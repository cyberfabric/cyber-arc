function parseFlagArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (!current.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${current}. Use --flag value form.`);
    }
    const key = current.slice(2);
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

module.exports = {
  parseFlagArgs,
};
