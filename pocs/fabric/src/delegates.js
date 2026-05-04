const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function readPromptFromStdin() {
  try {
    if (process.stdin.isTTY) {
      return "";
    }

    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function getProviderCommand(provider) {
  if (provider === "claude") {
    return {
      binary: process.env.FABRIC_CLAUDE_BIN || "claude",
      prefixArgs: process.env.FABRIC_CLAUDE_WRAPPER ? [process.env.FABRIC_CLAUDE_WRAPPER] : [],
    };
  }

  if (provider === "codex") {
    return {
      binary: process.env.FABRIC_CODEX_BIN || "codex",
      prefixArgs: process.env.FABRIC_CODEX_WRAPPER ? [process.env.FABRIC_CODEX_WRAPPER] : [],
    };
  }

  return null;
}

function parseClaudeOutput(stdout) {
  const lines = stdout.trim().split("\n").filter(Boolean);
  const textParts = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      if (parsed && typeof parsed.result === "string") {
        textParts.push(parsed.result);
      }
    } catch {
      if (line.trim()) {
        textParts.push(line);
      }
    }
  }

  return textParts.join("\n").trim();
}

function invokeClaude(prompt, options = {}) {
  const command = getProviderCommand("claude");
  const args = [
    ...command.prefixArgs,
    "--print",
    "--output-format",
    "json",
    "--no-session-persistence",
    prompt,
  ];
  const result = spawnSync(command.binary, args, {
    cwd: options.cwd || process.cwd(),
    env: process.env,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Failed to spawn Claude CLI: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Claude CLI exited with code ${result.status}: ${result.stderr || result.stdout}`.trim());
  }

  return parseClaudeOutput(result.stdout);
}

function invokeCodex(prompt, options = {}) {
  const command = getProviderCommand("codex");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-codex-"));
  const outputFile = path.join(tempDir, "last-message.txt");
  const args = [
    ...command.prefixArgs,
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--ephemeral",
    "-C",
    options.cwd || process.cwd(),
    "-o",
    outputFile,
    prompt,
  ];

  try {
    const result = spawnSync(command.binary, args, {
      cwd: options.cwd || process.cwd(),
      env: process.env,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.error) {
      throw new Error(`Failed to spawn Codex CLI: ${result.error.message}`);
    }

    if (result.status !== 0) {
      throw new Error(`Codex CLI exited with code ${result.status}: ${result.stderr || result.stdout}`.trim());
    }

    if (fs.existsSync(outputFile)) {
      return fs.readFileSync(outputFile, "utf8").trim();
    }

    return result.stdout.trim();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function collectPromptText(promptParts) {
  const inlinePrompt = promptParts.join(" ").trim();

  if (inlinePrompt) {
    return inlinePrompt;
  }

  return readPromptFromStdin().trim();
}

function delegatePrompt(provider, prompt, options = {}) {
  const command = getProviderCommand(provider);

  if (!command) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  if (!prompt) {
    throw new Error("Missing prompt text");
  }

  if (provider === "claude") {
    return invokeClaude(prompt, options);
  }

  return invokeCodex(prompt, options);
}

module.exports = {
  collectPromptText,
  delegatePrompt,
};
