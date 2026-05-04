const fs = require("node:fs");
const path = require("node:path");
const {
  getActiveManifestPathsReadOnly,
  resolveResourcePatternsFromManifest,
} = require("@cyberfabric/fabric");

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER_CSV_FIELDS = ["target_prompts", "target_types"];
const PROMPT_GET_REF = /fabric\s+prompt\s+get\s+([a-z0-9][a-z0-9-]*)/g;
const SCRIPT_RUN_REF = /fabric\s+script\s+run\s+([a-z0-9][a-z0-9-]*)/g;

function parseArgs(args) {
  let kitPath;
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (current.startsWith("--")) {
      throw new Error(`prompt-kit-lint: unexpected flag ${current}`);
    }
    if (kitPath !== undefined) {
      throw new Error(`prompt-kit-lint: unexpected extra argument ${current}`);
    }
    kitPath = current;
  }
  if (!kitPath) throw new Error("prompt-kit-lint: kit directory path is required");
  return { kitPath };
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

function splitFrontmatter(content) {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return null;
  const lines = content.split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  return {
    raw: lines.slice(1, end).join("\n"),
    body: lines.slice(end + 1).join("\n"),
  };
}

function parseFrontmatter(raw) {
  const fields = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  for (const field of FRONTMATTER_CSV_FIELDS) {
    if (fields[field] !== undefined) {
      fields[field] = fields[field]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return fields;
}

function readPromptMeta(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const fm = splitFrontmatter(content);
  if (!fm) return { path: filePath, id: null, type: null, target_prompts: [], body: content, frontmatterValid: false };
  const fields = parseFrontmatter(fm.raw);
  return {
    path: filePath,
    id: fields.id || null,
    type: fields.type || null,
    target_prompts: fields.target_prompts || [],
    body: fm.body,
    frontmatterValid: true,
  };
}

function extractScriptId(source) {
  const assignRegex = /^module\.exports\s*=\s*\{/m;
  const match = assignRegex.exec(source);
  if (!match) return null;
  const slice = source.slice(match.index + match[0].length);
  const idMatch = slice.match(/\bid\s*:\s*["']([^"']+)["']/);
  return idMatch ? idMatch[1] : null;
}

function readScriptMeta(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return { path: filePath, id: extractScriptId(source) };
}

function enumeratePhysicalFiles(dir, extension) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs.readdirSync(dir)
    .filter((e) => e.endsWith(extension))
    .map((e) => path.join(dir, e))
    .sort();
}

function detectManifestCoverageGaps(kitPath, manifestPath, coveredPrompts, coveredScripts) {
  const manifestSource = fs.readFileSync(manifestPath, "utf8");
  const hasPromptFilesKey = /^\s*prompt_files\s*=/m.test(manifestSource);
  const hasScriptFilesKey = /^\s*script_files\s*=/m.test(manifestSource);
  const gaps = [];

  const physicalPrompts = enumeratePhysicalFiles(path.join(kitPath, "prompts"), ".md");
  const coveredPromptSet = new Set(coveredPrompts.map((p) => path.resolve(p)));
  if (physicalPrompts.length > 0 && !hasPromptFilesKey) {
    gaps.push({
      severity: "HIGH",
      where: "kit.manifest.prompt_files",
      problem: `resources.toml declares no prompt_files key, but ${physicalPrompts.length} *.md file(s) exist under prompts/; add prompt_files = ["prompts/*.md"] or remove the files`,
    });
  }
  for (const p of physicalPrompts) {
    if (!coveredPromptSet.has(path.resolve(p))) {
      gaps.push({
        severity: "HIGH",
        where: "kit.orphan.prompt",
        problem: `${p} exists on disk but is not covered by any prompt_files glob in ${manifestPath}; extend the manifest or remove the file`,
      });
    }
  }

  const physicalScripts = enumeratePhysicalFiles(path.join(kitPath, "scripts"), ".js");
  const coveredScriptSet = new Set(coveredScripts.map((s) => path.resolve(s)));
  if (physicalScripts.length > 0 && !hasScriptFilesKey) {
    gaps.push({
      severity: "HIGH",
      where: "kit.manifest.script_files",
      problem: `resources.toml declares no script_files key, but ${physicalScripts.length} *.js file(s) exist under scripts/; add script_files = ["scripts/*.js"] or remove the files`,
    });
  }
  for (const s of physicalScripts) {
    if (!coveredScriptSet.has(path.resolve(s))) {
      gaps.push({
        severity: "HIGH",
        where: "kit.orphan.script",
        problem: `${s} exists on disk but is not covered by any script_files glob in ${manifestPath}; extend the manifest or remove the file`,
      });
    }
  }

  return gaps;
}

function collectKit(kitPath) {
  const manifestPath = path.join(kitPath, "resources.toml");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`prompt-kit-lint: no resources.toml at ${manifestPath}`);
  }
  const promptFiles = enumerateManifestFiles(manifestPath, "promptFiles");
  const scriptFiles = enumerateManifestFiles(manifestPath, "scriptFiles");
  const coverageGaps = detectManifestCoverageGaps(kitPath, manifestPath, promptFiles, scriptFiles);
  return {
    manifestPath,
    prompts: promptFiles.map(readPromptMeta),
    scripts: scriptFiles.map(readScriptMeta),
    coverageGaps,
  };
}

