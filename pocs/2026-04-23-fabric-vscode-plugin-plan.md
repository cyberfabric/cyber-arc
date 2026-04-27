# Fabric VS Code Plugin PoC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a UI-only VS Code extension that demonstrates the fabric plugin UX end-to-end against an in-memory mock library, satisfying the 10 demo flows in Section 14 of `2026-04-23-fabric-vscode-plugin-design.md`.

**Architecture:** Single TypeScript VS Code extension, three TreeViews in an activity-bar container (My Kits / Store / Agents). The `fabricLib` import resolves to a mock module with a singleton in-memory state that feeds all views and commands. No git, no shell, no filesystem writes outside the extension's own storage, no automated tests.

**Tech Stack:** TypeScript 5.x, Node 18+, `@types/vscode` (VS Code 1.85+), esbuild for bundling, VS Code Extension API (TreeView, QuickPick, Walkthroughs, OutputChannel, StatusBar).

**Plan location:** `.workspace-sources/cyberfabric/cyber-fabric/pocs/` (alongside the spec).

**Extension location:** `.workspace-sources/cyberfabric/cyber-fabric/pocs/fabric-vscode/` (new sibling of existing `fabric/` and `fabric-kits/`).

**Git note:** the submodule `cyber-fabric` is on branch `adrs` with unrelated pending deletions in `poc/*`. When committing, stage specific paths only (`git add pocs/fabric-vscode/<file>`) — never `git add -A`.

**No tests.** Each task's verification is: launch the Extension Development Host (`F5` in VS Code with the extension folder open, or `code --extensionDevelopmentPath=.`), perform the stated manual check, commit.

---

## Task 1: Scaffold the extension project

**Files:**
- Create: `pocs/fabric-vscode/package.json`
- Create: `pocs/fabric-vscode/tsconfig.json`
- Create: `pocs/fabric-vscode/.vscodeignore`
- Create: `pocs/fabric-vscode/.gitignore`
- Create: `pocs/fabric-vscode/esbuild.js`
- Create: `pocs/fabric-vscode/media/fabric-icon.svg`
- Create: `pocs/fabric-vscode/src/extension.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "fabric-vscode",
  "displayName": "Fabric",
  "description": "Manage fabric kits, marketplaces, and agent registration",
  "version": "0.0.1",
  "private": true,
  "publisher": "cyberfabric",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "fabric",
          "title": "Fabric",
          "icon": "media/fabric-icon.svg"
        }
      ]
    },
    "views": {
      "fabric": [
        { "id": "fabric.kits", "name": "My Kits" },
        { "id": "fabric.store", "name": "Store" },
        { "id": "fabric.agents", "name": "Agents" }
      ]
    },
    "commands": [],
    "menus": {}
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "build": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "compile-types": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.20.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "dist",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `esbuild.js`**

```js
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const ctx = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  format: 'cjs',
  sourcemap: true,
  loader: { '.json': 'json' },
};

(async () => {
  if (watch) {
    const context = await esbuild.context(ctx);
    await context.watch();
    console.log('esbuild watching…');
  } else {
    await esbuild.build(ctx);
    console.log('esbuild build complete');
  }
})().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Create `.vscodeignore`**

```
.vscode/**
.vscode-test/**
src/**
tsconfig.json
esbuild.js
**/*.map
**/tsconfig.tsbuildinfo
node_modules/**
!node_modules/vscode/**
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
*.vsix
```

- [ ] **Step 6: Create `media/fabric-icon.svg`**

A minimalist icon for the activity bar. VS Code expects 24x24 monochrome SVG, currentColor fill.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
</svg>
```

- [ ] **Step 7: Create `src/extension.ts` (stub)**

```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  console.log('[fabric] extension activated');
}

export function deactivate(): void {}
```

- [ ] **Step 8: Install deps and verify build**

Run from `pocs/fabric-vscode/`:
```bash
npm install
npm run build
```

Expected: `dist/extension.js` is produced without errors.

- [ ] **Step 9: Launch Extension Development Host**

Open `pocs/fabric-vscode/` in VS Code. Press `F5` ("Run Extension"). A new VS Code window opens. In the Output panel of the new window, pick "Log (Extension Host)" — confirm the line `[fabric] extension activated` appears.

The Activity Bar should show a new Fabric icon. Clicking it shows three empty view sections: My Kits, Store, Agents. (Empty because no TreeDataProviders yet — next tasks add them.)

- [ ] **Step 10: Commit**

```bash
git add pocs/fabric-vscode/package.json \
        pocs/fabric-vscode/tsconfig.json \
        pocs/fabric-vscode/.vscodeignore \
        pocs/fabric-vscode/.gitignore \
        pocs/fabric-vscode/esbuild.js \
        pocs/fabric-vscode/media/fabric-icon.svg \
        pocs/fabric-vscode/src/extension.ts
git commit -m "feat(fabric-vscode): scaffold extension with activity bar"
```

---

## Task 2: Types module

**Files:**
- Create: `pocs/fabric-vscode/src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export type Scope = 'project' | 'global';

export type KitSource =
  | { source: 'url'; url: string; version: string }
  | { source: 'git-subdir'; url: string; path: string; version: string }
  | string; // relative path inside marketplace

export interface MarketplaceKit {
  name: string;
  description: string;
  category: string;
  author?: { name: string; email?: string };
  homepage?: string;
  source: KitSource;
  /** Resolved semver version; pre-release suffix means unstable channel. */
  version: string;
  /** Files the kit would install — used for mock diff preview. */
  files: string[];
  /** Marker for intentionally broken fixture entries. */
  broken?: { reason: string };
}

export interface Marketplace {
  name: string;
  description: string;
  owner: { name: string; email?: string };
  kits: MarketplaceKit[];
  /** Raw source string the user provided (git URL or local path). */
  addedFrom: string;
}

export interface InstalledKit {
  name: string;
  description: string;
  category: string;
  version: string;
  scope: Scope;
  source: KitSource;
  files: string[];
  /** Only set when a newer marketplace version exists. */
  updateAvailable?: { latest: string };
}

export interface AgentInfo {
  id: string;
  name: string;
  detected: boolean;
  registered: boolean;
  registeredScope?: 'default' | 'project' | 'global' | 'project+global';
  promptCount: number;
}

export type RegisterScope = 'default' | 'project' | 'global' | 'project+global';

export interface RegisterResult {
  agents: string[];
  scope: RegisterScope;
  filesTouched: string[];
}

export interface UnregisterResult {
  agents: string[];
  filesRemoved: string[];
}

export interface UpdateResult {
  name: string;
  scope: Scope;
  before: string;
  after: string;
  /** Files that would change (mock diff). */
  files: { added: string[]; removed: string[]; changed: string[] };
}

export interface CliDetection {
  found: boolean;
  version?: string;
  path?: string;
  compatible?: boolean;
}
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
npm run compile-types
```

Expected: exits cleanly.

- [ ] **Step 3: Commit**

```bash
git add pocs/fabric-vscode/src/types.ts
git commit -m "feat(fabric-vscode): domain types for kits, marketplaces, agents"
```

---

## Task 3: Fixture data

**Files:**
- Create: `pocs/fabric-vscode/src/mock/fixtures/marketplaces.ts`

- [ ] **Step 1: Create `src/mock/fixtures/marketplaces.ts`**

One file so the fixtures stay co-located and round-trip through TypeScript type checking (cheaper than JSON schema validation).

```ts
import type { Marketplace } from '../../types';

export const FIXTURE_MARKETPLACES: Marketplace[] = [
  {
    name: 'cyber-fabric-official',
    description: 'Curated fabric kits maintained by Cyber Fabric',
    owner: { name: 'Cyber Fabric', email: 'support@cyberfabric.dev' },
    addedFrom: 'https://github.com/cyberfabric/fabric-marketplace.git',
    kits: [
      {
        name: 'review-prompts',
        description: 'Code review prompt pack',
        category: 'development',
        author: { name: 'Cyber Fabric' },
        homepage: 'https://github.com/cyberfabric/review-prompts',
        source: { source: 'url', url: 'https://github.com/cyberfabric/review-prompts.git', version: '1.2.0' },
        version: '1.2.0',
        files: [
          'prompts/review-diff.md',
          'prompts/review-pr.md',
          'scripts/pr-audit.js',
        ],
      },
      {
        name: 'sdlc-kit',
        description: 'Planning, ADR, design prompts for SDLC',
        category: 'sdlc',
        author: { name: 'Cyber Fabric' },
        source: { source: 'git-subdir', url: 'cyberfabric/fabric-monorepo', path: 'kits/sdlc', version: '0.4.1' },
        version: '0.4.1',
        files: [
          'prompts/adr.md',
          'prompts/design.md',
          'prompts/prd.md',
        ],
      },
      {
        name: 'testing-kit',
        description: 'Test strategy and coverage prompts',
        category: 'testing',
        source: { source: 'url', url: 'https://github.com/cyberfabric/testing-kit.git', version: '2.0.0' },
        version: '2.0.0',
        files: ['prompts/test-plan.md', 'prompts/coverage-audit.md'],
      },
      {
        name: 'productivity-pack',
        description: 'Meeting notes, summarizers, todo extractors',
        category: 'productivity',
        source: { source: 'url', url: 'https://github.com/cyberfabric/productivity-pack.git', version: '1.0.3' },
        version: '1.0.3',
        files: ['prompts/summarize.md', 'prompts/extract-todos.md'],
      },
      {
        name: 'prompt-authoring',
        description: 'Author prompts with brainstorm, generate, repair',
        category: 'authoring',
        source: { source: 'url', url: 'https://github.com/cyberfabric/prompt-authoring.git', version: '1.2.0-beta.1' },
        version: '1.2.0-beta.1',
        files: [
          'prompts/prompt-brainstorm.md',
          'prompts/prompt-generate.md',
          'prompts/prompt-repair.md',
        ],
      },
    ],
  },
  {
    name: 'community-demo',
    description: 'Community-contributed kits (demo marketplace)',
    owner: { name: 'Community', email: 'community@example.com' },
    addedFrom: 'https://github.com/example/fabric-community.git',
    kits: [
      {
        name: 'rust-helper',
        description: 'Prompts for Rust codebases',
        category: 'language',
        source: { source: 'url', url: 'https://github.com/example/rust-helper.git', version: '0.9.2' },
        version: '0.9.2',
        files: ['prompts/rust-diagnose.md'],
      },
      {
        name: 'sql-tuner',
        description: 'SQL performance diagnosis prompts',
        category: 'database',
        source: { source: 'url', url: 'https://github.com/example/sql-tuner.git', version: '1.0.0' },
        version: '1.0.0',
        files: ['prompts/explain-plan.md', 'prompts/index-advice.md'],
      },
      {
        name: 'broken-kit',
        description: 'Demonstrates a failing install',
        category: 'demo',
        source: { source: 'url', url: 'https://example.invalid/broken.git', version: 'not-a-semver' },
        version: 'not-a-semver',
        files: [],
        broken: { reason: 'Invalid semver version "not-a-semver"' },
      },
    ],
  },
];
```

- [ ] **Step 2: Verify compile**

```bash
npm run compile-types
```

- [ ] **Step 3: Commit**

```bash
git add pocs/fabric-vscode/src/mock/fixtures/marketplaces.ts
git commit -m "feat(fabric-vscode): bundled marketplace and kit fixtures"
```

---

## Task 4: Mock state singleton

**Files:**
- Create: `pocs/fabric-vscode/src/mock/state.ts`

- [ ] **Step 1: Create `src/mock/state.ts`**

```ts
import { EventEmitter } from 'events';
import type {
  AgentInfo,
  InstalledKit,
  Marketplace,
} from '../types';

