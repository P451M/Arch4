import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type Arch4LayoutConfig,
  type Arch4ManualLayout,
  type ArchitectureIndex,
  type DiagramSpec,
  type Diagnostic,
  type EntityMetadata,
  type LayoutDirection,
  defaultArch4LayoutConfig,
  defaultArch4ManualLayout,
  ensureArch4Layout,
  isLayoutDirection,
  parseJsonFile,
  readArch4LayoutConfig,
  readArch4ManualLayout,
  requireArch4Workspace,
  resolveArch4Paths,
  safeId,
  toPosixPath,
  validateArchitectureIndex,
  validateDiagnostics,
  validateDiagramSpec,
  validateEntityMetadata,
  writeArch4LayoutConfig,
  writeArch4ManualLayout,
  writeJson,
} from "@arch4/core";
import { buildArchitectureIndex, writeContextFiles } from "@arch4/cli/indexer";
import { layoutDiagramSpec } from "@arch4/layout";
import { renderArch4Workspace } from "@arch4/renderer-structurizr";

export type Arch4ViewerPayload = {
  diagrams: DiagramSpec[];
  index?: ArchitectureIndex;
  diagnostics: Diagnostic[];
  layoutDirections: Record<string, LayoutDirection>;
  manualLayoutDiagramIds: string[];
};

export type ReadDiagramsResult = {
  diagrams: DiagramSpec[];
  diagnostics: Diagnostic[];
};

export type ReadArchitectureIndexResult = {
  index?: ArchitectureIndex;
  diagnostics: Diagnostic[];
};

export type BuildArtifactsResult = {
  renderedViews: number;
  indexedViews: number;
  diagnostics: Diagnostic[];
  index?: ArchitectureIndex;
};

export type BuildArtifactsOptions = {
  preserveViewsOnError?: boolean;
};

export type ArchitectureSourceEntity = EntityMetadata;

export type WriteArchitectureSourceInput = {
  workspaceDsl?: string;
  entities?: ArchitectureSourceEntity[];
  removeMissingEntities?: boolean;
};

export type WriteArchitectureSourceResult = {
  written: string[];
  removed: string[];
  diagnostics: Diagnostic[];
};

export type UpdateLayoutInput =
  | {
      diagramId: string;
      direction: LayoutDirection;
    }
  | {
      diagramId: string;
      nodeId: string;
      x: number;
      y: number;
    }
  | {
      diagramId: string;
      resetManualLayout: true;
    };

export function resolveProjectRoot(projectRoot?: string): string {
  return path.resolve(
    projectRoot ?? process.env.ARCH4_PROJECT_ROOT ?? process.cwd(),
  );
}

export function prepareArchitectureWorkspace(projectRoot?: string): {
  root: string;
  architectureRoot: string;
  workspaceDslPath: string;
  entitiesDir: string;
} {
  const root = resolveProjectRoot(projectRoot);
  const paths = ensureArch4Layout(root, path.basename(root));
  return {
    root,
    architectureRoot: paths.architectureRoot,
    workspaceDslPath: paths.workspaceDslPath,
    entitiesDir: paths.entitiesDir,
  };
}

export async function createViewerPayload(
  projectRoot?: string,
): Promise<Arch4ViewerPayload> {
  const root = resolveProjectRoot(projectRoot);
  const paths = resolveArch4Paths(root);
  const diagramResult = await readDiagrams(root, paths.viewsDir);
  const indexResult = await readArchitectureIndex(
    root,
    paths.architectureIndexPath,
  );
  const diagnostics = await readWorkspaceDiagnostics(
    root,
    paths,
    diagramResult,
    indexResult,
  );
  const layoutConfig = readArch4LayoutConfig(paths.layoutConfigPath);
  const manualLayout = readArch4ManualLayout(paths.manualLayoutPath);
  const diagrams = applyLayoutSidecarsToDiagrams(
    diagramResult.diagrams,
    layoutConfig.value,
    manualLayout.value,
  );
  return {
    diagrams,
    index: indexResult.index,
    diagnostics: dedupeDiagnostics([
      ...diagnostics,
      ...layoutConfig.diagnostics,
      ...manualLayout.diagnostics,
    ]),
    layoutDirections: layoutDirectionsFromConfig(layoutConfig.value),
    manualLayoutDiagramIds: manualLayoutDiagramIdsFromConfig(
      manualLayout.value,
    ),
  };
}

export async function readDiagrams(
  root: string,
  viewsDir: string,
): Promise<ReadDiagramsResult> {
  const diagrams: DiagramSpec[] = [];
  const diagnostics: Diagnostic[] = [];
  try {
    const files = await readdir(viewsDir);
    for (const file of files.filter((item) => item.endsWith(".json"))) {
      const filePath = path.join(viewsDir, file);
      const relativePath = toPosixPath(path.relative(root, filePath));
      const parsed = parseJsonFile(filePath);
      diagnostics.push(...withPath(parsed.diagnostics, relativePath));
      if (!parsed.value) continue;
      const validated = validateDiagramSpec(parsed.value, relativePath);
      diagnostics.push(...validated.diagnostics);
      if (validated.value) diagrams.push(validated.value);
    }
  } catch {
    return { diagrams, diagnostics };
  }
  return { diagrams, diagnostics };
}

