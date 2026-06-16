import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { minimatch } from "minimatch";
import {
  type ArchitectureIndex,
  type Diagnostic,
  type DiagramSpec,
  type EntityContextFile,
  type EntityMetadata,
  parseJsonFile,
  requireArch4Workspace,
  safeId,
  toPosixPath,
  validateDiagramSpec,
  validateEntityMetadata,
} from "@arch4/core";
import { renderContextMarkdown } from "./context.js";
import { generatedAt } from "./generated.js";
import { listRepoFiles } from "./repo-files.js";

export function buildArchitectureIndex(root: string): ArchitectureIndex {
  const paths = requireArch4Workspace(root);
  const specsResult = readSpecs(root, paths.viewsDir);
  const specs = specsResult.specs;
  const metadataResult = readEntityMetadata(root, paths.entitiesDir);
  const metadata = metadataResult.metadata;
  const elementsById = new Map<string, ArchitectureIndex["elements"][number]>();
  const diagnostics: Diagnostic[] = [
    ...specsResult.diagnostics,
    ...metadataResult.diagnostics,
  ];
  const unmappedEntityIds = new Set<string>();

  if (!specs.length) {
    diagnostics.push({
      level: "warning",
      code: "arch4.index.views.missing",
      message:
        "No rendered view data found. Run arch4 render before arch4 index.",
      path: toPosixPath(path.relative(root, paths.viewsDir)),
    });
  }

  specs.forEach((spec) => {
    spec.nodes.forEach((node) => {
      const entityId = node.entityId ?? node.id;
      const meta = metadata.get(entityId);
      const mappedPaths = meta?.paths ?? [];
      if (!mappedPaths.length && !unmappedEntityIds.has(entityId)) {
        diagnostics.push({
          level: "warning",
          code: "arch4.index.element.unmapped",
          message: `Architecture entity ${entityId} has no path mapping.`,
        });
        unmappedEntityIds.add(entityId);
      }
      const current = elementsById.get(entityId) ?? {
        entityId,
        name: node.name,
        type: node.type,
        description: node.description,
        tags: node.tags,
        paths: mappedPaths,
        owners: meta?.owners,
        confidence: meta?.confidence,
        openQuestions: meta?.openQuestions,
        notes: meta?.notes,
        views: [],
        contributors: [],
        recentCommits: [],
        contextPath: toPosixPath(
          path.relative(
            root,
            path.join(paths.contextDir, `${safeId(entityId)}.md`),
          ),
        ),
      };
      if (!current.views.includes(spec.id)) current.views.push(spec.id);
      elementsById.set(entityId, current);
    });
  });

  const elements = [...elementsById.values()]
    .map((element) => enrichElementWithGit(root, element))
    .sort((a, b) => a.entityId.localeCompare(b.entityId));
  metadata.forEach((item, entityId) => {
    if (elementsById.has(entityId)) return;
    diagnostics.push({
      level: "warning",
      code: "arch4.index.metadata.orphaned",
      message: `Entity metadata ${entityId} does not match any rendered architecture element.`,
      path: item.path,
    });
  });
  const elementIdByNodeId = new Map<string, string>();
  specs.forEach((spec) => {
    spec.nodes.forEach((node) =>
      elementIdByNodeId.set(node.id, node.entityId ?? node.id),
    );
  });
  const relationshipMap = new Map<
    string,
    ArchitectureIndex["relationships"][number]
  >();
  specs.forEach((spec) => {
    spec.edges.forEach((edge) => {
      const id = edge.id;
      const current = relationshipMap.get(id) ?? {
        id: edge.id,
        sourceEntityId: elementIdByNodeId.get(edge.source),
        targetEntityId: elementIdByNodeId.get(edge.target),
        label: edge.label,
        technology: edge.technology,
        views: [],
      };
      if (!current.views.includes(spec.id)) current.views.push(spec.id);
      relationshipMap.set(id, current);
    });
  });
  const relationships = [...relationshipMap.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return {
    schemaVersion: 1,
    generatedAt: generatedAt(),
    projectRoot: root,
    elements,
    relationships,
    views: specs
      .map((spec) => ({
        id: spec.id,
        name: spec.name,
        type: spec.type,
        subjectEntityId: spec.subjectEntityId,
        dataPath: toPosixPath(
          path.relative(
            root,
            path.join(paths.viewsDir, `${safeId(spec.id)}.json`),
          ),
        ),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics,
  };
}

export function writeContextFiles(
  root: string,
  index: ArchitectureIndex,
): EntityContextFile[] {
  const paths = requireArch4Workspace(root);
  mkdirSync(paths.contextDir, { recursive: true });
  return index.elements.map((element) => {
    const markdownPath = path.join(
      paths.contextDir,
      `${safeId(element.entityId)}.md`,
    );
    writeFileSync(markdownPath, renderContextMarkdown([element], []), "utf8");
    return {
      schemaVersion: 1,
      id: element.entityId,
      title: element.name,
      markdownPath: toPosixPath(path.relative(root, markdownPath)),
      elementIds: [element.entityId],
      sourcePaths: element.paths,
      generatedAt: generatedAt(),
    };
  });
}

function enrichElementWithGit(
  root: string,
  element: ArchitectureIndex["elements"][number],
): ArchitectureIndex["elements"][number] {
  if (!element.paths.length || !existsSync(path.join(root, ".git"))) {
    return element;
  }
  const paths = listRepoFiles(root)
    .filter((file) =>
      element.paths.some((glob) => minimatch(file, glob, { dot: true })),
    )
    .slice(0, 25);
  if (!paths.length) return element;
  try {
    const output = execFileSync(
      "git",
      [
        "log",
        "--date=short",
        "--format=%H%x1f%an%x1f%ae%x1f%ad%x1f%s",
        "--",
        ...paths,
      ],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const commits = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(0, 20)
      .map((line) => {
        const [hash, author, email, date, subject] = line.split("\x1f");
        return { hash, author, email, date, subject };
      });
    const contributorCounts = new Map<
      string,
      { name: string; email?: string; commits: number }
    >();
    commits.forEach((commit) => {
      const key = commit.email || commit.author;
      const current = contributorCounts.get(key) ?? {
        name: commit.author,
        email: commit.email,
        commits: 0,
      };
      current.commits += 1;
      contributorCounts.set(key, current);
    });
    return {
      ...element,
      contributors: [...contributorCounts.values()].sort(
        (a, b) => b.commits - a.commits,
      ),
      recentCommits: commits
        .slice(0, 10)
        .map(({ hash, author, date, subject }) => ({
          hash,
          author,
          date,
          subject,
        })),
    };
  } catch {
    return element;
  }
}

function readSpecs(
  root: string,
  viewsDir: string,
): { diagnostics: Diagnostic[]; specs: DiagramSpec[] } {
  const diagnostics: Diagnostic[] = [];
  const specs: DiagramSpec[] = [];
  if (!existsSync(viewsDir)) return { diagnostics, specs };
  readdirSync(viewsDir)
    .filter((file) => file.endsWith(".json"))
    .forEach((file) => {
      const filePath = path.join(viewsDir, file);
      const relativePath = toPosixPath(path.relative(root, filePath));
      const parsed = parseJsonFile(filePath);
      diagnostics.push(
        ...parsed.diagnostics.map((item) => ({ ...item, path: relativePath })),
      );
      if (!parsed.value) return;
      const validated = validateDiagramSpec(parsed.value, relativePath);
      diagnostics.push(...validated.diagnostics);
      if (validated.value) specs.push(validated.value);
    });
  return { diagnostics, specs };
}

function readEntityMetadata(
  root: string,
  entitiesDir: string,
): {
  diagnostics: Diagnostic[];
  metadata: Map<string, EntityMetadata & { path?: string }>;
} {
  const diagnostics: Diagnostic[] = [];
  const mapped = new Map<string, EntityMetadata & { path?: string }>();
  if (!existsSync(entitiesDir)) return { diagnostics, metadata: mapped };
  readdirSync(entitiesDir)
    .filter((file) => file.endsWith(".json"))
    .forEach((file) => {
      const metadataPath = path.join(entitiesDir, file);
      const relativePath = toPosixPath(path.relative(root, metadataPath));
      const parsed = parseJsonFile(metadataPath);
      diagnostics.push(
        ...parsed.diagnostics.map((item) => ({ ...item, path: relativePath })),
      );
      if (!parsed.value) return;
      const validated = validateEntityMetadata(parsed.value, relativePath);
      diagnostics.push(...validated.diagnostics);
      if (!validated.value) return;
      const metadata = validated.value;
      const expectedFileName = `${metadata.entityId}.json`;
      if (file !== expectedFileName) {
        diagnostics.push({
          level: "warning",
          code: "arch4.index.metadata.filename_mismatch",
          message: `Entity metadata file ${file} contains entityId ${metadata.entityId}; expected ${expectedFileName}.`,
          path: relativePath,
        });
      }
      mapped.set(metadata.entityId, { ...metadata, path: relativePath });
    });
  return { diagnostics, metadata: mapped };
}
