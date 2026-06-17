import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureArch4Layout, writeJson } from "@arch4/core";
import {
  layoutDiagramSpec,
  renderArch4Workspace,
  normalizeStructurizrWorkspace,
} from "./index.js";
import {
  componentWorkspaceJson,
  deploymentWorkspaceJson,
  dynamicWorkspaceJson,
  officialWorkspaceJson,
} from "./fixtures.js";

describe("normalizeStructurizrWorkspace", () => {
  it("normalizes container views with stable entity ids, generated names, and boundaries", () => {
    const model = normalizeStructurizrWorkspace(officialWorkspaceJson());
    const spec = model.specs.find((item) => item.type === "container");

    expect(spec?.id).toBe("Containers");
    expect(spec?.name).toBe("Containers");
    expect(spec?.subjectId).toBe("2");
    expect(spec?.subjectEntityId).toBe("recovery");
    expect(spec?.direction).toBe("RIGHT");
    expect(spec?.bounds).toBeUndefined();
    expect(spec?.nodes.map((node) => node.id).sort()).toEqual([
      "1",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(spec?.nodes.find((node) => node.id === "3")?.entityId).toBe("web");
    expect(spec?.nodes.find((node) => node.id === "3")?.parentEntityId).toBe(
      "recovery",
    );
    expect(spec?.nodes.find((node) => node.id === "5")?.type).toBe("database");
    expect(spec?.nodes.every((node) => node.layout === undefined)).toBe(true);
    expect(
      spec?.edges.map((edge) => [
        edge.source,
        edge.target,
        edge.label,
        edge.vertices,
      ]),
    ).toEqual([
      ["1", "3", "Uses", undefined],
      ["3", "4", "Calls", undefined],
      ["4", "5", "Reads and writes", undefined],
    ]);
    expect(spec?.boundaries?.[0]).toMatchObject({
      type: "softwareSystem",
      elementId: "2",
      entityId: "recovery",
      children: ["3", "4", "5"],
    });
  });

  it("renders Structurizr group fields as visible boundaries", () => {
    const payload = officialWorkspaceJson();
    const people = payload.model.people as Array<Record<string, unknown>>;
    const systems = payload.model.softwareSystems as Array<
      Record<string, unknown>
    >;
    people[0] = { ...people[0], group: "Users" };
    systems[1] = { ...systems[1], group: "External Systems" };

    const model = normalizeStructurizrWorkspace(payload);
    const spec = model.specs.find((item) => item.type === "container");

    expect(spec?.nodes.find((node) => node.id === "1")?.group).toBe("Users");
    expect(spec?.boundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "group-boundary-root-Users",
          type: "group",
          label: "Users",
          children: ["1"],
        }),
        expect.objectContaining({
          id: "group-boundary-root-External-Systems",
          type: "group",
          label: "External Systems",
          children: ["6"],
        }),
      ]),
    );
    expect(spec?.boundaries?.[0]).toMatchObject({
      id: "system-boundary-2",
      type: "softwareSystem",
    });
  });

  it("renders component views with a container boundary", () => {
    const model = normalizeStructurizrWorkspace(componentWorkspaceJson());
    const spec = model.specs.find((item) => item.type === "component");

    expect(spec?.name).toBe("ApiComponents");
    expect(spec?.subjectId).toBe("3");
    expect(spec?.nodes.map((node) => node.type).sort()).toEqual([
      "component",
      "component",
      "database",
    ]);
    expect(spec?.boundaries?.[0]).toMatchObject({
      type: "container",
      elementId: "3",
      children: ["4", "5"],
    });
    expect(spec?.edges.map((edge) => edge.label)).toEqual([
      "Delegates",
      "Reads and writes",
    ]);
  });

  it("warns when component views contain multiple nodes and no relationships", () => {
    const payload = componentWorkspaceJson();
    const view = payload.views.componentViews[0] as Record<string, unknown>;
    view.relationships = [];
    const system = payload.model.softwareSystems[0] as Record<string, unknown>;
    const container = (system.containers as Array<Record<string, unknown>>)[0];
    const components = container.components as Array<Record<string, unknown>>;
    components.forEach((component) => {
      component.relationships = [];
    });

    const model = normalizeStructurizrWorkspace(payload);

    expect(
      model.specs.find((item) => item.type === "component")?.edges,
    ).toEqual([]);
    expect(model.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.view.component.relationships.empty",
        level: "warning",
      }),
    );
  });

  it("warns for weak relationship labels but accepts labels with sentence context", () => {
    const model = normalizeStructurizrWorkspace({
      name: "Relationship Quality",
      model: {
        people: [
          {
            id: "1",
            name: "Developer",
            tags: "Element,Person",
            relationships: [
              {
                id: "weak",
                sourceId: "1",
                destinationId: "2",
                description: "Uses",
                tags: "Relationship",
              },
              {
                id: "readable",
                sourceId: "1",
                destinationId: "3",
                description: "reads commit history from",
                tags: "Relationship",
              },
            ],
          },
        ],
        softwareSystems: [
          { id: "2", name: "Arch4", tags: "Element,Software System" },
          { id: "3", name: "Git", tags: "Element,Software System" },
        ],
      },
      views: {
        systemContextViews: [
          {
            key: "Context",
            softwareSystemId: "2",
            automaticLayout: {
              rankDirection: "LeftRight",
              implementation: "Graphviz",
            },
            dimensions: { width: 1200, height: 640 },
            elements: [
              { id: "1", x: 100, y: 120 },
              { id: "2", x: 520, y: 120 },
              { id: "3", x: 900, y: 120 },
            ],
            relationships: [{ id: "weak" }, { id: "readable" }],
          },
        ],
      },
    });

    const weakDiagnostics = model.diagnostics.filter(
      (diagnostic) => diagnostic.code === "arch4.relationship.label.weak",
    );

    expect(weakDiagnostics).toHaveLength(1);
    expect(weakDiagnostics[0]?.message).toContain("Relationship weak");
  });

  it("renders deployment nodes as boundaries and hides the boundary node from nodes", () => {
    const model = normalizeStructurizrWorkspace(deploymentWorkspaceJson());
    const spec = model.specs.find((item) => item.type === "deployment");

    expect(spec?.nodes.map((node) => node.id).sort()).toEqual(["7", "8", "9"]);
    expect(spec?.nodes.map((node) => node.type).sort()).toEqual([
      "containerInstance",
      "containerInstance",
      "infrastructureNode",
    ]);
    expect(spec?.nodes.find((node) => node.id === "8")?.instanceOfId).toBe("3");
    expect(spec?.boundaries?.[0]).toMatchObject({
      type: "deploymentNode",
      elementId: "6",
      children: ["7", "8", "9"],
    });
    expect(
      spec?.edges.map((edge) => [edge.source, edge.target, edge.label]),
    ).toEqual([
      ["7", "8", "Routes"],
      ["8", "9", "Calls"],
    ]);
  });

  it("renders dynamic views using view-scoped ordered relationships", () => {
    const model = normalizeStructurizrWorkspace(dynamicWorkspaceJson());
    const spec = model.specs.find((item) => item.type === "dynamic");

    expect(spec?.id).toBe("Request-Processing");
    expect(spec?.name).toBe("Request Processing");
    expect(spec?.subjectId).toBe("2");
    expect(spec?.subjectEntityId).toBe("2");
    expect(spec?.nodes.map((node) => node.id).sort()).toEqual([
      "1",
      "3",
      "4",
      "5",
    ]);
    expect(spec?.edges.map((edge) => edge.order)).toEqual([1, 2, 3, 4, 5]);
    expect(spec?.edges.every((edge) => edge.dynamic)).toBe(true);
    expect(spec?.edges.map((edge) => edge.label)).toEqual([
      "Starts request",
      "Writes request",
      "Returns accepted",
      "Streams update",
      "Persists request",
    ]);
    expect(spec?.edges[0]?.vertices).toBeUndefined();
    expect(spec?.boundaries?.[0]).toMatchObject({
      type: "softwareSystem",
    });
  });

  it("ignores placeholder Structurizr JSON layout coordinates", () => {
    const payload = officialWorkspaceJson();
    const view = payload.views.containerViews[0] as Record<string, unknown>;
    view.dimensions = null;
    view.elements = (view.elements as Array<Record<string, unknown>>).map(
      (element) => ({ ...element, x: 0, y: 0 }),
    );

    const model = normalizeStructurizrWorkspace(payload);
    const spec = model.specs.find((item) => item.type === "container");

    expect(spec?.bounds).toBeUndefined();
    expect(spec?.nodes.every((node) => node.layout === undefined)).toBe(true);
    expect(spec?.boundaries?.every((boundary) => !boundary.layout)).toBe(true);
  });

  it("lays out nodes, boundaries, and bounds with Dagre", () => {
    const model = normalizeStructurizrWorkspace(officialWorkspaceJson());
    const spec = model.specs.find((item) => item.type === "container");
    expect(spec).toBeDefined();

    const laidOut = layoutDiagramSpec(spec!);

    expect(laidOut.bounds?.width).toBeGreaterThan(0);
    expect(laidOut.bounds?.height).toBeGreaterThan(0);
    laidOut.nodes.forEach((node) => expectFiniteLayout(node.layout));
    laidOut.boundaries?.forEach((boundary) => {
      expectFiniteLayout(boundary.layout);
      expectBoundaryContainsChildren(boundary, laidOut.nodes);
    });
  });

  it("keeps sibling boundary rectangles separated in crowded layouts", () => {
    const payload = officialWorkspaceJson();
    const systems = payload.model.softwareSystems as Array<
      Record<string, unknown>
    >;
    systems.push({
      id: "13",
      name: "Second System",
      tags: "Element,Software System",
      containers: [
        { id: "14", name: "Worker", tags: "Element,Container" },
        { id: "15", name: "Queue", tags: "Element,Container" },
      ],
    });
    const view = payload.views.containerViews[0] as Record<string, unknown>;
    view.elements = [
      ...(view.elements as unknown[]),
      { id: "14", x: 0, y: 0 },
      { id: "15", x: 0, y: 0 },
    ];
    view.relationships = [...(view.relationships as unknown[]), { id: "16" }];
    const api = (systems[0]?.containers as Array<Record<string, unknown>>)[1]!;
    (api.relationships as Array<Record<string, unknown>>).push({
      id: "16",
      sourceId: "4",
      destinationId: "14",
      description: "Publishes to",
      tags: "Relationship",
    });

    const model = normalizeStructurizrWorkspace(payload);
    const spec = layoutDiagramSpec(
      model.specs.find((item) => item.type === "container")!,
    );
    const softwareBoundaries = (spec.boundaries ?? []).filter(
      (boundary) => boundary.type === "softwareSystem",
    );

    expect(softwareBoundaries.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < softwareBoundaries.length; i += 1) {
      for (let j = i + 1; j < softwareBoundaries.length; j += 1) {
        expect(
          layoutsOverlap(
            softwareBoundaries[i]!.layout!,
            softwareBoundaries[j]!.layout!,
          ),
        ).toBe(false);
      }
    }
  });

  it("restricts system context views by arch4.view.entityIds when present", () => {
    const payload = dynamicWorkspaceJson();
    const contextView = payload.views.systemContextViews[0] as Record<
      string,
      unknown
    >;
    contextView.elements = [
      ...(contextView.elements as unknown[]),
      { id: "6", x: 940, y: 120 },
    ];
    contextView.properties = { "arch4.view.entityIds": "1,2" };

    const model = normalizeStructurizrWorkspace(payload);
    const spec = model.specs.find((item) => item.type === "system_context");

    expect(spec?.nodes.map((node) => node.id).sort()).toEqual(["1", "2"]);
    expect(spec?.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["1", "2"],
    ]);
  });
});

