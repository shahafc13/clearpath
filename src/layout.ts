import type { Cell, Level } from "./types";

export function cellSize(canvasWidth: number, canvasHeight: number, level: Level, margin: number): number {
  const innerWidth = Math.max(0, canvasWidth - margin * 2);
  const innerHeight = Math.max(0, canvasHeight - margin * 2);
  return Math.floor(Math.min(innerWidth / level.width, innerHeight / level.height));
}

export function boardOrigin(
  canvasWidth: number,
  canvasHeight: number,
  level: Level,
  size: number,
): { x: number; y: number } {
  return {
    x: Math.floor((canvasWidth - size * level.width) / 2),
    y: Math.floor((canvasHeight - size * level.height) / 2),
  };
}

export function cellAt(
  originX: number,
  originY: number,
  size: number,
  width: number,
  height: number,
  px: number,
  py: number,
): Cell | null {
  if (size <= 0) return null;
  const x = Math.floor((px - originX) / size);
  const y = Math.floor((py - originY) / size);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x, y };
}
