// Cyber Fabric VS Code Extension
// Host-native surface over the unified Fabric operational model (ADR-0017).

import * as vscode from "vscode";
import { Orchestrator, SkillRegistry } from "@cyber-fabric/fabric-core";
import type { OrchestratorConfig } from "@cyber-fabric/fabric-core";
import { ChatPanel } from "./chat-panel.js";

let orchestrator: Orchestrator | undefined;
let outputChannel: vscode.OutputChannel | undefined;

/**
 * Activate the Cyber Fabric extension.
 * Initialises the fabric-core Orchestrator and registers commands.
 */
export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("Cyber Fabric");
  outputChannel.appendLine("Cyber Fabric extension activating...");

  // Initialise fabric-core components
  const registry = new SkillRegistry();
  const config: OrchestratorConfig = {};
  orchestrator = new Orchestrator(registry, config);

  // --- Command: showStatus ---------------------------------------------------
  const showStatus = vscode.commands.registerCommand(
    "cyber-fabric.showStatus",
    () => {
      const msg = "Cyber Fabric is active. Orchestrator ready.";
      outputChannel!.appendLine(msg);
      vscode.window.showInformationMessage(msg);
    },
  );

  // --- Command: runPipeline --------------------------------------------------
  const runPipeline = vscode.commands.registerCommand(
    "cyber-fabric.runPipeline",
    async () => {
      try {
        vscode.window.showInformationMessage(
          "Cyber Fabric: no pipeline loaded yet. Use the Chat panel (Phase 9) or provide a plan file.",
        );
        outputChannel!.appendLine("runPipeline invoked — no pipeline loaded.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel!.appendLine(`runPipeline error: ${message}`);
        vscode.window.showErrorMessage(`Cyber Fabric pipeline error: ${message}`);
      }
    },
  );

  // --- Command: openChat -------------------------------------------------------
  const openChat = vscode.commands.registerCommand(
    "cyber-fabric.openChat",
    () => {
      ChatPanel.createOrShow(context.extensionUri, orchestrator!);
      outputChannel!.appendLine("Chat panel opened.");
    },
  );

  context.subscriptions.push(outputChannel, showStatus, runPipeline, openChat);

  outputChannel.appendLine("Cyber Fabric extension activated.");
}

/**
 * Deactivate the Cyber Fabric extension.
 * Cleans up orchestrator resources.
 */
export function deactivate(): void {
  if (outputChannel) {
    outputChannel.appendLine("Cyber Fabric extension deactivating...");
  }
  orchestrator = undefined;
}
