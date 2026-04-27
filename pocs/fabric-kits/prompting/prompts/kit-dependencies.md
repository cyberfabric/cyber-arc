---
id: kit-dependencies
type: rules
name: kit dependencies
description: Per-kit third-party dependency methodology — declaration in package.json + [dependencies], strategies (none/package-json/vendored), runtime reachability, and authoring workflow via fabric register + fabric kit install
---

<!-- append "kit_dependencies_overview" -->
**Scope**: a fabric kit may declare its own third-party Node.js dependencies. `fabric register` resolves and installs them into the kit's local `node_modules/` so kit scripts can `require(...)` them at runtime. Kit-declared dependencies are isolated from fabric core and from other kits — declaring `lodash` in kit A does not make it reachable from kit B.

**Out of scope**: this rule does not cover prompts (markdown is dependency-free) or fabric core's own dependencies (those are managed in `pocs/fabric/package.json` and are always reachable). It also does not cover dependencies of dependencies — npm resolves the transitive graph automatically; only the direct deps go into the kit's `package.json`.

**When to use**: a script needs a third-party package that is not already exported by `@cyberfabric/fabric` and not in Node core. Before adding a kit dep, check whether `@cyberfabric/fabric` already exposes the primitive — internal helpers may have been re-exported there.
<!-- /append -->

<!-- append "kit_dependencies_declaration" -->
A kit declares dependencies in two places, both colocated with the kit's `resources.toml`:

1. **`package.json`** in the kit root. Standard npm-style manifest; `dependencies` lists the third-party packages and version ranges. The kit's `name` is conventionally `@cyberfabric-kits/<kit-id>`. `private: true` keeps the package out of public registries.

2. **`[dependencies]` table** in `resources.toml` (optional). Pin the install strategy explicitly:
   ```toml
   [dependencies]
   strategy = "package-json"   # "none" | "package-json" | "vendored"
   package_manager = "auto"    # "auto" | "npm" | "pnpm" | "yarn" | "bun"
   ignore_scripts = false      # when true, npm/pnpm/yarn/bun runs install with --ignore-scripts
   ```

**Implicit defaults** when `[dependencies]` is omitted:
- `package.json` absent → `strategy = "none"` (no install attempted; reachable only Node core + `@cyberfabric/fabric`).
- `package.json` present → `strategy = "package-json"`, `package_manager = "auto"`, `ignore_scripts = false`.

