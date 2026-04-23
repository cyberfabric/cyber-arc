import { useState } from 'react';
import fabric from '../../fabricLib';
import { useMockState } from '../../hooks/useMockState';
import { state } from '../../mock/state';
import InstallKitDialog, { type InstallSource } from '../install/InstallKitDialog';
import { notify } from '../toast/toast';
import type { Marketplace, MarketplaceKit } from '../../types';

export default function StoreView(): JSX.Element {
  useMockState(['marketplaces', 'ui']);
  const mkts = fabric.marketplaces.list();
  const [installSource, setInstallSource] = useState<InstallSource | null>(null);

  return (
    <section className="view">
      <div className="view__header-row">
        <h1 className="view__title">Store</h1>
        <label className="toggle">
          <input
            type="checkbox"
            checked={state.includePrereleases}
            onChange={() => { state.includePrereleases = !state.includePrereleases; state.emit('ui'); }}
          />
          <span>Include pre-releases</span>
        </label>
      </div>
      {mkts.length === 0 && (
        <p className="view__hint">No marketplaces added yet. Use «Add Marketplace…» (next task).</p>
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
        />
      ))}
      {installSource && (
        <InstallKitDialog source={installSource} onClose={() => setInstallSource(null)} />
      )}
    </section>
  );
}

function MarketplaceBlock({ mkt, onInstall }: { mkt: Marketplace; onInstall: (kit: MarketplaceKit) => void }): JSX.Element {
  const visible = mkt.kits.filter((k) => state.includePrereleases || !isPrerelease(k.version));
  return (
    <div className="group">
      <div className="group__title">
        {mkt.name} <span className="group__count">({visible.length})</span>
        <span className="group__sub">{mkt.description}</span>
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
