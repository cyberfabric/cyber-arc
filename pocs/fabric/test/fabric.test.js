const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadPromptsFromManifest } = require("../src/prompts");

const cliPath = path.join(__dirname, "..", "bin", "fabric");
const mockClaudePath = path.join(__dirname, "fixtures", "mock-claude.js");
const mockCodexPath = path.join(__dirname, "fixtures", "mock-codex.js");
const kitFixturePath = path.join(__dirname, "fixtures", "kit");
const kitPromptGlob = path.join(kitFixturePath, "prompts", "*.md");
const kitScriptGlob = path.join(kitFixturePath, "scripts", "*.js");
const promptingKitPath = path.join(__dirname, "..", "..", "fabric-kits", "prompting");
const promptingScriptGlob = path.join(promptingKitPath, "scripts", "*.js");
const middlewareManifestPath = path.join(__dirname, "fixtures", "middleware", "resources.toml");
const middlewareFixturePath = path.join(__dirname, "fixtures", "middleware");
const middlewarePromptGlob = path.join(middlewareFixturePath, "prompts", "*.md");
const sharedCliHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-cli-home-"));
const questionsAtEndMiddleware = "If you need to ask the user questions, place all user-facing questions together as a list at the very end of the output. Label the questions as `A`, `B`, `C`, `D`, and so on. Number the answer options for each question so the user can reply compactly with forms such as `A1`, `B3`, or `A2, C1`. Always propose your own recommended option or answer and explain why. Each question must include its rationale, and include relevant risks or trade-offs when applicable.";

function buildCliEnv(homeDir = sharedCliHome, overrides = {}) {
  return {
    ...process.env,
    FABRIC_HOME: homeDir,
    ...overrides,
  };
}

