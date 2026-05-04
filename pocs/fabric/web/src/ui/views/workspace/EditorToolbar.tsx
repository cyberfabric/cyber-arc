import type { ContributedAction } from './contributions';

interface Props {
  actions: ContributedAction[];
  activeFilePath: string | null;
  onInvoke: (action: ContributedAction, filePath: string) => void;
}

export default function EditorToolbar({ actions, activeFilePath, onInvoke }: Props): JSX.Element | null {
  if (actions.length === 0 || !activeFilePath) return null;
  return (
    <div className="ws-toolbar">
      <div className="ws-toolbar__label">Actions</div>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className="ws-toolbar__btn"
          onClick={() => onInvoke(a, activeFilePath)}
          title={`From kit: ${a.kitName}`}
        >
          {a.icon && <span aria-hidden>{iconFor(a.icon)}</span>}
          <span>{a.label}</span>
          <span className="ws-toolbar__kit">· {a.kitName}</span>
        </button>
      ))}
    </div>
  );
}

function iconFor(name: string): string {
  switch (name) {
    case 'git-pull-request': return '🔀';
    case 'check-circle':     return '✅';
    case 'workflow':         return '🧭';
    default:                 return '🧩';
  }
}
