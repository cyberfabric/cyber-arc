import * as vscode from 'vscode';
import { state } from '../mock/state';

export type StoreNode = { kind: 'placeholder'; label: string };

export class StoreTreeDataProvider implements vscode.TreeDataProvider<StoreNode> {
  private readonly _onDidChange = new vscode.EventEmitter<StoreNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('marketplaces', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(element: StoreNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'fabric.store.placeholder';
    return item;
  }

  getChildren(): StoreNode[] {
    return [{ kind: 'placeholder', label: 'Add a marketplace to browse kits' }];
  }
}
