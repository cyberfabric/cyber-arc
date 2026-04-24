import { forwardRef } from 'react';
import type { Workspace } from '../../../types';
import FileTree from './FileTree';

interface Props {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeTabPath: string | null;
  expanded: Set<string>;
  searchQuery: string;
  onSelectWorkspace: (id: string) => void;
  onChangeSearch: (q: string) => void;
  onToggleFolder: (p: string) => void;
  onOpenFile: (p: string) => void;
}

const WorkspacePanel = forwardRef<HTMLInputElement, Props>(function WorkspacePanel(props, searchRef) {
  return (
    <div className="ws-panel">
      <select
        className="ws-panel__switcher"
        value={props.activeWorkspace?.id ?? ''}
        onChange={(e) => props.onSelectWorkspace(e.target.value)}
      >
        <option value="" disabled>Select workspace…</option>
        {props.workspaces.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <input
        ref={searchRef}
        type="text"
        className="ws-panel__search"
        placeholder="Search files…"
        value={props.searchQuery}
        onChange={(e) => props.onChangeSearch(e.target.value)}
      />
      {props.activeWorkspace ? (
        <FileTree
          files={props.activeWorkspace.files}
          expanded={props.expanded}
          activePath={props.activeTabPath}
          searchQuery={props.searchQuery}
          onToggleFolder={props.onToggleFolder}
          onOpenFile={props.onOpenFile}
        />
      ) : (
        <div className="ws-panel__empty">Pick a workspace above.</div>
      )}
    </div>
  );
});

export default WorkspacePanel;
