import { LogItem } from '../domain/log-item';
import { Task } from '../domain/task';
import { cluster, prune, EdgeTypeResolver } from './relation-utils';
import { ConfigPort } from '../ports/config-port';
import { DocumentPort } from '../ports/document-port';
import { LLMPort, LLMMessage, LLMToolDefinition } from '../ports/llm-port';
import { SchedulerPort } from '../ports/scheduler-port';
import { autoRecognizeTaskInterval } from '../config/constants';
import { parseAIResponseWithDetails } from '../utils/json-parser';
import { makePosition, makeRange } from '../domain/geometry';

const recPrompt = `
你是一个 IDE 任务识别助手。下面给出了用户最近的操作日志。
请根据日志分析用户当前正在做的事情。
1. 只依据日志本身的内容进行分析
2. 当日志信息不足时，可以调用 read_code 工具读取相关代码辅助判断
3. 任务描述应具体明确，避免过于宽泛

要求：
1. 围绕日志中实际发生的操作进行归纳
2. 如果日志不够明确（例如只是浏览或搜索），可以调用 read_code 读取相关文件（优先读取被编辑的文件）辅助理解
3. 不要编造日志中不存在的信息

工具说明：
- read_code: 读取指定文件的指定行范围内容，参数：filepath(文件路径)、startLine(起始行号)、endLine(结束行号)

输出要求：
1. taskName(任务名称，不超过20字)
2. taskDescription(任务描述，具体说明用户意图，不超过200字)
3. 使用中文输出

以JSON格式输出：
{
  "taskName": "任务名称",
  "taskDescription": "任务描述"
}

只输出JSON。
`;

export class TaskRecognizer {
  private isRecognizing = false;
  private lastRecognizeTimestamp = 0;
  private disposables: Array<{ dispose(): void }> = [];

  constructor(
    private readonly llm: LLMPort,
    private readonly documents: DocumentPort,
    private readonly config: ConfigPort,
    private readonly scheduler: SchedulerPort,
    private readonly getEdgeType: EdgeTypeResolver,
    private readonly getLogs: () => LogItem[],
    private readonly onTasks: (tasks: Task[]) => void,
  ) {}

  start() {
    this.disposables.push(
      this.scheduler.setInterval(() => {
        if (!this.config.get<boolean>('foreshadow.control.taskRecognize', true)) return;
        this.recognizeTask([...this.getLogs()])
          .then(r => {
            if (r.length > 0) this.onTasks(r);
          })
          .catch(error => console.error(error));
      }, autoRecognizeTaskInterval),
    );
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  private createReadCodeTool(): LLMToolDefinition {
    return {
      name: 'read_code',
      description: '读取指定文件的指定行范围内容',
      schema: {
        type: 'object',
        properties: {
          filepath: { type: 'string', description: '文件路径' },
          startLine: { type: 'number', description: '起始行号(1-based)' },
          endLine: { type: 'number', description: '结束行号(1-based)' },
        },
        required: ['filepath', 'startLine', 'endLine'],
      },
      func: async ({ filepath, startLine, endLine }) => {
        const doc = await this.documents.openDocument(filepath);
        if (!doc) return `Cannot open file: ${filepath}`;
        const start = Math.max(0, (startLine || 1) - 1);
        const end = Math.min(doc.lineCount - 1, (endLine || startLine || 1) - 1);
        return doc.getText(makeRange(makePosition(start, 0), makePosition(end, Number.MAX_SAFE_INTEGER)));
      },
    };
  }

  private async recognizeTaskFromCluster(clusterLogs: LogItem[]): Promise<Task> {
    let taskName = '未命名任务';
    let taskDescription = new Date().toLocaleString();
    if (!this.llm.isConfigured()) {
      return new Task('unconfigured', 'TaskRecognizer LLM not configured', clusterLogs);
    }
    try {
      const logAbs = clusterLogs.map(log => log.toAbstract()).join('\n');
      const messages: LLMMessage[] = [{ role: 'system', content: recPrompt + logAbs }];
      const tools = [this.createReadCodeTool()];
      let response = await this.llm.chat(messages, tools);
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          if (toolCall.name === 'read_code') {
            try {
              const codeContent = await tools[0].func(toolCall.args);
              messages.push({ role: 'assistant', content: response.content || '' });
              messages.push({
                role: 'tool',
                content: `已读取 ${toolCall.args.filepath} 第${toolCall.args.startLine}-${toolCall.args.endLine}行内容如下：\n\`\`\`\n${codeContent}\n\`\`\``,
                tool_call_id: toolCall.id,
              });
            } catch (error) {
              messages.push({
                role: 'tool',
                content: `读取失败: ${error instanceof Error ? error.message : '未知错误'}`,
                tool_call_id: toolCall.id,
              });
            }
          }
        }
        messages.push({
          role: 'user',
          content: '请根据以上所有信息分析用户当前任务，并以JSON格式输出。',
        });
        response = await this.llm.chat(messages, tools);
      }
      const content = response.content as string;
      const parseResult = parseAIResponseWithDetails(content, 'TaskRecognizer');
      if (parseResult.success && parseResult.data) {
        const parsed = parseResult.data as any;
        taskName = parsed.taskName || taskName;
        taskDescription = parsed.taskDescription || taskDescription;
      } else {
        taskDescription = `解析返回结果失败: ${String(content).substring(0, 200)}...`;
      }
      return new Task(taskName, taskDescription, clusterLogs);
    } catch (error: any) {
      console.error('Error in recognizeTaskFromCluster:', error);
      return new Task(taskName, `${taskDescription} (${error?.message || error})`, clusterLogs);
    }
  }

  async recognizeTask(logs: LogItem[]): Promise<Task[]> {
    if (!this.config.get<boolean>('foreshadow.control.taskRecognize', true)) {
      return [];
    }
    if (!this.llm.isConfigured()) {
      console.warn('TaskRecognizer LLM not configured, skip');
      return [];
    }
    logs = logs.filter(log => Date.parse(log.timeStamp) > this.lastRecognizeTimestamp);
    if (logs.length === 0 || this.isRecognizing) return [];
    this.isRecognizing = true;
    try {
      logs = await prune(logs);
      const clustersAll = await cluster(logs, this.getEdgeType);
      const clusters = clustersAll.filter(c => c.length > 0);
      if (clusters.length === 0) return [];
      const results = await Promise.allSettled(clusters.map(c => this.recognizeTaskFromCluster(c)));
      const tasks = results
        .filter((result): result is PromiseFulfilledResult<Task> => result.status === 'fulfilled')
        .map(result => result.value);
      this.lastRecognizeTimestamp = Math.max(
        this.lastRecognizeTimestamp,
        Date.parse(logs[logs.length - 1].timeStamp),
      );
      return tasks;
    } finally {
      this.isRecognizing = false;
    }
  }
}
