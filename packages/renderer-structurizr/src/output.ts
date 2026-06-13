import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { safeId, type DiagramSpec, writeJson } from "@arch4/core";

export function replaceRenderedViews(
  viewsDir: string,
  specs: DiagramSpec[],
): void {
  mkdirSync(path.dirname(viewsDir), { recursive: true });
  const tempViewsDir = mkdtempSync(
    path.join(path.dirname(viewsDir), ".views-"),
  );
  try {
    specs.forEach((spec) => {
      writeJson(path.join(tempViewsDir, `${safeId(spec.id)}.json`), spec);
    });
    rmSync(viewsDir, { force: true, recursive: true });
    renameSync(tempViewsDir, viewsDir);
  } catch (error) {
    rmSync(tempViewsDir, { force: true, recursive: true });
    throw error;
  }
}
