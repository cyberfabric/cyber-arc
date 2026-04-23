import * as vscode from 'vscode';
import fabric from './fabricLib';
import { state } from './mock/state';

export function registerStatusBar(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(item);

  const refresh = (): void => {
    const det = fabric.system.detectCli();
    if (det.found) {
      item.text = `$(check) Fabric CLI ${det.version ?? ''}`.trim();
      item.tooltip = `Path: ${det.path ?? 'unknown'}`;
      item.command = undefined;
      item.backgroundColor = undefined;
    } else {
      item.text = `$(warning) Install Fabric CLI`;
      item.tooltip = 'Fabric CLI not detected — click to install';
      item.command = 'fabric.cli.install';
      item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    item.show();
  };

  state.on('cli', refresh);
  refresh();
}
