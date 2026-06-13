import { useState } from "react";
import { EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { routedPath, resolveEdgeRouting } from "./edge-routing.js";
import { edgeStyleVars, safeDomId } from "./style-utils.js";
import type { Arch4EdgeData } from "./types.js";

export function Arch4Edge(props: EdgeProps) {
  const data = props.data as Arch4EdgeData | undefined;
  const [isHovered, setIsHovered] = useState(false);
  const routing = resolveEdgeRouting(data?.style?.routing);
  const [edgePath, labelX, labelY] = routedPath(
    props,
    data?.vertices ?? [],
    routing,
  );
  const markerId = `arch4-edge-arrow-${safeDomId(props.id)}`;
  const edgeVars = edgeStyleVars(data?.style);
  const isActive = props.selected || isHovered;
  const activeClass = isActive ? "active" : "";
  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerHeight="14"
          markerUnits="userSpaceOnUse"
          markerWidth="14"
          orient="auto"
          refX="12"
          refY="7"
        >
          <path
            className={`arch4-edge-arrow ${activeClass}`}
            d="M 1 1 L 12 7 L 1 13 z"
            style={edgeVars}
          />
        </marker>
      </defs>
      <path
        className={`arch4-edge-hitbox ${activeClass}`}
        d={edgePath}
        fill="none"
        pointerEvents="stroke"
        stroke="transparent"
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      />
      <path
        className={`arch4-edge-path ${activeClass}`}
        d={edgePath}
        fill="none"
        markerEnd={`url(#${markerId})`}
        style={edgeVars}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      />
      {(data?.label || data?.order) && (
        <EdgeLabelRenderer>
          <div
            className={`arch4-edge-label nodrag nopan ${data.dynamic ? "dynamic" : ""} ${activeClass}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
          >
            {data.order && (
              <span className="arch4-edge-order">{data.order}</span>
            )}
            {data.label && <span>{data.label}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
