import {
  type DiagramBoundary,
  type DiagramEdge,
  type DiagramNode,
  type DiagramSpec,
  type Diagnostic,
  safeId,
} from "@arch4/core";
import { boundaryPadding, expandLayoutRect, unionLayouts } from "@arch4/layout";
import type {
  ElementModel,
  NormalizedWorkspace,
  RelationshipModel,
} from "./types.js";

export function normalizeStructurizrWorkspace(
  workspaceJson: Record<string, unknown>,
): NormalizedWorkspace {
  const diagnostics: Diagnostic[] = [];
  const elements = new Map<string, ElementModel>();
  const relationships: RelationshipModel[] = [];
  const model = asRecord(workspaceJson.model);

  for (const person of asArray(model.people)) {
    addElement(elements, person, "person");
  }
  for (const system of asArray(model.softwareSystems)) {
    const systemId = addElement(elements, system, "softwareSystem");
    for (const container of asArray(asRecord(system).containers)) {
      const containerId = addElement(
        elements,
        container,
        inferContainerType(container),
        systemId,
      );
      for (const component of asArray(asRecord(container).components)) {
        addElement(elements, component, "component", containerId);
      }
    }
  }
  addDeploymentElements(elements, model);

  for (const payload of relationshipPayloadOwners(model)) {
    for (const relationship of asArray(asRecord(payload).relationships)) {
      const rel = relationshipFromPayload(relationship);
      if (
        rel.source &&
        rel.target &&
        !relationships.some((item) => item.id === rel.id)
      ) {
        relationships.push(rel);
      }
    }
  }

  const views = asRecord(workspaceJson.views);
  const specs: DiagramSpec[] = [
    ...asArray(views.systemContextViews).map((view) =>
      buildSpec(view, "system_context", elements, relationships),
    ),
    ...asArray(views.containerViews).map((view) =>
      buildSpec(view, "container", elements, relationships),
    ),
    ...asArray(views.componentViews).map((view) =>
      buildSpec(view, "component", elements, relationships),
    ),
    ...asArray(views.deploymentViews).map((view) =>
      buildSpec(view, "deployment", elements, relationships),
    ),
    ...asArray(views.dynamicViews).map((view) =>
      buildDynamicSpec(view, elements, relationships),
    ),
  ];

  if (!specs.length) {
    diagnostics.push({
      level: "warning",
      code: "arch4.views.empty",
      message: "Structurizr workspace did not define renderable views.",
    });
  }
  diagnostics.push(...qualityDiagnostics(specs, elements, relationships));

  return { elements, relationships, specs, diagnostics };
}

function qualityDiagnostics(
  specs: DiagramSpec[],
  elements: Map<string, ElementModel>,
  relationships: RelationshipModel[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  specs
    .filter(
      (spec) =>
        spec.type === "component" &&
        spec.nodes.length > 1 &&
        spec.edges.length === 0,
    )
    .forEach((spec) => {
      diagnostics.push({
        level: "warning",
        code: "arch4.view.component.relationships.empty",
        message: `Component view ${spec.id} has ${spec.nodes.length} nodes and no relationships. Add evidenced component relationships or skip the view.`,
      });
    });

  relationships
    .filter(
      (relationship) =>
        relationship.label && weakRelationshipLabel(relationship.label),
    )
    .forEach((relationship) => {
      const source =
        elements.get(relationship.source)?.name ?? relationship.source;
      const target =
        elements.get(relationship.target)?.name ?? relationship.target;
      diagnostics.push({
        level: "warning",
        code: "arch4.relationship.label.weak",
        message: `Relationship ${relationship.id} label "${relationship.label}" may not read as a complete sentence: ${source} ${relationship.label} ${target}. Include needed context or prepositions.`,
      });
    });

  return diagnostics;
}

function weakRelationshipLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return true;
  return !words.some((word) => RELATIONSHIP_CONNECTIVES.has(word));
}

const RELATIONSHIP_CONNECTIVES = new Set([
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "inside",
  "into",
  "of",
  "on",
  "through",
  "to",
  "via",
  "with",
]);

