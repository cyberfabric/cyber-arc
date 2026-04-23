import { useState } from 'react';
import fabric from '../../fabricLib';
import { useMockState } from '../../hooks/useMockState';
import InstallKitDialog from '../install/InstallKitDialog';
import type { InstalledKit } from '../../types';

export default function KitsView(): JSX.Element {
  useMockState(['kits', 'marketplaces']);
  const all = fabric.kits.list({ scope: 'both' });
  const project = all.filter((k) => k.scope === 'project');
  const user = all.filter((k) => k.scope === 'global');
  const [showInstallUrl, setShowInstallUrl] = useState(false);

  return (
    <section className="view">
      <div className="view__header-row">
        <h1 className="view__title">My Kits</h1>
        <button type="button" className="btn" onClick={() => setShowInstallUrl(true)}>Install from URL…</button>
      </div>
      {all.length === 0 && (
        <p className="view__hint">No kits installed. Open the Store to browse and install.</p>
      )}
      {project.length > 0 && <Group label="Workspace" kits={project} />}
      {user.length > 0 && <Group label="User" kits={user} />}
      {showInstallUrl && (
        <InstallKitDialog source={{ kind: 'url' }} onClose={() => setShowInstallUrl(false)} />
      )}
    </section>
  );
}

function Group({ label, kits }: { label: string; kits: InstalledKit[] }): JSX.Element {
  return (
    <div className="group">
      <div className="group__title">{label} <span className="group__count">({kits.length})</span></div>
      <ul className="group__list">
        {kits.map((k) => <KitRow key={`${k.name}-${k.scope}`} kit={k} />)}
      </ul>
    </div>
  );
}

function KitRow({ kit }: { kit: InstalledKit }): JSX.Element {
  const badges: string[] = [kit.scope];
  if (kit.updateAvailable) badges.push(`update → ${kit.updateAvailable.latest}`);
  return (
    <li className="row">
      <div className="row__main">
        <div className="row__title">{kit.name} <span className="row__version">{kit.version}</span></div>
        <div className="row__desc">{kit.description}</div>
      </div>
      <div className="row__badges">
        {badges.map((b) => <span key={b} className="badge">{b}</span>)}
      </div>
    </li>
  );
}
