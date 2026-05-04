const fs = require("node:fs");
const path = require("node:path");
const {
  ensureGlobalResourceRegistry,
  ensureResourcesManifest,
  getGlobalResourcesManifestPath,
  getLocalResourcesManifestPath,
  manifestPath,
  readResourcesManifestFile,
  resolveActiveManifestPaths,
  resolveResourcePatternsFromManifest,
} = require("./resources");

const allowedPromptTypes = new Set(["skill", "agent", "rules", "template", "middleware", "workflow", "checklist"]);
const allowedMiddlewareTimings = new Set(["pre", "post"]);

const promptTypeCatalog = [
  {
    type: "skill",
    summary: "Directly invokable fabric skill; becomes `fabric-<id>` after fabric-poc register.",
    whenToUse: "The user should invoke this capability as a named skill (for example a router or a top-level action).",
    requiredFields: ["id", "type", "name", "description"],
    optionalFields: [],
    notes: [
      "Registered to .claude/skills and .agents/skills by `fabric-poc register`.",
      "Routers of this type should dispatch to `rules` prompts via `fabric-poc prompt get <id>-<mode>`.",
    ],
  },
  {
    type: "rules",
    summary: "Mode-specific rule body loaded by another prompt via `fabric-poc prompt get`.",
    whenToUse: "A router skill needs to pull in mode-specific instructions (brainstorm / generate / review / ...).",
    requiredFields: ["id", "type", "name", "description"],
    optionalFields: [],
    notes: [
      "Not auto-registered as a skill; activated only through another prompt.",
      "Keep routing logic out of rules files.",
    ],
  },
  {
    type: "template",
    summary: "Static template content (document layout, placeholder structure) loaded by other prompts.",
    whenToUse: "You need a reusable layout or scaffold consumed via `fabric-poc prompt get <id>`.",
    requiredFields: ["id", "type", "name", "description"],
    optionalFields: [],
    notes: [
      "Keep templates free of procedural instructions — those belong in `rules` or `skill` prompts.",
    ],
  },
  {
    type: "middleware",
    summary: "Cross-cutting pre/post guidance injected around prompts of matching target types.",
    whenToUse: "A constraint or format rule must apply uniformly to a category of prompts (for example English-only artifacts, questions-at-end).",
    requiredFields: ["id", "type", "name", "description", "target_types", "timing"],
    optionalFields: ["target_prompts"],
    notes: [
      "`target_types` is a comma-separated list of prompt types the middleware applies to.",
      "`target_prompts` is an optional comma-separated list of specific prompt ids; when set, the middleware applies only to those ids that also match `target_types` (AND semantics). Omit it to wrap every prompt of a matching type.",
      "`timing` must be `pre` (prelude) or `post` (postlude).",
      "Keep the body short and narrowly scoped; do not duplicate logic that belongs in the target prompts.",
    ],
  },
  {
    type: "workflow",
    summary: "Structured multi-step procedure loaded as a plain prompt.",
    whenToUse: "The user needs a concrete ordered process to execute or hand to an agent.",
    requiredFields: ["id", "type", "name", "description"],
    optionalFields: [],
    notes: [
      "Write explicit sequential steps; offload deterministic steps to `fabric-poc script run <id>`.",
    ],
  },
  {
    type: "checklist",
    summary: "Concrete checklist loaded as a plain prompt.",
    whenToUse: "The user needs a set of verifications or required items to go through.",
    requiredFields: ["id", "type", "name", "description"],
    optionalFields: [],
    notes: [
      "Use imperative, verifiable items; avoid narrative explanations.",
    ],
  },
  {
    type: "agent",
    summary: "Agent-oriented prompt describing a role and invocation interface.",
    whenToUse: "You need to package a persona or agent role to be invoked by another integration.",
    requiredFields: ["id", "type", "name", "description"],
    optionalFields: [],
    notes: [
      "State the agent's inputs, outputs, and hand-off points clearly.",
    ],
  },
];

