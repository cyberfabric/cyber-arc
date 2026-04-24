import { state } from './state';
import type { Workspace, ChatMessage, ChatAgent } from '../types';

function list(): Workspace[] {
  return [...state.workspaces];
}

function get(id: string): Workspace | undefined {
  return state.workspaces.find((w) => w.id === id);
}

// UI state setters — small explicit API so view components don't poke state directly.

function setActiveWorkspace(id: string | null): void {
  if (state.activeWorkspaceId === id) return;
  state.activeWorkspaceId = id;
  state.openTabs = [];
  state.activeTabPath = null;
  state.expandedFolders = new Set();
  state.treeSearch = '';
  state.emit('workspaces-ui');
}

function openTab(path: string): void {
  if (!state.openTabs.includes(path)) state.openTabs = [...state.openTabs, path];
  state.activeTabPath = path;
  state.emit('workspaces-ui');
}

function closeTab(path: string): void {
  const idx = state.openTabs.indexOf(path);
  if (idx === -1) return;
  const next = [...state.openTabs];
  next.splice(idx, 1);
  state.openTabs = next;
  if (state.activeTabPath === path) {
    state.activeTabPath = next[idx] ?? next[idx - 1] ?? null;
  }
  state.emit('workspaces-ui');
}

function activateTab(path: string): void {
  if (!state.openTabs.includes(path)) return;
  state.activeTabPath = path;
  state.emit('workspaces-ui');
}

function toggleFolder(folderPath: string): void {
  const next = new Set(state.expandedFolders);
  if (next.has(folderPath)) next.delete(folderPath);
  else next.add(folderPath);
  state.expandedFolders = next;
  state.emit('workspaces-ui');
}

function setTreeSearch(query: string): void {
  state.treeSearch = query;
  state.emit('workspaces-ui');
}

function setChatAgent(agent: ChatAgent): void {
  state.chatAgent = agent;
  state.emit('workspaces-ui');
}

function setChatInput(value: string): void {
  state.chatInput = value;
  state.emit('workspaces-ui');
}

function pushChatMessage(msg: ChatMessage): void {
  state.chatMessages = [...state.chatMessages, msg];
  state.emit('workspaces-ui');
}

export const workspaces = {
  list,
  get,
  setActiveWorkspace,
  openTab,
  closeTab,
  activateTab,
  toggleFolder,
  setTreeSearch,
  setChatAgent,
  setChatInput,
  pushChatMessage,
};
