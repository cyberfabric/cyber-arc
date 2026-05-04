const { parseFlagArgs } = require("../lib/args");

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseJsonField(field, raw, expectedShape) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    throw new Error(`--${field} must be valid JSON (${expectedShape}); got parse error: ${err.message}`);
  }
  return value;
}

function validate(parsed) {
  const errors = [];

  if (!parsed.id) errors.push("--id is required");
  else if (!KEBAB_CASE.test(parsed.id)) errors.push(`--id must be kebab-case (got ${JSON.stringify(parsed.id)})`);

  if (!parsed.name) errors.push("--name is required");
  if (!parsed.description) errors.push("--description is required");

  if (parsed.parameters) {
    const parameters = parseJsonField("parameters", parsed.parameters, "JSON array of {name, type, required, description}");
    if (!Array.isArray(parameters)) errors.push("--parameters must decode to a JSON array");
    else for (let i = 0; i < parameters.length; i += 1) {
      const entry = parameters[i];
      if (!entry || typeof entry !== "object") errors.push(`--parameters[${i}] must be an object`);
      else {
        if (!entry.name) errors.push(`--parameters[${i}].name is required`);
        if (!entry.type) errors.push(`--parameters[${i}].type is required`);
        if (typeof entry.required !== "boolean") errors.push(`--parameters[${i}].required must be boolean`);
        if (!entry.description) errors.push(`--parameters[${i}].description is required`);
      }
    }
  }

  if (parsed.examples) {
    const examples = parseJsonField("examples", parsed.examples, "JSON array of {command, description}");
    if (!Array.isArray(examples)) errors.push("--examples must decode to a JSON array");
    else for (let i = 0; i < examples.length; i += 1) {
      const entry = examples[i];
      if (!entry || typeof entry !== "object") errors.push(`--examples[${i}] must be an object`);
      else {
        if (!entry.command) errors.push(`--examples[${i}].command is required`);
        if (!entry.description) errors.push(`--examples[${i}].description is required`);
      }
    }
  }

  for (const arrayField of ["details", "usage", "notes"]) {
    if (parsed[arrayField]) {
      const value = parseJsonField(arrayField, parsed[arrayField], "JSON array of strings");
      if (!Array.isArray(value)) errors.push(`--${arrayField} must decode to a JSON array`);
      else for (let i = 0; i < value.length; i += 1) {
        if (typeof value[i] !== "string") errors.push(`--${arrayField}[${i}] must be a string`);
      }
    }
  }

  return errors;
}

function jsonArrayField(parsed, field) {
  return parsed[field] ? JSON.parse(parsed[field]) : [];
}

function indentJson(value, outerIndent) {
  const raw = JSON.stringify(value, null, 2);
  return raw.split("\n").map((line, i) => (i === 0 ? line : `${outerIndent}${line}`)).join("\n");
}

function buildInterface(parsed) {
  const details = jsonArrayField(parsed, "details");
  const usage = parsed.usage
    ? jsonArrayField(parsed, "usage")
    : [`fabric-poc script run ${parsed.id}${parsed.parameters ? " <args>" : ""}`];
  const parameters = parsed.parameters ? JSON.parse(parsed.parameters) : [];
  const returns = parsed.returns || "TODO: describe the shape that fabric will print.";
  const examples = parsed.examples ? JSON.parse(parsed.examples) : [];
  const notes = jsonArrayField(parsed, "notes");

  const parametersInline = parameters
    .map((p) => `      { name: ${JSON.stringify(p.name)}, type: ${JSON.stringify(p.type)}, required: ${JSON.stringify(p.required)}, description: ${JSON.stringify(p.description)} }`)
    .join(",\n");
  const examplesInline = examples
    .map((e) => `      { command: ${JSON.stringify(e.command)}, description: ${JSON.stringify(e.description)} }`)
    .join(",\n");

  return [
    "  interface: {",
    `    details: ${indentJson(details, "    ")},`,
    `    usage: ${indentJson(usage, "    ")},`,
    `    parameters: [${parametersInline ? `\n${parametersInline},\n    ` : ""}],`,
    `    returns: ${JSON.stringify(returns)},`,
    `    examples: [${examplesInline ? `\n${examplesInline},\n    ` : ""}],`,
    `    notes: ${indentJson(notes, "    ")},`,
    "  },",
  ].join("\n");
}

function buildSkeleton(parsed) {
  return [
    "module.exports = {",
    `  id: ${JSON.stringify(parsed.id)},`,
    `  name: ${JSON.stringify(parsed.name)},`,
    `  description: ${JSON.stringify(parsed.description)},`,
    buildInterface(parsed),
    "  run(args, context) {",
    `    throw new Error(${JSON.stringify(`${parsed.id}: not implemented`)});`,
    "  },",
    "};",
    "",
  ].join("\n");
}

module.exports = {
  id: "script-scaffold",
  name: "script scaffold",
  description: "Emit a valid fabric-poc script module skeleton with id, name, description, interface, and a run stub",
  interface: {
    details: [
      "Generates a Node module skeleton that satisfies the fabric-poc script contract: exports id, name, description, interface (with details, usage, parameters, returns, examples, notes), and a run(args, context) stub that throws \"not implemented\".",
      "Produces no file output — writes the skeleton to stdout so the caller can pipe or paste it into scripts/<id>.js.",
    ],
    usage: [
      "fabric-poc script run script-scaffold --id <kebab-id> --name <name> --description <description> [--parameters <json>] [--returns <str>] [--examples <json>] [--details <json>] [--usage <json>] [--notes <json>]",
    ],
    parameters: [
      { name: "--id", type: "string", required: true, description: "Stable kebab-case id for the new script." },
      { name: "--name", type: "string", required: true, description: "Human-friendly one-line name." },
      { name: "--description", type: "string", required: true, description: "One-line purpose shown in fabric-poc script list." },
      { name: "--parameters", type: "string", required: false, description: "JSON array of {name, type, required, description} for interface.parameters." },
      { name: "--returns", type: "string", required: false, description: "One-sentence description of what run() returns; defaults to a TODO placeholder." },
      { name: "--examples", type: "string", required: false, description: "JSON array of {command, description} for interface.examples." },
      { name: "--details", type: "string", required: false, description: "JSON array of strings for interface.details." },
      { name: "--usage", type: "string", required: false, description: "JSON array of runnable usage strings; defaults to a single generated line." },
      { name: "--notes", type: "string", required: false, description: "JSON array of strings for interface.notes." },
    ],
    returns: "Node module skeleton string with a complete module.exports object and a run() stub that throws 'not implemented'.",
    examples: [
      {
        command: "fabric-poc script run script-scaffold --id my-script --name \"my script\" --description \"Do the thing\"",
        description: "Emit a minimal skeleton with empty parameters/examples/notes arrays.",
      },
      {
        command: "fabric-poc script run script-scaffold --id find-things --name \"find things\" --description \"Find a thing\" --parameters '[{\"name\":\"--path\",\"type\":\"string\",\"required\":true,\"description\":\"Path to the thing\"}]'",
        description: "Emit a skeleton with a typed --path parameter already declared in interface.",
      },
    ],
    notes: [
      "Caller is responsible for writing the output to the correct script_files directory. Use prompt-register-dryrun --type script to verify coverage.",
      "Fill in the body of run(args, context); the generated stub always throws 'not implemented'.",
    ],
  },
  run(args) {
    const parsed = parseFlagArgs(args);
    const errors = validate(parsed);
    if (errors.length > 0) {
      throw new Error(`script-scaffold input invalid:\n- ${errors.join("\n- ")}`);
    }
    return buildSkeleton(parsed);
  },
};
