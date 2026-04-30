---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0026: Workspace-Aware Prompt Rendering with Auto-Injected Context and Init-Workspace Fallback

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Workspace-Aware Rendering](#option-1-no-workspace-aware-rendering)
  - [Option 2: Auto-Injection Only](#option-2-auto-injection-only)
  - [Option 3: Init-Workspace Fallback Only](#option-3-init-workspace-fallback-only)
  - [Option 4: Auto-Injection AND Init-Workspace Fallback](#option-4-auto-injection-and-init-workspace-fallback)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-workspace-aware-prompt-rendering`

## Context and Problem Statement

Cyber Fabric prompts are rendered through ADR-0010's templating engine and addressed via `fabric prompt get <kit>:<id>` (and equivalents from Web UI, REST API, VS Code plugin per ADR-0001 and ADR-0002). Today the prompt rendering pipeline is workspace-unaware: it does not know which workspace the user is in, it does not include workspace context in template variables, and it does not have a meaningful response when no workspace is detected. Two consequences fall out of that.

First, **agents that consume prompts have no immediate context.** Every agent invocation that needs workspace info has to call `fabric workspace info` separately, which adds round-trips and introduces a class of bugs where the prompt and the workspace context are read at different points in time and disagree.

Second, **when no workspace is detected, prompts that require workspace context have no good failure mode.** A silent failure ("workspace not found, here is an empty prompt") gives the agent nothing to do. An exception ("workspace not found, abort") forces the caller to handle the recovery. Neither is the right answer when the recovery is well-known: initialize a workspace.

The platform therefore needs **workspace-aware prompt rendering**: workspace context auto-injected into every rendered prompt, and a special init-workspace prompt returned as a fallback when no workspace is detected and the requested prompt is workspace-required.

## Decision Drivers

* **Immediate context for agents** — agents that consume prompts should see workspace info in the rendered output without making a separate `fabric workspace info` call
* **Recoverable missing-workspace state** — when no workspace is detected, agents should be told what to do (init or select), not handed an empty prompt or a raw exception
* **Surface parity** — auto-injection and fallback behavior must be identical across CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002
* **Composes with templating (ADR-0010)** — auto-injection populates a Handlebars variable that prompt authors can use, and fallback uses the same prompt-rendering pipeline
* **Composes with workspace context resolution (ADR-0025)** — "no workspace detected" is exactly what ADR-0025 reports back when neither `--workspace` nor CWD-based detection finds one
* **Default-on, opt-out** — most prompts benefit from workspace context; rare prompts that do not (or that operate against a different workspace explicitly) can opt out at the prompt level

## Considered Options

1. **No Workspace-Aware Rendering** — prompts are rendered without any workspace awareness; agents call `fabric workspace info` separately
2. **Auto-Injection Only** — workspace info auto-injected into prompt context, but missing workspace fails silently or with an exception
3. **Init-Workspace Fallback Only** — missing workspace returns init-workspace prompt, but successful renderings do not auto-inject workspace info
4. **Auto-Injection AND Init-Workspace Fallback** — both behaviors enabled; auto-inject when workspace detected, init-fallback when not

## Decision Outcome

Chosen option: **Option 4 — Auto-Injection AND Init-Workspace Fallback**, because Cyber Fabric needs both behaviors to be useful: agents need workspace context up front (which is what auto-injection gives them), AND they need clear guidance when context is missing (which is what the init-fallback gives them). Either alone leaves a gap.

The decision has two parts:

1. **Auto-injection of workspace context.** When `fabric prompt get <prompt-id> <instruction-id>` (or any equivalent Web UI / REST API / VS Code plugin invocation) is rendered with a workspace detected per ADR-0025, Fabric:
   * Populates a `workspace` variable in the Handlebars template context with the structure produced by `fabric workspace info`: at minimum `name`, `members` (list of member repositories with their paths and current branch and worktree state), and `kits_at_workspace_scope`. Prompt authors reference this through standard Handlebars expressions like `{{workspace.name}}` or `{{#each workspace.members}}...{{/each}}`.
   * Prepends an auto-generated **workspace summary block** to the rendered output, regardless of whether the prompt template explicitly references `{{workspace}}`. The summary is a brief markdown-formatted section covering workspace name, member repositories, current branches and worktrees per repo. This guarantees that any agent receiving a rendered prompt sees the workspace context up front, even for prompts written before workspace-awareness was introduced.

2. **Init-workspace fallback.** When `fabric prompt get` is invoked with **no workspace detected** (per ADR-0025) AND the requested prompt is workspace-required, Fabric returns a **special init-workspace prompt** instead of the requested instruction. The init-workspace prompt:
   * Is itself workspace-agnostic (does not trigger another fallback)
   * Is core-bundled (per ADR-0008's core scope)
   * Contains deterministic guidance: "no Fabric workspace is currently active; run `fabric workspace init` to create one, or `fabric workspace list` plus `--workspace <name>` to select an existing one, or `cd` into a directory whose ancestors contain a `.fabric/workspaces/<name>.toml` registration file"
   * Is rendered through the same templating pipeline (so the response from `fabric prompt get` is a normal rendered prompt, just with a different content body)

When the prompt being requested is **workspace-agnostic** (declared so per ADR-0025's command classification), the init-fallback does not trigger; the prompt is rendered normally without workspace context (since none is required).

**Per-prompt opt-out** of auto-injection is supported through a frontmatter field on the prompt file (per ADR-0007's frontmatter model), for example `auto_inject_workspace: false`. This is for the rare case where a prompt explicitly does not want workspace context, or wants to inject it manually through templating. The exact field name and semantics are intentionally left to follow-on design.

### Consequences

* Good, because agents see workspace context immediately on every prompt rendering, without separate calls
* Good, because missing-workspace becomes a recoverable, agent-readable state via the init-fallback
* Good, because both behaviors compose with the templating engine (ADR-0010) and the workspace resolution rules (ADR-0025) without inventing parallel mechanisms
* Good, because the same behavior holds across CLI, Web UI, REST API, and VS Code plugin per surface parity
* Good, because prompt authors can use `{{workspace}}` template expressions explicitly when they want fine control, and the summary block ensures sensible defaults otherwise
* Bad, because the workspace summary block adds visible scaffolding to every rendered prompt; for prompts where context is not needed the summary block adds noise (mitigated by per-prompt opt-out)
* Bad, because the format of the summary block becomes a stability surface — agents will start to depend on its layout
* Bad, because the init-workspace prompt's text becomes a UX surface that needs careful wording to be useful guidance rather than confusing noise

### Confirmation

Confirmed when:

* `fabric prompt get` and its Web UI, REST API, and VS Code plugin equivalents auto-populate a `workspace` Handlebars template variable with `fabric workspace info` content when a workspace is detected per ADR-0025
* `fabric prompt get` prepends a workspace summary block to the rendered output by default; per-prompt opt-out via prompt frontmatter is available
* when no workspace is detected and the requested prompt is workspace-required, `fabric prompt get` returns a special init-workspace prompt that contains deterministic guidance to `init`, `list` plus `--workspace`, or `cd` into a registered repo
* the init-workspace prompt is itself workspace-agnostic and core-bundled per ADR-0008
* surface parity across CLI, Web UI, REST API, and VS Code plugin is maintained per ADR-0001 and ADR-0002

## Pros and Cons of the Options

### Option 1: No Workspace-Aware Rendering

Prompts are rendered without workspace awareness; agents call `fabric workspace info` separately when needed.

* Good, because the prompt rendering pipeline stays minimal
* Bad, because every agent invocation needs an extra call for workspace context
* Bad, because prompt and workspace state can be read at different times and disagree
* Bad, because missing-workspace has no defined response shape

### Option 2: Auto-Injection Only

Workspace info auto-injected into prompt context; missing workspace fails silently or with an exception.

* Good, because prompts get workspace context for free in the common case
* Bad, because missing workspace is unhandled; agents get an empty or error response with no recovery guidance
* Bad, because callers have to reimplement the recovery flow ("if error, suggest init")

### Option 3: Init-Workspace Fallback Only

Missing workspace returns init-workspace prompt; successful renderings do not auto-inject workspace info.

* Good, because the missing-workspace case is handled cleanly
* Bad, because the common case (workspace detected) still requires agents to call `fabric workspace info` separately
* Bad, because every prompt author has to remember to use `{{workspace}}` template expressions or accept missing context

### Option 4: Auto-Injection AND Init-Workspace Fallback

Both behaviors enabled.

* Good, because both gaps are closed (immediate context AND recoverable missing-workspace)
* Good, because the two behaviors compose orthogonally
* Good, because prompt authors get workspace context for free but can opt out per-prompt
* Bad, because the workspace summary block adds default scaffolding that may be unwelcome in some prompts (mitigated by opt-out)
* Bad, because the format of the summary block and the init-workspace prompt text are both stability surfaces

## More Information

The exact format of the **workspace summary block** that gets prepended to rendered prompts (markdown structure, level of detail per repo, whether to include branches, worktrees, kit list, or commits, length budget), the exact wording of the **init-workspace prompt**, the canonical kit and instruction id under which the init-workspace prompt is shipped (likely a core-bundled `core-fabric` kit per ADR-0008), the per-prompt opt-out frontmatter field name, and whether the auto-injected `workspace` variable includes branches and worktrees by default or only on explicit request are all intentionally left to follow-on design.

This decision composes with several existing ADRs:

* **ADR-0007** (prompt file model) — prompts are markdown with Handlebars block helpers; the auto-injected `workspace` variable lives in the same template context as user-defined variables from ADR-0010
* **ADR-0010** (templating engine) — Handlebars is the engine; auto-injection adds one more variable to the context resolved per ADR-0010's variable layer rules
* **ADR-0011** (workspace concept) — `fabric workspace info` is the source of the auto-injected `workspace` variable
* **ADR-0025** (workspace resolution) — "workspace detected" or "not detected" is determined by the resolution rules in ADR-0025

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-workspace-aware-prompt-rendering`, `cpt-cyber-fabric-usecase-dev-share-parameterized-prompt`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0007](0007-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0010](0010-cpt-cyber-fabric-adr-prompt-templating-and-instruction-extraction-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0025](0025-cpt-cyber-fabric-adr-multi-workspace-operation-and-context-resolution-v1.md)

This decision directly addresses the following traceability items:

* `fabric prompt get` and its surface equivalents must auto-inject a `workspace` template variable populated from `fabric workspace info`
* `fabric prompt get` must prepend a workspace summary block to the rendered output by default
* per-prompt opt-out of auto-injection must be available through prompt frontmatter
* when no workspace is detected and the requested prompt is workspace-required, `fabric prompt get` must return a special init-workspace prompt with deterministic guidance
* the init-workspace prompt is itself workspace-agnostic and core-bundled
* surface parity across CLI, Web UI, REST API, and VS Code plugin is maintained
