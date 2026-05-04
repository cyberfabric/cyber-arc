---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0022: Git Commits as a First-Class Concept

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No First-Class Commit Concept](#option-1-no-first-class-commit-concept)
  - [Option 2: Commits as a Derivative of Branches](#option-2-commits-as-a-derivative-of-branches)
  - [Option 3: First-Class Commits with Their Own CLI Surface](#option-3-first-class-commits-with-their-own-cli-surface)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-git-commits-as-first-class-concept`

## Context and Problem Statement

Cyber Fabric models branches (ADR-0013) and worktrees (ADR-0014) as first-class git-domain concepts, but commits — the third foundational git concept — currently have no first-class representation. Consumers that need commit data have to call `git log` or `git show` and parse free-form output. The planned Fabric Web UI (ADR-0018) needs to render commit visualizations; the REST API (ADR-0020) needs to expose commit data to programmatic clients; cross-repo commit aggregation across a workspace ("all commits in this workspace this week") has no clean platform-level home.

The platform therefore needs a first-class commit concept: structured commit data with stable fields, a CLI surface for listing and inspecting commits, cross-repo aggregation across the workspace, and the same surface reachable from the Web UI, REST API, and VS Code plugin.

## Decision Drivers

* **Web UI commit visualization** — the planned Web UI (ADR-0018) needs structured commit data to render history views
* **Cross-repo aggregation** — workspace-level commit queries (across all member repositories) cannot be cleanly answered by repeated `git log` calls
* **REST API consumer contract** — programmatic clients should fetch commit data through structured JSON, not parse `git log` output
* **Composability with branches and worktrees** — the branch model (ADR-0013) already exposes `last_commit`; worktree records (ADR-0014) reference checked-out branches with their own commit context; a shared commit model is the natural foundation
* **Same git library** — implementation must use `simple-git` per ADR-0014 to share a single git interaction layer with branches and worktrees
* **Surface parity** — same operations from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002

## Considered Options

1. **No First-Class Commit Concept** — consumers call `git log` and `git show` directly and parse output
2. **Commits as a Derivative of Branches** — commits exist only as fields on branch records; no standalone commit operations
3. **First-Class Commits with Their Own CLI Surface** — Fabric models commits as structured data with their own CLI, cross-repo aggregation, and SDK access

## Decision Outcome

Chosen option: **Option 3 — First-Class Commits with Their Own CLI Surface**, because Cyber Fabric needs a structured, workspace-aware commit concept to serve the Web UI, the REST API, and cross-repo aggregation queries that cannot be cleanly answered by repeated `git log` invocations. Commits are the third foundational git-domain concept alongside branches (ADR-0013) and worktrees (ADR-0014); modeling them as first-class is consistent with that pattern.

A **commit** in Cyber Fabric is structured data representing one git commit within a workspace member repository. The commit model represents at minimum:

* `sha` — full commit SHA
* `repo` — workspace member repository the commit belongs to
* `message` — full commit message
* `author` — `{name, email}`
* `date` — commit timestamp (ISO 8601)
* `parents` — array of parent SHAs (length 0 for root commit, 2+ for merge commits)
* `files_changed` — summary `{added, modified, deleted}` counts; the full file list is available via `info` but not embedded by default in `list` output for size reasons
* `is_merge` — whether the commit has more than one parent

The CLI surface is:

* `fabric commit list [--repo <r>] [--branch <b>] [--since <t>] [--until <t>] [--author <a>] [--json]` — list commits across the workspace; defaults to scanning every workspace member repository, narrowable with `--repo`. Filters compose.
* `fabric commit info <sha> [--repo <r>] [--json]` — return the structured record for one commit, including the full file list of changes
* `fabric commit log <range> [--repo <r>] [--json]` — return commits in a revision range (e.g. `main..feature-x`)

Cross-repo aggregation is the default for `list`. The implementation uses **`simple-git`** per ADR-0014 (the same git library chosen there because it is the only TypeScript library with full worktree support; commits and worktrees share one git library by design).

Operations explicitly out of scope: `rebase`, `cherry-pick`, history rewriting, signature verification, commit signing, interactive log editing — those remain in `git` directly per the same boundary as ADR-0013.

The same surface is reachable from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002.

### Consequences

* Good, because the Web UI gets a structured commit model to render history visualizations from
* Good, because workspace-level commit queries become a single command instead of a per-repo iteration
* Good, because programmatic clients consume commits through typed REST endpoints instead of parsing `git log`
* Good, because the commit model composes naturally with branches (ADR-0013) and worktrees (ADR-0014) since all three share `simple-git`
* Good, because cross-repo aggregation by default makes the workspace-aware story consistent across git-domain ADRs
* Bad, because the platform must keep its commit data model in sync with what `git` exposes underneath
* Bad, because users coming from monolithic git porcelains may expect `fabric commit cherry-pick` and need redirection to `git`
* Bad, because file-change details on every commit can be expensive — `list` defaults to summary counts, full details only on `info`

### Confirmation

Confirmed when:

* `fabric commit list`, `fabric commit info`, and `fabric commit log` are implemented and behave as described above
* `fabric commit list --json` returns the structured record described in this ADR for every commit, with `--repo`, `--branch`, `--since`, `--until`, and `--author` filters honored
* cross-repo aggregation is the default; narrowable with `--repo`
* `rebase`, `cherry-pick`, history rewriting, and signing are explicitly not present in `fabric commit` and are documented as belonging to `git` directly
* the implementation uses `simple-git` per ADR-0014
* the same surface is available from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002

## Pros and Cons of the Options

### Option 1: No First-Class Commit Concept

Consumers call `git log` and `git show` directly and parse output.

* Good, because the platform owns less surface
* Bad, because the Web UI has no structured commit data to render
* Bad, because workspace-level commit queries are awkward
* Bad, because programmatic clients pay the parsing tax

### Option 2: Commits as a Derivative of Branches

Commits exist only as fields on branch records (e.g. `last_commit`); no standalone commit operations.

* Good, because the branch model already includes some commit data
* Bad, because commits exist independently of branches (a commit can be referenced without a branch — e.g. detached HEAD, ranges, search results)
* Bad, because cross-repo commit aggregation cannot be expressed through branch-scoped operations
* Bad, because commit-by-SHA inspection has no clean home

### Option 3: First-Class Commits with Their Own CLI Surface

Fabric models commits as structured data with their own CLI, cross-repo aggregation, and SDK access.

* Good, because commits get a clean, structured representation suitable for visualization and aggregation
* Good, because cross-repo aggregation is straightforward
* Good, because the model composes with branches (ADR-0013) and worktrees (ADR-0014)
* Good, because all four surfaces (CLI, Web UI, REST API, VS Code plugin) consume one model
* Bad, because the platform must maintain commit data model in sync with git
* Bad, because limits on `list` output (default summary counts vs full details) need explicit teaching

## More Information

The default behavior for `list`:

* `--since` / `--until` accept ISO timestamps or relative forms (e.g. `7d`, `1w`); precise grammar is follow-on design
* `--author` matches name or email substrings; the matching rule is follow-on design
* the default page size, the resolution rule when a SHA prefix is ambiguous in `info`, and the streaming behavior for large `list` results are intentionally left to follow-on design

`fabric commit log <range>` accepts standard git revision ranges (e.g. `main..feature-x`, `v1.0.0..HEAD`); the parser uses `simple-git`'s revision range support.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-git-commits-first-class`, `cpt-cyber-fabric-fr-git-workspace-aggregation`, `cpt-cyber-fabric-usecase-dev-browse-git-domain`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0013](0013-cpt-cyber-fabric-adr-branches-as-first-class-concept-v1.md), [ADR-0014](0014-cpt-cyber-fabric-adr-worktrees-as-first-class-with-hybrid-ownership-v1.md), [ADR-0024](0024-cpt-cyber-fabric-adr-pull-requests-as-first-class-concept-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must model commits as first-class structured data
* the commit CLI surface must support `list`, `info`, and `log` operations with cross-repo aggregation by default
* `rebase`, `cherry-pick`, history rewriting, and signing are explicitly out of scope and remain with `git` directly
* the implementation uses `simple-git` per ADR-0014
* the same surface is reachable from CLI, Web UI, REST API, and VS Code plugin per ADR-0001 and ADR-0002
