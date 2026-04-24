import type { Language } from '../../../../types';
import type { TokenKind } from './packs';

export interface Token { kind: TokenKind; text: string; }

/**
 * Tokenize a single source line for syntax coloring. Intentionally simple:
 * regex-driven, per-language, good enough for the fixture content in the
 * Workspaces demo. Not a real parser — do not reuse for editing.
 */
export function tokenizeLine(line: string, language: Language): Token[] {
  switch (language) {
    case 'typescript': return tokenizeGeneric(line, TS_RULES);
    case 'python':     return tokenizeGeneric(line, PY_RULES);
    case 'bash':       return tokenizeGeneric(line, SH_RULES);
    case 'json':       return tokenizeGeneric(line, JSON_RULES);
    case 'toml':       return tokenizeGeneric(line, TOML_RULES);
    case 'markdown':   return [{ kind: 'default', text: line }];
  }
}

interface Rule { kind: TokenKind; re: RegExp; }

/** Order matters: the first rule whose regex matches at the current offset wins. */
const TS_RULES: Rule[] = [
  { kind: 'comment',  re: /^\/\/[^\n]*/ },
  { kind: 'string',   re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^`(?:[^`\\]|\\.)*`/ },
  { kind: 'number',   re: /^\b\d+(?:\.\d+)?\b/ },
  { kind: 'keyword',  re: /^\b(?:import|export|from|as|const|let|var|function|class|interface|type|extends|implements|return|if|else|for|while|switch|case|break|continue|new|throw|catch|try|finally|async|await|public|private|protected|static|readonly|void|null|undefined|true|false)\b/ },
  { kind: 'type',     re: /^\b[A-Z][A-Za-z0-9_]*\b/ },
  { kind: 'function', re: /^\b[a-z_][A-Za-z0-9_]*(?=\()/ },
  { kind: 'operator', re: /^[=+\-*/<>!&|?:,.;(){}\[\]]/ },
  { kind: 'default',  re: /^[A-Za-z_][A-Za-z0-9_]*|^\s+|^./ },
];

const PY_RULES: Rule[] = [
  { kind: 'comment',  re: /^#[^\n]*/ },
  { kind: 'string',   re: /^"""[\s\S]*?(?:"""|$)|^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/ },
  { kind: 'number',   re: /^\b\d+(?:\.\d+)?\b/ },
  { kind: 'keyword',  re: /^\b(?:import|from|as|def|class|return|if|elif|else|for|while|in|is|not|and|or|pass|break|continue|raise|try|except|finally|with|yield|lambda|True|False|None|self|async|await)\b/ },
  { kind: 'type',     re: /^\b[A-Z][A-Za-z0-9_]*\b/ },
  { kind: 'function', re: /^\b[a-z_][A-Za-z0-9_]*(?=\()/ },
  { kind: 'operator', re: /^[=+\-*/<>!&|?:,.;(){}\[\]@]/ },
  { kind: 'default',  re: /^[A-Za-z_][A-Za-z0-9_]*|^\s+|^./ },
];

const SH_RULES: Rule[] = [
  { kind: 'comment',  re: /^#[^\n]*/ },
  { kind: 'string',   re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/ },
  { kind: 'keyword',  re: /^\b(?:if|then|else|elif|fi|for|do|done|while|case|esac|in|function|return|exit|set|unset|export|source|echo|local|readonly)\b/ },
  { kind: 'function', re: /^\b[a-z_][A-Za-z0-9_]*(?=\s*\(\))/ },
  { kind: 'operator', re: /^[=+\-*/<>!&|;()\[\]{}$]/ },
  { kind: 'default',  re: /^[A-Za-z_][A-Za-z0-9_-]*|^\s+|^./ },
];

const JSON_RULES: Rule[] = [
  { kind: 'string',   re: /^"(?:[^"\\]|\\.)*"/ },
  { kind: 'number',   re: /^-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/ },
  { kind: 'keyword',  re: /^\b(?:true|false|null)\b/ },
  { kind: 'operator', re: /^[:{},\[\]]/ },
  { kind: 'default',  re: /^\s+|^./ },
];

const TOML_RULES: Rule[] = [
  { kind: 'comment',  re: /^#[^\n]*/ },
  { kind: 'string',   re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/ },
  { kind: 'number',   re: /^-?\b\d+(?:\.\d+)?\b/ },
  { kind: 'keyword',  re: /^\b(?:true|false)\b/ },
  { kind: 'type',     re: /^\[[^\]]+\]/ },
  { kind: 'param',    re: /^[A-Za-z_][A-Za-z0-9_-]*(?=\s*=)/ },
  { kind: 'operator', re: /^[=,{}]/ },
  { kind: 'default',  re: /^\s+|^./ },
];

function tokenizeGeneric(line: string, rules: Rule[]): Token[] {
  const out: Token[] = [];
  let rest = line;
  while (rest.length > 0) {
    let matched = false;
    for (const r of rules) {
      const m = r.re.exec(rest);
      if (m && m.index === 0) {
        out.push({ kind: r.kind, text: m[0] });
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Safety: if nothing matched, consume one char as default (prevents infinite loop).
      out.push({ kind: 'default', text: rest[0] });
      rest = rest.slice(1);
    }
  }
  return out;
}
