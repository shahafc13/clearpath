# Clearpath design

Date: 2026-10-15

Clearpath is a browser puzzle. Snakes occupy trails of cells on a grid. A snake slithers off only when every cell in front of its head is empty. The board is won when the last snake leaves. The first version is five handmade levels. It has no hints, lives, accounts, or network calls.

## Architecture

The app is a Vite project in TypeScript. Game rules live in plain TypeScript, separate from the canvas, so a test can run a level without opening a browser. A level is data: grid width and height, plus each snake as an ordered list of cells from tail to head and a facing direction. The head is the last cell. Two snakes never share a cell.

On a click, the canvas converts the point to a cell and finds the snake that occupies it. Releasing that snake looks forward from the cell in front of its head to the edge of the board. If any of those cells holds another snake, the release fails and the snake plays a short bump. If every cell ahead is empty, the snake is committed to leave. Each frame moves it forward by one cell until the tail has passed the edge, then it is removed. The board is won when no snakes remain. A small level list advances to the next board, and the last board stops on a clear message.

Invalid levels fail at load: a snake shorter than two cells, a cell outside the grid, a duplicate cell, or a head that does not face the direction of its last step. The player never sees a half-loaded board.

## Board and play

The canvas fills the browser window with a centered board and a margin around it. Cells are equal squares. A snake is a thick rounded trail through its cells, wider than the grid lines, with a distinct head so the facing direction is obvious. Colors come from a short fixed palette, one per snake, and stay the same for that snake on that level. The grid lines sit under the snakes. Empty cells stay blank.

Play starts on level 1. The status line shows the level number and a one-line instruction: click a snake to send it off. A click on an empty cell does nothing. A failed release plays a short bump along the snake’s facing direction and returns it to its cells. A successful release locks input for that snake while it steps forward one cell per frame. Other snakes can still be clicked during that move. When the tail leaves the board, the snake is gone. Clearing the last snake replaces the instruction with a clear message and a button for the next level. The last level’s button reads “Play again” and returns to level 1. There is no undo.

Five handmade levels ship in one TypeScript file, in order. The first is a 4×4 board with two snakes that do not block each other, so either click wins. Later levels add a bend, a snake that must leave before the one behind it, and one board where the obvious snake is blocked until another leaves. Each level is small enough to read in one look. Restarting the page returns to level 1. Progress is not saved.

## Failures and tests

A level that fails validation does not start. The load error names the level and the broken rule. A click that misses every snake is ignored. A blocked release leaves the board data unchanged after the bump animation. A snake that is already leaving ignores further clicks. Resizing the window redraws the same board at the new cell size and does not reset the level.

Rules are tested with Vitest, without a browser. The tests cover a clear path, a blocked path, a snake that can leave only after another snake leaves, a win when the last snake is removed, and each invalid-level rule. Animation and hit-testing are checked by playing the five levels in the browser.
