import "./style.css";
import { lessonBlocked, lessonFree } from "./lesson";
import { levels } from "./levels";
import { BOARD_MARGIN, BUMP_MS, SLIDE_MS, drawBoard, type Departure } from "./render";
import { boardOrigin, cellAt, cellSize } from "./layout";
import { loadProgress, recordClear, saveProgress, starsForBumps, type Progress } from "./progress";
import { canEscape, isWon, snakeAt, stepSnake } from "./rules";
import { playBump, playClear, playLeave } from "./sound";
import type { Level, Snake } from "./types";
import { LevelError, validateLevel } from "./validate";


const status = query<HTMLParagraphElement>("#status");
const hint = query<HTMLParagraphElement>("#hint");
const pips = query<HTMLParagraphElement>("#pips");
const score = query<HTMLParagraphElement>("#score");
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
const travel = new Map<string, number>();
const bumpUntil = new Map<string, number>();
let departures: Departure[] = [];
let enteredAt = 0;
let celebrateAt = 0;
let won = false;
let lastFrame = 0;
let attemptBumps = 0;

const BUMP_LIMIT = 3;

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

function paintScore(): void {
  const earned = progress.stars.reduce((sum, count) => sum + count, 0);
  const total = levels.length * 3;
  score.textContent =
    earned === 0
      ? "Three bumps send the snakes back. A clear with no bumps is worth 3 stars."
      : `${earned} of ${total} stars. Three bumps send the snakes back.`;
}

function paintPips(): void {
  if (screen !== "play") {
    pips.hidden = true;
    return;
  }
  const left = BUMP_LIMIT - attemptBumps;
  pips.hidden = false;
  pips.textContent = "●".repeat(left) + "○".repeat(attemptBumps);
  pips.setAttribute("aria-label", left === 1 ? "1 bump left" : `${left} bumps left`);
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
  if (nextScreen === "home") {
    playButton.textContent = playLabel();
    paintScore();
  }
  paintPips();
  if (playing) requestAnimationFrame(resize);
}

function begin(level: Level, index: number): void {
  activeLevel = level;
  levelIndex = index;
  snakes = cloneSnakes(level.snakes);
  leaving.clear();
  travel.clear();
  bumpUntil.clear();
  departures = [];
  enteredAt = performance.now();
  celebrateAt = 0;
  won = false;
  attemptBumps = 0;
  nextButton.hidden = true;
  hint.textContent = "";
}

function loadCampaign(index: number): void {
  begin(levels[index], index);
  status.textContent =
    index < 5
      ? `Level ${index + 1} of ${levels.length}. Click a snake to send it off.`
      : `Level ${index + 1} of ${levels.length}. One snake can leave.`;
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
  celebrateAt = performance.now();
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
  const earned = starsForBumps(attemptBumps);
  progress = recordClear(progress, levelIndex, levels.length, attemptBumps);
  saveProgress(progress, store);
  const last = levelIndex === levels.length - 1;
  const starLine = earned === 3 ? "Clean clear. 3 stars." : earned === 2 ? "2 stars." : "1 star.";
  status.textContent = last ? `The path is clear. ${starLine}` : `Level ${levelIndex + 1} clear. ${starLine}`;
  const best = progress.stars[levelIndex] ?? earned;
  if (best > earned) hint.textContent = `Best on this level: ${best} stars.`;
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
    const number = document.createElement("span");
    number.textContent = String(index + 1);
    button.append(number);
    const rating = progress.stars[index] ?? 0;
    if (cleared) {
      const stars = document.createElement("span");
      stars.className = "star-row";
      stars.textContent = "★".repeat(rating) + "☆".repeat(3 - rating);
      button.append(stars);
      button.setAttribute("aria-label", `Level ${index + 1}, ${rating} stars`);
    }
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

function draw(): void {
  const now = performance.now();
  departures = departures.filter((ghost) => now - ghost.startedAt < SLIDE_MS);
  drawBoard(ctx!, board.width, board.height, activeLevel, snakes, {
    now,
    travel,
    bumps: bumpUntil,
    departures,
    enteredAt,
    celebrateAt,
    guides: screen === "lesson" || levelIndex < 5,
  });
}

function advance(now: number): void {
  const dt = Math.min(48, now - lastFrame);
  lastFrame = now;
  const nextSnakes: Snake[] = [];
  for (const snake of snakes) {
    if (!leaving.has(snake.id)) {
      nextSnakes.push(snake);
      continue;
    }
    let progressed = (travel.get(snake.id) ?? 0) + dt / SLIDE_MS;
    let current: Snake | null = snake;
    while (current && progressed >= 1) {
      progressed -= 1;
      const stepped = stepSnake(current, activeLevel.width, activeLevel.height);
      if (!stepped) {
        departures.push({ snake: current, startedAt: now });
        leaving.delete(snake.id);
        travel.delete(snake.id);
        current = null;
        break;
      }
      current = stepped;
    }
    if (current) {
      travel.set(current.id, progressed);
      nextSnakes.push(current);
    }
  }
  snakes = nextSnakes;
  if (isWon(snakes)) showWin();
}

function frame(now: number): void {
  const playing = screen === "play" || screen === "lesson";
  if (playing && !won) advance(now);
  else lastFrame = now;
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
      attemptBumps += 1;
      if (attemptBumps >= BUMP_LIMIT) {
        begin(activeLevel, levelIndex);
        hint.textContent = "Three bumps. The snakes are back. Look before you tap.";
        paintPips();
        return;
      }
      const left = BUMP_LIMIT - attemptBumps;
      hint.textContent = left === 1 ? "One bump left." : `${left} bumps left.`;
      paintPips();
    }
    return;
  }
  leaving.add(snake.id);
  travel.set(snake.id, 0);
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
  lastFrame = now;
  requestAnimationFrame(frame);
});
