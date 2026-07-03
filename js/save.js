// save.js — persistent, non-punishing localStorage progress. Tracks which
// missions are completed (which unlocks the next mission in sequence) and
// the one-time purchase flag. Losing a mission never resets or removes any
// progress already saved — permadeath-lite means "retry immediately," not
// "lose your run."

import { MISSIONS } from './missions.js';

const STORAGE_KEY = 'foresight.save.v1';

function defaultSave() {
  return { completedMissionIds: [], purchased: false };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return {
      completedMissionIds: Array.isArray(parsed.completedMissionIds) ? parsed.completedMissionIds : [],
      purchased: !!parsed.purchased,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // localStorage unavailable (e.g. private mode) — session still works, just won't persist
  }
}

export function markMissionCompleted(save, missionId) {
  if (!save.completedMissionIds.includes(missionId)) {
    save.completedMissionIds = [...save.completedMissionIds, missionId];
  }
  writeSave(save);
  return save;
}

export function markPurchased(save) {
  save.purchased = true;
  writeSave(save);
  return save;
}

/**
 * A mission is unlocked if: it's the first mission overall, OR the mission
 * immediately before it (in campaign order) has been completed, OR its
 * island is free. Paid islands additionally require save.purchased.
 */
export function isMissionUnlocked(save, missionId, islandsById) {
  const idx = MISSIONS.findIndex((m) => m.id === missionId);
  if (idx === -1) return false;
  const mission = MISSIONS[idx];
  const island = islandsById ? islandsById[mission.islandId] : undefined;
  const islandIsFree = island ? island.free : mission.islandId === 'reedshore';

  if (!islandIsFree && !save.purchased) return false;
  if (idx === 0) return true;
  const prev = MISSIONS[idx - 1];
  // Crossing an island boundary from a free island into a paid one still
  // requires the previous mission to be completed (natural progression),
  // in addition to the purchase gate above.
  return save.completedMissionIds.includes(prev.id);
}

export function isMissionCompleted(save, missionId) {
  return save.completedMissionIds.includes(missionId);
}
