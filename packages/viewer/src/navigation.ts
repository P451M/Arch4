import type { ArchitectureIndex, DiagramNode, DiagramSpec } from "@arch4/core";
import type {
  Arch4CurrentViewRelationship,
  Arch4ElementInfo,
  Arch4RelatedNavigationTarget,
} from "./types.js";
import { titleForType } from "./icons.js";

export function relationshipViewLabel(
  viewId: string,
  info: Arch4ElementInfo,
  diagrams: DiagramSpec[],
): string {
  const view = info.views.find((item) => item.id === viewId);
  const diagram = diagrams.find((item) => item.id === viewId);
  const name = view?.name ?? diagram?.name ?? viewId;
  const type = view?.type ?? diagram?.type;
  return type ? `${name} (${titleForType(type)})` : name;
}

export function resolveCurrentViewRelationships(
  diagram: DiagramSpec,
  node: DiagramNode,
): Arch4CurrentViewRelationship[] {
  const nodesById = new Map(diagram.nodes.map((item) => [item.id, item]));
  return diagram.edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => {
      const direction: "inbound" | "outbound" =
        edge.target === node.id ? "inbound" : "outbound";
      const counterpartNodeId =
        direction === "inbound" ? edge.source : edge.target;
      const sourceNode = nodesById.get(edge.source);
      const targetNode = nodesById.get(edge.target);
      return {
        counterpartName:
          nodesById.get(counterpartNodeId)?.name ?? counterpartNodeId,
        counterpartNodeId,
        direction,
        id: edge.id,
        label: edge.label,
        sourceName: sourceNode?.name ?? edge.source,
        sourceNodeId: edge.source,
        targetName: targetNode?.name ?? edge.target,
        targetNodeId: edge.target,
        technology: edge.technology,
      };
    });
}

export function resolveIndexedRelationshipsOutsideCurrentView(
  diagram: DiagramSpec,
  relationships: Arch4ElementInfo["relationships"],
): Arch4ElementInfo["relationships"] {
  const currentRelationshipIds = new Set(diagram.edges.map((edge) => edge.id));
  return relationships.filter(
    (relationship) => !currentRelationshipIds.has(relationship.id),
  );
}

export function resolveRelatedNavigationTargets(args: {
  activeDiagram: DiagramSpec;
  diagrams: DiagramSpec[];
  entityParentById: Map<string, string>;
  node: DiagramNode;
}): Arch4RelatedNavigationTarget[] {
  const currentRank = diagramViewRank(args.activeDiagram.type);
  const entityIds = uniqueStrings([args.node.entityId, args.node.id]);
  const childTargets = args.diagrams
    .filter((diagram) => diagram.id !== args.activeDiagram.id)
    .filter((diagram) => diagramViewRank(diagram.type) > currentRank)
    .filter((diagram) =>
      entityIds.some((entityId) => viewSubjectMatches(diagram, entityId)),
    )
    .map((diagram) => ({
      diagram,
      entityId:
        entityIds.find((entityId) => viewSubjectMatches(diagram, entityId)) ??
        entityIds[0]!,
      kind: "child" as const,
    }));

  const activeSubjectIds = uniqueStrings([
    args.activeDiagram.subjectEntityId,
    args.activeDiagram.subjectId,
  ]);
  const activeSubjectParentIds = activeSubjectIds
    .map((entityId) => args.entityParentById.get(entityId))
    .filter((entityId): entityId is string => Boolean(entityId));
  const parentIds = uniqueStrings([
    args.node.parentEntityId,
    args.node.entityId
      ? args.entityParentById.get(args.node.entityId)
      : undefined,
    args.entityParentById.get(args.node.id),
    ...activeSubjectParentIds,
  ]);
  const parentTargets = args.diagrams
    .filter((diagram) => diagram.id !== args.activeDiagram.id)
    .filter((diagram) => diagramViewRank(diagram.type) < currentRank)
    .filter((diagram) =>
      parentIds.some((entityId) => viewSubjectMatches(diagram, entityId)),
    )
    .map((diagram) => ({
      diagram,
      entityId:
        parentIds.find((entityId) => viewSubjectMatches(diagram, entityId)) ??
        parentIds[0]!,
      kind: "parent" as const,
    }));

  return dedupeNavigationTargets([...childTargets, ...parentTargets]);
}

