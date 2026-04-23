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
