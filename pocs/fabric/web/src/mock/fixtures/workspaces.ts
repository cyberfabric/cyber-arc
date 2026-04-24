import type { Workspace } from '../../types';

export const FIXTURE_WORKSPACES: Workspace[] = [
  /* fabric-core */
  {
    id: 'fabric-core',
    name: 'fabric-core',
    description: 'TypeScript library for fabric kits & marketplaces.',
    files: [
      {
        path: 'README.md',
        language: 'markdown',
        content:
`# fabric-core

A tiny TypeScript library that powers fabric's kits and marketplaces.

## Features

- **Kits** — install, update, uninstall prompt/rule bundles.
- **Marketplaces** — add and browse kit sources.
- **Zero runtime deps** — pure TypeScript.

## Install

\`\`\`bash
npm install fabric-core
\`\`\`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for internals.
`,
        summary: 'provides the public API surface for fabric-core (kits + marketplaces re-exports)',
      },
      {
        path: 'src/index.ts',
        language: 'typescript',
        content:
`// Entry point for fabric-core.
import * as kits from './kits';
import * as marketplaces from './marketplaces';

export const fabric = {
  kits,
  marketplaces,
};

export type { Kit, Scope } from './kits';
export type { Marketplace } from './marketplaces';
`,
        summary: 're-exports kits and marketplaces as the unified fabric namespace',
      },
      {
        path: 'src/kits.ts',
        language: 'typescript',
        content:
`import type { Marketplace } from './marketplaces';

export type Scope = 'project' | 'global';

export interface Kit {
  name: string;
  version: string;
  scope: Scope;
  files: string[];
}

const installed: Kit[] = [];

export function list(scope: Scope | 'both'): Kit[] {
  if (scope === 'both') return [...installed];
  return installed.filter((k) => k.scope === scope);
}

export function install(kit: Kit): void {
  if (installed.some((k) => k.name === kit.name && k.scope === kit.scope)) {
    throw new Error(\`Kit \${kit.name} already at \${kit.scope}\`);
  }
  installed.push(kit);
}

export function uninstall(name: string, scope: Scope): void {
  const idx = installed.findIndex((k) => k.name === name && k.scope === scope);
  if (idx >= 0) installed.splice(idx, 1);
}
`,
        summary: 'manages in-memory installed kit list with scope-aware install/uninstall',
      },
      {
        path: 'src/marketplaces.ts',
        language: 'typescript',
        content:
`export interface Marketplace {
  name: string;
  url: string;
  kits: string[];
}

const registered: Marketplace[] = [];

export function list(): Marketplace[] {
  return [...registered];
}

export function add(m: Marketplace): void {
  if (registered.some((r) => r.name === m.name)) {
    throw new Error(\`Marketplace \${m.name} already registered\`);
  }
  registered.push(m);
}

export function remove(name: string): void {
  const idx = registered.findIndex((r) => r.name === name);
  if (idx >= 0) registered.splice(idx, 1);
}
`,
        summary: 'tracks registered marketplaces and exposes add/remove/list',
      },
      {
        path: 'package.json',
        language: 'json',
        content:
`{
  "name": "fabric-core",
  "version": "0.4.1",
  "description": "Kits & marketplaces for fabric",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "node --test"
  },
  "license": "Apache-2.0"
}
`,
        summary: 'npm manifest pinning fabric-core version and build scripts',
      },
      {
        path: 'docs/ARCHITECTURE.md',
        language: 'markdown',
        content:
`# Architecture

\`fabric-core\` is split into three conceptual layers:

## 1. Data model

- **Kit** — a bundle of prompt and rule files tied to a version and scope.
- **Marketplace** — a named source of Kits, typically a git repository.

## 2. Installed state

Installed kits live in a single in-memory list. Mutation goes through \`kits.install\` and \`kits.uninstall\`, which enforce the invariant:

> A kit name is unique per scope.

## 3. Public API

The \`fabric\` namespace object (see \`src/index.ts\`) is the only supported entry point. Internal modules (\`kits\`, \`marketplaces\`) are implementation details.

### Future work

- Persistent storage (currently in-memory).
- Subscription API for state changes.
`,
        summary: 'three-layer breakdown of fabric-core: data model, state, and public API',
      },
    ],
  },
  /* sdlc-kit */
  {
    id: 'sdlc-kit',
    name: 'sdlc-kit',
    description: 'Markdown-heavy kit with SDLC prompts and rules.',
    files: [
      {
        path: 'README.md',
        language: 'markdown',
        content:
`# sdlc-kit

Prompts and rules for the SDLC artifact chain: **PRD → Design → ADR → Feature → PR Review**.

## What's inside

- \`prompts/\` — authoring prompts for each stage.
- \`rules/\` — code-style rules that apply across stages.
- \`kit.toml\` — manifest consumed by fabric.
`,
        summary: 'overview of the sdlc-kit layout (prompts, rules, manifest)',
      },
      {
        path: 'prompts/pr-review.md',
        language: 'markdown',
        content:
`# PR Review Prompt

You are a senior engineer reviewing a pull request. Your job is to provide
high-signal feedback that helps the author ship.

## Inputs

1. PR title and description
2. Diff hunks
3. Linked issue or spec, if any

## Review structure

### Summary
One paragraph describing what the PR does.

### Blocking issues
Bugs, security issues, missing tests. Each item includes a file:line reference.

### Non-blocking suggestions
Readability, naming, small refactors.

### Questions
Things you're not sure about.

## Tone

Be direct and specific. Don't hedge on blocking issues. Don't pile on
non-blocking nits — focus on the top 3 most impactful.

## Example

\`\`\`
### Blocking

- \`src/auth.ts:42\` — the token refresh path never fires \`onError\`, so UI shows a blank state on failure.

### Suggestions

- \`src/auth.ts:18\` — extract the \`decodeJwt\` helper, it's duplicated in two files.
\`\`\`

That's it. Review away.
`,
        summary: 'structured PR-review prompt with summary / blocking / suggestions / questions sections',
      },
      {
        path: 'prompts/spec-generator.md',
        language: 'markdown',
        content:
`# Spec Generator

Produce a concise specification for a feature given a one-paragraph idea.

## Required fields

| Field | Description |
|-------|-------------|
| Goal | One sentence: what the feature does. |
| Users | Who benefits. |
| Scope | What's in v1. |
| Out of scope | What's explicitly deferred. |
| Acceptance | How we know it works. |

## Format

Return markdown with the above headings as H2. Keep each section ≤ 4 bullets.
`,
        summary: 'template prompting an agent to produce a short, structured spec',
      },
      {
        path: 'prompts/planning.spec.md',
        language: 'markdown',
        content:
`# Planning Spec

## Goal

Turn a validated spec into a tasked implementation plan.

## Users

Engineers picking up a plan they didn't author.

## Scope

- Bite-sized tasks (2-5 min per step).
- Exact file paths and code in every step.
- Tests before implementation.

## Out of scope

- Prescribing the implementation language.
- Choosing the testing framework (the caller supplies it).

## Acceptance

A fresh engineer can execute the plan top-to-bottom and produce a working feature without asking clarifying questions.
`,
        summary: 'spec for how planning prompts should turn validated specs into plans',
      },
      {
        path: 'rules/code-style.md',
        language: 'markdown',
        content:
`# Code-Style Rules

Opinionated rules applied across SDLC prompts.

- Prefer small functions (< 30 lines).
- No deep nesting (> 3 levels is a smell).
- Name booleans with \`is\` / \`has\` / \`should\` prefix.
- Reject comments that restate the code.
- Errors bubble up by default; catch only when you can recover.
- Tests live next to the code they verify.
- Every public function has a single-sentence docstring.
`,
        summary: 'seven code-style rules covering size, naming, comments, error flow, tests',
      },
      {
        path: 'kit.toml',
        language: 'toml',
        content:
`name = "sdlc-kit"
version = "0.4.1"
description = "Planning, ADR, design, and PR-review prompts"
author = "Cyber Fabric"

[prompts]
pr-review = "prompts/pr-review.md"
spec-generator = "prompts/spec-generator.md"
planning = "prompts/planning.spec.md"

[rules]
code-style = "rules/code-style.md"
`,
        summary: 'TOML manifest enumerating prompts and rules files',
      },
    ],
  },
  /* orchestrator-demo */
  {
    id: 'orchestrator-demo',
    name: 'orchestrator-demo',
    description: 'Mixed-language orchestrator sample.',
    files: [
      {
        path: 'README.md',
        language: 'markdown',
        content:
`# orchestrator-demo

A tiny demo orchestrator that drives multiple agents through a plan.

- **Python** — orchestrator body (\`orchestrator.py\`).
- **Shell** — environment setup (\`scripts/setup.sh\`).
- **JSON** — configuration (\`config.json\`).

See \`docs/NOTES.md\` for design rationale.
`,
        summary: 'overview: Python orchestrator driven by shell setup and JSON config',
      },
      {
        path: 'orchestrator.py',
        language: 'python',
        content:
`"""Orchestrator that fans plan tasks across registered agents."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable


@dataclass
class Task:
    id: str
    prompt: str
    agent: str


@dataclass
class Agent:
    name: str
    run: Callable[[str], str]


class Orchestrator:
    def __init__(self, agents: Iterable[Agent]) -> None:
        self._agents = {a.name: a for a in agents}

    def execute(self, tasks: Iterable[Task]) -> list[tuple[str, str]]:
        results: list[tuple[str, str]] = []
        for task in tasks:
            agent = self._agents.get(task.agent)
            if agent is None:
                raise KeyError(f"unknown agent: {task.agent}")
            results.append((task.id, agent.run(task.prompt)))
        return results


def build(agents: Iterable[Agent]) -> Orchestrator:
    return Orchestrator(agents)
`,
        summary: 'Orchestrator class that dispatches tasks to named agents, plus a build() factory',
      },
      {
        path: 'scripts/setup.sh',
        language: 'bash',
        content:
`#!/usr/bin/env bash
set -euo pipefail

# Bootstrap the orchestrator demo environment.

if ! command -v python3 >/dev/null; then
  echo "python3 not found" >&2
  exit 1
fi

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "Environment ready. Run: python orchestrator.py"
`,
        summary: 'creates a Python venv, installs deps, and prints a run hint',
      },
      {
        path: 'config.json',
        language: 'json',
        content:
`{
  "version": "1.0",
  "agents": [
    { "name": "claude", "endpoint": "https://example/claude" },
    { "name": "codex", "endpoint": "https://example/codex" }
  ],
  "defaults": {
    "timeoutSec": 30,
    "maxParallel": 2
  }
}
`,
        summary: 'demo config listing two agents and default timing/parallelism settings',
      },
      {
        path: 'docs/NOTES.md',
        language: 'markdown',
        content:
`# Design Notes

## Why Python?

The orchestrator is I/O-bound. Python's \`asyncio\` — and its plentiful
HTTP libs like \`httpx\` — make fanning tasks out simple.

## Why not run agents in parallel?

In a real orchestrator, yes. This demo is intentionally sequential to
keep the sample small. See \`orchestrator.py\` — the \`for task in tasks\`
loop is the pivot point where concurrency would go.

## Calling convention

Each \`Agent.run\` receives a prompt string (inline markdown is fine) and
returns the final response. Streaming is out of scope for the demo.

\`\`\`python
from orchestrator import Agent, Task, build
agents = [Agent("claude", lambda p: f"[stub] {p}")]
orch = build(agents)
orch.execute([Task("t1", "hello", "claude")])
\`\`\`
`,
        summary: 'design notes covering language choice, concurrency decision, and calling convention',
      },
    ],
  },
];
