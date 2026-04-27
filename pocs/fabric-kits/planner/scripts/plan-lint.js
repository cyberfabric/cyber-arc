const fs = require("node:fs");
const path = require("node:path");
const TOML = require("@iarna/toml");

const SCRIPT_ID = "plan-lint";

const ALLOWED_LIFECYCLES = new Set(["gitignore", "cleanup", "archive", "manual"]);
const ALLOWED_LIFECYCLE_STATUSES = new Set([
  "pending",
  "ready",
  "in_progress",
  "manual_action_required",
  "done",
  "failed",
]);
const ALLOWED_EXECUTION_STATUSES = new Set(["not_started", "in_progress", "done", "failed"]);
const REQUIRED_PLAN_FIELDS = [
  "task",
  "type",
  "target",
  "target_key",
  "kit_path",
  "created",
  "lifecycle",
  "execution_status",
  "lifecycle_status",
  "plan_dir",
  "active_plan_dir",
  "total_phases",
];
const PHASE_LINE_BUDGET = 1000;

function resolveAbsolutePath(rawPath, cwd) {
  return path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
}

function countLines(text) {
  if (!text) return 0;
  const newlineCount = (text.match(/\n/g) || []).length;
  return text.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function loadManifest(planDir) {
  if (!fs.existsSync(planDir)) {
    throw new Error(`${SCRIPT_ID}: plan directory not found: ${planDir}`);
  }
  const manifestPath = path.join(planDir, "plan.toml");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`${SCRIPT_ID}: plan.toml not found in ${planDir}`);
  }
  let parsed;
  try {
    parsed = TOML.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`${SCRIPT_ID}: failed to parse ${manifestPath}: ${error.message}`);
  }
  return { manifestPath, parsed };
}

function checkManifestSchema(parsed) {
  const missing = [];
  if (!parsed.plan || typeof parsed.plan !== "object") {
    return { status: "FAIL", missing_fields: ["plan"] };
  }
  for (const field of REQUIRED_PLAN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(parsed.plan, field)) {
      missing.push(`plan.${field}`);
    }
  }
  if (!Array.isArray(parsed.phases)) {
    missing.push("phases");
  }
  return missing.length === 0
    ? { status: "PASS", missing_fields: [] }
    : { status: "FAIL", missing_fields: missing };
}

function checkLifecycle(plan) {
  const issues = [];
  if (!ALLOWED_LIFECYCLES.has(plan.lifecycle)) {
    issues.push({ issue: "invalid_lifecycle", value: plan.lifecycle });
  }
  if (!ALLOWED_LIFECYCLE_STATUSES.has(plan.lifecycle_status)) {
    issues.push({ issue: "invalid_lifecycle_status", value: plan.lifecycle_status });
  }
  if (!ALLOWED_EXECUTION_STATUSES.has(plan.execution_status)) {
    issues.push({ issue: "invalid_execution_status", value: plan.execution_status });
  }
  return issues.length === 0
    ? { status: "PASS", issues: [] }
    : { status: "FAIL", issues };
}

function checkStructural(plan, phases) {
  const issues = [];
  if (typeof plan.total_phases === "number" && plan.total_phases !== phases.length) {
    issues.push({ issue: "total_phases_mismatch", expected: plan.total_phases, actual: phases.length });
  }
  for (let i = 0; i < phases.length; i += 1) {
    const expected = i + 1;
    if (phases[i].number !== expected) {
      issues.push({ issue: "numbering_non_contiguous", expected, actual: phases[i].number });
    }
  }
  for (const phase of phases) {
    const deps = Array.isArray(phase.depends_on) ? phase.depends_on : [];
    for (const dep of deps) {
      if (!Number.isInteger(dep) || dep < 1 || dep >= phase.number) {
        issues.push({ issue: "depends_on_out_of_range", phase: phase.number, dep });
      }
      if (Number.isInteger(dep) && dep > phases.length) {
        issues.push({ issue: "depends_on_exceeds_total", phase: phase.number, dep });
      }
    }
  }
  return issues.length === 0
    ? { status: "PASS", issues: [] }
    : { status: "FAIL", issues };
}

