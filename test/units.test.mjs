import assert from 'node:assert/strict';
import { createBoard, placeUnit, setTerrain } from '../js/board.js';
import { moveAction, pushAction, attackAction, holdAction, UNIT_TYPES } from '../js/units.js';

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

check('moveAction moves a unit one tile and returns ok:true', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 2, y: 2, hp: 4 });
  const result = moveAction(board, 'p1', 2, 3);
  assert.equal(result.ok, true);
  const u = result.board.units.find((u) => u.id === 'p1');
  assert.equal(u.x, 2);
  assert.equal(u.y, 3);
});

check('moveAction rejects a move beyond the unit\'s moveRange', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 2, y: 2, hp: 4 });
  const result = moveAction(board, 'p1', 2, 5);
  assert.equal(result.ok, false);
});

check('moveAction rejects moving onto an occupied tile', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 2, y: 2, hp: 4 });
  board = placeUnit(board, { id: 'p2', side: 'player', type: 'ram', x: 2, y: 3, hp: 3 });
  const result = moveAction(board, 'p1', 2, 3);
  assert.equal(result.ok, false);
});

check('moveAction rejects moving onto a hazard tile', () => {
  let board = createBoard();
  board = setTerrain(board, 2, 3, 'hazard');
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 2, y: 2, hp: 4 });
  const result = moveAction(board, 'p1', 2, 3);
  assert.equal(result.ok, false);
});

check('pushAction moves a pushed enemy one further tile in the same direction when the destination is free', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'ram', x: 2, y: 2, hp: 3 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 3, y: 2, hp: 2 });
  const result = pushAction(board, 'p1', 3, 2);
  assert.equal(result.ok, true);
  const enemy = result.board.units.find((u) => u.id === 'e1');
  assert.equal(enemy.x, 4);
  assert.equal(enemy.y, 2);
  assert.equal(enemy.hp, 2, 'no damage when the push succeeds');
});

check('pushAction damages the enemy instead of moving it when the destination tile is blocked', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'ram', x: 2, y: 2, hp: 3 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 3, y: 2, hp: 2 });
  board = placeUnit(board, { id: 'e2', side: 'enemy', type: 'crawler', x: 4, y: 2, hp: 2 }); // blocks the push destination
  const result = pushAction(board, 'p1', 3, 2);
  assert.equal(result.ok, true);
  const pushed = result.board.units.find((u) => u.id === 'e1');
  assert.equal(pushed.x, 3, 'stayed in place, took damage instead');
  assert.equal(pushed.y, 2);
  assert.equal(pushed.hp, 2 - UNIT_TYPES.ram.pushDamage);
});

check('pushAction damages the enemy when pushed off the edge of the board', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'ram', x: 4, y: 2, hp: 3 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 5, y: 2, hp: 2 }); // edge of 6x6 board
  const result = pushAction(board, 'p1', 5, 2);
  assert.equal(result.ok, true);
  const pushed = result.board.units.find((u) => u.id === 'e1');
  assert.equal(pushed.x, 5, 'cannot be pushed off-board, stays put');
  assert.equal(pushed.hp, 2 - UNIT_TYPES.ram.pushDamage);
});

check('pushAction removes the enemy from the board when the push damage kills it', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'ram', x: 4, y: 2, hp: 3 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 5, y: 2, hp: 1 }); // dies to 1 push damage
  const result = pushAction(board, 'p1', 5, 2);
  assert.equal(result.ok, true);
  assert.equal(result.board.units.find((u) => u.id === 'e1'), undefined);
});

check('pushAction rejects a non-adjacent target', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'ram', x: 0, y: 0, hp: 3 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 3, y: 3, hp: 2 });
  const result = pushAction(board, 'p1', 3, 3);
  assert.equal(result.ok, false);
});

check('pushAction rejects when unit is not a ram', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 2, y: 2, hp: 4 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 3, y: 2, hp: 2 });
  const result = pushAction(board, 'p1', 3, 2);
  assert.equal(result.ok, false);
});

check('attackAction deals damage to an enemy in a straight line within range', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 3, y: 0, hp: 2 });
  const result = attackAction(board, 'p1', 3, 0);
  assert.equal(result.ok, true);
  const enemy = result.board.units.find((u) => u.id === 'e1');
  assert.equal(enemy.hp, 2 - UNIT_TYPES.striker.attackDamage);
});

check('attackAction rejects a target beyond attackRange', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  const result = attackAction(board, 'p1', 5, 0); // distance 5, range is 3
  assert.equal(result.ok, false);
});

check('attackAction rejects a diagonal target (must be a straight line)', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  const result = attackAction(board, 'p1', 2, 2);
  assert.equal(result.ok, false);
});

check('attackAction rejects when line of fire is blocked by another unit', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  board = placeUnit(board, { id: 'blocker', side: 'player', type: 'bulwark', x: 1, y: 0, hp: 4 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 2, y: 0, hp: 2 });
  const result = attackAction(board, 'p1', 2, 0);
  assert.equal(result.ok, false);
});

check('attackAction rejects when line of fire is blocked by a hazard tile', () => {
  let board = createBoard();
  board = setTerrain(board, 1, 0, 'hazard');
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  const result = attackAction(board, 'p1', 2, 0);
  assert.equal(result.ok, false);
});

check('attackAction removes an enemy from the board once its hp hits 0', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 0, y: 0, hp: 2 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 1, y: 0, hp: 1 }); // dies to 1 attack damage
  const result = attackAction(board, 'p1', 1, 0);
  assert.equal(result.ok, true);
  assert.equal(result.board.units.find((u) => u.id === 'e1'), undefined);
});

check('attackAction rejects when unit is not a striker', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 0, y: 0, hp: 4 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 1, y: 0, hp: 2 });
  const result = attackAction(board, 'p1', 1, 0);
  assert.equal(result.ok, false);
});

check('holdAction is a no-op that always succeeds for a living unit', () => {
  let board = createBoard();
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 0, y: 0, hp: 4 });
  const result = holdAction(board, 'p1');
  assert.equal(result.ok, true);
  assert.deepEqual(result.board, board);
});

console.log(`\n${passed} check(s) passed.`);
if (process.exitCode) {
  console.error('\nSOME CHECKS FAILED');
  process.exit(1);
} else {
  console.log('\nALL CHECKS PASSED');
}
