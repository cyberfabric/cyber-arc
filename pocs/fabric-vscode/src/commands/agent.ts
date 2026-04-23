import * as vscode from 'vscode';
import fabric from '../fabricLib';
import { runSafely } from '../errors';
import { logInfo } from '../output';
import type { AgentInfo, RegisterScope } from '../types';

export function registerAgentCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fabric.agent.register', registerAgents),
    vscode.commands.registerCommand('fabric.agent.unregister', unregisterAgents),
  );
}

async function pickAgents(
  options: AgentInfo[],
  placeHolder: string,
): Promise<AgentInfo[] | undefined> {
  const picks = await vscode.window.showQuickPick(
    options.map((a) => ({
      label: a.name,
      description: a.detected ? (a.registered ? 'registered' : 'not registered') : 'not detected',
      agent: a,
      picked: false,
    })),
    { canPickMany: true, placeHolder, ignoreFocusOut: true },
  );
  return picks?.map((p) => p.agent);
}

async function pickScope(): Promise<{ local: boolean; includeGlobal: boolean; label: RegisterScope } | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'Default',          description: 'fabric register (no flags)',             local: false, includeGlobal: false, scope: 'default' as RegisterScope },
      { label: 'Project',          description: 'fabric register --local',                local: true,  includeGlobal: false, scope: 'project' as RegisterScope },
      { label: 'Global',           description: 'fabric register --include-global',       local: false, includeGlobal: true,  scope: 'global' as RegisterScope },
      { label: 'Project + Global', description: 'fabric register --local --include-global', local: true, includeGlobal: true,  scope: 'project+global' as RegisterScope },
    ],
    { placeHolder: 'Registration scope', ignoreFocusOut: true },
  );
  if (!picked) return undefined;
  return { local: picked.local, includeGlobal: picked.includeGlobal, label: picked.scope };
}

async function registerAgents(passed?: { agent: AgentInfo }): Promise<void> {
  const allAgents = fabric.agents.list();
  const detected = allAgents.filter((a) => a.detected);
  if (detected.length === 0) {
    await vscode.window.showInformationMessage('No detected agents available');
    return;
  }
  const targets = passed?.agent
    ? [passed.agent]
    : await pickAgents(detected, 'Select agents to register');
  if (!targets || targets.length === 0) return;
  const scope = await pickScope();
  if (!scope) return;

  await runSafely('agent.register', async () => {
    const result = fabric.register({
      agents: targets.map((a) => a.id),
      local: scope.local,
      includeGlobal: scope.includeGlobal,
    });
    logInfo(`Registered ${result.agents.join(', ')} · scope=${result.scope} · files=${result.filesTouched.length}`);
    await vscode.window.showInformationMessage(
      `Registered ${result.agents.length} agent(s) at ${result.scope}`,
    );
  });
}

async function unregisterAgents(passed?: { agent: AgentInfo }): Promise<void> {
  const allAgents = fabric.agents.list();
  const registered = allAgents.filter((a) => a.registered);
  if (registered.length === 0) {
    await vscode.window.showInformationMessage('No registered agents to unregister');
    return;
  }
  const targets = passed?.agent
    ? [passed.agent]
    : await pickAgents(registered, 'Select agents to unregister');
  if (!targets || targets.length === 0) return;

  await runSafely('agent.unregister', async () => {
    const result = fabric.unregister({ agents: targets.map((a) => a.id) });
    logInfo(`Unregistered ${result.agents.join(', ')} · files=${result.filesRemoved.length}`);
    await vscode.window.showInformationMessage(`Unregistered ${result.agents.join(', ')}`);
  });
}
