const path = require("node:path");

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function relativeUnderRoot(absPath, projectRoot) {
  if (!projectRoot) return absPath;
  const normRoot = path.resolve(projectRoot);
  const normPath = path.resolve(absPath);
  if (normPath === normRoot) return "";
  if (normPath.startsWith(normRoot + path.sep)) {
    return normPath.slice(normRoot.length + 1);
  }
  return normPath;
}

function buildTargetKey({ targetForm, target, projectRoot, artifactKind }) {
  if (!targetForm) throw new Error("buildTargetKey: targetForm is required");
  if (!target) throw new Error("buildTargetKey: target is required");
  switch (targetForm) {
    case "artifact-path":
      return `artifact-path:${path.resolve(target)}`;
    case "artifact": {
      if (!artifactKind) throw new Error("buildTargetKey: artifactKind is required for artifact form");
      return `artifact:${artifactKind}:${target}`;
    }
    case "path":
      return `path:${path.resolve(target)}`;
    case "feature-path":
      return `feature-path:${path.resolve(target)}`;
    case "feature-id":
      return `feature-id:${target}`;
    case "feature-title":
      return `feature-title:${slugify(target)}`;
    default:
      throw new Error(`buildTargetKey: unknown targetForm ${JSON.stringify(targetForm)}`);
  }
}

function buildTaskSlug({ type, targetForm, target, projectRoot, artifactKind }) {
  if (!type) throw new Error("buildTaskSlug: type is required");
  switch (type) {
    case "generate":
    case "analyze": {
      if (targetForm === "path") {
        const rel = relativeUnderRoot(target, projectRoot);
        return `${type}-path-${slugify(rel || target)}`;
      }
      const slug = targetForm === "artifact-path"
        ? slugify(path.basename(target).replace(/\.[^.]+$/, ""))
        : slugify(target);
      const kind = artifactKind ? slugify(artifactKind) : "artifact";
      return `${type}-${kind}-${slug}`;
    }
    case "implement": {
      if (targetForm === "feature-path") {
        const rel = relativeUnderRoot(target, projectRoot);
        return `implement-feature-${slugify(rel || target)}`;
      }
      return `implement-feature-${slugify(target)}`;
    }
    default:
      throw new Error(`buildTaskSlug: unknown type ${JSON.stringify(type)}`);
  }
}

module.exports = {
  KEBAB_CASE,
  slugify,
  buildTargetKey,
  buildTaskSlug,
  relativeUnderRoot,
};
