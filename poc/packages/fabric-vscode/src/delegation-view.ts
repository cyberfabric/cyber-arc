// Delegation Status View — shows real-time status of agent delegations.

import * as vscode from "vscode";

/** Status of a delegation. */
export type DelegationStatus = "active" | "completed" | "failed" | "cancelled";

/** Internal tracking data for a delegation. */
export interface DelegationRecord {
  readonly id: string;
  readonly targetAgent: string;
  readonly skillId: string;
  readonly pipelineId: string;
  readonly stepIndex: number;
  status: DelegationStatus;
  readonly startTime: number;
  endTime?: number;
  error?: string;
}

/** Tree item representing a delegation entry. */
export class DelegationItem extends vscode.TreeItem {
  constructor(public readonly record: DelegationRecord) {
    super(
      `${record.targetAgent}: ${record.skillId}`,
      vscode.TreeItemCollapsibleState.None,
    );

    this.id = `delegation-${record.id}`;
    this.description = formatElapsed(record);
    this.contextValue = record.status === "active" ? "activeDelegation" : "delegation";
    this.iconPath = delegationStatusIcon(record.status);
    this.tooltip = buildTooltip(record);
  }
}

/** Format elapsed time for a delegation. */
function formatElapsed(record: DelegationRecord): string {
  const end = record.endTime ?? Date.now();
  const elapsed = Math.round((end - record.startTime) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}m ${secs}s`;
}

/** Map delegation status to a VS Code ThemeIcon. */
function delegationStatusIcon(status: DelegationStatus): vscode.ThemeIcon {
  switch (status) {
    case "active":
      return new vscode.ThemeIcon("loading~spin");
    case "completed":
      return new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));
    case "failed":
      return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
    case "cancelled":
      return new vscode.ThemeIcon("circle-slash");
  }
}

/** Build a tooltip string for a delegation item. */
function buildTooltip(record: DelegationRecord): string {
  const lines = [
    `Delegation: ${record.id}`,
    `Agent: ${record.targetAgent}`,
    `Skill: ${record.skillId}`,
    `Status: ${record.status}`,
    `Started: ${new Date(record.startTime).toLocaleTimeString()}`,
  ];
  if (record.endTime) {
    lines.push(`Ended: ${new Date(record.endTime).toLocaleTimeString()}`);
  }
  if (record.error) {
    lines.push(`Error: ${record.error}`);
  }
  return lines.join("\n");
}

/**
 * Provides delegation status data to the VS Code tree view.
 * Shows active delegations with elapsed time and history of completed ones.
 */
export class DelegationViewProvider implements vscode.TreeDataProvider<DelegationItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DelegationItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly activeDelegations = new Map<string, DelegationRecord>();
  private readonly history: DelegationRecord[] = [];
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    // Refresh every second to update elapsed time on active delegations
    this.refreshTimer = setInterval(() => {
      if (this.activeDelegations.size > 0) {
        this._onDidChangeTreeData.fire();
      }
    }, 1000);
  }

  /** Add a new active delegation. */
  addDelegation(record: DelegationRecord): void {
    this.activeDelegations.set(record.id, record);
    this._onDidChangeTreeData.fire();
  }

  /** Update an existing delegation's status. */
  updateDelegation(id: string, status: DelegationStatus, error?: string): void {
    const record = this.activeDelegations.get(id);
    if (!record) return;

    record.status = status;
    if (status !== "active") {
      record.endTime = Date.now();
      if (error) record.error = error;
      this.activeDelegations.delete(id);
      this.history.unshift(record);
    }
    this._onDidChangeTreeData.fire();
  }

  /** Cancel an active delegation. */
  cancelDelegation(id: string): void {
    this.updateDelegation(id, "cancelled");
  }

  /** Refresh the view. */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DelegationItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DelegationItem): DelegationItem[] {
    if (element) return [];

    const active = Array.from(this.activeDelegations.values()).map(
      (r) => new DelegationItem(r),
    );
    const completed = this.history.map((r) => new DelegationItem(r));

    if (active.length === 0 && completed.length === 0) {
      const empty = new DelegationItem({
        id: "empty",
        targetAgent: "No delegations",
        skillId: "",
        pipelineId: "",
        stepIndex: 0,
        status: "completed",
        startTime: Date.now(),
      });
      empty.label = "No active delegations";
      empty.iconPath = new vscode.ThemeIcon("info");
      empty.description = "";
      empty.contextValue = "empty";
      return [empty];
    }

    return [...active, ...completed];
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this._onDidChangeTreeData.dispose();
  }
}
