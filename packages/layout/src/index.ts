import { graphlib, layout as runDagreLayout } from "@dagrejs/dagre";
import type {
  DiagramBoundary,
  DiagramLayout,
  DiagramNode,
  DiagramSpec,
  LayoutDirection,
} from "@arch4/core";

const DEFAULT_NODE_WIDTH = 260;
const DEFAULT_NODE_HEIGHT = 140;
const GRAPH_MARGIN = 80;
const CLUSTER_GAP = 72;
const MAX_CLUSTER_SEPARATION_PASSES = 24;

export type LayoutConstraint =
  | {
      kind: "fixed";
      nodeId: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
    }
  | {
      kind: "pinned";
      nodeId: string;
    }
  | {
      kind: "preferred";
      nodeId: string;
      x: number;
      y: number;
    };

export type LayoutNode = {
  id: string;
  width?: number;
  height?: number;
};

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
};

export type LayoutCluster = {
  id: string;
  type: string;
  children: string[];
};

export type LayoutInput = {
  direction?: LayoutDirection;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  clusters: LayoutCluster[];
  constraints?: LayoutConstraint[];
};

export type LayoutDiagramOptions = {
  direction?: LayoutDirection;
  manualPositions?: Record<string, { x: number; y: number }>;
};

type LayoutRect = DiagramLayout;
type DagrePositionedNode = { x: number; y: number };

export type LayoutPadding = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type BoundaryLayoutResult = {
  affectedBoundaryIds: Set<string>;
  boundaries: DiagramBoundary[];
};

