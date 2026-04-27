const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const TOML = require("@iarna/toml");

const fabricRoot = path.join(__dirname, "..");
const manifestPath = path.join(fabricRoot, "resources.toml");

function uniqueEntries(values = []) {
  return Array.from(new Set(values.map((entry) => String(entry))));
}

function parseArrayField(parsed, key, label) {
  if (!parsed[key]) {
    return [];
  }

  if (!Array.isArray(parsed[key])) {
    throw new Error(`Invalid resources manifest: ${label} must be an array`);
  }

  return parsed[key].map((entry) => String(entry));
}

const ALLOWED_DEPENDENCY_STRATEGIES = ["none", "package-json", "vendored"];
const ALLOWED_DEPENDENCY_PACKAGE_MANAGERS = ["auto", "npm", "pnpm", "yarn", "bun"];

function parseDependenciesTable(parsed) {
  if (!Object.prototype.hasOwnProperty.call(parsed, "dependencies")) {
    return null;
  }
  const table = parsed.dependencies;
  if (!table || typeof table !== "object" || Array.isArray(table)) {
    throw new Error("Invalid resources manifest: [dependencies] must be a table");
  }
  if (!Object.prototype.hasOwnProperty.call(table, "strategy")) {
    throw new Error("Invalid resources manifest: dependencies.strategy is required");
  }
  if (typeof table.strategy !== "string" || !ALLOWED_DEPENDENCY_STRATEGIES.includes(table.strategy)) {
    throw new Error(`Invalid resources manifest: dependencies.strategy must be one of ${ALLOWED_DEPENDENCY_STRATEGIES.join(", ")} (got ${JSON.stringify(table.strategy)})`);
  }
  let packageManager = "auto";
  if (Object.prototype.hasOwnProperty.call(table, "package_manager")) {
    if (typeof table.package_manager !== "string" || !ALLOWED_DEPENDENCY_PACKAGE_MANAGERS.includes(table.package_manager)) {
      throw new Error(`Invalid resources manifest: dependencies.package_manager must be one of ${ALLOWED_DEPENDENCY_PACKAGE_MANAGERS.join(", ")} (got ${JSON.stringify(table.package_manager)})`);
    }
    packageManager = table.package_manager;
  }
  let ignoreScripts = false;
  if (Object.prototype.hasOwnProperty.call(table, "ignore_scripts")) {
    if (typeof table.ignore_scripts !== "boolean") {
      throw new Error(`Invalid resources manifest: dependencies.ignore_scripts must be a boolean (got ${JSON.stringify(table.ignore_scripts)})`);
    }
    ignoreScripts = table.ignore_scripts;
  }
  return {
    strategy: table.strategy,
    packageManager,
    ignoreScripts,
  };
}

function parseResourcesManifest(content) {
  const parsed = TOML.parse(content);

  return {
    promptFiles: parseArrayField(parsed, "prompt_files", "prompt_files"),
    scriptFiles: parseArrayField(parsed, "script_files", "script_files"),
    apiFiles: parseArrayField(parsed, "api_files", "api_files"),
    dependencies: parseDependenciesTable(parsed),
  };
}

function buildResourcesManifestContent(resources = {}) {
  return TOML.stringify({
    schema_version: 1,
    prompt_files: uniqueEntries(resources.promptFiles),
    script_files: uniqueEntries(resources.scriptFiles),
    api_files: uniqueEntries(resources.apiFiles),
  });
}

function getFabricHomeDirectory(options = {}) {
  return options.homeDir || process.env.FABRIC_HOME || os.homedir();
}

function getGlobalResourcesManifestPath(options = {}) {
  return path.join(getFabricHomeDirectory(options), ".fabric", "resources.toml");
}

function getLocalResourcesManifestPath(options = {}) {
  return path.join(options.cwd || process.cwd(), ".fabric", "resources.toml");
}

function getLegacyManifestPaths(options = {}, scope = "global") {
  if (scope === "local") {
    const cwd = options.cwd || process.cwd();

    return {
      prompts: path.join(cwd, ".fabric", "prompts.toml"),
      scripts: path.join(cwd, ".fabric", "scripts.toml"),
    };
  }

  const homeDir = getFabricHomeDirectory(options);

  return {
    prompts: path.join(homeDir, ".fabric", "prompts.toml"),
    scripts: path.join(homeDir, ".fabric", "scripts.toml"),
  };
}

function readResourcesManifestFile(targetManifestPath) {
  if (!fs.existsSync(targetManifestPath)) {
    return {
      promptFiles: [],
      scriptFiles: [],
      apiFiles: [],
    };
  }

  return parseResourcesManifest(fs.readFileSync(targetManifestPath, "utf8"));
}

function readLegacyResources(options = {}, scope = "global") {
  const legacyPaths = getLegacyManifestPaths(options, scope);
  const promptExists = fs.existsSync(legacyPaths.prompts);
  const scriptExists = fs.existsSync(legacyPaths.scripts);

  const promptFiles = promptExists
    ? parseResourcesManifest(fs.readFileSync(legacyPaths.prompts, "utf8")).promptFiles
    : [];
  const scriptFiles = scriptExists
    ? parseResourcesManifest(fs.readFileSync(legacyPaths.scripts, "utf8")).scriptFiles
    : [];

  return {
    promptExists,
    scriptExists,
    promptFiles,
    scriptFiles,
  };
}

