import { Position, type EdgeProps } from "@xyflow/react";

type Point = {
  x: number;
  y: number;
};

export function routedPath(
  props: EdgeProps,
  vertices: Array<{ x: number; y: number }>,
  routing: string,
): [string, number, number] {
  if (routing === "Direct") return directPath(props);
  return vertices.length
    ? curvedVertexPath(props, vertices)
    : bezierPath(props);
}

export function resolveEdgeRouting(
  styleRouting: string | undefined,
): "Curved" | "Direct" {
  if (styleRouting === "Direct") return "Direct";
  return "Curved";
}

function directPath(props: EdgeProps): [string, number, number] {
  const label = midpoint(
    { x: props.sourceX, y: props.sourceY },
    { x: props.targetX, y: props.targetY },
  );
  return [
    `M ${props.sourceX},${props.sourceY} L ${props.targetX},${props.targetY}`,
    label.x,
    label.y,
  ];
}

function bezierPath(props: EdgeProps): [string, number, number] {
  const distance = Math.hypot(
    props.targetX - props.sourceX,
    props.targetY - props.sourceY,
  );
  const offset = Math.max(92, distance * 0.32);
  const start = { x: props.sourceX, y: props.sourceY };
  const sourceVector = handleVector(props.sourcePosition, Position.Right);
  const targetVector = handleVector(props.targetPosition, Position.Left);
  const controlA = {
    x: props.sourceX + sourceVector.x * offset,
    y: props.sourceY + sourceVector.y * offset,
  };
  const controlB = {
    x: props.targetX + targetVector.x * offset,
    y: props.targetY + targetVector.y * offset,
  };
  const end = { x: props.targetX, y: props.targetY };
  const path = `M ${start.x},${start.y} C ${controlA.x},${controlA.y} ${controlB.x},${controlB.y} ${end.x},${end.y}`;
  const label = cubicBezierPoint(start, controlA, controlB, end, 0.5);
  return [path, label.x, label.y];
}

function handleVector(
  position: Position | undefined,
  fallback: Position,
): Point {
  const resolved = position ?? fallback;
  if (resolved === Position.Left) return { x: -1, y: 0 };
  if (resolved === Position.Right) return { x: 1, y: 0 };
  if (resolved === Position.Top) return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function curvedVertexPath(
  props: EdgeProps,
  vertices: Array<{ x: number; y: number }>,
): [string, number, number] {
  const points = [
    { x: props.sourceX, y: props.sourceY },
    ...vertices,
    { x: props.targetX, y: props.targetY },
  ];
  if (points.length < 3) return bezierPath(props);
  const commands = [`M ${points[0].x},${points[0].y}`];
  for (let index = 1; index < points.length - 2; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    commands.push(
      `Q ${current.x},${current.y} ${(current.x + next.x) / 2},${(current.y + next.y) / 2}`,
    );
  }
  const previous = points[points.length - 2];
  const target = points[points.length - 1];
  commands.push(`Q ${previous.x},${previous.y} ${target.x},${target.y}`);
  const label = curvedVertexLabelPoint(points);
  return [commands.join(" "), label.x, label.y];
}

function midpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function cubicBezierPoint(
  start: Point,
  controlA: Point,
  controlB: Point,
  end: Point,
  t: number,
): Point {
  const inverse = 1 - t;
  const startWeight = inverse ** 3;
  const controlAWeight = 3 * inverse ** 2 * t;
  const controlBWeight = 3 * inverse * t ** 2;
  const endWeight = t ** 3;
  return {
    x:
      startWeight * start.x +
      controlAWeight * controlA.x +
      controlBWeight * controlB.x +
      endWeight * end.x,
    y:
      startWeight * start.y +
      controlAWeight * controlA.y +
      controlBWeight * controlB.y +
      endWeight * end.y,
  };
}

function curvedVertexLabelPoint(points: Point[]): Point {
  const segments: Array<{ control: Point; end: Point; start: Point }> = [];
  let start = points[0]!;
  for (let index = 1; index < points.length - 2; index += 1) {
    const current = points[index]!;
    const next = points[index + 1]!;
    const end = midpoint(current, next);
    segments.push({ start, control: current, end });
    start = end;
  }
  segments.push({
    start,
    control: points[points.length - 2]!,
    end: points[points.length - 1]!,
  });
  const segment = segments[Math.max(0, Math.floor((segments.length - 1) / 2))]!;
  return quadraticBezierPoint(segment.start, segment.control, segment.end, 0.5);
}

function quadraticBezierPoint(
  start: Point,
  control: Point,
  end: Point,
  t: number,
): Point {
  const inverse = 1 - t;
  const startWeight = inverse ** 2;
  const controlWeight = 2 * inverse * t;
  const endWeight = t ** 2;
  return {
    x: startWeight * start.x + controlWeight * control.x + endWeight * end.x,
    y: startWeight * start.y + controlWeight * control.y + endWeight * end.y,
  };
}
