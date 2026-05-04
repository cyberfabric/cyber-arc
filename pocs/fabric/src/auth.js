const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const TOML = require("@iarna/toml");

const CREDENTIAL_NAME_RE = /^[a-z][a-z0-9-]*$/;
const ALLOWED_TYPES = new Set(["none", "bearer", "basic", "header"]);

function getFabricHomeDirectory(options = {}) {
  return options.homeDir || process.env.FABRIC_HOME || os.homedir();
}

function getAuthConfigPath(options = {}) {
  return path.join(getFabricHomeDirectory(options), ".fabric", "auth.toml");
}

function readAuthConfigFile(options = {}) {
  const authPath = getAuthConfigPath(options);
  if (!fs.existsSync(authPath)) {
    return { credentials: {} };
  }
  const parsed = TOML.parse(fs.readFileSync(authPath, "utf8"));
  const credentials = parsed.credentials || {};
  validateAuthConfig(credentials, authPath);
  return { credentials };
}

function validateAuthConfig(credentials, sourcePath) {
  for (const [name, credential] of Object.entries(credentials)) {
    if (!CREDENTIAL_NAME_RE.test(name)) {
      throw new Error(`Invalid credential name "${name}" in ${sourcePath}: must match ${CREDENTIAL_NAME_RE}`);
    }
    if (typeof credential.type !== "string" || !ALLOWED_TYPES.has(credential.type)) {
      throw new Error(`Credential "${name}" in ${sourcePath}: unknown type "${credential.type}"`);
    }
    if (credential.type === "bearer" && typeof credential.token !== "string") {
      throw new Error(`Credential "${name}" in ${sourcePath}: bearer type requires "token"`);
    }
    if (credential.type === "basic") {
      if (typeof credential.username !== "string" || typeof credential.password !== "string") {
        throw new Error(`Credential "${name}" in ${sourcePath}: basic type requires "username" and "password"`);
      }
    }
    if (credential.type === "header") {
      if (!credential.headers || typeof credential.headers !== "object") {
        throw new Error(`Credential "${name}" in ${sourcePath}: header type requires "headers" map`);
      }
    }
  }
}

/**
 * Build a per-request applier that mutates a headers object to inject this
 * credential. Returns undefined when the credential does not exist. Returns
 * a no-op applier when credentialName itself is undefined/empty.
 *
 * The applier is the only returned surface — callers never see the raw
 * credential object, so logging the applier does not leak secrets.
 */
function resolveAuth(credentialName, options = {}) {
  if (!credentialName) {
    return { applyHeaders: () => {} };
  }
  const { credentials } = readAuthConfigFile(options);
  const credential = credentials[credentialName];
  if (!credential) {
    return undefined;
  }
  return { applyHeaders: buildApplier(credential) };
}

function buildApplier(credential) {
  switch (credential.type) {
    case "none":
      return () => {};
    case "bearer":
      return (headers) => {
        headers.Authorization = `Bearer ${credential.token}`;
      };
    case "basic": {
      const encoded = Buffer.from(`${credential.username}:${credential.password}`).toString("base64");
      return (headers) => {
        headers.Authorization = `Basic ${encoded}`;
      };
    }
    case "header":
      return (headers) => {
        for (const [key, value] of Object.entries(credential.headers)) {
          headers[key] = String(value);
        }
      };
    default:
      throw new Error(`Unknown credential type: ${credential.type}`);
  }
}

/**
 * Look up the declared credential type without producing an applier. Used by
 * `fabric-poc api help` to show "Auth: github-token (bearer)" without touching
 * secret values. Returns undefined if the credential is not declared.
 */
function describeCredential(credentialName, options = {}) {
  if (!credentialName) return undefined;
  const { credentials } = readAuthConfigFile(options);
  const credential = credentials[credentialName];
  if (!credential) return undefined;
  return { type: credential.type };
}

module.exports = {
  getAuthConfigPath,
  readAuthConfigFile,
  resolveAuth,
  describeCredential,
};
