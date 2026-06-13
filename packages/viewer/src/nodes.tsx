import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ArrowDownRight, ArrowUpRight, Info, ListTree } from "lucide-react";
import { boundaryClass, iconFor, nodeLabel, variantClass } from "./icons.js";
import { relatedTargetLabel } from "./navigation.js";
import { boundaryStyleVars } from "./style-utils.js";
import type { BoundaryNodeData, ElementNodeData } from "./types.js";

export function Arch4Node(props: NodeProps) {
  const data = props.data as ElementNodeData;
  const Icon = iconFor(data.node.type);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRootRef = useRef<HTMLDivElement | null>(null);
  const relatedTargets = data.relatedTargets ?? [];
  const RelatedIcon =
    relatedTargets.length > 1
      ? ListTree
      : relatedTargets[0]?.kind === "child"
        ? ArrowDownRight
        : ArrowUpRight;

  useEffect(() => {
    if (!isActionMenuOpen) return;

    const closeWhenOutsideRoot = (event: PointerEvent) => {
      const root = actionMenuRootRef.current;
      if (!root) return;
      if (event.composedPath().includes(root)) return;
      setIsActionMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeWhenOutsideRoot, true);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutsideRoot, true);
    };
  }, [isActionMenuOpen]);

  return (
    <section
      className={`arch4-node ${variantClass(data.node.type)} ${data.isSelected ? "selected" : ""} ${isActionMenuOpen ? "menu-open" : ""}`}
    >
      <NodeHandles />
      <div className="arch4-node-rail" aria-hidden="true">
        <span className="arch4-node-icon">
          <Icon size={42} strokeWidth={2.25} />
        </span>
        <span>{nodeLabel(data.node)}</span>
      </div>
      <div className="arch4-node-body">
        <div className="arch4-node-text">
          <h3>{data.node.name}</h3>
          {data.node.description && <p>{data.node.description}</p>}
        </div>
        <div className="arch4-node-footer">
          {data.node.technology && (
            <small className="arch4-node-technology">
              {data.node.technology}
            </small>
          )}
          <div className="arch4-node-actions">
            <button
              aria-label={`Show element details: ${data.node.name}`}
              className="arch4-node-action nodrag nopan"
              title="Show element details"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                data.onSelect?.(data.node);
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Info size={14} />
            </button>
            {relatedTargets.length > 0 && (
              <div
                className="arch4-node-action-menu-root"
                ref={actionMenuRootRef}
                onBlur={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return;
                  }
                  setIsActionMenuOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.stopPropagation();
                  setIsActionMenuOpen(false);
                }}
              >
                <button
                  aria-expanded={
                    relatedTargets.length > 1 ? isActionMenuOpen : undefined
                  }
                  aria-haspopup={relatedTargets.length > 1 ? "menu" : undefined}
                  aria-label={`${relatedTargets.length > 1 ? "Open related diagram menu" : relatedTargetLabel(relatedTargets[0]!)}: ${data.node.name}`}
                  className="arch4-node-action nodrag nopan"
                  title={
                    relatedTargets.length > 1
                      ? "Open related diagram"
                      : relatedTargetLabel(relatedTargets[0]!)
                  }
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (relatedTargets.length > 1) {
                      setIsActionMenuOpen((value) => !value);
                      return;
                    }
                    data.onNavigate?.(relatedTargets[0]!);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <RelatedIcon size={14} />
                </button>
                {isActionMenuOpen && relatedTargets.length > 1 && (
                  <div
                    className="arch4-node-action-menu nodrag nopan"
                    role="menu"
                  >
                    {relatedTargets.map((target) => {
                      const OptionIcon =
                        target.kind === "child" ? ArrowDownRight : ArrowUpRight;
                      return (
                        <button
                          className="arch4-node-action-menu-item"
                          key={`${target.kind}:${target.diagram.id}:${target.entityId}`}
                          role="menuitem"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsActionMenuOpen(false);
                            data.onNavigate?.(target);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <OptionIcon size={14} />
                          <span>
                            <strong>{relatedTargetLabel(target)}</strong>
                            <small>{target.diagram.name}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const HANDLE_SIDES = [
  ["top", Position.Top],
  ["right", Position.Right],
  ["bottom", Position.Bottom],
  ["left", Position.Left],
] as const;
const HANDLE_SLOTS = ["a", "b", "c"] as const;

function NodeHandles() {
  return (
    <>
      {HANDLE_SIDES.flatMap(([side, position]) =>
        HANDLE_SLOTS.flatMap((slot) => [
          <Handle
            className="arch4-handle"
            id={`${side}-${slot}-target`}
            key={`${side}-${slot}-target`}
            position={position}
            style={handleSlotStyle(position, slot)}
            type="target"
          />,
          <Handle
            className="arch4-handle"
            id={`${side}-${slot}-source`}
            key={`${side}-${slot}-source`}
            position={position}
            style={handleSlotStyle(position, slot)}
            type="source"
          />,
        ]),
      )}
    </>
  );
}

function handleSlotStyle(
  position: Position,
  slot: "a" | "b" | "c",
): CSSProperties {
  const percent = slot === "a" ? "30%" : slot === "c" ? "70%" : "50%";
  if (position === Position.Left || position === Position.Right) {
    return { top: percent };
  }
  return { left: percent };
}

export function Arch4Boundary(props: NodeProps) {
  const data = props.data as BoundaryNodeData;
  return (
    <section
      className={`arch4-boundary ${boundaryClass(data.boundary.type)}`}
      style={boundaryStyleVars(data.boundary.style)}
    >
      <span>{data.boundary.label}</span>
    </section>
  );
}
