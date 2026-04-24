interface Props {
  contributionCount: number;
  onFocusSearch: () => void;
}

/**
 * 32-px icon column. v1 has three slots:
 *  - Explorer (always active)
 *  - Search (focuses tree search)
 *  - Extensions (count badge, no dropdown)
 */
export default function ActivityBar({ contributionCount, onFocusSearch }: Props): JSX.Element {
  return (
    <aside className="ws-act">
      <button type="button" className="ws-act__item ws-act__item--active" title="Explorer">📁</button>
      <button type="button" className="ws-act__item" title="Search files" onClick={onFocusSearch}>🔍</button>
      <button type="button" className="ws-act__item" title={`Active contributions: ${contributionCount}`}>
        🧩
        {contributionCount > 0 && <span className="ws-act__badge">{contributionCount}</span>}
      </button>
    </aside>
  );
}