function resolveApiPatternsFromManifest(targetManifestPath) {
  const manifestContent = readResourcesManifestFile(targetManifestPath);
  return uniqueEntries(manifestContent.apiFiles);
}

function resolveResourcePatternsFromManifest(targetManifestPath = manifestPath) {
  const resources = readResourcesManifestFile(targetManifestPath);
  const manifestDirectory = path.dirname(targetManifestPath);

  return {
    promptFiles: resources.promptFiles.map((pattern) => (path.isAbsolute(pattern) ? pattern : path.join(manifestDirectory, pattern))),
    scriptFiles: resources.scriptFiles.map((pattern) => (path.isAbsolute(pattern) ? pattern : path.join(manifestDirectory, pattern))),
  };
}

function ensureResourcesManifest(targetManifestPath, resources = {}) {
  const targetDirectory = path.dirname(targetManifestPath);
  fs.mkdirSync(targetDirectory, { recursive: true });

  if (!fs.existsSync(targetManifestPath)) {
    fs.writeFileSync(targetManifestPath, buildResourcesManifestContent(resources), "utf8");
    return targetManifestPath;
  }

  const existing = readResourcesManifestFile(targetManifestPath);
  const merged = {
    promptFiles: uniqueEntries([...existing.promptFiles, ...(resources.promptFiles || [])]),
    scriptFiles: uniqueEntries([...existing.scriptFiles, ...(resources.scriptFiles || [])]),
    apiFiles: uniqueEntries([...(existing.apiFiles || []), ...(resources.apiFiles || [])]),
  };

  if (
    merged.promptFiles.length !== existing.promptFiles.length
    || merged.scriptFiles.length !== existing.scriptFiles.length
    || merged.apiFiles.length !== (existing.apiFiles || []).length
  ) {
    fs.writeFileSync(targetManifestPath, buildResourcesManifestContent(merged), "utf8");
  }

  return targetManifestPath;
}

function selectBootstrapResources(options = {}, scope = "global") {
  const fallbackResources = resolveResourcePatternsFromManifest(manifestPath);
  const legacyResources = readLegacyResources(options, scope);

  return {
    promptFiles: legacyResources.promptExists ? legacyResources.promptFiles : fallbackResources.promptFiles,
    scriptFiles: legacyResources.scriptExists ? legacyResources.scriptFiles : fallbackResources.scriptFiles,
  };
}

function ensureGlobalResourceRegistry(options = {}) {
  const globalManifestPath = getGlobalResourcesManifestPath(options);

  if (fs.existsSync(globalManifestPath)) {
    return globalManifestPath;
  }

  return ensureResourcesManifest(globalManifestPath, selectBootstrapResources(options, "global"));
}

function ensureLocalResourceRegistryFromLegacy(options = {}) {
  const localManifestPath = getLocalResourcesManifestPath(options);

  if (fs.existsSync(localManifestPath)) {
    return localManifestPath;
  }

  const legacyResources = readLegacyResources(options, "local");

  if (!legacyResources.promptExists && !legacyResources.scriptExists) {
    return null;
  }

  return ensureResourcesManifest(localManifestPath, {
    promptFiles: legacyResources.promptFiles,
    scriptFiles: legacyResources.scriptFiles,
  });
}

function resolveActiveManifestPaths(options = {}) {
  const manifestPaths = [ensureGlobalResourceRegistry(options)];

  if (options.includeLocal === false) {
    return manifestPaths;
  }

  const localManifestPath = ensureLocalResourceRegistryFromLegacy(options) || getLocalResourcesManifestPath(options);

  if (fs.existsSync(localManifestPath)) {
    manifestPaths.push(localManifestPath);
  }

  return manifestPaths;
}

function getActiveManifestPathsReadOnly(options = {}) {
  const manifestPaths = [];
  const globalPath = getGlobalResourcesManifestPath(options);
  if (fs.existsSync(globalPath)) {
    manifestPaths.push(globalPath);
  }
  if (options.includeLocal === false) {
    return manifestPaths;
  }
  const localPath = getLocalResourcesManifestPath(options);
  if (fs.existsSync(localPath)) {
    manifestPaths.push(localPath);
  }
  return manifestPaths;
}

module.exports = {
  buildResourcesManifestContent,
  ensureGlobalResourceRegistry,
  ensureLocalResourceRegistryFromLegacy,
  ensureResourcesManifest,
  getActiveManifestPathsReadOnly,
  getFabricHomeDirectory,
  getGlobalResourcesManifestPath,
  getLocalResourcesManifestPath,
  manifestPath,
  parseResourcesManifest,
  readResourcesManifestFile,
  resolveActiveManifestPaths,
  resolveApiPatternsFromManifest,
  resolveResourcePatternsFromManifest,
};
