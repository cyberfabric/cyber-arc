const fs = require("node:fs");
const path = require("node:path");
const { parseArgs, requireString } = require("../lib/args");

const SCRIPT_ID = "plan-brief-write";

const PARSE_SCHEMA = {
  booleans: new Set(["dry-run"]),
  repeats: new Set(),
};

const REQUIRED_FIELDS = [
  "number",
  "total_phases",
  "title",
  "slug",
  "phase_file",
  "brief_file",
];

function resolveAbsolutePath(rawPath, cwd) {
  return path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
}

function loadSpec(flags, context) {
  const inline = flags["spec"];
  const fileArg = flags["spec-file"];
  if ((inline && fileArg) || (!inline && !fileArg)) {
    throw new Error(`${SCRIPT_ID}: pass exactly one of --spec or --spec-file`);
  }
  let raw;
  if (fileArg) {
    const abs = resolveAbsolutePath(fileArg, context.cwd);
    if (!fs.existsSync(abs)) throw new Error(`${SCRIPT_ID}: --spec-file not found: ${abs}`);
    raw = fs.readFileSync(abs, "utf8");
  } else {
    raw = inline;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${SCRIPT_ID}: spec is not valid JSON (${error.message})`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${SCRIPT_ID}: spec must be a JSON object`);
  }
  return parsed;
}

function validateSpec(spec) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(spec, field)) {
      errors.push(`spec.${field}: required`);
    }
  }
  if (typeof spec.number === "number" && Number.isInteger(spec.number)) {
    const padded = String(spec.number).padStart(2, "0");
    if (typeof spec.phase_file === "string" && typeof spec.slug === "string" && spec.phase_file !== `phase-${padded}-${spec.slug}.md`) {
      errors.push(`spec.phase_file: expected phase-${padded}-${spec.slug}.md (got ${JSON.stringify(spec.phase_file)})`);
    }
    if (typeof spec.brief_file === "string" && typeof spec.slug === "string" && spec.brief_file !== `brief-${padded}-${spec.slug}.md`) {
      errors.push(`spec.brief_file: expected brief-${padded}-${spec.slug}.md (got ${JSON.stringify(spec.brief_file)})`);
    }
  }
  return errors;
}

function formatList(items, formatter, fallback = "_(none)_") {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.map((item) => `- ${formatter(item)}`).join("\n");
}

function formatLoadInstruction(entry) {
  const fields = [];
  if (entry.path) fields.push(`path = \`${entry.path}\``);
  if (entry.sections) fields.push(`sections = ${entry.sections}`);
  if (entry.reason) fields.push(`reason = ${entry.reason}`);
  return fields.join(", ");
}

function formatRule(entry) {
  const fields = [];
  if (entry.source) fields.push(`source = \`${entry.source}\``);
  if (entry.section) fields.push(`section = ${entry.section}`);
  if (entry.purpose) fields.push(`purpose = ${entry.purpose}`);
  return fields.join(", ");
}

function formatSkill(entry) {
  return `${entry.id} (role=${entry.role}, ${entry.purpose})`;
}

function formatSubagent(entry) {
  return `${entry.name} (role=${entry.role}, ${entry.purpose})`;
}

function formatDecision(entry) {
  const opts = Array.isArray(entry.options) ? entry.options.join(" | ") : "";
  return `question: "${entry.question}"; options: [${opts}]; default: ${entry.default}; record_in: ${entry.record_in}`;
}

