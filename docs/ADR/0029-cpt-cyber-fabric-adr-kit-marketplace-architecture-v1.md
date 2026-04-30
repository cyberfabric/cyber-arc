---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0029: Kit Marketplace Architecture: Git-Repo-Backed Kit Registries with Multi-Marketplace, Provider-Agnostic Distribution, and PR-Gated Versioned Publication

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Custom Website or Registry Service](#option-1-custom-website-or-registry-service)
  - [Option 2: Manifest Without Versions, Lazy Git Tag Discovery](#option-2-manifest-without-versions-lazy-git-tag-discovery)
  - [Option 3: Git-Repo-Backed Marketplaces with PR-Gated Versioned Manifest and Hash Validation](#option-3-git-repo-backed-marketplaces-with-pr-gated-versioned-manifest-and-hash-validation)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-kit-marketplace-architecture`

## Context and Problem Statement

Cyber Fabric kits are packaged (per ADR-0006) and registered at three scopes (per ADR-0008) — core-bundled, global, workspace. The platform now needs a **discovery and distribution mechanism** so users can find kits, install them, and stay current. Without one, kit adoption depends on out-of-band documentation, manual git URL sharing, and ad hoc trust decisions per kit.

The platform must also avoid building or operating a custom registry service or marketplace website. Discovery and metadata should live on git providers users already use (per ADR-0023). And because kits ship runnable code (scripts per ADR-0017, web extensions per ADR-0018, dev tool plugins per ADR-0019), the distribution mechanism is a **supply chain** that needs supply-chain-grade integrity guarantees: the kit content a user installs must be exactly what was reviewed and approved.

A naive "manifest plus git tag discovery" model fails the supply-chain test — an author could register a kit in one state, then later push malicious content to the same tag (or a new tag matching the version pattern), and users would silently install the malicious version. The platform therefore needs **versioned manifests with commit and content hash pinning**, **PR-gated review**, and **client-side verification** at install time.

The platform must also accommodate realistic distribution shapes: a single kit in its own repo, a collection of kits in one repo (monorepo), local development marketplaces (no git, just a directory on disk), and company-internal marketplaces on private git providers. Authors without write access to a marketplace repo must still be able to publish through the standard fork-and-PR flow (per ADR-0023).

## Decision Drivers

* **No custom website or registry service** — discovery and metadata must live on existing git providers users already use
* **Provider-agnostic** — marketplace must work on GitHub, GitLab, Bitbucket, Gitea, Forgejo, and self-hosted providers, plus local filesystem paths
* **Multi-marketplace** — one official curated marketplace plus arbitrary user-added marketplaces (community, company-internal, local development)
* **Supply-chain integrity** — kit content installed must match exactly what was reviewed; tampering must be detectable
* **PR-gated versioned publication** — every version requires a PR with review, so authors cannot silently change what users install
* **Reusable kit publish flow** — same internals for remote (PR) and local (direct write) targets; fork-and-PR for authors without write access
* **Multi-kit repos** — a single repo should be allowed to ship multiple kits and optionally act as its own marketplace
* **Easy publication, especially for OSS** — `fabric kit publish` automates the manifest entry, PR creation, and (when needed) fork creation
* **Local marketplaces** — filesystem path registration for development, private experimentation, or one-machine workflows; with TOFU integrity protection because no git history exists

## Considered Options

1. **Custom Website or Registry Service** — Fabric runs (or contracts) a centralized registry service like npm or PyPI; authors `fabric kit publish` to that service via API
2. **Manifest Without Versions, Lazy Git Tag Discovery** — marketplace manifest just lists `(kit, git_url)`; Fabric uses `git ls-remote --tags` to discover available versions; no PR per release
3. **Git-Repo-Backed Marketplaces with PR-Gated Versioned Manifest and Hash Validation** — marketplaces are git repositories (or local filesystem paths) holding versioned manifest entries with pinned commit and content hash per version; new versions require PR review with CI hash validation

## Decision Outcome

Chosen option: **Option 3 — Git-Repo-Backed Marketplaces with PR-Gated Versioned Manifest and Hash Validation**, because Cyber Fabric needs supply-chain-grade integrity for kit distribution without operating a custom registry service. Build everything on top of the git providers users already use; require explicit per-version review through PRs; pin each version to a commit hash and content hash; validate at install time.

The decision has these parts:

### 1. Marketplace shape and registration

A **marketplace** is either:

* A **git repository** containing a `manifest.yaml` file at its root, OR
* A **local filesystem directory** containing a `manifest.yaml` file at its root

Marketplaces are registered locally at:

* `~/.fabric/marketplaces/<local-name>/` — user-global marketplaces (visible across all the user's projects)
* `<repo>/.fabric/marketplaces/<local-name>/` — workspace-scoped marketplaces (project-private)

For a **git-URL marketplace**, Fabric clones the repo into the registration path. For a **local-path marketplace**, the registration path is the marketplace base directly (or a symlink). The marketplace base always contains `manifest.yaml` at its root.

A repo can serve as both a kit-collection and a marketplace simultaneously by including both `.fabric/kits/<kit-name>/` directories (kit content) and a `manifest.yaml` (marketplace registry that lists those kits in `local` mode plus optionally external kits in `url` mode).

### 2. Manifest schema (YAML)

`manifest.yaml` lists kits and their versions:

```yaml
- id: prd-kit
  name: PRD Kit
  description: PRD authoring + brainstorming
  maintainers:
    - github: username
  homepage: https://example.com/prd-kit
  license: MIT
  categories: [docs, planning]
  versions:
    - version: "1.0.0"
      mode: url
      git_url: https://github.com/owner/prd-kit
      commit: "abc1234567890abcdef1234567890abcdef123456"
      sha256: "deadbeef..."
      released: "2026-04-29"
    - version: "1.1.0"
      mode: local
      commit: "def5678901234567890abcdef5678901234567890"
      sha256: "cafebabe..."
      released: "2026-05-15"
```

Per-version fields:

* `mode: url` — kit lives in an external git repo identified by `git_url`; `commit` is the commit in that repo; `sha256` is SHA-256 of `git archive <commit>` tarball
* `mode: local` — kit lives in this same marketplace repo at `.fabric/kits/<kit-id>/` (path is by convention; not specified in the entry); `commit` is the marketplace repo's commit at which the kit content was registered; `sha256` is SHA-256 of `git archive <commit> -- .fabric/kits/<kit-id>` tarball
* `commit` is always full git SHA (no abbreviations)
* `released` is ISO-8601 date string

Old versions accumulate — they are never removed from the manifest, so users on old versions can continue to install and verify.

### 3. Path convention (uniform across all bases)

In any base directory (user home, project root, marketplace repo, kit-collection repo):

* `<base>/.fabric/marketplaces/<name>/manifest.yaml` — marketplace registry
* `<base>/.fabric/kits/<kit-name>/` — kit content

Both can coexist in the same base. A repo can be a kit collection (just `.fabric/kits/...`), a marketplace (just `.fabric/marketplaces/...`), or both (kit collection that also lists itself as a marketplace).

### 4. Versioned `fabric kit publish` flow

```bash
# Remote target — creates PR (or fork + PR for authors without write access):
fabric kit publish <git-url-of-marketplace>

# Local target — writes the entry directly:
fabric kit publish --local <marketplace-name>
```

Reusable internals (run for both modes):

1. Inspect current kit (read its `kit.yaml` for id, name, description, maintainers; read git origin URL and HEAD; compute SHA-256 of `git archive HEAD` tarball)
2. Generate the manifest entry — `mode: url` for remote target with the kit's external `git_url`; `mode: local` for `--local` target
3. **Apply** the entry — this is the part that differs:

**Remote target** (positional `<git-url>`):

* Clone the marketplace repo locally (cached)
* Determine write access via the git provider (per ADR-0023):
  * If the user has write access to the marketplace repo → branch + commit (adds the new version entry to `manifest.yaml`) + push + open PR
  * If the user has no write access → fork the marketplace repo through the git provider's fork API (per ADR-0023) → branch on the fork + commit + push to fork → open cross-fork PR

**Local target** (`--local <marketplace-name>`):

* Edit `~/.fabric/marketplaces/<marketplace-name>/manifest.yaml` (or workspace path) directly with the new version entry
* No commit, no push, no PR
* Surface a warning that local marketplaces have no review chain

Credentials for git provider operations come from secret storage (per ADR-0027); login flow via `fabric login git <provider>`.

### 5. Versioned `fabric kit install` flow

```bash
fabric kit install <kit-id>[@<version>] [--marketplace <name>]
fabric kit install <git-url>   # direct install from arbitrary git URL with explicit warning
```

For marketplace-resolved install:

1. Look up `<kit-id>@<version>` in the configured marketplaces (or the explicitly named one) → get `mode`, `commit`, `sha256`, plus `git_url` if `mode: url`
2. **URL mode**: `git clone --depth 1 <git_url>`, `git fetch <commit>`, `git checkout <commit>`. Compute SHA-256 of `git archive <commit>` tarball. Verify match.
3. **Local mode**: marketplace repo is already locally cloned. Use `git -C <clone> archive <commit> -- .fabric/kits/<kit-id>/` to extract just the kit subtree at the recorded commit (no working-tree mutation). Compute SHA-256, verify match.
4. On hash match → unpack to install location → `pnpm install` per ADR-0028 → register per ADR-0011 / ADR-0008.
5. On hash mismatch → abort with explicit error; do not install.

For direct-URL install: prompt for explicit user confirmation (the source is not listed in any configured marketplace). Hash validation does not apply because there is no manifest entry to compare against; the user accepts trust on the URL alone.

### 6. Marketplace CI (recommended for git-tracked marketplaces)

Marketplace repositories should run CI on PRs:

1. Parse PR for new or modified version entries
2. For each new entry, perform the same `git archive` + SHA-256 computation Fabric does at install time
3. Verify computed SHA-256 matches the entry's `sha256` field
4. Validate kit name and version format against the safety regex
5. Block merge if any check fails

CI is a recommended convention for the official marketplace and any other quality-conscious marketplace; unofficial marketplaces may opt to skip it. Client-side hash validation always applies regardless of marketplace CI.

### 7. Defense in depth: client-side validation always runs

Even when marketplace CI passes and a maintainer reviews and merges the PR, Fabric's client-side hash validation at install time is the final gate. If anything in the chain (git provider compromise, marketplace repo tampering, transport-level man-in-the-middle) attempts to deliver content that does not match the manifest's recorded hash, the install fails.

### 8. TOFU manifest hash for local-path marketplaces

Local-path marketplaces (registered as filesystem path, not git) lack commit history, so an attacker with write access to the marketplace directory could modify `manifest.yaml` at any time between registration and install. Fabric mitigates this with **trust-on-first-use manifest hashing**:

* At `fabric marketplace add <name> <local-path>` (local-path mode), Fabric records the SHA-256 of `manifest.yaml` content
* On every subsequent read, Fabric recomputes the manifest hash and compares to the recorded value
* If the hash differs, Fabric prompts: "manifest changed since registration; review changes before continuing", with a `diff` view of recorded-vs-current state
* User must explicitly accept the new state, which updates the recorded hash

Local-path marketplaces are also marked `unverified` in `fabric marketplace list` output as a UX cue that their review chain is weaker than git-tracked marketplaces.

### 9. Safety validations

* **Kit name regex**: `^[a-z][a-z0-9_-]*$` enforced both client-side at install and in marketplace CI
* **Symlink escape rejection**: when computing SHA-256 in local mode, if symlinks resolve outside the marketplace base, abort with error
* **Version format validation**: SemVer-pattern validation in marketplace CI
* **Hash validation precedence**: client-side hash check always runs and always blocks install on mismatch; this overrides any other trust signal

### 10. Kit-to-kit dependencies

A kit version may declare **dependencies** on other kits — explicit triples of `(marketplace, kit, version)`. Dependencies are added as a `dependencies` array within a version entry of the kit's manifest:

```yaml
versions:
  - version: "1.1.0"
    mode: url
    git_url: https://github.com/owner/my-kit
    commit: "abc123..."
    sha256: "..."
    dependencies:
      - marketplace: official
        kit: prd-kit
        version: "2.0.0"
      - marketplace: https://github.com/example/community-marketplace
        kit: shared-prompts
        version: "1.5.0"
```

The `marketplace` field accepts:

* `official` — the well-known official marketplace whose URL is pinned in Fabric core
* A git URL — a fully-qualified marketplace URL (stable identifier across users and machines)
* Local-path marketplaces are **not allowed** as transitive dependency targets because their identity is per-user; distributable kits with declared dependencies must reference git-tracked marketplaces only

The `version` field requires an **exact version string** matching the target kit's published version — no ranges, no semver wildcards. This keeps reproducibility tight: the same kit version installed on any machine resolves to exactly the same dependency set.

**Transitive install**: `fabric kit install <kit>@<version>` first resolves the dependency graph and installs dependencies depth-first, then installs the requested kit. Each kit in the install graph is reused if already installed at the correct version; if installed at a different version, Fabric aborts with a conflict report (no automatic version change of an installed kit).

**Direct vs dependency install marking**: every installed kit is recorded in the local kit registry with an `installed_as` field set to either `direct` or `dependency`. The requested kit (the one explicitly passed to `fabric kit install`) is marked `direct`; kits installed transitively as part of resolving its dependency graph are marked `dependency`. If a `dependency`-marked kit is later installed explicitly via `fabric kit install`, its marking flips to `direct` and it is no longer treated as a transitive-only install.

**Uninstall flow with orphan handling**: `fabric kit uninstall <kit>` removes the kit. Fabric then computes the set of kits that (a) were installed as `dependency`, AND (b) are no longer referenced by any other still-installed kit's `dependencies`. These are dangling dependency installs. Fabric prompts: `removing <kit> orphans these dependencies: <list>. Also remove them? [Y/n]`. Users may confirm to remove all, decline, or selectively keep some.

Out of scope of this ADR (added to the existing follow-on list): version range support for dependencies (semver `^1.0.0`, `>=1.5 <2.0` — current model is exact pinning), conflict resolution policies when a kit graph requires two different versions of the same kit, optional dependencies (declared but not auto-installed), dev / test dependency separation, and auto-upgrade dependency versions on `fabric kit update`.

### Out of scope (follow-on)

* Yanked or withdrawn versions semantics (likely a `withdrawn: true` field with an optional reason)
* Manifest schema versioning for evolution
* Cross-marketplace deduplication or federation
* Kit signing, sigstore / cosign / SLSA provenance integration
* Mirror integrity and signed marketplaces
* Vulnerability disclosure format (GHSA-style)
* Trusted-author auto-merge for high-volume contributors
* Discovery aggregation (search across all configured marketplaces with weighting)
* Cloud Fabric marketplace federation
* Partial-version installs or version range resolution beyond exact pinning
* Sandboxing of `pnpm install` lifecycle scripts during kit install (ADR-0028's process sandbox covers `fabric script run`, not the install step)

### Consequences

* Good, because the platform gets a discovery and distribution mechanism without operating a custom registry service
* Good, because every kit version is reviewed by a marketplace maintainer through a standard PR flow
* Good, because the layered trust chain (author → CI → maintainer → client) gives supply-chain-grade integrity
* Good, because URL and local modes share most logic; multi-kit repos and monorepo-with-marketplace shapes work without special cases
* Good, because local-path marketplaces unlock fast development and private workflows without compromising integrity (TOFU protection)
* Good, because authors without write access to a marketplace can still publish through fork-and-PR
* Good, because client-side hash validation makes a compromised marketplace or git provider detectable at install time
* Bad, because every kit version requires a PR — high-volume releases incur review latency
* Bad, because the marketplace CI design is recommended but not enforced for unofficial marketplaces, so trust quality varies across marketplaces
* Bad, because the manifest schema becomes a stability surface that future versions must support (or migrate)
* Bad, because the official marketplace's curation policy is a meta-decision that affects ecosystem perception
* Bad, because local-path marketplaces have a weaker trust story even with TOFU; users must understand that distinction

### Confirmation

Confirmed when:

* a marketplace can be registered as either a git URL (cloned) or a local filesystem path (read directly), at user-global or workspace scope
* marketplace base contains a single `manifest.yaml` at root listing kits and their versions
* per-version fields include `mode` (`url` or `local`), `commit`, `sha256`, plus `git_url` for URL mode
* `fabric kit publish <git-url>` creates a PR (or fork + PR if no write access) via ADR-0023; `fabric kit publish --local <name>` writes the entry directly with a no-review-chain warning
* `fabric kit install` validates client-side SHA-256 against the manifest entry on every install; mismatch blocks install
* marketplace CI is documented as a recommended convention, performing the same hash verification on PRs
* local-path marketplaces use TOFU manifest hashing — registered hash recorded at `marketplace add`, prompted on change
* kit name regex `^[a-z][a-z0-9_-]*$` is enforced both client-side and in marketplace CI
* the unified path convention `.fabric/marketplaces/<name>/manifest.yaml` and `.fabric/kits/<kit-name>/` is uniform across user-home, project, marketplace repo, and kit-collection repo

## Pros and Cons of the Options

### Option 1: Custom Website or Registry Service

Fabric runs (or contracts) a centralized registry service with its own API, web UI, and storage; authors `fabric kit publish` to that service via API.

* Good, because discovery and search can be richer than what git provides natively
* Good, because rate limiting, abuse handling, and quotas are centralized
* Bad, because the platform must operate or contract a service — direct opposite of the "no special site" constraint
* Bad, because it creates a single point of failure or control unfriendly to OSS and self-hosted use cases
* Bad, because non-cloud or air-gapped users get a worse experience or are locked out

### Option 2: Manifest Without Versions, Lazy Git Tag Discovery

Marketplace manifest just lists `(kit, git_url)`; Fabric uses `git ls-remote --tags` to discover available versions; no PR per release.

* Good, because authors can release new versions just by tagging their repo (no marketplace PR overhead per release)
* Good, because the marketplace manifest is small and rarely updated
* Bad, because there is no PR review of the actual content of each version — author can register a kit in one state and later push malware to the tagged commit (or a new tag matching the version pattern)
* Bad, because there is no commit + content hash pinning, so tampering is silent
* Bad, because a force-push or tag move on the kit's repo invalidates anything users may have already verified
* Bad, because the trust model for OSS distribution is weaker than what existing ecosystems (Homebrew, Cargo, NixOS) provide

### Option 3: Git-Repo-Backed Marketplaces with PR-Gated Versioned Manifest and Hash Validation

Marketplaces are git repositories or local filesystem paths holding versioned manifest entries with pinned commit and content hash per version; new versions require PR review with CI hash validation.

* Good, because the trust chain is supply-chain-grade (author → CI → maintainer → client)
* Good, because client-side hash validation makes any tampering downstream detectable
* Good, because both URL-mode (external repos) and local-mode (in-marketplace) kits work with the same model
* Good, because multi-kit repos and monorepo-with-marketplace shapes work naturally
* Good, because authors without write access to a marketplace can publish through fork-and-PR
* Good, because no custom service is operated — everything lives on existing git providers
* Bad, because every release requires a marketplace PR (review latency)
* Bad, because marketplace CI is recommended but not enforced for unofficial marketplaces
* Bad, because the manifest schema becomes a stability surface
* Bad, because local-path marketplaces have a weaker trust story (mitigated by TOFU)

## More Information

The official marketplace URL is pinned in Fabric core — its address is built into the binary, and the marketplace is enabled by default. Users can disable it (`fabric marketplace remove official`) if they wish, and add their own marketplaces in any combination.

The official marketplace is **curated tightly** — it lists only kits that the Fabric maintainers consider broadly applicable and high quality. Curation is policy, not code: anyone can fork the official marketplace and run their own less-restrictive version, and other community marketplaces can flourish in parallel. This avoids the platform's curation policy becoming a bottleneck.

The exact YAML schema for `manifest.yaml`, the fields of `kit.yaml` (a kit's own manifest read by `fabric kit publish`), the fork-and-PR UX for authors without write access, the format and diff display of TOFU manifest hash mismatches, and the wording of CI failure messages are intentionally left to follow-on design.

This decision composes with several existing ADRs:

* **ADR-0006** (kit packaging) — kits are packaged according to ADR-0006 conventions; the marketplace just indexes them
* **ADR-0008** (kit scopes) — installed kits land at the appropriate scope after marketplace-resolved install
* **ADR-0011** (workspace concept) — workspace-scoped marketplaces are registered through the workspace's `.fabric/marketplaces/` directory
* **ADR-0017** (scripts as kit resources) — scripts in installed kits become available through `fabric script` after install
* **ADR-0023** (git provider abstraction) — provider operations (PR creation, fork creation, write-access detection) go through the abstraction; works on GitHub via Octokit and on other providers via their kits
* **ADR-0027** (secret storage and `fabric login`) — credentials for marketplace push, fork, and PR creation come from secret storage; `fabric login git <provider>` populates them
* **ADR-0028** (per-kit dependency isolation) — installed kits' dependencies are managed by pnpm via Corepack; install-script sandboxing during kit install is a known follow-on concern (ADR-0028's process sandbox covers `fabric script run`, not the install step)

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-marketplace-cross-surface`, `cpt-cyber-fabric-fr-multiple-marketplaces`, `cpt-cyber-fabric-fr-kit-publication-pr-gated`, `cpt-cyber-fabric-nfr-security-kit-secret-scan`, `cpt-cyber-fabric-usecase-dev-install-from-marketplace`, `cpt-cyber-fabric-usecase-pe-publish-kit`, `cpt-cyber-fabric-usecase-pe-distribute-kit`
- **Related decisions**: [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0023](0023-cpt-cyber-fabric-adr-git-provider-abstraction-with-github-default-v1.md), [ADR-0027](0027-cpt-cyber-fabric-adr-secret-storage-and-fabric-login-v1.md), [ADR-0028](0028-cpt-cyber-fabric-adr-per-kit-dependency-isolation-and-script-sandbox-v1.md)

This decision directly addresses the following traceability items:

* a marketplace can be a git repository or a local filesystem path
* multiple marketplaces are supported (one official, plus arbitrary user-added)
* marketplaces are provider-agnostic — work on any git provider, no custom registry service
* per-version manifest entries pin a commit and a content SHA-256 hash for supply-chain integrity
* publication is PR-gated; `fabric kit publish <git-url>` creates a PR (or fork + PR for authors without write access) via ADR-0023
* `fabric kit publish --local <name>` writes the entry directly with explicit no-review-chain warning
* `fabric kit install` performs client-side hash verification on every install; mismatch blocks install
* TOFU manifest hashing protects local-path marketplaces against tampering between registration and install
* marketplace CI is a recommended convention performing the same hash verification at PR time
* unified path convention `.fabric/marketplaces/<name>/manifest.yaml` and `.fabric/kits/<kit-name>/` works uniformly across all base directories
* multi-kit repos and monorepo-with-marketplace shapes are supported
* kit name regex `^[a-z][a-z0-9_-]*$` is enforced for safety
