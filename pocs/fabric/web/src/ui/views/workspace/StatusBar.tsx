import type { WorkspaceFile } from '../../../types';

interface Props { file: WorkspaceFile | null; }

export default function StatusBar({ file }: Props): JSX.Element {
  if (!file) return <div className="ws-status ws-status--empty">No file open</div>;
  const lines = file.content.split('\n').length;
  return (
    <div className="ws-status">
      <span>{prettyLang(file.language)}</span>
      <span>{lines} lines</span>
      <span>Ln 1, Col 1</span>
      <span>UTF-8</span>
    </div>
  );
}

function prettyLang(l: WorkspaceFile['language']): string {
  switch (l) {
    case 'typescript': return 'TypeScript';
    case 'markdown':   return 'Markdown';
    case 'python':     return 'Python';
    case 'toml':       return 'TOML';
    case 'bash':       return 'Shell';
    case 'json':       return 'JSON';
  }
}
