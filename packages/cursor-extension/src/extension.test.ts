import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveArch4Paths, type DiagramSpec } from "@arch4/core";
import { describe, expect, it } from "vitest";
import {
  ARCH4_OWNERSHIP_MARKER,
  arch4OwnedArtifactPaths,
  canReplaceArch4OwnedContent,
  removeArch4OwnedArtifacts,
} from "./workspace-artifacts.js";
import {
  readArchitectureIndex,
  readDiagnosticsFile,
  readDiagrams,
  readWorkspaceDiagnostics,
} from "./workspace-json.js";

describe("cursor extension webview bundle", () => {
  it("builds the React viewer webview assets", () => {
    const jsPath = path.resolve("media/webview.js");
    const cssPath = path.resolve("media/webview.css");

    expect(existsSync(jsPath)).toBe(true);
    expect(existsSync(cssPath)).toBe(true);

    const js = readFileSync(jsPath, "utf8");
    const css = readFileSync(cssPath, "utf8");

    expect(js.length).toBeGreaterThan(100_000);
    expect(js).toContain("arch4-payload");
    expect(css).toContain("arch4-viewer");
    expect(css).toContain("arch4-node-actions");
    expect(css).toContain("arch4-node-action-menu");
    expect(css).toContain("arch4-details");
  });
});

describe("cursor extension development launcher", () => {
  it("uses an isolated Cursor profile to avoid duplicate installed extension registrations", () => {
    const source = readFileSync(
      path.resolve("../../scripts/dev-cursor.mjs"),
      "utf8",
    );

    expect(source).toContain('path.join(root, "artifacts", "dev-cursor")');
    expect(source).toContain("--new-window");
    expect(source).toContain("--user-data-dir=");
    expect(source).toContain("--extensions-dir=");
    expect(source).toContain("--extensionDevelopmentPath=");
  });

  it("mirrors Cursor user settings into the isolated development profile", () => {
    const source = readFileSync(
      path.resolve("../../scripts/dev-cursor.mjs"),
      "utf8",
    );

    expect(source).toContain("syncDevCursorProfile()");
    expect(source).toContain("CURSOR_USER_DATA_DIR");
    expect(source).toContain('"settings.json"');
    expect(source).toContain('"keybindings.json"');
    expect(source).toContain('"snippets"');
  });

  it("mirrors non-Arch4 Cursor extensions so configured themes can load", () => {
    const source = readFileSync(
      path.resolve("../../scripts/dev-cursor.mjs"),
      "utf8",
    );

    expect(source).toContain("syncDevCursorExtensions()");
    expect(source).toContain("CURSOR_EXTENSIONS_DIR");
    expect(source).toContain("isInstalledArch4Extension");
    expect(source).toContain("symlinkSync");
    expect(source).toContain('startsWith("arch4.")');
  });

  it("renders and indexes the ignored minimal-repo diagram outputs before launching Cursor", () => {
    const source = readFileSync(
      path.resolve("../../scripts/dev-cursor.mjs"),
      "utf8",
    );

    expect(source).toContain("ensureRenderedExample()");
    expect(source).toContain('for (const command of ["render", "index"])');
    expect(source).toContain("ARCH4_RUNTIME_DIR");
    expect(source).toContain("pnpm setup:runtime and pnpm build");
  });
});

