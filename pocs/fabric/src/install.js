const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { parseResourcesManifest } = require("./resources");

const PACKAGE_MANAGER_LOCKFILES = [
  { manager: "pnpm", file: "pnpm-lock.yaml" },
  { manager: "yarn", file: "yarn.lock" },
  { manager: "bun", file: "bun.lock" },
  { manager: "bun", file: "bun.lockb" },
  { manager: "npm", file: "package-lock.json" },
];

function detectPackageManager(kitDir) {
  for (const { manager, file } of PACKAGE_MANAGER_LOCKFILES) {
    if (fs.existsSync(path.join(kitDir, file))) {
      return manager;
    }
  }
  return "npm";
}

function buildInstallCommand({ packageManager, hasLockfile, ignoreScripts }) {
  let command;
  let args;
  switch (packageManager) {
    case "npm":
      command = "npm";
      args = hasLockfile ? ["ci"] : ["install"];
      break;
    case "pnpm":
      command = "pnpm";
      args = hasLockfile ? ["install", "--frozen-lockfile"] : ["install"];
      break;
    case "yarn":
      command = "yarn";
      args = hasLockfile ? ["install", "--frozen-lockfile"] : ["install"];
      break;
    case "bun":
      command = "bun";
      args = hasLockfile ? ["install", "--frozen-lockfile"] : ["install"];
      break;
    default:
      throw new Error(`buildInstallCommand: unknown package manager ${JSON.stringify(packageManager)}`);
  }
  if (ignoreScripts) args.push("--ignore-scripts");
  return { command, args };
}

function computeInstallDecision({ strategy, hasNodeModules, currentState, expectedState, flags }) {
  if (strategy === "none") {
    return { action: "skip", reason: "no-deps" };
  }
  if (strategy === "vendored") {
    if (!hasNodeModules) {
      return { action: "fail", reason: "vendored-but-no-node_modules" };
    }
    return { action: "verify", reason: "vendored-ok" };
  }
  if (strategy !== "package-json") {
    throw new Error(`computeInstallDecision: unknown strategy ${JSON.stringify(strategy)}`);
  }
  if (flags && flags.reinstall) {
    return { action: "install", reason: "reinstall-flag" };
  }
  if (flags && flags.noInstall) {
    if (!hasNodeModules) {
      return { action: "fail", reason: "no-install-but-missing-node_modules" };
    }
    return { action: "verify", reason: "no-install-flag" };
  }
  if (!hasNodeModules) {
    return { action: "install", reason: "no-node-modules" };
  }
  if (!currentState) {
    return { action: "install", reason: "no-state-file" };
  }
  if (currentState.lockfileHash !== expectedState.lockfileHash) {
    return { action: "install", reason: "lockfile-hash-mismatch" };
  }
  if (currentState.packageJsonHash !== expectedState.packageJsonHash) {
    return { action: "install", reason: "package.json-hash-mismatch" };
  }
  if (currentState.nodeVersion !== expectedState.nodeVersion) {
    return { action: "install", reason: "node-version-mismatch" };
  }
  return { action: "skip", reason: "state-match" };
}

