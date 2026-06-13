import { existsSync } from "node:fs";
import path from "node:path";

export function resolveStructurizrCli(configured?: string): string | undefined {
  if (configured && existsSync(configured)) return configured;
  if (
    process.env.STRUCTURIZR_CLI_PATH &&
    existsSync(process.env.STRUCTURIZR_CLI_PATH)
  ) {
    return process.env.STRUCTURIZR_CLI_PATH;
  }
  const executable =
    process.platform === "win32" ? "structurizr.bat" : "structurizr.sh";
  return findOnPath(executable) ?? findOnPath("structurizr");
}

export function resolveJava(configured?: string): string | undefined {
  if (configured && existsSync(configured)) return configured;
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    const candidate = path.join(
      javaHome,
      "bin",
      process.platform === "win32" ? "java.exe" : "java",
    );
    if (existsSync(candidate)) return candidate;
  }
  return findOnPath(process.platform === "win32" ? "java.exe" : "java");
}

export function runtimeEnv(options: { javaPath?: string }): NodeJS.ProcessEnv {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const pathEntries = [
    options.javaPath ? path.dirname(options.javaPath) : undefined,
    process.env[pathKey],
  ].filter((value): value is string => Boolean(value));
  const javaHome = options.javaPath
    ? path.dirname(path.dirname(options.javaPath))
    : undefined;
  return {
    ...process.env,
    ...(javaHome ? { JAVA_HOME: javaHome } : {}),
    [pathKey]: pathEntries.join(path.delimiter),
  };
}

function findOnPath(command: string): string | undefined {
  const pathValue = process.env[process.platform === "win32" ? "Path" : "PATH"];
  if (!pathValue) return undefined;
  for (const dir of pathValue.split(path.delimiter)) {
    const candidate = path.join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