function buildSpec(
  viewPayload: unknown,
  type: string,
  elements: Map<string, ElementModel>,
  relationships: RelationshipModel[],
): DiagramSpec {
  const view = asRecord(viewPayload);
  const viewElements = asArray(view.elements);
  const viewRelationships = asArray(view.relationships);
  const subjectId = optionalString(
    view.softwareSystemId ?? view.containerId ?? view.elementId,
  );
  const restrictedEntityIds = restrictedViewEntityIds(view);
  const nodeIds = new Set(
    viewElements
      .map((item) => optionalString(asRecord(item).id))
      .filter(isString),
  );
  const nodes = [...nodeIds]
    .map((id) => nodeFromElement(elements.get(id)))
    .filter(isDefined)
    .filter(
      (node) =>
        !restrictedEntityIds.length ||
        restrictedEntityIds.includes(node.entityId ?? node.id),
    );
  const nodeSet = new Set(nodes.map((node) => node.id));
  const viewRelationshipIds = new Set(
    viewRelationships
      .map((item) => optionalString(asRecord(item).id))
      .filter(isString),
  );
  const edges = relationships
    .filter(
      (relationship) =>
        nodeSet.has(relationship.source) && nodeSet.has(relationship.target),
    )
    .filter(
      (relationship) =>
        !viewRelationshipIds.size || viewRelationshipIds.has(relationship.id),
    )
    .map((relationship) => edgeFromRelationship(relationship));
  const boundaries = boundariesForNodes(nodes, elements, type, subjectId);
  const boundaryElementIds = new Set(
    boundaries
      .filter(
        (boundary) => boundary.type === "deploymentNode" && boundary.elementId,
      )
      .map((boundary) => boundary.elementId),
  );
  const visibleNodes = nodes.filter((node) => !boundaryElementIds.has(node.id));
  const visibleNodeSet = new Set(visibleNodes.map((node) => node.id));
  return {
    id: safeId(String(view.key ?? view.name ?? type), "view"),
    name: viewName(view, type),
    type,
    subjectId,
    subjectEntityId: subjectId
      ? (elements.get(subjectId)?.entityId ?? null)
      : null,
    direction: layoutDirection(view),
    nodes: visibleNodes,
    edges: edges.filter(
      (edge) =>
        visibleNodeSet.has(edge.source) && visibleNodeSet.has(edge.target),
    ),
    boundaries,
    legend: legendFor(visibleNodes),
  };
}

function buildDynamicSpec(
  viewPayload: unknown,
  elements: Map<string, ElementModel>,
  relationships: RelationshipModel[],
): DiagramSpec {
  const view = asRecord(viewPayload);
  const spec = buildSpec(viewPayload, "dynamic", elements, relationships);
  const dynamicEdges = asArray(view.relationships)
    .map((payload, index) => {
      const raw = asRecord(payload);
      const rel = relationships.find(
        (item) => item.id === optionalString(raw.id),
      );
      const source = optionalString(raw.sourceId) ?? rel?.source;
      const target = optionalString(raw.destinationId) ?? rel?.target;
      if (!source || !target) return undefined;
      return {
        id: optionalString(raw.id) ?? `dynamic-${index + 1}`,
        source,
        target,
        label: optionalString(raw.description) ?? rel?.label,
        technology: optionalString(raw.technology) ?? rel?.technology,
        order: Number(raw.order ?? index + 1),
        dynamic: true,
      } satisfies DiagramEdge;
    })
    .filter(isDefined);
  const ids = new Set<string>();
  dynamicEdges.forEach((edge) => {
    ids.add(edge.source);
    ids.add(edge.target);
  });
  spec.nodes = [...ids]
    .map((id) => nodeFromElement(elements.get(id)))
    .filter(isDefined);
  spec.edges = dynamicEdges.filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
  spec.boundaries = boundariesForNodes(
    spec.nodes,
    elements,
    "dynamic",
    spec.subjectId ?? undefined,
  );
  spec.legend = legendFor(spec.nodes);
  return spec;
}

function addElement(
  elements: Map<string, ElementModel>,
  payload: unknown,
  type: string,
  parentId?: string,
): string {
  const item = asRecord(payload);
  const id = String(item.id ?? item.canonicalName ?? item.name);
  const parent = parentId ? elements.get(parentId) : undefined;
  const entityId = entityIdFor(item, id);
  elements.set(id, {
    id,
    entityId,
    name: String(item.name ?? id),
    type,
    description: optionalString(item.description),
    technology: optionalString(item.technology),
    tags: splitTags(item.tags),
    parentId: parentId ?? null,
    parentEntityId: parent?.entityId ?? null,
    group: groupFor(item),
  });
  return id;
}

