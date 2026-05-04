const { parseFlagArgs } = require("../lib/args");

const ALLOWED_TYPES = new Set([
  "skill",
  "agent",
  "rules",
  "template",
  "middleware",
  "workflow",
  "checklist",
]);

const ALLOWED_TIMINGS = new Set(["pre", "post"]);

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function splitCsv(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function validate(parsed) {
  const errors = [];

  if (!parsed.id) errors.push("--id is required");
  else if (!KEBAB_CASE.test(parsed.id)) errors.push(`--id must be kebab-case (got ${JSON.stringify(parsed.id)})`);

  if (!parsed.type) errors.push("--type is required");
  else if (!ALLOWED_TYPES.has(parsed.type)) errors.push(`--type must be one of ${[...ALLOWED_TYPES].join(", ")} (got ${JSON.stringify(parsed.type)})`);

  if (!parsed.name) errors.push("--name is required");
  if (!parsed.description) errors.push("--description is required");

  if (parsed.type === "middleware") {
    if (!parsed["target-types"]) {
      errors.push("--target-types is required for middleware (comma-separated list)");
    } else {
      const targets = splitCsv(parsed["target-types"]);
      if (targets.length === 0) errors.push("--target-types must contain at least one type");
      for (const target of targets) {
        if (!ALLOWED_TYPES.has(target)) errors.push(`--target-types contains invalid type: ${target}`);
      }
    }
    if (!parsed.timing) errors.push("--timing is required for middleware (pre or post)");
    else if (!ALLOWED_TIMINGS.has(parsed.timing)) errors.push(`--timing must be pre or post (got ${JSON.stringify(parsed.timing)})`);
    if (parsed["target-prompts"]) {
      const targetPrompts = splitCsv(parsed["target-prompts"]);
      for (const id of targetPrompts) {
        if (!KEBAB_CASE.test(id)) errors.push(`--target-prompts contains non-kebab-case id: ${id}`);
      }
    }
  } else if (parsed["target-prompts"]) {
    errors.push("--target-prompts is only valid for middleware");
  }

  if (parsed.blocks) {
    const blockIds = splitCsv(parsed.blocks);
    const seen = new Set();
    for (const blockId of blockIds) {
      if (seen.has(blockId)) errors.push(`--blocks contains duplicate id: ${blockId}`);
      seen.add(blockId);
    }
  }

  return errors;
}

function buildFrontmatter(parsed) {
  const lines = [
    "---",
    `id: ${parsed.id}`,
    `type: ${parsed.type}`,
    `name: ${parsed.name}`,
    `description: ${parsed.description}`,
  ];
  if (parsed.type === "middleware") {
    lines.push(`target_types: ${splitCsv(parsed["target-types"]).join(", ")}`);
    if (parsed["target-prompts"]) {
      lines.push(`target_prompts: ${splitCsv(parsed["target-prompts"]).join(", ")}`);
    }
    lines.push(`timing: ${parsed.timing}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function buildBlocks(parsed) {
  const defaultBlockId = `${parsed.id.replace(/-/g, "_")}_body`;
  const blockIds = parsed.blocks ? splitCsv(parsed.blocks) : [defaultBlockId];
  return blockIds
    .map((blockId) => [
      `<!-- append "${blockId}" -->`,
      `TODO: body for ${blockId}`,
      "<!-- /append -->",
    ].join("\n"))
    .join("\n\n");
}

module.exports = {
  id: "prompt-scaffold",
  name: "prompt scaffold",
  description: "Emit a valid fabric-poc prompt markdown skeleton for the given frontmatter",
  interface: {
    details: [
      "Generates a prompt file with correct frontmatter for the declared type and one or more append-block stubs.",
      "Produces no file output — writes the skeleton to stdout so the caller can pipe, save, or paste it.",
    ],
    usage: [
      "fabric-poc script run prompt-scaffold --id <kebab-id> --type <type> --name <name> --description <description> [--target-types <csv>] [--target-prompts <csv>] [--timing pre|post] [--blocks <csv>]",
    ],
    parameters: [
      { name: "--id", type: "string", required: true, description: "Stable kebab-case id for the new prompt." },
      { name: "--type", type: "string", required: true, description: "One of skill, agent, rules, template, middleware, workflow, checklist." },
      { name: "--name", type: "string", required: true, description: "Human-friendly name." },
      { name: "--description", type: "string", required: true, description: "One-line purpose shown in fabric-poc prompt list." },
      { name: "--target-types", type: "string", required: false, description: "Comma-separated list of target prompt types. Required when --type is middleware." },
      { name: "--target-prompts", type: "string", required: false, description: "Comma-separated list of prompt ids to narrow middleware application to. Only valid when --type is middleware; ANDs with --target-types." },
      { name: "--timing", type: "string", required: false, description: "Middleware timing: pre or post. Required when --type is middleware." },
      { name: "--blocks", type: "string", required: false, description: "Comma-separated list of append-block ids to stub out (default: one <id>_body block)." },
    ],
    returns: "Prompt markdown skeleton with valid frontmatter and one or more <!-- append --> / <!-- /append --> stubs.",
    examples: [
      {
        command: "fabric-poc script run prompt-scaffold --id my-skill --type skill --name \"my skill\" --description \"Do the thing\"",
        description: "Emit a skill skeleton with a single append block.",
      },
      {
        command: "fabric-poc script run prompt-scaffold --id english-only --type middleware --name \"english only\" --description \"Force English\" --target-types rules,skill --timing post",
        description: "Emit a middleware skeleton with target_types and timing.",
      },
    ],
    notes: [
      "Caller is responsible for writing the output to the correct prompt_files directory. Use prompt-register-dryrun to verify coverage.",
    ],
  },
  run(args) {
    const parsed = parseFlagArgs(args);
    const errors = validate(parsed);
    if (errors.length > 0) {
      throw new Error(`prompt-scaffold input invalid:\n- ${errors.join("\n- ")}`);
    }
    return `${buildFrontmatter(parsed)}\n\n${buildBlocks(parsed)}\n`;
  },
};