describe("renderArch4Workspace outputs", () => {
  it("uses layout config direction before Structurizr automaticLayout", () => {
    const project = renderProject(officialWorkspaceJson(), {
      views: { Containers: { direction: "DOWN" } },
    });

    expect(
      project.result.specs.find((spec) => spec.id === "Containers"),
    ).toMatchObject({ direction: "DOWN" });
  });

  it("uses Structurizr automaticLayout direction when no layout config override exists", () => {
    const project = renderProject(officialWorkspaceJson());

    expect(
      project.result.specs.find((spec) => spec.id === "Containers"),
    ).toMatchObject({ direction: "RIGHT" });
  });

  it("defaults rendered specs to RIGHT when no layout direction exists", () => {
    const payload = officialWorkspaceJson();
    const view = payload.views.containerViews[0] as Record<string, unknown>;
    delete view.automaticLayout;

    const project = renderProject(payload);

    expect(
      project.result.specs.find((spec) => spec.id === "Containers"),
    ).toMatchObject({ direction: "RIGHT" });
  });

  it("does not mutate generated output when writeOutputs is false", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "arch4-render-validate-"));
    const viewsDir = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    await mkdir(viewsDir, { recursive: true });
    writeFileSync(path.join(viewsDir, "stale.json"), "{}\n", "utf8");

    const result = renderArch4Workspace({
      projectRoot: root,
      writeOutputs: false,
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "arch4.workspace.missing" }),
    );
    expect(readdirSync(viewsDir)).toEqual(["stale.json"]);
  });

  it("clears stale view output when render fails", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "arch4-render-fail-"));
    const viewsDir = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    await mkdir(viewsDir, { recursive: true });
    writeFileSync(path.join(viewsDir, "stale.json"), "{}\n", "utf8");

    const result = renderArch4Workspace({
      projectRoot: root,
      writeOutputs: true,
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "arch4.workspace.missing" }),
    );
    expect(readdirSync(viewsDir)).toEqual([]);
    expect(
      existsSync(
        path.join(root, ".arch4", "architecture", "build", "diagnostics.json"),
      ),
    ).toBe(true);
  });

  it("preserves stale view output on render failure when requested", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "arch4-render-preserve-"));
    const viewsDir = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    const diagnosticsPath = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "diagnostics.json",
    );
    await mkdir(viewsDir, { recursive: true });
    writeFileSync(path.join(viewsDir, "stale.json"), "{}\n", "utf8");

    const result = renderArch4Workspace({
      projectRoot: root,
      writeOutputs: true,
      preserveViewsOnError: true,
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "arch4.workspace.missing" }),
    );
    expect(readdirSync(viewsDir)).toEqual(["stale.json"]);
    expect(JSON.parse(readFileSync(diagnosticsPath, "utf8"))).toContainEqual(
      expect.objectContaining({ code: "arch4.workspace.missing" }),
    );
  });

  it("preserves stale views during Structurizr validation failures when validating", async () => {
    const project = createRenderProcessProject(`
if (args[0] === "validate") {
  console.error("DSL parse failed");
  process.exit(1);
}
process.exit(0);
`);
    const viewsDir = path.join(
      project.root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    writeFileSync(path.join(viewsDir, "stale.json"), "{}\n", "utf8");

    const result = renderArch4Workspace({
      projectRoot: project.root,
      structurizrCliPath: project.structurizrCliPath,
      javaPath: project.javaPath,
      writeOutputs: false,
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.structurizr.validate_failed",
      }),
    );
    expect(readdirSync(viewsDir)).toEqual(["stale.json"]);
  });

  it("clears stale views and writes diagnostics during Structurizr validation failures when rendering", async () => {
    const project = createRenderProcessProject(`
if (args[0] === "validate") {
  console.error("DSL parse failed");
  process.exit(1);
}
process.exit(0);
`);
    const viewsDir = path.join(
      project.root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    const diagnosticsPath = path.join(
      project.root,
      ".arch4",
      "architecture",
      "build",
      "diagnostics.json",
    );
    writeFileSync(path.join(viewsDir, "stale.json"), "{}\n", "utf8");

    const result = renderArch4Workspace({
      projectRoot: project.root,
      structurizrCliPath: project.structurizrCliPath,
      javaPath: project.javaPath,
      writeOutputs: true,
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.structurizr.validate_failed",
      }),
    );
    expect(readdirSync(viewsDir)).toEqual([]);
    expect(JSON.parse(readFileSync(diagnosticsPath, "utf8"))).toContainEqual(
      expect.objectContaining({
        code: "arch4.structurizr.validate_failed",
      }),
    );
  });

  it("reports missing Structurizr workspace JSON exports", () => {
    const project = createRenderProcessProject(`
if (args[0] === "validate") process.exit(0);
if (args[0] === "export") process.exit(0);
process.exit(1);
`);

    const result = renderArch4Workspace({
      projectRoot: project.root,
      structurizrCliPath: project.structurizrCliPath,
      javaPath: project.javaPath,
      writeOutputs: true,
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.structurizr.export_missing",
      }),
    );
  });

  it("reports invalid Structurizr workspace JSON exports", () => {
    const project = createRenderProcessProject(`
if (args[0] === "validate") process.exit(0);
if (args[0] === "export") {
  const output = args[args.indexOf("-output") + 1];
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "workspace.json"), "{not-json");
  process.exit(0);
}
process.exit(1);
`);

    const result = renderArch4Workspace({
      projectRoot: project.root,
      structurizrCliPath: project.structurizrCliPath,
      javaPath: project.javaPath,
      writeOutputs: true,
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.structurizr.export_invalid_json",
      }),
    );
  });
});

