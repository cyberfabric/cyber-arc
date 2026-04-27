const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const planStatus = require("../scripts/plan-status");
const planResume = require("../scripts/plan-resume");

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
