---
id: prompt-engineering
type: rules
name: prompt engineering
description: Clarity, structure, anti-pattern, context-engineering, and improvement-synthesis methodology for prompts; companion rules loaded by prompt-review
---

<!-- append "engineering_heading" -->
# Prompt Engineering Review Methodology
<!-- /append -->

<!-- append "engineering_scope" -->
**Scope**: Any file containing agent instructions — system prompts, skills, workflows, requirements, `AGENTS.md`, and methodologies.

**Out of scope**: This does not provide a "best prompt" template or generate production prompts; it defines a review method and report format.

**Companion methodology**: for bug hunting, hidden failure modes, unsafe behavior, regressions, instruction conflicts, or root-cause analysis in prompts and agent instructions, also use the `prompt-bug-finding` rules (load via `fabric-poc prompt get prompt-bug-finding`) as the behavioral defect search procedure.
<!-- /append -->

<!-- append "engineering_overview" -->
## Overview

Agent instructions are executable policy for human cognition. Review them like software: classify the artifact, test for ambiguity, verify structure, identify missing contracts, detect anti-patterns, manage context budget, confirm testability, check model ergonomics, then synthesize prioritized fixes.

**High-priority rule**: for analysis and generation work, aggressively reduce loaded context whenever behavior, determinism, constraints, safety, output contracts, and recovery rules remain intact.
<!-- /append -->

<!-- append "engineering_layer_map" -->
## Layer Map

| Layer | Question |
|---|---|
| L1 | What kind of instruction document is this? |
| L2 | Are the instructions explicit and unambiguous? |
| L3 | Is the document scannable and cognitively manageable? |
| L4 | What required information is missing? |
| L5 | Which prompt anti-patterns are present? |
| L6 | Is context loaded, compressed, and preserved correctly? |
| L7 | Can compliance be verified? |
| L8 | Does the document align with LLM strengths and limits? |
| L9 | What should be fixed first? |
<!-- /append -->

<!-- append "engineering_l1_classification" -->
## L1: Document Classification

**Primary type**: identify whether the document is a `System Prompt`, `Skill/Tool`, `Workflow`, `Requirement`, `AGENTS.md`, `Template`, or `Checklist`.

**Instruction scope**: mark whether the rules are `Global`, `Conditional` (`WHEN`-gated), or `Task-Specific`.

**Audience**: determine whether it targets a `Single Agent Type`, is `Agent-Agnostic`, or is `Hybrid`.

**Dependencies**: list referenced docs, detect circular dependencies, confirm dependencies exist and are accessible, and verify version compatibility.

**Preconditions**: record what must already be true, what context must be loaded first, and what tools or capabilities are assumed.

**Fabric type mapping**: when reviewing a fabric-poc prompt, map the primary types above to the fabric catalog returned by `fabric-poc prompt types` (`skill`, `rules`, `template`, `middleware`, `workflow`, `checklist`, `agent`). The fabric catalog is authoritative for type-fit checks; this classification layer is additive.
<!-- /append -->

<!-- append "engineering_l2_clarity" -->
## L2: Clarity & Specificity

**Ambiguity scan**: flag vague qualifiers (`appropriate`, `relevant`, `suitable`, `proper`, `good`), subjective terms (`better`, `improved`, `professional`, `clean`), undefined references (`the above`, `this`, `that`, `it`), implicit assumptions, and weasel words (`might`, `could`, `possibly`, `generally`, `usually`).

**Specificity**: every instruction should state **WHO** acts, **WHAT** happens, **WHEN** it triggers, **HOW** it is executed, and **WHY** it matters.

**Quantification**: prefer explicit counts, limits, and thresholds over words like `few`, `brief`, or `many`.

**Sentence quality**: use imperative mood, prefer active voice, and keep to one action per sentence when possible.

**Framing**: prefer positive requirements; if a negative is necessary, pair it with the required alternative; distinguish `MUST NOT` / `NEVER` from `SHOULD NOT` / `AVOID`.

