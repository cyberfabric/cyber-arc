---
id: prompt-review-kit
type: rules
name: prompt review kit
description: Kit-level review criteria applied on top of per-file prompt-review when the input is a prompt kit directory
---

<!-- append "review_kit_intro" -->
Use kit-level review mode. This mode is loaded by `prompt-review` via `fabric prompt get prompt-review-kit` when the input is a directory (kit root, `prompts/`, or `scripts/`). It adds cross-file integrity criteria on top of the per-file findings returned by `prompt-audit` and `prompt-kit-lint`.
<!-- /append -->

<!-- append "review_kit_inputs" -->
1. Anchor the review on the deterministic outputs first, not on prose inspection:
   - `fabric script run prompt-audit <dir>` — per-file lint + coverage across every prompt and script in the directory, plus a summary
   - `fabric script run prompt-kit-lint <kit-dir>` — cross-file integrity (id collisions, orphan middleware target_prompts, broken `fabric prompt get` / `fabric script run` references)
   Import every finding at the severity they emit; this mode only adds kit-level judgment on top.
<!-- /append -->

<!-- append "review_kit_router_symmetry" -->
2. Router ↔ modes symmetry (judgment — not fully covered by the linters):
   - identify the kit's routers (`skill` prompts whose body contains a mode dispatch table of the form `fabric prompt get <router>-<mode>`)
   - for each router, confirm each `<router>-<mode>` referenced in the dispatch table has a matching `rules` file with id `<router>-<mode>` inside the kit
   - confirm no orphan mode files exist (a `rules` file id like `<router>-<mode>` with no corresponding dispatch row)
   - confirm routers contain no mode-specific content and mode files contain no routing logic
<!-- /append -->

<!-- append "review_kit_middleware_coverage" -->
3. Middleware coverage and scope:
   - for every `middleware` prompt in the kit, confirm `target_types` and `target_prompts` (when present) actually match prompts that exist in the kit or the active registry — `prompt-kit-lint` flags orphan target_prompts, this step adds the judgment check that the scope is intentional (not accidentally too broad or too narrow)
   - confirm `timing: pre` vs `post` matches the middleware's purpose: `pre` for baseline context injection, `post` for canonical references or appendices
   - flag any middleware whose body duplicates content already present inside a target prompt body — that is an `AP-DRY-VIOLATION` in `prompt-engineering L5`
<!-- /append -->

<!-- append "review_kit_shared_blocks" -->
4. Shared-block hygiene across mode files:
   - compare mode files inside the same router family (for example `prompt-generate`, `prompt-review`, `prompt-script`, `prompt-repair`) for blocks that repeat the same rule in similar words
   - when a rule is truly cross-cutting, recommend extracting it into a `middleware` (`timing: pre` for baseline, `timing: post` for appendix) or into a separate `rules` file loaded via `fabric prompt get`; cite `prompt-engineering L5 AP-DRY-VIOLATION`
   - when two mode files repeat a deterministic step, recommend pushing that step into a fabric script invoked via `fabric script run <id>` (single responsibility, `prompt-brainstorm.brainstorm_determinism_first`)
<!-- /append -->

<!-- append "review_kit_naming_and_layout" -->
5. Naming and layout consistency:
   - confirm prompt file names match their declared `id` (`prompts/<id>.md`)
   - confirm script file names match their declared `id` (`scripts/<id>.js`)
   - confirm the kit's `resources.toml` declares both `prompt_files` and `script_files` when the kit contains both, and that every file is covered by a glob (`prompt-audit` exposes `uncovered` — any entry is a finding)
   - flag kit-local conventions that drift from other kits in the workspace without a stated reason
<!-- /append -->

<!-- append "review_kit_severity" -->
6. Severity rubric for kit-level judgment findings (merge with per-file findings using the single fabric-level scale):
   - `CRITICAL`: the kit cannot register, or a router advertises a mode that has no matching mode file (broken dispatch)
   - `HIGH`: router ↔ mode leakage (routing logic in `rules` or mode content in router), middleware scope materially wrong, file name mismatching declared id, cross-cutting rule duplicated in ≥3 files without extraction
   - `MEDIUM`: two-file DRY violation, middleware `timing` mismatches purpose, shared block that would benefit from extraction but is not harmful
   - `LOW`: naming convention drift, description phrasing inconsistency, unused block id
<!-- /append -->

<!-- append "review_kit_output" -->
7. Kit-level report additions (append to the per-file `prompt-review` report, do not replace it):
   - `Kit Inventory` — router list with modes, middleware list with scope, shared-block map
   - `Kit Findings` — kit-level issues grouped by severity, each with affected files, recommended fix, and the exact fabric command to apply it (for example `fabric prompt get prompt-repair` for a repair handoff)
   - `Kit Verification` — confirm `prompt-audit` summary shows zero CRITICAL/HIGH and `prompt-kit-lint` findings are empty; if not, the kit is not ready to ship
<!-- /append -->
