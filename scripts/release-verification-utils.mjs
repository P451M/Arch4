import path from "node:path";

export const REQUIRED_PLATFORMS = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-x64",
  "win32-x64",
]);

export const REQUIRED_RUNTIME_TOOLS = new Set(["java", "structurizr"]);

export const REQUIRED_THIRD_PARTY_NOTICE_TEXTS = [
  "Eclipse Temurin",
  "Structurizr CLI",
  "@dagrejs/dagre",
  "@dagrejs/graphlib",
  "React",
  "React DOM",
  "@xyflow/react",
  "lucide-react",
  "minimatch",
  "esbuild",
  "Vite",
  "yazl",
];

export function runtimeManifestErrors(
  manifest,
  {
    allowPlaceholders = false,
    manifestPath,
    requireArchivePath = true,
    requireRuntimeTools = true,
    root = process.cwd(),
    targetPlatform,
  } = {},
) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push("schemaVersion must be 1");

  const platformId = `${manifest?.platform?.os}-${manifest?.platform?.arch}`;
  if (targetPlatform) {
    const expectedPlatform = platformParts(targetPlatform);
    if (manifest?.platform?.os !== expectedPlatform.os) {
      errors.push(`platform.os must be ${expectedPlatform.os}`);
    }
    if (manifest?.platform?.arch !== expectedPlatform.arch) {
      errors.push(`platform.arch must be ${expectedPlatform.arch}`);
    }
  } else if (!REQUIRED_PLATFORMS.has(platformId)) {
    errors.push(
      `${path.basename(manifestPath ?? "manifest")} has unexpected platform ${platformId}.`,
    );
  }

  if (!Array.isArray(manifest?.tools) || manifest.tools.length === 0) {
    errors.push("tools must be a non-empty array");
  }

  const names = new Set();
  for (const [index, tool] of (manifest?.tools ?? []).entries()) {
    if (!tool || typeof tool !== "object") {
      errors.push(`tools[${index}] must be an object`);
      continue;
    }
    if (tool.name !== "java" && tool.name !== "structurizr") {
      errors.push(`tools[${index}].name is unsupported: ${tool.name}`);
    }
    if (names.has(tool.name)) errors.push(`duplicate tool ${tool.name}`);
    names.add(tool.name);
    for (const field of [
      "version",
      "license",
      "url",
      "sha256",
      "relativeExecutable",
    ]) {
      if (typeof tool[field] !== "string" || !tool[field]) {
        errors.push(`tools[${index}].${field} must be a non-empty string`);
      }
    }
    if (
      requireArchivePath &&
      (typeof tool.archivePath !== "string" || !tool.archivePath)
    ) {
      errors.push(`tools[${index}].archivePath must be a non-empty string`);
    }
    const placeholder =
      tool.version === "TBD" ||
      tool.url === "TBD" ||
      /^0{64}$/.test(tool.sha256 ?? "") ||
      !/^[a-f0-9]{64}$/.test(tool.sha256 ?? "");
    if (placeholder && !allowPlaceholders) {
      errors.push(
        `${tool.name} is not pinned with a release URL, version, and SHA256.`,
      );
    }
    if (
      typeof tool.relativeExecutable === "string" &&
      path.isAbsolute(tool.relativeExecutable)
    ) {
      errors.push(`tools[${index}].relativeExecutable must be relative`);
    }
    if (
      typeof tool.relativeExecutable === "string" &&
      tool.relativeExecutable.split(/[\\/]/).includes("..")
    ) {
      errors.push(`tools[${index}].relativeExecutable must not escape runtime`);
    }
  }

  if (requireRuntimeTools) {
    for (const required of REQUIRED_RUNTIME_TOOLS) {
      if (!names.has(required)) errors.push(`missing ${required} tool`);
    }
  }

  return manifestPath
    ? errors.map((error) => `${path.relative(root, manifestPath)}: ${error}`)
    : errors;
}

export function thirdPartyNoticeErrors(
  notices,
  requiredTexts = REQUIRED_THIRD_PARTY_NOTICE_TEXTS,
) {
  return requiredTexts
    .filter((text) => !notices.includes(text))
    .map((text) => `THIRD_PARTY_NOTICES.md does not mention ${text}.`);
}

export function platformParts(targetPlatform) {
  const [os, arch] = targetPlatform.split("-");
  return { os, arch };
}
