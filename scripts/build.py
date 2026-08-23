import os
import json
import glob
import shapefile

ROOT = os.path.expanduser("~/thailand-tambon-village-map")
DOPA_DIR = os.path.join(ROOT, "data/raw/dopa_village")
TAMBON_DIR = os.path.join(ROOT, "data/raw/tambon_shp")
OUT_TAMBON_DIR = os.path.join(ROOT, "data/processed/tambon")
OUT_INDEX = os.path.join(ROOT, "data/processed/index.json")

os.makedirs(OUT_TAMBON_DIR, exist_ok=True)

def norm(s):
    if s is None:
        return ''
    return s.strip()

print("Loading DOPA village points...")
village_index = {}
# nested index for prefix-fallback matching: province -> amphoe -> tambon -> villages
nested_index = {}
total_villages = 0
for path in glob.glob(os.path.join(DOPA_DIR, "*.json")):
    rows = json.load(open(path, encoding="utf-8"))
    for r in rows:
        try:
            lat = float(r["oct_side15_lat"])
            lon = float(r["oct_side15_lon"])
        except (TypeError, ValueError):
            continue
        if not lat or not lon:
            continue
        prv = norm(r.get("pname"))
        amp = norm(r.get("aname"))
        tam = norm(r.get("tname"))
        name = norm(r.get("mname"))
        key = (prv, amp, tam)
        village_index.setdefault(key, []).append({"name": name, "lon": lon, "lat": lat})
        nested_index.setdefault(prv, {}).setdefault(amp, {}).setdefault(tam, [])
        nested_index[prv][amp][tam].append({"name": name, "lon": lon, "lat": lat})
        total_villages += 1

print(f"Loaded {total_villages} village points, {len(village_index)} tambon keys")

def _prefix_candidates(target, options):
    target = target.strip()
    return [o for o in options if o.startswith(target) or target.startswith(o)]

def _edit_distance_at_most_1(a, b):
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    if la == lb:
        return sum(1 for x, y in zip(a, b) if x != y) <= 1
    shorter, longer = (a, b) if la < lb else (b, a)
    i = j = edits = 0
    while i < len(shorter) and j < len(longer):
        if shorter[i] == longer[j]:
            i += 1; j += 1
        else:
            edits += 1
            if edits > 1:
                return False
            j += 1
    return True

def _near_candidates(target, options):
    return [o for o in options if _edit_distance_at_most_1(target, o)]

def _resolve_amphoe(prv, prv_node, amp):
    if amp in prv_node:
        return amp
    candidates = _prefix_candidates(amp, prv_node.keys())
    if len(candidates) == 1:
        return candidates[0]
    if amp == prv:
        capital = 'เมือง' + prv
        if capital in prv_node:
            return capital
    candidates = _near_candidates(amp, prv_node.keys())
    if len(candidates) == 1:
        return candidates[0]
    return None

def _nearest_by_centroid(candidates, tam_node, bbox_center):
    if not bbox_center:
        return None
    cx, cy = bbox_center
    best, best_d = None, None
    for c in candidates:
        villages = tam_node[c]
        if not villages:
            continue
        vx = sum(v["lon"] for v in villages) / len(villages)
        vy = sum(v["lat"] for v in villages) / len(villages)
        d = (vx - cx) ** 2 + (vy - cy) ** 2
        if best_d is None or d < best_d:
            best, best_d = c, d
    return best

def _resolve_tambon(tam_node, tam, bbox_center=None):
    if tam in tam_node:
        return tam
    candidates = _prefix_candidates(tam, tam_node.keys())
    if len(candidates) == 1:
        return candidates[0]
    if len(candidates) > 1:
        picked = _nearest_by_centroid(candidates, tam_node, bbox_center)
        if picked:
            return picked
    candidates = _near_candidates(tam, tam_node.keys())
    if len(candidates) == 1:
        return candidates[0]
    return None

def lookup(prv_th, amp_th, tam_th, bbox_center=None):
    """Returns (villages, real_amp_name, real_tam_name). The boundary
    shapefile has a handful of corrupted Thai district/subdistrict names in
    some provinces (DBF-width truncation, a dropped 'เมือง' prefix, or a
    single-character spelling slip) so we fall back to prefix / near-miss
    matching against the authoritative DOPA names before giving up. When a
    truncated name is an ambiguous prefix of several real names (e.g. two
    subdistricts both starting the same way), we disambiguate using which
    candidate's villages are geographically closest to the tambon's bbox
    center."""
    prv, amp, tam = norm(prv_th), norm(amp_th), norm(tam_th)
    key = (prv, amp, tam)
    if key in village_index:
        return village_index[key], amp, tam

    prv_node = nested_index.get(prv)
    if not prv_node:
        return [], amp, tam

    real_amp = _resolve_amphoe(prv, prv_node, amp)
    if real_amp is None:
        return [], amp, tam

    real_tam = _resolve_tambon(prv_node[real_amp], tam, bbox_center)
    if real_tam is None:
        return [], real_amp, tam

    return prv_node[real_amp][real_tam], real_amp, real_tam

