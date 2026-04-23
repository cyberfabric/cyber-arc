import fabric from '../../fabricLib';
import { useMockState } from '../../hooks/useMockState';
import type { AgentInfo } from '../../types';

export default function AgentsView(): JSX.Element {
  useMockState(['agents', 'kits']);
  const agents = fabric.agents.list();

  return (
    <section className="view">
      <h1 className="view__title">Agents</h1>
      <p className="view__hint">Registration actions come in the next task. For now this view is read-only.</p>
      <ul className="group__list">
        {agents.map((a) => <AgentRow key={a.id} agent={a} />)}
      </ul>
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
