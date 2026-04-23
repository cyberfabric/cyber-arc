import { useMemo, useState } from 'react';
import fabric from '../../fabricLib';
import Modal from '../Modal';
import { notify } from '../toast/toast';
import type { InstalledKit } from '../../types';

interface Diff {
  added: string[];
  removed: string[];
  changed: string[];
  latestVersion: string;
}

interface Props {
  kit: InstalledKit;
  onClose: () => void;
}

export default function UpdateKitDialog({ kit, onClose }: Props): JSX.Element {
  const diff = useMemo<Diff | null>(() => {
    const latest = fabric.marketplaces.listKits().find((k) => k.name === kit.name);
    if (!latest) return null;
    return {
      added: latest.files.filter((f) => !kit.files.includes(f)),
      removed: kit.files.filter((f) => !latest.files.includes(f)),
      changed: latest.files.filter((f) => kit.files.includes(f)),
      latestVersion: latest.version,
    };
  }, [kit.name, kit.version]);

  const [busy, setBusy] = useState(false);

  async function handleApply(): Promise<void> {
    setBusy(true);
    try {
      const result = fabric.kits.update(kit.name, kit.scope);
      notify.success(`Updated ${result.name}: ${result.before} → ${result.after}`);
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <>
      <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
      <button
        type="button"
        className="btn btn--primary"
        onClick={handleApply}
        disabled={busy || !diff}
      >
        {busy ? 'Applying…' : 'Apply Update'}
      </button>
    </>
  );

  return (
    <Modal title={`Update ${kit.name}`} onClose={busy ? () => {} : onClose} footer={footer}>
      {!diff && <p>No newer version is currently advertised in any marketplace.</p>}
      {diff && (
        <>
          <p>
            <strong>{kit.name}</strong>: <code>{kit.version}</code> → <code>{diff.latestVersion}</code> · scope <code>{kit.scope}</code>
          </p>
          <DiffList title="Added" items={diff.added} sign="+" className="diff-added" />
          <DiffList title="Removed" items={diff.removed} sign="−" className="diff-removed" />
          <DiffList title="Changed" items={diff.changed} sign="~" className="diff-changed" />
          {diff.added.length + diff.removed.length + diff.changed.length === 0 && (
            <p className="view__hint">No file changes detected.</p>
          )}
        </>
      )}
    </Modal>
  );
}

function DiffList({ title, items, sign, className }: { title: string; items: string[]; sign: string; className: string }): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className={`diff ${className}`}>
      <div className="diff__title">{title} ({items.length})</div>
      <ul className="diff__list">
        {items.map((f) => <li key={f}><span className="diff__sign">{sign}</span> {f}</li>)}
      </ul>
    </div>
  );
}
