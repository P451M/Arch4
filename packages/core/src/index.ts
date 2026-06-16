import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ARCH4_DIR = ".arch4";
export const ARCH4_ARCHITECTURE_DIR = "architecture";
export const ARCH4_MANIFEST_FILE = "arch4.json";
export const ARCH4_WORKSPACE_FILE = "workspace.dsl";
export const ARCH4_INDEX_FILE = "architecture-index.json";
export const ARCH4_DIAGNOSTICS_FILE = "diagnostics.json";
export const ARCH4_MANUAL_LAYOUT_FILE = "manual-layout.json";

export type ViewType =
  | "system_context"
  | "container"
  | "component"
  | "deployment"
  | "dynamic"
  | string;

export type Arch4ProjectManifest = {
  schemaVersion: 1;
  name: string;
  description?: string;
  createdAt: string;
  source: {
    dsl: string;
    entitiesDir: string;
    buildDir: string;
  };
  tools: {
    arch4: string;
    structurizrCli?: string;
    java?: string;
  };
};

export type DiagramLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutDirection = "RIGHT" | "LEFT" | "DOWN" | "UP";

export type DiagramNode = {
  id: string;
  entityId?: string;
  type: string;
  name: string;
  description?: string;
  technology?: string;
  parentId?: string | null;
  parentEntityId?: string | null;
  instanceOfId?: string | null;
  environment?: string | null;
  deploymentNodeId?: string | null;
  group?: string | null;
  tags?: string[];
  style?: Record<string, string>;
  layout?: DiagramLayout;
};

export type DiagramEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  technology?: string;
  order?: number;
  dynamic?: boolean;
  tags?: string[];
  style?: Record<string, string>;
  vertices?: Array<{ x: number; y: number }>;
};

export type DiagramBoundary = {
  id: string;
  type:
    | "enterprise"
    | "group"
    | "softwareSystem"
    | "container"
    | "deploymentNode"
    | string;
  label: string;
  elementId?: string | null;
  entityId?: string | null;
  children: string[];
  tags?: string[];
  style?: Record<string, string>;
  layout?: DiagramLayout;
};

export type DiagramSpec = {
  id: string;
  name: string;
  type: ViewType;
  subjectId?: string | null;
  subjectEntityId?: string | null;
  direction?: LayoutDirection;
  bounds?: {
    width: number;
    height: number;
  };
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  boundaries?: DiagramBoundary[];
  legend?: Array<{
    id: string;
    kind: "element" | "relationship" | "boundary" | string;
    label: string;
    style?: Record<string, string>;
  }>;
};

export type EntityMetadata = {
  schemaVersion: 1;
  entityId: string;
  paths?: string[];
  owners?: string[];
  confidence?: "low" | "medium" | "high" | string;
  openQuestions?: string[];
  notes?: Record<string, unknown>;
};

export type ArchitectureIndex = {
  schemaVersion: 1;
  generatedAt: string;
  projectRoot: string;
  elements: Array<{
    entityId: string;
    name: string;
    type?: string;
    description?: string;
    tags?: string[];
    paths: string[];
    owners?: string[];
    confidence?: "low" | "medium" | "high" | string;
    openQuestions?: string[];
    notes?: Record<string, unknown>;
    views: string[];
    contributors: Array<{ name: string; email?: string; commits: number }>;
    recentCommits: Array<{
      hash: string;
      subject: string;
      author: string;
      date: string;
    }>;
    contextPath?: string;
  }>;
  relationships: Array<{
    id: string;
    sourceEntityId?: string;
    targetEntityId?: string;
    label?: string;
    technology?: string;
    views: string[];
  }>;
  views: Array<{
    id: string;
    name: string;
    type: ViewType;
    dataPath: string;
    subjectEntityId?: string | null;
  }>;
  diagnostics: Diagnostic[];
};

export type EntityContextFile = {
  schemaVersion: 1;
  id: string;
  title: string;
  markdownPath: string;
  elementIds: string[];
  sourcePaths: string[];
  generatedAt: string;
};

