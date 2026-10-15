import "./style.css";
import { lessonBlocked, lessonFree } from "./lesson";
import { levels } from "./levels";
import { BOARD_MARGIN, drawBoard } from "./render";
import { boardOrigin, cellAt, cellSize } from "./layout";
import { loadProgress, recordClear, saveProgress, type Progress } from "./progress";
import { canEscape, isWon, snakeAt, stepSnake } from "./rules";
import { playBump, playClear, playLeave } from "./sound";
import type { Level, Snake } from "./types";
import { LevelError, validateLevel } from "./validate";

const STEP_MS = 140;
const BUMP_MS = 260;

const status = query<HTMLParagraphElement>("#status");
const hint = query<HTMLParagraphElement>("#hint");
const board = query<HTMLCanvasElement>("#board");
const nextButton = query<HTMLButtonElement>("#next");
const restartButton = query<HTMLButtonElement>("#restart");
const levelsButton = query<HTMLButtonElement>("#to-levels");
const skipLesson = query<HTMLButtonElement>("#skip-lesson");
const playBar = query<HTMLElement>("#play-bar");
const playActions = query<HTMLElement>("#play-actions");
const home = query<HTMLElement>("#home");
const playButton = query<HTMLButtonElement>("#play");
const howButton = query<HTMLButtonElement>("#how");
const pickButton = query<HTMLButtonElement>("#pick");
const levelSheet = query<HTMLElement>("#levels");
const levelGrid = query<HTMLElement>("#level-grid");
const levelsHome = query<HTMLButtonElement>("#levels-home");

const ctx = board.getContext("2d");
if (!ctx) throw new Error("Canvas rendering is unavailable");

const store = storage();

try {
  for (const level of [...levels, lessonFree, lessonBlocked]) validateLevel(level);
} catch (error) {
  const message = error instanceof LevelError ? error.message : "A level failed to load";
  status.textContent = message;
  home.hidden = true;
  playBar.hidden = false;
  throw error;
}

type Screen = "home" | "lesson" | "levels" | "play";
type LessonStep = "free" | "blocked";

