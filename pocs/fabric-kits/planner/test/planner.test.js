const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const planStatus = require("../scripts/plan-status");
const planResume = require("../scripts/plan-resume");
const planPhaseValidate = require("../scripts/plan-phase-validate");
const planBriefWrite = require("../scripts/plan-brief-write");
const planLint = require("../scripts/plan-lint");

function makePlanDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `planner-test-${label}-`));
}

function writePlanToml(planDir, body) {
  fs.writeFileSync(path.join(planDir, "plan.toml"), body, "utf8");
}

function makeContext(cwd) {
  return { cwd, env: process.env };
}

function runScript(script, args, cwd) {
  return JSON.parse(script.run(args, makeContext(cwd)));
}

test("plan-status throws when plan_dir does not exist", () => {
  const missing = path.join(os.tmpdir(), `planner-missing-${Date.now()}`);
  assert.throws(() => planStatus.run([missing], makeContext(process.cwd())), /plan-status.*not found/);
});

test("plan-status throws when plan.toml is missing inside plan_dir", () => {
  const planDir = makePlanDir("status-no-toml");
  try {
    assert.throws(() => planStatus.run([planDir], makeContext(process.cwd())), /plan\.toml/);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

const MINIMAL_PLAN_TOML = `[plan]
task = "generate PRD"
type = "generate"
target = "myapp"
target_key = "artifact:PRD:myapp"
kit_path = "/abs/kit"
created = "2026-04-27T00:00:00Z"
lifecycle = "gitignore"
execution_status = "not_started"
lifecycle_status = "done"
plan_dir = "/abs/plan"
active_plan_dir = "/abs/plan"
input_dir = ""
input_manifest = ""
input_signature = ""
input_chunks = []
total_phases = 3

[[phases]]
number = 1
title = "Overview"
slug = "overview"
file = "phase-01-overview.md"
brief_file = "brief-01-overview.md"
status = "pending"
kind = "delivery"
depends_on = []

[[phases]]
number = 2
title = "Requirements"
slug = "requirements"
file = "phase-02-requirements.md"
brief_file = "brief-02-requirements.md"
status = "pending"
kind = "delivery"
depends_on = [1]

[[phases]]
number = 3
title = "Acceptance"
slug = "acceptance"
file = "phase-03-acceptance.md"
brief_file = "brief-03-acceptance.md"
status = "pending"
kind = "delivery"
depends_on = [2]
`;

test("plan-status returns plan-level fields parsed from plan.toml", () => {
  const planDir = makePlanDir("status-fields");
  try {
    writePlanToml(planDir, MINIMAL_PLAN_TOML);
    const result = runScript(planStatus, [planDir], process.cwd());
    assert.equal(result.task, "generate PRD");
    assert.equal(result.type, "generate");
    assert.equal(result.target, "myapp");
    assert.equal(result.target_key, "artifact:PRD:myapp");
    assert.equal(result.execution_status, "not_started");
    assert.equal(result.lifecycle, "gitignore");
    assert.equal(result.lifecycle_status, "done");
    assert.equal(result.total_phases, 3);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-status returns phase_summary counting each status", () => {
  const planDir = makePlanDir("status-summary");
  try {
    const body = MINIMAL_PLAN_TOML
      .replace(/status = "pending"\nkind = "delivery"\ndepends_on = \[\]/, 'status = "done"\nkind = "delivery"\ndepends_on = []')
      .replace(/status = "pending"\nkind = "delivery"\ndepends_on = \[1\]/, 'status = "in_progress"\nkind = "delivery"\ndepends_on = [1]');
    writePlanToml(planDir, body);
    const result = runScript(planStatus, [planDir], process.cwd());
    assert.deepEqual(result.phase_summary, { pending: 1, in_progress: 1, done: 1, failed: 0 });
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-status returns next_executable as first pending phase whose depends_on are all done", () => {
  const planDir = makePlanDir("status-next-1");
  try {
    writePlanToml(planDir, MINIMAL_PLAN_TOML);
    const result = runScript(planStatus, [planDir], process.cwd());
    assert.equal(result.next_executable.number, 1);
    assert.equal(result.next_executable.reason, "ready");
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-status next_executable advances after a phase is marked done", () => {
  const planDir = makePlanDir("status-next-2");
  try {
    const body = MINIMAL_PLAN_TOML
      .replace(/status = "pending"\nkind = "delivery"\ndepends_on = \[\]/, 'status = "done"\nkind = "delivery"\ndepends_on = []');
    writePlanToml(planDir, body);
    const result = runScript(planStatus, [planDir], process.cwd());
    assert.equal(result.next_executable.number, 2);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-status next_executable is null when all phases are done", () => {
  const planDir = makePlanDir("status-next-done");
  try {
    const body = MINIMAL_PLAN_TOML.replace(/status = "pending"/g, 'status = "done"');
    writePlanToml(planDir, body);
    const result = runScript(planStatus, [planDir], process.cwd());
    assert.equal(result.next_executable, null);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-status next_executable is null when an upstream dependency is failed", () => {
  const planDir = makePlanDir("status-next-blocked");
  try {
    const body = MINIMAL_PLAN_TOML
      .replace(/status = "pending"\nkind = "delivery"\ndepends_on = \[\]/, 'status = "failed"\nkind = "delivery"\ndepends_on = []');
    writePlanToml(planDir, body);
    const result = runScript(planStatus, [planDir], process.cwd());
    assert.equal(result.next_executable, null);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

function stagePhaseArtifacts(planDir, { phaseFile, briefFile, outputs = [] }) {
  if (briefFile) fs.writeFileSync(path.join(planDir, briefFile), "# brief\n", "utf8");
  if (phaseFile) fs.writeFileSync(path.join(planDir, phaseFile), "# phase\n", "utf8");
  if (outputs.length > 0) {
    fs.mkdirSync(path.join(planDir, "out"), { recursive: true });
    for (const out of outputs) {
      fs.writeFileSync(path.join(planDir, out), "# intermediate\n", "utf8");
    }
  }
}

function planTomlWithStatuses(statuses) {
  const phases = statuses.map((status, idx) => {
    const number = idx + 1;
    const slug = status.slug || `phase${number}`;
    const dependsOn = status.depends_on || [];
    const outputs = status.outputs || [];
    const outputFiles = status.output_files || [];
    return [
      `[[phases]]`,
      `number = ${number}`,
      `title = "${status.title || `Phase ${number}`}"`,
      `slug = "${slug}"`,
      `file = "phase-${String(number).padStart(2, "0")}-${slug}.md"`,
      `brief_file = "brief-${String(number).padStart(2, "0")}-${slug}.md"`,
      `status = "${status.status || "pending"}"`,
      `kind = "delivery"`,
      `depends_on = [${dependsOn.join(", ")}]`,
      `input_files = []`,
      `output_files = [${outputFiles.map((f) => `"${f}"`).join(", ")}]`,
      `outputs = [${outputs.map((o) => `"${o}"`).join(", ")}]`,
      `inputs = []`,
      `template_sections = []`,
      `checklist_sections = []`,
    ].join("\n");
  }).join("\n\n");
  return [
    `[plan]`,
    `task = "test"`,
    `type = "generate"`,
    `target = "x"`,
    `target_key = "artifact:T:x"`,
    `kit_path = "/abs/kit"`,
    `created = "2026-04-27T00:00:00Z"`,
    `lifecycle = "${statuses.lifecycle || "gitignore"}"`,
    `execution_status = "in_progress"`,
    `lifecycle_status = "${statuses.lifecycle_status || "done"}"`,
    `plan_dir = "/abs/plan"`,
    `active_plan_dir = "/abs/plan"`,
    `input_dir = ""`,
    `input_manifest = ""`,
    `input_signature = ""`,
    `input_chunks = []`,
    `total_phases = ${statuses.length}`,
    ``,
    phases,
    ``,
  ].join("\n");
}

test("plan-resume throws when plan.toml is missing", () => {
  const planDir = makePlanDir("resume-no-toml");
  try {
    assert.throws(() => planResume.run([planDir], makeContext(process.cwd())), /plan\.toml/);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-resume reports no findings on a fully-staged healthy plan", () => {
  const planDir = makePlanDir("resume-healthy");
  try {
    const phases = [
      { status: "done", slug: "p1", outputs: ["out/phase-01-result.md"] },
      { status: "pending", slug: "p2", depends_on: [1] },
    ];
    writePlanToml(planDir, planTomlWithStatuses(phases));
    stagePhaseArtifacts(planDir, { briefFile: "brief-01-p1.md", phaseFile: "phase-01-p1.md", outputs: ["out/phase-01-result.md"] });
    stagePhaseArtifacts(planDir, { briefFile: "brief-02-p2.md", phaseFile: "phase-02-p2.md" });
    const result = runScript(planResume, [planDir], process.cwd());
    assert.deepEqual(result.audit_findings, []);
    assert.deepEqual(result.phases_to_reopen, []);
    assert.equal(result.next_executable.number, 2);
    assert.equal(result.applied, false);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-resume flags a done phase whose intermediate output is missing", () => {
  const planDir = makePlanDir("resume-missing-out");
  try {
    const phases = [
      { status: "done", slug: "p1", outputs: ["out/phase-01-result.md"] },
      { status: "pending", slug: "p2", depends_on: [1] },
    ];
    writePlanToml(planDir, planTomlWithStatuses(phases));
    stagePhaseArtifacts(planDir, { briefFile: "brief-01-p1.md", phaseFile: "phase-01-p1.md" });
    stagePhaseArtifacts(planDir, { briefFile: "brief-02-p2.md", phaseFile: "phase-02-p2.md" });
    const result = runScript(planResume, [planDir], process.cwd());
    assert.equal(result.audit_findings.length, 1);
    assert.match(result.audit_findings[0].issue, /missing[-_]output/i);
    assert.equal(result.audit_findings[0].phase, 1);
    assert.deepEqual(result.phases_to_reopen, [1]);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-resume flags a done phase whose brief or phase file was deleted", () => {
  const planDir = makePlanDir("resume-missing-brief");
  try {
    const phases = [{ status: "done", slug: "p1" }];
    writePlanToml(planDir, planTomlWithStatuses(phases));
    const result = runScript(planResume, [planDir], process.cwd());
    const issues = result.audit_findings.map((f) => f.issue).sort();
    assert.deepEqual(issues, ["missing-brief-file", "missing-phase-file"]);
    assert.deepEqual(result.phases_to_reopen, [1]);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-resume reopens downstream dependents when an upstream phase is reopened", () => {
  const planDir = makePlanDir("resume-cascade");
  try {
    const phases = [
      { status: "done", slug: "p1" },
      { status: "done", slug: "p2", depends_on: [1] },
      { status: "done", slug: "p3", depends_on: [2] },
    ];
    writePlanToml(planDir, planTomlWithStatuses(phases));
    stagePhaseArtifacts(planDir, { briefFile: "brief-02-p2.md", phaseFile: "phase-02-p2.md" });
    stagePhaseArtifacts(planDir, { briefFile: "brief-03-p3.md", phaseFile: "phase-03-p3.md" });
    const result = runScript(planResume, [planDir], process.cwd());
    assert.deepEqual(result.phases_to_reopen.sort((a, b) => a - b), [1, 2, 3]);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-resume exempts brief / phase / out absences when lifecycle=cleanup and lifecycle_status=done", () => {
  const planDir = makePlanDir("resume-cleanup-exempt");
  try {
    const phases = [
      { status: "done", slug: "p1", outputs: ["out/phase-01-result.md"] },
      { status: "done", slug: "p2", depends_on: [1] },
    ];
    phases.lifecycle = "cleanup";
    phases.lifecycle_status = "done";
    writePlanToml(planDir, planTomlWithStatuses(phases));
    const result = runScript(planResume, [planDir], process.cwd());
    assert.deepEqual(result.audit_findings, []);
    assert.deepEqual(result.phases_to_reopen, []);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-resume default does not mutate plan.toml", () => {
  const planDir = makePlanDir("resume-no-mutate");
  try {
    const body = planTomlWithStatuses([{ status: "done", slug: "p1" }]);
    writePlanToml(planDir, body);
    runScript(planResume, [planDir], process.cwd());
    assert.equal(fs.readFileSync(path.join(planDir, "plan.toml"), "utf8"), body);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-resume with --apply rewrites plan.toml downgrading reopened phases and resetting lifecycle_status", () => {
  const planDir = makePlanDir("resume-apply");
  try {
    const phases = [{ status: "done", slug: "p1" }];
    writePlanToml(planDir, planTomlWithStatuses(phases));
    const result = runScript(planResume, [planDir, "--apply"], process.cwd());
    assert.equal(result.applied, true);
    const TOML = require(path.join(__dirname, "..", "node_modules", "@iarna", "toml"));
    const reread = TOML.parse(fs.readFileSync(path.join(planDir, "plan.toml"), "utf8"));
    assert.equal(reread.phases[0].status, "pending");
    assert.equal(reread.plan.execution_status, "in_progress");
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

const HEALTHY_PHASE_BODY = `# Phase 1: Overview

## Context Boundary
Disregard all previous chat context.

## Phase Metadata
- Plan: \`/abs/plan/plan.toml\`
- Phase: 1 of 3

## Load
1. Read brief from disk.

## Dispatch
- Inline.

## Task
Do the thing.

## Rules
- MUST do X.

## User Decisions
None.

## Output Format
- File: docs/PRD.md

## Acceptance Criteria
- [ ] File exists.

## Handoff
On success: report done.
`;

const MINIMAL_BRIEF_BODY = `# Brief 1: Overview

## Context Boundary
Self-contained.

## Phase Metadata
- Phase: 1

## Load Instructions
- path = ...

## Phase File Structure
H2 headings: Context Boundary, Phase Metadata, Load, Dispatch, Task, Rules, User Decisions, Output Format, Acceptance Criteria, Handoff.

## Rules To Inline
none

## User Decisions To Embed
none

## Acceptance Criteria For The Compiled Phase File
- All headings present.
`;

function writePhaseAndBrief(dir, phaseBody = HEALTHY_PHASE_BODY, briefBody = MINIMAL_BRIEF_BODY) {
  const phasePath = path.join(dir, "phase-01-overview.md");
  const briefPath = path.join(dir, "brief-01-overview.md");
  fs.writeFileSync(phasePath, phaseBody, "utf8");
  fs.writeFileSync(briefPath, briefBody, "utf8");
  return { phasePath, briefPath };
}

test("plan-phase-validate throws when phase file or brief is missing", () => {
  const dir = makePlanDir("validate-missing");
  try {
    assert.throws(
      () => planPhaseValidate.run([path.join(dir, "missing.md"), path.join(dir, "brief.md")], makeContext(process.cwd())),
      /not found/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-phase-validate returns overall PASS for a healthy phase file", () => {
  const dir = makePlanDir("validate-healthy");
  try {
    const { phasePath, briefPath } = writePhaseAndBrief(dir);
    const result = runScript(planPhaseValidate, [phasePath, briefPath], process.cwd());
    assert.equal(result.overall, "PASS");
    assert.equal(result.categories.line_budget.status, "PASS");
    assert.equal(result.categories.unresolved_placeholders.status, "PASS");
    assert.equal(result.categories.required_headings.status, "PASS");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-phase-validate FAILs line_budget when the phase file exceeds the limit", () => {
  const dir = makePlanDir("validate-oversize");
  try {
    const oversized = HEALTHY_PHASE_BODY + Array(1100).fill("filler line").join("\n") + "\n";
    const { phasePath, briefPath } = writePhaseAndBrief(dir, oversized);
    const result = runScript(planPhaseValidate, [phasePath, briefPath], process.cwd());
    assert.equal(result.categories.line_budget.status, "FAIL");
    assert.ok(result.categories.line_budget.lines > 1000);
    assert.equal(result.overall, "FAIL");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-phase-validate FAILs unresolved_placeholders when {placeholder} appears outside fenced code blocks", () => {
  const dir = makePlanDir("validate-placeholders");
  try {
    const body = HEALTHY_PHASE_BODY.replace("Do the thing.", "Do {N} {slug} things.");
    const { phasePath, briefPath } = writePhaseAndBrief(dir, body);
    const result = runScript(planPhaseValidate, [phasePath, briefPath], process.cwd());
    assert.equal(result.categories.unresolved_placeholders.status, "FAIL");
    assert.ok(result.categories.unresolved_placeholders.occurrences.length >= 2);
    assert.equal(result.overall, "FAIL");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-phase-validate ignores {placeholders} that appear inside fenced code blocks", () => {
  const dir = makePlanDir("validate-placeholders-fenced");
  try {
    const body = HEALTHY_PHASE_BODY + "\n\n## Extra fenced\n\n\`\`\`text\n{N} and {slug} are fine inside fences\n\`\`\`\n";
    const { phasePath, briefPath } = writePhaseAndBrief(dir, body);
    const result = runScript(planPhaseValidate, [phasePath, briefPath], process.cwd());
    assert.equal(result.categories.unresolved_placeholders.status, "PASS");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-phase-validate FAILs required_headings when a required H2 is missing", () => {
  const dir = makePlanDir("validate-missing-h2");
  try {
    const body = HEALTHY_PHASE_BODY.replace("## Dispatch\n- Inline.\n\n", "");
    const { phasePath, briefPath } = writePhaseAndBrief(dir, body);
    const result = runScript(planPhaseValidate, [phasePath, briefPath], process.cwd());
    assert.equal(result.categories.required_headings.status, "FAIL");
    assert.ok(result.categories.required_headings.missing.includes("Dispatch"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeBriefSpec(overrides = {}) {
  return {
    number: 1,
    total_phases: 2,
    title: "Overview and Actors",
    slug: "overview",
    phase_file: "phase-01-overview.md",
    brief_file: "brief-01-overview.md",
    plan_dir: "/abs/plan",
    kind: "delivery",
    depends_on: [],
    inputs: [],
    output_files: ["docs/PRD.md"],
    outputs: ["out/phase-01-actors.md"],
    template_sections: [1, 2],
    checklist_sections: [],
    skills_loaded: [{ id: "prd-template", role: "companion", purpose: "PRD layout" }],
    subagents_dispatched: [],
    phase_file_lines: 380,
    load_instructions: [
      { path: "/abs/kit/template.md", reason: "extract sections 1-2", sections: "H2 1-2" },
    ],
    rules_to_inline: [
      { source: "prd-template", section: "H2 Overview", purpose: "PRD overview headings" },
    ],
    user_decisions: [],
    ...overrides,
  };
}

test("plan-brief-write throws when --spec and --spec-file are both missing", () => {
  const dir = makePlanDir("brief-no-spec");
  const outPath = path.join(dir, "brief-01-overview.md");
  try {
    assert.throws(
      () => planBriefWrite.run(["--output", outPath], makeContext(process.cwd())),
      /--spec/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-brief-write throws when spec is missing required fields", () => {
  const dir = makePlanDir("brief-bad-spec");
  const outPath = path.join(dir, "brief-01-overview.md");
  try {
    const incomplete = { number: 1 };
    assert.throws(
      () => planBriefWrite.run(["--output", outPath, "--spec", JSON.stringify(incomplete)], makeContext(process.cwd())),
      /title|slug|brief_file|phase_file|total_phases/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-brief-write writes a brief file with all required H2 headings in order", () => {
  const dir = makePlanDir("brief-write-headings");
  const outPath = path.join(dir, "brief-01-overview.md");
  try {
    runScript(planBriefWrite, ["--output", outPath, "--spec", JSON.stringify(makeBriefSpec())], process.cwd());
    const body = fs.readFileSync(outPath, "utf8");
    const headings = ["Context Boundary", "Phase Metadata", "Load Instructions", "Phase File Structure", "Rules To Inline", "User Decisions To Embed", "Acceptance Criteria For The Compiled Phase File"];
    let lastIndex = -1;
    for (const heading of headings) {
      const idx = body.indexOf(`## ${heading}`);
      assert.ok(idx > lastIndex, `heading "${heading}" missing or out of order`);
      lastIndex = idx;
    }
    assert.match(body, /^# Brief 1: Overview and Actors/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-brief-write embeds load instructions, rules, and skills_loaded entries", () => {
  const dir = makePlanDir("brief-write-content");
  const outPath = path.join(dir, "brief-01-overview.md");
  try {
    runScript(planBriefWrite, ["--output", outPath, "--spec", JSON.stringify(makeBriefSpec())], process.cwd());
    const body = fs.readFileSync(outPath, "utf8");
    assert.match(body, /\/abs\/kit\/template\.md/);
    assert.match(body, /extract sections 1-2/);
    assert.match(body, /prd-template/);
    assert.match(body, /PRD overview headings/);
    assert.match(body, /companion/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-brief-write writes 'none' under User Decisions when none are provided", () => {
  const dir = makePlanDir("brief-write-decisions-empty");
  const outPath = path.join(dir, "brief-01-overview.md");
  try {
    runScript(planBriefWrite, ["--output", outPath, "--spec", JSON.stringify(makeBriefSpec())], process.cwd());
    const body = fs.readFileSync(outPath, "utf8");
    const decisionsBlock = body.split("## User Decisions To Embed")[1].split("##")[0];
    assert.match(decisionsBlock, /none/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-brief-write embeds each user decision when provided", () => {
  const dir = makePlanDir("brief-write-decisions");
  const outPath = path.join(dir, "brief-01-overview.md");
  try {
    const spec = makeBriefSpec({
      user_decisions: [
        { question: "Use OAuth or SSO?", options: ["OAuth", "SSO"], default: "OAuth", record_in: "manifest:plan.auth_choice" },
      ],
    });
    runScript(planBriefWrite, ["--output", outPath, "--spec", JSON.stringify(spec)], process.cwd());
    const body = fs.readFileSync(outPath, "utf8");
    assert.match(body, /Use OAuth or SSO\?/);
    assert.match(body, /OAuth/);
    assert.match(body, /manifest:plan\.auth_choice/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function stageHealthyPlan(planDir) {
  const phases = [
    { status: "pending", slug: "p1", outputs: [] },
    { status: "pending", slug: "p2", depends_on: [1] },
  ];
  writePlanToml(planDir, planTomlWithStatuses(phases));
  for (const phase of [{ n: 1, slug: "p1" }, { n: 2, slug: "p2" }]) {
    const padded = String(phase.n).padStart(2, "0");
    fs.writeFileSync(path.join(planDir, `brief-${padded}-${phase.slug}.md`), "# brief\n", "utf8");
    fs.writeFileSync(path.join(planDir, `phase-${padded}-${phase.slug}.md`), "# phase\n", "utf8");
  }
}

test("plan-lint throws when plan.toml is missing", () => {
  const planDir = makePlanDir("lint-no-toml");
  try {
    assert.throws(() => planLint.run([planDir], makeContext(process.cwd())), /plan\.toml/);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-lint returns overall PASS for a healthy plan", () => {
  const planDir = makePlanDir("lint-healthy");
  try {
    stageHealthyPlan(planDir);
    const result = runScript(planLint, [planDir], process.cwd());
    assert.equal(result.overall, "PASS");
    assert.equal(result.categories.manifest_schema.status, "PASS");
    assert.equal(result.categories.lifecycle.status, "PASS");
    assert.equal(result.categories.structural.status, "PASS");
    assert.equal(result.categories.file_presence.status, "PASS");
    assert.equal(result.categories.budget.status, "PASS");
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-lint FAILs file_presence when a brief or phase file is missing", () => {
  const planDir = makePlanDir("lint-missing-file");
  try {
    stageHealthyPlan(planDir);
    fs.unlinkSync(path.join(planDir, "phase-02-p2.md"));
    const result = runScript(planLint, [planDir], process.cwd());
    assert.equal(result.categories.file_presence.status, "FAIL");
    assert.equal(result.categories.file_presence.missing_files.length, 1);
    assert.match(result.categories.file_presence.missing_files[0].path, /phase-02-p2\.md$/);
    assert.equal(result.overall, "FAIL");
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-lint FAILs structural when phase numbering is non-contiguous", () => {
  const planDir = makePlanDir("lint-numbering");
  try {
    stageHealthyPlan(planDir);
    const body = fs.readFileSync(path.join(planDir, "plan.toml"), "utf8").replace(/number = 2/, "number = 3");
    fs.writeFileSync(path.join(planDir, "plan.toml"), body, "utf8");
    const result = runScript(planLint, [planDir], process.cwd());
    assert.equal(result.categories.structural.status, "FAIL");
    assert.ok(result.categories.structural.issues.some((i) => /numbering|expected/.test(i.issue)));
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-lint FAILs structural when depends_on references a non-existent phase", () => {
  const planDir = makePlanDir("lint-bad-depends-on");
  try {
    stageHealthyPlan(planDir);
    const body = fs.readFileSync(path.join(planDir, "plan.toml"), "utf8").replace(/depends_on = \[1\]/, "depends_on = [99]");
    fs.writeFileSync(path.join(planDir, "plan.toml"), body, "utf8");
    const result = runScript(planLint, [planDir], process.cwd());
    assert.equal(result.categories.structural.status, "FAIL");
    assert.ok(result.categories.structural.issues.some((i) => /depends_on/.test(i.issue)));
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-lint FAILs lifecycle when lifecycle is not one of the allowed enum values", () => {
  const planDir = makePlanDir("lint-bad-lifecycle");
  try {
    stageHealthyPlan(planDir);
    const body = fs.readFileSync(path.join(planDir, "plan.toml"), "utf8").replace(/lifecycle = "gitignore"/, 'lifecycle = "bogus"');
    fs.writeFileSync(path.join(planDir, "plan.toml"), body, "utf8");
    const result = runScript(planLint, [planDir], process.cwd());
    assert.equal(result.categories.lifecycle.status, "FAIL");
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-lint FAILs budget when a phase file exceeds 1000 lines", () => {
  const planDir = makePlanDir("lint-budget");
  try {
    stageHealthyPlan(planDir);
    const oversized = "# phase\n" + Array(1100).fill("filler line").join("\n") + "\n";
    fs.writeFileSync(path.join(planDir, "phase-01-p1.md"), oversized, "utf8");
    const result = runScript(planLint, [planDir], process.cwd());
    assert.equal(result.categories.budget.status, "FAIL");
    assert.equal(result.categories.budget.over_budget.length, 1);
    assert.match(result.categories.budget.over_budget[0].path, /phase-01-p1\.md$/);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test("plan-brief-write --dry-run does not write the file", () => {
  const dir = makePlanDir("brief-write-dryrun");
  const outPath = path.join(dir, "brief-01-overview.md");
  try {
    const result = runScript(planBriefWrite, ["--output", outPath, "--spec", JSON.stringify(makeBriefSpec()), "--dry-run"], process.cwd());
    assert.equal(result.wrote, false);
    assert.equal(fs.existsSync(outPath), false);
    assert.match(result.markdown, /^# Brief 1: Overview and Actors/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-phase-validate FAILs required_headings when H2 order is wrong", () => {
  const dir = makePlanDir("validate-h2-order");
  try {
    const body = HEALTHY_PHASE_BODY.replace(
      "## Load\n1. Read brief from disk.\n\n## Dispatch\n- Inline.\n\n",
      "## Dispatch\n- Inline.\n\n## Load\n1. Read brief from disk.\n\n",
    );
    const { phasePath, briefPath } = writePhaseAndBrief(dir, body);
    const result = runScript(planPhaseValidate, [phasePath, briefPath], process.cwd());
    assert.equal(result.categories.required_headings.status, "FAIL");
    assert.equal(result.categories.required_headings.out_of_order, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-status returns each phase summary with number, title, status, depends_on", () => {
  const planDir = makePlanDir("status-phases");
  try {
    writePlanToml(planDir, MINIMAL_PLAN_TOML);
    const result = runScript(planStatus, [planDir], process.cwd());
    assert.equal(result.phases.length, 3);
    assert.deepEqual(result.phases[0], { number: 1, title: "Overview", slug: "overview", status: "pending", kind: "delivery", depends_on: [] });
    assert.deepEqual(result.phases[1].depends_on, [1]);
  } finally {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});
