"""Cardoen.be: SUV, petrol, manual used cars, verified on each posting page.

Usage: python3 -I scan_cardoen.py <out.json>
"""
import html as htmlmod
import json
import re
import sys
import time
import urllib.request

from common import min_reg

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
LIST = "https://www.cardoen.be/nl/auto-kopen/tweedehands/suv/benzine/manueel/?page={}"


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "nl-BE,nl;q=0.9"}), timeout=40).read().decode("utf-8", "replace")


urls = {}
for page in range(1, 8):
    h = fetch(LIST.format(page))
    m = re.search(r'id="srp-item-list-jsonld"[^>]*>(.*?)</script>', h, re.S)
    items = json.loads(m.group(1))["itemListElement"] if m else []
    new = 0
    for it in items:
        u = it["item"]["url"]
        if u not in urls:
            urls[u] = it["item"]
            new += 1
    print(f"page {page}: {len(items)} items, {new} new", file=sys.stderr)
    if not new:
        break
    time.sleep(0.5)

rows = []
for u, item in urls.items():
    d = fetch(u)
    m = re.search(r'id="vdp-car-jsonld"[^>]*>(.*?)</script>', d, re.S)
    if not m:
        continue
    j = json.loads(m.group(1))
    reg = (j.get("dateVehicleFirstRegistered") or "")[:7]  # YYYY-MM
    km = (j.get("mileageFromOdometer") or {}).get("value")
    price = (j.get("offers") or {}).get("price")
    if not (reg >= min_reg() and km is not None and km <= 50000 and price is not None and price <= 20000):
        continue
    spans = [htmlmod.unescape(s).strip() for s in re.findall(r'ds-text--body--xsmall ds-text--normal"><!--\[--><!--\[-->([^<]+)<!--\]-->', d)]
    blob = " ".join(spans).lower() + " " + (item.get("name") or "").lower()
    gm = re.search(r"aantal versnellingen\s*:\s*(\d+)", d, re.I)
    rows.append({
        "id": j.get("sku"), "url": u, "make": (j.get("brand") or {}).get("name"), "model": j.get("model"),
        "version": item.get("name"), "firstRegistration": reg, "km": km, "price": price,
        "powerKw": ((j.get("vehicleEngine") or {}).get("enginePower") or {}).get("value"),
        "equipment": spans, "aaExplicit": "android auto" in blob, "camera": bool(re.search(r"camera|caméra", blob)),
        "gears": int(gm.group(1)) if gm else None, "seller": "Cardoen", "source": "Cardoen.be",
    })
    time.sleep(0.5)
json.dump(rows, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print("done", len(urls), "checked,", len(rows), "match age/km/price", file=sys.stderr)
