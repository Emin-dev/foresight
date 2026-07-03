// missions.js — the mission campaign: 15 bite-sized missions across 3
// islands. Every mission is plain data (grid size, objective tiles, unit
// spawns, enemy spawns, turn limit) — no logic lives here, only content.
// Island 1 is free; Islands 2-3 require the one-time unlock (see checkout.js
// and main.js's isUnlocked() gate).

import { GRID_SIZE } from './board.js';

function u(id, type, x, y, side, facing) {
  const hp = { bulwark: 4, ram: 3, striker: 2, crawler: 2, brute: 3, spitter: 2 }[type];
  const unit = { id, type, x, y, side, hp, maxHp: hp };
  if (facing) unit.facing = facing;
  return unit;
}

export const ISLANDS = [
  {
    id: 'reedshore',
    name: 'Reedshore',
    description: 'A quiet river village. Gentle introduction — single enemies, small waves.',
    free: true,
  },
  {
    id: 'stonemarch',
    name: 'Stonemarch',
    description: 'Terraced hill farms. Multiple enemy types at once, tighter turn limits.',
    free: false,
  },
  {
    id: 'windkeep',
    name: 'Windkeep',
    description: 'The last watch before open country. Full squads, every enemy type combined.',
    free: false,
  },
];

// Each mission: id, islandId, name, size, turnLimit, objectives: [{x,y}],
// playerSpawns: [{id,type,x,y}], enemySpawns: [{id,type,x,y,facing?}], blurb.
export const MISSIONS = [
  // ---------------- Island 1: Reedshore (free) ----------------
  {
    id: 'reedshore-1',
    islandId: 'reedshore',
    name: 'The Well at Dawn',
    blurb: 'One crawler is heading for the village well. Stop it.',
    size: 6,
    turnLimit: 3,
    objectives: [{ x: 3, y: 3 }],
    hazards: [],
    playerSpawns: [
      u('p1', 'striker', 3, 1, 'player'),
    ],
    enemySpawns: [
      u('e1', 'crawler', 5, 5, 'enemy'),
    ],
  },
  {
    id: 'reedshore-2',
    islandId: 'reedshore',
    name: 'Two Paths',
    blurb: 'Two crawlers approach from opposite corners.',
    size: 6,
    turnLimit: 4,
    objectives: [{ x: 3, y: 3 }],
    hazards: [],
    playerSpawns: [
      u('p1', 'striker', 2, 2, 'player'),
      u('p2', 'bulwark', 3, 2, 'player'),
    ],
    enemySpawns: [
      u('e1', 'crawler', 0, 0, 'enemy'),
      u('e2', 'crawler', 5, 5, 'enemy'),
    ],
  },
  {
    id: 'reedshore-3',
    islandId: 'reedshore',
    name: 'The Brute\'s Lane',
    blurb: 'A brute marches in a straight line toward the well. Meet its telegraph head-on.',
    size: 6,
    turnLimit: 4,
    objectives: [{ x: 3, y: 4 }],
    hazards: [],
    playerSpawns: [
      u('p1', 'ram', 3, 2, 'player'),
      u('p2', 'bulwark', 3, 1, 'player'),
    ],
    enemySpawns: [
      u('e1', 'brute', 3, 0, 'enemy', 'down'),
    ],
  },
  {
    id: 'reedshore-4',
    islandId: 'reedshore',
    name: 'Ranged Warning',
    blurb: 'A spitter has the well in range already. Block its line or remove it fast.',
    size: 6,
    turnLimit: 4,
    objectives: [{ x: 2, y: 3 }],
    hazards: [{ x: 4, y: 2 }],
    playerSpawns: [
      u('p1', 'striker', 1, 4, 'player'),
      u('p2', 'bulwark', 2, 2, 'player'),
    ],
    enemySpawns: [
      u('e1', 'spitter', 2, 0, 'enemy'),
    ],
  },
  {
    id: 'reedshore-5',
    islandId: 'reedshore',
    name: 'Full Squad',
    blurb: 'Reedshore\'s hardest day: one of each enemy type, at once.',
    size: 6,
    turnLimit: 5,
    objectives: [{ x: 3, y: 3 }],
    hazards: [{ x: 1, y: 3 }],
    playerSpawns: [
      u('p1', 'striker', 2, 3, 'player'),
      u('p2', 'ram', 4, 3, 'player'),
      u('p3', 'bulwark', 3, 2, 'player'),
    ],
    enemySpawns: [
      u('e1', 'crawler', 0, 0, 'enemy'),
      u('e2', 'brute', 3, 0, 'enemy', 'down'),
      u('e3', 'spitter', 5, 5, 'enemy'),
    ],
  },

  // ---------------- Island 2: Stonemarch (paid) ----------------
  {
    id: 'stonemarch-1',
    islandId: 'stonemarch',
    name: 'Terrace Approach',
    blurb: 'Narrow terraces mean hazards box you in as much as they box the enemy.',
    size: 6,
    turnLimit: 4,
    objectives: [{ x: 3, y: 3 }],
    hazards: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 4 }],
    playerSpawns: [
      u('p1', 'striker', 3, 1, 'player'),
      u('p2', 'ram', 1, 3, 'player'),
    ],
    enemySpawns: [
      u('e1', 'crawler', 5, 0, 'enemy'),
      u('e2', 'brute', 0, 5, 'enemy', 'up'),
    ],
  },
  {
    id: 'stonemarch-2',
    islandId: 'stonemarch',
    name: 'Two Wells',
    blurb: 'Two objective tiles to protect at once — split your attention.',
    size: 6,
    turnLimit: 5,
    objectives: [{ x: 1, y: 3 }, { x: 4, y: 3 }],
    hazards: [],
    playerSpawns: [
      u('p1', 'bulwark', 2, 3, 'player'),
      u('p2', 'striker', 3, 3, 'player'),
    ],
    enemySpawns: [
      u('e1', 'crawler', 0, 0, 'enemy'),
      u('e2', 'crawler', 5, 5, 'enemy'),
      u('e3', 'spitter', 0, 5, 'enemy'),
    ],
  },
  {
    id: 'stonemarch-3',
    islandId: 'stonemarch',
    name: 'Push to the Edge',
    blurb: 'Use hazard tiles as a weapon: push enemies into them instead of trading blows.',
    size: 6,
    turnLimit: 4,
    objectives: [{ x: 3, y: 2 }],
    hazards: [{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }],
    playerSpawns: [
      u('p1', 'ram', 4, 1, 'player'),
      u('p2', 'ram', 4, 3, 'player'),
    ],
    enemySpawns: [
      u('e1', 'brute', 5, 0, 'enemy', 'down'),
      u('e2', 'crawler', 2, 5, 'enemy'),
    ],
  },
  {
    id: 'stonemarch-4',
    islandId: 'stonemarch',
    name: 'Crossfire Ridge',
    blurb: 'Two spitters lock down both lines into the well at once. Keep a Bulwark standing on it — that is the only thing that survives both lines of fire.',
    size: 6,
    turnLimit: 5,
    objectives: [{ x: 3, y: 3 }],
    hazards: [{ x: 3, y: 0 }, { x: 0, y: 3 }],
    playerSpawns: [
      u('p1', 'bulwark', 3, 3, 'player'),
      u('p2', 'bulwark', 2, 4, 'player'),
      u('p3', 'striker', 1, 4, 'player'),
    ],
    enemySpawns: [
      u('e1', 'spitter', 3, 5, 'enemy'),
      u('e2', 'spitter', 5, 3, 'enemy'),
    ],
  },
  {
    id: 'stonemarch-5',
    islandId: 'stonemarch',
    name: 'Stonemarch Stand',
    blurb: 'Stonemarch\'s hardest day: brute, crawler, and spitter together, tighter turn limit.',
    size: 6,
    turnLimit: 4,
    objectives: [{ x: 3, y: 3 }],
    hazards: [{ x: 1, y: 1 }, { x: 5, y: 5 }],
    playerSpawns: [
      u('p1', 'striker', 2, 3, 'player'),
      u('p2', 'ram', 4, 3, 'player'),
      u('p3', 'bulwark', 3, 4, 'player'),
    ],
    enemySpawns: [
      u('e1', 'brute', 3, 0, 'enemy', 'down'),
      u('e2', 'crawler', 0, 0, 'enemy'),
      u('e3', 'spitter', 5, 0, 'enemy'),
    ],
  },

  // ---------------- Island 3: Windkeep (paid) ----------------
  {
    id: 'windkeep-1',
    islandId: 'windkeep',
    name: 'The Last Watch',
    blurb: 'Windkeep opens with two brutes converging from both sides.',
    size: 6,
    turnLimit: 4,
    objectives: [{ x: 3, y: 3 }],
    hazards: [],
    playerSpawns: [
      u('p1', 'ram', 3, 2, 'player'),
      u('p2', 'ram', 3, 4, 'player'),
      u('p3', 'bulwark', 2, 3, 'player'),
    ],
    enemySpawns: [
      u('e1', 'brute', 3, 0, 'enemy', 'down'),
      u('e2', 'brute', 5, 3, 'enemy', 'left'),
    ],
  },
  {
    id: 'windkeep-2',
    islandId: 'windkeep',
    name: 'Three Wells, One Wall',
    blurb: 'Three objectives in a row. One well-placed Bulwark can shield more than one.',
    size: 6,
    turnLimit: 5,
    objectives: [{ x: 1, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 4 }],
    hazards: [],
    playerSpawns: [
      u('p1', 'bulwark', 3, 3, 'player'),
      u('p2', 'striker', 1, 3, 'player'),
      u('p3', 'striker', 5, 3, 'player'),
    ],
    enemySpawns: [
      u('e1', 'crawler', 1, 0, 'enemy'),
      u('e2', 'crawler', 3, 0, 'enemy'),
      u('e3', 'crawler', 5, 0, 'enemy'),
    ],
  },
  {
    id: 'windkeep-3',
    islandId: 'windkeep',
    name: 'Narrow Causeway',
    blurb: 'A hazard-lined causeway limits everyone\'s options equally — plan every push.',
    size: 6,
    turnLimit: 5,
    objectives: [{ x: 3, y: 5 }],
    hazards: [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 2, y: 2 }, { x: 4, y: 2 }],
    playerSpawns: [
      u('p1', 'ram', 2, 3, 'player'),
      u('p2', 'striker', 4, 3, 'player'),
      u('p3', 'bulwark', 3, 4, 'player'),
    ],
    enemySpawns: [
      u('e1', 'brute', 3, 1, 'enemy', 'down'),
      u('e2', 'spitter', 0, 3, 'enemy'),
    ],
  },
  {
    id: 'windkeep-4',
    islandId: 'windkeep',
    name: 'Every Front',
    blurb: 'All three enemy types, from three different sides, at once.',
    size: 6,
    turnLimit: 5,
    objectives: [{ x: 3, y: 3 }],
    hazards: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
    playerSpawns: [
      u('p1', 'striker', 3, 2, 'player'),
      u('p2', 'ram', 2, 3, 'player'),
      u('p3', 'bulwark', 4, 3, 'player'),
    ],
    enemySpawns: [
      u('e1', 'brute', 3, 0, 'enemy', 'down'),
      u('e2', 'crawler', 0, 5, 'enemy'),
      u('e3', 'spitter', 5, 5, 'enemy'),
    ],
  },
  {
    id: 'windkeep-5',
    islandId: 'windkeep',
    name: 'Windkeep\'s Last Stand',
    blurb: 'The campaign finale: two of every enemy type, tightest turn limit yet.',
    size: 6,
    turnLimit: 4,
    objectives: [{ x: 2, y: 3 }, { x: 4, y: 3 }],
    hazards: [{ x: 3, y: 3 }],
    playerSpawns: [
      u('p1', 'striker', 2, 2, 'player'),
      u('p2', 'striker', 4, 2, 'player'),
      u('p3', 'ram', 2, 4, 'player'),
      u('p4', 'bulwark', 4, 4, 'player'),
    ],
    enemySpawns: [
      u('e1', 'brute', 0, 3, 'enemy', 'right'),
      u('e2', 'brute', 5, 3, 'enemy', 'left'),
      u('e3', 'crawler', 0, 0, 'enemy'),
      u('e4', 'crawler', 5, 5, 'enemy'),
    ],
  },
];

export function getMissionById(id) {
  return MISSIONS.find((m) => m.id === id);
}

export function getMissionsForIsland(islandId) {
  return MISSIONS.filter((m) => m.islandId === islandId);
}

export function getIslandById(id) {
  return ISLANDS.find((i) => i.id === id);
}

export function getIslandForMission(missionId) {
  const m = getMissionById(missionId);
  if (!m) return undefined;
  return getIslandById(m.islandId);
}

export const TOTAL_MISSION_COUNT = MISSIONS.length;
export const TOTAL_ISLAND_COUNT = ISLANDS.length;
