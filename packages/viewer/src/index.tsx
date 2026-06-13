import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { layoutDiagramSpec } from "@arch4/layout";
import type {
  ArchitectureIndex,
  DiagramNode,
  DiagramSpec,
  LayoutDirection,
} from "@arch4/core";
import { ElementInfoPanel } from "./details.js";
import { Arch4Edge } from "./edges.js";
import { resolveEdgeRouting } from "./edge-routing.js";
import { buildFlowEdges, rebuildBoundaryFlowNodes, toFlow } from "./flow.js";
import {
  diagramIconForType,
  diagramIconVariant,
  diagramTreeLabel,
  variantClass,
} from "./icons.js";
import { LegendSwatch } from "./legend.js";
import {
  buildElementInfo,
  buildEntityParentMap,
  findNodeForEntity,
  resolveCurrentViewRelationships,
  resolveIndexedRelationshipsOutsideCurrentView,
  resolveRelatedNavigationTargets,
} from "./navigation.js";
import { Arch4Boundary, Arch4Node } from "./nodes.js";
import { CollapsibleSidebarSection, groupDiagrams } from "./sidebar.js";
import type {
  Arch4NodeData,
  Arch4RelatedNavigationTarget,
  Arch4ViewerProps,
} from "./types.js";

export type {
  Arch4CurrentViewRelationship,
  Arch4ElementInfo,
  Arch4RelatedNavigationTarget,
  Arch4ViewerProps,
} from "./types.js";
export {
  buildElementInfo,
  findNodeForEntity,
  resolveCurrentViewRelationships,
  resolveEdgeRouting,
  resolveIndexedRelationshipsOutsideCurrentView,
  resolveRelatedNavigationTargets,
};

const nodeTypes = { arch4Node: Arch4Node, arch4Boundary: Arch4Boundary };
const edgeTypes = { arch4Edge: Arch4Edge };
const FIT_VIEW_MAX_ATTEMPTS = 60;
const FIT_VIEW_PADDING = 0.14;
const commandPaletteShortcuts = [
  ["Cmd", "Shift", "P"],
  ["Ctrl", "Shift", "P"],
] as const;
const layoutDirectionOptions: Array<{
  direction: LayoutDirection;
  Icon: typeof ArrowRight;
  label: string;
}> = [
  { direction: "RIGHT", Icon: ArrowRight, label: "LR" },
  { direction: "DOWN", Icon: ArrowDown, label: "TB" },
  { direction: "LEFT", Icon: ArrowLeft, label: "RL" },
  { direction: "UP", Icon: ArrowUp, label: "BT" },
];

