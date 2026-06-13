import { existsSync } from "node:fs";
import path from "node:path";
import {
  type Diagnostic,
  readArch4LayoutConfig,
  readArch4ManualLayout,
  resolveArch4Paths,
  toPosixPath,
  writeJson,
} from "@arch4/core";
import { layoutDiagramSpec } from "./layout.js";
import { normalizeStructurizrWorkspace } from "./normalize.js";
import { replaceRenderedViews } from "./output.js";
import { exportWorkspace, isStructurizrProcessError } from "./process.js";
import { resolveJava, resolveStructurizrCli } from "./runtime.js";
import type { RenderOptions, RenderResult } from "./types.js";

export type { RenderOptions, RenderResult } from "./types.js";
export { normalizeStructurizrWorkspace } from "./normalize.js";
export { layoutDiagramSpec } from "./layout.js";
export { exportWorkspace } from "./process.js";

export function renderArch4Workspace(options: RenderOptions): RenderResult {
  const paths = resolveArch4Paths(options.projectRoot);
  const writeOutputs = options.writeOutputs ?? true;
  const diagnostics: Diagnostic[] = [];
  const fail = (items: Diagnostic[]): RenderResult => {
    if (writeOutputs) {
      replaceRenderedViews(paths.viewsDir, []);
      writeJson(paths.diagnosticsPath, items);
    }
    return { diagnostics: items, specs: [] };
  };
  if (!existsSync(paths.workspaceDslPath)) {
    return fail([
      {
        level: "error",
        code: "arch4.workspace.missing",
        message: `Architecture model is missing: ${toPosixPath(path.relative(options.projectRoot, paths.workspaceDslPath))}`,
      },
    ]);
  }

  const cliPath = resolveStructurizrCli(options.structurizrCliPath);
  if (!cliPath) {
    return fail([
      {
        level: "error",
        code: "arch4.structurizr.missing",
        message:
          "Structurizr CLI was not found. Run arch4 doctor for bundled runtime diagnostics.",
      },
    ]);
  }

  const javaPath = resolveJava(options.javaPath);
  if (!javaPath) {
    return fail([
      {
        level: "error",
        code: "arch4.java.missing",
        message:
          "Java runtime was not found. Run pnpm setup:runtime or configure JAVA_HOME.",
      },
    ]);
  }

  let workspaceJson: Record<string, unknown>;
  try {
    workspaceJson = exportWorkspace(paths.workspaceDslPath, cliPath, javaPath);
  } catch (error) {
    if (isStructurizrProcessError(error)) return fail([error.diagnostic]);
    throw error;
  }
  const normalized = normalizeStructurizrWorkspace(workspaceJson);
  const layoutConfig = readArch4LayoutConfig(paths.layoutConfigPath);
  const manualLayout = readArch4ManualLayout(paths.manualLayoutPath);
  diagnostics.push(...layoutConfig.diagnostics, ...manualLayout.diagnostics);
  const layoutViews = layoutConfig.value?.views ?? {};
  const manualLayoutViews = manualLayout.value?.views ?? {};
  normalized.specs = normalized.specs.map((spec) => {
    return layoutDiagramSpec(spec, {
      direction: layoutViews[spec.id]?.direction ?? spec.direction ?? "RIGHT",
      manualPositions: manualLayoutViews[spec.id]?.nodes,
    });
  });
  normalized.diagnostics.unshift(...diagnostics);
  if (writeOutputs) {
    replaceRenderedViews(paths.viewsDir, normalized.specs);
    writeJson(paths.diagnosticsPath, normalized.diagnostics);
  }
  return {
    diagnostics: normalized.diagnostics,
    specs: normalized.specs,
    workspaceJson,
  };
}
