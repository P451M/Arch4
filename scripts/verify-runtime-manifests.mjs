#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  REQUIRED_PLATFORMS,
  runtimeManifestErrors,
  thirdPartyNoticeErrors,
} from "./release-verification-utils.mjs";

const root = process.cwd();
const manifestsDir = path.join(root, "runtime", "manifests");
const noticesPath = path.join(root, "THIRD_PARTY_NOTICES.md");
const allowPlaceholders = process.env.ARCH4_ALLOW_RUNTIME_PLACEHOLDERS === "1";
const currentPlatform = `${process.platform}-${process.arch}`;
const errors = [];

if (!existsSync(manifestsDir)) {
  errors.push("runtime/manifests is missing.");
} else {
  const files = readdirSync(manifestsDir).filter((file) =>
    file.endsWith(".json"),
  );
  for (const platform of REQUIRED_PLATFORMS) {
    if (!files.includes(`${platform}.json`))
      errors.push(`Missing runtime manifest for ${platform}.`);
  }
  for (const file of files) {
    const manifestPath = path.join(manifestsDir, file);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    errors.push(
      ...runtimeManifestErrors(manifest, {
        allowPlaceholders,
        manifestPath,
        root,
      }),
    );
  }
}

const currentManifestPath = path.join(manifestsDir, `${currentPlatform}.json`);
if (existsSync(currentManifestPath)) {
  const manifest = JSON.parse(readFileSync(currentManifestPath, "utf8"));
  for (const tool of manifest.tools ?? []) {
    const executable = path.join(
      root,
      "runtime",
      "bundles",
      currentPlatform,
      tool.relativeExecutable,
    );
    if (!existsSync(executable))
      errors.push(
        `${currentPlatform}:${tool.name} is not installed at ${executable}. Run pnpm setup:runtime.`,
      );
  }
}

const notices = existsSync(noticesPath)
  ? readFileSync(noticesPath, "utf8")
  : "";
errors.push(...thirdPartyNoticeErrors(notices));

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Runtime manifests are complete.");
