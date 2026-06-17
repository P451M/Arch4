import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import {
  type ArchitectureIndex,
  type DiagramSpec,
  type Diagnostic,
  type LayoutDirection,
  isLayoutDirection,
  resolveArch4Paths,
} from "@arch4/core";
import {
  createViewerPayload,
  readArchitectureIndex,
  readDiagrams,
  readWorkspaceDiagnostics,
  updateArchitectureLayout,
} from "@arch4/workflows";
import {
  ARCH4_OWNERSHIP_MARKER,
  type Arch4OwnedArtifact,
  canReplaceArch4OwnedContent,
  removeArch4OwnedArtifacts,
} from "./workspace-artifacts.js";

const execFileAsync = promisify(execFile);
const ARCH4_ARTIFACT_REFRESH_DEBOUNCE_MS = 250;
const lastPayloadDigestByPanel = new WeakMap<vscode.WebviewPanel, string>();

type CursorContextArtifact = {
  relativePath: string;
  contentFileRelativePath: string;
  content: string;
};

type MapPanelSet = Set<vscode.WebviewPanel>;

type Arch4ArtifactRefreshScheduler = vscode.Disposable & {
  schedule: () => void;
};

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Arch4");
  const provider = new Arch4TreeProvider();
  const mapPanels: MapPanelSet = new Set();
  const artifactRefresh = createArch4ArtifactRefreshScheduler(
    provider,
    mapPanels,
  );
  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("arch4.explorer", provider),
  );
  context.subscriptions.push(artifactRefresh);
  context.subscriptions.push(
    ...registerArch4ArtifactWatchers(artifactRefresh.schedule),
  );
  context.subscriptions.push(
    command("arch4.openMap", async () => openMap(context, mapPanels)),
  );
  context.subscriptions.push(
    command("arch4.buildArtifacts", async () =>
      buildArchitectureArtifacts(context, provider, mapPanels),
    ),
  );
  context.subscriptions.push(
    command("arch4.updateModel", async () =>
      updateArchitectureModel(context, provider),
    ),
  );
  context.subscriptions.push(
    command("arch4.removeArtifacts", async () =>
      removeWorkspaceArtifacts(provider),
    ),
  );
  try {
    await installCursorLocalMcpPluginForWorkspace(context, output);
  } catch (error) {
    output.appendLine(
      `Could not install the Cursor MCP plugin automatically: ${errorMessage(error)}`,
    );
    void vscode.window
      .showWarningMessage(
        "Arch4 could not install its Cursor Agent MCP plugin automatically.",
        "Open Logs",
      )
      .then((choice) => {
        if (choice === "Open Logs") output.show();
      });
  }
}

export function deactivate() {}

function command(name: string, handler: () => Promise<void>) {
  return vscode.commands.registerCommand(name, async () => {
    try {
      await handler();
    } catch (error) {
      void vscode.window.showErrorMessage(
        error instanceof Error ? error.message : String(error),
      );
    }
  });
}