export async function readArchitectureIndex(
  root: string,
  filePath: string,
): Promise<ReadArchitectureIndexResult> {
  if (!existsSync(filePath)) return { diagnostics: [] };
  const relativePath = toPosixPath(path.relative(root, filePath));
  const parsed = parseJsonFile(filePath);
  const diagnostics = withPath(parsed.diagnostics, relativePath);
  if (!parsed.value) return { diagnostics };
  const validated = validateArchitectureIndex(parsed.value, relativePath);
  return {
    index: validated.value,
    diagnostics: [...diagnostics, ...validated.diagnostics],
  };
}

export async function readDiagnosticsFile(
  root: string,
  filePath: string,
): Promise<Diagnostic[]> {
  if (!existsSync(filePath)) return [];
  const relativePath = toPosixPath(path.relative(root, filePath));
  const parsed = parseJsonFile(filePath);
  const diagnostics = withPath(parsed.diagnostics, relativePath);
  if (!parsed.value) return diagnostics;
  const validated = validateDiagnostics(parsed.value, relativePath);
  return [...diagnostics, ...(validated.value ?? []), ...validated.diagnostics];
}

export async function readWorkspaceDiagnostics(
  root: string,
  paths: ReturnType<typeof resolveArch4Paths>,
  diagramResult: ReadDiagramsResult,
  indexResult: ReadArchitectureIndexResult,
): Promise<Diagnostic[]> {
  const diagnosticsFile = await readDiagnosticsFile(
    root,
    paths.diagnosticsPath,
  );
  return dedupeDiagnostics([
    ...diagramResult.diagnostics,
    ...indexResult.diagnostics,
    ...(indexResult.index?.diagnostics ?? []),
    ...diagnosticsFile,
  ]);
}

export function buildArchitectureArtifacts(
  projectRoot?: string,
  options: BuildArtifactsOptions = {},
): BuildArtifactsResult {
  const root = resolveProjectRoot(projectRoot);
  const paths = requireArch4Workspace(root);
  const renderResult = renderArch4Workspace({
    projectRoot: root,
    writeOutputs: true,
    preserveViewsOnError: options.preserveViewsOnError,
  });
  const renderErrors = renderResult.diagnostics.filter(
    (item) => item.level === "error",
  );
  if (renderErrors.length) {
    return {
      renderedViews: renderResult.specs.length,
      indexedViews: 0,
      diagnostics: renderResult.diagnostics,
    };
  }
  const index = buildArchitectureIndex(root);
  writeJson(paths.architectureIndexPath, index);
  writeContextFiles(root, index);
  return {
    renderedViews: renderResult.specs.length,
    indexedViews: index.views.length,
    diagnostics: dedupeDiagnostics([
      ...renderResult.diagnostics,
      ...index.diagnostics,
    ]),
    index,
  };
}

export async function writeArchitectureSource(
  projectRoot: string | undefined,
  input: WriteArchitectureSourceInput,
): Promise<WriteArchitectureSourceResult> {
  const root = resolveProjectRoot(projectRoot);
  const paths = ensureArch4Layout(root, path.basename(root));
  const diagnostics: Diagnostic[] = [];
  const written: string[] = [];
  const removed: string[] = [];

  if (input.workspaceDsl !== undefined) {
    if (!input.workspaceDsl.trim()) {
      diagnostics.push({
        level: "error",
        code: "arch4.source.workspace.empty",
        message: "workspaceDsl must not be empty.",
        path: toPosixPath(path.relative(root, paths.workspaceDslPath)),
      });
    } else {
      await writeFile(paths.workspaceDslPath, input.workspaceDsl, "utf8");
      written.push(toPosixPath(path.relative(root, paths.workspaceDslPath)));
    }
  }

  if (input.entities) {
    await mkdir(paths.entitiesDir, { recursive: true });
    const desiredFiles = new Set<string>();
    for (const entity of input.entities) {
      const filePath = path.join(
        paths.entitiesDir,
        `${safeId(entity.entityId)}.json`,
      );
      const relativePath = toPosixPath(path.relative(root, filePath));
      desiredFiles.add(path.basename(filePath));
      const validated = validateEntityMetadata(entity, relativePath);
      diagnostics.push(...validated.diagnostics);
      if (!validated.value) continue;
      await writeFile(
        filePath,
        `${JSON.stringify(validated.value, null, 2)}\n`,
        "utf8",
      );
      written.push(relativePath);
    }
    if (input.removeMissingEntities) {
      const existing = await readdir(paths.entitiesDir).catch(() => []);
      for (const file of existing.filter((item) => item.endsWith(".json"))) {
        if (desiredFiles.has(file)) continue;
        const filePath = path.join(paths.entitiesDir, file);
        await rm(filePath, { force: true });
        removed.push(toPosixPath(path.relative(root, filePath)));
      }
    }
  }

  return { written, removed, diagnostics: dedupeDiagnostics(diagnostics) };
}

