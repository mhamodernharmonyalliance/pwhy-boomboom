/* ==========================================
   الوجوه المضيئة (LED mosaic)
   ========================================== */

import { state, setMood } from './state.js';

const FACES = {
  calm:       { emoji: '😇', color: '#38bdf8', label: { ar: 'هادئ', en: 'Calm' } },
  eager:      { emoji: '🤑', color: '#fbbf24', label: { ar: 'متحمس', en: 'Eager' } },
  stressed:   { emoji: '😵‍💫', color: '#f87171', label: { ar: 'قلق',   en: 'Stressed' } },
  suspicious: { emoji: '🤨', color: '#a78bfa', label: { ar: 'شاكّ',   en: 'Suspicious' } },
  sedated:    { emoji: '🥴', color: '#34d399', label: { ar: 'مخدّر',  en: 'Sedated' } },
  euphoric:   { emoji: '🤩', color: '#f472b6', label: { ar: 'منتشي',  en: 'Euphoric' } },
  idle:       { emoji: '😴', color: '#64748b', label: { ar: 'خامل',   en: 'Idle' } },
};

export function getFace() {
  // لو المزاج مؤقت انتهى، نحسب تلقائي
  if (Date.now() > state.moodUntil) {
    const pct = state.energy / state.maxEnergy;
    if (pct < 0.2) state.mood = 'stressed';
    else if (pct > 0.8) state.mood = 'eager';
    else state.mood = 'calm';
  }
  return FACES[state.mood] || FACES.calm;
}

export function setFaceMood(mood, ms) {
  if (FACES[mood]) setMood(mood, ms);
}

export function getFaceColor() {
  return getFace().color;
}
