import os
import re
import json
import glob
import shapefile

ROOT = os.path.expanduser("~/thailand-tambon-village-map")
VILLAGE_SHP = os.path.join(ROOT, "data/raw/village/TH_VILLAGE2012.shp")
TAMBON_DIR = os.path.join(ROOT, "data/raw/tambon_shp")
OUT_TAMBON_DIR = os.path.join(ROOT, "data/processed/tambon")
OUT_INDEX = os.path.join(ROOT, "data/processed/index.json")

os.makedirs(OUT_TAMBON_DIR, exist_ok=True)

AMP_PREFIX_RE = re.compile(r'^(กิ่ง\s*อ\.|กิ่งอำเภอ|อ\.)\s*')

def norm(s):
    if s is None:
        return ''
    return s.strip()

def norm_amp(prv_th, amp_th):
    a = AMP_PREFIX_RE.sub('', norm(amp_th))
    prefix = 'เมือง' + prv_th
    if a == prefix:
        return 'เมือง'
    return a

# Provinces whose villages are still filed under an older parent province
# in the 2012 village dataset (administrative splits that happened after).
PROVINCE_FALLBACK = {
    'บึงกาฬ': 'หนองคาย',
}

print("Loading village points...")
vsf = shapefile.Reader(VILLAGE_SHP)
village_index = {}
total_villages = 0
for shape_rec in vsf.iterShapeRecords():
    rec = shape_rec.record.as_dict()
    pts = shape_rec.shape.points
    if not pts:
        continue
    lon, lat = pts[0]
    prv = norm(rec.get('PRV_NAME'))
    amp = norm_amp(prv, rec.get('AMP_NAME'))
    tam = norm(rec.get('TAM_NAME'))
    name = norm(rec.get('NAME'))
    key = (prv, amp, tam)
    village_index.setdefault(key, []).append({"name": name, "lon": lon, "lat": lat})
    total_villages += 1

print(f"Loaded {total_villages} village points, {len(village_index)} tambon keys")

def lookup_villages(prv_th, amp_th, tam_th):
    amp_key = norm_amp(prv_th, amp_th)
    key = (norm(prv_th), amp_key, norm(tam_th))
    if key in village_index:
        return village_index[key]
    fallback_prv = PROVINCE_FALLBACK.get(norm(prv_th))
    if fallback_prv:
        key2 = (fallback_prv, amp_key, norm(tam_th))
        if key2 in village_index:
            return village_index[key2]
    return []

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

        villages = lookup_villages(prv_th, amp_th, tam_th)

        stats["total_tambon"] += 1
        if villages:
            stats["matched"] += 1
            stats["matched_villages"] += len(villages)
        else:
            stats["unmatched"] += 1
            unmatched_list.append(f"{prv_th} / {amp_th} / {tam_th}")

        # Build polygon rings (list of [lon,lat] rings) from shapefile parts
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

# Convert index dict -> sorted list structure for JSON output
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
