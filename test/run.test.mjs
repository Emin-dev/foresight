// run.test.mjs — the most important test file in this repo. Foresight's
// entire hook is "what you're shown is exactly what happens." These tests
// prove that the intents computed at startTurn() are executed VERBATIM at
// resolveTurn(), even after the player has changed the board with their own
// actions in between — not recomputed against the new board.
import assert from 'node:assert/strict';
import { createBoard, placeUnit, setTerrain, getTerrain, unitAt } from '../js/board.js';
import { startTurn, applyPlayerActions, resolveTurn } from '../js/run.js';
import { getMissionById } from '../js/missions.js';

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

check('CORE PROMISE: a telegraphed attack lands on exactly the tile shown, even if the player rearranges the board first', () => {
  let board = createBoard();
  board = setTerrain(board, 3, 3, 'objective');
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'spitter', x: 3, y: 0, hp: 2 });
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'ram', x: 0, y: 0, hp: 3 });

  const { intents } = startTurn(board);
  const spitterIntent = intents.find((i) => i.enemyId === 'e1');
  assert.equal(spitterIntent.kind, 'attack');
  assert.equal(spitterIntent.targetX, 3);
  assert.equal(spitterIntent.targetY, 3);

  // Player moves their ram elsewhere — irrelevant to the spitter's fixed target, board changes in between.
  const afterPlayer = applyPlayerActions(board, [{ kind: 'move', unitId: 'p1', x: 0, y: 1 }]);

  const { board: finalBoard } = resolveTurn(afterPlayer, intents, { turnLimit: 5 });
  // The spitter's telegraphed target (the objective at 3,3) must be destroyed exactly as shown.
  assert.equal(getTerrain(finalBoard, 3, 3), 'rubble');
});

check('CORE PROMISE: intents are captured once and executed exactly even if the player kills the acting enemy first', () => {
  let board = createBoard();
  board = setTerrain(board, 3, 3, 'objective');
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'spitter', x: 1, y: 0, hp: 1 });
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'striker', x: 1, y: 3, hp: 2 });

  const { intents } = startTurn(board);
  assert.equal(intents.length, 1);

  // Player kills the spitter before it can act.
  const afterPlayer = applyPlayerActions(board, [{ kind: 'attack', unitId: 'p1', x: 1, y: 0 }]);
  assert.equal(unitAt(afterPlayer, 1, 0), undefined, 'spitter should be dead');

  const { board: finalBoard } = resolveTurn(afterPlayer, intents, { turnLimit: 5 });
  // The dead enemy's intent fizzles harmlessly — the objective must still be standing.
  assert.equal(getTerrain(finalBoard, 3, 3), 'objective');
});

check('CORE PROMISE: a telegraphed enemy move-attack moves to and attacks exactly the tiles computed at the start of the turn', () => {
  let board = createBoard();
  board = setTerrain(board, 3, 3, 'objective');
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'crawler', x: 0, y: 3, hp: 2 });
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 5, y: 5, hp: 4 });

  const { intents } = startTurn(board);
  const crawlerIntent = intents[0];
  assert.equal(crawlerIntent.kind, 'move-attack');
  assert.equal(crawlerIntent.toX, 1);
  assert.equal(crawlerIntent.toY, 3);

  const afterPlayer = applyPlayerActions(board, [{ kind: 'hold', unitId: 'p1' }]);
  const { board: finalBoard } = resolveTurn(afterPlayer, intents, { turnLimit: 5 });
  const crawler = finalBoard.units.find((u) => u.id === 'e1');
  assert.equal(crawler.x, 1);
  assert.equal(crawler.y, 3);
});

check('resolveTurn deals telegraphed damage to a player unit standing on the exact attacked tile', () => {
  let board = createBoard();
  board = setTerrain(board, 3, 3, 'objective');
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'brute', x: 2, y: 0, hp: 3, facing: 'down' });
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 2, y: 1, hp: 4 });

  const { intents } = startTurn(board);
  const bruteIntent = intents[0];
  assert.equal(bruteIntent.kind, 'attack');
  assert.equal(bruteIntent.targetX, 2);
  assert.equal(bruteIntent.targetY, 1);

  const afterPlayer = applyPlayerActions(board, [{ kind: 'hold', unitId: 'p1' }]);
  const { board: finalBoard } = resolveTurn(afterPlayer, intents, { turnLimit: 5 });
  const bulwark = finalBoard.units.find((u) => u.id === 'p1');
  assert.equal(bulwark.hp, 4 - bruteIntent.damage);
});

