# Phase 8: VS Code Extension Core — Summary

## Extension Structure

The Cyber Fabric VS Code extension lives in `packages/fabric-vscode` and follows ADR-0017: it is a host-native surface over the unified Fabric operational model. The extension does not reimplement Fabric logic — it delegates to `@cyber-fabric/fabric-core`.

### Files

- `package.json` — VS Code extension manifest with activation events, command contributions, and workspace dependency on `@cyber-fabric/fabric-core`
- `tsconfig.json` — TypeScript config extending root, outputting to `dist/`
- `src/extension.ts` — Extension entry point with `activate` and `deactivate` exports

## Registered Commands

| Command ID                    | Title                        | Description                          |
|-------------------------------|------------------------------|--------------------------------------|
| `cyber-fabric.showStatus`    | Cyber Fabric: Show Status    | Shows orchestrator readiness status  |
| `cyber-fabric.runPipeline`   | Cyber Fabric: Run Pipeline   | Placeholder for pipeline execution   |

## Integration Points with fabric-core

- `Orchestrator` — instantiated on activation with a `SkillRegistry` and default config
- `SkillRegistry` — created and passed to the Orchestrator constructor
- `PipelinePlanner` — imported but reserved for pipeline construction in later phases

## Extension Lifecycle

- **activate**: Creates an output channel ("Cyber Fabric"), initializes the Orchestrator, registers commands, pushes all disposables to `context.subscriptions`
- **deactivate**: Clears the orchestrator reference; output channel is disposed via subscriptions

## Notes for Later Phases

- **Phase 9 (Chat Panel)**: Should import the module-level `orchestrator` or receive it via dependency injection. The output channel is available for logging.
- **Phase 10 (Plan Tree)**: Tree view providers should be registered in `activate` and added to `context.subscriptions`. The orchestrator's `onEvent` listener can drive tree refresh.
