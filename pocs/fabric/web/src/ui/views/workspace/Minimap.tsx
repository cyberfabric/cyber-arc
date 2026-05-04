import type { WorkspaceFile } from '../../../types';
import { tokenizeLine } from './highlight/tokenize';
import { resolvePack } from './highlight/packs';

interface Props {
  file: WorkspaceFile | null;
  highlightPack?: string;
}

/**
 * Decorative schematic: one 2-px bar per line. Bar width proportional to
 * the first non-default token's text length, color from the active pack.
 * Skips markdown (preview mode doesn't map cleanly to token bars).
 */
export default function Minimap({ file, highlightPack }: Props): JSX.Element {
  if (!file || file.language === 'markdown') return <div className="ws-minimap ws-minimap--empty" />;
  const pack = resolvePack(highlightPack);
  const lines = file.content.split('\n');
  return (
    <div className="ws-minimap" aria-hidden>
      {lines.map((line, i) => {
        const toks = tokenizeLine(line, file.language);
        const dominant = toks.find((t) => t.kind !== 'default') ?? toks[0];
        const color = dominant ? pack[dominant.kind] ?? pack.default : pack.default;
        const width = Math.min(90, Math.max(2, (line.trimEnd().length ?? 0) * 2));
        return (
          <div
            key={i}
            className="ws-minimap__bar"
            style={{ background: color, width: `${width}%` }}
          />
        );
      })}
    </div>
  );
}