function renderBrief(spec) {
  const skillsCompanions = (spec.skills_loaded || []).filter((s) => s.role === "companion");
  const skillsTools = (spec.skills_loaded || []).filter((s) => s.role === "tool");
  const subagents = spec.subagents_dispatched || [];
  const decisions = spec.user_decisions || [];

  const lines = [];
  lines.push(`# Brief ${spec.number}: ${spec.title}`);
  lines.push("");
  lines.push("## Context Boundary");
  lines.push("The phase compiled from this brief is self-contained. The compiler MUST read this brief from disk before writing the phase file. Do not enrich the phase file with content not named here.");
  lines.push("");
  lines.push("## Phase Metadata");
  lines.push(`- Plan: \`${spec.plan_dir || ""}/plan.toml\``);
  lines.push(`- Phase: ${spec.number} of ${spec.total_phases}`);
  lines.push(`- Slug: ${spec.slug}`);
  lines.push(`- Phase file: \`${spec.plan_dir || ""}/${spec.phase_file}\``);
  lines.push(`- Kind: ${spec.kind || "delivery"}`);
  lines.push(`- Depends on: [${(spec.depends_on || []).join(", ")}]`);
  lines.push(`- Inputs: [${(spec.inputs || []).map((i) => `\`${i}\``).join(", ")}]`);
  lines.push(`- Output files: [${(spec.output_files || []).map((o) => `\`${o}\``).join(", ")}]`);
  lines.push(`- Intermediate outputs: [${(spec.outputs || []).map((o) => `\`${o}\``).join(", ")}]`);
  if (Array.isArray(spec.template_sections) && spec.template_sections.length > 0) {
    lines.push(`- Template sections: [${spec.template_sections.join(", ")}]`);
  }
  if (Array.isArray(spec.checklist_sections) && spec.checklist_sections.length > 0) {
    lines.push(`- Checklist sections: [${spec.checklist_sections.join(", ")}]`);
  }
  lines.push(`- Skills loaded as companions: ${skillsCompanions.length === 0 ? "_(none)_" : skillsCompanions.map(formatSkill).join("; ")}`);
  if (skillsTools.length > 0) {
    lines.push(`- Skills invoked as tools: ${skillsTools.map(formatSkill).join("; ")}`);
  }
  lines.push(`- Sub-agents dispatched: ${subagents.length === 0 ? "_(none)_" : subagents.map(formatSubagent).join("; ")}`);
  lines.push(`- Estimated phase file size: ~${spec.phase_file_lines || "?"} lines`);
  lines.push("");
  lines.push("## Load Instructions");
  lines.push("Files the compiler MUST read before assembling the phase file. The compiler MUST NOT load files outside this list.");
  lines.push("");
  lines.push(formatList(spec.load_instructions, formatLoadInstruction));
  lines.push("");
  lines.push("## Phase File Structure");
  lines.push("The compiler MUST emit a phase file whose H2 headings, in order, are exactly: `Context Boundary`, `Phase Metadata`, `Load`, `Dispatch`, `Task`, `Rules`, `User Decisions`, `Output Format`, `Acceptance Criteria`, `Handoff`. See `plan-template` for canonical body of each section.");
  lines.push("");
  lines.push("## Rules To Inline");
  lines.push("Every applicable rule the phase file MUST carry verbatim under its `Rules` heading. NEVER summarize.");
  lines.push("");
  lines.push(formatList(spec.rules_to_inline, formatRule));
  lines.push("");
  lines.push("## User Decisions To Embed");
  lines.push(decisions.length === 0
    ? "none"
    : formatList(decisions, formatDecision));
  lines.push("");
  lines.push("## Acceptance Criteria For The Compiled Phase File");
  lines.push("- [ ] All headings (Context Boundary → Handoff) present in order.");
  lines.push("- [ ] Every Rules To Inline entry present verbatim under Rules.");
  lines.push("- [ ] Every User Decisions To Embed entry present under User Decisions.");
  lines.push("- [ ] No unresolved `{...}` placeholders outside fenced code blocks.");
  lines.push(`- [ ] Phase file size ≤ 1000 lines, total runtime context ≤ 2000 lines.`);
  lines.push(`- [ ] output_files = [${(spec.output_files || []).map((o) => `\`${o}\``).join(", ")}]; outputs = [${(spec.outputs || []).map((o) => `\`${o}\``).join(", ")}].`);
  lines.push("");
  return lines.join("\n");
}

function run(args, context) {
  const { flags, positionals } = parseArgs(args, PARSE_SCHEMA);
  if (positionals.length > 0) {
    throw new Error(`${SCRIPT_ID}: unexpected positional argument: ${positionals[0]}`);
  }
  const outputRaw = requireString(flags, "output", SCRIPT_ID);
  const outputPath = resolveAbsolutePath(outputRaw, context.cwd);
  const dryRun = Boolean(flags["dry-run"]);

  const spec = loadSpec(flags, context);
  const errors = validateSpec(spec);
  if (errors.length > 0) {
    throw new Error(`${SCRIPT_ID}: spec invalid:\n- ${errors.join("\n- ")}`);
  }

  const markdown = renderBrief(spec);

  let wrote = false;
  if (!dryRun) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      throw new Error(`${SCRIPT_ID}: output directory does not exist: ${dir}`);
    }
    if (!fs.statSync(dir).isDirectory()) {
      throw new Error(`${SCRIPT_ID}: output directory parent is not a directory: ${dir}`);
    }
    fs.writeFileSync(outputPath, markdown, "utf8");
    wrote = true;
  }

  return JSON.stringify(
    {
      output: outputPath,
      dry_run: dryRun,
      wrote,
      bytes: Buffer.byteLength(markdown, "utf8"),
      markdown,
    },
    null,
    2,
  );
}

module.exports = {
  id: SCRIPT_ID,
  name: "plan brief write",
  description: "Render a brief-{NN}-{slug}.md from a JSON brief spec; the brief is the contract between decomposition and phase-file compilation",
  interface: {
    details: [
      "Reads a JSON spec describing a single phase brief and writes a markdown brief file matching the plan-brief-template structure.",
      "Validates required fields (number, total_phases, title, slug, phase_file, brief_file) and that phase_file / brief_file follow the canonical phase-{NN}-{slug}.md / brief-{NN}-{slug}.md naming.",
      "Renders Phase Metadata, Load Instructions, Phase File Structure (canonical heading list), Rules To Inline, User Decisions To Embed (or 'none'), and the Acceptance Criteria checklist.",
    ],
    usage: ["fabric-poc script run plan-brief-write --output <path> ( --spec '<json>' | --spec-file <path> ) [--dry-run]"],
    parameters: [
      { name: "--output", type: "string", required: true, description: "Path to write brief-{NN}-{slug}.md. Parent directory must already exist." },
      { name: "--spec", type: "string", required: false, description: "Inline JSON spec. Mutually exclusive with --spec-file." },
      { name: "--spec-file", type: "string", required: false, description: "Path to a JSON file containing the spec. Mutually exclusive with --spec." },
      { name: "--dry-run", type: "boolean", required: false, description: "Render and validate but do not write. The rendered markdown is included in the returned JSON." },
    ],
    returns: "JSON object with output, dry_run, wrote, bytes, and markdown (the rendered brief markdown).",
    examples: [
      { command: "fabric-poc script run plan-brief-write --output ./.fabric-plans/x/brief-01-overview.md --spec-file ./brief-01.json", description: "Write a brief from a JSON spec file." },
    ],
    notes: [
      "Writes only the path passed as --output; throws if the parent directory does not exist (the planner is responsible for creating plan_dir before writing briefs).",
      "Spec fields beyond the required set are optional — load_instructions, rules_to_inline, skills_loaded, subagents_dispatched, user_decisions, template_sections, checklist_sections, depends_on, inputs, outputs, output_files, kind, plan_dir, phase_file_lines.",
    ],
  },
  run,
};
