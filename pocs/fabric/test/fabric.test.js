const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadPromptsFromManifest } = require("../src/prompts");
const { parseResourcesManifest } = require("../src/resources");
const {
  detectPackageManager,
  buildInstallCommand,
  computeInstallDecision,
  resolveKitDependencies,
  installKit,
} = require("../src/install");
const { registerKitFolder } = require("../src/kits");

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
const apiFixturePath = path.join(__dirname, "fixtures", "api");
const apiFixtureApisDir = path.join(apiFixturePath, "apis");
const apiFixtureAuthPath = path.join(apiFixturePath, "auth.toml");
const { createMockServer } = require("./fixtures/api/mock-server");
const sharedCliHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-cli-home-"));
const questionsAtEndMiddleware = "If you need to ask the user questions, place all user-facing questions together as a list at the very end of the output. Label the questions as `A`, `B`, `C`, `D`, and so on. Number the answer options for each question so the user can reply compactly with forms such as `A1`, `B3`, or `A2, C1`. Always propose your own recommended option or answer and explain why. Each question must include its rationale, and include relevant risks or trade-offs when applicable.";

function buildCliEnv(homeDir = sharedCliHome, overrides = {}) {
  return {
    ...process.env,
    FABRIC_HOME: homeDir,
    ...overrides,
  };
}

function setupApiFixtures(tempHome, mockUrl, { includeDuplicate = false } = {}) {
  const globalRegistryDir = path.join(tempHome, ".fabric");
  fs.mkdirSync(globalRegistryDir, { recursive: true });

  // Copy auth.toml
  const authSource = fs.readFileSync(apiFixtureAuthPath, "utf8");
  fs.writeFileSync(path.join(globalRegistryDir, "auth.toml"), authSource, "utf8");

  // Copy API fixtures, substituting the mock URL.
  const targetApisDir = path.join(tempHome, "apis");
  fs.mkdirSync(targetApisDir, { recursive: true });
  const sources = fs.readdirSync(apiFixtureApisDir);
  const copied = [];
  for (const entry of sources) {
    if (entry === "duplicate.api.toml" && !includeDuplicate) continue;
    const sourcePath = path.join(apiFixtureApisDir, entry);
    const targetPath = path.join(targetApisDir, entry);
    const raw = fs.readFileSync(sourcePath, "utf8");
    const substituted = raw.replace("http://MOCK_SERVER_URL_PLACEHOLDER", mockUrl);
    fs.writeFileSync(targetPath, substituted, "utf8");
    copied.push(targetPath);
  }

  const apiGlob = path.join(targetApisDir, "*.api.toml");
  const manifestPath = path.join(globalRegistryDir, "resources.toml");
  fs.writeFileSync(
    manifestPath,
    `schema_version = 1\n\nprompt_files = []\n\nscript_files = []\n\napi_files = [\n  "${apiGlob}",\n]\n`,
    "utf8",
  );

  return { apiGlob, manifestPath, copied };
}

