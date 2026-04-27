# Fabric VS Code Plugin — Design (PoC)

Date: 2026-04-23
Status: approved for PoC implementation

## 1. Summary

A VS Code extension that provides a native UI for managing fabric: installing and browsing kits, registering agents, and bootstrapping the fabric CLI. The PoC is **UI-only** — all fabric operations are satisfied by an in-memory mock with bundled fixtures. Real git, real CLI calls, and real filesystem materialization are deferred to the post-PoC implementation.

## 2. Goals

- Demonstrate the intended UX end-to-end on a developer's machine.
- Exercise all core flows: add marketplace, browse, install kit, register agent, update kit, install fabric CLI.
- Validate the Claude-Code-marketplace-style distribution model applied to fabric kits.
- Surface design gaps before investing in real fabric library/CLI extensions.

## 3. Non-Goals

- Prompt execution / LLM runtime integration.
- Real git operations (clone, pull, auth).
- Real filesystem writes to `.claude/skills/` or other agent config paths.
- Real CLI invocation via shell; no `child_process.spawn` of `fabric`.
- Automated tests (unit, integration, smoke). Happy-path demo on the author's machine is the acceptance bar.
- Multi-window concurrent-use guarantees.
- Per-kit-per-agent registration. Registration is agent-level and covers all active kits.
- Error recovery UX beyond "toast + Output channel".

## 4. Target User and Problem

**User:** a developer who configures their agent environment (Claude Code, Codex, eventually Cursor/Windsurf/Copilot) from inside VS Code.

**Problem today:** fabric kits are installed and registered via CLI commands that are discoverable only through documentation. Setting up a new project's agent environment requires terminal fluency and accurate memory of `fabric register --local --include-global`-style flag combinations.

**What the plugin fixes:** a sidebar that makes the current state visible at a glance (installed kits, active marketplaces, registered agents) and exposes every fabric operation as a click or command-palette entry.

## 5. Architecture

### 5.1 High Level

A single TypeScript VS Code extension. Activation events: `onStartupFinished` (to detect CLI presence) plus `onView:fabric.kits` / `onView:fabric.store` / `onView:fabric.agents` for the TreeView containers.

### 5.2 Module Map

| Module | Responsibility |
|---|---|
| `fabricLib` | Thin shim over `import fabric`. In the PoC, the import resolves to a **mock implementation** bundled in the extension (`src/mock/fabric.ts`) that fulfils the same API surface as the real library will. |
| `ui/kitsView` | TreeDataProvider for the "My Kits" section. Groups installed kits by scope (Project / Global). Reads `fabric.kits.list({ scope: 'both' })`. |
| `ui/storeView` | TreeDataProvider for the "Store" section. Groups kits by marketplace. Reads `fabric.marketplaces.list()` and `fabric.marketplaces.listKits(name)`. |
| `ui/agentsView` | TreeDataProvider for the "Agents" section. Lists agents from `fabric.agents.list()` with registration state. |
| `ui/commands` | Registers VS Code commands, context menus, QuickPicks. |
| `cliInstaller` | Mock walkthrough for installing the fabric CLI. |
| `state` | In-memory snapshot of mock fabric state. Reset on window reload. |

### 5.3 Data-Flow Principle

The UI views are pure projections of `fabricLib` return values. No plugin-owned persistent state beyond VS Code's `globalState` for user preferences (e.g., "include pre-releases" toggle). Refreshes are explicit: after any mutating call (install/update/register), the plugin invalidates the relevant TreeView.

## 6. Sidebar Layout (Layout B — Kits vs Store)

```
FABRIC (Activity Bar icon)
├── My Kits
│   ├── Workspace (N)
│   │   └── <kit> [scope: project] [1.2.0]
│   └── User (M)
│       └── <kit> [scope: global] [0.4.1]
├── Store
│   ├── 🔍 Search…  |  ☐ Include pre-releases
│   ├── cyber-fabric-official (K kits)
│   │   └── <kit> — <description>  [1.3.0]
│   └── community-demo (L kits)
│       └── …
└── Agents
    ├── Claude Code  [detected ✓]  [registered ✓]  exposes N prompts
    ├── Codex        [detected ✓]  [registered ×]
    └── Cursor       [detected ×]  (coming soon)
```

- Status-bar item: fabric CLI version or "Install Fabric CLI".
- Output channel `Fabric` is the centralized log.

## 7. Kit Lifecycle

### 7.1 Install

- Entry points:
  - "Install from Git URL…" under Store header.
  - Command Palette: `Fabric: Install Kit from URL`.
  - Click on a kit in Store → `Install` action.
- Flow: git URL (or marketplace kit resolution) → QuickPick scope (Project / Global) → `fabric.kits.install({ source, scope })` → progress notification → refresh My Kits → toast "Installed <name> v<version>". A user who wants a kit at both scopes installs it twice; the two entries are distinct nodes in My Kits.

