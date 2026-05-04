---
status: accepted
date: 2026-05-04
decision-makers: cyber fabric maintainers
---

# ADR-0033: Cross-Agent Prompt Discovery and Middleware Composition

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No External Discovery](#option-1-no-external-discovery)
  - [Option 2: Mirror External Prompts into Fabric Kits](#option-2-mirror-external-prompts-into-fabric-kits)
  - [Option 3: Discovery Adapters per Agentic Tool](#option-3-discovery-adapters-per-agentic-tool)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-cross-agent-prompt-discovery-and-middleware-composition`

## Context and Problem Statement

Cyber Fabric already treats prompts shipped inside its own kits as first-class — kit-packaged skills (ADR-0006), the closed nine-type taxonomy (ADR-0031), Handlebars templating with workspace-aware injection (ADR-0010, ADR-0026), and middleware composition by id / type / glob (ADR-0031). Users, however, do their actual work inside agentic-tool hosts that each persist their own skills, sub-agents, and rules on disk in tool-specific conventions: `~/.claude/skills/`, `~/.claude/agents/`, `~/.claude/commands/`, and the per-project `.claude/...` mirrors for Claude Code; `~/.codex/` and `.codex/` for Codex; `.cursor/rules/` for Cursor; `.windsurf/workflows/` for Windsurf; `~/.copilot/` and `.github/copilot-instructions.md` for GitHub Copilot. Fabric is blind to all of these today.

That blindness has three concrete consequences. First, there is no single deterministic surface that answers "what skills, sub-agents, and rules are available in this context?" — a question that is foundational for any meta-prompt that picks a skill per (sub)task. Second, a user cannot retrieve an external skill's content through Fabric (`fabric prompt get`), so external prompts cannot participate in any Fabric-driven flow. Third, Fabric's middleware mechanism (cross-cutting rules / instructions composed by id / type / glob) cannot reach external prompts, so workspace-aware injections, task-routing rules, and other orthogonal concerns cannot apply uniformly when the user is operating through an external tool. The need for deterministic cross-agent discovery is amplified by the explicit Fabric goal of composing meta-instructions like "select the right skill for the current sub-task" and by the user-facing pattern of attaching a Fabric system-rule in-chat (`invoke fab:<system>`) so every prompt invocation is wrapped with `execute and follow fabric prompt get …` for consistent middleware application.

## Decision Drivers

* **Deterministic discovery surface** — one canonical answer to "what prompts are available here?" across Fabric's own kits and every supported agentic-tool host
* **Symmetric global + local scope** — both user-level (`~/.claude/...`, `~/.codex/...`, `~/.fabric/...`) and project-level (`.claude/...`, `.codex/...`, `.cursor/rules/`, `.windsurf/workflows/`, kit-shipped) sources are first-class
* **Read-only by default** — Fabric does not mutate other tools' on-disk files; external prompts are surfaced in place and rendered at retrieval time, not rewritten
* **Filtering by host** — `--agent claude-code | codex | cursor | windsurf | copilot | fabric` narrows the listing to one host; absence returns the union across hosts
* **Unified `fabric prompt get`** — every discovered prompt has a stable ID and is retrievable through one command, returning rendered content with middleware applied
* **Reuse the middleware contract** — middleware composition (ADR-0031, ADR-0026) targets external prompts the same way it targets Fabric prompts; no second middleware mechanism is introduced
* **In-chat system bind** — a Fabric `rules`-type prompt registered via the host's skill mechanism (`fab:<system>`) emits a host-injected instruction that wraps every subsequent prompt invocation with `execute and follow fabric prompt get <id>`, giving the user a one-shot way to make a chat session route through Fabric
* **Closed prompt-type taxonomy preserved** — external prompts are mapped onto the existing nine types (ADR-0031), not given a parallel taxonomy
* **Workspace-aware** — discovery and middleware composition respect the active Workspace context (ADR-0011, ADR-0025, ADR-0026)
* **Out-of-scope: pushing changes back** — Fabric does not write into external tools' directories; if a user wants a Fabric-curated version of an external prompt, that lives in a Fabric kit

## Considered Options

1. **No External Discovery** — users keep using each tool's own UI for skill / sub-agent listing; Fabric only sees Fabric-kit prompts
2. **Mirror External Prompts into Fabric Kits** — at install or sync time, Fabric copies external prompts into a generated Fabric kit so every prompt is Fabric-native
3. **Discovery Adapters per Agentic Tool** — Fabric reads each tool's on-disk convention through small per-tool, read-only adapters and exposes a unified prompt surface that supports filtering by agent, scope, and type, with the existing middleware mechanism applied at retrieval time

## Decision Outcome

Chosen option: **Option 3 — Discovery Adapters per Agentic Tool**, because it gives Cyber Fabric a deterministic cross-agent prompt surface without forking files, mutating user tools' state, or introducing a second middleware mechanism. The adapter pattern is consistent with how Fabric handles git providers (ADR-0023) and host-native plugins (ADR-0003); it lets each tool ship its own format translator while keeping the unified surface stable. Mirroring external prompts into Fabric kits (Option 2) is heavy, fragile, and guarantees drift the moment the user edits the source. No discovery (Option 1) leaves the deterministic-surface problem unsolved.

The decision has these parts:

1. **Adapter contract** — a `PromptDiscoveryAdapter` interface declares: `tool` (stable host id, e.g. `claude-code`, `codex`, `cursor`, `windsurf`, `copilot`, `fabric`), `discover(scope: 'global' | 'local' | 'all', workspace?: Workspace) → PromptRecord[]`, and `getContent(id) → RenderedPrompt`. Adapters are read-only and stateless. Each adapter declares its on-disk path conventions and frontmatter / body parsing rules.

2. **Stable cross-agent ID format** — every discovered prompt is addressable as `{tool}:{type}:{slug}[@{scope}]` where `tool` is the host id, `type` is one of the nine taxonomy types from ADR-0031, `slug` is the host-native name normalized to kebab-case, and `@{scope}` disambiguates global / local / kit when needed. Fabric's own prompts keep their existing addressing (`fab:<kit>:<name>`), which collapses to this form with `tool = fab` and `scope` defaulted by the kit-resolution rules of ADR-0008 / ADR-0030. Local prompts shadow global prompts of the same `{tool}:{type}:{slug}` (precedence: `local > global`); the resolved record carries the source path and scope metadata.

3. **CLI surface** — `fabric prompt list [--agent <tool>] [--scope global|local|all] [--type <taxonomy-type>] [--workspace <name>] [--include-middleware]` returns a structured listing across all adapters or a filtered subset. Default scope is `all`. `fabric prompt get <id> [--workspace <name>] [--render <none|middleware|full>]` returns the prompt content; `--render middleware` (default) applies middleware composition per ADR-0031 + ADR-0026, `--render full` additionally resolves Handlebars templating with workspace-aware injection per ADR-0010 + ADR-0026, `--render none` returns the raw on-disk content.

4. **REST surface** — the same operations are exposed under `/v1/prompts` (list) and `/v1/prompts/{id}` (get) on the canonical REST API (ADR-0020) for the Web UI and external programmatic clients. CLI / VS Code Plugin / agentic-tool host plugins reach the same operations through the in-process Fabric Core API (ADR-0021 revised, ADR-0003).

5. **Middleware composition over external prompts** — middleware-typed prompts (per ADR-0031) target external prompts identically to Fabric prompts. Middleware selectors continue to use id, type, and glob patterns; the cross-agent ID format makes selectors like `cc:skill:*`, `*:agent:plugin-*`, or `cdx:*:*` natural. Middleware is composed at retrieval time inside `getContent` / `fabric prompt get`; on-disk source files are never mutated.

6. **`invoke fab:<system>` in-chat bind** — a Fabric-shipped `rules`-type prompt (e.g. `fab:core:system-route-via-fabric`) registers as a host-native skill / rule on every supported agentic-tool host through the existing host-adapter mechanism (ADR-0003) and the `core` kit's dev-tool-plugin packaging (ADR-0019, ADR-0030). Invoking it in chat (e.g. `/fab:system` in Claude Code, the equivalent in Codex / Cursor / Windsurf) emits a system-prompt directive that asks the host to wrap subsequent prompt invocations with `execute and follow fabric prompt get <id> --render full --workspace <name>`. This makes the chat session deterministic with respect to Fabric middleware without requiring the user to memorize the wrapper command.

7. **Workspace context resolution** — discovery and rendering resolve the active Workspace per ADR-0025 (per-surface auto-detection). The `--workspace` flag is the override. Middleware that depends on workspace state is rendered with the same context resolver as kit-shipped middleware (ADR-0026).

8. **v1 adapter set** — the `core` kit (ADR-0030) ships adapters for: `claude-code`, `codex`, `cursor`, `windsurf`, `copilot`, and `fabric` itself. Additional hosts (e.g. JetBrains, agentic-tool plugins) can ship their own adapter via ADR-0019 dev-tool-plugin packaging without modifying Fabric Core.

The exact adapter directory conventions per tool, the precise rules for parsing host-specific frontmatter dialects into the closed nine-type taxonomy, the resolution algorithm for shadowing across multiple roots, the configuration schema for adapter root paths, and the host-specific mechanism by which `fab:<system>` injects its directive on each supported host are intentionally left to follow-on FEATURE design. Out of scope for this ADR: any write-back mechanism that would persist Fabric-applied middleware into external tool directories; any non-Fabric tool's own internal middleware mechanism.

### Consequences

* Good, because Cyber Fabric provides one deterministic surface for "what prompts apply here" across Fabric kits and every supported agentic-tool host
* Good, because external prompts become first-class participants in Fabric flows: retrieval through `fabric prompt get`, middleware composition, workspace-aware injection — with zero mutation of source files
* Good, because meta-prompts like "select the appropriate skill for this sub-task" become implementable with a deterministic candidate list across all hosts, not just Fabric kits
* Good, because the existing middleware mechanism (ADR-0031) is reused — no second middleware contract is introduced, and middleware authors can target external prompts with the same id / type / glob selectors
* Good, because the `fab:<system>` in-chat bind makes a chat session deterministic with respect to Fabric middleware without requiring the user to memorize a wrapper command
* Good, because adapter packaging follows the existing dev-tool-plugin model (ADR-0019), so third parties can add adapters without Fabric Core changes
* Bad, because each new agentic-tool host requires an adapter; format drift in any tool can break its adapter
* Bad, because external prompts are read-only — if a user wants a Fabric-curated version, they must author it as a Fabric kit prompt; this is the explicit boundary
* Bad, because identity collisions across global and local scopes need precedence rules (resolved as `local > global`) and may surprise users who expect global to win
* Bad, because the `fab:<system>` directive depends on each host's system-prompt injection capability; hosts without that capability degrade to manual wrapping (`fabric prompt get <id>` invoked explicitly)
* Bad, because middleware composition over external prompts whose source format does not conform to expected boundaries (e.g. malformed frontmatter) may yield render-time failures that surface as `fabric prompt get` errors rather than upstream tool errors

### Confirmation

Confirmed when:

* `fabric prompt list` enumerates prompts across at least the v1 adapter set (`claude-code`, `codex`, `cursor`, `windsurf`, `copilot`, `fabric`) at both global and local scope
* `fabric prompt list --agent <tool>` filters to that host; absence returns the union
* `fabric prompt get <id>` returns rendered content for any listed prompt with middleware applied at default `--render middleware`; raw and full-render modes are also reachable via `--render none|full`
* a middleware-typed Fabric prompt (per ADR-0031) targeting `cc:skill:*` is observably composed onto the corresponding Claude Code skill output via `fabric prompt get cc:skill:<name>` without mutating the source file
* the same retrieval is reachable via `/v1/prompts/{id}` on the REST API for the Web UI and external clients
* a Fabric-shipped `rules`-type prompt addressed as `fab:core:system-route-via-fabric` is registered as a host-native skill on every v1-supported host and, when invoked, emits a system-prompt directive that wraps subsequent prompt invocations with `execute and follow fabric prompt get …`
* discovery, retrieval, and middleware composition respect the active Workspace per ADR-0025 / ADR-0026
* on-disk source files in `~/.claude/...`, `.claude/...`, `~/.codex/...`, `.codex/...`, `.cursor/rules/`, `.windsurf/workflows/`, and the Copilot equivalents remain bytes-for-bytes unchanged across Fabric operations

## Pros and Cons of the Options

### Option 1: No External Discovery

Fabric only enumerates Fabric-kit prompts.

* Good, because nothing new ships
* Bad, because users have no deterministic answer to "what prompts apply here" beyond Fabric kits
* Bad, because external prompts cannot participate in any Fabric-driven flow (retrieval, middleware, workspace-aware injection)
* Bad, because the `fab:<system>` in-chat composition pattern is not implementable
* Bad, because the meta-prompt "select the appropriate skill for this sub-task" can only see Fabric's own skills, defeating the purpose

### Option 2: Mirror External Prompts into Fabric Kits

A sync step copies external prompts into a generated Fabric kit so every prompt is Fabric-native.

* Good, because every prompt becomes uniformly addressable as a Fabric kit prompt
* Bad, because mirroring duplicates state and guarantees drift between source and copy
* Bad, because users edit prompts in place via their tool's UI; sync becomes a perpetual reconciliation problem
* Bad, because mirrored copies break when the source format evolves
* Bad, because the mirror direction is unclear (auto-sync? manual? on demand?) and any answer is invasive

### Option 3: Discovery Adapters per Agentic Tool

Per-tool read-only adapters surface external prompts in place; the unified surface composes with the existing middleware mechanism at retrieval time.

* Good, because external prompts stay where they are, owned by their tools, and never get duplicated
* Good, because the adapter pattern matches Fabric's existing extension shapes (host adapters per ADR-0003, git providers per ADR-0023, dev-tool plugins per ADR-0019)
* Good, because middleware composition is the existing one (ADR-0031), unchanged
* Bad, because each new host costs an adapter; adapters can break if upstream conventions change

## More Information

The cross-agent ID format is intentionally minimal: `tool`, `type`, `slug`, optional `scope`. Type comes from the closed nine-type taxonomy of ADR-0031; mapping host-native conventions onto those types is part of each adapter's job (e.g. Claude Code "skills" map to `skill`, Cursor "rules" map to `rules`, Windsurf "workflows" map to `workflow`, Codex "agents" map to `agent`). Hosts that don't expose a clean type signal (e.g. Copilot's `copilot-instructions.md`) map to the closest taxonomy member with a clear default rather than introducing a tenth type.

The render modes (`none`, `middleware`, `full`) compose: `full` includes `middleware` includes `none`. Middleware composition applies even when the prompt's host has its own middleware-like construct, because Fabric's middleware is orthogonal: it does not replace the host's own composition, it adds Fabric-driven cross-cutting concerns on top of whatever the host already does.

The follow-on items intentionally deferred from this ADR: per-host adapter directory conventions and frontmatter dialects, the resolution algorithm for shadowing across multiple roots, the configuration schema for adapter root paths (e.g. project-relative overrides, environment variable overrides), the precise `fab:<system>` directive payload per host, the registration mechanism that publishes Fabric-shipped `rules`-type prompts as host-native skills on each host, and the error surface for malformed external prompts (degraded result vs hard error per host, telemetry policy under PRD exclusion NX-6).

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-prompts-typed-markdown`, `cpt-cyber-fabric-fr-prompts-middleware-composition`, `cpt-cyber-fabric-fr-skills-cross-tool-registration`, `cpt-cyber-fabric-fr-prompts-delegate-external-agents`, `cpt-cyber-fabric-fr-marketplace-cross-surface`, `cpt-cyber-fabric-fr-surface-parity`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0003](0003-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0007](0007-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0010](0010-cpt-cyber-fabric-adr-prompt-templating-and-instruction-extraction-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-dev-tool-plugins-as-kit-resources-v1.md), [ADR-0020](0020-cpt-cyber-fabric-adr-rest-api-as-fabric-surface-v1.md), [ADR-0021](0021-cpt-cyber-fabric-adr-vscode-plugin-fabric-host-adapter-v1.md), [ADR-0025](0025-cpt-cyber-fabric-adr-multi-workspace-operation-and-context-resolution-v1.md), [ADR-0026](0026-cpt-cyber-fabric-adr-workspace-aware-prompt-rendering-v1.md), [ADR-0030](0030-cpt-cyber-fabric-adr-core-bundled-kit-core-v1.md), [ADR-0031](0031-cpt-cyber-fabric-adr-prompt-type-taxonomy-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must expose one deterministic discovery surface for prompts (skills, sub-agents, rules) across Fabric kits and the v1 set of agentic-tool hosts
* `fabric prompt list` must accept `--agent <tool>` filtering and otherwise return the union; both global and local scopes must be reachable through `--scope`
* `fabric prompt get <id>` must return rendered content with middleware applied at default `--render middleware` for any discovered prompt, not just Fabric-kit prompts
* middleware-typed Fabric prompts (per ADR-0031) must compose into external prompts via id / type / glob selectors at retrieval time, with no mutation of source files
* a Fabric-shipped `fab:<system>` rules prompt must be invocable as a host-native skill on every v1-supported host and, when invoked, must emit a directive that wraps subsequent prompt invocations with `execute and follow fabric prompt get …`
* discovery, retrieval, and middleware composition must respect the active Workspace per ADR-0025 / ADR-0026
* external on-disk source files must remain bytes-for-bytes unchanged across Fabric operations
