---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0031: Prompt Type Taxonomy: Nine Types for Different Consumer Intents

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Formal Type Taxonomy](#option-1-no-formal-type-taxonomy)
  - [Option 2: Free-Form `type` Field](#option-2-free-form-type-field)
  - [Option 3: Closed Nine-Type Taxonomy with Middleware](#option-3-closed-nine-type-taxonomy-with-middleware)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-prompt-type-taxonomy`

## Context and Problem Statement

Cyber Fabric prompts (per ADR-0007 / ADR-0010) are addressable instruction blocks rendered through Handlebars. Today every prompt looks the same to consumers — agents, host tools, humans — so intent (this is a skill registered with my agent tool, vs this is a checklist I should run, vs this is a reference example) is implicit and recovered through naming convention or content inspection. The platform needs a **type taxonomy** that lets prompts declare their intent in frontmatter, lets host tools (Claude Code's skill / subagent registration per ADR-0006 and ADR-0030) and agent flows (workflows, delegations to external agents) treat prompts according to their kind, and lets cross-cutting content compose cleanly.

The platform must also accommodate two semantically richer types: `delegate` (a prompt that wraps invocation of an external agent — Claude, Codex, Devin, GitHub Copilot CLI) which has runtime side-effects, and `workflow` (a prompt that orchestrates other prompts) which has multi-phase semantics. And `middleware` — a prompt that injects itself into other prompts' rendering output by type or identifier — which generalizes the auto-injected workspace summary from ADR-0026.

## Decision Drivers

* **Intent declaration in frontmatter** — every prompt should declare what it is (skill, rules, checklist, etc.), so consumers do not have to infer
* **Closed taxonomy** — a fixed set of types prevents ecosystem fragmentation; free-form types would create incompatible vocabularies across kits
* **Mutex types** — one prompt = one type; multi-typed prompts complicate everything (rendering, registration, consumer code)
* **Type-driven specialization** — `delegate` and `workflow` need explicit runtime treatment that the taxonomy makes discoverable
* **Cross-cutting middleware** — a separate type that composes into other types' rendering (prepend / append) supports policy-as-prompt (safety prefixes, mandatory checklists, audit reminders) without modifying each affected prompt
* **Composes with existing ADRs** — applies to ADR-0007 prompt files, ADR-0010 rendering, ADR-0017 scripts (which are not prompts), ADR-0026 workspace-aware rendering (workspace summary becomes a middleware instance), ADR-0030 `core` kit's prompts
* **Closed for now, evolveable** — the nine-type set is stable; extensions require an ADR amendment, not free addition by every kit

## Considered Options

1. **No Formal Type Taxonomy** — prompts are all the same; consumers infer intent from naming or content
2. **Free-Form `type` Field** — any string allowed; community settles vocabulary by convention
3. **Closed Nine-Type Taxonomy with Middleware** — fixed set of nine canonical types including `middleware` as a cross-cutting injection primitive

## Decision Outcome

Chosen option: **Option 3 — Closed Nine-Type Taxonomy with Middleware**, because Cyber Fabric needs structured intent declaration for prompts AND a clean cross-cutting injection primitive that generalizes ADR-0026's auto-injected workspace summary. The closed set of types prevents ecosystem fragmentation while leaving room for extension via ADR amendments.

Every prompt instruction (per ADR-0007) declares a `type` in its frontmatter. The value is one of nine canonical types described below.

### Type 1: `template`

A content blueprint with placeholders that get filled when rendered. Examples: README template, bug report template, ADR template. The default rendering type — rendered and returned to the consumer.

**Frontmatter (minimum)**: `name`, `description`. Optional: `variables` schema describing expected vars.

### Type 2: `rules`

A set of rules, guidelines, or behavioral constraints. Examples: code style rules, project conventions, safety guidelines. Returned content is meant to be embedded into agent system prompts or read by humans for guidance.

**Frontmatter (minimum)**: `name`, `description`. Optional: `applies_to` (domain identifier).

### Type 3: `skill`

A skill registered with host agent tools (Claude Code, Codex, Cursor) per ADR-0006's central registration tool and ADR-0030's `fab:<kit>:<name>` convention. Skills are reactive — agents invoke them when their declared trigger description matches the situation.

**Frontmatter (minimum)**: `name: "fab:<kit>:<id>"` (registration name; for `core` kit drops the kit segment to `fab:<id>` per ADR-0030), `description` (the trigger). Optional: `tools` (allowed tool list).

### Type 4: `agent`

A sub-agent registered with host agent tools as an autonomous entity (Claude Code subagents, etc.). Agents have a system prompt (the rendered content) and can be dispatched with a task.

**Frontmatter (minimum)**: `name`, `description`, `tools` (allowed tool list). Optional: `model` (which model to use).

### Type 5: `delegate`

A prompt that wraps invocation of an external agent — Claude, Codex, Devin, GitHub Copilot CLI, or other future targets. The rendered content is the input passed to the external agent.

**Runtime mechanism**: `fabric prompt get <kit>:<id>` for a delegate prompt returns the rendered content (the input to the external agent). Actual invocation of the external agent happens through a separate command: `fabric delegate run <kit>:<id> [args...]`. This separation keeps `fabric prompt get` semantics uniform (always render-only, no side effects) while making the runtime side-effect explicit through a different verb.

**Frontmatter (minimum)**: `name`, `description`, `agent` (target identifier — `claude`, `codex`, `devin`, `copilot-cli`, etc.). Optional: `command_template` (CLI invocation override), `input_format` (how to pass the rendered content to the external).

**Extensibility**: the canonical delegate target set is `claude`, `codex`, `devin`, `copilot-cli`. New delegate targets (additional LLM providers, alternative CLI agents) can be added via kits that ship delegate adapters; the kit-side adapter mechanism is follow-on design.

### Type 6: `checklist`

A structured list of verification or process steps. Examples: pre-PR review checklist, deployment checklist, testing checklist. Consumer (agent or human) iterates through items.

**Frontmatter (minimum)**: `name`, `description`. Optional: `items` (structured list of step descriptions).

### Type 7: `example`

Reference example content — a canonical artifact, exemplar code, sample output. Returned as-is to provide consumers with a concrete reference.

**Frontmatter (minimum)**: `name`, `description`. Optional: `for_type` (which type the example illustrates), `for_id` (specific prompt this illustrates).

### Type 8: `workflow`

A multi-step workflow definition. The workflow's rendered content is a markdown document with phases; phases may reference other prompts (skills, agents, delegates, checklists) that consumers invoke at each phase. Consumer (typically an agent) executes phases sequentially.

**Frontmatter (minimum)**: `name`, `description`. Optional: `phases` schema enumerating phase ids and their referenced prompts.

**Execution**: workflows are NOT executed by a dedicated Fabric engine. The consumer (agent) reads the rendered markdown, identifies phases and referenced prompts, and invokes them in order. If structured execution becomes needed in the future, it lives in a marketplace planner kit, not in Fabric core.

### Type 9: `middleware`

A prompt that injects itself into other prompts' rendered output. Selects targets by `type` and / or `id` (with glob patterns), positions itself at `prepend` or `append`, and gets composed into the target's rendering automatically.

**Frontmatter (minimum)**:

```yaml
type: middleware
name: ...
description: ...
target_type: <type>          # e.g. "delegate"; optional if target_id specified
target_id: "<pattern>"       # e.g. "core:skill.*"; optional if target_type specified
position: prepend | append   # default: append
```

At least one of `target_type` / `target_id` must be specified. If both are specified, both must match (AND logic). `target_id` supports glob patterns (`*` for kit segment and / or for instruction-id segment).

**Behavior at `fabric prompt get`**:

1. Resolve target prompt (find instruction)
2. Find all middlewares whose `target_type` matches target's type AND / OR `target_id` matches target's full id
3. Render each applicable middleware
4. Compose: prepend-middlewares' content at the start, target rendered content in the middle, append-middlewares' content at the end
5. Return composed result

**Anti-recursion**: middlewares do NOT match other middlewares (a middleware never injects into another middleware). This prevents infinite loops and unbounded composition.

**Relationship to ADR-0026**: the auto-injected workspace summary block (per ADR-0026) is conceptually a built-in middleware — `target_type: *` (everything), `position: prepend`, content = workspace summary template. The platform may eventually express it as a literal middleware in `core` kit; for now it remains a hard-coded behavior in ADR-0026 with explicit cross-reference here.

### Type identification: source of truth

The `type` field in frontmatter is **authoritative**. Sub-namespace conventions (`core:skill.<name>`, `core:rules.<name>`, etc., per ADR-0030) are organizational hints but Fabric's runtime reads the `type` field for actual behavior dispatch. A prompt's sub-namespace and its `type` should match (e.g., `core:skill.workspace` should have `type: skill`); mismatch is a kit validation error per `core:validate` (ADR-0030).

### Type mutexity

One prompt instruction = one `type`. Multi-type prompts are not allowed; if the content fits two intents, it should be split into two prompts (e.g., a skill that includes a checklist becomes two prompts: a `skill` + a `checklist`, with the skill referencing the checklist).

### Out of scope (follow-on)

* Exhaustive frontmatter schema for each type beyond the minimums set in this ADR
* Delegate runtime — concrete invocation mechanics per external agent target (Claude API, Codex CLI, Devin agent, etc.); each delegate adapter kit specifies its own
* Workflow execution engine (if needed, marketplace planner kit)
* Middleware composition order when multiple middlewares apply to the same target (likely id-sorted for determinism; specifics follow-on)
* Per-prompt opt-out of middlewares (e.g., `apply_middlewares: false` frontmatter) — possibly useful for control prompts; follow-on
* Type composition / inheritance (a "compound" type combining characteristics) — explicitly rejected initially
* Migration path for existing POC prompts without `type` field — convention is `type: rules` if unspecified (matching POC's `prd-brainstorm.md`)
* Type extension — adding new types beyond the canonical nine requires an ADR amendment

### Consequences

* Good, because consumers (agents, host tools, humans) see explicit intent in every prompt
* Good, because skill / agent / delegate registration into host tools dispatches by `type` reliably
* Good, because middleware enables cross-cutting concerns (safety prefixes, mandatory checklists, audit reminders) without modifying each prompt
* Good, because `delegate` and `workflow` get explicit runtime treatment — no more guessing
* Good, because the closed taxonomy prevents kit ecosystem from fragmenting into incompatible vocabularies
* Good, because workspace summary auto-injection (ADR-0026) is now expressible as a regular middleware, unifying the model
* Bad, because every prompt now needs a `type` field — POC prompts need migration
* Bad, because the closed taxonomy means new types require ADR amendments — slower to evolve
* Bad, because middleware composition adds rendering complexity (apply order, anti-recursion, opt-out semantics) that needs careful follow-on design

### Confirmation

Confirmed when:

* every prompt instruction declares `type` in its frontmatter, with value one of: `template`, `rules`, `skill`, `agent`, `delegate`, `checklist`, `example`, `workflow`, `middleware`
* type identification is mutex (one prompt = one type) and authoritative through the `type` field; sub-namespace is organizational convention
* `skill` and `agent` types are registered with host agent tools per ADR-0006 / ADR-0030's `fab:<kit>:<name>` convention
* `delegate` type has separate execution (`fabric delegate run <kit>:<id> [args...]`); `fabric prompt get` for delegate returns rendered content (the external agent's input)
* `workflow` type has no dedicated execution engine — consumer iterates phases and invokes referenced prompts
* `middleware` type composes into target prompts' rendering by `target_type` and / or `target_id`, at `prepend` or `append` position
* middlewares do not apply to other middlewares (anti-recursion)
* the workspace summary auto-injection from ADR-0026 is conceptually a built-in middleware

## Pros and Cons of the Options

### Option 1: No Formal Type Taxonomy

Prompts are all the same; consumers infer intent from naming or content.

* Good, because the prompt model stays minimal
* Good, because adding new prompts requires no taxonomy decision
* Bad, because consumers (agents, host tools) cannot reliably dispatch by intent
* Bad, because skill / agent / delegate registration into host tools relies on naming convention which drifts
* Bad, because cross-cutting concerns (mandatory safety prefixes, checklists) have no clean injection mechanism

### Option 2: Free-Form `type` Field

Prompts declare a `type` but the value is free-form; community settles vocabulary by convention.

* Good, because authors can express any intent without ADR amendments
* Good, because evolution is unbounded
* Bad, because ecosystem fragments — different kits use incompatible types for the same intent
* Bad, because dispatching code (in host tools, agent flows) cannot rely on a stable vocabulary
* Bad, because the type-driven specializations (`delegate` runtime, `workflow` semantics, `middleware` composition) have no canonical names

### Option 3: Closed Nine-Type Taxonomy with Middleware

Fixed set of nine canonical types including `middleware`; `type` field authoritative; one prompt = one type.

* Good, because consumers dispatch reliably by type
* Good, because the platform can specialize behavior for `delegate`, `workflow`, `middleware` with confidence
* Good, because middleware unifies cross-cutting concerns (including ADR-0026's workspace summary) under one model
* Good, because the closed set prevents fragmentation
* Bad, because evolution requires ADR amendments
* Bad, because every prompt needs a `type` field; POC prompts need migration

## More Information

The nine canonical types and their one-line summaries:

* **`template`** — content blueprint with placeholders
* **`rules`** — guidelines / conventions / behavioral constraints
* **`skill`** — reactive trigger registered with host agent tools per ADR-0030 `fab:` convention
* **`agent`** — autonomous sub-agent registered with host agent tools
* **`delegate`** — wraps invocation of external agent (Claude, Codex, Devin, Copilot CLI); rendered = input; separate `fabric delegate run` actually invokes
* **`checklist`** — structured verification / process steps
* **`example`** — reference exemplar / canonical artifact
* **`workflow`** — multi-phase markdown definition referencing other prompts; no Fabric execution engine
* **`middleware`** — cross-cutting injection by `target_type` and / or `target_id` glob, at `prepend` or `append` position; anti-recursion by construction

The exact frontmatter schema for each type beyond the minimums listed above, the delegate adapter mechanism for kits to add new external agent targets, the workflow execution conventions if structured execution becomes needed, the middleware composition order semantics when multiple middlewares apply to the same target, and the per-prompt opt-out for middlewares are all intentionally left to follow-on design.

This decision composes with several existing ADRs:

* **ADR-0007** (prompt file model) — the `type` field lives in the frontmatter of each prompt's instruction blocks
* **ADR-0010** (templating + extraction) — `fabric prompt get <kit>:<id>` reads the type, applies type-specific behavior (mostly uniform render-and-return; specializations for `delegate` and middleware composition)
* **ADR-0017** (scripts as kit resources) — scripts are not prompts; the type taxonomy applies only to prompt instructions
* **ADR-0026** (workspace-aware prompt rendering) — workspace summary auto-injection is conceptually a built-in middleware (`target_type: *`, `position: prepend`)
* **ADR-0030** (`core` kit) — sub-namespace conventions (`core:skill.<name>`, `core:rules.<name>`, etc.) align with the `type` field; `core:validate` enforces consistency

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-prompts-typed-markdown`, `cpt-cyber-fabric-fr-prompts-middleware-composition`, `cpt-cyber-fabric-fr-prompts-delegate-external-agents`
- **Related decisions**: [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0007](0007-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md), [ADR-0010](0010-cpt-cyber-fabric-adr-prompt-templating-and-instruction-extraction-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0026](0026-cpt-cyber-fabric-adr-workspace-aware-prompt-rendering-v1.md), [ADR-0030](0030-cpt-cyber-fabric-adr-core-bundled-kit-core-v1.md)

This decision directly addresses the following traceability items:

* every prompt instruction must declare a `type` in frontmatter, drawn from a closed nine-type set
* the nine canonical types are `template`, `rules`, `skill`, `agent`, `delegate`, `checklist`, `example`, `workflow`, `middleware`
* one prompt = one type (mutex)
* the `type` field is authoritative; sub-namespace conventions (per ADR-0030) are organizational hints
* `skill` and `agent` types register with host agent tools per ADR-0006 and ADR-0030's `fab:<kit>:<name>` convention
* `delegate` type has separate execution via `fabric delegate run <kit>:<id> [args...]`; `fabric prompt get` returns rendered content only
* `delegate` target set is canonical (`claude`, `codex`, `devin`, `copilot-cli`) but extensible via kit-shipped adapters
* `workflow` type has no dedicated execution engine; consumers iterate phases and invoke referenced prompts
* `middleware` type composes into target prompts by `target_type` and / or `target_id`, at `prepend` or `append` position
* middlewares do not match other middlewares (anti-recursion)
* ADR-0026's workspace summary auto-injection is conceptually a built-in middleware
* extensions to the type taxonomy require ADR amendments
