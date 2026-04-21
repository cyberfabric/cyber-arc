// ClaudeAdapter — implements AdapterContract for the Claude Agent SDK host.
// Thin adapter that defers orchestration to fabric-core (ADR-0018).

import type {
  AdapterContract,
  AdapterId,
  ExecutionBackend,
  ExecutionContext,
  ExecutionResult,
  HostCapabilities,
  SessionContext,
  SkillInstance,
} from "@cyber-fabric/fabric-core";

import { AgentSDKBridge } from "./agent-sdk-bridge.js";
import type { AgentConfig, BridgeSession } from "./agent-sdk-bridge.js";

/** Configuration options for the Claude adapter. */
export interface ClaudeAdapterConfig {
  /** Claude model to use for agent execution */
  readonly model?: string;
  /** Working directory for agent sessions */
  readonly workingDirectory?: string;
  /** Default system prompt prefix */
  readonly systemPromptPrefix?: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Claude Code host adapter for Cyber Fabric.
 * Translates Fabric skill execution into Claude Agent SDK calls.
 * Remains thin per ADR-0018 — orchestration logic stays in fabric-core.
 */
export class ClaudeAdapter implements AdapterContract {
  /** Unique adapter identifier */
  readonly id: AdapterId = "claude-agent-sdk" as AdapterId;

  /** Human-readable name */
  readonly name = "Claude Agent SDK Adapter";

  private readonly bridge: AgentSDKBridge;
  private readonly config: ClaudeAdapterConfig;
  private readonly activeSessions = new Map<string, BridgeSession>();

  constructor(config: ClaudeAdapterConfig = {}) {
    this.config = config;
    this.bridge = new AgentSDKBridge();
  }

  /**
   * Report adapter capabilities.
   * Claude supports subagents, tool calling, and diff review.
   * @returns Host capabilities for the Claude adapter
   */
  getCapabilities(): HostCapabilities {
    return {
      subagents: true,
      backgroundExecution: true,
      toolCalling: true,
      diffSupport: true,
      reviewSurfaces: false,
      fileSystem: true,
    };
  }

  /**
   * Get the current session context for this adapter.
   * @returns Session context with working directory and permissions
   */
  getSessionContext(): SessionContext {
    return {
      sessionId: `claude-ctx-${Date.now()}`,
      workingDirectory: this.config.workingDirectory ?? process.cwd(),
      permissions: ["read", "write", "execute"],
      environment: {},
    };
  }

  /**
   * Get available execution backends.
   * The Claude adapter exposes a single backend backed by the Agent SDK.
   * @returns Array containing the Claude execution backend
   */
  getBackends(): readonly ExecutionBackend[] {
    const capabilities = this.getCapabilities();
    const bridge = this.bridge;
    const model = this.config.model ?? DEFAULT_MODEL;
    const systemPromptPrefix = this.config.systemPromptPrefix ?? "";

    const backend: ExecutionBackend = {
      id: "claude-sdk",
      name: "Claude Agent SDK Backend",
      capabilities,
      async execute(
        skill: SkillInstance,
        context: ExecutionContext
      ): Promise<ExecutionResult> {
        const agentConfig: AgentConfig = {
          model,
          systemPrompt: `${systemPromptPrefix}You are executing skill "${skill.contract.name}" (${skill.contract.id}). ${skill.contract.description}`.trim(),
          maxTokens: 4096,
        };

        const session = bridge.createAgent(agentConfig);
        try {
          const prompt = buildTaskPrompt(skill, context);
          return await bridge.runAgent(session, prompt);
        } finally {
          bridge.terminate(session.id);
        }
      },
      async isAvailable(): Promise<boolean> {
        return bridge.isSDKAvailable();
      },
    };

    return [backend];
  }

  /**
   * Check if the Claude Agent SDK is available and configured.
   * @returns true if the SDK can be loaded
   */
  async isAvailable(): Promise<boolean> {
    return this.bridge.isSDKAvailable();
  }

  /**
   * Execute a skill using the Claude Agent SDK.
   * Creates an agent session, runs the skill, and returns results.
   * @param skill - The skill instance to execute
   * @param context - The execution context with pipeline state
   * @returns The execution result
   */
  async execute(
    skill: SkillInstance,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const agentConfig: AgentConfig = {
      model: this.config.model ?? DEFAULT_MODEL,
      systemPrompt: `${this.config.systemPromptPrefix ?? ""}You are executing skill "${skill.contract.name}" (${skill.contract.id}). ${skill.contract.description}`.trim(),
      maxTokens: 4096,
    };

    const session = this.bridge.createAgent(agentConfig);
    this.activeSessions.set(session.id, session);

    try {
      const prompt = buildTaskPrompt(skill, context);
      return await this.bridge.runAgent(session, prompt);
    } finally {
      this.bridge.terminate(session.id);
      this.activeSessions.delete(session.id);
    }
  }

  /**
   * Spawn a new subagent session for multi-turn interactions.
   * @param config - Agent configuration
   * @returns The bridge session handle
   */
  spawn(config: AgentConfig): BridgeSession {
    const session = this.bridge.createAgent(config);
    this.activeSessions.set(session.id, session);
    return session;
  }

  /**
   * Terminate a subagent session and clean up resources.
   * @param sessionId - The session to terminate
   */
  terminate(sessionId: string): void {
    this.bridge.terminate(sessionId);
    this.activeSessions.delete(sessionId);
  }

  /**
   * Get count of currently active sessions.
   * @returns Number of active sessions
   */
  get activeSessionCount(): number {
    return this.activeSessions.size;
  }
}

/**
 * Build a task prompt for the Claude agent from skill and context.
 */
function buildTaskPrompt(
  skill: SkillInstance,
  context: ExecutionContext
): string {
  const parts: string[] = [];

  parts.push(`Execute skill: ${skill.contract.name}`);
  parts.push(`Operation: step ${context.currentStep} of pipeline ${context.pipelineId}`);

  if (skill.contract.operations.length > 0) {
    parts.push(`Supported operations: ${skill.contract.operations.map((op) => op.name).join(", ")}`);
  }

  const priorArtifacts = Object.entries(context.artifacts);
  if (priorArtifacts.length > 0) {
    parts.push("Prior artifacts:");
    for (const [step, refs] of priorArtifacts) {
      for (const ref of refs) {
        parts.push(`  Step ${step}: ${ref.family} (${ref.format}) at ${ref.path}`);
      }
    }
  }

  const params = Object.entries(context.parameters);
  if (params.length > 0) {
    parts.push("Parameters:");
    for (const [key, value] of params) {
      parts.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  return parts.join("\n");
}
