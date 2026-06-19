import { type Edge, type Node } from "@xyflow/react";
import {
  DEFAULT_DIAGRAM_NODE_HEIGHT,
  DEFAULT_DIAGRAM_NODE_WIDTH,
} from "@arch4/core/diagram-geometry";
import type {
  ArchitectureIndex,
  DiagramLayout,
  DiagramNode,
  DiagramSpec,
} from "@arch4/core";
import { deriveBoundaryLayouts } from "@arch4/layout";
import { resolveRelatedNavigationTargets } from "./navigation.js";
import type {
  Arch4EdgeData,
  Arch4NodeData,
  Arch4RelatedNavigationTarget,
} from "./types.js";

export function toFlow(
  spec: DiagramSpec | undefined,
  elementById: Map<string, ArchitectureIndex["elements"][number]>,
  showEdgeLabels: boolean,
  actions: {
    diagrams: DiagramSpec[];
    entityParentById: Map<string, string>;
    onNavigate: (target: Arch4RelatedNavigationTarget) => void;
    onSelect: (node: DiagramNode) => void;
    selectedNodeId?: string;
  },
): {
  nodes: Array<Node<Arch4NodeData>>;
  edges: Array<Edge<Arch4EdgeData>>;
} {
  if (!spec) return { nodes: [], edges: [] };
  const elementNodes = spec.nodes.map((node, index): Node<Arch4NodeData> => {
    const size = elementNodeSize(node.layout);
    return {
      id: node.id,
      type: "arch4Node",
      position: {
        x: node.layout?.x ?? 120 + (index % 4) * 360,
        y: node.layout?.y ?? 120 + Math.floor(index / 4) * 240,
      },
      width: size.width,
      height: size.height,
      style: size,
      draggable: true,
      zIndex: 20,
      data: {
        kind: "element",
        node,
        element: elementById.get(node.entityId ?? node.id),
        isSelected: actions.selectedNodeId === node.id,
        onNavigate: actions.onNavigate,
        onSelect: actions.onSelect,
        relatedTargets: resolveRelatedNavigationTargets({
          activeDiagram: spec,
          diagrams: actions.diagrams,
          entityParentById: actions.entityParentById,
          node,
        }),
      },
    };
  });
  const boundaryNodes = (spec.boundaries ?? [])
    .filter((boundary) => Boolean(boundary.layout))
    .map((boundary): Node<Arch4NodeData> => {
      const layout = boundary.layout!;
      return {
        id: boundary.id,
        type: "arch4Boundary",
        position: { x: layout.x, y: layout.y },
        width: layout.width,
        height: layout.height,
        style: { width: layout.width, height: layout.height },
        selectable: false,
        draggable: false,
        focusable: false,
        zIndex: 0,
        data: { kind: "boundary", boundary },
      };
    });
  const nodes = [...boundaryNodes, ...elementNodes];
  return {
    nodes,
    edges: buildFlowEdges(spec, nodes, showEdgeLabels),
  };
}

export function buildFlowEdges(
  spec: DiagramSpec,
  nodes: Array<Node<Arch4NodeData>>,
  showEdgeLabels: boolean,
): Array<Edge<Arch4EdgeData>> {
  const elementNodes = nodes.filter((node) => {
    const data = node.data as Arch4NodeData | undefined;
    return data?.kind === "element";
  });
  const nodeIds = new Set(elementNodes.map((node) => node.id));
  const visibleEdges = spec.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  );
  const handlePairs = handleAssignments(visibleEdges, elementNodes);
  return visibleEdges.map(
    (edge): Edge<Arch4EdgeData> => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: handlePairs.get(edge.id)?.sourceHandle,
      target: edge.target,
      targetHandle: handlePairs.get(edge.id)?.targetHandle,
      type: "arch4Edge",
      zIndex: 15,
      data: {
        label: showEdgeLabels ? edge.label : undefined,
        technology: edge.technology,
        order: edge.order,
        dynamic: edge.dynamic,
        vertices: edge.vertices,
        style: edge.style,
      },
    }),
  );
}

