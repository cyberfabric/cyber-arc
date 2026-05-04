---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0024: Pull Requests as a First-Class Concept with Markdown-Aware Review

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No First-Class Pull Requests](#option-1-no-first-class-pull-requests)
  - [Option 2: Pull Request Support Only via CLI](#option-2-pull-request-support-only-via-cli)
  - [Option 3: First-Class Pull Requests over Provider Abstraction with Markdown-Aware Review](#option-3-first-class-pull-requests-over-provider-abstraction-with-markdown-aware-review)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-pull-requests-as-first-class-concept`

## Context and Problem Statement

Cyber Fabric is built around delivery flows that culminate in pull-request-style review: spec documents, ADRs, kit prompts, scripts, and code all go through PRs. Today there is no first-class PR concept in Fabric — users invoke `gh` (or other provider CLIs) directly. That works, but it means Fabric's structured workspace, branch, worktree, and commit data does not compose with PR data, the planned Web UI (ADR-0018) has nothing structured to render for review, and PR-level operations cannot be cross-cut with workspace-aware filtering or aggregation.

A second concern: Cyber Fabric's central artifacts are markdown — specs, ADRs, design documents, prompts. Reviewing those artifacts in a PR using only diff views (which show raw markdown source) is a poor experience. Reviewers want **rendered preview alongside the source**, line comments anchored to the rendered view, and inline suggestion blocks that propose text edits. These markdown-aware review affordances are not optional for Fabric — they are the primary review case.

## Decision Drivers

* **First-class structured PRs** — the Web UI, REST API, and VS Code plugin all need structured PR data, not parsed `gh pr` output
* **Provider abstraction** — PRs (GitHub PRs), MRs (GitLab merge requests), and other provider equivalents must share one model through ADR-0023's abstraction
* **Markdown-aware review** — spec, ADR, and documentation review are primary use cases; raw-source-only review is not adequate
* **Surface parity** — same operations from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002
* **Composability with branches, worktrees, commits** — PRs reference branches (ADR-0013), source / target context, and commits (ADR-0022); the model must compose
* **Visualization** — the Web UI is the richest visualization surface; CLI provides scriptable access; the VS Code plugin embeds review in the editor; REST API exposes everything programmatically

## Considered Options

1. **No First-Class Pull Requests** — users invoke `gh` (or equivalent) directly; Fabric does not model PRs
2. **Pull Request Support Only via CLI** — Fabric exposes PR operations through CLI, but the Web UI and REST API do not surface them
3. **First-Class Pull Requests over Provider Abstraction with Markdown-Aware Review** — PRs are modeled as structured data through ADR-0023's provider abstraction, with markdown-aware review affordances as a required first-class capability

## Decision Outcome

Chosen option: **Option 3 — First-Class Pull Requests over Provider Abstraction with Markdown-Aware Review**, because Cyber Fabric is in its core a delivery system that flows through PR review, and the artifacts it produces (specs, ADRs, kit prompts, design documents) are predominantly markdown — review of which deserves rendered-preview affordances rather than raw-source-only diffs.

A **pull request** in Cyber Fabric is structured data representing one provider-side PR / MR / change set, surfaced through ADR-0023's provider abstraction. The data model represents at minimum:

* `id` — Fabric-internal identifier
* `provider` — provider name (e.g. `github`)
* `provider_id` — provider-side identifier (GitHub PR number, GitLab MR IID, etc.)
* `repo` — workspace member repository
* `title` — PR title
* `description` — full description (markdown)
* `source_branch` — source branch name and head SHA
* `target_branch` — target branch name and head SHA
* `author` — `{name, login, email}`
* `status` — `open` / `closed` / `merged` / `draft`
* `reviews` — array of `{reviewer, state, body, comments[]}`; `state` ∈ `approved` / `changes_requested` / `commented`
* `comments` — array of `{author, body, file?, line?, side?}`; general PR comments and file/line-anchored review comments
* `file_changes` — summary `{added, modified, deleted}` plus a list of changed paths; full diff fetched on demand
* `last_commit` — sha of the latest commit on the source branch (composes with ADR-0022)

The CLI surface is:

* `fabric pr list [--repo <r>] [--state open|closed|merged|all] [--author <a>] [--json]` — list PRs across the workspace; defaults to all repositories with their configured providers
* `fabric pr info <id> [--repo <r>] [--json]` — return the structured record for one PR
* `fabric pr create [--from <branch>] [--to <branch>] [--title <t>] [--body <b>] [--draft] [--repo <r>]` — create a PR via the configured provider
* `fabric pr review <id> [--approve | --request-changes | --comment] [--body <b>] [--repo <r>]` — submit a review
* `fabric pr comment <id> [--file <path>] [--line <n>] [--side left|right] --body <b> [--repo <r>]` — add a general or line-anchored comment
* `fabric pr view <id> [--web] [--repo <r>]` — visualize the PR; opens the Web UI by default; `--web` is a hint for alternative target if multiple visualizers exist

**Markdown-aware review affordances** (required, not optional):

1. **Side-by-side rendered preview** — for any markdown file in the PR's diff, the Web UI shows source + rendered view side-by-side; reviewers can switch each pane independently
2. **Line comments on rendered markdown** — comments anchor to source lines but display on the rendered view at the corresponding rendered location, so reviewers can comment on what they see (for example "this paragraph is unclear") rather than what they parse from raw markdown
3. **Suggestion blocks** — inline proposed text changes that the author can accept with one click (analogous to GitHub's suggestion blocks)
4. **Same affordances apply to spec, ADR, prompt, and documentation reviews** — these are the primary use cases driving this requirement

The same operations are reachable from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002. The Web UI is the richest visualization (full markdown rendering, side-by-side); the CLI provides scriptable access (suitable for CI integration); the VS Code plugin embeds review in the editor (PR diff in the diff view, comments in webviews); the REST API exposes everything programmatically.

### Consequences

* Good, because PRs become first-class composable data alongside branches, worktrees, and commits
* Good, because the Web UI gets a structured PR model to render review interfaces from
* Good, because markdown-aware review makes Fabric a credible delivery platform for spec / ADR / documentation work
* Good, because cross-repo PR aggregation across a workspace is a single command
* Good, because the same surface works from all four surfaces, supporting CLI scripting and CI as well as interactive review
* Good, because provider abstraction (ADR-0023) keeps the PR contract portable across providers
* Bad, because markdown-aware review is non-trivial UX work; the Web UI must implement source / render synchronization, comment anchoring across views, and suggestion-block semantics carefully
* Bad, because reviewer workflows differ across providers (approval rules, required reviewers, status checks); the abstraction must accommodate real differences without forcing the lowest common denominator
* Bad, because line-anchored comments on rendered markdown require reliable mapping between source line and rendered location, which is a hard problem when markdown extensions are involved

### Confirmation

Confirmed when:

* `fabric pr list / info / create / review / comment / view` are implemented and behave as the canonical operations described above
* PR data follows the structured model described in this ADR, served via ADR-0023's provider abstraction
* the Web UI provides side-by-side rendered preview for markdown files in PRs, line comments anchored to source lines but displayed on the rendered view, and suggestion blocks
* spec, ADR, prompt, and documentation review explicitly use these affordances as the primary case
* the same surface is reachable from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002
* cross-repo PR aggregation across a workspace is the default for `list`, narrowable with `--repo`

## Pros and Cons of the Options

### Option 1: No First-Class Pull Requests

Users invoke `gh` directly; Fabric does not model PRs.

* Good, because the platform owns less surface
* Bad, because Fabric's structured data does not compose with PR data
* Bad, because the Web UI has nothing structured to render for review
* Bad, because cross-repo workspace-aware PR queries are not possible
* Bad, because markdown-aware review of spec / ADR / documentation has no platform-level home

### Option 2: Pull Request Support Only via CLI

Fabric exposes PR operations through CLI but not through Web UI or REST API.

* Good, because CLI is the simplest surface to ship first
* Bad, because the Web UI cannot offer review interfaces for PRs
* Bad, because the markdown-aware review story has no place to live
* Bad, because surface parity per ADR-0001 / ADR-0002 is violated

### Option 3: First-Class Pull Requests over Provider Abstraction with Markdown-Aware Review

PRs as structured data through ADR-0023, with markdown-aware review affordances as a first-class requirement.

* Good, because PRs compose with branches, worktrees, and commits as workspace-aware structured data
* Good, because markdown-aware review makes Fabric a credible spec / ADR / documentation delivery platform
* Good, because all four surfaces (CLI, Web UI, REST API, VS Code plugin) consume one model
* Good, because the provider abstraction handles GitHub today and other providers later without amending the PR ADR
* Bad, because the Web UI's markdown-aware review affordances are non-trivial UX
* Bad, because line-anchored comments on rendered markdown have hard edge cases under complex markdown extensions

## More Information

The Web UI's markdown-aware review affordances draw inspiration from existing tools (GitHub's PR review, Reviewable, Phabricator's Differential), adapted for markdown-first workflows. The exact UX details — how source / render panes synchronize scroll position, how line-anchored comments visually display on the rendered side, how suggestion blocks render and apply, how reviewers navigate between markdown files and code files in the same PR, how draft reviews are represented — are intentionally left to follow-on design.

The relationship between PR comments / reviews and Fabric workspace storage (ADR-0015) — for example whether a partial draft review should persist locally before submission — is intentionally left to follow-on design.

The CLI form `fabric pr view <id> [--web]` opens the PR in the Web UI by default. Whether `--web` selects between Web UI and a future TUI viewer, or whether it forces a browser-based view versus the in-VS-Code embedded view, is intentionally left to follow-on design.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-pr-first-class`, `cpt-cyber-fabric-fr-pr-cross-surface-operations`, `cpt-cyber-fabric-fr-pr-markdown-aware-review`, `cpt-cyber-fabric-usecase-manage-pull-request`, `cpt-cyber-fabric-usecase-pm-review-from-web-app`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0013](0013-cpt-cyber-fabric-adr-branches-as-first-class-concept-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0021](0021-cpt-cyber-fabric-adr-vscode-plugin-fabric-host-adapter-v1.md), [ADR-0022](0022-cpt-cyber-fabric-adr-git-commits-as-first-class-concept-v1.md), [ADR-0023](0023-cpt-cyber-fabric-adr-git-provider-abstraction-with-github-default-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must model pull requests as first-class structured data through ADR-0023's provider abstraction
* the PR CLI surface must support `list`, `info`, `create`, `review`, `comment`, and `view` operations
* markdown-aware review affordances (side-by-side rendered preview, line comments anchored to source lines but displayed on rendered view, suggestion blocks) are required, not optional
* the same surface must be reachable from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002
* cross-repo PR aggregation across a workspace is the default
