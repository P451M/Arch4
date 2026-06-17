#!/usr/bin/env node
import {
  cpSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { finished } from "node:stream/promises";
import path from "node:path";
import yazl from "yazl";
import {
  cursorExtensionDir,
  currentPlatformId,
  extensionVsixPath,
  readCursorExtensionPackageJson,
  root,
} from "./extension-package-utils.mjs";
import { runtimeManifestErrors } from "./release-verification-utils.mjs";

const sourceDir = cursorExtensionDir;
const mediaSourceDir = path.join(root, "assets", "media");
const packageJson = readCursorExtensionPackageJson();
const platformId = option("--platform") ?? currentPlatformId();
const supportedPlatforms = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-x64",
  "win32-x64",
]);
if (!supportedPlatforms.has(platformId)) {
  throw new Error(`Unsupported extension target platform: ${platformId}`);
}
const artifactsDir = path.join(root, "artifacts");
const stagingDir = path.join(
  artifactsDir,
  `arch4-extension-vsix-${platformId}`,
);
const extensionDir = path.join(stagingDir, "extension");
const vsixPath = extensionVsixPath({ packageJson, platformId });

rmSync(stagingDir, { force: true, recursive: true });
rmSync(vsixPath, { force: true });
mkdirSync(extensionDir, { recursive: true });

copyFiltered(path.join(sourceDir, "dist"), path.join(extensionDir, "dist"));
copyFiltered(path.join(sourceDir, "media"), path.join(extensionDir, "media"));
copySharedMediaAssets(extensionDir);
copyFiltered(path.join(sourceDir, "cli"), path.join(extensionDir, "cli"));
copyFiltered(path.join(sourceDir, "mcp"), path.join(extensionDir, "mcp"));
writeFileSync(
  path.join(extensionDir, "README.md"),
  stagedExtensionReadme(),
  "utf8",
);
copyPlatformRuntime(platformId, extensionDir);
for (const item of [
  "CHANGELOG.md",
  "SUPPORT.md",
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
]) {
  cpSync(path.join(root, item), path.join(extensionDir, item));
}

const extensionPackage = {
  ...packageJson,
  publisher: packageJson.publisher ?? "arch4",
};
delete extensionPackage.private;
delete extensionPackage.scripts;
delete extensionPackage.dependencies;
delete extensionPackage.devDependencies;
extensionPackage.targetPlatform = platformId;

writeFileSync(
  path.join(extensionDir, "package.json"),
  `${JSON.stringify(extensionPackage, null, 2)}\n`,
  "utf8",
);
writeFileSync(
  path.join(stagingDir, "[Content_Types].xml"),
  contentTypes(),
  "utf8",
);
writeFileSync(
  path.join(stagingDir, "extension.vsixmanifest"),
  vsixManifest(extensionPackage, platformId),
  "utf8",
);

verifyStagedExtension(extensionDir, platformId);

await zipStagedExtension(stagingDir, vsixPath);

