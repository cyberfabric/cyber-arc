import type { WorkspaceFile } from '../../../../types';

interface Props { file: WorkspaceFile; }

/**
 * Minimal markdown → HTML renderer. Supports: ATX headings (# .. ###),
 * unordered lists (- / *), fenced code blocks (```), inline code (`x`),
 * **bold**, _italic_, and [text](url) links. Everything else renders as
 * a paragraph with literal text. Good enough for fixture content.
 */
export default function DefaultMarkdownRenderer({ file }: Props): JSX.Element {
  return <div className="ws-md">{renderBlocks(file.content)}</div>;
}

function renderBlocks(src: string): JSX.Element[] {
  const out: JSX.Element[] = [];
  const lines = src.split('\n');
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block
    if (/^```/.test(line)) {
      const langMatch = /^```([\w-]*)/.exec(line);
      const lang = langMatch ? langMatch[1] : '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume the closing fence
      out.push(
        <pre key={key++} className="ws-md__code" data-lang={lang}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    // Heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');
      out.push(<Tag key={key++} className={`ws-md__h${level}`}>{renderInline(text)}</Tag>);
      i++;
      continue;
    }
    // List block (consecutive list items)
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      out.push(
        <ul key={key++} className="ws-md__list">
          {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
        </ul>,
      );
      continue;
    }
    // Blank
    if (line.trim() === '') { i++; continue; }
    // Paragraph — gather consecutive non-special lines
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' &&
           !/^```|^#{1,3}\s|^[-*]\s/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(<p key={key++} className="ws-md__p">{renderInline(para.join(' '))}</p>);
  }
  return out;
}

function renderInline(text: string): (string | JSX.Element)[] {
  // Order: code → links → bold → italic. Anything unmatched passes through as text.
  const parts: (string | JSX.Element)[] = [text];
  const inlineCode = /`([^`]+)`/g;
  const link = /\[([^\]]+)\]\(([^)]+)\)/g;
  const bold = /\*\*([^*]+)\*\*/g;
  const italic = /_([^_]+)_/g;

  function replace(re: RegExp, wrap: (m: RegExpExecArray, k: number) => JSX.Element): void {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (typeof p !== 'string') continue;
      const next: (string | JSX.Element)[] = [];
      let last = 0;
      let k = 0;
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(p)) !== null) {
        if (m.index > last) next.push(p.slice(last, m.index));
        next.push(wrap(m, k++));
        last = m.index + m[0].length;
      }
      if (last < p.length) next.push(p.slice(last));
      if (next.length > 0) { parts.splice(i, 1, ...next); i += next.length - 1; }
    }
  }

  replace(inlineCode, (m, k) => <code key={`c${k}`} className="ws-md__inline-code">{m[1]}</code>);
  replace(link,       (m, k) => <a key={`a${k}`} href={m[2]} className="ws-md__link">{m[1]}</a>);
  replace(bold,       (m, k) => <strong key={`b${k}`}>{m[1]}</strong>);
  replace(italic,     (m, k) => <em key={`i${k}`}>{m[1]}</em>);

  return parts;
}