**Priority**: critical rules are marked (`MUST`, `REQUIRED`, `CRITICAL`), optional rules are marked (`MAY`, `OPTIONAL`, `CONSIDER`), and importance hierarchy is obvious.

**Compact clarity rules**: use short imperative sentences; front-load trigger + action + object (`WHEN X, do Y to Z`); use explicit nouns and verbs; replace vague wording with measurable limits or decision rules; keep stable terminology; remove filler and repeated restatements; prefer bullets, tables, and checklists over narrative; keep only examples that change behavior or clarify edge cases.
<!-- /append -->

<!-- append "engineering_l3_structure" -->
## L3: Structure & Organization

**Hierarchy quality**: headings follow logical `H1 -> H2 -> H3` order, section titles are descriptive, related content is grouped together, and the document uses inverted-pyramid ordering where important content appears early.

**Chunking**: long sections are split into digestible units; lists replace enumeration paragraphs; tables handle structured comparison; code blocks are reserved for commands and examples.

**Navigation aids**: long docs include a TOC, related sections are cross-linked, boundaries are visually clear, and a summary or overview appears near the start.

**Cognitive load**: keep one concept per paragraph, avoid nested conditionals beyond two levels, express complex logic as decision trees or ordered steps, and define abbreviations on first use.

**Visual hierarchy**: emphasize important terms with bolding, keep code and IDs in backticks, make warnings visually distinct, and clearly demarcate examples.

**Redundancy check**: remove contradictions, mark intentional repetition as intentional, and replace duplication with cross-references.
<!-- /append -->

<!-- append "engineering_l4_completeness" -->
## L4: Completeness Analysis

**Identity & purpose**: verify a purpose statement, scope boundary, and success criteria.

**Operational elements**: verify entry conditions, exit conditions, response-completion gates, required terminal sections or handoff blocks, error handling, and edge-case guidance.

**Integration elements**: dependencies are listed, outputs are defined, handoffs to other workflows are specified, and any required final prompt pair or terminal block ordering is explicit.

**Gap analysis**: ask what happens if the agent does not understand, preconditions are not met, multiple interpretations exist, or external resources are unavailable.

**Scenario coverage**: ensure the happy path, error paths, recovery procedures, escalation triggers, and completion branches are documented; check whether the response can terminate after a summary, validation block, or next-step menu even though required final sections are still missing.
<!-- /append -->

<!-- append "engineering_l5_heading" -->
## L5: Anti-Pattern Detection
<!-- /append -->

<!-- append "engineering_l5_anti_patterns_specification" -->
### Specification

| Code | Detect when |
|---|---|
| `AP-VAGUE` | Instructions rely on common sense, ambiguity, or implicit knowledge. |
| `AP-MISSING-FORMAT` | Output format is not specified. |
| `AP-MISSING-ROLE` | Needed persona or expertise is undefined. |
| `AP-MISSING-CONSTRAINTS` | Length, scope, style, or boundary constraints are missing. |
| `AP-OVERLOAD` | Too many tasks are packed into one instruction. |
| `AP-MICROMANAGE` | Low-level detail constrains execution without improving outcomes. |
| `AP-LONG-WINDED` | The same rule is padded with prose, repetition, or bloated examples. |
| `AP-CONFLICTING` | Requirements contradict one another. |
| `AP-IMPOSSIBLE` | Not all requirements can be satisfied simultaneously. |
<!-- /append -->

<!-- append "engineering_l5_anti_patterns_context_memory" -->
### Context & Memory

