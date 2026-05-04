import { useState } from 'react';
import fabric from '../../fabricLib';
import { useMockState } from '../../hooks/useMockState';
import { state } from '../../mock/state';
import InstallKitDialog, { type InstallSource } from '../install/InstallKitDialog';
import AddMarketplaceDialog from '../marketplace/AddMarketplaceDialog';
import ConfirmDialog from '../confirm/ConfirmDialog';
import { notify } from '../toast/toast';
import type { Marketplace, MarketplaceKit } from '../../types';

export default function StoreView(): JSX.Element {
  useMockState(['marketplaces', 'ui']);
  const mkts = fabric.marketplaces.list();
  const [installSource, setInstallSource] = useState<InstallSource | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Marketplace | null>(null);

  function refresh(): void {
    try {
      const { updated } = fabric.marketplaces.refresh();
      notify.info(`Refreshed ${updated.length} marketplace(s)`);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  }

  function performRemove(mkt: Marketplace): void {
    try {
      fabric.marketplaces.remove(mkt.name);
      notify.success(`Removed ${mkt.name}`);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="view">
      <div className="view__header-row">
        <h1 className="view__title">Store</h1>
        <div className="button-row">
          <label className="toggle">
            <input
              type="checkbox"
              checked={state.includePrereleases}
              onChange={() => { state.includePrereleases = !state.includePrereleases; state.emit('ui'); }}
            />
            <span>Pre-releases</span>
          </label>
          <button type="button" className="btn" onClick={refresh}>Refresh</button>
          <button type="button" className="btn btn--primary" onClick={() => setShowAdd(true)}>Add Marketplace…</button>
        </div>
      </div>
      {mkts.length === 0 && (
        <p className="view__hint">No marketplaces added yet. Click «Add Marketplace…» and try <code>cyber-fabric-official</code>.</p>
      )}
      {mkts.map((m) => (
        <MarketplaceBlock
          key={m.name}
          mkt={m}
          onInstall={(kit) => {
            if (kit.broken) {
              notify.error(`Cannot install ${kit.name}: ${kit.broken.reason}`);
              return;
            }
            setInstallSource({ kind: 'store', marketplace: m.name, kitName: kit.name, version: kit.version });
          }}
          onRemove={() => setRemoveTarget(m)}
        />
      ))}
      {installSource && (
        <InstallKitDialog source={installSource} onClose={() => setInstallSource(null)} />
      )}
      {showAdd && <AddMarketplaceDialog onClose={() => setShowAdd(false)} />}
      {removeTarget && (
        <ConfirmDialog
          title="Remove marketplace"
          message={`Remove ${removeTarget.name}? Installed kits stay, but no further updates or installs from this marketplace.`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => performRemove(removeTarget)}
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </section>
  );
}

function MarketplaceBlock({ mkt, onInstall, onRemove }: { mkt: Marketplace; onInstall: (kit: MarketplaceKit) => void; onRemove: () => void }): JSX.Element {
  const visible = mkt.kits.filter((k) => state.includePrereleases || !isPrerelease(k.version));
  return (
    <div className="group">
      <div className="group__title">
        {mkt.name} <span className="group__count">({visible.length})</span>
        <span className="group__sub">{mkt.description}</span>
        <button type="button" className="btn btn--compact btn--danger-outline group__action" onClick={onRemove}>Remove</button>
      </div>
      <ul className="group__list">
        {visible.map((kit) => <StoreKitRow key={kit.name} kit={kit} onInstall={() => onInstall(kit)} />)}
      </ul>
    </div>
  );
}

function StoreKitRow({ kit, onInstall }: { kit: MarketplaceKit; onInstall: () => void }): JSX.Element {
  const pre = isPrerelease(kit.version);
  const broken = !!kit.broken;
  return (
    <li className={`row ${broken ? 'row--danger' : ''}`}>
      <div className="row__main">
        <div className="row__title">
          {kit.name} <span className="row__version">{kit.version}</span>
          {kit.webExtensions && kit.webExtensions.length > 0 && <span className="badge badge--accent">+{kit.webExtensions.length} web</span>}
        </div>
        <div className="row__desc">{kit.description}</div>
      </div>
      <div className="row__badges">
        <span className="badge">{kit.category}</span>
        {pre && <span className="badge badge--warn">pre-release</span>}
        {broken && <span className="badge badge--danger">broken</span>}
        <button type="button" className="btn btn--compact" onClick={onInstall}>Install</button>
      </div>
    </li>
  );
}

function isPrerelease(version: string): boolean {
  return version.includes('-');
}
