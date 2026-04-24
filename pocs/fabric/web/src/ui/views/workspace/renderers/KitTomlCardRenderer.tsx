import { useMemo } from 'react';
import type { WorkspaceFile } from '../../../../types';

interface Props { file: WorkspaceFile; }

interface Section { name: string; entries: [string, string][]; }

/**
 * Renders a subset of TOML as a labeled card. Supports:
 *  - top-level `key = "value"` or `key = 42`
 *  - `[section]` headers
 *  - inline quoted strings and bare scalars
 * Comments and multiline structures are ignored.
 */
export default function KitTomlCardRenderer({ file }: Props): JSX.Element {
  const parsed = useMemo(() => parse(file.content), [file.content]);
  return (
    <div className="ws-toml">
      <div className="ws-toml__title">Kit Manifest</div>
      {parsed.top.length > 0 && (
        <div className="ws-toml__card">
          {parsed.top.map(([k, v]) => (
            <div className="ws-toml__row" key={k}>
              <div className="ws-toml__key">{k}</div>
              <div className="ws-toml__val">{v}</div>
            </div>
          ))}
        </div>
      )}
      {parsed.sections.map((s) => (
        <div className="ws-toml__card" key={s.name}>
          <div className="ws-toml__section">[{s.name}]</div>
          {s.entries.map(([k, v]) => (
            <div className="ws-toml__row" key={k}>
              <div className="ws-toml__key">{k}</div>
              <div className="ws-toml__val">{v}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function parse(src: string): { top: [string, string][]; sections: Section[] } {
  const top: [string, string][] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sec = /^\[([^\]]+)\]$/.exec(line);
    if (sec) { current = { name: sec[1], entries: [] }; sections.push(current); continue; }
    const kv = /^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.+)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const rawVal = kv[2].trim();
    const val = /^".*"$|^'.*'$/.test(rawVal) ? rawVal.slice(1, -1) : rawVal;
    if (current) current.entries.push([key, val]);
    else top.push([key, val]);
  }
  return { top, sections };
}
