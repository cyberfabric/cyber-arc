import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { state } from '../mock/state';
import type { AgentInfo } from '../types';

export type AgentNode = { kind: 'agent'; agent: AgentInfo };

export class AgentsTreeDataProvider implements vscode.TreeDataProvider<AgentNode> {
  private readonly _onDidChange = new vscode.EventEmitter<AgentNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('agents', () => this._onDidChange.fire(undefined));
    state.on('kits', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(node: AgentNode): vscode.TreeItem {
    const a = node.agent;
    const item = new vscode.TreeItem(a.name, vscode.TreeItemCollapsibleState.None);
    const status: string[] = [];
    status.push(a.detected ? 'detected' : 'not detected');
    if (a.detected) status.push(a.registered ? `registered · ${a.promptCount} prompts` : 'not registered');
    item.description = status.join(' · ');
    item.tooltip = new vscode.MarkdownString(
      `**${a.name}**\n\nDetected: ${a.detected ? '✓' : '✗'}\n\nRegistered: ${a.registered ? `✓ (${a.registeredScope})` : '✗'}\n\nPrompt count: ${a.promptCount}`,
    );
    item.contextValue = a.detected
      ? (a.registered ? 'fabric.agent.registered' : 'fabric.agent.unregistered')
      : 'fabric.agent.unsupported';
    item.iconPath = new vscode.ThemeIcon(
      a.detected ? (a.registered ? 'pass-filled' : 'circle-outline') : 'circle-slash',
    );
    return item;
  }

  getChildren(): AgentNode[] {
    return fabric.agents.list().map((agent) => ({ kind: 'agent' as const, agent }));
  }
}
