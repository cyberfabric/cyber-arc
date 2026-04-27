---
id: script-engineering
type: rules
name: script engineering
description: Clarity, structure, interface-parity, determinism-boundary, side-effect-budget, portability, and improvement-synthesis methodology for fabric scripts; companion rules loaded by prompt-script and by the script-involvement middleware
---

<!-- append "script_engineering_scope" -->
**Scope**: any fabric script — a JavaScript module registered through a kit's `script_files` glob and invoked via `fabric script run <id>`.

**Out of scope**: does not generate a "best script" template; defines a review and authoring method plus a report format.

**Companion methodology**: for behavioral defect hunting, hidden failure modes, and unsafe IO paths, also use the `script-bug-finding` rules (load via `fabric prompt get script-bug-finding`).
<!-- /append -->

<!-- append "script_engineering_overview" -->
## Overview

Fabric scripts are deterministic executable policy. Review them like small, strict Node modules: classify purpose, verify exported shape, check that `interface` matches real behavior, enforce the determinism and side-effect boundaries, confirm portability via the public fabric entry, then synthesize prioritized fixes.

**High-priority rule**: push any deterministic work out of prompts and into scripts, but never push judgment or open-ended drafting into a script. If the caller cannot produce a single correct output given fixed inputs, the behavior does not belong here.
<!-- /append -->

<!-- append "script_engineering_layer_map" -->
## Layer Map

| Layer | Question |
|---|---|
| L1 | What kind of script is this (scaffold, lint, resolver, transformer, IO helper, integration)? |
| L2 | Are the exports and the `interface` object explicit and unambiguous? |
| L3 | Is the script structured so one caller can invoke it and one reader can audit it? |
| L4 | Does the exported `interface` match what `fabric script help <id>` actually prints and what `run()` actually does? |
| L5 | Is the determinism boundary respected? |
| L6 | Is the side-effect budget respected? |
| L7 | Is the require graph portable across kits? |
| L8 | Can the script be tested and validated externally? |
| L9 | What should be fixed first? |
<!-- /append -->

<!-- append "script_engineering_L1_classification" -->
## L1: Script Classification

Identify the primary purpose exactly once, so review expectations are calibrated:

- `scaffold` — deterministic string template from validated inputs (e.g. `prompt-scaffold`)
- `lint` — static or dynamic check emitting findings (e.g. `prompt-lint`)
- `resolver` — queries fabric manifests or project state to answer a coverage / location / ownership question (e.g. `prompt-register-dryrun`)
- `transformer` — reads input, mutates content, writes output under explicit user-provided paths
- `IO helper` — reads or emits files, tightly bounded to user-supplied paths
- `integration` — reaches into fabric internals or external systems (rare, must be justified)

Dependencies: list every `require` target. Classification-level findings: circular dependencies, relative reaches into fabric internals (`../../../fabric/src/*`), and third-party packages that are not declared in either the kit's own `package.json` (per-kit dependency feature, see `fabric prompt get kit-dependencies`) or `pocs/fabric/package.json` (fabric-core deps reachable through `pocs/node_modules/`).
<!-- /append -->

<!-- append "script_engineering_L2_clarity" -->
## L2: Clarity & Specificity

**Ambiguity scan** in the exported `interface`:
- flag vague parameter descriptions (`the path`, `the config`, `some options`); every parameter description must answer *which value, in what format, for what behavior change*
- flag `returns` fields that say `JSON` or `a string` without describing the shape
- flag `examples[].description` that repeats the command instead of explaining what the example demonstrates

**Specificity** in `run()`:
- input validation must name the failing parameter and the expected shape (`throw new Error("prompt-lint: expected --path <file>, got nothing")`)
- output must either be a raw string for terminal display or a stringified JSON whose top-level shape is documented in `returns`

**Quantification**: if the script accepts sizes, counts, or budgets, the `interface` must document the unit (`lines`, `bytes`, `files`). Magic numbers inside `run()` are `AP-HARDCODED` at medium severity.
<!-- /append -->

<!-- append "script_engineering_L3_structure" -->
## L3: Structure & Organization

**Module shape**:
- one `module.exports = { id, name, description, interface, run }` at the bottom; helpers defined above; constants at the top
- helpers are module-private unless another script in the same kit needs them, in which case extract to a sibling module and require it explicitly
- top-level code must be side-effect-free (no reads, writes, or network calls at `require` time)

