import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { toPosixPath } from "@arch4/core";

export function listRepoFiles(root: string): string[] {
  const gitFiles = listGitFiles(root);
  if (gitFiles) return gitFiles;
  const ignored = new Set([
    ".git",
    "node_modules",
    "dist",
    "out",
    ".venv",
    ".pnpm-store",
    "coverage",
    ".turbo",
    ".cache",
  ]);
  const ignoredRelativePrefixes = [
    ".arch4/architecture/build/",
    ".cursor/",
    "runtime/bundles/",
    "packages/cursor-extension/cli/",
  ];
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (ignored.has(entry)) continue;
      const fullPath = path.join(dir, entry);
      const relative = toPosixPath(path.relative(root, fullPath));
      if (
        ignoredRelativePrefixes.some(
          (prefix) =>
            relative === prefix.slice(0, -1) || relative.startsWith(prefix),
        )
      ) {
        continue;
      }
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        visit(fullPath);
      } else if (stat.isFile()) {
        files.push(relative);
      }
    }
  };
  visit(root);
  return files;
}

function listGitFiles(root: string): string[] | undefined {
  if (!existsSync(path.join(root, ".git"))) return undefined;
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.split("\0").filter(Boolean);
  } catch {
    return undefined;
  }
}
