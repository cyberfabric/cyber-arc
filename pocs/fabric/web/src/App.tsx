import { useState } from 'react';
import Sidebar, { type SidebarEntry } from './ui/Sidebar';
import OverviewView from './ui/views/OverviewView';
import KitsView from './ui/views/KitsView';
import StoreView from './ui/views/StoreView';
import AgentsView from './ui/views/AgentsView';

const CORE_ENTRIES: SidebarEntry[] = [
  { id: 'overview', label: 'Overview', icon: '🏠', group: 'core' },
  { id: 'kits',     label: 'My Kits',   icon: '📦', group: 'core' },
  { id: 'store',    label: 'Store',     icon: '🛒', group: 'core' },
  { id: 'agents',   label: 'Agents',    icon: '🤖', group: 'core' },
];

export default function App(): JSX.Element {
  const [activeId, setActiveId] = useState<string>('overview');

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__brand">Fabric</span>
        <span className="app__tag">PoC · mock</span>
      </header>
      <div className="app__body">
        <Sidebar entries={CORE_ENTRIES} activeId={activeId} onSelect={setActiveId} />
        <main className="app__main">{renderActive(activeId)}</main>
      </div>
    </div>
  );
}

function renderActive(id: string): JSX.Element {
  switch (id) {
    case 'overview': return <OverviewView />;
    case 'kits':     return <KitsView />;
    case 'store':    return <StoreView />;
    case 'agents':   return <AgentsView />;
    default:         return <OverviewView />;
  }
}
