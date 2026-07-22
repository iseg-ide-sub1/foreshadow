# Foreshadow 独立 VSCode 插件 SPEC v0.2（终稿）

> **状态**：已确认，作为实现基线  
> **撰写**：从 VirtualME 剥离「数据底座 + 动态上下文层」  
> **目标仓**：`iseg-ide-sub1/foreshadow`  
> **对照源**：`virtualme2`（只读）  
> **文档基准**：VirtualME `docs/FS架构设计说明书.md` §4–5、§7.1、§11

---

## 0. 元信息

| 项 | 值 |
|---|---|
| 插件名 | **Foreshadow** |
| publisher / id | `iseg-ide-sub1.foreshadow` |
| 版本起点 | `0.1.0` |
| 定位 | 可迁移架构的 IDE 动态上下文系统（数据底座 + Foreshadow 上下文层） |

---

## 1. 目标与非目标

### 1.1 目标（Must）

1. 完整数据底座：行为日志、工件抽取、RepoMap（硬关系 / 软关系 / ripgrep / 缓存）
2. 完整七项上下文：CursorContext、AttentionZone、SoftRelContext、KeywordContext、LastArtifactContext、History、Task
3. 随 IDE 行为实时增量更新
4. `Foreshadow.toJSONObject()` 结构化导出（含 `deduplicate`）
5. 完整 TaskRecognizer（周期识别 + 工具读码），经 **LLMPort**
6. 轻量 WebView 实时面板 + 导出命令
7. 可配置持久化目录，默认 `.foreshadow/`
8. **严格分层**：L2/L3 **零 `vscode` 依赖**；平台能力全部经 Port；事件一律经 L2 Ingress

### 1.2 非目标

- CursorPredictor 推理（LLM/规则）
- CPInterface / Tab 采纳
- Distiller / CPPair / cursor_listener.py
- line-comp-check
- 用户画像 / 知识点 / Q-Matrix
- 运行时依赖 VirtualME

---

## 2. 架构分层（硬约束）

```
L0 Extension Shell     → activate、contributes、DI 组装、WebView 壳
L1 Host Adapter        → 唯一允许 import 'vscode'（及 Node 实现 Port）
L2 Data Foundation     → 事件接收、结构化、存储、RepoMap、Task 编排（无 vscode）
L3 Context (Foreshadow)→ 七项上下文、去重、导出（无 vscode）
```

**依赖方向：**

```
L0 → L1 → L2 → L3
L1 实现 L2 声明的 Ports
L1 不直接调用 L3；光标/选中/编辑等一律 L1 → L2 Ingress →（L2 转发）→ L3
L2/L3 禁止 import 'vscode'（eslint no-restricted-imports）
```

### 2.1 目录

```
foreshadow/
├── package.json
├── src/
│   ├── extension.ts
│   ├── host/vscode/              # L1
│   │   ├── mapper.ts
│   │   ├── ports/
│   │   ├── event-bridge.ts
│   │   └── webview/
│   ├── foundation/               # L2
│   │   ├── ports/
│   │   ├── domain/
│   │   ├── ingress/
│   │   ├── log/
│   │   ├── repomap/
│   │   ├── task/
│   │   ├── kw/
│   │   └── runtime.ts
│   └── context/                  # L3
│       └── foreshadow.ts
├── scripts/ripgrep/
└── docs/SPEC-v0.2.md
```

---

## 3. 领域模型（L2/L3 通货）

```ts
interface FsUri { fsPath: string; scheme?: string }
interface Position { line: number; character: number }  // 0-based
interface Range { start: Position; end: Position }
interface Location { uri: FsUri; range: Range }
interface SymbolRef {
  name: string
  kind: ArtifactType
  selectionStart: Position
  range: Range
}
```

- `Artifact.location: Location`
- 用 `SymbolRef` / `selectionStart` 替代 `vscode.DocumentSymbol`
- L1 `VscodeMapper` 做双向映射

---

## 4. Host Ports（L2 声明，L1 实现）

| Port | 职责 |
|------|------|
| `DocumentPort` | 读文本/行数/打开文档 |
| `LanguageIntelPort` | symbols / definition / typeDef / refs / impl / call hierarchy / hover |
| `WorkspaceSearchPort` | ripgrep 全局搜索 |
| `WorkspacePort` | workspace roots、路径解析、dataDir |
| `FileSystemPort` | 读写落盘文件 |
| `ConfigPort` | 配置读写与变更 |
| `SchedulerPort` | interval/timeout |
| `LLMPort` | chat + tools（**LangChain 只在 L1**） |

L3 仅依赖 L2 的 `ContextQueryService`（代码片段 / 工件上下文 / 软关系 / grep / getArtifactFromRange）。

---

## 5. 事件模型

### 5.1 RawHostEvent（L1 → L2）

```ts
type RawHostEvent =
  | { type: 'textChanged'; uri; beforeText; afterText; changes }
  | { type: 'selectionChanged'; uri; selections; active; kind?: 'select' | 'cursor' }
  | { type: 'activeEditorChanged'; uri | null; previousUri? }
  | { type: 'fileRenamed'; oldUri; newUri }
  | { type: 'terminalCommand'; processId; cmd; output; phase: 'start' | 'end' }
```

