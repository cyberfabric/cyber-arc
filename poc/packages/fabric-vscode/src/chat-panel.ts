// Cyber Fabric Chat Panel
// Webview-based chat UI for conversational interaction with the Fabric orchestrator.

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { Orchestrator } from "@cyber-fabric/fabric-core";

/** Messages sent from the webview to the extension host. */
export type WebviewMessage =
  | { type: "sendMessage"; text: string }
  | { type: "ready" };

/** Messages sent from the extension host to the webview. */
export type ExtensionMessage =
  | { type: "response"; text: string; isStreaming?: boolean }
  | { type: "status"; state: "idle" | "processing" | "error"; message?: string }
  | { type: "clear" };

/** Generate a cryptographically secure nonce for Content Security Policy. */
function getNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * ChatPanel manages a VS Code webview panel that provides a conversational
 * interface to the Fabric orchestrator. Uses a singleton pattern so only
 * one chat panel exists at a time.
 */
export class ChatPanel {
  public static readonly viewType = "cyberFabric.chatPanel";
  private static currentPanel: ChatPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly orchestrator: Orchestrator;
  private disposables: vscode.Disposable[] = [];

  /**
   * Create or reveal the chat panel singleton.
   * @param extensionUri - The extension's root URI for loading local resources.
   * @param orchestrator - The Fabric orchestrator instance for processing messages.
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    orchestrator: Orchestrator,
  ): ChatPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel.panel.reveal(column);
      return ChatPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      ChatPanel.viewType,
      "Cyber Fabric Chat",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist", "webview")],
      },
    );

    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, orchestrator);
    return ChatPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    orchestrator: Orchestrator,
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.orchestrator = orchestrator;

    this.panel.webview.html = this.getWebviewContent();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message),
      null,
      this.disposables,
    );
  }

  /** Send a typed message to the webview. */
  public postMessage(message: ExtensionMessage): void {
    this.panel.webview.postMessage(message);
  }

  /** Dispose the panel and all associated resources. */
  public dispose(): void {
    ChatPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }

  /** Handle incoming messages from the webview. */
  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.postMessage({ type: "status", state: "idle", message: "Connected to Cyber Fabric" });
        break;

      case "sendMessage": {
        const userText = message.text.trim();
        if (!userText) return;

        this.postMessage({ type: "status", state: "processing" });

        try {
          // For the PoC, respond with a status message indicating the orchestrator
          // is available but no pipeline is configured yet. A full implementation
          // would parse the user intent, create a pipeline via the Planner, and
          // execute it through the Orchestrator.
          const responseText =
            `[Cyber Fabric] Received: "${userText}"\n\n` +
            `Orchestrator is ready. To execute a pipeline, register skills and ` +
            `adapters first. This PoC demonstrates the message flow between the ` +
            `chat panel and the Fabric core.`;

          this.postMessage({ type: "response", text: responseText });
          this.postMessage({ type: "status", state: "idle" });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.postMessage({ type: "response", text: `Error: ${errMsg}` });
          this.postMessage({ type: "status", state: "error", message: errMsg });
        }
        break;
      }
    }
  }

  /** Build the webview HTML content with nonce-based CSP. */
  private getWebviewContent(): string {
    const nonce = getNonce();
    const htmlPath = path.join(
      this.extensionUri.fsPath,
      "dist",
      "webview",
      "chat.html",
    );

    try {
      const htmlTemplate = fs.readFileSync(htmlPath, "utf-8");
      return htmlTemplate.replace(/\{\{nonce\}\}/g, nonce);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><title>Cyber Fabric Chat</title></head><body><h2>Cyber Fabric Chat</h2><p>Failed to load chat template.</p><pre>${msg.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string))}</pre></body></html>`;
    }
  }
}