**Cognitive load**:
- `run()` should fit on one screen; extract long logic into helpers named for intent (`lintFrontmatter`, `lintMarkers`) rather than phase (`step1`)
- avoid deeply nested conditionals; prefer early returns and guard clauses

**Visual hierarchy**:
- keep regex patterns and magic strings in named constants at the top of the file
- comments are optional; when present, they explain *why* non-obvious logic exists, not *what* the code does
<!-- /append -->

<!-- append "script_engineering_L4_interface_parity" -->
## L4: Interface-vs-Help Parity

Fabric reads the exported `interface` object verbatim to render `fabric script help <id>`. Drift between `interface` and `run()` is a user-facing correctness bug.

**Parity checks**:
- every `parameters[].name` corresponds to a real CLI flag or positional that `run()` reads
- every flag that `run()` reads appears in `parameters[]`
- `parameters[].required` matches `run()`'s validation: a required flag that `run()` tolerates missing is HIGH; an optional flag that `run()` enforces is HIGH
- `returns` describes what fabric actually prints: if `run()` returns `JSON.stringify({foo, bar})`, `returns` must mention `foo` and `bar`
- every `examples[].command` must execute against a normal registered fabric without undocumented setup
- `usage[]` strings must be runnable copy-paste (no placeholder angle-brackets that the user cannot resolve from context)

**Verification command**: after registering, run `fabric script help <id>` and compare its output to the exported `interface` field by field.
<!-- /append -->

<!-- append "script_engineering_L5_determinism" -->
## L5: Determinism Boundary

**MUST hold**:
- same inputs produce same output (args + filesystem state + manifest state are the only inputs)
- no calls to a language model, an external API, an external clock for decision logic, or `Math.random()` (except when explicitly documented as the script's purpose)
- no interactive prompts — missing inputs raise an actionable `Error`

**When a script smells non-deterministic**:
- if the finding is "this needs judgment / discussion / drafting", the logic belongs in a prompt (`rules` / `skill`), not a script
- if the finding is "this depends on live external state", isolate the external fetch into a single helper and document the non-determinism in `interface.notes`
- if the finding is "output ordering is not stable", sort the collection before returning — unstable ordering breaks downstream diffs
<!-- /append -->

<!-- append "script_engineering_L6_side_effects" -->
## L6: Side-Effect Budget

**Default allowed**:
- synchronous filesystem reads (`fs.readFileSync`, `fs.existsSync`, `fs.readdirSync`)
- reading `context.env`
- calls into `@cyberfabric/fabric` public helpers
- synchronous stringification and JSON formatting

**Forbidden by default** (each requires explicit documentation in `interface.notes` and an input flag to enable):
- filesystem writes, deletes, renames (`fs.writeFile`, `fs.rm`, `fs.rename`, `fs.mkdir` unless creating a documented target directory)
- network IO (`http`, `https`, `net`, `dgram`, `dns`, `tls`)
- subprocess execution (`child_process`)
- mutation of fabric manifests outside public helpers (`ensureResourcesManifest` is allowed; hand-edited writes to `~/.fabric/resources.toml` are not)

**Reviewer check**: scan `require(...)` calls and the top level of `run()` for any of the forbidden APIs. Any hit that is not paired with a documented flag is a MEDIUM finding at minimum.
<!-- /append -->

<!-- append "script_engineering_L7_portability" -->
## L7: Portability

**MUST**:
- require fabric internals only via `require("@cyberfabric/fabric")`
- use `context.cwd`, `context.homeDir`, `context.fabricHome` for path resolution; do not assume `process.cwd()` matches the caller's working directory
- use `path.isAbsolute` / `path.join` for path construction; never string-concatenate paths with `/`
- declare third-party packages the script imports in the kit's own `package.json` so `fabric register` installs them via the per-kit dependency feature (see `fabric prompt get kit-dependencies` for declaration, strategies, and runtime reachability)

**MUST NOT**:
- `require("../../../fabric/src/*")` — couples the kit to a specific monorepo layout; failed when the kit is distributed standalone; closed by the `@cyberfabric/fabric` package
- assume a specific Node version beyond what fabric itself requires; if a newer API is needed, document it in `interface.notes`
- depend on third-party packages that are declared neither in the kit's own `package.json` nor in `pocs/fabric/package.json`; cross-kit `require` (reaching into a sibling kit's `node_modules/`) is unreachable by Node's resolver and a portability bug

