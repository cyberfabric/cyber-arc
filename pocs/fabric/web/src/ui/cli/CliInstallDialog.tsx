import { useState } from 'react';
import fabric from '../../fabricLib';
import Modal from '../Modal';
import { notify } from '../toast/toast';

interface Props {
  onClose: () => void;
}

type Method = 'npm' | 'brew' | 'scoop';

const METHODS: { id: Method; label: string; description: string }[] = [
  { id: 'npm',   label: 'npm',   description: 'npm install -g @cyberfabric/fabric' },
  { id: 'brew',  label: 'brew',  description: 'brew install cyberfabric/tap/fabric (macOS)' },
  { id: 'scoop', label: 'scoop', description: 'scoop install fabric (Windows)' },
];

export default function CliInstallDialog({ onClose }: Props): JSX.Element {
  const [method, setMethod] = useState<Method>('npm');
  const [busy, setBusy] = useState(false);

  async function install(): Promise<void> {
    setBusy(true);
    try {
      await sleep(2000);
      fabric.system.setCliDetected(true, fabric.system.MIN_CLI_VERSION);
      notify.success(`Fabric CLI installed via ${method}`);
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Install Fabric CLI"
      onClose={busy ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={install} disabled={busy}>
            {busy ? 'Installing…' : 'Install'}
          </button>
        </>
      )}
    >
      <p className="view__hint">In the PoC the installer is mocked — pick any method and the CLI is marked installed after 2s.</p>
      <fieldset className="field-set field-set--stack">
        <legend>Method</legend>
        {METHODS.map((m) => (
          <label key={m.id} className="radio">
            <input
              type="radio"
              name="cli-method"
              checked={method === m.id}
              onChange={() => setMethod(m.id)}
              disabled={busy}
            />
            <span>
              <strong>{m.label}</strong> <span className="view__hint" style={{ fontStyle: 'normal' }}>— {m.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
