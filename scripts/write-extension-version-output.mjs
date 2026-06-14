#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { readCursorExtensionPackageJson } from "./extension-package-utils.mjs";

const outputPath = process.env.GITHUB_OUTPUT;
if (!outputPath) {
  throw new Error("GITHUB_OUTPUT is required to write workflow outputs.");
}

const packageJson = readCursorExtensionPackageJson();
if (!packageJson.version) {
  throw new Error("packages/cursor-extension/package.json is missing version.");
}

appendFileSync(outputPath, `version=${packageJson.version}\n`, "utf8");
console.log(`Extension version: ${packageJson.version}`);
