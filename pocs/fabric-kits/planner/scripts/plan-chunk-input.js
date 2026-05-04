const fs = require("node:fs");
const path = require("node:path");
const { parseArgs, requireString, optionalInt } = require("../lib/args");
const { buildInputSignature } = require("../lib/hashing");
const { countLines } = require("../lib/lines");
const { slugify } = require("../lib/slugify");

const SCRIPT_ID = "plan-chunk-input";

const PARSE_SCHEMA = {
  booleans: new Set(["include-stdin", "dry-run"]),
  repeats: new Set(["raw-input"]),
};

const FORBIDDEN_OUTPUT_BASENAMES = new Set([".fabric", "fabric", "node_modules", ".git"]);

function resolveAbsolutePath(rawPath, cwd) {
  return path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
}

function ensureFile(absPath) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`${SCRIPT_ID}: raw-input file not found: ${absPath}`);
  }
  if (!fs.statSync(absPath).isFile()) {
    throw new Error(`${SCRIPT_ID}: raw-input path is not a file: ${absPath}`);
  }
}

function assertOutputDirSafety(absOutputDir) {
  const base = path.basename(absOutputDir);
  if (FORBIDDEN_OUTPUT_BASENAMES.has(base)) {
    throw new Error(`${SCRIPT_ID}: refusing to write into a sensitive directory name: ${absOutputDir}`);
  }
  if (absOutputDir === path.parse(absOutputDir).root) {
    throw new Error(`${SCRIPT_ID}: refusing to use filesystem root as --output-dir`);
  }
  if (fs.existsSync(absOutputDir)) {
    if (!fs.statSync(absOutputDir).isDirectory()) {
      throw new Error(`${SCRIPT_ID}: --output-dir exists but is not a directory: ${absOutputDir}`);
    }
  }
}

function chunkText(text, maxLines) {
  if (text.length === 0) return [""];
  const lines = text.split(/\r?\n/);
  const chunks = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines).join("\n"));
  }
  return chunks;
}

function describeRange(startLine, count, totalLines) {
  if (totalLines === 0) return "0-0";
  const endLine = Math.min(startLine + count - 1, totalLines);
  return `${startLine}-${endLine}`;
}

function fileSlug(absPath) {
  const base = path.basename(absPath).replace(/\.[^.]+$/, "");
  return slugify(base) || "raw-input";
}

function planChunksForFile(sourceIndex, absPath, content, maxLines) {
  const totalLines = countLines(content);
  const slug = fileSlug(absPath);
  const sliceTexts = chunkText(content, maxLines);
  const indexPad = String(sourceIndex).padStart(3, "0");
  const partTotal = sliceTexts.length;
  const chunks = sliceTexts.map((sliceText, partIndex) => {
    const partPad = String(partIndex + 1).padStart(2, "0");
    const file = partTotal === 1
      ? `${indexPad}-${slug}.md`
      : `${indexPad}-${slug}-part-${partPad}.md`;
    const startLine = partIndex * maxLines + 1;
    const sliceLineCount = countLines(sliceText);
    return {
      file,
      content: sliceText,
      source: {
        kind: "file",
        path: absPath,
        lines: describeRange(startLine, sliceLineCount, totalLines),
        total_lines: totalLines,
      },
      lines: sliceLineCount,
    };
  });
  return { totalLines, chunks };
}

function planChunksForStdin(content, maxLines) {
  const totalLines = countLines(content);
  const sliceTexts = chunkText(content, maxLines);
  const partTotal = sliceTexts.length;
  const chunks = sliceTexts.map((sliceText, partIndex) => {
    const partPad = String(partIndex + 1).padStart(2, "0");
    const file = partTotal === 1
      ? "direct-prompt.md"
      : `direct-prompt-part-${partPad}.md`;
    const startLine = partIndex * maxLines + 1;
    const sliceLineCount = countLines(sliceText);
    return {
      file,
      content: sliceText,
      source: {
        kind: "stdin",
        lines: describeRange(startLine, sliceLineCount, totalLines),
        total_lines: totalLines,
      },
      lines: sliceLineCount,
    };
  });
  return { totalLines, chunks };
}

