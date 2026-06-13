import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

export type Arch4OwnedArtifact = {
  absolutePath: string;
  relativePath: string;
};

export type RemoveArch4OwnedArtifactsOptions = {
  confirm: (artifacts: Arch4OwnedArtifact[]) => Promise<boolean>;
  exists?: (absolutePath: string) => boolean;
  remove?: (absolutePath: string) => Promise<void>;
};

export type RemoveArch4OwnedArtifactsResult = {
  cancelled: boolean;
  removed: Arch4OwnedArtifact[];
};

export const ARCH4_OWNED_WORKSPACE_ARTIFACTS = [
  ".arch4",
  ".cursor/rules/arch4.mdc",
  ".cursor/skills/c4",
  ".cursor/skills/arch4",
  ".cursor/commands/seed-arch4.md",
  ".cursor/commands/update-arch4.md",
  ".cursor/commands/review-arch4.md",
] as const;

export const ARCH4_OWNERSHIP_MARKER = "arch4-owned: true";

export function arch4OwnedArtifactPaths(root: string): Arch4OwnedArtifact[] {
  return ARCH4_OWNED_WORKSPACE_ARTIFACTS.map((relativePath) => ({
    relativePath,
    absolutePath: path.join(root, relativePath),
  }));
}

export async function removeArch4OwnedArtifacts(
  root: string,
  options: RemoveArch4OwnedArtifactsOptions,
): Promise<RemoveArch4OwnedArtifactsResult> {
  const exists = options.exists ?? existsSync;
  const remove =
    options.remove ??
    ((absolutePath: string) =>
      rm(absolutePath, { force: true, recursive: true }));
  const artifacts = arch4OwnedArtifactPaths(root).filter((artifact) =>
    exists(artifact.absolutePath),
  );
  if (!artifacts.length) return { cancelled: false, removed: [] };
  if (!(await options.confirm(artifacts)))
    return { cancelled: true, removed: [] };
  for (const artifact of artifacts) {
    await remove(artifact.absolutePath);
  }
  return { cancelled: false, removed: artifacts };
}

export function sameGeneratedContent(left: string, right: string): boolean {
  return normalizeLineEndings(left) === normalizeLineEndings(right);
}

export function canReplaceArch4OwnedContent(
  existing: string,
  generated: string,
): boolean {
  return (
    existing.includes(ARCH4_OWNERSHIP_MARKER) ||
    sameGeneratedContent(existing, generated)
  );
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}
