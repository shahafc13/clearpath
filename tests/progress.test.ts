import { describe, expect, it } from "vitest";
import { emptyProgress, loadProgress, recordClear, saveProgress, starsForBumps, type Progress } from "../src/progress";

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("progress", () => {
  it("starts on the first level", () => {
    expect(loadProgress(40, memory())).toEqual(emptyProgress());
  });

  it("unlocks the next level and keeps a replay from moving the bookmark", () => {
    const storage = memory();
    const cleared = recordClear(emptyProgress(), 0, 40, 0);
    saveProgress(cleared, storage);
    expect(loadProgress(40, storage)).toEqual<Progress>({
      current: 1,
      unlocked: 2,
      completed: false,
      seenLesson: false,
      stars: [3],
    });
    const replay = recordClear(loadProgress(40, storage), 0, 40, 1);
    expect(replay.current).toBe(1);
    expect(replay.unlocked).toBe(2);
  });

  it("marks the campaign complete on the last board and ignores a broken save", () => {
    const storage = memory();
    const done = recordClear({ current: 39, unlocked: 40, completed: false, seenLesson: true, stars: [] }, 39, 40, 0);
    saveProgress(done, storage);
    expect(loadProgress(40, storage).completed).toBe(true);
    expect(loadProgress(40, storage).unlocked).toBe(40);
    storage.setItem("clearpath.progress", "{");
    expect(loadProgress(40, storage)).toEqual(emptyProgress());
  });

  it("keeps the better star rating when a level is replayed", () => {
    expect(starsForBumps(0)).toBe(3);
    expect(starsForBumps(1)).toBe(2);
    expect(starsForBumps(2)).toBe(1);
    const rough = recordClear(emptyProgress(), 2, 40, 2);
    expect(rough.stars[2]).toBe(1);
    const clean = recordClear(rough, 2, 40, 0);
    expect(clean.stars[2]).toBe(3);
    expect(recordClear(clean, 2, 40, 2).stars[2]).toBe(3);
  });
});
