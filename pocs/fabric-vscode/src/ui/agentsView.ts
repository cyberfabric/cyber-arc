import * as vscode from 'vscode';
import { state } from '../mock/state';

export type AgentNode = { kind: 'placeholder'; label: string };

export class AgentsTreeDataProvider implements vscode.TreeDataProvider<AgentNode> {
  private readonly _onDidChange = new vscode.EventEmitter<AgentNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('agents', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(element: AgentNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'fabric.agent.placeholder';
    return item;
  }

  getChildren(): AgentNode[] {
    return [{ kind: 'placeholder', label: '(no agents shown yet)' }];
  }
}
