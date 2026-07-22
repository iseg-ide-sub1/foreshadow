import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  LLMChatResult,
  LLMMessage,
  LLMPort,
  LLMToolDefinition,
} from '../../../foundation/ports/llm-port';
import { ConfigPort } from '../../../foundation/ports/config-port';

export class LangChainLLMPort implements LLMPort {
  constructor(private readonly config: ConfigPort) {}

  isConfigured(): boolean {
    const apiKey = this.config.get<string>('foreshadow.taskRecognizer.apiKey', '');
    return !!apiKey && apiKey.trim().length > 0;
  }

  async chat(messages: LLMMessage[], tools?: LLMToolDefinition[]): Promise<LLMChatResult> {
    if (!this.isConfigured()) {
      return { content: '' };
    }
    const model = this.config.get<string>('foreshadow.taskRecognizer.model', 'deepseek-v3');
    const temperature = this.config.get<number>('foreshadow.taskRecognizer.temperature', 0.7);
    const apiKey = this.config.get<string>('foreshadow.taskRecognizer.apiKey', '');
    const baseURL = this.config.get<string>(
      'foreshadow.taskRecognizer.baseURL',
      'https://api.chatanywhere.tech/v1',
    );

    let llm: any = new ChatOpenAI({
      model,
      temperature,
      configuration: { apiKey, baseURL },
    });

    const lcTools =
      tools?.map(
        t =>
          new DynamicStructuredTool({
            name: t.name,
            description: t.description,
            schema: t.schema,
            func: async (args: any) => t.func(args),
          }),
      ) || [];
    if (lcTools.length > 0) {
      llm = llm.bindTools(lcTools);
    }

    const lcMessages = messages.map(m => {
      if (m.role === 'system') return new SystemMessage(m.content);
      if (m.role === 'user') return new HumanMessage(m.content);
      if (m.role === 'assistant') return new AIMessage(m.content);
      return new ToolMessage({ content: m.content, tool_call_id: m.tool_call_id || '' });
    });

    const response = await llm.invoke(lcMessages);
    const tool_calls = (response.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.name,
      args: tc.args || {},
    }));
    return {
      content: typeof response.content === 'string' ? response.content : String(response.content ?? ''),
      tool_calls,
      raw: response,
    };
  }
}
