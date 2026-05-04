const http = require("node:http");

function createMockServer() {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");

    // /status/NNN returns status NNN with an echo payload.
    const statusMatch = /^\/status\/(\d{3})$/.exec(req.url);
    if (statusMatch) {
      const code = Number.parseInt(statusMatch[1], 10);
      res.statusCode = code;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        status: code,
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      }));
      return;
    }

    // Default: 200 with a JSON echo of the request.
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    }));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { address, port } = server.address();
      resolve({
        server,
        url: `http://${address}:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = { createMockServer };
