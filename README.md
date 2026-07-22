# Foreshadow

独立 VSCode 插件：数据底座 + Foreshadow 动态上下文层。

## 架构

- L0 `src/extension.ts` 壳
- L1 `src/host/vscode/**` 唯一允许 `import 'vscode'`
- L2 `src/foundation/**` 无 vscode
- L3 `src/context/**` 无 vscode

依赖方向：L0 → L1 → L2 → L3。事件一律 L1 EventBridge → L2 EventIngress → L3。

详细说明见 [docs/架构说明书.md](docs/架构说明书.md)；实现基线见 [docs/SPEC-v0.2.md](docs/SPEC-v0.2.md)。

## 开发

完整入门（编译调试、架构约束下贡献）见 [docs/GetStarted.md](docs/GetStarted.md)。

```bash
pnpm install
pnpm compile
```

### 常用脚本

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 编译插件并以 Extension Development Host 启动调试（webpack watch） |
| `pnpm dev:ui` | 浏览器预览侧边栏 WebView UI（mock 数据，默认 http://127.0.0.1:5179） |
| `pnpm watch` | 仅 webpack 监听编译 |
| `pnpm compile` | 单次编译 |

说明：

- `pnpm dev` 会尝试调用本机 `cursor` / `code` CLI；也可在本仓库按 **F5**，使用 [`.vscode/launch.json`](.vscode/launch.json)。
- 若 CLI 不在 PATH，可设置 `FORESHADOW_EDITOR` 为可执行文件路径。
- UI 预览端口可用 `FORESHADOW_UI_PORT` 覆盖；设 `FORESHADOW_UI_NO_OPEN=1` 可不自动开浏览器。

## 配置

- `foreshadow.saveDir` 默认 `.foreshadow`
- `foreshadow.control.taskRecognize`
- `foreshadow.taskRecognizer.*`

## 命令

- `foreshadow.exportContext`
- `foreshadow.copyContext`
- `foreshadow.openPanel`
- `foreshadow.gotoSettings`
