import { existsSync } from "node:fs";
import path from "node:path";
import {
  type ArchitectureIndex,
  type Diagnostic,
  ensureArch4Layout,
  isArch4WorkspaceInitialized,
  readJson,
  requireArch4Workspace,
  resolveArch4Paths,
  toPosixPath,
  writeJson,
} from "@arch4/core";
import { renderArch4Workspace } from "@arch4/renderer-structurizr";
import { option, optionValues } from "./args.js";
import { elementsForFiles, renderContextMarkdown } from "./context.js";
import { buildArchitectureIndex, writeContextFiles } from "./indexer.js";
import {
  bundledToolPath,
  findOnPath,
  javaFromHome,
  readRuntimeManifest,
  runtimeDiagnostics,
  runtimePlatformId,
} from "./runtime.js";
import type { CommandContext } from "./types.js";

export async function run(ctx: CommandContext, name: string): Promise<void> {
  switch (name) {
    case "init":
      return init(ctx);
    case "scan":
      return scan(ctx);
    case "validate":
      return validate(ctx);
    case "render":
      return render(ctx);
    case "index":
      return index(ctx);
    case "context":
      return context(ctx);
    case "doctor":
      return doctor(ctx);
    default:
      return help();
  }
}

function init(ctx: CommandContext): void {
  const paths = ensureArch4Layout(ctx.root, path.basename(ctx.root));
  console.log(
    `Initialized Arch4 at ${toPosixPath(path.relative(ctx.root, paths.architectureRoot))}`,
  );
}

function scan(ctx: CommandContext): void {
  requireArch4Workspace(ctx.root);
  console.error(
    "arch4 scan has been removed. Use Cursor /arch4-update to generate architecture from repository evidence.",
  );
  process.exitCode = 1;
}

function validate(ctx: CommandContext): void {
  const paths = requireArch4Workspace(ctx.root);
  const result = renderArch4Workspace({
    projectRoot: ctx.root,
    structurizrCliPath:
      option(ctx.args, "--structurizr-cli") ?? bundledToolPath("structurizr"),
    javaPath: option(ctx.args, "--java") ?? bundledToolPath("java"),
    writeOutputs: false,
  });
  writeJson(paths.diagnosticsPath, result.diagnostics);
  if (exitOnRenderErrors(result.diagnostics)) return;
  console.log(`Validated ${result.specs.length} architecture view(s).`);
}

function render(ctx: CommandContext): void {
  const paths = requireArch4Workspace(ctx.root);
  const result = renderArch4Workspace({
    projectRoot: ctx.root,
    structurizrCliPath:
      option(ctx.args, "--structurizr-cli") ?? bundledToolPath("structurizr"),
    javaPath: option(ctx.args, "--java") ?? bundledToolPath("java"),
    writeOutputs: true,
  });
  writeJson(paths.diagnosticsPath, result.diagnostics);
  if (exitOnRenderErrors(result.diagnostics)) return;
  console.log(
    `Rendered ${result.specs.length} view(s) to ${toPosixPath(path.relative(ctx.root, paths.viewsDir))}`,
  );
}

function index(ctx: CommandContext): void {
  const paths = requireArch4Workspace(ctx.root);
  const index = buildArchitectureIndex(ctx.root);
  writeJson(paths.architectureIndexPath, index);
  writeContextFiles(ctx.root, index);
  console.log(
    `Wrote ${toPosixPath(path.relative(ctx.root, paths.architectureIndexPath))}`,
  );
}

function context(ctx: CommandContext): void {
  const paths = requireArch4Workspace(ctx.root);
  if (!existsSync(paths.architectureIndexPath)) {
    writeJson(paths.architectureIndexPath, buildArchitectureIndex(ctx.root));
  }
  const archIndex = readJson<ArchitectureIndex>(paths.architectureIndexPath);
  const file = option(ctx.args, "--file");
  const changedFiles = optionValues(ctx.args, "--changed-files");
  const matches = file
    ? elementsForFiles(archIndex, [file])
    : changedFiles.length
      ? elementsForFiles(archIndex, changedFiles)
      : archIndex.elements;
  console.log(renderContextMarkdown(matches, file ? [file] : changedFiles));
}

function doctor(ctx: CommandContext): void {
  const manifest = readRuntimeManifest();
  const structurizrCli =
    bundledToolPath("structurizr") ??
    process.env.STRUCTURIZR_CLI_PATH ??
    findOnPath("structurizr") ??
    findOnPath(
      process.platform === "win32" ? "structurizr.bat" : "structurizr.sh",
    );
  const java =
    bundledToolPath("java") ??
    javaFromHome() ??
    findOnPath(process.platform === "win32" ? "java.exe" : "java");
  const diagnostics: Diagnostic[] = [
    {
      level: structurizrCli && existsSync(structurizrCli) ? "info" : "warning",
      code: "arch4.structurizr",
      message: structurizrCli
        ? `Structurizr CLI: ${structurizrCli}`
        : "Structurizr CLI not found. Run pnpm setup:runtime or set STRUCTURIZR_CLI_PATH.",
    },
    {
      level: java && existsSync(java) ? "info" : "warning",
      code: "arch4.java",
      message: java
        ? `Java runtime: ${java}`
        : "Java runtime not found. Run pnpm setup:runtime or configure JAVA_HOME.",
    },
  ];
  if (!manifest) {
    diagnostics.push({
      level: "warning",
      code: "arch4.runtime.manifest",
      message: `No runtime manifest found for ${runtimePlatformId()}.`,
    });
  } else {
    diagnostics.push(...runtimeDiagnostics(manifest));
  }
  if (isArch4WorkspaceInitialized(ctx.root)) {
    writeJson(resolveArch4Paths(ctx.root).diagnosticsPath, diagnostics);
  }
  diagnostics.forEach((item) =>
    console.log(`${item.level.toUpperCase()} ${item.code}: ${item.message}`),
  );
}

function exitOnRenderErrors(diagnostics: Diagnostic[]): boolean {
  const errors = diagnostics.filter((item) => item.level === "error");
  if (!errors.length) return false;
  errors.forEach((item) => console.error(`${item.code}: ${item.message}`));
  process.exitCode = 1;
  return true;
}

function help(): void {
  console.log(`Arch4

Usage:
  arch4 init
  arch4 validate [--structurizr-cli <path>] [--java <path>]
  arch4 render [--structurizr-cli <path>] [--java <path>]
  arch4 index
  arch4 context --file <path>
  arch4 context --changed-files <path...>
  arch4 doctor
`);
}