test("fabric init creates a local empty resources manifest without bootstrapping the global registry", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-init-home-"));
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-init-workspace-"));
  const localManifest = path.join(tempWorkspace, ".fabric", "resources.toml");
  const globalManifest = path.join(tempHome, ".fabric", "resources.toml");

  try {
    const result = spawnSync(process.execPath, [cliPath, "init"], {
      cwd: tempWorkspace,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(fs.existsSync(localManifest), true);
    assert.equal(result.stdout, `Initialized ${fs.realpathSync(localManifest)}\n`);
    assert.equal(result.stderr, "");
    assert.equal(fs.readFileSync(localManifest, "utf8"), "schema_version = 1\nprompt_files = [ ]\nscript_files = [ ]\napi_files = [ ]\n");
    assert.equal(fs.existsSync(globalManifest), false);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("fabric prompt source returns prompt documents with markers for the resolved prompt", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-source-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const sharedPre = path.join(middlewareFixturePath, "prompts", "shared-pre.md");
  const sampleRules = path.join(middlewareFixturePath, "prompts", "sample-rules.md");
  const sharedPost = path.join(middlewareFixturePath, "prompts", "shared-post.md");
  const sharedRulesOnlyNarrow = path.join(middlewareFixturePath, "prompts", "shared-rules-only-narrow.md");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = [\n  "${middlewarePromptGlob}",\n]\n\nscript_files = []\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "prompt", "source", "sample-rules"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const expected = [
      fs.readFileSync(sharedPre, "utf8"),
      fs.readFileSync(sampleRules, "utf8"),
      fs.readFileSync(sharedPost, "utf8"),
      fs.readFileSync(sharedRulesOnlyNarrow, "utf8"),
    ].join("\n\n");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric prompt list returns a concise table of active prompts", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-list-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = [\n  "${kitPromptGlob}",\n]\n\nscript_files = []\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "prompt", "list"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const expected = [
      "ID | Type | Name | Description",
      "kit-hello | skill | kit-hello | Execute the fixture kit hello prompt through fabric",
    ].join("\n");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric prompt list --verbose returns detailed help for each active prompt", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-list-verbose-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const promptPath = path.join(kitFixturePath, "prompts", "kit-hello.md");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = [\n  "${kitPromptGlob}",\n]\n\nscript_files = []\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "prompt", "list", "--verbose"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const expected = [
      "ID: kit-hello",
      "Type: skill",
      "Name: kit-hello",
      "Description: Execute the fixture kit hello prompt through fabric",
      "",
      "Files:",
      `  - ${promptPath}`,
      "",
      "Applied middleware:",
      "  None",
      "",
      "Documents:",
      `  - ${promptPath}`,
      "    Blocks:",
      "      - append \"body\"",
      "",
      "Resolved prompt:",
      "  Print Kit hello!",
    ].join("\n");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric prompt help returns the authored help section between markers", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-help-home-"));
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-help-ws-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const promptDir = path.join(tempWorkspace, "prompts");
  const promptPath = path.join(promptDir, "doc-sample.md");
  const promptGlob = path.join(promptDir, "*.md");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.mkdirSync(promptDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = [\n  "${promptGlob}",\n]\n\nscript_files = []\n`, "utf8");
    fs.writeFileSync(promptPath, [
      "---",
      "id: doc-sample",
      "type: skill",
      "name: doc-sample",
      "description: Sample skill with an authored help section",
      "---",
      "",
      "<!-- help -->",
      "## Usage",
      "",
      "Run `fabric prompt get doc-sample` to get the compiled prompt body.",
      "Use `--foo=bar` to pass a fake option (authored example).",
      "<!-- /help -->",
      "",
      '<!-- append "body" -->',
      "Prompt body.",
      "<!-- /append -->",
      "",
    ].join("\n"), "utf8");

    const result = spawnSync(process.execPath, [cliPath, "prompt", "help", "doc-sample"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const expected = [
      "## Usage",
      "",
      "Run `fabric prompt get doc-sample` to get the compiled prompt body.",
      "Use `--foo=bar` to pass a fake option (authored example).",
    ].join("\n");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("fabric prompt help falls back to frontmatter metadata when no marker is present", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-help-fallback-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = [\n  "${kitPromptGlob}",\n]\n\nscript_files = []\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "prompt", "help", "kit-hello"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const expected = [
      "Name: kit-hello",
      "Type: skill",
      "Description: Execute the fixture kit hello prompt through fabric",
      "",
      "(no <!-- help --> section in prompt files)",
    ].join("\n");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric prompt help returns an error for an unknown prompt", () => {
  const result = spawnSync(process.execPath, [cliPath, "prompt", "help", "definitely-missing"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown prompt: definitely-missing\n");
});

test("fabric prompt types returns a concise catalog of allowed prompt types", () => {
  const result = spawnSync(process.execPath, [cliPath, "prompt", "types"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");

  const lines = result.stdout.trimEnd().split("\n");
  assert.equal(lines[0], "Type | Summary | When to use");

  const typeColumn = lines.slice(1).map((line) => line.split(" | ")[0]);

  for (const expected of ["skill", "rules", "template", "middleware", "workflow", "checklist", "agent"]) {
    assert.ok(typeColumn.includes(expected), `Missing type in catalog: ${expected}`);
  }
});

test("fabric prompt types --verbose returns required frontmatter and authoring notes per type", () => {
  const result = spawnSync(process.execPath, [cliPath, "prompt", "types", "--verbose"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.ok(result.stdout.includes("Type: skill"));
  assert.ok(result.stdout.includes("Type: middleware"));
  assert.ok(result.stdout.includes("Required frontmatter: id, type, name, description, target_types, timing"));
  assert.ok(result.stdout.includes("Authoring notes:"));
});

test("middleware prompts are injected around matching prompt types", () => {
  const prompts = loadPromptsFromManifest(middlewareManifestPath);

  assert.equal(
    prompts.get("sample-rules"),
    ["Shared prelude.", "Base rules body.", "Shared postlude.", "Narrow rules-only postlude."].join("\n")
  );
  assert.equal(prompts.get("sample-template"), ["Shared prelude.", "Base template body.", "Shared postlude."].join("\n"));
});

test("middleware with target_prompts narrows application to the listed ids", () => {
  const prompts = loadPromptsFromManifest(middlewareManifestPath);

  assert.ok(prompts.get("sample-rules").includes("Narrow rules-only postlude."));
  assert.ok(!prompts.get("sample-template").includes("Narrow rules-only postlude."));
});

test("middleware with target_prompts listing unknown ids is a no-op rather than an error", () => {
  const prompts = loadPromptsFromManifest(middlewareManifestPath);

  assert.ok(!prompts.get("sample-template").includes("Narrow rules-only postlude."));
  assert.ok(!prompts.get("sample-workflow").includes("Narrow rules-only postlude."));
});

test("middleware prompts remain directly loadable without self-wrapping", () => {
  const prompts = loadPromptsFromManifest(middlewareManifestPath);

  assert.equal(prompts.get("shared-pre"), "Shared prelude.");
  assert.equal(prompts.get("shared-post"), "Shared postlude.");
});

test("workflow and checklist prompt types load as normal prompts", () => {
  const prompts = loadPromptsFromManifest(middlewareManifestPath);

  assert.equal(prompts.get("sample-workflow"), "Base workflow body.");
  assert.equal(prompts.get("sample-checklist"), "Base checklist body.");
});

test("multiple replace blocks for the same id are concatenated in registration order", () => {
  const prompts = loadPromptsFromManifest(middlewareManifestPath);

  assert.equal(
    prompts.get("sample-stacked-replace"),
    ["First replacement body.", "Second replacement body."].join("\n")
  );
});

test("overlay prompt files can omit type when another prompt with the same id declares it", () => {
  const prompts = loadPromptsFromManifest(middlewareManifestPath);

  assert.equal(prompts.get("sample-overlay-without-type"), "Checklist body overridden without explicit type.");
});

test("fabric register generates global Claude and Agents skill entry points", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-register-home-"));

  try {
    const result = spawnSync(process.execPath, [cliPath, "register"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "Registered 0 prompts into 2 skill roots\n");
    assert.equal(result.stderr, "");

    const claudeHello = path.join(tempHome, ".claude", "skills", "fabric-hello", "SKILL.md");
    const claudeCodex = path.join(tempHome, ".claude", "skills", "fabric-codex", "SKILL.md");
    const agentsPipeline = path.join(tempHome, ".agents", "skills", "fabric-pipeline", "SKILL.md");
    const claudeMiddleware = path.join(tempHome, ".claude", "skills", "artifacts-english", "SKILL.md");

    assert.equal(fs.existsSync(claudeHello), false);
    assert.equal(fs.existsSync(claudeCodex), false);
    assert.equal(fs.existsSync(agentsPipeline), false);
    assert.equal(fs.existsSync(claudeMiddleware), false);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric register --local generates skill entry points in the current workspace", () => {
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-register-local-"));

  try {
    fs.mkdirSync(path.join(tempWorkspace, ".fabric", "prompts"), { recursive: true });
    fs.writeFileSync(
      path.join(tempWorkspace, ".fabric", "resources.toml"),
      "schema_version = 1\nprompt_files = [ \"prompts/*.md\" ]\nscript_files = [ ]\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(tempWorkspace, ".fabric", "prompts", "local-only.md"),
      [
        "---",
        "id: local-only",
        "type: skill",
        "name: local-only",
        "description: Local-only test skill: safe",
        "---",
        "",
        "<!-- append \"body\" -->",
        "Print Local only!",
        "<!-- /append -->",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(process.execPath, [cliPath, "register", "--local"], {
      cwd: tempWorkspace,
      encoding: "utf8",
      env: buildCliEnv(),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "Registered 1 prompts into 2 skill roots\n");
    assert.equal(result.stderr, "");

    const localClaudeOnly = path.join(tempWorkspace, ".claude", "skills", "fabric-local-only", "SKILL.md");
    const localAgentsOnly = path.join(tempWorkspace, ".agents", "skills", "fabric-local-only", "SKILL.md");
    const localClaudeHello = path.join(tempWorkspace, ".claude", "skills", "fabric-hello", "SKILL.md");

    assert.equal(fs.existsSync(localClaudeOnly), true);
    assert.equal(fs.existsSync(localAgentsOnly), true);
    assert.equal(fs.existsSync(localClaudeHello), false);
    assert.match(fs.readFileSync(localClaudeOnly, "utf8"), /^---\nname: fabric-local-only\ndescription: "Local-only test skill: safe"\n---\n\nEXECUTE and FOLLOW `fabric prompt get local-only`\n$/);
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("fabric register --local --include-global generates local and global skill entry points in the current workspace", () => {
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-register-local-include-global-"));

  try {
    fs.mkdirSync(path.join(tempWorkspace, ".fabric", "prompts"), { recursive: true });
    fs.writeFileSync(
      path.join(tempWorkspace, ".fabric", "resources.toml"),
      "schema_version = 1\nprompt_files = [ \"prompts/*.md\" ]\nscript_files = [ ]\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(tempWorkspace, ".fabric", "prompts", "local-only.md"),
      [
        "---",
        "id: local-only",
        "type: skill",
        "name: local-only",
        "description: Local-only test skill: safe",
        "---",
        "",
        "<!-- append \"body\" -->",
        "Print Local only!",
        "<!-- /append -->",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(process.execPath, [cliPath, "register", "--local", "--include-global"], {
      cwd: tempWorkspace,
      encoding: "utf8",
      env: buildCliEnv(),
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Registered \d+ prompts into 2 skill roots\n$/);
    assert.equal(result.stderr, "");

    const localClaudeOnly = path.join(tempWorkspace, ".claude", "skills", "fabric-local-only", "SKILL.md");
    const localClaudeHello = path.join(tempWorkspace, ".claude", "skills", "fabric-hello", "SKILL.md");

    assert.equal(fs.existsSync(localClaudeOnly), true);
    assert.equal(fs.existsSync(localClaudeHello), false);
    assert.match(fs.readFileSync(localClaudeOnly, "utf8"), /^---\nname: fabric-local-only\ndescription: "Local-only test skill: safe"\n---\n\nEXECUTE and FOLLOW `fabric prompt get local-only`\n$/);
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("fabric delegate claude forwards prompt and returns delegated response", () => {
  const result = spawnSync(
    process.execPath,
    [cliPath, "delegate", "claude", "hello from host"],
    {
      encoding: "utf8",
      env: buildCliEnv(sharedCliHome, {
        FABRIC_CLAUDE_BIN: process.execPath,
        FABRIC_CLAUDE_WRAPPER: mockClaudePath,
      }),
    }
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "mock-claude:hello from host\n");
  assert.equal(result.stderr, "");
});

test("fabric prompt delegate codex forwards named prompt and returns delegated response", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-delegate-codex-home-"));

  try {
    const registerResult = spawnSync(process.execPath, [cliPath, "register", kitFixturePath], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const result = spawnSync(
      process.execPath,
      [cliPath, "prompt", "delegate", "codex", "kit-hello"],
      {
        encoding: "utf8",
        env: buildCliEnv(tempHome, {
          FABRIC_CODEX_BIN: process.execPath,
          FABRIC_CODEX_WRAPPER: mockCodexPath,
        }),
      }
    );

    assert.equal(registerResult.status, 0);
    assert.equal(registerResult.stderr, "");
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `mock-codex:${questionsAtEndMiddleware}\nPrint Kit hello!\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric script run executes a registered global script", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-script-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = []\n\nscript_files = [\n  "${kitScriptGlob}",\n]\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "script", "run", "kit-hello-script", "alpha", "beta"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "kit-script:alpha,beta\n");
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric script help returns detailed help for a registered global script", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-script-help-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const scriptPath = path.join(kitFixturePath, "scripts", "kit-hello-script.js");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = []\n\nscript_files = [\n  "${kitScriptGlob}",\n]\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "script", "help", "kit-hello-script"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const expected = [
      "ID: kit-hello-script",
      "Name: kit hello script",
      "Description: Execute the fixture kit hello script through fabric",
      `File: ${scriptPath}`,
      "",
      "Usage:",
      "  fabric script run kit-hello-script <value> [more-values...]",
      "",
      "Script module interface:",
      "  run(args, context)",
      "  args: string[]",
      "  context.id: string",
      "  context.name: string",
      "  context.description: string",
      "  context.args: string[]",
      "  context.cwd: string",
      "  context.env: object",
      "  context.fabricHome: string",
      "  context.homeDir: string",
      "  context.scriptPath: string",
      "",
      "Details:",
      "  Echoes the received CLI parameters in a deterministic fixture string.",
      "",
      "Parameters:",
      "  - values (string, optional, variadic): One or more values to append to the fixture output.",
      "",
      "Returns:",
      "  String formatted as `kit-script:<comma-separated args>`.",
      "",
      "Examples:",
      "  - fabric script run kit-hello-script alpha beta",
      "    Returns `kit-script:alpha,beta`.",
      "",
      "Notes:",
      "  CLI parameters after the script id are passed into `run(args, context)` as `args`.",
      "",
    ].join("\n");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, expected);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("prompt-lint accepts quoted frontmatter values that the prompt loader accepts", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-lint-quoted-home-"));
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-lint-quoted-workspace-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const promptPath = path.join(tempWorkspace, "quoted.md");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = []\n\nscript_files = [\n  "${promptingScriptGlob}",\n]\n`, "utf8");
    fs.writeFileSync(promptPath, [
      "---",
      'id: "quoted-skill"',
      'type: "skill"',
      'name: "quoted skill"',
      'description: "quoted values"',
      "---",
      "",
      '<!-- append "body" -->',
      "hello",
      "<!-- /append -->",
      "",
    ].join("\n"), "utf8");

    const result = spawnSync(process.execPath, [cliPath, "script", "run", "prompt-lint", promptPath], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      file: promptPath,
      findings: [],
    });
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("prompt-lint flags frontmatter comment lines that Fabric rejects", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-lint-comment-home-"));
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-prompt-lint-comment-workspace-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const promptPath = path.join(tempWorkspace, "comment.md");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = []\n\nscript_files = [\n  "${promptingScriptGlob}",\n]\n`, "utf8");
    fs.writeFileSync(promptPath, [
      "---",
      "# comment",
      "id: comment-skill",
      "type: skill",
      "name: comment skill",
      "description: comment line",
      "---",
      "",
      '<!-- append "body" -->',
      "hello",
      "<!-- /append -->",
      "",
    ].join("\n"), "utf8");

    const result = spawnSync(process.execPath, [cliPath, "script", "run", "prompt-lint", promptPath], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      file: promptPath,
      findings: [
        {
          severity: "CRITICAL",
          where: "frontmatter",
          problem: "invalid frontmatter line: # comment",
        },
      ],
    });
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("script-lint accepts interface shorthand forms that Fabric normalizes at runtime", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-script-lint-shorthand-home-"));
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-script-lint-shorthand-workspace-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const scriptPath = path.join(tempWorkspace, "valid-loose.js");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = []\n\nscript_files = [\n  "${promptingScriptGlob}",\n]\n`, "utf8");
    fs.writeFileSync(scriptPath, [
      "module.exports = {",
      '  id: "valid-loose",',
      '  name: "valid loose",',
      '  description: "valid loose interface",',
      "  interface: {",
      '    details: "one line",',
      '    usage: "fabric script run valid-loose",',
      '    parameters: ["path"],',
      '    returns: "plain text",',
      '    examples: ["fabric script run valid-loose"],',
      '    notes: "note",',
      "  },",
      "  run() {",
      '    return "ok";',
      "  },",
      "};",
      "",
    ].join("\n"), "utf8");

    const result = spawnSync(process.execPath, [cliPath, "script", "run", "script-lint", scriptPath], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      file: scriptPath,
      findings: [],
    });
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("fabric script list returns a concise table of active scripts", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-script-list-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = []\n\nscript_files = [\n  "${kitScriptGlob}",\n]\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "script", "list"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const expected = [
      "ID | Name | Description",
      "kit-hello-script | kit hello script | Execute the fixture kit hello script through fabric",
    ].join("\n");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric script list --verbose returns detailed help for each active script", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-script-list-verbose-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const scriptPath = path.join(kitFixturePath, "scripts", "kit-hello-script.js");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = []\n\nscript_files = [\n  "${kitScriptGlob}",\n]\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "script", "list", "--verbose"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const expected = [
      "ID: kit-hello-script",
      "Name: kit hello script",
      "Description: Execute the fixture kit hello script through fabric",
      `File: ${scriptPath}`,
      "",
      "Usage:",
      "  fabric script run kit-hello-script <value> [more-values...]",
      "",
      "Script module interface:",
      "  run(args, context)",
      "  args: string[]",
      "  context.id: string",
      "  context.name: string",
      "  context.description: string",
      "  context.args: string[]",
      "  context.cwd: string",
      "  context.env: object",
      "  context.fabricHome: string",
      "  context.homeDir: string",
      "  context.scriptPath: string",
      "",
      "Details:",
      "  Echoes the received CLI parameters in a deterministic fixture string.",
      "",
      "Parameters:",
      "  - values (string, optional, variadic): One or more values to append to the fixture output.",
      "",
      "Returns:",
      "  String formatted as `kit-script:<comma-separated args>`.",
      "",
      "Examples:",
      "  - fabric script run kit-hello-script alpha beta",
      "    Returns `kit-script:alpha,beta`.",
      "",
      "Notes:",
      "  CLI parameters after the script id are passed into `run(args, context)` as `args`.",
    ].join("\n");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric merges legacy prompts.toml and scripts.toml into resources.toml automatically", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-legacy-resources-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const legacyPromptsPath = path.join(globalRegistryDir, "prompts.toml");
  const legacyScriptsPath = path.join(globalRegistryDir, "scripts.toml");
  const mergedResourcesPath = path.join(globalRegistryDir, "resources.toml");
  const kitPromptGlob = path.join(kitFixturePath, "prompts", "*.md");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(legacyPromptsPath, `schema_version = 1\n\nprompt_files = [\n  "${kitPromptGlob}",\n]\n`, "utf8");
    fs.writeFileSync(legacyScriptsPath, `schema_version = 1\n\nscript_files = [\n  "${kitScriptGlob}",\n]\n`, "utf8");

    const promptResult = spawnSync(process.execPath, [cliPath, "prompt", "get", "kit-hello"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    const scriptResult = spawnSync(process.execPath, [cliPath, "script", "run", "kit-hello-script", "legacy"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(promptResult.status, 0);
    assert.equal(promptResult.stdout, "Print Kit hello!\n");
    assert.equal(scriptResult.status, 0);
    assert.equal(scriptResult.stdout, "kit-script:legacy\n");
    assert.equal(fs.existsSync(mergedResourcesPath), true);
    assert.equal(fs.readFileSync(mergedResourcesPath, "utf8").includes(kitPromptGlob), true);
    assert.equal(fs.readFileSync(mergedResourcesPath, "utf8").includes(kitScriptGlob), true);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric prompt get returns error for unknown prompt", () => {
  const result = spawnSync(process.execPath, [cliPath, "prompt", "get", "unknown"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown prompt: unknown\n");
});

test("fabric prompt source returns error for unknown prompt", () => {
  const result = spawnSync(process.execPath, [cliPath, "prompt", "source", "unknown"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown prompt: unknown\n");
});

test("fabric script run returns error for unknown script", () => {
  const result = spawnSync(process.execPath, [cliPath, "script", "run", "unknown-script"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown script: unknown-script\n");
});

test("fabric script help returns error for unknown script", () => {
  const result = spawnSync(process.execPath, [cliPath, "script", "help", "unknown-script"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown script: unknown-script\n");
});

test("fabric does not re-merge the built-in core manifest into an existing global registry", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-existing-registry-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");
  const kitPromptGlob = path.join(kitFixturePath, "prompts", "*.md");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = [\n  "${kitPromptGlob}",\n]\n\nscript_files = []\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "prompt", "get", "kit-hello"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "Print Kit hello!\n");
    assert.equal(result.stderr, "");
    assert.equal(fs.readFileSync(globalRegistryPath, "utf8").includes(path.join(__dirname, "..", "prompts", "hello.md")), false);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric register ignores commented prompt file entries in the global registry", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-commented-registry-home-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, `schema_version = 1\n\nprompt_files = [\n#  "${path.join(__dirname, "..", "prompts", "hello.md")}",\n#  "${path.join(kitFixturePath, "prompts", "*.md")}",\n]\n\nscript_files = []\n`, "utf8");

    const result = spawnSync(process.execPath, [cliPath, "register"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "Registered 0 prompts into 2 skill roots\n");
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric register <path> adds resources to the global registry and generates global skills", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-kit-register-home-"));

  try {
    const result = spawnSync(process.execPath, [cliPath, "register", kitFixturePath], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const globalRegistry = path.join(tempHome, ".fabric", "resources.toml");
    const globalClaudeSkill = path.join(tempHome, ".claude", "skills", "fabric-kit-hello", "SKILL.md");
    const promptResult = spawnSync(process.execPath, [cliPath, "prompt", "get", "kit-hello"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    const scriptResult = spawnSync(process.execPath, [cliPath, "script", "run", "kit-hello-script", "first", "second"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Registered resources from .* into .*\.fabric\/resources\.toml and generated \d+ skills in 2 skill roots\n$/);
    assert.equal(result.stderr, "");
    assert.equal(fs.existsSync(globalRegistry), true);
    assert.equal(fs.readFileSync(globalRegistry, "utf8").includes(path.join(kitFixturePath, "prompts", "*.md")), true);
    assert.equal(fs.readFileSync(globalRegistry, "utf8").includes(kitScriptGlob), true);
    assert.equal(fs.existsSync(globalClaudeSkill), true);
    assert.equal(promptResult.status, 0);
    assert.equal(promptResult.stdout, `${questionsAtEndMiddleware}\nPrint Kit hello!\n`);
    assert.equal(scriptResult.status, 0);
    assert.equal(scriptResult.stdout, "kit-script:first,second\n");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric register --local <path> writes only to local registries and local skill roots", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-kit-register-home-"));
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-kit-register-workspace-"));
  const outsideWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-kit-register-outside-"));

  try {
    const result = spawnSync(process.execPath, [cliPath, "register", "--local", kitFixturePath], {
      cwd: tempWorkspace,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const localRegistry = path.join(tempWorkspace, ".fabric", "resources.toml");
    const globalRegistry = path.join(tempHome, ".fabric", "resources.toml");
    const localClaudeSkill = path.join(tempWorkspace, ".claude", "skills", "fabric-kit-hello", "SKILL.md");
    const globalClaudeSkill = path.join(tempHome, ".claude", "skills", "fabric-kit-hello", "SKILL.md");
    const localPromptResult = spawnSync(process.execPath, [cliPath, "prompt", "get", "kit-hello"], {
      cwd: tempWorkspace,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    const localScriptResult = spawnSync(process.execPath, [cliPath, "script", "run", "kit-hello-script", "workspace"], {
      cwd: tempWorkspace,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    const outsidePromptResult = spawnSync(process.execPath, [cliPath, "prompt", "get", "kit-hello"], {
      cwd: outsideWorkspace,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    const outsideScriptResult = spawnSync(process.execPath, [cliPath, "script", "run", "kit-hello-script"], {
      cwd: outsideWorkspace,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Registered resources from .* into .*\.fabric\/resources\.toml and generated \d+ skills in 2 skill roots\n$/);
    assert.equal(result.stderr, "");
    assert.equal(fs.existsSync(localRegistry), true);
    assert.equal(fs.existsSync(globalRegistry), true);
    assert.equal(fs.readFileSync(localRegistry, "utf8").includes(path.join(kitFixturePath, "prompts", "*.md")), true);
    assert.equal(fs.readFileSync(globalRegistry, "utf8").includes(path.join(kitFixturePath, "prompts", "*.md")), false);
    assert.equal(fs.readFileSync(localRegistry, "utf8").includes(kitScriptGlob), true);
    assert.equal(fs.readFileSync(globalRegistry, "utf8").includes(kitScriptGlob), false);
    assert.equal(fs.existsSync(localClaudeSkill), true);
    assert.equal(fs.existsSync(globalClaudeSkill), false);
    assert.equal(localPromptResult.status, 0);
    assert.equal(localPromptResult.stdout, `${questionsAtEndMiddleware}\nPrint Kit hello!\n`);
    assert.equal(localScriptResult.status, 0);
    assert.equal(localScriptResult.stdout, "kit-script:workspace\n");
    assert.equal(outsidePromptResult.status, 1);
    assert.equal(outsidePromptResult.stderr, "Unknown prompt: kit-hello\n");
    assert.equal(outsideScriptResult.status, 1);
    assert.equal(outsideScriptResult.stderr, "Unknown script: kit-hello-script\n");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
    fs.rmSync(outsideWorkspace, { recursive: true, force: true });
  }
});

test("fabric register --local <path> --include-global writes local registries and generates local skills from both local and global prompts", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-kit-register-home-include-global-"));
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-kit-register-workspace-include-global-"));

  try {
    const result = spawnSync(process.execPath, [cliPath, "register", "--local", kitFixturePath, "--include-global"], {
      cwd: tempWorkspace,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    const localRegistry = path.join(tempWorkspace, ".fabric", "resources.toml");
    const localClaudeSkill = path.join(tempWorkspace, ".claude", "skills", "fabric-kit-hello", "SKILL.md");
    const localClaudeHello = path.join(tempWorkspace, ".claude", "skills", "fabric-hello", "SKILL.md");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Registered resources from .* into .*\.fabric\/resources\.toml and generated \d+ skills in 2 skill roots\n$/);
    assert.equal(result.stderr, "");
    assert.equal(fs.existsSync(localRegistry), true);
    assert.equal(fs.readFileSync(localRegistry, "utf8").includes(path.join(kitFixturePath, "prompts", "*.md")), true);
    assert.equal(fs.existsSync(localClaudeSkill), true);
    assert.equal(fs.existsSync(localClaudeHello), false);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});
