const fs = require("node:fs");
const path = require("node:path");
const { parseArgs, requireString, requireOneOf, optionalInt } = require("../lib/args");
const { buildInputSignature } = require("../lib/hashing");
const { countLines } = require("../lib/lines");
const { buildTargetKey, buildTaskSlug, KEBAB_CASE } = require("../lib/slugify");

const SCRIPT_ID = "plan-init";

const ALLOWED_TYPES = ["generate", "analyze", "implement"];
const ALLOWED_TARGET_FORMS = [
  "artifact-path",
  "artifact",
  "path",
  "feature-path",
  "feature-id",
  "feature-title",
];

const PARSE_SCHEMA = {
  booleans: new Set(["include-stdin"]),
  repeats: new Set(["raw-input"]),
};

function resolveAbsolutePath(rawPath, cwd) {
  return path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
}

function ensureDirExists(absPath, role) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`${SCRIPT_ID}: ${role} not found: ${absPath}`);
  }
  const stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    throw new Error(`${SCRIPT_ID}: ${role} is not a directory: ${absPath}`);
  }
}

function ensureFileExists(absPath, role) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`${SCRIPT_ID}: ${role} not found: ${absPath}`);
  }
  const stat = fs.statSync(absPath);
  if (!stat.isFile()) {
    throw new Error(`${SCRIPT_ID}: ${role} is not a file: ${absPath}`);
  }
}

function buildItems(rawInputs, includeStdin, stdinText, cwd) {
  const items = [];
  for (const raw of rawInputs) {
    const abs = resolveAbsolutePath(raw, cwd);
    ensureFileExists(abs, "raw-input file");
    items.push({ kind: "file", path: abs });
  }
  if (includeStdin) {
    items.push({ kind: "stdin", content: stdinText || "" });
  }
  return items;
}

function readExistingPlanSignature(planDir) {
  const manifestPath = path.join(planDir, "input", "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  const stat = fs.statSync(manifestPath);
  if (!stat.isFile()) return null;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`${SCRIPT_ID}: existing input manifest is not valid JSON: ${manifestPath} (${error.message})`);
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.input_signature !== "string") {
    throw new Error(`${SCRIPT_ID}: existing input manifest missing input_signature: ${manifestPath}`);
  }
  return parsed.input_signature;
}

function run(args, context) {
  const { flags, positionals } = parseArgs(args, PARSE_SCHEMA);
  if (positionals.length > 0) {
    throw new Error(`${SCRIPT_ID}: unexpected positional argument: ${positionals[0]}`);
  }

  const task = requireString(flags, "task", SCRIPT_ID);
  const type = requireOneOf(flags, "type", ALLOWED_TYPES, SCRIPT_ID);
  const targetForm = requireOneOf(flags, "target-form", ALLOWED_TARGET_FORMS, SCRIPT_ID);
  const target = requireString(flags, "target", SCRIPT_ID);
  const artifactKind = flags["target-kind"] || null;
  const projectRootRaw = flags["project-root"] || context.cwd;
  const projectRoot = resolveAbsolutePath(projectRootRaw, context.cwd);
  ensureDirExists(projectRoot, "project root");
  const plansRootRaw = flags["plans-root"] || path.join(projectRoot, ".fabric-plans");
  const plansRoot = resolveAbsolutePath(plansRootRaw, context.cwd);
  const threshold = optionalInt(flags, "threshold-lines", SCRIPT_ID, 500);
  if (threshold <= 0) {
    throw new Error(`${SCRIPT_ID}: --threshold-lines must be > 0`);
  }
  const includeStdin = Boolean(flags["include-stdin"]);
  const stdinText = flags["stdin-text"] || "";
  if (!includeStdin && stdinText.length > 0) {
    throw new Error(`${SCRIPT_ID}: --stdin-text was provided without --include-stdin; pass --include-stdin to include the direct prompt text`);
  }
  const rawInputs = Array.isArray(flags["raw-input"]) ? flags["raw-input"] : [];

  const targetKey = buildTargetKey({ targetForm, target, projectRoot, artifactKind });
  const taskSlug = buildTaskSlug({ type, targetForm, target, projectRoot, artifactKind });
  if (!KEBAB_CASE.test(taskSlug)) {
    throw new Error(`${SCRIPT_ID}: derived task slug ${JSON.stringify(taskSlug)} is not kebab-case; check --target and --target-kind values`);
  }
  const planDir = path.join(plansRoot, taskSlug);

  const items = buildItems(rawInputs, includeStdin, stdinText, context.cwd);
  const inputSignature = buildInputSignature(items);

  let totalLines = 0;
  for (const item of items) {
    const text = item.kind === "file" ? fs.readFileSync(item.path, "utf8") : item.content;
    totalLines += countLines(text);
  }
  const needsChunking = totalLines > threshold;

  const existingSignature = readExistingPlanSignature(planDir);
  const existingPlanMatch = existingSignature !== null && existingSignature === inputSignature;

  return JSON.stringify(
    {
      task,
      type,
      target_kind: artifactKind,
      target,
      target_form: targetForm,
      target_key: targetKey,
      task_slug: taskSlug,
      project_root: projectRoot,
      plans_root: plansRoot,
      plan_dir: planDir,
      input_signature: inputSignature,
      input_total_lines: totalLines,
      input_threshold_lines: threshold,
      needs_chunking: needsChunking,
      raw_input_files: rawInputs.map((rel) => resolveAbsolutePath(rel, context.cwd)),
      includes_stdin: includeStdin,
      existing_plan_dir: existingSignature !== null ? planDir : null,
      existing_plan_signature: existingSignature,
      existing_plan_match: existingPlanMatch,
    },
    null,
    2,
  );
}

