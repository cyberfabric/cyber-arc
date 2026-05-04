import type { WorkspaceFile } from '../../../../types';
import { tokenizeLine } from '../highlight/tokenize';
import { resolvePack, type HighlightPack } from '../highlight/packs';

interface Props {
  file: WorkspaceFile;
  highlightPack?: string;
}

/**
 * Line-numbered code with token coloring. Lines are tokenized eagerly —
 * fine for sub-200-line fixture files; revisit if fixtures grow.
 */
export default function DefaultCodeRenderer({ file, highlightPack }: Props): JSX.Element {
  const pack = resolvePack(highlightPack);
  const lines = file.content.split('\n');
  return (
    <pre className="ws-code">
      {lines.map((line, idx) => (
        <div key={idx} className="ws-code__row">
          <span className="ws-code__num">{idx + 1}</span>
          <span className="ws-code__line">{renderLine(line, file.language, pack)}</span>
        </div>
      ))}
    </pre>
  );
}

function renderLine(line: string, lang: Props['file']['language'], pack: HighlightPack): JSX.Element[] {
  if (line.length === 0) return [];
  return tokenizeLine(line, lang).map((tok, idx) => (
    <span key={idx} style={{ color: pack[tok.kind] ?? pack.default }}>{tok.text}</span>
  ));
}
