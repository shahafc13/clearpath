import { describe, expect, it } from "vitest";
import { levels } from "../src/levels";
import { cellAt, cellSize } from "../src/layout";

describe("layout", () => {
  it("shrinks cells to fit the shorter side after the margin", () => {
    expect(cellSize(400, 200, levels[0], 20)).toBe(40);
  });

  it("maps a point inside the board to its cell and ignores the margin", () => {
    expect(cellAt(10, 10, 20, 4, 4, 15, 15)).toEqual({ x: 0, y: 0 });
    expect(cellAt(10, 10, 20, 4, 4, 0, 0)).toBeNull();
  });
});
