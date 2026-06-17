import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createViewerPayload,
  prepareArchitectureWorkspace,
  updateArchitectureLayout,
  writeArchitectureSource,
} from "./index.js";

describe("Arch4 workflows", () => {
  it("prepares a workspace and writes validated architecture source", async () => {
    const root = tempWorkspace();
    prepareArchitectureWorkspace(root);

    const result = await writeArchitectureSource(root, {
      workspaceDsl:
        'workspace "Example" { model { } views { theme default } }\n',
      entities: [
        {
          schemaVersion: 1,
          entityId: "example.system",
          paths: ["src/**"],
          confidence: "high",
        },
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.written).toContain(".arch4/architecture/workspace.dsl");
    expect(result.written).toContain(
      ".arch4/architecture/entities/example.system.json",
    );
    expect(
      readFileSync(
        path.join(root, ".arch4", "architecture", "workspace.dsl"),
        "utf8",
      ),
    ).toContain("Example");
  });

  it("assembles viewer payload from rendered artifacts and layout sidecars", async () => {
    const root = tempWorkspace();
    prepareArchitectureWorkspace(root);
    const viewsDir = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    mkdirSync(viewsDir, { recursive: true });
    writeFileSync(
      path.join(viewsDir, "context.json"),
      `${JSON.stringify({
        id: "context",
        name: "Context",
        type: "system_context",
        nodes: [],
        edges: [],
      })}\n`,
      "utf8",
    );
    updateArchitectureLayout(root, {
      diagramId: "context",
      direction: "DOWN",
    });

    const payload = await createViewerPayload(root);

    expect(payload.diagrams.map((diagram) => diagram.id)).toEqual(["context"]);
    expect(payload.layoutDirections).toEqual({ context: "DOWN" });
  });

  it("overlays manual layout sidecars onto stale rendered view payloads", async () => {
    const root = tempWorkspace();
    prepareArchitectureWorkspace(root);
    const viewsDir = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    mkdirSync(viewsDir, { recursive: true });
    writeFileSync(
      path.join(viewsDir, "container.json"),
      `${JSON.stringify({
        id: "container",
        name: "Container",
        type: "container",
        nodes: [
          {
            id: "web",
            type: "container",
            name: "Web",
            layout: { x: 80, y: 80, width: 260, height: 140 },
          },
          {
            id: "api",
            type: "container",
            name: "API",
            layout: { x: 520, y: 80, width: 260, height: 140 },
          },
        ],
        edges: [{ id: "web-api", source: "web", target: "api" }],
        boundaries: [
          {
            id: "system",
            type: "softwareSystem",
            label: "System",
            children: ["web", "api"],
            layout: { x: 40, y: 40, width: 780, height: 220 },
          },
        ],
      })}\n`,
      "utf8",
    );
    updateArchitectureLayout(root, {
      diagramId: "container",
      nodeId: "api",
      x: 900,
      y: 420,
    });

    const payload = await createViewerPayload(root);
    const diagram = payload.diagrams.find((item) => item.id === "container")!;
    const api = diagram.nodes.find((node) => node.id === "api")!;
    const boundary = diagram.boundaries?.find((item) => item.id === "system");

    expect(api.layout).toMatchObject({ x: 900, y: 420 });
    expect(boundary).toBeDefined();
    const boundaryLayout = boundary!.layout;
    expect(boundaryLayout).toBeDefined();
    expect(boundaryLayout!.x).toBeLessThanOrEqual(api.layout!.x);
    expect(boundaryLayout!.y).toBeLessThanOrEqual(api.layout!.y);
    expect(boundaryLayout!.x + boundaryLayout!.width).toBeGreaterThanOrEqual(
      api.layout!.x + api.layout!.width,
    );
    expect(boundaryLayout!.y + boundaryLayout!.height).toBeGreaterThanOrEqual(
      api.layout!.y + api.layout!.height,
    );
    expect(payload.manualLayoutDiagramIds).toEqual(["container"]);
  });
});

function tempWorkspace(): string {
  return mkdtempSync(path.join(tmpdir(), "arch4-workflows-"));
}
