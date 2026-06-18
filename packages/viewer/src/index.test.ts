import { readFileSync } from "node:fs";
import { Position, type EdgeProps } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { ArchitectureIndex, DiagramSpec } from "@arch4/core";
import { routedPath } from "./edge-routing.js";
import {
  buildElementInfo,
  createDiagramTreeItems,
  findNodeForEntity,
  resolveCurrentViewRelationships,
  resolveEdgeRouting,
  resolveIndexedRelationshipsOutsideCurrentView,
  resolveRelatedNavigationTargets,
} from "./index.js";
import { buildFlowEdges, rebuildBoundaryFlowNodes, toFlow } from "./flow.js";
import { buildArch4TreeItems } from "./tree.js";

describe("viewer navigation helpers", () => {
  it("builds generic tree nodes from item paths and search filters", () => {
    const nodes = buildArch4TreeItems(
      [
        { id: "overview", label: "Overview", path: ["Docs", "Overview"] },
        {
          id: "risk-report",
          label: "Risk",
          path: ["Reports", "Risk"],
          subtitle: "Report",
        },
      ],
      "risk",
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.label).toBe("Reports");
    expect(nodes[0]?.children[0]?.item?.id).toBe("risk-report");
  });

  it("creates diagram tree items with Arch4 labels and C4 grouping", () => {
    const items = createDiagramTreeItems([
      {
        edges: [],
        id: "travelbookingcontainers",
        name: "TravelBookingContainers",
        nodes: [],
        type: "container",
      },
      {
        edges: [],
        id: "booktripflow",
        name: "BookTripFlow",
        nodes: [],
        type: "dynamic",
      },
    ]);

    expect(items.map((item) => [item.id, item.label, item.path?.[0]])).toEqual([
      ["travelbookingcontainers", "TravelBooking", "Container"],
      ["booktripflow", "BookTrip", "Dynamic"],
    ]);
  });

  it.each([
    [Position.Right, Position.Left, "M 100,100 C 228,100 372,100 500,100"],
    [Position.Bottom, Position.Top, "M 100,100 C 100,228 100,372 100,500"],
    [Position.Top, Position.Bottom, "M 100,500 C 100,372 100,228 100,100"],
  ] as const)(
    "routes curved edges from %s to %s using handle direction",
    (sourcePosition, targetPosition, expectedPath) => {
      const vertical =
        sourcePosition === Position.Bottom || sourcePosition === Position.Top;
      const [path] = routedPath(
        {
          sourceX: 100,
          sourceY: vertical && sourcePosition === Position.Top ? 500 : 100,
          sourcePosition,
          targetX: vertical ? 100 : 500,
          targetY: vertical
            ? sourcePosition === Position.Top
              ? 100
              : 500
            : 100,
          targetPosition,
        } as EdgeProps,
        [],
        "Curved",
      );

      expect(path).toBe(expectedPath);
    },
  );

  it("chooses edge handle sides from current node geometry", () => {
    const diagram = sideSwitchDiagram();
    const flow = toFlow(diagram, new Map(), true, {
      diagrams: [],
      entityParentById: new Map(),
      onNavigate: () => {},
      onSelect: () => {},
    });

    expect(flow.edges[0]?.sourceHandle).toBe("right-b-source");
    expect(flow.edges[0]?.targetHandle).toBe("left-b-target");

    const moved = flow.nodes.map((node) =>
      node.id === "target" ? { ...node, position: { x: 100, y: 420 } } : node,
    );
    const rebuiltEdges = buildFlowEdges(diagram, moved, true);

    expect(rebuiltEdges[0]?.sourceHandle).toBe("bottom-b-source");
    expect(rebuiltEdges[0]?.targetHandle).toBe("top-b-target");
  });

  it("exposes the viewer layout settings control and callback wiring", () => {
    const source = readFileSync(
      new URL("./index.tsx", import.meta.url),
      "utf8",
    );
    const styles = readFileSync(
      new URL("./styles.css", import.meta.url),
      "utf8",
    );

    expect(source).toContain('aria-label="Layout settings"');
    expect(source).toContain('className="arch4-layout-reset"');
    expect(source).toContain("onLayoutDirectionChange");
    expect(source).toContain("onNodePositionChange");
    expect(source).toContain("onManualLayoutReset");
    expect(source).toContain("layoutDiagramSpec");
    expect(source).toContain("const refocusMap = useCallback");
    expect(source).toContain("const setSidebarOpen = useCallback");
    expect(source).toContain("shouldFocusMapAfterLayoutRef");
    expect(source).toContain("ref={canvasRef} tabIndex={-1}");
    expect(source).toContain("setSidebarOpen(false)");
    expect(styles).toContain(".arch4-layout-menu .arch4-layout-reset");
    expect(styles).toContain("grid-column: 1 / -1;");
    expect(styles).toContain("--arch4-control-right-inset");
    expect(styles).toContain("left: var(--arch4-control-inset)");
    expect(styles).toContain("right: var(--arch4-control-right-inset)");
  });

  it("guards fitView so payload refreshes do not refit the unchanged signal", () => {
    const source = readFileSync(
      new URL("./index.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("completedFitViewSignalRef");
    expect(source).toContain(
      "completedFitViewSignalRef.current === props.signal",
    );
    expect(source).toContain(
      "completedFitViewSignalRef.current = props.signal",
    );
    expect(source).toContain("FIT_VIEW_MAX_ATTEMPTS");
    expect(source).toContain("FIT_VIEW_PADDING");
    expect(source).toContain("fitViewNodesForExpectedDiagram");
    expect(source).toContain(
      "elementNodes.length < expectedElementNodeIds.size",
    );
    expect(source).toContain('data?.kind === "boundary"');
    expect(source).toContain('data?.kind !== "element"');
  });

  it("spreads multiple edges across stable source and target handle slots", () => {
    const flow = toFlow(multiEdgeDiagram(), new Map(), true, {
      diagrams: [],
      entityParentById: new Map(),
      onNavigate: () => {},
      onSelect: () => {},
    });
    const incoming = flow.edges
      .filter((edge) => edge.target === "core")
      .sort((a, b) => a.id.localeCompare(b.id));

    expect(incoming.map((edge) => edge.targetHandle)).toEqual([
      "left-a-target",
      "left-b-target",
      "left-c-target",
    ]);
  });

  it("marks element nodes draggable and keeps boundary nodes fixed", () => {
    const diagrams = sampleDiagrams();
    const diagram = boundedDiagram();
    const flow = toFlow(diagram, new Map(), true, {
      diagrams,
      entityParentById: new Map(),
      onNavigate: () => {},
      onSelect: () => {},
    });

    const element = flow.nodes.find((node) => node.id === "api-node");
    const boundary = flow.nodes.find((node) => node.id === "system-boundary");

    expect(element?.draggable).toBe(true);
    expect(boundary?.draggable).toBe(false);
  });

  it("rebuilds boundary nodes from moved element positions", () => {
    const diagrams = sampleDiagrams();
    const diagram = boundedDiagram();
    const flow = toFlow(diagram, new Map(), true, {
      diagrams,
      entityParentById: new Map(),
      onNavigate: () => {},
      onSelect: () => {},
    });
    const moved = flow.nodes.map((node) =>
      node.id === "api-node" ? { ...node, position: { x: 900, y: 480 } } : node,
    );
    const rebuilt = rebuildBoundaryFlowNodes(
      diagram,
      moved,
      new Set(["api-node"]),
    );
    const boundary = rebuilt.find((node) => node.id === "system-boundary")!;

    expect(boundary.position.x).toBeLessThanOrEqual(900);
    expect(boundary.position.y).toBeLessThanOrEqual(480);
    expect(Number(boundary.style?.width)).toBeGreaterThan(0);
    expect(Number(boundary.style?.height)).toBeGreaterThan(0);
  });

  it("does not move an unrelated boundary while rebuilding moved element positions", () => {
    const diagram = multiBoundaryDiagram();
    const flow = toFlow(diagram, new Map(), true, {
      diagrams: [diagram],
      entityParentById: new Map(),
      onNavigate: () => {},
      onSelect: () => {},
    });
    const before = flow.nodes.find((node) => node.id === "right-boundary")!;
    const moved = flow.nodes.map((node) =>
      node.id === "left-api" ? { ...node, position: { x: 900, y: 480 } } : node,
    );
    const rebuilt = rebuildBoundaryFlowNodes(
      diagram,
      moved,
      new Set(["left-api"]),
    );
    const after = rebuilt.find((node) => node.id === "right-boundary")!;

    expect(after.position).toEqual(before.position);
    expect(after.style).toEqual(before.style);
  });

  it("resolves child and parent diagram targets with stable labels", () => {
    const diagrams = sampleDiagrams();
    const parentById = new Map([
      ["api", "system"],
      ["web", "system"],
      ["router", "api"],
    ]);

    const contextTargets = resolveRelatedNavigationTargets({
      activeDiagram: diagrams[0]!,
      diagrams,
      entityParentById: parentById,
      node: diagrams[0]!.nodes.find((node) => node.entityId === "system")!,
    });
    expect(
      contextTargets.map((target) => [
        target.kind,
        target.diagram.id,
        target.entityId,
      ]),
    ).toEqual([["child", "container", "system"]]);

    const containerTargets = resolveRelatedNavigationTargets({
      activeDiagram: diagrams[1]!,
      diagrams,
      entityParentById: parentById,
      node: diagrams[1]!.nodes.find((node) => node.entityId === "api")!,
    });
    expect(
      containerTargets.map((target) => [
        target.kind,
        target.diagram.id,
        target.entityId,
      ]),
    ).toEqual([
      ["child", "component", "api"],
      ["parent", "context", "system"],
    ]);
  });

  it("dedupes multiple matching related diagram targets", () => {
    const diagrams = sampleDiagrams();
    const duplicateContainer = { ...diagrams[1]!, name: "Container Duplicate" };

    const targets = resolveRelatedNavigationTargets({
      activeDiagram: diagrams[0]!,
      diagrams: [diagrams[0]!, diagrams[1]!, duplicateContainer],
      entityParentById: new Map(),
      node: diagrams[0]!.nodes[1]!,
    });

    expect(targets.map((target) => target.diagram.id)).toEqual(["container"]);
  });

  it("treats subject views as related navigation targets even when the subject is not a visible node", () => {
    const diagrams: DiagramSpec[] = [
      {
        id: "TravelBookingSystemContext",
        name: "Travel Booking System Context",
        type: "system_context",
        subjectEntityId: "travel",
        nodes: [
          {
            id: "travel-node",
            entityId: "travel",
            type: "softwareSystem",
            name: "Travel Booking Platform",
          },
        ],
        edges: [],
      },
      {
        id: "TravelBookingContainers",
        name: "Travel Booking Containers",
        type: "container",
        subjectEntityId: "travel",
        nodes: [
          {
            id: "booking-api",
            entityId: "bookingApi",
            parentEntityId: "travel",
            type: "container",
            name: "Booking API",
          },
        ],
        edges: [],
      },
      {
        id: "BookTripFlow",
        name: "Book Trip Flow",
        type: "dynamic",
        subjectEntityId: "travel",
        nodes: [
          {
            id: "booking-api",
            entityId: "bookingApi",
            parentEntityId: "travel",
            type: "container",
            name: "Booking API",
          },
        ],
        edges: [],
      },
      {
        id: "ChangeOrCancelBookingFlow",
        name: "Change Or Cancel Booking Flow",
        type: "dynamic",
        subjectEntityId: "travel",
        nodes: [
          {
            id: "booking-api",
            entityId: "bookingApi",
            parentEntityId: "travel",
            type: "container",
            name: "Booking API",
          },
        ],
        edges: [],
      },
    ];

    const targets = resolveRelatedNavigationTargets({
      activeDiagram: diagrams[0]!,
      diagrams,
      entityParentById: new Map(),
      node: diagrams[0]!.nodes[0]!,
    });

    expect(
      targets.map((target) => [
        target.kind,
        target.diagram.id,
        target.entityId,
      ]),
    ).toEqual([
      ["child", "TravelBookingContainers", "travel"],
      ["child", "BookTripFlow", "travel"],
      ["child", "ChangeOrCancelBookingFlow", "travel"],
    ]);
  });

  it("finds a matching node after navigation by entity id or node id", () => {
    const diagram = sampleDiagrams()[1]!;

    expect(findNodeForEntity(diagram, "api")?.id).toBe("api-node");
    expect(findNodeForEntity(diagram, "web-node")?.entityId).toBe("web");
  });
});

describe("viewer edge routing", () => {
  it("uses curved routing by default", () => {
    expect(resolveEdgeRouting(undefined)).toBe("Curved");
    expect(resolveEdgeRouting("Curved")).toBe("Curved");
    expect(resolveEdgeRouting("Orthogonal")).toBe("Curved");
  });

  it("preserves explicitly direct edges", () => {
    expect(resolveEdgeRouting("Direct")).toBe("Direct");
  });
});

describe("viewer info helpers", () => {
  it("resolves current-view relationships with counterpart node labels", () => {
    const diagram = sampleDiagrams()[1]!;
    const node = diagram.nodes.find((item) => item.entityId === "api")!;

    expect(resolveCurrentViewRelationships(diagram, node)).toEqual([
      {
        counterpartName: "Web",
        counterpartNodeId: "web-node",
        direction: "inbound",
        id: "web-api",
        label: "Calls",
        sourceName: "Web",
        sourceNodeId: "web-node",
        targetName: "API",
        targetNodeId: "api-node",
        technology: undefined,
      },
      {
        counterpartName: "Database",
        counterpartNodeId: "db-node",
        direction: "outbound",
        id: "api-db",
        label: "Reads",
        sourceName: "API",
        sourceNodeId: "api-node",
        targetName: "Database",
        targetNodeId: "db-node",
        technology: "SQL",
      },
    ]);
  });

  it("returns no current-view relationships when the selected node has no visible edges", () => {
    const diagram = sampleDiagrams()[2]!;
    const node = diagram.nodes[0]!;

    expect(resolveCurrentViewRelationships(diagram, node)).toEqual([]);
  });

  it("excludes current-view relationships from indexed relationship summaries", () => {
    const diagrams = sampleDiagrams();
    const activeDiagram = diagrams[1]!;
    const relationships = [
      {
        counterpartEntityId: "web",
        counterpartName: "Web",
        direction: "inbound" as const,
        id: "web-api",
        label: "Calls",
        sourceEntityId: "web",
        sourceName: "Web",
        targetEntityId: "api",
        targetName: "API",
        views: ["container"],
      },
      {
        counterpartEntityId: "db",
        counterpartName: "Database",
        direction: "outbound" as const,
        id: "api-db",
        label: "Reads",
        sourceEntityId: "api",
        sourceName: "API",
        targetEntityId: "db",
        targetName: "Database",
        views: ["container", "component"],
      },
      {
        counterpartEntityId: "worker",
        counterpartName: "Worker",
        direction: "outbound" as const,
        id: "api-worker",
        label: "Queues work for",
        sourceEntityId: "api",
        sourceName: "API",
        targetEntityId: "worker",
        targetName: "Worker",
        views: ["component"],
      },
    ];

    expect(
      resolveIndexedRelationshipsOutsideCurrentView(
        activeDiagram,
        relationships,
      ).map((relationship) => relationship.id),
    ).toEqual(["api-worker"]);
  });

  it("composes element info from node data, index metadata, views, relationships, git data, and context files", () => {
    const diagrams = sampleDiagrams();
    const node = diagrams[1]!.nodes.find((item) => item.entityId === "api")!;
    const element: ArchitectureIndex["elements"][number] = {
      entityId: "api",
      name: "API",
      type: "container",
      description: "Handles requests.",
      tags: ["runtime"],
      paths: ["src/api/**"],
      owners: ["Platform"],
      confidence: "high",
      openQuestions: ["Split workers?"],
      notes: { tier: "critical" },
      views: ["container", "component"],
      contributors: [{ name: "Ada", email: "ada@example.com", commits: 4 }],
      recentCommits: [
        {
          hash: "abcdef123",
          author: "Ada",
          date: "2026-06-01",
          subject: "Refine API",
        },
      ],
      contextPath: ".arch4/architecture/build/context/api.md",
    };
    const architectureIndex: ArchitectureIndex = {
      schemaVersion: 1,
      generatedAt: "2026-06-01T00:00:00.000Z",
      projectRoot: "/repo",
      elements: [
        element,
        {
          entityId: "web",
          name: "Web",
          type: "container",
          paths: [],
          views: ["container"],
          contributors: [],
          recentCommits: [],
        },
        {
          entityId: "db",
          name: "Database",
          type: "database",
          paths: [],
          views: ["container"],
          contributors: [],
          recentCommits: [],
        },
      ],
      relationships: [
        {
          id: "web-api",
          sourceEntityId: "web",
          targetEntityId: "api",
          label: "Calls",
          views: ["container"],
        },
        {
          id: "api-db",
          sourceEntityId: "api",
          targetEntityId: "db",
          label: "Reads",
          technology: "SQL",
          views: ["container", "component"],
        },
      ],
      views: [
        {
          id: "container",
          name: "Containers",
          type: "container",
          dataPath: "container.json",
          subjectEntityId: "system",
        },
        {
          id: "component",
          name: "API Components",
          type: "component",
          dataPath: "component.json",
          subjectEntityId: "api",
        },
      ],
      diagnostics: [],
    };

    const info = buildElementInfo({
      architectureIndex,
      diagrams,
      element,
      node,
    });

    expect(info).toMatchObject({
      confidence: "high",
      contextPath: ".arch4/architecture/build/context/api.md",
      entityId: "api",
      name: "API",
      notes: { tier: "critical" },
      openQuestions: ["Split workers?"],
      owners: ["Platform"],
      paths: ["src/api/**"],
      tags: ["runtime"],
    });
    expect(info.views.map((view) => view.name)).toEqual([
      "Containers",
      "API Components",
    ]);
    expect(
      info.relationships.map((relationship) => [
        relationship.direction,
        relationship.sourceName,
        relationship.label,
        relationship.targetName,
      ]),
    ).toEqual([
      ["inbound", "Web", "Calls", "API"],
      ["outbound", "API", "Reads", "Database"],
    ]);
    expect(
      info.relationships.find((relationship) => relationship.id === "api-db")
        ?.views,
    ).toEqual(["container", "component"]);
    expect(info.contributors[0]?.name).toBe("Ada");
    expect(info.recentCommits[0]?.subject).toBe("Refine API");
  });
});

function sampleDiagrams(): DiagramSpec[] {
  return [
    {
      id: "context",
      name: "System Context",
      type: "system_context",
      subjectEntityId: "system",
      nodes: [
        { id: "user-node", entityId: "user", type: "person", name: "User" },
        {
          id: "system-node",
          entityId: "system",
          type: "softwareSystem",
          name: "System",
        },
      ],
      edges: [],
    },
    {
      id: "container",
      name: "Containers",
      type: "container",
      subjectEntityId: "system",
      nodes: [
        {
          id: "web-node",
          entityId: "web",
          parentEntityId: "system",
          type: "container",
          name: "Web",
        },
        {
          id: "api-node",
          entityId: "api",
          parentEntityId: "system",
          type: "container",
          name: "API",
          technology: "Node.js",
        },
        {
          id: "db-node",
          entityId: "db",
          parentEntityId: "system",
          type: "database",
          name: "Database",
        },
      ],
      edges: [
        {
          id: "web-api",
          source: "web-node",
          target: "api-node",
          label: "Calls",
        },
        {
          id: "api-db",
          source: "api-node",
          target: "db-node",
          label: "Reads",
          technology: "SQL",
        },
      ],
    },
    {
      id: "component",
      name: "API Components",
      type: "component",
      subjectEntityId: "api",
      nodes: [
        {
          id: "router-node",
          entityId: "router",
          parentEntityId: "api",
          type: "component",
          name: "Router",
        },
      ],
      edges: [],
    },
  ];
}

function boundedDiagram(): DiagramSpec {
  return {
    id: "bounded",
    name: "Bounded",
    type: "container",
    nodes: [
      {
        id: "api-node",
        entityId: "api",
        layout: { x: 100, y: 120, width: 260, height: 140 },
        name: "API",
        type: "container",
      },
      {
        id: "db-node",
        entityId: "db",
        layout: { x: 460, y: 120, width: 260, height: 140 },
        name: "Database",
        type: "database",
      },
    ],
    edges: [],
    boundaries: [
      {
        id: "system-boundary",
        children: ["api-node", "db-node"],
        label: "System",
        layout: { x: 40, y: 60, width: 760, height: 280 },
        type: "softwareSystem",
      },
    ],
  };
}

function multiBoundaryDiagram(): DiagramSpec {
  return {
    id: "multi-boundary",
    name: "Multi Boundary",
    type: "container",
    nodes: [
      {
        id: "left-api",
        layout: { x: 100, y: 120, width: 260, height: 140 },
        name: "Left API",
        type: "container",
      },
      {
        id: "left-db",
        layout: { x: 460, y: 120, width: 260, height: 140 },
        name: "Left DB",
        type: "database",
      },
      {
        id: "right-api",
        layout: { x: 1000, y: 120, width: 260, height: 140 },
        name: "Right API",
        type: "container",
      },
      {
        id: "right-db",
        layout: { x: 1360, y: 120, width: 260, height: 140 },
        name: "Right DB",
        type: "database",
      },
    ],
    edges: [],
    boundaries: [
      {
        id: "left-boundary",
        children: ["left-api", "left-db"],
        label: "Left",
        layout: { x: 40, y: 60, width: 760, height: 280 },
        type: "softwareSystem",
      },
      {
        id: "right-boundary",
        children: ["right-api", "right-db"],
        label: "Right",
        layout: { x: 940, y: 60, width: 760, height: 280 },
        type: "softwareSystem",
      },
    ],
  };
}

function multiEdgeDiagram(): DiagramSpec {
  return {
    id: "multi-edge",
    name: "Multi Edge",
    type: "container",
    nodes: [
      {
        id: "a",
        layout: { x: 0, y: 0, width: 260, height: 140 },
        name: "A",
        type: "container",
      },
      {
        id: "b",
        layout: { x: 0, y: 220, width: 260, height: 140 },
        name: "B",
        type: "container",
      },
      {
        id: "c",
        layout: { x: 0, y: 440, width: 260, height: 140 },
        name: "C",
        type: "container",
      },
      {
        id: "core",
        layout: { x: 520, y: 220, width: 260, height: 140 },
        name: "Core",
        type: "container",
      },
    ],
    edges: [
      { id: "a-core", source: "a", target: "core" },
      { id: "b-core", source: "b", target: "core" },
      { id: "c-core", source: "c", target: "core" },
    ],
  };
}

function sideSwitchDiagram(): DiagramSpec {
  return {
    id: "side-switch",
    name: "Side Switch",
    type: "container",
    nodes: [
      {
        id: "source",
        layout: { x: 100, y: 100, width: 260, height: 140 },
        name: "Source",
        type: "container",
      },
      {
        id: "target",
        layout: { x: 520, y: 100, width: 260, height: 140 },
        name: "Target",
        type: "container",
      },
    ],
    edges: [{ id: "source-target", source: "source", target: "target" }],
  };
}
