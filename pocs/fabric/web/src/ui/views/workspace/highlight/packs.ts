/**
 * Highlight packs. A pack maps a token kind to a hex color.
 * Token kinds are the union produced by the tokenizer in `./tokenize`.
 */

export type TokenKind =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'type'
  | 'function'
  | 'param'
  | 'operator'
  | 'default';

export type HighlightPack = Record<TokenKind, string>;

const DEFAULT_PACK: HighlightPack = {
  keyword:  '#c586c0',
  string:   '#ce9178',
  comment:  '#6a9955',
  number:   '#b5cea8',
  type:     '#e7e7ea', // falls back to default in minimal pack
  function: '#e7e7ea',
  param:    '#e7e7ea',
  operator: '#e7e7ea',
  default:  '#e7e7ea',
};

const PRO_PACK: HighlightPack = {
  keyword:  '#c586c0',
  string:   '#ce9178',
  comment:  '#6a9955',
  number:   '#b5cea8',
  type:     '#4ec9b0',
  function: '#dcdcaa',
  param:    '#9cdcfe',
  operator: '#d4d4d4',
  default:  '#e7e7ea',
};

export const packs: Record<string, HighlightPack> = {
  default: DEFAULT_PACK,
  pro: PRO_PACK,
};

export function resolvePack(key: string | undefined): HighlightPack {
  return packs[key ?? 'default'] ?? DEFAULT_PACK;
}