function checkFilePresence(planDir, phases) {
  const missing = [];
  for (const phase of phases) {
    const briefPath = path.join(planDir, phase.brief_file || "");
    if (!phase.brief_file || !fs.existsSync(briefPath)) {
      missing.push({ phase: phase.number, kind: "brief", path: briefPath });
    }
    const phasePath = path.join(planDir, phase.file || "");
    if (!phase.file || !fs.existsSync(phasePath)) {
      missing.push({ phase: phase.number, kind: "phase", path: phasePath });
    }
  }
  return missing.length === 0
    ? { status: "PASS", missing_files: [] }
    : { status: "FAIL", missing_files: missing };
}

function checkBudget(planDir, phases) {
  const overBudget = [];
  for (const phase of phases) {
    const phasePath = path.join(planDir, phase.file || "");
    if (!phase.file || !fs.existsSync(phasePath)) continue;
    const text = fs.readFileSync(phasePath, "utf8");
    const lines = countLines(text);
    if (lines > PHASE_LINE_BUDGET) {
      overBudget.push({ phase: phase.number, path: phasePath, lines, budget: PHASE_LINE_BUDGET });
    }
  }
  return overBudget.length === 0
    ? { status: "PASS", over_budget: [] }
    : { status: "FAIL", over_budget: overBudget };
}

function run(args, context) {
  if (args.length !== 1) {
    throw new Error(`${SCRIPT_ID}: expected exactly one argument <plan_dir>, got ${args.length}`);
  }
  const planDir = resolveAbsolutePath(args[0], context.cwd);
  const { manifestPath, parsed } = loadManifest(planDir);

  const manifestSchema = checkManifestSchema(parsed);
  const phases = Array.isArray(parsed.phases) ? parsed.phases : [];
  const plan = parsed.plan && typeof parsed.plan === "object" ? parsed.plan : {};

  const lifecycle = checkLifecycle(plan);
  const structural = checkStructural(plan, phases);
  const filePresence = checkFilePresence(planDir, phases);
  const budget = checkBudget(planDir, phases);

  const overall = [
    manifestSchema.status,
    lifecycle.status,
    structural.status,
    filePresence.status,
    budget.status,
  ].every((s) => s === "PASS")
    ? "PASS"
    : "FAIL";

  return JSON.stringify(
    {
      plan_dir: planDir,
      manifest_path: manifestPath,
      categories: {
        manifest_schema: manifestSchema,
        lifecycle,
        structural,
        file_presence: filePresence,
        budget,
      },
      overall,
    },
    null,
    2,
  );
}

module.exports = {
  id: SCRIPT_ID,
  name: "plan lint",
  description: "Kit-level deterministic audit of a plan directory: manifest schema, lifecycle / lifecycle_status / execution_status enums, phase numbering + depends_on validity, brief / phase file presence, and per-phase line-budget compliance",
  interface: {
    details: [
      "Reads <plan_dir>/plan.toml and runs five deterministic categories of checks:",
      "1) manifest_schema: every required [plan] field is present; phases is an array.",
      "2) lifecycle: lifecycle, lifecycle_status, execution_status are members of their allowed enums.",
      "3) structural: total_phases matches phases.length; numbering is 1..N contiguous; every depends_on entry is an integer < this phase's number and ≤ total_phases.",
      "4) file_presence: every brief_file and file declared in phases exists on disk under plan_dir.",
      "5) budget: every present phase file is ≤ 1000 lines.",
      "Per-phase content checks (headings, unresolved placeholders) are out of scope here — use plan-phase-validate for those.",
    ],
    usage: ["fabric script run plan-lint <plan_dir>"],
    parameters: [
      { name: "plan_dir", type: "string", required: true, description: "Absolute or cwd-relative path to a plan directory containing plan.toml." },
    ],
    returns: "JSON object with plan_dir, manifest_path, categories {manifest_schema, lifecycle, structural, file_presence, budget}, and overall PASS/FAIL.",
    examples: [
      { command: "fabric script run plan-lint ./.fabric-plans/generate-prd-myapp", description: "Audit an existing plan directory across all five categories." },
    ],
    notes: [
      "Read-only. Does not modify plan.toml or phase / brief files.",
      "Categories are independent: a FAIL in one does not short-circuit the others, so a single run reports every deterministic issue.",
    ],
  },
  run,
};
