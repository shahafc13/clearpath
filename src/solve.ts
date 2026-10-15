import { canEscape } from "./rules";
import type { Level, Snake } from "./types";

export function releaseWaves(level: Level): number {
  const waves = waveSizes(level);
  return waves.length === 0 ? 0 : waves.length;
}

export function peakFree(level: Level): number {
  const waves = waveSizes(level);
  return waves.reduce((peak, count) => Math.max(peak, count), 0);
}

function waveSizes(level: Level): number[] {
  let remaining = level.snakes;
  const waves: number[] = [];
  while (remaining.length > 0) {
    const board = { width: level.width, height: level.height, snakes: remaining };
    const free = remaining.filter((snake) => canEscape(board, snake.id));
    if (free.length === 0) return [];
    waves.push(free.length);
    const leaving = new Set(free.map((snake) => snake.id));
    remaining = remaining.filter((snake) => !leaving.has(snake.id));
  }
  return waves;
}

export function releaseOrder(level: Level): string[] | null {
  return search(level, level.snakes, []);
}

function search(level: Level, remaining: Snake[], order: string[]): string[] | null {
  if (remaining.length === 0) return order;
  const board = { width: level.width, height: level.height, snakes: remaining };
  for (const snake of remaining) {
    if (!canEscape(board, snake.id)) continue;
    const next = remaining.filter((entry) => entry.id !== snake.id);
    const found = search(level, next, [...order, snake.id]);
    if (found) return found;
  }
  return null;
}
