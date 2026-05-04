---
id: prompt-script
type: rules
name: prompt script
description: Author a fabric-poc script (JS module with id, name, description, interface, run) and register it alongside the prompts that invoke it
---

<!-- append "script_intro" -->
Use fabric-poc prompt script authoring mode. This mode produces a JavaScript file under a kit's `scripts/` directory — not a markdown prompt.
<!-- /append -->

<!-- append "script_goal" -->
1. The goal of this mode is to produce a fabric-poc script that is registerable, loadable, deterministic, and self-describing. Scripts hold behavior with a single correct output given fixed inputs; they do not hold judgment, drafting, or open-ended language work.
<!-- /append -->

<!-- append "script_load_companions" -->
2. Always load the two companion methodology rules before proposing, writing, or revising the script body:
   - `fabric-poc prompt get script-engineering` — clarity, structure, interface-parity, determinism-boundary, side-effect-budget, portability, testability, and improvement-synthesis layers
   - `fabric-poc prompt get script-bug-finding` — hotspot mapping, contract extraction, branch and I/O exploration, universal bug-class sweep, counterexample construction, dynamic validation, and reporting
   - treat the loaded methodologies as reference material; cite specific layers or codes (for example `L4 Interface-vs-help parity`, `L6 Side-effect budget`) rather than restating them
<!-- /append -->

<!-- append "script_ground_state" -->
3. Anchor on the script-specific side of fabric state:
   - confirm which prompts will invoke this script so the script interface matches their invocation signature
   - read at least one canonical existing script under `pocs/fabric-kits/*/scripts/` (for example `prompt-lint.js` or `prompt-scaffold.js`) as a shape reference; do not invent a new module layout
   The shared `fabric-poc script list` / `fabric-poc script help <id>` / `fabric-poc prompt list` baseline is injected by the `authoring-ground-state` middleware — do not restate it here.
<!-- /append -->

<!-- append "script_scaffold_via_script" -->
4. Emit the skeleton deterministically via fabric-poc script instead of writing `module.exports = {...}` by hand:
    - run `fabric-poc script run script-scaffold --id <kebab-id> --name <name> --description <description> [--parameters <json>] [--returns <str>] [--examples <json>] [--details <json>] [--usage <json>] [--notes <json>]` to produce a valid starter skeleton with empty or seeded `interface` fields
    - use `fabric-poc script help script-scaffold` when you need the full parameter list or examples
    - replace the `run()` stub (`throw new Error("<id>: not implemented")`) with real logic; keep the `interface` shape exactly as emitted and fill in any fields you did not seed via flags
<!-- /append -->

<!-- append "script_module_shape" -->
5. The module MUST export an object with these fields:
   - `id` — kebab-case string, globally unique across every active `script_files` manifest
   - `name` — human-friendly one-line name shown in `fabric-poc script list`
   - `description` — one-line purpose shown in `fabric-poc script list` and `fabric-poc script help`
   - `run(args, context)` — a function that executes the script; receives CLI args and the fabric context object (see next block); returns a string (JSON-stringified or plain) that fabric prints verbatim, or throws an `Error` on validation or IO failure
   - `interface` — strongly recommended; its shape drives `fabric-poc script help <id>`. Fields: `details: string[]`, `usage: string[]`, `parameters: { name, type, required, description }[]`, `returns: string`, `examples: { command, description }[]`, `notes: string[]`
   - all text fields in `interface` MUST match the script's actual behavior; `fabric-poc script help` reads this object verbatim, so any drift becomes user-facing misinformation
<!-- /append -->

<!-- append "script_context_reference" -->
6. The second argument to `run(args, context)` is the fabric context object. Honor these fields exactly as fabric provides them:
   - `context.id`, `context.name`, `context.description` — the script's own metadata, mirrored back for convenience
   - `context.args` — same array as the first argument; either may be used
   - `context.cwd` — the caller's working directory; use this to resolve relative paths the user passed on the command line
   - `context.fabricHome` — the resolved fabric home **root directory**, NOT `~/.fabric` itself. Default is `os.homedir()`; overridden by the `FABRIC_HOME` env var (or an explicit `homeDir` option). The global manifest lives at `path.join(context.fabricHome, ".fabric", "resources.toml")` — the `.fabric` suffix is yours to append
   - `context.homeDir` — currently mirrors `context.fabricHome` (same resolved root). Treat the two fields as identical in the current runtime and prefer `context.fabricHome` when the intent is "find fabric-owned state"; `context.homeDir` remains for forward-compat if the runtime later splits them
   - `context.env` — environment variables available to the script
   - `context.scriptPath` — absolute path to this script file on disk; use for reading sibling assets
   - do not assume fields that are not documented above; do not mutate the context object
<!-- /append -->

<!-- append "script_determinism_first" -->
7. Determinism boundary — a fabric-poc script MUST satisfy all of these:
   - given the same inputs (`args`, filesystem state, manifest state) it produces the same output
   - it does not consult a language model, a network service, an external clock for logic, or a random-number source (except when explicitly documented)
   - it does not ask the user interactive questions; missing inputs become `throw new Error(...)` with an actionable message
   - anything that requires judgment, drafting, or open-ended discussion belongs in a prompt (`rules` / `skill` / `workflow`), not in a script