function listPromptTypeCatalog() {
  return promptTypeCatalog.map((entry) => ({
    type: entry.type,
    summary: entry.summary,
    whenToUse: entry.whenToUse,
    requiredFields: [...entry.requiredFields],
    optionalFields: [...(entry.optionalFields || [])],
    notes: [...(entry.notes || [])],
  }));
}

function getPromptTypeHelp(type) {
  const entry = promptTypeCatalog.find((candidate) => candidate.type === type);

  if (!entry) {
    return undefined;
  }

  const lines = [
    `Type: ${entry.type}`,
    `Summary: ${entry.summary}`,
    `When to use: ${entry.whenToUse}`,
    `Required frontmatter: ${entry.requiredFields.join(", ")}`,
  ];

  if (entry.optionalFields && entry.optionalFields.length > 0) {
    lines.push(`Optional frontmatter: ${entry.optionalFields.join(", ")}`);
  }

  lines.push("", "Authoring notes:");

  if (entry.notes && entry.notes.length > 0) {
    for (const note of entry.notes) {
      lines.push(`  - ${note}`);
    }
  } else {
    lines.push("  - none");
  }

  return lines.join("\n");
}

let promptCache;
let promptCacheKey;

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function parseList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getGlobalPromptsManifestPath(options = {}) {
  return getGlobalResourcesManifestPath(options);
}

function getLocalPromptsManifestPath(options = {}) {
  return getLocalResourcesManifestPath(options);
}

function resolvePromptPatternsFromManifest(targetManifestPath = manifestPath) {
  return resolveResourcePatternsFromManifest(targetManifestPath).promptFiles;
}

function ensurePromptsManifest(targetManifestPath, promptFiles = []) {
  return ensureResourcesManifest(targetManifestPath, { promptFiles });
}

function ensureGlobalPromptRegistry(options = {}) {
  return ensureGlobalResourceRegistry(options);
}

