const fs = require("node:fs");
const path = require("node:path");
const TOML = require("@iarna/toml");

const SCRIPT_ID = "plan-status";

function resolveAbsolutePath(rawPath, cwd) {
  return path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
}

function summarizePhases(phases) {
  const summary = { pending: 0, in_progress: 0, done: 0, failed: 0 };
  for (const phase of phases) {
    if (Object.prototype.hasOwnProperty.call(summary, phase.status)) {
      summary[phase.status] += 1;
    }
  }
  return summary;
}

function findNextExecutable(phases) {
  const byNumber = new Map();
  for (const phase of phases) byNumber.set(phase.number, phase);
  for (const phase of phases) {
    if (phase.status !== "pending") continue;
    const deps = Array.isArray(phase.depends_on) ? phase.depends_on : [];
    const blocked = deps.some((dep) => {
      const upstream = byNumber.get(dep);
      return !upstream || upstream.status !== "done";
    });
    if (!blocked) {
      return { number: phase.number, slug: phase.slug, reason: "ready" };
    }
  }
  return null;
}

function run(args, context) {
  if (args.length !== 1) {
    throw new Error(`${SCRIPT_ID}: expected exactly one argument <plan_dir>, got ${args.length}`);
  }
  const planDir = resolveAbsolutePath(args[0], context.cwd);
  if (!fs.existsSync(planDir)) {
    throw new Error(`${SCRIPT_ID}: plan directory not found: ${planDir}`);
  }
  if (!fs.statSync(planDir).isDirectory()) {
    throw new Error(`${SCRIPT_ID}: path is not a directory: ${planDir}`);
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
  if (!parsed.plan || typeof parsed.plan !== "object") {
    throw new Error(`${SCRIPT_ID}: ${manifestPath} has no [plan] table`);
  }
  const phases = Array.isArray(parsed.phases) ? parsed.phases : [];

  const phaseSummaries = phases.map((phase) => ({
    number: phase.number,
    title: phase.title,
    slug: phase.slug,
    status: phase.status,
    kind: phase.kind,
    depends_on: Array.isArray(phase.depends_on) ? phase.depends_on : [],
  }));

  return JSON.stringify(
    {
      plan_dir: planDir,
      manifest_path: manifestPath,
      task: parsed.plan.task,
      type: parsed.plan.type,
      target: parsed.plan.target,
      target_key: parsed.plan.target_key,
      execution_status: parsed.plan.execution_status,
      lifecycle: parsed.plan.lifecycle,
      lifecycle_status: parsed.plan.lifecycle_status,
      active_plan_dir: parsed.plan.active_plan_dir,
      input_signature: parsed.plan.input_signature,
      total_phases: parsed.plan.total_phases,
      phase_summary: summarizePhases(phaseSummaries),
      next_executable: findNextExecutable(phaseSummaries),
      phases: phaseSummaries,
    },
    null,
    2,
  );
}

module.exports = {
  id: SCRIPT_ID,
  name: "plan status",
  description: "Read plan.toml from a plan directory and report execution + lifecycle status plus per-phase state",
  interface: {
    details: [
      "Reads <plan_dir>/plan.toml and returns plan-level metadata, per-phase status summaries, an aggregate phase_summary, and the first ready-to-run phase as next_executable.",
      "next_executable picks the lowest-numbered pending phase whose declared depends_on phases are all done. Returns null when nothing is ready (all done, or every pending phase is blocked by a non-done upstream).",
    ],
    usage: ["fabric script run plan-status <plan_dir>"],
    parameters: [
      { name: "plan_dir", type: "string", required: true, description: "Absolute or cwd-relative path to a plan directory containing plan.toml." },
    ],
    returns: "JSON object with plan_dir, manifest_path, task, type, target, target_key, execution_status, lifecycle, lifecycle_status, active_plan_dir, input_signature, total_phases, phase_summary {pending,in_progress,done,failed}, next_executable {number,slug,reason} or null, and phases[] {number,title,slug,status,kind,depends_on}.",
    examples: [
      { command: "fabric script run plan-status ./.fabric-plans/generate-prd-myapp", description: "Report status of an existing plan directory." },
    ],
    notes: [
      "Read-only. Does not modify plan.toml or any phase files.",
      "Does not audit on-disk artifacts — declared phase status in plan.toml is trusted as-is. Use plan-resume for filesystem-vs-manifest integrity audits.",
    ],
  },
  run,
};