function collectRegistry(context) {
  const manifestPaths = getActiveManifestPathsReadOnly({ cwd: context.cwd, homeDir: context.homeDir });
  const prompts = new Map();
  const scripts = new Map();
  for (const manifestPath of manifestPaths) {
    for (const f of enumerateManifestFiles(manifestPath, "promptFiles")) {
      const meta = readPromptMeta(f);
      if (meta.id) {
        if (!prompts.has(meta.id)) prompts.set(meta.id, []);
        prompts.get(meta.id).push(f);
      }
    }
    for (const f of enumerateManifestFiles(manifestPath, "scriptFiles")) {
      const meta = readScriptMeta(f);
      if (meta.id) {
        if (!scripts.has(meta.id)) scripts.set(meta.id, []);
        scripts.get(meta.id).push(f);
      }
    }
  }
  return { manifestPaths, prompts, scripts };
}

function detectIntraKitCollisions(items, kind) {
  const seen = new Map();
  const findings = [];
  for (const item of items) {
    if (!item.id) continue;
    if (seen.has(item.id)) {
      findings.push({
        severity: "CRITICAL",
        where: `kit.${kind}s.${item.id}`,
        problem: `duplicate ${kind} id within kit: ${seen.get(item.id)} vs ${item.path}`,
      });
    } else {
      seen.set(item.id, item.path);
    }
  }
  return { seen, findings };
}

function detectRegistryCollisions(kitIds, registryMap, kind) {
  const findings = [];
  for (const [id, kitPath_] of kitIds) {
    const registryPaths = registryMap.get(id) || [];
    const foreign = registryPaths.filter((rp) => rp !== kitPath_);
    if (foreign.length > 0) {
      findings.push({
        severity: "HIGH",
        where: `${kind}.${id}`,
        problem: `kit ${kind} id "${id}" collides with active registry entry at ${foreign.join(", ")}`,
      });
    }
  }
  return findings;
}

function detectMiddlewareOrphans(kit, knownPromptIds) {
  const findings = [];
  for (const p of kit.prompts) {
    if (p.type !== "middleware") continue;
    for (const targetId of p.target_prompts) {
      if (!knownPromptIds.has(targetId)) {
        findings.push({
          severity: "HIGH",
          where: `${p.path}.frontmatter.target_prompts`,
          problem: `target_prompts references unknown prompt id: ${targetId}`,
        });
      }
    }
  }
  return findings;
}

function detectBodyReferenceOrphans(kit, knownPromptIds, knownScriptIds) {
  const findings = [];
  for (const p of kit.prompts) {
    const seenPromptRefs = new Set();
    const seenScriptRefs = new Set();
    let match;
    PROMPT_GET_REF.lastIndex = 0;
    while ((match = PROMPT_GET_REF.exec(p.body)) !== null) {
      const refId = match[1];
      if (seenPromptRefs.has(refId)) continue;
      seenPromptRefs.add(refId);
      if (!KEBAB_CASE.test(refId)) continue;
      if (!knownPromptIds.has(refId)) {
        findings.push({
          severity: "HIGH",
          where: `${p.path}.body`,
          problem: `body references "fabric-poc prompt get ${refId}" but no prompt with that id is known in the kit or active registry`,
        });
      }
    }
    SCRIPT_RUN_REF.lastIndex = 0;
    while ((match = SCRIPT_RUN_REF.exec(p.body)) !== null) {
      const refId = match[1];
      if (seenScriptRefs.has(refId)) continue;
      seenScriptRefs.add(refId);
      if (!KEBAB_CASE.test(refId)) continue;
      if (!knownScriptIds.has(refId)) {
        findings.push({
          severity: "HIGH",
          where: `${p.path}.body`,
          problem: `body references "fabric-poc script run ${refId}" but no script with that id is known in the kit or active registry`,
        });
      }
    }
  }
  return findings;
}

