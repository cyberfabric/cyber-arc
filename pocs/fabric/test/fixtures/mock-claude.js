#!/usr/bin/env node

const prompt = process.argv[process.argv.length - 1] || "";
process.stdout.write(`${JSON.stringify({ type: "result", result: `mock-claude:${prompt}` })}\n`);
