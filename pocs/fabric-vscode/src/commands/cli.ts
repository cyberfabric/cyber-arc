import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { logInfo } from '../output';

export function registerCliCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.cli.toggleDetected', () => {
      fabric.system.toggleCli();
      const det = fabric.system.detectCli();
      logInfo(`PoC: toggled CLI detection → ${det.found ? 'found' : 'missing'}`);
    }),
    vscode.commands.registerCommand('fabric.cli.install', runMockInstall),
  );
}

async function runMockInstall(): Promise<void> {
  const method = await vscode.window.showQuickPick(
    [
      { label: 'npm', description: 'npm install -g @cyberfabric/fabric' },
      { label: 'brew', description: 'brew install cyberfabric/tap/fabric (macOS)' },
      { label: 'scoop', description: 'scoop install fabric (Windows)' },
    ],
    { placeHolder: 'Installation method (mocked)', ignoreFocusOut: true },
  );
  if (!method) return;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Installing Fabric CLI via ${method.label}…`, cancellable: false },
    async () => {
      await new Promise((r) => setTimeout(r, 2000));
      fabric.system.setCliDetected(true, fabric.system.MIN_CLI_VERSION);
    },
  );
  logInfo(`PoC: mock-installed Fabric CLI via ${method.label}`);
  await vscode.window.showInformationMessage('Fabric CLI installed ✓');
}
