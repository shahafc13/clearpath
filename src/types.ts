export type Direction = "up" | "down" | "left" | "right";

export interface Cell {
  x: number;
  y: number;
}

export interface Snake {
  id: string;
  cells: Cell[];
  direction: Direction;
}

export interface Level {
  id: string;
  width: number;
  height: number;
  snakes: Snake[];
}

export const DELTA: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