export type Diagnostic = {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  path?: string;
};

export type Arch4LayoutConfig = {
  schemaVersion: 1;
  views: Record<
    string,
    {
      direction?: LayoutDirection;
    }
  >;
};

export type Arch4ManualLayout = {
  schemaVersion: 1;
  views: Record<
    string,
    {
      nodes?: Record<
        string,
        {
          x: number;
          y: number;
        }
      >;
    }
  >;
};

export type ValidationResult<T> = {
  value?: T;
  diagnostics: Diagnostic[];
};

export type RuntimeManifest = {
  schemaVersion: 1;
  platform: {
    os: string;
    arch: string;
  };
  tools: Array<{
    name: "java" | "structurizr";
    version: string;
    license: string;
    url: string;
    sha256: string;
    relativeExecutable: string;
  }>;
};

export type Arch4Paths = {
  root: string;
  arch4Root: string;
  architectureRoot: string;
  manifestPath: string;
  workspaceDslPath: string;
  entitiesDir: string;
  buildDir: string;
  viewsDir: string;
  contextDir: string;
  architectureIndexPath: string;
  diagnosticsPath: string;
  layoutConfigPath: string;
  manualLayoutPath: string;
};

export function resolveArch4Paths(projectRoot: string): Arch4Paths {
  const root = path.resolve(projectRoot);
  const arch4Root = path.join(root, ARCH4_DIR);
  const architectureRoot = path.join(arch4Root, ARCH4_ARCHITECTURE_DIR);
  const buildDir = path.join(architectureRoot, "build");
  return {
    root,
    arch4Root,
    architectureRoot,
    manifestPath: path.join(architectureRoot, ARCH4_MANIFEST_FILE),
    workspaceDslPath: path.join(architectureRoot, ARCH4_WORKSPACE_FILE),
    entitiesDir: path.join(architectureRoot, "entities"),
    buildDir,
    viewsDir: path.join(buildDir, "views"),
    contextDir: path.join(buildDir, "context"),
    architectureIndexPath: path.join(buildDir, ARCH4_INDEX_FILE),
    diagnosticsPath: path.join(buildDir, ARCH4_DIAGNOSTICS_FILE),
    layoutConfigPath: path.join(architectureRoot, "layout.json"),
    manualLayoutPath: path.join(architectureRoot, ARCH4_MANUAL_LAYOUT_FILE),
  };
}

export function ensureArch4Layout(
  projectRoot: string,
  projectName = path.basename(projectRoot),
): Arch4Paths {
  const paths = resolveArch4Paths(projectRoot);
  [
    paths.architectureRoot,
    paths.entitiesDir,
    paths.buildDir,
    paths.viewsDir,
    paths.contextDir,
  ].forEach((dir) => mkdirSync(dir, { recursive: true }));

  if (!existsSync(paths.manifestPath)) {
    writeJson(paths.manifestPath, defaultManifest(projectName));
  }
  if (!existsSync(paths.workspaceDslPath)) {
    writeFileSync(
      paths.workspaceDslPath,
      defaultWorkspaceDsl(projectName),
      "utf8",
    );
  }
  return paths;
}

export function isArch4WorkspaceInitialized(projectRoot: string): boolean {
  const paths = resolveArch4Paths(projectRoot);
  return existsSync(paths.manifestPath) && existsSync(paths.workspaceDslPath);
}

export function requireArch4Workspace(projectRoot: string): Arch4Paths {
  const paths = resolveArch4Paths(projectRoot);
  if (isArch4WorkspaceInitialized(projectRoot)) return paths;
  throw new Error(
    "arch4.workspace.not_initialized: Arch4 workspace is not initialized. Run `arch4 init` or, in Cursor, run `Arch4: Create/Update Architecture Model`.",
  );
}

