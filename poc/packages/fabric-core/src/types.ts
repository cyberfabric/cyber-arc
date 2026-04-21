// Cyber Fabric Core Types & Contracts
// Foundational type system for skills, orchestrator, and host adapters

// ─── Common Utility Types ────────────────────────────────────────────

/** Discriminated union for success/failure results */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Reference to an artifact with type and path */
export interface ArtifactRef {
  /** Artifact family (e.g. "source-code", "test-report", "documentation") */
  readonly family: string;
  /** MIME type or format identifier */
  readonly format: string;
  /** Location of the artifact */
  readonly path: string;
  /** Optional version tag */
  readonly version?: string;
}

/** Outcome of a validation check with errors and warnings */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// ─── Skill Types ─────────────────────────────────────────────────────

/** Branded string type for skill identifiers */
export type SkillId = string & { readonly __brand: "SkillId" };

/** Semantic version string */
export type SkillVersion = `${number}.${number}.${number}`;

/** Schema definition for skill inputs */
export interface SkillInputSchema {
  /** Artifact families this skill accepts */
  readonly accepts: readonly ArtifactRef[];
  /** Required parameters beyond artifacts */
  readonly parameters?: Record<string, ParameterDefinition>;
}

/** Schema definition for skill outputs */
export interface SkillOutputSchema {
  /** Artifact families this skill produces */
  readonly produces: readonly ArtifactRef[];
}

/** Parameter definition for skill inputs */
export interface ParameterDefinition {
  readonly type: "string" | "number" | "boolean" | "object";
  readonly required: boolean;
  readonly description: string;
  readonly defaultValue?: unknown;
}

/** Supported operation that a skill can perform */
export interface SkillOperation {
  /** Operation identifier */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
  /** Input schema for this operation */
  readonly input: SkillInputSchema;
  /** Output schema for this operation */
  readonly output: SkillOutputSchema;
}

/** Complete skill interface contract */
export interface SkillContract {
  /** Unique skill identifier */
  readonly id: SkillId;
  /** Human-readable name */
  readonly name: string;
  /** Description of what this skill does */
  readonly description: string;
  /** Semantic version */
  readonly version: SkillVersion;
  /** Declared input schema */
  readonly input: SkillInputSchema;
  /** Declared output schema */
  readonly output: SkillOutputSchema;
  /** Supported operations */
  readonly operations: readonly SkillOperation[];
  /** Capability requirements from the host */
  readonly requirements?: readonly string[];
}

/** Runtime skill instance with execution method */
export interface SkillInstance {
  /** The skill's contract */
  readonly contract: SkillContract;
  /** Execute the skill with the given context */
  execute(context: ExecutionContext): Promise<ExecutionResult>;
}

// ─── Orchestrator Types ──────────────────────────────────────────────

/** Branded string type for pipeline identifiers */
export type PipelineId = string & { readonly __brand: "PipelineId" };

/** Individual step in a pipeline */
export interface PipelineStep {
  /** Step index within the pipeline */
  readonly index: number;
  /** Skill to invoke at this step */
  readonly skillId: SkillId;
  /** Operation to perform */
  readonly operation: string;
  /** Input bindings: map from parameter name to source (prior step output or pipeline input) */
  readonly inputBindings: Record<string, string>;
  /** Model selection criteria for this step */
  readonly modelSelector?: ModelSelector;
  /** Execution backend preference */
  readonly backendPreference?: string;
}

/** Complete pipeline definition */
export interface Pipeline {
  /** Unique pipeline identifier */
  readonly id: PipelineId;
  /** Human-readable name */
  readonly name: string;
  /** Ordered steps */
  readonly steps: readonly PipelineStep[];
  /** Pipeline-level input artifacts */
  readonly inputs: readonly ArtifactRef[];
  /** Expected output artifacts */
  readonly outputs: readonly ArtifactRef[];
  /** Creation timestamp */
  readonly createdAt: string;
}

/** Runtime execution state during pipeline execution */
export interface ExecutionContext {
  /** Pipeline being executed */
  readonly pipelineId: PipelineId;
  /** Current step index */
  readonly currentStep: number;
  /** Artifacts produced so far, keyed by step index */
  readonly artifacts: Record<number, readonly ArtifactRef[]>;
  /** Adapter being used for execution */
  readonly adapterId: AdapterId;
  /** Additional runtime parameters */
  readonly parameters: Record<string, unknown>;
}