function findLockfilePath(kitPath) {
  for (const { file } of PACKAGE_MANAGER_LOCKFILES) {
    const candidate = path.join(kitPath, file);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function sha256OfFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function nodeModulesNonEmpty(kitPath) {
  const dir = path.join(kitPath, "node_modules");
  if (!fs.existsSync(dir)) return false;
  if (!fs.statSync(dir).isDirectory()) return false;
  const entries = fs.readdirSync(dir).filter((entry) => entry !== ".fabric-install-state.json");
  return entries.length > 0;
}

function readInstallState(stateFilePath) {
  if (!fs.existsSync(stateFilePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(stateFilePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function defaultRunner({ command, args, cwd, env }) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8" });
  if (result.error) {
    return {
      status: typeof result.status === "number" ? result.status : 1,
      stdout: result.stdout || "",
      stderr: result.stderr || result.error.message || "",
    };
  }
  return {
    status: result.status == null ? 1 : result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function installKit(kitPath, options = {}) {
  const runner = options.runner || defaultRunner;
  const noInstall = Boolean(options.noInstall);
  const reinstall = Boolean(options.reinstall);
  const env = options.env || process.env;

  const deps = resolveKitDependencies(kitPath);
  const stateFilePath = path.join(kitPath, "node_modules", ".fabric-install-state.json");
  const hasNodeModules = nodeModulesNonEmpty(kitPath);

  let lockfilePath = null;
  let lockfileHash = null;
  let packageJsonHash = null;
  if (deps.strategy === "package-json") {
    const packageJsonPath = path.join(kitPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`installKit: kit at ${kitPath} declares package-json strategy but has no package.json`);
    }
    packageJsonHash = sha256OfFile(packageJsonPath);
    lockfilePath = findLockfilePath(kitPath);
    lockfileHash = lockfilePath ? sha256OfFile(lockfilePath) : "";
  }

  const expectedState = {
    packageJsonHash,
    lockfileHash,
    packageManager: deps.packageManager,
    nodeVersion: process.version,
  };
  const currentState = readInstallState(stateFilePath);

  const decision = computeInstallDecision({
    strategy: deps.strategy,
    hasNodeModules,
    currentState,
    expectedState,
    flags: { noInstall, reinstall },
  });

  if (decision.action === "fail") {
    if (decision.reason === "vendored-but-no-node_modules") {
      throw new Error(`installKit: kit at ${kitPath} declares vendored dependencies but node_modules is missing or empty. Vendor the dependencies into ${path.join(kitPath, "node_modules")} or change strategy.`);
    }
    if (decision.reason === "no-install-but-missing-node_modules") {
      throw new Error(`installKit: --no-install was set but node_modules is missing or empty at ${kitPath}. Run \`fabric kit install ${kitPath}\` first or drop --no-install.`);
    }
    throw new Error(`installKit: ${decision.reason} at ${kitPath}`);
  }
  if (decision.action === "skip" || decision.action === "verify") {
    return {
      action: decision.action,
      reason: decision.reason,
      strategy: deps.strategy,
      packageManager: deps.packageManager,
      stateFile: stateFilePath,
    };
  }

  const cmd = buildInstallCommand({
    packageManager: deps.packageManager,
    hasLockfile: Boolean(lockfilePath),
    ignoreScripts: deps.ignoreScripts,
  });
  const startedAt = Date.now();
  const runResult = runner({ command: cmd.command, args: cmd.args, cwd: kitPath, env });
  const durationMs = Date.now() - startedAt;
  if (runResult.status !== 0) {
    const tail = runResult.stderr || runResult.stdout || "";
    throw new Error(`installKit: \`${cmd.command} ${cmd.args.join(" ")}\` failed in ${kitPath} (exit status ${runResult.status})\n${tail}`);
  }
  fs.mkdirSync(path.join(kitPath, "node_modules"), { recursive: true });
  const newState = {
    ...expectedState,
    installedAt: new Date().toISOString(),
  };
  fs.writeFileSync(stateFilePath, `${JSON.stringify(newState, null, 2)}\n`, "utf8");
  return {
    action: "install",
    reason: decision.reason,
    strategy: deps.strategy,
    packageManager: deps.packageManager,
    command: cmd.command,
    args: cmd.args,
    stateFile: stateFilePath,
    durationMs,
  };
}

function resolveKitDependencies(kitPath) {
  const manifestPath = path.join(kitPath, "resources.toml");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`resolveKitDependencies: kit has no resources.toml at ${manifestPath}`);
  }
  const parsed = parseResourcesManifest(fs.readFileSync(manifestPath, "utf8"));
  let dependencies = parsed.dependencies;
  if (!dependencies) {
    const hasPackageJson = fs.existsSync(path.join(kitPath, "package.json"));
    dependencies = {
      strategy: hasPackageJson ? "package-json" : "none",
      packageManager: "auto",
      ignoreScripts: false,
    };
  }
  if (dependencies.packageManager === "auto") {
    return { ...dependencies, packageManager: detectPackageManager(kitPath) };
  }
  return { ...dependencies };
}

module.exports = {
  detectPackageManager,
  buildInstallCommand,
  computeInstallDecision,
  resolveKitDependencies,
  installKit,
};