function patternToRegExp(pattern) {
  return new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
      .replace(/\*/g, ".*")}$`
  );
}

function expandPromptPattern(rootDir, pattern) {
  const absolutePattern = path.isAbsolute(pattern) ? pattern : path.join(rootDir, pattern);

  if (!absolutePattern.includes("*")) {
    return fs.existsSync(absolutePattern) ? [absolutePattern] : [];
  }

  const directory = path.dirname(absolutePattern);
  const filenamePattern = path.basename(absolutePattern);
  const matcher = patternToRegExp(filenamePattern);

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && matcher.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function parseFrontmatter(fileContent, filePath) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match) {
    throw new Error(`Prompt file is missing frontmatter: ${filePath}`);
  }

  const metadata = {};

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line in ${filePath}: ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripQuotes(line.slice(separatorIndex + 1).trim());
    metadata[key] = value;
  }

  return {
    metadata,
    body: fileContent.slice(match[0].length),
  };
}

function parseAttributes(rawAttributes) {
  const attributes = {};

  if (!rawAttributes || !rawAttributes.trim()) {
    return attributes;
  }

  for (const match of rawAttributes.matchAll(/([a-zA-Z_][a-zA-Z0-9_-]*)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }

  return attributes;
}

function parsePromptBlocks(body, filePath) {
  const openPattern = /^\s*<!--\s*(append|insert|replace)\s+"([^"]+)"(?:\s+(.*?))?\s*-->\s*$/;
  const closePattern = /^\s*<!--\s*\/(append|insert|replace)\s*-->\s*$/;
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let currentBlock = null;

  for (const line of lines) {
    if (!currentBlock) {
      const openMatch = line.match(openPattern);

      if (!openMatch) {
        continue;
      }

      currentBlock = {
        operation: openMatch[1],
        id: openMatch[2],
        attributes: parseAttributes(openMatch[3]),
        lines: [],
      };
      continue;
    }

    const closeMatch = line.match(closePattern);

    if (closeMatch) {
      if (closeMatch[1] !== currentBlock.operation) {
        throw new Error(`Mismatched prompt marker in ${filePath}: expected /${currentBlock.operation}`);
      }

      blocks.push({
        operation: currentBlock.operation,
        id: currentBlock.id,
        attributes: currentBlock.attributes,
        content: currentBlock.lines.join("\n"),
      });
      currentBlock = null;
      continue;
    }

    currentBlock.lines.push(line);
  }

  if (currentBlock) {
    throw new Error(`Unclosed prompt marker in ${filePath}: ${currentBlock.id}`);
  }

  return blocks;
}

function readPromptSource(filePath) {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const { metadata, body } = parseFrontmatter(fileContent, filePath);

  return {
    filePath,
    fileContent,
    metadata,
    body,
  };
}

function parsePromptSource(source, options = {}) {
  const { filePath, fileContent, metadata, body } = source;
  const resolvedType = metadata.type || options.inferredType;

  if (!metadata.id) {
    throw new Error(`Prompt file is missing id: ${filePath}`);
  }

  if (!resolvedType) {
    throw new Error(`Prompt file is missing type: ${filePath}`);
  }

  if (!allowedPromptTypes.has(resolvedType)) {
    throw new Error(`Unsupported prompt type in ${filePath}: ${resolvedType}`);
  }

  const document = {
    id: metadata.id,
    type: resolvedType,
    name: metadata.name || metadata.id,
    description: metadata.description || "",
    filePath,
    metadata,
    source: fileContent,
    blocks: parsePromptBlocks(body, filePath),
  };

  if (resolvedType === "middleware") {
    if (!metadata.target_types) {
      throw new Error(`Middleware prompt file is missing target_types: ${filePath}`);
    }

    if (!metadata.timing) {
      throw new Error(`Middleware prompt file is missing timing: ${filePath}`);
    }

    const targetTypes = parseList(metadata.target_types);

    if (!targetTypes.length) {
      throw new Error(`Middleware prompt file has no target_types: ${filePath}`);
    }

    if (!allowedMiddlewareTimings.has(metadata.timing)) {
      throw new Error(`Unsupported middleware timing in ${filePath}: ${metadata.timing}`);
    }

    document.targetTypes = targetTypes;
    document.targetPrompts = metadata.target_prompts ? parseList(metadata.target_prompts) : [];
    document.timing = metadata.timing;
  }

  return document;
}

function parsePromptFile(filePath, options = {}) {
  return parsePromptSource(readPromptSource(filePath), options);
}

function insertBlock(blocks, block) {
  const hasBefore = typeof block.attributes.before === "string";
  const hasAfter = typeof block.attributes.after === "string";

  if (hasBefore === hasAfter) {
    throw new Error(`Insert block ${block.id} must define exactly one of before or after`);
  }

  const anchorId = hasBefore ? block.attributes.before : block.attributes.after;
  const anchorIndex = blocks.findIndex((entry) => entry.id === anchorId);

  if (anchorIndex === -1) {
    throw new Error(`Insert anchor not found for block ${block.id}: ${anchorId}`);
  }

  const insertIndex = hasBefore ? anchorIndex : anchorIndex + 1;
  blocks.splice(insertIndex, 0, { id: block.id, content: block.content, replaced: false });
}

function joinBlockContent(left, right) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return [left, right].join("\n");
}

function buildPrompt(documents) {
  const blocks = [];

  for (const document of documents) {
    for (const block of document.blocks) {
      if (blocks.some((entry) => entry.id === block.id) && block.operation !== "replace") {
        throw new Error(`Duplicate prompt block id: ${block.id}`);
      }

      if (block.operation === "append") {
        blocks.push({ id: block.id, content: block.content, replaced: false });
        continue;
      }

      if (block.operation === "insert") {
        insertBlock(blocks, block);
        continue;
      }

      const blockIndex = blocks.findIndex((entry) => entry.id === block.id);

      if (blockIndex === -1) {
        throw new Error(`Cannot replace missing prompt block: ${block.id}`);
      }

      const existing = blocks[blockIndex];

      if (!existing.replaced) {
        blocks[blockIndex] = { id: block.id, content: block.content, replaced: true };
        continue;
      }

      blocks[blockIndex] = {
        id: block.id,
        content: joinBlockContent(existing.content, block.content),
        replaced: true,
      };
    }
  }

  return blocks.map((block) => block.content).join("\n");
}

function middlewareApplies(middlewareDocument, definition) {
  if (!middlewareDocument.targetTypes || !middlewareDocument.targetTypes.includes(definition.type)) {
    return false;
  }

  if (middlewareDocument.targetPrompts && middlewareDocument.targetPrompts.length > 0) {
    const targetId = definition.documents[0].id;
    return middlewareDocument.targetPrompts.includes(targetId);
  }

  return true;
}

function selectApplicableMiddleware(middlewareDocuments, definition) {
  return middlewareDocuments.filter((document) => middlewareApplies(document, definition));
}

function composePrompt(documents, middlewareDocuments) {
  const prelude = buildPrompt(middlewareDocuments.filter((document) => document.timing === "pre"));
  const prompt = buildPrompt(documents);
  const postlude = buildPrompt(middlewareDocuments.filter((document) => document.timing === "post"));

  return [prelude, prompt, postlude].filter(Boolean).join("\n");
}

function mergePromptDefinitions(promptFiles) {
  const promptSources = promptFiles.map((promptFile) => readPromptSource(promptFile));
  const declaredTypesById = new Map();
  const promptDefinitionsById = new Map();
  const middlewareDocuments = [];

  for (const source of promptSources) {
    if (!source.metadata.id) {
      throw new Error(`Prompt file is missing id: ${source.filePath}`);
    }

    if (!source.metadata.type) {
      continue;
    }

    if (!allowedPromptTypes.has(source.metadata.type)) {
      throw new Error(`Unsupported prompt type in ${source.filePath}: ${source.metadata.type}`);
    }

    const existingDeclaredType = declaredTypesById.get(source.metadata.id);

    if (existingDeclaredType && existingDeclaredType !== source.metadata.type) {
      throw new Error(`Prompt id mixes multiple prompt types: ${source.metadata.id}`);
    }

    declaredTypesById.set(source.metadata.id, source.metadata.type);
  }

  for (const source of promptSources) {
    const document = parsePromptSource(source, { inferredType: declaredTypesById.get(source.metadata.id) });
    const existing = promptDefinitionsById.get(document.id);

    if (existing && existing.type !== document.type) {
      throw new Error(`Prompt id mixes multiple prompt types: ${document.id}`);
    }

    if (document.type === "middleware") {
      middlewareDocuments.push(document);
    }

    if (existing) {
      existing.documents.push(document);
      continue;
    }

    promptDefinitionsById.set(document.id, {
      type: document.type,
      name: document.name,
      description: document.description,
      documents: [document],
    });
  }

  return {
    promptDefinitionsById,
    middlewareDocuments,
  };
}

function loadPromptDefinitionsFromManifests(targetManifestPaths) {
  const promptFiles = [];
  const seenPromptFiles = new Set();

  for (const targetManifestPath of targetManifestPaths) {
    const patterns = resolvePromptPatternsFromManifest(targetManifestPath);

    for (const promptFile of patterns.flatMap((pattern) => expandPromptPattern(path.dirname(targetManifestPath), pattern))) {
      if (seenPromptFiles.has(promptFile)) {
        continue;
      }

      seenPromptFiles.add(promptFile);
      promptFiles.push(promptFile);
    }
  }

  return mergePromptDefinitions(promptFiles);
}

function loadPromptDefinitionsFromManifest(targetManifestPath = manifestPath) {
  return loadPromptDefinitionsFromManifests([targetManifestPath]);
}

function listPromptMetadata(targetManifestPath = manifestPath) {
  const { promptDefinitionsById } = loadPromptDefinitionsFromManifest(targetManifestPath);

  return Array.from(promptDefinitionsById.entries()).map(([id, definition]) => ({
    id,
    type: definition.type,
    name: definition.name,
    description: definition.description,
  }));
}

function listActivePromptMetadata(options = {}) {
  const { promptDefinitionsById } = loadPromptDefinitionsFromManifests(resolveActiveManifestPaths(options));

  return Array.from(promptDefinitionsById.entries()).map(([id, definition]) => ({
    id,
    type: definition.type,
    name: definition.name,
    description: definition.description,
  }));
}

function loadPromptsFromManifest(targetManifestPath = manifestPath) {
  const { promptDefinitionsById, middlewareDocuments } = loadPromptDefinitionsFromManifest(targetManifestPath);

  const prompts = new Map();

  for (const [promptId, definition] of promptDefinitionsById.entries()) {
    if (definition.type === "middleware") {
      prompts.set(promptId, buildPrompt(definition.documents));
      continue;
    }

    const applicableMiddleware = selectApplicableMiddleware(middlewareDocuments, definition);
    prompts.set(promptId, composePrompt(definition.documents, applicableMiddleware));
  }

  return prompts;
}

function loadActivePrompts(options = {}) {
  const { promptDefinitionsById, middlewareDocuments } = loadPromptDefinitionsFromManifests(resolveActiveManifestPaths(options));
  const prompts = new Map();

  for (const [promptId, definition] of promptDefinitionsById.entries()) {
    if (definition.type === "middleware") {
      prompts.set(promptId, buildPrompt(definition.documents));
      continue;
    }

    const applicableMiddleware = selectApplicableMiddleware(middlewareDocuments, definition);
    prompts.set(promptId, composePrompt(definition.documents, applicableMiddleware));
  }

  return prompts;
}

function loadPrompts(options = {}) {
  const cacheKey = resolveActiveManifestPaths(options).join("|");

  if (promptCache && promptCacheKey === cacheKey) {
    return promptCache;
  }

  promptCache = loadActivePrompts(options);
  promptCacheKey = cacheKey;

  return promptCache;
}

function getPrompt(name, options = {}) {
  return loadPrompts(options).get(name);
}

function getPromptDefinition(name, options = {}) {
  return loadPromptDefinitionsFromManifests(resolveActiveManifestPaths(options)).promptDefinitionsById.get(name);
}

function getPromptResolution(name, options = {}) {
  const { promptDefinitionsById, middlewareDocuments } = loadPromptDefinitionsFromManifests(resolveActiveManifestPaths(options));
  const definition = promptDefinitionsById.get(name);

  if (!definition) {
    return undefined;
  }

  if (definition.type === "middleware") {
    return {
      definition,
      applicableMiddleware: [],
      resolvedPrompt: buildPrompt(definition.documents),
    };
  }

  const applicableMiddleware = selectApplicableMiddleware(middlewareDocuments, definition);

  return {
    definition,
    applicableMiddleware,
    resolvedPrompt: composePrompt(definition.documents, applicableMiddleware),
  };
}

function formatPromptBlock(block) {
  const attributes = Object.entries(block.attributes)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");

  return attributes
    ? `${block.operation} \"${block.id}\" ${attributes}`
    : `${block.operation} \"${block.id}\"`;
}

