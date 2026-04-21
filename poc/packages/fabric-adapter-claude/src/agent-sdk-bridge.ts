// AgentSDKBridge — wraps the Claude Agent SDK for Fabric adapter use.
// Handles agent creation, execution, tool conversion, and result mapping.

import type {
  ExecutionResult,
  SkillInstance,
  ExecutionContext,
  ArtifactRef,
} from "@cyber-fabric/fabric-core";

/** Configuration for creating a Claude agent instance. */
export interface AgentConfig {
  /** Model to use for the agent */
  readonly model: string;
  /** System prompt for the agent */
  readonly systemPrompt: string;
  /** Tool definitions in Fabric format */
  readonly tools?: readonly ToolEntry[];
  /** Maximum tokens for agent response */
  readonly maxTokens?: number;
}

/** A tool entry in Fabric-neutral format, converted to Claude format by the bridge. */
export interface ToolEntry {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/** Represents a Claude tool definition in SDK format. */
export interface ClaudeTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

/** Raw result from the Claude Agent SDK before conversion. */
export interface ClaudeAgentResult {
  readonly messages: readonly Record<string, unknown>[];
  readonly toolOutputs?: readonly Record<string, unknown>[];
}

/** Tracks a running agent session within the bridge. */
export interface BridgeSession {
  readonly id: string;
  readonly config: AgentConfig;
  readonly createdAt: Date;
  active: boolean;
}

/**
 * Bridge between Fabric adapter layer and the Claude Agent SDK.
 * Encapsulates all SDK-specific logic so the adapter remains thin.
 */
export class AgentSDKBridge {
  private readonly sessions = new Map<string, BridgeSession>();
  private sessionCounter = 0;

  /**
   * Create a new agent session with the given configuration.
   * @param config - Agent configuration including model, prompt, and tools
   * @returns A bridge session handle for subsequent operations
   */
  createAgent(config: AgentConfig): BridgeSession {
    const id = `claude-session-${++this.sessionCounter}-${Date.now()}`;
    const session: BridgeSession = {
      id,
      config,
      createdAt: new Date(),
      active: true,
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Run an agent session with a task prompt.
   * Delegates to the Claude Agent SDK to execute the task.
   * @param session - The bridge session to run
   * @param taskPrompt - The task description for the agent
   * @returns The execution result in Fabric format
   */
  async runAgent(
    session: BridgeSession,
    taskPrompt: string
  ): Promise<ExecutionResult> {
    if (!session.active) {
      return {
        status: "failure",
        error: "Session is no longer active",
        duration: 0,
      };
    }

    const start = Date.now();

    try {
      // Attempt dynamic import of Claude Agent SDK
      const sdk = await this.loadSDK();
      if (!sdk) {
        return {
          status: "failure",
          error:
            "Claude Agent SDK not available. Install @anthropic-ai/claude-code to use the Claude adapter.",
          duration: Date.now() - start,
        };
      }

      const claudeTools = this.convertTools(session.config.tools ?? []);

      const agent = new sdk.Agent({
        model: session.config.model,
        tools: claudeTools,
        systemPrompt: session.config.systemPrompt,
      });

      const rawResult = await agent.run(taskPrompt);
      return this.convertResult(rawResult, Date.now() - start);
    } catch (err) {
      return {
        status: "failure",
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Convert Fabric tool definitions to Claude Agent SDK format.
   * @param tools - Fabric-format tool definitions
   * @returns Claude SDK tool definitions
   */
  convertTools(tools: readonly ToolEntry[]): ClaudeTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  /**
   * Convert a raw Claude Agent SDK result into a Fabric ExecutionResult.
   * @param raw - The raw result from the Claude Agent SDK
   * @param duration - Elapsed time in milliseconds
   * @returns A Fabric-compatible ExecutionResult
   */
  convertResult(raw: ClaudeAgentResult, duration: number): ExecutionResult {
    // Extract text content from messages
    const textParts: string[] = [];
    for (const msg of raw.messages) {
      if (typeof msg["content"] === "string") {
        textParts.push(msg["content"]);
      } else if (Array.isArray(msg["content"])) {
        for (const block of msg["content"] as Record<string, unknown>[]) {
          if (block["type"] === "text" && typeof block["text"] === "string") {
            textParts.push(block["text"] as string);
          }
        }
      }
    }

    // Extract artifact references from tool outputs
    const artifacts: ArtifactRef[] = [];
    if (raw.toolOutputs) {
      for (const output of raw.toolOutputs) {
        if (typeof output["path"] === "string") {
          artifacts.push({
            family: (output["family"] as string) ?? "unknown",
            format: (output["format"] as string) ?? "text/plain",
            path: output["path"] as string,
          });
        }
      }
    }

    return {
      status: "success",
      outputs: artifacts,
      duration,
      metadata: {
        messageCount: raw.messages.length,
        outputText: textParts.join("\n"),
      },
    };
  }

  /**
   * Terminate a bridge session and clean up resources.
   * @param sessionId - The session to terminate
   */
  terminate(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.active = false;
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Check if the Claude Agent SDK is available in the environment.
   * @returns true if the SDK can be loaded
   */
  async isSDKAvailable(): Promise<boolean> {
    const sdk = await this.loadSDK();
    return sdk !== null;
  }

  /**
   * Get an active session by ID.
   * @param sessionId - The session to retrieve
   * @returns The session if found and active, undefined otherwise
   */
  getSession(sessionId: string): BridgeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Attempt to dynamically load the Claude Agent SDK.
   * Returns null if the SDK is not installed.
   */
  private async loadSDK(): Promise<{ Agent: new (config: Record<string, unknown>) => { run(prompt: string): Promise<ClaudeAgentResult> } } | null> {
    try {
      // Dynamic import so the adapter works without the SDK installed
      // (it will just report unavailable)
      // @ts-expect-error — SDK may not be installed; absence is handled gracefully
      const mod = await import("@anthropic-ai/claude-code");
      if (mod && typeof mod.Agent === "function") {
        return mod as { Agent: new (config: Record<string, unknown>) => { run(prompt: string): Promise<ClaudeAgentResult> } };
      }
      return null;
    } catch {
      return null;
    }
  }
}
