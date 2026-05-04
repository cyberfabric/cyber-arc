import { state } from './state';
import type { AgentInfo, RegisterResult, RegisterScope, UnregisterResult } from '../types';

function list(): AgentInfo[] {
  return state.agents.map((a) => ({ ...a }));
}

type RegisterOptions = {
  agents?: string[];
  local?: boolean;
  includeGlobal?: boolean;
};

function scopeFromFlags(local?: boolean, includeGlobal?: boolean): RegisterScope {
  if (local && includeGlobal) return 'project+global';
  if (local) return 'project';
  if (includeGlobal) return 'global';
  return 'default';
}

function selectedAgents(opts: RegisterOptions): AgentInfo[] {
  const ids = opts.agents && opts.agents.length > 0
    ? opts.agents
    : state.agents.filter((a) => a.detected).map((a) => a.id);
  const hits: AgentInfo[] = [];
  for (const id of ids) {
    const agent = state.agents.find((a) => a.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    if (!agent.detected) throw new Error(`Agent ${agent.name} is not detected in this environment`);
    hits.push(agent);
  }
  return hits;
}

function register(opts: RegisterOptions): RegisterResult {
  const scope = scopeFromFlags(opts.local, opts.includeGlobal);
  const targets = selectedAgents(opts);
  const filesTouched: string[] = [];
  for (const agent of targets) {
    agent.registered = true;
    agent.registeredScope = scope;
    agent.promptCount = state.activePromptCount();
    filesTouched.push(`.claude/skills/<fabric>/${agent.id}/**`);
  }
  state.emit('agents');
  return { agents: targets.map((a) => a.id), scope, filesTouched };
}

function unregister(opts: RegisterOptions): UnregisterResult {
  const ids = opts.agents && opts.agents.length > 0
    ? opts.agents
    : state.agents.filter((a) => a.registered).map((a) => a.id);
  const filesRemoved: string[] = [];
  for (const id of ids) {
    const agent = state.agents.find((a) => a.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    if (!agent.registered) continue;
    agent.registered = false;
    agent.registeredScope = undefined;
    agent.promptCount = 0;
    filesRemoved.push(`.claude/skills/<fabric>/${agent.id}/**`);
  }
  state.emit('agents');
  return { agents: ids, filesRemoved };
}

export const agents = { list };
export { register, unregister };
