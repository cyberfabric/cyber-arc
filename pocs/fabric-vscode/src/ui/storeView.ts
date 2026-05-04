import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { state } from '../mock/state';
import type { Marketplace, MarketplaceKit } from '../types';

export type StoreNode =
  | { kind: 'marketplace'; marketplace: Marketplace; kits: MarketplaceKit[] }
  | { kind: 'kit'; marketplace: string; kit: MarketplaceKit }
  | { kind: 'empty'; label: string; contextValue: string };

export class StoreTreeDataProvider implements vscode.TreeDataProvider<StoreNode> {
  private readonly _onDidChange = new vscode.EventEmitter<StoreNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor() {
    state.on('marketplaces', () => this._onDidChange.fire(undefined));
    state.on('ui', () => this._onDidChange.fire(undefined));
  }

  getTreeItem(node: StoreNode): vscode.TreeItem {
    if (node.kind === 'marketplace') {
      const item = new vscode.TreeItem(
        `${node.marketplace.name} (${node.kits.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.description = node.marketplace.description;
      item.tooltip = new vscode.MarkdownString(
        `**${node.marketplace.name}**\n\n${node.marketplace.description}\n\nSource: \`${node.marketplace.addedFrom}\``,
      );
      item.contextValue = 'fabric.marketplace';
      item.iconPath = new vscode.ThemeIcon('organization');
      return item;
    }
    if (node.kind === 'kit') {
      const item = new vscode.TreeItem(node.kit.name, vscode.TreeItemCollapsibleState.None);
      const prerelease = isPrerelease(node.kit.version);
      const brokenSuffix = node.kit.broken ? ' (broken)' : '';
      item.description = `${node.kit.version}${prerelease ? ' · pre-release' : ''}${brokenSuffix}`;
      item.tooltip = new vscode.MarkdownString(
        `**${node.kit.name}** ${node.kit.version}\n\n${node.kit.description}\n\nCategory: ${node.kit.category}`,
      );
      item.contextValue = node.kit.broken ? 'fabric.marketplace.kit.broken' : 'fabric.marketplace.kit';
      item.iconPath = new vscode.ThemeIcon(node.kit.broken ? 'warning' : 'cloud-download');
      item.command = {
        command: 'fabric.kit.installFromStore',
        title: 'Install',
        arguments: [node.marketplace, node.kit.name],
      };
      return item;
    }
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = node.contextValue;
    return item;
  }

  getChildren(node?: StoreNode): StoreNode[] {
    if (!node) {
      const mkts = fabric.marketplaces.list();
      if (mkts.length === 0) {
        return []; // viewsWelcome takes over
      }
      return mkts.map((m) => ({
        kind: 'marketplace' as const,
        marketplace: m,
        kits: filterKits(m.kits),
      }));
    }
    if (node.kind === 'marketplace') {
      return node.kits.map((kit) => ({ kind: 'kit' as const, marketplace: node.marketplace.name, kit }));
    }
    return [];
  }
}

function isPrerelease(version: string): boolean {
  return version.includes('-');
}

function filterKits(kits: MarketplaceKit[]): MarketplaceKit[] {
  if (state.includePrereleases) return kits;
  return kits.filter((k) => !isPrerelease(k.version));
}
