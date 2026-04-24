import { useEffect, useMemo, useRef } from 'react';
import fabric from '../../fabricLib';
import { useMockState } from '../../hooks/useMockState';
import { state } from '../../mock/state';
import ActivityBar from './workspace/ActivityBar';
import WorkspacePanel from './workspace/WorkspacePanel';
import EditorTabs from './workspace/EditorTabs';
import EditorBreadcrumb from './workspace/EditorBreadcrumb';
import EditorToolbar from './workspace/EditorToolbar';
import FileEditor from './workspace/FileEditor';
import Minimap from './workspace/Minimap';
import StatusBar from './workspace/StatusBar';
import ChatPanel from './workspace/ChatPanel';
import { collectActiveContributions } from './workspace/contributions';
import { substituteFile } from './workspace/canned';

export default function WorkspacesView(): JSX.Element {
  // Re-render on any state channel that affects this view.
  useMockState(['workspaces', 'workspaces-ui', 'kits', 'marketplaces']);

  const workspaces = fabric.workspaces.list();
  const activeWorkspaceId = state.activeWorkspaceId;
  const activeWorkspace = activeWorkspaceId ? fabric.workspaces.get(activeWorkspaceId) ?? null : null;
  const activeFile = activeWorkspace && state.activeTabPath
    ? activeWorkspace.files.find((f) => f.path === state.activeTabPath) ?? null
    : null;

  // Auto-select the first workspace on first render.
  useEffect(() => {
    if (!state.activeWorkspaceId && workspaces.length > 0) {
      fabric.workspaces.setActiveWorkspace(workspaces[0].id);
    }
  }, [workspaces.length]);

  const contributions = useMemo(
    () => collectActiveContributions(),
    // Recompute when installed kits or marketplaces change.
    [fabric.kits.list({ scope: 'both' }).length, fabric.marketplaces.list().length],
  );

  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearch = (): void => searchRef.current?.focus();

  return (
    <div className="ws">
      <ActivityBar
        contributionCount={contributions.renderers.length + contributions.actions.length + (contributions.highlightPack !== 'default' ? 1 : 0)}
        onFocusSearch={focusSearch}
      />
      <WorkspacePanel
        ref={searchRef}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        activeTabPath={state.activeTabPath}
        expanded={state.expandedFolders}
        searchQuery={state.treeSearch}
        onSelectWorkspace={fabric.workspaces.setActiveWorkspace}
        onChangeSearch={fabric.workspaces.setTreeSearch}
        onToggleFolder={fabric.workspaces.toggleFolder}
        onOpenFile={fabric.workspaces.openTab}
      />
      <div className="ws__main">
        <EditorTabs
          tabs={state.openTabs}
          activePath={state.activeTabPath}
          onActivate={fabric.workspaces.activateTab}
          onClose={fabric.workspaces.closeTab}
        />
        <div className="ws__sub-header">
          <EditorBreadcrumb
            workspaceName={activeWorkspace?.name ?? ''}
            filePath={state.activeTabPath}
          />
          <EditorToolbar
            actions={contributions.actions}
            activeFilePath={state.activeTabPath}
            onInvoke={(action, filePath) => {
              const now = Date.now();
              fabric.workspaces.pushChatMessage({
                id: `u-${now}`,
                role: 'user',
                text: substituteFile(action.onClickPrompt, filePath),
                timestamp: now,
                fileContext: filePath,
              });
            }}
          />
        </div>
        <div className="ws__editor-row">
          <FileEditor
            file={activeFile}
            contributedRenderers={contributions.renderers}
            highlightPack={contributions.highlightPack}
          />
          <Minimap file={activeFile} highlightPack={contributions.highlightPack} />
        </div>
        <ChatPanel
          messages={state.chatMessages}
          agent={state.chatAgent}
          input={state.chatInput}
          activeFile={activeFile}
          onChangeAgent={fabric.workspaces.setChatAgent}
          onChangeInput={fabric.workspaces.setChatInput}
        />
        <StatusBar file={activeFile} />
      </div>
    </div>
  );
}
