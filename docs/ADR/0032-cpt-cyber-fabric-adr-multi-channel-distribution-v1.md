---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0032: Multi-Channel Fabric Distribution: npm, Homebrew, Scoop, VS Code Marketplace, and Agent-Tool Marketplaces

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Single Channel Only](#option-1-single-channel-only)
  - [Option 2: Multi-Channel with Self-Contained Binary](#option-2-multi-channel-with-self-contained-binary)
  - [Option 3: Multi-Channel with Node Prereq and Equivalent Outcomes](#option-3-multi-channel-with-node-prereq-and-equivalent-outcomes)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-multi-channel-distribution`

## Context and Problem Statement

Cyber Fabric needs to be installable through the channels users already use to get developer tools: package managers (npm, Homebrew, Scoop), IDE marketplaces (VS Code Marketplace), and agent-tool marketplaces (Claude Code, Codex). Forcing a single canonical install channel limits adoption — macOS developers expect brew, Windows developers expect scoop, IDE-first users expect VS Code Marketplace, and Claude Code / Codex users expect their tool's marketplace.

The platform must commit to a multi-channel distribution model where each channel produces an **equivalent** Fabric installation: same version, same `core` kit (per ADR-0030, which includes the VS Code extension and the GitHub provider implementation under `core:github.<name>`), same CLI / REST API / Web UI surfaces. The mechanism varies per channel; the outcome does not.

The platform must also handle Fabric's hard prerequisite (Node, per ADR-0004 and ADR-0028) consistently across channels — each channel either declares Node as a dependency, leverages an existing install, or ensures Node is present through the channel's own installer.

## Decision Drivers

* **Adoption breadth** — meeting users in the package manager / IDE / agent tool they already use is critical for adoption
* **Equivalent outcome across channels** — Fabric's surfaces, kit, and version must be the same regardless of install channel
* **Node prereq baseline** — ADR-0004 and ADR-0028 already commit to Node + Corepack + pnpm; multi-channel distribution must respect that baseline
* **Per-channel update mechanism** — leverage each channel's native update UX (`brew upgrade`, `scoop update`, `pnpm update -g`, VS Code auto-update, etc.) rather than inventing a unified `fabric update`
* **Cross-channel duplicate detection** — users may accidentally install via two channels; the platform should warn but not block (user responsibility)
* **MVP scope vs follow-on** — three channels cover the developer baseline (npm/pnpm + Homebrew + VS Code Marketplace); other channels are explicit follow-on to keep MVP scope tight
* **Same source for all channels** — each channel publishes from the same git tag; minor cross-channel publish lag is acceptable

## Considered Options

1. **Single Channel Only** — Fabric distributed via npm only, users on other platforms install Node + npm first
2. **Multi-Channel with Self-Contained Binary** — Fabric ships as a single executable with bundled Node runtime; each channel distributes the same binary
3. **Multi-Channel with Node Prereq and Equivalent Outcomes** — multiple distribution channels (npm/pnpm, Homebrew, Scoop, VS Code Marketplace, Claude Code / Codex marketplace), each handling Node prereq through its own mechanism, all producing an equivalent install

## Decision Outcome

Chosen option: **Option 3 — Multi-Channel with Node Prereq and Equivalent Outcomes**, because Cyber Fabric needs broad adoption across developer ecosystems (macOS, Linux, Windows, IDE-first, agent-tool-first), and forcing a single channel or shipping a self-contained binary both impose costs that outweigh their convenience. Multi-channel with Node prereq leverages each channel's native installation and update UX while keeping Fabric's runtime model (Node + Corepack + pnpm per ADR-0028) consistent.

The decision has these parts:

### 1. MVP channels

The initial release supports three channels:

* **npm / pnpm** — `pnpm add -g @fabric/cli` (canonical command) or `npm install -g @fabric/cli`. Assumes Node 16+ already installed (Corepack bundled). The npm package is the primary source of truth — other channels publish from the same source repository.
* **Homebrew** — `brew install fabric`. The formula declares Node 16+ as a dependency; brew installs Node automatically if missing. Targets macOS and Linux (Linuxbrew).
* **VS Code Marketplace** — search for "Fabric" in VS Code Extensions, install. The extension installer ensures Node 16+ is available (prompts to install if missing) and bootstraps Fabric core. The VS Code extension itself is the `core` kit's dev tool plugin per ADR-0021 and ADR-0030, so installing through this channel installs Fabric core + the VS Code extension as a unit.

### 2. Follow-on channels

The following channels are explicit follow-on (specified in this ADR but not blocking MVP):

* **Scoop** (Windows) — `scoop install fabric` from a dedicated bucket or main scoop-bucket; manifest declares Node 16+ as dependency
* **Claude Code / Codex marketplace** — installable via the agent tool's marketplace UX as a one-click "add Fabric" experience; the marketplace entry registers Fabric's skills (per ADR-0030's `fab:<name>` convention) and bootstraps Fabric core
* **Container images** (Docker, OCI) — for CI / CD use cases where users want Fabric in an isolated runtime
* **Self-contained binary** — built via `pkg`, `nexe`, Bun bundle, or similar; bundles Node runtime; for environments without Node or air-gapped scenarios

Adding a follow-on channel is implementation work, not an ADR amendment, as long as it respects the equivalence rule (same Fabric version, same `core`, same surfaces).

### 3. Equivalent outcome rule

Every channel produces:

* Same Fabric version (channels publish from the same git tag; minor publish lag is acceptable but version skew across channels is a release-engineering concern)
* Same `core` kit (per ADR-0030) — including the VS Code extension (per ADR-0021), GitHub provider implementation (per ADR-0023's commitment under `core:github.<name>`), platform-internal prompts (per ADR-0026), domain skills, guide material, kit-development guidance
* Same CLI surface (per ADR-0001, ADR-0002)
* Same REST API surface (per ADR-0020)
* Same Web UI surface when launched (per ADR-0018)

Channel-specific differences are limited to: the CLI invocation that does the install / update / uninstall; how Node prereq is satisfied; how the install is registered with the channel's listing mechanism.

### 4. Node prereq handling per channel

* **npm / pnpm**: assumes Node 16+ is already installed (the user used npm/pnpm to install, which implies Node is present)
* **Homebrew**: `node` declared as dependency in the formula; brew installs Node if missing
* **Scoop**: same approach via manifest
* **VS Code Marketplace**: extension's installer detects Node; if missing, prompts the user to install it via the recommended channel for their OS, or installs a bundled Node runtime to a Fabric-owned location (mechanism is follow-on)
* **Claude Code / Codex marketplace**: Claude Code / Codex are themselves Node applications, so Node is available; the marketplace entry only needs to bootstrap the Fabric installation

### 5. Cross-channel duplicate-install detection

When Fabric is installed via a channel, the channel's installer (or Fabric's first-run check) detects existing Fabric installs via other channels by:

* Checking `PATH` for an existing `fabric` binary
* Checking known channel-specific install locations (for example `~/.npm-global/bin`, `/opt/homebrew/bin`, `~/scoop/apps/fabric`, etc.)

If an existing install is detected, the installer warns: `existing Fabric install detected via <other-channel>; this install may conflict. Continue? [y/N]`. The default is `n`. Users explicitly override to proceed.

`fabric --version` reports the install channel (for example `fabric 1.0.0 (homebrew)`) so duplicate installs can be identified post-install.

This is **warning-only**, not blocking. Power users may legitimately have multiple installs (system-wide brew install plus project-local pnpm install, for example).

### 6. Per-channel update flow

Fabric does **not** ship a unified `fabric update` command that updates Fabric itself. Each channel has its own update UX:

* `pnpm update -g @fabric/cli` (or `npm update -g @fabric/cli`)
* `brew upgrade fabric`
* `scoop update fabric`
* VS Code auto-updates the extension
* Claude Code / Codex marketplace updates the entry

Optionally, Fabric may ship a `fabric upgrade` command that **dispatches** to the detected install channel's native update command (for example `fabric upgrade` detects Homebrew install and runs `brew upgrade fabric`). The exact dispatcher behavior is follow-on.

### 7. Version sync across channels

All channels publish from the same source git tag (single source of truth). Minor publish lag (hours to a day or two) is acceptable. The release engineering process publishes to each channel sequentially or in parallel as that channel's automation allows; cross-channel lockstep is not required.

### Out of scope (follow-on)

* Specific package / formula / manifest contents for each channel (recipe details)
* Channel-specific maintenance ownership and process
* Air-gapped enterprise installations (offline mirror, internal package repo)
* Container image publishing (Docker Hub, GHCR, etc.)
* Self-contained binary build pipeline (`pkg` / `nexe` / Bun bundle)
* Cross-channel release automation (CI/CD orchestration)
* Telemetry or install analytics per channel
* Rollback strategies per channel
* Beta / preview channel coexistence with stable
* Sub-version channel (a separate `@fabric/cli-canary` for unstable, etc.)

### Consequences

* Good, because Fabric meets users in the package manager / IDE / agent tool they already use
* Good, because each channel leverages its native install / update UX, requiring no Fabric-specific learning
* Good, because the equivalence rule ensures users get the same Fabric regardless of how they installed
* Good, because the `core` kit (per ADR-0030) carries the VS Code extension and GitHub provider implementation, so all channels deliver the full surface set
* Good, because per-channel update mechanisms scale naturally — Fabric does not invent its own update infrastructure
* Bad, because publishing to multiple channels is ongoing release-engineering work that must be sustained
* Bad, because cross-channel duplicate installs need warning-detection logic that has edge cases (custom PATH, non-default install locations)
* Bad, because version sync across channels has built-in lag; users may briefly see different versions on different channels
* Bad, because Node prereq handling differs per channel and creates per-channel installer complexity (especially VS Code Marketplace where bundling Node may eventually be needed)

### Confirmation

Confirmed when:

* Fabric is installable via npm / pnpm (`pnpm add -g @fabric/cli` or equivalent), Homebrew (`brew install fabric`), and VS Code Marketplace (search for "Fabric" → install) at MVP
* Each MVP channel produces an equivalent install: same Fabric version, same `core` kit (including VS Code extension per ADR-0021 / ADR-0030 and GitHub provider per ADR-0023's commitment), same CLI / REST / Web UI surfaces
* Node 16+ is the universal prerequisite; each channel handles the prereq through its own mechanism (declare as dep, leverage existing, or ensure via installer)
* Cross-channel duplicate-install detection emits a warning at install time; `fabric --version` reports the detected install channel
* Per-channel update is the canonical update path; Fabric does not ship a unified `fabric update` command (a `fabric upgrade` dispatcher is optional follow-on)
* Each channel publishes from the same source git tag; minor cross-channel publish lag is acceptable
* Follow-on channels (Scoop, Claude Code / Codex marketplace, container images, self-contained binary) are documented as roadmap, not blocking

## Pros and Cons of the Options

### Option 1: Single Channel Only

Fabric distributed via npm only; users on other platforms install Node + npm first.

* Good, because release engineering is simple — one publish per release
* Good, because there is no cross-channel coordination concern
* Bad, because adoption is limited — macOS users want brew, Windows users want scoop
* Bad, because IDE-first and agent-tool-first users have a worse experience
* Bad, because non-developers (or developers without npm muscle memory) may not adopt

### Option 2: Multi-Channel with Self-Contained Binary

Fabric ships as a single executable with bundled Node runtime; each channel distributes the same binary.

* Good, because there is no Node prereq for end users
* Good, because air-gapped scenarios work without external dependency resolution
* Bad, because binary size grows significantly (Node runtime adds tens of megabytes)
* Bad, because native module compatibility is fragile (some Node-native packages do not bundle cleanly)
* Bad, because Fabric's per-kit pnpm story (per ADR-0028) becomes awkward — bundling Node but still relying on pnpm via Corepack inside the bundle is double-Node
* Bad, because iteration speed slows — Node version bumps require a full rebundle and republish

### Option 3: Multi-Channel with Node Prereq and Equivalent Outcomes

Multiple distribution channels (npm/pnpm, Homebrew, Scoop, VS Code Marketplace, Claude Code / Codex marketplace), each handling Node prereq through its own mechanism, all producing equivalent installs.

* Good, because Fabric meets users in their familiar channels
* Good, because each channel leverages its native install / update UX
* Good, because Node prereq is consistent with ADR-0004 / ADR-0028
* Good, because the equivalence rule keeps Fabric's behavior consistent regardless of install path
* Bad, because release engineering must sustain multi-channel publishing
* Bad, because cross-channel duplicate-install detection has edge cases
* Bad, because per-channel Node prereq handling adds complexity to each installer

## More Information

The MVP channel order — npm/pnpm first, then Homebrew, then VS Code Marketplace — reflects implementation priority and infrastructure availability. Each channel becomes available as its publishing automation reaches readiness.

The follow-on channel order is suggestive, not committed. Scoop is most likely added when Windows-only adopters become a priority. Claude Code / Codex marketplace is added when those tools' integration story stabilizes (their marketplace formats and one-click install UX have to mature). Container images come for CI/CD use cases. Self-contained binary is a long-tail option for air-gapped or non-developer environments.

The exact npm package name (`@fabric/cli`, `cyber-fabric`, `fabric-cli`, etc.), the exact Homebrew tap or formula location (homebrew-core vs own tap), the Scoop bucket location (scoop-bucket vs own bucket), the VS Code Marketplace publisher ID, and the agent-tool marketplace identifiers are intentionally left to follow-on design.

The cross-channel duplicate-install detection's exact heuristics (PATH scanning, channel-specific install location checks, fingerprint comparison) and the `fabric --version` output format showing the install channel are intentionally left to follow-on design.

This decision composes with several existing ADRs:

* **ADR-0001** / **ADR-0002** (unified operational model + shared core) — every channel installs the same core, same surfaces
* **ADR-0003** (host-native plugins and adapters) — Claude Code / Codex marketplace channel uses the host-adapter pattern
* **ADR-0004** (TypeScript primary language) — Node baseline established here propagates to all channels
* **ADR-0006** (kit packaging + central registration) — installs deliver the central registration tool which then handles kit installs from marketplaces
* **ADR-0017** (scripts) — installed Fabric runs kit scripts per the same model regardless of install channel
* **ADR-0018** (Web UI on frontx) — VS Code Marketplace channel install delivers the Web UI capabilities
* **ADR-0020** (REST API) — installed Fabric exposes REST API per ADR-0020 regardless of channel
* **ADR-0021** (VS Code extension) — VS Code Marketplace channel installs the extension; the extension is shipped through the `core` kit per ADR-0030
* **ADR-0023** (git provider abstraction) — installed Fabric ships GitHub provider via `core` kit's `core:github.<name>` sub-namespace per ADR-0030
* **ADR-0028** (per-kit dependency isolation) — Node + Corepack + pnpm baseline established here is the prereq across all channels
* **ADR-0030** (`core` kit) — every channel delivers the same `core` kit content

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-distribution-multi-channel`, `cpt-cyber-fabric-fr-distribution-channel-equivalence`, `cpt-cyber-fabric-fr-distribution-channel-native-update`, `cpt-cyber-fabric-nfr-cross-channel-equivalence`, `cpt-cyber-fabric-usecase-install-fabric`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0003](0003-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0004](0004-cpt-cyber-fabric-adr-typescript-primary-language-v1.md), [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0020](0020-cpt-cyber-fabric-adr-rest-api-as-fabric-surface-v1.md), [ADR-0021](0021-cpt-cyber-fabric-adr-vscode-plugin-fabric-host-adapter-v1.md), [ADR-0023](0023-cpt-cyber-fabric-adr-git-provider-abstraction-with-github-default-v1.md), [ADR-0028](0028-cpt-cyber-fabric-adr-per-kit-dependency-isolation-and-script-sandbox-v1.md), [ADR-0030](0030-cpt-cyber-fabric-adr-core-bundled-kit-core-v1.md)

This decision directly addresses the following traceability items:

* Fabric must be installable via multiple channels (npm/pnpm, Homebrew, VS Code Marketplace at MVP; Scoop, Claude Code / Codex marketplace, container images, self-contained binary as follow-on)
* every channel produces an equivalent install — same Fabric version, same `core` kit, same CLI / REST / Web UI surfaces
* Node 16+ is the universal hard prerequisite; each channel handles the prereq through its own mechanism
* cross-channel duplicate-install detection is warning-only; `fabric --version` reports install channel
* per-channel update uses the channel's native mechanism; Fabric does not ship a unified `fabric update` command (a `fabric upgrade` dispatcher is optional follow-on)
* every channel publishes from the same source git tag; minor publish lag is acceptable
* the `core` kit (per ADR-0030, including VS Code extension per ADR-0021 and GitHub provider per ADR-0023's commitment) is delivered by every channel
