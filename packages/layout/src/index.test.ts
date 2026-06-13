import { describe, expect, it } from "vitest";
import type {
  DiagramBoundary,
  DiagramLayout,
  DiagramSpec,
  LayoutDirection,
} from "@arch4/core";
import { deriveBoundaryLayouts, layoutDiagramSpec } from "./index.js";

describe("layoutDiagramSpec", () => {
  it("assigns finite node, boundary, and bounds layouts", () => {
    const spec = layoutDiagramSpec(sampleSpec());

    expect(spec.direction).toBe("RIGHT");
    expect(spec.bounds?.width).toBeGreaterThan(0);
    expect(spec.bounds?.height).toBeGreaterThan(0);
    spec.nodes.forEach((node) => expectFiniteLayout(node.layout));
    spec.boundaries?.forEach((boundary) => {
      expectFiniteLayout(boundary.layout);
      boundary.children.forEach((childId) => {
        const child = spec.nodes.find((node) => node.id === childId);
        expect(child?.layout).toBeDefined();
        expect(child!.layout!.x).toBeGreaterThanOrEqual(boundary.layout!.x);
        expect(child!.layout!.y).toBeGreaterThanOrEqual(boundary.layout!.y);
        expect(child!.layout!.x + child!.layout!.width).toBeLessThanOrEqual(
          boundary.layout!.x + boundary.layout!.width,
        );
        expect(child!.layout!.y + child!.layout!.height).toBeLessThanOrEqual(
          boundary.layout!.y + boundary.layout!.height,
        );
      });
    });
  });

  it("keeps sibling boundary rectangles separated", () => {
    const spec = layoutDiagramSpec(crowdedSpec());
    const boundaries = spec.boundaries ?? [];

    expect(boundaries.length).toBe(2);
    expect(layoutsOverlap(boundaries[0]!.layout!, boundaries[1]!.layout!)).toBe(
      false,
    );
  });

  it("keeps visible padding between nested boundary lines", () => {
    const spec = layoutDiagramSpec(nestedBoundarySpec());
    const outer = spec.boundaries?.find((boundary) => boundary.id === "cloud");
    const inner = spec.boundaries?.find(
      (boundary) => boundary.id === "app-cluster",
    );

    expect(outer?.layout).toBeDefined();
    expect(inner?.layout).toBeDefined();
    expect(inner!.layout!.x - outer!.layout!.x).toBeGreaterThanOrEqual(32);
    expect(inner!.layout!.y - outer!.layout!.y).toBeGreaterThanOrEqual(32);
    expect(
      outer!.layout!.x +
        outer!.layout!.width -
        (inner!.layout!.x + inner!.layout!.width),
    ).toBeGreaterThanOrEqual(32);
    expect(
      outer!.layout!.y +
        outer!.layout!.height -
        (inner!.layout!.y + inner!.layout!.height),
    ).toBeGreaterThanOrEqual(32);
  });

  it("center-aligns stacked top-level boundary layers for down layouts", () => {
    const spec = layoutDiagramSpec(stackedBoundarySpec(), {
      direction: "DOWN",
    });
    const boundaries = spec.boundaries ?? [];
    const centers = boundaries.map(
      (boundary) => boundary.layout!.x + boundary.layout!.width / 2,
    );
    const orderedBoundaries = [...boundaries].sort(
      (a, b) => a.layout!.y - b.layout!.y,
    );

    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
    for (let index = 1; index < orderedBoundaries.length; index += 1) {
      const previous = orderedBoundaries[index - 1]!.layout!;
      const current = orderedBoundaries[index]!.layout!;
      expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height);
    }
  });

  it.each([
    ["RIGHT", "horizontal"],
    ["LEFT", "horizontal"],
    ["DOWN", "vertical"],
    ["UP", "vertical"],
  ] as const)("maps %s direction through Dagre", (direction, axis) => {
    const spec = layoutDiagramSpec(sampleSpec(), { direction });
    const source = spec.nodes.find((node) => node.id === "client")!.layout!;
    const target = spec.nodes.find((node) => node.id === "api")!.layout!;

    expect(spec.direction).toBe(direction);
    if (axis === "horizontal") {
      expect(Math.abs(target.x - source.x)).toBeGreaterThan(
        Math.abs(target.y - source.y),
      );
    } else {
      expect(Math.abs(target.y - source.y)).toBeGreaterThan(
        Math.abs(target.x - source.x),
      );
    }
  });

  it("preserves dynamic edge order", () => {
    const spec = layoutDiagramSpec({
      ...sampleSpec(),
      edges: [
        {
          id: "step-2",
          source: "api",
          target: "db",
          dynamic: true,
          order: 2,
        },
        {
          id: "step-1",
          source: "client",
          target: "api",
          dynamic: true,
          order: 1,
        },
      ],
    });

    expect(spec.edges.map((edge) => edge.order)).toEqual([2, 1]);
  });

  it("preserves manual node coordinates and recomputes boundaries", () => {
    const spec = layoutDiagramSpec(sampleSpec(), {
      manualPositions: {
        api: { x: 640, y: 420 },
      },
    });
    const api = spec.nodes.find((node) => node.id === "api")!;
    const boundary = spec.boundaries?.find(
      (item) => item.id === "system-boundary",
    );

    expect(api.layout).toMatchObject({ x: 640, y: 420 });
    const boundaryLayout = boundary?.layout;
    expect(boundaryLayout).toBeDefined();
    expect(boundaryLayout!.x).toBeLessThanOrEqual(api.layout!.x);
    expect(boundaryLayout!.y).toBeLessThanOrEqual(api.layout!.y);
    expect(boundaryLayout!.x + boundaryLayout!.width).toBeGreaterThanOrEqual(
      api.layout!.x + api.layout!.width,
    );
    expect(boundaryLayout!.y + boundaryLayout!.height).toBeGreaterThanOrEqual(
      api.layout!.y + api.layout!.height,
    );
    spec.nodes
      .filter((node) => node.id !== "api")
      .forEach((node) => expectFiniteLayout(node.layout));
  });

  it("keeps automatic node coordinates stable when a different node is manual", () => {
    const automatic = layoutDiagramSpec(sampleSpec());
    const manual = layoutDiagramSpec(sampleSpec(), {
      manualPositions: {
        api: { x: 640, y: 420 },
      },
    });

    expect(nodeLayout(manual, "api")).toMatchObject({ x: 640, y: 420 });
    expect(nodeLayout(manual, "client")).toEqual(
      nodeLayout(automatic, "client"),
    );
    expect(nodeLayout(manual, "db")).toEqual(nodeLayout(automatic, "db"));
  });

  it("leaves unrelated boundary geometry stable when a node outside it is manual", () => {
    const automatic = layoutDiagramSpec(crowdedSpec());
    const manual = layoutDiagramSpec(crowdedSpec(), {
      manualPositions: {
        api: { x: 640, y: 420 },
      },
    });

    expect(boundaryLayout(manual, "other-system-boundary")).toEqual(
      boundaryLayout(automatic, "other-system-boundary"),
    );
  });
});

