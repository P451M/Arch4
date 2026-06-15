#!/usr/bin/env node
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const artifact = process.argv[2];
if (!artifact) {
  throw new Error("Usage: node scripts/publish-openvsx.mjs <artifact.vsix>");
}
if (!process.env.OVSX_PAT) {
  throw new Error("OVSX_PAT is required to publish to OpenVSX.");
}

const artifactPath = path.resolve(artifact);
if (!existsSync(artifactPath)) {
  throw new Error(`VSIX artifact does not exist: ${artifactPath}`);
}

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

execFileSync(pnpmCommand, ["dlx", "ovsx@1.0.1", "publish", artifactPath], {
  env: { ...process.env, OVSX_PAT: process.env.OVSX_PAT },
  stdio: "inherit",
});
