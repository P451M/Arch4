import type { CSSProperties } from "react";

export function edgeStyleVars(style?: Record<string, string>): CSSProperties {
  if (!style?.stroke && !style?.strokeWidth) return {};
  const vars: CSSProperties & Record<string, string> = {};
  if (style.stroke) {
    vars["--arch4-edge-stroke"] = style.stroke;
  }
  if (style.strokeWidth) {
    vars["--arch4-edge-width"] = style.strokeWidth;
  }
  return vars;
}

export function boundaryStyleVars(
  style?: Record<string, string>,
): CSSProperties {
  if (!style) return {};
  const vars: CSSProperties & Record<string, string> = {};
  if (style.border) {
    vars["--arch4-boundary-border"] = style.border;
  }
  if (style.background) {
    vars["--arch4-boundary-fill"] = style.background;
  }
  if (style.label) {
    vars["--arch4-boundary-label"] = style.label;
  }
  if (style.strokeWidth) {
    vars["--arch4-boundary-width"] = style.strokeWidth;
  }
  return vars;
}

export function safeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
