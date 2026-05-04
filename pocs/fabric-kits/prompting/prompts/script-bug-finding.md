---
id: script-bug-finding
type: rules
name: script bug finding
description: Behavioral defect discovery methodology for fabric scripts; companion rules loaded by prompt-script and by the script-involvement middleware
---

<!-- append "script_bugfinding_scope" -->
**Scope**: behavioral defect discovery in fabric scripts — modules registered through a kit's `script_files` glob and invoked via `fabric-poc script run <id>`.

**Non-goal**: guarantee `100%` defect detection. Script behavior depends on argument shape, filesystem state, manifest state, Node version, and the fabric runtime. The practical target is **maximum recall with explicit hypotheses, counterexamples, evidence, and validation paths**.

**Companion methodology**: pair with `script-engineering` (load via `fabric-poc prompt get script-engineering`) for clarity, structure, and design review. This document is the behavioral-defect search procedure.
<!-- /append -->

<!-- append "script_bugfinding_principles" -->
## Core Principles

- Treat a fabric-poc script as executable policy: walk argument parsing, branches, IO paths, error paths, and the return contract.
- Optimize for recall first, then raise precision with evidence. Missing a real defect is worse than inspecting one plausible hypothesis.
- Distinguish **behavioral defects** from quality smells. A defect causes wrong output, wrong error, silent failure, unsafe IO, or a `fabric-poc script help` answer that lies about behavior; quality smells are handled by `script-engineering`.
- Work from **contracts, triggers, and failure modes**, not from style alone.
- A single review pass is insufficient. High-quality script defect discovery requires static reading plus at least one concrete invocation that observes output.
<!-- /append -->

<!-- append "script_bugfinding_layer_map" -->
## Layer Map

| Layer | Question |
|---|---|
| L1 | Where are the highest-risk behavioral hotspots? |
| L2 | What preconditions, postconditions, and invariants must always hold? |
| L3 | Which branches, IO paths, or error paths can break them? |
| L4 | Which universal script bug classes apply here? |
| L5 | Can a concrete counterexample invocation be constructed? |
| L6 | What dynamic validation would confirm or refute the suspected bug? |
| L7 | What is the review status, confidence, impact, and next action? |
<!-- /append -->

<!-- append "script_bugfinding_L1_hotspots" -->
## L1: Script Hotspot Mapping

Focus first on constructs most likely to create high-impact failures.

- **Argument parsing**: positional vs flag handling, missing-value handling, repeated flags, flags with no value, unexpected flags
- **Path resolution**: absolute vs relative path handling, `context.cwd` vs `process.cwd()` confusion, `path.isAbsolute` guards
- **Filesystem IO**: every `fs.readFileSync` / `fs.writeFileSync` / `fs.existsSync` / `fs.readdirSync` site
- **Require graph**: every `require()` call — fabric internals, third-party packages, relative reaches
- **Error surfaces**: every `throw new Error` and every try/catch; swallowed errors are hotspots
- **Return paths**: every `return` statement inside `run()`; inconsistent return types break downstream parsing
- **Module load time**: any top-level side effect (read, write, network, spawn) executes at `require` time for every caller
<!-- /append -->

<!-- append "script_bugfinding_L2_contracts" -->
## L2: Contract & Invariant Extraction

Extract what the script requires before, during, and after execution.

**Preconditions**:
- required args (from `interface.parameters[].required`) actually enforced in `run()`
- required files or paths actually checked (`fs.existsSync` before read)
- required `context` fields actually used
- required dependencies actually available at `require` time

**Postconditions**:
- a successful `run()` returns a string of the shape described in `interface.returns`
- a failing `run()` throws an `Error` with an actionable message naming the script id, the parameter, and what the user can do
- no partial writes: if the script writes files, it writes all-or-nothing or documents the failure recovery

**Authority invariants**:
- the script does not mutate paths outside what the user explicitly passed
- the script does not reach networks, spawn processes, or call forbidden APIs without an explicit documented flag
- the script does not write to fabric manifests outside public helpers (`ensureResourcesManifest`)

**Determinism invariants**:
- same `args`, same filesystem, same manifests → same output
- output ordering is stable (sort before return if the source is a Set or directory listing)

**Interface parity invariants** (cross-link with `script-engineering` L4):
- every `interface.parameters[].name` has a real consumer in `run()`
- every flag `run()` reads has a declaration in `interface.parameters`
- `interface.returns` describes the actual output shape
<!-- /append -->

