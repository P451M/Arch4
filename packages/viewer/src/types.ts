import type {
  ArchitectureIndex,
  DiagramBoundary,
  DiagramNode,
  DiagramSpec,
  LayoutDirection,
} from "@arch4/core";

export type Arch4ViewerProps = {
  architectureIndex?: ArchitectureIndex;
  diagnostics?: Array<{ level: string; code: string; message: string }>;
  diagrams: DiagramSpec[];
  initialDiagramId?: string;
  initialLayoutDirections?: Record<string, LayoutDirection>;
  initialManualLayoutDiagramIds?: string[];
  onLayoutDirectionChange?: (change: {
    diagramId: string;
    direction: LayoutDirection;
  }) => Promise<void> | void;
  onManualLayoutReset?: (change: { diagramId: string }) => Promise<void> | void;
  onNodePositionChange?: (change: {
    diagramId: string;
    nodeId: string;
    x: number;
    y: number;
  }) => Promise<void> | void;
  showEdgeLabels?: boolean;
};

export type Arch4RelatedNavigationTarget = {
  diagram: DiagramSpec;
  entityId: string;
  kind: "child" | "parent";
};

export type Arch4ElementInfo = {
  confidence?: string;
  contextPath?: string;
  contributors: Array<{ name: string; email?: string; commits: number }>;
  description?: string;
  entityId: string;
  name: string;
  notes?: Record<string, unknown>;
  openQuestions: string[];
  owners: string[];
  parent?: string | null;
  paths: string[];
  recentCommits: Array<{
    hash: string;
    subject: string;
    author: string;
    date: string;
  }>;
  relationships: Array<{
    counterpartEntityId?: string;
    counterpartName: string;
    direction: "inbound" | "outbound";
    id: string;
    label?: string;
    sourceEntityId?: string;
    sourceName: string;
    targetEntityId?: string;
    targetName: string;
    technology?: string;
    views: string[];
  }>;
  tags: string[];
  technology?: string;
  type?: string;
  views: Array<{ id: string; name: string; type: string }>;
};

export type ElementNodeData = {
  kind: "element";
  node: DiagramNode;
  element?: ArchitectureIndex["elements"][number];
  isSelected: boolean;
  onNavigate?: (target: Arch4RelatedNavigationTarget) => void;
  onSelect?: (node: DiagramNode) => void;
  relatedTargets: Arch4RelatedNavigationTarget[];
};

export type BoundaryNodeData = {
  kind: "boundary";
  boundary: DiagramBoundary;
};

export type Arch4NodeData = ElementNodeData | BoundaryNodeData;

export type Arch4EdgeData = {
  label?: string;
  technology?: string;
  order?: number;
  dynamic?: boolean;
  vertices?: Array<{ x: number; y: number }>;
  style?: Record<string, string>;
};

export type Arch4CurrentViewRelationship = {
  counterpartName: string;
  counterpartNodeId: string;
  direction: "inbound" | "outbound";
  id: string;
  label?: string;
  sourceName: string;
  sourceNodeId: string;
  targetName: string;
  targetNodeId: string;
  technology?: string;
};
