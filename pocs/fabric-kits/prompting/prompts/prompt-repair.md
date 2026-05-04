---
id: prompt-repair
type: rules
name: prompt repair
description: Repair an existing fabric-poc prompt file against type conventions, marker syntax, determinism expectations, and review findings
---

<!-- append "repair_intro" -->
Use fabric-poc prompt repair mode. This mode applies fixes to an existing prompt file against explicit findings (from `prompt-review`, `prompt-lint`, `prompt-kit-lint`) or against the type / determinism / router contracts the file is expected to satisfy.
<!-- /append -->

<!-- append "repair_goal" -->
1. The goal of this mode is to produce a corrected prompt file that passes every deterministic gate and resolves every CRITICAL and HIGH finding, while preserving the original intent, domain language, and block ids wherever safe.
<!-- /append -->

<!-- append "repair_inputs" -->
2. Accept the following input shapes:
   - a path to a prompt file and a prior review report (preferred)
   - a path to a prompt file alone, when the repair brief is explicit in the user's request
   - a kit directory when the repair is cross-file (id collision, orphan middleware target, broken router-mode symmetry)
   If the user has not supplied findings, run the deterministic scripts first so every repair is anchored to concrete evidence:
   - `fabric-poc script run prompt-lint <path>`
   - `fabric-poc script run prompt-register-dryrun <path>`
   - `fabric-poc script run prompt-kit-lint <kit-dir>` when the issue is cross-file
<!-- /append -->

<!-- append "repair_priority" -->
3. Apply fixes in this order:
   - CRITICAL deterministic findings first: restore missing required frontmatter, rebalance markers, correct invalid `type`, ensure the file is covered by an active `prompt_files` glob
   - HIGH findings next: non-kebab-case id, unresolved `insert` anchors, duplicate block ids, middleware field errors, broken `fabric-poc prompt get` / `fabric-poc script run` references, routing logic leaking into a `rules` file
   - MEDIUM findings: determinism-boundary violations (move deterministic logic into a fabric-poc script via `fabric-poc script run <id>`), logic duplicated across mode files, content that belongs in a different prompt or script
   - LOW findings: wording, description clarity, authoring hygiene
<!-- /append -->

<!-- append "repair_preserve" -->
4. Preserve the following unless a finding explicitly requires a change:
   - the prompt `id` and type
   - block ids (`append`, `insert`, `replace` names) — downstream overlays may target them
   - block ordering
   - the original imperative voice and terminology
   When a block must be renamed or removed, note it explicitly in the output so overlays can be updated.
<!-- /append -->

<!-- append "repair_delegation" -->
5. Delegate structural work to the existing authoring scripts instead of hand-writing frontmatter or marker syntax:
   - use `fabric-poc script run prompt-scaffold ...` when a missing file needs to be reconstructed from its frontmatter signature
   - when extracting deterministic behavior into a script, stop and delegate to prompt-script mode (`fabric-poc prompt get prompt-script`) to author the script; do not inline the script body in the repair output
<!-- /append -->

<!-- append "repair_router_pattern" -->
6. When repairing a router or its modes, keep the pattern intact:
   - the router `skill` only selects a mode and defers to `fabric-poc prompt get <router>-<mode>`
   - each mode file is a `rules` prompt with id `<router>-<mode>` and contains no routing logic
   - if a repair introduces or removes a mode, update both the router's dispatch table and the mode files in the same repair pass so the kit remains symmetric (`prompt-kit-lint` will catch drift)
<!-- /append -->

<!-- append "repair_verify" -->
7. Verify deterministically before returning:
   - rerun `fabric-poc script run prompt-lint <path>` and confirm `findings` is empty
   - rerun `fabric-poc script run prompt-register-dryrun <path>` and confirm `covered` is `true`
   - rerun `fabric-poc script run prompt-kit-lint <kit-dir>` when the repair was cross-file
   - if any CRITICAL or HIGH finding still appears, loop back to step 3 before producing the final output
<!-- /append -->

<!-- append "repair_output" -->
8. Output contract — follow the shared rules injected by the `authoring-output-contract` middleware below, plus this repair-specific delta:
   - include a short summary listing the findings resolved, the blocks added / renamed / removed, and any residual findings the repair deliberately left in place with their rationale
   - the shared "print registration command only when registry state changes" rule applies strictly here: for a repaired file whose coverage glob has not changed and whose type is unchanged, skip the register line
<!-- /append -->
