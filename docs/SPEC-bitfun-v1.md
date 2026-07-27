# Foreshadow × BitFun 集成 SPEC v1.0

| 项 | 值 |
|---|---|
| 文档类型 | 集成 SPEC（实现基线） |
| 状态 | **已锁定**，可作为双仓实现依据 |
| 日期 | 2026-04-08 |
| 关联文档 | [SPEC-v0.2.md](./SPEC-v0.2.md)（VS Code Host 基线）、[架构说明书.md](./架构说明书.md) |
| Foreshadow 仓 | 独立 Git（本仓）；算法与 L2/L3 真相源 |
| BitFun 仓 | 独立 Git；仅 Host 适配、采集桥、设置、MCP 装配 |
| 集成版本标记 | `1.0.0-bitfun`（`@foreshadow/core` 可从 `0.2.x` 起发） |

> 与 `SPEC-v0.2` 冲突时：**BitFun Host 行为以本文件为准**；L2/L3「零平台依赖、事件一律经 Ingress」取更严约束。

---

## 0. 已锁定决策总表

| ID | 主题 | 结论 |
|----|------|------|
| D1 | 交付边界 | **彻底分仓**。BitFun 以 **npm 包** `@foreshadow/core` 引入（semver + lockfile）。不把核心并进 BitFun monorepo；禁止主线长期 `file:`。 |
| D2 | LanguageIntel | v1 **No-op**；`LastArtifactContext` **允许为空**。 |
| D3 | Prompt / Agent 工具 | **仅桩**；本轮不采集、不扩展 `RawHostEvent`。 |
| D4 | 终端 | 多会话；`phase: 'end'` 带完整输出；无 shell integration **降级跳过**；输出 **≤ 64KB/命令**。 |
| D5 | textChanged | Monaco / TipTap **增量 `changes` 优先**；L2 允许 `beforeText`/`afterText` 可选；EditHistory 用局部 diff + padding（可改 L2）。 |
| D6 | MCP API | 单工具；快照主体为 **`toJSONObject()`**。 |
| D7 | TaskRecognizer LLM | 复用 BitFun 已有模型配置；**优先 fast，无则 main**。 |
| D8 | UI | **仅在现有设置页增加分类/Tab**；不做独立上下文侧栏面板。 |
| D9 | Memory / PromptBuilder | **不自动注入** system prompt；仅 MCP 按需拉取。 |
| D10 | 远程工作区 | **自动降级，不提供**（含 peer device 模式）。 |
| D11 | Runtime 位置 | **与 BitFun 前端 / 采集同进程**（方案 A）。 |
| D12 | 数据目录 | **仅在有工作区时工作**；数据固定 `{workspaceRoot}/.foreshadow/`。 |
| D13 | Workspace 实例 | **按 workspace 多实例**（`Map`）。 |
| D14 | 授权 | **默认需用户授权** 后才采集 / 提供快照。 |
| D15 | Markdown | **TipTap Markdown 进入 v1** 采集范围。 |
| D16 | 包引入 | 主线 npm `@foreshadow/core` semver；仅 core 作者可短时 `file:` 联调（见 §2）。 |

---

## 1. 目标与非目标

### 1.1 目标（Must）

1. 在 BitFun **本地工作区** 中持续采集：代码编辑、Markdown 编辑、选区/光标、活动文件切换、文件重命名、终端命令（具备 shell integration 时）。
2. 事件一律映射为 `RawHostEvent`，经 L2 `EventIngress` 进入 Foreshadow；维护七项动态上下文（LSP 相关项 v1 可空）。
3. 通过 MCP Tool 向 Agent 暴露当前上下文：调用后返回以 **`toJSONObject()`** 为本体的整片快照。
4. 在 BitFun 设置中心提供 Foreshadow 配置：启用与授权、任务识别、模型策略（复用 BitFun 模型下拉语义）。
5. 远程工作区、无工作区、未授权时明确 **unavailable**，禁止半残运行。
6. 保持 Foreshadow L2/L3 **平台无关**；BitFun 只实现 L0/L1 与出口装配。