### 7.2 Versioning

- Strict semver tags. Example kit tags: `1.2.5`, `1.3.4-alpha`, `2.0.0-rc.1`.
- Pre-release suffixes (`-alpha`, `-beta`, `-rc`) are the only "unstable" channel. No install-from-branch/SHA in PoC.
- Store UI has an "Include pre-releases" toggle (default off).
- Repositories without semver tags are invisible to the store and block manual install in the PoC flow.

### 7.3 Update

- **Manual only.** Refresh button in the Kits view header triggers comparison of installed version vs latest marketplace manifest entry. Kits with an update show a `↻ update available` badge.
- Click the badge → mock diff preview (list of files that will change) → confirm → `fabric.kits.update(name, scope)`.
- No background update checks in the PoC.

### 7.4 Uninstall

- Context menu → `Uninstall` → confirmation modal → `fabric.kits.uninstall(name, scope)`.
- The library handles agent-registration cleanup; the plugin just refreshes views.

### 7.5 Out-of-band Changes

- In the PoC there are no out-of-band changes because the mock state is process-local. A `FileSystemWatcher` is not wired up. This becomes real post-PoC.

## 8. Marketplaces (Store)

Model: Claude Code marketplace, adapted.

### 8.1 Manifest Shape

File: `.fabric-marketplace/marketplace.json` in a git repo (or local directory).

```json
{
  "$schema": "https://fabric.dev/marketplace.schema.json",
  "name": "cyber-fabric-official",
  "description": "Curated fabric kits",
  "owner": { "name": "Cyber Fabric", "email": "support@example.com" },
  "kits": [
    {
      "name": "review-prompts",
      "description": "Code review prompt pack",
      "category": "development",
      "author": { "name": "…" },
      "homepage": "…",
      "source": {
        "source": "url",
        "url": "https://github.com/.../review-prompts.git",
        "version": "1.2.0"
      }
    },
    {
      "name": "sdlc-kit",
      "source": {
        "source": "git-subdir",
        "url": "org/fabric-monorepo",
        "path": "kits/sdlc",
        "version": "0.4.1"
      }
    },
    {
      "name": "local-example",
      "source": "./kits/local-example"
    }
  ]
}
```

- Each `source` carries a semver `version`; the library resolves it to the git tag and its SHA. In the PoC the resolution is a lookup in bundled fixtures.
- Multiple marketplaces are supported; the union is displayed in the Store view.

### 8.2 Commands

- `Fabric: Add Marketplace…` (git URL or local path)
- `Fabric: Remove Marketplace`
- `Fabric: Refresh Marketplaces`
- `Fabric: Install Kit from Git URL` (bypasses marketplaces)

### 8.3 Bootstrap

On first activation, if no marketplaces are registered, the plugin surfaces a one-time hint to add `cyber-fabric-official` (the seed marketplace living in a dedicated GitHub repo). No pushy dialog — just a placeholder row in the Store section.

## 9. Agent Registration

### 9.1 Model

- **Scope is installation-level** (Project or Global), not per-agent.
- **Registration is agent-level**: registering agent X exposes it to *all* active kits/prompts at the active scope(s). There is no per-kit-per-agent toggle.

### 9.2 Commands

