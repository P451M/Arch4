#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(root, "packages", "cli", "dist", "index.js");
const bundledExtensionCli = path.join(
  root,
  "packages",
  "cursor-extension",
  "cli",
  "index.js",
);
const tempRoot = mkdtempSync(path.join(tmpdir(), "arch4-smoke-"));

try {
  await mkdir(path.join(tempRoot, "src"), { recursive: true });
  writeFileSync(
    path.join(tempRoot, "package.json"),
    '{"name":"arch4-smoke-target"}\n',
    "utf8",
  );
  writeFileSync(
    path.join(tempRoot, "src", "api.ts"),
    "export const ok = true;\n",
    "utf8",
  );

  run(process.execPath, [cliPath, "init"], tempRoot);
  assertContains(
    path.join(tempRoot, ".arch4", "architecture", "workspace.dsl"),
    "workspace",
  );
  assertContains(
    path.join(tempRoot, ".arch4", "architecture", "arch4.json"),
    '"entitiesDir": "entities"',
  );
  writeFileSync(
    path.join(tempRoot, ".arch4", "architecture", "workspace.dsl"),
    smokeWorkspaceDsl(),
    "utf8",
  );
  writeFileSync(
    path.join(tempRoot, ".arch4", "architecture", "layout.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        views: {
          SmokeContainers: {
            direction: "DOWN",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  run(process.execPath, [cliPath, "render"], tempRoot);
  const renderedView = readJson(
    path.join(
      tempRoot,
      ".arch4",
      "architecture",
      "build",
      "views",
      "SmokeContainers.json",
    ),
  );
  if (renderedView.direction !== "DOWN") {
    throw new Error("rendered view did not use layout.json direction.");
  }
  if (!Array.isArray(renderedView.nodes) || renderedView.nodes.length === 0) {
    throw new Error("rendered view did not contain any nodes.");
  }

  run(process.execPath, [cliPath, "index"], tempRoot);
  const architectureIndex = readJson(
    path.join(
      tempRoot,
      ".arch4",
      "architecture",
      "build",
      "architecture-index.json",
    ),
  );
  if (
    !Array.isArray(architectureIndex.views) ||
    architectureIndex.views.length === 0
  ) {
    throw new Error("architecture index did not contain rendered views.");
  }

  run(process.execPath, [bundledExtensionCli, "init"], tempRoot);

  const doctor = run(process.execPath, [cliPath, "doctor"], tempRoot);
  if (!doctor.includes("arch4.structurizr")) {
    throw new Error("doctor output did not include Structurizr diagnostics.");
  }

  console.log("Arch4 smoke test passed.");
} finally {
  await rm(tempRoot, { force: true, recursive: true });
}

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function assertContains(filePath, expected) {
  const content = readFileSync(filePath, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${filePath} did not contain ${expected}`);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function smokeWorkspaceDsl() {
  return `workspace "Arch4 Smoke" "Smoke render and index target." {
    model {
        user = person "User" "Exercises the smoke path."
        system = softwareSystem "Smoke System" "Minimal system for smoke coverage." {
            api = container "API" "Handles requests." "TypeScript"
            db = container "Database" "Stores smoke data." "PostgreSQL" "Database"
        }

        user -> api "Uses"
        api -> db "Reads and writes"
    }

    views {
        systemContext system "SmokeContext" {
            include *
            autoLayout lr
        }

        container system "SmokeContainers" {
            include *
            autoLayout lr
        }

        theme default
    }
}
`;
}
