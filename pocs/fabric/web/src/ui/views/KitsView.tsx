import { useState } from 'react';
import fabric from '../../fabricLib';
import { state } from '../../mock/state';
import { useMockState } from '../../hooks/useMockState';
import InstallKitDialog from '../install/InstallKitDialog';
import UpdateKitDialog from '../update/UpdateKitDialog';
import { notify } from '../toast/toast';
import type { InstalledKit } from '../../types';

export default function KitsView(): JSX.Element {
  useMockState(['kits', 'marketplaces']);
  const all = fabric.kits.list({ scope: 'both' });
  const project = all.filter((k) => k.scope === 'project');
  const user = all.filter((k) => k.scope === 'global');
  const [showInstallUrl, setShowInstallUrl] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<InstalledKit | null>(null);

  function simulateUpgrade(): void {
    if (all.length === 0) {
      notify.info('No kits installed to simulate an upgrade');
      return;
    }
    const kit = all[0];
    const bumped = nextPatchVersion(kit.version);
    state.simulateMarketplaceUpgrade(kit.name, bumped);
    notify.info(`Marketplace now offers ${kit.name} ${bumped}`);
  }

  return (
    <section className="view">
      <div className="view__header-row">
        <h1 className="view__title">My Kits</h1>
        <div className="button-row">
          <button type="button" className="btn" onClick={simulateUpgrade}>Simulate Upgrade</button>
          <button type="button" className="btn" onClick={() => setShowInstallUrl(true)}>Install from URL…</button>
        </div>
      </div>
      {all.length === 0 && (
        <p className="view__hint">No kits installed. Open the Store to browse and install.</p>
      )}
      {project.length > 0 && <Group label="Workspace" kits={project} onUpdate={setUpdateTarget} />}
      {user.length > 0 && <Group label="User" kits={user} onUpdate={setUpdateTarget} />}
      {showInstallUrl && (
        <InstallKitDialog source={{ kind: 'url' }} onClose={() => setShowInstallUrl(false)} />
      )}
      {updateTarget && (
        <UpdateKitDialog kit={updateTarget} onClose={() => setUpdateTarget(null)} />
      )}
    </section>
  );
}

function Group({ label, kits, onUpdate }: { label: string; kits: InstalledKit[]; onUpdate: (k: InstalledKit) => void }): JSX.Element {
  return (
    <div className="group">
      <div className="group__title">{label} <span className="group__count">({kits.length})</span></div>
      <ul className="group__list">
        {kits.map((k) => <KitRow key={`${k.name}-${k.scope}`} kit={k} onUpdate={() => onUpdate(k)} />)}
      </ul>
    </div>
  );
}

function KitRow({ kit, onUpdate }: { kit: InstalledKit; onUpdate: () => void }): JSX.Element {
  const updatable = !!kit.updateAvailable;
  return (
    <li className="row">
      <div className="row__main">
        <div className="row__title">{kit.name} <span className="row__version">{kit.version}</span></div>
        <div className="row__desc">{kit.description}</div>
      </div>
      <div className="row__badges">
        <span className="badge">{kit.scope}</span>
        {updatable && <span className="badge badge--warn">update → {kit.updateAvailable!.latest}</span>}
        {updatable && <button type="button" className="btn btn--compact" onClick={onUpdate}>Update</button>}
      </div>
    </li>
  );
}

function nextPatchVersion(v: string): string {
  const [main, pre] = v.split('-', 2);
  const parts = main.split('.').map((n) => Number.parseInt(n, 10));
  parts[2] = (parts[2] ?? 0) + 1;
  return pre ? `${parts.join('.')}-${pre}` : parts.join('.');
}
