const crypto = require("node:crypto");
const fs = require("node:fs");

function sha256OfString(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function sha256OfFile(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function buildInputSignature(items) {
  if (!Array.isArray(items)) throw new Error("buildInputSignature: items must be an array");
  if (items.length === 0) return sha256OfString("");
  const lines = items
    .map((item) => {
      if (!item || typeof item !== "object") throw new Error("buildInputSignature: each item must be an object");
      if (item.kind !== "file" && item.kind !== "stdin") {
        throw new Error(`buildInputSignature: unknown item kind ${JSON.stringify(item.kind)} (expected 'file' or 'stdin')`);
      }
      if (item.kind === "file") {
        if (typeof item.path !== "string" || item.path.length === 0) {
          throw new Error("buildInputSignature: file item requires a non-empty path");
        }
        const contentHash = sha256OfFile(item.path);
        return `file|${item.path}|${contentHash}`;
      }
      const contentHash = sha256OfString(item.content == null ? "" : item.content);
      return `stdin|<stdin>|${contentHash}`;
    })
    .sort();
  return sha256OfString(lines.join("\n"));
}

module.exports = {
  sha256OfString,
  sha256OfFile,
  buildInputSignature,
};
