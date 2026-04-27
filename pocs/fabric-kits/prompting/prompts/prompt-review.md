---
id: prompt-review
type: rules
name: prompt review
description: Review a fabric prompt file or prompt kit against type conventions, marker syntax, determinism expectations, and registration scope
---

<!-- append "review_intro" -->
Use fabric prompt review mode.
<!-- /append -->

<!-- append "review_ground_state" -->
1. Anchor on the review-specific side of fabric state:
   - accept either a single prompt markdown file or a prompt-kit directory as input
   - for a directory input, enumerate the review set: prefer `<dir>/prompts/*.md`; if `<dir>/resources.toml` declares `script_files`, also enumerate the matching script files (typically `<dir>/scripts/*.js`); if the input path already is a `prompts/` or `scripts/` directory, enumerate that directory's files directly; review every matched file and synthesize kit-level findings across the full prompt+script set
   - for each reviewed prompt file, prefer `fabric prompt source <id>` when the prompt is already registered — it returns the fully resolved source with applied middleware; otherwise read the file directly from disk
   - for each reviewed script file, read the file directly from disk, then confirm the exported contract and help surface with `fabric script help <id>` when the script id is already registered
   The shared `fabric prompt types` / `fabric prompt list` / `fabric script list` baseline is injected by the `authoring-ground-state` middleware — do not restate it here.
<!-- /append -->

<!-- append "review_deterministic_checks" -->
2. Run the deterministic checks via fabric scripts before forming opinions:
   - for a single-file review, run `fabric script run prompt-lint <path>` plus `fabric script run prompt-register-dryrun <path>` for a prompt file, or `fabric script run script-lint <path>` plus `fabric script run prompt-register-dryrun <path> --type script` for a script file
   - for a directory / kit review, run `fabric script run prompt-audit <dir>` — it enumerates and sweeps every prompt and script file, returning per-file lint findings plus a summary; then run `fabric script run prompt-kit-lint <kit-dir>` for cross-file defects (id collisions, orphan middleware target_prompts, broken `fabric prompt get` / `fabric script run` references, router-mode symmetry); after importing those findings, load `fabric prompt get prompt-review-kit` for kit-level judgment criteria that sit on top
   - `fabric script run prompt-lint <path>` — reports frontmatter, type, id-format, middleware field, marker-balance, insert-anchor, and unique-id findings
   - `fabric script run prompt-register-dryrun <path>` — reports whether the file is covered by an active `prompt_files` glob and which manifest governs it
   - `fabric script run script-lint <path>` — reports script export, interface-shape, portability, and side-effect-budget findings
   - `fabric script run prompt-register-dryrun <path> --type script` — reports whether the file is covered by an active `script_files` glob and which manifest governs it
   - `fabric script run prompt-audit <dir>` — aggregates the per-file lint + coverage across a kit or directory
   - `fabric script run prompt-kit-lint <kit-dir>` — reports cross-file integrity findings the per-file linters cannot catch
   - use `fabric script help <id>` on any of the above when you need its exact interface
   - import every finding returned by these scripts into the final report at the severity they emit; do not re-describe or second-guess them
<!-- /append -->

