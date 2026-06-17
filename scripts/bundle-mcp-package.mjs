#!/usr/bin/env node
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const [entryPoint, outfile] of [
  ["packages/mcp/src/server.ts", "packages/mcp/dist/server.js"],
  ["packages/mcp/src/stdio.ts", "packages/mcp/dist/stdio.js"],
]) {
  await esbuild.build({
    absWorkingDir: root,
    bundle: true,
    entryPoints: [entryPoint],
    format: "esm",
    outfile,
    platform: "node",
    sourcemap: true,
    target: "node22",
  });
  console.log(`Bundled ${outfile}`);
}
