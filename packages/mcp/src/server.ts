import { readFileSync } from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import type { EntityMetadata, LayoutDirection } from "@arch4/core";
import {
  type Arch4ViewerPayload,
  buildArchitectureArtifacts,
  createViewerPayload,
  prepareArchitectureWorkspace,
  readArchitectureSource,
  updateArchitectureLayout,
  writeArchitectureSource,
} from "@arch4/workflows";

const MAP_RESOURCE_URI = "ui://arch4/map.html";
const CURSOR_MAP_RESOURCE_URI = "arch4://architecture-map";

export type Arch4McpServerOptions = {
  projectRoot?: string;
};

export function resolveMcpProjectRoot(args: string[]): string | undefined {
  const rootIndex = args.indexOf("--root");
  if (rootIndex !== -1) return args[rootIndex + 1];
  return process.env.ARCH4_PROJECT_ROOT;
}

export function createArch4McpServer(options: Arch4McpServerOptions = {}) {
  const server = new McpServer({
    name: "arch4",
    version: "0.1.0",
  });
  const projectRoot = options.projectRoot;

  registerAppResource(
    server,
    "Arch4 Architecture Map",
    MAP_RESOURCE_URI,
    {
      title: "Arch4 Architecture Map",
      description: "Interactive Arch4 architecture map widget.",
      _meta: {
        ui: {
          csp: {
            connectDomains: [],
            resourceDomains: [],
          },
          prefersBorder: false,
        },
        "openai/widgetDescription":
          "An interactive C4 architecture map rendered from Arch4 artifacts.",
      },
    },
    async () => ({
      contents: [
        {
          uri: MAP_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: readWidgetHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
              prefersBorder: false,
            },
          },
        },
      ],
    }),
  );
  registerAppResource(
    server,
    "Arch4 Architecture Map",
    CURSOR_MAP_RESOURCE_URI,
    {
      title: "Arch4 Architecture Map",
      description:
        "Cursor-compatible alias for the interactive Arch4 architecture map widget.",
      _meta: {
        ui: {
          csp: {
            connectDomains: [],
            resourceDomains: [],
          },
          prefersBorder: false,
        },
        "openai/widgetDescription":
          "An interactive C4 architecture map rendered from Arch4 artifacts.",
      },
    },
    async () => ({
      contents: [
        {
          uri: CURSOR_MAP_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: readWidgetHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
              prefersBorder: false,
            },
          },
        },
      ],
    }),
  );

  server.registerTool(
    "arch4_start_update",
    {
      title: "Start Arch4 Update",
      description:
        "Use this when starting a seed, update, or review workflow for an Arch4 architecture model.",
      inputSchema: {
        mode: z.enum(["seed", "update", "review", "auto"]).default("auto"),
        includeCurrentModel: z.boolean().default(false),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ mode, includeCurrentModel }) => {
      const prepared = prepareArchitectureWorkspace(projectRoot);
      const current = includeCurrentModel
        ? await readArchitectureSource(projectRoot)
        : undefined;
      return textResult({
        summary: `Prepared Arch4 ${mode} workflow in ${prepared.root}.`,
        instructions: updateInstructions(mode),
        workspace: {
          root: prepared.root,
          workspaceDslPath: path.relative(
            prepared.root,
            prepared.workspaceDslPath,
          ),
          entitiesDir: path.relative(prepared.root, prepared.entitiesDir),
        },
        current,
      });
    },
  );

  server.registerTool(
    "arch4_write_architecture_source",
    {
      title: "Write Arch4 Architecture Source",
      description:
        "Use this when the host agent has inspected repository evidence and needs to write Arch4 source files.",
      inputSchema: {
        workspaceDsl: z.string().optional(),
        entities: z.array(entityMetadataSchema).optional(),
        removeMissingEntities: z.boolean().default(false),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await writeArchitectureSource(projectRoot, input);
      return textResult({
        summary: `Wrote ${result.written.length} Arch4 source file(s).`,
        ...result,
      });
    },
  );

  server.registerTool(
    "arch4_build_artifacts",
    {
      title: "Build Arch4 Artifacts",
      description:
        "Use this after Arch4 source changes to render views, rebuild the architecture index, and refresh diagnostics.",
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = buildArchitectureArtifacts(projectRoot);
      return textResult({
        summary: `Rendered ${result.renderedViews} view(s) and indexed ${result.indexedViews} view(s).`,
        ...result,
      });
    },
  );

  registerAppTool(
    server,
    "arch4_show_map",
    {
      title: "Show Arch4 Map",
      description:
        "Use this when the user wants to visualize the current Arch4 architecture map.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: MAP_RESOURCE_URI,
        },
        "openai/outputTemplate": MAP_RESOURCE_URI,
      },
    },
    async () => {
      const payload = await createViewerPayload(projectRoot);
      return widgetResult(payload);
    },
  );

  server.registerTool(
    "arch4_diagnostics",
    {
      title: "Read Arch4 Diagnostics",
      description:
        "Use this to inspect current Arch4 render, index, layout, and metadata diagnostics.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const payload = await createViewerPayload(projectRoot);
      return textResult({
        summary: `${payload.diagnostics.length} diagnostic(s).`,
        diagnostics: payload.diagnostics,
      });
    },
  );

  server.registerTool(
    "arch4_update_layout",
    {
      title: "Update Arch4 Layout",
      description:
        "Use this when the Arch4 map widget changes a diagram direction, node position, or manual layout state.",
      inputSchema: {
        diagramId: z.string().min(1),
        direction: z.enum(["RIGHT", "LEFT", "DOWN", "UP"]).optional(),
        nodeId: z.string().min(1).optional(),
        x: z.number().finite().optional(),
        y: z.number().finite().optional(),
        resetManualLayout: z.boolean().optional(),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      if (input.direction) {
        updateArchitectureLayout(projectRoot, {
          diagramId: input.diagramId,
          direction: input.direction as LayoutDirection,
        });
      } else if (input.resetManualLayout) {
        updateArchitectureLayout(projectRoot, {
          diagramId: input.diagramId,
          resetManualLayout: true,
        });
      } else if (
        input.nodeId &&
        typeof input.x === "number" &&
        typeof input.y === "number"
      ) {
        updateArchitectureLayout(projectRoot, {
          diagramId: input.diagramId,
          nodeId: input.nodeId,
          x: input.x,
          y: input.y,
        });
      } else {
        throw new Error(
          "Provide direction, resetManualLayout, or nodeId with x/y.",
        );
      }
      const build = buildArchitectureArtifacts(projectRoot, {
        preserveViewsOnError: true,
      });
      const payload = await createViewerPayload(projectRoot);
      return widgetResult(payload, {
        summary: `Updated layout for ${input.diagramId}.`,
        build,
      });
    },
  );

  return server;
}

