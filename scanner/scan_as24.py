"""AutoScout24.be crossover scan, v2: SUV body types only, verified on each posting page.

Usage: python3 -I scan2.py <out.json>
"""
import json
import math
import re
import sys
import time
import urllib.error
import urllib.request

from common import min_reg, min_reg_year

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
BASE = "https://www.autoscout24.be"
IEPER = (50.8514, 2.8850)

MODELS = [
    "skoda/karoq", "skoda/kamiq", "skoda/kodiaq", "seat/ateca", "seat/arona", "cupra/ateca",
    "volkswagen/t-roc", "volkswagen/t-cross", "volkswagen/tiguan", "kia/xceed", "kia/sportage", "kia/stonic",
    "hyundai/kona", "hyundai/bayon", "hyundai/tucson", "suzuki/s-cross", "suzuki/vitara", "ford/puma",
    "ford/kuga", "mazda/cx-30", "mazda/cx-5", "mazda/cx-3", "opel/mokka", "opel/grandland", "peugeot/2008",
    "peugeot/3008", "renault/captur", "renault/arkana", "nissan/juke", "nissan/qashqai", "dacia/duster",
    "toyota/c-hr", "toyota/yaris-cross", "honda/hr-v", "mitsubishi/asx", "citroen/c3-aircross",
    "citroen/c5-aircross", "jeep/renegade", "fiat/500x", "audi/q2", "bmw/x1", "mini/countryman", "volvo/xc40",
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "nl-BE,nl;q=0.9"})
    return urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "replace")


def next_data(h):
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', h, re.S)
    return json.loads(m.group(1))["props"]["pageProps"] if m else None


def flanders(zipcode):
    try:
        z = int(str(zipcode)[:4])
    except ValueError:
        return False
    return 1500 <= z <= 3999 or 8000 <= z <= 9999


def reg_ok(first_reg):
    try:
        mm, yy = first_reg.split("-")
        return f"{int(yy):04d}-{int(mm):02d}" >= min_reg()
    except Exception:
        return False


def strip_html(s):
    s = re.sub(r"<br\s*/?>", "\n", s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).replace("&amp;", "&").replace("&#x27;", "'")


_zip = {}


def distance_km(zipcode):
    if zipcode not in _zip:
        try:
            d = json.loads(fetch(f"https://api.zippopotam.us/be/{zipcode}"))
            p = d["places"][0]
            _zip[zipcode] = (float(p["latitude"]), float(p["longitude"]))
        except Exception:
            _zip[zipcode] = None
        time.sleep(0.15)
    c = _zip[zipcode]
    if not c:
        return None
    la1, lo1, la2, lo2 = map(math.radians, (*IEPER, *c))
    a = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return round(2 * 6371 * math.asin(math.sqrt(a)) * 1.3)  # straight line x 1.3 as a road estimate


cands = {}
for model in MODELS:
    page = 1
    while page <= 5:
        url = (f"{BASE}/nl/lst/{model}?atype=C&cy=B&fregfrom={min_reg_year()}&gear=M&fuel=B&kmto=50000&priceto=20000"
               f"&sort=age&desc=1&page={page}")
        try:
            pp = next_data(fetch(url))
        except Exception as e:
            print(f"{model}: {e}", file=sys.stderr)
            break
        if not pp:
            break
        for l in pp.get("listings", []):
            tr, loc, veh = l.get("tracking", {}), l.get("location", {}), l.get("vehicle", {})
            if not (reg_ok(tr.get("firstRegistration", "")) and int(tr.get("mileage") or 10**9) <= 50000
                    and int(tr.get("price") or 10**9) <= 20000 and flanders(loc.get("zip", ""))):
                continue
            if veh.get("transmission") != "Manueel" or veh.get("fuel") != "Benzine":
                continue
            cands[l["id"]] = {
                "id": l["id"], "url": BASE + l["url"], "make": veh.get("make"), "model": veh.get("model"),
                "version": veh.get("modelVersionInput"), "firstRegistration": tr.get("firstRegistration"),
                "km": int(tr.get("mileage")), "price": int(tr.get("price")),
                "zip": loc.get("zip"), "town": loc.get("city"),
                "seller": l.get("seller", {}).get("companyName"), "sellerType": l.get("seller", {}).get("type"),
                "phone": ((l.get("seller", {}).get("phones") or [{}])[0]).get("formattedNumber"),
                "source": "AutoScout24.be",
            }
        if page >= int(pp.get("numberOfPages") or 1):
            break
        page += 1
        time.sleep(0.4)
    print(f"{model}: {len(cands)} total so far", file=sys.stderr)
    time.sleep(0.4)

print(f"{len(cands)} candidates, opening posting pages", file=sys.stderr)
drop = []
for cid, c in cands.items():
    try:
        dd = next_data(fetch(c["url"]))["listingDetails"]
    except Exception as e:
        c["detailError"] = str(e)
        continue
    v = dd.get("vehicle", {})
    c["bodyType"] = v.get("bodyType")
    if "SUV" not in (c["bodyType"] or ""):
        drop.append(cid)
        continue
    eq = []
    for cat in (v.get("equipment") or {}).values():
        for it in cat or []:
            eq.append(it.get("id", ""))
    desc = strip_html(dd.get("description", ""))
    blob = " ".join([desc, " ".join(eq), dd.get("title") or "", c["version"] or ""]).lower()
    c["equipment"] = eq
    c["aaExplicit"] = bool(re.search(r"android\s*auto", blob))
    c["aaInferred"] = bool(re.search(r"app[- ]?connect|full link|smartlink|mirrorlink", blob))
    c["camera"] = bool(re.search(r"camera|caméra", blob))
    gm = re.search(r"(\d)\s*[- ]?(?:speed|versnellingen|vitesses|gangen)|\bman(?:ueel)?[ -]?(\d)\b|\b(\d)\s?mt\b|\bmt(\d)\b|\bm(\d)f?\b", blob)
    c["gears"] = v.get("gears") or next((int(g) for g in (gm.groups() if gm else ()) if g), None)
    c["powerKw"] = v.get("rawPowerInKw")
    c["engine"] = v.get("motorTypeName")
    c["seats"] = v.get("numberOfSeats")
    c["owners"] = v.get("noOfPreviousOwners")
    c["accident"] = v.get("hadAccident")
    c["serviceHistory"] = v.get("hasFullServiceHistory")
    c["carpass"] = v.get("carpassMileageUrl")
    c["warranty"] = dd.get("warranty") or ("garantie" in blob)
    c["description"] = desc[:1200]
    c["distanceKm"] = distance_km(c["zip"])
    time.sleep(0.4)
for cid in drop:
    cands.pop(cid, None)

json.dump(list(cands.values()), open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print("done", len(cands), file=sys.stderr)
