// main.js — UI wiring for Foresight. Renders the board, the island/mission
// select screen, the telegraphed enemy intents, and the checkout modal. All
// game logic lives in board.js/enemies.js/units.js/run.js/missions.js — this
// module only reads/renders that state and turns clicks into calls against
// the pure functions there. No fetch/XHR anywhere in this file.

import { GRID_SIZE, createBoard, setTerrain, placeUnit, getTerrain, unitAt, isTileFree, inBounds } from './board.js';
import { UNIT_TYPES } from './units.js';
import { ENEMY_TYPES } from './enemies.js';
import { startTurn, applyPlayerActions, resolveTurn } from './run.js';
import { ISLANDS, MISSIONS, getMissionsForIsland, getMissionById, getIslandById } from './missions.js';
import { loadSave, markMissionCompleted, isMissionUnlocked, isMissionCompleted } from './save.js';
import {
  validateCard,
  submitSandboxPayment,
  getOneTimePriceUSD,
  isUnlocked,
  markUnlocked,
  DECLINE_TEST_CARD,
} from './checkout.js';

// --- Global game state -------------------------------------------------------------

let save = loadSave();

const state = {
  view: 'select', // 'select' | 'mission'
  missionId: null,
  board: null,
  mission: null,
  intents: [],       // this turn's telegraphed enemy intents (captured at turn start)
  queuedActions: [],  // player actions queued this turn, in order
  selectedUnitId: null,
  outcome: 'ongoing', // 'ongoing' | 'won' | 'lost'
};

function unitsUsedThisTurn() {
  return new Set(state.queuedActions.map((a) => a.unitId));
}

// --- Building a board from mission data ---------------------------------------------

function buildBoardFromMission(mission) {
  let board = createBoard(mission.size || GRID_SIZE);
  for (const obj of mission.objectives || []) {
    board = setTerrain(board, obj.x, obj.y, 'objective');
  }
  for (const hz of mission.hazards || []) {
    board = setTerrain(board, hz.x, hz.y, 'hazard');
  }
  for (const spawn of mission.playerSpawns || []) {
    board = placeUnit(board, { ...spawn });
  }
  for (const spawn of mission.enemySpawns || []) {
    board = placeUnit(board, { ...spawn });
  }
  return board;
}

// --- Island / mission select screen --------------------------------------------------

function islandsById() {
  const map = {};
  for (const isl of ISLANDS) map[isl.id] = isl;
  return map;
}

function renderSelectScreen() {
  const root = document.getElementById('select-screen');
  root.innerHTML = '';

  for (const island of ISLANDS) {
    const section = document.createElement('div');
    section.className = 'island-block';

    const heading = document.createElement('div');
    heading.className = 'island-heading';
    const lockBadge = island.free || save.purchased ? '' : ' <span class="paid-badge-inline">LOCKED</span>';
    heading.innerHTML = `<h3>${island.name}${lockBadge}</h3><p class="island-desc"></p>`;
    heading.querySelector('.island-desc').textContent = island.description;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'mission-grid';

    const missions = getMissionsForIsland(island.id);
    for (const mission of missions) {
      const unlocked = isMissionUnlocked(save, mission.id, islandsById());
      const completed = isMissionCompleted(save, mission.id);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mission-card' + (unlocked ? '' : ' locked') + (completed ? ' completed' : '');
      card.disabled = !unlocked;
      card.innerHTML = `
        <span class="mission-name"></span>
        <span class="mission-blurb"></span>
        <span class="mission-meta"></span>
      `;
      card.querySelector('.mission-name').textContent = mission.name;
      card.querySelector('.mission-blurb').textContent = mission.blurb;
      card.querySelector('.mission-meta').textContent = unlocked
        ? (completed ? 'Completed — replay any time' : `Turn limit: ${mission.turnLimit}`)
        : 'Locked';

      if (unlocked) {
        card.addEventListener('click', () => startMission(mission.id));
      }
      grid.appendChild(card);
    }

    section.appendChild(grid);
    root.appendChild(section);
  }
}

// --- Mission play screen -------------------------------------------------------------

function startMission(missionId) {
  const mission = getMissionById(missionId);
  if (!mission) return;
  state.view = 'mission';
  state.missionId = missionId;
  state.mission = mission;
  state.board = buildBoardFromMission(mission);
  state.outcome = 'ongoing';
  beginTurn();
  showView('mission');
  renderMissionScreen();
}

function beginTurn() {
  const { board, intents } = startTurn(state.board);
  state.board = board;
  state.intents = intents;
  state.queuedActions = [];
  state.selectedUnitId = null;
}

