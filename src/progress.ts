export interface Progress {
  current: number;
  unlocked: number;
  completed: boolean;
  seenLesson: boolean;
  stars: number[];
}

const KEY = "clearpath.progress";

export function emptyProgress(): Progress {
  return { current: 0, unlocked: 1, completed: false, seenLesson: false, stars: [] };
}

export function starsForBumps(bumps: number): number {
  if (bumps <= 0) return 3;
  if (bumps === 1) return 2;
  return 1;
}

export function loadProgress(total: number, storage: Pick<Storage, "getItem">): Progress {
  const fallback = emptyProgress();
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    const record = parsed as Partial<Progress>;
    const unlocked = clamp(record.unlocked, 1, total, 1);
    const completed = record.completed === true && unlocked === total;
    const current = clamp(record.current, 0, Math.max(0, unlocked - 1), 0);
    return {
      current: completed ? 0 : current,
      unlocked,
      completed,
      seenLesson: record.seenLesson === true,
      stars: readStars(record.stars, total),
    };
  } catch {
    return fallback;
  }
}

export function saveProgress(progress: Progress, storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // The in-memory copy still advances when storage is blocked.
  }
}

export function recordClear(progress: Progress, levelIndex: number, total: number, bumps: number): Progress {
  const wasFrontier = levelIndex >= progress.unlocked - 1;
  const unlocked = Math.min(total, Math.max(progress.unlocked, levelIndex + 2));
  const completed = progress.completed || levelIndex === total - 1;
  const current = completed ? 0 : wasFrontier ? Math.min(levelIndex + 1, total - 1) : progress.current;
  const stars = progress.stars.slice();
  while (stars.length <= levelIndex) stars.push(0);
  stars[levelIndex] = Math.max(stars[levelIndex] ?? 0, starsForBumps(bumps));
  return {
    current,
    unlocked,
    completed,
    seenLesson: progress.seenLesson,
    stars,
  };
}

function readStars(value: unknown, total: number): number[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, total).map((entry) => clamp(entry, 0, 3, 0));
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
