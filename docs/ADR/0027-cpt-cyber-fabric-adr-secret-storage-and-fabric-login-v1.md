---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0027: Secret Storage with OS-Keychain Backends and `fabric login` for Provider Authentication

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Platform Secret Storage](#option-1-no-platform-secret-storage)
  - [Option 2: Use Ordinary Storage for Secrets](#option-2-use-ordinary-storage-for-secrets)
  - [Option 3: Dedicated Secret Storage with OS-Keychain Backends and `fabric login` Verb](#option-3-dedicated-secret-storage-with-os-keychain-backends-and-fabric-login-verb)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-secret-storage-and-fabric-login`

## Context and Problem Statement

Cyber Fabric kits and surfaces need to handle secrets — primarily git provider tokens (per ADR-0023's GitHub provider and any kit-shipped GitLab / Bitbucket / Gerrit / Forgejo / Gitea provider), but also arbitrary credentials that scripts (ADR-0017), web extensions (ADR-0018), and dev tool plugins (ADR-0019) may need. Today there is no platform-level secret storage. Kits that need credentials either use the ordinary key-value storage (ADR-0015), which writes plain files to `.fabric/storage/` and risks accidental commits and unencrypted persistence, or they invent their own ad hoc encryption schemes per kit, which fragments the security story and leaves users with no consistent place to inspect or revoke their secrets.

Beyond storage, the platform needs an ergonomic CLI verb for **provider authentication**. Today users either invoke `gh auth login` (or equivalent provider CLI) and Fabric never sees the resulting credential, or they manually paste a personal access token into some kit-specific configuration. Both approaches are friction; both bypass any future cloud Fabric service that needs credentials in known locations.

The platform therefore needs (1) a dedicated secret storage primitive with OS-native keychain backends and clear scoping rules, and (2) a top-level `fabric login` CLI verb that orchestrates provider-specific auth flows and stores their results in secret storage.

## Decision Drivers

* **Encryption at rest** — secrets must not live as plain text on disk; OS keychain integration (macOS Keychain, Windows Credential Manager, Linux Secret Service) is the standard for native applications
* **Distinct from ordinary storage (ADR-0015)** — secrets need different display semantics, different access auditing, different backing stores; treating them as ordinary key-value pairs leaks security concerns into every kit
* **Cross-OS support** — Fabric users run on macOS, Windows, and Linux; the secret storage backend must adapt to each platform's native mechanism while presenting one SDK to kits
* **Headless and CI fallback** — environments without a desktop keychain still need a working secret store
* **Provider-specific login flows** — git providers (and other future subjects) have varied auth flows (OAuth device flow, browser-based OAuth, personal access tokens, mTLS, etc.); the platform should not bake a single flow into core
* **Surface parity** — `fabric login` and secret-store operations must be reachable from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002
* **Cloud readiness** — secrets stored locally today should map cleanly onto a future centralized cloud Fabric service's credential store without redesign

## Considered Options

1. **No Platform Secret Storage** — kits manage their own secrets ad hoc
2. **Use Ordinary Storage (ADR-0015) for Secrets** — kits encrypt secrets themselves and store them in the ordinary key-value primitive
3. **Dedicated Secret Storage with OS-Keychain Backends and `fabric login` Verb** — Fabric provides a separate secret storage primitive backed by OS keychain (with encrypted-file fallback), plus a top-level `fabric login` CLI verb that orchestrates provider-specific auth flows

## Decision Outcome

Chosen option: **Option 3 — Dedicated Secret Storage with OS-Keychain Backends and `fabric login` Verb**, because Cyber Fabric needs a single platform-level secret store with proper encryption-at-rest and OS-keychain integration, and a single ergonomic CLI verb for provider authentication that abstracts each provider's auth flow specifics. Treating secrets as ordinary storage pushes the security burden into every kit, and leaving login flows ad hoc means users juggle multiple provider CLIs without Fabric ever seeing the resulting credentials.

The decision has two parts:

1. **Secret storage primitive** — a Fabric-provided store distinct from ADR-0015's ordinary storage:

   * **SDK**: `fabric.secrets.get(namespace, key)` returns the secret value; `fabric.secrets.set(namespace, key, value)` stores it; `fabric.secrets.delete(namespace, key)` removes it; `fabric.secrets.list(namespace)` returns key **names only**, never values.
   * **Backends** (selected automatically per platform):
     * macOS: **Keychain** (via native API or the `security` command-line tool)
     * Windows: **Credential Manager**
     * Linux: **Secret Service** (libsecret with GNOME Keyring or KWallet)
     * **Fallback**: encrypted-file backend (AES-256-GCM with a key derived from the platform keystore where available, or from a user-provided passphrase otherwise) for headless and CI environments
   * **Namespacing**: kit-namespaced by construction with sub-namespaces for grouping. For example, the GitHub provider's token lives at namespace `git-providers/github`, key `token`. Cross-kit access requires explicit grant; mechanism is follow-on design.
   * **CLI surface**: `fabric secret list [--namespace <ns>] [--json]`, `fabric secret get <namespace> <key> [--reveal]` (masks the value by default; `--reveal` shows it after a confirmation prompt), `fabric secret set <namespace> <key>` (reads value from stdin or interactive prompt; never accepts on the command line where it would land in shell history), `fabric secret delete <namespace> <key>`.
   * **REST API**: workspace-scoped at `/v1/workspaces/<ws>/secrets/...` and user-global at `/v1/secrets/...`. Values are never returned over non-localhost connections without TLS; a remote REST API endpoint that is not TLS-terminated rejects secret-value reads.
   * **Web UI**: secrets are listable; values are masked by default with an explicit reveal toggle that requires user confirmation per reveal.
   * **VS Code plugin**: secret-management commands surfaced through the Command Palette and a Fabric Side Panel section; values masked by default.

2. **`fabric login` CLI verb** — a top-level Fabric verb for provider authentication:

   * `fabric login git <provider-name>` invokes the git provider kit's login handler (per ADR-0023). The provider kit decides the auth flow (OAuth device flow, browser-based OAuth, personal access token entry, mTLS, etc.); the platform does not bake a single flow into core.
   * On successful authentication, the provider kit stores the resulting credential in secret storage under a conventional namespace (for example `git-providers/<provider-name>`, key `token`); the exact namespace conventions per provider are follow-on design.
   * `fabric login` is **extensible to non-git subjects** through the same dispatch model: `fabric login <subject> <args...>` routes to a registered login handler. Non-git subjects (for example `fabric login claude` for an LLM provider, `fabric login npm` for a package registry) are out of scope of this ADR but the CLI design supports them.
   * Same login flow available from **Web UI** as a button (`Login to GitHub` etc.), **VS Code plugin** through the Command Palette (`Fabric: Login to GitHub`), and **REST API** as a programmatic trigger that returns instructions to complete an interactive flow when one is required (the exact REST shape for interactive flows — for example returning a device-code URL — is follow-on design).

The exact provider auth flow implementations, the encrypted-file fallback's key management policy, the multi-tenant / shared-machine semantics, the token rotation and expiry handling, and audit logging for secret access are intentionally left to follow-on design.

### Consequences

* Good, because secrets get a single platform-level store with proper encryption-at-rest and OS-keychain integration
* Good, because kits stop reinventing security primitives and stop risking accidental commits of plain-text tokens
* Good, because `fabric login` is an ergonomic single verb that abstracts provider auth flow specifics
* Good, because surface parity (CLI, Web UI, REST API, VS Code plugin) holds for both secret operations and login flows
* Good, because the design is extensible to non-git auth subjects without a redesign
* Good, because cloud Fabric deployment can map this onto a centralized credential store without changing the SDK kits use
* Bad, because each OS keychain has its own quirks (lockout behavior, prompt frequency, app-bundle identity, etc.) and the cross-OS abstraction must absorb them
* Bad, because the encrypted-file fallback's key management is a real concern in headless and CI environments
* Bad, because the boundary between "this is a secret" (use this primitive) and "this is ordinary configuration" (use ADR-0015) needs documentation; some values (for example webhook URLs that contain a secret token) sit on the boundary

### Confirmation

Confirmed when:

* `fabric.secrets.get / set / delete / list` SDK is implemented and routes to the OS keychain on supported platforms with encrypted-file fallback elsewhere
* `fabric.secrets.list` returns key names only, never values
* `fabric secret list / get / set / delete` CLI is implemented with masking by default and explicit `--reveal` for value display
* `fabric login git <provider-name>` invokes the git provider kit's auth flow per ADR-0023 and stores the resulting credential in secret storage
* `fabric login` is reachable from Web UI, VS Code plugin, and REST API per ADR-0001 and ADR-0002
* secret values are never returned over non-localhost REST API connections without TLS
* the boundary between secret storage and ordinary storage (ADR-0015) is documented; ordinary storage is not used for secrets

## Pros and Cons of the Options

### Option 1: No Platform Secret Storage

Kits manage their own secrets ad hoc.

* Good, because the platform owns less surface
* Bad, because every kit reinvents secret handling — security quality is uneven across kits
* Bad, because operators have no consistent place to inspect or revoke credentials
* Bad, because Fabric never sees provider tokens, blocking cloud-side credential federation later

### Option 2: Use Ordinary Storage (ADR-0015) for Secrets

Kits encrypt secrets themselves and store them in the ordinary key-value primitive.

* Good, because kits use one storage SDK
* Bad, because ordinary storage is plain files in `.fabric/storage/...` — secrets risk accidental git commits even when encrypted at rest
* Bad, because OS keychain integration is missed; users get no biometric or system-level credential prompts
* Bad, because security responsibility (encryption, key management, masking on display) is pushed into every kit

### Option 3: Dedicated Secret Storage with OS-Keychain Backends and `fabric login` Verb

Fabric provides a separate secret storage primitive backed by OS keychain (with encrypted-file fallback), plus a top-level `fabric login` orchestration verb.

* Good, because secrets get proper OS-native storage with encryption-at-rest by construction
* Good, because operators get one consistent CLI for inspection, revocation, and auditing
* Good, because `fabric login` makes provider auth ergonomic and routable to provider-specific flows
* Good, because the design extends naturally to non-git auth subjects
* Good, because cloud Fabric can map this onto a centralized credential store without SDK changes
* Bad, because cross-OS keychain abstraction is non-trivial — each OS has quirks to absorb
* Bad, because the headless and CI fallback requires its own key management story
* Bad, because documenting the secret-vs-ordinary boundary takes deliberate effort

## More Information

The default namespace convention for git provider tokens is `git-providers/<provider-name>` with key `token`; for example the GitHub provider stores at `git-providers/github/token`. Other namespaces emerge as follow-on design when other auth subjects are added.

The exact OS-keychain client libraries (for example a cross-platform Node binding library, or platform-native bindings), the encrypted-file fallback's cipher and key derivation parameters, the master-passphrase prompt and caching policy for the fallback, the REST API shape for interactive auth flows (for example how a device-code URL is returned to a programmatic caller), the audit-logging policy for secret access, the multi-tenant and shared-machine semantics, and the token rotation, expiry, and refresh model are intentionally left to follow-on design.

This decision composes with several existing ADRs:

* **ADR-0015** (kit configuration storage) — secret storage is **distinct** from ordinary storage; kits should use whichever fits the data
* **ADR-0017** (scripts) — scripts may consume secrets through the SDK if they need provider tokens or other credentials
* **ADR-0018** (Web UI) — login buttons and secret-management UI live in the Web UI built on frontx
* **ADR-0019** (dev tool plugins) — kit-shipped IDE plugins may consume secrets through the SDK
* **ADR-0020** (REST API) — secret operations and `fabric login` are exposed through the REST API; secret-value reads are TLS-required for non-localhost
* **ADR-0021** (VS Code plugin) — secret management and login flows surface through native VS Code patterns
* **ADR-0023** (git provider abstraction) — git provider kits register their auth flows with `fabric login` and store credentials in secret storage; the GitHub provider is the canonical first instance

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-auth-fabric-login`, `cpt-cyber-fabric-fr-auth-secret-storage`, `cpt-cyber-fabric-fr-auth-cross-surface`, `cpt-cyber-fabric-fr-auth-secret-protection`, `cpt-cyber-fabric-nfr-security-secret-storage`, `cpt-cyber-fabric-contract-os-keychain`, `cpt-cyber-fabric-usecase-auth-with-provider`
- **Related decisions**: [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0015](0015-cpt-cyber-fabric-adr-kit-configuration-storage-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-dev-tool-plugins-as-kit-resources-v1.md), [ADR-0020](0020-cpt-cyber-fabric-adr-rest-api-as-fabric-surface-v1.md), [ADR-0021](0021-cpt-cyber-fabric-adr-vscode-plugin-fabric-host-adapter-v1.md), [ADR-0023](0023-cpt-cyber-fabric-adr-git-provider-abstraction-with-github-default-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must provide a dedicated secret storage primitive distinct from ordinary key-value storage (ADR-0015)
* the secret storage backend must integrate with OS keychains (macOS Keychain, Windows Credential Manager, Linux Secret Service) with encrypted-file fallback for headless environments
* secret storage values must never be returned over non-localhost REST API connections without TLS
* `fabric login git <provider-name>` must invoke the git provider kit's auth flow per ADR-0023 and store credentials in secret storage
* `fabric login` must be extensible to non-git auth subjects through the same dispatch model
* secret operations and login flows must be reachable from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002