function renderProject(
  workspaceJson: Record<string, unknown>,
  layoutConfig?: Record<string, unknown>,
): ReturnType<typeof createRenderProject> & {
  result: ReturnType<typeof renderArch4Workspace>;
} {
  const project = createRenderProject(workspaceJson, layoutConfig);
  return {
    ...project,
    result: renderArch4Workspace({
      projectRoot: project.root,
      structurizrCliPath: project.structurizrCliPath,
      javaPath: project.javaPath,
      writeOutputs: true,
    }),
  };
}

function createRenderProject(
  workspaceJson: Record<string, unknown>,
  layoutConfig?: Record<string, unknown>,
): {
  javaPath: string;
  root: string;
  structurizrCliPath: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), "arch4-render-project-"));
  const paths = ensureArch4Layout(root);
  writeFileSync(paths.workspaceDslPath, "workspace {}\n", "utf8");
  if (layoutConfig) {
    writeJson(paths.layoutConfigPath, { schemaVersion: 1, ...layoutConfig });
  }
  const javaPath = path.join(root, "java");
  writeFileSync(javaPath, "#!/usr/bin/env sh\nexit 0\n", "utf8");
  chmodSync(javaPath, 0o755);
  const structurizrCliPath = path.join(root, "structurizr");
  writeFileSync(
    structurizrCliPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
if (args[0] === "validate") process.exit(0);
if (args[0] === "export") {
  const output = args[args.indexOf("-output") + 1];
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "workspace.json"), ${JSON.stringify(JSON.stringify(workspaceJson))});
  process.exit(0);
}
process.exit(1);
`,
    "utf8",
  );
  chmodSync(structurizrCliPath, 0o755);
  return { javaPath, root, structurizrCliPath };
}

function createRenderProcessProject(script: string): {
  javaPath: string;
  root: string;
  structurizrCliPath: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), "arch4-render-process-"));
  const paths = ensureArch4Layout(root);
  writeFileSync(paths.workspaceDslPath, "workspace {}\n", "utf8");
  const javaPath = path.join(root, "java");
  writeFileSync(javaPath, "#!/usr/bin/env sh\nexit 0\n", "utf8");
  chmodSync(javaPath, 0o755);
  const structurizrCliPath = path.join(root, "structurizr");
  writeFileSync(
    structurizrCliPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
${script}
`,
    "utf8",
  );
  chmodSync(structurizrCliPath, 0o755);
  return { javaPath, root, structurizrCliPath };
}

function expectFiniteLayout(
  layout: { x: number; y: number; width: number; height: number } | undefined,
): void {
  expect(layout).toBeDefined();
  expect(Number.isFinite(layout!.x)).toBe(true);
  expect(Number.isFinite(layout!.y)).toBe(true);
  expect(layout!.width).toBeGreaterThan(0);
  expect(layout!.height).toBeGreaterThan(0);
}

function expectBoundaryContainsChildren(
  boundary: {
    children: string[];
    layout?: { x: number; y: number; width: number; height: number };
  },
  nodes: Array<{
    id: string;
    layout?: { x: number; y: number; width: number; height: number };
  }>,
): void {
  const layout = boundary.layout!;
  for (const childId of boundary.children) {
    const child = nodes.find((node) => node.id === childId);
    if (!child?.layout) continue;
    expect(child.layout.x).toBeGreaterThanOrEqual(layout.x);
    expect(child.layout.y).toBeGreaterThanOrEqual(layout.y);
    expect(child.layout.x + child.layout.width).toBeLessThanOrEqual(
      layout.x + layout.width,
    );
    expect(child.layout.y + child.layout.height).toBeLessThanOrEqual(
      layout.y + layout.height,
    );
  }
}

function layoutsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
