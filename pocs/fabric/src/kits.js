const fs = require("node:fs");
const path = require("node:path");
const {
  ensureGlobalPromptRegistry,
  ensurePromptsManifest,
  getGlobalPromptsManifestPath,
  getLocalPromptsManifestPath,
  resolvePromptPatternsFromManifest,
} = require("./prompts");
const {
  ensureGlobalScriptRegistry,
  ensureScriptsManifest,
  getGlobalScriptsManifestPath,
  getLocalScriptsManifestPath,
  resolveScriptPatternsFromManifest,
} = require("./scripts");
const { ensureApisManifest } = require("./apis");
const {
  resolveApiPatternsFromManifest,
  getGlobalResourcesManifestPath,
} = require("./resources");
const { registerPrompts } = require("./register");

function resolveKitRoot(targetPath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const absoluteKitPath = path.resolve(cwd, targetPath);
  const manifestPath = path.join(absoluteKitPath, "resources.toml");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Kit resources.toml not found: ${absoluteKitPath}`);
  }

  return {
    absoluteKitPath,
    manifestPath,
  };
}

function registerKitFolder(targetPath, options = {}) {
  const { absoluteKitPath, manifestPath } = resolveKitRoot(targetPath, options);
  const promptPatterns = resolvePromptPatternsFromManifest(manifestPath);
  const scriptPatterns = resolveScriptPatternsFromManifest(manifestPath);
  const apiPatterns = resolveApiPatternsFromManifest(manifestPath);

  if (!promptPatterns.length && !scriptPatterns.length && !apiPatterns.length) {
    throw new Error(`Kit resources.toml has no prompt_files, script_files, or api_files: ${manifestPath}`);
  }

  const registryManifestPath = options.local
    ? getLocalPromptsManifestPath({ cwd: options.cwd })
    : ensureGlobalPromptRegistry({ homeDir: options.homeDir });

  if (options.local) {
    ensurePromptsManifest(registryManifestPath, promptPatterns);
    ensureScriptsManifest(registryManifestPath, scriptPatterns);
    ensureApisManifest(registryManifestPath, apiPatterns);
  } else {
    ensurePromptsManifest(getGlobalPromptsManifestPath({ homeDir: options.homeDir }), promptPatterns);
    ensureScriptsManifest(getGlobalScriptsManifestPath({ homeDir: options.homeDir }), scriptPatterns);
    ensureApisManifest(getGlobalResourcesManifestPath({ homeDir: options.homeDir }), apiPatterns);
  }

  const registration = promptPatterns.length
    ? registerPrompts({
      local: options.local,
      includeGlobal: options.includeGlobal,
      cwd: options.cwd,
      homeDir: options.homeDir,
    })
    : { prompts: [], targets: [], generatedCount: 0 };

  return {
    absoluteKitPath,
    manifestPath,
    promptPatterns,
    scriptPatterns,
    apiPatterns,
    registryManifestPath,
    registration,
  };
}

module.exports = {
  registerKitFolder,
  resolveKitRoot,
};