function showView(view) {
  const apply = () => {
    document.getElementById('select-view').hidden = view !== 'select';
    document.getElementById('mission-view').hidden = view !== 'mission';
  };
  // Progressive enhancement only: if the browser supports the View
  // Transitions API, use it for a subtle cross-fade between screens. Falls
  // back to an instant swap everywhere else — no behavior change either way.
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

function backToSelect() {
  state.view = 'select';
  state.missionId = null;
  state.board = null;
  showView('select');
  renderSelectScreen();
}

// --- Rendering the board --------------------------------------------------------------

function unitIcon(type) {
  return { bulwark: '■', ram: '▲', striker: '●', crawler: '✦', brute: '◆', spitter: '✱' }[type] || '?';
}

/** Tiles the currently-selected unit could legally act on this turn, as a map "x,y" -> kind. */
function computeActionTargets() {
  const targets = {};
  if (!state.selectedUnitId) return targets;
  const unit = state.board.units.find((u) => u.id === state.selectedUnitId);
  if (!unit || unit.hp <= 0) return targets;
  const type = UNIT_TYPES[unit.type];

  // Move targets: orthogonal, within moveRange, free tiles.
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const tx = unit.x + dx;
    const ty = unit.y + dy;
    if (inBounds(tx, ty, state.board.size) && isTileFree(state.board, tx, ty)) {
      targets[`${tx},${ty}`] = 'move';
    }
  }

  if (unit.type === 'ram') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = unit.x + dx;
      const ty = unit.y + dy;
      const occ = unitAt(state.board, tx, ty);
      if (occ && occ.side === 'enemy') targets[`${tx},${ty}`] = 'push';
    }
  }

  if (unit.type === 'striker') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let dist = 1; dist <= type.attackRange; dist++) {
        const tx = unit.x + dx * dist;
        const ty = unit.y + dy * dist;
        if (!inBounds(tx, ty, state.board.size)) break;
        if (getTerrain(state.board, tx, ty) === 'hazard') break;
        const occ = unitAt(state.board, tx, ty);
        if (occ) {
          if (occ.side === 'enemy') targets[`${tx},${ty}`] = 'attack';
          break; // line of fire stops at the first occupied tile either way
        }
      }
    }
  }

  return targets;
}

function renderMissionScreen() {
  const board = state.board;
  const mission = state.mission;
  const island = getIslandForMission(mission);

  document.getElementById('mission-title').textContent = mission.name;
  document.getElementById('mission-blurb').textContent = mission.blurb;
  document.getElementById('mission-turn').textContent = `Turn ${board.turn} / ${mission.turnLimit}`;

  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  boardEl.style.setProperty('--grid-size', board.size);

  const targets = computeActionTargets();
  const usedIds = unitsUsedThisTurn();

  // Build quick intent lookup maps for telegraph rendering.
  const moveToMap = {};   // "x,y" -> true (an enemy will END UP here)
  const attackMap = {};   // "x,y" -> true (an enemy will HIT here)
  for (const intent of state.intents) {
    if (intent.kind === 'wait') continue;
    if (intent.toX !== undefined) moveToMap[`${intent.toX},${intent.toY}`] = true;
    if (intent.kind === 'attack' || intent.kind === 'move-attack') {
      attackMap[`${intent.targetX},${intent.targetY}`] = true;
    }
  }

  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      const tile = board.tiles[`${x},${y}`];
      const cell = document.createElement('div');
      cell.className = `tile tile-${tile.terrain}`;
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      const key = `${x},${y}`;
      if (moveToMap[key]) cell.classList.add('telegraph-move');
      if (attackMap[key]) cell.classList.add('telegraph-attack');
      if (targets[key]) cell.classList.add('actionable', `actionable-${targets[key]}`);

      const unit = unitAt(board, x, y);
      if (unit) {
        const u = document.createElement('div');
        u.className = `unit unit-${unit.side} unit-${unit.type}`;
        if (unit.id === state.selectedUnitId) u.classList.add('selected');
        if (unit.side === 'player' && usedIds.has(unit.id)) u.classList.add('used');
        u.innerHTML = `<span class="unit-icon">${unitIcon(unit.type)}</span><span class="unit-hp"></span>`;
        u.querySelector('.unit-hp').textContent = `${unit.hp}/${unit.maxHp}`;
        u.title = `${(unit.side === 'player' ? UNIT_TYPES[unit.type] : ENEMY_TYPES[unit.type]).name} (${unit.hp}/${unit.maxHp} HP)`;
        cell.appendChild(u);
      }

      cell.addEventListener('click', () => onTileClick(x, y));
      boardEl.appendChild(cell);
    }
  }

  renderIntentLog();
  renderUnitPanel();
  renderTurnControls();
}

