import React from "react";
import ReactDOM from "react-dom/client";
import { Arch4Viewer } from "@arch4/viewer";
import "@arch4/viewer/styles.css";
import "../webview.css";
import type {
  ArchitectureIndex,
  DiagramSpec,
  Diagnostic,
  LayoutDirection,
} from "@arch4/core";

type WebviewPayload = {
  diagnostics?: Diagnostic[];
  diagrams?: DiagramSpec[];
  index?: ArchitectureIndex;
  layoutDirections?: Record<string, LayoutDirection>;
  manualLayoutDiagramIds?: string[];
};

type VsCodeApi = {
  postMessage(message: unknown): void;
};

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

function readPayload(): WebviewPayload {
  const element = document.getElementById("arch4-payload");
  const payloadText =
    element instanceof HTMLTemplateElement
      ? element.content.textContent
      : element?.textContent;
  if (!payloadText) return {};
  return JSON.parse(payloadText) as WebviewPayload;
}

const vscode = window.acquireVsCodeApi?.();

function App() {
  const [payload, setPayload] = React.useState<WebviewPayload>(() =>
    readPayload(),
  );
  React.useEffect(() => {
    const updatePayload = (event: MessageEvent) => {
      const message = event.data as
        | { type?: unknown; payload?: WebviewPayload }
        | undefined;
      if (message?.type !== "arch4.payloadUpdated") return;
      setPayload(message.payload ?? {});
    };
    window.addEventListener("message", updatePayload);
    return () => window.removeEventListener("message", updatePayload);
  }, []);
  return (
    <Arch4Viewer
      architectureIndex={payload.index}
      diagrams={payload.diagrams ?? []}
      diagnostics={payload.diagnostics ?? payload.index?.diagnostics}
      initialLayoutDirections={payload.layoutDirections}
      initialManualLayoutDiagramIds={payload.manualLayoutDiagramIds}
      onLayoutDirectionChange={(change) => {
        vscode?.postMessage({
          type: "arch4.layoutDirectionChanged",
          ...change,
        });
      }}
      onManualLayoutReset={(change) => {
        vscode?.postMessage({
          type: "arch4.manualLayoutReset",
          ...change,
        });
      }}
      onNodePositionChange={(change) => {
        vscode?.postMessage({
          type: "arch4.nodePositionChanged",
          ...change,
        });
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
