import { describe, expect, it } from "vitest";
import { levels } from "../src/levels";
import { canEscape, isWon, stepSnake } from "../src/rules";
import type { Level, Snake } from "../src/types";
import { LevelError, validateLevel } from "../src/validate";

function cellsOf(snake: Snake | undefined): string {
  return (snake?.cells ?? []).map((cell) => `${cell.x},${cell.y}`).join(" ");
}

describe("escape", () => {
  it("lets either snake leave the first level", () => {
    const level = levels[0];
    expect(canEscape(level, "a")).toBe(true);
    expect(canEscape(level, "b")).toBe(true);
  });

  it("keeps a blocked snake in place", () => {
    const level = levels[2];
    const before = cellsOf(level.snakes[1]);
    expect(canEscape(level, "a")).toBe(true);
    expect(canEscape(level, "b")).toBe(false);
    expect(cellsOf(level.snakes[1])).toBe(before);
  });

  it("lets the waiting snake leave after the blocker is gone", () => {
    const level = levels[2];
    const opened: Level = { ...level, snakes: level.snakes.filter((snake) => snake.id !== "a") };
    expect(canEscape(opened, "b")).toBe(true);
  });

  it("keeps the long snake blocked until the gate has left the board", () => {
    const level = levels[3];
    expect(canEscape(level, "long")).toBe(false);
    const gate = level.snakes[0];
    const shifted = stepSnake(gate, level.width, level.height);
    expect(shifted).not.toBeNull();
    const during: Level = {
      ...level,
      snakes: [shifted!, level.snakes[1]],
    };
    expect(canEscape(during, "long")).toBe(false);
    const gone: Level = { ...level, snakes: [level.snakes[1]] };
    expect(canEscape(gone, "long")).toBe(true);
  });
});

describe("leaving the board", () => {
  it("removes a snake one cell at a time and wins when none remain", () => {
    const level = levels[0];
    let snake: Snake | null = level.snakes[0];
    const seen: string[] = [];
    while (snake) {
      seen.push(cellsOf(snake));
      snake = stepSnake(snake, level.width, level.height);
    }
    expect(seen[0]).toBe("0,1 1,1");
    expect(seen.at(-1)).not.toBe("");
    expect(isWon([])).toBe(true);
    expect(isWon(level.snakes)).toBe(false);
  });
});

describe("invalid levels", () => {
  const base = levels[0];

  it("rejects a snake shorter than two cells", () => {
    const level: Level = {
      ...base,
      snakes: [{ id: "short", direction: "right", cells: [{ x: 0, y: 0 }] }],
    };
    expect(() => validateLevel(level)).toThrow(LevelError);
    expect(() => validateLevel(level)).toThrow(/shorter than two cells/);
  });

  it("rejects a cell outside the grid", () => {
    const level: Level = {
      ...base,
      snakes: [{ id: "out", direction: "right", cells: [{ x: 0, y: 0 }, { x: 8, y: 0 }] }],
    };
    expect(() => validateLevel(level)).toThrow(/outside the grid/);
  });

  it("rejects a duplicate cell", () => {
    const level: Level = {
      ...base,
      snakes: [
        { id: "a", direction: "right", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
        { id: "b", direction: "right", cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
      ],
    };
    expect(() => validateLevel(level)).toThrow(/duplicate cell/);
  });

  it("rejects a trail with a gap", () => {
    const level: Level = {
      ...base,
      snakes: [
        {
          id: "gap",
          direction: "right",
          cells: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 3, y: 0 },
          ],
        },
      ],
    };
    expect(() => validateLevel(level)).toThrow(/gap in its trail/);
  });

  it("rejects a head that does not face its last step", () => {
    const level: Level = {
      ...base,
      snakes: [{ id: "turned", direction: "up", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    };
    expect(() => validateLevel(level)).toThrow(/does not face the direction of its last step/);
  });
});
