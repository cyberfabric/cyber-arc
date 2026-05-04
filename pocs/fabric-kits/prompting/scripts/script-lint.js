const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_EXPORTS = ["id", "name", "description", "run"];
const INTERFACE_ARRAY_FIELDS = ["details", "usage", "parameters", "examples", "notes"];
const FORBIDDEN_REQUIRES = [
  "child_process",
  "http",
  "https",
  "net",
  "dgram",
  "dns",
  "tls",
  "cluster",
  "worker_threads",
];

const SANDBOX_TIMEOUT_MS = 500;

function loadModuleInSandbox(source, filePath, findings) {
  const moduleObject = { exports: {} };
  const noopRequire = () => ({});
  const noopConsole = { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} };
  const sandbox = {
    module: moduleObject,
    exports: moduleObject.exports,
    require: noopRequire,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console: noopConsole,
    process: { env: {}, cwd: () => "/" },
    Buffer,
  };

  try {
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, {
      filename: filePath,
      timeout: SANDBOX_TIMEOUT_MS,
      displayErrors: true,
    });
  } catch (err) {
    findings.push({
      severity: "CRITICAL",
      where: "module.load",
      problem: `module cannot be evaluated in sandbox: ${err.message}`,
    });
    return null;
  }

  const exportsValue = sandbox.module && sandbox.module.exports;
  if (!exportsValue || typeof exportsValue !== "object") {
    findings.push({
      severity: "CRITICAL",
      where: "module.exports",
      problem: "module.exports is missing or not an object after sandbox evaluation",
    });
    return null;
  }
  return exportsValue;
}

function lintExports(module_, findings) {
  for (const field of REQUIRED_EXPORTS) {
    if (!(field in module_)) {
      findings.push({
        severity: "CRITICAL",
        where: `module.exports.${field}`,
        problem: `required export missing`,
      });
    }
  }

  if (module_.id && typeof module_.id !== "string") {
    findings.push({ severity: "CRITICAL", where: "module.exports.id", problem: "id must be a string" });
  } else if (module_.id && !KEBAB_CASE.test(module_.id)) {
    findings.push({ severity: "HIGH", where: "module.exports.id", problem: `id is not kebab-case: ${module_.id}` });
  }

  for (const stringField of ["name", "description"]) {
    if (module_[stringField] !== undefined && typeof module_[stringField] !== "string") {
      findings.push({ severity: "HIGH", where: `module.exports.${stringField}`, problem: `${stringField} must be a string` });
    }
  }

  if ("run" in module_ && typeof module_.run !== "function") {
    findings.push({ severity: "CRITICAL", where: "module.exports.run", problem: "run must be a function" });
  } else if (typeof module_.run === "function" && module_.run.length > 2) {
    findings.push({ severity: "HIGH", where: "module.exports.run", problem: `run should accept at most (args, context); got arity ${module_.run.length}` });
  }
}

function lintInterface(module_, findings) {
  if (!module_.interface) {
    findings.push({
      severity: "MEDIUM",
      where: "module.exports.interface",
      problem: "interface is missing; fabric-poc script help will have minimal output",
    });
    return;
  }

  const iface = module_.interface;
  if (typeof iface !== "object" || Array.isArray(iface)) {
    findings.push({ severity: "HIGH", where: "module.exports.interface", problem: "interface must be an object" });
    return;
  }

  for (const field of INTERFACE_ARRAY_FIELDS) {
    if (field === "parameters" || field === "examples") continue;
    if (iface[field] !== undefined && typeof iface[field] !== "string" && !Array.isArray(iface[field])) {
      findings.push({
        severity: "HIGH",
        where: `module.exports.interface.${field}`,
        problem: `${field} must be a string or an array`,
      });
    }
  }

  if (iface.returns !== undefined && typeof iface.returns !== "string") {
    findings.push({ severity: "HIGH", where: "module.exports.interface.returns", problem: "returns must be a string" });
  }

  if (Array.isArray(iface.parameters)) {
    for (let i = 0; i < iface.parameters.length; i += 1) {
      const p = iface.parameters[i];
      if (typeof p === "string") continue;
      if (!p || typeof p !== "object" || Array.isArray(p)) {
        findings.push({ severity: "HIGH", where: `module.exports.interface.parameters[${i}]`, problem: "parameter entry must be an object" });
        continue;
      }
      if (typeof p.name !== "string" || p.name.length === 0) findings.push({ severity: "HIGH", where: `module.exports.interface.parameters[${i}].name`, problem: "name must be a non-empty string" });
      if (p.type !== undefined && typeof p.type !== "string") findings.push({ severity: "HIGH", where: `module.exports.interface.parameters[${i}].type`, problem: "type must be a string when provided" });
      if (p.description !== undefined && typeof p.description !== "string") findings.push({ severity: "HIGH", where: `module.exports.interface.parameters[${i}].description`, problem: "description must be a string when provided" });
    }
  } else if (iface.parameters !== undefined) {
    findings.push({ severity: "HIGH", where: "module.exports.interface.parameters", problem: "parameters must be an array" });
  }

  if (Array.isArray(iface.examples)) {
    for (let i = 0; i < iface.examples.length; i += 1) {
      const e = iface.examples[i];
      if (typeof e === "string") continue;
      if (!e || typeof e !== "object" || Array.isArray(e)) {
        findings.push({ severity: "HIGH", where: `module.exports.interface.examples[${i}]`, problem: "example entry must be an object" });
        continue;
      }
      if (typeof e.command !== "string" || e.command.length === 0) findings.push({ severity: "HIGH", where: `module.exports.interface.examples[${i}].command`, problem: "command must be a non-empty string" });
      if (e.description !== undefined && typeof e.description !== "string") findings.push({ severity: "HIGH", where: `module.exports.interface.examples[${i}].description`, problem: "description must be a string when provided" });
    }
  } else if (iface.examples !== undefined) {
    findings.push({ severity: "HIGH", where: "module.exports.interface.examples", problem: "examples must be an array" });
  }
}

