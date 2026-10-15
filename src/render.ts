import { DELTA, type Level, type Snake } from "./types";
import { boardOrigin, cellSize } from "./layout";

export const SNAKE_COLORS = ["#c4512c", "#2f6f4e", "#2c5aa0", "#8a5a12", "#6b3fa0"];
export const BOARD_MARGIN = 28;

export function colorFor(index: number): string {
  return SNAKE_COLORS[index % SNAKE_COLORS.length];
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  level: Level,
  snakes: Snake[],
  bump: Record<string, { x: number; y: number }>,
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  const size = cellSize(canvasWidth, canvasHeight, level, BOARD_MARGIN);
  if (size <= 0) return;
  const origin = boardOrigin(canvasWidth, canvasHeight, level, size);

  ctx.strokeStyle = "#d9d3c7";
  ctx.lineWidth = 1;
  for (let y = 0; y <= level.height; y += 1) {
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y + y * size);
    ctx.lineTo(origin.x + level.width * size, origin.y + y * size);
    ctx.stroke();
  }
  for (let x = 0; x <= level.width; x += 1) {
    ctx.beginPath();
    ctx.moveTo(origin.x + x * size, origin.y);
    ctx.lineTo(origin.x + x * size, origin.y + level.height * size);
    ctx.stroke();
  }

  const order = new Map(level.snakes.map((snake, index) => [snake.id, index]));
  snakes.forEach((snake) => {
    const index = order.get(snake.id) ?? 0;
    const shift = bump[snake.id] ?? { x: 0, y: 0 };
    drawSnake(ctx, origin, size, snake, colorFor(index), shift);
  });
}

function center(origin: { x: number; y: number }, size: number, x: number, y: number, shift: { x: number; y: number }) {
  return {
    x: origin.x + (x + 0.5 + shift.x) * size,
    y: origin.y + (y + 0.5 + shift.y) * size,
  };
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  origin: { x: number; y: number },
  size: number,
  snake: Snake,
  color: string,
  shift: { x: number; y: number },
): void {
  const points = snake.cells.map((cell) => center(origin, size, cell.x, cell.y, shift));
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.62;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();

  const head = points[points.length - 1];
  const step = DELTA[snake.direction];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(head.x, head.y, size * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(head.x + step.x * size * 0.28, head.y + step.y * size * 0.28, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
}