export type StateChannel = 'kits' | 'marketplaces' | 'agents' | 'cli';

class MockState {
  installedKits: InstalledKit[] = [];
  marketplaces: Marketplace[] = [];
  agents: AgentInfo[] = [
    { id: 'claude', name: 'Claude Code', detected: true, registered: false, promptCount: 0 },
    { id: 'codex', name: 'Codex', detected: true, registered: false, promptCount: 0 },
    { id: 'cursor', name: 'Cursor', detected: false, registered: false, promptCount: 0 },
  ];
  cliDetected = true;
  cliVersion: string | undefined = '0.2.0';
  cliPath: string | undefined = '/usr/local/bin/fabric';

  private emitter = new EventEmitter();

  on(channel: StateChannel, listener: () => void): void {
    this.emitter.on(channel, listener);
  }

  emit(channel: StateChannel): void {
    this.emitter.emit(channel);
  }

  /** Count of prompts exposed to an agent equals the sum of kit files at active scopes. */
  activePromptCount(): number {
    return this.installedKits.reduce((sum, kit) => sum + kit.files.length, 0);
  }

  reset(): void {
    this.installedKits = [];
    this.marketplaces = [];
    this.agents.forEach((a) => { a.registered = false; a.promptCount = 0; a.registeredScope = undefined; });
    this.cliDetected = true;
    this.cliVersion = '0.2.0';
    this.cliPath = '/usr/local/bin/fabric';
    (['kits', 'marketplaces', 'agents', 'cli'] as StateChannel[]).forEach((c) => this.emit(c));
  }
}

export const state = new MockState();
```

- [ ] **Step 2: Verify compile**

```bash
npm run compile-types
```

- [ ] **Step 3: Commit**

```bash
git add pocs/fabric-vscode/src/mock/state.ts
git commit -m "feat(fabric-vscode): in-memory mock state with event emitter"
```

---

## Task 5: Mock library — marketplaces

**Files:**
- Create: `pocs/fabric-vscode/src/mock/marketplaces.ts`

- [ ] **Step 1: Create `src/mock/marketplaces.ts`**

```ts
import { state } from './state';
import { FIXTURE_MARKETPLACES } from './fixtures/marketplaces';
import type { Marketplace, MarketplaceKit } from '../types';

/** Returns true if `source` string identifies one of the bundled fixtures. */
function resolveFixtureByHint(hint: string): Marketplace | undefined {
  const needle = hint.toLowerCase();
  return FIXTURE_MARKETPLACES.find(
    (m) => m.name === hint || m.addedFrom === hint || needle.includes(m.name),
  );
}

function list(): Marketplace[] {
  return [...state.marketplaces];
}

function add(source: string): Marketplace {
  if (!source.trim()) {
    throw new Error('Marketplace source must not be empty');
  }
  if (state.marketplaces.some((m) => m.addedFrom === source)) {
    throw new Error(`Marketplace already added: ${source}`);
  }
  const fixture = resolveFixtureByHint(source);
  if (!fixture) {
    throw new Error(`Unknown marketplace source in PoC: ${source}. Try "cyber-fabric-official" or "community-demo".`);
  }
  const added: Marketplace = { ...fixture, addedFrom: source };
  state.marketplaces.push(added);
  state.emit('marketplaces');
  return added;
}

function remove(name: string): void {
  const index = state.marketplaces.findIndex((m) => m.name === name);
  if (index === -1) {
    throw new Error(`Unknown marketplace: ${name}`);
  }
  state.marketplaces.splice(index, 1);
  state.emit('marketplaces');
}

function refresh(): { updated: Marketplace[] } {
  return { updated: [...state.marketplaces] };
}

function listKits(name?: string): MarketplaceKit[] {
  const source = name
    ? state.marketplaces.filter((m) => m.name === name)
    : state.marketplaces;
  return source.flatMap((m) => m.kits);
}

export const marketplaces = { list, add, remove, refresh, listKits };
```

- [ ] **Step 2: Verify compile**

```bash
npm run compile-types
```

- [ ] **Step 3: Commit**

```bash
git add pocs/fabric-vscode/src/mock/marketplaces.ts
git commit -m "feat(fabric-vscode): mock marketplace add/remove/refresh"
```

---

## Task 6: Mock library — kits (install / update / uninstall)

**Files:**
- Create: `pocs/fabric-vscode/src/mock/kits.ts`

- [ ] **Step 1: Create `src/mock/kits.ts`**

```ts
import { state } from './state';
import type {
  InstalledKit,
  KitSource,
  MarketplaceKit,
  Scope,
  UpdateResult,
} from '../types';

const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

function assertSemver(version: string): void {
  if (!SEMVER_RE.test(version)) {
    throw new Error(`Invalid semver version: "${version}"`);
  }
}

function resolveMarketplaceKit(marketplaceName: string, kitName: string): MarketplaceKit {
  const marketplace = state.marketplaces.find((m) => m.name === marketplaceName);
  if (!marketplace) {
    throw new Error(`Unknown marketplace: ${marketplaceName}`);
  }
  const kit = marketplace.kits.find((k) => k.name === kitName);
  if (!kit) {
    throw new Error(`Kit not found in ${marketplaceName}: ${kitName}`);
  }
  if (kit.broken) {
    throw new Error(`Cannot install ${kitName}: ${kit.broken.reason}`);
  }
  return kit;
}

function resolveByUrl(url: string, version: string): MarketplaceKit {
  for (const m of state.marketplaces) {
    for (const k of m.kits) {
      if (typeof k.source === 'object' && 'url' in k.source && k.source.url === url) {
        return k;
      }
    }
  }
  throw new Error(`No marketplace kit matches url ${url}. Register the marketplace first or use a known URL.`);
}

type InstallArgs = {
  source: { url: string; version: string } | { marketplace: string; kit: string; version?: string };
  scope: Scope;
};

function list({ scope }: { scope: Scope | 'both' }): InstalledKit[] {
  if (scope === 'both') return [...state.installedKits];
  return state.installedKits.filter((k) => k.scope === scope);
}

function install({ source, scope }: InstallArgs): InstalledKit {
  let mk: MarketplaceKit;
  if ('marketplace' in source) {
    mk = resolveMarketplaceKit(source.marketplace, source.kit);
  } else {
    assertSemver(source.version);
    mk = resolveByUrl(source.url, source.version);
  }
  if (state.installedKits.some((k) => k.name === mk.name && k.scope === scope)) {
    throw new Error(`Kit ${mk.name} is already installed at ${scope} scope`);
  }
  const kitSource: KitSource =
    typeof mk.source === 'string' ? mk.source : { ...mk.source };
  const installed: InstalledKit = {
    name: mk.name,
    description: mk.description,
    category: mk.category,
    version: mk.version,
    scope,
    source: kitSource,
    files: [...mk.files],
  };
  state.installedKits.push(installed);
  state.emit('kits');
  return installed;
}

function findInstalled(name: string, scope: Scope): InstalledKit {
  const hit = state.installedKits.find((k) => k.name === name && k.scope === scope);
  if (!hit) {
    throw new Error(`Kit ${name} is not installed at ${scope} scope`);
  }
  return hit;
}

