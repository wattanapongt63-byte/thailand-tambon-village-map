import concurrent.futures
import urllib.request
import json
import os

OUT_DIR = os.path.expanduser("~/thailand-tambon-village-map/data/raw/dopa_village")
os.makedirs(OUT_DIR, exist_ok=True)

with open("/tmp/dopa_resources.txt", encoding="utf-8") as f:
    lines = [l.strip() for l in f if l.strip()]

jobs = []
for line in lines:
    fmt, name, url = line.split("|", 2)
    if fmt != "JSON" or "data_dictionary" in name:
        continue
    province = name.replace("ข้อมูลที่ตั้งและสภาพทั่วไปของหมู่บ้าน จังหวัด", "").strip()
    jobs.append((province, url))

print(f"{len(jobs)} province files to download")

def download(job):
    province, url = job
    out_path = os.path.join(OUT_DIR, f"{province}.json")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        with open(out_path, "wb") as f:
            f.write(data)
        # sanity check it's valid JSON
        json.loads(data)
        return f"OK {province} ({len(data)} bytes)"
    except Exception as e:
        return f"FAIL {province}: {e}"

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    for result in ex.map(download, jobs):
        print(result)
