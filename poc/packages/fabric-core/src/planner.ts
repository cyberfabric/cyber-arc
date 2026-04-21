// Pipeline Planner — inspects skill IO contracts, determines compatibility,
// and assembles validated pipelines from skill sequences or goal-directed search.

import type {
  SkillContract,
  SkillId,
  ArtifactRef,
  Pipeline,
  PipelineId,
  PipelineStep,
  ValidationResult,
  Result,
  Planner,
} from "./types.js";
import { SkillRegistry } from "./skill-registry.js";

/** Detailed compatibility report between two skills */
export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly matchedOutputs: ReadonlyArray<{
    output: ArtifactRef;
    input: ArtifactRef;
  }>;
  readonly unmatchedRequiredInputs: readonly ArtifactRef[];
  readonly reasons: readonly string[];
}

/** Outcome of pipeline creation */
export type PipelineResult = Result<Pipeline, string>;

/**
 * Pipeline planner that inspects skill IO contracts from the registry,
 * determines compatibility between skills, and assembles them into
 * executable pipelines.
 */
export class PipelinePlanner implements Planner {
  private readonly registry: SkillRegistry;
  private pipelineCounter = 0;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
  }

  private generatePipelineId(): PipelineId {
    this.pipelineCounter += 1;
    return `pipeline-${Date.now()}-${this.pipelineCounter}` as PipelineId;
  }

  /**
   * Check if two skills can be connected (upstream outputs -> downstream inputs).
   * Compares artifact families and formats between the output of the upstream
   * skill and the input of the downstream skill.
   * @param upstream - The skill producing output
   * @param downstream - The skill consuming input
   * @returns Detailed compatibility report
   */
  checkCompatibility(
    upstream: SkillContract,
    downstream: SkillContract
  ): CompatibilityResult {
    const matched: Array<{ output: ArtifactRef; input: ArtifactRef }> = [];
    const reasons: string[] = [];

    for (const produced of upstream.output.produces) {
      for (const accepted of downstream.input.accepts) {
        if (produced.family === accepted.family) {
          // Check format compatibility if both specify a format
          if (
            produced.format &&
            accepted.format &&
            produced.format !== accepted.format
          ) {
            reasons.push(
              `Family "${produced.family}" matches but formats differ: ` +
                `"${produced.format}" (output) vs "${accepted.format}" (input)`
            );
          } else {
            matched.push({ output: produced, input: accepted });
          }
        }
      }
    }

    // Find required inputs that are not satisfied by any upstream output
    const matchedFamilies = new Set(matched.map((m) => m.input.family));
    const unmatchedRequiredInputs = downstream.input.accepts.filter(
      (ref) => !matchedFamilies.has(ref.family)
    );

    if (matched.length === 0) {
      reasons.push(
        `No matching artifact families between "${upstream.name}" outputs ` +
          `[${upstream.output.produces.map((p) => p.family).join(", ")}] and ` +
          `"${downstream.name}" inputs ` +
          `[${downstream.input.accepts.map((a) => a.family).join(", ")}]`
      );
    }

    return {
      compatible: matched.length > 0,
      matchedOutputs: matched,
      unmatchedRequiredInputs: unmatchedRequiredInputs,
      reasons,
    };
  }

  /**
   * Create a pipeline from an ordered list of skill IDs. Looks up each skill
   * from the registry, verifies sequential compatibility, and builds a
   * validated Pipeline object.
   * @param name - Human-readable pipeline name
   * @param skillIds - Ordered list of skill IDs to chain
   * @param pipelineInputs - Artifacts available as pipeline-level inputs
   * @returns Result containing the pipeline or an error message
   */
  createPipeline(
    name: string,
    skillIds: readonly SkillId[],
    pipelineInputs: readonly ArtifactRef[] = []
  ): PipelineResult {
    if (skillIds.length === 0) {
      return { ok: false, error: "Pipeline must contain at least one skill" };
    }

    // Resolve all skills from the registry
    const skills: SkillContract[] = [];
    for (const id of skillIds) {
      const skill = this.registry.getSkill(id);
      if (!skill) {
        return { ok: false, error: `Skill "${id}" not found in registry` };
      }
      skills.push(skill);
    }

    // Verify sequential compatibility
    const errors: string[] = [];
    for (let i = 0; i < skills.length - 1; i++) {
      const compat = this.checkCompatibility(skills[i], skills[i + 1]);
      if (!compat.compatible) {
        errors.push(
          `Step ${i} ("${skills[i].name}") -> Step ${i + 1} ` +
            `("${skills[i + 1].name}"): ${compat.reasons.join("; ")}`
        );
      }
    }

    if (errors.length > 0) {
      return {
        ok: false,
        error: `Pipeline compatibility errors:\n${errors.join("\n")}`,
      };
    }

    // Build pipeline steps
    const steps: PipelineStep[] = skills.map((skill, index) => ({
      index,
      skillId: skill.id,
      operation: skill.operations[0]?.name ?? "default",
      inputBindings: buildInputBindings(skill, index, skills, pipelineInputs),
    }));

    // Collect pipeline-level outputs from the last skill
    const lastSkill = skills[skills.length - 1];
    const outputs = [...lastSkill.output.produces];

    const pipeline: Pipeline = {
      id: this.generatePipelineId(),
      name,
      steps,
      inputs: pipelineInputs,
      outputs,
      createdAt: new Date().toISOString(),
    };

    return { ok: true, value: pipeline };
  }

  /**
   * Find a chain of skills that transforms artifacts of inputFamily into
   * artifacts of outputFamily using breadth-first search.
   * @param inputFamily - The artifact family available as input
   * @param outputFamily - The desired artifact family as output
   * @returns Result containing an ordered list of skill IDs, or error
   */
  findPath(
    inputFamily: string,
    outputFamily: string
  ): Result<readonly SkillId[], string> {
    // Find skills that accept the input family
    const startSkills = this.registry.findByInputFamily(inputFamily);
    if (startSkills.length === 0) {
      return {
        ok: false,
        error: `No skills found that accept input family "${inputFamily}"`,
      };
    }

    // BFS to find shortest path from inputFamily to outputFamily
    const queue: Array<{ skill: SkillContract; path: SkillContract[] }> = [];
    const visited = new Set<string>();

    for (const skill of startSkills) {
      queue.push({ skill, path: [skill] });
      visited.add(skill.id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const { skill, path } = current;

      // Check if this skill produces the desired output
      const producesTarget = skill.output.produces.some(
        (ref) => ref.family === outputFamily
      );
      if (producesTarget) {
        return { ok: true, value: path.map((s) => s.id) };
      }

      // Explore downstream skills that can consume this skill's outputs
      for (const produced of skill.output.produces) {
        const consumers = this.registry.findByInputFamily(produced.family);
        for (const consumer of consumers) {
          if (!visited.has(consumer.id)) {
            visited.add(consumer.id);
            queue.push({ skill: consumer, path: [...path, consumer] });
          }
        }
      }
    }

    return {
      ok: false,
      error:
        `No path found from input family "${inputFamily}" ` +
        `to output family "${outputFamily}"`,
    };
  }

  /**
   * Validate that a pipeline can execute given the available input artifacts.
   * Checks that all required inputs for the first step are satisfied and that
   * the pipeline is internally consistent.
   * @param pipeline - The pipeline to validate
   * @param availableInputs - Artifacts available at execution time
   * @returns Validation result with any missing inputs or errors
   */
  validatePipeline(
    pipeline: Pipeline,
    availableInputs: readonly ArtifactRef[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (pipeline.steps.length === 0) {
      return { valid: false, errors: ["Pipeline has no steps"], warnings: [] };
    }

    // Check that the first step's required inputs are available
    const firstSkill = this.registry.getSkill(pipeline.steps[0].skillId);
    if (!firstSkill) {
      errors.push(
        `First step skill "${pipeline.steps[0].skillId}" not found in registry`
      );
    } else {
      const availableFamilies = new Set(
        [...availableInputs, ...pipeline.inputs].map((a) => a.family)
      );
      const missingInputs = firstSkill.input.accepts.filter(
        (ref) => !availableFamilies.has(ref.family)
      );
      for (const missing of missingInputs) {
        errors.push(
          `First step requires input family "${missing.family}" but it is not available`
        );
      }
    }

    // Verify all skills in the pipeline exist in the registry
    for (const step of pipeline.steps) {
      const skill = this.registry.getSkill(step.skillId);
      if (!skill) {
        errors.push(
          `Step ${step.index}: skill "${step.skillId}" not found in registry`
        );
      }
    }

    // Verify sequential compatibility within the pipeline
    for (let i = 0; i < pipeline.steps.length - 1; i++) {
      const current = this.registry.getSkill(pipeline.steps[i].skillId);
      const next = this.registry.getSkill(pipeline.steps[i + 1].skillId);
      if (current && next) {
        const compat = this.checkCompatibility(current, next);
        if (!compat.compatible) {
          errors.push(
            `Steps ${i} -> ${i + 1}: incompatible — ${compat.reasons.join("; ")}`
          );
        }
        if (compat.unmatchedRequiredInputs.length > 0) {
          warnings.push(
            `Step ${i + 1} has unmatched inputs: ` +
              compat.unmatchedRequiredInputs.map((r) => r.family).join(", ")
          );
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

/** Build input bindings for a pipeline step */
function buildInputBindings(
  skill: SkillContract,
  stepIndex: number,
  allSkills: readonly SkillContract[],
  pipelineInputs: readonly ArtifactRef[]
): Record<string, string> {
  const bindings: Record<string, string> = {};

  for (const accepted of skill.input.accepts) {
    if (stepIndex === 0) {
      // First step binds from pipeline inputs
      const match = pipelineInputs.find((a) => a.family === accepted.family);
      if (match) {
        bindings[accepted.family] = `pipeline:input:${match.family}`;
      }
    } else {
      // Subsequent steps bind from the previous step's output
      const prevSkill = allSkills[stepIndex - 1];
      const match = prevSkill.output.produces.find(
        (p) => p.family === accepted.family
      );
      if (match) {
        bindings[accepted.family] = `step:${stepIndex - 1}:${match.family}`;
      }
    }
  }

  return bindings;
}
