const {
  buildResourcesManifestContent,
  getActiveManifestPathsReadOnly,
  getFabricHomeDirectory,
  getGlobalResourcesManifestPath,
  getLocalResourcesManifestPath,
  parseResourcesManifest,
  readResourcesManifestFile,
  resolveActiveManifestPaths,
  resolveResourcePatternsFromManifest,
} = require("./resources");

const {
  callApi,
  getApiDefinition,
  getApiHelp,
  listActiveApiMetadata,
} = require("./apis");

const api = {
  call: (service, callOptions) => callApi(service, callOptions),
  get: (service) => getApiDefinition(service),
  list: () => listActiveApiMetadata(),
  help: (service) => getApiHelp(service),
};

module.exports = {
  api,
  buildResourcesManifestContent,
  getActiveManifestPathsReadOnly,
  getFabricHomeDirectory,
  getGlobalResourcesManifestPath,
  getLocalResourcesManifestPath,
  parseResourcesManifest,
  readResourcesManifestFile,
  resolveActiveManifestPaths,
  resolveResourcePatternsFromManifest,
};
