#!/usr/bin/env node
import {
  accessSync,
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  cursorExtensionDir,
  defaultCursorExtensionsDir,
  readCursorExtensionPackageJson,
  root,
} from "./extension-package-utils.mjs";

const extensionPath = cursorExtensionDir;
const targetPath = path.join(root, "examples", "minimal-repo");
const cliPath = path.join(root, "packages", "cli", "dist", "index.js");
const runtimeDir = path.join(root, "runtime");
const devProfileRoot = path.join(root, "artifacts", "dev-cursor");
const userDataDir = path.join(devProfileRoot, "user-data");
const extensionsDir = path.join(devProfileRoot, "extensions");
const cursorUserDataSource =
  process.env.CURSOR_USER_DATA_DIR ?? defaultCursorUserDataDir();
const cursorExtensionsSource =
  process.env.CURSOR_EXTENSIONS_DIR ?? defaultCursorExtensionsDir();
const userProfileResources = [
  "settings.json",
  "keybindings.json",
  "snippets",
  "profiles",
];
const extensionManifest = readCursorExtensionPackageJson();

const explicitCursor = process.env.CURSOR_BIN;
const candidates = [
  explicitCursor,
  commandPath("cursor"),
  "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
  path.join(
    process.env.HOME ?? "",
    "Applications/Cursor.app/Contents/Resources/app/bin/cursor",
  ),
].filter(Boolean);

const cursorBin = candidates.find(isExecutable);

if (!cursorBin) {
  console.error(`Cursor CLI was not found.

Install Cursor's shell command, or run with CURSOR_BIN:

  CURSOR_BIN=/Applications/Cursor.app/Contents/Resources/app/bin/cursor pnpm dev:cursor

Expected target workspace:
  ${targetPath}
`);
  process.exit(1);
}

mkdirSync(userDataDir, { recursive: true });
mkdirSync(extensionsDir, { recursive: true });
syncDevCursorProfile();
syncDevCursorExtensions();
ensureRenderedExample();

const args = [
  "--new-window",
  `--user-data-dir=${userDataDir}`,
  `--extensions-dir=${extensionsDir}`,
  `--extensionDevelopmentPath=${extensionPath}`,
  targetPath,
];
const result = spawnSync(cursorBin, args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);

function commandPath(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function syncDevCursorProfile() {
  if (!cursorUserDataSource || !isReadable(cursorUserDataSource)) return;
  if (samePath(cursorUserDataSource, userDataDir)) return;

  const sourceUserDir = path.join(cursorUserDataSource, "User");
  const targetUserDir = path.join(userDataDir, "User");
  if (!isReadable(sourceUserDir)) return;

  mkdirSync(targetUserDir, { recursive: true });
  for (const resource of userProfileResources) {
    copyProfileResource(
      path.join(sourceUserDir, resource),
      path.join(targetUserDir, resource),
    );
  }
}

function syncDevCursorExtensions() {
  if (samePath(cursorExtensionsSource, extensionsDir)) return;

  if (!cursorExtensionsSource || !isReadable(cursorExtensionsSource)) {
    writeFileSync(path.join(extensionsDir, "extensions.json"), "[]\n");
    return;
  }

  const mirroredExtensionNames = new Set();
  for (const entry of readdirSync(cursorExtensionsSource, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name === ".obsolete") continue;

    const sourcePath = path.join(cursorExtensionsSource, entry.name);
    if (isInstalledArch4Extension(sourcePath)) continue;

    mirroredExtensionNames.add(entry.name);
    mirrorExtension(sourcePath, path.join(extensionsDir, entry.name));
  }

  pruneStaleMirroredExtensions(mirroredExtensionNames);
  writeFileSync(path.join(extensionsDir, "extensions.json"), "[]\n");
}

function copyProfileResource(sourcePath, targetPath) {
  if (samePath(sourcePath, targetPath)) return;

  if (!existsSync(sourcePath)) {
    rmSync(targetPath, { recursive: true, force: true });
    return;
  }

  rmSync(targetPath, { recursive: true, force: true });
  if (lstatSync(sourcePath).isDirectory()) {
    cpSync(sourcePath, targetPath, { recursive: true, force: true });
    return;
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}

function mirrorExtension(sourcePath, targetPath) {
  if (samePath(sourcePath, targetPath)) return;
  if (isSymlinkTo(targetPath, sourcePath)) return;

  rmSync(targetPath, { recursive: true, force: true });
  symlinkSync(sourcePath, targetPath, "junction");
}

function pruneStaleMirroredExtensions(activeExtensionNames) {
  for (const entry of readdirSync(extensionsDir, { withFileTypes: true })) {
    if (entry.name === "extensions.json") continue;
    if (activeExtensionNames.has(entry.name)) continue;

    rmSync(path.join(extensionsDir, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

function isInstalledArch4Extension(extensionDir) {
  const manifest = readJsonFile(path.join(extensionDir, "package.json"));
  if (!manifest) return false;

  if (manifest.name === extensionManifest.name) return true;

  const contributedCommands = manifest.contributes?.commands;
  return Array.isArray(contributedCommands)
    ? contributedCommands.some((command) =>
        String(command.command ?? "").startsWith("arch4."),
      )
    : false;
}

function isSymlinkTo(filePath, targetPath) {
  try {
    const stat = lstatSync(filePath);
    if (!stat.isSymbolicLink()) return false;

    const linkedPath = readlinkSync(filePath);
    return (
      path.resolve(path.dirname(filePath), linkedPath) ===
      path.resolve(targetPath)
    );
  } catch {
    return false;
  }
}

function samePath(left, right) {
  return path.resolve(left) === path.resolve(right);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function defaultCursorUserDataDir() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Cursor");
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
      "Cursor",
    );
  }
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"),
    "Cursor",
  );
}

function ensureRenderedExample() {
  if (!isReadable(cliPath)) {
    console.error(`Arch4 CLI build was not found.

Run this before opening the dev Cursor workspace:

  pnpm build

Expected CLI:
  ${cliPath}
`);
    process.exit(1);
  }

  for (const command of ["render", "index"]) {
    const result = spawnSync(process.execPath, [cliPath, command], {
      cwd: targetPath,
      encoding: "utf8",
      env: { ...process.env, ARCH4_RUNTIME_DIR: runtimeDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      console.error(
        [
          `Could not run arch4 ${command} for the dev example.`,
          "",
          result.stdout.trim(),
          result.stderr.trim(),
          "",
          "Run pnpm setup:runtime and pnpm build, then try pnpm dev:cursor again.",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      process.exit(result.status ?? 1);
    }
    const output = [result.stdout, result.stderr].filter(Boolean).join("");
    if (output.trim()) process.stdout.write(output);
  }
}

function isReadable(filePath) {
  try {
    accessSync(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