index = {}  # province_th -> {en, amphoes: {amp_th -> {en, tambons: [...]}}}
stats = {"total_tambon": 0, "matched": 0, "unmatched": 0, "matched_villages": 0}
unmatched_list = []

province_dirs = sorted(glob.glob(os.path.join(TAMBON_DIR, "*")))
for pdir in province_dirs:
    shp_files = glob.glob(os.path.join(pdir, "*.shp"))
    if not shp_files:
        continue
    shp_path = shp_files[0]
    sf = shapefile.Reader(shp_path)
    for shape_rec in sf.iterShapeRecords():
        rec = shape_rec.record.as_dict()
        shape = shape_rec.shape
        prv_th = norm(rec.get('ADM1_TH'))
        prv_en = norm(rec.get('ADM1_EN'))
        amp_th = norm(rec.get('ADM2_TH'))
        amp_en = norm(rec.get('ADM2_EN'))
        tam_th = norm(rec.get('ADM3_TH'))
        tam_en = norm(rec.get('ADM3_EN'))
        pcode = norm(rec.get('ADM3_PCODE'))

        bbox = list(shape.bbox) if shape.bbox else None
        bbox_center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2) if bbox else None
        villages, real_amp_th, real_tam_th = lookup(prv_th, amp_th, tam_th, bbox_center)
        # prefer the authoritative (untruncated, current) DOPA names for display
        amp_th, tam_th = real_amp_th, real_tam_th

        stats["total_tambon"] += 1
        if villages:
            stats["matched"] += 1
            stats["matched_villages"] += len(villages)
        else:
            stats["unmatched"] += 1
            unmatched_list.append(f"{prv_th} / {amp_th} / {tam_th}")

        points = shape.points
        parts = list(shape.parts) + [len(points)]
        rings = []
        for i in range(len(parts) - 1):
            ring = points[parts[i]:parts[i + 1]]
            rings.append([[round(x, 6), round(y, 6)] for x, y in ring])
        bbox = list(shape.bbox) if shape.bbox else None

        tambon_record = {
            "pcode": pcode,
            "province_th": prv_th,
            "province_en": prv_en,
            "amphoe_th": amp_th,
            "amphoe_en": amp_en,
            "tambon_th": tam_th,
            "tambon_en": tam_en,
            "bbox": bbox,
            "rings": rings,
            "villages": sorted(villages, key=lambda v: v["name"]),
        }

        with open(os.path.join(OUT_TAMBON_DIR, f"{pcode}.json"), "w", encoding="utf-8") as f:
            json.dump(tambon_record, f, ensure_ascii=False, separators=(",", ":"))

        prv_node = index.setdefault(prv_th, {"en": prv_en, "amphoes": {}})
        amp_node = prv_node["amphoes"].setdefault(amp_th, {"en": amp_en, "tambons": []})
        amp_node["tambons"].append({
            "th": tam_th, "en": tam_en, "pcode": pcode, "village_count": len(villages)
        })

provinces_out = []
for prv_th in sorted(index.keys()):
    prv_node = index[prv_th]
    amphoes_out = []
    for amp_th in sorted(prv_node["amphoes"].keys()):
        amp_node = prv_node["amphoes"][amp_th]
        tambons_sorted = sorted(amp_node["tambons"], key=lambda t: t["th"])
        amphoes_out.append({"th": amp_th, "en": amp_node["en"], "tambons": tambons_sorted})
    provinces_out.append({"th": prv_th, "en": prv_node["en"], "amphoes": amphoes_out})

with open(OUT_INDEX, "w", encoding="utf-8") as f:
    json.dump({"provinces": provinces_out}, f, ensure_ascii=False, separators=(",", ":"))

print(json.dumps(stats, ensure_ascii=False, indent=2))
print(f"Unmatched sample (first 30 of {len(unmatched_list)}):")
for u in unmatched_list[:30]:
    print(" -", u)

with open(os.path.join(ROOT, "data/processed/unmatched.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(unmatched_list))
