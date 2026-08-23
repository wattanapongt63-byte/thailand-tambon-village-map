import concurrent.futures
import urllib.request
import urllib.parse
import os

BASE = "https://raw.githubusercontent.com/prasertcbs/thailand_gis/main/tambon/shapefiles_zip/"
OUT_DIR = os.path.expanduser("~/thailand-tambon-village-map/data/raw/tambon_zips")

with open(os.path.expanduser("~/thailand-tambon-village-map/data/province_zip_list.txt")) as f:
    names = [line.strip() for line in f if line.strip()]

def download(name):
    url = BASE + urllib.parse.quote(name)
    out_path = os.path.join(OUT_DIR, name)
    try:
        urllib.request.urlretrieve(url, out_path)
        size = os.path.getsize(out_path)
        return f"OK {name} ({size} bytes)"
    except Exception as e:
        return f"FAIL {name}: {e}"

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    for result in ex.map(download, names):
        print(result)
