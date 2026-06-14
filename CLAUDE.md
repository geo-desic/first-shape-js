# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source control

Do **not** perform any commits, pushes, or other write operations to source control (git) for this repository. Make changes to files in the working tree only — all changes are manually reviewed and committed by the maintainer.

## Overview

"First Shape" is a static, dependency-free browser app implementing board games (Tic Tac Toe variants) whose AIs are powered entirely by pre-trained TensorFlow.js neural networks. There is no build step, no package manager, and no test suite — it is plain HTML + vanilla JS served as static files. TensorFlow.js is loaded from a CDN in `index.html`. Hosted via GitHub Pages.

"First Shape" is a generic term for any board game where each player has one unique piece type, pieces are never moved/removed once played, and the goal is to be the first to form a winning shape (or in the *misere* version, to avoid forming one).

## Running / Developing

There is no build or test command. Serve the repo root as static files with `index.html` as the default page, e.g.:

```
python -m http.server 8000
```

A real HTTP server is required (not `file://`) because the models are fetched over HTTP via `tf.loadGraphModel`.

To verify changes, open the page and play; check the browser console for model-loading errors logged by `loadModelAsync`.

## Architecture

Two layers, loaded in order by `index.html`:

1. **`first_shape.js` — pure game engine, no DOM, no AI.** Defines the game model:
   - `FsShape` and subclasses (`FsLineHorizontal`, `FsLineVertical`, `FsLineDiagonal1` `\`, `FsLineDiagonal2` `/`, `FsSquare`) describe winning shapes as boolean grids.
   - `FsBoard` / `FsLocation` represent the board.
   - `FsGame` is the rules engine. Its constructor pre-computes every `FsEndCondition` (a concrete placement of a shape on the board) and links each board location to the end conditions it participates in. `move()` then updates fill counts incrementally rather than rescanning the board. `state` is `-1` in progress, `0` draw, `1`/`2` winner. In misere mode the player who *completes* a shape loses, so the winner is the other player.

2. **`script.js` — AI + DOM glue.** Depends on `first_shape.js` and the global `tf`.
   - An IIFE at the bottom registers the four `ModelDetails` (game type × misere) with their model paths and input sizes, loads them async, wires up UI events, and starts a game.
   - `Game` maps a UI game-type string (`"3x3l"`, `"4x4ls"`) to a configured `FsGame` plus optional `AiPlayer`s.
   - `AiPlayer.move()` is the core AI: for every valid move it fills the candidate into the model input array, runs `model.predict`, and collects scores. It then keeps all moves within `EVALUATION_EPSILON` of the best score and picks one at random (so play stays strong but non-deterministic).
   - `newGame()` renders the board into `#board_container` as a CSS Grid of `<button class="fs-cell">` elements (one per location), setting the `--cols` custom property on the container so the same CSS handles 3x3 and 4x4. Each cell keeps `id = LOCATION_ID_PREFIX + r + "_" + c`, `data-row`/`data-column`, and a click listener; the rest of the code finds cells by that id and toggles `win`/`loss` classes. Cells are `disabled` once filled.

## Key conventions and gotchas

- **Model input encoding (`boardToModelInputArray`):** input length is *twice* the board size. The first half is a one-hot of player 1's pieces, the second half is player 2's. When evaluating a move for player 2, the candidate index is offset by `board.size()`.
- **Scores are always from player 1's perspective.** For player 2, the prediction is negated before comparison. Higher score = better for the side to move after negation.
- **Only the 3x3 models are perfect predictors** (max absolute error < 0.5), so their raw predictions are rounded to the nearest integer in `AiPlayer.move()`. The 4x4 models are strong but not perfect and are used un-rounded. Don't add rounding for `4x4ls` without re-checking model error.
- **Score magnitude encodes speed-to-finish:** for a leaf state, `|score| = N` where `N-1` is the number of empty locations, so the AI prefers winning (or stalling a loss) in fewer moves, not just winning. See README for the full scoring definition.
- **Adding a game type** requires changes in three places that must stay in sync: the `<select id="game_type">` options in `index.html`, the `gameType` branch in the `Game` constructor (`script.js`), and a `ModelDetails` registration in the bottom IIFE — plus a model directory under `models/`.
- `refreshSupportedAiConfigurations()` disables the AI checkboxes when no model exists for the selected game-type/misere combination.

## Models

`models/<name>/` each contain a TensorFlow.js **graph** model (`model.json` + `group1-shard*.bin`). Naming: `fs-<board>-<shapes>[-m]`, e.g. `fs-3x3-l` (3x3, lines), `fs-4x4-ls` (4x4, lines + squares), trailing `-m` = misere. The Keras source models and training datasets are not in this repo — they live in the separate `geo-desic/public-data` repo under `first-shape/`.
