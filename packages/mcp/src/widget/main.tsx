import React from "react";
import ReactDOM from "react-dom/client";
import { Arch4Viewer } from "@arch4/viewer";
import "@arch4/viewer/styles.css";
import "./widget.css";
import {
  App as McpApp,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps";
import type {
  ArchitectureIndex,
  DiagramSpec,
  Diagnostic,
  LayoutDirection,
} from "@arch4/core";

type Arch4ViewerPayload = {
  diagnostics?: Diagnostic[];
  diagrams?: DiagramSpec[];
  index?: ArchitectureIndex;
  layoutDirections?: Record<string, LayoutDirection>;
  manualLayoutDiagramIds?: string[];
};

type HostTheme = "light" | "dark";
type HostContext = {
  theme?: HostTheme;
  styles?: {
    variables?: Parameters<typeof applyHostStyleVariables>[0];
    css?: { fonts?: string };
  };
};

type OpenAiWindow = {
  toolOutput?: unknown;
  toolResponseMetadata?: unknown;
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};

declare global {
  interface Window {
    openai?: OpenAiWindow;
  }
}

let mcpApp: McpApp | undefined;

function App() {
  const [payload, setPayload] = React.useState<Arch4ViewerPayload>(() =>
    payloadFromToolResult({
      structuredContent: window.openai?.toolOutput,
      _meta: window.openai?.toolResponseMetadata,
    }),
  );
  const [theme, setTheme] = React.useState<HostTheme>(() =>
    preferredDocumentTheme(),
  );

  const applyHostContext = React.useCallback((context?: HostContext) => {
    const nextTheme = context?.theme ?? preferredDocumentTheme();
    applyDocumentTheme(nextTheme);
    setTheme(nextTheme);
    if (context?.styles?.variables) {
      applyHostStyleVariables(context.styles.variables);
    }
    if (context?.styles?.css?.fonts) {
      applyHostFonts(context.styles.css.fonts);
    }
  }, []);

  const applyToolResult = React.useCallback((result: unknown) => {
    const next = payloadFromToolResult(result);
    if (hasPayloadData(next)) setPayload(next);
  }, []);

  const callAndApplyTool = React.useCallback(
    async (name: string, args: Record<string, unknown>) => {
      applyToolResult(await callTool(name, args));
    },
    [applyToolResult],
  );

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      applyToolResult(event.data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [applyToolResult]);

  React.useEffect(() => {
    applyHostContext();

    if (window.openai) return;

    const app = new McpApp({ name: "arch4-map", version: "0.1.0" }, {});
    const transport = new PostMessageTransport(window.parent, window.parent);
    mcpApp = app;
    app.onhostcontextchanged = () => {
      applyHostContext(app.getHostContext());
    };
    app.ontoolresult = (result) => {
      applyToolResult(result);
    };
    void app
      .connect(transport)
      .then(() => {
        applyHostContext(app.getHostContext());
      })
      .catch((error: unknown) => {
        console.warn("Arch4 MCP app bridge failed to connect", error);
      });

    return () => {
      if (mcpApp === app) mcpApp = undefined;
      void transport.close().catch((error: unknown) => {
        console.warn("Arch4 MCP app bridge failed to close", error);
      });
    };
  }, [applyHostContext, applyToolResult]);

  const themeClass = `arch4-mcp-theme-${theme}`;

  if (!payload.diagrams?.length && !payload.diagnostics?.length) {
    return (
      <main className={`arch4-mcp-empty ${themeClass}`}>
        <h1>Arch4</h1>
        <p>Call arch4_show_map to load the architecture map.</p>
      </main>
    );
  }

  return (
    <div className={`arch4-mcp-root ${themeClass}`}>
      <Arch4Viewer
        architectureIndex={payload.index}
        diagrams={payload.diagrams ?? []}
        diagnostics={payload.diagnostics ?? payload.index?.diagnostics}
        initialLayoutDirections={payload.layoutDirections}
        initialManualLayoutDiagramIds={payload.manualLayoutDiagramIds}
        onLayoutDirectionChange={(change) => {
          void callAndApplyTool("arch4_update_layout", change);
        }}
        onManualLayoutReset={(change) => {
          void callAndApplyTool("arch4_update_layout", {
            ...change,
            resetManualLayout: true,
          });
        }}
        onNodePositionChange={(change) => {
          void callAndApplyTool("arch4_update_layout", change);
        }}
      />
    </div>
  );
}

function payloadFromToolResult(value: unknown): Arch4ViewerPayload {
  const record = asRecord(value);
  const params = asRecord(record?.params);
  const result = asRecord(params?.result) ?? asRecord(record?.result) ?? record;
  const meta = asRecord(result?._meta) ?? asRecord(record?._meta);
  const payload = asRecord(meta?.arch4Payload);
  if (payload) return payload as Arch4ViewerPayload;
  const structured = asRecord(result?.structuredContent);
  const structuredPayload = asRecord(structured?.arch4Payload);
  return (structuredPayload ?? {}) as Arch4ViewerPayload;
}

function hasPayloadData(payload: Arch4ViewerPayload): boolean {
  return Boolean(payload.diagrams || payload.index || payload.diagnostics);
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (window.openai?.callTool) {
    return window.openai.callTool(name, args);
  }
  if (mcpApp) {
    return mcpApp.callServerTool({ name, arguments: args });
  }
  window.parent?.postMessage(
    {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    },
    "*",
  );
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function preferredDocumentTheme(): HostTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
