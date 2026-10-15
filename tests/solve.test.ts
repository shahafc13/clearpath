import { describe, expect, it } from "vitest";
import { canEscape } from "../src/rules";
import { releaseOrder, releaseWaves } from "../src/solve";
import type { Level } from "../src/types";

const cycle: Level = {
  id: "cycle",
  width: 4,
  height: 3,
  snakes: [
    { id: "a", direction: "right", cells: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
    { id: "b", direction: "left", cells: [{ x: 3, y: 1 }, { x: 2, y: 1 }] },
  ],
};

describe("solver", () => {
  it("finds no way out of a head-on block", () => {
    expect(canEscape(cycle, "a")).toBe(false);
    expect(canEscape(cycle, "b")).toBe(false);
    expect(releaseOrder(cycle)).toBeNull();
    expect(releaseWaves(cycle)).toBe(0);
  });
});
