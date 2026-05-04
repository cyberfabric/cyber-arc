import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function fabricOutput(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Fabric');
  }
  return channel;
}

export function logInfo(message: string): void {
  const ts = new Date().toISOString();
  fabricOutput().appendLine(`[${ts}] INFO  ${message}`);
}

export function logError(message: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const reason = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err ?? '');
  fabricOutput().appendLine(`[${ts}] ERROR ${message}${reason ? `\n  ${reason}` : ''}`);
}