function addDeploymentElements(
  elements: Map<string, ElementModel>,
  model: Record<string, unknown>,
): void {
  const topLevel = asArray(model.deploymentNodes);
  const environments = asArray(model.deploymentEnvironments).flatMap((env) =>
    asArray(asRecord(env).deploymentNodes),
  );
  [...topLevel, ...environments].forEach((node) =>
    addDeploymentNode(elements, node, undefined),
  );
}

function addDeploymentNode(
  elements: Map<string, ElementModel>,
  payload: unknown,
  parentId?: string,
): void {
  const id = addElement(elements, payload, "deploymentNode", parentId);
  const node = asRecord(payload);
  for (const infra of asArray(node.infrastructureNodes)) {
    addElement(elements, infra, "infrastructureNode", id);
  }
  for (const instance of asArray(node.containerInstances)) {
    const raw = asRecord(instance);
    const sourceId = optionalString(raw.containerId ?? raw.elementId);
    const source = sourceId ? elements.get(sourceId) : undefined;
    const instanceId = addElement(
      elements,
      {
        ...raw,
        name: raw.name ?? source?.name ?? "Container Instance",
        description: raw.description ?? source?.description,
        technology: raw.technology ?? source?.technology,
      },
      "containerInstance",
      id,
    );
    const current = elements.get(instanceId);
    if (current) {
      current.instanceOfId = sourceId ?? null;
      current.deploymentNodeId = id;
    }
  }
  for (const child of asArray(node.deploymentNodes ?? node.children)) {
    addDeploymentNode(elements, child, id);
  }
}

function relationshipFromPayload(payload: unknown): RelationshipModel {
  const item = asRecord(payload);
  return {
    id: String(
      item.id ??
        `${item.sourceId}-${item.destinationId}-${item.description ?? ""}`,
    ),
    source: String(item.sourceId ?? ""),
    target: String(item.destinationId ?? ""),
    label: optionalString(item.description),
    technology: optionalString(item.technology),
    tags: splitTags(item.tags),
  };
}

function nodeFromElement(
  element: ElementModel | undefined,
  layout?: DiagramNode["layout"],
): DiagramNode | undefined {
  if (!element) return undefined;
  return {
    id: element.id,
    entityId: element.entityId,
    type: element.type,
    name: element.name,
    description: element.description,
    technology: element.technology,
    parentId: element.parentId,
    parentEntityId: element.parentEntityId,
    instanceOfId: element.instanceOfId,
    environment: element.environment,
    deploymentNodeId: element.deploymentNodeId,
    group: element.group,
    tags: element.tags,
    layout,
  };
}

function edgeFromRelationship(relationship: RelationshipModel): DiagramEdge {
  return {
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    label: relationship.label,
    technology: relationship.technology,
    tags: relationship.tags,
  };
}

function boundariesForNodes(
  nodes: DiagramNode[],
  elements: Map<string, ElementModel>,
  viewType: string,
  subjectId?: string,
): DiagramBoundary[] {
  if (viewType === "deployment") {
    return nodes
      .filter((node) => node.type === "deploymentNode")
      .map((node) => {
        const children = deploymentBoundaryChildren(node.id, nodes);
        return {
          id: `deployment-node-${safeId(node.id)}`,
          type: "deploymentNode",
          label: node.name,
          elementId: node.id,
          entityId: node.entityId,
          children,
          layout: boundaryLayout(children, nodes, "deploymentNode"),
        };
      })
      .filter((boundary) => boundary.children.length > 0);
  }

  if (viewType === "component" && subjectId) {
    const subject = elements.get(subjectId);
    const children = nodes
      .filter((node) => node.parentId === subjectId)
      .map((node) => node.id)
      .sort();
    return subject && children.length
      ? [
          {
            id: `container-boundary-${safeId(subjectId)}`,
            type: "container",
            label: subject.name,
            elementId: subject.id,
            entityId: subject.entityId,
            children,
            layout: boundaryLayout(children, nodes, "container"),
          },
        ]
      : [];
  }

  if (viewType === "dynamic") {
    return dynamicBoundariesForNodes(nodes, elements);
  }

  const groupBoundaries = groupBoundariesForNodes(nodes);
  const childrenByParent = new Map<string, string[]>();
  nodes.forEach((node) => {
    if (!node.parentId) return;
    if (
      viewType === "container" &&
      elements.get(node.parentId)?.type !== "softwareSystem"
    ) {
      return;
    }
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  });
  const parentBoundaries = [...childrenByParent.entries()].map(
    ([parentId, children]) => {
      const parent = elements.get(parentId);
      return {
        id: `${parent?.type === "softwareSystem" ? "system-boundary" : "boundary"}-${safeId(parentId)}`,
        type: parent?.type ?? "group",
        label: parent?.name ?? parentId,
        elementId: parentId,
        entityId: parent?.entityId,
        children: children.sort(),
        layout: boundaryLayout(children, nodes, parent?.type ?? "group"),
      };
    },
  );
  return [...parentBoundaries, ...groupBoundaries];
}

