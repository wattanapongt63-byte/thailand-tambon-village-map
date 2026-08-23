const DATA_BASE = 'data/processed';

// ---------- DOM ----------
const provinceSelect = document.getElementById('province-select');
const amphoeSelect = document.getElementById('amphoe-select');
const tambonSelect = document.getElementById('tambon-select');
const statusBox = document.getElementById('status');
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const canvasEmpty = document.getElementById('canvas-empty');
const mapToolbar = document.getElementById('map-toolbar');
const mapHint = document.getElementById('map-hint');
const hint3d = document.getElementById('hint-3d');
const downloadBtn = document.getElementById('download-png-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomLevelEl = document.getElementById('zoom-level');
const villageCountLabel = document.getElementById('village-count-label');
const voronoiCheckbox = document.getElementById('voronoi-checkbox');
const labelsCheckbox = document.getElementById('labels-checkbox');
const threeDCheckbox = document.getElementById('three-d-checkbox');
const tiltField = document.getElementById('tilt-field');
const tiltRange = document.getElementById('tilt-range');
const themeSelect = document.getElementById('theme-select');
const mapTitle = document.getElementById('map-title');
const mapSubtitle = document.getElementById('map-subtitle');
const mapStats = document.getElementById('map-stats');
const statVillages = document.getElementById('stat-villages');
const statPcode = document.getElementById('stat-pcode');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const introModal = document.getElementById('intro-modal');
const introClose = document.getElementById('intro-close');
const introDontShow = document.getElementById('intro-dontshow');
const aboutBtn = document.getElementById('about-btn');
const toast = document.getElementById('toast');
const selChip = document.getElementById('sel-chip');
const selNum = document.getElementById('sel-num');
const selName = document.getElementById('sel-name');
const selCoord = document.getElementById('sel-coord');
const selClear = document.getElementById('sel-clear');

// prompt builder
const pbEmpty = document.getElementById('pb-empty');
const pbForm = document.getElementById('pb-form');
const pbSchool = document.getElementById('pb-school');
const pbResources = document.getElementById('pb-resources');
const pbHighlight = document.getElementById('pb-highlight');
const pbStyle = document.getElementById('pb-style');
const pbRatio = document.getElementById('pb-ratio');
const pbTone = document.getElementById('pb-tone');
const pbIncludeVillages = document.getElementById('pb-include-villages');
const pbOutput = document.getElementById('pb-output');
const pbCopy = document.getElementById('pb-copy');
const pbReset = document.getElementById('pb-reset');

// ---------- state ----------
let indexData = null;
let currentTambon = null;
let searchIndex = [];
let promptDirty = false;

const view = { zoom: 1, panX: 0, panY: 0, heading: 0, hover: -1, selected: -1 };

// offscreen "document" layer — everything static; the visible canvas is this
// plus a light interactive overlay, so hovering never repaints the whole map.
const baseCanvas = document.createElement('canvas');
const baseCtx = baseCanvas.getContext('2d');

let LAST = null;          // layout + screen-space hit data from the last base render
let voronoiCache = null;  // unit-space tessellation, independent of zoom/pan/tilt

// ---------- palettes ----------
const PALETTES = {
  dark: {
    sheet: '#0d1626', panelLine: '#22334d',
    title: '#7dd3fc', sub: '#94a3b8',
    fill: 'rgba(56,189,248,0.13)', stroke: '#38bdf8', side: '#123049', sideTop: '#1b4767',
    point: '#fb923c', pointRing: '#0d1626', label: '#e6edf7',
    legendHead: '#7dd3fc', legendText: '#cbd5e1', legendHot: '#fb923c',
    voronoi: 'rgba(148,177,214,0.5)', selFill: 'rgba(251,146,60,0.20)', selCell: 'rgba(251,146,60,0.30)',
    bannerBg: '#2a2110', bannerBd: '#5c4a15', bannerInk: '#fcd34d',
    footer: '#64748b', rule: '#22334d',
    tipBg: 'rgba(12,20,34,0.96)', tipBd: '#38bdf8', tipInk: '#e6edf7', tipSub: '#94a3b8',
  },
  light: {
    sheet: '#ffffff', panelLine: '#e2e0d8',
    title: '#1f4d36', sub: '#6b6a66',
    fill: 'rgba(47,111,79,0.12)', stroke: '#2f6f4f', side: '#c8dcd0', sideTop: '#b2cdbe',
    point: '#c0392b', pointRing: '#ffffff', label: '#21201c',
    legendHead: '#1f4d36', legendText: '#21201c', legendHot: '#c0392b',
    voronoi: 'rgba(90,74,26,0.55)', selFill: 'rgba(192,57,43,0.16)', selCell: 'rgba(192,57,43,0.22)',
    bannerBg: '#fff3cd', bannerBd: '#eddca6', bannerInk: '#6b5a1a',
    footer: '#6b6a66', rule: '#e2e0d8',
    tipBg: 'rgba(255,255,255,0.97)', tipBd: '#2f6f4f', tipInk: '#21201c', tipSub: '#6b6a66',
  },
};
function palette() { return PALETTES[themeSelect.value] || PALETTES.dark; }

// ---------- small helpers ----------
function showStatus(msg) { statusBox.textContent = msg || ''; statusBox.hidden = !msg; }

let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg; toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function populateSelect(select, items, placeholder) {
  select.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = ''; opt.textContent = placeholder;
  select.appendChild(opt);
  items.forEach((item, i) => {
    const o = document.createElement('option');
    o.value = String(i); o.textContent = item.label;
    select.appendChild(o);
  });
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

// ---------- intro modal ----------
if (localStorage.getItem('ltm_intro_seen') === '1') introModal.hidden = true;
introClose.addEventListener('click', () => {
  if (introDontShow.checked) localStorage.setItem('ltm_intro_seen', '1');
  introModal.hidden = true;
});
aboutBtn.addEventListener('click', () => { introModal.hidden = false; });
introModal.addEventListener('click', e => { if (e.target === introModal) introModal.hidden = true; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !introModal.hidden) introModal.hidden = true;
});

// ---------- init ----------
async function init() {
  showStatus('กำลังโหลดรายชื่อจังหวัด...');
  const res = await fetch(`${DATA_BASE}/index.json`);
  indexData = await res.json();

  populateSelect(provinceSelect,
    indexData.provinces.map(p => ({ label: `${p.th} (${p.en})` })), '-- เลือกจังหวัด --');
  provinceSelect.disabled = false;

  indexData.provinces.forEach((p, pi) => p.amphoes.forEach((a, ai) => a.tambons.forEach((t, ti) => {
    searchIndex.push({ pi, ai, ti, t: t.th, a: a.th, p: p.th, n: t.village_count });
  })));

  showStatus('');
}

// ---------- cascading selects ----------
provinceSelect.addEventListener('change', () => {
  clearMap();
  amphoeSelect.innerHTML = '<option value="">-- เลือกอำเภอ --</option>';
  tambonSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
  amphoeSelect.disabled = true; tambonSelect.disabled = true;
  if (provinceSelect.value === '') return;
  const province = indexData.provinces[Number(provinceSelect.value)];
  populateSelect(amphoeSelect, province.amphoes.map(a => ({ label: `${a.th} (${a.en})` })), '-- เลือกอำเภอ --');
  amphoeSelect.disabled = false;
});

amphoeSelect.addEventListener('change', () => {
  clearMap();
  tambonSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
  tambonSelect.disabled = true;
  if (provinceSelect.value === '' || amphoeSelect.value === '') return;
  const amphoe = indexData.provinces[Number(provinceSelect.value)].amphoes[Number(amphoeSelect.value)];
  populateSelect(tambonSelect, amphoe.tambons.map(t => ({
    label: `${t.th} (${t.en}) — ${t.village_count} หมู่บ้าน`
  })), '-- เลือกตำบล --');
  tambonSelect.disabled = false;
});

tambonSelect.addEventListener('change', () => {
  if (provinceSelect.value === '' || amphoeSelect.value === '' || tambonSelect.value === '') {
    clearMap(); return;
  }
  const ref = indexData.provinces[Number(provinceSelect.value)]
    .amphoes[Number(amphoeSelect.value)].tambons[Number(tambonSelect.value)];
  loadTambon(ref.pcode);
});

function clearMap() {
  currentTambon = null; voronoiCache = null; LAST = null;
  canvas.hidden = true; canvasEmpty.hidden = false;
  mapToolbar.hidden = true; mapHint.hidden = true; mapStats.hidden = true; selChip.hidden = true;
  mapTitle.textContent = 'ยังไม่ได้เลือกตำบล';
  mapSubtitle.textContent = 'เลือกจังหวัด อำเภอ และตำบล จากแผงด้านซ้าย เพื่อแสดงแผนที่';
  pbForm.hidden = true; pbEmpty.hidden = false;
}

function resetView() {
  view.zoom = 1; view.panX = 0; view.panY = 0; view.heading = 0;
  view.hover = -1; view.selected = -1;
  selChip.hidden = true;
}

async function loadTambon(pcode) {
  showStatus('กำลังโหลดข้อมูลตำบล...');
  try {
    const res = await fetch(`${DATA_BASE}/tambon/${pcode}.json`);
    if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    currentTambon = await res.json();
    voronoiCache = null;
    resetView();

    const t = currentTambon;
    mapTitle.textContent = `ตำบล${t.tambon_th} อำเภอ${t.amphoe_th} จังหวัด${t.province_th}`;
    mapSubtitle.textContent = `${t.tambon_en}, ${t.amphoe_en}, ${t.province_en}`;
    statVillages.textContent = (t.villages || []).length;
    statPcode.textContent = t.pcode;
    mapStats.hidden = false;

    canvasEmpty.hidden = true; canvas.hidden = false;
    mapToolbar.hidden = false; mapHint.hidden = false;
    render();

    pbEmpty.hidden = true; pbForm.hidden = false;
    pbSchool.value = `ศกร.ตำบล${t.tambon_th}`;
    promptDirty = false;
    buildPrompt();

    showStatus('');
  } catch (err) {
    showStatus('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
  }
}

// ================= RENDER =================

function render(quick = false) {
  if (!currentTambon) return;
  renderBase(currentTambon, quick);
  composite();
  zoomLevelEl.textContent = Math.round(view.zoom * 100) + '%';
}

function renderBase(t, quick) {
  const P = palette();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const shellW = document.querySelector('.canvas-shell').clientWidth - 24;
  const CSS_W = Math.max(620, Math.min(1080, shellW || 900));

  const villages = t.villages || [];
  const showVoronoi = voronoiCheckbox.checked && villages.length >= 2;
  const showLabels = labelsCheckbox.checked && villages.length > 0 && !quick;
  const is3D = threeDCheckbox.checked;

  villageCountLabel.textContent = villages.length
    ? `พบหมู่บ้านทั้งหมด ${villages.length} หมู่บ้าน`
    : 'ไม่มีข้อมูลหมู่บ้านสำหรับตำบลนี้ในชุดข้อมูล';

  // ---- layout ----
  const PAD = 26, TITLE_H = 96;
  const BANNER_H = showVoronoi ? 40 : 0;
  const MAP_H = is3D ? 560 : 520;
  const COL_W = 210, ROW_H = 19, LEG_GAP = 20, LEG_HEAD = 26, FOOTER_H = 48;

  const cols = Math.max(1, Math.floor((CSS_W - PAD * 2) / COL_W));
  const rows = villages.length ? Math.ceil(villages.length / cols) : 1;
  const legendH = LEG_HEAD + rows * ROW_H + LEG_GAP;
  const CSS_H = TITLE_H + BANNER_H + MAP_H + legendH + FOOTER_H;

  baseCanvas.width = CSS_W * dpr; baseCanvas.height = CSS_H * dpr;
  canvas.width = CSS_W * dpr; canvas.height = CSS_H * dpr;
  canvas.style.width = CSS_W + 'px'; canvas.style.height = CSS_H + 'px';

  const c = baseCtx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = P.sheet; c.fillRect(0, 0, CSS_W, CSS_H);

  // ---- title ----
  c.textBaseline = 'top'; c.textAlign = 'left';
  c.fillStyle = P.title; c.font = '700 22px Sarabun, sans-serif';
  c.fillText(`ตำบล${t.tambon_th}  อำเภอ${t.amphoe_th}  จังหวัด${t.province_th}`, PAD, PAD);
  c.fillStyle = P.sub; c.font = '400 14px Sarabun, sans-serif';
  c.fillText(`${t.tambon_en}, ${t.amphoe_en}, ${t.province_en}  |  รหัสพื้นที่ ${t.pcode}`, PAD, PAD + 30);
  c.fillText(`แผนที่ขอบเขตตำบลและรายชื่อหมู่บ้าน${is3D ? ' · มุมมอง 3 มิติ' : ''} (จัดทำเพื่อการศึกษา)`, PAD, PAD + 50);

  if (showVoronoi) {
    c.fillStyle = P.bannerBg; c.fillRect(PAD, TITLE_H, CSS_W - PAD * 2, BANNER_H - 8);
    c.strokeStyle = P.bannerBd; c.lineWidth = 1;
    c.strokeRect(PAD, TITLE_H, CSS_W - PAD * 2, BANNER_H - 8);
    c.fillStyle = P.bannerInk; c.font = '700 11px Sarabun, sans-serif';
    c.fillText('⚠ เส้นประคำนวณโดยประมาณ (Voronoi) จากพิกัดหมู่บ้านเท่านั้น ไม่ใช่ขอบเขตปกครองที่เป็นทางการ',
      PAD + 10, TITLE_H + 12);
  }

  const mapRect = { x: PAD, y: TITLE_H + BANNER_H, w: CSS_W - PAD * 2, h: MAP_H - 10 };
  c.strokeStyle = P.panelLine; c.lineWidth = 1;
  c.strokeRect(mapRect.x, mapRect.y, mapRect.w, mapRect.h);

  // ---- build the scene (unit space -> 3D transform -> fit to mapRect) ----
  const scene = buildScene(t, villages, mapRect, is3D);

  c.save();
  c.beginPath(); c.rect(mapRect.x, mapRect.y, mapRect.w, mapRect.h); c.clip();

  if (is3D) drawSides(c, scene.rings, scene.depth, P);
  drawTopFace(c, scene.rings, P);

  if (showVoronoi) {
    ensureVoronoi(t, villages, scene);
    if (view.selected >= 0) drawSelectedCells(c, scene, view.selected, P);
    drawVoronoiLines(c, scene, P);
  }

  drawVillages(c, villages, scene, mapRect, P, showLabels, is3D);
  c.restore();

  // ---- legend ----
  const legendY = TITLE_H + BANNER_H + MAP_H;
  const legendRects = [];
  c.textAlign = 'left';
  c.fillStyle = P.legendHead; c.font = '700 15px Sarabun, sans-serif';
  c.fillText('รายชื่อหมู่บ้าน', PAD, legendY);
  c.font = '400 13px Sarabun, sans-serif';

  if (villages.length) {
    villages.forEach((v, i) => {
      const col = Math.floor(i / rows), row = i % rows;
      const x = PAD + col * COL_W, y = legendY + LEG_HEAD + row * ROW_H;
      const hot = i === view.selected;
      if (hot) {
        c.fillStyle = P.selFill;
        roundRect(c, x - 4, y - 2, COL_W - 8, ROW_H - 1, 4); c.fill();
      }
      c.fillStyle = hot ? P.legendHot : P.legendText;
      c.font = hot ? '600 13px Sarabun, sans-serif' : '400 13px Sarabun, sans-serif';
      c.fillText(truncateToWidth(c, `${i + 1}. ${v.name}`, COL_W - 12), x, y);
      legendRects.push({ x: x - 4, y: y - 2, w: COL_W - 8, h: ROW_H - 1, i });
    });
  } else {
    c.fillStyle = P.sub;
    c.fillText('— ไม่มีข้อมูลหมู่บ้านในชุดข้อมูลสำหรับตำบลนี้ —', PAD, legendY + LEG_HEAD);
  }

  // ---- footer ----
  const footerY = CSS_H - FOOTER_H + 12;
  c.strokeStyle = P.rule; c.lineWidth = 1;
  c.beginPath(); c.moveTo(PAD, footerY - 8); c.lineTo(CSS_W - PAD, footerY - 8); c.stroke();
  c.fillStyle = P.footer; c.font = '400 11px Sarabun, sans-serif';
  c.fillText('ที่มาข้อมูล: ขอบเขตตำบล — thailand_gis (HDX COD-AB) | หมู่บ้าน — กรมการปกครอง catalog.dopa.go.th (gis-01) — ใช้เพื่อการศึกษา', PAD, footerY);
  c.fillText(`Learning T-Map · สร้างเมื่อ ${new Date().toLocaleDateString('th-TH')}`, PAD, footerY + 16);

  LAST = { cssW: CSS_W, cssH: CSS_H, dpr, mapRect, points: scene.points, legendRects, P, is3D };
}

function composite() {
  if (!LAST) return;
  ctx.setTransform(LAST.dpr, 0, 0, LAST.dpr, 0, 0);
  ctx.clearRect(0, 0, LAST.cssW, LAST.cssH);
  ctx.drawImage(baseCanvas, 0, 0, LAST.cssW, LAST.cssH);
  if (view.hover >= 0 && currentTambon) drawTooltip(ctx, view.hover);
}

// ---------- scene construction ----------
function computeBounds(rings, bboxFallback) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const ring of rings) for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (!isFinite(minLon) && bboxFallback) [minLon, minLat, maxLon, maxLat] = bboxFallback;
  const padLon = (maxLon - minLon) * 0.06 || 0.01;
  const padLat = (maxLat - minLat) * 0.06 || 0.01;
  minLon -= padLon; maxLon += padLon; minLat -= padLat; maxLat += padLat;
  const cosLat = Math.max(Math.cos(((minLat + maxLat) / 2) * Math.PI / 180), 0.15);
  return { minLon, maxLon, minLat, maxLat, cosLat };
}

