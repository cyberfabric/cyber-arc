const fs = require("node:fs");
const path = require("node:path");
const {
  getActiveManifestPathsReadOnly,
  resolveResourcePatternsFromManifest,
} = require("@cyberfabric/fabric");

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function getTrustedScriptDir() {
  return path.resolve(__dirname);
}

function parseArgs(args) {
  let dirPath;
  const flags = { allowUnsafeRequire: false };
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (current === "--type") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("prompt-audit: --type requires a value (prompt|script|both)");
      }
      if (!["prompt", "script", "both"].includes(value)) {
        throw new Error(`prompt-audit: --type must be prompt, script, or both (got ${value})`);
      }
      flags.type = value;
      i += 1;
    } else if (current === "--allow-unsafe-require") {
      flags.allowUnsafeRequire = true;
    } else if (current.startsWith("--")) {
      throw new Error(`prompt-audit: unexpected flag ${current}`);
    } else if (dirPath === undefined) {
      dirPath = current;
    } else {
      throw new Error(`prompt-audit: unexpected extra argument ${current}`);
    }
  }
  if (!dirPath) throw new Error("prompt-audit: directory path is required");
  return { dirPath, type: flags.type || "both", allowUnsafeRequire: flags.allowUnsafeRequire };
}

function isTrustedScriptPath(scriptPath) {
  const trustedDir = getTrustedScriptDir();
  const resolved = path.resolve(scriptPath);
  return resolved === trustedDir || resolved.startsWith(trustedDir + path.sep);
}

