// enemies.js — enemy type definitions + deterministic "decide next intent"
// logic. This is the heart of Foresight's honesty promise: computeIntent()
// is a pure function of (board, enemy) — same input always produces the
// same output, no randomness, no hidden state. run.js calls this BEFORE the
// player acts (so the intent can be displayed), then later executes exactly
// the intent object that was shown — see run.js's resolveEnemyIntent().
//
// An intent is a plain, fully-described plan:
// {
//   enemyId,
//   kind: 'move-attack' | 'attack' | 'wait',
//   toX, toY,          // tile the enemy will occupy after acting (same as
//                       // current x/y if it doesn't move)
//   targetX, targetY,  // tile it will attack (undefined if kind is 'wait')
//   damage,            // damage it will deal if the target tile is occupied
// }

import { inBounds, isTileFree, unitAt, getObjectiveTiles, getTerrain } from './board.js';

export const ENEMY_TYPES = {
  crawler: {
    name: 'Crawler',
    hp: 2,
    damage: 1,
    description: 'Always moves one tile toward the nearest objective, then attacks whatever tile it ends up facing.',
  },
  brute: {
    name: 'Brute',
    hp: 3,
    damage: 2,
    description: 'Always attacks the tile directly in front of it (the direction it is facing), advancing straight ahead when that tile is empty.',
  },
  spitter: {
    name: 'Spitter',
    hp: 2,
    damage: 1,
    description: 'Never moves. Fires down its row or column at the nearest aligned objective — anything standing in that line takes the hit instead, so a blocker can genuinely intercept the shot.',
  },
};

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** Find the nearest objective tile to (x,y). Deterministic tie-break: lowest y, then lowest x. */
function nearestObjective(board, x, y) {
  const objectives = getObjectiveTiles(board);
  if (objectives.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const o of objectives) {
    const d = manhattan(x, y, o.x, o.y);
    if (d < bestDist || (d === bestDist && best && (o.y < best.y || (o.y === best.y && o.x < best.x)))) {
      best = o;
      bestDist = d;
    }
  }
  return best;
}

/** One deterministic step from (x,y) toward (tx,ty): prefer reducing the larger axis gap; tie-break horizontal-first. */
function stepToward(x, y, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  if (dx === 0 && dy === 0) return { x, y };
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: x + Math.sign(dx), y };
  }
  return { x, y: y + Math.sign(dy) };
}

function crawlerIntent(board, enemy) {
  const target = nearestObjective(board, enemy.x, enemy.y);
  if (!target) {
    return { enemyId: enemy.id, kind: 'wait', toX: enemy.x, toY: enemy.y };
  }
  // Already adjacent (or on top of, which shouldn't happen) — attack without moving.
  if (manhattan(enemy.x, enemy.y, target.x, target.y) <= 1) {
    return {
      enemyId: enemy.id,
      kind: 'attack',
      toX: enemy.x,
      toY: enemy.y,
      targetX: target.x,
      targetY: target.y,
      damage: ENEMY_TYPES.crawler.damage,
    };
  }
  const step = stepToward(enemy.x, enemy.y, target.x, target.y);
  const blocked = !isTileFree(board, step.x, step.y) && !(step.x === enemy.x && step.y === enemy.y);
  const dest = blocked ? { x: enemy.x, y: enemy.y } : step;
  // After moving, attack the tile that is now adjacent in the direction of travel.
  const faceX = dest.x + Math.sign(target.x - dest.x === 0 ? 0 : target.x - dest.x);
  const attackStep = stepToward(dest.x, dest.y, target.x, target.y);
  return {
    enemyId: enemy.id,
    kind: 'move-attack',
    toX: dest.x,
    toY: dest.y,
    targetX: attackStep.x,
    targetY: attackStep.y,
    damage: ENEMY_TYPES.crawler.damage,
  };
}

