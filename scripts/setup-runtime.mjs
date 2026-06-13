#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(root, "runtime");
const platformId =
  option("--platform") ?? `${process.platform}-${process.arch}`;
const manifestPath = path.join(runtimeRoot, "manifests", `${platformId}.json`);

if (!existsSync(manifestPath)) {
  throw new Error(`No runtime manifest found for ${platformId}.`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const bundleDir = path.join(runtimeRoot, "bundles", platformId);
const tempRoot = mkdtempSync(path.join(tmpdir(), "arch4-runtime-"));

try {
  rmSync(bundleDir, { force: true, recursive: true });
  mkdirSync(bundleDir, { recursive: true });

  for (const tool of manifest.tools) {
    await installTool(tool);
  }

  validateRuntime(manifest);
  console.log(
    `Installed Arch4 runtime for ${platformId} at ${path.relative(root, bundleDir)}`,
  );
} catch (error) {
  rmSync(bundleDir, { force: true, recursive: true });
  throw error;
} finally {
  rmSync(tempRoot, { force: true, recursive: true });
}

function validateRuntime(manifest) {
  const env = runtimeEnv(manifest);
  for (const tool of manifest.tools) {
    const executable = path.join(bundleDir, tool.relativeExecutable);
    try {
      const args = tool.name === "java" ? ["-version"] : ["version"];
      execFileSync(executable, args, { env, stdio: "pipe" });
    } catch (error) {
      const stderr =
        error && typeof error === "object" && "stderr" in error
          ? Buffer.from(error.stderr ?? "").toString("utf8")
          : "";
      const stdout =
        error && typeof error === "object" && "stdout" in error
          ? Buffer.from(error.stdout ?? "").toString("utf8")
          : "";
      throw new Error(
        `${tool.name} runtime validation failed.\n${[stdout, stderr].filter(Boolean).join("\n").trim()}`,
        {
          cause: error,
        },
      );
    }
  }
}

function runtimeEnv(manifest) {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const pathEntries = manifest.tools
    .map((tool) => path.dirname(path.join(bundleDir, tool.relativeExecutable)))
    .concat(process.env[pathKey] ? [process.env[pathKey]] : []);
  const javaTool = manifest.tools.find((tool) => tool.name === "java");
  const javaHome = javaTool
    ? path.dirname(
        path.dirname(path.join(bundleDir, javaTool.relativeExecutable)),
      )
    : undefined;
  return {
    ...process.env,
    ...(javaHome ? { JAVA_HOME: javaHome } : {}),
    [pathKey]: pathEntries.join(path.delimiter),
  };
}

async function installTool(tool) {
  const archivePath = path.join(
    tempRoot,
    tool.archivePath ?? path.basename(new URL(tool.url).pathname),
  );
  const extractDir = path.join(tempRoot, `${tool.name}-extract`);
  mkdirSync(extractDir, { recursive: true });

  console.log(`Downloading ${tool.name} ${tool.version}`);
  const body = await download(tool.url);
  writeFileSync(archivePath, body);
  verifySha256(archivePath, tool.sha256, tool.name);
  extractArchive(archivePath, extractDir);

  const targetDir = path.join(bundleDir, tool.name);
  if (tool.name === "java") {
    const javaHome = findParentWithExecutable(
      extractDir,
      process.platform === "win32" ? "bin/java.exe" : "bin/java",
    );
    cpSync(javaHome, targetDir, { recursive: true, verbatimSymlinks: true });
  } else if (tool.name === "structurizr") {
    const executable =
      process.platform === "win32" ? "structurizr.bat" : "structurizr.sh";
    const cliDir = path.dirname(findFile(extractDir, executable));
    cpSync(cliDir, targetDir, { recursive: true, verbatimSymlinks: true });
  } else {
    throw new Error(`Unsupported runtime tool in manifest: ${tool.name}`);
  }

  const installedExecutable = path.join(bundleDir, tool.relativeExecutable);
  if (!existsSync(installedExecutable)) {
    throw new Error(
      `${tool.name} did not install expected executable: ${installedExecutable}`,
    );
  }
  if (process.platform !== "win32") {
    chmodSync(installedExecutable, 0o755);
  }
}

async function download(url) {
  if (url.startsWith("https://ghcr.io/v2/")) {
    return downloadGhcrBlob(url);
  }
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      `Download failed for ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function downloadGhcrBlob(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const blobsIndex = parts.indexOf("blobs");
  const repo = parts.slice(1, blobsIndex).join("/");
  const tokenResponse = await fetch(
    `https://ghcr.io/token?scope=repository:${repo}:pull`,
  );
  if (!tokenResponse.ok) {
    throw new Error(
      `Could not get GHCR token for ${repo}: ${tokenResponse.status} ${tokenResponse.statusText}`,
    );
  }
  const tokenPayload = await tokenResponse.json();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokenPayload.token}`,
      Accept: "application/vnd.oci.image.layer.v1.tar+gzip",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(
      `Download failed for ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function verifySha256(filePath, expected, name) {
  const actual = createHash("sha256")
    .update(readFileSync(filePath))
    .digest("hex");
  if (actual !== expected) {
    throw new Error(
      `${name} checksum mismatch. Expected ${expected}, got ${actual}.`,
    );
  }
}

function extractArchive(archivePath, destination) {
  if (archivePath.endsWith(".pkg")) {
    rmSync(destination, { force: true, recursive: true });
    execFileSync("pkgutil", ["--expand-full", archivePath, destination]);
    return;
  }
  if (archivePath.endsWith(".zip")) {
    if (process.platform === "win32") {
      execFileSync("powershell.exe", [
        "-NoProfile",
        "-Command",
        "Expand-Archive",
        "-LiteralPath",
        archivePath,
        "-DestinationPath",
        destination,
      ]);
      return;
    }
    execFileSync("unzip", ["-q", archivePath, "-d", destination]);
    return;
  }

  execFileSync("tar", ["-xf", archivePath, "-C", destination]);
}

function findParentWithExecutable(rootDir, relativeExecutable) {
  const executable = findFile(rootDir, path.basename(relativeExecutable));
  const parts = relativeExecutable.split(/[\\/]/);
  let current = path.dirname(executable);
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    if (path.basename(current) !== parts[index]) break;
    current = path.dirname(current);
  }
  const expected = path.join(current, relativeExecutable);
  if (!existsSync(expected)) {
    throw new Error(
      `Could not normalize runtime executable ${relativeExecutable} from ${rootDir}.`,
    );
  }
  return current;
}

function findFile(rootDir, fileName) {
  const entries = execFileSync(
    process.execPath,
    [
      "-e",
      `
const { readdirSync, statSync } = require("node:fs");
const path = require("node:path");
const root = process.argv[1];
const name = process.argv[2];
function visit(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      const found = visit(full);
      if (found) return found;
    } else if (entry === name) {
      return full;
    }
  }
}
const found = visit(root);
if (!found) process.exit(1);
console.log(found);
`,
      rootDir,
      fileName,
    ],
    { encoding: "utf8" },
  ).trim();
  if (!entries) throw new Error(`Could not find ${fileName} under ${rootDir}.`);
  return entries;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
