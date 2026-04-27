const fs = require("node:fs");
const path = require("node:path");

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
const REQUIRED_FIELDS = ["id", "type", "name", "description"];
const MIDDLEWARE_FIELDS = ["target_types", "timing"];

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match) {
    return { frontmatter: null, body: content, endLine: 0 };
  }

  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
    endLine: (match[0].match(/\n/g) || []).length,
  };
}

function parseFrontmatter(raw, findings) {
  const fields = {};
  if (raw === null) return fields;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    if (colon === -1) {
      findings.push({
        severity: "CRITICAL",
        where: "frontmatter",
        problem: `invalid frontmatter line: ${line}`,
      });
      continue;
    }
    const key = line.slice(0, colon).trim();
    const value = stripQuotes(line.slice(colon + 1).trim());
    fields[key] = value;
  }
  return fields;
}

function lintFrontmatter(fields, raw, findings) {
  if (raw === null) {
    findings.push({ severity: "CRITICAL", where: "frontmatter", problem: "missing YAML frontmatter delimited by ---" });
    return;
  }
  for (const field of REQUIRED_FIELDS) {
    if (!fields[field]) findings.push({ severity: "CRITICAL", where: `frontmatter.${field}`, problem: `required field missing` });
  }
  if (fields.id && !KEBAB_CASE.test(fields.id)) {
    findings.push({ severity: "HIGH", where: "frontmatter.id", problem: `id is not kebab-case: ${fields.id}` });
  }
  if (fields.type && !ALLOWED_TYPES.has(fields.type)) {
    findings.push({ severity: "CRITICAL", where: "frontmatter.type", problem: `type ${fields.type} is not one of ${[...ALLOWED_TYPES].join(", ")}` });
  }
  if (fields.type === "middleware") {
    for (const field of MIDDLEWARE_FIELDS) {
      if (!fields[field]) findings.push({ severity: "CRITICAL", where: `frontmatter.${field}`, problem: `middleware requires ${field}` });
    }
    if (fields.timing && !ALLOWED_TIMINGS.has(fields.timing)) {
      findings.push({ severity: "CRITICAL", where: "frontmatter.timing", problem: `timing must be pre or post (got ${fields.timing})` });
    }
    if (fields.target_types) {
      const targets = fields.target_types.split(",").map((s) => s.trim()).filter(Boolean);
      if (targets.length === 0) {
        findings.push({ severity: "CRITICAL", where: "frontmatter.target_types", problem: "target_types must be a non-empty comma-separated list" });
      }
      for (const target of targets) {
        if (!ALLOWED_TYPES.has(target)) findings.push({ severity: "HIGH", where: "frontmatter.target_types", problem: `target_types contains unknown type: ${target}` });
      }
    }
    if (fields.target_prompts) {
      const ids = fields.target_prompts.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        findings.push({ severity: "HIGH", where: "frontmatter.target_prompts", problem: "target_prompts is present but empty — omit the field or list at least one id" });
      }
      for (const id of ids) {
        if (!KEBAB_CASE.test(id)) findings.push({ severity: "HIGH", where: "frontmatter.target_prompts", problem: `target_prompts contains non-kebab-case id: ${id}` });
      }
    }
  } else if (fields.target_prompts) {
    findings.push({ severity: "HIGH", where: "frontmatter.target_prompts", problem: "target_prompts is only valid for middleware prompts" });
  }
}

const OPEN_MARKER = /<!--\s*(append|insert|replace)\s+"([^"]+)"([^>]*)-->/g;
const CLOSE_MARKER = /<!--\s*\/(append|insert|replace)\s*-->/g;
const EMPTY_BLOCK = /<!--\s*(append|insert|replace)\s+"([^"]+)"[^>]*-->\s*<!--\s*\/\1\s*-->/g;
const TODO_LINE = /^\s*TODO:\s/gm;
const PROMPT_GET_BROAD = /fabric\s+prompt\s+get\s+([A-Za-z][A-Za-z0-9_.-]*)/g;
const SCRIPT_RUN_BROAD = /fabric\s+script\s+run\s+([A-Za-z][A-Za-z0-9_.-]*)/g;

function lintMarkers(body, bodyStartLine, findings) {
  const opens = [];
  OPEN_MARKER.lastIndex = 0;
  let match;
  while ((match = OPEN_MARKER.exec(body)) !== null) {
    const [, op, id, rest] = match;
    const before = body.slice(0, match.index);
    const line = bodyStartLine + (before.match(/\n/g) || []).length + 1;
    const attrs = {};
    const attrRegex = /(\w+)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(rest)) !== null) attrs[attrMatch[1]] = attrMatch[2];
    opens.push({ op, id, attrs, line });
  }

  const closes = [];
  CLOSE_MARKER.lastIndex = 0;
  while ((match = CLOSE_MARKER.exec(body)) !== null) {
    const [, op] = match;
    const before = body.slice(0, match.index);
    const line = bodyStartLine + (before.match(/\n/g) || []).length + 1;
    closes.push({ op, line });
  }

  if (opens.length !== closes.length) {
    findings.push({
      severity: "CRITICAL",
      where: "body.markers",
      problem: `unbalanced markers: ${opens.length} opens vs ${closes.length} closes`,
    });
  }

  const matched = Math.min(opens.length, closes.length);
  for (let i = 0; i < matched; i += 1) {
    if (opens[i].op !== closes[i].op) {
      findings.push({
        severity: "CRITICAL",
        where: `body.markers[${i}]`,
        problem: `open <!-- ${opens[i].op} "${opens[i].id}" --> at line ${opens[i].line} is closed by <!-- /${closes[i].op} --> at line ${closes[i].line}`,
      });
    }
  }

  const seenIds = new Set();
  for (const open of opens) {
    if (open.op === "insert") {
      const hasBefore = Object.prototype.hasOwnProperty.call(open.attrs, "before");
      const hasAfter = Object.prototype.hasOwnProperty.call(open.attrs, "after");
      if (hasBefore === hasAfter) {
        findings.push({
          severity: "HIGH",
          where: `body.insert "${open.id}"`,
          problem: `insert must declare exactly one of before="..." or after="..." (line ${open.line})`,
        });
      }
    }
    if (open.op !== "replace" && seenIds.has(open.id)) {
      findings.push({
        severity: "HIGH",
        where: `body.block "${open.id}"`,
        problem: `duplicate block id at line ${open.line} (only replace may repeat an id)`,
      });
    }
    seenIds.add(open.id);
  }

  return { opens, closes };
}