function bruteIntent(board, enemy) {
  // Brute has a fixed facing direction (enemy.facing: 'up'|'down'|'left'|'right'),
  // set at spawn time in mission data. It always attacks the tile directly ahead,
  // advancing into that tile first if it's empty ground.
  const dir = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } }[enemy.facing || 'down'];
  const aheadX = enemy.x + dir.dx;
  const aheadY = enemy.y + dir.dy;

  if (!inBounds(aheadX, aheadY, board.size)) {
    return { enemyId: enemy.id, kind: 'wait', toX: enemy.x, toY: enemy.y };
  }

  const occupant = unitAt(board, aheadX, aheadY);
  if (occupant || getObjectiveTileHere(board, aheadX, aheadY)) {
    // Something to hit right ahead — attack in place.
    return {
      enemyId: enemy.id,
      kind: 'attack',
      toX: enemy.x,
      toY: enemy.y,
      targetX: aheadX,
      targetY: aheadY,
      damage: ENEMY_TYPES.brute.damage,
    };
  }
  if (isTileFree(board, aheadX, aheadY)) {
    // Advance one tile, then still telegraph an attack on the tile beyond (if in bounds).
    const nextAheadX = aheadX + dir.dx;
    const nextAheadY = aheadY + dir.dy;
    if (inBounds(nextAheadX, nextAheadY, board.size)) {
      return {
        enemyId: enemy.id,
        kind: 'move-attack',
        toX: aheadX,
        toY: aheadY,
        targetX: nextAheadX,
        targetY: nextAheadY,
        damage: ENEMY_TYPES.brute.damage,
      };
    }
    return { enemyId: enemy.id, kind: 'move-attack', toX: aheadX, toY: aheadY, targetX: aheadX, targetY: aheadY, damage: 0 };
  }
  // Blocked by hazard terrain ahead — hold and attack it anyway (hazards don't take damage but this stays deterministic/simple).
  return {
    enemyId: enemy.id,
    kind: 'attack',
    toX: enemy.x,
    toY: enemy.y,
    targetX: aheadX,
    targetY: aheadY,
    damage: ENEMY_TYPES.brute.damage,
  };
}

function getObjectiveTileHere(board, x, y) {
  const t = board.tiles[`${x},${y}`];
  return t && t.terrain === 'objective';
}

/**
 * Find the first blocking tile (unit or hazard) strictly between (x,y) and
 * (tx,ty) along a straight orthogonal line, scanning outward from (x,y).
 * Returns null if the line is clear all the way to the target.
 */
function firstBlockerAlongLine(board, x, y, tx, ty) {
  const dx = Math.sign(tx - x);
  const dy = Math.sign(ty - y);
  const dist = Math.max(Math.abs(tx - x), Math.abs(ty - y));
  for (let i = 1; i < dist; i++) {
    const cx = x + dx * i;
    const cy = y + dy * i;
    if (getTerrain(board, cx, cy) === 'hazard' || unitAt(board, cx, cy)) {
      return { x: cx, y: cy };
    }
  }
  return null;
}

/**
 * Spitter never moves. It always fires down its own row toward the nearest
 * objective that shares its row or column. If a unit or hazard sits between
 * the spitter and that objective, the shot hits that blocking tile instead —
 * a Bulwark can genuinely stand in the way. If no objective shares its row
 * or column, it fires straight down its column (toward increasing y) as a
 * fixed fallback, so its telegraph is always a real, displayable tile.
 */
function spitterIntent(board, enemy) {
  const objectives = getObjectiveTiles(board);
  const aligned = objectives.filter((o) => o.x === enemy.x || o.y === enemy.y);
  let target;
  if (aligned.length > 0) {
    target = aligned.reduce((best, o) => {
      const d = manhattan(enemy.x, enemy.y, o.x, o.y);
      const bestD = manhattan(enemy.x, enemy.y, best.x, best.y);
      return d < bestD ? o : best;
    });
  } else if (objectives.length > 0) {
    // Nothing aligned — fixed fallback direction so the telegraph is still concrete: fire straight down.
    target = { x: enemy.x, y: board.size - 1 };
  } else {
    return { enemyId: enemy.id, kind: 'wait', toX: enemy.x, toY: enemy.y };
  }

  const blocker = firstBlockerAlongLine(board, enemy.x, enemy.y, target.x, target.y);
  const actualTarget = blocker || target;

  return {
    enemyId: enemy.id,
    kind: 'attack',
    toX: enemy.x,
    toY: enemy.y,
    targetX: actualTarget.x,
    targetY: actualTarget.y,
    damage: ENEMY_TYPES.spitter.damage,
  };
}

const INTENT_FNS = {
  crawler: crawlerIntent,
  brute: bruteIntent,
  spitter: spitterIntent,
};

/**
 * Compute an enemy's fully deterministic next-turn intent given the CURRENT
 * board state. Pure function: calling this twice with the same board/enemy
 * always returns a deep-equal intent. Called once per enemy at the start of
 * a turn, before the player acts, so the intent can be displayed honestly.
 */
export function computeIntent(board, enemy) {
  const fn = INTENT_FNS[enemy.type];
  if (!fn) return { enemyId: enemy.id, kind: 'wait', toX: enemy.x, toY: enemy.y };
  return fn(board, enemy);
}

/** Compute intents for every living enemy on the board, in a stable order (by unit id). */
export function computeAllIntents(board) {
  const enemies = board.units.filter((u) => u.side === 'enemy' && u.hp > 0);
  const sorted = [...enemies].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.map((e) => computeIntent(board, e));
}
