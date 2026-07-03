// units.js — player unit type definitions + pure action-resolution logic.
// Every resolver takes a board + an action descriptor and returns a NEW
// board reflecting the result. No randomness, no external state — same
// inputs always produce the same output board.

import { inBounds, isTileFree, unitAt, moveUnit, damageUnit, cloneBoard, getTerrain } from './board.js';

export const UNIT_TYPES = {
  bulwark: {
    name: 'Bulwark',
    hp: 4,
    description: 'A slow, sturdy blocker. Moves one tile, or holds a tile that enemies cannot pass through or occupy. Deals no damage.',
    moveRange: 1,
    canAttack: false,
  },
  ram: {
    name: 'Ram',
    hp: 3,
    description: 'Pushes an adjacent enemy back one tile. If the pushed enemy hits another unit or a hazard tile, it takes damage instead of moving.',
    moveRange: 1,
    pushDamage: 1,
    canAttack: true,
  },
  striker: {
    name: 'Striker',
    hp: 2,
    description: 'Deals direct damage to a target in a straight line, up to 3 tiles away, with nothing blocking between.',
    moveRange: 1,
    attackRange: 3,
    attackDamage: 1,
    canAttack: true,
  },
};

function clampNewBoardAfterKill(board) {
  // Remove any unit reduced to 0 HP as an immediate consequence of this action.
  const next = cloneBoard(board);
  next.units = next.units.filter((u) => u.hp > 0);
  return next;
}

/**
 * Move a player unit by id to an adjacent free tile (orthogonal, within moveRange).
 * Returns { board, ok, reason }.
 */
export function moveAction(board, unitId, toX, toY) {
  const unit = board.units.find((u) => u.id === unitId);
  if (!unit || unit.hp <= 0) return { board, ok: false, reason: 'Unit not found.' };
  const type = UNIT_TYPES[unit.type];
  const dist = Math.abs(unit.x - toX) + Math.abs(unit.y - toY);
  if (dist === 0) return { board, ok: false, reason: 'Already there.' };
  if (dist > type.moveRange) return { board, ok: false, reason: 'Too far to move in one turn.' };
  if (!inBounds(toX, toY, board.size)) return { board, ok: false, reason: 'Out of bounds.' };
  if (!isTileFree(board, toX, toY)) return { board, ok: false, reason: 'Tile is occupied or a hazard.' };
  return { board: moveUnit(board, unitId, toX, toY), ok: true };
}

/**
 * Ram push: unitId (a 'ram') pushes whatever enemy occupies an adjacent
 * tile (targetX,targetY) one tile further in the same direction. If the
 * destination tile is blocked (another unit, hazard, or off-board), the
 * pushed enemy takes pushDamage instead of moving.
 */
export function pushAction(board, unitId, targetX, targetY) {
  const unit = board.units.find((u) => u.id === unitId);
  if (!unit || unit.hp <= 0) return { board, ok: false, reason: 'Unit not found.' };
  if (unit.type !== 'ram') return { board, ok: false, reason: 'Only the Ram can push.' };
  const dist = Math.abs(unit.x - targetX) + Math.abs(unit.y - targetY);
  if (dist !== 1) return { board, ok: false, reason: 'Push target must be adjacent.' };

  const target = unitAt(board, targetX, targetY);
  if (!target || target.side !== 'enemy') return { board, ok: false, reason: 'No enemy there to push.' };

  const dx = Math.sign(targetX - unit.x);
  const dy = Math.sign(targetY - unit.y);
  const destX = targetX + dx;
  const destY = targetY + dy;

  let next = cloneBoard(board);
  const destBlocked =
    !inBounds(destX, destY, board.size) ||
    getTerrain(next, destX, destY) === 'hazard' ||
    unitAt(next, destX, destY);

  if (destBlocked) {
    next = damageUnit(next, target.id, UNIT_TYPES.ram.pushDamage);
  } else {
    next = moveUnit(next, target.id, destX, destY);
  }
  next = clampNewBoardAfterKill(next);
  return { board: next, ok: true };
}

/**
 * Striker attack: unitId (a 'striker') hits a target tile in a straight
 * orthogonal line, within attackRange, with no blocking unit/hazard tile
 * strictly between attacker and target.
 */
export function attackAction(board, unitId, targetX, targetY) {
  const unit = board.units.find((u) => u.id === unitId);
  if (!unit || unit.hp <= 0) return { board, ok: false, reason: 'Unit not found.' };
  if (unit.type !== 'striker') return { board, ok: false, reason: 'Only the Striker can attack at range.' };

  const dx = targetX - unit.x;
  const dy = targetY - unit.y;
  if (dx !== 0 && dy !== 0) return { board, ok: false, reason: 'Striker only fires in a straight line.' };
  const dist = Math.abs(dx) + Math.abs(dy);
  if (dist === 0) return { board, ok: false, reason: 'Choose a different tile.' };
  if (dist > UNIT_TYPES.striker.attackRange) return { board, ok: false, reason: 'Out of range.' };

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  for (let i = 1; i < dist; i++) {
    const cx = unit.x + stepX * i;
    const cy = unit.y + stepY * i;
    if (getTerrain(board, cx, cy) === 'hazard' || unitAt(board, cx, cy)) {
      return { board, ok: false, reason: 'Line of fire is blocked.' };
    }
  }

  const target = unitAt(board, targetX, targetY);
  let next = board;
  if (target && target.side === 'enemy') {
    next = damageUnit(board, target.id, UNIT_TYPES.striker.attackDamage);
    next = clampNewBoardAfterKill(next);
  }
  return { board: next, ok: true };
}

/** A unit explicitly holds its position (Bulwark's primary use, but any unit may do this). */
export function holdAction(board, unitId) {
  const unit = board.units.find((u) => u.id === unitId);
  if (!unit || unit.hp <= 0) return { board, ok: false, reason: 'Unit not found.' };
  return { board, ok: true };
}
