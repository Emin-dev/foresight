import assert from 'node:assert/strict';
import {
  GRID_SIZE, createBoard, placeUnit, moveUnit, damageUnit, removeDead,
  isTileFree, unitAt, setTerrain, getTerrain, getObjectiveTiles, evaluateOutcome,
  advanceTurn, cloneBoard, inBounds,
} from '../js/board.js';

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

check('createBoard makes a GRID_SIZE x GRID_SIZE all-ground board', () => {
  const board = createBoard();
  assert.equal(board.size, GRID_SIZE);
  assert.equal(Object.keys(board.tiles).length, GRID_SIZE * GRID_SIZE);
  assert.equal(getTerrain(board, 0, 0), 'ground');
  assert.equal(getTerrain(board, GRID_SIZE - 1, GRID_SIZE - 1), 'ground');
});

check('inBounds correctly rejects out-of-range coordinates', () => {
  assert.equal(inBounds(0, 0, 6), true);
  assert.equal(inBounds(5, 5, 6), true);
  assert.equal(inBounds(6, 0, 6), false);
  assert.equal(inBounds(-1, 0, 6), false);
});

check('placeUnit adds a unit without mutating the original board', () => {
  const board = createBoard();
  const next = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 1, y: 1, hp: 2 });
  assert.equal(board.units.length, 0, 'original board must be untouched');
  assert.equal(next.units.length, 1);
  assert.equal(next.units[0].id, 'p1');
});

check('placeUnit throws when the tile is already occupied', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 1, y: 1, hp: 2 });
  assert.throws(() => placeUnit(board, { id: 'p2', side: 'player', type: 'ram', x: 1, y: 1, hp: 3 }));
});

check('placeUnit throws when out of bounds', () => {
  const board = createBoard();
  assert.throws(() => placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 99, y: 1, hp: 2 }));
});

check('moveUnit relocates a unit by id without mutating the input board', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 1, y: 1, hp: 2 });
  const next = moveUnit(board, 'p1', 2, 2);
  assert.equal(board.units[0].x, 1, 'original board unchanged');
  assert.equal(next.units[0].x, 2);
  assert.equal(next.units[0].y, 2);
});

check('damageUnit reduces hp and floors at 0, never negative', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 1, y: 1, hp: 2 });
  let next = damageUnit(board, 'p1', 1);
  assert.equal(next.units[0].hp, 1);
  next = damageUnit(next, 'p1', 99);
  assert.equal(next.units[0].hp, 0);
});

check('removeDead filters out units at 0 hp', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 1, y: 1, hp: 0 });
  board = placeUnit(board, { id: 'p2', side: 'player', type: 'ram', x: 2, y: 2, hp: 3 });
  const next = removeDead(board);
  assert.equal(next.units.length, 1);
  assert.equal(next.units[0].id, 'p2');
});

check('isTileFree is false for hazard terrain, occupied tiles, and out-of-bounds', () => {
  let board = createBoard();
  board = setTerrain(board, 2, 2, 'hazard');
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 3, y: 3, hp: 2 });
  assert.equal(isTileFree(board, 2, 2), false);
  assert.equal(isTileFree(board, 3, 3), false);
  assert.equal(isTileFree(board, 0, 0), true);
  assert.equal(isTileFree(board, 99, 99), false);
});

check('unitAt finds a live unit at exact coordinates, ignores dead ones', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 3, y: 3, hp: 0 });
  assert.equal(unitAt(board, 3, 3), undefined);
  board = placeUnit(board, { id: 'p2', side: 'player', type: 'ram', x: 4, y: 4, hp: 3 });
  assert.equal(unitAt(board, 4, 4).id, 'p2');
});

check('getObjectiveTiles returns every tile marked as objective', () => {
  let board = createBoard();
  board = setTerrain(board, 3, 3, 'objective');
  board = setTerrain(board, 1, 1, 'objective');
  const objectives = getObjectiveTiles(board).map((o) => `${o.x},${o.y}`).sort();
  assert.deepEqual(objectives, ['1,1', '3,3']);
});

check('evaluateOutcome returns "lost" when all player units are dead', () => {
  let board = createBoard();
  board = setTerrain(board, 3, 3, 'objective');
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 0, y: 0, hp: 2 });
  board.turn = 1;
  assert.equal(evaluateOutcome(board, { turnLimit: 5 }), 'lost');
});

check('evaluateOutcome returns "lost" when every objective tile has become rubble', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  board = setTerrain(board, 3, 3, 'rubble'); // was an objective, now destroyed
  assert.equal(evaluateOutcome(board, { turnLimit: 5 }), 'lost');
});

check('evaluateOutcome returns "ongoing" mid-mission with players alive and objectives standing', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  board = setTerrain(board, 3, 3, 'objective');
  board.turn = 2;
  assert.equal(evaluateOutcome(board, { turnLimit: 5 }), 'ongoing');
});

check('evaluateOutcome returns "won" once turn exceeds turnLimit with objectives + players surviving', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  board = setTerrain(board, 3, 3, 'objective');
  board.turn = 6;
  assert.equal(evaluateOutcome(board, { turnLimit: 5 }), 'won');
});

check('advanceTurn increments turn without mutating the input board', () => {
  const board = createBoard();
  const next = advanceTurn(board);
  assert.equal(board.turn, 1);
  assert.equal(next.turn, 2);
});

check('cloneBoard produces a deep-enough copy — mutating clone tiles/units does not affect the original', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 1, y: 1, hp: 2 });
  const clone = cloneBoard(board);
  clone.tiles['0,0'].terrain = 'hazard';
  clone.units[0].hp = 0;
  assert.equal(board.tiles['0,0'].terrain, 'ground');
  assert.equal(board.units[0].hp, 2);
});

console.log(`\n${passed} check(s) passed.`);
if (process.exitCode) {
  console.error('\nSOME CHECKS FAILED');
  process.exit(1);
} else {
  console.log('\nALL CHECKS PASSED');
}
