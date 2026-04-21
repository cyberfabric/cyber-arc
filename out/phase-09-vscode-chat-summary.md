# Phase 9: VS Code Chat Panel — Summary

## ChatPanel Class API

- `ChatPanel.createOrShow(extensionUri, orchestrator)` — Static factory that creates or reveals the singleton chat panel. Accepts the extension URI for local resource loading and the Orchestrator instance for message processing.
- `chatPanel.postMessage(message)` — Sends a typed `ExtensionMessage` to the webview (response, status, or clear).
- `chatPanel.dispose()` — Cleans up the webview panel and all disposable resources.

## Message Protocol

### Webview to Host (WebviewMessage)
| Type          | Payload        | Description                          |
|---------------|----------------|--------------------------------------|
| `sendMessage` | `text: string` | User sends a chat message            |
| `ready`       | —              | Webview signals it has loaded         |

### Host to Webview (ExtensionMessage)
| Type       | Payload                                      | Description                          |
|------------|----------------------------------------------|--------------------------------------|
| `response` | `text: string`, `isStreaming?: boolean`       | AI response to display               |
| `status`   | `state: idle|processing|error`, `message?`   | Connection/processing state update   |
| `clear`    | —                                            | Clear the message history            |

## Webview Structure

- `webview/chat.html` — Standalone HTML template with `{{nonce}}` placeholders injected at runtime.
- Nonce-based Content Security Policy restricts scripts and styles to the generated nonce.
- All styling uses VS Code CSS custom properties (`--vscode-*`) for automatic light/dark theme support.
- Accessible markup: `role="log"`, `role="article"`, `aria-label`, `aria-live="polite"` on key elements.
- Keyboard support: Enter sends, Shift+Enter inserts newline.

## Integration Points

- **extension.ts** — Imports `ChatPanel` and registers `cyber-fabric.openChat` command, passing `context.extensionUri` and the module-level `orchestrator`.
- **package.json** — New activation event and command contribution for `cyber-fabric.openChat`.
- **Orchestrator** — ChatPanel receives the Orchestrator instance. In the PoC, messages are acknowledged with a status response; full pipeline execution integration is deferred to the demo phase.

## Files Created / Modified

- Created: `packages/fabric-vscode/src/chat-panel.ts`
- Created: `packages/fabric-vscode/src/webview/chat.html`
- Modified: `packages/fabric-vscode/src/extension.ts`
- Modified: `packages/fabric-vscode/package.json`
