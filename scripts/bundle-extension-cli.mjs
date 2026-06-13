#!/usr/bin/env node
import { chmodSync } from "node:fs";
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join("packages", "cursor-extension", "cli", "index.js");

await esbuild.build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: ["packages/cli/src/index.ts"],
  format: "esm",
  outfile: output,
  platform: "node",
  sourcemap: true,
  target: "node22",
});

chmodSync(path.join(root, output), 0o755);
console.log(`Bundled ${output}`);
