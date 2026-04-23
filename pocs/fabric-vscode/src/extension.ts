import * as vscode from 'vscode';
import { KitsTreeDataProvider } from './ui/kitsView';
import { StoreTreeDataProvider } from './ui/storeView';
import { AgentsTreeDataProvider } from './ui/agentsView';
import { logInfo } from './output';

export function activate(context: vscode.ExtensionContext): void {
  logInfo('fabric extension activated');

  const kitsProvider = new KitsTreeDataProvider();
  const storeProvider = new StoreTreeDataProvider();
  const agentsProvider = new AgentsTreeDataProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('fabric.kits', kitsProvider),
    vscode.window.registerTreeDataProvider('fabric.store', storeProvider),
    vscode.window.registerTreeDataProvider('fabric.agents', agentsProvider),
  );
}

export function deactivate(): void {}
