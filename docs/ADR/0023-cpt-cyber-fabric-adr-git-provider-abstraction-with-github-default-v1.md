---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0023: Git Provider Abstraction with GitHub as the Default Provider

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: GitHub-Only Implementation](#option-1-github-only-implementation)
  - [Option 2: Provider Abstraction with All Providers Core-Bundled](#option-2-provider-abstraction-with-all-providers-core-bundled)
  - [Option 3: Provider Abstraction with GitHub Default Plus Others as Kits](#option-3-provider-abstraction-with-github-default-plus-others-as-kits)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-git-provider-abstraction-with-github-default`

## Context and Problem Statement

Branches (ADR-0013), worktrees (ADR-0014), and commits (ADR-0022) are universal git concepts that work the same way across providers. **Pull requests** (and their provider-specific equivalents — GitLab merge requests, Bitbucket pull requests, Gerrit changes, Forgejo / Gitea PRs, etc.) are not. Each provider has its own data model, its own API, its own auth, and its own terminology. If Fabric hard-codes GitHub semantics, the platform locks out every team that uses something else. If Fabric ships every provider as a core dependency, the core bloats with code that most users never touch.

The platform therefore needs a **provider-agnostic interface** for the operations that vary by provider — pull requests, reviews, comments, releases — with **GitHub as the default** provider shipped as a core-bundled kit (per ADR-0008's core scope), and **other providers** added as workspace- or global-scoped kits implementing the same interface.

## Decision Drivers

* **Provider-agnostic operations** — pull requests, reviews, comments, and releases must have a common interface that does not bake in any single provider's vocabulary
* **Default provider** — GitHub is the most common provider in Fabric's target user base and ships as the core-bundled default
* **Extensibility via kits** — other providers (GitLab, Bitbucket, Gerrit, Gitea, Forgejo, etc.) are added as kits per ADR-0008, not by amending the core
* **Official SDK for GitHub** — the GitHub provider implementation uses the official GitHub TypeScript SDK (`@octokit/rest` and `@octokit/graphql`) maintained by GitHub themselves
* **Per-repo provider selection** — within a workspace, different repositories may use different providers; selection is determined by remote URL pattern matching with explicit configuration as override
* **Bounded contract** — the initial contract scope covers pull requests, reviews, comments, and releases (minimum); issues are out of scope but extensible
* **Composability with PRs** — the pull request first-class concept (ADR-0024) consumes this abstraction; both must share one model

## Considered Options

1. **GitHub-Only Implementation** — Fabric supports only GitHub for pull-request-style operations
2. **Provider Abstraction with All Providers Core-Bundled** — Fabric defines an abstraction and ships GitHub, GitLab, Bitbucket, etc. all in the core
3. **Provider Abstraction with GitHub Default Plus Others as Kits** — Fabric defines the abstraction in core, ships GitHub as a core-bundled kit, and other providers come as workspace- or global-scoped kits

## Decision Outcome

Chosen option: **Option 3 — Provider Abstraction with GitHub Default Plus Others as Kits**, because Cyber Fabric needs both a stable provider-agnostic contract and an extensibility model that does not force every provider into the core. The kit packaging model (ADR-0006) and kit scopes (ADR-0008) already provide the right machinery; provider implementations are a natural application.

The decision has these parts:

1. **Provider-agnostic interface in Fabric core.** The contract covers pull requests / merge requests, reviews, comments, and releases at minimum. The interface uses generic terminology (e.g. "pull request" as the abstraction name, with provider-specific mappings inside the implementation: GitHub PR, GitLab MR, Bitbucket PR, Gerrit change set).

2. **GitHub provider implementation within the `core` kit.** GitHub is the default provider, with its implementation living inside the `core` core-bundled kit (per ADR-0030) under the `core:github.<name>` sub-namespace, rather than as a separate kit. Its version moves with the Fabric tool's release; users get GitHub support out of the box without installing additional kits.

3. **GitHub provider implementation uses the official GitHub TypeScript SDK** — `@octokit/rest` for REST API operations (the most common case) and `@octokit/graphql` for queries that benefit from batched retrieval (for example fetching a PR with all its reviews and comments in one round trip). Octokit is the official GitHub SDK, written and maintained by GitHub themselves; it is the de facto standard with TypeScript types.

4. **Other providers as kits.** GitLab, Bitbucket, Gerrit, Gitea, Forgejo, and any future provider are workspace- or global-scoped kits that implement the same provider-agnostic interface. New providers are added by writing a kit, not by patching Fabric core.

5. **Per-repo provider selection.** A workspace may have multiple repositories using different providers. The provider for a given repository is determined by:
   * Remote URL pattern matching (e.g. `github.com` → GitHub provider, `gitlab.com` → GitLab provider when installed)
   * Explicit configuration override (workspace storage per ADR-0015) when a repo's remote URL does not match a known pattern (e.g. self-hosted GitLab)

6. **Initial contract scope** — pull requests / merge requests, reviews, comments, releases (minimum). **Issues are out of scope of this ADR**; providers may expose them as an optional capability that other ADRs can later promote to the core contract if it proves universally useful.

7. **Authentication, webhooks, and provider-specific advanced features** — webhooks, GitHub Apps, OAuth flows, fine-grained permissions, and per-provider advanced surfaces are out of scope. Each provider kit decides how to authenticate; the core contract only knows that operations succeed or fail with structured errors.

### Consequences

* Good, because Fabric supports more than one git provider through one consistent contract
* Good, because new providers are kits, not core changes — the kit ecosystem grows naturally
* Good, because GitHub support out of the box uses the official SDK from GitHub themselves
* Good, because per-repo provider selection handles the realistic multi-provider workspace
* Good, because the abstraction is the foundation that ADR-0024 (pull requests) consumes
* Good, because the contract is bounded (PRs, reviews, comments, releases) and extensible — issues and other capabilities can be added later without breaking existing implementations
* Bad, because the contract design must be expressive enough to cover real provider differences without forcing the lowest common denominator
* Bad, because each provider kit is responsible for its own authentication; users adopting a new provider face a per-provider auth setup
* Bad, because per-repo provider selection edge cases (multiple matching patterns, self-hosted instances, mirroring) need explicit resolution rules

### Confirmation

Confirmed when:

* Fabric core defines a provider-agnostic interface covering pull requests, reviews, comments, and releases
* GitHub is the default provider, shipped as a core-bundled kit per ADR-0008
* the GitHub provider implementation uses `@octokit/rest` and `@octokit/graphql` — the official GitHub TypeScript SDK
* other providers (GitLab, Bitbucket, etc.) can be installed as kits implementing the same interface
* per-repo provider selection works through remote URL pattern matching with explicit configuration override
* issues, webhooks, GitHub Apps, OAuth flows, and fine-grained permissions are out of scope of the core contract; providers may expose them as optional capabilities

## Pros and Cons of the Options

### Option 1: GitHub-Only Implementation

Fabric supports only GitHub for pull-request-style operations.

* Good, because the implementation is simpler initially
* Good, because the official Octokit SDK covers everything GitHub-specific
* Bad, because non-GitHub users are locked out
* Bad, because the platform cannot grow into the rest of the git provider ecosystem

### Option 2: Provider Abstraction with All Providers Core-Bundled

Fabric defines an abstraction and ships GitHub, GitLab, Bitbucket, etc. all in the core.

* Good, because every supported provider works out of the box
* Bad, because Fabric core bloats with provider-specific code
* Bad, because every new provider requires core changes
* Bad, because users pay the disk and dependency cost of providers they never use

### Option 3: Provider Abstraction with GitHub Default Plus Others as Kits

Fabric defines the abstraction in core, ships GitHub as a core-bundled kit, others come as kits.

* Good, because GitHub works out of the box (the common case)
* Good, because non-GitHub users install one kit to add their provider
* Good, because the kit packaging model (ADR-0006) handles distribution naturally
* Good, because new providers are additive — no core changes
* Bad, because the abstraction contract design must accommodate real provider differences carefully
* Bad, because per-provider auth setup and per-repo provider selection are real concerns

## More Information

The contract initially covers:

* **Pull requests / merge requests / changes** — list, info, create, update (description, title, draft state)
* **Reviews** — submit (approve / request-changes / comment), list
* **Comments** — list, create (general, file, file+line)
* **Releases** — list, info, create

The exact interface signatures, the authentication model per provider, the per-repo provider-selection rules (URL pattern grammar, conflict resolution, self-hosted instance handling), the relationship between provider kits and the storage / assets primitives (ADR-0015 / ADR-0016), the upgrade path when the contract evolves, and the precise mapping between provider-specific concepts (GitHub PR draft state, GitLab approval rules, Bitbucket reviewer groups, etc.) and the abstract contract are intentionally left to follow-on design.

The pull request first-class concept (ADR-0024) consumes this abstraction directly. New first-class concepts (a future "issues as first-class" decision, for example) would extend the contract.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-pr-provider-agnostic`, `cpt-cyber-fabric-contract-git-provider`, `cpt-cyber-fabric-fr-pr-first-class`, `cpt-cyber-fabric-usecase-manage-pull-request`
- **Related decisions**: [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0013](0013-cpt-cyber-fabric-adr-branches-as-first-class-concept-v1.md), [ADR-0014](0014-cpt-cyber-fabric-adr-worktrees-as-first-class-with-hybrid-ownership-v1.md), [ADR-0022](0022-cpt-cyber-fabric-adr-git-commits-as-first-class-concept-v1.md), [ADR-0024](0024-cpt-cyber-fabric-adr-pull-requests-as-first-class-concept-v1.md), [ADR-0027](0027-cpt-cyber-fabric-adr-secret-storage-and-fabric-login-v1.md)

This decision directly addresses the following traceability items:

* Fabric core must define a provider-agnostic interface for pull requests, reviews, comments, and releases
* GitHub must be the default provider, shipped as a core-bundled kit
* the GitHub provider must use `@octokit/rest` and `@octokit/graphql` (the official GitHub TypeScript SDK)
* other providers must be addable as workspace- or global-scoped kits
* per-repo provider selection works through remote URL pattern matching with explicit configuration override
* issues, webhooks, GitHub Apps, OAuth flows, and fine-grained permissions are out of scope of the core contract
