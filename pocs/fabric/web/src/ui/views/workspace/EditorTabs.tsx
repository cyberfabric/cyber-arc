interface Props {
  tabs: string[];
  activePath: string | null;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
}

export default function EditorTabs(props: Props): JSX.Element {
  if (props.tabs.length === 0) return <div className="ws-tabs ws-tabs--empty" />;
  return (
    <div className="ws-tabs" role="tablist">
      {props.tabs.map((t) => {
        const name = t.split('/').pop();
        const active = t === props.activePath;
        return (
          <div
            key={t}
            role="tab"
            className={`ws-tab ${active ? 'ws-tab--active' : ''}`}
            onClick={() => props.onActivate(t)}
          >
            <span className="ws-tab__label">{name}</span>
            <button
              type="button"
              className="ws-tab__close"
              aria-label={`Close ${name}`}
              onClick={(e) => { e.stopPropagation(); props.onClose(t); }}
            >×</button>
          </div>
        );
      })}
    </div>
  );
}