function update(name: string, scope: Scope): UpdateResult {
  const existing = findInstalled(name, scope);
  const latest = state.marketplaces
    .flatMap((m) => m.kits)
    .find((k) => k.name === name);
  if (!latest) {
    throw new Error(`No marketplace currently offers ${name} — cannot update.`);
  }
  if (latest.version === existing.version) {
    throw new Error(`${name} is already at latest version ${existing.version}`);
  }
  const diff = {
    added: latest.files.filter((f) => !existing.files.includes(f)),
    removed: existing.files.filter((f) => !latest.files.includes(f)),
    changed: latest.files.filter((f) => existing.files.includes(f)),
  };
  const result: UpdateResult = {
    name,
    scope,
    before: existing.version,
    after: latest.version,
    files: diff,
  };
  existing.version = latest.version;
  existing.files = [...latest.files];
  existing.updateAvailable = undefined;
  state.emit('kits');
  return result;
}

function uninstall(name: string, scope: Scope): void {
  const idx = state.installedKits.findIndex((k) => k.name === name && k.scope === scope);
  if (idx === -1) {
    throw new Error(`Kit ${name} is not installed at ${scope} scope`);
  }
  state.installedKits.splice(idx, 1);
  state.emit('kits');
}

export const kits = { list, install, update, uninstall };
```

- [ ] **Step 2: Verify compile**

```bash
npm run compile-types
```

- [ ] **Step 3: Commit**

```bash
git add pocs/fabric-vscode/src/mock/kits.ts
git commit -m "feat(fabric-vscode): mock kit install/update/uninstall"
```

---

## Task 7: Mock library — agents, register, system

**Files:**
- Create: `pocs/fabric-vscode/src/mock/agents.ts`
- Create: `pocs/fabric-vscode/src/mock/system.ts`

- [ ] **Step 1: Create `src/mock/agents.ts`**

```ts
import { state } from './state';
import type { AgentInfo, RegisterResult, RegisterScope, UnregisterResult } from '../types';

function list(): AgentInfo[] {
  return state.agents.map((a) => ({ ...a }));
}

type RegisterOptions = {
  agents?: string[];
  local?: boolean;
  includeGlobal?: boolean;
};

function scopeFromFlags(local?: boolean, includeGlobal?: boolean): RegisterScope {
  if (local && includeGlobal) return 'project+global';
  if (local) return 'project';
  if (includeGlobal) return 'global';
  return 'default';
}

function selectedAgents(opts: RegisterOptions): AgentInfo[] {
  const ids = opts.agents && opts.agents.length > 0
    ? opts.agents
    : state.agents.filter((a) => a.detected).map((a) => a.id);
  const hits: AgentInfo[] = [];
  for (const id of ids) {
    const agent = state.agents.find((a) => a.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    if (!agent.detected) throw new Error(`Agent ${agent.name} is not detected in this environment`);
    hits.push(agent);
  }
  return hits;
}

function register(opts: RegisterOptions): RegisterResult {
  const scope = scopeFromFlags(opts.local, opts.includeGlobal);
  const targets = selectedAgents(opts);
  const filesTouched: string[] = [];
  for (const agent of targets) {
    agent.registered = true;
    agent.registeredScope = scope;
    agent.promptCount = state.activePromptCount();
    filesTouched.push(`.claude/skills/<fabric>/${agent.id}/**`);
  }
  state.emit('agents');
  return { agents: targets.map((a) => a.id), scope, filesTouched };
}

function unregister(opts: RegisterOptions): UnregisterResult {
  const ids = opts.agents && opts.agents.length > 0
    ? opts.agents
    : state.agents.filter((a) => a.registered).map((a) => a.id);
  const filesRemoved: string[] = [];
  for (const id of ids) {
    const agent = state.agents.find((a) => a.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    if (!agent.registered) continue;
    agent.registered = false;
    agent.registeredScope = undefined;
    agent.promptCount = 0;
    filesRemoved.push(`.claude/skills/<fabric>/${agent.id}/**`);
  }
  state.emit('agents');
  return { agents: ids, filesRemoved };
}

export const agents = { list };
export { register, unregister };
```

- [ ] **Step 2: Create `src/mock/system.ts`**

```ts
import { state } from './state';
import type { CliDetection } from '../types';

export const MIN_CLI_VERSION = '0.2.0';

function detectCli(): CliDetection {
  if (!state.cliDetected) {
    return { found: false };
  }
  return {
    found: true,
    version: state.cliVersion,
    path: state.cliPath,
    compatible: state.cliVersion === MIN_CLI_VERSION,
  };
}

function toggleCli(): void {
  state.cliDetected = !state.cliDetected;
  state.emit('cli');
}

function setCliDetected(detected: boolean, version?: string): void {
  state.cliDetected = detected;
  if (version !== undefined) state.cliVersion = version;
  state.emit('cli');
}

export const system = { detectCli, toggleCli, setCliDetected, MIN_CLI_VERSION };
```

- [ ] **Step 3: Verify compile**

```bash
npm run compile-types
```

- [ ] **Step 4: Commit**

```bash
git add pocs/fabric-vscode/src/mock/agents.ts pocs/fabric-vscode/src/mock/system.ts
git commit -m "feat(fabric-vscode): mock agents, register/unregister, system.detectCli"
```

---

## Task 8: fabricLib shim + Output channel

**Files:**
- Create: `pocs/fabric-vscode/src/mock/fabric.ts`
- Create: `pocs/fabric-vscode/src/fabricLib.ts`
- Create: `pocs/fabric-vscode/src/output.ts`

- [ ] **Step 1: Create `src/mock/fabric.ts` — public facade**

```ts
export { kits } from './kits';
export { marketplaces } from './marketplaces';
export { agents, register, unregister } from './agents';
export { system } from './system';
export { state } from './state';
```

- [ ] **Step 2: Create `src/fabricLib.ts` — single import point**

```ts
// The only module in the extension that imports from ./mock/fabric.
// Production swap: replace the below import with `import * as fabric from 'fabric';`
import * as fabric from './mock/fabric';
export default fabric;
```

- [ ] **Step 3: Create `src/output.ts` — shared Output channel**

```ts
import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function fabricOutput(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Fabric');
  }
  return channel;
}

export function logInfo(message: string): void {
  const ts = new Date().toISOString();
  fabricOutput().appendLine(`[${ts}] INFO  ${message}`);
}

export function logError(message: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const reason = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err ?? '');
  fabricOutput().appendLine(`[${ts}] ERROR ${message}${reason ? `\n  ${reason}` : ''}`);
}
```

- [ ] **Step 4: Verify compile**

```bash
npm run compile-types && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add pocs/fabric-vscode/src/mock/fabric.ts \
        pocs/fabric-vscode/src/fabricLib.ts \
        pocs/fabric-vscode/src/output.ts
git commit -m "feat(fabric-vscode): fabricLib shim and Fabric output channel"
```

---

## Task 9: TreeView wiring (empty views with placeholders)

**Files:**
- Create: `pocs/fabric-vscode/src/ui/kitsView.ts`
- Create: `pocs/fabric-vscode/src/ui/storeView.ts`
- Create: `pocs/fabric-vscode/src/ui/agentsView.ts`
- Modify: `pocs/fabric-vscode/src/extension.ts`

- [ ] **Step 1: Create `src/ui/kitsView.ts` (placeholder provider)**

```ts
import * as vscode from 'vscode';
import { state } from '../mock/state';

export type KitNode = { kind: 'placeholder'; label: string };

export class KitsTreeDataProvider implements vscode.TreeDataProvider<KitNode> {
  private readonly _onDidChange = new vscode.EventEmitter<KitNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('kits', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(element: KitNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'fabric.kit.placeholder';
    return item;
  }

  getChildren(): KitNode[] {
    return [{ kind: 'placeholder', label: '(no kits installed)' }];
  }
}
```

- [ ] **Step 2: Create `src/ui/storeView.ts` (placeholder provider)**

```ts
import * as vscode from 'vscode';
import { state } from '../mock/state';

export type StoreNode = { kind: 'placeholder'; label: string };

export class StoreTreeDataProvider implements vscode.TreeDataProvider<StoreNode> {
  private readonly _onDidChange = new vscode.EventEmitter<StoreNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('marketplaces', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(element: StoreNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'fabric.store.placeholder';
    return item;
  }

  getChildren(): StoreNode[] {
    return [{ kind: 'placeholder', label: 'Add a marketplace to browse kits' }];
  }
}
```

- [ ] **Step 3: Create `src/ui/agentsView.ts` (placeholder provider)**

```ts
import * as vscode from 'vscode';
import { state } from '../mock/state';

export type AgentNode = { kind: 'placeholder'; label: string };

export class AgentsTreeDataProvider implements vscode.TreeDataProvider<AgentNode> {
  private readonly _onDidChange = new vscode.EventEmitter<AgentNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('agents', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(element: AgentNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'fabric.agent.placeholder';
    return item;
  }

  getChildren(): AgentNode[] {
    return [{ kind: 'placeholder', label: '(no agents shown yet)' }];
  }
}
```

- [ ] **Step 4: Wire them up in `src/extension.ts`**

Replace the whole file:

```ts
import * as vscode from 'vscode';
import { KitsTreeDataProvider } from './ui/kitsView';
import { StoreTreeDataProvider } from './ui/storeView';
import { AgentsTreeDataProvider } from './ui/agentsView';
import { logInfo } from './output';

export function activate(context: vscode.ExtensionContext): void {
  logInfo('fabric extension activated');

  const kitsProvider = new KitsTreeDataProvider();
  const storeProvider = new StoreTreeDataProvider();
  const agentsProvider = new AgentsTreeDataProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('fabric.kits', kitsProvider),
    vscode.window.registerTreeDataProvider('fabric.store', storeProvider),
    vscode.window.registerTreeDataProvider('fabric.agents', agentsProvider),
  );
}

export function deactivate(): void {}
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Launch Extension Dev Host (`F5`). Open Fabric activity bar item. Confirm each of the three views shows its placeholder row (e.g., "(no kits installed)").

- [ ] **Step 6: Commit**

```bash
git add pocs/fabric-vscode/src/ui/kitsView.ts \
        pocs/fabric-vscode/src/ui/storeView.ts \
        pocs/fabric-vscode/src/ui/agentsView.ts \
        pocs/fabric-vscode/src/extension.ts
git commit -m "feat(fabric-vscode): wire placeholder TreeDataProviders for all three views"
```

---

## Task 10: Kits TreeView — real content

**Files:**
- Modify: `pocs/fabric-vscode/src/ui/kitsView.ts`

- [ ] **Step 1: Replace `src/ui/kitsView.ts` with the real tree**

```ts
import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { state } from '../mock/state';
import type { InstalledKit, Scope } from '../types';

export type KitNode =
  | { kind: 'group'; scope: Scope; label: string; kits: InstalledKit[] }
  | { kind: 'kit'; kit: InstalledKit }
  | { kind: 'empty'; label: string };

export class KitsTreeDataProvider implements vscode.TreeDataProvider<KitNode> {
  private readonly _onDidChange = new vscode.EventEmitter<KitNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('kits', () => this._onDidChange.fire(undefined));
    state.on('marketplaces', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(node: KitNode): vscode.TreeItem {
    if (node.kind === 'group') {
      const item = new vscode.TreeItem(
        `${node.label} (${node.kits.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = `fabric.kits.group.${node.scope}`;
      item.iconPath = new vscode.ThemeIcon('folder');
      return item;
    }
    if (node.kind === 'kit') {
      const item = new vscode.TreeItem(node.kit.name, vscode.TreeItemCollapsibleState.None);
      item.description = `${node.kit.version}${node.kit.updateAvailable ? ` (update → ${node.kit.updateAvailable.latest})` : ''}`;
      item.tooltip = new vscode.MarkdownString(
        `**${node.kit.name}** ${node.kit.version}\n\n${node.kit.description}\n\nScope: \`${node.kit.scope}\``,
      );
      item.contextValue = node.kit.updateAvailable ? 'fabric.kit.updatable' : 'fabric.kit.installed';
      item.iconPath = new vscode.ThemeIcon(node.kit.updateAvailable ? 'sync' : 'package');
      return item;
    }
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'fabric.kits.empty';
    return item;
  }

