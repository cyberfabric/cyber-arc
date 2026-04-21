// Orchestrator — central runtime that executes pipelines through adapter abstraction.
// Coordinates skill execution, selects backends, and tracks execution state.

import type {
  AdapterContract,
  AdapterId,
  ArtifactRef,
  ExecutionContext,
  ExecutionResult,
  Pipeline,
  PipelineId,
  PipelineStep,
  SkillInstance,
} from "./types.js";
import type { SkillRegistry } from "./skill-registry.js";

export type StepStatus = "pending" | "running" | "completed" | "failed";
export interface RetryPolicy { readonly maxAttempts: number; readonly backoffMs: number }
export interface OrchestratorConfig { readonly defaultAdapterId?: AdapterId; readonly retryPolicy?: RetryPolicy }

export interface StepState {
  readonly stepIndex: number;
  readonly skillId: string;
  readonly status: StepStatus;
  readonly result?: ExecutionResult;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export interface ExecutionState {
  readonly pipelineId: PipelineId;
  readonly status: "pending" | "running" | "completed" | "failed" | "partial";
  readonly steps: readonly StepState[];
  readonly startedAt: string;
  readonly completedAt?: string;
}

export type OrchestratorEvent =
  | { type: "step:start"; pipelineId: PipelineId; stepIndex: number }
  | { type: "step:complete"; pipelineId: PipelineId; stepIndex: number; result: ExecutionResult }
  | { type: "step:failed"; pipelineId: PipelineId; stepIndex: number; error: string }
  | { type: "pipeline:start"; pipelineId: PipelineId }
  | { type: "pipeline:complete"; pipelineId: PipelineId; result: ExecutionResult };
export type OrchestratorEventListener = (event: OrchestratorEvent) => void;

/**
 * Central Fabric orchestrator. Executes pipelines by delegating step execution
 * to registered adapters. Never calls LLM APIs directly.
 */
export class Orchestrator {
  private readonly adapters = new Map<string, AdapterContract>();
  private readonly states = new Map<string, ExecutionState>();
  private readonly listeners: OrchestratorEventListener[] = [];
  private readonly registry: SkillRegistry;
  private readonly config: OrchestratorConfig;

  constructor(registry: SkillRegistry, config: OrchestratorConfig = {}) {
    this.registry = registry;
    this.config = config;
  }

  /** Register an execution adapter for skill delegation. */
  registerAdapter(adapter: AdapterContract): void {
    this.adapters.set(adapter.id, adapter);
  }

  /** Select adapter: step preference > default > first registered. */
  selectBackend(step: PipelineStep): AdapterContract | undefined {
    if (step.backendPreference) {
      const preferred = this.adapters.get(step.backendPreference);
      if (preferred) return preferred;
    }
    if (this.config.defaultAdapterId) {
      const defaultAdapter = this.adapters.get(this.config.defaultAdapterId);
      if (defaultAdapter) return defaultAdapter;
    }
    // Fall back to first registered adapter
    const first = this.adapters.values().next();
    return first.done ? undefined : first.value;
  }

  /** Execute a single pipeline step by delegating to the selected adapter. */
  async executeStep(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const adapter = this.selectBackend(step);
    if (!adapter) {
      return {
        status: "failure",
        error: "No adapter available for step execution",
        failedStep: step.index,
        duration: 0,
      };
    }

    const skill = this.registry.getSkill(step.skillId);
    if (!skill) {
      return {
        status: "failure",
        error: `Skill "${step.skillId}" not found in registry`,
        failedStep: step.index,
        duration: 0,
      };
    }

    // Create a minimal SkillInstance wrapper for the adapter
    const instance: SkillInstance = {
      contract: skill,
      execute: (ctx: ExecutionContext) => adapter.execute(instance, ctx),
    };

    const start = Date.now();
    try {
      const result = await adapter.execute(instance, context);
      return result;
    } catch (err) {
      return {
        status: "failure",
        error: err instanceof Error ? err.message : String(err),
        failedStep: step.index,
        duration: Date.now() - start,
      };
    }
  }