export function layoutDiagramSpec(
  spec: DiagramSpec,
  options: LayoutDiagramOptions = {},
): DiagramSpec {
  const direction = options.direction ?? spec.direction ?? "RIGHT";
  const nodes = spec.nodes
    .map((node) => ({
      id: node.id,
      width: node.layout?.width ?? DEFAULT_NODE_WIDTH,
      height: node.layout?.height ?? DEFAULT_NODE_HEIGHT,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = spec.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }))
    .sort((a, b) => {
      const source = a.source.localeCompare(b.source);
      if (source) return source;
      const target = a.target.localeCompare(b.target);
      return target || a.id.localeCompare(b.id);
    });
  const clusters = (spec.boundaries ?? [])
    .map((boundary) => ({
      id: boundary.id,
      type: boundary.type,
      children: [
        ...new Set(boundary.children.filter((id) => nodeIds.has(id))),
      ].sort(),
    }))
    .filter((cluster) => cluster.children.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const layouts = layoutGraph({
    direction,
    nodes,
    edges,
    clusters,
  });
  const laidOutNodes = spec.nodes.map((node) => ({
    ...node,
    layout: layouts.get(node.id) ?? {
      x: GRAPH_MARGIN,
      y: GRAPH_MARGIN,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    },
  }));
  const separatedNodes = separateOverlappingClusters(laidOutNodes, clusters);
  const alignedNodes = alignTopLevelClusterLayers(
    separatedNodes,
    clusters,
    direction,
  );
  const boundaries = layoutBoundaries(spec.boundaries ?? [], alignedNodes);
  const normalized = normalizeOrigin(alignedNodes, boundaries);
  const manualLayouts = applyManualPositions(
    new Map(
      normalized.nodes
        .filter((node) => node.layout)
        .map((node) => [node.id, node.layout!]),
    ),
    nodes,
    options,
  );
  const positionedNodes = normalized.nodes.map((node) => ({
    ...node,
    layout: manualLayouts.get(node.id) ?? node.layout,
  }));
  const positionedBoundaries = layoutBoundaries(
    spec.boundaries ?? [],
    positionedNodes,
  );

  return {
    ...spec,
    direction,
    nodes: positionedNodes,
    boundaries: positionedBoundaries,
    bounds: boundsFor(positionedNodes, positionedBoundaries),
  };
}

export function layoutGraph(input: LayoutInput): Map<string, DiagramLayout> {
  const graph = new graphlib.Graph({ compound: true });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: dagreDirection(input.direction),
    ranksep: 300,
    nodesep: 250,
    edgesep: 80,
    marginx: GRAPH_MARGIN,
    marginy: GRAPH_MARGIN,
  });

  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  const clusters = input.clusters
    .map((cluster) => ({
      ...cluster,
      children: cluster.children.filter((id) => nodesById.has(id)).sort(),
    }))
    .filter((cluster) => cluster.children.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const cluster of clusters) {
    graph.setNode(clusterNodeId(cluster.id), {});
  }
  for (const cluster of clusters) {
    const parentId = parentClusterId(cluster, clusters);
    if (parentId) {
      graph.setParent(clusterNodeId(cluster.id), clusterNodeId(parentId));
    }
  }

  for (const node of input.nodes) {
    graph.setNode(node.id, {
      width: node.width ?? DEFAULT_NODE_WIDTH,
      height: node.height ?? DEFAULT_NODE_HEIGHT,
    });
    const parentId = smallestContainingCluster(node.id, clusters);
    if (parentId) graph.setParent(node.id, clusterNodeId(parentId));
  }
  for (const edge of input.edges) {
    if (nodesById.has(edge.source) && nodesById.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  runDagreLayout(graph);

  const layouts = new Map<string, DiagramLayout>();
  for (const node of input.nodes) {
    const dagreNode = graph.node(node.id) as DagrePositionedNode | undefined;
    const width = node.width ?? DEFAULT_NODE_WIDTH;
    const height = node.height ?? DEFAULT_NODE_HEIGHT;
    if (!dagreNode) {
      layouts.set(node.id, { x: GRAPH_MARGIN, y: GRAPH_MARGIN, width, height });
      continue;
    }
    layouts.set(node.id, {
      x: Math.round(dagreNode.x - width / 2),
      y: Math.round(dagreNode.y - height / 2),
      width,
      height,
    });
  }
  return layouts;
}

function applyManualPositions(
  layouts: Map<string, DiagramLayout>,
  nodes: LayoutNode[],
  options: LayoutDiagramOptions,
): Map<string, DiagramLayout> {
  const manualPositions = options.manualPositions ?? {};
  const manualIds = new Set(Object.keys(manualPositions));
  if (!manualIds.size) return layouts;

  const fixed = new Map(
    [...layouts.entries()].map(([id, layout]) => [id, { ...layout }]),
  );
  const nodeSizes = new Map(
    nodes.map((node) => [
      node.id,
      {
        width: node.width ?? DEFAULT_NODE_WIDTH,
        height: node.height ?? DEFAULT_NODE_HEIGHT,
      },
    ]),
  );

  for (const [id, position] of Object.entries(manualPositions)) {
    const size = nodeSizes.get(id);
    if (!size) continue;
    fixed.set(id, {
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: size.width,
      height: size.height,
    });
  }

  return fixed;
}

function clusterNodeId(id: string): string {
  return `__arch4_cluster_${id}`;
}

function dagreDirection(direction: LayoutDirection | undefined): string {
  if (direction === "LEFT") return "RL";
  if (direction === "DOWN") return "TB";
  if (direction === "UP") return "BT";
  return "LR";
}

function smallestContainingCluster(
  nodeId: string,
  clusters: LayoutCluster[],
): string | undefined {
  return clusters
    .filter((cluster) => cluster.children.includes(nodeId))
    .sort((a, b) => {
      const size = a.children.length - b.children.length;
      return size || a.id.localeCompare(b.id);
    })[0]?.id;
}

function parentClusterId(
  cluster: LayoutCluster,
  clusters: LayoutCluster[],
): string | undefined {
  const children = new Set(cluster.children);
  return clusters
    .filter((candidate) => {
      if (candidate.id === cluster.id) return false;
      const candidateChildren = new Set(candidate.children);
      if (candidateChildren.size <= children.size) return false;
      return [...children].every((id) => candidateChildren.has(id));
    })
    .sort((a, b) => {
      const size = a.children.length - b.children.length;
      return size || a.id.localeCompare(b.id);
    })[0]?.id;
}

function separateOverlappingClusters(
  nodes: DiagramNode[],
  clusters: LayoutCluster[],
): DiagramNode[] {
  const layouts = new Map(
    nodes
      .filter((node) => node.layout)
      .map((node) => [node.id, { ...node.layout! }]),
  );
  const activeClusters = clusters
    .map((cluster) => ({
      ...cluster,
      children: cluster.children.filter((id) => layouts.has(id)),
    }))
    .filter((cluster) => cluster.children.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (let pass = 0; pass < MAX_CLUSTER_SEPARATION_PASSES; pass += 1) {
    let moved = false;
    for (let i = 0; i < activeClusters.length; i += 1) {
      for (let j = i + 1; j < activeClusters.length; j += 1) {
        const a = activeClusters[i]!;
        const b = activeClusters[j]!;
        if (clustersShareChildren(a, b)) continue;
        const aRect = clusterRect(a, layouts, activeClusters);
        const bRect = clusterRect(b, layouts, activeClusters);
        if (!aRect || !bRect || !rectsOverlap(aRect, bRect, CLUSTER_GAP)) {
          continue;
        }
        const shift = collisionShift(aRect, bRect);
        if (!shift) continue;
        moveCluster(b, shift.dx, shift.dy, layouts);
        moved = true;
      }
    }
    if (!moved) break;
  }

  return nodes.map((node) => {
    const layout = layouts.get(node.id);
    return layout ? { ...node, layout } : node;
  });
}

function alignTopLevelClusterLayers(
  nodes: DiagramNode[],
  clusters: LayoutCluster[],
  direction: LayoutDirection,
): DiagramNode[] {
  const layouts = new Map(
    nodes
      .filter((node) => node.layout)
      .map((node) => [node.id, { ...node.layout! }]),
  );
  const activeClusters = clusters
    .map((cluster) => ({
      ...cluster,
      children: cluster.children.filter((id) => layouts.has(id)),
    }))
    .filter((cluster) => cluster.children.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  const topLevelClusters = activeClusters.filter(
    (cluster) => !parentClusterId(cluster, activeClusters),
  );
  if (topLevelClusters.length < 2) return nodes;

  separateTopLevelClustersAlongMainAxis(
    topLevelClusters,
    activeClusters,
    layouts,
    direction,
  );

  const clusterRects = computeClusterRects(activeClusters, layouts);
  const layers = clusterLayers(topLevelClusters, clusterRects, direction);
  if (layers.length < 2) return nodes;

  const layerRects = layers
    .map((layer) =>
      unionLayouts(
        layer.map((cluster) => clusterRects.get(cluster.id)).filter(isDefined),
      ),
    )
    .filter(isDefined);
  if (layerRects.length < 2) return nodes;

  const crossAxis = isVerticalDirection(direction) ? "x" : "y";
  const targetCenter = median(
    layerRects.map((rect) => center(rect, crossAxis)),
  );

  layers.forEach((layer, index) => {
    const layerRect = layerRects[index];
    if (!layerRect) return;
    const delta = Math.round(targetCenter - center(layerRect, crossAxis));
    if (delta === 0) return;
    const movedNodeIds = new Set<string>();
    for (const cluster of layer) {
      moveCluster(
        {
          ...cluster,
          children: cluster.children.filter((id) => {
            if (movedNodeIds.has(id)) return false;
            movedNodeIds.add(id);
            return true;
          }),
        },
        crossAxis === "x" ? delta : 0,
        crossAxis === "y" ? delta : 0,
        layouts,
      );
    }
  });

  return nodes.map((node) => {
    const layout = layouts.get(node.id);
    return layout ? { ...node, layout } : node;
  });
}

function separateTopLevelClustersAlongMainAxis(
  topLevelClusters: LayoutCluster[],
  activeClusters: LayoutCluster[],
  layouts: Map<string, DiagramLayout>,
  direction: LayoutDirection,
): void {
  const mainAxis = isVerticalDirection(direction) ? "y" : "x";
  const sortedClusters = [...topLevelClusters].sort((a, b) => {
    const clusterRects = computeClusterRects(activeClusters, layouts);
    const aRect = clusterRects.get(a.id);
    const bRect = clusterRects.get(b.id);
    if (!aRect || !bRect) return a.id.localeCompare(b.id);
    return aRect[mainAxis] - bRect[mainAxis] || a.id.localeCompare(b.id);
  });
  let currentEnd = Number.NEGATIVE_INFINITY;

  for (const cluster of sortedClusters) {
    const clusterRects = computeClusterRects(activeClusters, layouts);
    const rect = clusterRects.get(cluster.id);
    if (!rect) continue;
    const start = rect[mainAxis];
    const size = mainAxis === "x" ? rect.width : rect.height;
    const desiredStart = currentEnd + CLUSTER_GAP;
    const delta = Number.isFinite(currentEnd)
      ? Math.max(0, desiredStart - start)
      : 0;
    if (delta > 0) {
      moveCluster(
        cluster,
        mainAxis === "x" ? delta : 0,
        mainAxis === "y" ? delta : 0,
        layouts,
      );
    }
    currentEnd = Math.max(currentEnd, start + delta + size);
  }
}

function clusterLayers(
  clusters: LayoutCluster[],
  clusterRects: Map<string, LayoutRect | undefined>,
  direction: LayoutDirection,
): LayoutCluster[][] {
  const mainAxis = isVerticalDirection(direction) ? "y" : "x";
  const sortedClusters = clusters
    .filter((cluster) => clusterRects.get(cluster.id))
    .sort((a, b) => {
      const aRect = clusterRects.get(a.id)!;
      const bRect = clusterRects.get(b.id)!;
      return aRect[mainAxis] - bRect[mainAxis] || a.id.localeCompare(b.id);
    });
  const layers: LayoutCluster[][] = [];
  let currentLayer: LayoutCluster[] = [];
  let currentEnd = Number.NEGATIVE_INFINITY;

  for (const cluster of sortedClusters) {
    const rect = clusterRects.get(cluster.id);
    if (!rect) continue;
    const start = rect[mainAxis];
    const end = rect[mainAxis] + (mainAxis === "x" ? rect.width : rect.height);
    if (currentLayer.length && start > currentEnd) {
      layers.push(currentLayer);
      currentLayer = [];
      currentEnd = Number.NEGATIVE_INFINITY;
    }
    currentLayer.push(cluster);
    currentEnd = Math.max(currentEnd, end);
  }
  if (currentLayer.length) layers.push(currentLayer);
  return layers;
}

function clustersShareChildren(a: LayoutCluster, b: LayoutCluster): boolean {
  const bChildren = new Set(b.children);
  return a.children.some((id) => bChildren.has(id));
}

function clusterRect(
  cluster: LayoutCluster,
  layouts: Map<string, DiagramLayout>,
  clusters: LayoutCluster[],
): LayoutRect | undefined {
  return computeClusterRects(clusters, layouts).get(cluster.id);
}

function computeClusterRects(
  clusters: LayoutCluster[],
  layouts: Map<string, DiagramLayout>,
): Map<string, LayoutRect | undefined> {
  const computedRects = new Map<string, LayoutRect | undefined>();
  const orderedClusters = [...clusters].sort((a, b) => {
    const childCount = a.children.length - b.children.length;
    return childCount || a.id.localeCompare(b.id);
  });

  for (const cluster of orderedClusters) {
    const childIds = new Set(cluster.children);
    const childNodeRects = cluster.children
      .map((id) => layouts.get(id))
      .filter(isDefined);
    const nestedClusterRects = orderedClusters
      .filter((candidate) =>
        isNestedChildren(
          candidate.id,
          candidate.children,
          cluster.id,
          childIds,
        ),
      )
      .map((candidate) => computedRects.get(candidate.id))
      .filter(isDefined);
    const rect = unionLayouts([...childNodeRects, ...nestedClusterRects]);
    computedRects.set(
      cluster.id,
      rect ? expandLayoutRect(rect, boundaryPadding(cluster.type)) : undefined,
    );
  }

  return computedRects;
}

function moveCluster(
  cluster: LayoutCluster,
  dx: number,
  dy: number,
  layouts: Map<string, DiagramLayout>,
): void {
  for (const id of cluster.children) {
    const layout = layouts.get(id);
    if (!layout) continue;
    layouts.set(id, {
      ...layout,
      x: Math.round(layout.x + dx),
      y: Math.round(layout.y + dy),
    });
  }
}

function rectsOverlap(a: LayoutRect, b: LayoutRect, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

function collisionShift(
  a: LayoutRect,
  b: LayoutRect,
): { dx: number; dy: number } | undefined {
  const moveRight = a.x + a.width + CLUSTER_GAP - b.x;
  const moveLeft = a.x - CLUSTER_GAP - (b.x + b.width);
  const dx = center(b, "x") >= center(a, "x") ? moveRight : moveLeft;
  const moveDown = a.y + a.height + CLUSTER_GAP - b.y;
  const moveUp = a.y - CLUSTER_GAP - (b.y + b.height);
  const dy = center(b, "y") >= center(a, "y") ? moveDown : moveUp;
  if (dx === 0 && dy === 0) return undefined;
  return Math.abs(dx) <= Math.abs(dy) ? { dx, dy: 0 } : { dx: 0, dy };
}

function center(rect: LayoutRect, axis: "x" | "y"): number {
  return axis === "x" ? rect.x + rect.width / 2 : rect.y + rect.height / 2;
}

function isVerticalDirection(direction: LayoutDirection): boolean {
  return direction === "DOWN" || direction === "UP";
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function layoutBoundaries(
  boundaries: DiagramBoundary[],
  nodes: DiagramNode[],
): DiagramBoundary[] {
  const nodeLayouts = new Map(
    nodes.filter((node) => node.layout).map((node) => [node.id, node.layout!]),
  );
  return deriveBoundaryLayouts(boundaries, nodeLayouts).boundaries;
}

function normalizeOrigin(
  nodes: DiagramNode[],
  boundaries: DiagramBoundary[],
): { nodes: DiagramNode[]; boundaries: DiagramBoundary[] } {
  const rect = unionLayouts([
    ...nodes.map((node) => node.layout).filter(isDefined),
    ...boundaries.map((boundary) => boundary.layout).filter(isDefined),
  ]);
  if (!rect) return { nodes, boundaries };
  const dx = GRAPH_MARGIN - rect.x;
  const dy = GRAPH_MARGIN - rect.y;
  if (dx === 0 && dy === 0) return { nodes, boundaries };
  return {
    nodes: nodes.map((node) => ({
      ...node,
      layout: node.layout ? translateLayout(node.layout, dx, dy) : node.layout,
    })),
    boundaries: boundaries.map((boundary) => ({
      ...boundary,
      layout: boundary.layout
        ? translateLayout(boundary.layout, dx, dy)
        : boundary.layout,
    })),
  };
}

function boundsFor(
  nodes: DiagramNode[],
  boundaries: DiagramBoundary[],
): DiagramSpec["bounds"] {
  const rect = unionLayouts([
    ...nodes.map((node) => node.layout).filter(isDefined),
    ...boundaries.map((boundary) => boundary.layout).filter(isDefined),
  ]);
  return rect
    ? {
        width: Math.ceil(rect.x + rect.width + GRAPH_MARGIN),
        height: Math.ceil(rect.y + rect.height + GRAPH_MARGIN),
      }
    : undefined;
}

function translateLayout(
  layout: DiagramLayout,
  dx: number,
  dy: number,
): DiagramLayout {
  return {
    ...layout,
    x: Math.round(layout.x + dx),
    y: Math.round(layout.y + dy),
  };
}

export function deriveBoundaryLayouts(
  boundaries: DiagramBoundary[],
  nodeLayouts: Map<string, DiagramLayout>,
  options: {
    changedNodeIds?: Set<string>;
    existingBoundaryLayouts?: Map<string, DiagramLayout>;
  } = {},
): BoundaryLayoutResult {
  const computedLayouts = new Map<string, DiagramLayout | undefined>();
  const affectedBoundaryIds = new Set<string>();
  const orderedBoundaries = [...boundaries].sort((a, b) => {
    const childCount = a.children.length - b.children.length;
    return childCount || a.id.localeCompare(b.id);
  });

  for (const boundary of orderedBoundaries) {
    const childIds = new Set(boundary.children);
    const nestedBoundaries = orderedBoundaries.filter((candidate) =>
      isNestedBoundary(candidate, boundary, childIds),
    );
    const isAffected =
      !options.changedNodeIds ||
      boundary.children.some((id) => options.changedNodeIds?.has(id)) ||
      nestedBoundaries.some((candidate) =>
        affectedBoundaryIds.has(candidate.id),
      );
    if (!isAffected) {
      computedLayouts.set(
        boundary.id,
        options.existingBoundaryLayouts?.get(boundary.id) ?? boundary.layout,
      );
      continue;
    }

    affectedBoundaryIds.add(boundary.id);
    const childNodeRects = boundary.children
      .map((id) => nodeLayouts.get(id))
      .filter(isDefined);
    const nestedBoundaryRects = nestedBoundaries
      .map((candidate) => computedLayouts.get(candidate.id))
      .filter(isDefined);
    const rect = unionLayouts([...childNodeRects, ...nestedBoundaryRects]);
    computedLayouts.set(
      boundary.id,
      rect
        ? expandLayoutRect(rect, boundaryPadding(boundary.type))
        : boundary.layout,
    );
  }

  return {
    affectedBoundaryIds,
    boundaries: boundaries.map((boundary) => ({
      ...boundary,
      layout: computedLayouts.get(boundary.id),
    })),
  };
}

export function isNestedChildren(
  candidateId: string,
  candidateChildren: string[],
  boundaryId: string,
  boundaryChildIds: Set<string>,
): boolean {
  if (candidateId === boundaryId) return false;
  if (candidateChildren.length >= boundaryChildIds.size) return false;
  return candidateChildren.every((id) => boundaryChildIds.has(id));
}

function isNestedBoundary(
  candidate: DiagramBoundary,
  boundary: DiagramBoundary,
  boundaryChildIds: Set<string>,
): boolean {
  return isNestedChildren(
    candidate.id,
    candidate.children,
    boundary.id,
    boundaryChildIds,
  );
}

export function unionLayouts(
  rects: DiagramLayout[],
): DiagramLayout | undefined {
  if (!rects.length) return undefined;
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
  };
}

export function expandLayoutRect(
  rect: DiagramLayout,
  padding: LayoutPadding,
): DiagramLayout {
  return {
    x: Math.floor(rect.x - padding.left),
    y: Math.floor(rect.y - padding.top),
    width: Math.max(240, Math.ceil(rect.width + padding.left + padding.right)),
    height: Math.max(
      160,
      Math.ceil(rect.height + padding.top + padding.bottom),
    ),
  };
}

export function boundaryPadding(boundaryType: string): LayoutPadding {
  if (boundaryType === "softwareSystem") {
    return { left: 96, top: 92, right: 96, bottom: 82 };
  }
  if (boundaryType === "container" || boundaryType === "deploymentNode") {
    return { left: 88, top: 82, right: 88, bottom: 76 };
  }
  return { left: 82, top: 76, right: 82, bottom: 70 };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