  getChildren(node?: KitNode): KitNode[] {
    if (!node) {
      const all = fabric.kits.list({ scope: 'both' });
      if (all.length === 0) {
        return [{ kind: 'empty', label: '(no kits installed)' }];
      }
      const project = all.filter((k) => k.scope === 'project');
      const global = all.filter((k) => k.scope === 'global');
      const groups: KitNode[] = [];
      if (project.length > 0) groups.push({ kind: 'group', scope: 'project', label: 'Workspace', kits: project });
      if (global.length > 0) groups.push({ kind: 'group', scope: 'global', label: 'User', kits: global });
      return groups;
    }
    if (node.kind === 'group') {
      return node.kits.map((kit) => ({ kind: 'kit' as const, kit }));
    }
    return [];
  }
}
```

- [ ] **Step 2: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. My Kits view still shows `(no kits installed)` — that's correct; we add installs in later tasks. Type-check the tree still collapses and expands when kits appear (we'll re-verify after Task 14).

- [ ] **Step 3: Commit**

```bash
git add pocs/fabric-vscode/src/ui/kitsView.ts
git commit -m "feat(fabric-vscode): kits tree with workspace/user groups"
```

---

## Task 11: Store TreeView — real content

**Files:**
- Modify: `pocs/fabric-vscode/src/ui/storeView.ts`
- Modify: `pocs/fabric-vscode/src/mock/state.ts`

- [ ] **Step 1: Add `includePrereleases` flag to `state.ts`**

Edit `src/mock/state.ts` — add the field and accessor in the `MockState` class. Insert after `cliPath` line:

```ts
  includePrereleases = false;
```

And in `reset()`:

```ts
    this.includePrereleases = false;
```

Add to the channels list a `'ui'` channel for UI-preference changes. Change the `StateChannel` type:

```ts
export type StateChannel = 'kits' | 'marketplaces' | 'agents' | 'cli' | 'ui';
```

And in the `reset()` channel list:

```ts
    (['kits', 'marketplaces', 'agents', 'cli', 'ui'] as StateChannel[]).forEach((c) => this.emit(c));
```

- [ ] **Step 2: Replace `src/ui/storeView.ts`**

```ts
import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { state } from '../mock/state';
import type { Marketplace, MarketplaceKit } from '../types';

export type StoreNode =
  | { kind: 'marketplace'; marketplace: Marketplace; kits: MarketplaceKit[] }
  | { kind: 'kit'; marketplace: string; kit: MarketplaceKit }
  | { kind: 'empty'; label: string; contextValue: string };

export class StoreTreeDataProvider implements vscode.TreeDataProvider<StoreNode> {
  private readonly _onDidChange = new vscode.EventEmitter<StoreNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('marketplaces', () => this._onDidChange.fire(undefined));
    state.on('ui', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(node: StoreNode): vscode.TreeItem {
    if (node.kind === 'marketplace') {
      const item = new vscode.TreeItem(
        `${node.marketplace.name} (${node.kits.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.description = node.marketplace.description;
      item.tooltip = new vscode.MarkdownString(
        `**${node.marketplace.name}**\n\n${node.marketplace.description}\n\nSource: \`${node.marketplace.addedFrom}\``,
      );
      item.contextValue = 'fabric.marketplace';
      item.iconPath = new vscode.ThemeIcon('organization');
      return item;
    }
    if (node.kind === 'kit') {
      const item = new vscode.TreeItem(node.kit.name, vscode.TreeItemCollapsibleState.None);
      const prerelease = isPrerelease(node.kit.version);
      const brokenSuffix = node.kit.broken ? ' (broken)' : '';
      item.description = `${node.kit.version}${prerelease ? ' · pre-release' : ''}${brokenSuffix}`;
      item.tooltip = new vscode.MarkdownString(
        `**${node.kit.name}** ${node.kit.version}\n\n${node.kit.description}\n\nCategory: ${node.kit.category}`,
      );
      item.contextValue = node.kit.broken ? 'fabric.marketplace.kit.broken' : 'fabric.marketplace.kit';
      item.iconPath = new vscode.ThemeIcon(node.kit.broken ? 'warning' : 'cloud-download');
      item.command = {
        command: 'fabric.kit.installFromStore',
        title: 'Install',
        arguments: [node.marketplace, node.kit.name],
      };
      return item;
    }
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = node.contextValue;
    return item;
  }

  getChildren(node?: StoreNode): StoreNode[] {
    if (!node) {
      const mkts = fabric.marketplaces.list();
      if (mkts.length === 0) {
        return [
          { kind: 'empty', label: 'Run "Fabric: Add Marketplace…" to get started', contextValue: 'fabric.store.empty' },
          { kind: 'empty', label: `Pre-releases: ${state.includePrereleases ? 'shown' : 'hidden'} (toggle via command)`, contextValue: 'fabric.store.prereleaseFlag' },
        ];
      }
      return mkts.map((m) => ({
        kind: 'marketplace' as const,
        marketplace: m,
        kits: filterKits(m.kits),
      }));
    }
    if (node.kind === 'marketplace') {
      return node.kits.map((kit) => ({ kind: 'kit' as const, marketplace: node.marketplace.name, kit }));
    }
    return [];
  }
}

function isPrerelease(version: string): boolean {
  return version.includes('-');
}

function filterKits(kits: MarketplaceKit[]): MarketplaceKit[] {
  if (state.includePrereleases) return kits;
  return kits.filter((k) => !isPrerelease(k.version));
}
```

- [ ] **Step 3: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Store view shows both empty-state placeholders (the second one displays the current pre-releases flag).

- [ ] **Step 4: Commit**

```bash
git add pocs/fabric-vscode/src/ui/storeView.ts \
        pocs/fabric-vscode/src/mock/state.ts
git commit -m "feat(fabric-vscode): store tree with marketplaces, kits, pre-release filter"
```

---

## Task 12: Agents TreeView — real content

**Files:**
- Modify: `pocs/fabric-vscode/src/ui/agentsView.ts`

- [ ] **Step 1: Replace `src/ui/agentsView.ts`**

```ts
import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { state } from '../mock/state';
import type { AgentInfo } from '../types';

export type AgentNode = { kind: 'agent'; agent: AgentInfo };

export class AgentsTreeDataProvider implements vscode.TreeDataProvider<AgentNode> {
  private readonly _onDidChange = new vscode.EventEmitter<AgentNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('agents', () => this._onDidChange.fire(undefined));
    state.on('kits', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(node: AgentNode): vscode.TreeItem {
    const a = node.agent;
    const item = new vscode.TreeItem(a.name, vscode.TreeItemCollapsibleState.None);
    const status: string[] = [];
    status.push(a.detected ? 'detected' : 'not detected');
    if (a.detected) status.push(a.registered ? `registered · ${a.promptCount} prompts` : 'not registered');
    item.description = status.join(' · ');
    item.tooltip = new vscode.MarkdownString(
      `**${a.name}**\n\nDetected: ${a.detected ? '✓' : '✗'}\n\nRegistered: ${a.registered ? `✓ (${a.registeredScope})` : '✗'}\n\nPrompt count: ${a.promptCount}`,
    );
    item.contextValue = a.detected
      ? (a.registered ? 'fabric.agent.registered' : 'fabric.agent.unregistered')
      : 'fabric.agent.unsupported';
    item.iconPath = new vscode.ThemeIcon(
      a.detected ? (a.registered ? 'pass-filled' : 'circle-outline') : 'circle-slash',
    );
    return item;
  }

  getChildren(): AgentNode[] {
    return fabric.agents.list().map((agent) => ({ kind: 'agent' as const, agent }));
  }
}
```

- [ ] **Step 2: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Agents view shows three rows: Claude Code (detected · not registered), Codex (detected · not registered), Cursor (not detected). Icons differ per state.

- [ ] **Step 3: Commit**

```bash
git add pocs/fabric-vscode/src/ui/agentsView.ts
git commit -m "feat(fabric-vscode): agents tree with detection and registration status"
```

---

## Task 13: Error toast helper

**Files:**
- Create: `pocs/fabric-vscode/src/errors.ts`

- [ ] **Step 1: Create `src/errors.ts`**

```ts
import * as vscode from 'vscode';
import { fabricOutput, logError } from './output';

export async function reportError(scope: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  logError(`${scope}: ${message}`, err);
  const choice = await vscode.window.showErrorMessage(`Failed: ${message}`, 'Show Logs');
  if (choice === 'Show Logs') {
    fabricOutput().show(true);
  }
}

export async function runSafely<T>(scope: string, body: () => Promise<T> | T): Promise<T | undefined> {
  try {
    return await body();
  } catch (err) {
    await reportError(scope, err);
    return undefined;
  }
}
```

- [ ] **Step 2: Verify compile**

```bash
npm run compile-types
```

- [ ] **Step 3: Commit**

```bash
git add pocs/fabric-vscode/src/errors.ts
git commit -m "feat(fabric-vscode): reportError/runSafely toast helpers"
```

---

## Task 14: Marketplace commands (Add / Remove / Refresh)

**Files:**
- Create: `pocs/fabric-vscode/src/commands/marketplace.ts`
- Modify: `pocs/fabric-vscode/src/extension.ts`
- Modify: `pocs/fabric-vscode/package.json`

- [ ] **Step 1: Create `src/commands/marketplace.ts`**

```ts
import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { runSafely } from '../errors';
import { logInfo } from '../output';

export function registerMarketplaceCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.marketplace.add', handleAdd),
    vscode.commands.registerCommand('fabric.marketplace.remove', handleRemove),
    vscode.commands.registerCommand('fabric.marketplace.refresh', handleRefresh),
  );
}

async function handleAdd(): Promise<void> {
  const source = await vscode.window.showInputBox({
    prompt: 'Marketplace git URL or local path',
    placeHolder: 'cyber-fabric-official  or  https://github.com/…',
    ignoreFocusOut: true,
  });
  if (!source) return;
  await runSafely('marketplace.add', async () => {
    const mk = fabric.marketplaces.add(source.trim());
    logInfo(`Added marketplace: ${mk.name} (${mk.kits.length} kits)`);
    await vscode.window.showInformationMessage(`Added marketplace: ${mk.name}`);
  });
}

async function handleRemove(): Promise<void> {
  const list = fabric.marketplaces.list();
  if (list.length === 0) {
    await vscode.window.showInformationMessage('No marketplaces to remove');
    return;
  }
  const picked = await vscode.window.showQuickPick(
    list.map((m) => ({ label: m.name, description: m.description, mkt: m })),
    { placeHolder: 'Select marketplace to remove', ignoreFocusOut: true },
  );
  if (!picked) return;
  await runSafely('marketplace.remove', async () => {
    fabric.marketplaces.remove(picked.mkt.name);
    logInfo(`Removed marketplace: ${picked.mkt.name}`);
    await vscode.window.showInformationMessage(`Removed ${picked.mkt.name}`);
  });
}

async function handleRefresh(): Promise<void> {
  await runSafely('marketplace.refresh', async () => {
    const { updated } = fabric.marketplaces.refresh();
    logInfo(`Refreshed ${updated.length} marketplace(s)`);
    await vscode.window.showInformationMessage(`Refreshed ${updated.length} marketplace(s)`);
  });
}
```

- [ ] **Step 2: Wire into `extension.ts`**

Add import:
```ts
import { registerMarketplaceCommands } from './commands/marketplace';
```

In `activate()` after registering providers:
```ts
  registerMarketplaceCommands(context);
```

- [ ] **Step 3: Declare commands in `package.json`**

Replace the `"commands": []` array inside `"contributes"` with:

```json
    "commands": [
      { "command": "fabric.marketplace.add",     "title": "Fabric: Add Marketplace…" },
      { "command": "fabric.marketplace.remove",  "title": "Fabric: Remove Marketplace" },
      { "command": "fabric.marketplace.refresh", "title": "Fabric: Refresh Marketplaces" }
    ],
```

Add a view title-bar action for Refresh. Replace `"menus": {}` with:

```json
    "menus": {
      "view/title": [
        {
          "command": "fabric.marketplace.refresh",
          "when": "view == fabric.store",
          "group": "navigation"
        },
        {
          "command": "fabric.marketplace.add",
          "when": "view == fabric.store",
          "group": "navigation"
        }
      ]
    }
```

- [ ] **Step 4: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Command Palette → `Fabric: Add Marketplace…` → type `cyber-fabric-official` → Enter. Expect success toast. Store view now shows `cyber-fabric-official (4 kits)` (one pre-release filtered). Expand to see kits.

Repeat: `Fabric: Add Marketplace…` → `community-demo`. Both marketplaces now show. `Fabric: Remove Marketplace` → pick `community-demo` → removed.

Store view header: two icon buttons appear — "+" for Add, refresh icon for Refresh.

- [ ] **Step 5: Commit**

```bash
git add pocs/fabric-vscode/src/commands/marketplace.ts \
        pocs/fabric-vscode/src/extension.ts \
        pocs/fabric-vscode/package.json
git commit -m "feat(fabric-vscode): Add/Remove/Refresh Marketplace commands"
```

---

## Task 15: Pre-releases toggle command

**Files:**
- Create: `pocs/fabric-vscode/src/commands/ui.ts`
- Modify: `pocs/fabric-vscode/src/extension.ts`
- Modify: `pocs/fabric-vscode/package.json`

- [ ] **Step 1: Create `src/commands/ui.ts`**

```ts
import * as vscode from 'vscode';
import { state } from '../mock/state';
import { logInfo } from '../output';

export function registerUiCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.store.togglePrereleases', async () => {
      state.includePrereleases = !state.includePrereleases;
      state.emit('ui');
      logInfo(`Pre-releases: ${state.includePrereleases ? 'shown' : 'hidden'}`);
      await vscode.window.showInformationMessage(
        `Pre-releases are now ${state.includePrereleases ? 'shown' : 'hidden'} in Store`,
      );
    }),
  );
}
```

- [ ] **Step 2: Declare command in `package.json`**

Add inside `"contributes.commands"`:
```json
      { "command": "fabric.store.togglePrereleases", "title": "Fabric: Toggle Pre-releases in Store" }