const unitProject = (lon, lat, b) => [(lon - b.minLon) * b.cosLat, (b.maxLat - lat)];

function buildScene(t, villages, mapRect, is3D) {
  const bounds = computeBounds(t.rings, t.bbox);
  const uw = (bounds.maxLon - bounds.minLon) * bounds.cosLat;
  const uh = (bounds.maxLat - bounds.minLat);
  const ucx = uw / 2, ucy = uh / 2;
  const tilt = (Number(tiltRange.value) || 38) * Math.PI / 180;
  const depth = is3D ? 34 : 0;

  const tf = ([x, y]) => {
    if (!is3D) return [x, y];
    const dx = x - ucx, dy = y - ucy;
    const ch = Math.cos(view.heading), sh = Math.sin(view.heading);
    return [ucx + dx * ch - dy * sh, ucy + (dx * sh + dy * ch) * Math.cos(tilt)];
  };

  const uRings = t.rings.map(r => r.map(([lon, lat]) => unitProject(lon, lat, bounds)));
  const uPoints = villages.map(v => unitProject(v.lon, v.lat, bounds));
  const tRings = uRings.map(r => r.map(tf));

  // fit transformed geometry into the map frame
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const r of tRings) for (const [x, y] of r) {
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const bw = Math.max(bx1 - bx0, 1e-9), bh = Math.max(by1 - by0, 1e-9);
  const s = Math.min(mapRect.w / bw, (mapRect.h - depth) / bh) * view.zoom;
  const mcx = mapRect.x + mapRect.w / 2, mcy = mapRect.y + (mapRect.h - depth) / 2;
  const bcx = (bx0 + bx1) / 2, bcy = (by0 + by1) / 2;

  const toScreen = ([x, y]) => [mcx + (x - bcx) * s + view.panX, mcy + (y - bcy) * s + view.panY];
  const project = p => toScreen(tf(p));

  return {
    bounds, uRings, uPoints, tf, project, depth, scale: s,
    rings: tRings.map(r => r.map(toScreen)),
    points: uPoints.map(project),
  };
}

