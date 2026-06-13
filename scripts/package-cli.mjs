#!/usr/bin/env node
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);
const version = rootPackage.version ?? "0.1.0";
const packageDir = path.join(root, "artifacts", "arch4-cli-package");
const packDir = path.join(root, "artifacts");
const packageName = `arch4-cli-${version}.tgz`;
const packagePath = path.join(packDir, packageName);

rmSync(packageDir, { force: true, recursive: true });
rmSync(packagePath, { force: true });
mkdirSync(path.join(packageDir, "dist"), { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: ["packages/cli/src/index.ts"],
  format: "esm",
  outfile: "artifacts/arch4-cli-package/dist/index.js",
  platform: "node",
  target: "node22",
});

writeFileSync(
  path.join(packageDir, "package.json"),
  `${JSON.stringify(
    {
      name: "@arch4/cli",
      version,
      type: "module",
      license: "Apache-2.0",
      bin: {
        arch4: "./dist/index.js",
      },
      files: [
        "dist",
        "README.md",
        "LICENSE",
        "NOTICE",
        "THIRD_PARTY_NOTICES.md",
      ],
    },
    null,
    2,
  )}\n`,
  "utf8",
);

cpSync(path.join(root, "README.md"), path.join(packageDir, "README.md"));
cpSync(path.join(root, "LICENSE"), path.join(packageDir, "LICENSE"));
cpSync(path.join(root, "NOTICE"), path.join(packageDir, "NOTICE"));
cpSync(
  path.join(root, "THIRD_PARTY_NOTICES.md"),
  path.join(packageDir, "THIRD_PARTY_NOTICES.md"),
);

execFileSync("npm", ["pack", packageDir, "--pack-destination", packDir], {
  cwd: root,
  stdio: "inherit",
});
verifyCliPackage(packagePath);
console.log(`Wrote CLI package to ${path.join("artifacts", packageName)}`);

function verifyCliPackage(tarballPath) {
  const output = execFileSync("tar", ["-tzf", tarballPath], {
    cwd: root,
    encoding: "utf8",
  });
  const files = output.trim().split("\n").filter(Boolean);
  const requiredFiles = [
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    "package/NOTICE",
    "package/THIRD_PARTY_NOTICES.md",
    "package/dist/index.js",
  ];
  for (const file of requiredFiles) {
    if (!files.includes(file)) {
      throw new Error(`CLI package is missing ${file}`);
    }
  }
  const forbidden = files.filter(
    (file) =>
      file.endsWith(".map") ||
      file.endsWith(".d.ts") ||
      /\.test\.(js|d\.ts)$/.test(file) ||
      file.includes("/src/") ||
      file.includes("/__tests__/") ||
      file.includes("/fixtures/"),
  );
  if (forbidden.length) {
    throw new Error(
      `CLI package contains development-only files:\n${forbidden.map((file) => `- ${file}`).join("\n")}`,
    );
  }
}