function getIslandForMission(mission) {
  return getIslandById(mission.islandId);
}

function renderIntentLog() {
  const log = document.getElementById('intent-log');
  log.innerHTML = '';
  const living = state.intents.filter((i) => state.board.units.some((u) => u.id === i.enemyId && u.hp > 0));
  if (living.length === 0) {
    log.innerHTML = '<p class="intent-empty">No enemies remain.</p>';
    return;
  }
  for (const intent of living) {
    const enemy = state.board.units.find((u) => u.id === intent.enemyId);
    const li = document.createElement('div');
    li.className = 'intent-item';
    const name = ENEMY_TYPES[enemy.type].name;
    let desc;
    if (intent.kind === 'wait') {
      desc = `${name} will hold position.`;
    } else if (intent.kind === 'attack') {
      desc = `${name} will strike (${intent.targetX},${intent.targetY}) for ${intent.damage}.`;
    } else {
      desc = `${name} will move to (${intent.toX},${intent.toY}) and strike (${intent.targetX},${intent.targetY}) for ${intent.damage}.`;
    }
    li.textContent = desc;
    log.appendChild(li);
  }
}

function renderUnitPanel() {
  const panel = document.getElementById('unit-panel');
  panel.innerHTML = '';
  const usedIds = unitsUsedThisTurn();
  const playerUnits = state.board.units.filter((u) => u.side === 'player' && u.hp > 0);

  for (const unit of playerUnits) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const type = UNIT_TYPES[unit.type];
    btn.className = 'unit-select-btn';
    if (unit.id === state.selectedUnitId) btn.classList.add('active');
    if (usedIds.has(unit.id)) btn.classList.add('used');
    btn.innerHTML = `<span class="unit-icon">${unitIcon(unit.type)}</span> <span></span>`;
    btn.querySelector('span:last-child').textContent = `${type.name} (${unit.hp}/${unit.maxHp})`;
    btn.addEventListener('click', () => {
      state.selectedUnitId = state.selectedUnitId === unit.id ? null : unit.id;
      renderMissionScreen();
    });
    panel.appendChild(btn);
  }

  const helpEl = document.getElementById('unit-help');
  if (state.selectedUnitId) {
    const unit = state.board.units.find((u) => u.id === state.selectedUnitId);
    helpEl.textContent = unit ? UNIT_TYPES[unit.type].description : '';
  } else {
    helpEl.textContent = 'Select a unit to see its moves and targets highlighted on the board.';
  }
}

function renderTurnControls() {
  document.getElementById('confirm-turn-btn').disabled = state.outcome !== 'ongoing';
}

// --- Player interaction ---------------------------------------------------------------

function onTileClick(x, y) {
  if (state.outcome !== 'ongoing') return;
  if (!state.selectedUnitId) {
    const occ = unitAt(state.board, x, y);
    if (occ && occ.side === 'player' && !unitsUsedThisTurn().has(occ.id)) {
      state.selectedUnitId = occ.id;
      renderMissionScreen();
    }
    return;
  }

  if (unitsUsedThisTurn().has(state.selectedUnitId)) {
    state.selectedUnitId = null;
    renderMissionScreen();
    return;
  }

  const targets = computeActionTargets();
  const kind = targets[`${x},${y}`];
  if (!kind) {
    // Clicking a different, unused player unit re-selects it instead.
    const occ = unitAt(state.board, x, y);
    if (occ && occ.side === 'player' && !unitsUsedThisTurn().has(occ.id)) {
      state.selectedUnitId = occ.id;
      renderMissionScreen();
    }
    return;
  }

  state.queuedActions.push({ unitId: state.selectedUnitId, kind, x, y });
  state.selectedUnitId = null;
  renderMissionScreen();
}

function onHoldSelected() {
  if (!state.selectedUnitId || state.outcome !== 'ongoing') return;
  if (unitsUsedThisTurn().has(state.selectedUnitId)) return;
  state.queuedActions.push({ unitId: state.selectedUnitId, kind: 'hold' });
  state.selectedUnitId = null;
  renderMissionScreen();
}

function onConfirmTurn() {
  if (state.outcome !== 'ongoing') return;
  const boardAfterPlayer = applyPlayerActions(state.board, state.queuedActions);
  const result = resolveTurn(boardAfterPlayer, state.intents, state.mission);
  state.board = result.board;
  state.outcome = result.outcome;

  if (state.outcome === 'ongoing') {
    beginTurn();
    renderMissionScreen();
  } else {
    if (state.outcome === 'won') {
      save = markMissionCompleted(save, state.missionId);
    }
    renderMissionScreen();
    showOutcomeScreen(state.outcome);
  }
}

