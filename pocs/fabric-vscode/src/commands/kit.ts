import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { runSafely } from '../errors';
import { logInfo } from '../output';
import type { InstalledKit, Marketplace, Scope } from '../types';

export function registerKitCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.kit.installFromUrl', installFromUrl),
    vscode.commands.registerCommand('fabric.kit.installFromStore', installFromStore),
    vscode.commands.registerCommand('fabric.kit.update', updateKit),
    vscode.commands.registerCommand('fabric.kit.simulateUpgrade', simulateUpgrade),
    vscode.commands.registerCommand('fabric.kit.uninstall', uninstallKit),
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

async function updateKit(item?: { kit: InstalledKit }): Promise<void> {
  const kit = item?.kit ?? (await pickInstalledKit('Select kit to update'));
  if (!kit) return;

  await runSafely('kit.update', async () => {
    const latest = fabric.marketplaces.listKits().find((k) => k.name === kit.name);
    if (!latest) throw new Error(`No marketplace currently offers ${kit.name}`);

    const diff = {
      added: latest.files.filter((f) => !kit.files.includes(f)),
      removed: kit.files.filter((f) => !latest.files.includes(f)),
      changed: latest.files.filter((f) => kit.files.includes(f)),
    };
    const lines = [
      `Update ${kit.name}: ${kit.version} → ${latest.version}`,
      '',
      ...diff.added.map((f) => `+ ${f}`),
      ...diff.removed.map((f) => `- ${f}`),
      ...diff.changed.map((f) => `~ ${f}`),
    ];
    const choice = await vscode.window.showInformationMessage(
      lines.join('\n'),
      { modal: true },
      'Apply Update',
    );
    if (choice !== 'Apply Update') return;

    const result = fabric.kits.update(kit.name, kit.scope);
    logInfo(`Updated ${result.name}: ${result.before} → ${result.after}`);
    await vscode.window.showInformationMessage(`Updated ${result.name} to ${result.after}`);
  });
}

async function simulateUpgrade(): Promise<void> {
  const kit = await pickInstalledKit('Pick an installed kit to bump in the marketplace');
  if (!kit) return;
  const bumped = nextPatchVersion(kit.version);
  (await import('../mock/state')).state.simulateMarketplaceUpgrade(kit.name, bumped);
  logInfo(`Simulated marketplace upgrade: ${kit.name} → ${bumped}`);
  await vscode.window.showInformationMessage(`Marketplace now offers ${kit.name} ${bumped}`);
}

async function pickInstalledKit(placeHolder: string): Promise<InstalledKit | undefined> {
  const all = fabric.kits.list({ scope: 'both' });
  if (all.length === 0) {
    await vscode.window.showInformationMessage('No kits installed');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    all.map((k) => ({
      label: k.name,
      description: `${k.version} · ${k.scope}`,
      kit: k,
    })),
    { placeHolder, ignoreFocusOut: true },
  );
  return picked?.kit;
}

function nextPatchVersion(v: string): string {
  const [main, pre] = v.split('-', 2);
  const parts = main.split('.').map((n) => Number.parseInt(n, 10));
  parts[2] = (parts[2] ?? 0) + 1;
  return pre ? `${parts.join('.')}-${pre}` : parts.join('.');
}

async function uninstallKit(item?: { kit: InstalledKit }): Promise<void> {
  const kit = item?.kit ?? (await pickInstalledKit('Select kit to uninstall'));
  if (!kit) return;
  const confirm = await vscode.window.showWarningMessage(
    `Uninstall ${kit.name} (${kit.scope})?`,
    { modal: true },
    'Uninstall',
  );
  if (confirm !== 'Uninstall') return;
  await runSafely('kit.uninstall', async () => {
    fabric.kits.uninstall(kit.name, kit.scope);
    logInfo(`Uninstalled ${kit.name} (${kit.scope})`);
    await vscode.window.showInformationMessage(`Uninstalled ${kit.name}`);
  });
}
