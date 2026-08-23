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
const downloadBtn = document.getElementById('download-png-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
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
let promptDirty = false; // true once the user hand-edits the generated prompt

// ---------- palettes ----------
const PALETTES = {
  dark: {
    sheet: '#0d1626', panelLine: '#22334d',
    title: '#7dd3fc', sub: '#94a3b8', body: '#cbd5e1',
    fill: 'rgba(56,189,248,0.13)', stroke: '#38bdf8', side: '#123049', sideTop: '#1b4767',
    point: '#fb923c', pointRing: '#0d1626', label: '#e6edf7',
    legendHead: '#7dd3fc', legendText: '#cbd5e1',
    voronoi: 'rgba(148,177,214,0.5)',
    bannerBg: '#2a2110', bannerBd: '#5c4a15', bannerInk: '#fcd34d',
    footer: '#64748b', rule: '#22334d',
  },
  light: {
    sheet: '#ffffff', panelLine: '#e2e0d8',
    title: '#1f4d36', sub: '#6b6a66', body: '#21201c',
    fill: 'rgba(47,111,79,0.12)', stroke: '#2f6f4f', side: '#c8dcd0', sideTop: '#b2cdbe',
    point: '#c0392b', pointRing: '#ffffff', label: '#21201c',
    legendHead: '#1f4d36', legendText: '#21201c',
    voronoi: 'rgba(90,74,26,0.55)',
    bannerBg: '#fff3cd', bannerBd: '#eddca6', bannerInk: '#6b5a1a',
    footer: '#6b6a66', rule: '#e2e0d8',
  },
};

function palette() { return PALETTES[themeSelect.value] || PALETTES.dark; }

// ---------- helpers ----------
function showStatus(msg) {
  statusBox.textContent = msg || '';
  statusBox.hidden = !msg;
}

let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function populateSelect(select, items, placeholder) {
  select.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = placeholder;
  select.appendChild(opt);
  items.forEach((item, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = item.label;
    select.appendChild(o);
  });
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

  populateSelect(provinceSelect, indexData.provinces.map(p => ({ label: `${p.th} (${p.en})` })), '-- เลือกจังหวัด --');
  provinceSelect.disabled = false;

  indexData.provinces.forEach((p, pi) => {
    p.amphoes.forEach((a, ai) => {
      a.tambons.forEach((t, ti) => {
        searchIndex.push({ pi, ai, ti, t: t.th, a: a.th, p: p.th, n: t.village_count });
      });
    });
  });

  showStatus('');
}

// ---------- cascading selects ----------
provinceSelect.addEventListener('change', () => {
  clearMap();
  amphoeSelect.innerHTML = '<option value="">-- เลือกอำเภอ --</option>';
  tambonSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
  amphoeSelect.disabled = true;
  tambonSelect.disabled = true;
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
    clearMap();
    return;
  }
  const ref = indexData.provinces[Number(provinceSelect.value)]
    .amphoes[Number(amphoeSelect.value)]
    .tambons[Number(tambonSelect.value)];
  loadTambon(ref.pcode);
});

function clearMap() {
  currentTambon = null;
  canvas.hidden = true;
  canvasEmpty.hidden = false;
  mapToolbar.hidden = true;
  mapStats.hidden = true;
  mapTitle.textContent = 'ยังไม่ได้เลือกตำบล';
  mapSubtitle.textContent = 'เลือกจังหวัด อำเภอ และตำบล จากแผงด้านซ้าย เพื่อแสดงแผนที่';
  pbForm.hidden = true;
  pbEmpty.hidden = false;
}

