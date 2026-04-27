const fs = require("node:fs");
const path = require("node:path");

const SCRIPT_ID = "plan-phase-validate";

const REQUIRED_HEADINGS = [
  "Context Boundary",
  "Phase Metadata",
  "Load",
  "Dispatch",
  "Task",
  "Rules",
  "User Decisions",
  "Output Format",
  "Acceptance Criteria",
  "Handoff",
];

const PHASE_LINE_BUDGET = 1000;
const PLACEHOLDER_PATTERN = /\{[A-Za-z_][A-Za-z0-9_.\[\]= "',-]*\}/g;
const FENCE_PATTERN = /```[\s\S]*?```/g;
const H2_PATTERN = /^##\s+(.+?)\s*$/gm;

function resolveAbsolutePath(rawPath, cwd) {
  return path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
}

function loadFile(absPath, role) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`${SCRIPT_ID}: ${role} not found: ${absPath}`);
  }
  if (!fs.statSync(absPath).isFile()) {
    throw new Error(`${SCRIPT_ID}: ${role} is not a file: ${absPath}`);
  }
  return fs.readFileSync(absPath, "utf8");
}

function countLines(text) {
  if (!text) return 0;
  const newlineCount = (text.match(/\n/g) || []).length;
  return text.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function stripFencedBlocks(text) {
  return text.replace(FENCE_PATTERN, "");
}

function findUnresolvedPlaceholders(phaseText) {
  const stripped = stripFencedBlocks(phaseText);
  const occurrences = [];
  let match;
  PLACEHOLDER_PATTERN.lastIndex = 0;
  while ((match = PLACEHOLDER_PATTERN.exec(stripped)) !== null) {
    occurrences.push({ token: match[0] });
  }
  return occurrences;
}

function extractHeadings(text) {
  const stripped = stripFencedBlocks(text);
  const headings = [];
  let match;
  H2_PATTERN.lastIndex = 0;
  while ((match = H2_PATTERN.exec(stripped)) !== null) {
    headings.push(match[1]);
  }
  return headings;
}

function validateHeadings(actualHeadings) {
  const missing = REQUIRED_HEADINGS.filter((required) => !actualHeadings.includes(required));
  if (missing.length > 0) {
    return { status: "FAIL", missing, out_of_order: false };
  }
  const indices = REQUIRED_HEADINGS.map((required) => actualHeadings.indexOf(required));
  for (let i = 1; i < indices.length; i += 1) {
    if (indices[i] < indices[i - 1]) {
      return { status: "FAIL", missing: [], out_of_order: true };
    }
  }
  return { status: "PASS", missing: [], out_of_order: false };
}

function run(args, context) {
  if (args.length !== 2) {
    throw new Error(`${SCRIPT_ID}: expected exactly two arguments <phase_file> <brief_file>, got ${args.length}`);
  }
  const phasePath = resolveAbsolutePath(args[0], context.cwd);
  const briefPath = resolveAbsolutePath(args[1], context.cwd);
  const phaseText = loadFile(phasePath, "phase file");
  loadFile(briefPath, "brief file");

  const lineCount = countLines(phaseText);
  const lineBudget = lineCount <= PHASE_LINE_BUDGET
    ? { status: "PASS", lines: lineCount, budget: PHASE_LINE_BUDGET }
    : { status: "FAIL", lines: lineCount, budget: PHASE_LINE_BUDGET };

  const occurrences = findUnresolvedPlaceholders(phaseText);
  const placeholders = occurrences.length === 0
    ? { status: "PASS", occurrences: [] }
    : { status: "FAIL", occurrences };

  const headings = extractHeadings(phaseText);
  const headingResult = validateHeadings(headings);

  const overall = [lineBudget.status, placeholders.status, headingResult.status].every((s) => s === "PASS")
    ? "PASS"
    : "FAIL";

  return JSON.stringify(
    {
      phase_file: phasePath,
      brief_file: briefPath,
      phase_file_lines: lineCount,
      categories: {
        line_budget: lineBudget,
        unresolved_placeholders: placeholders,
        required_headings: headingResult,
      },
      overall,
    },
    null,
    2,
  );
}

module.exports = {
  id: SCRIPT_ID,
  name: "plan phase validate",
  description: "Validate a compiled phase file against its brief: line-budget, unresolved {placeholders} outside fences, and required H2 heading set + order",
  interface: {
    details: [
      "Reads <phase_file> and confirms <brief_file> exists. Validates three categories deterministically:",
      "1) line_budget: phase file size ≤ 1000 lines (the runtime context budget assumes ≤ 2000 total including inputs/outputs; the file itself stays under 1000).",
      "2) unresolved_placeholders: regex-matches {placeholder} tokens outside fenced ```code``` blocks. Inside-fence placeholders are intentional examples and PASS.",
      "3) required_headings: the phase file MUST have these H2 headings in this order — Context Boundary, Phase Metadata, Load, Dispatch, Task, Rules, User Decisions, Output Format, Acceptance Criteria, Handoff.",
    ],
    usage: ["fabric script run plan-phase-validate <phase_file> <brief_file>"],
    parameters: [
      { name: "phase_file", type: "string", required: true, description: "Absolute or cwd-relative path to phase-{NN}-{slug}.md." },
      { name: "brief_file", type: "string", required: true, description: "Absolute or cwd-relative path to the corresponding brief-{NN}-{slug}.md (presence check only in this version)." },
    ],
    returns: "JSON object with phase_file, brief_file, phase_file_lines, categories {line_budget, unresolved_placeholders, required_headings}, and overall PASS/FAIL.",
    examples: [
      { command: "fabric script run plan-phase-validate ./.fabric-plans/x/phase-01-overview.md ./.fabric-plans/x/brief-01-overview.md", description: "Validate a compiled phase file against its brief." },
    ],
    notes: [
      "Read-only. Does not modify either file.",
      "Brief alignment beyond presence (rules-completeness, declared-skills cross-check, output_files match) is intentionally out of scope here; those checks belong in plan-lint where the full plan manifest provides cross-reference data.",
    ],
  },
  run,
};
