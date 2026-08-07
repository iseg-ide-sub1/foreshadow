# Foreshadow 开发入门（Get Started）

本文面向要在本仓库上编译、调试和贡献代码的开发者。产品设计与分层约束的完整说明见 [架构说明书.md](./架构说明书.md)。

---

## 1. 环境要求

| 项 | 要求 |
|----|------|
| Node.js | 建议 18+ |
| 包管理 | **pnpm**（仓库使用 `pnpm-lock.yaml`） |
| 编辑器 | VS Code 或 Cursor，`engines.vscode` ≥ `^1.80.0` |
| 可选 CLI | `code` 或 `cursor` 在 PATH 中（`pnpm dev` 会调用） |

克隆仓库后安装依赖：

```bash
pnpm install
```

---

## 2. 编译与构建

### 2.1 常用脚本

| 命令 | 作用 |
|------|------|
| `pnpm compile` | 单次 webpack 编译 → `out/extension/extension.js` |
| `pnpm watch` | webpack 监听模式，改 TS 后自动重编 |
| `pnpm package` | production 打包（`vscode:prepublish` 会调用） |
| `pnpm lint` | ESLint 检查 `src/` |
| `pnpm vsce:package` | 打出 `.vsix`（`--no-dependencies`） |
| `pnpm dev` / `pnpm dev:ext` | 编译 +（可选 watch）+ 拉起 Extension Development Host |
| `pnpm dev:ui` | 浏览器预览侧边栏 WebView（mock 数据） |

入口与产物：

- 源入口：`src/extension.ts`
- 打包配置：`webpack.config.js`
- 运行入口（`package.json` → `main`）：`./out/extension/extension.js`

### 2.2 仅编译

```bash
pnpm compile
# 或持续编译
pnpm watch
```

编译成功后应存在 `out/extension/extension.js`（及 source map）。

### 2.3 打包发布（可选）

```bash
pnpm package          # production webpack
pnpm vsce:package     # 生成 foreshadow-x.y.z.vsix
```

在目标编辑器中用 “Install from VSIX…” 安装即可，**无需**依赖 VirtualME。

---

## 3. 调试插件

有两种推荐路径：**F5（launch.json）** 与 **`pnpm dev`**。

### 3.1 方式 A：在仓库内按 F5（推荐）

1. 用 VS Code / Cursor **打开 foreshadow 仓库根目录**（含 `package.json` 的那一层）。
2. 选择启动配置：
   - **Run Foreshadow Extension**：`preLaunchTask` = `pnpm: compile`，编译一次后启动 Extension Host。
   - **Run Foreshadow Extension (watch)**：`preLaunchTask` = `pnpm: watch`，适合持续改代码。
3. 按 **F5**（或 Run and Debug）。
4. 会打开 **Extension Development Host** 新窗口；在该窗口中打开任意工作区文件夹进行验证。

相关文件：

- [`.vscode/launch.json`](../.vscode/launch.json)
- [`.vscode/tasks.json`](../.vscode/tasks.json)

调试技巧：

- 在 `src/**/*.ts` 打断点；`outFiles` 已指向 `out/extension/**/*.js`。
- Host 窗口中打开 **输出 / 开发者工具** 查看 `console.log`（如 `Foreshadow activating...`）。
- 改完 L1/L2/L3 代码后：watch 模式下重新加载窗口（Command Palette → **Developer: Reload Window**）即可加载新 bundle。

### 3.2 方式 B：`pnpm dev`

```bash
pnpm dev
```

脚本行为（`scripts/dev-extension.mjs`）：

1. 先执行一次 webpack 编译；
2. 默认再起 `webpack --watch`；
3. 查找 Cursor / VS Code CLI，并以  
   `--extensionDevelopmentPath=<仓库根>` 启动 Extension Development Host。

环境变量：

| 变量 | 含义 |
|------|------|
| `FORESHADOW_EDITOR` | 指定编辑器可执行文件路径（CLI 不在 PATH 时） |
| `FORESHADOW_DEV_WORKSPACE` | 启动 Host 时顺带打开的工作区路径 |
| `FORESHADOW_DEV_WATCH` | 设为 `1` 强制 watch（`pnpm dev` 已带 `--watch`） |

若找不到 CLI：

- 脚本会提示设置 `FORESHADOW_EDITOR`，或改用 F5；
- watch 可能仍在运行，用 Ctrl+C 结束。

### 3.3 验证功能清单（冒烟）

在 Extension Development Host 中：