```

Add a title-bar entry for the Store view:
```json
        {
          "command": "fabric.store.togglePrereleases",
          "when": "view == fabric.store",
          "group": "navigation"
        }
```

- [ ] **Step 3: Wire in `extension.ts`**

```ts
import { registerUiCommands } from './commands/ui';
// …
  registerUiCommands(context);
```

- [ ] **Step 4: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Add `cyber-fabric-official`. Store shows 4 kits. Run `Fabric: Toggle Pre-releases in Store`. Store now shows 5 kits including `prompt-authoring 1.2.0-beta.1 · pre-release`. Toggle back — returns to 4.

- [ ] **Step 5: Commit**

```bash
git add pocs/fabric-vscode/src/commands/ui.ts \
        pocs/fabric-vscode/src/extension.ts \
        pocs/fabric-vscode/package.json
git commit -m "feat(fabric-vscode): toggle pre-releases in Store"
```

---

## Task 16: Install kit (from URL and from Store)

**Files:**
- Create: `pocs/fabric-vscode/src/commands/kit.ts`
- Modify: `pocs/fabric-vscode/src/extension.ts`
- Modify: `pocs/fabric-vscode/package.json`

- [ ] **Step 1: Create `src/commands/kit.ts`**

```ts
import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { runSafely } from '../errors';
import { logInfo } from '../output';
import type { Marketplace, Scope } from '../types';

export function registerKitCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.kit.installFromUrl', installFromUrl),
    vscode.commands.registerCommand('fabric.kit.installFromStore', installFromStore),
  );
}

async function pickScope(): Promise<Scope | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'Project', description: 'Install into the workspace .fabric/', scope: 'project' as Scope },
      { label: 'Global',  description: 'Install into ~/.fabric/',              scope: 'global'  as Scope },
    ],
    { placeHolder: 'Install scope', ignoreFocusOut: true },
  );
  return picked?.scope;
}

