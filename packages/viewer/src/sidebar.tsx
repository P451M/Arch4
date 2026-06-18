import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { DiagramSpec } from "@arch4/core";
import {
  diagramIconForType,
  diagramIconVariant,
  diagramTreeLabel,
  titleForType,
  variantClass,
} from "./icons.js";
import type { Arch4TreeItem } from "./tree.js";

export function CollapsibleSidebarSection(props: {
  children: ReactNode;
  id: string;
  isNested?: boolean;
  isOpen: boolean;
  onToggle: (id: string) => void;
  title: string;
}) {
  return (
    <section
      className={props.isNested ? "arch4-sidebar-subsection" : undefined}
    >
      <button
        aria-expanded={props.isOpen}
        className={
          props.isNested ? "arch4-subsection-trigger" : "arch4-section-trigger"
        }
        type="button"
        onClick={() => props.onToggle(props.id)}
      >
        <ChevronRight
          aria-hidden="true"
          className={props.isOpen ? "open" : ""}
          size={14}
        />
        <span>{props.title}</span>
      </button>
      {props.isOpen && (
        <div
          className={
            props.isNested
              ? "arch4-subsection-content"
              : "arch4-section-content"
          }
        >
          {props.children}
        </div>
      )}
    </section>
  );
}

export function groupDiagrams(
  diagrams: DiagramSpec[],
): Array<{ diagrams: DiagramSpec[]; label: string; type: string }> {
  const order = [
    "system_context",
    "container",
    "component",
    "deployment",
    "dynamic",
  ];
  const labels = new Map([
    ["system_context", "System Context"],
    ["container", "Container"],
    ["component", "Component"],
    ["deployment", "Deployment"],
    ["dynamic", "Dynamic"],
  ]);
  const groupByType = new Map<
    string,
    { diagrams: DiagramSpec[]; label: string; type: string }
  >();
  diagrams.forEach((diagram) => {
    const type = diagram.type || "other";
    let group = groupByType.get(type);
    if (!group) {
      group = {
        diagrams: [],
        label: labels.get(type) ?? titleForType(type),
        type,
      };
      groupByType.set(type, group);
    }
    group.diagrams.push(diagram);
  });
  return [...groupByType.values()]
    .map((group) => ({
      ...group,
      diagrams: [...group.diagrams].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    }))
    .sort((left, right) => {
      const leftIndex = order.indexOf(left.type);
      const rightIndex = order.indexOf(right.type);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (
          (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
        );
      }
      return left.label.localeCompare(right.label);
    });
}

export function createDiagramTreeItems(
  diagrams: DiagramSpec[],
): Arch4TreeItem[] {
  return groupDiagrams(diagrams).flatMap((group) =>
    group.diagrams.map((diagram) => ({
      icon: diagramIconForType(diagram.type),
      iconClassName: variantClass(diagramIconVariant(diagram.type)),
      id: diagram.id,
      kind: diagram.type,
      label: diagramTreeLabel(diagram),
      path: [group.label, diagramTreeLabel(diagram)],
    })),
  );
}