<!-- append "script_bugfinding_L3_branches" -->
## L3: Branch, IO, and Error-Path Exploration

Trace how defects appear when execution leaves the happy path.

- **Argument edge cases**: zero args, one arg when two required, unknown flags, flag repeated, flag with empty value, flag with value that begins with `--`
- **Filesystem edge cases**: target file missing, target file unreadable, target path is a directory, target path is a symlink to a non-existent file, manifest file malformed TOML
- **Manifest edge cases**: no global manifest, no local manifest, both manifests empty, manifest with conflicting globs, manifest with legacy `prompts.toml` / `scripts.toml` still present
- **Error recovery**: try/catch that silently swallows a read error; try/catch that logs without throwing; recovery code that is unreachable
- **Return-type edge cases**: `return` with no value (undefined), `return` with a non-string value when fabric expects a string
- **Module-load edge cases**: `require()` that succeeds on the script author's machine but fails elsewhere (relative reaches, missing peer deps)
- **Context mismatch**: assuming `process.cwd()` when the caller set a different cwd via their invocation
<!-- /append -->

<!-- append "script_bugfinding_L4_universal_sweep" -->
## L4: Universal Script Bug-Class Sweep

Apply the same defect lenses regardless of script style.

| Class | Typical failures |
|---|---|
| Argument parsing | Missing `--flag` detection, positional-vs-flag confusion, `--flag` with no value, boolean flag accidentally requires a value |
| Path resolution | `context.cwd` vs `process.cwd()` mismatch, missing `path.isAbsolute` guard, `..` traversal from user input, trailing-slash differences |
| Filesystem IO | Read before `fs.existsSync`, write without the target directory existing, partial write on error, non-atomic write |
| Require graph | Relative reach into fabric internals; third-party package undeclared in any reachable `package.json`; package declared in kit `package.json` but kit not installed (fabric-poc register skipped or `--no-install` used without prior install); cross-kit `require` reaching a sibling kit's `node_modules/`; circular require; require-time side effect (see `fabric-poc prompt get kit-dependencies` for the per-kit dependency feature) |
| Side effects | Hidden network IO, hidden subprocess, silent write outside user-provided path, direct manifest edit |
| Determinism | Reliance on wall-clock, random, or undocumented external state; unstable ordering of directory listings or Set iteration |
| Error handling | Silent swallow, generic `Error("something went wrong")` without parameter context, double-throw, unhandled rejection in `run()` |
| Return contract | Returns undefined, returns non-string, returns differently shaped JSON on different branches |
| Interface parity | `interface.parameters` missing a real flag, declaring a fake flag, wrong `required`, stale `returns` description |
| Module-load | Top-level side effect that executes at every `require` call, top-level throw that makes the script unloadable |
| Safety | Write to a path derived from user input without canonicalisation, delete-then-recreate patterns, race conditions on parallel invocations |
| Observability | No indication of which finding applied to which input, no line numbers on lint output, no context in error messages |
| Integration | Invocation signature in a prompt that calls this script does not match the script's real flags |
<!-- /append -->

<!-- append "script_bugfinding_L5_counterexample" -->
## L5: Counterexample Construction

A suspected defect becomes much stronger when you can describe exactly how the script fails.

- Build the smallest trigger: minimal `args` array plus minimal filesystem / manifest state needed to violate an invariant
- Express the failure as `args + state -> code path -> wrong behavior`
- Prefer concrete commands (`fabric-poc script run <id> --flag value`) with the expected vs observed output
- Search for guard clauses, input validation, or downstream checks that would prevent the hypothesis
- If no plausible failure trace can be constructed, lower confidence or discard the finding

**Minimum command form for a counterexample**:

```
fabric-poc script run <id> <args> # on cwd=<dir>
# Expected: <what interface.returns says>
# Observed: <what actually prints, or the thrown message>
```
<!-- /append -->

<!-- append "script_bugfinding_L6_validation" -->
## L6: Dynamic Validation Strategy

When static review is insufficient, specify the cheapest next proof.

- **Happy path**: run the documented `examples[].command` and confirm the return shape matches `interface.returns`
- **Missing argument**: invoke with zero args; confirm the error message names the script id and the missing parameter
- **Missing file**: invoke against a non-existent path; confirm actionable error
- **Malformed file**: point at a file with invalid content (bad frontmatter, malformed TOML, wrong extension); confirm error handling
- **Manifest edge case**: invoke under a cwd where no local manifest exists; confirm global-only resolution
- **Require-graph portability**: run `node -e 'require("/abs/path/to/script.js")'` from outside the kit; confirm no relative reach into fabric internals breaks the load