### 1.2 非目标（v1 明确不做）

- 修改 BitFun Agent Kernel / PromptBuilder 以自动注入 Foreshadow
- 在 BitFun 内直接运行原 `host/vscode` 或 VS Code Extension Host
- 独立侧边栏「上下文监视」面板（对等原 WebView 面板）
- LanguageIntel 完整实现与 `LastArtifactContext` 强制填充
- 用户 Prompt / Agent 工具调用轨迹入库
- 远程 SSH / peer 工作区上下文
- CursorPredictor、蒸馏、用户画像、Tab 采纳

---

## 2. 仓库、包与依赖

### 2.1 物理边界

```text
foreshadow/                          # 独立 Git（本仓）
├── packages/core                    # L2 foundation + L3 context → 发布 @foreshadow/core
├── packages/host-contract           # 可选：RawHostEvent / Port 类型（可并入 core 导出）
├── packages/mcp-server              # 可选：薄 MCP 查询入口（§4.3）
├── src/host/vscode/                 # 既有 VS Code L1（继续维护）
└── docs/
    ├── SPEC-v0.2.md
    ├── SPEC-bitfun-v1.md            # 本文件
    └── 架构说明书.md

BitFun/                              # 独立 Git
├── src/web-ui/
│   └── src/tools/foreshadow/        # 建议：L0 装配、L1 bridge、RuntimeMap、设置组件
│       或 features/foreshadow/
├── （package / pnpm workspace）
│   └── 依赖 "@foreshadow/core"
└── docs/plans/…                     # 可选：本 SPEC 副本便于 PR
```

### 2.2 npm 依赖策略（D1 / D16）

| 阶段 | BitFun 侧依赖示例 | 说明 |
|------|-------------------|------|
| 开发 / CI / 发布（现行） | `"@foreshadow/core": "^0.2.0"` | 从 npm registry 安装；lockfile 钉死解析版本 |
| 仅 core 作者临时联调 | 短时 `file:` / `link:` sibling | **不得**合入 BitFun 主线；联调后改回 semver |
| 禁止 | 将 foreshadow 源码树并入 BitFun monorepo 作为唯一真相源；长期提交 `file:` 本机路径 | 与「彻底分仓」+ 仓库卫生冲突 |

### 2.3 分层映射

| 层 | 位置 | 职责 |
|----|------|------|
| L0 Shell | BitFun web-ui 装配 | workspace 生命周期、授权、远程门闩、DI |
| L1 Host | BitFun `host/bitfun`（逻辑名） | EventBridge、Ports 实现、Config |
| L2 Foundation | `@foreshadow/core` | Ingress、Log/Task、RepoMap、TaskRecognizer… |
| L3 Context | `@foreshadow/core` | 七项上下文、`toJSONObject` / deduplicate |
| 出口 | MCP Tool 面 | 读取当前 workspace Runtime 的 `toJSONObject()` |

**硬约束：**

1. L1 **只** `runtime.publish(RawHostEvent)`，禁止直接 `Foreshadow.updateBy*`。
2. L2/L3 **禁止**依赖 BitFun、React、Tauri、Monaco、TipTap 类型。
3. 为 BitFun 所需的 L2 变更（如 `textChanged` 可选全文）在 **foreshadow 仓** 完成，并保持 VS Code Host 回归可用。

---

## 3. 运行时拓扑

### 3.1 总览（方案 A：同进程 Runtime）

```text
[ BitFun WebUI 进程 ]
  Monaco CodeEditor ──┐
  TipTap Markdown  ───┼─► ActivityCollector (L1)
  Terminal correlator─┤         │
  FS rename watch  ───┘         ▼
                        publish(RawHostEvent)
                                │
                                ▼
                   RuntimeMap[workspaceKey]  (L2+L3)
                                │
                                │ toJSONObject()
                                ▼
[ Agent 路径 ]  MCP Client ──► foreshadow_get_context
```

