import { useMemo } from 'react';
import type { WorkspaceFile } from '../../../../types';
import DefaultMarkdownRenderer from './DefaultMarkdownRenderer';

interface Props { file: WorkspaceFile; }

interface Heading { level: 1 | 2 | 3; text: string; id: string; }

/**
 * Spec View: extracts H1–H3 headings into a left-column TOC; the right
 * column re-uses the default markdown renderer. TOC entries link via the
 * `id` anchor, which the markdown renderer doesn't emit — we override
 * anchor behavior with a click handler that scrolls to matching text.
 */
export default function SpecViewRenderer({ file }: Props): JSX.Element {
  const headings = useMemo(() => extractHeadings(file.content), [file.content]);

  const handleClick = (text: string) => () => {
    const root = document.querySelector('.ws-spec__body');
    if (!root) return;
    const hs = root.querySelectorAll('h1, h2, h3');
    for (const h of Array.from(hs)) {
      if (h.textContent?.trim() === text) {
        (h as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  };

  return (
    <div className="ws-spec">
      <aside className="ws-spec__toc">
        <div className="ws-spec__toc-label">On this page</div>
        {headings.length === 0 && <div className="ws-spec__toc-empty">No headings</div>}
        {headings.map((h, i) => (
          <button
            key={i}
            type="button"
            className={`ws-spec__toc-item ws-spec__toc-item--l${h.level}`}
            onClick={handleClick(h.text)}
          >
            {h.text}
          </button>
        ))}
      </aside>
      <div className="ws-spec__body">
        <DefaultMarkdownRenderer file={file} />
      </div>
    </div>
  );
}

function extractHeadings(src: string): Heading[] {
  const out: Heading[] = [];
  for (const line of src.split('\n')) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!m) continue;
    const level = m[1].length as 1 | 2 | 3;
    const text = m[2].trim();
    out.push({ level, text, id: slug(text) });
  }
  return out;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