function createArch4ArtifactRefreshScheduler(
  provider: Arch4TreeProvider,
  mapPanels: MapPanelSet,
): Arch4ArtifactRefreshScheduler {
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      provider.refresh();
      void refreshOpenMapPanels(mapPanels).catch((error) => {
        console.error(
          `Arch4 could not reload architecture map: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, ARCH4_ARTIFACT_REFRESH_DEBOUNCE_MS);
  };
  return {
    schedule,
    dispose: () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = undefined;
    },
  };
}

function registerArch4ArtifactWatchers(
  scheduleArtifactRefresh: () => void,
): vscode.Disposable[] {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return [];
  const patterns = [
    ".arch4/architecture/build/views/*.json",
    ".arch4/architecture/build/architecture-index.json",
    ".arch4/architecture/build/diagnostics.json",
  ];
  return patterns.flatMap((pattern) => {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, pattern),
    );
    return [
      watcher,
      watcher.onDidCreate(scheduleArtifactRefresh),
      watcher.onDidChange(scheduleArtifactRefresh),
      watcher.onDidDelete(scheduleArtifactRefresh),
    ];
  });
}

async function runCli(
  args: string[],
  context: vscode.ExtensionContext,
): Promise<string> {
  const root = workspaceRoot();
  const cliPath = resolveCliPath(context);
  const env = resolveCliEnv(context);
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [cliPath, ...args],
    { cwd: root, env },
  );
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

async function openMap(
  context: vscode.ExtensionContext,
  mapPanels: MapPanelSet,
): Promise<void> {
  const root = workspaceRoot();
  let payload = await createViewerPayload(root);
  if (payload.diagrams.length) {
    await refreshArchitectureIndex(context);
  }
  const panel = vscode.window.createWebviewPanel(
    "arch4.map",
    "Arch4 Architecture Map",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
      retainContextWhenHidden: true,
    },
  );
  mapPanels.add(panel);
  panel.onDidDispose(() => {
    mapPanels.delete(panel);
  });
  payload = await createViewerPayload(root);
  panel.webview.onDidReceiveMessage((message: unknown) => {
    void handleWebviewMessage(context, panel, message);
  });
  panel.webview.html = renderWebviewHtml(
    context,
    panel.webview,
    payload.diagrams,
    payload.index,
    payload.diagnostics,
    payload.layoutDirections,
    payload.manualLayoutDiagramIds,
  );
}

async function handleWebviewMessage(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  message: unknown,
): Promise<void> {
  if (!isRecord(message)) return;
  const diagramId = stringMessageField(message.diagramId);
  if (!diagramId) return;
  try {
    if (message.type === "arch4.layoutDirectionChanged") {
      const direction = message.direction;
      if (!isLayoutDirection(direction)) return;
      await persistLayoutDirection(context, panel, diagramId, direction);
      return;
    }
    if (message.type === "arch4.nodePositionChanged") {
      const nodeId = stringMessageField(message.nodeId);
      const x = numberMessageField(message.x);
      const y = numberMessageField(message.y);
      if (!nodeId || x === undefined || y === undefined) return;
      await persistNodePosition(context, panel, diagramId, nodeId, x, y);
      return;
    }
    if (message.type === "arch4.manualLayoutReset") {
      await resetManualLayout(context, panel, diagramId);
    }
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Arch4 could not update layout: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function persistLayoutDirection(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  diagramId: string,
  direction: LayoutDirection,
): Promise<void> {
  const root = workspaceRoot();
  updateArchitectureLayout(root, { diagramId, direction });
  await runCli(["render"], context);
  await runCli(["index"], context);
  await postCurrentPayload(panel);
}

async function persistNodePosition(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  diagramId: string,
  nodeId: string,
  x: number,
  y: number,
): Promise<void> {
  const root = workspaceRoot();
  updateArchitectureLayout(root, { diagramId, nodeId, x, y });
  await runCli(["render"], context);
  await postCurrentPayload(panel);
}

async function resetManualLayout(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  diagramId: string,
): Promise<void> {
  const root = workspaceRoot();
  updateArchitectureLayout(root, { diagramId, resetManualLayout: true });
  await runCli(["render"], context);
  await postCurrentPayload(panel);
}

async function refreshOpenMapPanels(mapPanels: MapPanelSet): Promise<void> {
  await Promise.all([...mapPanels].map((panel) => postCurrentPayload(panel)));
}

async function postCurrentPayload(panel: vscode.WebviewPanel): Promise<void> {
  const root = workspaceRoot();
  const payload = await createViewerPayload(root);
  const digest = JSON.stringify(payload);
  if (lastPayloadDigestByPanel.get(panel) === digest) return;
  lastPayloadDigestByPanel.set(panel, digest);
  await panel.webview.postMessage({
    type: "arch4.payloadUpdated",
    payload,
  });
}

async function refreshArchitectureIndex(
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    await runCli(["index"], context);
  } catch (error) {
    void vscode.window.showWarningMessage(
      `Arch4 could not refresh map metadata: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function buildArchitectureArtifacts(
  context: vscode.ExtensionContext,
  provider: Arch4TreeProvider,
  mapPanels: MapPanelSet,
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Building Arch4 architecture artifacts",
    },
    async () => {
      await runCli(["render"], context);
      await runCli(["index"], context);
      provider.refresh();
      await refreshOpenMapPanels(mapPanels);
    },
  );
  void vscode.window.showInformationMessage(
    "Built Arch4 architecture artifacts from workspace.dsl.",
  );
}

async function updateArchitectureModel(
  context: vscode.ExtensionContext,
  provider: Arch4TreeProvider,
): Promise<void> {
  await prepareArchitectureModelWorkspace(context, provider);
  await openCursorPrompt(updateArchitectureRouterPrompt());
}

async function prepareArchitectureModelWorkspace(
  context: vscode.ExtensionContext,
  provider: Arch4TreeProvider,
): Promise<void> {
  await runCli(["init"], context);
  await installCursorContext({ notify: false });
  await installWorkspaceLauncher();
  provider.refresh();
}

async function removeWorkspaceArtifacts(
  provider: Arch4TreeProvider,
): Promise<void> {
  const root = workspaceRoot();
  const result = await removeArch4OwnedArtifacts(root, {
    confirm: confirmRemoveArtifacts,
  });
  if (result.cancelled) return;
  provider.refresh();
  if (!result.removed.length) {
    void vscode.window.showInformationMessage(
      "No Arch4 workspace artifacts were found.",
    );
    return;
  }
  void vscode.window.showInformationMessage(
    `Removed ${result.removed.length} Arch4 workspace artifact(s).`,
  );
}

async function confirmRemoveArtifacts(
  artifacts: Arch4OwnedArtifact[],
): Promise<boolean> {
  const listedPaths = artifacts
    .map((artifact) => `- ${artifact.relativePath}`)
    .join("\n");
  const choice = await vscode.window.showWarningMessage(
    `Remove these Arch4-owned workspace artifacts?\n\n${listedPaths}`,
    { modal: true },
    "Remove Artifacts",
  );
  return choice === "Remove Artifacts";
}

async function openCursorPrompt(prompt: string): Promise<void> {
  const link = new URL("cursor://anysphere.cursor-deeplink/prompt");
  link.searchParams.set("text", prompt);
  await vscode.env.openExternal(vscode.Uri.parse(link.toString()));
}

async function installCursorLocalMcpPluginForWorkspace(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
): Promise<void> {
  const syncPlugin = async () => {
    const root = maybeWorkspaceRoot();
    if (root) await installCursorLocalMcpPlugin(context, root);
  };

  await syncPlugin();
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void syncPlugin().catch((error) => {
        output.appendLine(
          `Could not refresh the Cursor MCP plugin workspace root: ${errorMessage(error)}`,
        );
      });
    }),
  );
}