### 3.2 进程关系说明

| 组件 | 进程 | 说明 |
|------|------|------|
| 采集桥 + FoundationRuntime + Foreshadow 状态 | **BitFun UI 同进程** | 避免把每次击键跨进程灌入 Node |
| Agent 调用的 MCP | BitFun 作为 MCP Client；工具实现见 §4 | 可走现有 stdio MCP 基础设施（参考 BitFun `mcp/server/process.rs`） |
| 可选 `@foreshadow/mcp-server` 子进程 | 仅当需要「独立 MCP server 列表项」时 | **只做查询转发**，不在子进程维护主状态 |

**明确否定：** `spawn(node foreshadow)` 后自动拥有编辑器/终端事件——不可行。事件必须由 BitFun L1 注入 Runtime。

### 3.3 Workspace 多实例

```ts
type WorkspaceRuntimeEntry = {
  workspaceKey: string;       // 规范化本地 root path
  workspacePath: string;
  runtime: FoundationRuntime; // @foreshadow/core
  enabled: boolean;           // 授权且非远程且有工作区
  dataDir: string;            // `${workspacePath}/.foreshadow`
};

// 全局逻辑：Map<workspaceKey, WorkspaceRuntimeEntry>
```

| 场景 | 行为 |
|------|------|
| 打开/激活本地工作区 + 已授权 | 创建或恢复 entry，启动采集 |
| 切换当前工作区 | MCP 默认读 **当前** entry |
| 关闭/移除工作区 | dispose runtime，停采集 |
| 无工作区 | 不创建 runtime；MCP → `NO_WORKSPACE` |
| 远程 / peer | 不创建或暂停；MCP → `REMOTE_UNSUPPORTED` |
| 未授权 / 关闭开关 | 停 publish；MCP → `NOT_AUTHORIZED` |

远程判定：复用 BitFun `isRemoteWorkspace` / `WorkspaceKind.Remote`（及 peer device 模式同等降级）。

---

## 4. MCP 对外 API

### 4.1 工具定义

| 字段 | 值 |
|------|-----|
| Tool name | `foreshadow_get_context` |
| Title / 描述（英文） | Return the current Foreshadow IDE dynamic context snapshot for the active local workspace. |
| 输入 | 可选 `{ "workspacePath"?: string }`；省略则用当前活动工作区 |
| 成功输出 | JSON 对象或 JSON 字符串（实现二选一，**契约固定一种**并在实现 PR 写死）；形状见 §4.2 |
| 副作用 | 无；只读快照 |

### 4.2 成功载荷

**主体**为 `Foreshadow.toJSONObject()`（七项字段，导出前 `deduplicate`）。

推荐稳定外壳：

```json
{
  "schemaVersion": 1,
  "workspacePath": "D:/path/to/workspace",
  "generatedAt": "2026-04-08T00:00:00.000Z",
  "context": {
    "...": "toJSONObject() 七项字段"
  }
}
```

- Agent 以 `context` 为 Foreshadow 快照本体。
- v1 **不要求**返回 `getSnapshot()` 的 logs/tasks/abstract 扩展。
- `schemaVersion` 用于后续破坏性变更。

### 4.3 注册形态（实现可选，行为等价）

**推荐（v1 默认）：** BitFun 内建 tool / MCP 工具面直接读同进程 `RuntimeMap`。

**可选：** 独立 stdio server 进程，内部 IPC/命令向 UI 进程取快照；用户在 MCP 列表可见独立 server。配置示例：

```json
{
  "command": "node",
  "args": ["path/to/@foreshadow/mcp-server/dist/index.js"]
}
```

无论哪种，**状态权威源**都是 UI 进程 RuntimeMap。

