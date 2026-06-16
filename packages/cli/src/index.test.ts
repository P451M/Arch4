import {
  execFileSync,
  type ExecFileSyncOptionsWithStringEncoding,
} from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type ArchitectureIndex, type DiagramSpec } from "@arch4/core";

const cliPath = path.resolve("dist/index.js");

describe("arch4 cli", () => {
  it("initializes an AI-first scaffold without deterministic architecture facts", async () => {
    const root = tempRepo();
    writeFileSync(
      path.join(root, "package.json"),
      '{"name":"sample"}\n',
      "utf8",
    );
    await mkdir(path.join(root, "src"), { recursive: true });
    writeFileSync(
      path.join(root, "src", "app.ts"),
      "export const app = true;\n",
      "utf8",
    );

    run(root, "init");
    const workspaceDsl = readFileSync(
      path.join(root, ".arch4", "architecture", "workspace.dsl"),
      "utf8",
    );
    const manifest = JSON.parse(
      readFileSync(
        path.join(root, ".arch4", "architecture", "arch4.json"),
        "utf8",
      ),
    );
    const scanFailure = runFailure(root, "scan");

    expect(workspaceDsl).toContain("AI-maintained architecture model");
    expect(workspaceDsl).not.toContain("Application");
    expect(workspaceDsl).not.toContain("Database");
    expect(
      await readdir(path.join(root, ".arch4", "architecture", "entities")),
    ).toEqual([]);
    expect(
      await readdir(
        path.join(root, ".arch4", "architecture", "build", "views"),
      ),
    ).toEqual([]);
    expect(
      await readdir(
        path.join(root, ".arch4", "architecture", "build", "context"),
      ),
    ).toEqual([]);
    expect(manifest.source).toEqual({
      dsl: "workspace.dsl",
      entitiesDir: "entities",
      buildDir: "build",
    });
    expect(scanFailure.status).not.toBe(0);
    expect(scanFailure.stderr).toContain("arch4 scan has been removed");
  });

  it("indexes rendered views deterministically and emits scoped context", async () => {
    const root = tempRepo();
    run(root, "init");
    await mkdir(path.join(root, "src"), { recursive: true });
    writeFileSync(
      path.join(root, "src", "api.ts"),
      "export const api = true;\n",
      "utf8",
    );
    writeFileSync(
      path.join(
        root,
        ".arch4",
        "architecture",
        "build",
        "views",
        "Containers.json",
      ),
      `${JSON.stringify(sampleSpec(), null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      path.join(root, ".arch4", "architecture", "entities", "api.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          entityId: "api",
          paths: ["src/**/*.ts"],
          owners: ["Platform"],
          confidence: "high",
          openQuestions: ["Should background jobs be split out?"],
          notes: { reliability: "Handles external API traffic." },
        },
        null,
        2,
      ),
      "utf8",
    );

    run(root, "index");
    const first = readFileSync(
      path.join(
        root,
        ".arch4",
        "architecture",
        "build",
        "architecture-index.json",
      ),
      "utf8",
    );
    run(root, "index");
    const second = readFileSync(
      path.join(
        root,
        ".arch4",
        "architecture",
        "build",
        "architecture-index.json",
      ),
      "utf8",
    );
    const index = JSON.parse(second) as ArchitectureIndex;
    const context = run(root, "context", "--file", "src/api.ts");

    expect(second).toBe(first);
    expect(index.elements.map((element) => element.entityId)).toEqual(["api"]);
    expect(index.elements[0]?.paths).toEqual(["src/**/*.ts"]);
    expect(index.elements[0]).toMatchObject({
      tags: ["runtime"],
      owners: ["Platform"],
      confidence: "high",
      openQuestions: ["Should background jobs be split out?"],
      notes: { reliability: "Handles external API traffic." },
      contextPath: ".arch4/architecture/build/context/api.md",
    });
    expect(index.relationships[0]).toMatchObject({
      sourceEntityId: "api",
      targetEntityId: "api",
    });
    expect(context).toContain("Application API");
    expect(context).toContain("src/**/*.ts");
    expect(context).toContain("Owners: Platform");
    expect(context).toContain("Should background jobs be split out?");
  });

  it("warns for orphaned metadata and metadata filename mismatches", async () => {
    const root = tempRepo();
    run(root, "init");
    writeFileSync(
      path.join(
        root,
        ".arch4",
        "architecture",
        "build",
        "views",
        "Containers.json",
      ),
      `${JSON.stringify(sampleSpec(), null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      path.join(root, ".arch4", "architecture", "entities", "api.json"),
      JSON.stringify(
        { schemaVersion: 1, entityId: "api", paths: ["src/api.ts"] },
        null,
        2,
      ),
      "utf8",
    );
    writeFileSync(
      path.join(root, ".arch4", "architecture", "entities", "wrong-name.json"),
      JSON.stringify(
        { schemaVersion: 1, entityId: "ghost", paths: ["src/ghost.ts"] },
        null,
        2,
      ),
      "utf8",
    );

    run(root, "index");
    const index = JSON.parse(
      readFileSync(
        path.join(
          root,
          ".arch4",
          "architecture",
          "build",
          "architecture-index.json",
        ),
        "utf8",
      ),
    ) as ArchitectureIndex;

    expect(index.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.index.metadata.filename_mismatch",
        path: ".arch4/architecture/entities/wrong-name.json",
      }),
    );
    expect(index.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.index.metadata.orphaned",
        path: ".arch4/architecture/entities/wrong-name.json",
      }),
    );
  });

  it("reports diagnostics for malformed view and entity metadata JSON", async () => {
    const root = tempRepo();
    run(root, "init");
    writeFileSync(
      path.join(
        root,
        ".arch4",
        "architecture",
        "build",
        "views",
        "broken.json",
      ),
      "{not-json",
      "utf8",
    );
    writeFileSync(
      path.join(root, ".arch4", "architecture", "entities", "broken.json"),
      "{not-json",
      "utf8",
    );

    run(root, "index");
    const index = JSON.parse(
      readFileSync(
        path.join(
          root,
          ".arch4",
          "architecture",
          "build",
          "architecture-index.json",
        ),
        "utf8",
      ),
    ) as ArchitectureIndex;

    expect(index.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.json.invalid",
        path: ".arch4/architecture/build/views/broken.json",
      }),
    );
    expect(index.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.json.invalid",
        path: ".arch4/architecture/entities/broken.json",
      }),
    );
  });

  it("keeps stale view output during validate failures but clears it during render failures", async () => {
    const root = tempRepo();
    run(root, "init");
    const viewsDir = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    writeFileSync(path.join(viewsDir, "stale.json"), "{}\n", "utf8");
    const emptyBin = path.join(root, "empty-bin");
    await mkdir(emptyBin, { recursive: true });
    const runtimeEnv = {
      ...process.env,
      ARCH4_RUNTIME_DIR: path.join(root, "missing-runtime"),
      JAVA_HOME: "",
      PATH: emptyBin,
      Path: emptyBin,
      STRUCTURIZR_CLI_PATH: "",
    };

    runFailure(root, "validate", { env: runtimeEnv });
    expect(await readdir(viewsDir)).toEqual(["stale.json"]);

    runFailure(root, "render", { env: runtimeEnv });
    expect(await readdir(viewsDir)).toEqual([]);
  });

  it("fails workspace commands before initialization without creating Arch4 files", async () => {
    const root = tempRepo();

    for (const command of ["validate", "render", "index", "context"]) {
      const failure = runFailure(root, command);

      expect(failure.status).not.toBe(0);
      expect(failure.stderr).toContain("arch4.workspace.not_initialized");
    }
    expect(existsSync(path.join(root, ".arch4"))).toBe(false);
  });

  it("runs doctor before initialization without creating Arch4 files", () => {
    const root = tempRepo();
    const output = run(root, "doctor");

    expect(output).toContain("arch4.");
    expect(existsSync(path.join(root, ".arch4"))).toBe(false);
  });

  it("writes diagnostics for Structurizr validation failures and clears stale output only when rendering", async () => {
    const root = tempRepo();
    run(root, "init");
    const viewsDir = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    const diagnosticsPath = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "diagnostics.json",
    );
    writeFileSync(path.join(viewsDir, "stale.json"), "{}\n", "utf8");
    const tools = createRuntimeTools(
      root,
      `
if (args[0] === "validate") {
  console.error("DSL parse failed");
  process.exit(1);
}
process.exit(0);
`,
    );
    const cliArgs = [
      "--structurizr-cli",
      tools.structurizrCliPath,
      "--java",
      tools.javaPath,
    ];

    const validateFailure = runCommandFailure(root, ["validate", ...cliArgs]);

    expect(validateFailure.status).not.toBe(0);
    expect(validateFailure.stderr).toContain(
      "arch4.structurizr.validate_failed",
    );
    expect(await readdir(viewsDir)).toEqual(["stale.json"]);
    expect(JSON.parse(readFileSync(diagnosticsPath, "utf8"))).toContainEqual(
      expect.objectContaining({
        code: "arch4.structurizr.validate_failed",
      }),
    );

    const renderFailure = runCommandFailure(root, ["render", ...cliArgs]);

    expect(renderFailure.status).not.toBe(0);
    expect(renderFailure.stderr).toContain("arch4.structurizr.validate_failed");
    expect(await readdir(viewsDir)).toEqual([]);
    expect(JSON.parse(readFileSync(diagnosticsPath, "utf8"))).toContainEqual(
      expect.objectContaining({
        code: "arch4.structurizr.validate_failed",
      }),
    );
  });

  it("fails render when runtime tools cannot be resolved", async () => {
    const root = tempRepo();
    run(root, "init");
    const emptyBin = path.join(root, "empty-bin");
    await mkdir(emptyBin, { recursive: true });

    const failure = runFailure(root, "render", {
      env: {
        ...process.env,
        ARCH4_RUNTIME_DIR: path.join(root, "missing-runtime"),
        JAVA_HOME: "",
        PATH: emptyBin,
        Path: emptyBin,
        STRUCTURIZR_CLI_PATH: "",
      },
    });

    expect(failure.status).not.toBe(0);
    expect(failure.stderr).toContain("arch4.structurizr.missing");
    expect(failure.stdout).not.toContain("Rendered ");
  });
});

function tempRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "arch4-cli-test-"));
}

function run(cwd: string, ...args: string[]): string {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function runFailure(
  cwd: string,
  command: string,
  options: Omit<ExecFileSyncOptionsWithStringEncoding, "cwd" | "encoding"> = {},
): {
  status: number | undefined;
  stdout: string;
  stderr: string;
} {
  return runCommandFailure(cwd, [command], options);
}

function runCommandFailure(
  cwd: string,
  args: string[],
  options: Omit<ExecFileSyncOptionsWithStringEncoding, "cwd" | "encoding"> = {},
): {
  status: number | undefined;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      ...options,
      cwd,
      encoding: "utf8",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const failure = error as {
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    return {
      status: failure.status,
      stdout: bufferToString(failure.stdout),
      stderr: bufferToString(failure.stderr),
    };
  }
}

function bufferToString(value: Buffer | string | undefined): string {
  return Buffer.isBuffer(value) ? value.toString("utf8") : (value ?? "");
}

function createRuntimeTools(
  root: string,
  structurizrScript: string,
): { javaPath: string; structurizrCliPath: string } {
  const javaPath = path.join(root, "java");
  writeFileSync(javaPath, "#!/usr/bin/env sh\nexit 0\n", "utf8");
  chmodSync(javaPath, 0o755);
  const structurizrCliPath = path.join(root, "structurizr");
  writeFileSync(
    structurizrCliPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
${structurizrScript}
`,
    "utf8",
  );
  chmodSync(structurizrCliPath, 0o755);
  return { javaPath, structurizrCliPath };
}

function sampleSpec(): DiagramSpec {
  return {
    id: "Containers",
    name: "Containers",
    type: "container",
    nodes: [
      {
        id: "api-node",
        entityId: "api",
        type: "container",
        name: "Application API",
        description: "Handles API requests.",
        tags: ["runtime"],
        layout: { x: 100, y: 120, width: 260, height: 140 },
      },
    ],
    edges: [
      {
        id: "self",
        source: "api-node",
        target: "api-node",
        label: "Calls",
      },
    ],
  };
}
