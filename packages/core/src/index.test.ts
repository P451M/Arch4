import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compactArch4ManualLayout,
  readArch4ManualLayout,
  safeId,
  validateArch4ManualLayout,
  writeArch4ManualLayout,
  type Arch4ManualLayout,
} from "./index.js";

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe("Arch4 manual layout sidecar", () => {
  it("returns an empty layout when the sidecar is missing", () => {
    const dir = tempDir();
    const result = readArch4ManualLayout(path.join(dir, "manual-layout.json"));

    expect(result.diagnostics).toEqual([]);
    expect(result.value).toEqual({ schemaVersion: 1, views: {} });
  });

  it("parses valid manual node coordinates", () => {
    const result = validateArch4ManualLayout({
      schemaVersion: 1,
      views: {
        containers: {
          nodes: {
            api: { x: 120, y: 240 },
          },
        },
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.value?.views.containers?.nodes?.api).toEqual({
      x: 120,
      y: 240,
    });
  });

  it("rejects non-finite manual node coordinates", () => {
    const result = validateArch4ManualLayout({
      schemaVersion: 1,
      views: {
        containers: {
          nodes: {
            api: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
          },
        },
      },
    });

    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "arch4.manual_layout.position" }),
    ]);
  });

  it("ignores legacy edge label coordinates without treating the view as invalid", () => {
    const result = validateArch4ManualLayout({
      schemaVersion: 1,
      views: {
        containers: {
          edgeLabels: {
            "api-db": { x: 320, y: 180 },
          },
        },
      },
    });

    expect(result.diagnostics).toEqual([]);
  });

  it("omits empty views and invalid coordinates when writing", () => {
    const dir = tempDir();
    const filePath = path.join(dir, "manual-layout.json");
    const manualLayout: Arch4ManualLayout = {
      schemaVersion: 1,
      views: {
        empty: { nodes: {} },
        mixed: {
          nodes: {
            api: { x: 10, y: 20 },
            bad: { x: Number.NaN, y: 30 },
          },
        },
      },
    };

    writeArch4ManualLayout(filePath, manualLayout);
    const result = readArch4ManualLayout(filePath);

    expect(compactArch4ManualLayout(manualLayout)).toEqual({
      schemaVersion: 1,
      views: {
        mixed: {
          nodes: {
            api: { x: 10, y: 20 },
          },
        },
      },
    });
    expect(result.value).toEqual(compactArch4ManualLayout(manualLayout));
  });
});

describe("shared layout utilities", () => {
  it("normalizes identifiers with a configurable fallback", () => {
    expect(safeId("System Context View")).toBe("System-Context-View");
    expect(safeId(" / ", "view")).toBe("view");
  });
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "arch4-core-"));
  tempDirs.push(dir);
  return dir;
}
