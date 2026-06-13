import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  type ArchitectureIndex,
  type DiagramSpec,
  type Diagnostic,
  type resolveArch4Paths,
  parseJsonFile,
  toPosixPath,
  validateArchitectureIndex,
  validateDiagnostics,
  validateDiagramSpec,
} from "@arch4/core";

export type ReadDiagramsResult = {
  diagrams: DiagramSpec[];
  diagnostics: Diagnostic[];
};

export type ReadArchitectureIndexResult = {
  index?: ArchitectureIndex;
  diagnostics: Diagnostic[];
};

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
