/* ==========================================
   الرسم البياني — d3
   خطان: الحقيقي ($0.0004) + الحلم (314)
   ========================================== */

import { CONFIG } from '../config.js';
import { state } from './state.js';

let svg, xScale, yScale, dreamPath, realPath, targetLine;
let dreamData = [], realData = [];
let container;
let width = 0, height = 0;

export function initChart(el) {
  if (!el || !window.d3) return;
  container = el;
  const rect = el.getBoundingClientRect();
  width = rect.width;
  height = rect.height;

  svg = d3.select(el).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('position', 'absolute')
    .style('inset', 0);

  const g = svg.append('g');

  // نطاق مبسط (log للقيم الكبيرة)
  xScale = d3.scaleLinear().domain([0, 100]).range([0, width]);

  // y لوغاريتمي لأن الفرق بين 0.0004 و 314 هائل
  yScale = d3.scaleLog()
    .domain([0.0001, 1000])
    .range([height - 20, 20]);

  // خط الحلم (314) — أفقي ذهبي
  g.append('line')
    .attr('class', 'dream-line')
    .attr('x1', 0).attr('x2', width)
    .attr('y1', yScale(CONFIG.game.dreamTarget))
    .attr('y2', yScale(CONFIG.game.dreamTarget))
    .attr('stroke', '#fbbf24')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '6,6')
    .attr('opacity', 0.7);

  // خط السعر الحقيقي — أحمر ثابت
  realPath = g.append('path')
    .attr('fill', 'none')
    .attr('stroke', '#f87171')
    .attr('stroke-width', 2)
    .attr('opacity', 0.8);

  // خط الحلم الصاعد — أزرق
  dreamPath = g.append('path')
    .attr('fill', 'none')
    .attr('stroke', '#38bdf8')
    .attr('stroke-width', 2.5)
    .attr('filter', 'drop-shadow(0 0 8px #38bdf8)');

  // تعبئة البيانات الابتدائية
  for (let i = 0; i < 100; i++) {
    realData.push({ x: i, y: CONFIG.game.realPrice * (0.9 + Math.random() * 0.2) });
    // خط الحلم يبدأ واطيًا ويصعد مع المستويات
    const base = Math.pow(10, state.level * 0.5);
    dreamData.push({ x: i, y: base * (0.85 + Math.random() * 0.3) });
  }

  draw();
}

export function updateChart() {
  if (!svg) return;
  // إضافة نقطة جديدة
  const lastReal = realData[realData.length - 1];
  const lastDream = dreamData[dreamData.length - 1];

  realData.push({ x: lastReal.x + 1, y: CONFIG.game.realPrice * (0.9 + Math.random() * 0.2) });
  const dreamBase = Math.pow(10, state.level * 0.5);
  dreamData.push({ x: lastDream.x + 1, y: dreamBase * (0.85 + Math.random() * 0.3) });

  // تحريك النافذة
  if (realData.length > 100) { realData.shift(); dreamData.shift(); }
  realData.forEach((d, i) => d.x = i);
  dreamData.forEach((d, i) => d.x = i);

  draw();
}

function draw() {
  if (!svg) return;
  const lineGen = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(Math.max(d.y, 0.00005)))
    .curve(d3.curveMonotoneX);

  realPath.attr('d', lineGen(realData));
  dreamPath.attr('d', lineGen(dreamData));
}

export function resizeChart() {
  if (!container || !svg) return;
  const rect = container.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  svg.attr('viewBox', `0 0 ${width} ${height}`);
  xScale.range([0, width]);
  yScale.range([height - 20, 20]);
  draw();
}