  /** Execute a complete pipeline in sequence, tracking state and emitting events. */
  async executePipeline(pipeline: Pipeline): Promise<ExecutionResult> {
    const pipelineStart = Date.now();
    const stepStates: StepState[] = pipeline.steps.map((step) => ({
      stepIndex: step.index,
      skillId: step.skillId,
      status: "pending" as StepStatus,
    }));

    const state: ExecutionState = {
      pipelineId: pipeline.id,
      status: "running",
      steps: stepStates,
      startedAt: new Date().toISOString(),
    };
    this.states.set(pipeline.id, state);
    this.emit({ type: "pipeline:start", pipelineId: pipeline.id });

    const artifacts: Record<number, readonly ArtifactRef[]> = {};
    const firstAdapter = this.selectBackend(pipeline.steps[0]);

    for (const step of pipeline.steps) {
      // Update step status to running
      this.updateStepState(pipeline.id, step.index, { status: "running", startedAt: new Date().toISOString() });
      this.emit({ type: "step:start", pipelineId: pipeline.id, stepIndex: step.index });

      const context: ExecutionContext = {
        pipelineId: pipeline.id,
        currentStep: step.index,
        artifacts,
        adapterId: firstAdapter?.id ?? ("unknown" as AdapterId),
        parameters: {},
      };

      const result = await this.executeStepWithRetry(step, context);

      if (result.status === "failure") {
        this.updateStepState(pipeline.id, step.index, {
          status: "failed",
          result,
          completedAt: new Date().toISOString(),
        });
        this.emit({ type: "step:failed", pipelineId: pipeline.id, stepIndex: step.index, error: result.error });

        const pipelineResult: ExecutionResult = {
          status: "partial",
          completedSteps: step.index,
          outputs: Object.values(artifacts).flat(),
          error: result.error,
          duration: Date.now() - pipelineStart,
        };
        this.updatePipelineState(pipeline.id, "partial", pipelineResult);
        return pipelineResult;
      }

      if (result.status === "success") {
        artifacts[step.index] = result.outputs;
      }
      this.updateStepState(pipeline.id, step.index, {
        status: "completed",
        result,
        completedAt: new Date().toISOString(),
      });
      this.emit({ type: "step:complete", pipelineId: pipeline.id, stepIndex: step.index, result });
    }

    const finalResult: ExecutionResult = {
      status: "success",
      outputs: Object.values(artifacts).flat(),
      duration: Date.now() - pipelineStart,
    };
    this.updatePipelineState(pipeline.id, "completed", finalResult);
    this.emit({ type: "pipeline:complete", pipelineId: pipeline.id, result: finalResult });
    return finalResult;
  }

  /** Get the current execution state for a pipeline. */
  getExecutionState(pipelineId: PipelineId): ExecutionState | undefined {
    return this.states.get(pipelineId);
  }

  /** Subscribe to orchestrator events for observability. */
  onEvent(listener: OrchestratorEventListener): void {
    this.listeners.push(listener);
  }

  private async executeStepWithRetry(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const maxAttempts = this.config.retryPolicy?.maxAttempts ?? 1;
    const backoffMs = this.config.retryPolicy?.backoffMs ?? 1000;
    let lastResult: ExecutionResult | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      lastResult = await this.executeStep(step, context);
      if (lastResult.status !== "failure") return lastResult;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      }
    }
    return lastResult!;
  }

  private updateStepState(pipelineId: PipelineId, stepIndex: number, update: Partial<StepState>): void {
    const state = this.states.get(pipelineId);
    if (!state) return;
    const steps = state.steps.map((s) =>
      s.stepIndex === stepIndex ? { ...s, ...update } : s
    );
    this.states.set(pipelineId, { ...state, steps });
  }

  private updatePipelineState(pipelineId: PipelineId, status: ExecutionState["status"], _result: ExecutionResult): void {
    const state = this.states.get(pipelineId);
    if (!state) return;
    this.states.set(pipelineId, { ...state, status, completedAt: new Date().toISOString() });
  }

  private emit(event: OrchestratorEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
