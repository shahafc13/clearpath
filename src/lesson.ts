import type { Level } from "./types";

export const lessonFree: Level = {
  id: "lesson-free",
  width: 4,
  height: 3,
  snakes: [{ id: "free", direction: "right", cells: [{ x: 0, y: 1 }, { x: 1, y: 1 }] }],
};

export const lessonBlocked: Level = {
  id: "lesson-blocked",
  width: 4,
  height: 3,
  snakes: [
    { id: "rust", direction: "right", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    { id: "green", direction: "up", cells: [{ x: 1, y: 2 }, { x: 1, y: 1 }] },
  ],
};
