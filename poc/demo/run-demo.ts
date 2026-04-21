#!/usr/bin/env npx tsx
// Cyber Fabric PoC Demo Runner
// Demonstrates end-to-end pipeline creation and delegation.
// Run: npx tsx demo/run-demo.ts

import {
  SkillRegistry,
  PipelinePlanner,
  Orchestrator,
} from "@cyber-fabric/fabric-core";
import { ClaudeAdapter } from "@cyber-fabric/fabric-adapter-claude";
import { CodexAdapter } from "@cyber-fabric/fabric-adapter-codex";

import {
  sampleSkills,
  sampleInputs,
  codeReviewSkill,
  testGenerationSkill,
} from "./example-plan.js";

function log(label: string, message: string): void {
  console.log(`[${label}] ${message}`);
}

async function main(): Promise<void> {
  console.log("=== Cyber Fabric PoC Demo ===\n");

  // Step 1: Initialize skill registry and register sample skills
  log("REGISTRY", "Creating skill registry...");
  const registry = new SkillRegistry();

  for (const skill of sampleSkills) {
    registry.register(skill);
    log("REGISTRY", `  Registered: ${skill.name} (${skill.id})`);
  }
  log("REGISTRY", `Total skills registered: ${registry.getAllSkills().length}`);

  // Step 2: Create a pipeline using the planner
  log("PLANNER", "Creating pipeline: Code Review -> Test Generation...");
  const planner = new PipelinePlanner(registry);

  const pipelineResult = planner.createPipeline(
    "Review and Test Pipeline",
    [codeReviewSkill.id, testGenerationSkill.id],
    sampleInputs
  );

  if (!pipelineResult.ok) {
    log("PLANNER", `Pipeline creation failed: ${pipelineResult.error}`);
    process.exit(1);
  }

  const pipeline = pipelineResult.value;
  log("PLANNER", `Pipeline created: ${pipeline.name} (${pipeline.id})`);
  log("PLANNER", `  Steps: ${pipeline.steps.length}`);
  for (const step of pipeline.steps) {
    log("PLANNER", `    Step ${step.index}: skill=${step.skillId}, op=${step.operation}`);
  }

  // Step 3: Validate the pipeline
  log("PLANNER", "Validating pipeline...");
  const validation = planner.validatePipeline(pipeline, sampleInputs);
  if (validation.valid) {
    log("PLANNER", "Pipeline validation: PASSED");
  } else {
    log("PLANNER", `Pipeline validation: FAILED`);
    for (const err of validation.errors) {
      log("PLANNER", `  Error: ${err}`);
    }
  }
  for (const warn of validation.warnings) {
    log("PLANNER", `  Warning: ${warn}`);
  }

  // Step 4: Initialize orchestrator with adapters
  log("ORCHESTRATOR", "Initializing orchestrator...");
  const orchestrator = new Orchestrator(registry);

  // Subscribe to events for observability
  orchestrator.onEvent((event) => {
    switch (event.type) {
      case "pipeline:start":
        log("EVENT", `Pipeline started: ${event.pipelineId}`);
        break;
      case "step:start":
        log("EVENT", `Step ${event.stepIndex} started`);
        break;
      case "step:complete":
        log("EVENT", `Step ${event.stepIndex} completed: ${event.result.status}`);
        break;
      case "step:failed":
        log("EVENT", `Step ${event.stepIndex} failed: ${event.error}`);
        break;
      case "pipeline:complete":
        log("EVENT", `Pipeline completed: ${event.result.status}`);
        break;
    }
  });

  // Step 5: Register adapters, checking availability
  log("ADAPTERS", "Checking adapter availability...");

  const claudeAdapter = new ClaudeAdapter();
  const codexAdapter = new CodexAdapter();

  let claudeAvailable = false;
  let codexAvailable = false;

  try {
    claudeAvailable = await claudeAdapter.isAvailable();
  } catch {
    claudeAvailable = false;
  }

  try {
    codexAvailable = await codexAdapter.isAvailable();
  } catch {
    codexAvailable = false;
  }

  log("ADAPTERS", `  Claude Agent SDK: ${claudeAvailable ? "available" : "not available"}`);
  log("ADAPTERS", `  Codex CLI:        ${codexAvailable ? "available" : "not available"}`);

  if (!claudeAvailable && !codexAvailable) {
    log("ADAPTERS", "");
    log("ADAPTERS", "Neither adapter is available. This is expected in environments");
    log("ADAPTERS", "without the Claude Agent SDK or Codex CLI installed.");
    log("ADAPTERS", "");
    log("ADAPTERS", "To enable Claude adapter:");
    log("ADAPTERS", "  npm install @anthropic-ai/claude-code");
    log("ADAPTERS", "");
    log("ADAPTERS", "To enable Codex adapter:");
    log("ADAPTERS", "  Ensure 'codex' CLI is on your PATH");
    log("ADAPTERS", "");
    log("ADAPTERS", "Registering adapters anyway to demonstrate orchestrator flow...");
  }

  orchestrator.registerAdapter(claudeAdapter);
  orchestrator.registerAdapter(codexAdapter);
  log("ORCHESTRATOR", "Adapters registered. Attempting pipeline execution...");

  // Step 6: Execute the pipeline (will delegate to available adapter)
  log("EXECUTION", "Executing pipeline...");
  const result = await orchestrator.executePipeline(pipeline);

  log("EXECUTION", `Pipeline result: ${result.status}`);
  if (result.status === "success") {
    log("EXECUTION", `  Duration: ${result.duration}ms`);
    log("EXECUTION", `  Outputs: ${result.outputs.length} artifact(s)`);
    for (const output of result.outputs) {
      log("EXECUTION", `    ${output.family} (${output.format}) at ${output.path}`);
    }
  } else if (result.status === "failure") {
    log("EXECUTION", `  Error: ${result.error}`);
    log("EXECUTION", `  Duration: ${result.duration}ms`);
    log("EXECUTION", "");
    log("EXECUTION", "This is expected when agent credentials are not configured.");
    log("EXECUTION", "The demo shows the full orchestrator lifecycle regardless.");
  } else if (result.status === "partial") {
    log("EXECUTION", `  Completed steps: ${result.completedSteps}`);
    log("EXECUTION", `  Error: ${result.error}`);
    log("EXECUTION", `  Outputs so far: ${result.outputs.length} artifact(s)`);
  }

  // Step 7: Show final execution state
  const state = orchestrator.getExecutionState(pipeline.id);
  if (state) {
    log("STATE", `Pipeline ${state.pipelineId}: ${state.status}`);
    for (const step of state.steps) {
      log("STATE", `  Step ${step.stepIndex} (${step.skillId}): ${step.status}`);
    }
  }

  console.log("\n=== Demo Complete ===");
}

main().catch((err) => {
  console.error("Demo failed with unexpected error:", err);
  process.exit(1);
});
