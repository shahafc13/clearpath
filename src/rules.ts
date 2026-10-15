import { DELTA, type Cell, type Level, type Snake } from "./types";

function key(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function inBounds(width: number, height: number, cell: Cell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;
}

export function cellsAhead(width: number, height: number, snake: Snake): Cell[] {
  const head = snake.cells[snake.cells.length - 1];
  const step = DELTA[snake.direction];
  const ahead: Cell[] = [];
  let cursor = { x: head.x + step.x, y: head.y + step.y };
  while (inBounds(width, height, cursor)) {
    ahead.push(cursor);
    cursor = { x: cursor.x + step.x, y: cursor.y + step.y };
  }
  return ahead;
}

export function occupied(snakes: Snake[]): Set<string> {
  const cells = new Set<string>();
  for (const snake of snakes) {
    for (const cell of snake.cells) cells.add(key(cell));
  }
  return cells;
}

export function canEscape(level: Pick<Level, "width" | "height" | "snakes">, snakeId: string): boolean {
  const snake = level.snakes.find((entry) => entry.id === snakeId);
  if (!snake) return false;
  const filled = occupied(level.snakes);
  return cellsAhead(level.width, level.height, snake).every((cell) => !filled.has(key(cell)));
}

export function snakeAt(snakes: Snake[], cell: Cell): Snake | undefined {
  const target = key(cell);
  return snakes.find((snake) => snake.cells.some((entry) => key(entry) === target));
}

export function stepSnake(snake: Snake, width: number, height: number): Snake | null {
  const step = DELTA[snake.direction];
  const cells = snake.cells
    .map((cell) => ({ x: cell.x + step.x, y: cell.y + step.y }))
    .filter((cell) => inBounds(width, height, cell));
  if (cells.length === 0) return null;
  return { ...snake, cells };
}

export function isWon(snakes: Snake[]): boolean {
  return snakes.length === 0;
}
