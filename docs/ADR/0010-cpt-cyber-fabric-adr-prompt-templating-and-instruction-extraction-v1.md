---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0010: Adopt Handlebars for Prompt Templating with Layered Variable Resolution and Per-Instruction Extraction

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Templating Engine, Static Prompt Content Only](#option-1-no-templating-engine-static-prompt-content-only)
  - [Option 2: Adopt Handlebars with Layered Variables and Per-Instruction Extraction](#option-2-adopt-handlebars-with-layered-variables-and-per-instruction-extraction)
  - [Option 3: Adopt EJS or an Embedded-JS Template Engine](#option-3-adopt-ejs-or-an-embedded-js-template-engine)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-prompt-templating-and-instruction-extraction`

## Context and Problem Statement

ADR-0007 establishes that prompts are markdown files in which individual instructions are demarcated by Handlebars block helpers — `{{#instruction "<id>"}} ... {{/instruction}}` — and that higher-priority layers can override individual instructions by id. That model handles structural variation across projects and users very well, but the platform still needs to commit to a specific templating engine, decide how variables are resolved across configuration layers, and define a CLI surface that lets other tools enumerate, inspect, and pull rendered instructions out of a prompt by their identifiers — including the ability to override variables ad hoc on the command line for a single invocation.

Without an explicit engine choice and variable model, ADR-0007's `{{#instruction}}` syntax has no runtime, conditional content inside instructions cannot be expressed safely, and `fabric prompt get` has no defined behavior. Without a discoverable CLI surface symmetric with the script CLI from ADR-0017, prompt-shipping kits and script-shipping kits would have inconsistent operator experiences for two adjacent concepts.

## Decision Drivers

* **Conditional content** — prompt authors must be able to express that an instruction or part of an instruction depends on variable values
* **Layered variables** — variables must be resolvable from a global (user / installation) layer and a local (project / workspace) layer, with the local layer overriding the global one
* **Per-instruction extraction and discovery** — operators and other tools must be able to enumerate, inspect, and pull a single rendered instruction out of a prompt by its identifier
* **CLI symmetry with scripts (ADR-0017)** — kits ship both prompts and scripts; their CLI surfaces should follow the same `<kit>:<id>` addressing scheme to keep the operator experience consistent
* **Ad-hoc CLI overrides** — `fabric prompt get` must be able to receive variable overrides on the command line that take effect for that single invocation
* **Industry-standard engine** — the templating engine should be the most widespread and well-supported choice in the TypeScript ecosystem so that contributors and users do not need to learn a niche syntax
* **Single runtime with ADR-0007** — the same engine that defines instruction granularity must also evaluate conditional content, so that the prompt model has one parser and one runtime instead of two parallel ones
* **Safety** — the engine must not allow templates to execute arbitrary host code

## Considered Options

1. **No Templating Engine, Static Prompt Content Only** — keep the granularity model but accept that conditional content must be expressed by parallel prompt files
2. **Adopt Handlebars with Layered Variables and Per-Instruction Extraction** — Handlebars renders both `{{#instruction}}` block helpers (ADR-0007) and conditional expressions inside them, variables are resolved from a global config layer overridden by a local project layer (with CLI overrides at the highest priority), and `fabric prompt list / info / get <kit>:<id> [args...]` provides a CLI surface symmetric with the script CLI (ADR-0017)
3. **Adopt EJS or an Embedded-JS Template Engine** — use an engine that lets templates execute arbitrary JavaScript expressions for maximum flexibility

## Decision Outcome

Chosen option: **Option 2 — Adopt Handlebars with Layered Variables and Per-Instruction Extraction**, because Handlebars is the most widespread general-purpose templating engine in the TypeScript ecosystem (over an order of magnitude more weekly npm downloads than any of its safe alternatives), it supports the conditionals Cyber Fabric needs through built-in `{{#if}}` and `{{#unless}}` blocks, it sandboxes template evaluation so prompts cannot execute arbitrary host code, and it is the same engine that ADR-0007 commits to for its `{{#instruction}}` block-helper grammar — using Handlebars for variable resolution and conditionals therefore adds no parallel runtime.

The decision has four parts:

1. **Templating engine** — Handlebars is the official prompt-templating engine for Cyber Fabric. The same Handlebars runtime evaluates both the `{{#instruction}}` block helpers that define instruction granularity (ADR-0007) and any conditional expressions inside them.

2. **Variable layers** — template variables are resolved by merging a **global** configuration file (user / installation level) and a **local** configuration file (project / workspace level). The local layer overrides the global layer on a per-key basis. Both files use the same key model.

3. **Per-instruction extraction and discovery** — instructions inside prompt files are addressable through a CLI surface symmetric with the script CLI from ADR-0017:
   * `fabric prompt list [--kit <id>] [--json]` — list all instructions across installed kits, narrowable by kit; output includes `<kit>:<id>` identifiers and instruction descriptions
   * `fabric prompt info <kit>:<id> [--json]` — return the structured record for one instruction (kit, id, description, source prompt file, declared variables) without rendering
   * `fabric prompt get <kit>:<id> [args...]` — render the instruction with current variables and return only the rendered content; `[args...]` carries `--var key=value` overrides per part 4

   Instruction identifiers (`<id>` in `<kit>:<id>`) are **unique within the kit** (across all prompt files in that kit), so that the addressing scheme is unambiguous. The extractor walks the parsed Handlebars AST across the kit's prompt files, finds the `{{#instruction}}` block helper whose id matches, and renders only that block against the resolved variable set.

4. **Ad-hoc CLI overrides** — the `[args...]` portion of `fabric prompt get <kit>:<id> [args...]` accepts per-invocation variable overrides as `--var key=value`. CLI overrides take precedence over the local layer, which takes precedence over the global layer.

The full variable precedence (highest to lowest) is therefore:

1. CLI overrides passed to `fabric prompt get`
2. Local / project configuration
3. Global / user configuration

### Consequences

* Good, because authors can express conditional content inline next to the instruction it modifies instead of forking prompts per configuration
* Good, because variable resolution mirrors the global to local override pattern users already know from ADR-0007's prompt-layer model
* Good, because the prompt CLI surface (`list / info / get <kit>:<id>`) is symmetric with the script CLI (ADR-0017), so operators learn one addressing scheme for both concepts
* Good, because `fabric prompt get` becomes a precise extraction primitive that other tools can call to pull one rendered instruction at a time
* Good, because CLI overrides give callers a clean way to render a prompt for a specific scenario without mutating any configuration file
* Good, because Handlebars is mainstream, widely understood, sandboxed, and well-typed in TypeScript
* Good, because identity (ADR-0007) and templating share one runtime — there is no parallel parser to maintain
* Bad, because adding a templating layer increases the cognitive load on prompt authors who previously only had to know markdown
* Bad, because debugging a rendered instruction requires inspecting both the override layers (ADR-0007) and the variable layers
* Bad, because the variable schema across global, local, and CLI sources must be documented and validated to avoid silent typos or undefined references
* Bad, because the kit-uniqueness constraint on instruction ids has to be enforced at kit packaging time (ADR-0006) — kits with id collisions across prompt files must be rejected

### Confirmation

Confirmed when:

* the prompt materializer evaluates Handlebars expressions inside instruction blocks as part of generation
* template variables are read from a global configuration file and a local configuration file, with the local file overriding the global on a per-key basis
* `fabric prompt list [--kit <id>] [--json]`, `fabric prompt info <kit>:<id> [--json]`, and `fabric prompt get <kit>:<id> [args...]` are implemented and addressable through the `<kit>:<id>` scheme symmetric with the script CLI of ADR-0017
* `fabric prompt get <kit>:<id> [args...]` returns only that instruction's rendered content; instruction ids are unique within the kit
* `fabric prompt get` accepts variable overrides through `--var key=value` arguments and applies them as the highest-priority layer for that invocation
* a prompt that uses no conditional expressions inside its `{{#instruction}}` blocks renders identically to its plain-content reading

## Pros and Cons of the Options

### Option 1: No Templating Engine, Static Prompt Content Only

Keep instruction granularity but require parallel prompt files for any conditional variation.

* Good, because the prompt model stays minimal
* Good, because there is no engine to maintain
* Bad, because every conditional variation forces a forked prompt file
* Bad, because the same prompt cannot be rendered for different scenarios at runtime
* Bad, because ADR-0007's `{{#instruction}}` block helpers would still need a Handlebars runtime to evaluate, so the "no engine" framing is fictional in practice

### Option 2: Adopt Handlebars with Layered Variables and Per-Instruction Extraction

Use the Handlebars runtime that ADR-0007 already commits to, resolve variables from layered global and local configuration, support per-instruction extraction via `fabric prompt list / info / get <kit>:<id>`, and accept ad-hoc CLI overrides.

* Good, because Handlebars is the most widespread safe templating engine in the TypeScript ecosystem
* Good, because identity (ADR-0007) and templating share one runtime
* Good, because conditional content lives inline next to the instruction it modifies
* Good, because the global to local to CLI precedence matches the existing layered-override mental model
* Good, because the CLI is symmetric with the script CLI of ADR-0017 (`<kit>:<id>` addressing for both)
* Good, because per-instruction extraction is a sharp, reusable primitive
* Bad, because authors must learn the Handlebars subset Cyber Fabric uses
* Bad, because variable schemas need explicit documentation and validation
* Bad, because the kit-uniqueness constraint on instruction ids has to be enforced at kit packaging time

### Option 3: Adopt EJS or an Embedded-JS Template Engine

Use a template engine that lets templates execute arbitrary JavaScript inline.

* Good, because templates can express any imaginable transformation
* Good, because some authors already know the syntax from web templating
* Bad, because templates can execute arbitrary host code, which is unsafe for shared kits and untrusted sources
* Bad, because the engine encourages mixing logic into prompts in ways that are hard to review
* Bad, because the broader TypeScript prompt-engineering ecosystem has not converged on EJS-style engines

## More Information

The intended granularity-plus-templating integration is illustrated by:

```markdown
{{#instruction "brainstorm_role_panel"}}
Act as a rotating panel of roles:
- CEO
- Board of Directors
{{#if includeFullPanel}}
- Chief Product Manager
- Principal Product Designer
{{/if}}
{{/instruction}}
```

A user invokes the rendered instruction through the kit-namespaced CLI, for example:

```bash
fabric prompt get prd-kit:brainstorm_role_panel --var includeFullPanel=true
```

The variable model:

* a global configuration file lives at the user / installation level and applies across the user's projects
* a local configuration file lives inside a project or workspace and applies to that project only
* on every key, the local layer overrides the global layer; missing keys fall through to the global layer
* `fabric prompt get <kit>:<id> [args...]` accepts variable overrides through `--var key=value` arguments, which take effect for that invocation only and override both the local and global layers

The exact configuration-file format, schema validation rules, the canonical Handlebars helper set Cyber Fabric registers beyond the built-ins (for example any custom helpers for prompt-specific operations), and the kit-packaging-time validation that enforces instruction-id uniqueness within a kit are intentionally left to follow-on design work that builds on this decision.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-prompts-variable-resolution`, `cpt-cyber-fabric-fr-prompts-typed-markdown`, `cpt-cyber-fabric-usecase-dev-share-parameterized-prompt`
- **Related decisions**: [ADR-0007](0007-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md)

This decision directly addresses the following traceability items:

* prompts gain a templating layer on top of the instruction-granularity model from ADR-0007
* Handlebars is the chosen templating engine, used as the single runtime for both identity and conditional content
* template variables are resolved from a layered global and local configuration with local-over-global precedence
* `fabric prompt list [--kit <id>] [--json]`, `fabric prompt info <kit>:<id>`, and `fabric prompt get <kit>:<id> [args...]` provide discovery, metadata, and rendering symmetric with the script CLI of ADR-0017
* instruction identifiers (`<id>` in `<kit>:<id>`) must be unique within the kit
* `fabric prompt get` accepts CLI variable overrides through `--var key=value` arguments that take precedence over the local and global layers