function formatPromptTextBlock(text, indent = "  ") {
  if (!text) {
    return [`${indent}(empty)`];
  }

  return text.split("\n").map((line) => `${indent}${line}`);
}

/**
 * Extracts author-written help content between `<!-- help -->` and `<!-- /help -->`
 * markers in a prompt document body. Case-insensitive; multi-line; the first
 * matching pair wins per document. Whitespace around the captured body is trimmed.
 * Returns an empty string when no help block is present.
 */
function extractHelpSection(body) {
  if (!body) return "";
  const match = body.match(/<!--\s*help\s*-->([\s\S]*?)<!--\s*\/help\s*-->/i);
  if (!match) return "";
  return match[1].trim();
}

function getPromptHelp(name, options = {}) {
  const resolution = getPromptResolution(name, options);

  if (!resolution) {
    return undefined;
  }

  const { definition } = resolution;
  const sections = definition.documents
    .map((document) => extractHelpSection(document.source))
    .filter((section) => section.length > 0);

  if (sections.length > 0) {
    return sections.join("\n\n---\n\n");
  }

  // Graceful fallback: show frontmatter metadata and hint to authors.
  const lines = [
    `Name: ${definition.name}`,
    `Type: ${definition.type}`,
    `Description: ${definition.description || "No description provided."}`,
    "",
    "(no <!-- help --> section in prompt files)",
  ];
  return lines.join("\n");
}

