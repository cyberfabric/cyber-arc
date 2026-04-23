import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { runSafely } from '../errors';
import { logInfo } from '../output';
import type { Marketplace, Scope } from '../types';

export function registerKitCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.kit.installFromUrl', installFromUrl),
    vscode.commands.registerCommand('fabric.kit.installFromStore', installFromStore),
  );
}

async function pickScope(): Promise<Scope | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'Project', description: 'Install into the workspace .fabric/', scope: 'project' as Scope },
      { label: 'Global',  description: 'Install into ~/.fabric/',              scope: 'global'  as Scope },
    ],
    { placeHolder: 'Install scope', ignoreFocusOut: true },
  );
  return picked?.scope;
}

async function installFromUrl(): Promise<void> {
  const url = await vscode.window.showInputBox({
    prompt: 'Kit git URL',
    placeHolder: 'https://github.com/cyberfabric/review-prompts.git',
    ignoreFocusOut: true,
  });
  if (!url) return;
  const version = await vscode.window.showInputBox({
    prompt: 'Kit version (semver)',
    placeHolder: '1.2.0',
    ignoreFocusOut: true,
  });
  if (!version) return;
  const scope = await pickScope();
  if (!scope) return;

  await runSafely('kit.installFromUrl', async () => {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Installing ${url}…`, cancellable: false },
      async () => {
        await sleep(400);
        const kit = fabric.kits.install({ source: { url, version }, scope });
        logInfo(`Installed ${kit.name} ${kit.version} at ${scope}`);
        await vscode.window.showInformationMessage(`Installed ${kit.name} ${kit.version}`);
      },
    );
  });
}

async function installFromStore(marketplace: Marketplace, kitName: string): Promise<void> {
  if (!marketplace || !kitName) {
    await vscode.window.showErrorMessage('Install from Store requires a marketplace and a kit name');
    return;
  }
  const scope = await pickScope();
  if (!scope) return;

  await runSafely('kit.installFromStore', async () => {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Installing ${kitName}…`, cancellable: false },
      async () => {
        await sleep(400);
        const kit = fabric.kits.install({
          source: { marketplace: marketplace.name, kit: kitName },
          scope,
        });
        logInfo(`Installed ${kit.name} ${kit.version} at ${scope} from ${marketplace.name}`);
        await vscode.window.showInformationMessage(`Installed ${kit.name} ${kit.version}`);
      },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
