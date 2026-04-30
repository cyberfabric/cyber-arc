---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0007: Generate Agent Prompts Exclusively Through a Tool from Layered Markdown Prompt Files with Handlebars Block-Helper Instructions

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Hand-Author Agent Prompts as Monolithic Markdown Files](#option-1-hand-author-agent-prompts-as-monolithic-markdown-files)
  - [Option 2: Markdown Prompt Files with HTML-Comment Instruction Markers](#option-2-markdown-prompt-files-with-html-comment-instruction-markers)
  - [Option 3: Markdown Prompt Files with Handlebars Block-Helper Instructions](#option-3-markdown-prompt-files-with-handlebars-block-helper-instructions)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-tool-generated-layered-prompts`

## Context and Problem Statement

Cyber Fabric needs a prompt system that authors can read and edit comfortably, that the platform can compose deterministically, that users can override surgically at instruction granularity, and that does not invent parallel grammars for instruction identity and dynamic content. Hand-authored monolithic prompt files make targeted overrides difficult and force copy-and-fork maintenance whenever a project needs a small variation. HTML-comment instruction markers — the convention currently used in the cyber-fabric POC, for example `<!-- append "brainstorm_role_panel" --> ... <!-- /append -->` — give every instruction a stable identifier but live in a different grammar than the templating engine used for conditional content, so authors and tooling have to deal with two parallel marker systems once dynamic prompts are introduced.

The platform therefore needs one authoritative tool that generates agent prompts from authored markdown files, and one syntactic primitive — based on the same Handlebars engine that ADR-0010 commits to for templating — that expresses both instruction granularity / identity and any conditional content inside an instruction.

## Decision Drivers

* **Authoring ergonomics** — prompt authors must be able to write prompts as markdown documents
* **Deterministic generation** — the agent-facing prompt must be materialized by one repeatable tool, not edited as a runtime artifact
* **Surgical overrides** — users must be able to replace, append, remove, or reorder specific instructions without rewriting whole prompt documents
* **Stable instruction identity** — an instruction must keep its identifier across versions and overrides even when the surrounding text changes
* **Layering** — project-specific prompt behavior must take precedence over user-level customization, which in turn overrides defaults shipped with the kit
* **Single syntax for identity and dynamics** — instruction identity and conditional content should not require two parallel grammars
* **Visible scaffolding** — readers reviewing a prompt should immediately see, in the rendered markdown view, that a block contains dynamic or override content rather than having dynamics hidden behind invisible HTML comments

## Considered Options

1. **Hand-Author Agent Prompts as Monolithic Markdown Files** — prompts are written and overridden directly as large markdown documents with no per-instruction addressability
2. **Markdown Prompt Files with HTML-Comment Instruction Markers** — markdown files with frontmatter and HTML-comment marker blocks (such as `<!-- append "<id>" --> ... <!-- /append -->`) carry instruction identity, while a separate templating engine handles dynamics
3. **Markdown Prompt Files with Handlebars Block-Helper Instructions** — markdown files with frontmatter where individual instructions are delimited by Handlebars block helpers (such as `{{#instruction "<id>"}} ... {{/instruction}}`), and the same Handlebars syntax expresses both instruction identity and conditional content

## Decision Outcome

Chosen option: **Option 3 — Markdown Prompt Files with Handlebars Block-Helper Instructions**, because Cyber Fabric needs prompts to be human-readable, override-friendly at instruction granularity, and able to express dynamic content without inventing parallel grammars. Prompts are authored as markdown files with YAML frontmatter (covering at least `id`, `type`, `name`, and `description`). Inside a prompt file, individual instructions are demarcated by Handlebars block helpers — for example `{{#instruction "<instruction-id>"}} ... {{/instruction}}` — where each block carries a stable identifier and the same Handlebars syntax that delimits the block can also express conditional content inside it through built-in helpers such as `{{#if}}` and `{{#unless}}`.

The agent-facing prompt is materialized only through the generation tool, never maintained directly as a runtime artifact. Override layers, in priority order, are:

1. **Project prompt layer** — highest priority, scoped to one repository or workspace
2. **Outside-project user prompt layer** — next priority, the user's personal prompt customizations
3. **Default prompt layer** — fallback base, shipped with the kit

Higher-priority layers may replace, append, remove, or reorder instructions by id. Override semantics themselves are expressed through Handlebars block helpers in higher-priority layers — for example `{{#replace "id"}} ... {{/replace}}`, `{{#append after="id"}} ... {{/append}}`, `{{#remove "id" /}}`, and similar — so that override grammar composes with conditional grammar in one runtime instead of needing a separate marker syntax. The canonical helper set is intentionally left to follow-on design work that builds on this decision. Final prompt assembly preserves deterministic ordering after overrides are applied.

Identity and conditional content share one Handlebars-based syntax. The split between this ADR and ADR-0010 is therefore not a split of syntax but of concern: this ADR owns the file model, the instruction-granularity primitive, and the override-layer model, while ADR-0010 owns the engine choice, the variable resolution model, and the per-instruction extraction interface (`fabric prompt get`).

### Consequences

* Good, because authors edit prompts as markdown — the format they already use everywhere else
* Good, because instruction blocks have stable identifiers that survive surrounding text changes
* Good, because users can override prompts surgically at instruction granularity
* Good, because one Handlebars-based syntax covers identity, override addressing, and conditional content — there is no parallel marker grammar
* Good, because Handlebars block-helper scaffolding is visible in rendered markdown, giving reviewers an immediate visual signal that a block contains dynamic or override content rather than plain prompt prose
* Good, because override verbs become discoverable Handlebars helpers that compose naturally with conditionals
* Good, because the parsed Handlebars AST is available for tooling such as validation, extraction, and layered merging
* Bad, because every prompt file requires a Handlebars-aware materializer — there is no plain-markdown read path
* Bad, because the canonical helper set (`instruction` plus override verbs) must remain stable across versions
* Bad, because authors must learn the Handlebars block-helper subset Cyber Fabric uses, even for prompts that contain no conditional content
* Bad, because debugging final prompt output requires layer-aware and helper-aware inspection tooling

### Confirmation

Confirmed when:

* prompt files are authored as markdown documents with YAML frontmatter for metadata
* individual instructions are delimited by `{{#instruction "<id>"}} ... {{/instruction}}` Handlebars block helpers
* instruction identifiers (`<id>`) are unique within the kit (across all prompt files in that kit), so that `fabric prompt get <kit>:<id>` (per ADR-0010) addresses one specific instruction unambiguously
* override semantics (replace, append, remove, reorder) are realized as Handlebars block helpers in higher-priority layers, not as a separate marker syntax
* the agent-facing prompt is materialized only through the generation tool
* higher-priority layers can replace, append, remove, and reorder instructions by id
* override precedence is enforced as project layer, then outside-project user layer, then default kit layer
* HTML-comment instruction markers are not used; instruction identity lives in Handlebars block helpers

## Pros and Cons of the Options

### Option 1: Hand-Author Agent Prompts as Monolithic Markdown Files

Maintain prompts as large markdown documents and override them by editing copies.

* Good, because it is initially simple to read and edit
* Good, because no dedicated tooling is required at first
* Bad, because there is no instruction-level addressability for surgical overrides
* Bad, because customization forces copy-and-fork maintenance
* Bad, because the layered-override model has nothing to address against

### Option 2: Markdown Prompt Files with HTML-Comment Instruction Markers

Use markdown files with HTML-comment instruction markers (such as `<!-- append "<id>" --> ... <!-- /append -->`) for identity, and a separate templating engine for dynamics.

* Good, because markers disappear in rendered markdown, keeping the documentation view clean
* Good, because the identity layer is independent of any templating engine
* Good, because regex-friendly extraction tooling is straightforward
* Bad, because once dynamic content is added, the prompt has two parallel grammars: HTML-comment markers for identity and templating syntax for conditionals
* Bad, because rendered markdown does not visually distinguish a plain instruction from one with dynamic content
* Bad, because override verbs require their own marker grammar that does not compose with templating helpers
* Bad, because HTML comments are not part of markdown's structural grammar — markdown-aware tools may relocate, strip, or normalize them in ways that break identity

### Option 3: Markdown Prompt Files with Handlebars Block-Helper Instructions

Markdown files with frontmatter where individual instructions are delimited by Handlebars block helpers, and the same Handlebars syntax expresses both identity and conditional content.

* Good, because identity and dynamics share one syntax — there is no parallel grammar
* Good, because scaffolding is visible in rendered markdown, signalling to readers that a block is dynamic or override-related rather than plain prompt prose
* Good, because override verbs become discoverable Handlebars helpers that compose naturally with conditionals
* Good, because the Handlebars AST is available for extraction, validation, and layered merging tooling
* Bad, because every prompt file requires a Handlebars-aware tool — there is no pure-markdown read path
* Bad, because authors must learn the Handlebars block-helper subset Cyber Fabric uses
* Bad, because the canonical helper set (`instruction` plus override verbs) must be designed carefully and remain stable across versions

## More Information

The intended file shape is illustrated by:

```markdown
---
id: prd-brainstorm
type: rules
name: prd brainstorm
description: Run a multi-role brainstorming workflow that drives decisions into the PRD template
---

{{#instruction "brainstorm_intro"}}
Use PRD brainstorming mode.
{{/instruction}}

{{#instruction "brainstorm_role_panel"}}
Act as a rotating panel of roles. Each role must contribute from its own perspective:
- CEO
- Board of Directors
{{#if includeFullPanel}}
- Chief Product Manager
- Principal Product Designer
{{/if}}
{{/instruction}}
```

Higher-priority layers express their changes through additional Handlebars block helpers. For example, a project layer might use `{{#replace "brainstorm_role_panel"}} ... {{/replace}}` to replace the default panel definition, or `{{#remove "brainstorm_intro" /}}` to remove an instruction. The canonical override-helper set is intentionally left to follow-on design work that builds on this decision.

For the templating engine that backs `{{#instruction}}` and any conditional expressions inside it, the variable resolution model, and the `fabric prompt get` extraction interface, see ADR-0010.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-prompts-typed-markdown`, `cpt-cyber-fabric-fr-prompts-layered-overrides`, `cpt-cyber-fabric-usecase-dev-customize-upstream-kit`, `cpt-cyber-fabric-usecase-pe-extend-other-kits`
- **Related decisions**: [ADR-0010](0010-cpt-cyber-fabric-adr-prompt-templating-and-instruction-extraction-v1.md)

This decision directly addresses the following traceability items:

* prompts must be authored as markdown files with YAML frontmatter
* individual instructions must carry stable identifiers via Handlebars block helpers, not via a parallel HTML-comment marker grammar
* the agent-facing prompt is generated exclusively by the tool
* higher-priority layers may replace, append, remove, and reorder instruction blocks by id through Handlebars helpers
* prompt precedence is project layer, then outside-project user layer, then default kit layer
* identity and conditional content share one Handlebars-based syntax