function lineAt(body, bodyStartLine, index) {
  return bodyStartLine + (body.slice(0, index).match(/\n/g) || []).length + 1;
}

function lintEmptyBlocks(body, bodyStartLine, findings) {
  EMPTY_BLOCK.lastIndex = 0;
  let match;
  while ((match = EMPTY_BLOCK.exec(body)) !== null) {
    const line = lineAt(body, bodyStartLine, match.index);
    findings.push({
      severity: "MEDIUM",
      where: `body.block "${match[2]}"`,
      problem: `empty ${match[1]} block at line ${line}: add body content or remove the block`,
    });
  }
}

function lintTodoMarkers(body, bodyStartLine, findings) {
  TODO_LINE.lastIndex = 0;
  let match;
  while ((match = TODO_LINE.exec(body)) !== null) {
    const line = lineAt(body, bodyStartLine, match.index);
    findings.push({
      severity: "LOW",
      where: `body`,
      problem: `leftover "TODO:" placeholder at line ${line}; replace with real content or remove`,
    });
  }
}

function lintBrokenRefs(body, bodyStartLine, findings) {
  const patterns = [
    { regex: PROMPT_GET_BROAD, verb: "fabric prompt get", kind: "prompt" },
    { regex: SCRIPT_RUN_BROAD, verb: "fabric script run", kind: "script" },
  ];
  for (const { regex, verb, kind } of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(body)) !== null) {
      const refId = match[1].replace(/[.,;:)\]]+$/, "");
      if (KEBAB_CASE.test(refId)) continue;
      const line = lineAt(body, bodyStartLine, match.index);
      findings.push({
        severity: "HIGH",
        where: `body`,
        problem: `malformed ${kind} id in "${verb} ${match[1]}" at line ${line}: ids must be kebab-case`,
      });
    }
  }
}

module.exports = {
  id: "prompt-lint",
  name: "prompt lint",
  description: "Deterministically lint a fabric prompt file for frontmatter and marker syntax issues",
  interface: {
    details: [
      "Reads a fabric prompt file from disk and reports frontmatter, type, kebab-case id, middleware field, marker balance, insert-anchor, and unique-id findings.",
      "Also flags empty append/insert/replace blocks (MEDIUM), leftover 'TODO:' placeholders at line start (LOW), and malformed non-kebab-case ids in 'fabric prompt get <id>' / 'fabric script run <id>' body references (HIGH).",
      "Does not check type-fit, routing logic, registration-glob coverage, or cross-file id existence — those belong in prompt-review (judgment), prompt-register-dryrun (coverage), and prompt-kit-lint (cross-file).",
    ],
    usage: [
      "fabric script run prompt-lint <path-to-prompt.md>",
    ],
    parameters: [
      { name: "path", type: "string", required: true, description: "Absolute or cwd-relative path to the prompt file to lint." },
    ],
    returns: "JSON-formatted array of findings; each finding has severity, where, and problem fields. Empty array means the file passed the deterministic checks.",
    examples: [
      {
        command: "fabric script run prompt-lint pocs/fabric-kits/prompting/prompts/prompt.md",
        description: "Lint the prompt router.",
      },
    ],
    notes: [
      "Reports CRITICAL for fatal frontmatter/marker issues, HIGH for correctness issues (kebab-case id, insert-anchor, duplicate id, malformed body references), MEDIUM for empty blocks, and LOW for leftover TODO placeholders — severity is fixed per rule.",
      "Body reference checks only flag ids that are syntactically malformed (non-kebab-case). Unresolved-but-kebab-case references are checked by prompt-kit-lint against the active registry.",
    ],
  },
  run(args, context) {
    if (args.length !== 1) throw new Error("prompt-lint requires exactly one path argument");
    const target = path.isAbsolute(args[0]) ? args[0] : path.join(context.cwd, args[0]);
    if (!fs.existsSync(target)) throw new Error(`prompt-lint: file not found: ${target}`);
    const content = fs.readFileSync(target, "utf8");
    const findings = [];
    const { frontmatter, body, endLine } = splitFrontmatter(content);
    lintFrontmatter(parseFrontmatter(frontmatter, findings), frontmatter, findings);
    lintMarkers(body, endLine, findings);
    lintEmptyBlocks(body, endLine, findings);
    lintTodoMarkers(body, endLine, findings);
    lintBrokenRefs(body, endLine, findings);
    return JSON.stringify({ file: target, findings }, null, 2);
  },
};
