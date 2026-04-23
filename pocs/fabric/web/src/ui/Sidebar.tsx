import type { ReactNode } from 'react';

export type CoreViewId = 'overview' | 'kits' | 'store' | 'agents';

export interface SidebarEntry {
  id: string;
  label: string;
  icon?: string;
  group: 'core' | 'extensions';
}

interface Props {
  entries: SidebarEntry[];
  activeId: string;
  onSelect: (id: string) => void;
  footer?: ReactNode;
}

export default function Sidebar({ entries, activeId, onSelect, footer }: Props): JSX.Element {
  const core = entries.filter((e) => e.group === 'core');
  const extensions = entries.filter((e) => e.group === 'extensions');

  return (
    <nav className="sidebar">
      <div className="sidebar__group">
        <div className="sidebar__group-label">Fabric</div>
        {core.map((e) => (
          <SidebarItem key={e.id} entry={e} active={e.id === activeId} onSelect={onSelect} />
        ))}
      </div>
      {extensions.length > 0 && (
        <div className="sidebar__group">
          <div className="sidebar__group-label">Extensions</div>
          {extensions.map((e) => (
            <SidebarItem key={e.id} entry={e} active={e.id === activeId} onSelect={onSelect} />
          ))}
        </div>
      )}
      <div className="sidebar__spacer" />
      {footer && <div className="sidebar__footer">{footer}</div>}
    </nav>
  );
}

function SidebarItem({ entry, active, onSelect }: { entry: SidebarEntry; active: boolean; onSelect: (id: string) => void }): JSX.Element {
  return (
    <button
      type="button"
      className={`sidebar__item ${active ? 'sidebar__item--active' : ''}`}
      onClick={() => onSelect(entry.id)}
    >
      {entry.icon && <span className="sidebar__icon" aria-hidden>{entry.icon}</span>}
      <span className="sidebar__label">{entry.label}</span>
    </button>
  );
}
