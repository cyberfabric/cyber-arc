// Example plan demonstrating Cyber Fabric skill contracts and pipeline creation.
// Defines sample skills and a multi-phase plan for the demo runner.

import type {
  SkillContract,
  SkillId,
  ArtifactRef,
} from "@cyber-fabric/fabric-core";

/**
 * Sample "code-review" skill contract.
 * Accepts source code and produces a review report.
 */
export const codeReviewSkill: SkillContract = {
  id: "skill-code-review" as SkillId,
  name: "Code Review",
  description:
    "Analyzes source code for quality, correctness, and style issues. " +
    "Produces a structured review report with findings and suggestions.",
  version: "0.1.0",
  input: {
    accepts: [
      { family: "source-code", format: "text/typescript", path: "" },
    ],
  },
  output: {
    produces: [
      { family: "review-report", format: "application/json", path: "" },
    ],
  },
  operations: [
    {
      name: "review",
      description: "Perform a full code review on the provided source files",
      input: {
        accepts: [
          { family: "source-code", format: "text/typescript", path: "" },
        ],
      },
      output: {
        produces: [
          { family: "review-report", format: "application/json", path: "" },
        ],
      },
    },
  ],
};

/**
 * Sample "test-generation" skill contract.
 * Accepts a review report and produces test files.
 */
export const testGenerationSkill: SkillContract = {
  id: "skill-test-generation" as SkillId,
  name: "Test Generation",
  description:
    "Generates unit tests based on review findings. " +
    "Produces test source code covering identified issues.",
  version: "0.1.0",
  input: {
    accepts: [
      { family: "review-report", format: "application/json", path: "" },
    ],
  },
  output: {
    produces: [
      { family: "test-code", format: "text/typescript", path: "" },
    ],
  },
  operations: [
    {
      name: "generate-tests",
      description: "Generate tests from review findings",
      input: {
        accepts: [
          { family: "review-report", format: "application/json", path: "" },
        ],
      },
      output: {
        produces: [
          { family: "test-code", format: "text/typescript", path: "" },
        ],
      },
    },
  ],
};

/**
 * Sample "documentation" skill contract.
 * Accepts source code and produces documentation.
 */
export const documentationSkill: SkillContract = {
  id: "skill-documentation" as SkillId,
  name: "Documentation Generator",
  description:
    "Generates API documentation from source code. " +
    "Produces markdown documentation with type signatures and descriptions.",
  version: "0.1.0",
  input: {
    accepts: [
      { family: "source-code", format: "text/typescript", path: "" },
    ],
  },
  output: {
    produces: [
      { family: "documentation", format: "text/markdown", path: "" },
    ],
  },
  operations: [
    {
      name: "generate-docs",
      description: "Generate API documentation from source code",
      input: {
        accepts: [
          { family: "source-code", format: "text/typescript", path: "" },
        ],
      },
      output: {
        produces: [
          { family: "documentation", format: "text/markdown", path: "" },
        ],
      },
    },
  ],
};

/** All sample skills for registration */
export const sampleSkills: SkillContract[] = [
  codeReviewSkill,
  testGenerationSkill,
  documentationSkill,
];

/** Pipeline input artifacts representing source code to review */
export const sampleInputs: ArtifactRef[] = [
  {
    family: "source-code",
    format: "text/typescript",
    path: "packages/fabric-core/src/orchestrator.ts",
  },
];
