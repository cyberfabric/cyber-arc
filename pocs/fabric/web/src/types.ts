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
  /** Optional web-UI contributions brought by this kit. */
  webExtensions?: WebExtension[];
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

export interface WebExtension {
  /** Globally-unique extension id, e.g. "sdlc-kit.orchestrator". */
  id: string;
  /** Label shown in the left sidebar. */
  label: string;
  /** Optional lucide/emoji icon hint (string key). */
  icon?: string;
  /** One-sentence summary for tooltips / headings. */
  description: string;
  /** Placeholder content shown when the extension page is open. */
  placeholder: {
    title: string;
    lines: string[];
  };
  /** v1 demo-level contributions to the Workspaces viewer. */
  workspaceContributions?: WorkspaceContributions;
}

export type Language =
  | 'typescript'
  | 'markdown'
  | 'python'
  | 'toml'
  | 'bash'
  | 'json';

export interface WorkspaceFile {
  /** Path relative to workspace root, POSIX-style, no leading slash. */
  path: string;
  language: Language;
  content: string;
  /**
   * Optional one-sentence summary used by the canned chat responder when this file
   * is the active context. When absent, the responder falls back to counting
   * top-level symbols.
   */
  summary?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  files: WorkspaceFile[];
}

export interface WorkspaceRendererContribution {
  /**
   * Match string. Supported syntax:
   *   - `*.ext`          matches any file whose path ends with `.ext`
   *   - `literal.name`   matches the basename exactly
   *   - `dir/*.ext`      matches inside a specific directory
   */
  match: string;
  /** Key in the renderers registry. */
  componentKey: string;
  /** Human label shown in UI affordances. */
  label: string;
}

export interface WorkspaceActionContribution {
  id: string;
  label: string;
  /** Emoji or sidebar icon-name hint. */
  icon?: string;
  /**
   * Prompt template inserted as a synthetic user message when clicked.
   * `{file}` is substituted with the active file path.
   */
  onClickPrompt: string;
}

export interface WorkspaceContributions {
  renderers?: WorkspaceRendererContribution[];
  actions?: WorkspaceActionContribution[];
  /** Registry key of a highlight pack to activate while the contributing kit is installed. */
  highlightPack?: string;
}

export type ChatAgent = 'claude' | 'codex';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  agent?: ChatAgent;
  text: string;
  timestamp: number;
  /** Active file path at send time. */
  fileContext?: string;
}
