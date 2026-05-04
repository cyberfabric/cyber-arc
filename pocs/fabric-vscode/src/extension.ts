import * as vscode from 'vscode';
import fabric from './fabricLib';
import { KitsTreeDataProvider } from './ui/kitsView';
import { StoreTreeDataProvider } from './ui/storeView';
import { AgentsTreeDataProvider } from './ui/agentsView';
import { logError, logInfo } from './output';
import { registerMarketplaceCommands } from './commands/marketplace';
import { registerUiCommands } from './commands/ui';
import { registerKitCommands } from './commands/kit';
import { registerAgentCommands } from './commands/agent';
import { registerStatusBar } from './statusBar';
import { registerCliCommands } from './commands/cli';

const DEFAULT_MARKETPLACE = 'cyber-fabric-official';

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

  registerMarketplaceCommands(context);
  registerUiCommands(context);
  registerKitCommands(context);
  registerAgentCommands(context);
  registerStatusBar(context);
  registerCliCommands(context);

  seedDefaultMarketplace();
}

function seedDefaultMarketplace(): void {
  if (fabric.marketplaces.list().length > 0) return;
  try {
    const mk = fabric.marketplaces.add(DEFAULT_MARKETPLACE);
    logInfo(`Seeded default marketplace: ${mk.name} (${mk.kits.length} kits)`);
  } catch (err) {
    logError('seedDefaultMarketplace', err);
  }
}

export function deactivate(): void {}
