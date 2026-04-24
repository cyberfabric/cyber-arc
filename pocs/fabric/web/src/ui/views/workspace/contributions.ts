import fabric from '../../../fabricLib';
import type {
  WorkspaceRendererContribution,
  WorkspaceActionContribution,
} from '../../../types';

export interface ContributedRenderer extends WorkspaceRendererContribution {
  kitName: string;
}

export interface ContributedAction extends WorkspaceActionContribution {
  kitName: string;
}

export interface ActiveContributions {
  renderers: ContributedRenderer[];
  actions: ContributedAction[];
  highlightPack: string;   // 'default' when none contributed
}

/**
 * Walks installed kits and aggregates any `workspaceContributions` they carry
 * through their web-extension entries in the marketplace fixture. Pure over
 * the state read — callers re-run this on every render.
 */
export function collectActiveContributions(): ActiveContributions {
  const renderers: ContributedRenderer[] = [];
  const actions: ContributedAction[] = [];
  let highlightPack = 'default';

  const installed = fabric.kits.list({ scope: 'both' });
  const installedNames = new Set(installed.map((k) => k.name));

  for (const mkt of fabric.marketplaces.list()) {
    for (const kit of mkt.kits) {
      if (!installedNames.has(kit.name)) continue;
      if (!kit.webExtensions) continue;
      for (const ext of kit.webExtensions) {
        const c = ext.workspaceContributions;
        if (!c) continue;
        if (c.renderers) {
          for (const r of c.renderers) renderers.push({ ...r, kitName: kit.name });
        }
        if (c.actions) {
          for (const a of c.actions) actions.push({ ...a, kitName: kit.name });
        }
        if (c.highlightPack) highlightPack = c.highlightPack;
      }
    }
  }
  return { renderers, actions, highlightPack };
}
