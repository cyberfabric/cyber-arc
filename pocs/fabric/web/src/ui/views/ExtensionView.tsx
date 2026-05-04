import type { WebExtension } from '../../types';

interface Props {
  extension: WebExtension;
  sourceKit: string;
}

export default function ExtensionView({ extension, sourceKit }: Props): JSX.Element {
  return (
    <section className="view">
      <div className="view__header-row">
        <div>
          <h1 className="view__title">{extension.placeholder.title}</h1>
          <p className="view__lead">{extension.description}</p>
        </div>
        <span className="badge badge--accent">from kit: {sourceKit}</span>
      </div>
      <div className="ext-placeholder">
        <p className="view__hint">This page is a PoC placeholder — the real implementation would be shipped by the kit.</p>
        <ul className="ext-placeholder__list">
          {extension.placeholder.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
