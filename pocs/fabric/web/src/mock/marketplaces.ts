import { state } from './state';
import { FIXTURE_MARKETPLACES } from './fixtures/marketplaces';
import type { Marketplace, MarketplaceKit } from '../types';

/** Returns true if `source` string identifies one of the bundled fixtures. */
function resolveFixtureByHint(hint: string): Marketplace | undefined {
  const needle = hint.toLowerCase();
  return FIXTURE_MARKETPLACES.find(
    (m) => m.name === hint || m.addedFrom === hint || needle.includes(m.name),
  );
}

function list(): Marketplace[] {
  return [...state.marketplaces];
}

function add(source: string): Marketplace {
  if (!source.trim()) {
    throw new Error('Marketplace source must not be empty');
  }
  if (state.marketplaces.some((m) => m.addedFrom === source)) {
    throw new Error(`Marketplace already added: ${source}`);
  }
  const fixture = resolveFixtureByHint(source);
  if (!fixture) {
    throw new Error(`Unknown marketplace source in PoC: ${source}. Try "cyber-fabric-official" or "community-demo".`);
  }
  const added: Marketplace = { ...fixture, addedFrom: source };
  state.marketplaces.push(added);
  state.emit('marketplaces');
  return added;
}

function remove(name: string): void {
  const index = state.marketplaces.findIndex((m) => m.name === name);
  if (index === -1) {
    throw new Error(`Unknown marketplace: ${name}`);
  }
  state.marketplaces.splice(index, 1);
  state.emit('marketplaces');
}

function refresh(): { updated: Marketplace[] } {
  return { updated: [...state.marketplaces] };
}

function listKits(name?: string): MarketplaceKit[] {
  const source = name
    ? state.marketplaces.filter((m) => m.name === name)
    : state.marketplaces;
  return source.flatMap((m) => m.kits);
}

export const marketplaces = { list, add, remove, refresh, listKits };
