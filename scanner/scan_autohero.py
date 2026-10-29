"""Autohero.com/nl-be: SUV, petrol, manual, <= 50k km, <= 20k, 2022+. Verified on each posting page.

Usage: python3 -I scan_autohero.py <out.json>
"""
import html as htmlmod
import json
import re
import sys
import time
import urllib.request

from common import min_reg_year

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
SEARCH = ("https://www.autohero.com/nl-be/search/?bodyType=suv&fuelType=petrol&transmission=manual"
          "&mileageMax=50000&priceMax=20000&yearMin={year}&page={page}")


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "nl-BE,nl;q=0.9"}), timeout=40).read().decode("utf-8", "replace")


def products(h):
    out = []
    for b in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', h, re.S):
        try:
            j = json.loads(b)
        except Exception:
            continue
        if isinstance(j, dict) and j.get("@type") == "Product":
            out.append(j)
    return out


seen = {}
for page in range(1, 6):
    h = fetch(SEARCH.format(year=min_reg_year(), page=page))
    ps = products(h)
    new = [p for p in ps if p["productID"] not in seen]
    for p in new:
        seen[p["productID"]] = p
    print(f"page {page}: {len(ps)} products, {len(new)} new", file=sys.stderr)
    if not new:
        break
    time.sleep(0.5)

rows = []
for pid, p in seen.items():
    d = fetch(p["url"])
    facts = {}
    for k, v in re.findall(r'<span class="listItemTitle[^"]*">([^<]+)</span><h5[^>]*>([^<]+)</h5>', d):
        facts[htmlmod.unescape(k).strip()] = htmlmod.unescape(v).strip()
    eq = [htmlmod.unescape(x) for x in re.findall(r'data-qa-selector="equipment-value">([^<]+)<', d)]
    blob = " ".join(eq).lower()
    gears = re.search(r"manueel\s+(\d)\s+versnellingen", blob)
    rows.append({
        "id": pid, "url": p["url"], "make": p.get("brand"), "model": p["name"], "version": p.get("description"),
        "price": p["offers"][0]["price"], "facts": facts, "equipment": eq,
        "aaExplicit": "android auto" in blob, "aaNote": "activering door koper" if "android auto (activering door koper)" in blob else "",
        "camera": bool(re.search(r"camera", blob)), "gears": int(gears.group(1)) if gears else None,
        "seller": "Autohero", "source": "Autohero",
    })
    time.sleep(0.5)
json.dump(rows, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print("done", len(rows), file=sys.stderr)