describe("release packaging", () => {
  it("runs production gates before OpenVSX publish and derives artifact versions", () => {
    const workflow = readFileSync(
      path.resolve("../../.github/workflows/release-openvsx.yml"),
      "utf8",
    );

    expect(workflow).toContain("needs: verify");
    for (const command of [
      "pnpm check",
      "pnpm lint",
      "pnpm format:check",
      "pnpm test",
      "pnpm smoke",
      "pnpm verify:runtime",
      "pnpm audit --prod",
      "pnpm package:cli",
    ]) {
      expect(workflow).toContain(command);
    }
    expect(workflow).toContain("startsWith(github.ref, 'refs/tags/')");
    expect(workflow).toContain("steps.extension.outputs.version");
    expect(workflow).not.toContain("arch4-0.1.0-");
  });

  it("uses pinned OpenVSX publishing and Node-based VSIX packaging verification", () => {
    const publishScript = readFileSync(
      path.resolve("../../scripts/publish-openvsx.mjs"),
      "utf8",
    );
    const packageScript = readFileSync(
      path.resolve("../../scripts/package-extension.mjs"),
      "utf8",
    );

    expect(publishScript).toContain("ovsx@1.0.1");
    expect(publishScript).toContain("OVSX_PAT");
    expect(publishScript).toContain('execFileSync("pnpm"');
    expect(publishScript).toContain('shell: process.platform === "win32"');
    expect(publishScript).not.toContain('"-p"');
    expect(publishScript).not.toContain('"npx"');
    expect(packageScript).toContain('from "yazl"');
    expect(packageScript).toContain("zipStagedExtension");
    expect(packageScript).toContain("forceDosTimestamp: true");
    expect(packageScript).toContain("assertNoZipExtraFields");
    expect(packageScript).toContain('"media/icon.png"');
    expect(packageScript).toContain(
      '"media/marketplace/arch4-demo-cropped.gif"',
    );
    expect(packageScript).toContain("runtimeManifestErrors");
    expect(packageScript).toContain("verifyCopiedRuntime");
    expect(packageScript).not.toContain('execFileSync(\n  "zip"');
  });

  it("verifies required third-party notice coverage", () => {
    const utilityUrl = pathToFileURL(
      path.resolve("../../scripts/release-verification-utils.mjs"),
    ).href;
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
import { thirdPartyNoticeErrors } from ${JSON.stringify(utilityUrl)};
const errors = thirdPartyNoticeErrors("React\\nStructurizr CLI\\n", ["React", "Missing Library"]);
console.log(JSON.stringify(errors));
`,
      ],
      { encoding: "utf8" },
    );

    expect(JSON.parse(output)).toEqual([
      "THIRD_PARTY_NOTICES.md does not mention Missing Library.",
    ]);
  });

  it("documents all-platform packaging runtime prerequisites", () => {
    const releaseDocs = readFileSync(
      path.resolve("../../docs/openvsx-release.md"),
      "utf8",
    );

    expect(releaseDocs).toContain("pnpm setup:runtime");
    expect(releaseDocs).toContain("pnpm package:extension");
    expect(releaseDocs).toContain("pnpm package:extension:all");
    expect(releaseDocs).toContain("platform matrix");
    expect(releaseDocs).toContain("already exist on disk");
  });
});

describe("cursor extension agent instructions", () => {
  it("exposes only product-level commands in the Command Palette", () => {
    const manifest = JSON.parse(
      readFileSync(path.resolve("package.json"), "utf8"),
    ) as {
      activationEvents: string[];
      contributes: { commands: Array<{ command: string; title: string }> };
    };

    expect(
      manifest.activationEvents.filter((event) =>
        event.startsWith("onCommand:"),
      ),
    ).toEqual([
      "onCommand:arch4.init",
      "onCommand:arch4.openMap",
      "onCommand:arch4.buildArtifacts",
      "onCommand:arch4.updateModel",
      "onCommand:arch4.removeArtifacts",
    ]);
    expect(manifest.contributes.commands.map((item) => item.command)).toEqual([
      "arch4.init",
      "arch4.openMap",
      "arch4.buildArtifacts",
      "arch4.updateModel",
      "arch4.removeArtifacts",
    ]);
    expect(manifest.contributes.commands.map((item) => item.title)).toEqual([
      "Arch4: Initialize Workspace",
      "Arch4: Open Architecture Map",
      "Arch4: Build Architecture Artifacts",
      "Arch4: Update Architecture Model",
      "Arch4: Remove Workspace Artifacts",
    ]);
  });

  it("installs C4 and Arch4 skills plus internal Cursor seed, update, and review workflows", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(source).toContain('path.join(root, ".cursor", "skills", "c4")');
    expect(source).toContain('path.join(root, ".cursor", "skills", "arch4")');
    expect(source).toContain(
      'contentFileRelativePath: ".cursor/commands/seed-arch4.md"',
    );
    expect(source).toContain(
      'contentFileRelativePath: ".cursor/commands/update-arch4.md"',
    );
    expect(source).toContain(
      'contentFileRelativePath: ".cursor/commands/review-arch4.md"',
    );
    expect(source).toContain("https://c4model.com/");
    expect(source).toContain("Creative Commons Attribution 4.0 International");
    expect(source).toContain("Do not reseed from scratch");
    expect(source).toContain(
      "Relationship labels must read as a natural sentence",
    );
    expect(source).toContain("zero-edge component views");
    expect(source).toContain("node, edge, and boundary counts");
    expect(source).toContain("git status --short");
    expect(source).toContain("!identifiers hierarchical");
    expect(source).toContain("fully qualified identifiers");
    expect(source).toContain("developer -> arch4.arch4Extension");
    expect(source).toContain("arch4.arch4Renderer.rendererExport");
    expect(source).toContain("identifier inventory");
    expect(source).toContain("staged validation before metadata generation");
    expect(source).toContain("notes.summary");
    expect(source).toContain("technologyNotes");
    expect(source).toContain("dependencyNotes");
    expect(source).toContain("Put uncertain facts in \\`openQuestions\\`");
    expect(source).toContain("evidence-backed architecture context");
    expect(source).toContain(
      "Review changed files against mapped entities and confirm relevant",
    );
  });

  it("routes the public update command to seed or update workflows by model state", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(source).toContain("updateArchitectureRouterPrompt()");
    expect(source).toContain("If the model is empty or minimal");
    expect(source).toContain(
      "same first-time seeding workflow as \\`/seed-arch4\\`",
    );
    expect(source).toContain(
      "same ongoing maintenance workflow as \\`/update-arch4\\`",
    );
    expect(source).not.toContain('command("arch4.seedModel"');
    expect(source).not.toContain('command("arch4.reviewModel"');
  });

  it("routes the public build command through deterministic render and index steps", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(source).toContain('command("arch4.buildArtifacts"');
    expect(source).toContain("buildArchitectureArtifacts");
    expect(source).toContain("Building Arch4 architecture artifacts");
    expect(source).toContain('await runCli(["render"], context)');
    expect(source).toContain('await runCli(["index"], context)');
    expect(source).toContain("provider.refresh()");
    expect(source).toContain("refreshOpenMapPanels(mapPanels)");
    expect(source).toContain(
      "Built Arch4 architecture artifacts from workspace.dsl.",
    );
  });

  it("uses repository runtime when loaded as a source development extension", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(source).toContain("resolveCliEnv(context)");
    expect(source).toContain(
      'path.resolve(extensionRoot, "..", "..", "runtime")',
    );
    expect(source).toContain("vscode.ExtensionMode.Development");
    expect(source).toContain("isSourceDevelopmentExtension(context)");
    expect(source).toContain("Arch4 packaged runtime is missing");
  });

  it("hardens webview HTML with CSP and inert JSON payload", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");
    const webviewSource = readFileSync(
      path.resolve("src/webview/main.tsx"),
      "utf8",
    );

    expect(source).toContain("Content-Security-Policy");
    expect(source).toContain("default-src 'none'");
    expect(source).toContain("localResourceRoots");
    expect(source).toContain('<template id="arch4-payload">');
    expect(source).toContain("layoutDirections");
    expect(source).toContain("manualLayoutDiagramIds");
    expect(source).toContain("onDidReceiveMessage");
    expect(source).toContain("arch4.layoutDirectionChanged");
    expect(source).toContain("arch4.nodePositionChanged");
    expect(source).toContain("arch4.manualLayoutReset");
    expect(source).not.toContain("arch4.edgeLabelPositionChanged");
    expect(webviewSource).toContain("HTMLTemplateElement");
    expect(webviewSource).toContain("element.content.textContent");
    expect(webviewSource).toContain("acquireVsCodeApi");
    expect(webviewSource).toContain("arch4.payloadUpdated");
    expect(source).not.toContain("nonce = String(Date.now())");
    expect(source).not.toContain('type="application/json" id="arch4-payload"');
  });

  it("watches generated architecture artifacts for live map reloads", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(source).toContain("registerArch4ArtifactWatchers");
    expect(source).toContain("vscode.workspace.createFileSystemWatcher");
    expect(source).toContain(
      "new vscode.RelativePattern(workspaceFolder, pattern)",
    );
    expect(source).toContain('".arch4/architecture/build/views/*.json"');
    expect(source).toContain(
      '".arch4/architecture/build/architecture-index.json"',
    );
    expect(source).toContain('".arch4/architecture/build/diagnostics.json"');
    expect(source).not.toContain('".arch4/architecture/layout.json"');
    expect(source).toContain("watcher.onDidCreate(scheduleArtifactRefresh)");
    expect(source).toContain("watcher.onDidChange(scheduleArtifactRefresh)");
    expect(source).toContain("watcher.onDidDelete(scheduleArtifactRefresh)");
  });

  it("persists manual node positions through the manual layout sidecar", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");
    const webviewSource = readFileSync(
      path.resolve("src/webview/main.tsx"),
      "utf8",
    );

    expect(source).toContain("persistNodePosition");
    expect(source).not.toContain("persistEdgeLabelPosition");
    expect(source).toContain("readArch4ManualLayout");
    expect(source).toContain("writeArch4ManualLayout");
    expect(source).toContain("clearManualLayoutView");
    expect(source).toContain('runCli(["render"], context)');
    expect(source).toContain("lastPayloadDigestByPanel");
    expect(webviewSource).toContain("onNodePositionChange");
    expect(webviewSource).not.toContain("onEdgeLabelPositionChange");
    expect(webviewSource).toContain("onManualLayoutReset");
  });

  it("debounces artifact refreshes and refreshes both explorer and map panels", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(source).toContain("ARCH4_ARTIFACT_REFRESH_DEBOUNCE_MS = 250");
    expect(source).toContain("createArch4ArtifactRefreshScheduler");
    expect(source).toContain("clearTimeout(refreshTimer)");
    expect(source).toContain("setTimeout(() =>");
    expect(source).toContain("provider.refresh()");
    expect(source).toContain("refreshOpenMapPanels(mapPanels)");
    expect(source).toContain("postCurrentPayload(panel)");
  });

  it("tracks open architecture map panels and forgets disposed panels", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(source).toContain("const mapPanels: MapPanelSet = new Set()");
    expect(source).toContain("openMap(context, mapPanels)");
    expect(source).toContain("mapPanels.add(panel)");
    expect(source).toContain("panel.onDidDispose");
    expect(source).toContain("mapPanels.delete(panel)");
  });

  it("does not reference removed architecture source layout in instructions", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(source).not.toContain("model/path-map.json");
    expect(source).not.toContain("model/elements");
    expect(source).not.toContain("generated/");
    expect(source).not.toContain("context-packs");
  });

  it("targets only Arch4 workspace artifacts for removal", () => {
    expect(
      arch4OwnedArtifactPaths("/workspace").map(
        (artifact) => artifact.relativePath,
      ),
    ).toEqual([
      ".arch4",
      ".cursor/rules/arch4.mdc",
      ".cursor/skills/c4",
      ".cursor/skills/arch4",
      ".cursor/commands/seed-arch4.md",
      ".cursor/commands/update-arch4.md",
      ".cursor/commands/review-arch4.md",
    ]);
  });

  it("does not remove Arch4 workspace artifacts when confirmation is cancelled", async () => {
    const removed: string[] = [];

    const result = await removeArch4OwnedArtifacts("/workspace", {
      confirm: async () => false,
      exists: () => true,
      remove: async (absolutePath) => {
        removed.push(absolutePath);
      },
    });

    expect(result.cancelled).toBe(true);
    expect(result.removed).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("removes existing root-level Arch4 workspace artifacts after confirmation", async () => {
    const removed: string[] = [];

    const result = await removeArch4OwnedArtifacts("/workspace", {
      confirm: async () => true,
      exists: (absolutePath) =>
        absolutePath.endsWith(".arch4") ||
        absolutePath.endsWith("update-arch4.md"),
      remove: async (absolutePath) => {
        removed.push(absolutePath);
      },
    });

    expect(result.cancelled).toBe(false);
    expect(result.removed.map((artifact) => artifact.relativePath)).toEqual([
      ".arch4",
      ".cursor/commands/update-arch4.md",
    ]);
    expect(
      removed.map((absolutePath) => path.relative("/workspace", absolutePath)),
    ).toEqual([".arch4", ".cursor/commands/update-arch4.md"]);
  });

  it("removes existing Cursor artifacts without inspecting generated content", async () => {
    const root = tempWorkspace();
    const commandPath = path.join(root, ".cursor", "commands");
    mkdirSync(commandPath, { recursive: true });
    writeFileSync(
      path.join(commandPath, "update-arch4.md"),
      "# Update Arch4 Architecture Model\n\nUser customization.\n",
      "utf8",
    );
    const removed: string[] = [];

    const result = await removeArch4OwnedArtifacts(root, {
      confirm: async () => true,
      remove: async (absolutePath) => {
        removed.push(absolutePath);
      },
    });

    expect(result.cancelled).toBe(false);
    expect(result.removed.map((artifact) => artifact.relativePath)).toEqual([
      ".cursor/commands/update-arch4.md",
    ]);
    expect(
      removed.map((absolutePath) => path.relative(root, absolutePath)),
    ).toEqual([".cursor/commands/update-arch4.md"]);
  });

  it("removes .arch4 directories without requiring an ownership marker", async () => {
    const root = tempWorkspace();
    mkdirSync(path.join(root, ".arch4", "custom"), { recursive: true });
    const removed: string[] = [];

    const result = await removeArch4OwnedArtifacts(root, {
      confirm: async () => true,
      remove: async (absolutePath) => {
        removed.push(absolutePath);
      },
    });

    expect(result.cancelled).toBe(false);
    expect(result.removed.map((artifact) => artifact.relativePath)).toEqual([
      ".arch4",
    ]);
    expect(
      removed.map((absolutePath) => path.relative(root, absolutePath)),
    ).toEqual([".arch4"]);
  });

  it("uses Arch4 ownership markers for installed Cursor files", () => {
    const source = readFileSync(path.resolve("src/extension.ts"), "utf8");

    expect(ARCH4_OWNERSHIP_MARKER).toBe("arch4-owned: true");
    expect(source).toContain("ARCH4_OWNERSHIP_MARKER");
    expect(source).toContain("Refusing to overwrite user-owned Cursor file");
  });

  it("allows initialize to mark exact legacy generated Cursor content", () => {
    expect(
      canReplaceArch4OwnedContent(
        "# Update Arch4 Architecture Model\r\n\r\nGenerated body.\r\n",
        "# Update Arch4 Architecture Model\n\nGenerated body.\n",
      ),
    ).toBe(true);
  });

  it("blocks initialize from replacing modified unmarked Cursor content", () => {
    expect(
      canReplaceArch4OwnedContent(
        "# Update Arch4 Architecture Model\n\nUser customization.\n",
        "# Update Arch4 Architecture Model\n\nGenerated body.\n",
      ),
    ).toBe(false);
  });

  it("does not create backup directories for workspace artifact removal", () => {
    const source = readFileSync(
      path.resolve("src/workspace-artifacts.ts"),
      "utf8",
    );

    expect(source).not.toContain("backups");
    expect(source).not.toContain("backup");
  });
});

describe("workspace JSON loading", () => {
  it("keeps valid diagrams and reports malformed view JSON", async () => {
    const root = tempWorkspace();
    const viewsDir = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "views",
    );
    mkdirSync(viewsDir, { recursive: true });
    writeFileSync(
      path.join(viewsDir, "valid.json"),
      `${JSON.stringify(sampleDiagram(), null, 2)}\n`,
      "utf8",
    );
    writeFileSync(path.join(viewsDir, "broken.json"), "{not-json", "utf8");

    const result = await readDiagrams(root, viewsDir);

    expect(result.diagrams.map((diagram) => diagram.id)).toEqual(["Context"]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.json.invalid",
        path: ".arch4/architecture/build/views/broken.json",
      }),
    );
  });

  it("reports malformed architecture index JSON without throwing", async () => {
    const root = tempWorkspace();
    const indexPath = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "architecture-index.json",
    );
    mkdirSync(path.dirname(indexPath), { recursive: true });
    writeFileSync(indexPath, "{not-json", "utf8");

    const result = await readArchitectureIndex(root, indexPath);

    expect(result.index).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.json.invalid",
        path: ".arch4/architecture/build/architecture-index.json",
      }),
    );
  });

  it("reports malformed diagnostics JSON instead of swallowing it", async () => {
    const root = tempWorkspace();
    const diagnosticsPath = path.join(
      root,
      ".arch4",
      "architecture",
      "build",
      "diagnostics.json",
    );
    mkdirSync(path.dirname(diagnosticsPath), { recursive: true });
    writeFileSync(diagnosticsPath, "{not-json", "utf8");

    const diagnostics = await readDiagnosticsFile(root, diagnosticsPath);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "arch4.json.invalid",
        path: ".arch4/architecture/build/diagnostics.json",
      }),
    );
  });

  it("includes renderer diagnostics alongside architecture index diagnostics without duplicates", async () => {
    const root = tempWorkspace();
    const paths = resolveArch4Paths(root);
    mkdirSync(paths.buildDir, { recursive: true });
    const repeatedDiagnostic = {
      level: "error" as const,
      code: "arch4.shared",
      message: "Appears in both files.",
      path: ".arch4/architecture/workspace.dsl",
    };
    writeFileSync(
      paths.architectureIndexPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: "2026-06-13T00:00:00.000Z",
          projectRoot: root,
          elements: [],
          relationships: [],
          views: [],
          diagnostics: [
            repeatedDiagnostic,
            {
              level: "warning",
              code: "arch4.index.warning",
              message: "Index warning.",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeFileSync(
      paths.diagnosticsPath,
      `${JSON.stringify(
        [
          repeatedDiagnostic,
          {
            level: "error",
            code: "arch4.structurizr.validate_failed",
            message: "Renderer failure.",
            path: ".arch4/architecture/workspace.dsl",
          },
        ],
        null,
        2,
      )}\n`,
      "utf8",
    );

    const indexResult = await readArchitectureIndex(
      root,
      paths.architectureIndexPath,
    );
    const diagnostics = await readWorkspaceDiagnostics(
      root,
      paths,
      { diagrams: [], diagnostics: [] },
      indexResult,
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "arch4.shared",
      "arch4.index.warning",
      "arch4.structurizr.validate_failed",
    ]);
  });
});

function tempWorkspace(): string {
  return mkdtempSync(path.join(tmpdir(), "arch4-extension-test-"));
}

function sampleDiagram(): DiagramSpec {
  return {
    id: "Context",
    name: "Context",
    type: "system_context",
    nodes: [
      {
        id: "system",
        type: "softwareSystem",
        name: "System",
      },
    ],
    edges: [],
  };
}