async function loadTambon(pcode) {
  showStatus('กำลังโหลดข้อมูลตำบล...');
  try {
    const res = await fetch(`${DATA_BASE}/tambon/${pcode}.json`);
    if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    currentTambon = await res.json();
    const t = currentTambon;

    mapTitle.textContent = `ตำบล${t.tambon_th} อำเภอ${t.amphoe_th} จังหวัด${t.province_th}`;
    mapSubtitle.textContent = `${t.tambon_en}, ${t.amphoe_en}, ${t.province_en}`;
    statVillages.textContent = (t.villages || []).length;
    statPcode.textContent = t.pcode;
    mapStats.hidden = false;

    canvasEmpty.hidden = true;
    canvas.hidden = false;
    mapToolbar.hidden = false;
    renderMap(t);

    // prompt builder
    pbEmpty.hidden = true;
    pbForm.hidden = false;
    pbSchool.value = `ศกร.ตำบล${t.tambon_th}`;
    promptDirty = false;
    buildPrompt();

    showStatus('');
  } catch (err) {
    showStatus('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
  }
}

// ---------- view controls ----------
[voronoiCheckbox, labelsCheckbox, themeSelect].forEach(el =>
  el.addEventListener('change', () => { if (currentTambon) renderMap(currentTambon); }));

threeDCheckbox.addEventListener('change', () => {
  tiltField.hidden = !threeDCheckbox.checked;
  if (currentTambon) renderMap(currentTambon);
});

tiltRange.addEventListener('input', () => { if (currentTambon) renderMap(currentTambon); });

resetViewBtn.addEventListener('click', () => {
  threeDCheckbox.checked = false;
  tiltField.hidden = true;
  tiltRange.value = 38;
  voronoiCheckbox.checked = true;
  labelsCheckbox.checked = true;
  themeSelect.value = 'dark';
  if (currentTambon) renderMap(currentTambon);
});

window.addEventListener('resize', () => { if (currentTambon) renderMap(currentTambon); });

downloadBtn.addEventListener('click', () => {
  if (!currentTambon) return;
  const link = document.createElement('a');
  const safe = `${currentTambon.province_en}_${currentTambon.amphoe_en}_${currentTambon.tambon_en}`
    .replace(/[^a-zA-Z0-9]+/g, '_');
  link.download = `tambon_${safe}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('ดาวน์โหลดภาพแล้ว');
});

// ================= RENDERING =================

function renderMap(t) {
  const P = palette();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const shellW = document.querySelector('.canvas-shell').clientWidth - 24;
  const CSS_WIDTH = Math.max(620, Math.min(1080, shellW || 900));

  const villages = t.villages || [];
  const showVoronoi = voronoiCheckbox.checked && villages.length >= 2;
  const showLabels = labelsCheckbox.checked && villages.length > 0;
  const is3D = threeDCheckbox.checked;

  villageCountLabel.textContent = villages.length
    ? `พบหมู่บ้านทั้งหมด ${villages.length} หมู่บ้าน`
    : 'ไม่มีข้อมูลหมู่บ้านสำหรับตำบลนี้ในชุดข้อมูล';

  // layout
  const PAD = 26;
  const TITLE_H = 96;
  const BANNER_H = showVoronoi ? 40 : 0;
  const MAP_H = is3D ? 560 : 520;
  const COL_W = 210;
  const ROW_H = 19;
  const LEG_GAP = 20;
  const LEG_HEAD = 26;
  const FOOTER_H = 48;

  const cols = Math.max(1, Math.floor((CSS_WIDTH - PAD * 2) / COL_W));
  const rows = villages.length ? Math.ceil(villages.length / cols) : 1;
  const legendH = LEG_HEAD + rows * ROW_H + LEG_GAP;
  const CSS_HEIGHT = TITLE_H + BANNER_H + MAP_H + legendH + FOOTER_H;

  canvas.width = CSS_WIDTH * dpr;
  canvas.height = CSS_HEIGHT * dpr;
  canvas.style.width = CSS_WIDTH + 'px';
  canvas.style.height = CSS_HEIGHT + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // sheet background
  ctx.fillStyle = P.sheet;
  ctx.fillRect(0, 0, CSS_WIDTH, CSS_HEIGHT);

  // title
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = P.title;
  ctx.font = '700 22px Sarabun, sans-serif';
  ctx.fillText(`ตำบล${t.tambon_th}  อำเภอ${t.amphoe_th}  จังหวัด${t.province_th}`, PAD, PAD);

  ctx.fillStyle = P.sub;
  ctx.font = '400 14px Sarabun, sans-serif';
  ctx.fillText(`${t.tambon_en}, ${t.amphoe_en}, ${t.province_en}  |  รหัสพื้นที่ ${t.pcode}`, PAD, PAD + 30);
  ctx.fillText(
    `แผนที่ขอบเขตตำบลและรายชื่อหมู่บ้าน${is3D ? ' · มุมมอง 3 มิติ' : ''} (จัดทำเพื่อการศึกษา)`,
    PAD, PAD + 50);

  // voronoi warning banner
  if (showVoronoi) {
    ctx.fillStyle = P.bannerBg;
    ctx.fillRect(PAD, TITLE_H, CSS_WIDTH - PAD * 2, BANNER_H - 8);
    ctx.strokeStyle = P.bannerBd;
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, TITLE_H, CSS_WIDTH - PAD * 2, BANNER_H - 8);
    ctx.fillStyle = P.bannerInk;
    ctx.font = '700 11px Sarabun, sans-serif';
    ctx.fillText('⚠ เส้นประคำนวณโดยประมาณ (Voronoi) จากพิกัดหมู่บ้านเท่านั้น ไม่ใช่ขอบเขตปกครองที่เป็นทางการ',
      PAD + 10, TITLE_H + 12);
  }

  // map frame
  const mapRect = { x: PAD, y: TITLE_H + BANNER_H, w: CSS_WIDTH - PAD * 2, h: MAP_H - 10 };
  ctx.strokeStyle = P.panelLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(mapRect.x, mapRect.y, mapRect.w, mapRect.h);

  const view = {
    is3D,
    tilt: (Number(tiltRange.value) || 38) * Math.PI / 180,
    depth: 34,
    cy: mapRect.y + mapRect.h / 2,
  };

  const bounds = computeBounds(t.rings, t.bbox, view);
  const flatRings = t.rings.map(r => r.map(([lon, lat]) => project(lon, lat, bounds, mapRect)));
  const flatPoints = villages.map(v => project(v.lon, v.lat, bounds, mapRect));

  if (is3D) drawExtrudedSides(flatRings, view, P);
  drawTopFace(flatRings, view, P);
  if (showVoronoi) drawVoronoiOverlay(flatRings, flatPoints, mapRect, view, P);
  drawVillages(villages, flatPoints, mapRect, view, P, showLabels);

  // legend
  const legendY = TITLE_H + BANNER_H + MAP_H;
  ctx.textAlign = 'left';
  ctx.fillStyle = P.legendHead;
  ctx.font = '700 15px Sarabun, sans-serif';
  ctx.fillText('รายชื่อหมู่บ้าน', PAD, legendY);

  ctx.font = '400 13px Sarabun, sans-serif';
  if (villages.length) {
    ctx.fillStyle = P.legendText;
    villages.forEach((v, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = PAD + col * COL_W;
      const y = legendY + LEG_HEAD + row * ROW_H;
      ctx.fillText(truncateToWidth(ctx, `${i + 1}. ${v.name}`, COL_W - 12), x, y);
    });
  } else {
    ctx.fillStyle = P.sub;
    ctx.fillText('— ไม่มีข้อมูลหมู่บ้านในชุดข้อมูลสำหรับตำบลนี้ —', PAD, legendY + LEG_HEAD);
  }

  // footer
  const footerY = CSS_HEIGHT - FOOTER_H + 12;
  ctx.strokeStyle = P.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 8);
  ctx.lineTo(CSS_WIDTH - PAD, footerY - 8);
  ctx.stroke();
  ctx.fillStyle = P.footer;
  ctx.font = '400 11px Sarabun, sans-serif';
  ctx.fillText('ที่มาข้อมูล: ขอบเขตตำบล — thailand_gis (HDX COD-AB) | หมู่บ้าน — กรมการปกครอง catalog.dopa.go.th (gis-01) — ใช้เพื่อการศึกษา', PAD, footerY);
  ctx.fillText(`Learning T-Map · สร้างเมื่อ ${new Date().toLocaleDateString('th-TH')}`, PAD, footerY + 16);
}

// ---------- geometry ----------
function computeBounds(rings, bboxFallback, view) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!isFinite(minLon) && bboxFallback) [minLon, minLat, maxLon, maxLat] = bboxFallback;

  const padLon = (maxLon - minLon) * 0.08 || 0.01;
  const padLat = (maxLat - minLat) * 0.08 || 0.01;
  minLon -= padLon; maxLon += padLon;
  minLat -= padLat; maxLat += padLat;

  const centerLat = (minLat + maxLat) / 2;
  const cosLat = Math.max(Math.cos(centerLat * Math.PI / 180), 0.15);
  // in 3D the shape is vertically compressed, so allow it to occupy more height
  const vScale = view && view.is3D ? 1 / Math.max(Math.cos(view.tilt), 0.35) : 1;
  return { minLon, maxLon, minLat, maxLat, cosLat, vScale };
}

function project(lon, lat, bounds, mapRect) {
  const dx = (bounds.maxLon - bounds.minLon) * bounds.cosLat;
  const dy = (bounds.maxLat - bounds.minLat);
  const usableH = mapRect.h * (bounds.vScale || 1);
  const scale = Math.min(mapRect.w / dx, usableH / dy);
  const offsetX = mapRect.x + (mapRect.w - dx * scale) / 2;
  const offsetY = mapRect.y + (mapRect.h - dy * scale) / 2;
  return [
    offsetX + (lon - bounds.minLon) * bounds.cosLat * scale,
    offsetY + (bounds.maxLat - lat) * scale,
  ];
}

// tilt a flat map-space point into the pseudo-3D view
function tilt([x, y], view) {
  if (!view.is3D) return [x, y];
  return [x, view.cy + (y - view.cy) * Math.cos(view.tilt) - view.depth * 0.45];
}

function drawExtrudedSides(flatRings, view, P) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0)';
  for (const ring of flatRings) {
    for (let i = 0; i < ring.length; i++) {
      const a = tilt(ring[i], view);
      const b = tilt(ring[(i + 1) % ring.length], view);
      // shade by edge orientation so the slab reads as a solid volume
      const facingDown = b[0] - a[0];
      ctx.fillStyle = facingDown > 0 ? P.side : P.sideTop;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(b[0], b[1] + view.depth);
      ctx.lineTo(a[0], a[1] + view.depth);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTopFace(flatRings, view, P) {
  ctx.save();
  ctx.beginPath();
  for (const ring of flatRings) {
    ring.forEach((pt, i) => {
      const [x, y] = tilt(pt, view);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  ctx.fillStyle = P.fill;
  ctx.fill('evenodd');
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = P.stroke;
  ctx.stroke();
  ctx.restore();
}

// Approximate per-village "territory" lines via a rasterized nearest-neighbor
// (Voronoi) tessellation clipped to the tambon polygon. Mathematical
// approximation from village coordinates only — NOT an official boundary.
function drawVoronoiOverlay(flatRings, flatPoints, mapRect, view, P) {
  const STEP = 3;
  const cols = Math.ceil(mapRect.w / STEP) + 1;
  const rows = Math.ceil(mapRect.h / STEP) + 1;
  const labels = new Int32Array(cols * rows).fill(-1);

  for (let r = 0; r < rows; r++) {
    const y = mapRect.y + r * STEP;
    for (let c = 0; c < cols; c++) {
      const x = mapRect.x + c * STEP;
      if (!pointInRings(x, y, flatRings)) continue;
      labels[r * cols + c] = nearestPointIndex(x, y, flatPoints);
    }
  }

  ctx.save();
  ctx.strokeStyle = P.voronoi;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const label = labels[r * cols + c];
      if (label < 0) continue;
      const x = mapRect.x + c * STEP;
      const y = mapRect.y + r * STEP;
      if (c + 1 < cols) {
        const right = labels[r * cols + c + 1];
        if (right >= 0 && right !== label) {
          const a = tilt([x + STEP, y], view);
          const b = tilt([x + STEP, y + STEP], view);
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
      }
      if (r + 1 < rows) {
        const down = labels[(r + 1) * cols + c];
        if (down >= 0 && down !== label) {
          const a = tilt([x, y + STEP], view);
          const b = tilt([x + STEP, y + STEP], view);
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
      }
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function pointInRings(x, y, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
  }
  return inside;
}

function nearestPointIndex(x, y, points) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i][0] - x, dy = points[i][1] - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// ---------- village points + label placement ----------
const LABEL_DIRS = [
  { dx: 1, dy: 0 }, { dx: 1, dy: -1 }, { dx: 0, dy: -1 }, { dx: -1, dy: -1 },
  { dx: -1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
];
const LABEL_RADII = [7, 12, 18, 26, 36];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function drawVillages(villages, flatPoints, mapRect, view, P, showLabels) {
  const STEM = view.is3D ? 11 : 0;
  const pts = flatPoints.map(p => {
    const [x, y] = tilt(p, view);
    return [x, y - STEM];
  });

  // 3D pin stems, drawn first so markers sit on top
  if (view.is3D) {
    ctx.save();
    ctx.strokeStyle = P.point;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + STEM);
    });
    ctx.stroke();
    ctx.restore();
  }

  pts.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = P.point;
    ctx.fill();
    ctx.strokeStyle = P.pointRing;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  });

  if (!showLabels) return;

  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = '600 10px Sarabun, sans-serif';
  const LABEL_H = 12;
  const GAP = 3;

  const placed = pts.map(([x, y]) => ({ x: x - 5, y: y - 5, w: 10, h: 10 + STEM }));

  villages.forEach((v, i) => {
    const [px, py] = pts[i];
    const textW = ctx.measureText(v.name).width;

    let chosen = null;
    outer:
    for (const r of LABEL_RADII) {
      for (const { dx, dy } of LABEL_DIRS) {
        const ax = px + dx * r;
        const ay = py + dy * r;
        const align = dx > 0 ? 'left' : dx < 0 ? 'right' : 'center';
        const bx = align === 'left' ? ax : align === 'right' ? ax - textW : ax - textW / 2;
        const by = dy > 0 ? ay : dy < 0 ? ay - LABEL_H : ay - LABEL_H / 2;
        const box = { x: bx - GAP, y: by - GAP, w: textW + GAP * 2, h: LABEL_H + GAP * 2 };
        if (box.x < mapRect.x || box.x + box.w > mapRect.x + mapRect.w) continue;
        if (box.y < mapRect.y || box.y + box.h > mapRect.y + mapRect.h) continue;
        if (placed.some(pb => rectsOverlap(box, pb))) continue;
        chosen = { ax, ay, align, box };
        break outer;
      }
    }

    ctx.fillStyle = P.label;
    if (chosen) {
      placed.push(chosen.box);
      ctx.textAlign = chosen.align;
      ctx.fillText(v.name, chosen.ax, chosen.ay);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), px + 5, py - 5);
    }
  });

  ctx.restore();
}

function truncateToWidth(c2d, text, maxWidth) {
  if (c2d.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (c2d.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

// ================= PROMPT BUILDER =================

function buildPrompt() {
  if (!currentTambon) return;
  const t = currentTambon;
  const villages = t.villages || [];

  const school = pbSchool.value.trim() || `ศกร.ตำบล${t.tambon_th}`;
  const resources = pbResources.value.trim();
  const highlight = pbHighlight.value.trim();

  const lines = [];
  lines.push(`สร้างภาพ "แผนที่แหล่งเรียนรู้" ของ ${school}`);
  lines.push(`พื้นที่: ตำบล${t.tambon_th} อำเภอ${t.amphoe_th} จังหวัด${t.province_th}`);
  lines.push('');
  lines.push(`รูปแบบภาพ: ${pbStyle.value}`);
  lines.push(`โทนสี: ${pbTone.value}`);
  lines.push(`สัดส่วนภาพ: ${pbRatio.value}`);
  lines.push('');
  lines.push('องค์ประกอบที่ต้องมีในภาพ:');

  let n = 1;
  lines.push(`${n++}. รูปทรงขอบเขตตำบล${t.tambon_th} เป็นกรอบหลักของภาพ`);

  if (pbIncludeVillages.checked && villages.length) {
    lines.push(`${n++}. หมุดหมู่บ้านทั้งหมด ${villages.length} หมู่บ้าน พร้อมชื่อกำกับอ่านง่าย ได้แก่`);
    villages.forEach((v, i) => lines.push(`   ${i + 1}) บ้าน${v.name}`));
  } else {
    lines.push(`${n++}. หมุดหมู่บ้านในตำบล พร้อมชื่อกำกับอ่านง่าย`);
  }

  if (resources) {
    lines.push(`${n++}. ไอคอนแหล่งเรียนรู้ในพื้นที่ พร้อมชื่อกำกับ ได้แก่`);
    resources.split('\n').map(s => s.trim()).filter(Boolean)
      .forEach(r => lines.push(`   • ${r}`));
  } else {
    lines.push(`${n++}. ไอคอนแหล่งเรียนรู้ในพื้นที่ เช่น วัด โรงเรียน ศูนย์การเรียนรู้ กลุ่มอาชีพ แหล่งท่องเที่ยว พร้อมชื่อกำกับ`);
  }

  if (highlight) lines.push(`${n++}. จุดเด่น/อัตลักษณ์ของชุมชนที่ต้องสื่อในภาพ: ${highlight}`);

  lines.push(`${n++}. ป้ายหัวเรื่องด้านบนภาพ ข้อความว่า "แผนที่แหล่งเรียนรู้ ${school}"`);
  lines.push(`${n++}. คำอธิบายสัญลักษณ์ (legend) ที่มุมล่างของภาพ`);
  lines.push('');
  lines.push('ข้อกำหนดเพิ่มเติม:');
  lines.push('- ข้อความทั้งหมดเป็นภาษาไทย สะกดถูกต้อง ตัวอักษรคมชัดอ่านง่าย');
  lines.push('- จัดวางองค์ประกอบไม่ทับซ้อนกัน เว้นระยะให้สบายตา');
  lines.push('- เน้นความสวยงามและสื่อสารเข้าใจง่าย เหมาะใช้เป็นสื่อการเรียนรู้');
  lines.push('- ไม่ต้องอ้างอิงพิกัดภูมิศาสตร์จริง และไม่ต้องใส่เส้นแบ่งเขตการปกครองที่เป็นทางการ');

  pbOutput.value = lines.join('\n');
}

[pbSchool, pbResources, pbHighlight].forEach(el =>
  el.addEventListener('input', () => { if (!promptDirty) buildPrompt(); }));
[pbStyle, pbRatio, pbTone, pbIncludeVillages].forEach(el =>
  el.addEventListener('change', () => { if (!promptDirty) buildPrompt(); }));

pbOutput.addEventListener('input', () => { promptDirty = true; });

pbReset.addEventListener('click', () => {
  promptDirty = false;
  buildPrompt();
  showToast('สร้าง prompt ใหม่แล้ว');
});

pbCopy.addEventListener('click', async () => {
  const text = pbOutput.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('คัดลอก prompt แล้ว ✓');
  } catch {
    pbOutput.select();
    document.execCommand('copy');
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
    searchResults.hidden = false;
    return;
  }

  searchResults.innerHTML = hits.map((h, i) =>
    `<div class="sr-item" data-i="${i}">
       <b>ตำบล${h.t}</b>
       <span>อ.${h.a} จ.${h.p} · ${h.n} หมู่บ้าน</span>
     </div>`).join('');
  searchResults.hidden = false;

  searchResults.querySelectorAll('.sr-item').forEach(el => {
    el.addEventListener('click', () => selectFromSearch(hits[Number(el.dataset.i)]));
  });
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
    (items[searchActive >= 0 ? searchActive : 0]).click();
  } else if (e.key === 'Escape') {
    searchResults.hidden = true;
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) searchResults.hidden = true;
});

function selectFromSearch(hit) {
  searchResults.hidden = true;
  searchInput.value = '';

  provinceSelect.value = String(hit.pi);
  provinceSelect.dispatchEvent(new Event('change'));
  amphoeSelect.value = String(hit.ai);
  amphoeSelect.dispatchEvent(new Event('change'));
  tambonSelect.value = String(hit.ti);
  tambonSelect.dispatchEvent(new Event('change'));
}

init();