let screen: Screen = "home";
let lessonStep: LessonStep = "free";
let lessonFirstRun = false;
let progress: Progress = loadProgress(levels.length, store);
let levelIndex = 0;
let activeLevel: Level = levels[0];
let snakes: Snake[] = [];
const leaving = new Set<string>();
const bumpUntil = new Map<string, number>();
let won = false;
let lastStep = 0;

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Clearpath page is missing ${selector}`);
  return element;
}

function storage(): Pick<Storage, "getItem" | "setItem"> {
  try {
    const local = window.localStorage;
    local.getItem("clearpath.progress");
    return local;
  } catch {
    const values = new Map<string, string>();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
  }
}

function cloneSnakes(source: Snake[]): Snake[] {
  return source.map((snake) => ({
    ...snake,
    cells: snake.cells.map((cell) => ({ ...cell })),
  }));
}

function atStart(): boolean {
  return progress.current === 0 && progress.unlocked === 1 && !progress.completed;
}

function playLabel(): string {
  if (progress.completed) return "Play again";
  if (atStart()) return "Play";
  return "Continue";
}

function show(nextScreen: Screen): void {
  screen = nextScreen;
  const playing = nextScreen === "play" || nextScreen === "lesson";
  home.hidden = nextScreen !== "home";
  levelSheet.hidden = nextScreen !== "levels";
  playBar.hidden = !playing;
  board.hidden = !playing;
  playActions.hidden = !playing;
  restartButton.hidden = nextScreen !== "play";
  levelsButton.hidden = nextScreen !== "play";
  skipLesson.hidden = nextScreen !== "lesson";
  if (nextScreen === "home") playButton.textContent = playLabel();
  if (playing) requestAnimationFrame(resize);
}

function begin(level: Level, index: number): void {
  activeLevel = level;
  levelIndex = index;
  snakes = cloneSnakes(level.snakes);
  leaving.clear();
  bumpUntil.clear();
  won = false;
  nextButton.hidden = true;
  hint.textContent = "";
}

function loadCampaign(index: number): void {
  begin(levels[index], index);
  status.textContent = `Level ${index + 1} of ${levels.length}. Click a snake to send it off.`;
  show("play");
}

function startLesson(firstRun: boolean): void {
  lessonFirstRun = firstRun;
  lessonStep = "free";
  begin(lessonFree, 0);
  status.textContent = "The cells in front of its head are empty. Click the snake.";
  show("lesson");
}

function finishLesson(): void {
  progress = { ...progress, seenLesson: true };
  saveProgress(progress, store);
  if (lessonFirstRun) loadCampaign(0);
  else show("home");
}

function showWin(): void {
  if (won) return;
  won = true;
  playClear();
  hint.textContent = "";
  if (screen === "lesson") {
    if (lessonStep === "free") {
      status.textContent = "It slithers off the board.";
      nextButton.textContent = "Show a blocked snake";
    } else {
      status.textContent = "Clear the snake in front, then the one behind it.";
      nextButton.textContent = lessonFirstRun ? "Play level 1" : "Done";
    }
    nextButton.hidden = false;
    return;
  }
  progress = recordClear(progress, levelIndex, levels.length);
  saveProgress(progress, store);
  const last = levelIndex === levels.length - 1;
  status.textContent = last ? "Every snake has left. The path is clear." : `Level ${levelIndex + 1} clear.`;
  nextButton.textContent = last ? "Choose a level" : "Next level";
  nextButton.hidden = false;
}

function renderLevels(): void {
  levelGrid.replaceChildren();
  levels.forEach((_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const open = index < progress.unlocked;
    const cleared = progress.completed || index < progress.unlocked - 1;
    button.textContent = String(index + 1);
    button.disabled = !open;
    if (cleared) button.classList.add("cleared");
    if (open && !progress.completed && index === progress.current) button.setAttribute("aria-current", "true");
    if (!open) button.setAttribute("aria-label", `Level ${index + 1} locked`);
    button.addEventListener("click", () => {
      if (open) loadCampaign(index);
    });
    levelGrid.append(button);
  });
}

function resize(): void {
  if (board.hidden) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  board.width = Math.max(1, Math.floor(board.clientWidth * dpr));
  board.height = Math.max(1, Math.floor(board.clientHeight * dpr));
  draw();
}

function bumpShift(now: number): Record<string, { x: number; y: number }> {
  const shifts: Record<string, { x: number; y: number }> = {};
  for (const [id, until] of bumpUntil) {
    const remaining = until - now;
    if (remaining <= 0) {
      bumpUntil.delete(id);
      continue;
    }
    const snake = snakes.find((entry) => entry.id === id);
    if (!snake) continue;
    const progressRatio = 1 - remaining / BUMP_MS;
    const amount = Math.sin(progressRatio * Math.PI) * 0.32;
    const step = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[
      snake.direction
    ];
    shifts[id] = { x: step.x * amount, y: step.y * amount };
  }
  return shifts;
}

function draw(): void {
  drawBoard(ctx!, board.width, board.height, activeLevel, snakes, bumpShift(performance.now()));
}

function stepLeaving(): void {
  snakes = snakes.flatMap((snake) => {
    if (!leaving.has(snake.id)) return [snake];
    const moved = stepSnake(snake, activeLevel.width, activeLevel.height);
    if (!moved) {
      leaving.delete(snake.id);
      return [];
    }
    return [moved];
  });
  if (isWon(snakes)) showWin();
}

function frame(now: number): void {
  const playing = screen === "play" || screen === "lesson";
  if (playing && now - lastStep >= STEP_MS) {
    lastStep = now;
    if (!won) stepLeaving();
  }
  if (playing) draw();
  requestAnimationFrame(frame);
}

board.addEventListener("click", (event) => {
  if ((screen !== "play" && screen !== "lesson") || won) return;
  const rect = board.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * board.width;
  const py = ((event.clientY - rect.top) / rect.height) * board.height;
  const size = cellSize(board.width, board.height, activeLevel, BOARD_MARGIN);
  const origin = boardOrigin(board.width, board.height, activeLevel, size);
  const cell = cellAt(origin.x, origin.y, size, activeLevel.width, activeLevel.height, px, py);
  if (!cell) return;
  const snake = snakeAt(snakes, cell);
  if (!snake || leaving.has(snake.id)) return;
  if (!canEscape({ width: activeLevel.width, height: activeLevel.height, snakes }, snake.id)) {
    bumpUntil.set(snake.id, performance.now() + BUMP_MS);
    playBump();
    if (screen === "lesson" && lessonStep === "blocked") {
      status.textContent = "The green snake stays. Send the rust snake off first.";
    } else if (screen === "play") {
      hint.textContent = "That path is blocked.";
    }
    return;
  }
  leaving.add(snake.id);
  playLeave();
  if (screen === "play") hint.textContent = "";
  if (screen === "lesson" && lessonStep === "blocked" && snake.id === "rust") {
    status.textContent = "Rust is leaving. Click green once the path is empty.";
  }
});

nextButton.addEventListener("click", () => {
  if (screen === "lesson") {
    if (lessonStep === "free") {
      lessonStep = "blocked";
      begin(lessonBlocked, 0);
      status.textContent = "Green points at rust. Click the green snake.";
      show("lesson");
      return;
    }
    finishLesson();
    return;
  }
  if (levelIndex === levels.length - 1) {
    renderLevels();
    show("levels");
    return;
  }
  loadCampaign(levelIndex + 1);
});

restartButton.addEventListener("click", () => loadCampaign(levelIndex));
skipLesson.addEventListener("click", finishLesson);
playButton.addEventListener("click", () => {
  if (!progress.seenLesson && atStart()) startLesson(true);
  else loadCampaign(progress.completed ? 0 : progress.current);
});
howButton.addEventListener("click", () => startLesson(false));
pickButton.addEventListener("click", () => {
  renderLevels();
  show("levels");
});
levelsButton.addEventListener("click", () => {
  renderLevels();
  show("levels");
});
levelsHome.addEventListener("click", () => show("home"));

window.addEventListener("resize", resize);
show("home");
requestAnimationFrame((now) => {
  lastStep = now;
  requestAnimationFrame(frame);
});