export function Arch4Viewer(props: Arch4ViewerProps) {
  const onLayoutDirectionChange = props.onLayoutDirectionChange;
  const onManualLayoutReset = props.onManualLayoutReset;
  const onNodePositionChange = props.onNodePositionChange;
  const [activeDiagramId, setActiveDiagramId] = useState(
    props.initialDiagramId ?? props.diagrams[0]?.id,
  );
  const [layoutDirections, setLayoutDirections] = useState<
    Record<string, LayoutDirection>
  >(() => props.initialLayoutDirections ?? {});
  const [manualLayoutDiagramIds, setManualLayoutDiagramIds] = useState<
    Set<string>
  >(() => new Set(props.initialManualLayoutDiagramIds ?? []));
  const [locallyResetManualDiagramIds, setLocallyResetManualDiagramIds] =
    useState<Set<string>>(() => new Set());
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [collapsedSidebarSections, setCollapsedSidebarSections] = useState<
    Set<string>
  >(() => new Set(["diagnostics"]));
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [pendingNodeEntityId, setPendingNodeEntityId] = useState<string | null>(
    null,
  );
  const [zoom, setZoom] = useState(1);
  const [fitViewSignal, setFitViewSignal] = useState(1);
  const suppressNodeClickRef = useRef(false);
  const diagrams = useMemo(
    () =>
      applyLayoutDirections(
        props.diagrams,
        layoutDirections,
        locallyResetManualDiagramIds,
      ),
    [layoutDirections, locallyResetManualDiagramIds, props.diagrams],
  );
  const activeDiagram =
    diagrams.find((diagram) => diagram.id === activeDiagramId) ?? diagrams[0];
  const diagramGroups = useMemo(() => groupDiagrams(diagrams), [diagrams]);
  const elementById = useMemo(() => {
    const mapped = new Map<string, ArchitectureIndex["elements"][number]>();
    props.architectureIndex?.elements.forEach((element) =>
      mapped.set(element.entityId, element),
    );
    return mapped;
  }, [props.architectureIndex]);
  const entityParentById = useMemo(
    () => buildEntityParentMap(diagrams),
    [diagrams],
  );
  useEffect(() => {
    setLayoutDirections(props.initialLayoutDirections ?? {});
  }, [props.initialLayoutDirections]);
  useEffect(() => {
    const nextManualIds = new Set(props.initialManualLayoutDiagramIds ?? []);
    setManualLayoutDiagramIds(nextManualIds);
    setLocallyResetManualDiagramIds((current) => {
      const next = new Set(current);
      for (const diagramId of current) {
        if (!nextManualIds.has(diagramId)) next.delete(diagramId);
      }
      return next;
    });
  }, [props.initialManualLayoutDiagramIds]);
  const navigateToRelatedTarget = useCallback(
    (target: Arch4RelatedNavigationTarget) => {
      setActiveDiagramId(target.diagram.id);
      setPendingNodeEntityId(target.entityId);
      setZoom(1);
      setFitViewSignal((current) => current + 1);
    },
    [],
  );
  const toggleSelectedNode = useCallback((node: DiagramNode) => {
    setSelectedNode((current) => (current?.id === node.id ? null : node));
  }, []);
  const changeLayoutDirection = useCallback(
    (diagram: DiagramSpec, direction: LayoutDirection) => {
      setLayoutDirections((current) => ({
        ...current,
        [diagram.id]: direction,
      }));
      setManualLayoutDiagramIds((current) => {
        const next = new Set(current);
        next.delete(diagram.id);
        return next;
      });
      setLocallyResetManualDiagramIds((current) => {
        const next = new Set(current);
        next.add(diagram.id);
        return next;
      });
      setIsLayoutMenuOpen(false);
      setFitViewSignal((current) => current + 1);
      void Promise.resolve(
        onLayoutDirectionChange?.({ diagramId: diagram.id, direction }),
      ).catch((error) => {
        console.error("Arch4 could not persist layout direction.", error);
      });
    },
    [onLayoutDirectionChange],
  );
  const resetManualLayout = useCallback(
    (diagram: DiagramSpec) => {
      setManualLayoutDiagramIds((current) => {
        const next = new Set(current);
        next.delete(diagram.id);
        return next;
      });
      setLocallyResetManualDiagramIds((current) => {
        const next = new Set(current);
        next.add(diagram.id);
        return next;
      });
      setIsLayoutMenuOpen(false);
      setFitViewSignal((current) => current + 1);
      void Promise.resolve(
        onManualLayoutReset?.({ diagramId: diagram.id }),
      ).catch((error) => {
        console.error("Arch4 could not reset manual layout.", error);
      });
    },
    [onManualLayoutReset],
  );
  const flow = useMemo(
    () =>
      toFlow(activeDiagram, elementById, props.showEdgeLabels ?? true, {
        diagrams,
        entityParentById,
        onNavigate: navigateToRelatedTarget,
        onSelect: toggleSelectedNode,
        selectedNodeId: selectedNode?.id,
      }),
    [
      activeDiagram,
      elementById,
      entityParentById,
      navigateToRelatedTarget,
      diagrams,
      props.showEdgeLabels,
      selectedNode?.id,
      toggleSelectedNode,
    ],
  );
  const fitViewElementIds = useMemo(
    () => activeDiagram?.nodes.map((node) => node.id).sort() ?? [],
    [activeDiagram],
  );
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(flow.nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(flow.edges);
  const flowNodesRef = useRef(flow.nodes);
  useEffect(() => {
    flowNodesRef.current = flow.nodes;
    setFlowNodes(flow.nodes);
    setFlowEdges(flow.edges);
  }, [flow.edges, flow.nodes, setFlowEdges, setFlowNodes]);
  const updateDraggedNode = useCallback(
    (node: Node) => {
      if (!activeDiagram) return;
      const moved = flowNodesRef.current.map((item) =>
        item.id === node.id ? { ...item, position: node.position } : item,
      );
      const rebuilt = rebuildBoundaryFlowNodes(
        activeDiagram,
        moved as Array<Node<Arch4NodeData>>,
        new Set([node.id]),
      );
      flowNodesRef.current = rebuilt;
      setFlowNodes(rebuilt);
      setFlowEdges(
        buildFlowEdges(activeDiagram, rebuilt, props.showEdgeLabels ?? true),
      );
    },
    [activeDiagram, props.showEdgeLabels, setFlowEdges, setFlowNodes],
  );
  const persistDraggedNode = useCallback(
    (node: Node) => {
      if (!activeDiagram) return;
      const data = node.data as Arch4NodeData | undefined;
      if (data?.kind !== "element") return;
      setManualLayoutDiagramIds((current) => {
        const next = new Set(current);
        next.add(activeDiagram.id);
        return next;
      });
      void Promise.resolve(
        onNodePositionChange?.({
          diagramId: activeDiagram.id,
          nodeId: node.id,
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        }),
      ).catch((error) => {
        console.error("Arch4 could not persist node position.", error);
      });
    },
    [activeDiagram, onNodePositionChange],
  );
  const selectedElement = selectedNode
    ? elementById.get(selectedNode.entityId ?? selectedNode.id)
    : undefined;
  const selectedInfo = selectedNode
    ? buildElementInfo({
        architectureIndex: props.architectureIndex,
        diagrams,
        element: selectedElement,
        node: selectedNode,
      })
    : undefined;
  const selectedRelatedTargets =
    selectedNode && activeDiagram
      ? resolveRelatedNavigationTargets({
          activeDiagram,
          diagrams,
          entityParentById,
          node: selectedNode,
        })
      : [];
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const isSectionOpen = (sectionId: string) =>
    !collapsedSidebarSections.has(sectionId);
  const toggleSidebarSection = (sectionId: string) => {
    setCollapsedSidebarSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };
  useEffect(() => {
    if (!pendingNodeEntityId || !activeDiagram) return;
    const nextNode = findNodeForEntity(activeDiagram, pendingNodeEntityId);
    setSelectedNode(nextNode ?? null);
    setPendingNodeEntityId(null);
  }, [activeDiagram, pendingNodeEntityId]);
  useEffect(() => {
    if (!isLayoutMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && layoutMenuRef.current?.contains(target)) {
        return;
      }
      setIsLayoutMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
    };
  }, [isLayoutMenuOpen]);

  return (
    <div className={`arch4-viewer ${isSidebarOpen ? "" : "sidebar-collapsed"}`}>
      {isSidebarOpen ? (
        <aside className="arch4-sidebar">
          <div className="arch4-brand">
            <span>
              <strong>Arch4</strong>
              <span>Architecture Maps</span>
            </span>
            <button
              aria-label="Collapse architecture tree"
              className="arch4-icon-button arch4-sidebar-toggle"
              title="Collapse architecture tree"
              type="button"
              onClick={() => setIsSidebarOpen(false)}
            >
              <PanelLeftClose size={19} />
            </button>
          </div>
          <CollapsibleSidebarSection
            id="diagrams"
            isOpen={isSectionOpen("diagrams")}
            title="Diagrams"
            onToggle={toggleSidebarSection}
          >
            <div className="arch4-tree">
              {diagramGroups.map((group) => (
                <CollapsibleSidebarSection
                  id={`diagram-group:${group.type}`}
                  isNested
                  isOpen={isSectionOpen(`diagram-group:${group.type}`)}
                  key={group.type}
                  title={group.label}
                  onToggle={toggleSidebarSection}
                >
                  <div className="arch4-list">
                    {group.diagrams.map((diagram) => {
                      const DiagramIcon = diagramIconForType(diagram.type);
                      const diagramLabel = diagramTreeLabel(diagram);
                      return (
                        <button
                          aria-current={
                            diagram.id === activeDiagram?.id
                              ? "page"
                              : undefined
                          }
                          className={
                            diagram.id === activeDiagram?.id ? "active" : ""
                          }
                          key={diagram.id}
                          type="button"
                          onClick={() => {
                            setActiveDiagramId(diagram.id);
                            setSelectedNode(null);
                            setPendingNodeEntityId(null);
                            setZoom(1);
                            setFitViewSignal((current) => current + 1);
                            setIsLayoutMenuOpen(false);
                          }}
                        >
                          <span
                            className={`arch4-tree-item-icon ${variantClass(diagramIconVariant(diagram.type))}`}
                            aria-hidden="true"
                          >
                            <DiagramIcon size={14} strokeWidth={2.35} />
                          </span>
                          <strong>{diagramLabel}</strong>
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleSidebarSection>
              ))}
            </div>
          </CollapsibleSidebarSection>
          {Boolean(props.diagnostics?.length) && (
            <CollapsibleSidebarSection
              id="diagnostics"
              isOpen={isSectionOpen("diagnostics")}
              title="Diagnostics"
              onToggle={toggleSidebarSection}
            >
              <div className="arch4-diagnostics">
                {props.diagnostics?.map((diagnostic) => (
                  <div
                    className={`arch4-diagnostic ${diagnostic.level}`}
                    key={`${diagnostic.code}-${diagnostic.message}`}
                  >
                    <strong>{diagnostic.code}</strong>
                    <span>{diagnostic.message}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSidebarSection>
          )}
        </aside>
      ) : null}
      <main className="arch4-canvas">
        {!isSidebarOpen && (
          <button
            aria-label="Expand architecture tree"
            className="arch4-icon-button arch4-sidebar-toggle arch4-sidebar-reopen"
            title="Expand architecture tree"
            type="button"
            onClick={() => setIsSidebarOpen(true)}
          >
            <PanelLeftOpen size={19} />
          </button>
        )}
        {activeDiagram ? (
          <ReactFlow
            className={zoom <= 0.42 ? "arch4-flow-overview" : undefined}
            defaultEdgeOptions={{ type: "arch4Edge" }}
            edgeTypes={edgeTypes}
            edges={flowEdges}
            elementsSelectable={false}
            fitViewOptions={{ maxZoom: 1.12, padding: FIT_VIEW_PADDING }}
            key={activeDiagram.id}
            maxZoom={1.35}
            minZoom={0.08}
            nodes={flowNodes}
            autoPanOnNodeDrag={false}
            nodesConnectable={false}
            nodesDraggable
            nodeTypes={nodeTypes}
            onEdgesChange={onEdgesChange}
            onMove={(_, viewport) => setZoom(viewport.zoom)}
            onNodeDrag={(_, node) => {
              suppressNodeClickRef.current = true;
              updateDraggedNode(node);
            }}
            onNodeDragStop={(_, node) => {
              updateDraggedNode(node);
              persistDraggedNode(node);
              window.setTimeout(() => {
                suppressNodeClickRef.current = false;
              }, 80);
            }}
            onNodeClick={(_, node) => {
              if (suppressNodeClickRef.current) return;
              const data = node.data as Arch4NodeData;
              if (data.kind === "element") toggleSelectedNode(data.node);
            }}
            onNodesChange={onNodesChange}
            onPaneClick={() => setSelectedNode(null)}
            panOnDrag
            proOptions={proOptions}
            selectionOnDrag={false}
            zoomOnDoubleClick={false}
          >
            <FitViewOnSignal
              elementNodeIds={fitViewElementIds}
              signal={fitViewSignal}
            />
            <Panel className="arch4-layout-panel" position="top-right">
              <div
                className="arch4-layout-settings"
                ref={layoutMenuRef}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setIsLayoutMenuOpen(false);
                }}
              >
                <button
                  aria-expanded={isLayoutMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Layout settings"
                  className="arch4-icon-button arch4-layout-settings-trigger"
                  title="Layout settings"
                  type="button"
                  onClick={() => setIsLayoutMenuOpen((current) => !current)}
                >
                  <Settings size={18} />
                </button>
                {isLayoutMenuOpen && activeDiagram ? (
                  <div className="arch4-layout-menu nodrag nopan" role="menu">
                    {layoutDirectionOptions.map(
                      ({ direction, Icon, label }) => (
                        <button
                          aria-checked={activeDiagram.direction === direction}
                          className={
                            activeDiagram.direction === direction
                              ? "active"
                              : ""
                          }
                          key={direction}
                          role="menuitemradio"
                          title={`Layout ${label}`}
                          type="button"
                          onClick={() =>
                            changeLayoutDirection(activeDiagram, direction)
                          }
                        >
                          <Icon size={15} />
                          <span>{label}</span>
                        </button>
                      ),
                    )}
                    {manualLayoutDiagramIds.has(activeDiagram.id) && (
                      <button
                        className="arch4-layout-reset"
                        role="menuitem"
                        title="Reset manual layout"
                        type="button"
                        onClick={() => resetManualLayout(activeDiagram)}
                      >
                        <Settings size={15} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </Panel>
            {Boolean(activeDiagram.legend?.length) && (
              <Panel className="arch4-legend" position="bottom-left">
                {activeDiagram.legend?.map((entry) => (
                  <span className="arch4-legend-item" key={entry.id}>
                    <LegendSwatch entry={entry} />
                    {entry.label}
                  </span>
                ))}
              </Panel>
            )}
            <Background
              id="arch4-grid-minor"
              color="var(--arch4-grid-color)"
              gap={12}
              size={1.15}
              variant={BackgroundVariant.Dots}
            />
            <Background
              id="arch4-grid-major"
              color="var(--arch4-grid-major-color)"
              gap={60}
              size={1.9}
              variant={BackgroundVariant.Dots}
            />
            <Controls
              fitViewOptions={{ maxZoom: 1.12, padding: FIT_VIEW_PADDING }}
              position="bottom-right"
              showInteractive={false}
            />
          </ReactFlow>
        ) : (
          <div className="arch4-empty">
            <div className="arch4-empty-message">
              <strong>No diagrams rendered yet.</strong>
              <span>
                Open the Command Palette with{" "}
                <KeyboardShortcut keys={commandPaletteShortcuts[0]} /> or{" "}
                <KeyboardShortcut keys={commandPaletteShortcuts[1]} />, then run{" "}
                <kbd>Arch4: Update Architecture Model</kbd> to seed the initial
                diagrams.
              </span>
            </div>
          </div>
        )}
      </main>
      {selectedNode && selectedInfo && activeDiagram && (
        <ElementInfoPanel
          activeDiagram={activeDiagram}
          diagrams={diagrams}
          info={selectedInfo}
          node={selectedNode}
          relatedTargets={selectedRelatedTargets}
          onNavigate={navigateToRelatedTarget}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

function KeyboardShortcut({ keys }: { keys: readonly string[] }) {
  return (
    <span className="arch4-keyboard-shortcut">
      {keys.map((key, index) => (
        <span className="arch4-keyboard-shortcut-part" key={key}>
          {index > 0 && <span className="arch4-keyboard-separator">+</span>}
          <kbd>{key}</kbd>
        </span>
      ))}
    </span>
  );
}

function applyLayoutDirections(
  diagrams: DiagramSpec[],
  layoutDirections: Record<string, LayoutDirection>,
  locallyResetManualDiagramIds: Set<string>,
): DiagramSpec[] {
  return diagrams.map((diagram) => {
    const direction = layoutDirections[diagram.id];
    if (!direction || direction === diagram.direction) {
      return locallyResetManualDiagramIds.has(diagram.id)
        ? layoutDiagramSpec(diagram)
        : diagram;
    }
    return layoutDiagramSpec(diagram, { direction });
  });
}

function FitViewOnSignal(props: { elementNodeIds: string[]; signal: number }) {
  const reactFlow = useReactFlow();
  const completedFitViewSignalRef = useRef<number | undefined>(undefined);
  const elementNodeIdsKey = props.elementNodeIds.join("\u0000");
  useEffect(() => {
    if (props.signal === 0) return;
    if (completedFitViewSignalRef.current === props.signal) return;
    const expectedElementNodeIds = new Set(props.elementNodeIds);
    let attempts = 0;
    let frame: number | undefined;

    const fitWhenReady = () => {
      const nodes = reactFlow.getNodes() as Array<Node<Arch4NodeData>>;
      const fitNodes = fitViewNodesForExpectedDiagram(
        nodes,
        expectedElementNodeIds,
      );
      if (!fitNodes.length || !fitNodes.every(hasRenderableNodeSize)) {
        attempts += 1;
        if (attempts <= FIT_VIEW_MAX_ATTEMPTS) {
          frame = window.requestAnimationFrame(fitWhenReady);
        }
        return;
      }
      void reactFlow.fitView({
        maxZoom: 1.12,
        nodes: fitNodes.map((node) => ({ id: node.id })),
        padding: FIT_VIEW_PADDING,
      });
      completedFitViewSignalRef.current = props.signal;
    };

    frame = window.requestAnimationFrame(fitWhenReady);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [elementNodeIdsKey, props.elementNodeIds, props.signal, reactFlow]);
  return null;
}

function fitViewNodesForExpectedDiagram(
  nodes: Array<Node<Arch4NodeData>>,
  expectedElementNodeIds: Set<string>,
): Array<Node<Arch4NodeData>> {
  if (expectedElementNodeIds.size === 0) return nodes;
  const elementNodes = nodes.filter((node) => {
    const data = node.data as Arch4NodeData | undefined;
    if (data?.kind !== "element") return false;
    return expectedElementNodeIds.has(node.id);
  });
  if (elementNodes.length < expectedElementNodeIds.size) return [];
  const availableElementNodeIds = new Set(elementNodes.map((node) => node.id));
  for (const id of expectedElementNodeIds) {
    if (!availableElementNodeIds.has(id)) return [];
  }
  const diagramNodes = nodes.filter((node) => {
    const data = node.data as Arch4NodeData | undefined;
    if (data?.kind === "boundary") return true;
    return data?.kind === "element" && expectedElementNodeIds.has(node.id);
  });
  return diagramNodes.length ? diagramNodes : elementNodes;
}

function hasRenderableNodeSize(node: Node<Arch4NodeData>): boolean {
  const width = nodeNumberSize(node, "width");
  const height = nodeNumberSize(node, "height");
  return Boolean(width && height);
}

function nodeNumberSize(
  node: Node<Arch4NodeData>,
  key: "width" | "height",
): number | undefined {
  const value = node.measured?.[key] ?? node[key] ?? node.style?.[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}
