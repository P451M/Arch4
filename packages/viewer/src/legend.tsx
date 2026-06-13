import type { DiagramSpec } from "@arch4/core";
import { iconFor, legendVariant, variantClass } from "./icons.js";

export function LegendSwatch(props: {
  entry: NonNullable<DiagramSpec["legend"]>[number];
}) {
  const entry = props.entry;
  if (entry.kind === "element") {
    const Icon = iconFor(legendVariant(entry));
    return (
      <span
        className={`arch4-legend-icon ${variantClass(legendVariant(entry))}`}
        aria-hidden="true"
      >
        <Icon size={13} strokeWidth={2.35} />
      </span>
    );
  }
  return (
    <span
      className={`arch4-legend-swatch ${entry.kind === "relationship" ? "relationship" : ""} ${entry.kind === "boundary" ? "boundary" : ""}`}
      aria-hidden="true"
    />
  );
}
