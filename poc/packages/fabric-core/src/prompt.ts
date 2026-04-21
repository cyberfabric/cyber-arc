// Shared task prompt builder for adapters.

import type { SkillInstance, ExecutionContext } from "./types.js";

/**
 * Build a task prompt from a skill instance and execution context.
 * Used by adapters to construct CLI/SDK prompts from Fabric contracts.
 */
export function buildTaskPrompt(
  skill: SkillInstance,
  context: ExecutionContext
): string {
  const parts: string[] = [];

  parts.push(`Execute skill: ${skill.contract.name}`);
  parts.push(`Operation: step ${context.currentStep} of pipeline ${context.pipelineId}`);

  if (skill.contract.operations.length > 0) {
    parts.push(`Supported operations: ${skill.contract.operations.map((op) => op.name).join(", ")}`);
  }

  const priorArtifacts = Object.entries(context.artifacts);
  if (priorArtifacts.length > 0) {
    parts.push("Prior artifacts:");
    for (const [step, refs] of priorArtifacts) {
      for (const ref of refs) {
        parts.push(`  Step ${step}: ${ref.family} (${ref.format}) at ${ref.path}`);
      }
    }
  }

  const params = Object.entries(context.parameters);
  if (params.length > 0) {
    parts.push("Parameters:");
    for (const [key, value] of params) {
      parts.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  return parts.join("\n");
}