1. 侧边栏出现 **Foreshadow** 图标，打开 **Foreshadow Context** 面板，约 500ms 刷新快照。
2. 编辑文件 → History / 日志摘要应出现 `EditTextDocument`。
3. 移动光标 → `cursorContext` / `attentionZone` 更新。
4. 有选区 → 可能产生 `SelectText` 日志。
5. 终端执行命令（需编辑器支持 shell execution API）→ History 可出现 `ExecuteTerminalCommand`。
6. 命令面板：
   - `Foreshadow: Export Context` → 写入 `{saveDir}/context-<ts>.json`
   - `Foreshadow: Copy Context` → 剪贴板
   - `Foreshadow: Open Panel` / `Open Settings`

### 3.4 配置项（Settings）

| Key | 默认 | 说明 |
|-----|------|------|
| `foreshadow.saveDir` | `.foreshadow` | 工作区相对数据目录（日志/任务/软关系等） |
| `foreshadow.control.taskRecognize` | `true` | 周期任务识别开关 |
| `foreshadow.taskRecognizer.baseURL` | OpenAI 兼容地址 | LLM 网关 |
| `foreshadow.taskRecognizer.model` | 模型名 | TaskRecognizer 使用 |
| `foreshadow.taskRecognizer.apiKey` | `""` | 空则安全跳过 LLM 调用 |
| `foreshadow.taskRecognizer.temperature` | `0.7` | 采样温度 |

---

## 4. 单独预览 WebView UI

侧边栏 UI 为单文件 HTML：`media/panel.html`。不启动插件时可用 mock 数据预览：

```bash
pnpm dev:ui
```

- 默认地址：`http://127.0.0.1:5179/`
- 每约 800ms 推送一轮 mock snapshot
- `FORESHADOW_UI_PORT`：改端口
- `FORESHADOW_UI_NO_OPEN=1`：不自动打开浏览器

真实 IDE 数据路径：`ForeshadowPanelProvider` 每 `UIUpdateInterval`（500ms）调用 `FoundationRuntime.getSnapshot()` 并 `postMessage`。

改 UI 时：

1. 改 `media/panel.html`；
2. `pnpm dev:ui` 刷新浏览器即可看布局；
3. 插件内验证需 Reload Extension Host（HTML 在 resolve 时读取）。

---

## 5. 架构约束下的 Contribute

### 5.1 四层与依赖方向（硬约束）

```
L0 Extension Shell     src/extension.ts
L1 Host Adapter        src/host/vscode/**     ← 唯一允许 import 'vscode'
L2 Data Foundation     src/foundation/**      ← 禁止 vscode
L3 Context             src/context/**         ← 禁止 vscode
```

**依赖方向只能是：**

```
L0 → L1 → L2 → L3
```

细则：

1. **L1 实现 L2 声明的 Ports**（`src/foundation/ports/*` 接口，`src/host/vscode/ports/*` 实现）。
2. **L1 不得直接调用 L3**（禁止 `new Foreshadow` / `foreshadow.updateCursor` 等从 host 直调）。
3. **事件一律**：VSCode API → L1 `EventBridge` → `FoundationRuntime.publish` → L2 `EventIngress` → 存储 / RepoMap / L3。
4. **LangChain / OpenAI SDK 只出现在 L1**（`LangChainLLMPort`）；L2 `TaskRecognizer` 只依赖 `LLMPort`。
5. **L3 只依赖** `ContextQueryService`（当前由 `RepoMap` 实现），不碰具体 Port 实现。

ESLint 已对 `src/foundation/**`、`src/context/**` 启用 `no-restricted-imports` 禁止 `vscode`（见 `eslint.config.mjs`）。提交前请运行：

```bash
pnpm lint
```

### 5.2 改代码时该落在哪一层？

| 你想做的事 | 应修改的位置 |
|------------|--------------|
| 监听新的 IDE 事件、映射 vscode 类型 | L1 `event-bridge.ts` / `mapper.ts` |
| 增加平台能力（读文件、搜代码、LLM…） | L2 先声明 Port → L1 再实现 |
| 日志结构化、持久化、RepoMap、软关系、Task 编排 | L2 `foundation/**` |
| 七项上下文算法、去重、导出 JSON | L3 `context/foreshadow.ts` |
| 组装 DI、注册命令/WebView | L0 `extension.ts` + L1 `commands` / `webview` |
| 面板展示样式与前端逻辑 | `media/panel.html`（由 L1 provider 加载） |
| 阈值常量 | `foundation/config/constants.ts` |

### 5.3 领域类型（L2/L3 通货）

L2/L3 **不要**使用 `vscode.Uri` / `vscode.Position` 等。统一使用：

- `FsUri`、`Position`、`Range`、`Location`、`SymbolRef`（`foundation/domain/geometry.ts` 等）
- L1 `VscodeMapper` 负责 vscode ↔ 领域类型双向转换

新增跨层数据时：先在 `foundation/domain` 定义，再在 L1 mapper 补映射。

### 5.4 事件与 History 约定