async function installFromUrl(): Promise<void> {
  const url = await vscode.window.showInputBox({
    prompt: 'Kit git URL',
    placeHolder: 'https://github.com/cyberfabric/review-prompts.git',
    ignoreFocusOut: true,
  });
  if (!url) return;
  const version = await vscode.window.showInputBox({
    prompt: 'Kit version (semver)',
    placeHolder: '1.2.0',
    ignoreFocusOut: true,
  });
  if (!version) return;
  const scope = await pickScope();
  if (!scope) return;

  await runSafely('kit.installFromUrl', async () => {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Installing ${url}…`, cancellable: false },
      async () => {
        await sleep(400);
        const kit = fabric.kits.install({ source: { url, version }, scope });
        logInfo(`Installed ${kit.name} ${kit.version} at ${scope}`);
        await vscode.window.showInformationMessage(`Installed ${kit.name} ${kit.version}`);
      },
    );
  });
}

async function installFromStore(marketplace: Marketplace, kitName: string): Promise<void> {
  if (!marketplace || !kitName) {
    await vscode.window.showErrorMessage('Install from Store requires a marketplace and a kit name');
    return;
  }
  const scope = await pickScope();
  if (!scope) return;

  await runSafely('kit.installFromStore', async () => {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Installing ${kitName}…`, cancellable: false },
      async () => {
        await sleep(400);
        const kit = fabric.kits.install({
          source: { marketplace: marketplace.name, kit: kitName },
          scope,
        });
        logInfo(`Installed ${kit.name} ${kit.version} at ${scope} from ${marketplace.name}`);
        await vscode.window.showInformationMessage(`Installed ${kit.name} ${kit.version}`);
      },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 2: Declare commands + context menus in `package.json`**

Add to `"contributes.commands"`:
```json
      { "command": "fabric.kit.installFromUrl",   "title": "Fabric: Install Kit from URL" },
      { "command": "fabric.kit.installFromStore", "title": "Fabric: Install Kit from Store" }
```

Add to `"contributes.menus"` (merge into existing object):
```json
      "view/title": [
        { "command": "fabric.kit.installFromUrl", "when": "view == fabric.store", "group": "navigation" }
      ],
      "view/item/context": [
        {
          "command": "fabric.kit.installFromStore",
          "when": "view == fabric.store && viewItem == fabric.marketplace.kit",
          "group": "inline"
        }
      ]
```

Note: merge this `view/title` entry with the existing entries from Tasks 14 and 15 (don't duplicate the key — list all four title-bar commands under one `view/title` array).

- [ ] **Step 3: Wire in `extension.ts`**

```ts
import { registerKitCommands } from './commands/kit';
// …
  registerKitCommands(context);
```

- [ ] **Step 4: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Add `cyber-fabric-official`. In Store → expand marketplace → click `review-prompts`. QuickPick appears. Pick `Project` — progress notification, then success toast. My Kits now has `Workspace` group containing `review-prompts 1.2.0`.

Try `Fabric: Install Kit from URL` with `https://github.com/cyberfabric/testing-kit.git` / version `2.0.0` / scope `Global` → My Kits shows both Workspace and User groups.

Try a broken kit: toggle pre-releases, add `community-demo`, click `broken-kit`. Expect toast "Failed: …" and entry in Output channel `Fabric`.

- [ ] **Step 5: Commit**

```bash
git add pocs/fabric-vscode/src/commands/kit.ts \
        pocs/fabric-vscode/src/extension.ts \
        pocs/fabric-vscode/package.json
git commit -m "feat(fabric-vscode): install kit from URL and from Store"
```

---

## Task 17: Update kit (with diff preview)

**Files:**
- Modify: `pocs/fabric-vscode/src/commands/kit.ts`
- Modify: `pocs/fabric-vscode/src/mock/state.ts`
- Modify: `pocs/fabric-vscode/src/mock/kits.ts`
- Modify: `pocs/fabric-vscode/package.json`

- [ ] **Step 1: Add a helper that simulates an upgrade in the marketplace**

Edit `src/mock/state.ts` — add a method on `MockState`:

```ts
  simulateMarketplaceUpgrade(kitName: string, newVersion: string): void {
    for (const m of this.marketplaces) {
      for (const k of m.kits) {
        if (k.name === kitName) {
          k.version = newVersion;
          k.files = [...k.files, `prompts/${kitName}-new-in-${newVersion}.md`];
        }
      }
    }
    for (const installed of this.installedKits) {
      if (installed.name === kitName) {
        installed.updateAvailable = { latest: newVersion };
      }
    }
    this.emit('marketplaces');
    this.emit('kits');
  }
```

- [ ] **Step 2: Add `fabric.update` command handler to `src/commands/kit.ts`**

Append to the module (add to imports: `InstalledKit`):

```ts
async function updateKit(item?: { kit: InstalledKit }): Promise<void> {
  const kit = item?.kit ?? (await pickInstalledKit('Select kit to update'));
  if (!kit) return;

  await runSafely('kit.update', async () => {
    const latest = fabric.marketplaces.listKits().find((k) => k.name === kit.name);
    if (!latest) throw new Error(`No marketplace currently offers ${kit.name}`);

    const diff = {
      added: latest.files.filter((f) => !kit.files.includes(f)),
      removed: kit.files.filter((f) => !latest.files.includes(f)),
      changed: latest.files.filter((f) => kit.files.includes(f)),
    };
    const lines = [
      `Update ${kit.name}: ${kit.version} → ${latest.version}`,
      '',
      ...diff.added.map((f) => `+ ${f}`),
      ...diff.removed.map((f) => `- ${f}`),
      ...diff.changed.map((f) => `~ ${f}`),
    ];
    const choice = await vscode.window.showInformationMessage(
      lines.join('\n'),
      { modal: true },
      'Apply Update',
    );
    if (choice !== 'Apply Update') return;

    const result = fabric.kits.update(kit.name, kit.scope);
    logInfo(`Updated ${result.name}: ${result.before} → ${result.after}`);
    await vscode.window.showInformationMessage(`Updated ${result.name} to ${result.after}`);
  });
}

async function simulateUpgrade(): Promise<void> {
  const kit = await pickInstalledKit('Pick an installed kit to bump in the marketplace');
  if (!kit) return;
  const bumped = nextPatchVersion(kit.version);
  (await import('../mock/state')).state.simulateMarketplaceUpgrade(kit.name, bumped);
  logInfo(`Simulated marketplace upgrade: ${kit.name} → ${bumped}`);
  await vscode.window.showInformationMessage(`Marketplace now offers ${kit.name} ${bumped}`);
}

async function pickInstalledKit(placeHolder: string): Promise<InstalledKit | undefined> {
  const all = fabric.kits.list({ scope: 'both' });
  if (all.length === 0) {
    await vscode.window.showInformationMessage('No kits installed');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    all.map((k) => ({
      label: k.name,
      description: `${k.version} · ${k.scope}`,
      kit: k,
    })),
    { placeHolder, ignoreFocusOut: true },
  );
  return picked?.kit;
}

function nextPatchVersion(v: string): string {
  const [main, pre] = v.split('-', 2);
  const parts = main.split('.').map((n) => Number.parseInt(n, 10));
  parts[2] = (parts[2] ?? 0) + 1;
  return pre ? `${parts.join('.')}-${pre}` : parts.join('.');
}
```

Register in the `registerKitCommands` function (add two more `registerCommand` calls):

```ts
    vscode.commands.registerCommand('fabric.kit.update', updateKit),
    vscode.commands.registerCommand('fabric.kit.simulateUpgrade', simulateUpgrade),
```

- [ ] **Step 3: Declare commands + menus in `package.json`**

Add to `"contributes.commands"`:
```json
      { "command": "fabric.kit.update",          "title": "Fabric: Update Kit…" },
      { "command": "fabric.kit.simulateUpgrade", "title": "Fabric PoC: Simulate Marketplace Upgrade" }
```

Add a context-menu entry (merge into existing `view/item/context`):
```json
        {
          "command": "fabric.kit.update",
          "when": "view == fabric.kits && viewItem == fabric.kit.updatable",
          "group": "inline"
        }
```

- [ ] **Step 4: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Add marketplace, install `review-prompts 1.2.0` to Project. Run `Fabric PoC: Simulate Marketplace Upgrade` → pick `review-prompts`. My Kits now shows `review-prompts 1.2.0 (update → 1.2.1)` with a sync icon. Click the inline update icon (or run `Fabric: Update Kit…`). A modal shows the diff with `+ prompts/review-prompts-new-in-1.2.1.md`. Click `Apply Update` — kit version becomes 1.2.1, badge gone.

- [ ] **Step 5: Commit**

```bash
git add pocs/fabric-vscode/src/commands/kit.ts \
        pocs/fabric-vscode/src/mock/state.ts \
        pocs/fabric-vscode/package.json
git commit -m "feat(fabric-vscode): kit update flow with mock diff preview"
```

---

## Task 18: Uninstall kit

**Files:**
- Modify: `pocs/fabric-vscode/src/commands/kit.ts`
- Modify: `pocs/fabric-vscode/package.json`

- [ ] **Step 1: Append `uninstallKit` to `src/commands/kit.ts`**

Add the function:

```ts
async function uninstallKit(item?: { kit: InstalledKit }): Promise<void> {
  const kit = item?.kit ?? (await pickInstalledKit('Select kit to uninstall'));
  if (!kit) return;
  const confirm = await vscode.window.showWarningMessage(
    `Uninstall ${kit.name} (${kit.scope})?`,
    { modal: true },
    'Uninstall',
  );
  if (confirm !== 'Uninstall') return;
  await runSafely('kit.uninstall', async () => {
    fabric.kits.uninstall(kit.name, kit.scope);
    logInfo(`Uninstalled ${kit.name} (${kit.scope})`);
    await vscode.window.showInformationMessage(`Uninstalled ${kit.name}`);
  });
}
```

Register it (add to `registerKitCommands`):

```ts
    vscode.commands.registerCommand('fabric.kit.uninstall', uninstallKit),
```

- [ ] **Step 2: Declare command + menu in `package.json`**

Add to `"contributes.commands"`:
```json
      { "command": "fabric.kit.uninstall", "title": "Fabric: Uninstall Kit…" }
```

Add to `view/item/context` (both `fabric.kit.installed` and `fabric.kit.updatable` contexts):
```json
        {
          "command": "fabric.kit.uninstall",
          "when": "view == fabric.kits && viewItem =~ /fabric.kit./",
          "group": "uninstall"
        }
```

- [ ] **Step 3: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Install a kit. Right-click it → `Fabric: Uninstall Kit…`. Confirm. Kit disappears from My Kits; group collapses to empty state if last kit was removed.

- [ ] **Step 4: Commit**

```bash
git add pocs/fabric-vscode/src/commands/kit.ts \
        pocs/fabric-vscode/package.json
git commit -m "feat(fabric-vscode): uninstall kit with confirmation"
```

---

## Task 19: Register / Unregister agents

**Files:**
- Create: `pocs/fabric-vscode/src/commands/agent.ts`
- Modify: `pocs/fabric-vscode/src/extension.ts`
- Modify: `pocs/fabric-vscode/package.json`

- [ ] **Step 1: Create `src/commands/agent.ts`**

```ts
import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { runSafely } from '../errors';
import { logInfo } from '../output';
import type { AgentInfo, RegisterScope } from '../types';

export function registerAgentCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.agent.register', registerAgents),
    vscode.commands.registerCommand('fabric.agent.unregister', unregisterAgents),
  );
}

async function pickAgents(
  options: AgentInfo[],
  placeHolder: string,
): Promise<AgentInfo[] | undefined> {
  const picks = await vscode.window.showQuickPick(
    options.map((a) => ({
      label: a.name,
      description: a.detected ? (a.registered ? 'registered' : 'not registered') : 'not detected',
      agent: a,
      picked: false,
    })),
    { canPickMany: true, placeHolder, ignoreFocusOut: true },
  );
  return picks?.map((p) => p.agent);
}

async function pickScope(): Promise<{ local: boolean; includeGlobal: boolean; label: RegisterScope } | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'Default',          description: 'fabric register (no flags)',             local: false, includeGlobal: false, scope: 'default' as RegisterScope },
      { label: 'Project',          description: 'fabric register --local',                local: true,  includeGlobal: false, scope: 'project' as RegisterScope },
      { label: 'Global',           description: 'fabric register --include-global',       local: false, includeGlobal: true,  scope: 'global' as RegisterScope },
      { label: 'Project + Global', description: 'fabric register --local --include-global', local: true, includeGlobal: true,  scope: 'project+global' as RegisterScope },
    ],
    { placeHolder: 'Registration scope', ignoreFocusOut: true },
  );
  if (!picked) return undefined;
  return { local: picked.local, includeGlobal: picked.includeGlobal, label: picked.scope };
}

async function registerAgents(passed?: { agent: AgentInfo }): Promise<void> {
  const allAgents = fabric.agents.list();
  const detected = allAgents.filter((a) => a.detected);
  if (detected.length === 0) {
    await vscode.window.showInformationMessage('No detected agents available');
    return;
  }
  const targets = passed?.agent
    ? [passed.agent]
    : await pickAgents(detected, 'Select agents to register');
  if (!targets || targets.length === 0) return;
  const scope = await pickScope();
  if (!scope) return;

  await runSafely('agent.register', async () => {
    const result = fabric.register({
      agents: targets.map((a) => a.id),
      local: scope.local,
      includeGlobal: scope.includeGlobal,
    });
    logInfo(`Registered ${result.agents.join(', ')} · scope=${result.scope} · files=${result.filesTouched.length}`);
    await vscode.window.showInformationMessage(
      `Registered ${result.agents.length} agent(s) at ${result.scope}`,
    );
  });
}

async function unregisterAgents(passed?: { agent: AgentInfo }): Promise<void> {
  const allAgents = fabric.agents.list();
  const registered = allAgents.filter((a) => a.registered);
  if (registered.length === 0) {
    await vscode.window.showInformationMessage('No registered agents to unregister');
    return;
  }
  const targets = passed?.agent
    ? [passed.agent]
    : await pickAgents(registered, 'Select agents to unregister');
  if (!targets || targets.length === 0) return;

  await runSafely('agent.unregister', async () => {
    const result = fabric.unregister({ agents: targets.map((a) => a.id) });
    logInfo(`Unregistered ${result.agents.join(', ')} · files=${result.filesRemoved.length}`);
    await vscode.window.showInformationMessage(`Unregistered ${result.agents.join(', ')}`);
  });
}
```

- [ ] **Step 2: Wire in `extension.ts`**

```ts
import { registerAgentCommands } from './commands/agent';
// …
  registerAgentCommands(context);
```

- [ ] **Step 3: Declare commands + menus in `package.json`**

Add to `"contributes.commands"`:
```json
      { "command": "fabric.agent.register",   "title": "Fabric: Register Agents…" },
      { "command": "fabric.agent.unregister", "title": "Fabric: Unregister Agents…" }
```

Add view/title and view/item/context entries (merge with existing):
```json
        {
          "command": "fabric.agent.register",
          "when": "view == fabric.agents",
          "group": "navigation"
        },
        {
          "command": "fabric.agent.register",
          "when": "view == fabric.agents && viewItem == fabric.agent.unregistered",
          "group": "inline"
        },
        {
          "command": "fabric.agent.unregister",
          "when": "view == fabric.agents && viewItem == fabric.agent.registered",
          "group": "inline"
        }
```

- [ ] **Step 4: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Install a kit (so `promptCount` is non-zero). Add marketplace. Run `Fabric: Register Agents…` → pick Claude Code and Codex → pick `Project + Global`. Agents tree shows both as `detected · registered · N prompts`.

Right-click Claude Code → `Fabric: Unregister Agents…` (inline action) → row flips back to `not registered`.

- [ ] **Step 5: Commit**

```bash
git add pocs/fabric-vscode/src/commands/agent.ts \
        pocs/fabric-vscode/src/extension.ts \
        pocs/fabric-vscode/package.json
git commit -m "feat(fabric-vscode): register/unregister agent commands"
```

---

## Task 20: Status-bar item + CLI detection toggle

**Files:**
- Create: `pocs/fabric-vscode/src/statusBar.ts`
- Create: `pocs/fabric-vscode/src/commands/cli.ts`
- Modify: `pocs/fabric-vscode/src/extension.ts`
- Modify: `pocs/fabric-vscode/package.json`

- [ ] **Step 1: Create `src/statusBar.ts`**

```ts
import * as vscode from 'vscode';
import fabric from './fabricLib';
import { state } from './mock/state';

export function registerStatusBar(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(item);

  const refresh = (): void => {
    const det = fabric.system.detectCli();
    if (det.found) {
      item.text = `$(check) Fabric CLI ${det.version ?? ''}`.trim();
      item.tooltip = `Path: ${det.path ?? 'unknown'}`;
      item.command = undefined;
      item.backgroundColor = undefined;
    } else {
      item.text = `$(warning) Install Fabric CLI`;
      item.tooltip = 'Fabric CLI not detected — click to install';
      item.command = 'fabric.cli.install';
      item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    item.show();
  };

  state.on('cli', refresh);
  refresh();
}
```

- [ ] **Step 2: Create `src/commands/cli.ts`**

```ts
import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { logInfo } from '../output';

export function registerCliCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.cli.toggleDetected', () => {
      fabric.system.toggleCli();
      const det = fabric.system.detectCli();
      logInfo(`PoC: toggled CLI detection → ${det.found ? 'found' : 'missing'}`);
    }),
    vscode.commands.registerCommand('fabric.cli.install', runMockInstall),
  );
}

async function runMockInstall(): Promise<void> {
  const method = await vscode.window.showQuickPick(
    [
      { label: 'npm', description: 'npm install -g @cyberfabric/fabric' },
      { label: 'brew', description: 'brew install cyberfabric/tap/fabric (macOS)' },
      { label: 'scoop', description: 'scoop install fabric (Windows)' },
    ],
    { placeHolder: 'Installation method (mocked)', ignoreFocusOut: true },
  );
  if (!method) return;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Installing Fabric CLI via ${method.label}…`, cancellable: false },
    async () => {
      await new Promise((r) => setTimeout(r, 2000));
      fabric.system.setCliDetected(true, fabric.system.MIN_CLI_VERSION);
    },
  );
  logInfo(`PoC: mock-installed Fabric CLI via ${method.label}`);
  await vscode.window.showInformationMessage('Fabric CLI installed ✓');
}
```

- [ ] **Step 3: Wire in `extension.ts`**

```ts
import { registerStatusBar } from './statusBar';
import { registerCliCommands } from './commands/cli';
// …
  registerStatusBar(context);
  registerCliCommands(context);
