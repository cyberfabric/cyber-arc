const http = require("http");
const fs = require("fs");
const path = require("path");

const WEB_DIST = path.resolve(__dirname, "..", "web", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function parseArguments(args) {
  let port;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === "--port" || arg === "-p") {
      const value = args[i + 1];
      if (value === undefined) {
        return { error: "Missing value for --port" };
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) {
        return { error: `Invalid port: ${value}` };
      }
      port = parsed;
      i += 2;
      continue;
    }

    return { error: `Unknown argument: ${arg}` };
  }

  return { port };
}

function resolveFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "/index.html" : decoded;
  const target = path.normalize(path.join(WEB_DIST, relative));
  if (!target.startsWith(WEB_DIST + path.sep) && target !== WEB_DIST) {
    return null; // Path traversal blocked
  }
  return target;
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      fallbackIndex(res, filePath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function fallbackIndex(res, missingPath) {
  const indexPath = path.join(WEB_DIST, "index.html");
  fs.stat(indexPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        `fabric-poc web: ${missingPath} not found.\n` +
          `Hint: build the web UI first — \`cd ${path.relative(process.cwd(), path.join(WEB_DIST, "..")) || "web"} && npm install && npm run build\`.\n`,
      );
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": stats.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(indexPath).pipe(res);
  });
}

function runWebServer(args) {
  const parsed = parseArguments(args);
  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n`);
    return 1;
  }

  if (!fs.existsSync(WEB_DIST)) {
    process.stderr.write(
      `fabric-poc web: web/dist not found at ${WEB_DIST}.\n` +
        `Build the UI first: cd ${path.join(path.relative(process.cwd(), WEB_DIST), "..")} && npm install && npm run build\n`,
    );
    return 1;
  }

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const target = resolveFilePath(req.url ?? "/");
      if (!target) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Bad Request");
        return;
      }
      sendFile(res, target);
    });

    server.on("error", (err) => {
      process.stderr.write(`fabric-poc web: server error — ${err.message}\n`);
      resolve(1);
    });

    const listenPort = parsed.port ?? 0;
    server.listen(listenPort, "127.0.0.1", () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : listenPort;
      process.stdout.write(`Fabric web UI ready at http://127.0.0.1:${actualPort} (Ctrl+C to stop)\n`);
    });

    const shutdown = () => {
      server.close(() => resolve(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

module.exports = { runWebServer };
