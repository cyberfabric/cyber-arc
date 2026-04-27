const fs = require("node:fs");
const path = require("node:path");
const TOML = require("@iarna/toml");
const { parseArgs, requireString } = require("../lib/args");
const { KEBAB_CASE } = require("../lib/slugify");

const SCRIPT_ID = "plan-manifest-write";

const PARSE_SCHEMA = {
  booleans: new Set(["dry-run"]),
  repeats: new Set(),
};

const ALLOWED_TYPES = new Set(["generate", "analyze", "implement"]);
const ALLOWED_LIFECYCLES = new Set(["gitignore", "cleanup", "archive", "manual"]);
const ALLOWED_EXECUTION_STATUS = new Set(["not_started", "in_progress", "done", "failed"]);
const ALLOWED_LIFECYCLE_STATUS = new Set([
  "pending",
  "ready",
  "in_progress",
  "manual_action_required",
  "done",
  "failed",
]);
const ALLOWED_PHASE_STATUS = new Set(["pending", "in_progress", "done", "failed"]);
const ALLOWED_PHASE_KIND = new Set(["delivery", "lifecycle"]);
const ALLOWED_SKILL_ROLES = new Set(["companion", "tool"]);
const ALLOWED_SUBAGENT_ROLES = new Set(["delegate", "companion-runner"]);

const PLAN_REQUIRED_FIELDS = [
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

const PHASE_REQUIRED_FIELDS = [
  "number",
  "title",
  "slug",
  "file",
  "brief_file",
  "status",
  "kind",
];

function resolveAbsolutePath(rawPath, cwd) {
  return path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
}

function loadSpec(flags, context) {
  const spec = flags["spec"];
  const specFile = flags["spec-file"];
  if ((spec && specFile) || (!spec && !specFile)) {
    throw new Error(`${SCRIPT_ID}: pass exactly one of --spec or --spec-file`);
  }
  let raw;
  if (specFile) {
    const abs = resolveAbsolutePath(specFile, context.cwd);
    if (!fs.existsSync(abs)) throw new Error(`${SCRIPT_ID}: --spec-file not found: ${abs}`);
    if (!fs.statSync(abs).isFile()) throw new Error(`${SCRIPT_ID}: --spec-file is not a file: ${abs}`);
    raw = fs.readFileSync(abs, "utf8");
  } else {
    raw = spec;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${SCRIPT_ID}: spec is not valid JSON (${error.message})`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${SCRIPT_ID}: spec must be a JSON object with plan and phases keys`);
  }
  return parsed;
}

function validatePlan(plan, errors) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    errors.push("plan: must be an object");
    return;
  }
  for (const field of PLAN_REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(plan, field)) {
      errors.push(`plan.${field}: required`);
    }
  }
  if (plan.type && !ALLOWED_TYPES.has(plan.type)) {
    errors.push(`plan.type: must be one of ${[...ALLOWED_TYPES].join(", ")} (got ${JSON.stringify(plan.type)})`);
  }
  if (plan.lifecycle && !ALLOWED_LIFECYCLES.has(plan.lifecycle)) {
    errors.push(`plan.lifecycle: must be one of ${[...ALLOWED_LIFECYCLES].join(", ")} (got ${JSON.stringify(plan.lifecycle)})`);
  }
  if (plan.execution_status && !ALLOWED_EXECUTION_STATUS.has(plan.execution_status)) {
    errors.push(`plan.execution_status: must be one of ${[...ALLOWED_EXECUTION_STATUS].join(", ")} (got ${JSON.stringify(plan.execution_status)})`);
  }
  if (plan.lifecycle_status && !ALLOWED_LIFECYCLE_STATUS.has(plan.lifecycle_status)) {
    errors.push(`plan.lifecycle_status: must be one of ${[...ALLOWED_LIFECYCLE_STATUS].join(", ")} (got ${JSON.stringify(plan.lifecycle_status)})`);
  }
  if (typeof plan.total_phases !== "number" || !Number.isInteger(plan.total_phases) || plan.total_phases < 0) {
    errors.push(`plan.total_phases: must be a non-negative integer (got ${JSON.stringify(plan.total_phases)})`);
  }
  if (plan.input_chunks !== undefined && !Array.isArray(plan.input_chunks)) {
    errors.push(`plan.input_chunks: must be an array when present`);
  }
  for (const optional of ["input_dir", "input_manifest", "input_signature"]) {
    if (plan[optional] !== undefined && typeof plan[optional] !== "string") {
      errors.push(`plan.${optional}: must be a string when present`);
    }
  }
}

