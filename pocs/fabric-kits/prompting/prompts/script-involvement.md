---
id: script-involvement
type: middleware
name: script involvement
description: Inject a conditional load of script-engineering and script-bug-finding when the prompt under discussion invokes a fabric script
target_types: rules
target_prompts: prompt-brainstorm, prompt-generate, prompt-review
timing: post
---

<!-- append "script_involvement_rule" -->
When the prompt or artifact under discussion invokes a fabric script — for example it calls `fabric script run <id>`, calls `fabric script help <id>`, proposes creating a new script, reviews a module that exports `id`, `name`, `description`, `run`, or sits in a kit whose `resources.toml` declares `script_files` — also load both companion methodologies before reasoning about the script side of the work:
- `fabric prompt get script-engineering` — clarity, structure, interface-parity, determinism-boundary, side-effect-budget, portability, testability, and improvement-synthesis layers for fabric scripts
- `fabric prompt get script-bug-finding` — behavioral defect methodology with hotspot mapping, contract extraction, branch / IO exploration, universal bug-class sweep, counterexample construction, dynamic validation, and review-status reporting

If the review target is a kit directory whose `resources.toml` declares `script_files`, enumerate those script files explicitly, run `fabric script run script-lint <path>` and `fabric script run prompt-register-dryrun <path> --type script` for each one, and fold the results into the same review report as the prompt findings.

Apply the loaded methodologies alongside the mode's own rules. Cite specific layers or bug-class codes (for example `L4 Interface-vs-help parity`, `L6 Side-effect budget`, `L4 Universal Script Bug-Class Sweep: Return contract`) rather than restating them. Keep the single fabric-level severity scale (`CRITICAL` to `LOW`) across all findings so script-side and prompt-side findings can be merged without translation.
<!-- /append -->
