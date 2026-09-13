export type Board2048 = number[][];

const SIZE = 4;

export function emptyBoard(): Board2048 {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function emptyCells(board: Board2048): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

export function addRandomTile(board: Board2048): Board2048 {
  const cells = emptyCells(board);
  if (cells.length === 0) return board;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const next = board.map((row) => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const values = row.filter((v) => v !== 0);
  const result: number[] = [];
  let gained = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      result.push(merged);
      gained += merged;
      i++;
    } else {
      result.push(values[i]);
    }
  }
  while (result.length < SIZE) result.push(0);
  return { row: result, gained };
}

function rotateClockwise(board: Board2048): Board2048 {
  const next = emptyBoard();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      next[c][SIZE - 1 - r] = board[r][c];
    }
  }
  return next;
}

export type Direction = "left" | "right" | "up" | "down";

export function moveBoard(board: Board2048, direction: Direction): { board: Board2048; moved: boolean; gained: number } {
  // Приводим любое направление к «сдвигу влево» через повороты — так вся логика
  // слияния плиток описывается один раз в slideRowLeft.
  let rotations = 0;
  if (direction === "up") rotations = 3;
  if (direction === "right") rotations = 2;
  if (direction === "down") rotations = 1;

  let working = board;
  for (let i = 0; i < rotations; i++) working = rotateClockwise(working);

  let gained = 0;
  const slid = working.map((row) => {
    const { row: newRow, gained: rowGained } = slideRowLeft(row);
    gained += rowGained;
    return newRow;
  });

  let result = slid;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotateClockwise(result);

  const moved = JSON.stringify(board) !== JSON.stringify(result);
  return { board: result, moved, gained };
}

export function hasWon(board: Board2048): boolean {
  return board.some((row) => row.some((v) => v >= 2048));
}

export function isGameOver(board: Board2048): boolean {
  if (emptyCells(board).length > 0) return false;
  for (const direction of ["left", "right", "up", "down"] as Direction[]) {
    if (moveBoard(board, direction).moved) return false;
  }
  return true;
}