function validateIntegrationEntry(entry, idx, label, allowedRoles, errors, idField) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push(`${label}[${idx}]: must be an object`);
    return;
  }
  if (typeof entry[idField] !== "string" || entry[idField].length === 0) {
    errors.push(`${label}[${idx}].${idField}: must be a non-empty string`);
  } else if (idField === "id" && !KEBAB_CASE.test(entry.id)) {
    errors.push(`${label}[${idx}].id: must be kebab-case (got ${JSON.stringify(entry.id)})`);
  }
  if (typeof entry.role !== "string" || !allowedRoles.has(entry.role)) {
    errors.push(`${label}[${idx}].role: must be one of ${[...allowedRoles].join(", ")} (got ${JSON.stringify(entry.role)})`);
  }
  if (typeof entry.purpose !== "string" || entry.purpose.length === 0) {
    errors.push(`${label}[${idx}].purpose: must be a non-empty string`);
  }
}

function validatePhase(phase, idx, totalPhases, errors) {
  const label = `phases[${idx}]`;
  if (!phase || typeof phase !== "object" || Array.isArray(phase)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  for (const field of PHASE_REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(phase, field)) {
      errors.push(`${label}.${field}: required`);
    }
  }
  if (typeof phase.number !== "number" || !Number.isInteger(phase.number)) {
    errors.push(`${label}.number: must be an integer`);
  } else if (phase.number !== idx + 1) {
    errors.push(`${label}.number: must equal ${idx + 1} (got ${phase.number})`);
  }
  if (phase.slug !== undefined && !KEBAB_CASE.test(String(phase.slug))) {
    errors.push(`${label}.slug: must be kebab-case (got ${JSON.stringify(phase.slug)})`);
  }
  const numberPad = String(phase.number || idx + 1).padStart(2, "0");
  if (typeof phase.file === "string" && phase.slug && phase.file !== `phase-${numberPad}-${phase.slug}.md`) {
    errors.push(`${label}.file: expected phase-${numberPad}-${phase.slug}.md (got ${JSON.stringify(phase.file)})`);
  }
  if (typeof phase.brief_file === "string" && phase.slug && phase.brief_file !== `brief-${numberPad}-${phase.slug}.md`) {
    errors.push(`${label}.brief_file: expected brief-${numberPad}-${phase.slug}.md (got ${JSON.stringify(phase.brief_file)})`);
  }
  if (phase.status && !ALLOWED_PHASE_STATUS.has(phase.status)) {
    errors.push(`${label}.status: must be one of ${[...ALLOWED_PHASE_STATUS].join(", ")} (got ${JSON.stringify(phase.status)})`);
  }
  if (phase.kind && !ALLOWED_PHASE_KIND.has(phase.kind)) {
    errors.push(`${label}.kind: must be one of ${[...ALLOWED_PHASE_KIND].join(", ")} (got ${JSON.stringify(phase.kind)})`);
  }
  for (const arrayField of [
    "depends_on",
    "input_files",
    "output_files",
    "outputs",
    "inputs",
    "template_sections",
    "checklist_sections",
  ]) {
    if (phase[arrayField] !== undefined && !Array.isArray(phase[arrayField])) {
      errors.push(`${label}.${arrayField}: must be an array when present`);
    }
  }
  if (Array.isArray(phase.depends_on)) {
    for (const dep of phase.depends_on) {
      if (!Number.isInteger(dep) || dep < 1 || dep >= phase.number) {
        errors.push(`${label}.depends_on: every entry must be a phase number in [1, ${phase.number - 1}] (got ${JSON.stringify(dep)})`);
      }
      if (Number.isInteger(dep) && dep > totalPhases) {
        errors.push(`${label}.depends_on: ${dep} exceeds total_phases ${totalPhases}`);
      }
    }
  }
  if (phase.skills_loaded !== undefined) {
    if (!Array.isArray(phase.skills_loaded)) {
      errors.push(`${label}.skills_loaded: must be an array when present`);
    } else {
      phase.skills_loaded.forEach((entry, i) => {
        validateIntegrationEntry(entry, i, `${label}.skills_loaded`, ALLOWED_SKILL_ROLES, errors, "id");
      });
    }
  }
  if (phase.subagents_dispatched !== undefined) {
    if (!Array.isArray(phase.subagents_dispatched)) {
      errors.push(`${label}.subagents_dispatched: must be an array when present`);
    } else {
      phase.subagents_dispatched.forEach((entry, i) => {
        validateIntegrationEntry(entry, i, `${label}.subagents_dispatched`, ALLOWED_SUBAGENT_ROLES, errors, "name");
      });
    }
  }
}