async function installCursorLocalMcpPlugin(
  context: vscode.ExtensionContext,
  root: string,
): Promise<string> {
  const pluginPath = cursorLocalMcpPluginPath();
  const manifestDir = path.join(pluginPath, ".cursor-plugin");
  await mkdir(manifestDir, { recursive: true });
  await writeFile(
    path.join(manifestDir, "plugin.json"),
    `${JSON.stringify(cursorExtensionMcpPluginManifest(context), null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(pluginPath, "mcp.json"),
    `${JSON.stringify(
      {
        mcpServers: {
          arch4: extensionMcpServerConfig(context, root),
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return pluginPath;
}

function cursorLocalMcpPluginPath(): string {
  return path.join(os.homedir(), ".cursor", "plugins", "local", "arch4-mcp");
}

function cursorExtensionMcpPluginManifest(
  context: vscode.ExtensionContext,
): Record<string, unknown> {
  const packageJson = context.extension.packageJSON as
    | { version?: unknown }
    | undefined;
  return {
    name: "arch4-mcp",
    version:
      typeof packageJson?.version === "string" ? packageJson.version : "0.0.0",
    description: "Arch4 MCP tools from the installed Arch4 Cursor extension.",
    mcpServers: "mcp.json",
  };
}

function extensionMcpServerConfig(
  context: vscode.ExtensionContext,
  root: string,
): Record<string, unknown> {
  return {
    type: "stdio",
    command: process.execPath,
    args: [resolveMcpPath(context), "--root", root],
    env: mcpEnv(context),
  };
}

async function installCursorContext(
  options: { notify?: boolean } = {},
): Promise<void> {
  const root = workspaceRoot();
  const rulesDir = path.join(root, ".cursor", "rules");
  const c4SkillsDir = path.join(root, ".cursor", "skills", "c4");
  const arch4SkillsDir = path.join(root, ".cursor", "skills", "arch4");
  const commandsDir = path.join(root, ".cursor", "commands");
  await mkdir(rulesDir, { recursive: true });
  await mkdir(c4SkillsDir, { recursive: true });
  await mkdir(arch4SkillsDir, { recursive: true });
  await mkdir(commandsDir, { recursive: true });
  for (const artifact of cursorContextArtifacts()) {
    await writeArch4OwnedFile(
      path.join(root, artifact.contentFileRelativePath),
      artifact.content,
    );
  }
  if (options.notify ?? true) {
    void vscode.window.showInformationMessage(
      "Installed Arch4 Cursor rule, C4/Arch4 skills, and /seed-arch4, /update-arch4, and /review-arch4 commands.",
    );
  }
}

async function installWorkspaceLauncher(): Promise<void> {
  const root = workspaceRoot();
  const binDir = path.join(root, ".arch4", "bin");
  await mkdir(binDir, { recursive: true });
  const launcherPath = path.join(binDir, "arch4");
  const windowsLauncherPath = path.join(binDir, "arch4.cmd");
  const packageJsonPath = path.join(binDir, "package.json");
  await writeArch4OwnedFile(
    packageJsonPath,
    arch4LauncherPackageJsonTemplate(),
    "Arch4 launcher",
  );
  await writeArch4OwnedFile(
    launcherPath,
    arch4LauncherTemplate(),
    "Arch4 launcher",
  );
  await chmod(launcherPath, 0o755);
  await writeArch4OwnedFile(
    windowsLauncherPath,
    arch4WindowsLauncherTemplate(),
    "Arch4 launcher",
  );
}

function renderWebviewHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  diagrams: DiagramSpec[],
  index: ArchitectureIndex | undefined,
  diagnostics: Diagnostic[],
  layoutDirections: Record<string, LayoutDirection>,
  manualLayoutDiagramIds: string[],
): string {
  const payload = escapeHtml(
    JSON.stringify({
      diagrams,
      index,
      diagnostics,
      layoutDirections,
      manualLayoutDiagramIds,
    }),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "webview.css"),
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "webview.js"),
  );
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource}`,
    `script-src ${webview.cspSource}`,
    `font-src ${webview.cspSource}`,
    `connect-src 'none'`,
  ].join("; ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${escapeAttribute(String(styleUri))}">
  <title>Arch4</title>
</head>
<body>
  <div id="root"></div>
  <template id="arch4-payload">${payload}</template>
  <script type="module" src="${escapeAttribute(String(scriptUri))}"></script>
</body>
</html>`;
}

function stringMessageField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberMessageField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function writeArch4OwnedFile(
  filePath: string,
  content: string,
  artifactKind = "Cursor file",
): Promise<void> {
  const markedContent = withArch4OwnershipMarker(content);
  try {
    const existing = await readFile(filePath, "utf8");
    if (!canReplaceArch4OwnedContent(existing, content)) {
      throw new Error(
        `Refusing to overwrite user-owned ${artifactKind}: ${filePath}`,
      );
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
  await writeFile(filePath, markedContent, "utf8");
}

function cursorContextArtifacts(): readonly CursorContextArtifact[] {
  return [
    {
      relativePath: ".cursor/rules/arch4.mdc",
      contentFileRelativePath: ".cursor/rules/arch4.mdc",
      content: cursorRuleTemplate(),
    },
    {
      relativePath: ".cursor/skills/c4",
      contentFileRelativePath: ".cursor/skills/c4/SKILL.md",
      content: c4SkillTemplate(),
    },
    {
      relativePath: ".cursor/skills/arch4",
      contentFileRelativePath: ".cursor/skills/arch4/SKILL.md",
      content: arch4SkillTemplate(),
    },
    {
      relativePath: ".cursor/commands/seed-arch4.md",
      contentFileRelativePath: ".cursor/commands/seed-arch4.md",
      content: seedArch4CommandTemplate(),
    },
    {
      relativePath: ".cursor/commands/update-arch4.md",
      contentFileRelativePath: ".cursor/commands/update-arch4.md",
      content: updateArch4CommandTemplate(),
    },
    {
      relativePath: ".cursor/commands/review-arch4.md",
      contentFileRelativePath: ".cursor/commands/review-arch4.md",
      content: reviewArch4CommandTemplate(),
    },
  ];
}

function arch4LauncherTemplate(): string {
  return `#!/usr/bin/env node
// ${ARCH4_OWNERSHIP_MARKER}
import { existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const extensionDir = findArch4ExtensionDir();
if (!extensionDir) {
  fail("Could not find an installed Arch4 Cursor extension. Reinstall Arch4 in Cursor, then run Arch4: Create/Update Architecture Model.");
}

const cliPath = path.join(extensionDir, "cli", "index.js");
const runtimeDir = path.join(extensionDir, "runtime");
if (!existsSync(cliPath)) {
  fail(\`Installed Arch4 extension is missing bundled CLI at \${cliPath}. Reinstall Arch4 in Cursor, then run Arch4: Create/Update Architecture Model.\`);
}
if (!existsSync(runtimeDir)) {
  fail(\`Installed Arch4 extension is missing bundled runtime at \${runtimeDir}. Reinstall Arch4 in Cursor, then run Arch4: Create/Update Architecture Model.\`);
}

const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ARCH4_RUNTIME_DIR: runtimeDir },
});

if (result.error) fail(result.error.message);
if (typeof result.status === "number") process.exit(result.status);
process.exit(1);

function findArch4ExtensionDir() {
  const roots = [
    process.env.CURSOR_EXTENSIONS_DIR,
    process.env.VSCODE_EXTENSIONS,
    path.join(os.homedir(), ".cursor", "extensions"),
  ].filter(Boolean);
  const candidates = [];
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith("arch4.arch4-cursor-extension-")) continue;
      const candidate = path.join(root, entry);
      const stats = statSync(candidate);
      if (stats.isDirectory()) candidates.push({ path: candidate, mtimeMs: stats.mtimeMs });
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0]?.path;
}

function fail(message) {
  console.error(\`arch4.launcher: \${message}\`);
  process.exit(1);
}
`;
}

function arch4WindowsLauncherTemplate(): string {
  return `@echo off
rem ${ARCH4_OWNERSHIP_MARKER}
node "%~dp0arch4" %*
`;
}

function arch4LauncherPackageJsonTemplate(): string {
  return `{
  "${ARCH4_OWNERSHIP_MARKER}": true,
  "type": "module"
}
`;
}

function withArch4OwnershipMarker(content: string): string {
  if (content.includes(ARCH4_OWNERSHIP_MARKER)) return content;
  if (content.startsWith("---\n")) {
    return content.replace("---\n", `---\n${ARCH4_OWNERSHIP_MARKER}\n`);
  }
  return `<!-- ${ARCH4_OWNERSHIP_MARKER} -->\n${content}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

class Arch4TreeProvider implements vscode.TreeDataProvider<Arch4TreeItem> {
  private readonly emitter = new vscode.EventEmitter<
    Arch4TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: Arch4TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Arch4TreeItem): Promise<Arch4TreeItem[]> {
    const root = maybeWorkspaceRoot();
    if (!root) return [];
    const paths = resolveArch4Paths(root);
    if (!element) {
      return [
        new Arch4TreeItem(
          "Diagrams",
          "diagrams",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
        new Arch4TreeItem(
          "Elements",
          "elements",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
        new Arch4TreeItem(
          "Relationships",
          "relationships",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
        new Arch4TreeItem(
          "Diagnostics",
          "diagnostics",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
      ];
    }
    if (element.kind === "diagrams") {
      return (await readDiagrams(root, paths.viewsDir)).diagrams.map(
        (diagram) =>
          new Arch4TreeItem(
            diagram.name,
            "leaf",
            vscode.TreeItemCollapsibleState.None,
            diagram.type,
          ),
      );
    }
    if (element.kind === "elements") {
      const indexResult = await readArchitectureIndex(
        root,
        paths.architectureIndexPath,
      );
      return (indexResult.index?.elements ?? []).map(
        (item) =>
          new Arch4TreeItem(
            item.name,
            "leaf",
            vscode.TreeItemCollapsibleState.None,
            item.entityId,
          ),
      );
    }
    if (element.kind === "relationships") {
      const indexResult = await readArchitectureIndex(
        root,
        paths.architectureIndexPath,
      );
      return (indexResult.index?.relationships ?? []).map((item) => {
        const label =
          item.label ??
          `${item.sourceEntityId ?? "unknown"} -> ${item.targetEntityId ?? "unknown"}`;
        return new Arch4TreeItem(
          label,
          "leaf",
          vscode.TreeItemCollapsibleState.None,
          item.views.join(", "),
        );
      });
    }
    if (element.kind === "diagnostics") {
      const diagramResult = await readDiagrams(root, paths.viewsDir);
      const indexResult = await readArchitectureIndex(
        root,
        paths.architectureIndexPath,
      );
      const diagnostics = await readWorkspaceDiagnostics(
        root,
        paths,
        diagramResult,
        indexResult,
      );
      return diagnostics.map(
        (item) =>
          new Arch4TreeItem(
            item.code,
            "leaf",
            vscode.TreeItemCollapsibleState.None,
            item.message,
          ),
      );
    }
    return [];
  }
}

class Arch4TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    readonly kind: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    description?: string,
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}

function resolveCliPath(context: vscode.ExtensionContext): string {
  const extensionRoot = context.extensionUri.fsPath;
  const bundledCli = path.join(extensionRoot, "cli", "index.js");
  if (existsSync(bundledCli)) return bundledCli;
  return path.resolve(extensionRoot, "..", "cli", "dist", "index.js");
}

function resolveMcpPath(context: vscode.ExtensionContext): string {
  const extensionRoot = context.extensionUri.fsPath;
  const bundledMcp = path.join(extensionRoot, "mcp", "index.js");
  if (existsSync(bundledMcp)) return bundledMcp;
  return path.resolve(extensionRoot, "..", "mcp", "dist", "stdio.js");
}

function resolveCliEnv(context: vscode.ExtensionContext): NodeJS.ProcessEnv {
  const extensionRoot = context.extensionUri.fsPath;
  const runtimeDir = resolveRuntimeDir(context);
  if (runtimeDir) {
    return { ...process.env, ARCH4_RUNTIME_DIR: runtimeDir };
  }

  const bundledCli = path.join(extensionRoot, "cli", "index.js");
  if (existsSync(bundledCli) && !isSourceDevelopmentExtension(context)) {
    throw new Error(
      "Arch4 packaged runtime is missing from this extension install. Reinstall Arch4 from OpenVSX or install the matching platform VSIX.",
    );
  }

  return process.env;
}

function resolveRuntimeDir(
  context: vscode.ExtensionContext,
): string | undefined {
  const extensionRoot = context.extensionUri.fsPath;
  const packagedRuntimeDir = path.join(extensionRoot, "runtime");
  if (existsSync(packagedRuntimeDir)) return packagedRuntimeDir;

  const sourceRuntimeDir = path.resolve(extensionRoot, "..", "..", "runtime");
  if (isSourceDevelopmentExtension(context) && existsSync(sourceRuntimeDir)) {
    return sourceRuntimeDir;
  }

  return undefined;
}

function mcpEnv(context: vscode.ExtensionContext): Record<string, string> {
  const env: Record<string, string> = {
    ELECTRON_RUN_AS_NODE: "1",
  };
  const runtimeDir = resolveRuntimeDir(context);
  if (runtimeDir) env.ARCH4_RUNTIME_DIR = runtimeDir;
  return env;
}

function isSourceDevelopmentExtension(
  context: vscode.ExtensionContext,
): boolean {
  return (
    context.extensionMode === vscode.ExtensionMode.Development ||
    existsSync(path.join(context.extensionUri.fsPath, "src", "extension.ts"))
  );
}

function workspaceRoot(): string {
  const root = maybeWorkspaceRoot();
  if (!root) throw new Error("Open a workspace folder before using Arch4.");
  return root;
}

function maybeWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function cursorRuleTemplate(): string {
  return `---
description: Keep Arch4 architecture maps current
alwaysApply: true
---

Arch4 source of truth lives in .arch4/architecture/.

After architectural changes, redesigns, dependency changes, runtime topology
changes, deployment changes, ownership changes, or source path moves, update
Arch4 before considering the work complete.

Architecture source:

- \`.arch4/architecture/workspace.dsl\` contains the architecture model.
- \`.arch4/architecture/entities/*.json\` contains entity metadata: owners,
  paths, confidence, open questions, and notes.
- \`.arch4/architecture/build/**\` is derived output. Never edit it as source.

Use the C4 and Arch4 skills for detailed workflow:

- Use \`/seed-arch4\` for first-time model creation when
  \`.arch4/architecture/workspace.dsl\` is empty or still minimal.
- Use \`/update-arch4\` for ongoing model maintenance when an architecture
  model already exists.
- Use \`/review-arch4\` before committing architecture-impacting changes.

Evidence boundaries:

- The first architecture model is AI-generated from repository inspection, not
  from scaffold assumptions.
- Do not invent architecture facts without source evidence from code, manifests,
  deployment/config files, tests, git history, existing model files, or explicit
  user input.
- Prefer adding diagnostics/open questions over silently encoding uncertain
  facts.
- Edit only \`.arch4/architecture/workspace.dsl\` and
  \`.arch4/architecture/entities/*.json\` as architecture source.
- Never edit \`.arch4/architecture/build/**\` as source.
- Keep architecture facts scoped to systems, dependencies, ownership, runtime,
  deployment, and paths that are evidenced in this repository.
- Before completing architecture-impacting work, review changed files against
  mapped entities and confirm relevant entity notes are still accurate.
`;
}

function c4SkillTemplate(): string {
  return `---
name: c4
description: Apply C4 model concepts and terminology when creating or reviewing software architecture diagrams.
---

# C4 Model Guidance

This skill is adapted from the C4 model for visualising software architecture by
Simon Brown: https://c4model.com/. The C4 website and example diagrams are
licensed under Creative Commons Attribution 4.0 International.

Use this skill to decide what belongs in C4 architecture models and views.

## Core Abstractions

- Software system: the highest-level system being modeled, plus other software
  systems it depends on or that depend on it. Usually this is the system a team
  owns and can inspect internally.
- Container: a runtime or data-store boundary required for the software system
  to work. Examples include web apps, mobile apps, services, jobs, serverless
  functions, databases, queues, caches, object stores, and file stores. A C4
  container is not necessarily a Docker/containerization unit.
- Component: a meaningful grouping of related functionality inside a container,
  encapsulated behind a well-defined interface. Components are not separately
  deployable units by default.
- Code: implementation details such as classes, functions, modules, and source
  files. Do not model code-level details unless explicitly requested.

## Diagram Guidance

- System context views show the target software system, people, and external
  systems. If actors or dependencies are unknown, include at least the target
  software system and record open questions.
- Container views show the runtime/data-store containers inside the target
  software system and their relationships to people and external systems.
- Component views zoom into important containers and show meaningful internal
  components, not folder structures or every class.
- Create a component view only when evidenced relationships make it useful. If
  candidate components have no meaningful relationships yet, skip the view or
  record why it is intentionally relationship-free.
- Deployment views show runtime environments, deployment nodes, infrastructure,
  and software/container instances. Create them only when deployment evidence is
  present.
- Dynamic views show how existing model elements collaborate at runtime for an
  important feature, story, use case, or recurring pattern. Use them sparingly
  and suggest candidates before creating them.

## Modeling Rules

- Prefer architecture-significant runtime boundaries over package, folder, or
  repository layout.
- Model packages or libraries as containers only when no stronger runtime
  boundary is evidenced, and record that modeling convention in notes or open
  questions.
- Use directional relationships with meaningful verbs and technology/protocol
  details when evidenced.
- Relationship labels must read as a natural sentence when placed between the
  source and target names: \`<source> <label> <target>\`. Include needed
  prepositions such as from, to, in, through, with, or by.
- Keep C4 scopes explicit: system context views show the target software system
  as one node, container views show containers inside the software system in
  scope, and component views are scoped to one container.
- Treat external systems as outside the scoped system; do not decompose them in
  its views.
- Use visual grouping only when it improves readability without implying false
  ownership, runtime containment, or decomposition.
- Avoid inventing actors, external systems, deployment topology, technologies,
  or relationships without evidence.
- Preserve uncertainty as open questions or low-confidence metadata.
`;
}

function arch4SkillTemplate(): string {
  return `---
name: arch4
description: Maintain Arch4 workspaces, source files, entity metadata, derived outputs, and CLI workflow.
---

# Arch4 Architecture Maintenance

Use this skill when editing or reviewing Arch4 files for the current repository.
Use the C4 skill for C4 modeling terminology and diagram semantics.

## Source Locations

- Architecture DSL: \`.arch4/architecture/workspace.dsl\`
- Entity metadata: \`.arch4/architecture/entities/*.json\`
- Derived output: \`.arch4/architecture/build/**\`
- Local agent launcher: \`.arch4/bin/**\`
- Cursor workflow helpers: \`.cursor/commands/*\`, \`.cursor/rules/arch4.mdc\`,
  and \`.cursor/skills/*\`

## Git Status Classification

- Expected Arch4 source edits: \`.arch4/architecture/workspace.dsl\` and
  \`.arch4/architecture/entities/*.json\`.
- Expected Arch4 generated or local artifacts: \`.arch4/architecture/build/**\`,
  \`.arch4/bin/**\`, \`.cursor/commands/*\`, \`.cursor/rules/arch4.mdc\`, and
  \`.cursor/skills/*\`.
- Unexpected changes: any other repository files unless the user explicitly
  requested them or they were already present before the Arch4 workflow.
- Do not label Arch4-owned initialization artifacts under \`.cursor/**\` or
  \`.arch4/bin/**\` as unexpected.

## Entity Metadata Schema

Each entity metadata file is stored at
\`.arch4/architecture/entities/{entityId}.json\`:

\`\`\`json
{
  "schemaVersion": 1,
  "entityId": "bookingApi",
  "owners": ["Platform"],
  "paths": ["src/booking-api/**/*"],
  "confidence": "high",
  "openQuestions": [],
  "notes": {}
}
\`\`\`

Use \`paths\` for repository file globs. Do not use \`pathGlobs\`.

## Entity Notes

Use \`notes\` for durable, evidence-backed architecture context that is not
already obvious from the DSL, paths, owners, or relationships.

- Prefer \`notes.summary\` as the first field when notes are present. Keep it to
  1-3 concise sentences about the entity's durable architecture role, not an
  implementation walkthrough.
- Use structured keys when evidenced and useful: \`summary\`,
  \`responsibilities\`, \`boundaries\`, \`dataOwnership\`, \`contracts\`,
  \`technologyNotes\`, \`dependencyNotes\`, \`operationalConcerns\`,
  \`decisions\`, \`risks\`, and \`evidence\`.
- Use \`technologyNotes\` and \`dependencyNotes\` for explanatory context, not as
  duplicates of DSL technology labels or modeled relationships. Good notes
  explain rationale, runtime constraints, dependency criticality, sync/async
  behavior, failure behavior, ownership boundaries, or coupling that affects
  future changes.
- Do not invent notes from guesses or names alone. Keep notes backed by code,
  manifests, deploy files, tests, docs, git history, existing Arch4 files, or
  explicit user input.
- Put uncertain facts in \`openQuestions\`, not \`notes\`.
- Avoid duplicating the DSL description or restating first-class Arch4 facts
  unless the note adds important context.
- Omit empty note fields and keep \`notes: {}\` when there is nothing durable to
  add.
- Update relevant entity notes when responsibilities, boundaries,
  dependencies, data ownership, runtime technology, runtime behavior,
  ownership, or paths change.

## Structurizr Identifier Discipline

- Check whether \`.arch4/architecture/workspace.dsl\` contains
  \`!identifiers hierarchical\` before editing identifiers, relationships,
  views, or metadata.
- With hierarchical identifiers, references outside an element's declaring scope
  must use fully qualified identifiers. For example, use
  \`developer -> arch4.arch4Extension\`, not
  \`developer -> arch4Extension\`.
- Nested component metadata must also use fully qualified identifiers. For
  example, use \`arch4.arch4Renderer.rendererExport\` as the metadata filename
  and \`entityId\`, not \`rendererExport\`.
- Use the same fully qualified identifiers in relationships, view subjects,
  include statements, metadata filenames, and \`entityId\` values.
- Before creating or renaming many elements, build an identifier inventory from
  the DSL tree and use that inventory for relationships, views, and metadata.
- Do not batch-create metadata from local nested names when hierarchical
  identifiers are enabled.

## Boundary Rendering

- Arch4 renders boundaries from DSL containment, deployment nodes, component
  view subjects, and Structurizr \`group\`.
- Preserve C4 containment in the DSL; use \`group\` for semantic or readability
  grouping only when labels do not imply false ownership, runtime containment,
  or decomposition.

## Workflow

1. Read the current Arch4 source files and relevant repository files.
2. Run \`.arch4/bin/arch4 doctor\`. If the local launcher, workspace, CLI, or
   runtime is missing, stop without edits and tell the user to run
   \`Arch4: Create/Update Architecture Model\` or reinstall Arch4.
3. Decide whether the change affects architecture responsibilities, boundaries,
   dependencies, deployment topology, data ownership, runtime technology,
   ownership metadata, or path coverage.
4. If it does, update \`.arch4/architecture/workspace.dsl\` and the relevant
   \`.arch4/architecture/entities/*.json\` metadata files.
5. Keep \`.arch4/architecture/build/**\` disposable and derived; do not edit it
   as source.
6. Validate/render/index the model after source edits with
   \`.arch4/bin/arch4 validate\`, \`.arch4/bin/arch4 render\`, and
   \`.arch4/bin/arch4 index\`. Treat command failure as a blocking error.
7. After rendering, inspect generated view JSON and report node, edge, and
   boundary counts for each view. Treat zero-edge component views as a quality
   problem unless intentionally justified.
8. Before committing or completing architecture-impacting work, review changed
   files against mapped entities and confirm relevant
   \`.arch4/architecture/entities/*.json\` notes are still accurate.
9. Run \`git status --short\` after architecture workflows and classify changes
   using the Git Status Classification rules above.

## Large Architecture Edit Workflow

For large DSL changes, use staged validation before metadata generation:

1. Model elements and boundaries.
2. Validate the DSL.
3. Add relationships and views.
4. Validate and render the DSL.
5. Create or update entity metadata from rendered or validated identifiers.
6. Index and inspect orphaned metadata warnings.

## CLI Commands

- \`.arch4/bin/arch4 doctor\`: verify the local Arch4 launcher, bundled CLI,
  and runtime.
- \`.arch4/bin/arch4 validate\`: validate the Structurizr workspace and write diagnostics.
- \`.arch4/bin/arch4 render\`: render DSL views into \`.arch4/architecture/build/views/\`.
- \`.arch4/bin/arch4 index\`: build \`.arch4/architecture/build/architecture-index.json\`
  and \`.arch4/architecture/build/context/*.md\`.
- \`.arch4/bin/arch4 context --changed-files <paths...>\`: retrieve compact architecture
  context for changed files.

## Evidence Rules

- Do not invent architecture facts.
- Use code, manifests, deploy files, git history, existing Arch4 model files, or
  explicit user input as evidence.
- When evidence is weak, preserve the uncertainty as diagnostics, open
  questions, notes, or low-confidence metadata.
- Do not add concepts that are not supported by source evidence in the current
  repository.
`;
}

function seedArch4CommandTemplate(): string {
  return seedArchitecturePrompt();
}

function updateArch4CommandTemplate(): string {
  return updateArchitecturePrompt();
}

function reviewArch4CommandTemplate(): string {
  return reviewArchitecturePrompt();
}

function updateArchitectureRouterPrompt(): string {
  return `# Create/Update Arch4 Architecture Model

Create or update this repository's Arch4 architecture model using the correct Arch4 workflow for the current model state.

Use both the C4 skill and the Arch4 skill. Follow this routing workflow:

1. Confirm \`.arch4/architecture/workspace.dsl\` and \`.arch4/bin/arch4\` exist.
2. Run \`.arch4/bin/arch4 doctor\`. If the local launcher, workspace, CLI, or runtime is missing, stop without edits and tell the user to run \`Arch4: Create/Update Architecture Model\` or reinstall Arch4.
3. Read \`.arch4/architecture/workspace.dsl\` and any entity metadata under \`.arch4/architecture/entities/\`.
4. Determine the DSL identifier mode. If \`!identifiers hierarchical\` is present, draft an identifier inventory before writing many relationships, views, or metadata files.
5. Decide whether \`.arch4/architecture/workspace.dsl\` is empty, scaffold-only, or still minimal.
6. If the model is empty or minimal, follow the same first-time seeding workflow as \`/seed-arch4\`:
   - inspect repository source files, dependency manifests, deployment/config files, tests, docs, and existing architecture notes
   - create or refresh the initial C4 model from evidenced facts only
   - include system context and relevant container/component views supported by evidence
   - use relationship labels that read as \`<source> <label> <target>\`
   - create component views only when they contain meaningful relationships, or explain why they are skipped
   - treat package-as-container modeling as an explicit convention when runtime boundaries are not evidenced
   - validate the element tree before creating bulk metadata
   - create or update \`.arch4/architecture/entities/*.json\` metadata from validated identifiers for modeled entities
   - write entity notes using the Arch4 skill's entity notes guidance
   - do not create dynamic views during initial seeding; suggest candidates instead
7. If the model already contains meaningful architecture facts, follow the same ongoing maintenance workflow as \`/update-arch4\`:
   - inspect repository source files, dependency manifests, deployment/config files, and tests needed to understand the actual architecture
   - identify architecture-relevant changes to responsibilities, boundaries, containers, components, relationships, deployment topology, runtime technologies, data ownership, and path ownership
   - maintain the existing model from changed facts without reseeding from scratch
   - preserve existing qualified identifiers unless a rename is explicitly justified
   - update relevant entity notes when mapped responsibilities, boundaries, dependencies, data ownership, runtime technology, runtime behavior, ownership, or paths changed
8. Update only Arch4 architecture source files when facts changed:
   - \`.arch4/architecture/workspace.dsl\`
   - \`.arch4/architecture/entities/*.json\`
9. Use staged validation before metadata generation for large DSL edits.
10. Do not invent architecture facts. If evidence is insufficient, add an open question or leave the model unchanged and explain the uncertainty.
11. Do not edit files under \`.arch4/architecture/build/**\`; they are derived output.
12. Run \`.arch4/bin/arch4 validate\`, \`.arch4/bin/arch4 render\`, and \`.arch4/bin/arch4 index\` after source edits and report the result. Treat command failure as a blocking error.
13. Inspect rendered view JSON and report node, edge, and boundary counts for each view.
14. Run \`git status --short\` and classify changes as Arch4 source edits, Arch4 generated/local artifacts, and unexpected non-Arch4 files. Do not label Arch4-owned initialization artifacts under \`.cursor/**\` or \`.arch4/bin/**\` as unexpected.

Return a concise summary of which workflow was used, model changes, evidence used, and any open questions.`;
}

function seedArchitecturePrompt(): string {
  return `# Seed Arch4 Architecture Model

Create this repository's initial Arch4 architecture model.

Use both the C4 skill and the Arch4 skill. Follow this workflow:

1. Confirm \`.arch4/architecture/workspace.dsl\` and \`.arch4/bin/arch4\` exist.
2. Run \`.arch4/bin/arch4 doctor\`. If the local launcher, workspace, CLI, or runtime is missing, stop without edits and tell the user to run \`Arch4: Create/Update Architecture Model\` or reinstall Arch4.
3. Read \`.arch4/architecture/workspace.dsl\` and any entity metadata under \`.arch4/architecture/entities/\`.
4. Determine the DSL identifier mode. If \`!identifiers hierarchical\` is present, draft an identifier inventory before writing many relationships, views, or metadata files.
5. Inspect repository source files, dependency manifests, deployment/config files, tests, docs, and existing architecture notes needed to understand the actual architecture.
6. Create or refresh the initial C4 model in \`.arch4/architecture/workspace.dsl\` using only evidenced facts:
   - include a system context view; if actors or external dependencies are unknown, include at least the target software system and record open questions
   - include all relevant container views supported by evidence
   - include only component views that have meaningful evidenced relationships; skip or justify relationship-free component candidates
   - include deployment views only when deployment/runtime evidence exists
   - use relationship labels that read as \`<source> <label> <target>\`, including needed prepositions
   - treat package-as-container modeling as an explicit convention when runtime boundaries are not evidenced
7. Use staged validation before metadata generation for large DSL edits.
8. Create or update \`.arch4/architecture/entities/*.json\` metadata from validated identifiers for modeled entities, including paths, owners when known, confidence, open questions, and notes that follow the Arch4 skill's entity notes guidance.
9. Do not create dynamic views during initial seeding. Instead, identify suitable dynamic view candidates.
10. Do not edit files under \`.arch4/architecture/build/**\`; they are derived output.
11. Run \`.arch4/bin/arch4 validate\`, \`.arch4/bin/arch4 render\`, and \`.arch4/bin/arch4 index\` after source edits and report the result. Treat command failure as a blocking error.
12. Inspect rendered view JSON and report node, edge, and boundary counts for each view.
13. Run \`git status --short\` and classify changes as Arch4 source edits, Arch4 generated/local artifacts, and unexpected non-Arch4 files. Do not label Arch4-owned initialization artifacts under \`.cursor/**\` or \`.arch4/bin/**\` as unexpected.

Return a concise summary of model changes, evidence used, open questions, and suggested dynamic views. Ask which suggested dynamic views should be created next.`;
}

function updateArchitecturePrompt(): string {
  return `# Update Arch4 Architecture Model

Update this repository's Arch4 architecture model.

Use both the C4 skill and the Arch4 skill. Follow this workflow:

1. Confirm \`.arch4/architecture/workspace.dsl\` and \`.arch4/bin/arch4\` exist.
2. Run \`.arch4/bin/arch4 doctor\`. If the local launcher, workspace, CLI, or runtime is missing, stop without edits and tell the user to run \`Arch4: Create/Update Architecture Model\` or reinstall Arch4.
3. Read \`.arch4/architecture/workspace.dsl\` and any entity metadata under \`.arch4/architecture/entities/\`.
4. Determine the DSL identifier mode. If \`!identifiers hierarchical\` is present, draft an identifier inventory before writing many relationships, views, or metadata files.
5. Inspect repository source files, dependency manifests, deployment/config files, and tests needed to understand the actual architecture.
6. Identify architecture-relevant changes: responsibilities, boundaries, containers, components, relationships, deployment topology, runtime technologies, data ownership, and path ownership.
7. Maintain the existing model from the changed facts. Do not reseed from scratch unless \`.arch4/architecture/workspace.dsl\` is still empty or minimal.
8. Preserve existing qualified identifiers unless a rename is explicitly justified.
9. Update only Arch4 architecture source files when facts changed:
   - \`.arch4/architecture/workspace.dsl\`
   - \`.arch4/architecture/entities/*.json\`
10. Update relevant entity notes when mapped responsibilities, boundaries, dependencies, data ownership, runtime technology, runtime behavior, ownership, or paths changed.
11. Use staged validation before metadata generation for large DSL edits.
12. Do not invent architecture facts. If evidence is insufficient, add an open question or leave the model unchanged and explain the uncertainty.
13. Do not edit files under \`.arch4/architecture/build/**\`; they are derived output.
14. Run \`.arch4/bin/arch4 validate\`, \`.arch4/bin/arch4 render\`, and \`.arch4/bin/arch4 index\` after source edits and report the result. Treat command failure as a blocking error.
15. Inspect rendered view JSON and report node, edge, and boundary counts for each view.
16. Run \`git status --short\` and classify changes as Arch4 source edits, Arch4 generated/local artifacts, and unexpected non-Arch4 files. Do not label Arch4-owned initialization artifacts under \`.cursor/**\` or \`.arch4/bin/**\` as unexpected.

Return a concise summary of model changes, evidence used, and any open questions.`;
}

function reviewArchitecturePrompt(): string {
  return `# Review Arch4 Before Commit

Review whether the current repository changes require Arch4 updates.

Use both the C4 skill and the Arch4 skill. Follow this workflow:

1. Confirm \`.arch4/architecture/workspace.dsl\` and \`.arch4/bin/arch4\` exist.
2. Run \`.arch4/bin/arch4 doctor\`. If the local launcher, workspace, CLI, or runtime is missing, stop without edits and tell the user to run \`Arch4: Create/Update Architecture Model\` or reinstall Arch4.
3. Inspect changed files using git status and git diff. Include staged and unstaged changes when available.
4. Decide whether the changes affect architecture responsibilities, boundaries, containers, components, relationships, deployment topology, runtime technologies, data ownership, ownership metadata, or path ownership.
5. Review changed files against mapped entities and confirm relevant \`.arch4/architecture/entities/*.json\` notes are still accurate.
6. If architecture source must change, update only:
   - \`.arch4/architecture/workspace.dsl\`
   - \`.arch4/architecture/entities/*.json\`
7. When entity notes are stale, update them using the Arch4 skill's entity notes guidance.
8. Do not edit files under \`.arch4/architecture/build/**\`; they are derived output.
9. If only derived output is stale, run \`.arch4/bin/arch4 render\` and \`.arch4/bin/arch4 index\`. Treat command failure as a blocking error.
10. If render/index runs, inspect rendered view JSON and report node, edge, and boundary counts for each view.
11. Run \`git status --short\` and classify changes as Arch4 source edits, Arch4 generated/local artifacts, and unexpected non-Arch4 files. Do not label Arch4-owned initialization artifacts under \`.cursor/**\` or \`.arch4/bin/**\` as unexpected.
12. If no Arch4 source change is needed, say so and explain why.

Return a concise commit-review summary: changed files inspected, architecture impact, Arch4 updates made or intentionally skipped, validation/rendering result, and open questions.`;
}
