module.exports = {
  id: "kit-hello-script",
  name: "kit hello script",
  description: "Execute the fixture kit hello script through fabric",
  interface: {
    details: [
      "Echoes the received CLI parameters in a deterministic fixture string.",
    ],
    usage: [
      "fabric script run kit-hello-script <value> [more-values...]",
    ],
    parameters: [
      {
        name: "values",
        type: "string",
        variadic: true,
        description: "One or more values to append to the fixture output.",
      },
    ],
    returns: "String formatted as `kit-script:<comma-separated args>`.",
    examples: [
      {
        command: "fabric script run kit-hello-script alpha beta",
        description: "Returns `kit-script:alpha,beta`.",
      },
    ],
    notes: [
      "CLI parameters after the script id are passed into `run(args, context)` as `args`.",
    ],
  },
  run(args) {
    return `kit-script:${args.join(",")}`;
  },
};
