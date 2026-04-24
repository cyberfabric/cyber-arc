import { useEffect, useMemo, useState } from 'react';
import fabric from './fabricLib';
import { useMockState } from './hooks/useMockState';
import Sidebar, { type SidebarEntry } from './ui/Sidebar';
import WorkspacesView from './ui/views/WorkspacesView';
import KitsView from './ui/views/KitsView';
import StoreView from './ui/views/StoreView';
import AgentsView from './ui/views/AgentsView';
import ExtensionView from './ui/views/ExtensionView';
import ToastHost from './ui/toast/ToastHost';
import CliStatus from './ui/cli/CliStatus';
import type { InstalledKit, WebExtension } from './types';

const CORE_ENTRIES: SidebarEntry[] = [
  { id: 'workspaces', label: 'Workspaces', icon: '📁', group: 'core' },
  { id: 'kits',       label: 'My Kits',    icon: '📦', group: 'core' },
  { id: 'store',      label: 'Store',      icon: '🛒', group: 'core' },
  { id: 'agents',     label: 'Agents',     icon: '🤖', group: 'core' },
];

interface ExtensionEntry {
  sidebar: SidebarEntry;
  extension: WebExtension;
  sourceKit: string;
}

function collectExtensionEntries(): ExtensionEntry[] {
  const installed: InstalledKit[] = fabric.kits.list({ scope: 'both' });
  // Each installed kit may contribute 0+ web extensions. Look them up by name in marketplaces.
  const byKitName = new Map<string, WebExtension[]>();
  for (const mkt of fabric.marketplaces.list()) {
    for (const k of mkt.kits) {
      if (k.webExtensions && k.webExtensions.length > 0) {
        byKitName.set(k.name, k.webExtensions);
      }
    }
  }

  const seen = new Set<string>();
  const result: ExtensionEntry[] = [];
  for (const kit of installed) {
    const exts = byKitName.get(kit.name);
    if (!exts) continue;
    for (const ext of exts) {
      if (seen.has(ext.id)) continue; // de-dup if the same kit is installed at multiple scopes
      seen.add(ext.id);
      result.push({
        sidebar: { id: ext.id, label: ext.label, icon: iconFor(ext.icon), group: 'extensions' },
        extension: ext,
        sourceKit: kit.name,
      });
    }
  }
  return result;
}

function iconFor(name?: string): string {
  // Minimal emoji map; unknown names fall back to a puzzle piece.
  switch (name) {
    case 'workflow': return '🧭';
    case 'message-square': return '💬';
    case 'git-pull-request': return '🔀';
    case 'check-circle': return '✅';
    default: return '🧩';
  }
}

export default function App(): JSX.Element {
  useMockState(['kits', 'marketplaces']);

  useEffect(() => {
    if (fabric.marketplaces.list().length > 0) return;
    try {
      const mk = fabric.marketplaces.add('cyber-fabric-official');
      console.log(`[fabric-web] seeded default marketplace: ${mk.name} (${mk.kits.length} kits)`);
    } catch (err) {
      console.warn('[fabric-web] failed to seed default marketplace', err);
    }
  }, []);

  const [activeId, setActiveId] = useState<string>('workspaces');

  const extensionEntries = useMemo(() => collectExtensionEntries(), [fabric.kits.list({ scope: 'both' }).length, fabric.marketplaces.list().length]);
  const entries = useMemo<SidebarEntry[]>(
    () => [...CORE_ENTRIES, ...extensionEntries.map((e) => e.sidebar)],
    [extensionEntries],
  );

  // If active id refers to an extension that's no longer installed, fall back to workspaces.
  useEffect(() => {
    const allIds = new Set(entries.map((e) => e.id));
    if (!allIds.has(activeId)) setActiveId('workspaces');
  }, [entries, activeId]);

  const activeExtension = extensionEntries.find((e) => e.sidebar.id === activeId);

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__brand">Fabric</span>
        <span className="app__tag">PoC · mock</span>
        <span className="app__spacer" />
        <button
          type="button"
          className="app__action"
          onClick={() => fabric.system.toggleCli()}
          title="PoC helper: flip CLI detection"
        >
          Toggle CLI
        </button>
        <CliStatus />
      </header>
      <div className="app__body">
        <Sidebar entries={entries} activeId={activeId} onSelect={setActiveId} />
        <main className="app__main">
          {activeExtension
            ? <ExtensionView extension={activeExtension.extension} sourceKit={activeExtension.sourceKit} />
            : renderCore(activeId)}
        </main>
      </div>
      <ToastHost />
    </div>
  );
}

function renderCore(id: string): JSX.Element {
  switch (id) {
    case 'kits':       return <KitsView />;
    case 'store':      return <StoreView />;
    case 'agents':     return <AgentsView />;
    case 'workspaces': return <WorkspacesView />;
    default:           return <WorkspacesView />;
  }
}