export function buildElementInfo(args: {
  architectureIndex?: ArchitectureIndex;
  diagrams: DiagramSpec[];
  element?: ArchitectureIndex["elements"][number];
  node: DiagramNode;
}): Arch4ElementInfo {
  const entityId = args.node.entityId ?? args.node.id;
  const viewsById = new Map(
    args.architectureIndex?.views.map((view) => [view.id, view]) ?? [],
  );
  const diagramById = new Map(
    args.diagrams.map((diagram) => [diagram.id, diagram]),
  );
  const entityNameById = buildEntityNameMap(
    args.architectureIndex,
    args.diagrams,
  );
  const viewIds = uniqueStrings([
    ...(args.element?.views ?? []),
    ...args.diagrams
      .filter((diagram) =>
        diagram.nodes.some((node) => (node.entityId ?? node.id) === entityId),
      )
      .map((diagram) => diagram.id),
  ]);
  const relationships = (args.architectureIndex?.relationships ?? [])
    .filter(
      (relationship) =>
        relationship.sourceEntityId === entityId ||
        relationship.targetEntityId === entityId,
    )
    .map((relationship) => {
      const direction: "inbound" | "outbound" =
        relationship.targetEntityId === entityId ? "inbound" : "outbound";
      const counterpartEntityId =
        direction === "inbound"
          ? relationship.sourceEntityId
          : relationship.targetEntityId;
      return {
        counterpartEntityId,
        counterpartName: entityLabel(
          relationship.targetEntityId === entityId
            ? relationship.sourceEntityId
            : relationship.targetEntityId,
          entityNameById,
        ),
        direction,
        id: relationship.id,
        label: relationship.label,
        sourceEntityId: relationship.sourceEntityId,
        sourceName: entityLabel(relationship.sourceEntityId, entityNameById),
        targetEntityId: relationship.targetEntityId,
        targetName: entityLabel(relationship.targetEntityId, entityNameById),
        technology: relationship.technology,
        views: relationship.views,
      };
    });

  return {
    confidence: args.element?.confidence,
    contextPath: args.element?.contextPath,
    contributors: args.element?.contributors ?? [],
    description: args.element?.description ?? args.node.description,
    entityId,
    name: args.element?.name ?? args.node.name,
    notes: args.element?.notes,
    openQuestions: args.element?.openQuestions ?? [],
    owners: args.element?.owners ?? [],
    parent: args.node.parentEntityId ?? args.node.parentId,
    paths: args.element?.paths ?? [],
    recentCommits: args.element?.recentCommits ?? [],
    relationships,
    tags: uniqueStrings([
      ...(args.element?.tags ?? []),
      ...(args.node.tags ?? []),
    ]),
    technology: args.node.technology,
    type: args.element?.type ?? args.node.type,
    views: viewIds.map((id) => {
      const view = viewsById.get(id);
      const diagram = diagramById.get(id);
      return {
        id,
        name: view?.name ?? diagram?.name ?? id,
        type: view?.type ?? diagram?.type ?? "view",
      };
    }),
  };
}

export function findNodeForEntity(
  diagram: DiagramSpec,
  entityId: string,
): DiagramNode | undefined {
  return diagram.nodes.find(
    (node) => (node.entityId ?? node.id) === entityId || node.id === entityId,
  );
}

export function buildEntityParentMap(
  diagrams: DiagramSpec[],
): Map<string, string> {
  const mapped = new Map<string, string>();
  diagrams.forEach((diagram) => {
    const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
    diagram.nodes.forEach((node) => {
      const entityId = node.entityId ?? node.id;
      if (node.parentEntityId) mapped.set(entityId, node.parentEntityId);
    });
    (diagram.boundaries ?? []).forEach((boundary) => {
      if (!boundary.entityId) return;
      boundary.children.forEach((nodeId) => {
        const child = nodeById.get(nodeId);
        if (child) mapped.set(child.entityId ?? child.id, boundary.entityId!);
      });
    });
  });
  return mapped;
}

export function relatedTargetLabel(
  target: Arch4RelatedNavigationTarget,
): string {
  return target.kind === "child" ? "Open child view" : "Open parent view";
}

function buildEntityNameMap(
  architectureIndex: ArchitectureIndex | undefined,
  diagrams: DiagramSpec[],
): Map<string, string> {
  const names = new Map<string, string>();
  diagrams.forEach((diagram) => {
    diagram.nodes.forEach((node) => {
      const entityId = node.entityId ?? node.id;
      if (!names.has(entityId)) names.set(entityId, node.name);
    });
    (diagram.boundaries ?? []).forEach((boundary) => {
      if (boundary.entityId && !names.has(boundary.entityId))
        names.set(boundary.entityId, boundary.label);
    });
  });
  architectureIndex?.elements.forEach((element) =>
    names.set(element.entityId, element.name),
  );
  return names;
}

function entityLabel(
  entityId: string | undefined,
  entityNameById: Map<string, string>,
): string {
  if (!entityId) return "Unknown entity";
  return entityNameById.get(entityId) ?? entityId;
}

function dedupeNavigationTargets(
  targets: Arch4RelatedNavigationTarget[],
): Arch4RelatedNavigationTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.kind}:${target.diagram.id}:${target.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function viewSubjectMatches(diagram: DiagramSpec, entityId: string): boolean {
  return diagram.subjectEntityId === entityId || diagram.subjectId === entityId;
}

function diagramViewRank(type?: string | null): number {
  if (type === "system_context") return 1;
  if (type === "container") return 2;
  if (type === "component") return 3;
  if (type === "dynamic") return 4;
  if (type === "deployment") return 4;
  return 0;
}

export function uniqueStrings(
  values: Array<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}
