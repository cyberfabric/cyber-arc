import type { WorkspaceFile, ChatAgent } from '../../../types';

const PREFIX: Record<ChatAgent, string> = {
  claude: '🔷 Claude',
  codex:  '🟢 Codex',
};

export function cannedResponse(agent: ChatAgent, activeFile: WorkspaceFile | null): string {
  const prefix = PREFIX[agent];
  if (!activeFile) return `${prefix}: Open a file and I'll help you understand it.`;

  if (activeFile.language === 'markdown') {
    const headings = extractHeadings(activeFile.content).slice(0, 3);
    const headText = headings.length > 0 ? headings.join(', ') : 'no headings yet';
    return `${prefix}: I skimmed \`${activeFile.path}\`. Key sections: ${headText}.`;
  }

  const summary = activeFile.summary ?? fallbackSummary(activeFile);
  return `${prefix}: Looking at \`${activeFile.path}\` — this module ${summary}.`;
}

function extractHeadings(src: string): string[] {
  const out: string[] = [];
  for (const line of src.split('\n')) {
    const m = /^#{1,2}\s+(.*)$/.exec(line);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function fallbackSummary(file: WorkspaceFile): string {
  const count = countSymbols(file);
  return `defines ${count} top-level symbol${count === 1 ? '' : 's'}`;
}

function countSymbols(file: WorkspaceFile): number {
  let re: RegExp;
  switch (file.language) {
    case 'typescript': re = /\bexport\b/g; break;
    case 'python':     re = /^\s*(?:def|class)\s+/gm; break;
    case 'bash':       re = /^\s*(?:function\s+)?[A-Za-z_][A-Za-z0-9_]*\s*\(\)\s*\{/gm; break;
    default:           return 0;
  }
  return (file.content.match(re) ?? []).length;
}

export function substituteFile(template: string, filePath: string): string {
  return template.replace(/\{file\}/g, filePath);
}
