import * as vscode from 'vscode';
import { state } from '../mock/state';
import { logInfo } from '../output';

export function registerUiCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.store.togglePrereleases', async () => {
      state.includePrereleases = !state.includePrereleases;
      state.emit('ui');
      logInfo(`Pre-releases: ${state.includePrereleases ? 'shown' : 'hidden'}`);
      await vscode.window.showInformationMessage(
        `Pre-releases are now ${state.includePrereleases ? 'shown' : 'hidden'} in Store`,
      );
    }),
  );
}
