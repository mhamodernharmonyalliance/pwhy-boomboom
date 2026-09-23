/* ==========================================
   حالة اللاعب
   ========================================== */

import { CONFIG } from '../config.js';
import { getLevel } from '../products.js';

export const state = {
  user: null,              // من Telegram
  level: 1,
  energy: 5,
  maxEnergy: CONFIG.game.baseEnergyCap,
  coins: 0,
  coinMultiplier: 1.0,
  lastClick: 0,
  lastClaim: 0,
  lastDaily: 0,
  lastAd: 0,
  mood: 'calm',            // calm | eager | stressed | suspicious | sedated | euphoric | idle
  moodUntil: 0,
  log: [],                 // سجل أحداث اللعبة
  purchases: [],
  loaded: false,
};

export function applyLevel(level) {
  const L = getLevel(level);
  if (!L) return;
  state.level = level;
  state.maxEnergy = L.maxEnergy;
  state.coinMultiplier = L.coinMultiplier;
  state.energy = Math.min(state.energy, state.maxEnergy);
  setMood('eager', 3000);
}

export function setMood(mood, durationMs = 2000) {
  state.mood = mood;
  state.moodUntil = Date.now() + durationMs;
}

export function addLog(text) {
  state.log.unshift({ text, at: Date.now() });
  if (state.log.length > 30) state.log.pop();
}

export function addCoins(amount) {
  state.coins += amount * state.coinMultiplier;
}

export function addEnergy(amount) {
  state.energy = Math.min(state.energy + amount, state.maxEnergy);
}