export function defaultManifest(name: string): Arch4ProjectManifest {
  return {
    schemaVersion: 1,
    name,
    createdAt: new Date().toISOString(),
    source: {
      dsl: "workspace.dsl",
      entitiesDir: "entities",
      buildDir: "build",
    },
    tools: {
      arch4: "0.1.0",
    },
  };
}

export function defaultWorkspaceDsl(name: string): string {
  const escaped = name.replaceAll('"', '\\"');
  return `workspace "${escaped}" "AI-maintained architecture model." {
    !identifiers hierarchical

    model {
    }

    views {
        theme default
    }
}
`;
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readArch4LayoutConfig(
  filePath: string,
): ValidationResult<Arch4LayoutConfig> {
  if (!existsSync(filePath)) {
    return { value: defaultArch4LayoutConfig(), diagnostics: [] };
  }
  const parsed = parseJsonFile(filePath);
  if (!parsed.value) return { diagnostics: parsed.diagnostics };
  const validated = validateArch4LayoutConfig(parsed.value, filePath);
  return {
    value: validated.value,
    diagnostics: [...parsed.diagnostics, ...validated.diagnostics],
  };
}

export function writeArch4LayoutConfig(
  filePath: string,
  config: Arch4LayoutConfig,
): void {
  writeJson(filePath, config);
}

export function defaultArch4LayoutConfig(): Arch4LayoutConfig {
  return { schemaVersion: 1, views: {} };
}

export function readArch4ManualLayout(
  filePath: string,
): ValidationResult<Arch4ManualLayout> {
  if (!existsSync(filePath)) {
    return { value: defaultArch4ManualLayout(), diagnostics: [] };
  }
  const parsed = parseJsonFile(filePath);
  if (!parsed.value) return { diagnostics: parsed.diagnostics };
  const validated = validateArch4ManualLayout(parsed.value, filePath);
  return {
    value: validated.value,
    diagnostics: [...parsed.diagnostics, ...validated.diagnostics],
  };
}

export function writeArch4ManualLayout(
  filePath: string,
  manualLayout: Arch4ManualLayout,
): void {
  writeJson(filePath, compactArch4ManualLayout(manualLayout));
}

export function defaultArch4ManualLayout(): Arch4ManualLayout {
  return { schemaVersion: 1, views: {} };
}

export function compactArch4ManualLayout(
  manualLayout: Arch4ManualLayout,
): Arch4ManualLayout {
  const views: Arch4ManualLayout["views"] = {};
  for (const [viewId, view] of Object.entries(manualLayout.views)) {
    const nodes: NonNullable<Arch4ManualLayout["views"][string]["nodes"]> = {};
    for (const [nodeId, position] of Object.entries(view.nodes ?? {})) {
      if (Number.isFinite(position.x) && Number.isFinite(position.y)) {
        nodes[nodeId] = { x: position.x, y: position.y };
      }
    }
    const compactView: Arch4ManualLayout["views"][string] = {};
    if (Object.keys(nodes).length > 0) compactView.nodes = nodes;
    if (compactView.nodes) views[viewId] = compactView;
  }
  return { schemaVersion: 1, views };
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function safeId(value: string, fallback = "item"): string {
  return (
    value.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || fallback
  );
}

export function parseJsonFile(filePath: string): ValidationResult<unknown> {
  try {
    return {
      value: JSON.parse(readFileSync(filePath, "utf8")) as unknown,
      diagnostics: [],
    };
  } catch (error) {
    return {
      diagnostics: [
        {
          level: "error",
          code: "arch4.json.invalid",
          message: `Could not parse JSON: ${error instanceof Error ? error.message : String(error)}`,
          path: filePath,
        },
      ],
    };
  }
}

export function validateArch4ProjectManifest(
  value: unknown,
  filePath?: string,
): ValidationResult<Arch4ProjectManifest> {
  const diagnostics = baseObjectDiagnostics(
    value,
    "arch4.manifest.invalid",
    "Arch4 project manifest",
    filePath,
  );
  if (diagnostics.length) return { diagnostics };
  const candidate = value as Partial<Arch4ProjectManifest>;
  requireLiteral(
    candidate.schemaVersion,
    1,
    diagnostics,
    "arch4.manifest.schema_version",
    "schemaVersion must be 1.",
    filePath,
  );
  requireString(
    candidate.name,
    diagnostics,
    "arch4.manifest.name",
    "name must be a string.",
    filePath,
  );
  requireString(
    candidate.createdAt,
    diagnostics,
    "arch4.manifest.created_at",
    "createdAt must be an ISO timestamp string.",
    filePath,
  );
  requireRecord(
    candidate.source,
    diagnostics,
    "arch4.manifest.source",
    "source must be an object.",
    filePath,
  );
  if (isRecord(candidate.source)) {
    requireString(
      candidate.source.dsl,
      diagnostics,
      "arch4.manifest.source.dsl",
      "source.dsl must be a string.",
      filePath,
    );
    requireString(
      candidate.source.entitiesDir,
      diagnostics,
      "arch4.manifest.source.entities_dir",
      "source.entitiesDir must be a string.",
      filePath,
    );
    requireString(
      candidate.source.buildDir,
      diagnostics,
      "arch4.manifest.source.build_dir",
      "source.buildDir must be a string.",
      filePath,
    );
  }
  requireRecord(
    candidate.tools,
    diagnostics,
    "arch4.manifest.tools",
    "tools must be an object.",
    filePath,
  );
  if (isRecord(candidate.tools)) {
    requireString(
      candidate.tools.arch4,
      diagnostics,
      "arch4.manifest.tools.arch4",
      "tools.arch4 must be a string.",
      filePath,
    );
  }
  return diagnostics.length
    ? { diagnostics }
    : { value: candidate as Arch4ProjectManifest, diagnostics };
}

export function validateEntityMetadata(
  value: unknown,
  filePath?: string,
): ValidationResult<EntityMetadata> {
  const diagnostics = baseObjectDiagnostics(
    value,
    "arch4.metadata.invalid",
    "Entity metadata",
    filePath,
  );
  if (diagnostics.length) return { diagnostics };
  const candidate = value as Partial<EntityMetadata>;
  requireLiteral(
    candidate.schemaVersion,
    1,
    diagnostics,
    "arch4.metadata.schema_version",
    "schemaVersion must be 1.",
    filePath,
  );
  requireString(
    candidate.entityId,
    diagnostics,
    "arch4.metadata.entity_id",
    "entityId must be a string.",
    filePath,
  );
  optionalStringArray(
    candidate.paths,
    diagnostics,
    "arch4.metadata.paths",
    "paths must be an array of strings.",
    filePath,
  );
  optionalStringArray(
    candidate.owners,
    diagnostics,
    "arch4.metadata.owners",
    "owners must be an array of strings.",
    filePath,
  );
  optionalStringArray(
    candidate.openQuestions,
    diagnostics,
    "arch4.metadata.open_questions",
    "openQuestions must be an array of strings.",
    filePath,
  );
  if (candidate.notes !== undefined && !isRecord(candidate.notes)) {
    diagnostics.push(
      error("arch4.metadata.notes", "notes must be an object.", filePath),
    );
  }
  return diagnostics.length
    ? { diagnostics }
    : { value: candidate as EntityMetadata, diagnostics };
}

export function validateDiagramSpec(
  value: unknown,
  filePath?: string,
): ValidationResult<DiagramSpec> {
  const diagnostics = baseObjectDiagnostics(
    value,
    "arch4.view.invalid",
    "Diagram spec",
    filePath,
  );
  if (diagnostics.length) return { diagnostics };
  const candidate = value as Partial<DiagramSpec>;
  requireString(
    candidate.id,
    diagnostics,
    "arch4.view.id",
    "id must be a string.",
    filePath,
  );
  requireString(
    candidate.name,
    diagnostics,
    "arch4.view.name",
    "name must be a string.",
    filePath,
  );
  requireString(
    candidate.type,
    diagnostics,
    "arch4.view.type",
    "type must be a string.",
    filePath,
  );
  requireArray(
    candidate.nodes,
    diagnostics,
    "arch4.view.nodes",
    "nodes must be an array.",
    filePath,
  );
  requireArray(
    candidate.edges,
    diagnostics,
    "arch4.view.edges",
    "edges must be an array.",
    filePath,
  );
  return diagnostics.length
    ? { diagnostics }
    : { value: candidate as DiagramSpec, diagnostics };
}

export function validateArch4LayoutConfig(
  value: unknown,
  filePath?: string,
): ValidationResult<Arch4LayoutConfig> {
  const diagnostics = baseObjectDiagnostics(
    value,
    "arch4.layout_config.invalid",
    "Layout config",
    filePath,
  );
  if (diagnostics.length) return { diagnostics };
  const candidate = value as Partial<Arch4LayoutConfig>;
  requireLiteral(
    candidate.schemaVersion,
    1,
    diagnostics,
    "arch4.layout_config.schema_version",
    "schemaVersion must be 1.",
    filePath,
  );
  requireRecord(
    candidate.views,
    diagnostics,
    "arch4.layout_config.views",
    "views must be an object.",
    filePath,
  );
  if (isRecord(candidate.views)) {
    for (const [viewId, viewConfig] of Object.entries(candidate.views)) {
      if (!isRecord(viewConfig)) {
        diagnostics.push(
          error(
            "arch4.layout_config.view",
            `views.${viewId} must be an object.`,
            filePath,
          ),
        );
        continue;
      }
      const direction = viewConfig.direction;
      if (direction !== undefined && !isLayoutDirection(direction)) {
        diagnostics.push(
          error(
            "arch4.layout_config.direction",
            `views.${viewId}.direction must be RIGHT, DOWN, LEFT, or UP.`,
            filePath,
          ),
        );
      }
    }
  }
  return diagnostics.length
    ? { diagnostics }
    : { value: candidate as Arch4LayoutConfig, diagnostics };
}

export function validateArch4ManualLayout(
  value: unknown,
  filePath?: string,
): ValidationResult<Arch4ManualLayout> {
  const diagnostics = baseObjectDiagnostics(
    value,
    "arch4.manual_layout.invalid",
    "Manual layout",
    filePath,
  );
  if (diagnostics.length) return { diagnostics };
  const candidate = value as Partial<Arch4ManualLayout>;
  requireLiteral(
    candidate.schemaVersion,
    1,
    diagnostics,
    "arch4.manual_layout.schema_version",
    "schemaVersion must be 1.",
    filePath,
  );
  requireRecord(
    candidate.views,
    diagnostics,
    "arch4.manual_layout.views",
    "views must be an object.",
    filePath,
  );
  if (isRecord(candidate.views)) {
    for (const [viewId, viewConfig] of Object.entries(candidate.views)) {
      if (!isRecord(viewConfig)) {
        diagnostics.push(
          error(
            "arch4.manual_layout.view",
            `views.${viewId} must be an object.`,
            filePath,
          ),
        );
        continue;
      }
      if (viewConfig.nodes !== undefined) {
        requireRecord(
          viewConfig.nodes,
          diagnostics,
          "arch4.manual_layout.nodes",
          `views.${viewId}.nodes must be an object.`,
          filePath,
        );
        if (isRecord(viewConfig.nodes)) {
          validateManualPositions(
            viewConfig.nodes,
            `views.${viewId}.nodes`,
            diagnostics,
            filePath,
          );
        }
      }
      if (
        viewConfig.nodes === undefined &&
        !isRecord((viewConfig as Record<string, unknown>).edgeLabels)
      ) {
        diagnostics.push(
          error(
            "arch4.manual_layout.view_empty",
            `views.${viewId} must define nodes.`,
            filePath,
          ),
        );
      }
    }
  }
  return diagnostics.length
    ? { diagnostics }
    : { value: candidate as Arch4ManualLayout, diagnostics };
}

function validateManualPositions(
  positions: Record<string, unknown>,
  pathLabel: string,
  diagnostics: Diagnostic[],
  filePath?: string,
): void {
  for (const [itemId, position] of Object.entries(positions)) {
    if (!isRecord(position)) {
      diagnostics.push(
        error(
          "arch4.manual_layout.item",
          `${pathLabel}.${itemId} must be an object.`,
          filePath,
        ),
      );
      continue;
    }
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      diagnostics.push(
        error(
          "arch4.manual_layout.position",
          `${pathLabel}.${itemId}.x and y must be finite numbers.`,
          filePath,
        ),
      );
    }
  }
}

export function isLayoutDirection(value: unknown): value is LayoutDirection {
  return (
    value === "RIGHT" || value === "DOWN" || value === "LEFT" || value === "UP"
  );
}

export function validateArchitectureIndex(
  value: unknown,
  filePath?: string,
): ValidationResult<ArchitectureIndex> {
  const diagnostics = baseObjectDiagnostics(
    value,
    "arch4.index.invalid",
    "Architecture index",
    filePath,
  );
  if (diagnostics.length) return { diagnostics };
  const candidate = value as Partial<ArchitectureIndex>;
  requireLiteral(
    candidate.schemaVersion,
    1,
    diagnostics,
    "arch4.index.schema_version",
    "schemaVersion must be 1.",
    filePath,
  );
  requireString(
    candidate.generatedAt,
    diagnostics,
    "arch4.index.generated_at",
    "generatedAt must be a string.",
    filePath,
  );
  requireString(
    candidate.projectRoot,
    diagnostics,
    "arch4.index.project_root",
    "projectRoot must be a string.",
    filePath,
  );
  requireArray(
    candidate.elements,
    diagnostics,
    "arch4.index.elements",
    "elements must be an array.",
    filePath,
  );
  requireArray(
    candidate.relationships,
    diagnostics,
    "arch4.index.relationships",
    "relationships must be an array.",
    filePath,
  );
  requireArray(
    candidate.views,
    diagnostics,
    "arch4.index.views",
    "views must be an array.",
    filePath,
  );
  requireArray(
    candidate.diagnostics,
    diagnostics,
    "arch4.index.diagnostics",
    "diagnostics must be an array.",
    filePath,
  );
  return diagnostics.length
    ? { diagnostics }
    : { value: candidate as ArchitectureIndex, diagnostics };
}

export function validateDiagnostics(
  value: unknown,
  filePath?: string,
): ValidationResult<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  if (!Array.isArray(value)) {
    return {
      diagnostics: [
        error(
          "arch4.diagnostics.invalid",
          "Diagnostics must be an array.",
          filePath,
        ),
      ],
    };
  }
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      diagnostics.push(
        error(
          "arch4.diagnostics.item",
          `diagnostics[${index}] must be an object.`,
          filePath,
        ),
      );
      return;
    }
    if (!["info", "warning", "error"].includes(String(item.level))) {
      diagnostics.push(
        error(
          "arch4.diagnostics.level",
          `diagnostics[${index}].level must be info, warning, or error.`,
          filePath,
        ),
      );
    }
    requireString(
      item.code,
      diagnostics,
      "arch4.diagnostics.code",
      `diagnostics[${index}].code must be a string.`,
      filePath,
    );
    requireString(
      item.message,
      diagnostics,
      "arch4.diagnostics.message",
      `diagnostics[${index}].message must be a string.`,
      filePath,
    );
  });
  return diagnostics.length
    ? { diagnostics }
    : { value: value as Diagnostic[], diagnostics };
}