| Code | Detect when |
|---|---|
| `AP-CONTEXT-BLOAT` | Excessive context dilutes priorities. |
| `AP-SYSTEM-PROMPT-BLOAT` | A system prompt violates `6.1.3`: always-on text is `> 200` lines or embeds conditional blocks that should be modular. |
| `AP-CONTEXT-STARVATION` | Critical context is missing. |
| `AP-CONTEXT-DRIFT` | Required context may be lost through compaction or long sessions. |
| `AP-BURIED-PRIORITY` | Critical rules are hidden instead of surfaced early and scannably. |
| `AP-VAGUE-REFERENCE` | References such as `the above` or `this` have no clear antecedent. |
| `AP-ASSUMES-MEMORY` | The document assumes the agent will remember earlier turns. |
| `AP-NO-CHECKPOINT` | Long workflows lack state checkpoints. |
| `AP-IMPLICIT-STATE` | State changes are not explicitly tracked. |
<!-- /append -->

<!-- append "engineering_l5_anti_patterns_execution_output" -->
### Execution & Output

| Code | Detect when |
|---|---|
| `AP-NO-VERIFICATION` | No self-check or validation step exists. |
| `AP-FALSE-COMPLETION` | The prompt allows the response to end after a summary, validation result, next-step menu, or checkpoint-looking block even though required final sections or handoff prompts are still missing. |
| `AP-MISSING-TERMINAL-BLOCK` | Required final prompt blocks, handoff sections, or terminal block ordering are unspecified or only implied. |
| `AP-SKIP-ALLOWED` | Critical steps are easy to skip. |
| `AP-SILENT-FAIL` | Failures are not surfaced to the user. |
| `AP-INFINITE-LOOP` | Retry loops can stall indefinitely. |
| `AP-HALLUCINATION-PRONE` | The prompt encourages guessing. |
| `AP-NO-UNCERTAINTY` | The agent is not allowed to say `I don't know`. |
| `AP-NO-SOURCES` | Claims need not be cited or verified. |
<!-- /append -->

<!-- append "engineering_l5_anti_patterns_maintainability" -->
### Maintainability

| Code | Detect when |
|---|---|
| `AP-HARDCODED` | Magic strings or numbers appear instead of parameters. |
| `AP-DRY-VIOLATION` | The same rule appears in multiple places. |
| `AP-NO-VERSION` | Breaking changes are not versioned. |
| `AP-TANGLED` | Editing one area breaks unrelated behavior. |
<!-- /append -->

<!-- append "engineering_l6_content_audit" -->
## L6: Context Engineering

**Content audit**: identify compressible sections, redundant sections, content that should load conditionally, and approximate size. Optional sizing helpers: `wc -l path/to/document.md` for line count and a simple word-count proxy for rough token estimation.

**Information priority**: confirm the most critical instructions appear in the first `20%` of the document, examples and details can be truncated without losing core behavior, and conditional content is clearly marked for selective loading.
<!-- /append -->

<!-- append "engineering_l6_system_prompt_budget" -->
**CRIT — system prompt budget**: if the reviewed document is a `System Prompt`, its always-on portion MUST NOT exceed `200` lines. Count the fully assembled always-on text, including headings, blank lines, and lists. Content moved into on-demand modules does not count. PASS if `<= 200`; FAIL if `> 200`.

**If the system prompt exceeds budget**: keep only always-on invariants (identity, safety, tool rules, output contract); move task-specific or conditional material into modules; add explicit loading rules via `AGENTS.md`, workflow `WHEN` clauses, or ordered steps. Recommended organizations: module index + conditional loading, phase-based chain loading, or mode-based branching. Acceptance: prompt `<= 200`, optional detail externalized, triggers are explicit, and next modules are obvious.
<!-- /append -->

<!-- append "engineering_l6_overflow_control" -->
**CRIT — workflow/skill/methodology overflow control**: any document that tells the agent to load more files MUST define budget, gating, chunking, summarization, and a fail-safe. Minimum controls: max files / max total lines or a mandatory summarize-and-drop policy; rules for when a dependency should load; partial loading by TOC/section/range instead of whole-file default; conversion of loaded text into an operational summary; and a stop / checkpoint / ask-user fallback when budget would be exceeded.

