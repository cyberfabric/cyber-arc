// CodexAdapter — implements AdapterContract for the Codex CLI host.
// Thin adapter that defers orchestration to fabric-core (ADR-0018).

import { execFile } from "node:child_process";
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

/** Configuration options for the Codex adapter. */
export interface CodexAdapterConfig {
  /** Path to the Codex CLI binary (defaults to "codex") */
  readonly cliPath?: string;
  /** Default timeout for CLI invocations in milliseconds */
  readonly defaultTimeoutMs?: number;
  /** Working directory for Codex execution */
  readonly workingDirectory?: string;
  /** Additional CLI flags to pass on every invocation */
  readonly extraFlags?: readonly string[];
}

const DEFAULT_CLI_PATH = "codex";
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Codex CLI host adapter for Cyber Fabric.
 * Translates Fabric skill execution into Codex CLI subprocess calls.
 * Remains thin per ADR-0018 — orchestration logic stays in fabric-core.
 */
export class CodexAdapter implements AdapterContract {
  /** Unique adapter identifier */
  readonly id: AdapterId = "codex-cli" as AdapterId;

  /** Human-readable name */
  readonly name = "Codex CLI Adapter";

  private readonly config: CodexAdapterConfig;

  constructor(config: CodexAdapterConfig = {}) {
    this.config = config;
  }

  /**
   * Report adapter capabilities.
   * Codex supports tool calling and file system access but not subagents or review surfaces.
   * @returns Host capabilities for the Codex adapter
   */
  getCapabilities(): HostCapabilities {
    return {
      subagents: false,
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
      sessionId: `codex-ctx-${Date.now()}`,
      workingDirectory: this.config.workingDirectory ?? process.cwd(),
      permissions: ["read", "write", "execute"],
      environment: {},
    };
  }

  /**
   * Get available execution backends.
   * The Codex adapter exposes a single backend backed by the CLI.
   * @returns Array containing the Codex CLI execution backend
   */
  getBackends(): readonly ExecutionBackend[] {
    const adapter = this;
    const capabilities = this.getCapabilities();

    const backend: ExecutionBackend = {
      id: "codex-cli",
      name: "Codex CLI Backend",
      capabilities,
      async execute(
        skill: SkillInstance,
        context: ExecutionContext
      ): Promise<ExecutionResult> {
        const prompt = buildTaskPrompt(skill, context);
        return adapter.invokeCodexCLI(prompt, context);
      },
      async isAvailable(): Promise<boolean> {
        return adapter.isAvailable();
      },
    };

    return [backend];
  }

  /**
   * Check if the Codex CLI is available on the system.
   * @returns true if the CLI binary can be found and executed
   */
  async isAvailable(): Promise<boolean> {
    try {
      const cliPath = this.config.cliPath ?? DEFAULT_CLI_PATH;
      await this.execCLI(cliPath, ["--version"], 5_000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a skill using the Codex CLI.
   * Builds a prompt from the skill contract and context, then invokes the CLI.
   * @param skill - The skill instance to execute
   * @param context - The execution context with pipeline state
   * @returns The execution result
   */
  async execute(
    skill: SkillInstance,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const prompt = buildTaskPrompt(skill, context);
    return this.invokeCodexCLI(prompt, context);
  }

  /**
   * Invoke the Codex CLI with a prompt and capture output.
   * @param prompt - The prompt text to send to Codex
   * @param context - The execution context for working directory resolution
   * @returns Parsed execution result
   */
  private async invokeCodexCLI(
    prompt: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const cliPath = this.config.cliPath ?? DEFAULT_CLI_PATH;
    const timeout = this.config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const cwd = this.config.workingDirectory ?? process.cwd();

    const args: string[] = [
      "--prompt",
      prompt,
      "--output-format",
      "json",
    ];

    if (cwd) {
      args.push("--cwd", cwd);
    }

    if (this.config.extraFlags) {
      args.push(...this.config.extraFlags);
    }

    try {
      const stdout = await this.execCLI(cliPath, args, timeout);
      const result = this.parseOutput(stdout);
      const duration = Date.now() - startTime;

      return {
        status: "success",
        outputs: [],
        duration,
        metadata: {
          adapter: this.id,
          rawOutput: result,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message =
        error instanceof Error ? error.message : String(error);

      if (message.includes("TIMEOUT")) {
        return {
          status: "failure",
          error: `Codex CLI timed out after ${timeout}ms`,
          duration,
        };
      }

      return {
        status: "failure",
        error: `Codex CLI execution failed: ${message}`,
        duration,
      };
    }
  }

  /**
   * Execute the CLI binary with arguments and return stdout.
   * @param binary - Path to the CLI binary
   * @param args - Command-line arguments
   * @param timeoutMs - Timeout in milliseconds
   * @returns Standard output as a string
   */
  private execCLI(
    binary: string,
    args: string[],
    timeoutMs: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = execFile(
        binary,
        args,
        { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            if ((error as NodeJS.ErrnoException & { killed?: boolean }).killed) {
              reject(new Error("TIMEOUT: Codex CLI process killed"));
            } else {
              reject(
                new Error(
                  `CLI error (exit ${error.code}): ${stderr || error.message}`
                )
              );
            }
            return;
          }
          resolve(stdout);
        }
      );

      child.unref();
    });
  }

  /**
   * Parse Codex CLI JSON output into a structured object.
   * Falls back to raw string if JSON parsing fails.
   * @param stdout - Raw stdout from the CLI
   * @returns Parsed object or raw output string
   */
  private parseOutput(stdout: string): unknown {
    const trimmed = stdout.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
}

/**
 * Build a task prompt for the Codex CLI from skill and context.
 */
function buildTaskPrompt(
  skill: SkillInstance,
  context: ExecutionContext
): string {
  const parts: string[] = [];

  parts.push(`Execute skill: ${skill.contract.name}`);
  parts.push(
    `Operation: step ${context.currentStep} of pipeline ${context.pipelineId}`
  );

  if (skill.contract.operations.length > 0) {
    parts.push(
      `Supported operations: ${skill.contract.operations.map((op) => op.name).join(", ")}`
    );
  }

  const priorArtifacts = Object.entries(context.artifacts);
  if (priorArtifacts.length > 0) {
    parts.push("Prior artifacts:");
    for (const [step, refs] of priorArtifacts) {
      for (const ref of refs) {
        parts.push(
          `  Step ${step}: ${ref.family} (${ref.format}) at ${ref.path}`
        );
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
