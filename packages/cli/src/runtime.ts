import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Diagnostic,
  type RuntimeManifest,
  parseJsonFile,
  validateRuntimeManifest,
} from "@arch4/core";

export function bundledToolPath(
  name: RuntimeManifest["tools"][number]["name"],
): string | undefined {
  const manifest = readRuntimeManifest();
  const tool = manifest?.tools.find((item) => item.name === name);
  if (!tool) return undefined;
  const executable = path.join(
    runtimeRoot(),
    "bundles",
    runtimePlatformId(),
    tool.relativeExecutable,
  );
  return existsSync(executable) ? executable : undefined;
}

export function javaFromHome(): string | undefined {
  const javaHome = process.env.JAVA_HOME;
  if (!javaHome) return undefined;
  const executable = path.join(
    javaHome,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  return existsSync(executable) ? executable : undefined;
}

export function findOnPath(command: string): string | undefined {
  const pathValue = process.env[process.platform === "win32" ? "Path" : "PATH"];
  if (!pathValue) return undefined;
  for (const dir of pathValue.split(path.delimiter)) {
    const candidate = path.join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function runtimeDiagnostics(manifest: RuntimeManifest): Diagnostic[] {
  return manifest.tools.map((tool) => {
    const executable = path.join(
      runtimeRoot(),
      "bundles",
      runtimePlatformId(),
      tool.relativeExecutable,
    );
    const placeholder =
      tool.version === "TBD" ||
      tool.url === "TBD" ||
      /^0{64}$/.test(tool.sha256);
    if (placeholder) {
      return {
        level: "warning",
        code: `arch4.runtime.${tool.name}.unpinned`,
        message: `${tool.name} runtime is declared but not pinned for release packaging.`,
      } satisfies Diagnostic;
    }
    return {
      level: existsSync(executable) ? "info" : "warning",
      code: `arch4.runtime.${tool.name}`,
      message: existsSync(executable)
        ? `${tool.name} ${tool.version}: ${executable}`
        : `${tool.name} ${tool.version} is pinned but missing at ${executable}.`,
    } satisfies Diagnostic;
  });
}

export function readRuntimeManifest(): RuntimeManifest | undefined {
  const manifestPath = path.join(
    runtimeRoot(),
    "manifests",
    `${runtimePlatformId()}.json`,
  );
  if (!existsSync(manifestPath)) return undefined;
  const parsed = parseJsonFile(manifestPath);
  if (!parsed.value) return undefined;
  return validateRuntimeManifest(parsed.value, manifestPath).value;
}

export function runtimeRoot(): string {
  return (
    process.env.ARCH4_RUNTIME_DIR ??
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../runtime",
    )
  );
}

export function runtimePlatformId(): string {
  return `${process.platform}-${process.arch}`;
}
