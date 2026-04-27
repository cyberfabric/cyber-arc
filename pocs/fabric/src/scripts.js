const fs = require("node:fs");
const path = require("node:path");
const {
  ensureGlobalResourceRegistry,
  ensureResourcesManifest,
  getFabricHomeDirectory,
  getGlobalResourcesManifestPath,
  getLocalResourcesManifestPath,
  manifestPath,
  resolveActiveManifestPaths,
  resolveResourcePatternsFromManifest,
} = require("./resources");

let scriptCache;
let scriptCacheKey;

function getGlobalScriptsManifestPath(options = {}) {
  return getGlobalResourcesManifestPath(options);
}

function getLocalScriptsManifestPath(options = {}) {
  return getLocalResourcesManifestPath(options);
}

function resolveScriptPatternsFromManifest(targetManifestPath = manifestPath) {
  return resolveResourcePatternsFromManifest(targetManifestPath).scriptFiles;
}

function ensureScriptsManifest(targetManifestPath, scriptFiles = []) {
  return ensureResourcesManifest(targetManifestPath, { scriptFiles });
}

function ensureGlobalScriptRegistry(options = {}) {
  return ensureGlobalResourceRegistry(options);
}

function patternToRegExp(pattern) {
  return new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
      .replace(/\*/g, ".*")}$`
  );
}

function expandScriptPattern(rootDir, pattern) {
  const absolutePattern = path.isAbsolute(pattern) ? pattern : path.join(rootDir, pattern);

  if (!absolutePattern.includes("*")) {
    return fs.existsSync(absolutePattern) ? [absolutePattern] : [];
  }

  const directory = path.dirname(absolutePattern);
  const filenamePattern = path.basename(absolutePattern);
  const matcher = patternToRegExp(filenamePattern);

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && matcher.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function normalizeStringList(value) {
  if (value === undefined || value === null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => String(entry));
}

function normalizeScriptParameter(parameter, filePath, index) {
  if (typeof parameter === "string") {
    return {
      name: parameter,
      type: "string",
      required: false,
      variadic: false,
      description: "",
      defaultValue: undefined,
    };
  }

  if (!parameter || typeof parameter !== "object" || Array.isArray(parameter)) {
    throw new Error(`Script interface parameter must be a string or object at index ${index}: ${filePath}`);
  }

  if (!parameter.name) {
    throw new Error(`Script interface parameter is missing name at index ${index}: ${filePath}`);
  }

  return {
    name: String(parameter.name),
    type: parameter.type ? String(parameter.type) : "string",
    required: parameter.required === true,
    variadic: parameter.variadic === true,
    description: parameter.description ? String(parameter.description) : "",
    defaultValue: parameter.default === undefined ? undefined : String(parameter.default),
  };
}

function normalizeScriptExample(example, filePath, index) {
  if (typeof example === "string") {
    return {
      command: example,
      description: "",
    };
  }

  if (!example || typeof example !== "object" || Array.isArray(example)) {
    throw new Error(`Script interface example must be a string or object at index ${index}: ${filePath}`);
  }

  if (!example.command) {
    throw new Error(`Script interface example is missing command at index ${index}: ${filePath}`);
  }

  return {
    command: String(example.command),
    description: example.description ? String(example.description) : "",
  };
}

function normalizeScriptInterface(scriptInterface, filePath) {
  if (scriptInterface === undefined) {
    return {
      details: [],
      usage: [],
      parameters: [],
      returns: "",
      examples: [],
      notes: [],
    };
  }

  if (typeof scriptInterface === "string") {
    return {
      details: [scriptInterface],
      usage: [],
      parameters: [],
      returns: "",
      examples: [],
      notes: [],
    };
  }

  if (!scriptInterface || typeof scriptInterface !== "object" || Array.isArray(scriptInterface)) {
    throw new Error(`Script interface must be an object: ${filePath}`);
  }

  if (scriptInterface.parameters !== undefined && !Array.isArray(scriptInterface.parameters)) {
    throw new Error(`Script interface parameters must be an array: ${filePath}`);
  }

  if (scriptInterface.examples !== undefined && !Array.isArray(scriptInterface.examples)) {
    throw new Error(`Script interface examples must be an array: ${filePath}`);
  }

  return {
    details: normalizeStringList(scriptInterface.details),
    usage: normalizeStringList(scriptInterface.usage),
    parameters: (scriptInterface.parameters || []).map((parameter, index) => normalizeScriptParameter(parameter, filePath, index)),
    returns: scriptInterface.returns ? String(scriptInterface.returns) : "",
    examples: (scriptInterface.examples || []).map((example, index) => normalizeScriptExample(example, filePath, index)),
    notes: normalizeStringList(scriptInterface.notes),
  };
}

function normalizeScriptModule(scriptModule, filePath) {
  const candidate = scriptModule && typeof scriptModule === "object" && scriptModule.default
    ? scriptModule.default
    : scriptModule;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`Script module must export an object: ${filePath}`);
  }

  if (!candidate.id) {
    throw new Error(`Script module is missing id: ${filePath}`);
  }

  if (typeof candidate.run !== "function") {
    throw new Error(`Script module is missing run function: ${filePath}`);
  }

  return {
    id: String(candidate.id),
    name: candidate.name ? String(candidate.name) : String(candidate.id),
    description: candidate.description ? String(candidate.description) : "",
    interface: normalizeScriptInterface(candidate.interface, filePath),
    run: candidate.run,
    filePath,
  };
}

function loadScriptDefinition(scriptFile) {
  const resolvedPath = require.resolve(scriptFile);
  delete require.cache[resolvedPath];
  return normalizeScriptModule(require(resolvedPath), scriptFile);
}

function loadScriptDefinitionsFromManifests(targetManifestPaths) {
  const scriptFiles = [];
  const seenScriptFiles = new Set();

  for (const targetManifestPath of targetManifestPaths) {
    const patterns = resolveScriptPatternsFromManifest(targetManifestPath);

    for (const scriptFile of patterns.flatMap((pattern) => expandScriptPattern(path.dirname(targetManifestPath), pattern))) {
      if (seenScriptFiles.has(scriptFile)) {
        continue;
      }

      seenScriptFiles.add(scriptFile);
      scriptFiles.push(scriptFile);
    }
  }

  const scriptDefinitionsById = new Map();

  for (const scriptFile of scriptFiles) {
    const definition = loadScriptDefinition(scriptFile);
    scriptDefinitionsById.set(definition.id, definition);
  }

  return scriptDefinitionsById;
}

function listScriptMetadata(targetManifestPath = manifestPath) {
  return Array.from(loadScriptDefinitionsFromManifests([targetManifestPath]).values()).map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    filePath: definition.filePath,
  }));
}

function listActiveScriptMetadata(options = {}) {
  return Array.from(loadScriptDefinitionsFromManifests(resolveActiveManifestPaths(options)).values()).map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    filePath: definition.filePath,
  }));
}

function loadActiveScripts(options = {}) {
  return loadScriptDefinitionsFromManifests(resolveActiveManifestPaths(options));
}

function loadScripts(options = {}) {
  const cacheKey = resolveActiveManifestPaths(options).join("|");

  if (scriptCache && scriptCacheKey === cacheKey) {
    return scriptCache;
  }

  scriptCache = loadActiveScripts(options);
  scriptCacheKey = cacheKey;

  return scriptCache;
}

function getScript(id, options = {}) {
  return loadScripts(options).get(id);
}

function formatScriptParameter(parameter) {
  const flags = [parameter.type, parameter.required ? "required" : "optional"];

  if (parameter.variadic) {
    flags.push("variadic");
  }

  if (parameter.defaultValue !== undefined) {
    flags.push(`default=${JSON.stringify(parameter.defaultValue)}`);
  }

  const summary = `  - ${parameter.name} (${flags.join(", ")})`;
  return parameter.description ? `${summary}: ${parameter.description}` : summary;
}

function getScriptHelp(id, options = {}) {
  const script = getScript(id, options);

  if (!script) {
    return undefined;
  }

  const usageLines = script.interface.usage.length > 0
    ? script.interface.usage
    : [`fabric script run ${script.id} [parameters...]`];
  const lines = [
    `ID: ${script.id}`,
    `Name: ${script.name}`,
    `Description: ${script.description || "No description provided."}`,
    `File: ${script.filePath}`,
    "",
    "Usage:",
    ...usageLines.map((line) => `  ${line}`),
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
  ];

  if (script.interface.details.length > 0) {
    lines.push("", "Details:", ...script.interface.details.map((entry) => `  ${entry}`));
  }

  lines.push("", "Parameters:");

  if (script.interface.parameters.length > 0) {
    lines.push(...script.interface.parameters.map(formatScriptParameter));
  } else {
    lines.push("  Positional CLI parameters after the script id are passed through as args.");
  }

  lines.push("", "Returns:");
  lines.push(`  ${script.interface.returns || "Any serializable value returned by run(args, context) is written to stdout."}`);

  if (script.interface.examples.length > 0) {
    lines.push("", "Examples:");

    for (const example of script.interface.examples) {
      lines.push(`  - ${example.command}`);

      if (example.description) {
        lines.push(`    ${example.description}`);
      }
    }
  }

  if (script.interface.notes.length > 0) {
    lines.push("", "Notes:", ...script.interface.notes.map((entry) => `  ${entry}`));
  }

  return lines.join("\n");
}

async function runScript(id, args = [], options = {}) {
  const script = getScript(id, options);

  if (!script) {
    return undefined;
  }

  const cwd = options.cwd || process.cwd();
  const fabricHome = getFabricHomeDirectory(options);
  const result = await script.run(args, {
    id: script.id,
    name: script.name,
    description: script.description,
    args,
    cwd,
    env: process.env,
    fabricHome,
    homeDir: fabricHome,
    scriptPath: script.filePath,
  });

  return {
    script,
    result,
  };
}

module.exports = {
  ensureGlobalScriptRegistry,
  ensureScriptsManifest,
  getGlobalScriptsManifestPath,
  getLocalScriptsManifestPath,
  getScriptHelp,
  getScript,
  listScriptMetadata,
  listActiveScriptMetadata,
  loadScripts,
  resolveScriptPatternsFromManifest,
  runScript,
};
