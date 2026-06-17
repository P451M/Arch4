#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from "node:fs";
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "packages", "cursor-extension", "mcp");

await esbuild.build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: ["packages/mcp/src/stdio.ts"],
  format: "esm",
  outfile: "packages/cursor-extension/mcp/index.js",
  platform: "node",
  sourcemap: true,
  target: "node22",
});

const widgetSource = path.join(root, "packages", "mcp", "dist", "widget");
if (!existsSync(widgetSource)) {
  throw new Error(
    "MCP widget assets are missing. Run the @arch4/mcp build before bundling the extension MCP server.",
  );
}
mkdirSync(outputDir, { recursive: true });
cpSync(widgetSource, path.join(outputDir, "widget"), {
  recursive: true,
});

console.log(
  `Bundled ${path.join("packages", "cursor-extension", "mcp", "index.js")}`,
);
