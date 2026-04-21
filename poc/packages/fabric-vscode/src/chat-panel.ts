// Cyber Fabric Chat Panel
// Webview-based chat UI for conversational interaction with the Fabric orchestrator.

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
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

/** Generate a random nonce for Content Security Policy. */
function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
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
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "src", "webview")],
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

    // Try to load the external HTML template, falling back to inline HTML
    const htmlPath = path.join(
      this.extensionUri.fsPath,
      "src",
      "webview",
      "chat.html",
    );

    let htmlTemplate: string | undefined;
    try {
      htmlTemplate = fs.readFileSync(htmlPath, "utf-8");
    } catch {
      // Fall through to inline template
    }

    if (htmlTemplate) {
      // Inject nonce into the template placeholders
      return htmlTemplate.replace(/\{\{nonce\}\}/g, nonce);
    }

    // Inline fallback
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Cyber Fabric Chat</title>
  <style nonce="${nonce}">
    body {
      margin: 0; padding: 0;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex; flex-direction: column; height: 100vh;
    }
    #messages {
      flex: 1; overflow-y: auto; padding: 12px;
    }
    .message { margin-bottom: 12px; padding: 8px 12px; border-radius: 6px; max-width: 85%; }
    .message.user { background: var(--vscode-input-background); margin-left: auto; }
    .message.assistant { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    #input-area {
      display: flex; gap: 8px; padding: 8px 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    #input {
      flex: 1; resize: none; padding: 8px;
      font-family: inherit; font-size: inherit;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px; min-height: 36px;
    }
    #send {
      padding: 8px 16px; cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px;
    }
    #send:hover { background: var(--vscode-button-hoverBackground); }
    #send:disabled { opacity: 0.5; cursor: default; }
    #status-bar { padding: 4px 12px; font-size: 11px; color: var(--vscode-descriptionForeground); }
    .loading { display: none; padding: 8px 12px; }
    .loading.visible { display: block; }
  </style>
</head>
<body>
  <div id="messages" role="log" aria-label="Chat messages" aria-live="polite"></div>
  <div id="loading" class="loading" aria-label="Processing">Processing...</div>
  <div id="status-bar" role="status" aria-live="polite"></div>
  <div id="input-area">
    <textarea id="input" rows="1" aria-label="Message input" placeholder="Type a message..."></textarea>
    <button id="send" aria-label="Send message">Send</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const loadingEl = document.getElementById('loading');
    const statusBar = document.getElementById('status-bar');

    function addMessage(text, role) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.setAttribute('role', 'article');
      div.setAttribute('aria-label', role + ' message');
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function send() {
      const text = inputEl.value.trim();
      if (!text) return;
      addMessage(text, 'user');
      vscode.postMessage({ type: 'sendMessage', text: text });
      inputEl.value = '';
      sendBtn.disabled = true;
    }

    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    window.addEventListener('message', function(event) {
      const msg = event.data;
      switch (msg.type) {
        case 'response':
          addMessage(msg.text, 'assistant');
          sendBtn.disabled = false;
          loadingEl.classList.remove('visible');
          break;
        case 'status':
          statusBar.textContent = msg.message || msg.state;
          if (msg.state === 'processing') { loadingEl.classList.add('visible'); sendBtn.disabled = true; }
          else { loadingEl.classList.remove('visible'); sendBtn.disabled = false; }
          break;
        case 'clear':
          messagesEl.innerHTML = '';
          break;
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