<!-- append "review_load_methodologies" -->
3. Load the companion methodology rules and apply their layer maps in addition to the fabric-specific checks below:
   - always load only the smallest decisive slices needed from `fabric prompt get prompt-engineering`, then walk its L1-L9 layers (document classification, clarity, structure, completeness, anti-patterns, context engineering, testability, agent ergonomics, improvement synthesis); use its severity and effort rubrics when classifying quality findings
   - minimum default slices for `prompt-engineering`: the Layer Map, L5 Anti-Pattern Detection, L6 Context Engineering, L9 Improvement Synthesis, and the Output format / Required report fields / Validation sections; load more only when the active review question is still materially unresolved
   - when the user is asking for defect hunting, root-cause analysis, hidden-failure discovery, or safety review — or when the earlier deterministic and type-fit checks already reveal concerning behavior — also load only the smallest decisive slices needed from `fabric prompt get prompt-bug-finding` and walk its L1-L7 layers (hotspot mapping, contract extraction, branch/state/handoff exploration, universal bug-class sweep, counterexample construction, dynamic validation, reporting with review status and residual risk)
   - minimum default slices for `prompt-bug-finding`: the Layer Map, L4 Universal Prompt Bug-Class Sweep, L7 Reporting / status semantics, and the Validation checklist; load more only when a suspected defect still needs contract, branch, or validation guidance
   - honor the report-section order from `prompt-engineering` (`Summary`, `Context Budget & Evidence`, `Compact-Prompts Findings`, `Layer Summaries`, `Issues Found`, `Recommended Fixes`, `Verification Checklist`); when `prompt-bug-finding` is active, prepend its status block (`Review status`, `Deterministic gate: PASS | FAIL | SKIPPED`, scope, review basis, environment snapshot, coverage summary) to `Summary`
   - bounded-load rule: treat the loaded methodologies as reference material, not as text to restate; keep the companion-load budget explicit in `Context Budget & Evidence`; cite the specific layer or anti-pattern code (for example `L5 AP-BURIED-PRIORITY`, `L6 CRIT system prompt budget`, `L4 Universal Prompt Bug-Class Sweep: Completion & finalization gate`) and keep the fabric-level `CRITICAL`-to-`LOW` severity rubric defined in the `review_severity_rubric` block below as the single severity scale across all findings
<!-- /append -->

<!-- append "review_type_fit" -->
4. Check that the body fits the declared type (judgment — not covered by the linter):
   - a `skill` reads as directly invokable and specifies inputs, behavior, and output format
   - `rules` files contain no routing logic and are loadable by a router
   - `template` files contain only template content, not procedural instructions
   - `middleware` bodies are short, cross-cutting, and target-typed; they do not duplicate rules already delivered by the target prompts
   - `workflow` / `checklist` bodies are concrete and ordered
   - `agent` bodies clearly describe role and invocation interface
<!-- /append -->

<!-- append "review_determinism" -->
5. Check the determinism boundary (judgment — not covered by the linter):
   - identify any behavior in the body that is pure computation, transformation, lookup, validation, or formatting — anything with a single correct output given fixed inputs
   - recommend moving such behavior into a fabric script invoked via `fabric script run <id>`, with a matching `fabric script help <id>` for its interface
   - if the prompt already calls a script, confirm the script appears in `fabric script list` and that the invocation command matches `fabric script help <id>`
<!-- /append -->

<!-- append "review_router_pattern" -->
6. When the prompt participates in a router pattern (judgment — not covered by the linter):
   - confirm the router `skill` only dispatches and loads mode rules via `fabric prompt get <router>-<mode>`
   - confirm each mode file is a `rules` prompt with id `<router>-<mode>` and contains no routing logic
   - flag cross-leakage between router and mode files
<!-- /append -->

<!-- append "review_severity_rubric" -->
7. Severity rubric — use consistently across deterministic, methodology-layer, and judgment findings:
   - `CRITICAL`: the prompt cannot load or register (missing required frontmatter, unbalanced markers, invalid type, invisible to every active `prompt_files` glob)
   - `HIGH`: the prompt loads but behaves incorrectly for its declared type or its router contract (routing logic in a `rules` file, duplicate block id, insert with zero or both of before/after, broken script invocation)
   - `MEDIUM`: determinism-boundary violation, logic duplicated across mode files, or content that belongs in a different prompt or in a script
   - `LOW`: style, wording, description clarity, or minor authoring hygiene with no functional impact
<!-- /append -->

<!-- append "review_findings" -->
8. Report findings grouped by severity. For each finding include:
   - the file and the block id or frontmatter field affected
   - the problem
   - why it matters
   - effort (`TRIVIAL`, `SMALL`, `MEDIUM`, `LARGE`) using the `prompt-engineering` improvement rubric
   - a concrete repair recommendation (cite the fabric script or command to run when one applies)
<!-- /append -->

<!-- append "review_summary" -->
9. Finish with a short overall assessment: is the prompt ready to register, does it need revision, or should it be split, merged, or converted into a fabric script. Include the exact registration command the author should run once the review is addressed — see the register-commands middleware appendix for the canonical command set.
<!-- /append -->
