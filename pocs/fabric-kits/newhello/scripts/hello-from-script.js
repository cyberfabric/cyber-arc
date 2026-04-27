module.exports = {
  id: "newhello-hello-from-script",
  name: "newhello hello from script",
  description: "Print the newhello greeting from a fabric script",
  interface: {
    details: [
      "Returns the sample greeting together with the raw CLI arguments received by the script.",
    ],
    usage: [
      "fabric script run newhello-hello-from-script <value> [more-values...]",
    ],
    parameters: [
      {
        name: "values",
        type: "string",
        variadic: true,
        description: "Values that will be echoed back in the resulting args array.",
      },
    ],
    returns: "Greeting string with a JSON representation of the received args array.",
    examples: [
      {
        command: "fabric script run newhello-hello-from-script demo-value",
        description: "Returns `Hello from script!!! args=[\"demo-value\"]`.",
      },
    ],
    notes: [
      "Fabric passes CLI parameters after the script id into `run(args, context)` as `args`.",
    ],
  },
  run(args) {
    return `Hello from script!!! args=${JSON.stringify(args)}`;
  },
};
