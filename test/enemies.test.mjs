import assert from 'node:assert/strict';
import { createBoard, placeUnit, setTerrain } from '../js/board.js';
import { computeIntent, computeAllIntents, ENEMY_TYPES } from '../js/enemies.js';

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

function baseBoard() {
  let board = createBoard();
  board = setTerrain(board, 3, 3, 'objective');
  return board;
}

check('computeIntent is deterministic: same board+enemy always yields a deep-equal intent', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 0, y: 0, hp: 2 });
  const enemy = board.units[0];
  const intent1 = computeIntent(board, enemy);
  const intent2 = computeIntent(board, enemy);
  assert.deepEqual(intent1, intent2);
  // Also true across many repeated calls, not just twice.
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(computeIntent(board, enemy), intent1);
  }
});

check('crawler moves one step toward the nearest objective when not adjacent', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 0, y: 3, hp: 2 });
  const enemy = board.units[0];
  const intent = computeIntent(board, enemy);
  assert.equal(intent.kind, 'move-attack');
  // moving from (0,3) toward (3,3): dx=3,dy=0 -> step is (1,3)
  assert.equal(intent.toX, 1);
  assert.equal(intent.toY, 3);
});

check('crawler attacks without moving once already adjacent to its target objective', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 2, y: 3, hp: 2 });
  const enemy = board.units[0];
  const intent = computeIntent(board, enemy);
  assert.equal(intent.kind, 'attack');
  assert.equal(intent.toX, 2);
  assert.equal(intent.toY, 3);
  assert.equal(intent.targetX, 3);
  assert.equal(intent.targetY, 3);
  assert.equal(intent.damage, ENEMY_TYPES.crawler.damage);
});

check('crawler with no objectives on the board returns a "wait" intent rather than crashing', () => {
  let board = createBoard(); // no objective set
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 0, y: 0, hp: 2 });
  const intent = computeIntent(board, board.units[0]);
  assert.equal(intent.kind, 'wait');
});

check('brute always attacks the tile directly ahead in its fixed facing direction', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'brute', x: 3, y: 0, hp: 3, facing: 'down' });
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 3, y: 1, hp: 4 });
  const enemy = board.units.find((u) => u.id === 'e1');
  const intent = computeIntent(board, enemy);
  assert.equal(intent.kind, 'attack');
  assert.equal(intent.targetX, 3);
  assert.equal(intent.targetY, 1);
});

check('brute advances into an empty tile ahead and telegraphs the tile beyond that as its next attack', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'brute', x: 3, y: 0, hp: 3, facing: 'down' });
  const enemy = board.units[0];
  const intent = computeIntent(board, enemy);
  assert.equal(intent.kind, 'move-attack');
  assert.equal(intent.toX, 3);
  assert.equal(intent.toY, 1);
  assert.equal(intent.targetX, 3);
  assert.equal(intent.targetY, 2);
});

check('brute facing off the edge of the board returns "wait" instead of throwing', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'brute', x: 3, y: 0, hp: 3, facing: 'up' });
  const enemy = board.units[0];
  const intent = computeIntent(board, enemy);
  assert.equal(intent.kind, 'wait');
});

check('spitter never moves and always targets the nearest objective at range', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'spitter', x: 3, y: 0, hp: 2 });
  const enemy = board.units[0];
  const intent = computeIntent(board, enemy);
  assert.equal(intent.kind, 'attack');
  assert.equal(intent.toX, 3);
  assert.equal(intent.toY, 0);
  assert.equal(intent.targetX, 3);
  assert.equal(intent.targetY, 3);
});

check('computeAllIntents returns intents in a stable order (sorted by unit id) and skips dead enemies', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e2', side: 'enemy', type: 'crawler', x: 5, y: 5, hp: 2 });
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 0, y: 0, hp: 2 });
  board = placeUnit(board, { id: 'e3', side: 'enemy', type: 'crawler', x: 5, y: 0, hp: 0 }); // dead
  const intents = computeAllIntents(board);
  assert.equal(intents.length, 2);
  assert.deepEqual(intents.map((i) => i.enemyId), ['e1', 'e2']);
});

check('two different enemies in the same board state each get their own correct, independent intent', () => {
  let board = baseBoard();
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 0, y: 3, hp: 2 });
  board = placeUnit(board, { id: 'e2', side: 'enemy', type: 'spitter', x: 3, y: 5, hp: 2 });
  const intents = computeAllIntents(board);
  const crawlerIntent = intents.find((i) => i.enemyId === 'e1');
  const spitterIntent = intents.find((i) => i.enemyId === 'e2');
  assert.equal(crawlerIntent.kind, 'move-attack');
  assert.equal(spitterIntent.kind, 'attack');
  assert.equal(spitterIntent.toX, 3);
  assert.equal(spitterIntent.toY, 5);
});

console.log(`\n${passed} check(s) passed.`);
if (process.exitCode) {
  console.error('\nSOME CHECKS FAILED');
  process.exit(1);
} else {
  console.log('\nALL CHECKS PASSED');
}
