import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { ChevronRight, FileText, Folder, Search } from "lucide-react";

export type Arch4TreeIcon = ComponentType<{
  className?: string;
  size?: number;
  strokeWidth?: number;
}>;

export type Arch4TreeItem = {
  disabled?: boolean;
  icon?: Arch4TreeIcon;
  iconClassName?: string;
  id: string;
  kind?: string;
  label: string;
  path?: string[];
  subtitle?: string;
};

export type Arch4TreeNode = {
  children: Arch4TreeNode[];
  id: string;
  item?: Arch4TreeItem;
  label: string;
  path: string[];
};

export type Arch4TreeProps = {
  className?: string;
  emptyTitle?: string;
  header?: ReactNode;
  headerAction?: ReactNode;
  items: Arch4TreeItem[];
  onQueryChange?: (query: string) => void;
  onSelect: (id: string) => void;
  query?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  selectedId?: string | null;
  theme?: "dark" | "light";
  title?: string;
};

export function Arch4Tree(props: Arch4TreeProps) {
  const query = props.query ?? "";
  const nodes = useMemo(
    () => buildArch4TreeItems(props.items, query),
    [props.items, query],
  );
  const defaultExpanded = useMemo(
    () => defaultExpandedArch4TreeNodeIds(nodes, props.selectedId, query),
    [nodes, props.selectedId, query],
  );
  const automaticExpanded = useMemo(
    () =>
      query.trim()
        ? defaultExpanded
        : selectedArch4TreeNodeAncestorIds(nodes, props.selectedId),
    [defaultExpanded, nodes, props.selectedId, query],
  );
  const validFolderIds = useMemo(() => collectFolderIds(nodes), [nodes]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(defaultExpanded),
  );

  useEffect(() => {
    setExpandedIds((current) => {
      const next = new Set(
        Array.from(current).filter((id) => validFolderIds.has(id)),
      );
      automaticExpanded.forEach((id) => next.add(id));
      if (setsEqual(current, next)) return current;
      return next;
    });
  }, [automaticExpanded, validFolderIds]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <aside
      className={`arch4-tree-panel ${props.className ?? ""}`.trim()}
      data-arch4-theme={props.theme}
    >
      {(props.title || props.header || props.headerAction) && (
        <div className="arch4-tree-header">
          <div className="arch4-tree-title">
            {props.header ??
              (props.title ? <strong>{props.title}</strong> : null)}
          </div>
          {props.headerAction && (
            <div className="arch4-tree-header-action">{props.headerAction}</div>
          )}
        </div>
      )}
      {props.onQueryChange && (
        <label className="arch4-tree-search">
          <Search aria-hidden="true" size={16} />
          <span className="arch4-sr-only">
            {props.searchLabel ?? `Search ${props.title ?? "items"}`}
          </span>
          <input
            placeholder={props.searchPlaceholder ?? "Search"}
            type="search"
            value={query}
            onChange={(event) => props.onQueryChange?.(event.target.value)}
          />
        </label>
      )}
      <div className="arch4-tree-scroll" role="tree">
        {!nodes.length && (
          <div className="arch4-tree-empty">
            {props.emptyTitle ?? "No items match"}
          </div>
        )}
        <div className="arch4-tree">
          {nodes.map((node) => (
            <Arch4TreeNodeView
              depth={0}
              expandedIds={expandedIds}
              key={node.id}
              node={node}
              onSelect={props.onSelect}
              selectedId={props.selectedId}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function Arch4TreeNodeView(props: {
  depth: number;
  expandedIds: Set<string>;
  node: Arch4TreeNode;
  onSelect: (id: string) => void;
  selectedId?: string | null;
  toggleExpanded: (id: string) => void;
}) {
  if (props.node.item) {
    const item = props.node.item;
    const Icon = item.icon ?? FileText;
    return (
      <button
        aria-disabled={item.disabled || undefined}
        aria-selected={props.selectedId === item.id}
        className={props.selectedId === item.id ? "active" : undefined}
        disabled={item.disabled}
        role="treeitem"
        style={{ paddingLeft: `${10 + props.depth * 14}px` }}
        title={item.label}
        type="button"
        onClick={() => props.onSelect(item.id)}
      >
        <span
          aria-hidden="true"
          className={`arch4-tree-item-icon ${item.iconClassName ?? ""}`.trim()}
        >
          <Icon size={14} strokeWidth={2.35} />
        </span>
        <span className="arch4-tree-item-text">
          <strong>{item.label}</strong>
          {item.subtitle && <small>{item.subtitle}</small>}
        </span>
      </button>
    );
  }

  const isExpanded = props.expandedIds.has(props.node.id);
  return (
    <section className="arch4-tree-folder">
      <button
        aria-expanded={isExpanded}
        role="treeitem"
        style={{ paddingLeft: `${6 + props.depth * 14}px` }}
        title={props.node.path.join("/")}
        type="button"
        onClick={() => props.toggleExpanded(props.node.id)}
      >
        <ChevronRight
          aria-hidden="true"
          className={isExpanded ? "open" : undefined}
          size={14}
        />
        <Folder aria-hidden="true" size={14} />
        <strong>{props.node.label}</strong>
      </button>
      {isExpanded && (
        <div className="arch4-tree-folder-children" role="group">
          {props.node.children.map((child) => (
            <Arch4TreeNodeView
              depth={props.depth + 1}
              expandedIds={props.expandedIds}
              key={child.id}
              node={child}
              onSelect={props.onSelect}
              selectedId={props.selectedId}
              toggleExpanded={props.toggleExpanded}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function buildArch4TreeItems(
  items: Arch4TreeItem[],
  query = "",
): Arch4TreeNode[] {
  const trimmed = query.trim();
  const matcher = trimmed ? new RegExp(escapeRegExp(trimmed), "i") : null;
  const roots: Arch4TreeNode[] = [];
  const rootBySegment = new Map<string, Arch4TreeNode>();
  const childIndexes = new Map<string, Map<string, Arch4TreeNode>>();

  items.forEach((item) => {
    const path = normalizeTreePath(item);
    if (matcher && !matcher.test(`${path.join(" ")} ${item.subtitle ?? ""}`)) {
      return;
    }
    let siblings = roots;
    let siblingIndex = rootBySegment;

    path.slice(0, -1).forEach((segment, index) => {
      const nodePath = path.slice(0, index + 1);
      const nodeId = folderNodeId(nodePath);
      let folder = siblingIndex.get(segment);
      if (!folder) {
        folder = { children: [], id: nodeId, label: segment, path: nodePath };
        siblingIndex.set(segment, folder);
        siblings.push(folder);
      }
      if (!childIndexes.has(folder.id)) {
        childIndexes.set(folder.id, new Map());
      }
      siblings = folder.children;
      siblingIndex = childIndexes.get(folder.id)!;
    });

    siblings.push({
      children: [],
      id: leafNodeId(item.id),
      item: { ...item, path },
      label: path[path.length - 1] ?? item.label,
      path,
    });
  });

  return roots;
}

export function defaultExpandedArch4TreeNodeIds(
  nodes: Arch4TreeNode[],
  selectedId: string | null | undefined,
  query = "",
): string[] {
  const expanded = new Set<string>();
  const hasQuery = Boolean(query.trim());

  function visit(node: Arch4TreeNode, depth: number): boolean {
    if (node.item) return node.item.id === selectedId;
    const hasSelectedDescendant = node.children.some((child) =>
      visit(child, depth + 1),
    );
    if (depth === 0 || hasQuery || hasSelectedDescendant) {
      expanded.add(node.id);
    }
    return hasSelectedDescendant;
  }

  nodes.forEach((node) => visit(node, 0));
  return Array.from(expanded);
}

export function selectedArch4TreeNodeAncestorIds(
  nodes: Arch4TreeNode[],
  selectedId: string | null | undefined,
): string[] {
  const expanded = new Set<string>();

  function visit(node: Arch4TreeNode): boolean {
    if (node.item) return node.item.id === selectedId;
    const hasSelectedDescendant = node.children.some(visit);
    if (hasSelectedDescendant) expanded.add(node.id);
    return hasSelectedDescendant;
  }

  nodes.forEach(visit);
  return Array.from(expanded);
}

function normalizeTreePath(item: Arch4TreeItem): string[] {
  const path = (item.path ?? [item.label])
    .map((segment) => segment.trim())
    .filter(Boolean);
  return path.length ? path : [item.label];
}

function collectFolderIds(nodes: Arch4TreeNode[]): Set<string> {
  const ids = new Set<string>();
  nodes.forEach((node) => {
    if (!node.item) {
      ids.add(node.id);
      collectFolderIds(node.children).forEach((id) => ids.add(id));
    }
  });
  return ids;
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function folderNodeId(path: string[]): string {
  return `folder:${path.join("\u001f")}`;
}

function leafNodeId(id: string): string {
  return `leaf:${id}`;
}
