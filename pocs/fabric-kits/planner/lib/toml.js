const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

function escapeBasicString(value) {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0);
    if (char === "\\") out += "\\\\";
    else if (char === "\"") out += "\\\"";
    else if (char === "\n") out += "\\n";
    else if (char === "\r") out += "\\r";
    else if (char === "\t") out += "\\t";
    else if (char === "\b") out += "\\b";
    else if (char === "\f") out += "\\f";
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += char;
  }
  return `"${out}"`;
}

function emitKey(key) {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`emitKey: refusing to emit non-bare TOML key ${JSON.stringify(key)}`);
  }
  return key;
}

function emitInlineValue(value) {
  if (value === null || value === undefined) {
    throw new Error("emitInlineValue: null / undefined is not a valid TOML value");
  }
  if (typeof value === "string") return escapeBasicString(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`emitInlineValue: non-finite number ${value}`);
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return `[${value.map(emitInlineValue).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([k, v]) => `${emitKey(k)} = ${emitInlineValue(v)}`)
      .join(", ");
    return `{ ${entries} }`;
  }
  throw new Error(`emitInlineValue: unsupported value type ${typeof value}`);
}

function emitTable(headerPath, table) {
  const lines = [];
  if (headerPath) lines.push(`[${headerPath}]`);
  for (const [key, value] of Object.entries(table)) {
    lines.push(`${emitKey(key)} = ${emitInlineValue(value)}`);
  }
  return lines.join("\n");
}

function emitArrayOfTables(headerPath, items) {
  return items
    .map((item) => {
      const lines = [`[[${headerPath}]]`];
      for (const [key, value] of Object.entries(item)) {
        lines.push(`${emitKey(key)} = ${emitInlineValue(value)}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function emitDocument(sections) {
  const blocks = [];
  for (const section of sections) {
    if (section.kind === "table") {
      blocks.push(emitTable(section.header, section.table));
    } else if (section.kind === "array-of-tables") {
      if (section.items.length === 0) continue;
      blocks.push(emitArrayOfTables(section.header, section.items));
    } else {
      throw new Error(`emitDocument: unknown section kind ${JSON.stringify(section.kind)}`);
    }
  }
  return `${blocks.join("\n\n")}\n`;
}

module.exports = {
  emitDocument,
  emitTable,
  emitArrayOfTables,
  emitInlineValue,
  escapeBasicString,
};