```

- [ ] **Step 4: Declare commands in `package.json`**

Add to `"contributes.commands"`:
```json
      { "command": "fabric.cli.toggleDetected", "title": "Fabric PoC: Toggle CLI Detected" },
      { "command": "fabric.cli.install",        "title": "Fabric: Install Fabric CLI…" }
```

- [ ] **Step 5: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Status bar (left side) shows `✓ Fabric CLI 0.2.0`. Run `Fabric PoC: Toggle CLI Detected`. Status bar flips to `⚠ Install Fabric CLI` with warning background. Click it — QuickPick appears with npm / brew / scoop. Pick any — 2-second spinner — status bar returns to `✓`.

- [ ] **Step 6: Commit**

```bash
git add pocs/fabric-vscode/src/statusBar.ts \
        pocs/fabric-vscode/src/commands/cli.ts \
        pocs/fabric-vscode/src/extension.ts \
        pocs/fabric-vscode/package.json
git commit -m "feat(fabric-vscode): CLI status bar, toggle, and mock installer"
```

---

## Task 21: Welcome view content (empty states use native Welcome UI)

**Files:**
- Modify: `pocs/fabric-vscode/package.json`

- [ ] **Step 1: Add `viewsWelcome` contributions in `package.json`**

Inside `"contributes"`:

```json
    "viewsWelcome": [
      {
        "view": "fabric.kits",
        "contents": "No fabric kits installed yet.\n\n[Install from URL](command:fabric.kit.installFromUrl)\n\nOr open the Store to browse."
      },
      {
        "view": "fabric.store",
        "contents": "No marketplaces registered.\n\n[Add Marketplace…](command:fabric.marketplace.add)\n\nBundled fixtures: `cyber-fabric-official`, `community-demo`."
      },
      {
        "view": "fabric.agents",
        "contents": "Detect and register agents here after installing kits.\n\n[Register Agents…](command:fabric.agent.register)"
      }
    ]