**Evidence requirement**: the review output lists loaded files with sizes and sections/ranges, plus the chosen budget and whether it was respected or which fail-safe path was taken.

**Companion-load budget**: when this methodology itself is loaded alongside `prompt-bug-finding`, apply that document's bounded dependency budget (`<= 1` contiguous slice of `<= 120` raw lines per escalation, `<= 3` dependency files, `<= 400` raw dependency lines in active review context) to all cross-loaded companion rules.
<!-- /append -->

<!-- append "engineering_l6_compact_prompts" -->
**HIGH-priority compact-prompts review**: answer this question explicitly — *What can be removed, externalized, deduplicated, summarized, or conditionally loaded without changing required behavior?* Required optimization loop: classify content as always-on invariant / conditional guidance / example-reference / archival detail; keep only minimum viable always-on context; externalize conditional detail into triggered modules; compress prose into bullets, tables, and decision rules; deduplicate to one canonical statement per rule; keep the smallest example set that still prevents ambiguity; then verify every `MUST`, `MUST NOT`, trigger, threshold, format rule, and fail-safe still exists.

**Compaction checks**: split always-on vs on-demand content explicitly; replace repeated narrative with one rule plus reference; convert branching prose into decision tables or ordered steps; prefer `WHEN` / `IF` / `ONLY IF` triggers over buried clauses; surface critical priorities early; keep output formats and acceptance criteria close to dependent instructions; remove decorative wording; prefer short labels with one-sentence explanations over dense paragraphs.

**Prompt-writing recommendations**: state role, task, constraints, then output contract unless a different dependency order is necessary; use one stable name per artifact, mode, workflow, or variable; keep thresholds numeric (`<= 200 lines`, `max 3 iterations`, `read 1 file at a time`); pair forbidden behavior with the required alternative; make scope explicit (`In scope`, `Out of scope`, `Do not infer`); prefer concrete condition-action phrasing; avoid nested parentheticals and stacked caveats when a sub-list is clearer.

**Compactness examples**:

| Anti-pattern | Before | After |
|---|---|---|
| `AP-LONG-WINDED` | `When you are in a situation where context may be running low...` | `WHEN context runs low, summarize loaded instructions into a short operational checklist and drop the raw text.` |
| `AP-BURIED-PRIORITY` | `Use good judgment... before writing anything make sure they have approved it.` | `MUST NOT write files before explicit user confirmation.` |

**Severity guidance**: missed safe compaction opportunities are `HIGH` when they affect always-on prompts or frequently loaded instruction files; compaction that removes required behavior, constraints, or recovery steps is a `FAIL`.
<!-- /append -->

<!-- append "engineering_l6_lifecycle_attention" -->
**Lifecycle**: specify what loads at start, what loads on demand, what can be summarized when context is low, what must never be dropped, how critical state survives compaction, what belongs in files vs working memory, and how context loss is detected and recovered.

**Attention management**: repeat or reinforce critical instructions, visually emphasize important sections, keep guardrails in a dedicated section, avoid too many competing instructions, group related rules, and separate low-priority content.
<!-- /append -->

<!-- append "engineering_l7_testability" -->
## L7: Testability Assessment

**Binary verification**: for each instruction, determine whether the agent did it, did it correctly, and did it completely.

**Observable outputs**: require visible artifacts, visible intermediate steps, and explicit compliance evidence.

**Built-in checks**: include validation criteria, a pre-completion self-check, checklist formatting for critical steps, and proof-of-work requirements when appropriate.

**When a workflow requires terminal prompts or final handoff blocks, the pre-completion self-check should verify that those exact blocks were emitted before the response may end.**

**External verification**: prefer rules that can be checked by automated tools, another agent, or a human reviewer.

**Happy-path tests**: provide at least one correct example, with full input-to-output trace and key edge cases.

**Negative tests**: show what not to do, what incorrect outputs look like, and how to recover.
<!-- /append -->

