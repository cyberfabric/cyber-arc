const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getLocalPromptsManifestPath, listActivePromptMetadata, listPromptMetadata } = require("./prompts");

function getGeneratedSkillName(prompt) {
  return `fabric-${prompt.name || prompt.id}`;
}

function toYamlDoubleQuotedString(value = "") {
  return JSON.stringify(String(value));
}

function slugifySkillDirectoryName(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "skill";
}

function isRegistrablePromptType(type) {
  return type === "skill" || type === "agent";
}

function buildEntryFrontmatter(prompt) {
  return [
    "---",
    `name: ${getGeneratedSkillName(prompt)}`,
    `description: ${toYamlDoubleQuotedString(prompt.description)}`,
    "---",
    "",
    `EXECUTE and FOLLOW \`fabric-poc prompt get ${prompt.id}\``,
    "",
  ].join("\n");
}

function buildSkillEntryContent(prompt) {
  return buildEntryFrontmatter(prompt);
}

function buildAgentEntryContent(prompt) {
  return buildEntryFrontmatter(prompt);
}

function resolveTargetDirectories(options = {}) {
  const hasOverride =
    options.claudeSkillsDir ||
    options.agentsSkillsDir ||
    options.claudeAgentsDir ||
    options.agentsAgentsDir;

  if (hasOverride) {
    return {
      claudeSkillsDir: options.claudeSkillsDir,
      agentsSkillsDir: options.agentsSkillsDir,
      claudeAgentsDir: options.claudeAgentsDir,
      agentsAgentsDir: options.agentsAgentsDir,
    };
  }

  if (options.local) {
    const cwd = options.cwd || process.cwd();

    return {
      claudeSkillsDir: path.join(cwd, ".claude", "skills"),
      agentsSkillsDir: path.join(cwd, ".agents", "skills"),
      claudeAgentsDir: path.join(cwd, ".claude", "agents"),
      agentsAgentsDir: path.join(cwd, ".agents", "agents"),
    };
  }

  const homeDir = options.homeDir || process.env.FABRIC_HOME || os.homedir();

  return {
    claudeSkillsDir: path.join(homeDir, ".claude", "skills"),
    agentsSkillsDir: path.join(homeDir, ".agents", "skills"),
    claudeAgentsDir: path.join(homeDir, ".claude", "agents"),
    agentsAgentsDir: path.join(homeDir, ".agents", "agents"),
  };
}

function validateDirectoryNames(prompts) {
  const seen = new Map();

  for (const prompt of prompts) {
    const directoryName = slugifySkillDirectoryName(getGeneratedSkillName(prompt));
    const existing = seen.get(directoryName);

    if (existing) {
      throw new Error(`Multiple prompts map to the same skill directory name: ${existing.id} and ${prompt.id} -> ${directoryName}`);
    }

    seen.set(directoryName, prompt);
  }
}

function registerPrompts(options = {}) {
  const promptMetadata = (
    options.manifestPath
      ? listPromptMetadata(options.manifestPath)
      : options.local && !options.includeGlobal
        ? listPromptMetadata(getLocalPromptsManifestPath({ cwd: options.cwd }))
        : listActivePromptMetadata({
          includeLocal: Boolean(options.local),
          cwd: options.cwd,
          homeDir: options.homeDir,
        })
  )
    .filter((prompt) => isRegistrablePromptType(prompt.type))
    .sort((left, right) => left.id.localeCompare(right.id));

  const skillPrompts = promptMetadata.filter((prompt) => prompt.type === "skill");
  const agentPrompts = promptMetadata.filter((prompt) => prompt.type === "agent");

  validateDirectoryNames(skillPrompts);
  validateDirectoryNames(agentPrompts);

  const {
    claudeSkillsDir,
    agentsSkillsDir,
    claudeAgentsDir,
    agentsAgentsDir,
  } = resolveTargetDirectories(options);
  const skillTargets = [claudeSkillsDir, agentsSkillsDir].filter(Boolean);
  const agentTargets = [claudeAgentsDir, agentsAgentsDir].filter(Boolean);

  for (const targetDir of skillTargets) {
    fs.mkdirSync(targetDir, { recursive: true });

    for (const prompt of skillPrompts) {
      const skillDir = path.join(targetDir, slugifySkillDirectoryName(getGeneratedSkillName(prompt)));
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), buildSkillEntryContent(prompt), "utf8");
    }
  }

  for (const targetDir of agentTargets) {
    fs.mkdirSync(targetDir, { recursive: true });

    for (const prompt of agentPrompts) {
      const agentFile = path.join(targetDir, `${slugifySkillDirectoryName(getGeneratedSkillName(prompt))}.md`);
      fs.writeFileSync(agentFile, buildAgentEntryContent(prompt), "utf8");
    }
  }

  return {
    prompts: promptMetadata,
    skills: skillPrompts,
    agents: agentPrompts,
    skillTargets,
    agentTargets,
    targets: [...skillTargets, ...agentTargets],
    generatedCount: skillPrompts.length * skillTargets.length + agentPrompts.length * agentTargets.length,
  };
}

module.exports = {
  buildAgentEntryContent,
  buildSkillEntryContent,
  getGeneratedSkillName,
  registerPrompts,
  resolveTargetDirectories,
  slugifySkillDirectoryName,
};
