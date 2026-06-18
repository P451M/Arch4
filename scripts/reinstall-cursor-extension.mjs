#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, openSync, readFileSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cursorExtensionDir,
  cursorExtensionId,
  currentPlatformId,
  extensionVsixPath,
  installedCursorExtensionDir,
  root,
} from "./extension-package-utils.mjs";

const logPath = path.join(os.tmpdir(), "arch4-cursor-reinstall.log");
const extensionId = cursorExtensionId();

if (process.argv[2] === "--worker") {
  await runWorker({
    cursorBin: process.argv[3],
    vsixPath: process.argv[4],
    workspacePath: process.argv[5],
    extensionId: process.argv[6],
  });
  process.exit(0);
}

const cursorBin = findCursorBin();
if (!cursorBin) {
  console.error(`Cursor CLI was not found.

Install Cursor's shell command, or run with CURSOR_BIN:

  CURSOR_BIN=/Applications/Cursor.app/Contents/Resources/app/bin/cursor pnpm reinstall:cursor
`);
  process.exit(1);
}

const vsixPath = extensionVsixPath();
statSync(vsixPath);

const logFd = openSync(logPath, "a");
const child = spawn(
  process.execPath,
  [
    fileURLToPath(import.meta.url),
    "--worker",
    cursorBin,
    vsixPath,
    root,
    extensionId,
  ],
  {
    cwd: root,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  },
);
child.unref();

console.log(`Started Cursor reinstall in the background.`);
console.log(`Log: ${logPath}`);
console.log(
  `Wait for "Cursor reinstall complete." in the log before using Arch4.`,
);

function findCursorBin() {
  const candidates = [
    process.env.CURSOR_BIN,
    commandPath("cursor"),
    "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    path.join(
      process.env.HOME ?? "",
      "Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    ),
  ].filter(Boolean);
  return candidates.find(isExecutable);
}

function commandPath(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function isExecutable(filePath) {
  const result = spawnSync("test", ["-x", filePath]);
  return result.status === 0;
}

async function runWorker({ cursorBin, vsixPath, workspacePath, extensionId }) {
  log(`Reinstalling ${vsixPath}`);
  await sleep(1000);

  if (process.platform === "darwin") {
    run("osascript", ["-e", 'quit app "Cursor"'], { optional: true });
    await sleep(2000);
  }

  run(cursorBin, ["--uninstall-extension", extensionId], { optional: true });
  run(cursorBin, ["--install-extension", vsixPath, "--force"]);
  verifyInstalledExtension({ vsixPath });

  if (process.platform === "darwin") {
    run("open", ["-a", "Cursor", workspacePath]);
  } else {
    run(cursorBin, [workspacePath]);
  }
  await verifyCursorLocalMcpPlugin({ workspacePath });

  log("Cursor reinstall complete.");
}

function verifyInstalledExtension({ vsixPath }) {
  const extensionDir = installedCursorExtensionDir();
  verifyInstalledFile({
    extensionDir,
    relativePath: path.join("media", "webview.js"),
    vsixPath,
  });
  verifyInstalledFile({
    extensionDir,
    relativePath: path.join("mcp", "index.js"),
    vsixPath,
  });
  verifyInstalledFile({
    extensionDir,
    relativePath: path.join("mcp", "widget", "index.html"),
    vsixPath,
  });
}

function verifyInstalledFile({ extensionDir, relativePath, vsixPath }) {
  const installedPath = path.join(extensionDir, relativePath);
  if (!existsSync(installedPath)) {
    throw new Error(
      `Installed extension is missing ${relativePath} at ${installedPath}`,
    );
  }
  const expectedPath = expectedPackagedFilePath(relativePath);
  const expectedHash = sha256(readFileSync(expectedPath));
  const installedHash = sha256(readFileSync(installedPath));
  if (installedHash !== expectedHash) {
    throw new Error(
      `Installed Cursor extension file ${relativePath} does not match packaged file from ${vsixPath}.\nExpected ${expectedHash}; got ${installedHash}.`,
    );
  }
  log(`Verified installed extension file: ${installedPath}`);
}

async function verifyCursorLocalMcpPlugin({ workspacePath }) {
  const pluginDir = path.join(
    os.homedir(),
    ".cursor",
    "plugins",
    "local",
    "arch4-mcp",
  );
  const manifestPath = path.join(pluginDir, ".cursor-plugin", "plugin.json");
  const mcpPath = path.join(pluginDir, "mcp.json");
  const commandPaths = arch4PluginCommandPaths(pluginDir);
  const skillPath = path.join(pluginDir, "skills", "arch4-mcp", "SKILL.md");
  const installedMcpPath = path.join(
    installedCursorExtensionDir(),
    "mcp",
    "index.js",
  );
  const installedRuntimePath = path.join(
    installedCursorExtensionDir(),
    "runtime",
  );
  await waitFor(
    () =>
      cursorLocalMcpPluginIsValid({
        manifestPath,
        mcpPath,
        commandPaths,
        skillPath,
        installedMcpPath,
        installedRuntimePath,
        workspacePath,
      }),
    `valid Cursor local MCP plugin config at ${pluginDir}`,
  );

  log(`Verified Cursor local MCP plugin: ${pluginDir}`);
}

function cursorLocalMcpPluginIsValid({
  manifestPath,
  mcpPath,
  commandPaths,
  skillPath,
  installedMcpPath,
  installedRuntimePath,
  workspacePath,
}) {
  if (
    !existsSync(manifestPath) ||
    !existsSync(mcpPath) ||
    !existsSync(skillPath) ||
    commandPaths.some((commandPath) => !existsSync(commandPath))
  ) {
    return false;
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (
      manifest.name !== "arch4-mcp" ||
      manifest.mcpServers !== "mcp.json" ||
      manifest.commands !== "commands" ||
      manifest.skills !== "skills"
    ) {
      return false;
    }

    const config = JSON.parse(readFileSync(mcpPath, "utf8"));
    const server = config?.mcpServers?.arch4;
    return (
      server?.type === "stdio" &&
      Array.isArray(server.args) &&
      server.args[0] === installedMcpPath &&
      server.args[1] === "--root" &&
      server.args[2] === workspacePath &&
      server.env?.ELECTRON_RUN_AS_NODE === "1" &&
      server.env?.ARCH4_RUNTIME_DIR === installedRuntimePath
    );
  } catch {
    return false;
  }
}

function arch4PluginCommandPaths(pluginDir) {
  return [
    "arch4-open-map.md",
    "arch4-build-artifacts.md",
    "arch4-update.md",
    "arch4-seed.md",
    "arch4-review.md",
    "arch4-create-support-request.md",
  ].map((fileName) => path.join(pluginDir, "commands", fileName));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function expectedPackagedFilePath(relativePath) {
  const sourcePath = path.join(cursorExtensionDir, relativePath);
  if (existsSync(sourcePath)) return sourcePath;
  return path.join(
    root,
    "artifacts",
    `arch4-extension-vsix-${currentPlatformId()}`,
    "extension",
    relativePath,
  );
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function run(command, args, options = {}) {
  log(`$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 && !options.optional) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
