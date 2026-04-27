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
  return type === "skill";
}

function buildSkillEntryContent(prompt) {
  return [
    "---",
    `name: ${getGeneratedSkillName(prompt)}`,
    `description: ${toYamlDoubleQuotedString(prompt.description)}`,
    "---",
    "",
    `EXECUTE and FOLLOW \`fabric prompt get ${prompt.id}\``,
    "",
  ].join("\n");
}

function resolveTargetDirectories(options = {}) {
  if (options.claudeSkillsDir || options.agentsSkillsDir) {
    return {
      claudeSkillsDir: options.claudeSkillsDir,
      agentsSkillsDir: options.agentsSkillsDir,
    };
  }

  if (options.local) {
    const cwd = options.cwd || process.cwd();

    return {
      claudeSkillsDir: path.join(cwd, ".claude", "skills"),
      agentsSkillsDir: path.join(cwd, ".agents", "skills"),
    };
  }

  const homeDir = options.homeDir || process.env.FABRIC_HOME || os.homedir();

  return {
    claudeSkillsDir: path.join(homeDir, ".claude", "skills"),
    agentsSkillsDir: path.join(homeDir, ".agents", "skills"),
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

  validateDirectoryNames(promptMetadata);

  const { claudeSkillsDir, agentsSkillsDir } = resolveTargetDirectories(options);
  const targets = [claudeSkillsDir, agentsSkillsDir].filter(Boolean);

  for (const targetDir of targets) {
    fs.mkdirSync(targetDir, { recursive: true });

    for (const prompt of promptMetadata) {
      const skillDir = path.join(targetDir, slugifySkillDirectoryName(getGeneratedSkillName(prompt)));
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), buildSkillEntryContent(prompt), "utf8");
    }
  }

  return {
    prompts: promptMetadata,
    targets,
    generatedCount: promptMetadata.length * targets.length,
  };
}

module.exports = {
  buildSkillEntryContent,
  getGeneratedSkillName,
  registerPrompts,
  resolveTargetDirectories,
  slugifySkillDirectoryName,
};