### 4.4 权限

1. 设置中 **启用 Foreshadow** 为总开关（默认关）。
2. Agent 调用 `foreshadow_get_context` 走 BitFun **既有工具授权**（Permission / ToolApproval）；**默认需用户批准**（可「记住」则沿用现有 UX）。
3. 未启用或未授权 → 工具不可用或返回 `NOT_AUTHORIZED`。
4. **禁止**将快照自动写入 PromptBuilder / system prompt。

### 4.5 错误码

| Code | 含义 |
|------|------|
| `NO_WORKSPACE` | 无活动工作区 |
| `REMOTE_UNSUPPORTED` | 远程或 peer 模式已降级 |
| `NOT_AUTHORIZED` | 未启用或未授权 |
| `NOT_READY` | Runtime 未就绪 |
| `INTERNAL_ERROR` | 其它内部错误 |

错误 message：**英文**，无 emoji（对齐 BitFun 日志规范）。

---

## 5. 事件模型

### 5.1 RawHostEvent（L1 → L2）

在 v0.2 基础上，**放宽 textChanged 全文必填**（BitFun 增量路径）：

```ts
type TextChange = {
  range: Range; // 0-based Position
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

type RawHostEvent =
  | {
      type: 'textChanged';
      uri: FsUri;
      changes: TextChange[];
      beforeText?: string; // 可选；VS Code bridge 可继续填写
      afterText?: string;  // 可选
    }
  | {
      type: 'selectionChanged';
      uri: FsUri;
      selections: Range[];
      active: Position;
      kind?: 'select' | 'cursor';
    }
  | {
      type: 'activeEditorChanged';
      uri: FsUri | null;
      previousUri?: FsUri;
      lineCount?: number;
    }
  | {
      type: 'fileRenamed';
      oldUri: FsUri;
      newUri: FsUri;
    }
  | {
      type: 'terminalCommand';
      processId: string; // BitFun terminal session_id
      cmd: string;
      output: string;    // phase=end 时有效；已截断策略处理后
      phase: 'start' | 'end';
    };
```

路径锁定：

```text
BitFun IDE 能力 → L1 EventBridge → L2 EventIngress
  → Log / SoftRel / cursor 路由 → Store / RepoMap → L3 updateBy*
```

### 5.2 BitFun 覆盖矩阵

| RawHostEvent | BitFun 能力源 | 现状缺口 | v1 适配要求 |
|--------------|---------------|----------|-------------|
| `textChanged` | Monaco `ITextModel.onDidChangeContent`；`IModelContentChangedEvent.changes` | `CodeEditor` 多只用 `getValue()` 更新 dirty，**不外发** | 旁路挂 model listener；映射 1-based→0-based range；优先发 `changes` |
| `textChanged`（Markdown） | TipTap / MarkdownEditor 文档变更 | 无 Foreshadow 事件 | 发 `textChanged`；若无细粒度 changes，允许 `afterText` + 空 `changes`（L2 兼容） |
| `selectionChanged` | Monaco `onDidChangeCursorPosition` / `onDidChangeCursorSelection` | 仅状态栏 React state | 外发标准化事件；可轻度节流 |
| `activeEditorChanged` | content-canvas / FileTabManager / `isActiveTab` | 无统一 Foreshadow 事件 | tab 激活/切换时发 `uri` |
| `fileRenamed` | `file-system-changed` 的 `rename` + `from`（`FileSystemService`） | 需订阅 | 映射 `oldUri`/`newUri` 后 publish |
| `terminalCommand` | Rust：`CommandStarted` / `CommandFinished` / `Data`（含 `session_id`） | 前端 `TerminalService` 对 Started/Finished **直接丢弃** | 旁路 `listen('terminal_event')` 或透传；按 session+command_id 聚合 |

**结论：** 协议层 5/5 可覆盖；均需适配，无能力天花板硬阻塞。终端聚合为最重项。