export function validateRuntimeManifest(
  value: unknown,
  filePath?: string,
): ValidationResult<RuntimeManifest> {
  const diagnostics = baseObjectDiagnostics(
    value,
    "arch4.runtime_manifest.invalid",
    "Runtime manifest",
    filePath,
  );
  if (diagnostics.length) return { diagnostics };
  const candidate = value as Partial<RuntimeManifest>;
  requireLiteral(
    candidate.schemaVersion,
    1,
    diagnostics,
    "arch4.runtime_manifest.schema_version",
    "schemaVersion must be 1.",
    filePath,
  );
  requireRecord(
    candidate.platform,
    diagnostics,
    "arch4.runtime_manifest.platform",
    "platform must be an object.",
    filePath,
  );
  if (isRecord(candidate.platform)) {
    requireString(
      candidate.platform.os,
      diagnostics,
      "arch4.runtime_manifest.platform.os",
      "platform.os must be a string.",
      filePath,
    );
    requireString(
      candidate.platform.arch,
      diagnostics,
      "arch4.runtime_manifest.platform.arch",
      "platform.arch must be a string.",
      filePath,
    );
  }
  requireArray(
    candidate.tools,
    diagnostics,
    "arch4.runtime_manifest.tools",
    "tools must be an array.",
    filePath,
  );
  if (Array.isArray(candidate.tools)) {
    candidate.tools.forEach((tool, index) => {
      if (!isRecord(tool)) {
        diagnostics.push(
          error(
            "arch4.runtime_manifest.tool",
            `tools[${index}] must be an object.`,
            filePath,
          ),
        );
        return;
      }
      requireString(
        tool.name,
        diagnostics,
        "arch4.runtime_manifest.tool.name",
        `tools[${index}].name must be a string.`,
        filePath,
      );
      requireString(
        tool.version,
        diagnostics,
        "arch4.runtime_manifest.tool.version",
        `tools[${index}].version must be a string.`,
        filePath,
      );
      requireString(
        tool.license,
        diagnostics,
        "arch4.runtime_manifest.tool.license",
        `tools[${index}].license must be a string.`,
        filePath,
      );
      requireString(
        tool.url,
        diagnostics,
        "arch4.runtime_manifest.tool.url",
        `tools[${index}].url must be a string.`,
        filePath,
      );
      requireString(
        tool.sha256,
        diagnostics,
        "arch4.runtime_manifest.tool.sha256",
        `tools[${index}].sha256 must be a string.`,
        filePath,
      );
      requireString(
        tool.relativeExecutable,
        diagnostics,
        "arch4.runtime_manifest.tool.relative_executable",
        `tools[${index}].relativeExecutable must be a string.`,
        filePath,
      );
    });
  }
  return diagnostics.length
    ? { diagnostics }
    : { value: candidate as RuntimeManifest, diagnostics };
}