function dynamicBoundariesForNodes(
  nodes: DiagramNode[],
  elements: Map<string, ElementModel>,
): DiagramBoundary[] {
  const groupBoundaries = groupBoundariesForNodes(nodes);
  const childrenBySystem = new Map<string, string[]>();
  const childrenByContainer = new Map<string, string[]>();

  nodes.forEach((node) => {
    const systemId = nearestAncestorOfType(node.id, "softwareSystem", elements);
    if (systemId) {
      const children = childrenBySystem.get(systemId) ?? [];
      children.push(node.id);
      childrenBySystem.set(systemId, children);
    }

    if (node.parentId && elements.get(node.parentId)?.type === "container") {
      const children = childrenByContainer.get(node.parentId) ?? [];
      children.push(node.id);
      childrenByContainer.set(node.parentId, children);
    }
  });

  const systemBoundaries = [...childrenBySystem.entries()].map(
    ([systemId, children]) =>
      boundaryForParent(systemId, children, elements, nodes),
  );
  const containerBoundaries = [...childrenByContainer.entries()].map(
    ([containerId, children]) =>
      boundaryForParent(containerId, children, elements, nodes),
  );
  return [...systemBoundaries, ...containerBoundaries, ...groupBoundaries];
}

function nearestAncestorOfType(
  elementId: string,
  type: string,
  elements: Map<string, ElementModel>,
): string | undefined {
  let current = elements.get(elementId)?.parentId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const element = elements.get(current);
    if (!element) return undefined;
    if (element.type === type) return element.id;
    current = element.parentId ?? undefined;
  }
  return undefined;
}

function boundaryForParent(
  parentId: string,
  children: string[],
  elements: Map<string, ElementModel>,
  nodes: DiagramNode[],
): DiagramBoundary {
  const parent = elements.get(parentId);
  const sortedChildren = children.sort();
  return {
    id: `${parent?.type === "softwareSystem" ? "system-boundary" : "boundary"}-${safeId(parentId)}`,
    type: parent?.type ?? "group",
    label: parent?.name ?? parentId,
    elementId: parentId,
    entityId: parent?.entityId,
    children: sortedChildren,
    layout: boundaryLayout(sortedChildren, nodes, parent?.type ?? "group"),
  };
}

function groupBoundariesForNodes(nodes: DiagramNode[]): DiagramBoundary[] {
  const childrenByGroup = new Map<
    string,
    { group: string; parentId: string | null; children: string[] }
  >();
  nodes.forEach((node) => {
    if (!node.group) return;
    const parentId = node.parentId ?? null;
    const key = `${parentId ?? "root"}:${node.group}`;
    const entry = childrenByGroup.get(key) ?? {
      group: node.group,
      parentId,
      children: [],
    };
    entry.children.push(node.id);
    childrenByGroup.set(key, entry);
  });

  return [...childrenByGroup.values()].map((entry) => {
    const parentScope = entry.parentId ? safeId(entry.parentId) : "root";
    const children = entry.children.sort();
    return {
      id: `group-boundary-${parentScope}-${safeId(entry.group)}`,
      type: "group",
      label: entry.group,
      children,
      layout: boundaryLayout(children, nodes, "group"),
    };
  });
}

function boundaryLayout(
  children: string[],
  nodes: DiagramNode[],
  boundaryType: string,
): DiagramBoundary["layout"] | undefined {
  const childLayouts = children
    .map((childId) => nodes.find((node) => node.id === childId)?.layout)
    .filter(isDefined);

  const rect = unionLayouts(childLayouts);
  return rect
    ? expandLayoutRect(rect, boundaryPadding(boundaryType))
    : undefined;
}

