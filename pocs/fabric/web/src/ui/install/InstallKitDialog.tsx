import { useState } from 'react';
import fabric from '../../fabricLib';
import Modal from '../Modal';
import { notify } from '../toast/toast';
import type { Scope } from '../../types';

export type InstallSource =
  | { kind: 'url' }
  | { kind: 'store'; marketplace: string; kitName: string; version: string };

interface Props {
  source: InstallSource;
  onClose: () => void;
}

export default function InstallKitDialog({ source, onClose }: Props): JSX.Element {
  const [url, setUrl] = useState('');
  const [version, setVersion] = useState('');
  const [scope, setScope] = useState<Scope>('project');
  const [busy, setBusy] = useState(false);

  const isStore = source.kind === 'store';
  const title = isStore ? `Install ${source.kitName}` : 'Install Kit from URL';

  async function handleInstall(): Promise<void> {
    setBusy(true);
    try {
      await sleep(350); // mock progress
      if (isStore) {
        const kit = fabric.kits.install({
          source: { marketplace: source.marketplace, kit: source.kitName, version: source.version },
          scope,
        });
        notify.success(`Installed ${kit.name} ${kit.version} at ${scope}`);
      } else {
        const kit = fabric.kits.install({ source: { url: url.trim(), version: version.trim() }, scope });
        notify.success(`Installed ${kit.name} ${kit.version} at ${scope}`);
      }
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleInstall}
            disabled={busy || (!isStore && (!url.trim() || !version.trim()))}
          >
            {busy ? 'Installing…' : 'Install'}
          </button>
        </>
      )}
    >
      {isStore ? (
        <div className="field-group">
          <Field label="Marketplace"><code>{source.marketplace}</code></Field>
          <Field label="Kit"><code>{source.kitName}</code></Field>
          <Field label="Version"><code>{source.version}</code></Field>
        </div>
      ) : (
        <div className="field-group">
          <label className="field">
            <span>Git URL</span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/cyberfabric/review-prompts.git"
              autoFocus
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>Version (semver)</span>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.2.0"
              disabled={busy}
            />
          </label>
        </div>
      )}
      <fieldset className="field-set">
        <legend>Scope</legend>
        <label className="radio"><input type="radio" name="scope" checked={scope === 'project'} onChange={() => setScope('project')} disabled={busy} /> Project</label>
        <label className="radio"><input type="radio" name="scope" checked={scope === 'global'} onChange={() => setScope('global')} disabled={busy} /> Global</label>
      </fieldset>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="field__value">{children}</div>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
