import type {
  AgentInfo,
  InstalledKit,
  Marketplace,
  Workspace,
  ChatMessage,
  ChatAgent,
} from '../types';

export type StateChannel =
  | 'kits' | 'marketplaces' | 'agents' | 'cli' | 'ui'
  | 'workspaces' | 'workspaces-ui';

type Listener = () => void;

class ChannelEmitter {
  private channels = new Map<StateChannel, Set<Listener>>();
  on(channel: StateChannel, listener: Listener): void {
    if (!this.channels.has(channel)) this.channels.set(channel, new Set());
    this.channels.get(channel)!.add(listener);
  }
  emit(channel: StateChannel): void {
    this.channels.get(channel)?.forEach((fn) => fn());
  }
}

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
  includePrereleases = false;

  // Workspaces (read-only fixtures wired up in Task 3).
  workspaces: Workspace[] = [];
  // Workspaces UI state (in-memory only; resets on reload).
  activeWorkspaceId: string | null = null;
  openTabs: string[] = [];        // file paths in active workspace
  activeTabPath: string | null = null;
  expandedFolders: Set<string> = new Set();
  treeSearch = '';
  chatMessages: ChatMessage[] = [];
  chatAgent: ChatAgent = 'claude';
  chatInput = '';

  private emitter = new ChannelEmitter();

  on(channel: StateChannel, listener: Listener): void {
    this.emitter.on(channel, listener);
  }

  emit(channel: StateChannel): void {
    this.emitter.emit(channel);
  }

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
    this.includePrereleases = false;
    this.activeWorkspaceId = null;
    this.openTabs = [];
    this.activeTabPath = null;
    this.expandedFolders = new Set();
    this.treeSearch = '';
    this.chatMessages = [];
    this.chatAgent = 'claude';
    this.chatInput = '';
    (['kits', 'marketplaces', 'agents', 'cli', 'ui', 'workspaces', 'workspaces-ui'] as StateChannel[])
      .forEach((c) => this.emit(c));
  }

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
}

export const state = new MockState();
