import * as vscode from 'vscode';
import { fabricOutput, logError } from './output';

export async function reportError(scope: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  logError(`${scope}: ${message}`, err);
  const choice = await vscode.window.showErrorMessage(`Failed: ${message}`, 'Show Logs');
  if (choice === 'Show Logs') {
    fabricOutput().show(true);
  }
}

export async function runSafely<T>(scope: string, body: () => Promise<T> | T): Promise<T | undefined> {
  try {
    return await body();
  } catch (err) {
    await reportError(scope, err);
    return undefined;
  }
}