/** Outcome of skill or pipeline execution */
export type ExecutionResult =
  | {
      readonly status: "success";
      readonly outputs: readonly ArtifactRef[];
      readonly duration: number;
      readonly metadata?: Record<string, unknown>;
    }
  | {
      readonly status: "failure";
      readonly error: string;
      readonly failedStep?: number;
      readonly duration: number;
    }
  | {
      readonly status: "partial";
      readonly completedSteps: number;
      readonly outputs: readonly ArtifactRef[];
      readonly error: string;
      readonly duration: number;
    };

/** Criteria for model selection per pipeline step */
export interface ModelSelector {
  /** Minimum capability level required */
  readonly capability?: "basic" | "standard" | "advanced";
  /** Cost preference */
  readonly costPreference?: "lowest" | "balanced" | "best";
  /** Latency preference */
  readonly latencyPreference?: "fastest" | "balanced" | "thorough";
  /** Quality preference */
  readonly qualityPreference?: "draft" | "standard" | "highest";
  /** Specific model ID override */
  readonly modelId?: string;
}

/** Interface for pipeline creation (planner) */
export interface Planner {
  /** Create a pipeline from a set of skill references */
  createPipeline(
    name: string,
    skillIds: readonly SkillId[],
    inputs: readonly ArtifactRef[]
  ): Result<Pipeline, string>;

  /** Find a compatible chain of skills from input type to output type */
  findPath(
    inputFamily: string,
    outputFamily: string
  ): Result<readonly SkillId[], string>;

  /** Validate a pipeline before execution */
  validatePipeline(
    pipeline: Pipeline,
    availableInputs: readonly ArtifactRef[]
  ): ValidationResult;
}

/** Interface for pipeline execution (executor) */
export interface Executor {
  /** Execute a complete pipeline */
  executePipeline(
    pipeline: Pipeline,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  /** Execute a single pipeline step */
  executeStep(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  /** Get execution state for a running pipeline */
  getExecutionState(pipelineId: PipelineId): ExecutionContext | undefined;
}

// ─── Adapter Types ───────────────────────────────────────────────────

/** Branded string type for adapter identifiers */
export type AdapterId = string & { readonly __brand: "AdapterId" };

/** What the host can do — explicit capability declaration */
export interface HostCapabilities {
  /** Host supports spawning subagents */
  readonly subagents: boolean;
  /** Host supports background execution */
  readonly backgroundExecution: boolean;
  /** Host supports tool calling */
  readonly toolCalling: boolean;
  /** Host supports diff-based code changes */
  readonly diffSupport: boolean;
  /** Host supports review surfaces */
  readonly reviewSurfaces: boolean;
  /** Host supports file system access */
  readonly fileSystem: boolean;
  /** Additional capability flags */
  readonly extensions?: Record<string, boolean>;
}

/** Current session state and permissions */
export interface SessionContext {
  /** Session identifier */
  readonly sessionId: string;
  /** Working directory */
  readonly workingDirectory: string;
  /** Permissions granted to the adapter */
  readonly permissions: readonly string[];
  /** Environment variables available */
  readonly environment: Record<string, string>;
  /** Host-specific session metadata */
  readonly metadata?: Record<string, unknown>;
}

/** How skills are invoked on this host */
export interface ExecutionBackend {
  /** Backend identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Capabilities of this backend */
  readonly capabilities: HostCapabilities;
  /** Execute a skill through this backend */
  execute(
    skill: SkillInstance,
    context: ExecutionContext
  ): Promise<ExecutionResult>;
  /** Check if this backend is currently available */
  isAvailable(): Promise<boolean>;
}

/** Complete adapter interface for host integration */
export interface AdapterContract {
  /** Unique adapter identifier */
  readonly id: AdapterId;
  /** Human-readable adapter name */
  readonly name: string;
  /** Host capabilities this adapter exposes */
  getCapabilities(): HostCapabilities;
  /** Get current session context */
  getSessionContext(): SessionContext;
  /** Get available execution backends */
  getBackends(): readonly ExecutionBackend[];
  /** Check if the adapter is available and properly configured */
  isAvailable(): Promise<boolean>;
  /** Execute a skill using the most appropriate backend */
  execute(
    skill: SkillInstance,
    context: ExecutionContext
  ): Promise<ExecutionResult>;
}
