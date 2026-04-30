---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0030: Core-Bundled `core` Kit: Fabric Platform-Internal Prompts, Domain Model Skills, Guide Material, and Kit Development Toolkit

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Core Kit](#option-1-no-core-kit)
  - [Option 2: Multiple Core Kits Split by Concern](#option-2-multiple-core-kits-split-by-concern)
  - [Option 3: Single `core` Kit with Sub-Namespaced Contents](#option-3-single-core-kit-with-sub-namespaced-contents)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-core-bundled-kit-core`

## Context and Problem Statement

Several Cyber Fabric ADRs depend on platform-internal content that must ship with Fabric itself: the init-workspace fallback prompt and auto-injected workspace summary template (per ADR-0026), login flow guidance (per ADR-0027), and error templates returned by various surfaces. The platform also has substantial documentation, educational, and developer-toolkit material that must ship out of the box: a Fabric guide explaining workspaces, kits, marketplaces, prompts, scripts, and the rest of the domain model; agent-facing skills that wrap each domain entity (workspace operations, kit operations, branch operations, PR operations, etc.); and the kit-development toolkit for scaffolding, validating, and publishing new kits.

The platform must decide how this content is organized. Three shapes are plausible: do not ship any of it (let the community provide), split it across multiple core-bundled kits by concern (one for kit-dev, one for guide, one for skills, one for platform internals), or consolidate it into a single core-bundled kit with sub-namespaced contents.

## Decision Drivers

* **Single mental model** — `core` is one canonical place where Fabric's own platform content lives; users and contributors do not have to remember which of several core kits hosts which thing
* **Versioned with Fabric** — all platform content moves together with the Fabric release, ensuring guide / skills / dev-toolkit / internal-prompts stay consistent with the platform version
* **Fabric-author-only** — the content requires deep platform knowledge and tight integration with Fabric SDK; community is unlikely to deliver or replace it correctly
* **Reduced ADR and index density** — one kit ADR instead of multiple keeps the architecture surface small
* **Natural growth** — when new platform content is needed (a new domain skill, a new internal prompt), it has an obvious home
* **Boundary discipline** — must remain platform primitives and platform internals; opinionated workflow kits (planners, methodology kits) belong in marketplace
* **Initial MVP minimum** — the only blocking content for Fabric to function is the init-workspace prompt and workspace-summary template (per ADR-0026); the rest is natural growth and can be delivered incrementally

## Considered Options

1. **No Core Kit** — Fabric ships only platform code; no kit-shipped content
2. **Multiple Core Kits Split by Concern** — separate core-bundled kits for kit-dev, guide, skills, and platform internals
3. **Single `core` Kit with Sub-Namespaced Contents** — one core-bundled kit hosting all platform-internal prompts, guide material, domain model skills, and kit-development toolkit, organized by sub-namespace within the kit

## Decision Outcome

Chosen option: **Option 3 — Single `core` Kit with Sub-Namespaced Contents**, because Cyber Fabric needs a single mental model for "platform content that ships with Fabric itself", with a unified version and one obvious home for new platform content. Splitting across multiple core kits adds ADR density and decision overhead without meaningful isolation benefit; not shipping the content at all leaves Fabric without working init-workspace fallback, without canonical agent skills over its own domain model, and without an authoring toolkit for kit creators.

The `core` kit is core-bundled per ADR-0008, ID literally `core`, versioned with the Fabric tool itself.

### Sub-namespaces within `core`

Instructions inside `core` are organized by sub-namespace using a dot separator inside instruction IDs:

* **`core:<name>`** — platform-internal runtime prompts that Fabric itself uses (init-workspace fallback, workspace summary, login flow guidance, error templates)
* **`core:guide.<name>`** — educational material about Fabric's domain model and operations (`core:guide.fabric-overview`, `core:guide.workspaces`, `core:guide.kits`, `core:guide.marketplace`, `core:guide.prompts`, `core:guide.scripts`, `core:guide.git-domain`, `core:guide.secrets`)
* **`core:skill.<name>`** — agent-facing skills wrapping CLI / SDK operations for each Fabric domain entity (`core:skill.workspace`, `core:skill.kits`, `core:skill.marketplace`, `core:skill.branches`, `core:skill.worktrees`, `core:skill.commits`, `core:skill.prs`, `core:skill.scripts`, `core:skill.secrets`)
* **`core:kit.<name>`** — kit development toolkit (`core:kit.scaffold`, `core:kit.author-prompt`, `core:kit.author-script`, `core:kit.author-web-extension`, `core:kit.author-dev-plugin`, `core:kit.document`, `core:kit.test`, `core:kit.publish-flow`)
* **`core:github.<name>`** — GitHub provider implementation per ADR-0023: auth flows, provider operation scripts using `@octokit/rest` and `@octokit/graphql`, github-specific skills, GitHub-specific guide content. Octokit dependencies declared in `core`'s `kit.yaml`. This sub-namespace is a **feature-area exception** to the type-based sub-namespace pattern, justified by the GitHub provider being a coherent feature implementation that crosses content types (scripts + prompts + skills); it satisfies ADR-0023's commitment to ship the GitHub provider with Fabric without making it a separate kit

Instruction-id sub-namespaces respect ADR-0010's kit-unique-id constraint: every instruction across all sub-namespaces in `core` has a unique full id.

### Skill and sub-agent registration into host agent tools

When `core` (or any other kit) ships **skills** or **sub-agents** that get registered into host agent tools (Claude Code, Codex, Cursor, JetBrains AI, etc., per the host-adapter pattern in ADR-0003 and the central registration tool in ADR-0006), the host-registered name follows a Fabric-wide convention:

```text
fab:<kit>:<name>
```

For the `core` kit specifically, the `<kit>` segment is **omitted**, producing the shorter form:

```text
fab:<name>
```

This special-case makes `core`'s content visually distinct in host agent tool listings (for example `fab:skill.workspace`, `fab:guide.kits`) while non-core kits retain their kit identity in their registered names. The shortening applies **only** to `core`; other core-bundled kits like `github` (per ADR-0031) retain their kit segment as `fab:github:<name>`.

The host-registered name appears in the kit resource's frontmatter:

```yaml
name: "fab:<kit>:<name>"
```

Quotes are required in YAML because the unquoted colon would be parsed as a key-value separator.

**Examples:**

| Fabric internal id | Host-registered name |
|---|---|
| `core:skill.workspace` | `fab:skill.workspace` |
| `core:skill.branches` | `fab:skill.branches` |
| `core:guide.workspaces` | `fab:guide.workspaces` |
| `core:github.create-pr` | `fab:github.create-pr` |
| `core:github.skill.review-pr` | `fab:github.skill.review-pr` |
| `prd-kit:skill.brainstorm` | `fab:prd-kit:skill.brainstorm` |

The `fab:` prefix identifies the source as a Fabric kit (distinguishing it from host-native skills or other platforms' content). The core-only shortening is the only exception to the uniform `fab:<kit>:<name>` rule.

### Scripts and runtime determinism: native Fabric CLI, not kit-shipped

The `core` kit ships **no scripts**. All deterministic operations one might expect of a "kit-development toolkit" — scaffolding, validation, hash computation, build, migration, diagnostics — are implemented **natively in the Fabric tool itself**, not as kit-shipped scripts. This is the **defining property** of `core` being the platform's own kit: `core` holds Fabric-author-only prompts and assets, while runtime determinism lives in Fabric core code.

The corresponding native CLI commands (with their REST API and Web UI equivalents per ADR-0001 / ADR-0002 / ADR-0020):

* `fabric doctor` (or `fabric health-check`) — diagnostics over workspace registry consistency, marketplace cache integrity, TOFU manifest hashes (per ADR-0029), kit `node_modules` install state (per ADR-0028), secret storage backend availability (per ADR-0027)
* `fabric kit scaffold <name>` — scaffold a new kit directory with `kit.yaml`, `prompts/`, `web/`, etc.
* `fabric kit add-prompt <name>` / `add-script <name>` / `add-web-extension <name>` / `add-dev-plugin <host>` — add resources to the current kit
* `fabric kit validate` — static validation (manifest valid, prompts parse, instruction id uniqueness within kit per ADR-0010, script entries exist, declared deps consistent)
* `fabric kit compute-hash` — SHA-256 of `git archive HEAD` tarball for marketplace publication per ADR-0029
* `fabric kit build` — full pipeline (validate + hash + ready for publish)
* `fabric migrate` — schema migrations as Fabric evolves (workspace registry per ADR-0011, marketplace manifest per ADR-0029, etc.)

These are part of Fabric's stability contract — kit authors cannot reasonably override `fabric kit validate` or `fabric kit compute-hash` without breaking platform invariants. They are **not** user-replaceable kit scripts. The `core:kit.<name>` sub-namespace contains *prompts* (authoring guidance, walkthroughs) that complement these CLI commands by teaching users / agents how to use them — but the deterministic action stays in Fabric core code.

Kits ship determinism through `fabric script run <kit>:<id>` per ADR-0017 only when their concern is a third-party operation that Fabric itself cannot foresee or validate (e.g., a domain-specific transformation, an external service call, a kit-author's custom build step). Platform-wide operations live in Fabric core.

### Web extensions

The `core` kit ships no web extensions initially. Fabric's own Web UI per ADR-0018 is platform code, not kit content; the platform may later refactor parts into kit web extensions if useful, but that is not committed by this decision.

### Dev tool plugins

The `core` kit ships **one dev tool plugin**: the official **Fabric VS Code extension** (per ADR-0021), packaged as a kit-shipped dev plugin per ADR-0019's host-native packaging convention. The plugin's binary / source lives inside the kit at the dev-plugin convention path; on Fabric install, it gets registered into VS Code through the host adapter (per ADR-0003 / ADR-0019). This unifies the delivery model: kits and Fabric core both use ADR-0019's mechanism — there is no special "first-party plugin" code path separate from the kit-shipped one.

The plugin's *content* (which Fabric capabilities it surfaces, the per-window workspace context, native VS Code patterns it uses) is specified in ADR-0021; this ADR commits only to *where it lives* (inside the `core` kit) and *how it is delivered* (per ADR-0019).

Other first-party dev tool plugins (JetBrains, Cursor, JetBrains AI, etc.) may be added to `core` over time as Fabric expands its host coverage; each addition is a follow-on decision and follows the same ADR-0019 delivery model.

### Initial MVP content

For Fabric to function out of the box, only two prompts in `core` are blocking:

* `core:init-workspace` (required by ADR-0026 fallback)
* `core:workspace-summary` (required by ADR-0026 auto-injection)

Everything else (guide material, domain skills, kit-development toolkit, scripts beyond `core:health-check`) is natural growth and can be added incrementally as Fabric evolves. The ADR fixes the structure and policy; specific contents are follow-on design.

### Out of scope (follow-on)

* Exact instruction IDs and content for guide, skills, and kit-dev sub-namespaces
* Localization / translation strategy for guide material
* Versioning policy for content within `core` as Fabric evolves
* Whether parts of `core` get factored out into separately versioned kits in the future as the kit grows
* The exact format of the `kit.yaml` file (kit's own manifest read by `core:scaffold-kit` and `fabric kit publish`)
* Sub-namespace separator format finalization (dot vs dash vs other) — current proposal is dot

### Consequences

* Good, because Fabric ships out of the box with everything needed to function (init-workspace fallback, workspace summary auto-injection)
* Good, because there is one canonical home for platform content; users and contributors do not have to navigate multiple core kits
* Good, because guide material, domain skills, and kit-dev toolkit ship together with the platform and stay version-aligned
* Good, because the sub-namespace organization keeps content discoverable through `fabric prompt list --kit core` filtered by prefix
* Good, because new platform content (new domain skill, new internal prompt, new dev script) has an obvious home
* Good, because boundary discipline is preserved — opinionated workflow kits stay in marketplace
* Bad, because the core kit becomes large over time; high-frequency content updates may push Fabric release cadence
* Bad, because all platform content is bound to the Fabric release version — users cannot pull a single guide article fix without bumping Fabric
* Bad, because sub-namespace conventions need to be documented and enforced consistently

### Confirmation

Confirmed when:

* `core` kit is core-bundled per ADR-0008, ID literally `core`, versioned with Fabric
* `core:init-workspace` and `core:workspace-summary` prompts exist and satisfy ADR-0026's fallback and auto-injection requirements
* sub-namespaces `core:guide.<name>`, `core:skill.<name>`, `core:kit.<name>` are reserved for guide, domain skills, and kit-dev toolkit respectively
* `core` kit ships scripts including `health-check`, `scaffold-kit`, `add-prompt` / `add-script` / `add-web-extension` / `add-dev-plugin`, `validate`, `compute-hash`, `build`, and `migrate`
* opinionated workflow content (planners, methodology-specific tooling) is not in `core` — it lives in marketplace kits

## Pros and Cons of the Options

### Option 1: No Core Kit

Fabric ships only platform code; community provides any kit-shipped content.

* Good, because the platform owns less content surface
* Good, because content can iterate independently of platform releases
* Bad, because Fabric cannot function out of the box (init-workspace fallback per ADR-0026 needs a real prompt to return)
* Bad, because canonical agent skills, guide material, and kit-dev toolkit do not exist by default — every user has to find them
* Bad, because content quality varies — community kits will not have deep platform integration

### Option 2: Multiple Core Kits Split by Concern

Separate core-bundled kits for kit-dev, guide, skills, and platform internals.

* Good, because each kit has a tight scope
* Good, because evolution boundaries are clearer
* Bad, because users and contributors have to learn which core kit hosts which thing
* Bad, because multiple ADRs and index entries for what is effectively one concern (Fabric platform content)
* Bad, because cross-cutting content (a skill that references a guide) does not have a clear home

### Option 3: Single `core` Kit with Sub-Namespaced Contents

One core-bundled kit hosting all platform-internal prompts, guide material, domain model skills, and kit-development toolkit, organized by sub-namespace.

* Good, because there is one mental model for platform content
* Good, because sub-namespaces (`core:guide.<name>`, `core:skill.<name>`, `core:kit.<name>`) keep content discoverable while staying in one kit
* Good, because new platform content has an obvious home
* Good, because version alignment with Fabric is automatic
* Bad, because the kit becomes large
* Bad, because all content is tied to the Fabric release cadence

## More Information

The sub-namespace conventions inside `core`:

* `core:<name>` is reserved for **platform-internal runtime prompts** — content Fabric itself returns or injects at runtime. Examples: `core:init-workspace`, `core:workspace-summary`, `core:onboarding`, `core:login-device-flow`, `core:no-marketplace-found`
* `core:guide.<name>` is reserved for **educational and onboarding material** — content that explains Fabric to its users. Examples: `core:guide.fabric-overview`, `core:guide.workspaces`, `core:guide.kits`, `core:guide.marketplace`, `core:guide.prompts`, `core:guide.scripts`, `core:guide.git-domain`, `core:guide.secrets`
* `core:skill.<name>` is reserved for **agent-facing skills** — content that teaches an agent how to work with each Fabric domain entity through CLI / SDK operations. Examples: `core:skill.workspace`, `core:skill.kits`, `core:skill.marketplace`, `core:skill.branches`, `core:skill.worktrees`, `core:skill.commits`, `core:skill.prs`, `core:skill.scripts`, `core:skill.secrets`
* `core:kit.<name>` is reserved for **kit-development toolkit** — content that helps kit authors create, validate, and publish kits. Examples: `core:kit.scaffold`, `core:kit.author-prompt`, `core:kit.author-script`, `core:kit.author-web-extension`, `core:kit.author-dev-plugin`, `core:kit.document`, `core:kit.test`, `core:kit.publish-flow`

The exact instruction-id format inside sub-namespaces (dot, dash, slash, etc.), the exhaustive content list for each sub-namespace, the script CLI argument format for `scaffold-kit` / `add-*` / `validate` / `compute-hash` / `build` / `migrate`, the localization approach for guide material, and the integration with ADR-0026's auto-injected workspace summary block are intentionally left to follow-on design.

This decision composes with several existing ADRs:

* **ADR-0006** (kit packaging) — `core` is a kit packaged like any other
* **ADR-0007** (prompt file model) — `core`'s prompts use `{{#instruction "<id>"}}...{{/instruction}}` Handlebars block helpers; sub-namespacing happens through dotted instruction ids
* **ADR-0008** (kit scopes) — `core` is core-bundled, version-aligned with Fabric
* **ADR-0010** (templating + extraction) — instruction ids in `core` are unique within the kit (across all sub-namespaces), addressable via `core:<id>`
* **ADR-0011** (workspace concept) — `core:guide.workspaces` and `core:skill.workspace` reference workspace operations
* **ADR-0017** (scripts) — `core`'s scripts (`health-check`, `scaffold-kit`, etc.) follow ADR-0017's `<kit>:<id>` addressing
* **ADR-0023** (git provider abstraction) — `core:guide.git-domain` covers the abstraction; `core:skill.branches` / `skill.worktrees` / `skill.commits` / `skill.prs` reference the domain entities
* **ADR-0026** (workspace-aware prompt rendering) — `core:init-workspace` is the fallback prompt; `core:workspace-summary` is the auto-injection template
* **ADR-0027** (secret storage) — `core:guide.secrets` and `core:skill.secrets` reference secret storage; `core:login-device-flow` is the OAuth device flow guidance
* **ADR-0028** (per-kit dependency isolation) — `core` declares its own pnpm dependencies; runs in the same sandbox model as any other kit
* **ADR-0029** (marketplace) — `core` is the canonical example of a core-bundled kit; `core:kit.publish-flow` walks through publication

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-distribution-core-kit`, `cpt-cyber-fabric-fr-kits-three-scopes`
- **Related decisions**: [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0007](0007-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0010](0010-cpt-cyber-fabric-adr-prompt-templating-and-instruction-extraction-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0023](0023-cpt-cyber-fabric-adr-git-provider-abstraction-with-github-default-v1.md), [ADR-0026](0026-cpt-cyber-fabric-adr-workspace-aware-prompt-rendering-v1.md), [ADR-0027](0027-cpt-cyber-fabric-adr-secret-storage-and-fabric-login-v1.md), [ADR-0028](0028-cpt-cyber-fabric-adr-per-kit-dependency-isolation-and-script-sandbox-v1.md), [ADR-0029](0029-cpt-cyber-fabric-adr-kit-marketplace-architecture-v1.md)

This decision directly addresses the following traceability items:

* a single `core` kit is core-bundled with Fabric, holding all Fabric-author-only platform content
* sub-namespaces `core:guide.<name>`, `core:skill.<name>`, `core:kit.<name>` are reserved for guide material, domain skills, and kit-development toolkit
* `core:init-workspace` and `core:workspace-summary` provide the runtime prompts ADR-0026 depends on
* `core` ships scripts for diagnostics (`health-check`), kit authoring (`scaffold-kit`, `add-*`, `validate`, `compute-hash`, `build`), and migrations (`migrate`)
* opinionated workflow kits live in marketplace, not in `core`
* Fabric's first-party VS Code extension (ADR-0021) and Web UI (ADR-0018) ship as platform code or first-party plugin, not as `core` content
