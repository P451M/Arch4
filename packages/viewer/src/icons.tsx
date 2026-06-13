import {
  Box,
  Boxes,
  Cloud,
  Component,
  Database,
  Route,
  Server,
  UserRound,
  Waypoints,
} from "lucide-react";
import type { DiagramNode, DiagramSpec } from "@arch4/core";

export function nodeLabel(node: DiagramNode): string {
  if (node.type === "softwareSystem") return "Software System";
  if (node.type === "containerInstance") return "Container Instance";
  if (node.type === "softwareSystemInstance") return "System Instance";
  if (node.type === "deploymentNode") return "Deployment Node";
  if (node.type === "infrastructureNode") return "Infrastructure";
  return titleForType(node.type);
}

export function titleForType(type: string): string {
  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function iconFor(type: string) {
  if (type === "person") return UserRound;
  if (type === "database") return Database;
  if (type === "softwareSystem") return Boxes;
  if (type === "container") return Box;
  if (type === "component") return Component;
  if (type === "deploymentNode") return Server;
  if (type === "infrastructureNode" || type === "infrastructure") return Cloud;
  if (type === "containerInstance") return Box;
  if (type === "softwareSystemInstance") return Boxes;
  return Waypoints;
}

export function diagramIconForType(type: string) {
  if (type === "container") return Box;
  if (type === "component") return Component;
  if (type === "deployment") return Server;
  if (type === "dynamic") return Route;
  if (type === "system_context" || type === "systemContext") return Boxes;
  return Waypoints;
}

export function diagramIconVariant(type: string): string {
  if (type === "container") return "container";
  if (type === "component") return "component";
  if (type === "deployment") return "deploymentView";
  if (type === "dynamic") return "dynamicView";
  if (type === "system_context" || type === "systemContext")
    return "softwareSystem";
  return "softwareSystem";
}

export function diagramTreeLabel(diagram: DiagramSpec): string {
  const suffixesByType: Record<string, string[]> = {
    component: ["Component View", "Components", "Component"],
    container: ["Container View", "Containers", "Container"],
    deployment: ["Deployment View", "Deployments", "Deployment"],
    dynamic: ["Dynamic View", "Flows", "Flow", "Dynamics", "Dynamic"],
    system_context: ["System Context View", "SystemContext", "System Context"],
    systemContext: ["System Context View", "SystemContext", "System Context"],
  };
  const suffixes = suffixesByType[diagram.type] ?? [];
  const compactName = suffixes
    .reduce(
      (name, suffix) => removeDiagramTypeSuffix(name, suffix),
      diagram.name,
    )
    .trim();
  return compactName.length > 0 ? compactName : diagram.name;
}

export function legendVariant(
  entry: NonNullable<DiagramSpec["legend"]>[number],
): string {
  const id = entry.id.toLowerCase();
  const label = entry.label.toLowerCase();
  if (id.includes("person") || label.includes("person")) return "person";
  if (id.includes("database") || label.includes("database")) return "database";
  if (id.includes("component") || label.includes("component"))
    return "component";
  if (id.includes("infrastructure") || label.includes("infrastructure"))
    return "infrastructureNode";
  if (id.includes("deployment") || label.includes("deployment"))
    return "deploymentNode";
  if (id.includes("instance") || label.includes("instance")) return "container";
  if (id.includes("container") || label.includes("container"))
    return "container";
  return "softwareSystem";
}

export function variantClass(type: string): string {
  if (type === "softwareSystem") return "software-system";
  if (type === "infrastructureNode") return "infrastructure-node";
  if (type === "deploymentNode") return "deployment-node";
  if (type === "deploymentView") return "deployment-view";
  if (type === "dynamicView") return "dynamic-view";
  if (type === "containerInstance") return "container-instance";
  if (type === "softwareSystemInstance") return "software-system-instance";
  return type;
}

export function boundaryClass(type: string): string {
  if (type === "softwareSystem") return "software-system";
  if (type === "deploymentNode") return "deployment-node";
  return type;
}

function removeDiagramTypeSuffix(name: string, suffix: string): string {
  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name
    .replace(
      new RegExp(`(?:[\\s_-]+${escapedSuffix}|${escapedSuffix})$`, "i"),
      "",
    )
    .trim();
}