- `Fabric: Register Agents…` — multi-pick of agents from `fabric.agents.list()`, then QuickPick scope. Scope options mirror the `fabric register` flag combinations: **Default** (no flags — fabric's built-in defaults), **Project** (`--local`), **Global** (`--include-global`), **Project + Global** (`--local --include-global`).
- `Fabric: Unregister Agents…` — inverse.
- Also reachable via context menu on each agent row in the Agents view.

### 9.3 Agents View Items

Each agent shows: display name, `detected` state, `registered` state, and an exposed-prompt count. Context menu actions: Register / Unregister. Undetected agents are still listed (greyed) to preview upcoming support.

### 9.4 CLI Vocabulary (post-PoC reference)

- `fabric register [path] [--agent <id>] [--local] [--include-global]`
- `fabric unregister [path] [--agent <id>] [--local] [--include-global]`
- Without `--agent`, the operation covers all known agents.

## 10. Fabric CLI Installer

### 10.1 Status

- The CLI is **required in production** because materialized agent skills invoke `fabric prompt get <name>` at runtime.
- In the PoC, the installer walkthrough is a **mock**. Clicking "Install" runs a 2-second fake spinner and flips the mock `detectCli()` result.

### 10.2 Production Plan (non-PoC reference)

On activation, the plugin runs `fabric.system.detectCli()`. If the CLI is missing, a persistent sidebar banner directs the user to the walkthrough. Methods per platform:

| OS | Primary | Fallback |
|---|---|---|
| macOS | `brew install fabric` | `npm install -g @cyberfabric/fabric` |
| Linux | `npm install -g @cyberfabric/fabric` | — |
| Windows | `scoop install fabric` | `npm install -g @cyberfabric/fabric` |

The walkthrough invokes the command in an integrated terminal, then re-runs detect. Node.js / brew / scoop prerequisites are linked out, not bundled.

## 11. Library / CLI API Contract

Commands and APIs the plugin relies on. In the PoC the mock implements them; in production the real fabric library does.

### 11.1 Library Exports

```ts
fabric.kits.list({ scope: 'project' | 'global' | 'both' }): InstalledKit[]
fabric.kits.install({
  source: { url: string, version: string }
         | { marketplace: string, kit: string, version?: string },
  scope: 'project' | 'global',
}): InstalledKit
fabric.kits.update(name: string, scope): { before, after, files }
fabric.kits.uninstall(name: string, scope): void

fabric.marketplaces.list(): Marketplace[]
fabric.marketplaces.add(source: GitSource | LocalSource): Marketplace
fabric.marketplaces.remove(name: string): void
fabric.marketplaces.refresh(): { updated: Marketplace[] }
fabric.marketplaces.listKits(name?: string): MarketplaceKit[]

fabric.agents.list(): AgentInfo[]   // { id, name, detected, registered, scope, promptCount }
fabric.register({ agents?: string[], local?: boolean, includeGlobal?: boolean }): RegisterResult
fabric.unregister({ agents?: string[], local?: boolean, includeGlobal?: boolean }): UnregisterResult

fabric.system.detectCli(): { found: boolean, version?: string, path?: string, compatible?: boolean }
fabric.system.MIN_CLI_VERSION: string
```

### 11.2 CLI Surface (reference for post-PoC)

Existing commands kept as-is. New commands required:

```
fabric kit list [--scope project|global|both] [--json]
fabric kit install <source> [--scope …] [--version …]
fabric kit update <name> [--scope …]
fabric kit uninstall <name> [--scope …]
fabric marketplace add <source>
fabric marketplace list [--json]
fabric marketplace remove <name>
fabric marketplace refresh
fabric agent list [--json]
fabric register [path] [--agent <id>] [--local] [--include-global]
fabric unregister [path] [--agent <id>] [--local] [--include-global]
```

## 12. PoC Fixtures

Bundled in `resources/fixtures/`:

### 12.1 Marketplaces (2)

- **`cyber-fabric-official`** — 5 kits spanning categories (development, productivity, review, sdlc, testing). All with stable semver versions.
- **`community-demo`** — 3 kits plus 1 intentionally broken entry (invalid `source.version`) to demonstrate the error-surface UX.

### 12.2 Kits (~8)

Each kit fixture includes: `name`, `description`, `category`, `author`, `homepage`, `source`, and a fake set of "files this kit would install" for the mock diff preview. One kit carries a pre-release tag (`1.2.0-beta.1`) to demonstrate the pre-release toggle.

### 12.3 Agents

`fabric.agents.list()` returns three entries in the PoC:

| id | name | detected | registered |
|---|---|---|---|
| claude | Claude Code | ✓ | starts unregistered |
| codex | Codex | ✓ | starts unregistered |
| cursor | Cursor | × | n/a |

### 12.4 CLI Detection Toggle

A Command Palette entry `Fabric PoC: Toggle CLI Detected` flips `detectCli()` between "found" and "missing" states for demo purposes.

## 13. Error Handling

Minimal:

- All operations log to the `Fabric` Output channel.
- Failures surface as a VS Code toast: `"Failed: <reason>"` with `Show Logs` action that opens the Output channel.
- No retry flows, no health panels, no persistent banners (except the single CLI-missing prompt).

## 14. Success Criteria

On the author's machine, a live demo must complete these flows without crashes:

1. Fresh install → sidebar renders with empty marketplace / kit lists.
2. Add `cyber-fabric-official` (from bundled fixture) → kits populate.
3. Install one kit to Project scope; confirm it appears under My Kits / Workspace.
4. Install another kit to Global scope; confirm it appears under My Kits / User.
5. Register the Claude Code agent → agent row flips to "registered ✓".
6. Trigger mock update for a kit → diff preview → confirm → version bumps.
7. Toggle `detectCli` to "missing" → CLI banner appears → run mock walkthrough → banner clears.
8. Unregister Claude Code → row flips back.
9. Uninstall a kit → removed from My Kits.
10. Fail one operation (via community-demo's broken kit) → toast + Output log entry.

## 15. Out of Scope (post-PoC backlog)

- Real git and fabric library integration.
- Cursor / Windsurf / Copilot agent adapters in fabric library.
- Automated tests (see non-goals).
- Background update checks.
- Agents health diagnostics (stale/missing/conflict states).
- Dry-run diff for register.
- `--json` outputs for every list command.
- Persistent FileSystemWatcher for out-of-band `.fabric/` changes.
- Private git credentials flow.
