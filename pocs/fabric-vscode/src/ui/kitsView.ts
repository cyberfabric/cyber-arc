import * as vscode from 'vscode';
import { state } from '../mock/state';

export type KitNode = { kind: 'placeholder'; label: string };

export class KitsTreeDataProvider implements vscode.TreeDataProvider<KitNode> {
  private readonly _onDidChange = new vscode.EventEmitter<KitNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('kits', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(element: KitNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'fabric.kit.placeholder';
    return item;
  }

  getChildren(): KitNode[] {
    return [{ kind: 'placeholder', label: '(no kits installed)' }];
  }
}
