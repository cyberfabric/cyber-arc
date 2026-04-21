// Cyber Fabric Core
// Shared runtime, contracts, and orchestration logic

export const VERSION = "0.1.0";

// Core types and contracts
export * from "./types.js";

// Skill registry for contract-based discovery and routing
export { SkillRegistry } from "./skill-registry.js";

// Pipeline planner for skill composition
export { PipelinePlanner } from "./planner.js";
export type { CompatibilityResult, PipelineResult } from "./planner.js";

// Shared prompt builder for adapters
export { buildTaskPrompt } from "./prompt.js";

// Orchestrator for pipeline execution
export { Orchestrator } from "./orchestrator.js";
export type {
  OrchestratorConfig,
  RetryPolicy,
  StepStatus,
  StepState,
  ExecutionState,
  OrchestratorEvent,
  OrchestratorEventListener,
} from "./orchestrator.js";