test("fabric-poc init creates a local empty resources manifest without bootstrapping the global registry", () => {
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

test("fabric-poc prompt source returns prompt documents with markers for the resolved prompt", () => {
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

test("fabric-poc prompt list returns a concise table of active prompts", () => {
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

test("fabric-poc prompt list --verbose returns detailed help for each active prompt", () => {
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

test("fabric-poc prompt help returns the authored help section between markers", () => {
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
      "Run `fabric-poc prompt get doc-sample` to get the compiled prompt body.",
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
      "Run `fabric-poc prompt get doc-sample` to get the compiled prompt body.",
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

test("fabric-poc prompt help falls back to frontmatter metadata when no marker is present", () => {
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

test("fabric-poc prompt help returns an error for an unknown prompt", () => {
  const result = spawnSync(process.execPath, [cliPath, "prompt", "help", "definitely-missing"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown prompt: definitely-missing\n");
});

test("fabric-poc prompt types returns a concise catalog of allowed prompt types", () => {
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

test("fabric-poc prompt types --verbose returns required frontmatter and authoring notes per type", () => {
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

test("fabric-poc register generates global Claude and Agents skill entry points", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-register-home-"));

  try {
    const result = spawnSync(process.execPath, [cliPath, "register"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Registered \d+ prompts into 2 skill roots and 2 agent roots\n$/);
    assert.equal(result.stderr, "");

    const claudeHello = path.join(tempHome, ".claude", "skills", "fabric-hello", "SKILL.md");
    const claudeCodex = path.join(tempHome, ".claude", "skills", "fabric-codex", "SKILL.md");
    const agentsPipeline = path.join(tempHome, ".agents", "skills", "fabric-pipeline", "SKILL.md");
    const claudeMiddleware = path.join(tempHome, ".claude", "skills", "artifacts-english", "SKILL.md");
    const claudeAgentsRoot = path.join(tempHome, ".claude", "agents");
    const agentsAgentsRoot = path.join(tempHome, ".agents", "agents");

    assert.equal(fs.existsSync(claudeHello), false);
    assert.equal(fs.existsSync(claudeCodex), false);
    assert.equal(fs.existsSync(agentsPipeline), false);
    assert.equal(fs.existsSync(claudeMiddleware), false);
    assert.equal(fs.existsSync(claudeAgentsRoot), true);
    assert.equal(fs.existsSync(agentsAgentsRoot), true);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc register --local generates skill entry points in the current workspace", () => {
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
    assert.equal(result.stdout, "Registered 1 prompts into 2 skill roots and 2 agent roots\n");
    assert.equal(result.stderr, "");

    const localClaudeOnly = path.join(tempWorkspace, ".claude", "skills", "fabric-local-only", "SKILL.md");
    const localAgentsOnly = path.join(tempWorkspace, ".agents", "skills", "fabric-local-only", "SKILL.md");
    const localClaudeHello = path.join(tempWorkspace, ".claude", "skills", "fabric-hello", "SKILL.md");

    assert.equal(fs.existsSync(localClaudeOnly), true);
    assert.equal(fs.existsSync(localAgentsOnly), true);
    assert.equal(fs.existsSync(localClaudeHello), false);
    assert.match(fs.readFileSync(localClaudeOnly, "utf8"), /^---\nname: fabric-local-only\ndescription: "Local-only test skill: safe"\n---\n\nEXECUTE and FOLLOW `fabric-poc prompt get local-only`\n$/);
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("fabric-poc register --local --include-global generates local and global skill entry points in the current workspace", () => {
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
    assert.match(result.stdout, /^Registered \d+ prompts into 2 skill roots and 2 agent roots\n$/);
    assert.equal(result.stderr, "");

    const localClaudeOnly = path.join(tempWorkspace, ".claude", "skills", "fabric-local-only", "SKILL.md");
    const localClaudeHello = path.join(tempWorkspace, ".claude", "skills", "fabric-hello", "SKILL.md");

    assert.equal(fs.existsSync(localClaudeOnly), true);
    assert.equal(fs.existsSync(localClaudeHello), false);
    assert.match(fs.readFileSync(localClaudeOnly, "utf8"), /^---\nname: fabric-local-only\ndescription: "Local-only test skill: safe"\n---\n\nEXECUTE and FOLLOW `fabric-poc prompt get local-only`\n$/);
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("fabric-poc register --local writes sub-agent entry points for type: agent prompts", () => {
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-register-agent-local-"));

  try {
    fs.mkdirSync(path.join(tempWorkspace, ".fabric", "prompts"), { recursive: true });
    fs.writeFileSync(
      path.join(tempWorkspace, ".fabric", "resources.toml"),
      "schema_version = 1\nprompt_files = [ \"prompts/*.md\" ]\nscript_files = [ ]\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(tempWorkspace, ".fabric", "prompts", "local-skill.md"),
      [
        "---",
        "id: local-skill",
        "type: skill",
        "name: local-skill",
        "description: Local skill: safe",
        "---",
        "",
        "<!-- append \"body\" -->",
        "Skill body",
        "<!-- /append -->",
        "",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(tempWorkspace, ".fabric", "prompts", "local-agent.md"),
      [
        "---",
        "id: local-agent",
        "type: agent",
        "name: local-agent",
        "description: Local agent: persona",
        "---",
        "",
        "<!-- append \"body\" -->",
        "Agent body",
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
    assert.equal(result.stdout, "Registered 2 prompts into 2 skill roots and 2 agent roots\n");
    assert.equal(result.stderr, "");

    const localClaudeSkill = path.join(tempWorkspace, ".claude", "skills", "fabric-local-skill", "SKILL.md");
    const localAgentsSkill = path.join(tempWorkspace, ".agents", "skills", "fabric-local-skill", "SKILL.md");
    const localClaudeAgent = path.join(tempWorkspace, ".claude", "agents", "fabric-local-agent.md");
    const localAgentsAgent = path.join(tempWorkspace, ".agents", "agents", "fabric-local-agent.md");
    const skillCrossClaudeAgent = path.join(tempWorkspace, ".claude", "agents", "fabric-local-skill.md");
    const agentCrossClaudeSkill = path.join(tempWorkspace, ".claude", "skills", "fabric-local-agent", "SKILL.md");

    assert.equal(fs.existsSync(localClaudeSkill), true);
    assert.equal(fs.existsSync(localAgentsSkill), true);
    assert.equal(fs.existsSync(localClaudeAgent), true);
    assert.equal(fs.existsSync(localAgentsAgent), true);
    assert.equal(fs.existsSync(skillCrossClaudeAgent), false);
    assert.equal(fs.existsSync(agentCrossClaudeSkill), false);

    const expectedAgentBody = [
      "---",
      "name: fabric-local-agent",
      'description: "Local agent: persona"',
      "---",
      "",
      "EXECUTE and FOLLOW `fabric-poc prompt get local-agent`",
      "",
    ].join("\n");
    assert.equal(fs.readFileSync(localClaudeAgent, "utf8"), expectedAgentBody);
    assert.equal(fs.readFileSync(localAgentsAgent, "utf8"), expectedAgentBody);
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test("fabric-poc register <path> generates global agent entry points for type: agent prompts in a kit", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-register-agent-kit-home-"));
  const tempKit = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-register-agent-kit-"));

  try {
    fs.mkdirSync(path.join(tempKit, "prompts"), { recursive: true });
    fs.writeFileSync(
      path.join(tempKit, "resources.toml"),
      "schema_version = 1\nprompt_files = [ \"prompts/*.md\" ]\nscript_files = [ ]\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(tempKit, "prompts", "kit-agent.md"),
      [
        "---",
        "id: kit-agent",
        "type: agent",
        "name: kit-agent",
        "description: Kit agent: scoped persona",
        "---",
        "",
        "<!-- append \"body\" -->",
        "Kit agent body",
        "<!-- /append -->",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(process.execPath, [cliPath, "register", tempKit], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Registered resources from .* into .*\.fabric\/resources\.toml and generated \d+ prompts in 2 skill roots and 2 agent roots\n$/);
    assert.equal(result.stderr, "");

    const claudeAgent = path.join(tempHome, ".claude", "agents", "fabric-kit-agent.md");
    const agentsAgent = path.join(tempHome, ".agents", "agents", "fabric-kit-agent.md");
    const claudeSkill = path.join(tempHome, ".claude", "skills", "fabric-kit-agent", "SKILL.md");

    assert.equal(fs.existsSync(claudeAgent), true);
    assert.equal(fs.existsSync(agentsAgent), true);
    assert.equal(fs.existsSync(claudeSkill), false);
    assert.match(fs.readFileSync(claudeAgent, "utf8"), /^---\nname: fabric-kit-agent\ndescription: "Kit agent: scoped persona"\n---\n\nEXECUTE and FOLLOW `fabric-poc prompt get kit-agent`\n$/);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempKit, { recursive: true, force: true });
  }
});

test("fabric-poc delegate claude forwards prompt and returns delegated response", () => {
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

test("fabric-poc prompt delegate codex forwards named prompt and returns delegated response", () => {
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

test("fabric-poc script run executes a registered global script", () => {
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

test("fabric-poc script help returns detailed help for a registered global script", () => {
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
      "  fabric-poc script run kit-hello-script <value> [more-values...]",
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
      "  - fabric-poc script run kit-hello-script alpha beta",
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
      '    usage: "fabric-poc script run valid-loose",',
      '    parameters: ["path"],',
      '    returns: "plain text",',
      '    examples: ["fabric-poc script run valid-loose"],',
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

test("fabric-poc script list returns a concise table of active scripts", () => {
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

test("fabric-poc script list --verbose returns detailed help for each active script", () => {
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
      "  fabric-poc script run kit-hello-script <value> [more-values...]",
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
      "  - fabric-poc script run kit-hello-script alpha beta",
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

test("fabric-poc prompt get returns error for unknown prompt", () => {
  const result = spawnSync(process.execPath, [cliPath, "prompt", "get", "unknown"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown prompt: unknown\n");
});

test("fabric-poc prompt source returns error for unknown prompt", () => {
  const result = spawnSync(process.execPath, [cliPath, "prompt", "source", "unknown"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown prompt: unknown\n");
});

test("fabric-poc script run returns error for unknown script", () => {
  const result = spawnSync(process.execPath, [cliPath, "script", "run", "unknown-script"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown script: unknown-script\n");
});

test("fabric-poc script help returns error for unknown script", () => {
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

test("fabric-poc register ignores commented prompt file entries in the global registry", () => {
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
    assert.equal(result.stdout, "Registered 0 prompts into 2 skill roots and 2 agent roots\n");
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc register <path> adds resources to the global registry and generates global skills", () => {
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
    assert.match(result.stdout, /^Registered resources from .* into .*\.fabric\/resources\.toml and generated \d+ prompts in 2 skill roots and 2 agent roots\n$/);
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

test("fabric-poc register --local <path> writes only to local registries and local skill roots", () => {
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
    assert.match(result.stdout, /^Registered resources from .* into .*\.fabric\/resources\.toml and generated \d+ prompts in 2 skill roots and 2 agent roots\n$/);
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

test("fabric-poc register --local <path> --include-global writes local registries and generates local skills from both local and global prompts", () => {
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
    assert.match(result.stdout, /^Registered resources from .* into .*\.fabric\/resources\.toml and generated \d+ prompts in 2 skill roots and 2 agent roots\n$/);
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

test("fabric-poc api list with no APIs returns an empty table", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-list-empty-"));
  const globalRegistryDir = path.join(tempHome, ".fabric");
  const globalRegistryPath = path.join(globalRegistryDir, "resources.toml");

  try {
    fs.mkdirSync(globalRegistryDir, { recursive: true });
    fs.writeFileSync(globalRegistryPath, "schema_version = 1\n\nprompt_files = []\n\nscript_files = []\n\napi_files = []\n", "utf8");

    const result = spawnSync(process.execPath, [cliPath, "api", "list"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "Name | Description | Base URL | Auth\n");
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api list returns a row per registered API", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-list-"));
  try {
    setupApiFixtures(tempHome, mock.url);

    const result = spawnSync(process.execPath, [cliPath, "api", "list"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines[0], "Name | Description | Base URL | Auth");
    const names = lines.slice(1).map((l) => l.split(" | ")[0]);
    assert.deepEqual(names.sort(), ["sample", "with-basic", "with-bearer", "with-header", "with-help"]);
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api help prints the authored help section when present", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-help-authored-"));
  try {
    setupApiFixtures(tempHome, mock.url);

    const result = spawnSync(process.execPath, [cliPath, "api", "help", "with-help"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.ok(result.stdout.includes("## Usage"));
    assert.ok(result.stdout.includes("fabric-poc api call with-help /ping"));
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api help falls back to metadata when no marker is present", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-help-fallback-"));
  try {
    setupApiFixtures(tempHome, mock.url);

    const result = spawnSync(process.execPath, [cliPath, "api", "help", "sample"], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.ok(result.stdout.includes("Name: sample"));
    assert.ok(result.stdout.includes("Description: Fixture API without auth"));
    assert.ok(result.stdout.includes(`Base URL: ${mock.url}`));
    assert.ok(result.stdout.includes("Auth: (none)"));
    assert.ok(result.stdout.includes("(no <!-- help --> section in api file)"));
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api help returns an error for an unknown API", () => {
  const result = spawnSync(process.execPath, [cliPath, "api", "help", "definitely-missing"], {
    encoding: "utf8",
    env: buildCliEnv(),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown API: definitely-missing\n");
});

test("fabric-poc api call GET reaches the mock server and returns the body", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-get-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    const { callApi } = require("../src/apis");

    const r = await callApi("sample", { path: "/ping" }, { homeDir: tempHome });

    assert.equal(r.ok, true);
    assert.equal(r.status, 200);
    assert.equal(r.body.method, "GET");
    assert.equal(r.body.url, "/ping");
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api call POST --json sets Content-Type and body", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-post-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    const { callApi } = require("../src/apis");

    const r = await callApi("sample", {
      method: "POST",
      path: "/echo",
      body: '{"hello":"world"}',
      headers: { "Content-Type": "application/json" },
    }, { homeDir: tempHome });

    assert.equal(r.ok, true);
    assert.equal(r.body.method, "POST");
    assert.equal(r.body.headers["content-type"], "application/json");
    assert.equal(r.body.body, '{"hello":"world"}');
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api call -H forwards the header verbatim", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-header-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    const { callApi } = require("../src/apis");

    const r = await callApi("sample", {
      path: "/echo",
      headers: { "X-Trace": "trace-1" },
    }, { homeDir: tempHome });

    assert.equal(r.ok, true);
    assert.equal(r.body.headers["x-trace"], "trace-1");
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api call exits 1 on non-2xx and writes status to stderr", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-error-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    const { callApi } = require("../src/apis");

    const r = await callApi("sample", { path: "/status/404" }, { homeDir: tempHome });

    assert.equal(r.ok, false);
    assert.equal(r.status, 404);
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api call injects Bearer Authorization from auth.toml", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-bearer-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    const { callApi } = require("../src/apis");

    const r = await callApi("with-bearer", { path: "/ping" }, { homeDir: tempHome });

    assert.equal(r.ok, true);
    assert.equal(r.body.headers.authorization, "Bearer test-bearer-abc123");
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api call injects Basic Authorization from auth.toml", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-basic-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    const { callApi } = require("../src/apis");

    const r = await callApi("with-basic", { path: "/ping" }, { homeDir: tempHome });

    assert.equal(r.ok, true);
    const expected = "Basic " + Buffer.from("alice:secret").toString("base64");
    assert.equal(r.body.headers.authorization, expected);
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api call with header-type credential sets each declared header", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-header-auth-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    const { callApi } = require("../src/apis");

    const r = await callApi("with-header", { path: "/ping" }, { homeDir: tempHome });

    assert.equal(r.ok, true);
    assert.equal(r.body.headers["x-api-key"], "api-key-xyz");
    assert.equal(r.body.headers["x-default"], "yes");
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api call fails when auth_ref points to a missing credential", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-missing-cred-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    fs.writeFileSync(path.join(tempHome, ".fabric", "auth.toml"), "schema_version = 1\n", "utf8");

    const result = spawnSync(process.execPath, [
      cliPath, "api", "call", "with-bearer", "/ping",
    ], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.ok(result.stderr.includes("Credential not found: bearer-token"));
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc api list throws on duplicate API names", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-dup-"));
  try {
    setupApiFixtures(tempHome, mock.url, { includeDuplicate: true });

    const result = spawnSync(process.execPath, [
      cliPath, "api", "list",
    ], {
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });

    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("Duplicate API definition \"sample\""));
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("per-call -H overrides an auth-contributed header with the same name", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-call-override-"));
  try {
    setupApiFixtures(tempHome, mock.url);
    const { callApi } = require("../src/apis");

    const r = await callApi("with-bearer", {
      path: "/ping",
      headers: { "Authorization": "Override-Value" },
    }, { homeDir: tempHome });

    assert.equal(r.ok, true);
    assert.equal(r.body.headers.authorization, "Override-Value");
  } finally {
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric SDK api.call returns { status, headers, body, ok }", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-sdk-"));
  const prevHome = process.env.FABRIC_HOME;
  try {
    setupApiFixtures(tempHome, mock.url);
    process.env.FABRIC_HOME = tempHome;
    const fabric = require("../src/public.js");

    const r = await fabric.api.call("sample", { path: "/hello" });

    assert.equal(r.status, 200);
    assert.equal(r.ok, true);
    assert.equal(r.body.method, "GET");
  } finally {
    process.env.FABRIC_HOME = prevHome;
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric SDK api.call returns ok:false on non-2xx without throwing", async () => {
  const mock = await createMockServer();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fabric-api-sdk-404-"));
  const prevHome = process.env.FABRIC_HOME;
  try {
    setupApiFixtures(tempHome, mock.url);
    process.env.FABRIC_HOME = tempHome;
    const fabric = require("../src/public.js");

    let r;
    try {
      r = await fabric.api.call("sample", { path: "/status/404" });
    } catch (err) {
      assert.fail("fabric.api.call should not throw on non-2xx, but threw: " + err.message);
    }

    assert.equal(r.status, 404);
    assert.equal(r.ok, false);
  } finally {
    process.env.FABRIC_HOME = prevHome;
    await mock.close();
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("parseResourcesManifest returns dependencies: null when no [dependencies] table is present", () => {
  const content = `schema_version = 1\nprompt_files = []\nscript_files = []\n`;
  const parsed = parseResourcesManifest(content);
  assert.equal(parsed.dependencies, null);
});

test("parseResourcesManifest returns dependencies with all provided fields when present", () => {
  const content = [
    `schema_version = 1`,
    `prompt_files = []`,
    `script_files = []`,
    ``,
    `[dependencies]`,
    `strategy = "package-json"`,
    `package_manager = "pnpm"`,
    `ignore_scripts = true`,
  ].join("\n");
  const parsed = parseResourcesManifest(content);
  assert.deepEqual(parsed.dependencies, {
    strategy: "package-json",
    packageManager: "pnpm",
    ignoreScripts: true,
  });
});

test("parseResourcesManifest fills dependency defaults: package_manager=auto, ignore_scripts=false, strategy required", () => {
  const content = [
    `schema_version = 1`,
    `prompt_files = []`,
    `script_files = []`,
    ``,
    `[dependencies]`,
    `strategy = "vendored"`,
  ].join("\n");
  const parsed = parseResourcesManifest(content);
  assert.deepEqual(parsed.dependencies, {
    strategy: "vendored",
    packageManager: "auto",
    ignoreScripts: false,
  });
});

test("parseResourcesManifest throws when dependencies.strategy is missing", () => {
  const content = [
    `schema_version = 1`,
    `prompt_files = []`,
    `script_files = []`,
    ``,
    `[dependencies]`,
    `package_manager = "npm"`,
  ].join("\n");
  assert.throws(() => parseResourcesManifest(content), /dependencies\.strategy/);
});

test("parseResourcesManifest throws on invalid dependencies.strategy", () => {
  const content = [
    `schema_version = 1`,
    `prompt_files = []`,
    `script_files = []`,
    ``,
    `[dependencies]`,
    `strategy = "magic"`,
  ].join("\n");
  assert.throws(() => parseResourcesManifest(content), /dependencies\.strategy.*none.*package-json.*vendored/s);
});

test("parseResourcesManifest throws on invalid dependencies.package_manager", () => {
  const content = [
    `schema_version = 1`,
    `prompt_files = []`,
    `script_files = []`,
    ``,
    `[dependencies]`,
    `strategy = "package-json"`,
    `package_manager = "cargo"`,
  ].join("\n");
  assert.throws(() => parseResourcesManifest(content), /dependencies\.package_manager.*auto.*npm.*pnpm.*yarn.*bun/s);
});

function makeKitDir(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fabric-kit-${label}-`));
  return dir;
}

test("detectPackageManager returns npm when no lockfile is present", () => {
  const kitDir = makeKitDir("detect-default");
  try {
    assert.equal(detectPackageManager(kitDir), "npm");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("detectPackageManager returns npm when only package-lock.json is present", () => {
  const kitDir = makeKitDir("detect-npm");
  try {
    fs.writeFileSync(path.join(kitDir, "package-lock.json"), "{}", "utf8");
    assert.equal(detectPackageManager(kitDir), "npm");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("detectPackageManager returns pnpm when pnpm-lock.yaml is present", () => {
  const kitDir = makeKitDir("detect-pnpm");
  try {
    fs.writeFileSync(path.join(kitDir, "pnpm-lock.yaml"), "lockfileVersion: '6.0'\n", "utf8");
    assert.equal(detectPackageManager(kitDir), "pnpm");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("detectPackageManager returns yarn when yarn.lock is present", () => {
  const kitDir = makeKitDir("detect-yarn");
  try {
    fs.writeFileSync(path.join(kitDir, "yarn.lock"), "# yarn lockfile v1\n", "utf8");
    assert.equal(detectPackageManager(kitDir), "yarn");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("detectPackageManager returns bun when bun.lock is present", () => {
  const kitDir = makeKitDir("detect-bun");
  try {
    fs.writeFileSync(path.join(kitDir, "bun.lock"), "{}", "utf8");
    assert.equal(detectPackageManager(kitDir), "bun");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("detectPackageManager returns bun when bun.lockb is present", () => {
  const kitDir = makeKitDir("detect-bunb");
  try {
    fs.writeFileSync(path.join(kitDir, "bun.lockb"), "binary", "utf8");
    assert.equal(detectPackageManager(kitDir), "bun");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("detectPackageManager prefers pnpm over npm when both lockfiles exist", () => {
  const kitDir = makeKitDir("detect-pnpm-vs-npm");
  try {
    fs.writeFileSync(path.join(kitDir, "package-lock.json"), "{}", "utf8");
    fs.writeFileSync(path.join(kitDir, "pnpm-lock.yaml"), "lockfileVersion: '6.0'\n", "utf8");
    assert.equal(detectPackageManager(kitDir), "pnpm");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("buildInstallCommand: npm + lockfile uses ci without --ignore-scripts by default", () => {
  assert.deepEqual(buildInstallCommand({ packageManager: "npm", hasLockfile: true, ignoreScripts: false }), {
    command: "npm",
    args: ["ci"],
  });
});

test("buildInstallCommand: npm + no lockfile falls back to install", () => {
  assert.deepEqual(buildInstallCommand({ packageManager: "npm", hasLockfile: false, ignoreScripts: false }), {
    command: "npm",
    args: ["install"],
  });
});

test("buildInstallCommand: npm appends --ignore-scripts when configured", () => {
  assert.deepEqual(buildInstallCommand({ packageManager: "npm", hasLockfile: true, ignoreScripts: true }), {
    command: "npm",
    args: ["ci", "--ignore-scripts"],
  });
});

test("buildInstallCommand: pnpm + lockfile uses --frozen-lockfile", () => {
  assert.deepEqual(buildInstallCommand({ packageManager: "pnpm", hasLockfile: true, ignoreScripts: false }), {
    command: "pnpm",
    args: ["install", "--frozen-lockfile"],
  });
});

test("buildInstallCommand: pnpm + no lockfile + ignore-scripts", () => {
  assert.deepEqual(buildInstallCommand({ packageManager: "pnpm", hasLockfile: false, ignoreScripts: true }), {
    command: "pnpm",
    args: ["install", "--ignore-scripts"],
  });
});

test("buildInstallCommand: yarn + lockfile uses --frozen-lockfile", () => {
  assert.deepEqual(buildInstallCommand({ packageManager: "yarn", hasLockfile: true, ignoreScripts: false }), {
    command: "yarn",
    args: ["install", "--frozen-lockfile"],
  });
});

test("buildInstallCommand: bun + lockfile uses --frozen-lockfile", () => {
  assert.deepEqual(buildInstallCommand({ packageManager: "bun", hasLockfile: true, ignoreScripts: false }), {
    command: "bun",
    args: ["install", "--frozen-lockfile"],
  });
});

test("buildInstallCommand throws on unknown package manager", () => {
  assert.throws(() => buildInstallCommand({ packageManager: "cargo", hasLockfile: true, ignoreScripts: false }), /buildInstallCommand.*cargo/);
});

const SAMPLE_STATE = {
  packageJsonHash: "pkg-1",
  lockfileHash: "lock-1",
  packageManager: "npm",
  nodeVersion: "v22.0.0",
};

function makeDecisionInputs(overrides = {}) {
  return {
    strategy: "package-json",
    hasNodeModules: true,
    currentState: { ...SAMPLE_STATE },
    expectedState: { ...SAMPLE_STATE },
    flags: { noInstall: false, reinstall: false },
    ...overrides,
  };
}

test("computeInstallDecision skips when strategy is none", () => {
  const decision = computeInstallDecision(makeDecisionInputs({ strategy: "none" }));
  assert.equal(decision.action, "skip");
  assert.match(decision.reason, /no-deps/);
});

test("computeInstallDecision verifies when strategy is vendored and node_modules exists", () => {
  const decision = computeInstallDecision(makeDecisionInputs({ strategy: "vendored", currentState: null }));
  assert.equal(decision.action, "verify");
  assert.match(decision.reason, /vendored/);
});

test("computeInstallDecision fails when strategy is vendored but node_modules is missing", () => {
  const decision = computeInstallDecision(makeDecisionInputs({ strategy: "vendored", hasNodeModules: false, currentState: null }));
  assert.equal(decision.action, "fail");
  assert.match(decision.reason, /vendored.*node_modules/);
});

test("computeInstallDecision installs when package-json kit has no node_modules", () => {
  const decision = computeInstallDecision(makeDecisionInputs({ hasNodeModules: false, currentState: null }));
  assert.equal(decision.action, "install");
  assert.match(decision.reason, /no-node-modules/);
});

test("computeInstallDecision installs when no state file recorded", () => {
  const decision = computeInstallDecision(makeDecisionInputs({ currentState: null }));
  assert.equal(decision.action, "install");
  assert.match(decision.reason, /no-state/);
});

test("computeInstallDecision skips when state matches expected hashes and node version", () => {
  const decision = computeInstallDecision(makeDecisionInputs());
  assert.equal(decision.action, "skip");
  assert.match(decision.reason, /state-match/);
});

test("computeInstallDecision installs when lockfile hash differs", () => {
  const decision = computeInstallDecision(makeDecisionInputs({
    expectedState: { ...SAMPLE_STATE, lockfileHash: "lock-2" },
  }));
  assert.equal(decision.action, "install");
  assert.match(decision.reason, /lockfile/);
});

test("computeInstallDecision installs when package.json hash differs", () => {
  const decision = computeInstallDecision(makeDecisionInputs({
    expectedState: { ...SAMPLE_STATE, packageJsonHash: "pkg-2" },
  }));
  assert.equal(decision.action, "install");
  assert.match(decision.reason, /package\.json/);
});

test("computeInstallDecision installs when node version differs", () => {
  const decision = computeInstallDecision(makeDecisionInputs({
    expectedState: { ...SAMPLE_STATE, nodeVersion: "v24.0.0" },
  }));
  assert.equal(decision.action, "install");
  assert.match(decision.reason, /node-version/);
});

test("computeInstallDecision installs when reinstall flag is set even if state matches", () => {
  const decision = computeInstallDecision(makeDecisionInputs({ flags: { noInstall: false, reinstall: true } }));
  assert.equal(decision.action, "install");
  assert.match(decision.reason, /reinstall-flag/);
});

test("computeInstallDecision verifies under --no-install when node_modules exists", () => {
  const decision = computeInstallDecision(makeDecisionInputs({
    flags: { noInstall: true, reinstall: false },
    currentState: null,
  }));
  assert.equal(decision.action, "verify");
  assert.match(decision.reason, /no-install/);
});

test("computeInstallDecision fails under --no-install when node_modules is missing", () => {
  const decision = computeInstallDecision(makeDecisionInputs({
    flags: { noInstall: true, reinstall: false },
    hasNodeModules: false,
    currentState: null,
  }));
  assert.equal(decision.action, "fail");
  assert.match(decision.reason, /no-install.*node_modules/);
});

function writeKitManifest(kitDir, body = "schema_version = 1\nprompt_files = []\nscript_files = []\n") {
  fs.writeFileSync(path.join(kitDir, "resources.toml"), body, "utf8");
}

test("resolveKitDependencies throws when kit has no resources.toml", () => {
  const kitDir = makeKitDir("resolve-no-manifest");
  try {
    assert.throws(() => resolveKitDependencies(kitDir), /resources\.toml/);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("resolveKitDependencies returns strategy=none when no [dependencies] table and no package.json", () => {
  const kitDir = makeKitDir("resolve-implicit-none");
  try {
    writeKitManifest(kitDir);
    const deps = resolveKitDependencies(kitDir);
    assert.equal(deps.strategy, "none");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("resolveKitDependencies returns implicit package-json strategy when package.json exists", () => {
  const kitDir = makeKitDir("resolve-implicit-pkg");
  try {
    writeKitManifest(kitDir);
    fs.writeFileSync(path.join(kitDir, "package.json"), '{"name":"k","version":"0.0.0"}', "utf8");
    const deps = resolveKitDependencies(kitDir);
    assert.deepEqual(deps, { strategy: "package-json", packageManager: "npm", ignoreScripts: false });
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("resolveKitDependencies resolves package_manager=auto via lockfile detection", () => {
  const kitDir = makeKitDir("resolve-auto-detect");
  try {
    writeKitManifest(kitDir, [
      `schema_version = 1`,
      `prompt_files = []`,
      `script_files = []`,
      ``,
      `[dependencies]`,
      `strategy = "package-json"`,
      `package_manager = "auto"`,
    ].join("\n"));
    fs.writeFileSync(path.join(kitDir, "pnpm-lock.yaml"), "lockfileVersion: '6.0'\n", "utf8");
    const deps = resolveKitDependencies(kitDir);
    assert.equal(deps.packageManager, "pnpm");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("resolveKitDependencies honors explicit package_manager", () => {
  const kitDir = makeKitDir("resolve-explicit-pm");
  try {
    writeKitManifest(kitDir, [
      `schema_version = 1`,
      `prompt_files = []`,
      `script_files = []`,
      ``,
      `[dependencies]`,
      `strategy = "package-json"`,
      `package_manager = "yarn"`,
    ].join("\n"));
    fs.writeFileSync(path.join(kitDir, "pnpm-lock.yaml"), "lockfileVersion: '6.0'\n", "utf8");
    const deps = resolveKitDependencies(kitDir);
    assert.equal(deps.packageManager, "yarn");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

function makeFakeRunner(impl) {
  const calls = [];
  function runner(opts) {
    calls.push(opts);
    return impl ? impl(opts) : { status: 0, stdout: "", stderr: "" };
  }
  return { runner, calls };
}

test("installKit returns skip without invoking runner when strategy is none", () => {
  const kitDir = makeKitDir("kit-install-none");
  try {
    writeKitManifest(kitDir);
    const fake = makeFakeRunner();
    const result = installKit(kitDir, { runner: fake.runner });
    assert.equal(result.action, "skip");
    assert.equal(result.strategy, "none");
    assert.equal(fake.calls.length, 0);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("installKit runs install with detected package manager and writes state file", () => {
  const kitDir = makeKitDir("kit-install-run");
  try {
    writeKitManifest(kitDir);
    fs.writeFileSync(path.join(kitDir, "package.json"), '{"name":"k","version":"0.0.0"}', "utf8");
    fs.writeFileSync(path.join(kitDir, "package-lock.json"), '{"name":"k","lockfileVersion":3}', "utf8");
    const fake = makeFakeRunner(({ cwd }) => {
      // simulate install creating node_modules
      fs.mkdirSync(path.join(cwd, "node_modules"), { recursive: true });
      fs.writeFileSync(path.join(cwd, "node_modules", ".keep"), "", "utf8");
      return { status: 0, stdout: "", stderr: "" };
    });
    const result = installKit(kitDir, { runner: fake.runner });
    assert.equal(result.action, "install");
    assert.equal(result.packageManager, "npm");
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.calls[0].command, "npm");
    assert.deepEqual(fake.calls[0].args, ["ci"]);
    assert.equal(fake.calls[0].cwd, kitDir);
    const stateFilePath = path.join(kitDir, "node_modules", ".fabric-install-state.json");
    assert.equal(fs.existsSync(stateFilePath), true);
    const state = JSON.parse(fs.readFileSync(stateFilePath, "utf8"));
    assert.equal(state.packageManager, "npm");
    assert.equal(state.nodeVersion, process.version);
    assert.equal(typeof state.lockfileHash, "string");
    assert.equal(typeof state.packageJsonHash, "string");
    assert.equal(typeof state.installedAt, "string");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("installKit skips when state file matches current package.json + lockfile + node version", () => {
  const kitDir = makeKitDir("kit-install-cache-hit");
  try {
    writeKitManifest(kitDir);
    fs.writeFileSync(path.join(kitDir, "package.json"), '{"name":"k","version":"0.0.0"}', "utf8");
    fs.writeFileSync(path.join(kitDir, "package-lock.json"), '{"name":"k","lockfileVersion":3}', "utf8");
    const fake = makeFakeRunner(({ cwd }) => {
      fs.mkdirSync(path.join(cwd, "node_modules"), { recursive: true });
      fs.writeFileSync(path.join(cwd, "node_modules", ".keep"), "", "utf8");
      return { status: 0, stdout: "", stderr: "" };
    });
    installKit(kitDir, { runner: fake.runner });
    assert.equal(fake.calls.length, 1);
    const second = installKit(kitDir, { runner: fake.runner });
    assert.equal(second.action, "skip");
    assert.match(second.reason, /state-match/);
    assert.equal(fake.calls.length, 1);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("installKit reinstalls when --reinstall is set even if state matches", () => {
  const kitDir = makeKitDir("kit-install-reinstall");
  try {
    writeKitManifest(kitDir);
    fs.writeFileSync(path.join(kitDir, "package.json"), '{"name":"k","version":"0.0.0"}', "utf8");
    const fake = makeFakeRunner(({ cwd }) => {
      fs.mkdirSync(path.join(cwd, "node_modules"), { recursive: true });
      fs.writeFileSync(path.join(cwd, "node_modules", ".keep"), "", "utf8");
      return { status: 0, stdout: "", stderr: "" };
    });
    installKit(kitDir, { runner: fake.runner });
    const second = installKit(kitDir, { runner: fake.runner, reinstall: true });
    assert.equal(second.action, "install");
    assert.match(second.reason, /reinstall-flag/);
    assert.equal(fake.calls.length, 2);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("installKit with --no-install and missing node_modules throws an actionable error", () => {
  const kitDir = makeKitDir("kit-install-no-install-missing");
  try {
    writeKitManifest(kitDir);
    fs.writeFileSync(path.join(kitDir, "package.json"), '{"name":"k","version":"0.0.0"}', "utf8");
    const fake = makeFakeRunner();
    assert.throws(
      () => installKit(kitDir, { runner: fake.runner, noInstall: true }),
      (error) => /no-install/.test(error.message) && /node_modules/.test(error.message),
    );
    assert.equal(fake.calls.length, 0);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("installKit propagates runner failure with kit path and stderr in the error", () => {
  const kitDir = makeKitDir("kit-install-runner-fail");
  try {
    writeKitManifest(kitDir);
    fs.writeFileSync(path.join(kitDir, "package.json"), '{"name":"k","version":"0.0.0"}', "utf8");
    const fake = makeFakeRunner(() => ({ status: 1, stdout: "", stderr: "ENETUNREACH registry.npmjs.org" }));
    assert.throws(
      () => installKit(kitDir, { runner: fake.runner }),
      (error) => error.message.includes(kitDir) && error.message.includes("ENETUNREACH"),
    );
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("installKit verifies vendored kit when node_modules exists", () => {
  const kitDir = makeKitDir("kit-install-vendored-ok");
  try {
    writeKitManifest(kitDir, [
      `schema_version = 1`,
      `prompt_files = []`,
      `script_files = []`,
      ``,
      `[dependencies]`,
      `strategy = "vendored"`,
    ].join("\n"));
    fs.mkdirSync(path.join(kitDir, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(kitDir, "node_modules", ".keep"), "", "utf8");
    const fake = makeFakeRunner();
    const result = installKit(kitDir, { runner: fake.runner });
    assert.equal(result.action, "verify");
    assert.equal(result.strategy, "vendored");
    assert.equal(fake.calls.length, 0);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("installKit throws when vendored kit has no node_modules", () => {
  const kitDir = makeKitDir("kit-install-vendored-fail");
  try {
    writeKitManifest(kitDir, [
      `schema_version = 1`,
      `prompt_files = []`,
      `script_files = []`,
      ``,
      `[dependencies]`,
      `strategy = "vendored"`,
    ].join("\n"));
    const fake = makeFakeRunner();
    assert.throws(
      () => installKit(kitDir, { runner: fake.runner }),
      (error) => /vendored/.test(error.message) && /node_modules/.test(error.message),
    );
    assert.equal(fake.calls.length, 0);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

function makeRegisterKitFixture(label) {
  const kitDir = makeKitDir(`register-${label}`);
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), `fabric-register-home-${label}-`));
  fs.mkdirSync(path.join(kitDir, "prompts"), { recursive: true });
  fs.writeFileSync(
    path.join(kitDir, "prompts", "demo.md"),
    "---\nid: demo\ntype: skill\nname: demo\ndescription: demo skill\n---\n\n<!-- append \"body\" -->\nDemo body.\n<!-- /append -->\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(kitDir, "resources.toml"),
    `schema_version = 1\nprompt_files = ["prompts/*.md"]\nscript_files = []\n`,
    "utf8",
  );
  return { kitDir, tempHome };
}

test("registerKitFolder invokes installer with kit path and forwards install flags", () => {
  const { kitDir, tempHome } = makeRegisterKitFixture("install-call");
  try {
    const installerCalls = [];
    const fakeInstaller = (calledKitPath, options) => {
      installerCalls.push({ calledKitPath, options });
      return { action: "skip", reason: "no-deps", strategy: "none" };
    };
    const result = registerKitFolder(kitDir, {
      homeDir: tempHome,
      installer: fakeInstaller,
      noInstall: true,
      reinstall: false,
    });
    assert.equal(installerCalls.length, 1);
    assert.equal(installerCalls[0].calledKitPath, kitDir);
    assert.equal(installerCalls[0].options.noInstall, true);
    assert.equal(installerCalls[0].options.reinstall, false);
    assert.deepEqual(result.install, { action: "skip", reason: "no-deps", strategy: "none" });
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("registerKitFolder aborts before manifest writes when installer throws", () => {
  const { kitDir, tempHome } = makeRegisterKitFixture("install-fail");
  const globalManifestPath = path.join(tempHome, ".fabric", "resources.toml");
  try {
    const fakeInstaller = () => {
      throw new Error("installer failed: simulated network error");
    };
    assert.throws(
      () => registerKitFolder(kitDir, { homeDir: tempHome, installer: fakeInstaller }),
      /installer failed/,
    );
    assert.equal(fs.existsSync(globalManifestPath), false);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("registerKitFolder defaults to installKit and reports install metadata in result", () => {
  const { kitDir, tempHome } = makeRegisterKitFixture("install-default");
  try {
    const result = registerKitFolder(kitDir, { homeDir: tempHome });
    assert.equal(result.install.action, "skip");
    assert.equal(result.install.strategy, "none");
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc register <path> --local --no-install succeeds for a kit with no dependencies", () => {
  const { kitDir, tempHome } = makeRegisterKitFixture("cli-no-install-none");
  try {
    const result = spawnSync(process.execPath, [cliPath, "register", kitDir, "--local", "--no-install"], {
      cwd: tempHome,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /Registered resources from/);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc register <path> --local --no-install fails when kit has package.json but no node_modules", () => {
  const { kitDir, tempHome } = makeRegisterKitFixture("cli-no-install-missing");
  try {
    fs.writeFileSync(path.join(kitDir, "package.json"), '{"name":"k","version":"0.0.0"}', "utf8");
    const result = spawnSync(process.execPath, [cliPath, "register", kitDir, "--local", "--no-install"], {
      cwd: tempHome,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no-install/);
    assert.match(result.stderr, /node_modules/);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc kit install <path> runs the install path for a strategy=none kit and reports skip", () => {
  const { kitDir, tempHome } = makeRegisterKitFixture("cli-kit-install-skip");
  try {
    const result = spawnSync(process.execPath, [cliPath, "kit", "install", kitDir], {
      cwd: tempHome,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /Dependencies/i);
    assert.match(result.stdout, /skip/);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("fabric-poc kit install <path> verifies a vendored kit and reports verify", () => {
  const { kitDir, tempHome } = makeRegisterKitFixture("cli-kit-install-vendored");
  try {
    fs.writeFileSync(path.join(kitDir, "resources.toml"), [
      `schema_version = 1`,
      `prompt_files = ["prompts/*.md"]`,
      `script_files = []`,
      ``,
      `[dependencies]`,
      `strategy = "vendored"`,
    ].join("\n"), "utf8");
    fs.mkdirSync(path.join(kitDir, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(kitDir, "node_modules", ".keep"), "", "utf8");
    const result = spawnSync(process.execPath, [cliPath, "kit", "install", kitDir], {
      cwd: tempHome,
      encoding: "utf8",
      env: buildCliEnv(tempHome),
    });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /verify/);
    assert.match(result.stdout, /vendored/);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("resolveKitDependencies returns vendored strategy when configured", () => {
  const kitDir = makeKitDir("resolve-vendored");
  try {
    writeKitManifest(kitDir, [
      `schema_version = 1`,
      `prompt_files = []`,
      `script_files = []`,
      ``,
      `[dependencies]`,
      `strategy = "vendored"`,
    ].join("\n"));
    const deps = resolveKitDependencies(kitDir);
    assert.equal(deps.strategy, "vendored");
    assert.equal(deps.ignoreScripts, false);
  } finally {
    fs.rmSync(kitDir, { recursive: true, force: true });
  }
});

test("parseResourcesManifest throws when dependencies.ignore_scripts is not a boolean", () => {
  const content = [
    `schema_version = 1`,
    `prompt_files = []`,
    `script_files = []`,
    ``,
    `[dependencies]`,
    `strategy = "package-json"`,
    `ignore_scripts = "yes"`,
  ].join("\n");
  assert.throws(() => parseResourcesManifest(content), /dependencies\.ignore_scripts/);
});