function lintKit(kitPath, context) {
  const kit = collectKit(kitPath);
  const registry = collectRegistry(context);
  const findings = [];

  findings.push(...kit.coverageGaps);

  const promptsDup = detectIntraKitCollisions(kit.prompts, "prompt");
  const scriptsDup = detectIntraKitCollisions(kit.scripts, "script");
  findings.push(...promptsDup.findings, ...scriptsDup.findings);

  findings.push(...detectRegistryCollisions(promptsDup.seen, registry.prompts, "prompt"));
  findings.push(...detectRegistryCollisions(scriptsDup.seen, registry.scripts, "script"));

  const knownPromptIds = new Set([...promptsDup.seen.keys(), ...registry.prompts.keys()]);
  const knownScriptIds = new Set([...scriptsDup.seen.keys(), ...registry.scripts.keys()]);

  findings.push(...detectMiddlewareOrphans(kit, knownPromptIds));
  findings.push(...detectBodyReferenceOrphans(kit, knownPromptIds, knownScriptIds));

  return {
    kit: kitPath,
    manifest: kit.manifestPath,
    registryManifests: registry.manifestPaths,
    prompts: kit.prompts.map((p) => ({ id: p.id, type: p.type, path: p.path })),
    scripts: kit.scripts.map((s) => ({ id: s.id, path: s.path })),
    findings,
  };
}

module.exports = {
  id: "prompt-kit-lint",
  name: "prompt kit lint",
  description: "Deterministically lint a fabric-poc prompt kit for cross-file defects the per-file linters cannot catch",
  interface: {
    details: [
      "Loads the kit's resources.toml, enumerates every prompt (prompts/*.md) and script (scripts/*.js) it declares, cross-references the active fabric registry (global + local manifests), and reports kit-level defects.",
      "Detects: duplicate prompt or script ids within the kit; id collisions with entries in the active registry under a different path; middleware target_prompts referencing unknown prompt ids; body references to 'fabric-poc prompt get <id>' or 'fabric-poc script run <id>' whose target is unknown in both the kit and the active registry.",
      "Also detects manifest coverage gaps: physical *.md files under prompts/ or *.js files under scripts/ that are not covered by any declared glob, and directories that contain files but have no corresponding prompt_files / script_files key in resources.toml. This prevents the false-clean case where an omitted manifest key silently hides a whole directory from deterministic review.",
      "Covers router↔modes symmetry implicitly: a router body that references 'fabric-poc prompt get <router>-<mode>' fails the body-reference check when the matching mode file is missing.",
    ],
    usage: [
      "fabric-poc script run prompt-kit-lint <path-to-kit-directory>",
    ],
    parameters: [
      { name: "kit", type: "string", required: true, description: "Absolute or cwd-relative path to a kit directory that contains a resources.toml manifest." },
    ],
    returns: "JSON object with kit, manifest, registryManifests, prompts (id/type/path), scripts (id/path), and findings (severity/where/problem). Empty findings means all cross-file checks passed.",
    examples: [
      {
        command: "fabric-poc script run prompt-kit-lint pocs/fabric-kits/prompting",
        description: "Lint the prompting kit for cross-file defects against the active registry.",
      },
    ],
    notes: [
      "Reports CRITICAL for intra-kit id collisions; HIGH for registry collisions, orphan middleware target_prompts, orphan body references, missing manifest keys for populated directories, and physical files outside declared globs.",
      "Does not duplicate prompt-lint or script-lint: per-file issues stay in those linters; this script focuses on cross-file integrity.",
      "Only the literal id form of fabric-poc prompt get / fabric-poc script run is scanned; meta-syntactic placeholders like '<router>-<mode>' are intentionally ignored.",
      "Glob expansion supports one '*' in the file basename (e.g. prompts/*.md, scripts/*.js); manifests using deeper glob patterns require an update to this script.",
    ],
  },
  run(args, context) {
    const { kitPath } = parseArgs(args);
    const absoluteKitPath = path.isAbsolute(kitPath) ? kitPath : path.join(context.cwd, kitPath);
    if (!fs.existsSync(absoluteKitPath)) {
      throw new Error(`prompt-kit-lint: kit directory not found: ${absoluteKitPath}`);
    }
    if (!fs.statSync(absoluteKitPath).isDirectory()) {
      throw new Error(`prompt-kit-lint: path is not a directory: ${absoluteKitPath}`);
    }
    return JSON.stringify(lintKit(absoluteKitPath, context), null, 2);
  },
};