function getPromptInfo(name, options = {}) {
  const resolution = getPromptResolution(name, options);

  if (!resolution) {
    return undefined;
  }

  const { definition, applicableMiddleware, resolvedPrompt } = resolution;
  const lines = [
    `ID: ${definition.documents[0].id}`,
    `Type: ${definition.type}`,
    `Name: ${definition.name}`,
    `Description: ${definition.description || "No description provided."}`,
    "",
    "Files:",
    ...definition.documents.map((document) => `  - ${document.filePath}`),
  ];

  if (definition.type === "middleware") {
    const timings = Array.from(new Set(definition.documents.map((document) => document.timing).filter(Boolean)));
    const targetTypes = Array.from(new Set(definition.documents.flatMap((document) => document.targetTypes || [])));

    lines.push("", "Middleware:");
    lines.push(`  Timing: ${timings.join(", ") || "unknown"}`);
    lines.push(`  Target types: ${targetTypes.join(", ") || "none"}`);
  } else {
    lines.push("", "Applied middleware:");

    if (applicableMiddleware.length > 0) {
      lines.push(...applicableMiddleware.map((document) => `  - ${document.id} (${document.timing}) -> ${document.filePath}`));
    } else {
      lines.push("  None");
    }
  }

  lines.push("", "Documents:");

  for (const document of definition.documents) {
    lines.push(`  - ${document.filePath}`);

    if (document.blocks.length > 0) {
      lines.push("    Blocks:");
      lines.push(...document.blocks.map((block) => `      - ${formatPromptBlock(block)}`));
    } else {
      lines.push("    Blocks:");
      lines.push("      - none");
    }
  }

  lines.push("", "Resolved prompt:");
  lines.push(...formatPromptTextBlock(resolvedPrompt));

  return lines.join("\n");
}

function getPromptSource(name, options = {}) {
  const resolution = getPromptResolution(name, options);

  if (!resolution) {
    return undefined;
  }

  const { definition, applicableMiddleware } = resolution;

  if (definition.type === "middleware") {
    return definition.documents.map((document) => document.source).join("\n\n");
  }

  const documents = [
    ...applicableMiddleware.filter((document) => document.timing === "pre"),
    ...definition.documents,
    ...applicableMiddleware.filter((document) => document.timing === "post"),
  ];

  return documents.map((document) => document.source).join("\n\n");
}

module.exports = {
  ensureGlobalPromptRegistry,
  ensurePromptsManifest,
  getGlobalPromptsManifestPath,
  getLocalPromptsManifestPath,
  getPromptDefinition,
  getPrompt,
  getPromptHelp,
  getPromptInfo,
  getPromptSource,
  getPromptTypeHelp,
  listPromptMetadata,
  listActivePromptMetadata,
  listPromptTypeCatalog,
  loadPromptDefinitionsFromManifest,
  loadPromptDefinitionsFromManifests,
  loadPrompts,
  loadPromptsFromManifest,
  resolveActiveManifestPaths,
  resolvePromptPatternsFromManifest,
};
