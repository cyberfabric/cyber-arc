const fs = require("node:fs");
const path = require("node:path");
const TOML = require("@iarna/toml");

const SCRIPT_ID = "plan-resume";

function resolveAbsolutePath(rawPath, cwd) {
  return path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
}

function parseArgs(rawArgs) {
  let planDir;
  let apply = false;
  for (const arg of rawArgs) {
    if (arg === "--apply") {
      if (apply) throw new Error(`${SCRIPT_ID}: --apply specified more than once`);
      apply = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`${SCRIPT_ID}: unknown flag ${arg}`);
    }
    if (planDir !== undefined) {
      throw new Error(`${SCRIPT_ID}: unexpected positional argument: ${arg}`);
    }
    planDir = arg;
  }
  if (!planDir) throw new Error(`${SCRIPT_ID}: <plan_dir> is required`);
  return { planDir, apply };
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
  if (!parsed.plan || typeof parsed.plan !== "object") {
    throw new Error(`${SCRIPT_ID}: ${manifestPath} has no [plan] table`);
  }
  return { manifestPath, parsed };
}

function isCleanupExempt(plan) {
  return plan.lifecycle === "cleanup" && plan.lifecycle_status === "done";
}

function auditPhase(planDir, phase, exempt) {
  const findings = [];
  if (phase.status !== "done") return findings;
  if (exempt) return findings;
  const briefPath = path.join(planDir, phase.brief_file || "");
  if (!phase.brief_file || !fs.existsSync(briefPath)) {
    findings.push({ phase: phase.number, issue: "missing-brief-file", path: briefPath });
  }
  const phasePath = path.join(planDir, phase.file || "");
  if (!phase.file || !fs.existsSync(phasePath)) {
    findings.push({ phase: phase.number, issue: "missing-phase-file", path: phasePath });
  }
  const outputs = Array.isArray(phase.outputs) ? phase.outputs : [];
  for (const out of outputs) {
    const outPath = path.join(planDir, out);
    if (!fs.existsSync(outPath)) {
      findings.push({ phase: phase.number, issue: "missing-output", path: outPath });
    }
  }
  return findings;
}

function expandReopenSet(phases, initialReopens) {
  const reopen = new Set(initialReopens);
  let changed = true;
  while (changed) {
    changed = false;
    for (const phase of phases) {
      if (phase.status !== "done") continue;
      const deps = Array.isArray(phase.depends_on) ? phase.depends_on : [];
      if (deps.some((d) => reopen.has(d)) && !reopen.has(phase.number)) {
        reopen.add(phase.number);
        changed = true;
      }
    }
  }
  return [...reopen].sort((a, b) => a - b);
}

function computeExecutionStatus(phases, anyReopened) {
  if (anyReopened) return "in_progress";
  const statuses = phases.map((p) => p.status);
  if (statuses.every((s) => s === "done")) return "done";
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.some((s) => s === "in_progress" || s === "done")) return "in_progress";
  return "not_started";
}

function repairLifecycle(plan, anyReopened) {
  if (!anyReopened) return null;
  if (plan.lifecycle === "gitignore") return null;
  const previous = plan.lifecycle_status;
  if (previous === "pending") return null;
  return { from: previous, to: "pending", reason: "phases reopened" };
}

function findNextExecutable(phases) {
  for (const phase of phases) {
    if (phase.status !== "pending") continue;
    const deps = Array.isArray(phase.depends_on) ? phase.depends_on : [];
    const blocked = deps.some((d) => {
      const upstream = phases.find((p) => p.number === d);
      return !upstream || upstream.status !== "done";
    });
    if (!blocked) return { number: phase.number, slug: phase.slug, reason: "ready" };
  }
  return null;
}

