import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Diagnostic } from "@arch4/core";
import { runtimeEnv } from "./runtime.js";

export class StructurizrProcessError extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
    this.name = "StructurizrProcessError";
  }
}

export function isStructurizrProcessError(
  error: unknown,
): error is StructurizrProcessError {
  return error instanceof StructurizrProcessError;
}

export function exportWorkspace(
  workspaceDslPath: string,
  structurizrCliPath: string,
  javaPath?: string,
): Record<string, unknown> {
  const env = runtimeEnv({ javaPath });
  runStructurizr(
    structurizrCliPath,
    ["validate", "-workspace", workspaceDslPath],
    env,
    {
      code: "arch4.structurizr.validate_failed",
      message: "Structurizr validation failed.",
      path: workspaceDslPath,
    },
  );
  const tempDir = mkdtempSync(path.join(tmpdir(), "arch4-structurizr-"));
  try {
    runStructurizr(
      structurizrCliPath,
      [
        "export",
        "-workspace",
        workspaceDslPath,
        "-format",
        "json",
        "-output",
        tempDir,
      ],
      env,
      {
        code: "arch4.structurizr.export_failed",
        message: "Structurizr JSON export failed.",
        path: workspaceDslPath,
      },
    );
    const workspaceJsonPath = path.join(tempDir, "workspace.json");
    if (!existsSync(workspaceJsonPath)) {
      throw new StructurizrProcessError(
        diagnostic(
          "arch4.structurizr.export_missing",
          "Structurizr JSON export did not produce workspace.json.",
          workspaceJsonPath,
        ),
      );
    }
    try {
      return JSON.parse(readFileSync(workspaceJsonPath, "utf8")) as Record<
        string,
        unknown
      >;
    } catch (error) {
      throw new StructurizrProcessError(
        diagnostic(
          "arch4.structurizr.export_invalid_json",
          `Structurizr JSON export was invalid: ${error instanceof Error ? error.message : String(error)}`,
          workspaceJsonPath,
        ),
      );
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function runStructurizr(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  failure: { code: string; message: string; path: string },
): void {
  try {
    execFileSync(command, args, {
      encoding: "utf8",
      env,
      stdio: "pipe",
    });
  } catch (error) {
    throw new StructurizrProcessError(
      diagnostic(
        failure.code,
        `${failure.message}${commandOutput(error)}`,
        failure.path,
      ),
    );
  }
}

function diagnostic(
  code: string,
  message: string,
  filePath: string,
): Diagnostic {
  return {
    level: "error",
    code,
    message,
    path: filePath,
  };
}

function commandOutput(error: unknown): string {
  const failure = error as {
    message?: string;
    stderr?: Buffer | string;
    stdout?: Buffer | string;
  };
  const output = [failure.stdout, failure.stderr, failure.message]
    .map(bufferToString)
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
  return output ? `\n${output.slice(0, 4000)}` : "";
}

function bufferToString(value: Buffer | string | undefined): string {
  return Buffer.isBuffer(value) ? value.toString("utf8") : (value ?? "");
}
