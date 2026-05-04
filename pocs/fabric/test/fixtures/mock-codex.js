#!/usr/bin/env node

const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args[args.length - 1] || "";

if (outputIndex !== -1 && args[outputIndex + 1]) {
  require("node:fs").writeFileSync(args[outputIndex + 1], `mock-codex:${prompt}\n`);
}

process.stdout.write(`${JSON.stringify({ type: "result", prompt })}\n`);
