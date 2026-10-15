import { DELTA, type Level } from "./types";

export class LevelError extends Error {
  constructor(levelId: string, rule: string) {
    super(`Level ${levelId} failed validation: ${rule}`);
    this.name = "LevelError";
  }
}

export function validateLevel(level: Level): void {
  const seen = new Set<string>();
  for (const snake of level.snakes) {
    if (snake.cells.length < 2) {
      throw new LevelError(level.id, `snake ${snake.id} is shorter than two cells`);
    }
    for (const cell of snake.cells) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= level.width || cell.y >= level.height) {
        throw new LevelError(level.id, `snake ${snake.id} has a cell outside the grid`);
      }
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) {
        throw new LevelError(level.id, `duplicate cell ${key}`);
      }
      seen.add(key);
    }
    for (let index = 1; index < snake.cells.length; index += 1) {
      const prev = snake.cells[index - 1];
      const cell = snake.cells[index];
      const dx = Math.abs(cell.x - prev.x);
      const dy = Math.abs(cell.y - prev.y);
      if (dx + dy !== 1) {
        throw new LevelError(level.id, `snake ${snake.id} has a gap in its trail`);
      }
    }
    const prev = snake.cells[snake.cells.length - 2];
    const head = snake.cells[snake.cells.length - 1];
    const step = DELTA[snake.direction];
    if (head.x - prev.x !== step.x || head.y - prev.y !== step.y) {
      throw new LevelError(
        level.id,
        `snake ${snake.id} head does not face the direction of its last step`,
      );
    }
  }
}
