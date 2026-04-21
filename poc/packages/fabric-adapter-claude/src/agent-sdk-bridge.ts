// AgentSDKBridge — wraps the Claude CLI for Fabric adapter use.
// Handles agent creation, execution via subprocess, and result mapping.

import { spawn } from "child_process";
import type {
  ExecutionResult,
  ArtifactRef,
} from "@cyber-fabric/fabric-core";

/** Configuration for creating a Claude agent instance. */
export interface AgentConfig {
  /** Model to use for the agent */
  readonly model: string;
  /** System prompt for the agent */
  readonly systemPrompt: string;
  /** Tool definitions in Fabric format (not used with CLI) */
  readonly tools?: readonly ToolEntry[];
  /** Maximum tokens for agent response (not used with CLI) */
  readonly maxTokens?: number;
}

/** A tool entry in Fabric-neutral format. */
export interface ToolEntry {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/** Tracks a running agent session within the bridge. */
export interface BridgeSession {
  readonly id: string;
  readonly config: AgentConfig;
  readonly createdAt: Date;
  active: boolean;
}

/** JSON output from Claude CLI with --output-format json */
interface ClaudeCLIResult {
  type: string;
  subtype?: string;
  session_id?: string;
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  cost_usd?: number;
  total_cost_usd?: number;
}

/**
 * Bridge between Fabric adapter layer and the Claude CLI.
 * Invokes claude command as subprocess for execution.
 */
export class AgentSDKBridge {
  private readonly sessions = new Map<string, BridgeSession>();
  private sessionCounter = 0;
  private cliAvailable: boolean | null = null;

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
   * Invokes the Claude CLI as a subprocess.
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
      const available = await this.isSDKAvailable();
      if (!available) {
        return {
          status: "failure",
          error:
            "Claude CLI not available. Install @anthropic-ai/claude-code globally: npm install -g @anthropic-ai/claude-code",
          duration: Date.now() - start,
        };
      }

      const result = await this.invokeCLI(session.config, taskPrompt);

      return {
        status: "success",
        outputs: result.artifacts,
        duration: Date.now() - start,
        metadata: {
          outputText: result.text,
          numTurns: result.numTurns,
          costUsd: result.costUsd,
        },
      };
    } catch (err) {
      return {
        status: "failure",
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Invoke the Claude CLI with the given config and prompt.
   */
  private async invokeCLI(
    config: AgentConfig,
    taskPrompt: string
  ): Promise<{ text: string; artifacts: ArtifactRef[]; numTurns?: number; costUsd?: number }> {
    return new Promise((resolve, reject) => {
      const args = [
        "--print",
        "--output-format", "json",
        "--model", config.model,
        "--system-prompt", config.systemPrompt,
        taskPrompt,
      ];

      const proc = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr || stdout}`));
          return;
        }

        try {
          const result = this.parseJSONOutput(stdout);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse Claude CLI output: ${err}`));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
      });
    });
  }

  /**
   * Parse JSON output from Claude CLI.
   * The CLI outputs newline-delimited JSON objects.
   */
  private parseJSONOutput(output: string): { text: string; artifacts: ArtifactRef[]; numTurns?: number; costUsd?: number } {
    const lines = output.trim().split("\n").filter(Boolean);
    const textParts: string[] = [];
    const artifacts: ArtifactRef[] = [];
    let numTurns: number | undefined;
    let costUsd: number | undefined;

    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as ClaudeCLIResult;

        if (obj.type === "result" && obj.result) {
          textParts.push(obj.result);
          numTurns = obj.num_turns;
          costUsd = obj.total_cost_usd;
        } else if (obj.type === "assistant" && obj.subtype === "text") {
          // Handle streaming text blocks if present
          const content = (obj as unknown as Record<string, unknown>)["content"];
          if (typeof content === "string") {
            textParts.push(content);
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    return {
      text: textParts.join("\n"),
      artifacts,
      numTurns,
      costUsd,
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
   * Check if the Claude CLI is available.
   * @returns true if the CLI can be invoked
   */
  async isSDKAvailable(): Promise<boolean> {
    if (this.cliAvailable !== null) {
      return this.cliAvailable;
    }

    try {
      const result = await this.checkCLI();
      this.cliAvailable = result;
      return result;
    } catch {
      this.cliAvailable = false;
      return false;
    }
  }

  /**
   * Check if claude CLI is available by running --version.
   */
  private checkCLI(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("claude", ["--version"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.on("close", (code) => {
        resolve(code === 0);
      });

      proc.on("error", () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Get an active session by ID.
   * @param sessionId - The session to retrieve
   * @returns The session if found and active, undefined otherwise
   */
  getSession(sessionId: string): BridgeSession | undefined {
    return this.sessions.get(sessionId);
  }
}