function handleAssignments(
  edges: DiagramSpec["edges"],
  nodes: Array<Node<Arch4NodeData>>,
): Map<string, { sourceHandle: string; targetHandle: string }> {
  const nodeRects = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: node.position.x,
        y: node.position.y,
        width: nodeNumberSize(node, "width") ?? DEFAULT_DIAGRAM_NODE_WIDTH,
        height: nodeNumberSize(node, "height") ?? DEFAULT_DIAGRAM_NODE_HEIGHT,
      },
    ]),
  );
  const edgeInfos = edges.map((edge) => {
    const sourceRect = nodeRects.get(edge.source);
    const targetRect = nodeRects.get(edge.target);
    const pair =
      sourceRect && targetRect
        ? computeHandlePair(sourceRect, targetRect)
        : { sourceSide: "right", targetSide: "left" };
    return { edge, ...pair };
  });

  const sideGroups = new Map<
    string,
    Array<{ edgeIndex: number; role: "source" | "target" }>
  >();
  edgeInfos.forEach((info, edgeIndex) => {
    const sourceKey = `${info.edge.source}:${info.sourceSide}`;
    const targetKey = `${info.edge.target}:${info.targetSide}`;
    sideGroups.set(sourceKey, [
      ...(sideGroups.get(sourceKey) ?? []),
      { edgeIndex, role: "source" },
    ]);
    sideGroups.set(targetKey, [
      ...(sideGroups.get(targetKey) ?? []),
      { edgeIndex, role: "target" },
    ]);
  });

  const sourceSlots = new Map<number, string>();
  const targetSlots = new Map<number, string>();
  for (const [key, entries] of sideGroups.entries()) {
    const side = key.split(":")[1] ?? "right";
    const sorted = [...entries].sort((a, b) => {
      const counterpartA = counterpartNodeId(edgeInfos[a.edgeIndex]!, a.role);
      const counterpartB = counterpartNodeId(edgeInfos[b.edgeIndex]!, b.role);
      const rectA = nodeRects.get(counterpartA);
      const rectB = nodeRects.get(counterpartB);
      if (!rectA || !rectB) return counterpartA.localeCompare(counterpartB);
      const centerA = rectCenter(rectA);
      const centerB = rectCenter(rectB);
      const delta =
        side === "top" || side === "bottom"
          ? centerA.x - centerB.x
          : centerA.y - centerB.y;
      return delta || counterpartA.localeCompare(counterpartB);
    });
    const slots = pickSlots(sorted.length);
    sorted.forEach((entry, index) => {
      const slotMap = entry.role === "source" ? sourceSlots : targetSlots;
      slotMap.set(entry.edgeIndex, slots[index]!);
    });
  }

  return new Map(
    edgeInfos.map((info, index) => [
      info.edge.id,
      {
        sourceHandle: `${info.sourceSide}-${sourceSlots.get(index) ?? "b"}-source`,
        targetHandle: `${info.targetSide}-${targetSlots.get(index) ?? "b"}-target`,
      },
    ]),
  );
}

function computeHandlePair(
  source: DiagramLayout,
  target: DiagramLayout,
): { sourceSide: string; targetSide: string } {
  const sourceCenter = rectCenter(source);
  const targetCenter = rectCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0
      ? { sourceSide: "right", targetSide: "left" }
      : { sourceSide: "left", targetSide: "right" };
  }
  return dy >= 0
    ? { sourceSide: "bottom", targetSide: "top" }
    : { sourceSide: "top", targetSide: "bottom" };
}

function rectCenter(rect: DiagramLayout): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function counterpartNodeId(
  info: {
    edge: DiagramSpec["edges"][number];
  },
  role: "source" | "target",
): string {
  return role === "source" ? info.edge.target : info.edge.source;
}

function pickSlots(count: number): string[] {
  if (count <= 1) return ["b"];
  if (count === 2) return ["a", "c"];
  const slots = ["a", "b", "c"];
  return Array.from(
    { length: count },
    (_, index) => slots[index % slots.length]!,
  );
}

export function rebuildBoundaryFlowNodes(
  spec: DiagramSpec,
  nodes: Array<Node<Arch4NodeData>>,
  changedNodeIds?: Set<string>,
): Array<Node<Arch4NodeData>> {
  const elementNodes = nodes.filter((node) => {
    const data = node.data as Arch4NodeData | undefined;
    return data?.kind === "element";
  });
  const existingBoundaryNodes = new Map(
    nodes
      .filter((node) => {
        const data = node.data as Arch4NodeData | undefined;
        return data?.kind === "boundary";
      })
      .map((node) => [node.id, node]),
  );
  const existingBoundaryLayouts = new Map(
    [...existingBoundaryNodes.entries()].map(([id, node]) => [
      id,
      {
        x: node.position.x,
        y: node.position.y,
        width: nodeNumberSize(node, "width") ?? 240,
        height: nodeNumberSize(node, "height") ?? 160,
      },
    ]),
  );
  const layouts = new Map<string, DiagramLayout>();
  for (const node of elementNodes) {
    layouts.set(node.id, {
      x: node.position.x,
      y: node.position.y,
      width: nodeNumberSize(node, "width") ?? DEFAULT_DIAGRAM_NODE_WIDTH,
      height: nodeNumberSize(node, "height") ?? DEFAULT_DIAGRAM_NODE_HEIGHT,
    });
  }
  const { affectedBoundaryIds, boundaries } = deriveBoundaryLayouts(
    spec.boundaries ?? [],
    layouts,
    { existingBoundaryLayouts, changedNodeIds },
  );
  const boundaryNodes = boundaries
    .filter((boundary) => Boolean(boundary.layout))
    .map((boundary): Node<Arch4NodeData> => {
      if (changedNodeIds && !affectedBoundaryIds.has(boundary.id)) {
        const existing = existingBoundaryNodes.get(boundary.id);
        if (existing) return existing;
      }
      const layout = boundary.layout!;
      return {
        id: boundary.id,
        type: "arch4Boundary",
        position: { x: layout.x, y: layout.y },
        width: layout.width,
        height: layout.height,
        style: { width: layout.width, height: layout.height },
        selectable: false,
        draggable: false,
        focusable: false,
        zIndex: 0,
        data: { kind: "boundary", boundary },
      };
    });
  return [...boundaryNodes, ...elementNodes];
}

function elementNodeSize(layout: DiagramLayout | undefined): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(layout?.width ?? 0, DEFAULT_DIAGRAM_NODE_WIDTH),
    height: Math.max(layout?.height ?? 0, DEFAULT_DIAGRAM_NODE_HEIGHT),
  };
}

function nodeNumberSize(
  node: Node<Arch4NodeData>,
  key: "width" | "height",
): number | undefined {
  const value = node[key] ?? node.measured?.[key] ?? node.style?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}