function scanForbiddenRequires(source, findings) {
  const requireRegExp = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = requireRegExp.exec(source)) !== null) {
    const target = match[1].replace(/^node:/, "");
    if (FORBIDDEN_REQUIRES.includes(target)) {
      const before = source.slice(0, match.index);
      const line = (before.match(/\n/g) || []).length + 1;
      findings.push({
        severity: "MEDIUM",
        where: `require at line ${line}`,
        problem: `require("${match[1]}") is on the restricted side-effect list; document the opt-in flag and the use case in interface.notes`,
      });
    }
  }
}

function scanRelativeFabricReach(source, findings) {
  const relativeReachRegExp = /require\s*\(\s*["'](\.{2}(?:\/\.{2})*\/fabric\/src[^"']*)["']\s*\)/g;
  let match;
  while ((match = relativeReachRegExp.exec(source)) !== null) {
    const before = source.slice(0, match.index);
    const line = (before.match(/\n/g) || []).length + 1;
    findings.push({
      severity: "HIGH",
      where: `require at line ${line}`,
      problem: `require("${match[1]}") reaches into fabric internals via relative path; use require("@cyberfabric/fabric") instead (portability violation)`,
    });
  }
}

function scanStdoutWrites(source, findings) {
  const patterns = [
    /console\.log\s*\(/g,
    /process\.stdout\.write\s*\(/g,
    /process\.stderr\.write\s*\(/g,
  ];
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source)) !== null) {
      const before = source.slice(0, match.index);
      const line = (before.match(/\n/g) || []).length + 1;
      findings.push({
        severity: "MEDIUM",
        where: `stdout/stderr write at line ${line}`,
        problem: `${match[0].trim()} bypasses the fabric output contract; return a string from run() instead`,
      });
    }
  }
}

module.exports = {
  id: "script-lint",
  name: "script lint",
  description: "Deterministically lint a fabric-poc script file for exports shape, interface shape, determinism, and side-effect-budget violations",
  interface: {
    details: [
      "Reads the source and evaluates the module inside an isolated node:vm sandbox with require() stubbed to a no-op, a 500 ms execution cap, and no access to fs / network / subprocess globals. The inspected value of module.exports drives every exports- and interface-shape finding.",
      "Because require() is stubbed, any top-level IO the target script would have performed under a real require() is suppressed: linting is safe against untrusted scripts that would otherwise write files, open sockets, or spawn processes at load time.",
      "Statically scans the source text for restricted requires (child_process, http, net, etc.), relative reaches into fabric internals, and direct stdout/stderr writes.",
      "Does not cover determinism beyond what static scan and sandbox evaluation can infer; dynamic determinism remains a judgment finding for prompt-script / script-bug-finding.",
    ],
    usage: [
      "fabric-poc script run script-lint <path-to-script.js>",
    ],
    parameters: [
      { name: "path", type: "string", required: true, description: "Absolute or cwd-relative path to the script file to lint." },
    ],
    returns: "JSON object with file and findings (array of {severity, where, problem}). Empty findings means the file passed all deterministic checks.",
    examples: [
      {
        command: "fabric-poc script run script-lint pocs/fabric-kits/prompting/scripts/prompt-scaffold.js",
        description: "Lint the prompt-scaffold script in the sandbox.",
      },
    ],
    notes: [
      "Reports CRITICAL for sandbox-evaluation failures and missing required exports; HIGH for shape errors (non-kebab id, wrong types, malformed interface, relative fabric reach); MEDIUM for restricted requires, stdout writes, and missing interface.",
      "The sandbox stubs require() to a no-op. A script that relies on required modules for top-level computation (rather than for in-run helpers) will see undefined bindings and the exports object may be incomplete; the resulting finding is still safe — it just flags the script as non-sandbox-friendly.",
      "The sandbox enforces a 500 ms timeout, so pathological or infinite-loop top-level code fails closed with a CRITICAL finding rather than blocking the linter.",
    ],
  },
  run(args, context) {
    if (args.length !== 1) throw new Error("script-lint requires exactly one path argument");
    const target = path.isAbsolute(args[0]) ? args[0] : path.join(context.cwd, args[0]);
    if (!fs.existsSync(target)) throw new Error(`script-lint: file not found: ${target}`);
    const findings = [];
    const source = fs.readFileSync(target, "utf8");
    const module_ = loadModuleInSandbox(source, target, findings);
    if (module_) {
      lintExports(module_, findings);
      lintInterface(module_, findings);
    }
    scanForbiddenRequires(source, findings);
    scanRelativeFabricReach(source, findings);
    scanStdoutWrites(source, findings);
    return JSON.stringify({ file: target, findings }, null, 2);
  },
};
