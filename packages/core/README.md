# `@foreshadow/core`

Platform-agnostic Foreshadow **L2 foundation + L3 context** library for IDE hosts
(BitFun, VS Code extension shell, future hosts).

## Install

```bash
npm install @foreshadow/core
# or
pnpm add @foreshadow/core
```

## Usage (host sketch)

```ts
import {
  FoundationRuntime,
  NoopLanguageIntelPort,
  type FoundationPorts,
  type RawHostEvent,
} from '@foreshadow/core';

const ports: FoundationPorts = {
  documents: /* DocumentPort */,
  languageIntel: NoopLanguageIntelPort /* or real impl */,
  workspace: /* WorkspacePort */,
  search: /* WorkspaceSearchPort */,
  fs: /* FileSystemPort */,
  config: /* ConfigPort */,
  scheduler: /* SchedulerPort */,
  llm: /* LLMPort */,
};

const runtime = new FoundationRuntime(ports);
runtime.start();

await runtime.publish(event as RawHostEvent);
const { context } = runtime.getSnapshot(); // context === foreshadow.toJSONObject()
```

Hosts **must not** import VS Code types into this package. Implement ports in the host layer.

## Develop / publish

From this package:

```bash
pnpm sync          # copy repo src/foundation + src/context + src/core.ts → ./src
npm pack --dry-run # verify tarball contents
npm publish --access public
```

`prepack` / `prepublishOnly` run `sync` automatically.

See `PUBLISH-npm-bitfun.md` (archived to the workspace-level `proc_doc/` directory).