function run(args, context) {
  const { flags, positionals } = parseArgs(args, PARSE_SCHEMA);
  if (positionals.length > 0) {
    throw new Error(`${SCRIPT_ID}: unexpected positional argument: ${positionals[0]}`);
  }

  const outputDirRaw = requireString(flags, "output-dir", SCRIPT_ID);
  const outputDir = resolveAbsolutePath(outputDirRaw, context.cwd);
  assertOutputDirSafety(outputDir);

  const maxLines = optionalInt(flags, "max-lines", SCRIPT_ID, 300);
  if (maxLines <= 0) throw new Error(`${SCRIPT_ID}: --max-lines must be > 0`);
  const thresholdLines = optionalInt(flags, "threshold-lines", SCRIPT_ID, 500);
  if (thresholdLines <= 0) throw new Error(`${SCRIPT_ID}: --threshold-lines must be > 0`);

  const includeStdin = Boolean(flags["include-stdin"]);
  const stdinText = flags["stdin-text"] || "";
  if (!includeStdin && stdinText.length > 0) {
    throw new Error(`${SCRIPT_ID}: --stdin-text was provided without --include-stdin`);
  }
  const dryRun = Boolean(flags["dry-run"]);

  const rawInputs = Array.isArray(flags["raw-input"]) ? flags["raw-input"] : [];
  if (rawInputs.length === 0 && !includeStdin) {
    throw new Error(`${SCRIPT_ID}: at least one --raw-input or --include-stdin is required`);
  }

  const absRawInputs = rawInputs.map((rel) => resolveAbsolutePath(rel, context.cwd));
  for (const abs of absRawInputs) ensureFile(abs);

  const sources = [];
  const allChunks = [];
  const signatureItems = [];

  let sourceIndex = 0;
  for (const abs of absRawInputs) {
    sourceIndex += 1;
    const content = fs.readFileSync(abs, "utf8");
    const { totalLines, chunks } = planChunksForFile(sourceIndex, abs, content, maxLines);
    sources.push({
      index: sourceIndex,
      kind: "file",
      path: abs,
      total_lines: totalLines,
      chunks: chunks.map((c) => c.file),
    });
    for (const chunk of chunks) allChunks.push(chunk);
    signatureItems.push({ kind: "file", path: abs });
  }

  if (includeStdin) {
    sourceIndex += 1;
    const { totalLines, chunks } = planChunksForStdin(stdinText, maxLines);
    sources.push({
      index: sourceIndex,
      kind: "stdin",
      total_lines: totalLines,
      chunks: chunks.map((c) => c.file),
    });
    for (const chunk of chunks) allChunks.push(chunk);
    signatureItems.push({ kind: "stdin", content: stdinText });
  }

  const seenFiles = new Set();
  for (const chunk of allChunks) {
    if (seenFiles.has(chunk.file)) {
      throw new Error(`${SCRIPT_ID}: chunk filename collision (${chunk.file}); raw-input filenames slug-collide; rename one of the inputs or pass distinct paths`);
    }
    seenFiles.add(chunk.file);
  }

  const inputSignature = buildInputSignature(signatureItems);
  const totalLinesSum = sources.reduce((sum, source) => sum + source.total_lines, 0);
  const exceededThreshold = totalLinesSum > thresholdLines;

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifest = {
    input_signature: inputSignature,
    max_lines: maxLines,
    threshold_lines: thresholdLines,
    total_lines: totalLinesSum,
    exceeded_threshold: exceededThreshold,
    chunks: allChunks.map((chunk) => ({
      file: chunk.file,
      source: chunk.source,
      lines: chunk.lines,
    })),
    sources,
  };

  let wrote = false;
  const writtenFiles = [];
  if (!dryRun) {
    fs.mkdirSync(outputDir, { recursive: true });
    for (const chunk of allChunks) {
      const chunkPath = path.join(outputDir, chunk.file);
      fs.writeFileSync(chunkPath, chunk.content, "utf8");
      writtenFiles.push(chunkPath);
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    writtenFiles.push(manifestPath);
    wrote = true;
  }

  return JSON.stringify(
    {
      output_dir: outputDir,
      manifest_path: manifestPath,
      input_signature: inputSignature,
      max_lines: maxLines,
      threshold_lines: thresholdLines,
      total_lines: totalLinesSum,
      exceeded_threshold: exceededThreshold,
      dry_run: dryRun,
      wrote,
      chunks: allChunks.map((chunk) => ({ file: chunk.file, lines: chunk.lines, source: chunk.source })),
      sources,
      written_files: writtenFiles,
    },
    null,
    2,
  );
}

module.exports = {
  id: SCRIPT_ID,
  name: "plan chunk input",
  description: "Chunk raw planner input files (and optional direct prompt text) into ≤ max-lines slices under a user-supplied output directory and emit manifest.json carrying input_signature",
  interface: {
    details: [
      "Splits each --raw-input file into chunks of at most --max-lines lines and writes them under --output-dir.",
      "Optionally folds direct prompt text into a separate direct-prompt[-part-NN].md file when --include-stdin is set.",
      "Emits manifest.json carrying input_signature, max_lines, threshold_lines, total_lines, exceeded_threshold, chunks[], and sources[]; the input_signature is identical to the one plan-init computes for the same inputs.",
      "Operates in --dry-run mode without touching the filesystem; useful to compare signatures with an existing plan before staging a replacement package.",
    ],
    usage: [
      "fabric-poc script run plan-chunk-input --output-dir <path> [--max-lines <int>] [--threshold-lines <int>] [--raw-input <path>]... [--include-stdin] [--stdin-text <text>] [--dry-run]",
    ],
    parameters: [
      { name: "--output-dir", type: "string", required: true, description: "Where to write chunk files and manifest.json. Created if missing." },
      { name: "--max-lines", type: "string", required: false, description: "Max lines per chunk file. Defaults to 300." },
      { name: "--threshold-lines", type: "string", required: false, description: "Total-line threshold reported in manifest.exceeded_threshold. Defaults to 500." },
      { name: "--raw-input", type: "string", required: false, description: "Path to a raw-input file. Repeat for multiple files. Files must exist." },
      { name: "--include-stdin", type: "boolean", required: false, description: "Include direct prompt text as a stdin source." },
      { name: "--stdin-text", type: "string", required: false, description: "Direct prompt text content. Required only when --include-stdin is set with non-empty content." },
      { name: "--dry-run", type: "boolean", required: false, description: "Compute manifest and chunk plan but write no files. Useful for signature comparison." },
    ],
    returns: "JSON object with output_dir, manifest_path, input_signature, max_lines, threshold_lines, total_lines, exceeded_threshold, dry_run, wrote, chunks[], sources[], and written_files.",
    examples: [
      {
        command: "fabric-poc script run plan-chunk-input --output-dir ./.fabric-plans/generate-prd-myapp/input --raw-input ./request.md --include-stdin --stdin-text \"focus on auth\"",
        description: "Stage chunks and manifest for a generate task whose raw input is one file plus a direct prompt note.",
      },
      {
        command: "fabric-poc script run plan-chunk-input --output-dir ./.fabric-plans/generate-prd-myapp/input --raw-input ./request.md --dry-run",
        description: "Preview chunks and signature without writing anything.",
      },
    ],
    notes: [
      "Writes inside --output-dir only. Creates --output-dir recursively when it does not exist; refuses output paths whose basename matches a sensitive name (.fabric, .git, node_modules, fabric) or that resolve to filesystem root.",
      "Chunk filenames: files are named {NNN}-{slug}.md or {NNN}-{slug}-part-{PP}.md (NNN = 3-digit source index, PP = 2-digit part); direct prompt is direct-prompt.md or direct-prompt-part-{PP}.md.",
      "input_signature is order-insensitive across raw-input files and the optional stdin source so re-passing the same set of inputs in a different order does not invalidate plan reuse.",
      "Two raw-input files whose stem slugs collide are rejected; rename or pass distinct paths.",
    ],
  },
  run,
};
