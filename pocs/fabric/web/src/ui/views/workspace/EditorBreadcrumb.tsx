interface Props {
  workspaceName: string;
  filePath: string | null;
}

export default function EditorBreadcrumb({ workspaceName, filePath }: Props): JSX.Element {
  if (!filePath) return <div className="ws-crumb" />;
  const parts = filePath.split('/');
  return (
    <div className="ws-crumb">
      <span className="ws-crumb__seg ws-crumb__seg--ws">{workspaceName}</span>
      {parts.map((p, i) => (
        <span key={i} className="ws-crumb__seg">
          <span className="ws-crumb__sep">›</span>{p}
        </span>
      ))}
    </div>
  );
}