**Evidence requirement**: every review finding that names a concrete failure should include the counterexample command and the observed output.
<!-- /append -->

<!-- append "script_bugfinding_L7_reporting" -->
## L7: Reporting, Review Status, and Residual Risk

Every review report MUST start its `Summary` section with:

- Review status: `PASS`, `PARTIAL`, or `FAIL`
- Deterministic gate: `PASS`, `FAIL`, or `SKIPPED`; if `SKIPPED`, state why and explicitly state `no validator-backed evidence for this review path`
- Scope reviewed
- Review basis: `static`, `dynamic`, or `static + dynamic`
- Environment snapshot: Node version if known, fabric version, active manifests, cwd used for invocations
- Coverage summary: hotspots checked, invocations run, invocations still pending

Status semantics:

- `PASS` — stated scope was completed, every hotspot was inspected, at least one happy-path invocation was executed, no confirmed or high-confidence defect remains open
- `PARTIAL` — coverage is incomplete, blocked, or still waiting on dynamic validation
- `FAIL` — the review path was invalid or at least one confirmed defect remains open

Report each finding with:

- Bug class (from L4 table)
- Severity (shared fabric-level rubric: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
- Confidence: `CONFIRMED`, `HIGH`, `MEDIUM`, `LOW`
- Location (file + line range)
- Violated invariant or contract
- Minimal trigger or counterexample command
- Likely bad behavior
- Evidence (observed output or the static excerpt that shows the defect)
- Proposed fix
- Best validation step

**Residual uncertainty is mandatory**: list hotspots not fully checked, dynamic validations not yet run, bug classes partially swept, and why `PARTIAL` or `FAIL` was used. Never collapse uncertainty into a blanket `PASS`.
<!-- /append -->

<!-- append "script_bugfinding_execution_protocol" -->
## Execution Protocol

For each script hotspot:

1. Map the active branches, IO paths, and require graph (L1)
2. Extract explicit and inferred invariants (L2)
3. Walk the happy path and the most dangerous failure / recovery paths (L3)
4. Sweep all script bug classes (L4)
5. Build or refute a concrete counterexample invocation (L5)
6. Run the cheapest confirming dynamic validation (L6)
7. Set review status, then report findings and residual risk (L7)

**Efficiency rules**:

- prefer static reading first; add one concrete invocation per non-trivial hypothesis
- keep invocations cheap: use existing kit fixtures and real manifests rather than scaffolding test harnesses
- batch independent invocations into parallel tool calls when the review tool allows it
- when coverage is genuinely blocked (missing fixture, missing runtime), mark `PARTIAL` and document the exact invocation that would unblock it
<!-- /append -->

<!-- append "script_bugfinding_integration" -->
## Integration with prompt-script and prompt-review

- Use this methodology when the reviewer's task is defect hunting, hidden failure modes, regressions, unsafe IO, or root causes in a fabric-poc script
- Use the `script-engineering` rules (load via `fabric-poc prompt get script-engineering`) for clarity, structure, interface-parity, and improvement synthesis review
- This methodology is **the behavioral defect search procedure** that layers on top of `prompt-script`'s authoring loop and on top of `prompt-review` when the reviewed prompt depends on a script (the `script-involvement` middleware injects the load)
- Findings from this methodology use the single fabric-level severity scale (`CRITICAL`-to-`LOW`) so they can be merged with prompt-side findings without translation
<!-- /append -->

<!-- append "script_bugfinding_validation" -->
## Validation

Review is complete when:

- [ ] Behavioral hotspots were identified and prioritized
- [ ] Explicit and inferred contracts were extracted
- [ ] Happy path, failure paths, and recovery paths were examined
- [ ] All script bug classes (L4 table) were swept for the target scope
- [ ] Each reported issue includes a plausible trigger or counterexample
- [ ] Missing proof was converted into a concrete dynamic validation step
- [ ] Review status, deterministic gate state, environment snapshot, and coverage summary were reported explicitly
- [ ] Confidence and residual uncertainty were reported explicitly
- [ ] No claim of `100%` detection or blanket coverage was made
<!-- /append -->
