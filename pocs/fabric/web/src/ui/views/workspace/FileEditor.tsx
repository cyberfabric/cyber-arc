import type { WorkspaceFile } from '../../../types';
import type { ContributedRenderer } from './contributions';
import { renderers, defaultRendererKey } from './renderers/registry';
import { matchesGlob } from './glob';

interface Props {
  file: WorkspaceFile | null;
  contributedRenderers: ContributedRenderer[];
  highlightPack: string;
}

/**
 * Resolves the renderer for the active file:
 * 1. First contributed renderer whose `match` matches the path.
 * 2. Fallback to default by language.
 */
export default function FileEditor({ file, contributedRenderers, highlightPack }: Props): JSX.Element {
  if (!file) return <EmptyPane />;
  const hit = contributedRenderers.find((r) => matchesGlob(file.path, r.match));
  const key = hit?.componentKey ?? defaultRendererKey(file);
  const Component = renderers[key] ?? renderers[defaultRendererKey(file)];
  return (
    <div className="ws-editor">
      <Component file={file} highlightPack={highlightPack} />
    </div>
  );
}

function EmptyPane(): JSX.Element {
  return (
    <div className="ws-editor ws-editor--empty">
      <p>Pick a file from the tree to view it.</p>
      <p className="ws-editor__hint">Install kits from the Store to unlock richer renderers and actions.</p>
    </div>
  );
}
