# Cyber Fabric PoC

Proof-of-concept implementation of Cyber Fabric, a product delivery system that connects product management, design, architecture, engineering, QA, and expert teams in one workspace-oriented surface.

See [VISION.md](../VISION.md) for the full product direction and design principles.

## Architecture

The PoC is structured as a TypeScript monorepo with four packages:

```
poc/
  packages/
    fabric-core/          Core runtime: types, skill registry, planner, orchestrator
    fabric-adapter-claude/  Claude Agent SDK adapter
    fabric-adapter-codex/   Codex CLI adapter
    fabric-vscode/          VS Code extension with chat panel and plan tree
  demo/                   End-to-end demo runner
```

### How it works

1. **Skills** declare contracts (inputs, outputs, operations) and register with the **Skill Registry**
2. The **Planner** inspects skill IO contracts to compose compatible skills into **Pipelines**
3. The **Orchestrator** executes pipelines by delegating steps to **Adapters** (Claude, Codex, etc.)
4. The **VS Code extension** provides a chat panel, plan tree view, and delegation status display

The orchestrator never calls LLM APIs directly. All execution is delegated through adapter contracts, keeping orchestration logic host-agnostic.

## Packages

| Package | Description |
|---------|-------------|
| `@cyber-fabric/fabric-core` | Core types, skill registry, pipeline planner, and orchestrator. Defines `SkillContract`, `Pipeline`, `ExecutionResult`, and `AdapterContract` interfaces. |
| `@cyber-fabric/fabric-adapter-claude` | Claude Agent SDK adapter. Implements `AdapterContract` to execute skills via Claude subagents. |
| `@cyber-fabric/fabric-adapter-codex` | Codex CLI adapter. Implements `AdapterContract` to execute skills via the Codex CLI subprocess. |
| `@cyber-fabric/fabric-vscode` | VS Code extension with chat panel (webview), plan tree view, and delegation status view. |

## Prerequisites

- Node.js >= 18
- npm >= 9 (workspaces support)
- TypeScript >= 5.4

Optional (for agent execution):
- `claude` CLI on PATH (for Claude adapter — install via `npm install -g @anthropic-ai/claude-code`)
- `codex` CLI on PATH (for Codex adapter)

## Setup

```bash
# Install dependencies
cd poc
npm install

# Build all packages
npm run build

# Run TypeScript checks
npx tsc --noEmit
```

## Running the Demo

The demo creates sample skill contracts, builds a pipeline, and attempts delegation through available adapters.

```bash
cd poc
npm run demo
```

The demo will:
1. Register sample skills (Code Review, Test Generation, Documentation)
2. Create a pipeline chaining Code Review into Test Generation
3. Validate the pipeline against available inputs
4. Check adapter availability (Claude SDK, Codex CLI)
5. Execute the pipeline through the orchestrator
6. Display execution results and state

If no agent credentials are configured, the demo handles this gracefully and shows informative messages about what would happen with configured adapters.

## Agent Configuration

### Claude Adapter

The Claude adapter invokes the `claude` CLI as a subprocess. Install it globally:

```bash
npm install -g @anthropic-ai/claude-code
```

If `claude` is not on PATH, `isAvailable()` returns false and the adapter is skipped.

### Codex Adapter

The Codex adapter requires the `codex` CLI binary on your PATH:

```bash
# Verify Codex is available
codex --version
```

Configure the adapter with a custom path if needed:

```typescript
const adapter = new CodexAdapter({ cliPath: "/usr/local/bin/codex" });
```

## Development

### Project Structure

Each package follows the same layout:

```
packages/<name>/
  package.json      Package manifest with workspace dependencies
  tsconfig.json     TypeScript config extending root
  src/
    index.ts        Public exports
    ...             Implementation files
```

### Building

```bash
# Build all packages
npm run build

# Build a single package
npm run build --workspace=packages/fabric-core
```

### Key Interfaces

The core type system is defined in `packages/fabric-core/src/types.ts`:

- `SkillContract` - Declares what a skill accepts, produces, and can do
- `Pipeline` - Ordered sequence of skill steps with input/output bindings
- `ExecutionResult` - Outcome of skill or pipeline execution (success/failure/partial)
- `AdapterContract` - Host integration interface for different agent runtimes

### Adding a New Adapter

1. Create a new package under `packages/`
2. Implement the `AdapterContract` interface from `@cyber-fabric/fabric-core`
3. Register the adapter with the orchestrator via `orchestrator.registerAdapter()`

## Product Direction

Cyber Fabric aims to provide:

- **Single product view** from intent to implementation and tests
- **End-to-end traceability** across requirements, design, plans, code, tests, and reviews
- **Deterministic collaboration** with structured generation and validation
- **Same Fabric skill everywhere** (IDE, CLI, web)
- **Workspace-first multi-repo delivery**
- **Reviewable change management** with Git-aware workflows

See [VISION.md](../VISION.md) for the complete product vision and direction.