function baseObjectDiagnostics(
  value: unknown,
  code: string,
  label: string,
  filePath?: string,
): Diagnostic[] {
  return isRecord(value)
    ? []
    : [error(code, `${label} must be a JSON object.`, filePath)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  diagnostics: Diagnostic[],
  code: string,
  message: string,
  filePath?: string,
): void {
  if (!isRecord(value)) diagnostics.push(error(code, message, filePath));
}

function requireArray(
  value: unknown,
  diagnostics: Diagnostic[],
  code: string,
  message: string,
  filePath?: string,
): void {
  if (!Array.isArray(value)) diagnostics.push(error(code, message, filePath));
}

function requireLiteral(
  value: unknown,
  expected: unknown,
  diagnostics: Diagnostic[],
  code: string,
  message: string,
  filePath?: string,
): void {
  if (value !== expected) diagnostics.push(error(code, message, filePath));
}

function requireString(
  value: unknown,
  diagnostics: Diagnostic[],
  code: string,
  message: string,
  filePath?: string,
): void {
  if (typeof value !== "string" || value.length === 0)
    diagnostics.push(error(code, message, filePath));
}

function optionalStringArray(
  value: unknown,
  diagnostics: Diagnostic[],
  code: string,
  message: string,
  filePath?: string,
): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
  ) {
    diagnostics.push(error(code, message, filePath));
  }
}

function error(code: string, message: string, filePath?: string): Diagnostic {
  return {
    level: "error",
    code,
    message,
    path: filePath,
  };
}