```

- [ ] **Step 2: Also drop the emptystate placeholder rows from the Store tree**

Edit `src/ui/storeView.ts`. Replace the `mkts.length === 0` branch with:

```ts
      if (mkts.length === 0) {
        return []; // viewsWelcome takes over
      }
```

And similarly in `src/ui/kitsView.ts`:

```ts
      if (all.length === 0) {
        return [];
      }
```

- [ ] **Step 3: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. With no data, each view renders a VS Code-native welcome panel with a clickable action button. Click `Add Marketplace…` — full flow from Task 14 runs.

- [ ] **Step 4: Commit**

```bash
git add pocs/fabric-vscode/package.json \
        pocs/fabric-vscode/src/ui/storeView.ts \
        pocs/fabric-vscode/src/ui/kitsView.ts
git commit -m "feat(fabric-vscode): viewsWelcome panels for empty states"
```

---

## Task 22: End-to-end demo walkthrough

**Files:**
- Modify: `pocs/fabric-vscode/package.json`
- Create: `pocs/fabric-vscode/media/walkthrough/overview.md`
- Create: `pocs/fabric-vscode/media/walkthrough/install.md`

- [ ] **Step 1: Create `media/walkthrough/overview.md`**

```markdown
# Fabric PoC Walkthrough

This VS Code extension is a UI-only PoC for the fabric agent environment manager.

**What works here:**
- Add marketplaces (bundled: `cyber-fabric-official`, `community-demo`).
- Browse and install kits (project / global scope).
- Update kits when the marketplace advertises a newer version.
- Register agents (Claude Code, Codex) across scope combinations.
- Simulate CLI missing / installed states.

**What is mocked:** every fabric library call, all git activity, and all filesystem writes. No real `fabric` CLI is invoked.
```

- [ ] **Step 2: Create `media/walkthrough/install.md`**

```markdown
# Install the Fabric CLI (mock)

In this PoC the installer is fake:

1. Open Command Palette → `Fabric PoC: Toggle CLI Detected` to flip the mock detection.
2. Click the status bar entry `⚠ Install Fabric CLI`.
3. Pick any method (npm / brew / scoop).
4. After a 2-second spinner the CLI is reported as installed.

Real installation docs will replace this walkthrough post-PoC.
```

- [ ] **Step 3: Declare walkthrough in `package.json`**

Inside `"contributes"`:

```json
    "walkthroughs": [
      {
        "id": "fabric.welcome",
        "title": "Fabric PoC Quickstart",
        "description": "Learn the PoC UI and try the core flows",
        "steps": [
          {
            "id": "fabric.welcome.overview",
            "title": "What this extension does",
            "description": "Read a short overview of the UI-only PoC.",
            "media": { "markdown": "media/walkthrough/overview.md" }
          },
          {
            "id": "fabric.welcome.add-marketplace",
            "title": "Add a marketplace",
            "description": "Run `Fabric: Add Marketplace…` and enter `cyber-fabric-official`.",
            "media": { "markdown": "media/walkthrough/overview.md" },
            "completionEvents": ["onCommand:fabric.marketplace.add"]
          },
          {
            "id": "fabric.welcome.install-kit",
            "title": "Install a kit",
            "description": "Expand the marketplace in Store and click a kit. Pick Project scope.",
            "media": { "markdown": "media/walkthrough/overview.md" },
            "completionEvents": ["onCommand:fabric.kit.installFromStore", "onCommand:fabric.kit.installFromUrl"]
          },
          {
            "id": "fabric.welcome.register-agent",
            "title": "Register an agent",
            "description": "Run `Fabric: Register Agents…` and pick Claude Code.",
            "media": { "markdown": "media/walkthrough/overview.md" },
            "completionEvents": ["onCommand:fabric.agent.register"]
          },
          {
            "id": "fabric.welcome.install-cli",
            "title": "Install the Fabric CLI (mock)",
            "description": "Toggle `detectCli` to missing, then click the status-bar entry.",
            "media": { "markdown": "media/walkthrough/install.md" },
            "completionEvents": ["onCommand:fabric.cli.install"]
          }
        ]
      }
    ]
```

- [ ] **Step 4: Build + verify**

```bash
npm run build
```

Launch Extension Dev Host. Command Palette → `Welcome: Open Walkthrough` → select `Fabric PoC Quickstart`. Walk through the five steps; each one completes when you run the referenced command.

- [ ] **Step 5: Commit**

```bash
git add pocs/fabric-vscode/media/walkthrough/overview.md \
        pocs/fabric-vscode/media/walkthrough/install.md \
        pocs/fabric-vscode/package.json
git commit -m "feat(fabric-vscode): PoC quickstart walkthrough"
```

---

## Task 23: Final demo pass against Section 14 success criteria

**Files:** none (verification-only task).

- [ ] **Step 1: Fresh Extension Dev Host**

Launch. Activity Bar → Fabric. My Kits and Store show viewsWelcome panels. Agents shows three rows with starting states.

- [ ] **Step 2: Criterion 1 — empty render**

Confirm: no marketplaces, no kits, agents show three rows with `starts unregistered` states.

- [ ] **Step 3: Criterion 2 — add marketplace**

Run `Fabric: Add Marketplace…` → `cyber-fabric-official`. Store populates with 4 kits (pre-release hidden).

- [ ] **Step 4: Criterion 3 — install to Project**

Click `review-prompts` in Store → scope `Project`. My Kits shows `Workspace (1)` with the kit.

- [ ] **Step 5: Criterion 4 — install to Global**

Click `testing-kit` in Store → scope `Global`. My Kits now shows `User (1)` group.

- [ ] **Step 6: Criterion 5 — register agent**

Run `Fabric: Register Agents…` → pick Claude Code → scope Project. Agents view: Claude Code row becomes `detected · registered · N prompts`.

- [ ] **Step 7: Criterion 6 — update kit**

Run `Fabric PoC: Simulate Marketplace Upgrade` → pick `review-prompts`. Kit gains update badge. Run `Fabric: Update Kit…` (or click inline sync icon) → diff modal → Apply. Version bumps.

- [ ] **Step 8: Criterion 7 — CLI missing flow**

Run `Fabric PoC: Toggle CLI Detected`. Status bar warns. Click status bar → pick any method → 2-sec spinner → back to `✓`.

- [ ] **Step 9: Criterion 8 — unregister agent**

Right-click Claude Code → inline unregister. Row flips back to `not registered`.

- [ ] **Step 10: Criterion 9 — uninstall kit**

Right-click `review-prompts` in My Kits → `Fabric: Uninstall Kit…` → confirm. Kit disappears.

- [ ] **Step 11: Criterion 10 — error surface**

Run `Fabric: Toggle Pre-releases in Store`. Add `community-demo`. Click `broken-kit` in Store → pick scope. Error toast `Failed: Invalid semver version "not-a-semver"` appears. Click `Show Logs` — Output channel opens showing the stack trace.

- [ ] **Step 12: Commit a run-log (optional)**

If everything passed, nothing to commit. If a criterion failed, open the matching earlier task and fix before proceeding.

---

## Self-review summary

Spec coverage check:

| Spec section | Covered by task(s) |
|---|---|
| 5.2 Module map | 8 (fabricLib), 9–12 (views), 14–20 (commands), 20 (cliInstaller), 4 (state) |
| 6 Sidebar layout B | 9, 10, 11, 12, 21 |
| 7.1 Kit install | 16 |
| 7.2 Versioning (semver + pre-release toggle) | 6 (assertSemver), 11 (toggle), 15 |
| 7.3 Kit update + diff preview | 17 |
| 7.4 Uninstall | 18 |
| 8 Marketplaces + fixtures + manifest shape | 3, 5, 14 |
| 9 Agent registration | 7 (mock), 19 |
| 10 CLI installer (mock) | 7, 20 |
| 11 Library API contract | 5, 6, 7, 8 |
| 12 Fixtures | 3 |
| 13 Error handling | 13 |
| 14 Success criteria (10 flows) | 23 |
| 15 Out of scope | — (enforced by omission) |

Placeholder scan: no TBDs or "similar to task N" — every code block is inline.

Type consistency: `InstalledKit.scope`, `Scope`, `RegisterScope`, `AgentInfo.registered`, `fabric.kits.install({ source, scope })`, `fabric.register({ agents, local, includeGlobal })`, `fabric.system.detectCli()` names agree across tasks 2, 5, 6, 7, 10, 16, 19, 20.

---

## Execution Handoff

Plan complete and saved to `.workspace-sources/cyberfabric/cyber-fabric/pocs/2026-04-23-fabric-vscode-plugin-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