<!-- /append -->

<!-- append "script_side_effect_budget" -->
8. Default side-effect budget — a fabric-poc script:
   - MAY read files via `fs.readFileSync` / `fs.existsSync` / `fs.readdirSync`
   - MAY read environment variables from `context.env`
   - MAY call fabric's public API from `require("@cyberfabric/fabric")`
   - MAY require third-party packages declared in the kit's own `package.json`; `fabric-poc register` installs them via the per-kit dependency feature (see `fabric-poc prompt get kit-dependencies` for declaration, strategies, and runtime reachability)
   - MUST NOT perform network IO (no `http`, `https`, `net`, `dgram`, `dns`, `tls`)
   - MUST NOT spawn subprocesses (no `child_process`)
   - MUST NOT write, rename, or delete files outside the paths the user explicitly passed as args — and never inside fabric's own manifest files except via public helpers like `ensureResourcesManifest`
   - if the script needs to write, document the exact files written in `interface.notes` and fail loudly when the target path is outside the expected scope
<!-- /append -->

<!-- append "script_portability" -->
9. Portability rules:
   - to use fabric internals, require the curated public entry: `const { ... } = require("@cyberfabric/fabric");`
   - MUST NOT use relative `require("../../../fabric/src/*")` — that path couples the kit to a specific monorepo layout and breaks standalone distribution
   - MUST NOT import fabric-private modules that are not re-exported from `@cyberfabric/fabric`; if a needed primitive is missing from the public entry, treat it as a fabric-core follow-up and surface it as an open question instead of reaching for internals
   - Node core (`node:fs`, `node:path`, `node:os`, etc.) is always available; third-party packages must be declared in the kit's own `package.json` (preferred — installed by `fabric-poc register` via the per-kit dependency feature; see `fabric-poc prompt get kit-dependencies`) or, when the package is genuinely a fabric-core primitive, in `pocs/fabric/package.json`
   - MUST NOT rely on a third-party package that is reachable only through a sibling kit's `node_modules/` or through a global npm install — Node's resolver walks ancestors of the script file, so cross-kit reach is not portable
<!-- /append -->

<!-- append "script_error_contract" -->
10. Error and output contract:
   - on invalid inputs or missing files, throw `new Error(<actionable message naming the script id, the parameter, and what the user can do>)`; fabric catches and surfaces the message
   - on success, return a string from `run()`; if the output is structured, `JSON.stringify(value, null, 2)` and return the result
   - do not write to `stdout` or `stderr` directly (`console.log`, `process.stdout.write`); let fabric render the returned string
   - do not swallow errors inside try/catch without re-throwing or returning a structured error object; silent failure is a prompt-script bug-finding defect (`L7 Reporting`)
<!-- /append -->

<!-- append "script_interface_parity" -->
11. Interface parity:
    - every `parameters[].name` in `interface` must correspond to a real CLI flag or positional accepted by `run()`; after writing `run()`, list every argument it inspects and compare one-to-one
    - `usage` strings must be runnable copy-paste examples
    - `returns` must describe what fabric actually prints — if the script returns JSON, say so and give the shape in one sentence
    - `examples[].command` must execute successfully against a registered fabric in a normal environment; do not ship examples that depend on undocumented setup
<!-- /append -->

<!-- append "script_file_location" -->
12. Place the generated script according to its registration scope:
    - for a kit-scoped script, write it under the target kit's `scripts/` directory so it is covered by the kit's `script_files` glob
    - for a project-local script, write it under the directory referenced by the project's local `.fabric/resources.toml` `script_files` entry
    - read the kit's `resources.toml` before writing to confirm the `script_files` glob shape; if the chosen path is not covered, extend the manifest or choose a different directory first
<!-- /append -->

<!-- append "script_verify_before_register" -->
13. Verify before registering via deterministic scripts:
    - run `fabric-poc script run script-lint <path>` and fix every CRITICAL and HIGH finding; fabric-poc script help output is driven by the exported `interface`, so a HIGH interface-shape finding is a real defect
    - run `fabric-poc script run prompt-register-dryrun <path> --type script` to confirm the new file is covered by an active `script_files` glob; if `covered` is `false`, extend the target kit's `resources.toml` or choose a different directory before continuing
    - re-read the file and visually confirm every `interface.parameters[].name` is actually consumed by `run()` and every field in `interface` matches the script's behavior (interface-parity findings that the linter cannot catch statically)
    - apply the `script-engineering` and `script-bug-finding` layer maps to the final draft; resolve any CRITICAL or HIGH finding before registering
<!-- /append -->

<!-- append "script_output" -->
14. Output contract — follow the shared rules injected by the `authoring-output-contract` middleware below, plus these script-specific deltas:
    - print the verification command `fabric-poc script help <id>` so the user can confirm the help output renders from the exported `interface`
    - do NOT promise that `fabric-poc register` will generate a slash command or skill entry point for this script — per the shared contract's rule 4, scripts never become skill entry points; `fabric-poc register` only refreshes `script_files` glob coverage so that `fabric-poc script run <id>` and `fabric-poc script help <id>` resolve
<!-- /append -->