function showOutcomeScreen(outcome) {
  const overlay = document.getElementById('outcome-overlay');
  const title = document.getElementById('outcome-title');
  const msg = document.getElementById('outcome-message');
  overlay.classList.remove('outcome-won', 'outcome-lost');

  if (outcome === 'won') {
    overlay.classList.add('outcome-won');
    title.textContent = 'Mission complete';
    msg.textContent = `${state.mission.name} is secure. No punishment for how you got here — only that you did.`;
  } else {
    overlay.classList.add('outcome-lost');
    title.textContent = 'Mission failed';
    msg.textContent = 'Nothing is lost but this attempt — every enemy move was shown before it happened. Retry immediately, no penalty.';
  }

  const nextBtn = document.getElementById('outcome-next-btn');
  const missionsForIsland = getMissionsForIsland(state.mission.islandId);
  const idx = missionsForIsland.findIndex((m) => m.id === state.missionId);
  const next = missionsForIsland[idx + 1];
  nextBtn.hidden = outcome !== 'won' || !next;
  nextBtn.onclick = () => {
    overlay.hidden = true;
    if (next) startMission(next.id);
  };

  overlay.hidden = false;
}

function onRetryMission() {
  document.getElementById('outcome-overlay').hidden = true;
  startMission(state.missionId);
}

function onExitToSelect() {
  document.getElementById('outcome-overlay').hidden = true;
  backToSelect();
}

// --- Checkout modal ---------------------------------------------------------------

function refreshUnlockUI() {
  if (isUnlocked() && !save.purchased) {
    save.purchased = true;
  }
  document.getElementById('price-display').textContent = `$${getOneTimePriceUSD().toFixed(2)}`;
  document.getElementById('checkout-price').textContent = `Total: $${getOneTimePriceUSD().toFixed(2)} (sandbox)`;
  document.getElementById('decline-card-hint').textContent = DECLINE_TEST_CARD;
  document.getElementById('already-unlocked-note').hidden = !save.purchased;
  document.getElementById('open-checkout-btn').hidden = save.purchased;
}

function wireCheckout() {
  const openBtn = document.getElementById('open-checkout-btn');
  const overlay = document.getElementById('checkout-overlay');
  const closeBtn = document.getElementById('checkout-close');
  const form = document.getElementById('checkout-form');
  const resultEl = document.getElementById('checkout-result');

  openBtn.addEventListener('click', () => {
    resultEl.textContent = '';
    resultEl.className = 'checkout-result';
    form.reset();
    overlay.hidden = false;
  });

  closeBtn.addEventListener('click', () => {
    overlay.hidden = true;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = document.getElementById('card-number').value;
    const expiry = document.getElementById('card-expiry').value;
    const cvc = document.getElementById('card-cvc').value;

    document.getElementById('error-number').textContent = '';
    document.getElementById('error-expiry').textContent = '';
    document.getElementById('error-cvc').textContent = '';

    const { valid, errors } = validateCard({ number, expiry, cvc });
    if (!valid) {
      if (errors.number) document.getElementById('error-number').textContent = errors.number;
      if (errors.expiry) document.getElementById('error-expiry').textContent = errors.expiry;
      if (errors.cvc) document.getElementById('error-cvc').textContent = errors.cvc;
      return;
    }

    const submitBtn = document.getElementById('checkout-submit');
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    resultEl.textContent = 'Processing (sandbox)…';
    resultEl.className = 'checkout-result';

    const outcome = await submitSandboxPayment({ number });
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-loading');

    if (outcome.ok) {
      markUnlocked();
      save.purchased = true;
      resultEl.textContent = `${outcome.message} Reference: ${outcome.reference}`;
      resultEl.className = 'checkout-result ok';
      refreshUnlockUI();
      setTimeout(() => {
        overlay.hidden = true;
        renderSelectScreen();
      }, 1200);
    } else {
      resultEl.textContent = outcome.message;
      resultEl.className = 'checkout-result fail';
    }
  });
}

// --- Init ---------------------------------------------------------------------------

function wireMissionControls() {
  document.getElementById('confirm-turn-btn').addEventListener('click', onConfirmTurn);
  document.getElementById('hold-unit-btn').addEventListener('click', onHoldSelected);
  document.getElementById('back-to-select-btn').addEventListener('click', backToSelect);
  document.getElementById('outcome-retry-btn').addEventListener('click', onRetryMission);
  document.getElementById('outcome-exit-btn').addEventListener('click', onExitToSelect);
}

function init() {
  wireMissionControls();
  wireCheckout();
  refreshUnlockUI();
  showView('select');
  renderSelectScreen();
}

init();