`RawHostEvent` 类型（`foundation/domain/raw-events.ts`）：

- `textChanged` / `selectionChanged` / `activeEditorChanged` / `fileRenamed` / `terminalCommand`

进入 Foreshadow **History** 的日志类型（过滤后 `mergeEditLogs` → `slice(-5)`）：

- `EditTextDocument`
- `SelectText`
- `ExecuteTerminalCommand`

`lastArtifact`：自后向前第一个带 `location` 的 Edit/Select；**终端日志不参与** lastArtifact。

### 5.5 上下文导出与去重

- 对外结构：`Foreshadow.toJSONObject()`（导出前会 `deduplicate`）
- 去重优先级：  
  `CursorContext > AttentionZone > SoftRelContext > KeywordContext > LastArtifactContext`
- 另有：`toAbstract()` / `checkCompleteness()` / `clone()`

WebView / 命令应通过 `FoundationRuntime.getSnapshot()` 或 `exportContextJson()` 取数，不要在 L1 拼装七项字段。

### 5.6 推荐贡献流程

1. **读文档**：本文 + 架构说明书相关章节。
2. **开分支**，改动尽量落在**单一层次**；跨层变更时先 Ports/领域类型，再实现。
3. **本地验证**：
   - `pnpm lint`
   - `pnpm compile`
   - F5 或 `pnpm dev` 冒烟（见 §3.3）
   - 若动 UI：`pnpm dev:ui` + Host 内面板
4. **自检清单**：
   - [ ] `foundation/**`、`context/**` 无 `import 'vscode'`
   - [ ] 新平台 I/O 走 Port，未在 L2/L3 直接 `fs`/`child_process` 绑死 Node（落盘等经 `FileSystemPort`）
   - [ ] 新 IDE 事件经 `EventBridge` → `RawHostEvent` → `EventIngress`，未直调 L3
   - [ ] LLM 仅经 `LLMPort`
   - [ ] 未引入 CursorPredictor / Distiller / 用户画像等 **非目标** 能力
5. **PR 说明**：写清改动层、事件/Port 变更、如何手动验证。

### 5.7 明确不要做的事

- 在 `foundation` / `context` 中 `import * as vscode`
- L1 直接 `runtime.foreshadow.updateByCursor(...)`（应 `runtime.publish(event)`）
- 在 L2 引入 `@langchain/*` 实现类
- 把 VirtualME 的 CP 推理、Tab 采纳、蒸馏、知识点等模块原样塞回本仓
- 提交真实 `apiKey` 到仓库或默认配置

### 5.8 目录速查

```
foreshadow/
├── package.json                 # 插件 manifest + scripts
├── webpack.config.js
├── eslint.config.mjs            # L2/L3 禁 vscode
├── media/panel.html             # WebView UI
├── scripts/
│   ├── dev-extension.mjs        # pnpm dev
│   ├── dev-ui.mjs               # pnpm dev:ui
│   └── ripgrep/                 # 工作区搜索二进制
├── src/
│   ├── extension.ts             # L0
│   ├── host/vscode/             # L1
│   ├── foundation/              # L2
│   └── context/foreshadow.ts    # L3
└── docs/
    ├── GetStarted.md            # 本文
    └── 架构说明书.md
```

---

## 6. 常见问题

**Q: F5 后侧边栏没有 Foreshadow？**  
确认打开的是 Extension Development Host 窗口；`activationEvents` 为 `onStartupFinished`，稍等或执行 `Foreshadow: Open Panel`。

**Q: 编译成功但断点不进？**  
确认 `out/extension/**/*.js` 已更新，且 launch 的 `outFiles` 匹配；优先用 source map 的 TS 断点。

**Q: Task 一直为空？**  
检查 `foreshadow.control.taskRecognize` 与 `taskRecognizer.apiKey`；空 key 会安全跳过 LLM。识别周期见 `autoRecognizeTaskInterval`（默认 60s）。

**Q: 终端命令进不了 History？**  
依赖编辑器的 `onDidStart/EndTerminalShellExecution` API；旧版 VS Code 可能没有这些事件。

**Q: 想换 Host（非 VS Code）？**  
保留 L2/L3 不动；新增 `src/host/<platform>/`，实现全部 Ports + 等价 EventBridge，在对应壳里组装 `FoundationRuntime`。这是本架构的核心目标之一。

---

## 7. 相关文档

- [架构说明书.md](./架构说明书.md) — 背景、功能、架构与模块说明
- 仓库根 [README.md](../README.md) — 简要索引
- BitFun 集成 SPEC（`SPEC-bitfun-v1.md`）与 `@foreshadow/core` 发布说明（`PUBLISH-npm-bitfun.md`）已移出本仓，归档至工作区级过程文档目录 `proc_doc/`