// ---------- drawing ----------
function drawSides(c, rings, depth, P) {
  c.save();
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      c.fillStyle = (b[0] - a[0]) > 0 ? P.side : P.sideTop;
      c.beginPath();
      c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
      c.lineTo(b[0], b[1] + depth); c.lineTo(a[0], a[1] + depth);
      c.closePath(); c.fill();
    }
  }
  c.restore();
}

function drawTopFace(c, rings, P) {
  c.save();
  c.beginPath();
  for (const ring of rings) {
    ring.forEach(([x, y], i) => { if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.closePath();
  }
  c.fillStyle = P.fill; c.fill('evenodd');
  c.lineWidth = 1.6; c.strokeStyle = P.stroke; c.stroke();
  c.restore();
}

// Nearest-neighbour (Voronoi) tessellation computed once per tambon in unit
// space, so zooming / panning / rotating never recomputes it. Mathematical
// approximation from village coordinates only — NOT an official boundary.
function ensureVoronoi(t, villages, scene) {
  if (voronoiCache && voronoiCache.pcode === t.pcode) return;

  const COLS = 260;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of scene.uRings) for (const [x, y] of r) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const step = (x1 - x0) / COLS;
  const rows = Math.max(1, Math.ceil((y1 - y0) / step));
  const grid = new Int32Array(COLS * rows).fill(-1);

  for (let r = 0; r < rows; r++) {
    const y = y0 + r * step;
    for (let cI = 0; cI < COLS; cI++) {
      const x = x0 + cI * step;
      if (!pointInRings(x, y, scene.uRings)) continue;
      grid[r * COLS + cI] = nearestIndex(x, y, scene.uPoints);
    }
  }

  const segments = [];
  const cellsByLabel = new Map();
  for (let r = 0; r < rows; r++) {
    for (let cI = 0; cI < COLS; cI++) {
      const lab = grid[r * COLS + cI];
      if (lab < 0) continue;
      const x = x0 + cI * step, y = y0 + r * step;
      if (!cellsByLabel.has(lab)) cellsByLabel.set(lab, []);
      cellsByLabel.get(lab).push([x, y]);
      if (cI + 1 < COLS) {
        const right = grid[r * COLS + cI + 1];
        if (right >= 0 && right !== lab) segments.push([x + step, y, x + step, y + step]);
      }
      if (r + 1 < rows) {
        const down = grid[(r + 1) * COLS + cI];
        if (down >= 0 && down !== lab) segments.push([x, y + step, x + step, y + step]);
      }
    }
  }
  voronoiCache = { pcode: t.pcode, step, segments, cellsByLabel };
}

function drawVoronoiLines(c, scene, P) {
  if (!voronoiCache) return;
  c.save();
  c.strokeStyle = P.voronoi; c.lineWidth = 1; c.setLineDash([2, 2]);
  c.beginPath();
  for (const [ax, ay, bx, by] of voronoiCache.segments) {
    const a = scene.project([ax, ay]), b = scene.project([bx, by]);
    c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
  }
  c.stroke(); c.setLineDash([]); c.restore();
}

function drawSelectedCells(c, scene, index, P) {
  if (!voronoiCache) return;
  const cells = voronoiCache.cellsByLabel.get(index);
  if (!cells) return;
  const st = voronoiCache.step;
  c.save();
  c.fillStyle = P.selCell;
  c.beginPath();
  for (const [x, y] of cells) {
    const p0 = scene.project([x, y]), p1 = scene.project([x + st, y]);
    const p2 = scene.project([x + st, y + st]), p3 = scene.project([x, y + st]);
    c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]);
    c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]);
    c.closePath();
  }
  c.fill();
  c.restore();
}