module.exports = {
  id: SCRIPT_ID,
  name: "plan init",
  description: "Compute task_slug, target_key, input_signature, and plan_dir for a planner task; report whether existing plan reuse applies and whether raw input requires chunking",
  interface: {
    details: [
      "Resolves the canonical plan-directory naming and identity for a fabric planner task without writing any files.",
      "Computes a content-derived input_signature so that planner-generate / planner-recover can reuse an existing .fabric-plans directory when both task target and raw input match.",
      "Counts total input lines (files + optional direct prompt) and reports needs_chunking against --threshold-lines so the prompt can decide whether to invoke plan-chunk-input next.",
    ],
    usage: [
      "fabric script run plan-init --task <text> --type <generate|analyze|implement> --target-form <form> --target <value> [--target-kind <kind>] [--project-root <path>] [--plans-root <path>] [--raw-input <path>]... [--include-stdin] [--stdin-text <text>] [--threshold-lines <int>]",
    ],
    parameters: [
      { name: "--task", type: "string", required: true, description: "Human-readable task description recorded in the plan manifest." },
      { name: "--type", type: "string", required: true, description: "Task type: generate, analyze, or implement." },
      { name: "--target-form", type: "string", required: true, description: "How target_key is built: artifact-path, artifact, path, feature-path, feature-id, or feature-title." },
      { name: "--target", type: "string", required: true, description: "Target value matching --target-form (artifact path, artifact name, file/dir path, feature path, feature id, or feature title)." },
      { name: "--target-kind", type: "string", required: false, description: "Artifact kind (e.g. PRD, DESIGN, FEATURE). Required when --target-form is artifact." },
      { name: "--project-root", type: "string", required: false, description: "Absolute or cwd-relative project root. Defaults to the script's cwd." },
      { name: "--plans-root", type: "string", required: false, description: "Where plan directories live. Defaults to {project-root}/.fabric-plans." },
      { name: "--raw-input", type: "string", required: false, description: "Path to a raw-input file. Repeat for multiple files. Files must exist." },
      { name: "--include-stdin", type: "boolean", required: false, description: "Include direct prompt text in the input identity. Pair with --stdin-text." },
      { name: "--stdin-text", type: "string", required: false, description: "Direct prompt text to fold into the input signature when --include-stdin is set." },
      { name: "--threshold-lines", type: "string", required: false, description: "Total-line threshold above which raw input must be chunked. Defaults to 500." },
    ],
    returns: "JSON object with task, type, target_kind, target, target_form, target_key, task_slug, project_root, plans_root, plan_dir, input_signature, input_total_lines, input_threshold_lines, needs_chunking, raw_input_files, includes_stdin, existing_plan_dir, existing_plan_signature, and existing_plan_match.",
    examples: [
      {
        command: "fabric script run plan-init --task \"generate PRD for myapp\" --type generate --target-form artifact --target-kind PRD --target myapp",
        description: "Compute identity for a generate-PRD task with no raw-input package; defaults plan_dir to {cwd}/.fabric-plans/generate-prd-myapp.",
      },
      {
        command: "fabric script run plan-init --task \"analyze docs vs code\" --type analyze --target-form path --target ./docs --raw-input ./docs/README.md --include-stdin --stdin-text \"focus on adr drift\"",
        description: "Compute identity for an analyze-path task whose raw input includes a file plus direct prompt text.",
      },
    ],
    notes: [
      "Read-only. Does NOT create plan_dir, write manifest.json, or chunk raw input. The caller invokes plan-chunk-input next when needs_chunking is true.",
      "task_slug + target_key + input_signature together drive plan-directory reuse; existing_plan_match is true only when {plan_dir}/input/manifest.json already records an identical input_signature.",
      "Stdin text is folded into the signature only when --include-stdin is set; presentation-only labels are excluded from the signature so relabeling the prompt does not break reuse.",
    ],
  },
  run,
};