### 5.3 textChanged 与 EditHistory（foreshadow L2 变更）

| 规则 | 说明 |
|------|------|
| 优先 `changes` | 由 changes 生成带 **上下 padding** 的局部 diff 块写入 Edit / History |
| 全文可选 | 缺 `beforeText`/`afterText` 不得抛错；VS Code 路径可继续传全文 |
| 合并击键 | 建议 debounce **300–800ms** 无输入或 blur 合并为一段 Edit，对齐 `mergeEditLogs` 语义 |
| 大文件 | 可跳过超大全文；以 changes 路径为主 |

### 5.4 终端聚合（D4）

```text
CommandStarted(session_id, command, command_id)
  → buf[session_id][command_id] = { cmd, chunks: [] }
  → publish terminalCommand { phase: 'start', output: '' }

Data(session_id, data)
  → 若该 session 存在 active command buffer，append data

CommandFinished(session_id, command_id, exit_code)
  → output = apply64k(join(chunks))
  → publish terminalCommand { phase: 'end', cmd, output }
  → clear buffer

无 shell integration（无 Started/Finished）
  → 不猜测命令边界；不写终端 History
```

**64KB 截断策略（锁定）：**

- 若 `output.length > 65536`（按 UTF-16 code unit 或实现选定的统一字节/字符口径，**实现时写死一种并单测**）：
  - 保留 **头部 32KB + 尾部 32KB**
  - 中间插入：`\n...[truncated]...\n`
- `processId` = `session_id` 字符串
- 多会话：按 `session_id` 分桶，互不覆盖

### 5.5 Prompt / Agent 桩（D3）

- 代码与文档预留 v2 扩展点注释即可。
- v1 **不**增加 RawHostEvent 变体，**不**写入 History。

---

## 6. Host Ports（BitFun 实现完整度）

| Port | v1 | 实现要点 |
|------|----|----------|
| `DocumentPort` | 必做 | `workspaceAPI` 读文件；打开缓冲优先 Monaco/TipTap 当前文本 |
| `LanguageIntelPort` | **No-op** | 全部安全返回空；不抛错；LastArtifact 空 |
| `WorkspaceSearchPort` | 必做 | 适配 BitFun workspace search / flashgrep；失败则 KeywordContext 空 |
| `WorkspacePort` | 必做 | roots、路径、`dataDir = {root}/.foreshadow` |
| `FileSystemPort` | 必做 | 读写 `.foreshadow/**` |
| `ConfigPort` | 必做 | 映射 BitFun Foreshadow 设置 |
| `SchedulerPort` | 必做 | `setInterval` / `setTimeout` + dispose |
| `LLMPort` | 必做 | 调用 BitFun 模型链路；模型选择 **fast → 否则 main**；失败只影响 Task |

L3 仅依赖 `ContextQueryService`（RepoMap），与 v0.2 一致。

---

## 7. 设置 UI（BitFun）

### 7.1 位置与形态

- **形态：** 现有设置中心 **新增 Tab**（分类内一项），**不是**独立工作区面板。
- **建议挂载：** `smartCapabilities` 分类（与 MCP / Memories 同级）。
- **改动索引：**
  - `src/web-ui/src/app/scenes/settings/settingsConfig.ts`：`ConfigTab` 增加 `'foreshadow'`
  - `SettingsScene.tsx`：渲染 `ForeshadowConfig`
  - i18n：`settings` namespace 增加 label / description / 文案（遵守 BitFun i18n 规范）

### 7.2 设置项

