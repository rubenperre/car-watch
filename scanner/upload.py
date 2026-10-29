"""Upload the qualifying cars from merged.json to Supabase (table `listings`).

Usage:  python3 upload.py [--dry-run]
Needs:  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (not for --dry-run).

The service_role key bypasses row-level security. It lives only in GitHub Actions secrets and in
your local shell. Never put it in app/ or in a VITE_* variable.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

TODAY = date.today().isoformat()
NEAR_KM = 110  # estimated road km from Ieper; AutoScout24 cars further away are not uploaded
GONE_AFTER_RUNS = 3
PREFIX = {"AutoScout24.be": "as24", "Autohero": "ah", "Cardoen.be": "cd"}
dry = "--dry-run" in sys.argv


def evidence(r):
    items = [e for e in (r.get("equipment") or []) if re.search(r"android|camera|caméra", e, re.I)]
    if not items and r.get("description"):
        for m in re.finditer(r"android\s*auto|camera|caméra", r["description"], re.I):
            items.append(r["description"][max(0, m.start() - 20):m.end() + 20].strip())
            if len(items) >= 2:
                break
    return "; ".join(dict.fromkeys(items))[:160] or None


def near(r):
    return r["source"] != "AutoScout24.be" or (r.get("distanceKm") is not None and r["distanceKm"] <= NEAR_KM)


def build_rows(path="merged.json"):
    out = {}
    for r in json.load(open(path)):
        if not (r.get("gearsOk") and not r.get("pt") and near(r)):
            continue
        aa, cam = r["aa"] != "nee", r["cam"] == "ja"
        if not (aa or cam):
            continue
        rid = f"{PREFIX.get(r['source'], 'x')}-{re.sub(r'[^A-Za-z0-9_-]', '', str(r['id']))[:60]}"
        out[rid] = {
            "id": rid, "source": r["source"], "make": r.get("make"), "model": r.get("model"),
            "title": f"{r['make']} {r['model']} {r.get('version') or ''}".replace("  ", " ").strip()[:90],
            "price": r["price"], "first_registration": r["reg"], "km": r["km"], "gears": r.get("gearsEff"),
            "seller": r.get("seller") or ("Particulier" if r.get("sellerType") == "PrivateSeller" else None),
            "phone": r.get("phone") or None, "town": r.get("town") or None, "zip": r.get("zip") or None,
            "distance_km": r.get("distanceKm"),
            "android_auto": "confirmed" if aa else "missing", "camera": "confirmed" if cam else "missing",
            "evidence": evidence(r), "url": r["url"], "match": "full" if (aa and cam) else "partial",
            "bigger": bool(r.get("big")), "owners": int(r["owners"]) if str(r.get("owners", "")).isdigit() else None,
            "no_accident": r.get("accident") is False, "service_history": bool(r.get("serviceHistory")),
            "private_seller": r.get("sellerType") == "PrivateSeller", "is_new": r["km"] < 500,
        }
    return out


def api(method, path, body=None, prefer=None):
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/" + path
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=headers), timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase {method} {path.split('?')[0]} failed: HTTP {e.code} {e.read().decode()[:300]}")


def main():
    rows = build_rows()
    print(f"{len(rows)} qualifying cars in merged.json")
    if not rows:
        sys.exit("No cars in merged.json: the scan probably failed or a site blocked us. Nothing was changed.")
    if dry:
        for r in list(rows.values())[:3]:
            print(json.dumps(r, ensure_ascii=False)[:300])
        return

    existing = {r["id"]: r for r in api("GET", "listings?select=id,status,missing_runs&limit=5000")}
    fresh = [dict(r, first_seen=TODAY, last_seen=TODAY, missing_runs=0, status="new") for i, r in rows.items() if i not in existing]
    known = [dict(r, last_seen=TODAY, missing_runs=0, status="active") for i, r in rows.items() if i in existing]
    for batch in (fresh, known):
        if batch:
            api("POST", "listings?on_conflict=id", batch, prefer="resolution=merge-duplicates,return=minimal")

    gone = 0
    for i, old in existing.items():
        if i in rows or old["status"] == "gone":
            continue
        misses = (old.get("missing_runs") or 0) + 1
        patch = {"missing_runs": misses}
        if misses >= GONE_AFTER_RUNS:
            patch["status"] = "gone"
            gone += 1
        api("PATCH", "listings?id=eq." + urllib.parse.quote(i, safe=""), patch, prefer="return=minimal")
    print(f"uploaded: {len(fresh)} new, {len(known)} seen again, {gone} marked gone")


main()
