import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { state } from '../mock/state';
import type { InstalledKit, Scope } from '../types';

export type KitNode =
  | { kind: 'group'; scope: Scope; label: string; kits: InstalledKit[] }
  | { kind: 'kit'; kit: InstalledKit }
  | { kind: 'empty'; label: string };

export class KitsTreeDataProvider implements vscode.TreeDataProvider<KitNode> {
  private readonly _onDidChange = new vscode.EventEmitter<KitNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('kits', () => this._onDidChange.fire(undefined));
    state.on('marketplaces', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(node: KitNode): vscode.TreeItem {
    if (node.kind === 'group') {
      const item = new vscode.TreeItem(
        `${node.label} (${node.kits.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = `fabric.kits.group.${node.scope}`;
      item.iconPath = new vscode.ThemeIcon('folder');
      return item;
    }
    if (node.kind === 'kit') {
      const item = new vscode.TreeItem(node.kit.name, vscode.TreeItemCollapsibleState.None);
      item.description = `${node.kit.version}${node.kit.updateAvailable ? ` (update → ${node.kit.updateAvailable.latest})` : ''}`;
      item.tooltip = new vscode.MarkdownString(
        `**${node.kit.name}** ${node.kit.version}\n\n${node.kit.description}\n\nScope: \`${node.kit.scope}\``,
      );
      item.contextValue = node.kit.updateAvailable ? 'fabric.kit.updatable' : 'fabric.kit.installed';
      item.iconPath = new vscode.ThemeIcon(node.kit.updateAvailable ? 'sync' : 'package');
      return item;
    }
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'fabric.kits.empty';
    return item;
  }

  getChildren(node?: KitNode): KitNode[] {
    if (!node) {
      const all = fabric.kits.list({ scope: 'both' });
      if (all.length === 0) {
        return [{ kind: 'empty', label: '(no kits installed)' }];
      }
      const project = all.filter((k) => k.scope === 'project');
      const global = all.filter((k) => k.scope === 'global');
      const groups: KitNode[] = [];
      if (project.length > 0) groups.push({ kind: 'group', scope: 'project', label: 'Workspace', kits: project });
      if (global.length > 0) groups.push({ kind: 'group', scope: 'global', label: 'User', kits: global });
      return groups;
    }
    if (node.kind === 'group') {
      return node.kits.map((kit) => ({ kind: 'kit' as const, kit }));
    }
    return [];
  }
}
