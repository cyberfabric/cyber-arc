// Cyber Fabric VS Code Extension
// Host-native surface over the unified Fabric operational model (ADR-0017).

import * as vscode from "vscode";
import { Orchestrator, SkillRegistry } from "@cyber-fabric/fabric-core";
import type { OrchestratorConfig } from "@cyber-fabric/fabric-core";
import { ChatPanel } from "./chat-panel.js";
import { PlanTreeProvider } from "./plan-tree.js";
import { DelegationViewProvider } from "./delegation-view.js";
import type { OrchestratorEvent } from "@cyber-fabric/fabric-core";

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

  // --- Plan Tree View ---------------------------------------------------------
  const planTreeProvider = new PlanTreeProvider();
  const planTreeView = vscode.window.createTreeView("cyberFabric.planTree", {
    treeDataProvider: planTreeProvider,
    showCollapseAll: true,
  });

  // --- Delegation Status View -------------------------------------------------
  const delegationViewProvider = new DelegationViewProvider();
  const delegationView = vscode.window.createTreeView("cyberFabric.delegationStatus", {
    treeDataProvider: delegationViewProvider,
  });

  // --- Connect Orchestrator events to tree views ------------------------------
  orchestrator.onEvent((event: OrchestratorEvent) => {
    const state = orchestrator!.getExecutionState(event.pipelineId);
    if (state) {
      planTreeProvider.updateExecutionState(state);
    }

    if (event.type === "step:start") {
      delegationViewProvider.addDelegation({
        id: `${event.pipelineId}-step-${event.stepIndex}`,
        targetAgent: "fabric-agent",
        skillId: `step-${event.stepIndex}`,
        pipelineId: event.pipelineId,
        stepIndex: event.stepIndex,
        status: "active",
        startTime: Date.now(),
      });
    } else if (event.type === "step:complete") {
      delegationViewProvider.updateDelegation(
        `${event.pipelineId}-step-${event.stepIndex}`,
        "completed",
      );
    } else if (event.type === "step:failed") {
      delegationViewProvider.updateDelegation(
        `${event.pipelineId}-step-${event.stepIndex}`,
        "failed",
        event.error,
      );
    }
  });

  // --- Command: openPhase (tree interaction) ----------------------------------
  const openPhase = vscode.commands.registerCommand(
    "cyber-fabric.openPhase",
    (phase) => {
      outputChannel!.appendLine(`Phase selected: step ${phase.index} (${phase.operation})`);
      vscode.window.showInformationMessage(
        `Cyber Fabric: Phase ${phase.index} — ${phase.skillId} (${phase.operation})`,
      );
    },
  );

  // --- Command: cancelDelegation ----------------------------------------------
  const cancelDelegation = vscode.commands.registerCommand(
    "cyber-fabric.cancelDelegation",
    (item) => {
      if (item?.record?.id) {
        delegationViewProvider.cancelDelegation(item.record.id);
        outputChannel!.appendLine(`Delegation cancelled: ${item.record.id}`);
      }
    },
  );

  context.subscriptions.push(
    outputChannel,
    showStatus,
    runPipeline,
    openChat,
    planTreeView,
    delegationView,
    openPhase,
    cancelDelegation,
    { dispose: () => planTreeProvider.dispose() },
    { dispose: () => delegationViewProvider.dispose() },
  );

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
