import type { WorkspaceFile } from '../../../types';

interface Props {
  files: WorkspaceFile[];
  expanded: Set<string>;
  activePath: string | null;
  searchQuery: string;
  onToggleFolder: (folderPath: string) => void;
  onOpenFile: (path: string) => void;
}

interface FolderNode { type: 'folder'; name: string; path: string; children: TreeNode[]; }
interface FileNode   { type: 'file';   name: string; path: string; }
type TreeNode = FolderNode | FileNode;

export default function FileTree(props: Props): JSX.Element {
  const filtered = props.searchQuery.trim()
    ? props.files.filter((f) => f.path.toLowerCase().includes(props.searchQuery.toLowerCase()))
    : props.files;
  const root = buildTree(filtered);
  // Auto-expand all when searching so matches are visible.
  const effectiveExpanded = props.searchQuery.trim()
    ? collectFolderPaths(root)
    : props.expanded;
  return (
    <div className="ws-tree" role="tree">
      {root.map((n) => renderNode(n, 0, effectiveExpanded, props))}
    </div>
  );
}

function renderNode(
  node: TreeNode,
  depth: number,
  expanded: Set<string>,
  props: Props,
): JSX.Element {
  if (node.type === 'folder') {
    const isOpen = expanded.has(node.path);
    return (
      <div key={node.path}>
        <button
          type="button"
          className="ws-tree__row"
          style={{ paddingLeft: 6 + depth * 12 }}
          onClick={() => props.onToggleFolder(node.path)}
          role="treeitem"
          aria-expanded={isOpen}
        >
          <span className="ws-tree__chevron">{isOpen ? '▾' : '▸'}</span>
          <span className="ws-tree__icon">📁</span>
          <span className="ws-tree__label">{node.name}</span>
        </button>
        {isOpen && node.children.map((c) => renderNode(c, depth + 1, expanded, props))}
      </div>
    );
  }
  const active = node.path === props.activePath;
  return (
    <button
      key={node.path}
      type="button"
      className={`ws-tree__row ${active ? 'ws-tree__row--active' : ''}`}
      style={{ paddingLeft: 6 + depth * 12 + 12 }}
      onClick={() => props.onOpenFile(node.path)}
      role="treeitem"
    >
      <span className="ws-tree__icon">📄</span>
      <span className="ws-tree__label">{node.name}</span>
    </button>
  );
}

function buildTree(files: WorkspaceFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const f of files) insertPath(root, f.path.split('/'), f.path, '');
  // Sort: folders first, then files, both alphabetically.
  const sort = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.type === 'folder') sort(n.children);
  };
  sort(root);
  return root;
}

function insertPath(nodes: TreeNode[], parts: string[], fullPath: string, prefix: string): void {
  const [head, ...rest] = parts;
  const here = prefix ? `${prefix}/${head}` : head;
  if (rest.length === 0) {
    nodes.push({ type: 'file', name: head, path: fullPath });
    return;
  }
  let folder = nodes.find((n): n is FolderNode => n.type === 'folder' && n.name === head);
  if (!folder) {
    folder = { type: 'folder', name: head, path: here, children: [] };
    nodes.push(folder);
  }
  insertPath(folder.children, rest, fullPath, here);
}

function collectFolderPaths(nodes: TreeNode[]): Set<string> {
  const out = new Set<string>();
  const walk = (ns: TreeNode[]): void => {
    for (const n of ns) if (n.type === 'folder') { out.add(n.path); walk(n.children); }
  };
  walk(nodes);
  return out;
}