describe("shared boundary geometry", () => {
  it("derives nested boundary layouts from node rectangles", () => {
    const boundaries: DiagramBoundary[] = [
      {
        id: "outer",
        label: "Outer",
        type: "deploymentNode",
        children: ["api", "worker", "db"],
      },
      {
        id: "inner",
        label: "Inner",
        type: "container",
        children: ["api", "worker"],
      },
    ];
    const nodeLayouts = new Map<string, DiagramLayout>([
      ["api", { x: 100, y: 120, width: 260, height: 140 }],
      ["worker", { x: 420, y: 120, width: 260, height: 140 }],
      ["db", { x: 260, y: 420, width: 260, height: 140 }],
    ]);

    const result = deriveBoundaryLayouts(boundaries, nodeLayouts);
    const outer = result.boundaries.find((boundary) => boundary.id === "outer");
    const inner = result.boundaries.find((boundary) => boundary.id === "inner");

    expect([...result.affectedBoundaryIds].sort()).toEqual(["inner", "outer"]);
    expect(inner?.layout).toBeDefined();
    expect(outer?.layout).toBeDefined();
    expect(outer!.layout!.x).toBeLessThan(inner!.layout!.x);
    expect(outer!.layout!.y).toBeLessThan(inner!.layout!.y);
    expect(outer!.layout!.x + outer!.layout!.width).toBeGreaterThan(
      inner!.layout!.x + inner!.layout!.width,
    );
    expect(outer!.layout!.y + outer!.layout!.height).toBeGreaterThan(
      inner!.layout!.y + inner!.layout!.height,
    );
  });
});

function sampleSpec(direction: LayoutDirection = "RIGHT"): DiagramSpec {
  return {
    id: "sample",
    name: "Sample",
    type: "container",
    direction,
    nodes: [
      { id: "client", name: "Client", type: "person" },
      {
        id: "api",
        name: "API",
        parentEntityId: "system",
        type: "container",
      },
      {
        id: "db",
        name: "Database",
        parentEntityId: "system",
        type: "database",
      },
    ],
    edges: [
      { id: "client-api", source: "client", target: "api" },
      { id: "api-db", source: "api", target: "db" },
    ],
    boundaries: [
      {
        id: "system-boundary",
        label: "System",
        type: "softwareSystem",
        children: ["api", "db"],
      },
    ],
  };
}

