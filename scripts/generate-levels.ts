import { writeFileSync } from "node:fs";
import { canEscape } from "../src/rules";
import { releaseOrder, releaseWaves } from "../src/solve";
import type { Cell, Direction, Level, Snake } from "../src/types";
import { validateLevel } from "../src/validate";

const LETTERS = ["a", "b", "c", "d", "e"];

const teaching: Level[] = [
  {
    id: "1",
    width: 4,
    height: 4,
    snakes: [
      { id: "a", direction: "right", cells: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: "b", direction: "right", cells: [{ x: 0, y: 3 }, { x: 1, y: 3 }] },
    ],
  },
  {
    id: "2",
    width: 4,
    height: 4,
    snakes: [
      {
        id: "a",
        direction: "right",
        cells: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      },
      { id: "b", direction: "left", cells: [{ x: 3, y: 3 }, { x: 2, y: 3 }] },
    ],
  },
  {
    id: "3",
    width: 4,
    height: 3,
    snakes: [
      { id: "a", direction: "right", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: "b", direction: "up", cells: [{ x: 1, y: 2 }, { x: 1, y: 1 }] },
    ],
  },
  {
    id: "4",
    width: 5,
    height: 3,
    snakes: [
      { id: "gate", direction: "up", cells: [{ x: 0, y: 2 }, { x: 0, y: 1 }] },
      {
        id: "long",
        direction: "left",
        cells: [
          { x: 4, y: 1 },
          { x: 3, y: 1 },
          { x: 2, y: 1 },
          { x: 1, y: 1 },
        ],
      },
    ],
  },
  {
    id: "5",
    width: 5,
    height: 4,
    snakes: [
      {
        id: "bent",
        direction: "right",
        cells: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      },
      { id: "vertical", direction: "up", cells: [{ x: 1, y: 3 }, { x: 1, y: 2 }] },
      { id: "side", direction: "left", cells: [{ x: 4, y: 3 }, { x: 3, y: 3 }] },
    ],
  },
];

interface Spec {
  width: number;
  height: number;
  count: number;
  minWaves: number;
  minBends: number;
}

function specFor(index: number): Spec {
  if (index < 10) return { width: 4, height: 4, count: 2, minWaves: 2, minBends: 0 };
  if (index < 15) return { width: 5, height: 4, count: 3, minWaves: 2, minBends: 0 };
  if (index < 20) return { width: 5, height: 5, count: 3, minWaves: 2, minBends: 1 };
  if (index < 25) return { width: 6, height: 5, count: 3, minWaves: 2, minBends: 1 };
  if (index < 30) return { width: 6, height: 5, count: 4, minWaves: 2, minBends: 1 };
  if (index < 35) return { width: 6, height: 6, count: 4, minWaves: 3, minBends: 1 };
  return { width: 6, height: 6, count: 5, minWaves: 3, minBends: 2 };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function key(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function directionOf(prev: Cell, head: Cell): Direction | null {
  const dx = head.x - prev.x;
  const dy = head.y - prev.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  return null;
}

function hasBend(snake: Snake): boolean {
  const headings = new Set<string>();
  for (let index = 1; index < snake.cells.length; index += 1) {
    const prev = snake.cells[index - 1];
    const cell = snake.cells[index];
    headings.add(`${cell.x - prev.x},${cell.y - prev.y}`);
  }
  return headings.size > 1;
}

function neighbors(cell: Cell, width: number, height: number): Cell[] {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ].filter((next) => next.x >= 0 && next.y >= 0 && next.x < width && next.y < height);
}

function grow(width: number, height: number, filled: Set<string>, id: string, rng: () => number): Snake | null {
  const open: Cell[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!filled.has(`${x},${y}`)) open.push({ x, y });
    }
  }
  if (open.length < 2) return null;
  const length = 2 + Math.floor(rng() * 3);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const cells = [open[Math.floor(rng() * open.length)]];
    while (cells.length < length) {
      const current = cells[cells.length - 1];
      const options = neighbors(current, width, height).filter((cell) => {
        const name = key(cell);
        return !filled.has(name) && cells.every((entry) => key(entry) !== name);
      });
      if (options.length === 0) break;
      cells.push(options[Math.floor(rng() * options.length)]);
    }
    if (cells.length < 2) continue;
    const direction = directionOf(cells[cells.length - 2], cells[cells.length - 1]);
    if (!direction) continue;
    return { id, direction, cells };
  }
  return null;
}

function fingerprint(level: Level): string {
  const snakes = level.snakes
    .map((snake) => `${snake.direction}:${snake.cells.map(key).join(">")}`)
    .sort()
    .join("|");
  return `${level.width}x${level.height}:${snakes}`;
}

function acceptable(level: Level, spec: Spec): boolean {
  try {
    validateLevel(level);
  } catch {
    return false;
  }
  if (!releaseOrder(level)) return false;
  if (releaseWaves(level) < spec.minWaves) return false;
  const bends = level.snakes.filter(hasBend).length;
  if (bends < spec.minBends) return false;
  const blocked = level.snakes.some((snake) => !canEscape(level, snake.id));
  return blocked;
}

function build(index: number, rng: () => number, seen: Set<string>): Level {
  const spec = specFor(index);
  for (let attempt = 0; attempt < 20000; attempt += 1) {
    const filled = new Set<string>();
    const snakes: Snake[] = [];
    let failed = false;
    for (let count = 0; count < spec.count; count += 1) {
      const snake = grow(spec.width, spec.height, filled, LETTERS[count], rng);
      if (!snake) {
        failed = true;
        break;
      }
      for (const cell of snake.cells) filled.add(key(cell));
      snakes.push(snake);
    }
    if (failed) continue;
    const level: Level = {
      id: String(index + 1),
      width: spec.width,
      height: spec.height,
      snakes,
    };
    const print = fingerprint(level);
    if (seen.has(print) || !acceptable(level, spec)) continue;
    seen.add(print);
    return level;
  }
  throw new Error(`Could not build level ${index + 1}`);
}

function literal(level: Level): string {
  const snakes = level.snakes
    .map((snake) => {
      const cells = snake.cells.map((cell) => `{ x: ${cell.x}, y: ${cell.y} }`).join(", ");
      return `    { id: "${snake.id}", direction: "${snake.direction}", cells: [${cells}] },`;
    })
    .join("\n");
  return `  {\n    id: "${level.id}",\n    width: ${level.width},\n    height: ${level.height},\n    snakes: [\n${snakes}\n    ],\n  },`;
}

const seen = new Set(teaching.map(fingerprint));
const rng = mulberry32(20261015);
const campaign = [...teaching];
for (let index = teaching.length; index < 40; index += 1) {
  campaign.push(build(index, rng, seen));
}

const source = `import type { Level } from "./types";

export const levels: Level[] = [
${campaign.map(literal).join("\n")}
];
`;

writeFileSync(new URL("../src/levels.ts", import.meta.url), source);
console.log(`wrote ${campaign.length} levels`);
