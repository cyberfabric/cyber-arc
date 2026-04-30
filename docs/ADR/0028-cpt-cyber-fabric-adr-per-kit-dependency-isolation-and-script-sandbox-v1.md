---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0028: Per-Kit TypeScript Dependency Isolation via pnpm and Corepack with Process-Sandboxed Script Execution

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: npm Only](#option-1-npm-only)
  - [Option 2: Bundled Scripts at Kit-Build Time](#option-2-bundled-scripts-at-kit-build-time)
  - [Option 3: pnpm via Corepack with Per-Kit node_modules and Process Sandbox](#option-3-pnpm-via-corepack-with-per-kit-node_modules-and-process-sandbox)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-per-kit-dependency-isolation-and-script-sandbox`

## Context and Problem Statement

Cyber Fabric kits ship scripts (per ADR-0017), and those scripts realistically need third-party TypeScript libraries — HTTP clients, parsers, formatters, language clients, AI SDKs, and so on. ADR-0017 fixed the existence of scripts as a first-class kit resource and the `fabric script list / info / run` CLI surface, but it deferred two adjacent decisions: how kit-declared dependencies are installed and isolated, and what happens when a script is executed. Without committing to those, two real problems are left open.

First, **dependency isolation**. Different kits will declare different versions of the same library — kit A may need `lodash@4.x` while kit B is still on `lodash@3.x`. If all kits share one global `node_modules` (or a hoisted layout), version conflicts and "ambient" dep leakage become daily failure modes; if every kit has its own naive `node_modules`, the same packages get duplicated on disk and install times balloon when many kits are installed.

Second, **execution safety**. A script bug — infinite loop, uncaught exception, accidental `process.exit(1)`, runaway memory — must not bring down Fabric itself, mutate other kits' working state, or accidentally read another kit's environment variables (which could include secrets per ADR-0027). Some level of sandbox is required just to make scripts a safe primitive.

A third constraint is operational: the same package manager that handles Fabric's own development dependencies should also handle kit-shipped dependencies, so contributors and operators see one tool, not two.

## Decision Drivers

* **Per-kit dependency isolation** — different versions of the same library across kits must coexist without conflict
* **Disk efficiency** — content-addressed deduplication so that users with many kits do not pay multiplicative storage cost
* **Strict node_modules layout** — a kit script must see only the deps its kit declared, not "ambient" deps from other kits or hoisting
* **Same package manager as Fabric core** — kits and Fabric core's own dependencies must be managed by the same tool, so there is one workflow for both
* **Minimal user prerequisite** — Node is already a prerequisite (per ADR-0004); the dependency model should not add a separate package-manager install step on top
* **Process isolation for scripts** — script runs in a separate process with constrained environment so misbehaving scripts cannot crash Fabric or interfere with sibling kits
* **Headroom for stronger sandbox later** — filesystem restrictions, network restrictions, and resource limits are explicit follow-on, not blocked by this decision

## Considered Options

1. **npm Only** — use the package manager bundled with Node; simpler but weaker isolation and disk efficiency
2. **Bundled Scripts at Kit-Build Time** — kit authors bundle dependencies via esbuild or similar so the user does not install anything; pushes complexity to kit authors
3. **pnpm via Corepack with Per-Kit node_modules and Process Sandbox** — pnpm activated through Corepack (bundled with Node 16+); per-kit `node_modules` for dependency isolation; pnpm's content-addressed global store for disk efficiency; child-process execution with constrained CWD, `NODE_PATH`, and env-var whitelist for basic safety

## Decision Outcome

Chosen option: **Option 3 — pnpm via Corepack with Per-Kit node_modules and Process Sandbox**, because Cyber Fabric needs a dependency model that gives strict per-kit isolation with cheap disk usage, uses the same tooling for Fabric core development and kit-shipped dependencies, keeps the user prerequisite at "Node only", and ships with at least basic execution safety so scripts can be added without each one threatening Fabric's own stability. Of the realistic options, only pnpm hits all four points at once.

The decision has three parts:

1. **Package manager: pnpm via Corepack.** Fabric requires Node (already a prerequisite per ADR-0004); **Corepack** (bundled with Node 16+) auto-activates pnpm based on the project's `packageManager` field. There is **no separate pnpm install step** for users — Corepack downloads and uses the pinned pnpm version on first invocation. The same pnpm tooling manages Fabric core's own development dependencies and the dependencies kits declare in their manifests, so contributors and operators see one workflow.

2. **Per-kit dependency isolation.** Each kit declares its dependencies in its manifest. When the kit is installed or its dependency declaration changes, Fabric runs `pnpm install` scoped to the kit's directory, producing a kit-local `node_modules`. pnpm's **content-addressed global store** deduplicates packages across kits — when kit A pins `lodash@4.x` and kit B pins `lodash@3.x`, each kit's `node_modules` links into the global store and each unique `(name, version)` pair exists exactly once on disk. pnpm's **strict node_modules layout** ensures that a kit script's module resolution sees only the deps that kit declared — no "ambient" leakage from other kits or from hoisting.

3. **Process-sandboxed script execution.** When `fabric script run <kit>:<id>` (per ADR-0017) is invoked, Fabric spawns a **child Node process** for the script with:
   * **CWD** set to the kit's directory
   * **`NODE_PATH`** constrained to the kit's `node_modules`
   * **Environment variables** passed through a **whitelist** (the kit does not inherit the parent process's full environment; only explicitly allowed variables — `PATH`, `HOME`, `FABRIC_*`, kit-declared env vars, etc. — are forwarded)
   * **stdout / stderr** captured by Fabric and surfaced to the caller

   This gives basic safety: a misbehaving script crashing, hanging, or calling `process.exit` cannot bring down Fabric itself, and one kit's scripts cannot accidentally read another kit's secrets through shared environment variables.

**Out of scope (follow-on):**

* Lockfile model per kit (`pnpm-lock.yaml` per kit vs. one Fabric-managed lockfile)
* Conflict resolution when a kit pins a package at a different version than Fabric core requires
* Stronger sandboxing: filesystem restrictions, network restrictions, CPU and memory limits, Node `--permission` flag, container-based or VM-based isolation
* The TypeScript transpilation pipeline for kit scripts (whether Fabric uses `ts-node` / `tsx` at runtime, or kits ship pre-transpiled JS)
* Whether the global pnpm store is pre-warmed at install time or populated lazily on first script run
* Kit-build-time bundling as an opt-in for kits that want zero-install user experience
* The exact env-var whitelist (which variables are passed through by default)

### Consequences

* Good, because per-kit `node_modules` plus pnpm's content-addressed global store gives the dependency isolation we need at minimal disk cost
* Good, because Corepack means the user prerequisite stays just Node — no separate pnpm install step for users
* Good, because the same pnpm tooling manages Fabric core's own development deps and kit-shipped deps, so the operational story is one tool
* Good, because process sandboxing gives basic safety: a script crashing or hanging cannot affect Fabric or sibling kits
* Good, because stronger sandboxing (filesystem, network, resources) is left as a clean follow-on and is not blocked by this decision
* Good, because the env-var whitelist by construction prevents one kit's scripts from reading another kit's secrets through process inheritance
* Bad, because the decision relies on Corepack being available (Node 16+) and on the `packageManager` field convention
* Bad, because spawning a child process per script invocation adds latency (in practice 50–100 ms, negligible for non-hot-path use)
* Bad, because the env-var whitelist needs deliberate design — too restrictive breaks legitimate scripts, too permissive defeats the sandbox
* Bad, because TypeScript scripts need a transpile or runtime-TS tool (`ts-node`, `tsx`, or pre-transpilation), which is itself a follow-on dependency choice not pinned here

### Confirmation

Confirmed when:

* Fabric uses **pnpm via Corepack** as its package manager for both Fabric core development and kit dependency installation; users do not have to install pnpm separately on top of Node
* kits declare dependencies in their manifest; `pnpm install` is run scoped to the kit's directory when the kit is installed or its declaration changes
* each kit gets a strict, isolated `node_modules`; different versions of the same library across kits coexist via pnpm's content-addressed global store and each unique `(name, version)` exists once on disk
* `fabric script run <kit>:<id>` spawns a child Node process with `CWD = kit-dir`, `NODE_PATH = kit-node_modules`, and an env-var whitelist
* a crashing or hanging script does not affect Fabric itself or other kits' scripts
* one kit's scripts cannot read another kit's secrets through inherited process environment

## Pros and Cons of the Options

### Option 1: npm Only

Use the package manager bundled with Node; one shared `node_modules` (with hoisting) or per-kit `node_modules` without content-addressing.

* Good, because npm is bundled with Node — no extra install at all
* Good, because npm is universally understood
* Bad, because no content-addressed deduplication — disk usage grows linearly with kit count
* Bad, because the default `node_modules` layout has hoisting, allowing "ambient" deps to leak between kits in subtle ways
* Bad, because install times grow noticeably for many kits

### Option 2: Bundled Scripts at Kit-Build Time

Kit authors bundle their dependencies via esbuild or rollup at kit-build time; the user installs nothing extra.

* Good, because zero install on the user side — `node script.js` just runs
* Good, because what was bundled at build time is exactly what runs at script time (deterministic)
* Bad, because every kit author needs to set up and maintain a bundler pipeline
* Bad, because kit packages get larger (each kit ships its own copy of every dep)
* Bad, because debugging requires unpacking bundled JS, breaking the natural editor experience
* Bad, because patching a dep in place (for local debugging) requires a full rebuild of the kit

### Option 3: pnpm via Corepack with Per-Kit node_modules and Process Sandbox

pnpm activated through Corepack; each kit gets its own `node_modules`; scripts run in a child Node process with constrained CWD, `NODE_PATH`, and env-var whitelist.

* Good, because content-addressed global store deduplicates across kits while preserving per-kit isolation
* Good, because strict node_modules layout prevents ambient dep leakage
* Good, because Corepack means user prerequisite stays at Node only
* Good, because the same pnpm tooling serves Fabric core development and kit dependencies
* Good, because process sandbox gives basic safety against misbehaving scripts at low cost
* Good, because the env-var whitelist prevents accidental cross-kit secret leakage
* Bad, because Corepack requires Node 16+ and depends on `packageManager` field convention
* Bad, because per-script process spawn adds 50–100 ms latency
* Bad, because env-var whitelist design needs deliberate care
* Bad, because TypeScript transpilation for scripts is a separate follow-on choice not resolved here

## More Information

The user-prerequisite ladder under this decision is:

* **Node** (already required per ADR-0004) — comes with Corepack since Node 16
* **Corepack** (bundled with Node) — auto-activates pnpm based on the `packageManager` field
* **pnpm** — pinned by version in `packageManager`; downloaded by Corepack on first use, no manual install

Other package managers were considered and rejected:

* **Yarn Berry (Plug'n'Play)** — offers even stricter isolation (no `node_modules` at all) and powerful workspace support, but the ecosystem still has rough edges with some libraries that assume a real `node_modules`. We rejected it in favor of pnpm's strict-but-compatible approach. A future amendment could revisit if PnP compatibility broadly improves.
* **Bun** — a faster Node-compatible runtime and package manager, but at this writing has runtime incompatibilities in some areas (some Node APIs not fully covered, ecosystem libraries not all tested against Bun); we treat it as out of scope for the platform's hard prerequisite, though kit authors are not prevented from using it locally.

The TypeScript transpilation pipeline for kit scripts (whether Fabric uses `ts-node` or `tsx` at runtime, or whether kits are expected to ship pre-transpiled `.js`), the exact env-var whitelist, the conflict-resolution strategy when a kit and Fabric core pin the same package at different versions, and the lockfile model are intentionally left to follow-on design.

This decision composes with several existing ADRs:

* **ADR-0004** (TypeScript primary language) — Node remains the runtime; Corepack is bundled with Node 16+
* **ADR-0006** (kit packaging) — kit packaging includes the dependency declaration that `pnpm install` reads
* **ADR-0008** (kit scopes) — the dependency isolation works the same regardless of whether the kit is core-bundled, global, or workspace-scoped
* **ADR-0017** (scripts as kit resources) — `fabric script run` is the surface that triggers the sandboxed child-process execution
* **ADR-0027** (secret storage and `fabric login`) — env-var whitelist works in tandem with secret storage to prevent accidental cross-kit secret leakage through inherited process environment

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-per-kit-dependency-isolation`
- **Related decisions**: [ADR-0004](0004-cpt-cyber-fabric-adr-typescript-primary-language-v1.md), [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0027](0027-cpt-cyber-fabric-adr-secret-storage-and-fabric-login-v1.md)

This decision directly addresses the following traceability items:

* Fabric must use pnpm via Corepack as its package manager for both Fabric core development and kit dependency installation
* the same package manager manages Fabric core dev and kit dependency installation; users do not install pnpm separately on top of Node
* per-kit `node_modules` provides dependency isolation; pnpm's content-addressed global store provides disk efficiency across kits
* different versions of the same library across kits must coexist without conflict
* `fabric script run` spawns a child Node process with constrained CWD, `NODE_PATH`, and an env-var whitelist
* a misbehaving script cannot affect Fabric itself or sibling kits
* stronger sandboxing (filesystem, network, resource limits) is explicit follow-on design
