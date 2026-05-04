function parseArgs(rawArgs, schema = {}) {
  const booleans = schema.booleans instanceof Set ? schema.booleans : new Set(schema.booleans || []);
  const repeats = schema.repeats instanceof Set ? schema.repeats : new Set(schema.repeats || []);
  const flags = {};
  const positionals = [];

  for (let i = 0; i < rawArgs.length; i += 1) {
    const current = rawArgs[i];
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }
    const key = current.slice(2);
    if (key.length === 0) throw new Error("Empty flag name (\"--\") is not allowed");
    if (booleans.has(key)) {
      flags[key] = true;
      continue;
    }
    const value = rawArgs[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    if (repeats.has(key)) {
      if (!flags[key]) flags[key] = [];
      flags[key].push(value);
    } else {
      if (Object.prototype.hasOwnProperty.call(flags, key)) {
        throw new Error(`Duplicate --${key}; this flag accepts a single value`);
      }
      flags[key] = value;
    }
    i += 1;
  }

  return { flags, positionals };
}

function requireString(flags, name, scriptId) {
  const value = flags[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${scriptId}: --${name} is required`);
  }
  return value;
}

function requireOneOf(flags, name, allowed, scriptId) {
  const value = requireString(flags, name, scriptId);
  if (!allowed.includes(value)) {
    throw new Error(`${scriptId}: --${name} must be one of ${allowed.join(", ")} (got ${JSON.stringify(value)})`);
  }
  return value;
}

function optionalInt(flags, name, scriptId, fallback) {
  if (!Object.prototype.hasOwnProperty.call(flags, name)) return fallback;
  const raw = flags[name];
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== String(raw)) {
    throw new Error(`${scriptId}: --${name} must be an integer (got ${JSON.stringify(raw)})`);
  }
  return parsed;
}

module.exports = {
  parseArgs,
  requireString,
  requireOneOf,
  optionalInt,
};