export function updateArchitectureLayout(
  projectRoot: string | undefined,
  input: UpdateLayoutInput,
): void {
  const root = resolveProjectRoot(projectRoot);
  const paths = requireArch4Workspace(root);
  if ("direction" in input) {
    if (!isLayoutDirection(input.direction)) {
      throw new Error(`Invalid layout direction: ${input.direction}`);
    }
    const current = readArch4LayoutConfig(paths.layoutConfigPath);
    const config: Arch4LayoutConfig =
      current.value ?? defaultArch4LayoutConfig();
    writeArch4LayoutConfig(paths.layoutConfigPath, {
      ...config,
      views: {
        ...config.views,
        [input.diagramId]: {
          ...config.views[input.diagramId],
          direction: input.direction,
        },
      },
    });
    clearManualLayoutView(paths.manualLayoutPath, input.diagramId);
    return;
  }
  if ("resetManualLayout" in input) {
    clearManualLayoutView(paths.manualLayoutPath, input.diagramId);
    return;
  }
  const current = readArch4ManualLayout(paths.manualLayoutPath);
  const manualLayout: Arch4ManualLayout =
    current.value ?? defaultArch4ManualLayout();
  writeArch4ManualLayout(paths.manualLayoutPath, {
    ...manualLayout,
    views: {
      ...manualLayout.views,
      [input.diagramId]: {
        ...(manualLayout.views[input.diagramId] ?? {}),
        nodes: {
          ...(manualLayout.views[input.diagramId]?.nodes ?? {}),
          [input.nodeId]: { x: Math.round(input.x), y: Math.round(input.y) },
        },
      },
    },
  });
}

export async function readArchitectureSource(projectRoot?: string): Promise<{
  workspaceDsl?: string;
  entities: EntityMetadata[];
  diagnostics: Diagnostic[];
}> {
  const root = resolveProjectRoot(projectRoot);
  const paths = resolveArch4Paths(root);
  const diagnostics: Diagnostic[] = [];
  const workspaceDsl = existsSync(paths.workspaceDslPath)
    ? await readFile(paths.workspaceDslPath, "utf8")
    : undefined;
  const entities: EntityMetadata[] = [];
  const files = await readdir(paths.entitiesDir).catch(() => []);
  for (const file of files.filter((item) => item.endsWith(".json"))) {
    const filePath = path.join(paths.entitiesDir, file);
    const relativePath = toPosixPath(path.relative(root, filePath));
    const parsed = parseJsonFile(filePath);
    diagnostics.push(...withPath(parsed.diagnostics, relativePath));
    if (!parsed.value) continue;
    const validated = validateEntityMetadata(parsed.value, relativePath);
    diagnostics.push(...validated.diagnostics);
    if (validated.value) entities.push(validated.value);
  }
  return {
    workspaceDsl,
    entities,
    diagnostics: dedupeDiagnostics(diagnostics),
  };
}

function clearManualLayoutView(filePath: string, diagramId: string): void {
  const current = readArch4ManualLayout(filePath);
  const manualLayout: Arch4ManualLayout =
    current.value ?? defaultArch4ManualLayout();
  if (!manualLayout.views[diagramId]) return;
  const views = { ...manualLayout.views };
  delete views[diagramId];
  writeArch4ManualLayout(filePath, {
    ...manualLayout,
    views,
  });
}

function layoutDirectionsFromConfig(
  config: Arch4LayoutConfig | undefined,
): Record<string, LayoutDirection> {
  const directions: Record<string, LayoutDirection> = {};
  for (const [viewId, viewConfig] of Object.entries(config?.views ?? {})) {
    if (viewConfig.direction) directions[viewId] = viewConfig.direction;
  }
  return directions;
}

function manualLayoutDiagramIdsFromConfig(
  config: Arch4ManualLayout | undefined,
): string[] {
  return Object.entries(config?.views ?? {})
    .filter(([, view]) => Object.keys(view.nodes ?? {}).length > 0)
    .map(([viewId]) => viewId)
    .sort();
}

function applyLayoutSidecarsToDiagrams(
  diagrams: DiagramSpec[],
  layoutConfig: Arch4LayoutConfig | undefined,
  manualLayout: Arch4ManualLayout | undefined,
): DiagramSpec[] {
  return diagrams.map((diagram) => {
    const direction = layoutConfig?.views[diagram.id]?.direction;
    const manualPositions = manualLayout?.views[diagram.id]?.nodes;
    if (!direction && !manualPositions) return diagram;
    return layoutDiagramSpec(diagram, {
      direction,
      manualPositions,
    });
  });
}

function withPath(
  diagnostics: Diagnostic[],
  relativePath: string,
): Diagnostic[] {
  return diagnostics.map((item) => ({
    ...item,
    path: relativePath,
  }));
}

function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}\u0000${diagnostic.path ?? ""}\u0000${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
