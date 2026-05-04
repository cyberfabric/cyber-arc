import { state } from './state';
import type {
  InstalledKit,
  KitSource,
  MarketplaceKit,
  Scope,
  UpdateResult,
} from '../types';

const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

function assertSemver(version: string): void {
  if (!SEMVER_RE.test(version)) {
    throw new Error(`Invalid semver version: "${version}"`);
  }
}

function resolveMarketplaceKit(marketplaceName: string, kitName: string): MarketplaceKit {
  const marketplace = state.marketplaces.find((m) => m.name === marketplaceName);
  if (!marketplace) {
    throw new Error(`Unknown marketplace: ${marketplaceName}`);
  }
  const kit = marketplace.kits.find((k) => k.name === kitName);
  if (!kit) {
    throw new Error(`Kit not found in ${marketplaceName}: ${kitName}`);
  }
  if (kit.broken) {
    throw new Error(`Cannot install ${kitName}: ${kit.broken.reason}`);
  }
  return kit;
}

function resolveByUrl(url: string, version: string): MarketplaceKit {
  for (const m of state.marketplaces) {
    for (const k of m.kits) {
      if (typeof k.source === 'object' && 'url' in k.source && k.source.url === url) {
        return k;
      }
    }
  }
  throw new Error(`No marketplace kit matches url ${url}. Register the marketplace first or use a known URL.`);
}

type InstallArgs = {
  source: { url: string; version: string } | { marketplace: string; kit: string; version?: string };
  scope: Scope;
};

function list({ scope }: { scope: Scope | 'both' }): InstalledKit[] {
  if (scope === 'both') return [...state.installedKits];
  return state.installedKits.filter((k) => k.scope === scope);
}

function install({ source, scope }: InstallArgs): InstalledKit {
  let mk: MarketplaceKit;
  if ('marketplace' in source) {
    mk = resolveMarketplaceKit(source.marketplace, source.kit);
  } else {
    assertSemver(source.version);
    mk = resolveByUrl(source.url, source.version);
  }
  if (state.installedKits.some((k) => k.name === mk.name && k.scope === scope)) {
    throw new Error(`Kit ${mk.name} is already installed at ${scope} scope`);
  }
  const kitSource: KitSource =
    typeof mk.source === 'string' ? mk.source : { ...mk.source };
  const installed: InstalledKit = {
    name: mk.name,
    description: mk.description,
    category: mk.category,
    version: mk.version,
    scope,
    source: kitSource,
    files: [...mk.files],
  };
  state.installedKits.push(installed);
  state.emit('kits');
  return installed;
}

function findInstalled(name: string, scope: Scope): InstalledKit {
  const hit = state.installedKits.find((k) => k.name === name && k.scope === scope);
  if (!hit) {
    throw new Error(`Kit ${name} is not installed at ${scope} scope`);
  }
  return hit;
}

function update(name: string, scope: Scope): UpdateResult {
  const existing = findInstalled(name, scope);
  const latest = state.marketplaces
    .flatMap((m) => m.kits)
    .find((k) => k.name === name);
  if (!latest) {
    throw new Error(`No marketplace currently offers ${name} — cannot update.`);
  }
  if (latest.version === existing.version) {
    throw new Error(`${name} is already at latest version ${existing.version}`);
  }
  const diff = {
    added: latest.files.filter((f) => !existing.files.includes(f)),
    removed: existing.files.filter((f) => !latest.files.includes(f)),
    changed: latest.files.filter((f) => existing.files.includes(f)),
  };
  const result: UpdateResult = {
    name,
    scope,
    before: existing.version,
    after: latest.version,
    files: diff,
  };
  existing.version = latest.version;
  existing.files = [...latest.files];
  existing.updateAvailable = undefined;
  state.emit('kits');
  return result;
}

function uninstall(name: string, scope: Scope): void {
  const idx = state.installedKits.findIndex((k) => k.name === name && k.scope === scope);
  if (idx === -1) {
    throw new Error(`Kit ${name} is not installed at ${scope} scope`);
  }
  state.installedKits.splice(idx, 1);
  state.emit('kits');
}

export const kits = { list, install, update, uninstall };
