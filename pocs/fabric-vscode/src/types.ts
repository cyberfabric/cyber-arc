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
