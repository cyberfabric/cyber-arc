import { useState } from 'react';
import fabric from '../../fabricLib';
import Modal from '../Modal';
import { notify } from '../toast/toast';

interface Props {
  onClose: () => void;
}

export default function AddMarketplaceDialog({ onClose }: Props): JSX.Element {
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAdd(): Promise<void> {
    if (!source.trim()) return;
    setBusy(true);
    try {
      const mk = fabric.marketplaces.add(source.trim());
      notify.success(`Added marketplace: ${mk.name} (${mk.kits.length} kits)`);
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add Marketplace"
      onClose={busy ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={handleAdd} disabled={busy || !source.trim()}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </>
      )}
    >
      <label className="field">
        <span>Marketplace source</span>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="cyber-fabric-official  or  https://github.com/…"
          autoFocus
          disabled={busy}
        />
      </label>
      <p className="view__hint">PoC fixtures available: <code>cyber-fabric-official</code>, <code>community-demo</code>.</p>
    </Modal>
  );
}