function readWidgetHtml(): string {
  return readFileSync(new URL("./widget/index.html", import.meta.url), "utf8");
}

function widgetResult(
  payload: Arch4ViewerPayload,
  extra: Record<string, unknown> = {},
): CallToolResult {
  const viewCount = payload.diagrams.length;
  const diagnosticCount = payload.diagnostics.length;
  return {
    structuredContent: {
      summary: `Loaded ${viewCount} architecture view(s) with ${diagnosticCount} diagnostic(s).`,
      viewCount,
      diagnosticCount,
      arch4Payload: payload,
      ...extra,
    },
    content: [
      {
        type: "text",
        text: `Arch4 map loaded: ${viewCount} view(s), ${diagnosticCount} diagnostic(s).`,
      },
      {
        type: "resource_link",
        uri: MAP_RESOURCE_URI,
        name: "Arch4 Architecture Map",
        title: "Arch4 Architecture Map",
        description: "Interactive Arch4 architecture map widget.",
        mimeType: RESOURCE_MIME_TYPE,
      },
    ],
    _meta: {
      arch4Payload: payload,
      ui: {
        resourceUri: MAP_RESOURCE_URI,
      },
      "openai/outputTemplate": MAP_RESOURCE_URI,
    },
  };
}

function textResult(value: Record<string, unknown>): CallToolResult {
  return {
    structuredContent: value,
    content: [
      {
        type: "text",
        text: String(value.summary ?? JSON.stringify(value)),
      },
    ],
  };
}

function updateInstructions(mode: string): string[] {
  return [
    `Use the ${mode === "auto" ? "seed or update" : mode} workflow based on the current model state.`,
    "Inspect repository evidence before writing architecture facts.",
    "Write only .arch4/architecture/workspace.dsl and .arch4/architecture/entities/*.json through arch4_write_architecture_source.",
    "Run arch4_build_artifacts after source changes.",
    "Call arch4_show_map after a successful build to display the rendered architecture map.",
  ];
}

const entityMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  entityId: z.string().min(1),
  paths: z.array(z.string()).optional(),
  owners: z.array(z.string()).optional(),
  confidence: z.string().optional(),
  openQuestions: z.array(z.string()).optional(),
  notes: z.record(z.string(), z.unknown()).optional(),
}) satisfies z.ZodType<EntityMetadata>;
