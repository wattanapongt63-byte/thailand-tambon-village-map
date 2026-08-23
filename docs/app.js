const DATA_BASE = 'data/processed';

const provinceSelect = document.getElementById('province-select');
const amphoeSelect = document.getElementById('amphoe-select');
const tambonSelect = document.getElementById('tambon-select');
const statusBox = document.getElementById('status');
const resultBox = document.getElementById('result');
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('download-png-btn');
const villageCountLabel = document.getElementById('village-count-label');
const voronoiCheckbox = document.getElementById('voronoi-checkbox');

let indexData = null;
let currentTambon = null;

function showStatus(msg) {
  statusBox.textContent = msg;
  statusBox.hidden = !msg;
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

async function init() {
  showStatus('กำลังโหลดรายชื่อจังหวัด...');
  const res = await fetch(`${DATA_BASE}/index.json`);
  indexData = await res.json();
  const items = indexData.provinces.map(p => ({ label: `${p.th} (${p.en})` }));
  populateSelect(provinceSelect, items, '-- เลือกจังหวัด --');
  provinceSelect.disabled = false;
  showStatus('');
}

provinceSelect.addEventListener('change', () => {
  resultBox.hidden = true;
  amphoeSelect.innerHTML = '<option value="">-- เลือกอำเภอ --</option>';
  tambonSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
  amphoeSelect.disabled = true;
  tambonSelect.disabled = true;

  const idx = provinceSelect.value;
  if (idx === '') return;
  const province = indexData.provinces[Number(idx)];
  const items = province.amphoes.map(a => ({ label: `${a.th} (${a.en})` }));
  populateSelect(amphoeSelect, items, '-- เลือกอำเภอ --');
  amphoeSelect.disabled = false;
});

amphoeSelect.addEventListener('change', () => {
  resultBox.hidden = true;
  tambonSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
  tambonSelect.disabled = true;

  const pIdx = provinceSelect.value;
  const aIdx = amphoeSelect.value;
  if (pIdx === '' || aIdx === '') return;
  const amphoe = indexData.provinces[Number(pIdx)].amphoes[Number(aIdx)];
  const items = amphoe.tambons.map(t => ({
    label: `${t.th} (${t.en}) — ${t.village_count} หมู่บ้าน`
  }));
  populateSelect(tambonSelect, items, '-- เลือกตำบล --');
  tambonSelect.disabled = false;
});

tambonSelect.addEventListener('change', async () => {
  const pIdx = provinceSelect.value;
  const aIdx = amphoeSelect.value;
  const tIdx = tambonSelect.value;
  if (pIdx === '' || aIdx === '' || tIdx === '') {
    resultBox.hidden = true;
    return;
  }
  const tambonRef = indexData.provinces[Number(pIdx)].amphoes[Number(aIdx)].tambons[Number(tIdx)];
  showStatus('กำลังโหลดข้อมูลตำบล...');
  resultBox.hidden = true;
  try {
    const res = await fetch(`${DATA_BASE}/tambon/${tambonRef.pcode}.json`);
    if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    currentTambon = await res.json();
    renderMap(currentTambon);
    resultBox.hidden = false;
    showStatus('');
  } catch (err) {
    showStatus('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
  }
});

voronoiCheckbox.addEventListener('change', () => {
  if (currentTambon) renderMap(currentTambon);
});

downloadBtn.addEventListener('click', () => {
  if (!currentTambon) return;
  const link = document.createElement('a');
  const safeName = `${currentTambon.province_en}_${currentTambon.amphoe_en}_${currentTambon.tambon_en}`
    .replace(/[^a-zA-Z0-9]+/g, '_');
  link.download = `tambon_${safeName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// ---- Rendering ----

function renderMap(t) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const CSS_WIDTH = 900;

  const villages = t.villages || [];
  villageCountLabel.textContent = villages.length
    ? `พบหมู่บ้านทั้งหมด ${villages.length} หมู่บ้าน`
    : 'ไม่มีข้อมูลหมู่บ้านสำหรับตำบลนี้ในชุดข้อมูล';

  const showVoronoi = voronoiCheckbox.checked && villages.length >= 2;

  // ---- layout constants (CSS px) ----
  const PAD = 24;
  const TITLE_H = 92;
  const BANNER_H = showVoronoi ? 40 : 0;
  const MAP_H = 520;
  const LEGEND_COL_W = 210;
  const LEGEND_ROW_H = 19;
  const LEGEND_TOP_GAP = 20;
  const LEGEND_HEADER_H = 26;
  const FOOTER_H = 46;

  const legendCols = Math.max(1, Math.floor((CSS_WIDTH - PAD * 2) / LEGEND_COL_W));
  const legendRows = villages.length ? Math.ceil(villages.length / legendCols) : 1;
  const legendH = villages.length
    ? LEGEND_HEADER_H + legendRows * LEGEND_ROW_H + LEGEND_TOP_GAP
    : LEGEND_HEADER_H + LEGEND_ROW_H + LEGEND_TOP_GAP;

  const CSS_HEIGHT = TITLE_H + BANNER_H + MAP_H + legendH + FOOTER_H;

  canvas.width = CSS_WIDTH * dpr;
  canvas.height = CSS_HEIGHT * dpr;
  canvas.style.width = CSS_WIDTH + 'px';
  canvas.style.height = CSS_HEIGHT + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CSS_WIDTH, CSS_HEIGHT);

  // ---- title ----
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1f4d36';
  ctx.font = '700 22px Sarabun, sans-serif';
  ctx.fillText(`ตำบล${t.tambon_th}  อำเภอ${t.amphoe_th}  จังหวัด${t.province_th}`, PAD, PAD);

  ctx.fillStyle = '#6b6a66';
  ctx.font = '400 14px Sarabun, sans-serif';
  ctx.fillText(`${t.tambon_en}, ${t.amphoe_en}, ${t.province_en}  |  รหัสพื้นที่ ${t.pcode}`, PAD, PAD + 30);
  ctx.fillText('แผนที่ขอบเขตตำบลและรายชื่อหมู่บ้าน (จัดทำเพื่อการศึกษา)', PAD, PAD + 50);

  // ---- warning banner (only when Voronoi overlay is shown) ----
  if (showVoronoi) {
    ctx.fillStyle = '#fff3cd';
    ctx.fillRect(PAD, TITLE_H, CSS_WIDTH - PAD * 2, BANNER_H - 8);
    ctx.strokeStyle = '#eddca6';
    ctx.strokeRect(PAD, TITLE_H, CSS_WIDTH - PAD * 2, BANNER_H - 8);
    ctx.fillStyle = '#6b5a1a';
    ctx.font = '700 11px Sarabun, sans-serif';
    ctx.fillText(
      '⚠ เส้นประคำนวณโดยประมาณ (Voronoi) จากพิกัดหมู่บ้านเท่านั้น ไม่ใช่ขอบเขตปกครองที่เป็นทางการ',
      PAD + 10, TITLE_H + 12
    );
  }

  // ---- map area ----
  const mapRect = { x: PAD, y: TITLE_H + BANNER_H, w: CSS_WIDTH - PAD * 2, h: MAP_H - 10 };
  ctx.strokeStyle = '#e2e0d8';
  ctx.strokeRect(mapRect.x, mapRect.y, mapRect.w, mapRect.h);

  const bounds = computeBounds(t.rings, t.bbox);
  drawRings(t.rings, bounds, mapRect);
  if (showVoronoi) drawVoronoiOverlay(t.rings, villages, bounds, mapRect);
  drawVillages(villages, bounds, mapRect);

  // ---- legend ----
  const legendY = TITLE_H + BANNER_H + MAP_H;
  ctx.fillStyle = '#1f4d36';
  ctx.font = '700 15px Sarabun, sans-serif';
  ctx.fillText('รายชื่อหมู่บ้าน', PAD, legendY);

  ctx.font = '400 13px Sarabun, sans-serif';
  ctx.fillStyle = '#21201c';
  if (villages.length) {
    villages.forEach((v, i) => {
      const col = Math.floor(i / legendRows);
      const row = i % legendRows;
      const x = PAD + col * LEGEND_COL_W;
      const y = legendY + LEGEND_HEADER_H + row * LEGEND_ROW_H;
      const label = `${i + 1}. ${v.name}`;
      ctx.fillText(truncateToWidth(ctx, label, LEGEND_COL_W - 12), x, y);
    });
  } else {
    ctx.fillStyle = '#6b6a66';
    ctx.fillText('— ไม่มีข้อมูลหมู่บ้านในชุดข้อมูลสำหรับตำบลนี้ —', PAD, legendY + LEGEND_HEADER_H);
  }

  // ---- footer ----
  const footerY = CSS_HEIGHT - FOOTER_H + 10;
  ctx.strokeStyle = '#e2e0d8';
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 8);
  ctx.lineTo(CSS_WIDTH - PAD, footerY - 8);
  ctx.stroke();
  ctx.fillStyle = '#6b6a66';
  ctx.font = '400 11px Sarabun, sans-serif';
  ctx.fillText('ที่มาข้อมูล: ขอบเขตตำบล — thailand_gis (HDX COD-AB) | หมู่บ้าน — กรมการปกครอง catalog.dopa.go.th (gis-01) — ใช้เพื่อการศึกษา', PAD, footerY);
  const now = new Date();
  ctx.fillText(`สร้างเมื่อ ${now.toLocaleDateString('th-TH')}`, PAD, footerY + 16);
}

function computeBounds(rings, bboxFallback) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!isFinite(minLon) && bboxFallback) {
    [minLon, minLat, maxLon, maxLat] = bboxFallback;
  }
  const padLon = (maxLon - minLon) * 0.08 || 0.01;
  const padLat = (maxLat - minLat) * 0.08 || 0.01;
  minLon -= padLon; maxLon += padLon;
  minLat -= padLat; maxLat += padLat;
  const centerLat = (minLat + maxLat) / 2;
  const cosLat = Math.max(Math.cos(centerLat * Math.PI / 180), 0.15);
  return { minLon, maxLon, minLat, maxLat, cosLat };
}

function project(lon, lat, bounds, mapRect) {
  const dx = (bounds.maxLon - bounds.minLon) * bounds.cosLat;
  const dy = (bounds.maxLat - bounds.minLat);
  const scale = Math.min(mapRect.w / dx, mapRect.h / dy);
  const offsetX = mapRect.x + (mapRect.w - dx * scale) / 2;
  const offsetY = mapRect.y + (mapRect.h - dy * scale) / 2;
  const x = offsetX + (lon - bounds.minLon) * bounds.cosLat * scale;
  const y = offsetY + (bounds.maxLat - lat) * scale;
  return [x, y];
}

function drawRings(rings, bounds, mapRect) {
  ctx.save();
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach(([lon, lat], i) => {
      const [x, y] = project(lon, lat, bounds, mapRect);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  ctx.fillStyle = 'rgba(47, 111, 79, 0.12)';
  ctx.fill('evenodd');
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#2f6f4f';
  ctx.stroke();
  ctx.restore();
}

// Approximate per-village "territory" lines using a rasterized nearest-
// neighbor (Voronoi) tessellation, clipped to the tambon polygon. This is a
// mathematical approximation from village coordinates only, NOT an official
// administrative boundary (see the on-page/in-image disclaimer).
function drawVoronoiOverlay(rings, villages, bounds, mapRect) {
  const STEP = 3; // CSS px grid resolution
  const projectedRings = rings.map(ring => ring.map(([lon, lat]) => project(lon, lat, bounds, mapRect)));
  const points = villages.map(v => project(v.lon, v.lat, bounds, mapRect));

  const cols = Math.ceil(mapRect.w / STEP) + 1;
  const rows = Math.ceil(mapRect.h / STEP) + 1;
  const labels = new Int32Array(cols * rows).fill(-1);

  for (let r = 0; r < rows; r++) {
    const y = mapRect.y + r * STEP;
    for (let c = 0; c < cols; c++) {
      const x = mapRect.x + c * STEP;
      if (!pointInRings(x, y, projectedRings)) continue;
      labels[r * cols + c] = nearestPointIndex(x, y, points);
    }
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(90, 74, 26, 0.55)';
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
        const rightLabel = labels[r * cols + c + 1];
        if (rightLabel >= 0 && rightLabel !== label) {
          ctx.moveTo(x + STEP, y);
          ctx.lineTo(x + STEP, y + STEP);
        }
      }
      if (r + 1 < rows) {
        const downLabel = labels[(r + 1) * cols + c];
        if (downLabel >= 0 && downLabel !== label) {
          ctx.moveTo(x, y + STEP);
          ctx.lineTo(x + STEP, y + STEP);
        }
      }
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function pointInRings(x, y, projectedRings) {
  let inside = false;
  for (const ring of projectedRings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersects = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersects) inside = !inside;
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

const LABEL_DIRS = [
  { dx: 1, dy: 0 }, { dx: 1, dy: -1 }, { dx: 0, dy: -1 }, { dx: -1, dy: -1 },
  { dx: -1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
];
const LABEL_RADII = [7, 12, 18, 26, 36];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Places each village's name next to its point, trying 8 directions at
// increasing distance and skipping any position that would overlap an
// already-placed label or point marker. Falls back to a plain number
// (matching the legend below) when no free spot can be found nearby.
function drawVillages(villages, bounds, mapRect) {
  const points = villages.map(v => project(v.lon, v.lat, bounds, mapRect));

  points.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#c0392b';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });

  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = '400 10px Sarabun, sans-serif';
  const LABEL_H = 12;
  const GAP = 3;

  const placedBoxes = points.map(([x, y]) => ({ x: x - 5, y: y - 5, w: 10, h: 10 }));

  villages.forEach((v, i) => {
    const [px, py] = points[i];
    const textW = ctx.measureText(v.name).width;

    let chosen = null;
    outer:
    for (const r of LABEL_RADII) {
      for (const { dx, dy } of LABEL_DIRS) {
        const anchorX = px + dx * r;
        const anchorY = py + dy * r;
        const align = dx > 0 ? 'left' : dx < 0 ? 'right' : 'center';
        const boxX = align === 'left' ? anchorX : align === 'right' ? anchorX - textW : anchorX - textW / 2;
        const boxY = dy > 0 ? anchorY : dy < 0 ? anchorY - LABEL_H : anchorY - LABEL_H / 2;
        const box = { x: boxX - GAP, y: boxY - GAP, w: textW + GAP * 2, h: LABEL_H + GAP * 2 };
        if (box.x < mapRect.x || box.x + box.w > mapRect.x + mapRect.w) continue;
        if (box.y < mapRect.y || box.y + box.h > mapRect.y + mapRect.h) continue;
        if (placedBoxes.some(pb => rectsOverlap(box, pb))) continue;
        chosen = { anchorX, anchorY, align, box };
        break outer;
      }
    }

    if (chosen) {
      placedBoxes.push(chosen.box);
      ctx.fillStyle = '#21201c';
      ctx.textAlign = chosen.align;
      ctx.fillText(v.name, chosen.anchorX, chosen.anchorY);
    } else {
      ctx.fillStyle = '#21201c';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), px + 5, py - 5);
    }
  });

  ctx.restore();
}

function truncateToWidth(ctx2d, text, maxWidth) {
  if (ctx2d.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + '…';
    if (ctx2d.measureText(candidate).width <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

init();
