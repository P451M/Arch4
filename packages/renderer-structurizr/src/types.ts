import type { DiagramSpec, Diagnostic } from "@arch4/core";

export type RenderOptions = {
  projectRoot: string;
  structurizrCliPath?: string;
  javaPath?: string;
  writeOutputs?: boolean;
};

export type RenderResult = {
  diagnostics: Diagnostic[];
  specs: DiagramSpec[];
  workspaceJson?: unknown;
};

export type ElementModel = {
  id: string;
  entityId: string;
  name: string;
  type: string;
  description?: string;
  technology?: string;
  tags: string[];
  parentId?: string | null;
  parentEntityId?: string | null;
  instanceOfId?: string | null;
  environment?: string | null;
  deploymentNodeId?: string | null;
  group?: string | null;
};

export type RelationshipModel = {
  id: string;
  source: string;
  target: string;
  label?: string;
  technology?: string;
  tags?: string[];
};

export type NormalizedWorkspace = {
  elements: Map<string, ElementModel>;
  relationships: RelationshipModel[];
  specs: DiagramSpec[];
  diagnostics: Diagnostic[];
};
