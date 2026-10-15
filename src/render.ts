import { cellsAhead } from "./rules";
import { DELTA, type Direction, type Level, type Snake } from "./types";
import { boardOrigin, cellSize } from "./layout";

export const BOARD_MARGIN = 28;
export const SLIDE_MS = 150;
export const BUMP_MS = 420;
const ENTER_MS = 560;
const CELEBRATE_MS = 980;

const PALETTE = [
  { body: "#d4653c", belly: "#f3c2ae", dark: "#8a341c", glow: "#f0a080" },
  { body: "#2f8a5b", belly: "#b7e0c8", dark: "#1c5336", glow: "#8fd0aa" },
  { body: "#3c6fbe", belly: "#c5d7f4", dark: "#23467e", glow: "#9bb8ea" },
  { body: "#c4882a", belly: "#f3ddb0", dark: "#7a5410", glow: "#e6c27a" },
  { body: "#7a4eb8", belly: "#dcc8f2", dark: "#4a2c78", glow: "#c2a6e6" },
];

export interface Departure {
  snake: Snake;
  startedAt: number;
}

export interface Scene {
  now: number;
  travel: ReadonlyMap<string, number>;
  bumps: ReadonlyMap<string, number>;
  departures: readonly Departure[];
  enteredAt: number;
  celebrateAt: number;
  guides: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Paint {
  body: string;
  belly: string;
  dark: string;
  glow: string;
}

const ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length].body;
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  level: Level,
  snakes: Snake[],
  scene: Scene,
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  const size = cellSize(canvasWidth, canvasHeight, level, BOARD_MARGIN);
  if (size <= 0) return;
  const origin = boardOrigin(canvasWidth, canvasHeight, level, size);
  const boardWidth = size * level.width;
  const boardHeight = size * level.height;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveal = calm ? 1 : easeOut(clamp((scene.now - scene.enteredAt) / ENTER_MS, 0, 1));

  drawTable(ctx, origin, boardWidth, boardHeight, size, level);

  const order = new Map(level.snakes.map((snake, index) => [snake.id, index]));
  const filled = new Set<string>();
  for (const snake of snakes) {
    for (const cell of snake.cells) filled.add(`${cell.x},${cell.y}`);
  }

  if (scene.guides) {
    for (const snake of snakes) {
      const paint = PALETTE[(order.get(snake.id) ?? 0) % PALETTE.length];
      drawGuide(ctx, origin, size, level, snake, filled, paint, scene, reveal);
    }
  }

  for (const ghost of scene.departures) {
    const age = scene.now - ghost.startedAt;
    if (age < 0 || age > SLIDE_MS) continue;
    const paint = PALETTE[(order.get(ghost.snake.id) ?? 0) % PALETTE.length];
    drawSnake(ctx, origin, size, ghost.snake, paint, {
      travel: 1 + age / SLIDE_MS,
      bump: 0,
      reveal: 1,
      alpha: 1 - age / SLIDE_MS,
      now: scene.now,
      calm: true,
      leaving: true,
    });
  }

  for (const snake of snakes) {
    const paint = PALETTE[(order.get(snake.id) ?? 0) % PALETTE.length];
    const until = scene.bumps.get(snake.id) ?? 0;
    const bump = until > scene.now ? 1 - (until - scene.now) / BUMP_MS : 0;
    drawSnake(ctx, origin, size, snake, paint, {
      travel: scene.travel.get(snake.id) ?? 0,
      bump,
      reveal,
      alpha: 1,
      now: scene.now,
      calm,
      leaving: scene.travel.has(snake.id),
    });
  }

  drawCelebration(ctx, origin, boardWidth, boardHeight, size, scene.now, scene.celebrateAt);
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  origin: Point,
  boardWidth: number,
  boardHeight: number,
  size: number,
  level: Level,
): void {
  const radius = Math.min(size * 0.22, 28);
  ctx.save();
  ctx.shadowColor = "rgba(72, 48, 22, 0.2)";
  ctx.shadowBlur = size * 0.28;
  ctx.shadowOffsetY = size * 0.07;
  ctx.fillStyle = "#e6d8c4";
  roundRect(ctx, origin.x, origin.y, boardWidth, boardHeight, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, origin.x, origin.y, boardWidth, boardHeight, radius);
  ctx.clip();
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#f7f1e6" : "#efe4d2";
      ctx.fillRect(origin.x + x * size + 1.5, origin.y + y * size + 1.5, size - 3, size - 3);
    }
  }
  ctx.fillStyle = "rgba(92, 64, 36, 0.045)";
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if ((x * 13 + y * 29) % 5 !== 0) continue;
      ctx.beginPath();
      ctx.arc(origin.x + (x + 0.72) * size, origin.y + (y + 0.28) * size, Math.max(1, size * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const sheen = ctx.createLinearGradient(origin.x, origin.y, origin.x, origin.y + boardHeight);
  sheen.addColorStop(0, "rgba(255,255,255,0.38)");
  sheen.addColorStop(0.42, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(origin.x, origin.y, boardWidth, boardHeight);
  ctx.restore();

  ctx.strokeStyle = "rgba(120, 90, 55, 0.28)";
  ctx.lineWidth = Math.max(2, size * 0.025);
  roundRect(ctx, origin.x + 1, origin.y + 1, boardWidth - 2, boardHeight - 2, radius);
  ctx.stroke();
}

function drawGuide(
  ctx: CanvasRenderingContext2D,
  origin: Point,
  size: number,
  level: Level,
  snake: Snake,
  filled: Set<string>,
  paint: Paint,
  scene: Scene,
  reveal: number,
): void {
  if (reveal < 0.85 || scene.travel.has(snake.id)) return;
  const head = snake.cells[snake.cells.length - 1];
  const step = DELTA[snake.direction];
  const next = { x: head.x + step.x, y: head.y + step.y };
  if (next.x < 0 || next.y < 0 || next.x >= level.width || next.y >= level.height) return;
  const blocked = filled.has(`${next.x},${next.y}`);
  const until = scene.bumps.get(snake.id) ?? 0;
  const bump = until > scene.now ? 1 - (until - scene.now) / BUMP_MS : 0;
  const point = center(origin, size, next.x, next.y, { x: 0, y: 0 });
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(ANGLE[snake.direction]);
  ctx.strokeStyle = blocked ? paint.dark : paint.body;
  ctx.globalAlpha = (blocked ? 0.22 : 0.3) + bump * 0.45;
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-size * 0.14, -size * 0.12);
  ctx.lineTo(size * 0.05, 0);
  ctx.lineTo(-size * 0.14, size * 0.12);
  ctx.stroke();
  ctx.restore();

  if (bump <= 0 || !blocked) return;
  const ahead = cellsAhead(level.width, level.height, snake).find((cell) => filled.has(`${cell.x},${cell.y}`));
  if (!ahead) return;
  const hit = center(origin, size, ahead.x, ahead.y, { x: 0, y: 0 });
  ctx.save();
  ctx.strokeStyle = paint.glow;
  ctx.globalAlpha = (1 - bump) * 0.8;
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.beginPath();
  ctx.arc(hit.x, hit.y, size * (0.18 + bump * 0.28), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

interface Pose {
  travel: number;
  bump: number;
  reveal: number;
  alpha: number;
  now: number;
  calm: boolean;
  leaving: boolean;
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  origin: Point,
  size: number,
  snake: Snake,
  paint: Paint,
  pose: Pose,
): void {
  const step = DELTA[snake.direction];
  const lunge = Math.sin(pose.bump * Math.PI) * 0.2;
  const settle = (1 - pose.reveal) * 0.45;
  const shift = {
    x: step.x * (pose.travel + lunge - settle),
    y: step.y * (pose.travel + lunge - settle),
  };
  const anchors = snake.cells.map((cell) => center(origin, size, cell.x, cell.y, shift));
  const tailCell = snake.cells[0];
  const neckCell = snake.cells[1];
  anchors.unshift(
    center(origin, size, tailCell.x - (neckCell.x - tailCell.x) * 0.28, tailCell.y - (neckCell.y - tailCell.y) * 0.28, shift),
  );
  const samples = roundedSamples(anchors, size * 0.42);
  if (samples.length < 2) return;

  const phase = hash(snake.id);
  const centers = samples.map((point, index) => {
    const tangent = tangentAt(samples, index);
    const normal = { x: -tangent.y, y: tangent.x };
    const along = index / (samples.length - 1);
    const idle = pose.calm || pose.bump > 0 ? 0 : Math.sin(pose.now / 320 + index * 0.55 + phase * 6) * size * 0.028;
    const slither = pose.leaving && !pose.calm ? Math.sin(pose.now / 70 + index * 0.9) * size * 0.04 : 0;
    const offset = idle + slither * (1 - along);
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
  });

  ctx.save();
  ctx.globalAlpha = pose.alpha * (0.2 + 0.8 * pose.reveal);
  ctx.fillStyle = "rgba(62, 42, 22, 0.14)";
  for (let index = 0; index < centers.length; index += 3) {
    const along = index / (centers.length - 1);
    ctx.beginPath();
    ctx.ellipse(centers[index].x, centers[index].y + size * 0.07, bodyWidth(along, size) * 0.42, size * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tail = centers[0];
  const neck = centers[centers.length - 1];
  const gradient = ctx.createLinearGradient(tail.x, tail.y, neck.x, neck.y);
  gradient.addColorStop(0, paint.dark);
  gradient.addColorStop(0.35, paint.body);
  gradient.addColorStop(1, paint.body);
  traceRibbon(ctx, centers, (along) => bodyWidth(along, size));
  ctx.fillStyle = gradient;
  ctx.fill();

  const belly = centers.slice(Math.floor(centers.length * 0.18)).map((point) => ({ x: point.x, y: point.y - size * 0.025 }));
  if (belly.length > 3) {
    traceRibbon(ctx, belly, (along) => bodyWidth(0.18 + along * 0.82, size) * 0.4);
    ctx.fillStyle = withAlpha(paint.belly, 0.95);
    ctx.fill();
  }

  if (size > 34) drawScales(ctx, centers, size, paint);

  const head = {
    x: neck.x + step.x * size * 0.1,
    y: neck.y + step.y * size * 0.1,
  };
  drawHead(ctx, head, size, snake.direction, paint, pose);
  if (pose.bump > 0) drawShock(ctx, head, step, size, paint, pose.bump);
  ctx.restore();
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  head: Point,
  size: number,
  direction: Direction,
  paint: Paint,
  pose: Pose,
): void {
  const blink = !pose.calm && Math.sin(pose.now / 900 + head.x * 0.01 + head.y * 0.02) > 0.96;
  const squash = 1 + Math.sin(pose.bump * Math.PI) * 0.16;
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(ANGLE[direction]);
  ctx.scale(squash, 1 / squash);
  const rx = size * 0.36;
  const ry = size * 0.28;
  const fill = ctx.createLinearGradient(0, -ry, 0, ry);
  fill.addColorStop(0, paint.dark);
  fill.addColorStop(0.42, paint.body);
  fill.addColorStop(1, paint.belly);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(size * 0.04, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeX = size * 0.16;
  const eyeY = size * 0.12;
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#fbf7f1";
    ctx.beginPath();
    ctx.ellipse(eyeX, side * eyeY, size * 0.085, blink ? size * 0.02 : size * 0.105, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink) continue;
    ctx.fillStyle = "#1b1612";
    ctx.beginPath();
    ctx.arc(eyeX + size * 0.02, side * eyeY, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(eyeX + size * 0.005, side * eyeY - size * 0.025, size * 0.016, 0, Math.PI * 2);
    ctx.fill();
  }

  const flick = Math.sin(pose.now / 640 + head.x * 0.01);
  if (!pose.calm && !pose.leaving && pose.bump === 0 && flick > 0.78) {
    const length = size * 0.16 * ((flick - 0.78) / 0.22);
    ctx.strokeStyle = "#c4495a";
    ctx.lineWidth = Math.max(1.5, size * 0.03);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(rx * 0.85, 0);
    ctx.lineTo(rx * 0.85 + length, -length * 0.45);
    ctx.moveTo(rx * 0.85, 0);
    ctx.lineTo(rx * 0.85 + length, length * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShock(ctx: CanvasRenderingContext2D, head: Point, step: Point, size: number, paint: Paint, bump: number): void {
  ctx.save();
  ctx.globalAlpha *= 1 - bump;
  ctx.strokeStyle = paint.glow;
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.beginPath();
  ctx.arc(head.x + step.x * size * 0.62, head.y + step.y * size * 0.62, size * (0.12 + bump * 0.38), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawScales(ctx: CanvasRenderingContext2D, centers: Point[], size: number, paint: Paint): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(paint.dark, 0.35);
  ctx.lineWidth = Math.max(1, size * 0.03);
  for (let index = 2; index < centers.length - 2; index += 3) {
    const tangent = tangentAt(centers, index);
    const angle = Math.atan2(tangent.y, tangent.x);
    const point = centers[index];
    ctx.beginPath();
    ctx.arc(point.x, point.y, bodyWidth(index / (centers.length - 1), size) * 0.28, angle - 1.1, angle + 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCelebration(
  ctx: CanvasRenderingContext2D,
  origin: Point,
  boardWidth: number,
  boardHeight: number,
  size: number,
  now: number,
  celebrateAt: number,
): void {
  if (celebrateAt <= 0) return;
  const age = now - celebrateAt;
  if (age < 0 || age > CELEBRATE_MS) return;
  const centerPoint = { x: origin.x + boardWidth / 2, y: origin.y + boardHeight / 2 };
  ctx.save();
  for (let ring = 0; ring < 3; ring += 1) {
    const local = clamp((age - ring * 90) / (CELEBRATE_MS * 0.7), 0, 1);
    if (local <= 0) continue;
    ctx.globalAlpha = (1 - local) * 0.55;
    ctx.strokeStyle = PALETTE[ring].glow;
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.beginPath();
    ctx.arc(centerPoint.x, centerPoint.y, size * (0.2 + local * 2.4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function bodyWidth(along: number, size: number): number {
  const grow = clamp(along / 0.4, 0, 1);
  const eased = grow * grow * (3 - 2 * grow);
  return size * (0.36 + (0.54 - 0.36) * eased);
}

function traceRibbon(ctx: CanvasRenderingContext2D, centers: Point[], widthAt: (along: number) => number): void {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let index = 0; index < centers.length; index += 1) {
    const tangent = tangentAt(centers, index);
    const normal = { x: -tangent.y, y: tangent.x };
    const half = widthAt(index / (centers.length - 1)) / 2;
    left.push({ x: centers[index].x + normal.x * half, y: centers[index].y + normal.y * half });
    right.push({ x: centers[index].x - normal.x * half, y: centers[index].y - normal.y * half });
  }
  const tangent = tangentAt(centers, 0);
  const angle = Math.atan2(tangent.y, tangent.x);
  ctx.beginPath();
  ctx.arc(centers[0].x, centers[0].y, widthAt(0) / 2 + 1, angle + Math.PI / 2, angle - Math.PI / 2, false);
  ctx.lineTo(right[0].x, right[0].y);
  for (let index = 1; index < right.length; index += 1) ctx.lineTo(right[index].x, right[index].y);
  for (let index = left.length - 1; index >= 1; index -= 1) ctx.lineTo(left[index].x, left[index].y);
  ctx.closePath();
}

function roundedSamples(points: Point[], radius: number): Point[] {
  if (points.length < 2) return points;
  if (points.length === 2) return sampleLine(points[0], points[1], 8);
  const sampled: Point[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const cut = Math.min(radius, distance(prev, current) * 0.45, distance(current, next) * 0.45);
    const start = pointToward(current, prev, cut);
    const end = pointToward(current, next, cut);
    pushSamples(sampled, sampleLine(sampled[sampled.length - 1], start, 4));
    pushSamples(sampled, sampleQuad(start, current, end, 7));
  }
  pushSamples(sampled, sampleLine(sampled[sampled.length - 1], points[points.length - 1], 6));
  return sampled;
}

function pushSamples(target: Point[], extra: Point[]): void {
  for (const point of extra) {
    const last = target[target.length - 1];
    if (!last || distance(last, point) > 0.5) target.push(point);
  }
}

function sampleLine(from: Point, to: Point, steps: number): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return points;
}

function sampleQuad(from: Point, control: Point, to: Point, steps: number): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    points.push({
      x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
    });
  }
  return points;
}

function tangentAt(points: Point[], index: number): Point {
  const prev = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const length = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
  return { x: (next.x - prev.x) / length, y: (next.y - prev.y) / length };
}

function center(origin: Point, size: number, x: number, y: number, shift: Point): Point {
  return {
    x: origin.x + (x + 0.5 + shift.x) * size,
    y: origin.y + (y + 0.5 + shift.y) * size,
  };
}

function pointToward(from: Point, to: Point, distanceAlong: number): Point {
  const length = distance(from, to) || 1;
  return {
    x: from.x + ((to.x - from.x) / length) * distanceAlong,
    y: from.y + ((to.y - from.y) / length) * distanceAlong,
  };
}

function distance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function hash(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) total = (total * 33 + value.charCodeAt(index)) >>> 0;
  return total / 4294967295;
}

function easeOut(value: number): number {
  return 1 - (1 - value) ** 3;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
