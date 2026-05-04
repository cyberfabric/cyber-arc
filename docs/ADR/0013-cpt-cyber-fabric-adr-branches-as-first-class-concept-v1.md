---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0013: Branches as a First-Class Concept

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No First-Class Branch Concept](#option-1-no-first-class-branch-concept)
  - [Option 2: First-Class Branches with Read and Lifecycle CLI but No Full Porcelain](#option-2-first-class-branches-with-read-and-lifecycle-cli-but-no-full-porcelain)
  - [Option 3: Full Git Porcelain Including Merge, Rebase, and Push](#option-3-full-git-porcelain-including-merge-rebase-and-push)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-branches-as-first-class-concept`

## Context and Problem Statement

Cyber Fabric workspaces (ADR-0011) collect folders and repositories, but the platform currently has no understanding of git branches inside those repositories. As soon as Fabric needs to answer questions like "which branches in this workspace have no worktree?", "which branches have been deleted on the remote but still exist locally?", or "what is the upstream of branch X?", every consumer is left to call `git` directly and parse free-form output. The same problem amplifies once a Fabric web UI is on the roadmap: a structured workspace view needs structured branch data, not on-demand shell parsing.

The platform therefore needs a first-class branch concept: structured branch data, a stable CLI surface that emits it (so that both terminal users and the future web UI consume the same model), and workspace-level aggregation that spans every repository in the active Fabric workspace. The platform does not need to replace `git` or `gh` for write-heavy operations such as `merge`, `rebase`, `push`, `fetch`, or `cherry-pick` — those operations are fine where they live today.

## Decision Drivers

* **Web UI readiness** — the planned Fabric web UI needs structured branch data, which forces a stable data model regardless of CLI ergonomics
* **Workspace aggregation** — branches in a workspace span multiple repositories; users need a single command that lists or filters them all
* **Workspace-level filters** — operationally important filters (`--orphan`, `--gone`, `--stale`) are not solvable by `git` alone because they are workspace-level concerns
* **Stable consumer contract** — other tools, agents, and integrations must be able to call one canonical command and parse JSON instead of regex-ing porcelain output
* **Bounded scope** — the platform must avoid becoming a parallel git porcelain for operations that `git` and `gh` already handle well
* **Composability with worktrees** — the worktree first-class concept (ADR-0014) consumes branch data; both must share the same model

## Considered Options

1. **No First-Class Branch Concept** — Fabric does not model branches; consumers call `git` directly when they need branch information
2. **First-Class Branches with Read and Lifecycle CLI but No Full Porcelain** — Fabric exposes structured branch data, list / info / create / delete / rename / track operations, and workspace-aware filters; merge / rebase / push remain in `git` and `gh`
3. **Full Git Porcelain Including Merge, Rebase, and Push** — Fabric exposes a complete branch-operation CLI that mirrors and replaces day-to-day `git` and `gh` usage

## Decision Outcome

Chosen option: **Option 2 — First-Class Branches with Read and Lifecycle CLI but No Full Porcelain**, because Cyber Fabric needs structured, workspace-aware branch knowledge to serve both the CLI and the planned web UI from one model, but it does not benefit from re-implementing `merge`, `rebase`, or `push` operations that `git` and `gh` already handle well.

A **branch** in Cyber Fabric is structured data that exists independently of any worktree — a branch can have no worktree at all and is still a first-class object. Fabric's branch model represents at minimum:

* `name` — branch name
* `repo` — workspace member repository the branch belongs to
* `upstream` — tracked remote branch, if any
* `last_commit` — `{sha, message, author, date}`
* `ahead` / `behind` — commit deltas relative to upstream
* `has_worktree` — whether any worktree currently has this branch checked out
* `gone` — whether the upstream remote branch has been deleted
* `stale` — whether no new commits have landed on this branch within a configurable window

The CLI surface is:

* `fabric branch list [--repo <r>] [--orphan] [--gone] [--stale[=<days>]] [--json]` — list branches across the workspace; defaults to scanning every workspace member repository, can be narrowed with `--repo`. Filters compose. `--orphan` returns branches with no worktree; `--gone` returns branches whose upstream remote branch has been deleted; `--stale` returns branches with no new commits in the given window.
* `fabric branch info <name> [--repo <r>] [--json]` — return the structured record for one branch
* `fabric branch create <name> [--from <ref>] [--repo <r>]` — create a new branch
* `fabric branch delete <name> [--repo <r>] [--force]` — delete a branch
* `fabric branch rename <old> <new> [--repo <r>]` — rename a branch
* `fabric branch track <upstream> [--name <name>] [--repo <r>]` — set upstream tracking
* `fabric branch untrack [--name <name>] [--repo <r>]` — remove upstream tracking

The structured `--json` output is the canonical machine contract; both the CLI's human-readable rendering and the future web UI consume the same data. Operations explicitly out of scope: `merge`, `rebase`, `push`, `fetch`, `cherry-pick`, conflict resolution, stashing, and any other write-heavy git surface — those remain in `git` and `gh`. Worktree-related operations such as `fabric worktree merge` compose Fabric's branch primitives with worktree primitives but are owned by ADR-0014, not by this ADR.

### Consequences

* Good, because both the CLI and the future web UI consume one structured branch model from one source of truth
* Good, because workspace-aware filters such as `--orphan`, `--gone`, and `--stale` answer real workspace-level questions that plain `git` cannot answer in one command
* Good, because cross-repo aggregation is built into `list` instead of forced onto each consumer
* Good, because the platform avoids becoming a parallel git porcelain by leaving merge, rebase, and push to `git` and `gh`
* Good, because ADR-0014's worktree model has a stable branch model to consume
* Bad, because the platform must keep its branch data model in sync with what `git` actually exposes as the underlying source of truth
* Bad, because filters like `--stale` need a configurable window whose default belongs to follow-on design
* Bad, because users coming from monolithic git porcelains may initially expect `fabric branch merge` and need to be redirected to `git` or `gh`

### Confirmation

Confirmed when:

* `fabric branch list`, `fabric branch info`, `fabric branch create`, `fabric branch delete`, `fabric branch rename`, `fabric branch track`, and `fabric branch untrack` are implemented and behave as the canonical operations defined above
* `fabric branch list --json` returns the structured record described in this ADR for every branch, with `--orphan`, `--gone`, and `--stale` filters honored
* cross-repo aggregation is the default, narrowable with `--repo`
* `merge`, `rebase`, `push`, `fetch`, and `cherry-pick` are explicitly not present in `fabric branch` and are documented as belonging to `git` and `gh`
* the worktree CLI in ADR-0014 consumes this branch data model rather than re-implementing it

## Pros and Cons of the Options

### Option 1: No First-Class Branch Concept

Do not model branches in Fabric; consumers call `git` directly.

* Good, because the platform avoids owning a branch data model
* Good, because the initial CLI surface stays smaller
* Bad, because the future web UI has nothing structured to render
* Bad, because workspace-level filters (`--orphan`, `--gone`, `--stale`) must be reinvented by every consumer
* Bad, because the worktree first-class concept (ADR-0014) has no branch model to compose with

### Option 2: First-Class Branches with Read and Lifecycle CLI but No Full Porcelain

Expose structured branch data and list / info / create / delete / rename / track operations; leave merge, rebase, and push to `git` and `gh`.

* Good, because both the CLI and the web UI consume one model
* Good, because workspace-aware filters answer real questions in one command
* Good, because Fabric does not duplicate `git` and `gh` for the operations they already do well
* Good, because the branch model composes cleanly with the worktree model in ADR-0014
* Bad, because the platform must maintain its branch data model in sync with the underlying git state
* Bad, because the boundary "Fabric handles read and lifecycle, `git`/`gh` handles merge / rebase / push" must be documented clearly to avoid surprised users

### Option 3: Full Git Porcelain Including Merge, Rebase, and Push

Re-implement a complete branch-operation CLI that mirrors and replaces day-to-day `git` and `gh` usage.

* Good, because users get one tool for everything
* Good, because the web UI can drive every operation through Fabric without falling out to `git` or `gh`
* Bad, because Fabric ends up as a parallel porcelain that has to track every git edge case
* Bad, because users already have `git` and `gh` muscle memory and a parallel CLI invites confusion
* Bad, because conflict resolution, history rewriting, and remote interaction surfaces are large, evolving, and not where Fabric adds unique value

## More Information

The CLI surface defined by this ADR:

* `fabric branch list [--repo <r>] [--orphan] [--gone] [--stale[=<days>]] [--json]`
* `fabric branch info <name> [--repo <r>] [--json]`
* `fabric branch create <name> [--from <ref>] [--repo <r>]`
* `fabric branch delete <name> [--repo <r>] [--force]`
* `fabric branch rename <old> <new> [--repo <r>]`
* `fabric branch track <upstream> [--name <name>] [--repo <r>]`
* `fabric branch untrack [--name <name>] [--repo <r>]`

The implementation uses `simple-git` as the git interaction library — see ADR-0014 for the rationale (no official git SDK exists for TypeScript, and only `simple-git` provides full worktree support that ADR-0014 requires; `fabric branch` reuses the same library for consistency).

The default value for `--stale=<days>`, the precise output schema (field names, ordering, optional fields), and the resolution rules when a branch name collides across multiple workspace repos under the implicit `--repo`-less form are intentionally left to follow-on design. The structured contract this ADR fixes is the existence of `--json` output and the minimum field set listed in the Decision Outcome.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-git-branches-first-class`, `cpt-cyber-fabric-fr-git-workspace-aggregation`, `cpt-cyber-fabric-usecase-dev-browse-git-domain`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0014](0014-cpt-cyber-fabric-adr-worktrees-as-first-class-with-hybrid-ownership-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must model branches as first-class structured data
* the branch CLI surface must support list / info / create / delete / rename / track operations
* `merge`, `rebase`, `push`, `fetch`, and `cherry-pick` are explicitly out of scope and remain with `git` and `gh`
* workspace-aware filters `--orphan`, `--gone`, and `--stale` are first-class operations
* `fabric branch list` defaults to scanning every workspace member repository
* the structured `--json` output is the canonical machine contract serving both CLI and the future web UI
* the worktree first-class concept (ADR-0014) consumes this branch data model
