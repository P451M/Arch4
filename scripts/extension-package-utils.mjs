import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const cursorExtensionDir = path.join(
  root,
  "packages",
  "cursor-extension",
);

export function readCursorExtensionPackageJson() {
  return JSON.parse(
    readFileSync(path.join(cursorExtensionDir, "package.json"), "utf8"),
  );
}

export function cursorExtensionPublisher(
  packageJson = readCursorExtensionPackageJson(),
) {
  return packageJson.publisher ?? "arch4";
}

export function cursorExtensionId(
  packageJson = readCursorExtensionPackageJson(),
) {
  return `${cursorExtensionPublisher(packageJson)}.${packageJson.name}`;
}

export function currentPlatformId() {
  if (process.platform === "darwin")
    return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  if (process.platform === "linux" && process.arch === "x64")
    return "linux-x64";
  if (process.platform === "win32" && process.arch === "x64")
    return "win32-x64";
  return `${process.platform}-${process.arch}`;
}

export function extensionVsixPath({
  packageJson = readCursorExtensionPackageJson(),
  platformId = currentPlatformId(),
} = {}) {
  return path.join(
    root,
    "artifacts",
    `arch4-${packageJson.version ?? "0.1.0"}-${platformId}.vsix`,
  );
}

export function defaultCursorExtensionsDir() {
  return path.join(os.homedir(), ".cursor", "extensions");
}

export function installedCursorExtensionDir({
  packageJson = readCursorExtensionPackageJson(),
  extensionsDir = defaultCursorExtensionsDir(),
} = {}) {
  return path.join(
    extensionsDir,
    `${cursorExtensionId(packageJson)}-${packageJson.version ?? "0.1.0"}`,
  );
}