`package_manager = "auto"` resolves at register time by lockfile presence: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock` / `bun.lockb` → bun, `package-lock.json` or none → npm. Lockfile presence determines `npm ci` vs `npm install` (and `--frozen-lockfile` for the others).

**Lockfiles**: commit them. The install feature uses lockfile content hash for cache-skip, so a missing lockfile means every register re-installs.
<!-- /append -->

<!-- append "kit_dependencies_strategies" -->
| Strategy | When | What `fabric register` does | What runtime expects |
|----------|------|------------------------------|------------------------|
| `none` | Kit has no third-party deps. | Skips install entirely. No `node_modules/` is created. | Scripts `require` only Node core + `@cyberfabric/fabric`. |
| `package-json` | Standard case: kit declares deps in `package.json` and wants them installed. | Runs the resolved package manager in the kit dir; writes `node_modules/.fabric-install-state.json` with content hashes for cache-skip on the next register. | Scripts `require` Node core + `@cyberfabric/fabric` + anything declared in the kit's `package.json`. |
| `vendored` | Hermetic / offline kits, kits whose deps are pure-JS and small enough to commit, kits that need a specific install state that npm cannot reproduce. | Verifies `node_modules/` exists and is non-empty. Never runs the package manager. Never writes a state file. | Same as `package-json` at runtime; install is the kit author's responsibility. |

**Choosing**:
- Default to `package-json` (implicit when `package.json` is present). It works out of the box, supports the four common package managers, and cache-skips on subsequent registers.
- Pick `vendored` only when (1) the kit's reviewers can audit committed `node_modules/`, (2) the deps are pure-JS, and (3) you need offline-first install or fully reproducible bytes. The trade-off is repo size and platform-specific files for native modules.
- Avoid mixing: don't ship a `vendored` kit with a `package.json` that lists the same deps. The vendored bytes win at runtime; the `package.json` becomes misleading.
<!-- /append -->

<!-- append "kit_dependencies_runtime_reachability" -->
A fabric script invoked via `fabric script run <id>` resolves `require(...)` from its own location upward. Reachable, in this order:

1. **Node core** — `node:fs`, `node:path`, `node:os`, `node:crypto`, etc. Always available.
2. **The kit's own deps** — anything declared in the kit's `package.json` after install. Reachable via `node_modules/` directly inside the kit dir.
3. **Shared monorepo deps** — packages installed at a parent `node_modules/` that Node's resolver walks into. In this fabric layout, `@cyberfabric/fabric` lives at `pocs/node_modules/@cyberfabric/fabric` and is reachable from every kit under `pocs/fabric-kits/`.
4. **Fabric internals via the public entry** — `require("@cyberfabric/fabric")` exposes a curated surface (`api`, `getActiveManifestPathsReadOnly`, `parseResourcesManifest`, etc.). Always prefer the public entry over reaching into `pocs/fabric/src/...`.

**NOT reachable**:
- Other kits' deps. Even if both kits declare `@iarna/toml`, kit A cannot `require` kit B's installed copy — Node only walks parents of the requiring file.
- Fabric core's own deps that are NOT exported through `@cyberfabric/fabric`. They live at `pocs/fabric/node_modules/`, which is a sibling of `pocs/fabric-kits/<kit>/`, not an ancestor. If you need such a primitive, declare it in the kit's `package.json` directly, or open a fabric-core issue to expose it via the public entry.
- Globally installed npm packages (`npm install -g foo`). Kit isolation does not depend on global installs.

**Runtime evidence**: when in doubt, write a one-line probe and run it: `fabric script run <kit-script-id>` with a `require("foo")` at the top — Node throws `Cannot find module 'foo'` if it isn't in the resolution path.
<!-- /append -->

<!-- append "kit_dependencies_authoring_workflow" -->
1. **Add the dep**: edit the kit's `package.json` (creating it if missing); pin a version range.
2. **Install during authoring**: run `fabric kit install <kit-path>` from anywhere. This reads the kit's `package.json` + `[dependencies]` table, installs into `kit/node_modules/`, and writes `kit/node_modules/.fabric-install-state.json`. Use this whenever you change deps mid-authoring without wanting to re-register.
3. **Verify the require resolves**: `node -e "require('<your-package>')"` from inside the kit dir, or invoke a script that uses it via `fabric script run <id>`.
4. **Commit lockfile**: stage `package.json` AND `package-lock.json` (or the equivalent `pnpm-lock.yaml` / `yarn.lock` / `bun.lock`). NEVER commit `node_modules/` itself unless `strategy = "vendored"`. Add `node_modules/` to the kit's `.gitignore`.
5. **Register normally**: `fabric register <kit-path> [--local]` runs install before generating skill entries. Cache-skip kicks in when `package.json` and lockfile hashes match the stored state.
6. **CI / hermetic environments**: pass `--no-install` to skip the install step and verify only that `node_modules/` exists and is non-empty. Use `--reinstall` to force a fresh install ignoring the cache.

**Symbolic walk-through** (the planner kit, real example):
```
pocs/fabric-kits/planner/
  resources.toml          # no [dependencies] block — implicit package-json
  package.json            # declares "@iarna/toml": "^2.2.5"
  package-lock.json       # committed
  scripts/plan-manifest-write.js
                          # const TOML = require("@iarna/toml");
  node_modules/           # gitignored; populated by fabric register
    @iarna/toml/...
    .fabric-install-state.json
