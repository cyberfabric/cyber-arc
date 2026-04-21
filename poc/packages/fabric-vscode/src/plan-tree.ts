// Plan Tree View — displays Cypilot execution plan phases in a hierarchical tree.

import * as vscode from "vscode";
import type {
  Pipeline,
  PipelineStep,
} from "@cyber-fabric/fabric-core";
import type {
  ExecutionState,
  StepState,
  StepStatus,
} from "@cyber-fabric/fabric-core";

/** Tree item representing a pipeline or a pipeline step (phase). */
export class PlanTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly phase?: PipelineStep,
    public readonly stepState?: StepState,
  ) {
    super(label, collapsibleState);

    if (phase) {
      this.id = `phase-${phase.index}`;
      this.description = phase.operation;
      this.contextValue = stepState?.status ?? "pending";
      this.iconPath = statusToIcon(stepState?.status ?? "pending");
      this.tooltip = `Step ${phase.index}: ${phase.operation} [${stepState?.status ?? "pending"}]`;
      this.command = {
        command: "cyber-fabric.openPhase",
        title: "Open Phase Details",
        arguments: [phase],
      };
    }
  }
}

/** Map a step status to the appropriate VS Code ThemeIcon. */
function statusToIcon(status: StepStatus): vscode.ThemeIcon {
  switch (status) {
    case "completed":
      return new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));
    case "running":
      return new vscode.ThemeIcon("loading~spin");
    case "failed":
      return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
    case "pending":
    default:
      return new vscode.ThemeIcon("circle-outline");
  }
}

/**
 * Provides plan phase data to the VS Code tree view.
 * Displays a loaded pipeline's steps with live status indicators.
 */
export class PlanTreeProvider implements vscode.TreeDataProvider<PlanTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PlanTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private pipeline: Pipeline | undefined;
  private executionState: ExecutionState | undefined;

  /** Load a pipeline into the tree view. */
  setPipeline(pipeline: Pipeline): void {
    this.pipeline = pipeline;
    this.executionState = undefined;
    this._onDidChangeTreeData.fire();
  }

  /** Update execution state and refresh the tree. */
  updateExecutionState(state: ExecutionState): void {
    this.executionState = state;
    this._onDidChangeTreeData.fire();
  }

  /** Clear the current pipeline from the view. */
  clear(): void {
    this.pipeline = undefined;
    this.executionState = undefined;
    this._onDidChangeTreeData.fire();
  }

  /** Refresh the tree view. */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PlanTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PlanTreeItem): PlanTreeItem[] {
    if (!this.pipeline) {
      return [
        new PlanTreeItem(
          "No plan loaded",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    // Root level: show the pipeline as the top node
    if (!element) {
      const pipelineStatus = this.executionState?.status ?? "pending";
      const root = new PlanTreeItem(
        this.pipeline.name,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      root.iconPath = statusToIcon(pipelineStatus as StepStatus);
      root.description = `${this.pipeline.steps.length} phases`;
      root.contextValue = "pipeline";
      return [root];
    }

    // Pipeline children: show each step as a phase
    if (element.contextValue === "pipeline" && this.pipeline) {
      return this.pipeline.steps.map((step) => {
        const stepState = this.executionState?.steps.find(
          (s) => s.stepIndex === step.index,
        );
        return new PlanTreeItem(
          `Phase ${step.index}: ${step.skillId}`,
          vscode.TreeItemCollapsibleState.None,
          step,
          stepState,
        );
      });
    }

    return [];
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
