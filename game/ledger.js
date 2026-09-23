/* ==========================================
   دفتر الطاقة والحضور
   ========================================== */

import { CONFIG } from '../config.js';
import { state, addEnergy, addCoins, addLog, setMood } from './state.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function checkDailyPresence() {
  const now = Date.now();
  if (now - state.lastDaily >= DAY_MS) {
    state.lastDaily = now;
    addEnergy(CONFIG.game.dailyPresenceEnergy);
    addLog(`🎁 ${CONFIG.game.dailyPresenceEnergy} طاقة (حضور)`);
    setMood('euphoric', 2500);
    return true;
  }
  return false;
}

export function canClick() {
  return Date.now() - state.lastClick >= CONFIG.game.clickCooldown;
}

export function doClick() {
  if (!canClick()) return false;
  if (state.energy >= state.maxEnergy) return false;
  state.lastClick = Date.now();
  addEnergy(CONFIG.game.clickEnergy);
  if (Math.random() < 0.1) addLog('⚡ +1 طاقة');
  return true;
}

export function canClaim() {
  return Date.now() - state.lastClaim >= CONFIG.game.claimCooldown;
}

export function doClaim() {
  if (!canClaim()) return { ok: false };
  state.lastClaim = Date.now();
  const earned = Math.floor(state.energy * 0.1) + 1;
  addCoins(earned);
  addLog(`🪙 +${earned} (استلام)`);
  setMood('eager', 1500);
  return { ok: true, earned };
}

export function consumeEnergy(amount) {
  if (state.energy < amount) return false;
  state.energy -= amount;
  return true;
}