function validateSpec(spec) {
  const errors = [];
  validatePlan(spec.plan, errors);
  if (!Array.isArray(spec.phases)) {
    errors.push("phases: must be an array");
  } else {
    const declaredTotal = spec.plan && typeof spec.plan.total_phases === "number" ? spec.plan.total_phases : null;
    if (declaredTotal !== null && spec.phases.length !== declaredTotal) {
      errors.push(`phases.length must equal plan.total_phases (got phases=${spec.phases.length}, total_phases=${declaredTotal})`);
    }
    spec.phases.forEach((phase, idx) => {
      validatePhase(phase, idx, declaredTotal == null ? spec.phases.length : declaredTotal, errors);
    });
  }
  return errors;
}

function buildTomlObject(spec) {
  const planRaw = spec.plan;
  const plan = {
    task: String(planRaw.task),
    type: String(planRaw.type),
    target: String(planRaw.target),
    target_key: String(planRaw.target_key),
    kit_path: String(planRaw.kit_path),
    created: String(planRaw.created),
    lifecycle: String(planRaw.lifecycle),
    execution_status: String(planRaw.execution_status),
    lifecycle_status: String(planRaw.lifecycle_status),
    plan_dir: String(planRaw.plan_dir),
    active_plan_dir: String(planRaw.active_plan_dir),
    input_dir: typeof planRaw.input_dir === "string" ? planRaw.input_dir : "",
    input_manifest: typeof planRaw.input_manifest === "string" ? planRaw.input_manifest : "",
    input_signature: typeof planRaw.input_signature === "string" ? planRaw.input_signature : "",
    input_chunks: Array.isArray(planRaw.input_chunks) ? planRaw.input_chunks.map(String) : [],
    total_phases: planRaw.total_phases,
  };
  const phases = spec.phases.map((phase) => ({
    number: phase.number,
    title: String(phase.title),
    slug: String(phase.slug),
    file: String(phase.file),
    brief_file: String(phase.brief_file),
    status: String(phase.status || "pending"),
    kind: String(phase.kind || "delivery"),
    depends_on: Array.isArray(phase.depends_on) ? phase.depends_on : [],
    input_files: Array.isArray(phase.input_files) ? phase.input_files.map(String) : [],
    output_files: Array.isArray(phase.output_files) ? phase.output_files.map(String) : [],
    outputs: Array.isArray(phase.outputs) ? phase.outputs.map(String) : [],
    inputs: Array.isArray(phase.inputs) ? phase.inputs.map(String) : [],
    template_sections: Array.isArray(phase.template_sections) ? phase.template_sections : [],
    checklist_sections: Array.isArray(phase.checklist_sections) ? phase.checklist_sections : [],
    skills_loaded: Array.isArray(phase.skills_loaded)
      ? phase.skills_loaded.map((entry) => ({
        id: String(entry.id),
        role: String(entry.role),
        purpose: String(entry.purpose),
      }))
      : [],
    subagents_dispatched: Array.isArray(phase.subagents_dispatched)
      ? phase.subagents_dispatched.map((entry) => ({
        name: String(entry.name),
        role: String(entry.role),
        purpose: String(entry.purpose),
      }))
      : [],
  }));
  return { plan, phases };
}

