// Skill Registry — manages skill discovery, registration, and compatibility queries
// The central catalog where skills declare their contracts so the orchestrator
// can route work by declared interfaces rather than prompt guesses.

import type {
  SkillContract,
  SkillId,
  SkillOperation,
  ArtifactRef,
} from "./types.js";

/**
 * Central registry for skill contracts. Skills must be registered with valid,
 * bounded contracts before they can participate in orchestrator routing.
 */
export class SkillRegistry {
  private readonly skills = new Map<string, SkillContract>();

  /**
   * Register a skill contract. Validates that the skill has bounded
   * responsibilities and complete contract declarations before accepting.
   * @param skill - The skill contract to register
   * @throws Error if the contract is invalid or the skill ID is already registered
   */
  register(skill: SkillContract): void {
    this.validateContract(skill);

    if (this.skills.has(skill.id)) {
      throw new Error(
        `Skill with id "${skill.id}" is already registered. Unregister it first to replace.`
      );
    }

    this.skills.set(skill.id, skill);
  }

  /**
   * Remove a skill from the registry.
   * @param skillId - The ID of the skill to remove
   */
  unregister(skillId: string): void {
    this.skills.delete(skillId);
  }

  /**
   * Retrieve a skill contract by ID.
   * @param skillId - The ID of the skill to retrieve
   * @returns The skill contract, or undefined if not found
   */
  getSkill(skillId: string): SkillContract | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get all registered skill contracts.
   * @returns Array of all registered skill contracts
   */
  getAllSkills(): SkillContract[] {
    return Array.from(this.skills.values());
  }

  /**
   * Find all skills that support a given operation name.
   * Routing is based on declared operation contracts, not skill names.
   * @param operationName - The operation name to search for (e.g. "generate", "analyze")
   * @returns Array of skills that declare support for the given operation
   */
  findByOperation(operationName: string): SkillContract[] {
    return this.getAllSkills().filter((skill) =>
      skill.operations.some((op: SkillOperation) => op.name === operationName)
    );
  }

  /**
   * Find all skills that accept artifacts of the given family as input.
   * @param family - The artifact family to search for (e.g. "source-code", "documentation")
   * @returns Array of skills whose input schema accepts the given family
   */
  findByInputFamily(family: string): SkillContract[] {
    return this.getAllSkills().filter((skill) =>
      skill.input.accepts.some((ref: ArtifactRef) => ref.family === family)
    );
  }

  /**
   * Find all skills that produce artifacts of the given family as output.
   * @param family - The artifact family to search for
   * @returns Array of skills whose output schema produces the given family
   */
  findByOutputFamily(family: string): SkillContract[] {
    return this.getAllSkills().filter((skill) =>
      skill.output.produces.some((ref: ArtifactRef) => ref.family === family)
    );
  }

  /**
   * Find skills that can receive artifacts of the given output family as input.
   * Supports partial matching on family name (e.g. "source" matches "source-code").
   * Returns an empty array when no matches exist (never throws).
   * @param outputFamily - The output artifact family to find compatible consumers for
   * @returns Array of skills that accept the given family as input
   */
  findCompatible(outputFamily: string): SkillContract[] {
    return this.getAllSkills().filter((skill) =>
      skill.input.accepts.some(
        (ref: ArtifactRef) =>
          ref.family === outputFamily || ref.family.includes(outputFamily) || outputFamily.includes(ref.family)
      )
    );
  }

  /**
   * Check whether two skills can be chained in a pipeline — i.e. at least one
   * output artifact family of the source skill matches an input artifact family
   * of the target skill.
   * @param fromSkillId - The ID of the upstream skill (producer)
   * @param toSkillId - The ID of the downstream skill (consumer)
   * @returns true if the skills can be chained, false otherwise
   */
  canChain(fromSkillId: string, toSkillId: string): boolean {
    const from = this.skills.get(fromSkillId);
    const to = this.skills.get(toSkillId);

    if (!from || !to) {
      return false;
    }

    return from.output.produces.some((produced: ArtifactRef) =>
      to.input.accepts.some((accepted: ArtifactRef) => accepted.family === produced.family)
    );
  }

  /**
   * Validate that a skill contract meets the minimum registration requirements:
   * - Non-empty id and name
   * - At least one operation declared
   * - At least one input or output artifact family declared
   */
  private validateContract(skill: SkillContract): void {
    if (!skill.id || skill.id.trim() === "") {
      throw new Error("Skill contract must have a non-empty id");
    }
    if (!skill.name || skill.name.trim() === "") {
      throw new Error("Skill contract must have a non-empty name");
    }
    if (!skill.operations || skill.operations.length === 0) {
      throw new Error(
        `Skill "${skill.name}" must declare at least one operation`
      );
    }
    const hasInputs = skill.input.accepts.length > 0;
    const hasOutputs = skill.output.produces.length > 0;
    if (!hasInputs && !hasOutputs) {
      throw new Error(
        `Skill "${skill.name}" must declare at least one input or output artifact family`
      );
    }
  }
}