function stackedBoundarySpec(): DiagramSpec {
  return {
    id: "stacked",
    name: "Stacked",
    type: "container",
    direction: "DOWN",
    nodes: [
      { id: "traveler", name: "Traveler", type: "person" },
      { id: "support", name: "Support Agent", type: "person" },
      { id: "web", name: "Web App", type: "container" },
      { id: "api", name: "Booking API", type: "container" },
      { id: "hotel", name: "Hotel APIs", type: "softwareSystem" },
      { id: "airline", name: "Airline APIs", type: "softwareSystem" },
      { id: "payment", name: "Payment Provider", type: "softwareSystem" },
      {
        id: "notification",
        name: "Notification Provider",
        type: "softwareSystem",
      },
    ],
    edges: [
      { id: "traveler-web", source: "traveler", target: "web" },
      { id: "support-api", source: "support", target: "api" },
      { id: "web-api", source: "web", target: "api" },
      { id: "api-hotel", source: "api", target: "hotel" },
      { id: "api-airline", source: "api", target: "airline" },
      { id: "api-payment", source: "api", target: "payment" },
      { id: "api-notification", source: "api", target: "notification" },
    ],
    boundaries: [
      {
        id: "customers",
        label: "Customers",
        type: "group",
        children: ["traveler", "support"],
      },
      {
        id: "platform",
        label: "Travel Booking Platform",
        type: "softwareSystem",
        children: ["web", "api"],
      },
      {
        id: "external",
        label: "External Services",
        type: "group",
        children: ["hotel", "airline", "payment", "notification"],
      },
    ],
  };
}

function nestedBoundarySpec(): DiagramSpec {
  return {
    id: "deployment",
    name: "Deployment",
    type: "deployment",
    direction: "RIGHT",
    nodes: [
      { id: "gateway", name: "Gateway", type: "infrastructureNode" },
      { id: "app", name: "App", type: "containerInstance" },
      { id: "worker", name: "Worker", type: "containerInstance" },
      { id: "database", name: "Database", type: "infrastructureNode" },
    ],
    edges: [
      { id: "gateway-app", source: "gateway", target: "app" },
      { id: "app-worker", source: "app", target: "worker" },
      { id: "worker-database", source: "worker", target: "database" },
    ],
    boundaries: [
      {
        id: "cloud",
        label: "Cloud Region",
        type: "deploymentNode",
        children: ["gateway", "app", "worker", "database"],
      },
      {
        id: "app-cluster",
        label: "Application Cluster",
        type: "deploymentNode",
        children: ["app", "worker"],
      },
    ],
  };
}

function crowdedSpec(): DiagramSpec {
  const spec = sampleSpec();
  return {
    ...spec,
    nodes: [
      ...spec.nodes,
      {
        id: "worker",
        name: "Worker",
        parentEntityId: "other-system",
        type: "container",
      },
      {
        id: "queue",
        name: "Queue",
        parentEntityId: "other-system",
        type: "container",
      },
    ],
    edges: [
      ...spec.edges,
      { id: "api-worker", source: "api", target: "worker" },
      { id: "worker-queue", source: "worker", target: "queue" },
    ],
    boundaries: [
      ...spec.boundaries!,
      {
        id: "other-system-boundary",
        label: "Other System",
        type: "softwareSystem",
        children: ["worker", "queue"],
      },
    ],
  };
}

function expectFiniteLayout(layout: DiagramLayout | undefined): void {
  expect(layout).toBeDefined();
  expect(Number.isFinite(layout!.x)).toBe(true);
  expect(Number.isFinite(layout!.y)).toBe(true);
  expect(layout!.width).toBeGreaterThan(0);
  expect(layout!.height).toBeGreaterThan(0);
}

function nodeLayout(spec: DiagramSpec, nodeId: string): DiagramLayout {
  const layout = spec.nodes.find((node) => node.id === nodeId)?.layout;
  expectFiniteLayout(layout);
  return layout!;
}

function boundaryLayout(spec: DiagramSpec, boundaryId: string): DiagramLayout {
  const layout = spec.boundaries?.find(
    (boundary) => boundary.id === boundaryId,
  )?.layout;
  expectFiniteLayout(layout);
  return layout!;
}

function layoutsOverlap(a: DiagramLayout, b: DiagramLayout): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