function run(args, context) {
  const { planDir: rawPlanDir, apply } = parseArgs(args);
  const planDir = resolveAbsolutePath(rawPlanDir, context.cwd);
  const { manifestPath, parsed } = loadManifest(planDir);
  const phases = Array.isArray(parsed.phases) ? parsed.phases : [];
  const exempt = isCleanupExempt(parsed.plan);

  const auditFindings = [];
  const initialReopen = new Set();
  for (const phase of phases) {
    const findings = auditPhase(planDir, phase, exempt);
    if (findings.length > 0) {
      initialReopen.add(phase.number);
      for (const f of findings) auditFindings.push(f);
    }
  }
  const phasesToReopen = expandReopenSet(phases, initialReopen);

  const projectedPhases = phases.map((p) => ({
    ...p,
    status: phasesToReopen.includes(p.number) ? "pending" : p.status,
  }));
  const executionStatus = computeExecutionStatus(projectedPhases, phasesToReopen.length > 0);
  const lifecycleRepair = repairLifecycle(parsed.plan, phasesToReopen.length > 0);
  const nextExecutable = findNextExecutable(projectedPhases);

  let applied = false;
  if (apply && (phasesToReopen.length > 0 || lifecycleRepair !== null)) {
    const next = { ...parsed };
    next.plan = {
      ...parsed.plan,
      execution_status: executionStatus,
      lifecycle_status: lifecycleRepair ? lifecycleRepair.to : parsed.plan.lifecycle_status,
    };
    next.phases = projectedPhases;
    fs.writeFileSync(manifestPath, TOML.stringify(next), "utf8");
    applied = true;
  } else if (apply) {
    applied = true;
  }

  return JSON.stringify(
    {
      plan_dir: planDir,
      manifest_path: manifestPath,
      cleanup_exempt: exempt,
      audit_findings: auditFindings,
      phases_to_reopen: phasesToReopen,
      lifecycle_repair: lifecycleRepair,
      execution_status: executionStatus,
      next_executable: nextExecutable,
      applied,
    },
    null,
    2,
  );
}

module.exports = {
  id: SCRIPT_ID,
  name: "plan resume",
  description: "Audit a plan directory for inconsistent done phases (missing briefs / phase files / intermediate outputs), compute the cascade of phases to reopen, and optionally apply the downgrade to plan.toml",
  interface: {
    details: [
      "Reads <plan_dir>/plan.toml and audits every phase marked done against the on-disk presence of its brief-{NN}-{slug}.md, phase-{NN}-{slug}.md, and declared outputs (paths under <plan_dir>).",
      "Inconsistent done phases are added to phases_to_reopen; downstream phases (transitively) whose depends_on includes any reopened phase are also added.",
      "Repairs lifecycle_status when work is reopened: keeps `done` only for lifecycle=gitignore; otherwise records a recommendation to reset lifecycle_status to `pending`.",
      "Exempts brief / phase / out file absences when lifecycle=cleanup and lifecycle_status=done — those deletions are intentional terminal cleanup, not regressions.",
      "By default, does not mutate plan.toml. Pass --apply to rewrite plan.toml with downgraded statuses and recomputed execution_status / lifecycle_status.",
    ],
    usage: ["fabric-poc script run plan-resume <plan_dir> [--apply]"],
    parameters: [
      { name: "plan_dir", type: "string", required: true, description: "Absolute or cwd-relative path to a plan directory containing plan.toml." },
      { name: "--apply", type: "boolean", required: false, description: "Rewrite plan.toml in place with the recommended downgrades and lifecycle repair. Without this flag the script is read-only." },
    ],
    returns: "JSON object with plan_dir, manifest_path, cleanup_exempt, audit_findings[] {phase,issue,path}, phases_to_reopen[], lifecycle_repair {from,to,reason} or null, execution_status, next_executable {number,slug,reason} or null, and applied.",
    examples: [
      { command: "fabric-poc script run plan-resume ./.fabric-plans/generate-prd-myapp", description: "Audit the plan and report findings without mutating anything." },
      { command: "fabric-poc script run plan-resume ./.fabric-plans/generate-prd-myapp --apply", description: "Audit and rewrite plan.toml with reopened phases + lifecycle repair." },
    ],
    notes: [
      "Only audits artifacts under plan_dir (briefs, phase files, intermediate outputs). Project-side output_files are out of scope; use plan-lint for cross-cutting plan validation.",
      "When --apply is passed and there is nothing to change, plan.toml is left untouched but applied is reported as true so callers can confirm the intent ran.",
    ],
  },
  run,
};
