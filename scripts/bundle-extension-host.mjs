#!/usr/bin/env node
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: ["packages/cursor-extension/src/extension.ts"],
  external: ["vscode"],
  format: "esm",
  outfile: "packages/cursor-extension/dist/extension.js",
  platform: "node",
  sourcemap: true,
  target: "node22",
});

console.log(
  `Bundled ${path.join("packages", "cursor-extension", "dist", "extension.js")}`,
);
