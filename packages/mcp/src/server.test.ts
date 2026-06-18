import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createArch4McpServer } from "./server.js";

describe("Arch4 MCP package contract", () => {
  it("declares the stdio binary expected by Cursor plugin distribution", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
      bin: Record<string, string>;
    };
    const pluginMcp = JSON.parse(
      readFileSync(
        path.resolve("../../plugins/cursor/arch4-mcp/mcp.json"),
        "utf8",
      ),
    ) as {
      mcpServers: { arch4: { command: string; args: string[] } };
    };

    expect(manifest.bin["arch4-mcp"]).toBe("./dist/stdio.js");
    expect(pluginMcp.mcpServers.arch4.command).toBe("npx");
    expect(pluginMcp.mcpServers.arch4.args).toEqual([
      "-y",
      "@arch4/mcp",
      "--root",
      "${workspaceFolder}",
    ]);
    const packageScripts = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageScripts.scripts.build).toContain("inline-mcp-widget.mjs");
  });

  it("exposes the map app resource through the canonical widget URI only", async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), "arch4-mcp-test-"));
    const server = createArch4McpServer({ projectRoot });
    const client = new Client({ name: "arch4-mcp-test", version: "0.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const resources = await client.listResources();
      expect(
        resources.resources
          .map((resource) => resource.uri)
          .filter((uri) => uri.includes("arch4")),
      ).toEqual(["ui://arch4/map.html"]);

      const resource = await client.readResource({
        uri: "ui://arch4/map.html",
      });
      expect(resource.contents).toHaveLength(1);
      expect(resource.contents[0]).toMatchObject({
        uri: "ui://arch4/map.html",
        mimeType: "text/html;profile=mcp-app",
      });
      expect(
        "text" in resource.contents[0] && resource.contents[0].text,
      ).toContain("root");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns an explicit app resource link from the show-map tool", () => {
    const source = readFileSync(path.resolve("src/server.ts"), "utf8");

    expect(source).toContain('type: "resource_link"');
    expect(source).toContain("uri: MAP_RESOURCE_URI");
    expect(source).not.toContain("arch4://architecture-map");
  });

  it("bridges host theme context into the map widget", () => {
    const source = readFileSync(path.resolve("src/widget/main.tsx"), "utf8");
    const styles = readFileSync(path.resolve("src/widget/widget.css"), "utf8");

    expect(source).toContain("applyDocumentTheme");
    expect(source).toContain("applyHostStyleVariables");
    expect(source).toContain("app.onhostcontextchanged");
    expect(source).toContain("app.getHostContext()");
    expect(source).toContain("transport.close()");
    expect(source).toContain("arch4-mcp-theme-${theme}");
    expect(styles).toContain(".arch4-mcp-theme-dark .arch4-viewer");
    expect(styles).toContain("--arch4-mcp-edge-inset");
    expect(styles).toContain("env(safe-area-inset-left, 0px)");
    expect(styles).toContain("env(safe-area-inset-right, 0px)");
    expect(styles).toContain("--arch4-control-right-inset");
    expect(styles).toContain(
      "--arch4-control-right-inset: var(--arch4-control-inset)",
    );
    expect(styles).toContain(
      "MCP hosts may inject body padding; Arch4 owns the iframe viewport.",
    );
    expect(styles).toContain("padding: 0 !important");
    expect(styles).toContain("max-width: 100vw");
  });

  it("preserves rendered views when layout-triggered rebuilds fail", () => {
    const source = readFileSync(path.resolve("src/server.ts"), "utf8");

    expect(source).toContain("buildArchitectureArtifacts(projectRoot, {");
    expect(source).toContain("preserveViewsOnError: true");
  });
});