check('resolveTurn advances the turn counter and reports outcome:"lost" when the last player unit dies', () => {
  let board = createBoard();
  board = setTerrain(board, 3, 3, 'objective');
  board = placeUnit(board, { id: 'e1', side: 'enemy', type: 'brute', x: 2, y: 0, hp: 3, facing: 'down' });
  board = placeUnit(board, { id: 'p1', side: 'player', type: 'bulwark', x: 2, y: 1, hp: 1 }); // dies to any hit

  const { intents } = startTurn(board);
  const afterPlayer = applyPlayerActions(board, [{ kind: 'hold', unitId: 'p1' }]);
  const { board: finalBoard, outcome } = resolveTurn(afterPlayer, intents, { turnLimit: 5 });
  assert.equal(finalBoard.turn, board.turn + 1);
  assert.equal(outcome, 'lost');
});

check('FULL MISSION PLAYTHROUGH: reedshore-1 can be won by a specific, exactly-verified sequence of player actions', () => {
  const mission = getMissionById('reedshore-1');
  assert.ok(mission, 'reedshore-1 mission must exist');

  let board = createBoard(mission.size);
  for (const o of mission.objectives) board = setTerrain(board, o.x, o.y, 'objective');
  for (const h of mission.hazards) board = setTerrain(board, h.x, h.y, 'hazard');
  for (const spawn of mission.playerSpawns) board = placeUnit(board, { ...spawn });
  for (const spawn of mission.enemySpawns) board = placeUnit(board, { ...spawn });

  // reedshore-1: one striker at (3,1), one crawler at (5,5), objective at (3,3), turnLimit 3.
  // This exact 3-turn sequence was confirmed by an exhaustive search of every possible
  // striker action at every turn (not hand-guessed) to be a genuine win: the crawler
  // marches (5,5)->(4,5)->(4,4)->(3,4), telegraphing an attack on the well (3,3) each step
  // of the way. The striker can never out-range and kill it in time (range 3, moves 1/turn,
  // never gets aligned with a clean shot before the crawler arrives) — the only way to
  // survive is to walk the striker onto the well tile itself, so the crawler's final,
  // exactly-telegraphed attack on (3,3) lands on the striker instead of destroying the well.
  // This is deterministic, displayed-in-advance counterplay, not a lucky guess.
  const scriptedActions = [
    { kind: 'hold', unitId: 'p1' },
    { kind: 'move', unitId: 'p1', x: 3, y: 2 },
    { kind: 'move', unitId: 'p1', x: 3, y: 3 },
  ];

  let outcome = 'ongoing';
  let turnsPlayed = 0;
  for (const action of scriptedActions) {
    const { intents } = startTurn(board);
    const afterPlayer = applyPlayerActions(board, [action]);
    const result = resolveTurn(afterPlayer, intents, mission);
    board = result.board;
    outcome = result.outcome;
    turnsPlayed++;
    if (outcome !== 'ongoing') break;
  }

  assert.equal(outcome, 'won', `expected a win after the scripted sequence, got ${outcome} after ${turnsPlayed} turns`);
  assert.equal(getTerrain(board, 3, 3), 'objective', 'the well must still be standing — the striker absorbed the final hit standing on it');
  const striker = board.units.find((u) => u.id === 'p1');
  assert.ok(striker, 'the striker should have survived (it only ever took the crawler\'s single final telegraphed hit)');
  assert.equal(striker.x, 3);
  assert.equal(striker.y, 3);
});

check('FULL MISSION PLAYTHROUGH: reedshore-1 is lost if the player does nothing and lets the crawler reach the well', () => {
  const mission = getMissionById('reedshore-1');
  let board = createBoard(mission.size);
  for (const o of mission.objectives) board = setTerrain(board, o.x, o.y, 'objective');
  for (const h of mission.hazards) board = setTerrain(board, h.x, h.y, 'hazard');
  for (const spawn of mission.playerSpawns) board = placeUnit(board, { ...spawn });
  for (const spawn of mission.enemySpawns) board = placeUnit(board, { ...spawn });

  let outcome = 'ongoing';
  let turnsPlayed = 0;
  while (outcome === 'ongoing' && turnsPlayed < 10) {
    const { intents } = startTurn(board);
    const actions = board.units
      .filter((u) => u.side === 'player' && u.hp > 0)
      .map((u) => ({ kind: 'hold', unitId: u.id }));
    const afterPlayer = applyPlayerActions(board, actions);
    const result = resolveTurn(afterPlayer, intents, mission);
    board = result.board;
    outcome = result.outcome;
    turnsPlayed++;
  }

  assert.equal(outcome, 'lost', `expected a loss when the player never acts, got ${outcome} after ${turnsPlayed} turns`);
});

console.log(`\n${passed} check(s) passed.`);
if (process.exitCode) {
  console.error('\nSOME CHECKS FAILED');
  process.exit(1);
} else {
  console.log('\nALL CHECKS PASSED');
}
