const fs = require("node:fs");
const path = require("node:path");
const {
  getActiveManifestPathsReadOnly,
  resolveResourcePatternsFromManifest,
} = require("@cyberfabric/fabric");

const ALLOWED_TYPES = new Set(["prompt", "script"]);

function parseArgs(args) {
  let targetPath;
  let type = "prompt";
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (current === "--type") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error("prompt-register-dryrun: --type requires a value (prompt|script)");
      if (!ALLOWED_TYPES.has(value)) throw new Error(`prompt-register-dryrun: --type must be one of ${[...ALLOWED_TYPES].join(", ")} (got ${value})`);
      type = value;
      i += 1;
    } else if (!current.startsWith("--") && !targetPath) {
      targetPath = current;
    } else {
      throw new Error(`prompt-register-dryrun: unexpected argument: ${current}`);
    }
  }
  if (!targetPath) throw new Error("prompt-register-dryrun: path is required");
  return { targetPath, type };
}

function patternToRegExp(pattern) {
  return new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
      .replace(/\*/g, "[^/]*")}$`
  );
}

function matchManifests(targetPath, type, options) {
  const manifestPaths = getActiveManifestPathsReadOnly(options);
  const matches = [];
  const allGlobs = [];
  const patternsKey = type === "script" ? "scriptFiles" : "promptFiles";

  for (const manifestPath of manifestPaths) {
    const patterns = resolveResourcePatternsFromManifest(manifestPath)[patternsKey];
    for (const pattern of patterns) {
      const absolutePattern = path.isAbsolute(pattern) ? pattern : path.join(path.dirname(manifestPath), pattern);
      allGlobs.push({ manifest: manifestPath, glob: absolutePattern });
      if (!absolutePattern.includes("*")) {
        if (absolutePattern === targetPath) matches.push({ manifest: manifestPath, glob: absolutePattern });
        continue;
      }
      const directory = path.dirname(absolutePattern);
      const filenameRegExp = patternToRegExp(path.basename(absolutePattern));
      if (path.dirname(targetPath) === directory && filenameRegExp.test(path.basename(targetPath))) {
        matches.push({ manifest: manifestPath, glob: absolutePattern });
      }
    }
  }

  return { manifestPaths, matches, allGlobs };
}

module.exports = {
  id: "prompt-register-dryrun",
  name: "prompt register dryrun",
  description: "Report whether a prompt or script file is covered by an active prompt_files or script_files glob",
  interface: {
    details: [
      "Resolves the active fabric resource manifests (global + optional local) and checks whether the given file path matches any prompt_files glob (default) or script_files glob (when --type script).",
      "Helps catch the silent-invisible failure mode where a prompt or script is authored in a directory not covered by any manifest.",
    ],
    usage: [
      "fabric script run prompt-register-dryrun <path-to-file> [--type prompt|script]",
    ],
    parameters: [
      { name: "path", type: "string", required: true, description: "Absolute or cwd-relative path to the file to test. Positional argument." },
      { name: "--type", type: "string", required: false, description: "Which manifest glob list to check against: prompt (default, uses prompt_files) or script (uses script_files)." },
    ],
    returns: "JSON object with file, type, covered, matches (manifest + glob pairs that cover the file), and allGlobs (every active glob for the selected type). matches is empty when the file is invisible.",
    examples: [
      {
        command: "fabric script run prompt-register-dryrun pocs/fabric-kits/prompting/prompts/prompt.md",
        description: "Confirm the prompt router markdown is covered by a prompt_files glob (default).",
      },
      {
        command: "fabric script run prompt-register-dryrun pocs/fabric-kits/prompting/scripts/prompt-lint.js --type script",
        description: "Confirm the prompt-lint script is covered by a script_files glob.",
      },
    ],
    notes: [
      "Default behavior (no --type) is backward-compatible with earlier versions: checks prompt_files only.",
      "Pass --type script to check script_files instead. Does not check both lists in a single invocation.",
    ],
  },
  run(args, context) {
    const { targetPath: rawPath, type } = parseArgs(args);
    const target = path.isAbsolute(rawPath) ? rawPath : path.join(context.cwd, rawPath);
    if (!fs.existsSync(target)) throw new Error(`prompt-register-dryrun: file not found: ${target}`);
    const { matches, allGlobs } = matchManifests(target, type, { cwd: context.cwd, homeDir: context.homeDir });
    return JSON.stringify({
      file: target,
      type,
      covered: matches.length > 0,
      matches,
      allGlobs,
    }, null, 2);
  },
};
