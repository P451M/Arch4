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

  log("Cursor reinstall complete.");
}

function verifyInstalledExtension({ vsixPath }) {
  const extensionDir = installedCursorExtensionDir();
  const installedWebviewPath = path.join(extensionDir, "media", "webview.js");
  if (!existsSync(installedWebviewPath)) {
    throw new Error(
      `Installed extension is missing media/webview.js at ${installedWebviewPath}`,
    );
  }
  const expectedWebviewPath = path.join(
    cursorExtensionDir,
    "media",
    "webview.js",
  );
  const expectedHash = sha256(readFileSync(expectedWebviewPath));
  const installedHash = sha256(readFileSync(installedWebviewPath));
  if (installedHash !== expectedHash) {
    throw new Error(
      `Installed Cursor extension webview does not match packaged webview from ${vsixPath}.\nExpected ${expectedHash}; got ${installedHash}.`,
    );
  }
  log(`Verified installed webview: ${installedWebviewPath}`);
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
