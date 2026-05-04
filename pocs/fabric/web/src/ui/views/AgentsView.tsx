import { useState } from 'react';
import fabric from '../../fabricLib';
import { useMockState } from '../../hooks/useMockState';
import RegisterAgentsDialog from '../agents/RegisterAgentsDialog';
import type { AgentInfo } from '../../types';

export default function AgentsView(): JSX.Element {
  useMockState(['agents', 'kits']);
  const agents = fabric.agents.list();
  const [mode, setMode] = useState<'register' | 'unregister' | null>(null);

  return (
    <section className="view">
      <div className="view__header-row">
        <h1 className="view__title">Agents</h1>
        <div className="button-row">
          <button type="button" className="btn" onClick={() => setMode('unregister')} disabled={!agents.some((a) => a.registered)}>Unregister…</button>
          <button type="button" className="btn btn--primary" onClick={() => setMode('register')} disabled={!agents.some((a) => a.detected)}>Register Agents…</button>
        </div>
      </div>
      <ul className="group__list">
        {agents.map((a) => <AgentRow key={a.id} agent={a} />)}
      </ul>
      {mode && <RegisterAgentsDialog mode={mode} onClose={() => setMode(null)} />}
    </section>
  );
}

function AgentRow({ agent }: { agent: AgentInfo }): JSX.Element {
  const badges: { label: string; cls?: string }[] = [];
  badges.push({ label: agent.detected ? 'detected' : 'not detected', cls: agent.detected ? undefined : 'badge--muted' });
  if (agent.detected) {
    badges.push({
      label: agent.registered ? `registered · ${agent.promptCount} prompts` : 'not registered',
      cls: agent.registered ? 'badge--success' : undefined,
    });
    if (agent.registered && agent.registeredScope) badges.push({ label: `scope: ${agent.registeredScope}`, cls: 'badge--accent' });
  }
  return (
    <li className={`row ${agent.detected ? '' : 'row--muted'}`}>
      <div className="row__main">
        <div className="row__title">{agent.name}</div>
        <div className="row__desc">id: <code>{agent.id}</code></div>
      </div>
      <div className="row__badges">
        {badges.map((b) => <span key={b.label} className={`badge ${b.cls ?? ''}`}>{b.label}</span>)}
      </div>
    </li>
  );
}