console.log(`Wrote extension package to ${path.relative(root, vsixPath)}`);

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function copyFiltered(source, destination) {
  if (!existsSync(source))
    throw new Error(
      `Required package source is missing: ${path.relative(root, source)}`,
    );
  const stat = statSync(source);
  if (stat.isDirectory()) {
    const entries = readdirSync(source).filter(
      (entry) => !excludedPackageEntry(entry, path.join(source, entry)),
    );
    if (!entries.length) return;
    mkdirSync(destination, { recursive: true });
    for (const entry of entries) {
      copyFiltered(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }
  if (stat.isFile()) cpSync(source, destination);
}

function copySharedMediaAssets(targetExtensionDir) {
  const mediaTargetDir = path.join(targetExtensionDir, "media");
  mkdirSync(mediaTargetDir, { recursive: true });
  for (const [source, destination] of [
    ["arch4-icon-512.png", "icon.png"],
    ["arch4-command-palette.png", "arch4-command-palette.png"],
    ["arch4-full-screenshot.png", "arch4-full-screenshot.png"],
    ["arch4-overview.png", "arch4-overview.png"],
  ]) {
    cpSync(
      path.join(mediaSourceDir, source),
      path.join(mediaTargetDir, destination),
    );
  }
}

function stagedExtensionReadme() {
  const readme = readFileSync(path.join(sourceDir, "README.md"), "utf8");
  return readme.replaceAll(
    "../../assets/media/",
    releaseMediaBaseUrl(packageJson),
  );
}

function releaseMediaBaseUrl(manifest) {
  if (!manifest.version) {
    throw new Error("Extension package version is required for README media.");
  }
  const repository = githubRepositoryPath(manifest.repository?.url);
  return `https://raw.githubusercontent.com/${repository}/v${manifest.version}/assets/media/`;
}

function githubRepositoryPath(repositoryUrl) {
  const normalized = String(repositoryUrl ?? "")
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");
  const httpsMatch = /^https:\/\/github\.com\/([^/]+\/[^/]+)$/.exec(normalized);
  if (httpsMatch) return httpsMatch[1];
  const sshMatch = /^git@github\.com:([^/]+\/[^/]+)$/.exec(normalized);
  if (sshMatch) return sshMatch[1];
  throw new Error(
    `Extension package repository must be a GitHub URL for README media: ${repositoryUrl}`,
  );
}

function excludedPackageEntry(entry, absolutePath) {
  if (entry.endsWith(".d.ts")) return true;
  if (entry.endsWith(".map")) return true;
  if (/\.test\.(js|d\.ts)$/.test(entry)) return true;
  if (/\.test\.d\.ts\.map$/.test(entry)) return true;
  if (entry === "__tests__" || entry === "__fixtures__" || entry === "fixtures")
    return true;
  if (absolutePath.includes(`${path.sep}dist${path.sep}webview${path.sep}`))
    return true;
  return absolutePath.includes(`${path.sep}src${path.sep}`);
}

function copyPlatformRuntime(targetPlatform, targetExtensionDir) {
  const manifestPath = path.join(
    root,
    "runtime",
    "manifests",
    `${targetPlatform}.json`,
  );
  const bundleDir = path.join(root, "runtime", "bundles", targetPlatform);
  if (!existsSync(manifestPath))
    throw new Error(
      `Runtime manifest missing for ${targetPlatform}. Run pnpm setup:runtime -- --platform ${targetPlatform}.`,
    );
  if (!existsSync(bundleDir))
    throw new Error(
      `Runtime bundle missing for ${targetPlatform}. Run pnpm setup:runtime -- --platform ${targetPlatform}.`,
    );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assertRuntimeManifest(manifest, targetPlatform, manifestPath);
  const runtimeDir = path.join(targetExtensionDir, "runtime");
  mkdirSync(path.join(runtimeDir, "manifests"), { recursive: true });
  cpSync(
    manifestPath,
    path.join(runtimeDir, "manifests", `${targetPlatform}.json`),
  );
  const targetBundleDir = path.join(runtimeDir, "bundles", targetPlatform);
  mkdirSync(targetBundleDir, { recursive: true });
  for (const tool of manifest.tools ?? []) {
    const toolRoot = String(tool.relativeExecutable ?? "").split(/[\\/]/)[0];
    if (!toolRoot) {
      throw new Error(`Runtime manifest has invalid tool path: ${tool.name}`);
    }
    const source = path.join(bundleDir, toolRoot);
    if (!existsSync(source)) {
      throw new Error(
        `Runtime tool ${tool.name} is missing at ${path.relative(root, source)}.`,
      );
    }
    const target = path.join(targetBundleDir, toolRoot);
    cpSync(source, target, { recursive: true, verbatimSymlinks: true });
    verifyCopiedRuntime(source, target, tool.name);
  }
}

function verifyStagedExtension(targetExtensionDir, targetPlatform) {
  const requiredFiles = [
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "SUPPORT.md",
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "dist/extension.js",
    "media/icon.png",
    "media/arch4-command-palette.png",
    "media/arch4-full-screenshot.png",
    "media/arch4-overview.png",
    "media/webview.js",
    "media/webview.css",
    "cli/index.js",
    "mcp/index.js",
    "mcp/widget/index.html",
    `runtime/manifests/${targetPlatform}.json`,
  ];
  for (const file of requiredFiles) {
    if (!existsSync(path.join(targetExtensionDir, file))) {
      throw new Error(`Packaged extension is missing ${file}`);
    }
  }
  const packagedPluginPath = path.join(targetExtensionDir, "cursor-plugins");
  if (existsSync(packagedPluginPath)) {
    throw new Error(
      "Packaged extension must not include Cursor plugin files; the VSIX and Cursor MCP plugin are separate install paths.",
    );
  }
  const bundleRoot = path.join(targetExtensionDir, "runtime", "bundles");
  const bundles = readdirSync(bundleRoot).filter((entry) =>
    statSync(path.join(bundleRoot, entry)).isDirectory(),
  );
  if (bundles.length !== 1 || bundles[0] !== targetPlatform) {
    throw new Error(
      `Packaged extension must contain exactly one runtime bundle (${targetPlatform}); found ${bundles.join(", ") || "none"}.`,
    );
  }
  const manifestPath = path.join(
    targetExtensionDir,
    "runtime",
    "manifests",
    `${targetPlatform}.json`,
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assertRuntimeManifest(manifest, targetPlatform, manifestPath);
  const readme = readFileSync(
    path.join(targetExtensionDir, "README.md"),
    "utf8",
  );
  if (readme.includes("../../assets/media/") || readme.includes("](media/")) {
    throw new Error(
      "Packaged README must use absolute release media URLs for marketplace rendering.",
    );
  }
  for (const tool of manifest.tools) {
    const executable = path.join(
      targetExtensionDir,
      "runtime",
      "bundles",
      targetPlatform,
      tool.relativeExecutable,
    );
    if (!existsSync(executable)) {
      throw new Error(
        `Packaged extension is missing runtime executable ${tool.relativeExecutable}.`,
      );
    }
    if (process.platform !== "win32" && !targetPlatform.startsWith("win32-")) {
      const mode = statSync(executable).mode;
      if ((mode & 0o111) === 0) {
        throw new Error(
          `Packaged runtime executable is not executable: ${tool.relativeExecutable}.`,
        );
      }
    }
  }
  const forbidden = listFiles(targetExtensionDir).filter(
    (file) =>
      file.endsWith(".map") ||
      file.endsWith(".d.ts") ||
      /\.test\.(js|d\.ts)$/.test(file) ||
      file.includes("/__tests__/") ||
      file.includes("/fixtures/") ||
      file.startsWith("dist/webview/") ||
      file.startsWith("src/"),
  );
  if (forbidden.length) {
    throw new Error(
      `Packaged extension contains development-only files:\n${forbidden.map((file) => `- ${file}`).join("\n")}`,
    );
  }
}

function assertRuntimeManifest(manifest, targetPlatform, manifestPath) {
  const errors = runtimeManifestErrors(manifest, {
    manifestPath,
    root,
    targetPlatform,
  });
  if (errors.length) {
    throw new Error(
      `Runtime manifest is invalid:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
}

function verifyCopiedRuntime(source, target, toolName) {
  const sourceDigest = directoryDigest(source);
  const targetDigest = directoryDigest(target);
  if (sourceDigest !== targetDigest) {
    throw new Error(`Runtime copy verification failed for ${toolName}.`);
  }
}

function directoryDigest(directory) {
  const hash = createHash("sha256");
  for (const file of listFiles(directory).sort()) {
    const absolutePath = path.join(directory, file);
    const stat = lstatSync(absolutePath);
    hash.update(file);
    hash.update("\0");
    hash.update(String(stat.mode));
    hash.update("\0");
    hash.update(
      stat.isSymbolicLink()
        ? readlinkSync(absolutePath)
        : readFileSync(absolutePath),
    );
    hash.update("\0");
  }
  return hash.digest("hex");
}

function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolutePath = path.join(directory, entry);
    const relativePath = prefix ? `${prefix}/${entry}` : entry;
    const stat = lstatSync(absolutePath);
    if (stat.isDirectory()) {
      files.push(...listFiles(absolutePath, relativePath));
    } else if (stat.isFile()) {
      files.push(relativePath);
    } else if (stat.isSymbolicLink()) {
      files.push(relativePath);
    }
  }
  return files;
}

async function zipStagedExtension(sourceDir, outputPath) {
  const zipFile = new yazl.ZipFile();
  const output = createWriteStream(outputPath);
  zipFile.outputStream.pipe(output);
  for (const file of [
    "[Content_Types].xml",
    "extension.vsixmanifest",
    ...listFiles(path.join(sourceDir, "extension")).map(
      (file) => `extension/${file}`,
    ),
  ]) {
    const absolutePath = path.join(sourceDir, file);
    zipFile.addFile(absolutePath, file, {
      forceDosTimestamp: true,
      mode: statSync(absolutePath).mode,
    });
  }
  zipFile.end();
  await finished(output);
  assertNoZipExtraFields(outputPath);
}

function assertNoZipExtraFields(zipPath) {
  const zip = readFileSync(zipPath);
  const eocdOffset = findEndOfCentralDirectory(zip);
  const entries = zip.readUInt16LE(eocdOffset + 10);
  let centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  const entriesWithExtraFields = [];

  for (let index = 0; index < entries; index += 1) {
    if (zip.readUInt32LE(centralDirectoryOffset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory in ${zipPath}.`);
    }

    const fileNameLength = zip.readUInt16LE(centralDirectoryOffset + 28);
    const centralExtraFieldLength = zip.readUInt16LE(
      centralDirectoryOffset + 30,
    );
    const fileCommentLength = zip.readUInt16LE(centralDirectoryOffset + 32);
    const localHeaderOffset = zip.readUInt32LE(centralDirectoryOffset + 42);
    const fileName = zip
      .subarray(
        centralDirectoryOffset + 46,
        centralDirectoryOffset + 46 + fileNameLength,
      )
      .toString("utf8");

    if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${fileName}.`);
    }
    const localExtraFieldLength = zip.readUInt16LE(localHeaderOffset + 28);
    if (centralExtraFieldLength || localExtraFieldLength) {
      entriesWithExtraFields.push(fileName);
    }

    centralDirectoryOffset +=
      46 + fileNameLength + centralExtraFieldLength + fileCommentLength;
  }

  if (entriesWithExtraFields.length) {
    throw new Error(
      `OpenVSX rejects VSIX ZIP extra fields; found extra fields in:\n${entriesWithExtraFields.map((file) => `- ${file}`).join("\n")}`,
    );
  }
}

function findEndOfCentralDirectory(zip) {
  for (let offset = zip.length - 22; offset >= 0; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid ZIP file: end of central directory not found.");
}

function contentTypes() {
  return `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="css" ContentType="text/css"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Default Extension="md" ContentType="text/markdown"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Default Extension="txt" ContentType="text/plain"/>
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
  <Default Extension="xml" ContentType="text/xml"/>
</Types>
`;
}

function vsixManifest(manifest, targetPlatform) {
  const categories = (manifest.categories ?? []).join(",");
  return `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="${escapeXml(manifest.name)}" Version="${escapeXml(manifest.version)}" Publisher="${escapeXml(manifest.publisher)}" TargetPlatform="${escapeXml(targetPlatform)}"/>
    <DisplayName>${escapeXml(manifest.displayName ?? manifest.name)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(manifest.description ?? "")}</Description>
    <Categories>${escapeXml(categories)}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${escapeXml(manifest.engines?.vscode ?? "*")}"/>
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    ${manifest.icon ? `<Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/${escapeXml(manifest.icon)}" Addressable="true"/>` : ""}
  </Assets>
</PackageManifest>
`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
