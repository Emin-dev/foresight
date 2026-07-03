// board.js — pure grid/tile state representation for Foresight.
//
// The board is a fixed 6x6 grid (GRID_SIZE). Every function here is a pure
// function: given a board state (and possibly other plain-data arguments),
// it returns a NEW board state (or a derived value) without mutating its
// input and without touching any external/global/random state. This is what
// makes the whole game deterministic and Node-testable without a DOM.
//
// Board shape:
// {
//   size: 6,
//   tiles: { "x,y": { terrain: 'ground' | 'hazard' | 'objective' } , ... }
//   units: [ { id, side: 'player' | 'enemy', type, x, y, hp, maxHp, ... }, ... ]
//   turn: number,
// }

export const GRID_SIZE = 6;

export function key(x, y) {
  return `${x},${y}`;
}

export function inBounds(x, y, size = GRID_SIZE) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

/** Create a fresh empty board of the given size, all tiles 'ground'. */
export function createBoard(size = GRID_SIZE) {
  const tiles = {};
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      tiles[key(x, y)] = { terrain: 'ground' };
    }
  }
  return { size, tiles, units: [], turn: 1 };
}

/** Return a deep-enough clone of a board (safe to mutate the clone). */
export function cloneBoard(board) {
  const tiles = {};
  for (const k of Object.keys(board.tiles)) {
    tiles[k] = { ...board.tiles[k] };
  }
  return {
    size: board.size,
    tiles,
    units: board.units.map((u) => ({ ...u })),
    turn: board.turn,
  };
}

export function setTerrain(board, x, y, terrain) {
  const next = cloneBoard(board);
  next.tiles[key(x, y)] = { terrain };
  return next;
}

export function getTerrain(board, x, y) {
  const t = board.tiles[key(x, y)];
  return t ? t.terrain : undefined;
}

export function getObjectiveTiles(board) {
  const out = [];
  for (const k of Object.keys(board.tiles)) {
    if (board.tiles[k].terrain === 'objective') {
      const [x, y] = k.split(',').map(Number);
      out.push({ x, y });
    }
  }
  return out;
}

/** Find a unit by id. Returns undefined if not present. */
export function findUnit(board, id) {
  return board.units.find((u) => u.id === id);
}

export function unitAt(board, x, y) {
  return board.units.find((u) => u.x === x && u.y === y && u.hp > 0);
}

export function isTileFree(board, x, y) {
  if (!inBounds(x, y, board.size)) return false;
  if (getTerrain(board, x, y) === 'hazard') return false;
  return !unitAt(board, x, y);
}

/** Place a new unit onto the board. Returns a new board. Throws if occupied/out of bounds. */
export function placeUnit(board, unit) {
  if (!inBounds(unit.x, unit.y, board.size)) {
    throw new Error(`placeUnit: (${unit.x},${unit.y}) out of bounds`);
  }
  if (unitAt(board, unit.x, unit.y)) {
    throw new Error(`placeUnit: tile (${unit.x},${unit.y}) already occupied`);
  }
  const next = cloneBoard(board);
  next.units.push({ ...unit });
  return next;
}

/** Move a unit (by id) to a new tile. Returns a new board. No-op guard: caller should validate first. */
export function moveUnit(board, id, x, y) {
  const next = cloneBoard(board);
  const u = next.units.find((u) => u.id === id);
  if (!u) return next;
  u.x = x;
  u.y = y;
  return next;
}

/** Apply damage to a unit (by id). HP floors at 0. Returns a new board. */
export function damageUnit(board, id, amount) {
  const next = cloneBoard(board);
  const u = next.units.find((u) => u.id === id);
  if (!u) return next;
  u.hp = Math.max(0, u.hp - amount);
  return next;
}

/** Remove units with hp <= 0 from the board. Returns a new board. */
export function removeDead(board) {
  const next = cloneBoard(board);
  next.units = next.units.filter((u) => u.hp > 0);
  return next;
}

export function advanceTurn(board) {
  const next = cloneBoard(board);
  next.turn += 1;
  return next;
}

/**
 * Win/loss evaluation for a mission in progress.
 * @param {object} board
 * @param {object} mission - { turnLimit, objectiveMustSurvive: boolean }
 * @returns {'ongoing'|'won'|'lost'}
 *
 * Loss: any objective tile has been destroyed (terrain flips to 'rubble'
 * when an objective is destroyed — see run.js), OR all player units are dead.
 * Win: the current turn counter exceeds the mission's turnLimit while at
 * least one objective tile and at least one player unit still survive.
 */
export function evaluateOutcome(board, mission) {
  const playerAlive = board.units.some((u) => u.side === 'player' && u.hp > 0);
  if (!playerAlive) return 'lost';

  const objectiveKeys = Object.keys(board.tiles).filter(
    (k) => board.tiles[k].terrain === 'objective'
  );
  const rubbleKeys = Object.keys(board.tiles).filter(
    (k) => board.tiles[k].terrain === 'rubble'
  );
  // If mission originally had objectives and ALL of them are now rubble, it's a loss.
  const totalObjectiveTilesEver = objectiveKeys.length + rubbleKeys.length;
  if (totalObjectiveTilesEver > 0 && objectiveKeys.length === 0) {
    return 'lost';
  }

  if (board.turn > mission.turnLimit) {
    return 'won';
  }

  return 'ongoing';
}