### 5.2 路径（锁定）

```
VSCode API → L1 EventBridge → L2 EventIngress
  → LogStructurer / SoftRelObserver / cursor 路由
  → LogStore / TaskStore / RepoMap
  → L3 Foreshadow.updateBy*
```

**禁止** L1 直接 `Foreshadow.updateCursor`。

### 5.3 监听范围

保留：编辑、选中、活动编辑器切换、重命名、光标 active 变化、终端执行 start/end。  
去掉：lint、终端 open/close、hover、Python CursorJump、蒸馏。

### 5.4 History 过滤（相对 VirtualME 变更）

```ts
[EditTextDocument, SelectText, ExecuteTerminalCommand]
```

→ `mergeEditLogs` → 过滤 → `slice(-5)`  
`lastArtifact`：自后向前第一个带 `location` 的 Edit/Select（终端不参与）。

---

## 6. L2 / L3 职责

### L2 Foundation

- `EventIngress.publish`
- Raw → `LogItem` / `Artifact`
- LogStore / TaskStore / 持久化
- RepoMap 编排（算法在 L2，I/O 走 Port）
- SoftRel 观察与图谱
- kw-extract 纯算法 + 搜索走 Port
- TaskRecognizer：prune/cluster + **LLMPort** + DocumentPort 读码
- 向 L3 转发 `updateByLog / updateByCursor / updateByTask`

### L3 Foreshadow

- 七项上下文状态机
- `deduplicate` 优先级：  
  `CursorContext > AttentionZone > SoftRelContext > KeywordContext > LastArtifactContext`
- `toJSONObject` / `toAbstract` / `checkCompleteness` / `clone`

---

## 7. 配置与持久化

| Key | 默认 | 说明 |
|-----|------|------|
| `foreshadow.saveDir` | `.foreshadow` | 工作区相对数据目录 |
| `foreshadow.control.taskRecognize` | `true` | 任务识别开关 |
| `foreshadow.taskRecognizer.*` | — | baseURL / model / apiKey / temperature |

落盘均在 `{saveDir}/`，与 `.virtualme` 隔离。

---

## 8. UI / 命令

- 侧边栏 WebView：实时 JSON（~500ms）、completeness、logs/tasks 摘要
- 命令：`foreshadow.exportContext` / `copyContext` / `openPanel` / `gotoSettings`
- v0.1 单包内嵌 HTML

---

## 9. 验收

| ID | 标准 |
|----|------|
| A1 | 插件可独立安装/启动，无需 VirtualME |
| A2 | 编辑后 History 及时反映 Edit 日志 |
| A3 | 光标移动更新 CursorContext / AttentionZone |
| A4 | 编辑后 LastArtifactContext 异步填充 |
| A5 | 回环跳转可写入软关系并进入 SoftRelContext |
| A6 | KeywordContext 节流后经 ripgrep 更新 |
| A7 | 终端命令可进入 History |
| A8 | 配置 TaskRecognizer 后 Task 字段可更新 |
| A9 | `toJSONObject()` 含七字段结构且已去重 |
| A10 | WebView 实时展示；导出可落盘/复制 |
| A11 | 数据写入 `.foreshadow/`（或配置目录） |
| A12 | 无 predict / Tab 采纳 / 蒸馏 |
| A13 | `foundation/**`、`context/**` 无 `import 'vscode'` |
| A14 | LSP/文档/搜索/配置/落盘/LLM 均经 Port |
| A15 | fake ports 下可跑通结构化与导出 |

---

## 10. 实现分期

| 阶段 | 内容 |
|------|------|
| P0 | 脚手架、domain、ports、DI、eslint、WebView 占位 |
| P1 | EventBridge + Ingress + Log 结构化 |
| P2 | Ports 实现 + RepoMap/soft-rel/grep |
| P3 | L3 七项上下文 + 去重 + toJSONObject |
| P4 | TaskRecognizer + LLMPort |
| P5 | WebView 实时面板 + 导出 |
| P6 | A1–A15 验收 |

策略：**严格路径一次到位**（领域类型 + 全 Port）。

---

## 11. 已锁定决策

| 决策 | 结论 |
|------|------|
| Task | 完整 TaskRecognizer |
| 工程位置 | `iseg-ide-sub1/foreshadow` 独立仓 |
| UI | 轻量 WebView + 导出 |
| 日志 | 最小集 + 终端入 History |
| 持久化 | 可配置，默认 `.foreshadow/` |
| 推理引擎 | 不实现 |
| 去 vscode | **严格** L2/L3 零依赖 |
| 事件路径 | **一律经 L2 Ingress** |
| LLM | **L1 LLMPort**，L2 只调接口 |

---

## 12. 数据流

```
IDE 用户动作
    │
    ▼
L1 EventBridge  ──RawHostEvent──►  L2 EventIngress
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
               LogStructurer    SoftRelObserver    cursor route
                    │                 │                 │
                    ▼                 ▼                 ▼
               LogStore          SoftRelMap        Foreshadow (L3)
               TaskRecognizer ─► TaskStore ─► updateByTask
               RepoMap(ports) ◄──────────────── updateBy* 查询
                    │
                    ▼
               toJSONObject()  ◄── WebView / export
```
