import { describe, expect, it } from "vitest";
import { levels } from "../src/levels";
import { canEscape } from "../src/rules";
import { peakFree, releaseOrder, releaseWaves } from "../src/solve";
import { validateLevel } from "../src/validate";

describe("handmade levels", () => {
  it("ships a solved campaign and keeps the teaching boards first", () => {
    expect(levels).toHaveLength(40);
    for (const level of levels) {
      validateLevel(level);
      const order = releaseOrder(level);
      expect(order, level.id).not.toBeNull();
      let remaining = level.snakes;
      for (const id of order ?? []) {
        expect(canEscape({ ...level, snakes: remaining }, id), `${level.id} ${id}`).toBe(true);
        remaining = remaining.filter((snake) => snake.id !== id);
      }
      expect(remaining).toHaveLength(0);
    }
    for (const level of levels.slice(5)) {
      expect(releaseWaves(level), level.id).toBe(level.snakes.length);
      expect(peakFree(level), level.id).toBe(1);
    }
    for (const level of levels.slice(15)) expect(level.snakes.length).toBeGreaterThanOrEqual(5);
  });

  it("makes the bent snake on level 2 able to leave", () => {
    expect(levels[1].snakes[0].cells).toHaveLength(3);
    expect(canEscape(levels[1], "a")).toBe(true);
  });

  it("requires bent, then vertical, then side on level 5", () => {
    const level = levels[4];
    expect(canEscape(level, "bent")).toBe(true);
    expect(canEscape(level, "vertical")).toBe(false);
    expect(canEscape(level, "side")).toBe(false);
    const afterBent = { ...level, snakes: level.snakes.filter((snake) => snake.id !== "bent") };
    expect(canEscape(afterBent, "vertical")).toBe(true);
    expect(canEscape(afterBent, "side")).toBe(false);
    const afterVertical = { ...afterBent, snakes: afterBent.snakes.filter((snake) => snake.id !== "vertical") };
    expect(canEscape(afterVertical, "side")).toBe(true);
  });
});
