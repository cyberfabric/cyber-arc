
const fabric = require("/Volumes/CaseSensitive/coding/orchestrator/.workspace-sources/cyberfabric/cyber-fabric/pocs/fabric/src/public.js");
(async () => {
  const r = await fabric.api.call("sample", { path: "/hello" });
  console.log(JSON.stringify({ status: r.status, ok: r.ok, methodEcho: r.body.method }));
})();
