
const fabric = require("/Volumes/CaseSensitive/coding/orchestrator/.workspace-sources/cyberfabric/cyber-fabric/pocs/fabric/src/public.js");
(async () => {
  try {
    const r = await fabric.api.call("sample", { path: "/status/404" });
    console.log(JSON.stringify({ status: r.status, ok: r.ok }));
  } catch (err) {
    console.log("THREW:" + err.message);
  }
})();