function legendFor(nodes: DiagramNode[]): DiagramSpec["legend"] {
  return [...new Set(nodes.map((node) => node.type))].sort().map((type) => ({
    id: type,
    kind: "element",
    label: titleForType(type),
  }));
}

function relationshipPayloadOwners(model: Record<string, unknown>): unknown[] {
  const payloads: unknown[] = [];
  asArray(model.people).forEach((person) => payloads.push(person));
  asArray(model.softwareSystems).forEach((system) => {
    payloads.push(system);
    asArray(asRecord(system).containers).forEach((container) => {
      payloads.push(container);
      asArray(asRecord(container).components).forEach((component) =>
        payloads.push(component),
      );
    });
  });
  for (const node of deploymentNodes(model)) {
    payloads.push(...deploymentRelationshipOwners(node));
  }
  return payloads;
}

function deploymentNodes(model: Record<string, unknown>): unknown[] {
  return [
    ...asArray(model.deploymentNodes),
    ...asArray(model.deploymentEnvironments).flatMap((env) =>
      asArray(asRecord(env).deploymentNodes),
    ),
  ];
}

function deploymentRelationshipOwners(payload: unknown): unknown[] {
  const node = asRecord(payload);
  return [
    payload,
    ...asArray(node.infrastructureNodes),
    ...asArray(node.softwareSystemInstances),
    ...asArray(node.containerInstances),
    ...asArray(node.deploymentNodes ?? node.children).flatMap((child) =>
      deploymentRelationshipOwners(child),
    ),
  ];
}

function layoutDirection(
  view: Record<string, unknown>,
): DiagramSpec["direction"] {
  const rawLayout = view.automaticLayout ?? view.autoLayout ?? "";
  const layout =
    typeof rawLayout === "object" && rawLayout !== null
      ? String(asRecord(rawLayout).rankDirection ?? "")
      : String(rawLayout);
  const normalized = layout.toLowerCase();
  if (
    normalized.includes("tb") ||
    normalized.includes("topbottom") ||
    normalized.includes("down")
  ) {
    return "DOWN";
  }
  if (
    normalized.includes("bt") ||
    normalized.includes("bottomtop") ||
    normalized.includes("up")
  ) {
    return "UP";
  }
  if (normalized.includes("rl") || normalized.includes("rightleft")) {
    return "LEFT";
  }
  return "RIGHT";
}

function viewName(view: Record<string, unknown>, type: string): string {
  const key = String(view.key ?? type);
  const name = optionalString(view.name);
  const generatedPrefixes: Record<string, string> = {
    system_context: "System Context View:",
    container: "Container View:",
    component: "Component View:",
    deployment: "Deployment View:",
    dynamic: "Dynamic View:",
  };
  if (!name) return key;
  const prefix = generatedPrefixes[type];
  return prefix && name.startsWith(prefix) ? key : name;
}

function restrictedViewEntityIds(view: Record<string, unknown>): string[] {
  const properties = asRecord(view.properties);
  const value = properties["arch4.view.entityIds"];
  return value
    ? String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function deploymentBoundaryChildren(
  parentId: string,
  nodes: DiagramNode[],
): string[] {
  const direct = nodes
    .filter(
      (node) => node.parentId === parentId && node.type !== "deploymentNode",
    )
    .map((node) => node.id);
  const nested = nodes
    .filter(
      (node) => node.parentId === parentId && node.type === "deploymentNode",
    )
    .flatMap((node) => deploymentBoundaryChildren(node.id, nodes));
  return [...direct, ...nested].sort();
}

function entityIdFor(item: Record<string, unknown>, fallback: string): string {
  const properties = asRecord(item.properties);
  return String(
    properties["structurizr.dsl.identifier"] ??
      properties["arch4.entityId"] ??
      fallback,
  );
}

function groupFor(item: Record<string, unknown>): string | undefined {
  const properties = asRecord(item.properties);
  return (
    optionalString(item.group) ??
    optionalString(properties["structurizr.group"]) ??
    optionalString(properties["arch4.group"])
  );
}

function inferContainerType(payload: unknown): string {
  const item = asRecord(payload);
  const tags = splitTags(item.tags).join(" ").toLowerCase();
  const technology = String(item.technology ?? "").toLowerCase();
  return tags.includes("database") || technology.includes("database")
    ? "database"
    : "container";
}

function splitTags(value: unknown): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null || value === ""
    ? undefined
    : String(value);
}

function titleForType(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
