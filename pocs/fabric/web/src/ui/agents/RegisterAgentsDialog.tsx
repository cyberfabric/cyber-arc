import { useState } from 'react';
import fabric from '../../fabricLib';
import Modal from '../Modal';
import { notify } from '../toast/toast';
import type { AgentInfo, RegisterScope } from '../../types';

type Mode = 'register' | 'unregister';

interface Props {
  mode: Mode;
  onClose: () => void;
}

interface ScopeOption {
  label: string;
  description: string;
  local: boolean;
  includeGlobal: boolean;
  scope: RegisterScope;
}

const SCOPES: ScopeOption[] = [
  { label: 'Default',          description: 'fabric-poc register (no flags)',               local: false, includeGlobal: false, scope: 'default' },
  { label: 'Project',          description: 'fabric-poc register --local',                  local: true,  includeGlobal: false, scope: 'project' },
  { label: 'Global',           description: 'fabric-poc register --include-global',         local: false, includeGlobal: true,  scope: 'global' },
  { label: 'Project + Global', description: 'fabric-poc register --local --include-global', local: true,  includeGlobal: true,  scope: 'project+global' },
];

export default function RegisterAgentsDialog({ mode, onClose }: Props): JSX.Element {
  const all = fabric.agents.list();
  const candidates: AgentInfo[] = mode === 'register'
    ? all.filter((a) => a.detected)
    : all.filter((a) => a.registered);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scopeIdx, setScopeIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function apply(): Promise<void> {
    if (selected.size === 0) return;
    setBusy(true);
    const agents = Array.from(selected);
    try {
      if (mode === 'register') {
        const chosen = SCOPES[scopeIdx];
        const result = fabric.register({ agents, local: chosen.local, includeGlobal: chosen.includeGlobal });
        notify.success(`Registered ${result.agents.join(', ')} at ${result.scope}`);
      } else {
        const result = fabric.unregister({ agents });
        notify.success(`Unregistered ${result.agents.join(', ')}`);
      }
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'register' ? 'Register Agents' : 'Unregister Agents';
  const confirmLabel = mode === 'register' ? 'Register' : 'Unregister';

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={`btn ${mode === 'register' ? 'btn--primary' : 'btn--danger'}`}
            onClick={apply}
            disabled={busy || selected.size === 0}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      )}
    >
      {candidates.length === 0 ? (
        <p className="view__hint">
          {mode === 'register'
            ? 'No detected agents available to register.'
            : 'No registered agents to remove.'}
        </p>
      ) : (
        <>
          <div className="field">
            <span>Select agents</span>
            <ul className="checklist">
              {candidates.map((a) => (
                <li key={a.id} className="checklist__item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      disabled={busy}
                    />
                    <span className="checklist__label">{a.name}</span>
                    <span className="checklist__meta">
                      {a.detected ? 'detected' : 'not detected'}
                      {a.detected && (a.registered ? ` · registered (${a.registeredScope})` : ' · not registered')}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {mode === 'register' && (
            <fieldset className="field-set">
              <legend>Scope</legend>
              {SCOPES.map((s, i) => (
                <label key={s.scope} className="radio" title={s.description}>
                  <input
                    type="radio"
                    name="agent-scope"
                    checked={scopeIdx === i}
                    onChange={() => setScopeIdx(i)}
                    disabled={busy}
                  />
                  {s.label}
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
    </Modal>
  );
}