```
After `fabric register pocs/fabric-kits/planner --local`:
```
Registered resources from .../planner into .../.fabric/resources.toml ...
Dependencies: install (no-node-modules) strategy=package-json packageManager=npm ran=npm install
```
A second register on unchanged inputs cache-skips:
```
Dependencies: skip (state-match) strategy=package-json packageManager=npm
```
<!-- /append -->

<!-- append "kit_dependencies_vendored_caveats" -->
Picking `strategy = "vendored"` means the kit author owns the install. Reviewers see committed `node_modules/`. This is rarely the right call — these caveats explain why:

- **Native modules don't vendor cleanly**: anything with a binding (`better-sqlite3`, `node-sass`, `sharp`, `node-gyp` deps) compiles per-platform / per-arch / per-Node-version. A vendored copy from macOS-arm64 + Node 22 will not load on Linux-x64 + Node 24. Either prebuild for every target platform you support (huge repo, painful CI) or stick with `strategy = "package-json"` and let each environment compile.
- **Repo size**: medium kits hit hundreds of MB once `node_modules/` is in. Even with sparse checkouts, every clone pays for it.
- **License surface**: vendoring captures the licenses of every transitive dep into the repo. Some licenses (GPL family) propagate through redistribution. Audit before vendoring.
- **Lifecycle scripts run anyway**: `npm install` lifecycle scripts (`postinstall`, etc.) run when authors install locally before vendoring. Vendoring locks in whatever those scripts produced; if a build is non-deterministic, the vendored state may drift from a fresh install.
- **`ignore_scripts` does NOT apply to vendored kits**: the flag controls the package manager invocation `fabric register` makes. For vendored, fabric runs no install at all. The kit author chose to commit the result of whatever they ran — including any lifecycle effects.
- **Verification is shallow**: `fabric register` for a vendored kit only checks that `node_modules/` is non-empty. It does NOT verify the contents match `package.json`, that hashes match a lockfile, or that no rogue files were committed. Reviewers must do that.

When vendored is the right call: pure-JS deps, small footprint, the kit ships in environments where install isn't possible (air-gapped CI, restricted endpoints), and the team accepts manual platform builds.
<!-- /append -->

<!-- append "kit_dependencies_failure_modes" -->
| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Cannot find module '<pkg>'` at runtime | Kit declares dep in `package.json` but `fabric register` was not run since the change | `fabric kit install <kit-path>` or re-register. |
| `installer: ... npm ci ... failed (exit status 1)` | Lockfile is out of sync with `package.json` | Either re-run `npm install` to refresh the lockfile, or delete the lockfile and let fabric run `npm install`. Commit the new lockfile. |
| Register fails with `vendored-but-no-node_modules` | Kit declares `strategy = "vendored"` but `node_modules/` is missing or empty | Run install in the kit dir manually and commit `node_modules/`, or switch to `strategy = "package-json"`. |
| Register fails with `no-install-but-missing-node_modules` | Run with `--no-install` but the kit was never installed before | Drop `--no-install` for the first install, OR run `fabric kit install <kit-path>` first then re-register with `--no-install`. |
| Cache-skip when you expected install | `package.json` + lockfile + Node version all unchanged from last successful install | Use `fabric register <kit-path> --reinstall` to force. |
| Script works locally but fails in CI | CI uses `--no-install` and `node_modules/` was not provisioned | Either provision `node_modules/` via a CI-side install step before `fabric register --no-install`, or drop `--no-install` in CI. |
| Kit A imports Kit B's dep | Cross-kit `require` is impossible by design | Each kit declares its own deps. Duplication is the cost of isolation. |
| Lifecycle script (`postinstall`) doesn't run | `[dependencies] ignore_scripts = true` is set | Set `ignore_scripts = false` (the default) or remove the flag. Be explicit about why scripts must run. |
<!-- /append -->