function globBasenameToRegExp(pattern) {
  return new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
      .replace(/\*/g, "[^/]*")}$`
  );
}

function enumerateManifestFiles(manifestPath, patternsKey) {
  const patterns = resolveResourcePatternsFromManifest(manifestPath)[patternsKey] || [];
  const results = [];
  for (const pattern of patterns) {
    const absolutePattern = path.isAbsolute(pattern) ? pattern : path.join(path.dirname(manifestPath), pattern);
    if (!absolutePattern.includes("*")) {
      if (fs.existsSync(absolutePattern)) results.push(absolutePattern);
      continue;
    }
    const directory = path.dirname(absolutePattern);
    const filenameRegExp = globBasenameToRegExp(path.basename(absolutePattern));
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory)) {
      if (filenameRegExp.test(entry)) results.push(path.join(directory, entry));
    }
  }
  return results.sort();
}

function extractScriptId(source) {
  const assignRegex = /^module\.exports\s*=\s*\{/m;
  const match = assignRegex.exec(source);
  if (!match) return null;
  const slice = source.slice(match.index + match[0].length);
  const idMatch = slice.match(/\bid\s*:\s*["']([^"']+)["']/);
  return idMatch ? idMatch[1] : null;
}

function loadRegisteredScript(id, context, cache, options) {
  if (cache.has(id)) return cache.get(id);
  const allowUnsafeRequire = options && options.allowUnsafeRequire === true;
  const manifestPaths = getActiveManifestPathsReadOnly({ cwd: context.cwd, homeDir: context.homeDir });
  for (const manifestPath of manifestPaths) {
    for (const f of enumerateManifestFiles(manifestPath, "scriptFiles")) {
      let source;
      try {
        source = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }
      if (extractScriptId(source) !== id) continue;
      if (!allowUnsafeRequire && !isTrustedScriptPath(f)) {
        throw new Error(
          `prompt-audit: registered "${id}" at ${f} is outside the trusted script directory (${getTrustedScriptDir()}); `
          + `default-safe mode refuses to require a registry entry that could shadow the canonical linter. `
          + `Pass --allow-unsafe-require to load it anyway.`
        );
      }
      const mod = require(f);
      cache.set(id, mod);
      return mod;
    }
  }
  throw new Error(`prompt-audit: registered script not found: ${id}`);
}

function classifyInput(dirPath) {
  const manifest = path.join(dirPath, "resources.toml");
  if (fs.existsSync(manifest)) return { kind: "kit", manifestPath: manifest };
  const base = path.basename(dirPath);
  if (base === "prompts") return { kind: "prompts-dir" };
  if (base === "scripts") return { kind: "scripts-dir" };
  const entries = fs.readdirSync(dirPath);
  if (entries.some((e) => e.endsWith(".md"))) return { kind: "prompts-dir" };
  if (entries.some((e) => e.endsWith(".js"))) return { kind: "scripts-dir" };
  throw new Error(`prompt-audit: directory ${dirPath} does not look like a kit, prompts/, or scripts/ directory`);
}

function enumeratePhysicalFiles(dir, extension) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs.readdirSync(dir)
    .filter((e) => e.endsWith(extension))
    .map((e) => path.join(dir, e))
    .sort();
}

function detectManifestCoverageGaps(kitPath, manifestPath, coveredPrompts, coveredScripts, typeFilter) {
  const manifestSource = fs.readFileSync(manifestPath, "utf8");
  const hasPromptFilesKey = /^\s*prompt_files\s*=/m.test(manifestSource);
  const hasScriptFilesKey = /^\s*script_files\s*=/m.test(manifestSource);
  const gaps = [];

  if (typeFilter !== "script") {
    const physicalPrompts = enumeratePhysicalFiles(path.join(kitPath, "prompts"), ".md");
    const coveredSet = new Set(coveredPrompts.map((p) => path.resolve(p)));
    if (physicalPrompts.length > 0 && !hasPromptFilesKey) {
      gaps.push({
        severity: "HIGH",
        where: "kit.manifest.prompt_files",
        problem: `resources.toml declares no prompt_files key, but ${physicalPrompts.length} *.md file(s) exist under prompts/; add prompt_files = ["prompts/*.md"] or remove the files`,
      });
    }
    for (const p of physicalPrompts) {
      if (!coveredSet.has(path.resolve(p))) {
        gaps.push({
          severity: "HIGH",
          where: "kit.orphan.prompt",
          problem: `${p} exists on disk but is not covered by any prompt_files glob in ${manifestPath}; extend the manifest or remove the file`,
          orphanPath: p,
        });
      }
    }
  }

  if (typeFilter !== "prompt") {
    const physicalScripts = enumeratePhysicalFiles(path.join(kitPath, "scripts"), ".js");
    const coveredSet = new Set(coveredScripts.map((s) => path.resolve(s)));
    if (physicalScripts.length > 0 && !hasScriptFilesKey) {
      gaps.push({
        severity: "HIGH",
        where: "kit.manifest.script_files",
        problem: `resources.toml declares no script_files key, but ${physicalScripts.length} *.js file(s) exist under scripts/; add script_files = ["scripts/*.js"] or remove the files`,
      });
    }
    for (const s of physicalScripts) {
      if (!coveredSet.has(path.resolve(s))) {
        gaps.push({
          severity: "HIGH",
          where: "kit.orphan.script",
          problem: `${s} exists on disk but is not covered by any script_files glob in ${manifestPath}; extend the manifest or remove the file`,
          orphanPath: s,
        });
      }
    }
  }

  return gaps;
}

function enumerateInputFiles(dirPath, classification, typeFilter) {
  const out = { prompts: [], scripts: [], gaps: [] };
  if (classification.kind === "kit") {
    if (typeFilter !== "script") out.prompts = enumerateManifestFiles(classification.manifestPath, "promptFiles");
    if (typeFilter !== "prompt") out.scripts = enumerateManifestFiles(classification.manifestPath, "scriptFiles");
    out.gaps = detectManifestCoverageGaps(dirPath, classification.manifestPath, out.prompts, out.scripts, typeFilter);
    return out;
  }
  const entries = fs.readdirSync(dirPath).sort();
  if (classification.kind === "prompts-dir" && typeFilter !== "script") {
    out.prompts = entries.filter((e) => e.endsWith(".md")).map((e) => path.join(dirPath, e));
  }
  if (classification.kind === "scripts-dir" && typeFilter !== "prompt") {
    out.scripts = entries.filter((e) => e.endsWith(".js")).map((e) => path.join(dirPath, e));
  }
  return out;
}

function safeRunScript(mod, args, context) {
  try {
    const raw = mod.run(args, context);
    return { ok: true, result: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function buildFileFinding(kind, filePath, scripts, context, coverageType, lintLabel) {
  const lintResult = safeRunScript(scripts[kind === "prompt" ? "promptLint" : "scriptLint"], [filePath], context);
  const coverageResult = safeRunScript(scripts.registerDryrun, [filePath, "--type", coverageType], context);

  const findings = lintResult.ok
    ? [...lintResult.result.findings]
    : [{ severity: "CRITICAL", where: lintLabel, problem: `${lintLabel} failed to run: ${lintResult.error}` }];

  let coverage;
  if (coverageResult.ok) {
    coverage = { covered: coverageResult.result.covered, matches: coverageResult.result.matches };
    if (coverage.covered === false) {
      findings.push({
        severity: "HIGH",
        where: "coverage",
        problem: `file is not covered by any active ${coverageType}_files glob; extend the manifest or move the file before registering`,
      });
    }
  } else {
    coverage = { covered: null, error: coverageResult.error };
    findings.push({
      severity: "HIGH",
      where: "coverage.error",
      problem: `prompt-register-dryrun failed: ${coverageResult.error}`,
    });
  }

  return { path: filePath, type: kind, lint: findings, coverage };
}

function auditPromptFile(filePath, scripts, context) {
  return buildFileFinding("prompt", filePath, scripts, context, "prompt", "prompt-lint");
}

function auditScriptFile(filePath, scripts, context) {
  return buildFileFinding("script", filePath, scripts, context, "script", "script-lint");
}

function summarize(files, kitGaps) {
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  const uncovered = [];
  let filesWithFindings = 0;
  let totalFindings = 0;
  for (const f of files) {
    if (f.lint.length > 0) filesWithFindings += 1;
    totalFindings += f.lint.length;
    for (const finding of f.lint) {
      if (bySeverity[finding.severity] !== undefined) bySeverity[finding.severity] += 1;
    }
    if (f.coverage && f.coverage.covered === false) uncovered.push(f.path);
  }
  for (const gap of kitGaps || []) {
    if (bySeverity[gap.severity] !== undefined) bySeverity[gap.severity] += 1;
    totalFindings += 1;
  }
  return {
    totalFiles: files.length,
    filesWithFindings,
    totalFindings,
    bySeverity,
    uncovered,
    kitGapFindings: (kitGaps || []).length,
  };
}

function audit(dirPath, typeFilter, context, loaderOptions) {
  const classification = classifyInput(dirPath);
  const inputs = enumerateInputFiles(dirPath, classification, typeFilter);

  const scriptCache = new Map();
  const scripts = {
    promptLint: inputs.prompts.length > 0 ? loadRegisteredScript("prompt-lint", context, scriptCache, loaderOptions) : null,
    scriptLint: inputs.scripts.length > 0 ? loadRegisteredScript("script-lint", context, scriptCache, loaderOptions) : null,
    registerDryrun: (inputs.prompts.length > 0 || inputs.scripts.length > 0) ? loadRegisteredScript("prompt-register-dryrun", context, scriptCache, loaderOptions) : null,
  };

  const files = [];
  for (const p of inputs.prompts) files.push(auditPromptFile(p, scripts, context));
  for (const s of inputs.scripts) files.push(auditScriptFile(s, scripts, context));

  return {
    directory: dirPath,
    classification: classification.kind,
    type: typeFilter,
    files,
    kitGaps: inputs.gaps || [],
    summary: summarize(files, inputs.gaps || []),
  };
}

module.exports = {
  id: "prompt-audit",
  name: "prompt audit",
  description: "Deterministically audit every prompt and script in a kit or directory by running prompt-lint / script-lint / prompt-register-dryrun on each file and aggregating findings",
  interface: {
    details: [
      "Accepts a kit directory (one containing resources.toml), a prompts/ directory, or a scripts/ directory. Enumerates the relevant files, runs the per-file fabric linters, collects coverage status, cross-checks the kit's physical prompts/ and scripts/ directories against manifest globs, and returns an aggregated report.",
      "Delegates the actual lint work to the registered prompt-lint, script-lint, and prompt-register-dryrun scripts; does not duplicate their logic. If one of those scripts is not registered in the active manifests, the audit fails loudly.",
      "For a kit, prompts and scripts are enumerated via the kit's resources.toml (authoritative). Physical files under prompts/ and scripts/ that are not covered by the declared globs, as well as missing prompt_files / script_files keys for directories that do contain files, surface as HIGH kit-level findings.",
      "Default-safe loader: a registered linter is accepted only when its file path lies under the same directory as prompt-audit.js itself, preventing a foreign registry entry from shadowing the canonical linter chain. Pass --allow-unsafe-require to bypass this check for audits of third-party kits you already trust.",
    ],
    usage: [
      "fabric-poc script run prompt-audit <path-to-dir> [--type prompt|script|both] [--allow-unsafe-require]",
    ],
    parameters: [
      { name: "dir", type: "string", required: true, description: "Absolute or cwd-relative path to a kit directory (contains resources.toml), a prompts/ directory, or a scripts/ directory." },
      { name: "--type", type: "string", required: false, description: "Restrict the audit to prompt files only, script files only, or both (default)." },
      { name: "--allow-unsafe-require", type: "boolean", required: false, description: "Bypass the default-safe loader and require() any registered prompt-lint / script-lint / prompt-register-dryrun regardless of file location. Use only for third-party kits whose linter chain you already trust." },
    ],
    returns: "JSON object with directory, classification (kit|prompts-dir|scripts-dir), type, files (per-file lint + coverage), kitGaps (manifest coverage gaps: missing keys, orphan files outside declared globs), and summary (totals, bySeverity, uncovered paths, kitGapFindings count).",
    examples: [
      {
        command: "fabric-poc script run prompt-audit pocs/fabric-kits/prompting",
        description: "Audit every prompt and script in the prompting kit.",
      },
      {
        command: "fabric-poc script run prompt-audit pocs/fabric-kits/prompting/prompts --type prompt",
        description: "Audit only the prompt markdown files in a prompts/ directory.",
      },
      {
        command: "fabric-poc script run prompt-audit ./vendor/some-kit --allow-unsafe-require",
        description: "Audit a third-party kit whose linter registrations you accept as trusted.",
      },
    ],
    notes: [
      "Default-safe mode refuses to require() a registered prompt-lint / script-lint / prompt-register-dryrun whose file is outside the directory that contains prompt-audit.js. This protects against a foreign registry entry hijacking the linter chain at audit time.",
      "When --allow-unsafe-require is set, the loader falls back to raw require() against whatever the active manifests register under those ids; any top-level side effects of the loaded modules will execute.",
      "Does not replace prompt-kit-lint: this audit sweeps per-file checks across a directory and flags kit-level coverage gaps, while prompt-kit-lint focuses on cross-file id collisions, orphan references, and router-mode symmetry.",
      "Pair with prompt-kit-lint for a complete deterministic review pass on a kit.",
    ],
  },
  run(args, context) {
    const { dirPath, type, allowUnsafeRequire } = parseArgs(args);
    const absoluteDir = path.isAbsolute(dirPath) ? dirPath : path.join(context.cwd, dirPath);
    if (!fs.existsSync(absoluteDir)) throw new Error(`prompt-audit: directory not found: ${absoluteDir}`);
    if (!fs.statSync(absoluteDir).isDirectory()) throw new Error(`prompt-audit: path is not a directory: ${absoluteDir}`);
    return JSON.stringify(audit(absoluteDir, type, context, { allowUnsafeRequire }), null, 2);
  },
};