| 项 | 类型 | 说明 |
|----|------|------|
| 启用 Foreshadow | 开关 | 默认 off；开启触发授权/说明 |
| 授权状态 | 只读 + 操作 | 已授权 / 未授权；与工具权限联动 |
| 任务识别 | 开关 | → `taskRecognize` |
| 任务模型 | BitFun 模型下拉 | 展示可选模型；运行时策略仍 **fast 优先否则 main**（可在 UI 说明） |
| 数据目录 | 只读 | `{workspace}/.foreshadow`；无工作区时显示 N/A |
| 运行状态 | 只读 | `ready` / `no_workspace` / `remote_disabled` / `not_authorized` / `not_ready` |
| MCP 说明 | 只读 | 工具名 `foreshadow_get_context`；可链到 MCP 工具设置页 |

**不做：** 实时七项 JSON 侧栏、500ms 刷画面板（可列 v1.1）。

---

## 8. 授权与隐私

1. 默认 **关闭** 采集与 MCP 提供。
2. 用户在设置中启用时，展示采集范围说明：代码片段、选区、路径、终端输出（截断后）等。
3. Agent 调用快照工具：默认 **ask** 授权，复用 BitFun 权限体系，不平行发明框架。
4. 关闭或撤权：立即停止 `publish`；磁盘历史可保留但不更新；MCP 拒绝。
5. 产品日志与错误：**英文**、无 emoji。

---

## 9. 与 BitFun 既有系统关系

| 系统 | 关系 |
|------|------|
| Memory / Insights | 无读写耦合 |
| PromptBuilder / system prompt | **不注入** |
| SessionContextStore | 不替换会话消息列表 |
| MCP 设置页 | 可发现工具；启用与授权以 Foreshadow 设置 + Permission 为准 |
| OpenCode 插件路径 | 不使用 |
| 现有 Monaco / 终端 / 文件监听 | 仅旁路采集，避免大改内核逻辑 |

---

## 10. BitFun 代码落点（实现索引）

| 区域 | 预期路径 / 锚点 | 职责 |
|------|-----------------|------|
| 功能根 | `src/web-ui/src/tools/foreshadow/` 或 `features/foreshadow/` | RuntimeMap、门闩、bridge |
| EventBridge | `.../host/event-bridge.ts` | 五类事件 → RawHostEvent |
| Monaco | 轻触 `tools/editor/components/CodeEditor.tsx` 或旁路 service | content/selection |
| Markdown | `MarkdownEditor` / `meditor` | text/selection/active |
| 终端 | 旁路 `terminal_event`；参考 `TerminalService.ts`（当前丢弃命令生命周期） | 聚合 start/data/end |
| 重命名 | `FileSystemService.watch` | fileRenamed |
| 设置 | `settingsConfig` + `ForeshadowConfig` | UI |
| MCP | desktop/assembly 注册 tool 或薄 server | `foreshadow_get_context` |
| 依赖 | web-ui `package.json` | `@foreshadow/core` |

**原则：** 最小侵入；Foreshadow 业务逻辑不进入 Monaco 内部实现。

---

## 11. foreshadow 仓必做变更

1. 提供可被 npm 消费的 **library entry**（`@foreshadow/core`），而非仅 VS Code extension bundle。
2. `RawHostEvent.textChanged`：`beforeText`/`afterText` 可选；Ingress/Edit 结构化支持 **仅 changes**。
3. `LanguageIntelPort` 可注入 No-op 全路径不抛错。
4. 保持 `host/vscode` 行为可回归（全文 textChanged 仍可用）。
5. 文档：本 SPEC 维护于 `docs/SPEC-bitfun-v1.md`；架构说明书在实现后可补「BitFun Host」小节。

---

## 12. 验收标准