function run(args, context) {
  const { flags, positionals } = parseArgs(args, PARSE_SCHEMA);
  if (positionals.length > 0) {
    throw new Error(`${SCRIPT_ID}: unexpected positional argument: ${positionals[0]}`);
  }

  const outputRaw = requireString(flags, "output", SCRIPT_ID);
  const outputPath = resolveAbsolutePath(outputRaw, context.cwd);
  if (path.basename(outputPath) !== "plan.toml") {
    throw new Error(`${SCRIPT_ID}: --output must end with plan.toml (got ${path.basename(outputPath)})`);
  }
  if (fs.existsSync(outputPath) && !fs.statSync(outputPath).isFile()) {
    throw new Error(`${SCRIPT_ID}: --output exists but is not a file: ${outputPath}`);
  }
  const dryRun = Boolean(flags["dry-run"]);

  const spec = loadSpec(flags, context);
  const errors = validateSpec(spec);
  if (errors.length > 0) {
    throw new Error(`${SCRIPT_ID}: spec invalid:\n- ${errors.join("\n- ")}`);
  }

  const tomlObject = buildTomlObject(spec);
  const tomlText = TOML.stringify(tomlObject);

  let wrote = false;
  if (!dryRun) {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      throw new Error(`${SCRIPT_ID}: output directory does not exist: ${outputDir} (the caller must create the plan dir before writing the manifest)`);
    }
    if (!fs.statSync(outputDir).isDirectory()) {
      throw new Error(`${SCRIPT_ID}: output directory parent is not a directory: ${outputDir}`);
    }
    fs.writeFileSync(outputPath, tomlText, "utf8");
    wrote = true;
  }

  return JSON.stringify(
    {
      output: outputPath,
      dry_run: dryRun,
      wrote,
      total_phases: spec.plan.total_phases,
      bytes: Buffer.byteLength(tomlText, "utf8"),
      toml: tomlText,
    },
    null,
    2,
  );
}

module.exports = {
  id: SCRIPT_ID,
  name: "plan manifest write",
  description: "Validate a JSON plan spec and emit (or preview) plan.toml for a fabric planner plan",
  interface: {
    details: [
      "Validates the JSON spec against the plan / phase schema (required fields, enum values, kebab-case ids, file-name conventions, depends_on monotonicity, integration-entry shape) and either writes plan.toml or returns the rendered TOML in dry-run.",
      "Phase entries support skills_loaded[] and subagents_dispatched[] arrays so per-phase integration choices recorded by planner-brainstorm round-trip into the manifest verbatim.",
      "TOML emission uses @iarna/toml (declared as a kit dependency in package.json and installed by `fabric register`); entries are written in the canonical key order (no alphabetic re-sort) so reviewers can diff manifests deterministically against the spec.",
    ],
    usage: [
      "fabric script run plan-manifest-write --output <path-to-plan.toml> ( --spec '<json>' | --spec-file <path> ) [--dry-run]",
    ],
    parameters: [
      { name: "--output", type: "string", required: true, description: "Path to write plan.toml. Filename must be plan.toml; parent directory must already exist." },
      { name: "--spec", type: "string", required: false, description: "Inline JSON spec describing the plan and phases. Mutually exclusive with --spec-file." },
      { name: "--spec-file", type: "string", required: false, description: "Path to a JSON file containing the spec. Mutually exclusive with --spec." },
      { name: "--dry-run", type: "boolean", required: false, description: "Validate and render TOML but do not write. The rendered TOML is included in the returned JSON." },
    ],
    returns: "JSON object with output, dry_run, wrote, total_phases, bytes, and toml (the rendered TOML text).",
    examples: [
      {
        command: "fabric script run plan-manifest-write --output ./.fabric-plans/generate-prd-myapp/plan.toml --spec-file ./plan-spec.json",
        description: "Write plan.toml from a JSON spec stored next to the planner invocation.",
      },
      {
        command: "fabric script run plan-manifest-write --output ./.fabric-plans/generate-prd-myapp/plan.toml --spec-file ./plan-spec.json --dry-run",
        description: "Render TOML without writing; useful to compare against an existing manifest before overwriting.",
      },
    ],
    notes: [
      "Writes only the path passed as --output; throws if the parent directory does not exist (the planner is responsible for creating the plan_dir before invoking this script).",
      "depends_on values must reference earlier phase numbers strictly less than the current phase's number; phase numbering must be 1-based and contiguous.",
      "phases[].file and phases[].brief_file, when present, must follow the canonical phase-{NN}-{slug}.md / brief-{NN}-{slug}.md pattern; mismatches are validation errors.",
      "skills_loaded entries require {id, role, purpose} with role in {companion, tool}; subagents_dispatched entries require {name, role, purpose} with role in {delegate, companion-runner}.",
    ],
  },
  run,
};
