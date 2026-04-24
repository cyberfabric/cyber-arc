/**
 * Match a workspace file path against a contribution's `match` pattern.
 * Supported forms:
 *   - `*.ext`          — matches any path whose BASENAME ends with `.ext`
 *   - `literal.name`   — matches the basename exactly
 *   - `dir/*.ext`      — matches files named `*.ext` inside `dir/` at any depth
 */
export function matchesGlob(path: string, pattern: string): boolean {
  const basename = path.split('/').pop() ?? path;
  if (pattern.startsWith('*.')) {
    return basename.endsWith(pattern.slice(1));
  }
  if (pattern.includes('/')) {
    const [dir, rest] = pattern.split('/', 2);
    if (!path.includes(`${dir}/`)) return false;
    return matchesGlob(basename, rest);
  }
  return basename === pattern;
}
