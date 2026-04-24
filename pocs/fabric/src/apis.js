const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const TOML = require("@iarna/toml");

const {
  ensureResourcesManifest,
  getGlobalResourcesManifestPath,
  getLocalResourcesManifestPath,
  readResourcesManifestFile,
  resolveApiPatternsFromManifest,
  resolveActiveManifestPaths,
} = require("./resources");

const { describeCredential, resolveAuth } = require("./auth");

const API_NAME_RE = /^[a-z][a-z0-9-]*$/;

function getFabricHomeDirectory(options = {}) {
  return options.homeDir || process.env.FABRIC_HOME || os.homedir();
}

function ensureGlobalApiRegistry(options = {}) {
  const manifestPath = getGlobalResourcesManifestPath(options);
  ensureResourcesManifest(manifestPath, {});
  return manifestPath;
}

function ensureApisManifest(manifestPath, apiPatterns) {
  const current = readResourcesManifestFile(manifestPath);
  const merged = Array.from(new Set([...(current.apiFiles || []), ...apiPatterns]));
  ensureResourcesManifest(manifestPath, {
    promptFiles: current.promptFiles || [],
    scriptFiles: current.scriptFiles || [],
    apiFiles: merged,
  });
}

// Glob expansion for api_files. Supports:
//   - literal path (no wildcard) — returns [path] if it exists, else []
//   - `<dir>/*.api.toml` — returns matching files in dir
//   - `<dir>/**/*.api.toml` — recursive
// Anything else returns [] (not supported by v1 kit conventions).
function expandGlob(pattern) {
  if (!pattern.includes("*")) {
    return fs.existsSync(pattern) ? [pattern] : [];
  }
  const recursiveMatch = pattern.match(/^(.+)\/\*\*\/\*\.api\.toml$/);
  if (recursiveMatch) {
    const root = recursiveMatch[1];
    return walkRecursive(root).filter((p) => p.endsWith(".api.toml"));
  }
  const simpleMatch = pattern.match(/^(.+)\/\*\.api\.toml$/);
  if (simpleMatch) {
    const dir = simpleMatch[1];
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith(".api.toml"))
      .map((name) => path.join(dir, name));
  }
  return [];
}

function walkRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkRecursive(full));
    else out.push(full);
  }
  return out;
}

function resolveActiveApiFilePaths(options = {}) {
  const activePaths = resolveActiveManifestPaths(options);
  const patterns = new Set();
  for (const manifestPath of activePaths) {
    for (const pattern of resolveApiPatternsFromManifest(manifestPath)) {
      patterns.add(pattern);
    }
  }
  const files = new Set();
  for (const pattern of patterns) {
    for (const match of expandGlob(pattern)) {
      files.add(match);
    }
  }
  return Array.from(files).sort();
}

function parseApiFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = TOML.parse(raw);

  if (parsed.schema_version !== 1) {
    throw new Error(`${filePath}: expected schema_version = 1, got ${parsed.schema_version}`);
  }
  if (typeof parsed.name !== "string") {
    throw new Error(`${filePath}: missing "name"`);
  }
  if (!API_NAME_RE.test(parsed.name)) {
    throw new Error(`${filePath}: name "${parsed.name}" must match ${API_NAME_RE}`);
  }
  if (typeof parsed.description !== "string") {
    throw new Error(`${filePath}: missing "description"`);
  }
  if (typeof parsed.base_url !== "string") {
    throw new Error(`${filePath}: missing "base_url"`);
  }
  if (!/^https?:\/\//.test(parsed.base_url)) {
    throw new Error(`${filePath}: base_url must start with http:// or https://`);
  }

  const defaultHeaders = parsed.default_headers && typeof parsed.default_headers === "object"
    ? { ...parsed.default_headers }
    : {};

  return {
    filePath,
    source: raw,
    name: parsed.name,
    description: parsed.description,
    baseUrl: parsed.base_url.replace(/\/+$/, ""),
    authRef: typeof parsed.auth_ref === "string" ? parsed.auth_ref : undefined,
    defaultHeaders,
  };
}

function buildApiRegistry(options = {}) {
  const files = resolveActiveApiFilePaths(options);
  const byName = new Map();
  for (const filePath of files) {
    const definition = parseApiFile(filePath);
    const existing = byName.get(definition.name);
    if (existing) {
      throw new Error(
        `Duplicate API definition "${definition.name}" from ${filePath} (conflicts with ${existing.filePath})`,
      );
    }
    byName.set(definition.name, definition);
  }
  return byName;
}

function listActiveApiMetadata(options = {}) {
  const registry = buildApiRegistry(options);
  return Array.from(registry.values()).map((def) => ({
    name: def.name,
    description: def.description,
    baseUrl: def.baseUrl,
    authRef: def.authRef,
  }));
}

function getApiDefinition(name, options = {}) {
  const registry = buildApiRegistry(options);
  return registry.get(name);
}

/**
 * Extract author-written help content between `<!-- help -->` and `<!-- /help -->`
 * markers in an api-definition source. Strips a leading `# ` or `#` from each
 * captured line so authors can embed help in TOML comments without breaking TOML
 * parsing (since the help block lives inside the `.api.toml` file itself).
 */
function extractHelpSection(body) {
  if (!body) return "";
  const match = body.match(/<!--\s*help\s*-->([\s\S]*?)<!--\s*\/help\s*-->/i);
  if (!match) return "";
  const stripped = match[1]
    .split("\n")
    .map((line) => line.replace(/^#\s?/, ""))
    .join("\n");
  return stripped.trim();
}

function getApiHelp(name, options = {}) {
  const def = getApiDefinition(name, options);
  if (!def) return undefined;

  const authored = extractHelpSection(def.source);
  if (authored) return authored;

  const authDesc = def.authRef ? describeCredential(def.authRef, options) : undefined;
  const authLine = def.authRef
    ? `Auth: ${def.authRef} (${authDesc ? authDesc.type : "missing"})`
    : "Auth: (none)";

  const headerLines = Object.entries(def.defaultHeaders).map(([k, v]) => `  ${k}: ${v}`);

  const lines = [
    `Name: ${def.name}`,
    `Description: ${def.description}`,
    `Base URL: ${def.baseUrl}`,
    authLine,
  ];
  if (headerLines.length > 0) {
    lines.push("Default headers:", ...headerLines);
  }
  lines.push("", "(no <!-- help --> section in api file)");
  return lines.join("\n");
}

module.exports = {
  ensureGlobalApiRegistry,
  ensureApisManifest,
  resolveActiveApiFilePaths,
  buildApiRegistry,
  getApiDefinition,
  getApiHelp,
  listActiveApiMetadata,
  parseApiFile,
};
