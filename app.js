(() => {
  "use strict";

  const STORAGE_KEY = "kiban-sudoku-state-v1";
  const DIFFICULTY_CLUES = { easy: 38, medium: 32, hard: 27, expert: 23 };
  const MAX_MISTAKES = 3;

  // ---------------- Solver / Generator (bitmask backtracking) ----------------

  function emptyBoard() { return new Array(81).fill(0); }

  function boxIndex(r, c) { return Math.floor(r / 3) * 3 + Math.floor(c / 3); }

  // Counts solutions up to `limit`, filling `board` in place with the first solution found.
  function solve(board, limit = 1) {
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);
    const cells = [];

    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      if (board[i] !== 0) {
        const bit = 1 << (board[i] - 1);
        rows[r] |= bit; cols[c] |= bit; boxes[boxIndex(r, c)] |= bit;
      } else {
        cells.push(i);
      }
    }

    let solutions = 0;
    let firstSolution = null;

    function backtrack() {
      if (solutions >= limit) return;

      // Find most-constrained empty cell
      let bestIdx = -1, bestMask = 0, bestCount = 10;
      for (const i of cells) {
        if (board[i] !== 0) continue;
        const r = Math.floor(i / 9), c = i % 9;
        const used = rows[r] | cols[c] | boxes[boxIndex(r, c)];
        const avail = (~used) & 0x1FF;
        const count = popcount(avail);
        if (count === 0) return; // dead end
        if (count < bestCount) { bestCount = count; bestIdx = i; bestMask = avail; if (count === 1) break; }
      }

      if (bestIdx === -1) {
        solutions++;
        if (!firstSolution) firstSolution = board.slice();
        return;
      }

      const r = Math.floor(bestIdx / 9), c = bestIdx % 9, b = boxIndex(r, c);
      let mask = bestMask;
      while (mask) {
        const bit = mask & (-mask);
        mask ^= bit;
        const val = Math.log2(bit) + 1;
        board[bestIdx] = val;
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        backtrack();
        rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;
        if (solutions >= limit) { board[bestIdx] = 0; return; }
      }
      board[bestIdx] = 0;
    }

    backtrack();
    if (firstSolution) board.splice(0, 81, ...firstSolution);
    return solutions;
  }

  function popcount(n) {
    let c = 0;
    while (n) { n &= n - 1; c++; }
    return c;
  }

  function shuffledDigits() {
    const arr = [1,2,3,4,5,6,7,8,9];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function generateSolvedGrid() {
    const board = emptyBoard();
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);

    function fill(pos) {
      if (pos === 81) return true;
      const r = Math.floor(pos / 9), c = pos % 9, b = boxIndex(r, c);
      const used = rows[r] | cols[c] | boxes[b];
      const digits = shuffledDigits();
      for (const val of digits) {
        const bit = 1 << (val - 1);
        if (used & bit) continue;
        board[pos] = val;
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        if (fill(pos + 1)) return true;
        rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;
        board[pos] = 0;
      }
      return false;
    }
    fill(0);
    return board;
  }

  function generatePuzzle(clueCount) {
    const solution = generateSolvedGrid();
    const puzzle = solution.slice();
    const order = [...Array(81).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    let clues = 81;
    for (const idx of order) {
      if (clues <= clueCount) break;
      const backup = puzzle[idx];
      puzzle[idx] = 0;
      const testBoard = puzzle.slice();
      const count = solve(testBoard, 2);
      if (count === 1) {
        clues--;
      } else {
        puzzle[idx] = backup;
      }
    }
    return { puzzle, solution };
  }

  // ---------------- Game State ----------------

  let state = null;
  let selected = -1;
  let notesMode = false;
  let timerHandle = null;

  function newGame(difficulty) {
    const { puzzle, solution } = generatePuzzle(DIFFICULTY_CLUES[difficulty]);
    state = {
      difficulty,
      puzzle,
      solution,
      entries: puzzle.slice(),
      given: puzzle.map(v => v !== 0),
      notes: Array.from({ length: 81 }, () => []),
      elapsed: 0,
      mistakes: 0,
      history: [],
      completed: false
    };
    selected = -1;
    save();
    renderAll();
    startTimer();
  }

  function save() {
    if (!state) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      state = JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  }

  function startTimer() {
    clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      if (state.completed) return;
      state.elapsed++;
      renderTimer();
      if (state.elapsed % 5 === 0) save();
    }, 1000);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  // ---------------- Rendering ----------------

  const boardEl = document.getElementById("board");
  const timerEl = document.getElementById("timer");
  const mistakesEl = document.getElementById("mistakes");
  const winOverlay = document.getElementById("winOverlay");
  const winTimeEl = document.getElementById("winTime");
  const winEyebrow = winOverlay.querySelector(".win-eyebrow");

  function buildBoardDom() {
    boardEl.innerHTML = "";
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = i;
      if ((r + 1) % 3 === 0 && r !== 8) cell.classList.add("box-row-end");
      cell.addEventListener("click", () => selectCell(i));
      const notesDiv = document.createElement("div");
      notesDiv.className = "notes";
      for (let n = 1; n <= 9; n++) {
        const span = document.createElement("span");
        notesDiv.appendChild(span);
      }
      const valueSpan = document.createElement("span");
      valueSpan.className = "value";
      cell.appendChild(valueSpan);
      cell.appendChild(notesDiv);
      boardEl.appendChild(cell);
    }
  }

  function renderAll() {
    renderBoard();
    renderTimer();
    renderMistakes();
    renderDifficultyTabs();
    winOverlay.hidden = true;
  }

  function renderTimer() { timerEl.textContent = formatTime(state.elapsed); }

  function renderMistakes() {
    mistakesEl.textContent = `${state.mistakes}/${MAX_MISTAKES}`;
    mistakesEl.classList.toggle("warn", state.mistakes >= MAX_MISTAKES - 1);
  }

  function renderDifficultyTabs() {
    document.querySelectorAll("#difficulty button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.level === state.difficulty);
    });
  }

  function renderBoard() {
    const selRow = selected >= 0 ? Math.floor(selected / 9) : -1;
    const selCol = selected >= 0 ? selected % 9 : -1;
    const selBox = selected >= 0 ? boxIndex(selRow, selCol) : -1;
    const selVal = selected >= 0 ? state.entries[selected] : 0;

    for (let i = 0; i < 81; i++) {
      const cellEl = boardEl.children[i];
      const r = Math.floor(i / 9), c = i % 9;
      const val = state.entries[i];
      const valueSpan = cellEl.querySelector(".value");
      const notesDiv = cellEl.querySelector(".notes");

      cellEl.classList.remove("given", "entered", "error", "selected", "peer", "same-value");

      if (val !== 0) {
        valueSpan.textContent = val;
        notesDiv.style.display = "none";
        if (state.given[i]) {
          cellEl.classList.add("given");
        } else {
          cellEl.classList.add("entered");
          if (val !== state.solution[i]) cellEl.classList.add("error");
        }
      } else {
        valueSpan.textContent = "";
        const noteSet = state.notes[i];
        notesDiv.style.display = noteSet.length ? "grid" : "none";
        for (let n = 1; n <= 9; n++) {
          notesDiv.children[n - 1].textContent = noteSet.includes(n) ? n : "";
        }
      }

      if (selected >= 0) {
        const box = boxIndex(r, c);
        if (i === selected) {
          cellEl.classList.add("selected");
        } else if (r === selRow || c === selCol || box === selBox) {
          cellEl.classList.add("peer");
        }
        if (selVal !== 0 && val === selVal) cellEl.classList.add("same-value");
      }
    }
    renderNumpadDepletion();
  }

  function renderNumpadDepletion() {
    const counts = new Array(10).fill(0);
    for (const v of state.entries) if (v !== 0) counts[v]++;
    document.querySelectorAll(".num").forEach(btn => {
      const n = Number(btn.dataset.num);
      btn.classList.toggle("depleted", counts[n] >= 9);
    });
  }

  function selectCell(i) {
    selected = i;
    renderBoard();
  }

  // ---------------- Actions ----------------

  function pushHistory(index, prevValue, prevNotes) {
    state.history.push({ index, prevValue, prevNotes: prevNotes.slice() });
    if (state.history.length > 200) state.history.shift();
  }

  function placeDigit(digit) {
    if (selected < 0 || state.given[selected] || state.completed) return;
    const i = selected;

    if (notesMode) {
      pushHistory(i, state.entries[i], state.notes[i]);
      const set = state.notes[i];
      const pos = set.indexOf(digit);
      if (pos >= 0) set.splice(pos, 1); else set.push(digit);
      renderBoard();
      save();
      return;
    }

    pushHistory(i, state.entries[i], state.notes[i]);
    state.entries[i] = digit;
    state.notes[i] = [];

    if (digit !== state.solution[i]) {
      state.mistakes++;
      const cellEl = boardEl.children[i];
      cellEl.classList.add("error-flash");
      setTimeout(() => cellEl.classList.remove("error-flash"), 350);
      renderMistakes();
      if (state.mistakes >= MAX_MISTAKES) {
        renderBoard();
        save();
        endGame(false);
        return;
      }
    }

    renderBoard();
    save();
    checkWin();
  }

  function eraseCell() {
    if (selected < 0 || state.given[selected] || state.completed) return;
    const i = selected;
    if (state.entries[i] === 0 && state.notes[i].length === 0) return;
    pushHistory(i, state.entries[i], state.notes[i]);
    state.entries[i] = 0;
    state.notes[i] = [];
    renderBoard();
    save();
  }

  function undo() {
    if (state.history.length === 0 || state.completed) return;
    const move = state.history.pop();
    state.entries[move.index] = move.prevValue;
    state.notes[move.index] = move.prevNotes;
    selected = move.index;
    renderBoard();
    save();
  }

  function hint() {
    if (state.completed) return;
    let target = selected;
    if (target < 0 || state.given[target] || state.entries[target] === state.solution[target]) {
      const candidates = [];
      for (let i = 0; i < 81; i++) {
        if (!state.given[i] && state.entries[i] !== state.solution[i]) candidates.push(i);
      }
      if (candidates.length === 0) return;
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
    pushHistory(target, state.entries[target], state.notes[target]);
    state.entries[target] = state.solution[target];
    state.notes[target] = [];
    selected = target;
    renderBoard();
    save();
    checkWin();
  }

  function checkWin() {
    for (let i = 0; i < 81; i++) {
      if (state.entries[i] !== state.solution[i]) return;
    }
    endGame(true);
  }

  function endGame(won) {
    state.completed = true;
    clearInterval(timerHandle);
    save();
    winEyebrow.textContent = won ? "Solved" : "Out of mistakes";
    winTimeEl.textContent = won ? formatTime(state.elapsed) : "";
    winOverlay.hidden = false;
  }

  // ---------------- Input wiring ----------------

  document.getElementById("numpad").addEventListener("click", (e) => {
    const btn = e.target.closest(".num");
    if (btn) placeDigit(Number(btn.dataset.num));
  });

  document.getElementById("btnErase").addEventListener("click", eraseCell);
  document.getElementById("btnUndo").addEventListener("click", undo);
  document.getElementById("btnHint").addEventListener("click", hint);
  document.getElementById("btnNew").addEventListener("click", () => newGame(state.difficulty));
  document.getElementById("winNewGame").addEventListener("click", () => newGame(state.difficulty));

  document.getElementById("btnNotes").addEventListener("click", (e) => {
    notesMode = !notesMode;
    e.currentTarget.classList.toggle("on", notesMode);
  });

  document.getElementById("difficulty").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    newGame(btn.dataset.level);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key >= "1" && e.key <= "9") placeDigit(Number(e.key));
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") eraseCell();
    else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (selected < 0) { selectCell(40); return; }
      let r = Math.floor(selected / 9), c = selected % 9;
      if (e.key === "ArrowUp") r = (r + 8) % 9;
      if (e.key === "ArrowDown") r = (r + 1) % 9;
      if (e.key === "ArrowLeft") c = (c + 8) % 9;
      if (e.key === "ArrowRight") c = (c + 1) % 9;
      selectCell(r * 9 + c);
      e.preventDefault();
    }
  });

  // ---------------- Boot ----------------

  buildBoardDom();

  if (load() && state && !state.completed) {
    renderAll();
    startTimer();
  } else {
    newGame("medium");
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