| ID | 标准 |
|----|------|
| B1 | 本地工作区 + 已授权：Monaco 编辑后 History 出现 Edit 类日志 |
| B2 | 光标/选区变化更新 CursorContext（相关路径不崩溃） |
| B3 | 切换编辑 tab 产生 activeEditor 侧效果（日志或上下文可观察） |
| B4 | 文件重命名进入 Foreshadow 日志路径 |
| B5 | 有 shell integration 时，命令 end 进入 History，且 output 遵守 64KB 策略 |
| B6 | 无 shell integration 时 **不伪造** 终端 History |
| B7 | `foreshadow_get_context` 成功返回含七字段结构的 `context`（来自 `toJSONObject`） |
| B8 | `LastArtifactContext` 允许为空；无 LSP 不报错 |
| B9 | 远程 / peer：采集与 MCP 不可用，设置页状态正确 |
| B10 | 未授权：不采集；工具拒绝或不可用 |
| B11 | 多工作区实例隔离；切换后快照对应当前工作区 |
| B12 | 持久化位于 `{workspace}/.foreshadow/` |
| B13 | PromptBuilder **无**自动注入 |
| B14 | TipTap Markdown 编辑可产生 textChanged（或文档约定的等价事件） |
| B15 | 模型可用时 Task 可更新；LLM 失败不影响其它上下文字段 |
| B16 | BitFun 可通过 npm 依赖 `@foreshadow/core`（`^x.y.z` + lockfile）完成构建 |

---

## 13. 实现分期

| 阶段 | 内容 | 仓库 |
|------|------|------|
| P0 | core 库导出；textChanged 兼容；No-op LanguageIntel 契约 | foreshadow |
| P1 | RuntimeMap、workspace/远程/授权门闩、设置 Tab | BitFun |
| P2 | Monaco + activeEditor + rename 采集 | BitFun |
| P3 | 终端 correlator（多会话、64KB、降级） | BitFun |
| P4 | TipTap Markdown 采集 | BitFun |
| P5 | Document/Search/FS/Config/LLM Ports + TaskRecognizer | BitFun |
| P6 | `foreshadow_get_context` + 工具权限 | BitFun |
| P7 | npm 发布；BitFun 主线依赖改为 `@foreshadow/core` semver；B1–B16 验收 | 双仓；见 [PUBLISH-npm-bitfun.md](./PUBLISH-npm-bitfun.md) 与 BitFun `docs/plans/foreshadow-bitfun-release-and-acceptance-v1.md` |

---

## 14. 风险与缓解

| 风险 | 缓解 |
|------|------|
| CodeEditor 未外发 changes | 旁路 model listener，避免重写保存/dirty 主路径 |
| TerminalService 丢弃命令事件 | 独立 `terminal_event` 监听与聚合 |
| 终端/编辑内存膨胀 | 64KB/命令 + Foreshadow 既有 log 上限常量 |
| Search Port 与 flashgrep 差异 | Keyword 失败则空，不阻断主路径 |
| 双仓版本漂移 | 发布后 BitFun 锁 npm semver + lockfile；禁止主线 file: 漂移 |
| 权限 UX 分裂 | 100% 复用现有 tool permission |
| Markdown 无细粒度 diff | L2 兼容 after-only / 空 changes |

---

## 15. v1.1 候选（非承诺）

- 独立上下文预览面板
- LanguageIntel / LastArtifact 填充
- Prompt / Agent 工具 RawHostEvent
- 远程工作区只读子集
- `getSnapshot` 扩展 tool 或 query flag

---

## 16. 术语

| 术语 | 含义 |
|------|------|
| RuntimeMap | 按 workspace 持有的 FoundationRuntime 集合 |
| 采集桥 / ActivityCollector | BitFun L1：把 IDE 能力变成 RawHostEvent |
| 整片快照 | `toJSONObject()` 结果（外加可选 schema 外壳） |
| 降级 | 明确不提供能力，而非错误半状态 |
| 分仓 + npm | 两 Git 仓；运行时以包依赖耦合，而非 monorepo 合并 |

---

## 17. 文档维护

- 行为变更若触及：进程拓扑、五类事件、MCP 契约、授权、远程门闩、包依赖策略，必须更新本文件。
- VS Code 专用行为继续以 `SPEC-v0.2.md` 为准；共享 L2/L3 变更需两边验收（B 系列 + A 系列相关项）。