<!-- append "engineering_l8_ergonomics" -->
## L8: Agent Ergonomics

**Capability match**: ensure instructions do not ask impossible things, break complex reasoning into steps, and request output formats the model is good at (`JSON`, `Markdown`, etc.).

**Training alignment**: use familiar prompt patterns, an appropriate role/persona, and a style consistent with effective prompting.

**Graceful degradation**: define what happens on partial failure, whether the agent can recover without intervention, and when it must ask for help.

**Hallucination prevention**: require verification or citation, permit uncertainty, mark speculation, and use external tools for factual queries.

**Iterative compatibility**: support iterative improvement, define how feedback is incorporated, and keep partial success actionable.

**Conversation compatibility**: support multi-turn use, clarification requests, and mid-task scope changes.
<!-- /append -->

<!-- append "engineering_l9_severity" -->
## L9: Improvement Synthesis

**Severity**:

| Severity | Criteria | Action |
|---|---|---|
| `CRITICAL` | Blocks task completion | Fix immediately |
| `HIGH` | Causes incorrect or inconsistent output | Fix before deployment |
| `MEDIUM` | Reduces quality or efficiency | Fix next iteration |
| `LOW` | Minor improvement opportunity | Backlog |
<!-- /append -->

<!-- append "engineering_l9_effort" -->
**Effort**:

| Effort | Criteria |
|---|---|
| `TRIVIAL` | Single word or phrase change |
| `SMALL` | Single section rewrite |
| `MEDIUM` | Multiple section changes |
| `LARGE` | Document restructure |
<!-- /append -->

<!-- append "engineering_l9_planning" -->
**Quick wins**: list `CRITICAL` plus `TRIVIAL` / `SMALL` fixes, rank by impact-to-effort ratio, and note dependencies between fixes.

**Strategic improvements**: list structural changes, refactoring opportunities, and missing sections or companion docs.

**Per-fix guidance**: provide `What`, `Where`, `Why`, `How`, and `Verify`.

**Testing plan**: define tests for critical fixes, regression checks for preserved behavior, and validation that fixes do not conflict.
<!-- /append -->

<!-- append "engineering_execution_prerequisites" -->
## Execution Protocol

**Prerequisites**: full document text is accessible; related documents are available for cross-reference; document purpose and context are understood; example outputs are available when applicable.

**Order**: execute layers `1 -> 9` in sequence. Review completion requires the required report format plus a fully evaluated verification checklist. After each layer, checkpoint findings before continuing.
<!-- /append -->

<!-- append "engineering_execution_budgeting" -->
**Work budgeting**: prefer bounded review passes over elapsed time. Size the review with `wc -l path/to/document.md` and use this pass budget:

| Document Size | L1-L3 | L4-L5 | L6-L8 | L9 |
|---|---|---|---|---|
| Small (`< 500`) | 1 pass | 1 pass | 1 pass | 1 synthesis pass |
| Medium (`500-2000`) | 1-2 passes | 1-2 passes | 1-2 passes | 1 synthesis pass |
| Large (`> 2000`) | 2 passes | 2 passes | 2 passes | 1-2 synthesis passes |

If a layer exceeds its pass budget, note blockers and continue; incomplete analysis is better than no analysis.
<!-- /append -->

<!-- append "engineering_execution_error_handling" -->
**Error handling**:

- `Partial layer`: document completed checks, blockers, mark the layer `PARTIAL`, then proceed.
- `Missing information`: if dependencies are inaccessible, analyze what is available; if examples are missing, flag Layer 7 and recommend examples; if context is unclear, ask the user or make assumptions explicit.
- `Recovery`: default to a chat-only checkpoint; save `review-checkpoint-{document}-{layer}.md` only with explicit user request or approval; on resume, read the available checkpoint source, verify the document is unchanged, and continue.
<!-- /append -->