function pointInRings(x, y, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
  }
  return inside;
}

function nearestIndex(x, y, pts) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i][0] - x, dy = pts[i][1] - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// ---------- village markers + labels ----------
const LABEL_DIRS = [
  { dx: 1, dy: 0 }, { dx: 1, dy: -1 }, { dx: 0, dy: -1 }, { dx: -1, dy: -1 },
  { dx: -1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
];
const LABEL_RADII = [7, 12, 18, 26, 36];
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function drawVillages(c, villages, scene, mapRect, P, showLabels, is3D) {
  const STEM = is3D ? 11 : 0;
  const pts = scene.points.map(([x, y]) => [x, y - STEM]);

  if (is3D) {
    c.save();
    c.strokeStyle = P.point; c.globalAlpha = .55; c.lineWidth = 1.2;
    c.beginPath();
    pts.forEach(([x, y]) => { c.moveTo(x, y); c.lineTo(x, y + STEM); });
    c.stroke(); c.restore();
  }

  pts.forEach(([x, y], i) => {
    const sel = i === view.selected;
    if (sel) {
      c.beginPath(); c.arc(x, y, 8.5, 0, Math.PI * 2);
      c.fillStyle = P.selFill; c.fill();
      c.beginPath(); c.arc(x, y, 6.5, 0, Math.PI * 2);
      c.strokeStyle = P.point; c.lineWidth = 1.6; c.stroke();
    }
    c.beginPath(); c.arc(x, y, sel ? 4.4 : 3.4, 0, Math.PI * 2);
    c.fillStyle = P.point; c.fill();
    c.strokeStyle = P.pointRing; c.lineWidth = .9; c.stroke();
  });

  if (!showLabels) return;

  c.save(); c.textBaseline = 'top';
  const LH = 12, GAP = 3;
  const placed = pts.map(([x, y]) => ({ x: x - 5, y: y - 5, w: 10, h: 10 + STEM }));

  villages.forEach((v, i) => {
    const [px, py] = pts[i];
    if (px < mapRect.x - 40 || px > mapRect.x + mapRect.w + 40) return;
    if (py < mapRect.y - 40 || py > mapRect.y + mapRect.h + 40) return;

    const sel = i === view.selected;
    c.font = sel ? '700 11px Sarabun, sans-serif' : '600 10px Sarabun, sans-serif';
    const tw = c.measureText(v.name).width;

    let chosen = null;
    outer:
    for (const r of LABEL_RADII) {
      for (const { dx, dy } of LABEL_DIRS) {
        const ax = px + dx * r, ay = py + dy * r;
        const align = dx > 0 ? 'left' : dx < 0 ? 'right' : 'center';
        const bx = align === 'left' ? ax : align === 'right' ? ax - tw : ax - tw / 2;
        const by = dy > 0 ? ay : dy < 0 ? ay - LH : ay - LH / 2;
        const box = { x: bx - GAP, y: by - GAP, w: tw + GAP * 2, h: LH + GAP * 2 };
        if (box.x < mapRect.x || box.x + box.w > mapRect.x + mapRect.w) continue;
        if (box.y < mapRect.y || box.y + box.h > mapRect.y + mapRect.h) continue;
        if (placed.some(pb => overlaps(box, pb))) continue;
        chosen = { ax, ay, align, box }; break outer;
      }
    }

    c.fillStyle = sel ? P.legendHot : P.label;
    if (chosen) {
      placed.push(chosen.box);
      c.textAlign = chosen.align;
      c.fillText(v.name, chosen.ax, chosen.ay);
    } else {
      c.textAlign = 'left';
      c.fillText(String(i + 1), px + 5, py - 5);
    }
  });
  c.restore();
}

function drawTooltip(c, i) {
  const t = currentTambon, P = LAST.P;
  const v = (t.villages || [])[i];
  if (!v) return;
  const [px, py0] = LAST.points[i];
  const py = py0 - (LAST.is3D ? 11 : 0);

  const name = `${i + 1}. บ้าน${v.name}`;
  const coord = `${v.lat.toFixed(5)}, ${v.lon.toFixed(5)}`;

  c.save();
  c.font = '700 12px Sarabun, sans-serif';
  const w1 = c.measureText(name).width;
  c.font = '400 10px Sarabun, sans-serif';
  const w2 = c.measureText(coord).width;
  const w = Math.max(w1, w2) + 20, h = 40;

  let x = px + 14, y = py - h - 10;
  if (x + w > LAST.cssW - 8) x = px - w - 14;
  if (y < LAST.mapRect.y + 4) y = py + 14;

  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
  c.fillStyle = P.tipBg; roundRect(c, x, y, w, h, 8); c.fill();
  c.shadowColor = 'transparent';
  c.strokeStyle = P.tipBd; c.lineWidth = 1; c.stroke();

  c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillStyle = P.tipInk; c.font = '700 12px Sarabun, sans-serif';
  c.fillText(name, x + 10, y + 7);
  c.fillStyle = P.tipSub; c.font = '400 10px Sarabun, sans-serif';
  c.fillText(coord, x + 10, y + 24);

  // marker halo
  c.beginPath(); c.arc(px, py, 7, 0, Math.PI * 2);
  c.strokeStyle = P.point; c.lineWidth = 2; c.stroke();
  c.restore();
}

function truncateToWidth(c, text, maxW) {
  if (c.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (c.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

// ================= INTERACTION =================

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  const s = LAST ? LAST.cssW / r.width : 1;
  return [(e.clientX - r.left) * s, (e.clientY - r.top) * s];
}

function hitVillage(x, y) {
  if (!LAST || !LAST.points.length) return -1;
  const stem = LAST.is3D ? 11 : 0;
  let best = -1, bestD = 196; // 14px radius
  LAST.points.forEach(([px, py0], i) => {
    const py = py0 - stem;
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function hitLegend(x, y) {
  if (!LAST) return -1;
  for (const r of LAST.legendRects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.i;
  }
  return -1;
}

function selectVillage(i) {
  view.selected = i;
  if (i >= 0 && currentTambon) {
    const v = currentTambon.villages[i];
    selNum.textContent = i + 1;
    selName.textContent = `บ้าน${v.name}`;
    selCoord.textContent = `พิกัด ${v.lat.toFixed(5)}, ${v.lon.toFixed(5)}` +
      (voronoiCheckbox.checked ? ' · พื้นที่ไฮไลต์เป็นการประมาณ' : '');
    selChip.hidden = false;
  } else {
    selChip.hidden = true;
  }
  render();
}

selClear.addEventListener('click', () => selectVillage(-1));

let drag = null;

canvas.addEventListener('pointerdown', e => {
  if (!LAST) return;
  const [x, y] = canvasPos(e);
  canvas.setPointerCapture(e.pointerId);
  drag = {
    x0: x, y0: y, px: view.panX, py: view.panY, h0: view.heading,
    tilt0: Number(tiltRange.value), moved: false,
    rotate: LAST.is3D && !e.shiftKey,
    inMap: x >= LAST.mapRect.x && x <= LAST.mapRect.x + LAST.mapRect.w &&
           y >= LAST.mapRect.y && y <= LAST.mapRect.y + LAST.mapRect.h,
  };
});

canvas.addEventListener('pointermove', e => {
  if (!LAST) return;
  const [x, y] = canvasPos(e);

  if (drag && drag.inMap) {
    const dx = x - drag.x0, dy = y - drag.y0;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    if (!drag.moved) return;
    canvas.classList.add('grabbing');
    if (drag.rotate) {
      view.heading = drag.h0 + dx * 0.006;
      tiltRange.value = Math.max(15, Math.min(60, drag.tilt0 - dy * 0.15));
    } else {
      view.panX = drag.px + dx;
      view.panY = drag.py + dy;
    }
    render(true);
    return;
  }

  const hit = hitVillage(x, y);
  const overLegend = hitLegend(x, y) >= 0;
  canvas.classList.toggle('pointing', hit >= 0 || overLegend);
  if (hit !== view.hover) { view.hover = hit; composite(); }
});

canvas.addEventListener('pointerup', e => {
  if (!LAST) return;
  canvas.classList.remove('grabbing');
  const wasDrag = drag && drag.moved;
  drag = null;
  if (wasDrag) { render(); return; }

  const [x, y] = canvasPos(e);
  const hit = hitVillage(x, y);
  const leg = hitLegend(x, y);
  if (hit >= 0) selectVillage(hit === view.selected ? -1 : hit);
  else if (leg >= 0) selectVillage(leg === view.selected ? -1 : leg);
});

canvas.addEventListener('pointerleave', () => {
  if (view.hover !== -1) { view.hover = -1; composite(); }
  canvas.classList.remove('grabbing', 'pointing');
});

canvas.addEventListener('wheel', e => {
  if (!LAST) return;
  const [x, y] = canvasPos(e);
  const m = LAST.mapRect;
  if (x < m.x || x > m.x + m.w || y < m.y || y > m.y + m.h) return;
  e.preventDefault();
  zoomAt(x, y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });

function zoomAt(px, py, k) {
  const next = Math.max(0.6, Math.min(8, view.zoom * k));
  const actual = next / view.zoom;
  if (actual === 1) return;
  const m = LAST.mapRect;
  const mcx = m.x + m.w / 2, mcy = m.y + (m.h - (LAST.is3D ? 34 : 0)) / 2;
  view.panX += (px - mcx - view.panX) * (1 - actual);
  view.panY += (py - mcy - view.panY) * (1 - actual);
  view.zoom = next;
  render();
}

zoomInBtn.addEventListener('click', () => {
  if (!LAST) return;
  const m = LAST.mapRect;
  zoomAt(m.x + m.w / 2, m.y + m.h / 2, 1.3);
});
zoomOutBtn.addEventListener('click', () => {
  if (!LAST) return;
  const m = LAST.mapRect;
  zoomAt(m.x + m.w / 2, m.y + m.h / 2, 1 / 1.3);
});

// ---------- view controls ----------
[voronoiCheckbox, labelsCheckbox, themeSelect].forEach(el =>
  el.addEventListener('change', () => render()));

threeDCheckbox.addEventListener('change', () => {
  tiltField.hidden = !threeDCheckbox.checked;
  hint3d.hidden = !threeDCheckbox.checked;
  view.heading = 0;
  render();
});

tiltRange.addEventListener('input', () => render());

resetViewBtn.addEventListener('click', () => {
  threeDCheckbox.checked = false;
  tiltField.hidden = true; hint3d.hidden = true;
  tiltRange.value = 38;
  voronoiCheckbox.checked = true;
  labelsCheckbox.checked = true;
  themeSelect.value = 'dark';
  resetView();
  render();
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => render(), 150);
});

downloadBtn.addEventListener('click', () => {
  if (!currentTambon) return;
  const link = document.createElement('a');
  const safe = `${currentTambon.province_en}_${currentTambon.amphoe_en}_${currentTambon.tambon_en}`
    .replace(/[^a-zA-Z0-9]+/g, '_');
  link.download = `tambon_${safe}.png`;
  link.href = baseCanvas.toDataURL('image/png'); // clean sheet, no hover tooltip
  link.click();
  showToast('ดาวน์โหลดภาพแล้ว');
});

// ================= PROMPT BUILDER =================
function buildPrompt() {
  if (!currentTambon) return;
  const t = currentTambon;
  const villages = t.villages || [];
  const school = pbSchool.value.trim() || `ศกร.ตำบล${t.tambon_th}`;
  const resources = pbResources.value.trim();
  const highlight = pbHighlight.value.trim();

  const L = [];
  L.push(`สร้างภาพ "แผนที่แหล่งเรียนรู้" ของ ${school}`);
  L.push(`พื้นที่: ตำบล${t.tambon_th} อำเภอ${t.amphoe_th} จังหวัด${t.province_th}`);
  L.push('');
  L.push(`รูปแบบภาพ: ${pbStyle.value}`);
  L.push(`โทนสี: ${pbTone.value}`);
  L.push(`สัดส่วนภาพ: ${pbRatio.value}`);
  L.push('');
  L.push('องค์ประกอบที่ต้องมีในภาพ:');

  let n = 1;
  L.push(`${n++}. รูปทรงขอบเขตตำบล${t.tambon_th} เป็นกรอบหลักของภาพ`);

  if (pbIncludeVillages.checked && villages.length) {
    L.push(`${n++}. หมุดหมู่บ้านทั้งหมด ${villages.length} หมู่บ้าน พร้อมชื่อกำกับอ่านง่าย ได้แก่`);
    villages.forEach((v, i) => L.push(`   ${i + 1}) บ้าน${v.name}`));
  } else {
    L.push(`${n++}. หมุดหมู่บ้านในตำบล พร้อมชื่อกำกับอ่านง่าย`);
  }

  if (resources) {
    L.push(`${n++}. ไอคอนแหล่งเรียนรู้ในพื้นที่ พร้อมชื่อกำกับ ได้แก่`);
    resources.split('\n').map(s => s.trim()).filter(Boolean).forEach(r => L.push(`   • ${r}`));
  } else {
    L.push(`${n++}. ไอคอนแหล่งเรียนรู้ในพื้นที่ เช่น วัด โรงเรียน ศูนย์การเรียนรู้ กลุ่มอาชีพ แหล่งท่องเที่ยว พร้อมชื่อกำกับ`);
  }

  if (highlight) L.push(`${n++}. จุดเด่น/อัตลักษณ์ของชุมชนที่ต้องสื่อในภาพ: ${highlight}`);

  L.push(`${n++}. ป้ายหัวเรื่องด้านบนภาพ ข้อความว่า "แผนที่แหล่งเรียนรู้ ${school}"`);
  L.push(`${n++}. คำอธิบายสัญลักษณ์ (legend) ที่มุมล่างของภาพ`);
  L.push('');
  L.push('ข้อกำหนดเพิ่มเติม:');
  L.push('- ข้อความทั้งหมดเป็นภาษาไทย สะกดถูกต้อง ตัวอักษรคมชัดอ่านง่าย');
  L.push('- จัดวางองค์ประกอบไม่ทับซ้อนกัน เว้นระยะให้สบายตา');
  L.push('- เน้นความสวยงามและสื่อสารเข้าใจง่าย เหมาะใช้เป็นสื่อการเรียนรู้');
  L.push('- ไม่ต้องอ้างอิงพิกัดภูมิศาสตร์จริง และไม่ต้องใส่เส้นแบ่งเขตการปกครองที่เป็นทางการ');

  pbOutput.value = L.join('\n');
}

[pbSchool, pbResources, pbHighlight].forEach(el =>
  el.addEventListener('input', () => { if (!promptDirty) buildPrompt(); }));
[pbStyle, pbRatio, pbTone, pbIncludeVillages].forEach(el =>
  el.addEventListener('change', () => { if (!promptDirty) buildPrompt(); }));
pbOutput.addEventListener('input', () => { promptDirty = true; });

pbReset.addEventListener('click', () => {
  promptDirty = false; buildPrompt(); showToast('สร้าง prompt ใหม่แล้ว');
});

pbCopy.addEventListener('click', async () => {
  const text = pbOutput.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('คัดลอก prompt แล้ว ✓');
  } catch {
    pbOutput.select(); document.execCommand('copy');
    showToast('คัดลอก prompt แล้ว ✓');
  }
});

// ================= SEARCH =================
let searchActive = -1;

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (!q) { searchResults.hidden = true; return; }
  const hits = searchIndex.filter(r => r.t.includes(q)).slice(0, 30);
  searchActive = -1;

  if (!hits.length) {
    searchResults.innerHTML = '<div class="sr-empty">ไม่พบตำบลที่ค้นหา</div>';
    searchResults.hidden = false; return;
  }
  searchResults.innerHTML = hits.map((h, i) =>
    `<div class="sr-item" data-i="${i}"><b>ตำบล${h.t}</b><span>อ.${h.a} จ.${h.p} · ${h.n} หมู่บ้าน</span></div>`
  ).join('');
  searchResults.hidden = false;
  searchResults.querySelectorAll('.sr-item').forEach(el =>
    el.addEventListener('click', () => selectFromSearch(hits[Number(el.dataset.i)])));
});

searchInput.addEventListener('keydown', e => {
  const items = searchResults.querySelectorAll('.sr-item');
  if (!items.length || searchResults.hidden) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    searchActive += e.key === 'ArrowDown' ? 1 : -1;
    if (searchActive < 0) searchActive = items.length - 1;
    if (searchActive >= items.length) searchActive = 0;
    items.forEach((el, i) => el.classList.toggle('active', i === searchActive));
    items[searchActive].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    items[searchActive >= 0 ? searchActive : 0].click();
  } else if (e.key === 'Escape') {
    searchResults.hidden = true;
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) searchResults.hidden = true;
});

function selectFromSearch(hit) {
  searchResults.hidden = true; searchInput.value = '';
  provinceSelect.value = String(hit.pi); provinceSelect.dispatchEvent(new Event('change'));
  amphoeSelect.value = String(hit.ai); amphoeSelect.dispatchEvent(new Event('change'));
  tambonSelect.value = String(hit.ti); tambonSelect.dispatchEvent(new Event('change'));
}

init();
