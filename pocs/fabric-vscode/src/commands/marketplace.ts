import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { runSafely } from '../errors';
import { logInfo } from '../output';

export function registerMarketplaceCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.marketplace.add', handleAdd),
    vscode.commands.registerCommand('fabric.marketplace.remove', handleRemove),
    vscode.commands.registerCommand('fabric.marketplace.refresh', handleRefresh),
  );
}

async function handleAdd(): Promise<void> {
  const source = await vscode.window.showInputBox({
    prompt: 'Marketplace git URL or local path',
    placeHolder: 'cyber-fabric-official  or  https://github.com/…',
    ignoreFocusOut: true,
  });
  if (!source) return;
  await runSafely('marketplace.add', async () => {
    const mk = fabric.marketplaces.add(source.trim());
    logInfo(`Added marketplace: ${mk.name} (${mk.kits.length} kits)`);
    await vscode.window.showInformationMessage(`Added marketplace: ${mk.name}`);
  });
}

async function handleRemove(): Promise<void> {
  const list = fabric.marketplaces.list();
  if (list.length === 0) {
    await vscode.window.showInformationMessage('No marketplaces to remove');
    return;
  }
  const picked = await vscode.window.showQuickPick(
    list.map((m) => ({ label: m.name, description: m.description, mkt: m })),
    { placeHolder: 'Select marketplace to remove', ignoreFocusOut: true },
  );
  if (!picked) return;
  await runSafely('marketplace.remove', async () => {
    fabric.marketplaces.remove(picked.mkt.name);
    logInfo(`Removed marketplace: ${picked.mkt.name}`);
    await vscode.window.showInformationMessage(`Removed ${picked.mkt.name}`);
  });
}

async function handleRefresh(): Promise<void> {
  await runSafely('marketplace.refresh', async () => {
    const { updated } = fabric.marketplaces.refresh();
    logInfo(`Refreshed ${updated.length} marketplace(s)`);
    await vscode.window.showInformationMessage(`Refreshed ${updated.length} marketplace(s)`);
  });
}