<!-- append "engineering_output_format" -->
**Output format**: produce a report with these sections in order: `Summary`, `Context Budget & Evidence`, `Compact-Prompts Findings`, `Layer Summaries`, `Issues Found` (Critical / High / Medium / Low tables), `Recommended Fixes` (Immediate / Next Iteration / Backlog), and `Verification Checklist`.
<!-- /append -->

<!-- append "engineering_required_report_fields" -->
**Required report fields**:

- `Summary`: document type, overall quality (`GOOD | NEEDS_IMPROVEMENT | POOR`), critical issue count, total issue count. When paired with the `prompt-bug-finding` rules, start `Summary` with that methodology's required status block, including `Review status` and `Deterministic gate: PASS | FAIL | SKIPPED`; if the gate is `SKIPPED`, state why and explicitly state `no validator-backed evidence for this review path` before the quality counts.
- `Context Budget & Evidence`: budget, inputs loaded (`path — size — sections/ranges`), and overflow handling.
- `Compact-Prompts Findings`: safe reductions found, content kept intentionally, deferred or blocked opportunities, and a behavior-preservation check confirming `MUST`, `MUST NOT`, triggers, thresholds, output rules, and fail-safes remain intact.
- `Verification Checklist`: all critical issues addressed; no new issues introduced; examples/tests updated when needed; context overflow prevention evidenced; compact-prompts findings reported explicitly; and, when the reviewed document requires terminal response blocks, the checklist explicitly states whether false completion paths were ruled out.

When the deterministic gate is `SKIPPED`, do not describe semantic review, checklist review, or manual inspection as deterministic, validator-backed, or tool-validated unless actual validator or tool output exists.

**N/A rule**: mark a check `N/A` only when the document explicitly makes it inapplicable; otherwise mark `FAIL` or `PARTIAL` and explain what is missing.
<!-- /append -->

<!-- append "engineering_integration_fabric" -->
## Integration with fabric-poc prompt-review

- **Base review**: the `prompt-review` rules run the deterministic lints (`prompt-lint`, `prompt-register-dryrun`) plus the type-fit / determinism-boundary / router-pattern judgment checks. Use those before applying this methodology.
- **Quality layer**: use this methodology as the clarity, structure, anti-pattern, context-engineering, and improvement-synthesis layer on top of `prompt-review`.
- **Defect layer**: pair with the `prompt-bug-finding` rules when the task is behavioral defect hunting rather than general instruction-quality review.
<!-- /append -->

<!-- append "engineering_references" -->
## References

**Methodology sources**: Anthropic Prompt Engineering Docs; Anthropic Context Engineering for Agents; Prompt Engineering Guide; IBM 2026 Prompt Engineering Guide; Microsoft AI Agents Design Patterns; Taxonomy of Prompt Defects.

**Anti-pattern sources**: 14 Prompt Engineering Mistakes; 10 Common LLM Prompt Mistakes; Common Challenges and Solutions.

**Agent-specific resources**: 4 Tips for AI Agent System Prompts; 11 Prompting Techniques for Better AI Agents; System Prompts Design Patterns.

**Companion methodology**: the `prompt-bug-finding` rules for bug hunting, hidden failure modes, unsafe behavior, regressions, instruction conflicts, or root-cause analysis in prompts and agent instructions.
<!-- /append -->

<!-- append "engineering_validation_checklist" -->
## Validation

Review is complete when:

- [ ] All 9 layers analyzed
- [ ] All checklist items attempted (`PASS`, `FAIL`, `PARTIAL`, or explicit `N/A`)
- [ ] Issues categorized by severity and effort
- [ ] Fixes prioritized by impact/effort
- [ ] Implementation guidance provided
- [ ] Safe compact-prompts opportunities identified and prioritized for prompt/instruction documents
- [ ] Compact-prompts findings reported explicitly in the review output
- [ ] Required completion gates, terminal blocks, and false-completion paths were checked explicitly when the document defines a final response contract
- [ ] Verification plan included
<!-- /append -->