**When a primitive is missing from `@cyberfabric/fabric`**:
- if it is genuinely a third-party package (npm registry), declare it in the kit's `package.json` — that is the portable answer; no fabric-core change is needed
- if it is fabric-private state or behavior, surface it as a fabric-core follow-up to be re-exported from `@cyberfabric/fabric`, not as a local shortcut into `../../fabric/src`
- in the interim, stop and ask; do not reach into `../../fabric/src`
<!-- /append -->

<!-- append "script_engineering_L8_testability" -->
## L8: Testability

**Pure-function discipline**:
- helpers that accept inputs and return outputs without touching the filesystem should be directly unit-testable
- IO paths should be narrow — one `fs.readFileSync` site per file read, one `fs.writeFileSync` site per file write — so that tests can assert on file contents

**Fabric test harness** (where applicable):
- fabric core ships a test suite under `pocs/fabric/test/fabric.test.js`; new scripts that are core-facing should have a matching test entry
- kit-local scripts can be tested via `fabric script run <id>` invocations in a sandbox cwd with a crafted `resources.toml`

**Validation evidence**:
- every script review should cite at least one concrete invocation that was executed and the output observed, or mark the review `PARTIAL` with the exact missing invocation
<!-- /append -->

<!-- append "script_engineering_L9_synthesis" -->
## L9: Improvement Synthesis

**Severity rubric** (single scale across this methodology):
- `CRITICAL` — script cannot load, register, or execute; throws at `require` time; missing a required export; `id` collides with another registered script
- `HIGH` — `interface` drifts from `run()` behavior (parameter missing, required/optional wrong, `returns` wrong); determinism boundary violated; forbidden side effect without documented flag
- `MEDIUM` — portability violation (relative reach into fabric internals); cognitive-load or structure defect that blocks future edits; missing error message context
- `LOW` — wording, description clarity, example hygiene, unused helper, stylistic inconsistency

**Effort rubric**:
- `TRIVIAL` — single line or description edit
- `SMALL` — single helper rewrite or single `interface` field correction
- `MEDIUM` — multiple sections; reorganize `run()` or extract a helper
- `LARGE` — module-level restructure or split into multiple scripts

**Quick wins**: CRITICAL + TRIVIAL/SMALL fixes, ranked by impact-to-effort.

**Per-fix guidance**: provide `What`, `Where` (file and line range), `Why`, `How`, `Verify` (concrete command to run after the fix).
<!-- /append -->

<!-- append "script_engineering_report_format" -->
## Report Format

Produce a report with these sections in order when applying this methodology as a review:

1. `Summary` — script id, classification (L1), overall quality (`GOOD | NEEDS_IMPROVEMENT | POOR`), critical issue count, total issue count
2. `Context Budget & Evidence` — files read, invocations executed, and their observed output
3. `Layer Summaries` — one short paragraph per layer L1-L8
4. `Issues Found` — tables by severity (CRITICAL / HIGH / MEDIUM / LOW)
5. `Recommended Fixes` — immediate / next iteration / backlog
6. `Verification Checklist`

When `script-bug-finding` is loaded alongside, prepend its status block (`Review status`, `Deterministic gate: PASS | FAIL | SKIPPED`, scope, review basis, environment snapshot, coverage summary) to `Summary`.
<!-- /append -->

<!-- append "script_engineering_validation" -->
## Validation

Review is complete when:

- [ ] All 8 analytical layers analyzed
- [ ] Issues categorized by severity and effort
- [ ] Fixes prioritized by impact/effort
- [ ] Implementation guidance provided (`Where`, `How`, `Verify`)
- [ ] At least one concrete invocation was executed and its output cited
- [ ] `fabric script help <id>` output was compared against the exported `interface` object field by field (L4)
- [ ] Determinism and side-effect budgets were checked explicitly (L5, L6)
- [ ] Require graph was walked for portability violations (L7)
- [ ] No claim of `100%` detection or blanket coverage was made
<!-- /append -->
