// run.js — orchestrates a full turn. This module is the proof of Foresight's
// core promise: enemy intents are computed from the board BEFORE the player
// acts (startTurn), and when the turn resolves (resolveTurn), each enemy
// executes EXACTLY the intent object computed earlier — never recomputed
// against the post-player-action board. What was shown is what happens.
//
// Usage pattern for a single turn:
//   let state = startTurn(board);            // { board, intents }
//   // ... UI shows state.intents to the player, player picks actions ...
//   const after = applyPlayerActions(state.board, actions); // player acts
//   const result = resolveTurn(after, state.intents, mission); // enemies execute the SAME intents
//   // result = { board, outcome }

import { computeAllIntents } from './enemies.js';
import { damageUnit, cloneBoard, moveUnit, evaluateOutcome, advanceTurn, unitAt, setTerrain } from './board.js';
import { moveAction, pushAction, attackAction, holdAction } from './units.js';

/**
 * Start a turn: compute every enemy's telegraphed intent from the CURRENT
 * board, before any player action has happened. Pure — does not mutate board.
 */
export function startTurn(board) {
  const intents = computeAllIntents(board);
  return { board, intents };
}

/**
 * Apply a list of player actions in order to a board. Each action:
 * { unitId, kind: 'move'|'push'|'attack'|'hold', x, y }
 * Returns the resulting board. Invalid actions are skipped (ok:false is
 * ignored, board unchanged for that action) — callers (UI) should validate
 * before calling so this should rarely happen in practice, but this stays
 * safe either way.
 */
export function applyPlayerActions(board, actions) {
  let current = board;
  for (const action of actions) {
    let result;
    switch (action.kind) {
      case 'move':
        result = moveAction(current, action.unitId, action.x, action.y);
        break;
      case 'push':
        result = pushAction(current, action.unitId, action.x, action.y);
        break;
      case 'attack':
        result = attackAction(current, action.unitId, action.x, action.y);
        break;
      case 'hold':
      default:
        result = holdAction(current, action.unitId);
        break;
    }
    current = result.board;
  }
  return current;
}

/**
 * Execute one previously-computed enemy intent against the CURRENT board
 * (post player-action board). The intent's move/target coordinates are used
 * exactly as computed at startTurn — this function does not recompute
 * behavior, it only checks whether the previously-telegraphed destination/
 * target tile is still valid (e.g. a unit could have moved out of a target
 * tile since the intent was shown) and applies the consequence honestly.
 */
function executeIntent(board, intent) {
  let next = board;
  const enemy = next.units.find((u) => u.id === intent.enemyId && u.hp > 0);
  if (!enemy) return next; // enemy died earlier this turn (e.g. from a player action) — intent fizzles, which is honest: it's gone, it can't act.

  if (intent.kind === 'wait') {
    return next;
  }

  // Move step (only if the telegraphed destination is still unoccupied by another unit).
  if ((intent.toX !== enemy.x || intent.toY !== enemy.y)) {
    const occupant = unitAt(next, intent.toX, intent.toY);
    if (!occupant) {
      next = moveUnit(next, enemy.id, intent.toX, intent.toY);
    }
    // If now occupied (e.g. a player unit moved into that exact tile), the
    // enemy simply holds its ground rather than silently teleporting through
    // it — still deterministic, still exactly derived from the shown intent.
  }

  if (intent.kind === 'attack' || intent.kind === 'move-attack') {
    const targetUnit = unitAt(next, intent.targetX, intent.targetY);
    if (targetUnit && targetUnit.side === 'player') {
      next = damageUnit(next, targetUnit.id, intent.damage);
    } else {
      // Check if the telegraphed target tile was an objective.
      const t = next.tiles[`${intent.targetX},${intent.targetY}`];
      if (t && t.terrain === 'objective') {
        next = setTerrain(next, intent.targetX, intent.targetY, 'rubble');
      }
    }
  }

  return next;
}

/**
 * Resolve the enemy phase: execute every previously-computed intent (in the
 * same stable order they were computed in), remove any units that hit 0 HP,
 * advance the turn counter, and evaluate the mission outcome.
 * @param {object} board - board AFTER player actions have been applied
 * @param {Array} intents - the exact intents returned by startTurn() earlier this turn
 * @param {object} mission - { turnLimit }
 */
export function resolveTurn(board, intents, mission) {
  let next = cloneBoard(board);
  for (const intent of intents) {
    next = executeIntent(next, intent);
  }
  next.units = next.units.filter((u) => u.hp > 0);
  next = advanceTurn(next);
  const outcome = evaluateOutcome(next, mission);
  return { board: next, outcome };
}
