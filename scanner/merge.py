import json
import re

from common import min_reg

# Models counted as bigger than a B-segment crossover (closer to the Karoq): ranked up.
BIG = {"karoq", "ateca", "kodiaq", "tiguan", "sportage", "tucson", "kuga", "cx-5", "duster", "qashqai", "grandland",
       "grandland x", "3008", "vitara", "s-cross", "t-roc", "xceed", "kona", "puma", "cx-30", "tivoli", "renegade", "500x", "juke", "arkana"}
PURETECH = re.compile(r"puretech|1\.2 turbo|1\.2t|ecotec", re.I)


def reg_key(r):
    s = r["firstRegistration"]
    if "." in s:  # 31.03.2022
        d, m, y = s.split(".")
        return f"{y}-{m}"
    if "-" in s and len(s.split("-")[0]) == 2:  # 04-2024
        m, y = s.split("-")
        return f"{y}-{m}"
    return s[:7]


def to_int(x):
    if isinstance(x, (int, float)):
        return int(x)
    return int(re.sub(r"[^\d]", "", x))


rows = []
for r in json.load(open("as24_v2.json")):
    r = dict(r)
    r["reg"] = reg_key(r)
    r["aa"] = "ja" if r.get("aaExplicit") else ("app-connect (afgeleid)" if r.get("aaInferred") else "nee")
    r["cam"] = "ja" if r.get("camera") else "nee"
    rows.append(r)
for r in json.load(open("autohero.json")):
    f = r["facts"]
    r["reg"] = reg_key({"firstRegistration": f.get("Eerste inschrijving", "")})
    r["km"] = to_int(f.get("Kilometerstand", "0"))
    r["firstRegistration"] = r["reg"]
    r["town"] = "levering aan huis"
    r["distanceKm"] = None
    r["aa"] = "ja" + (" (activeren door koper)" if r.get("aaNote") else "") if r.get("aaExplicit") else "nee"
    r["cam"] = "ja" if r.get("camera") else "nee"
    r["engine"] = f.get("Vermogen")
    r["owners"] = f.get("Aantal vorige eigenaren")
    rows.append(r)
for r in json.load(open("cardoen.json")):
    r["reg"] = r["firstRegistration"]
    r["town"] = "Cardoen"
    r["distanceKm"] = None
    r["aa"] = "ja" if r.get("aaExplicit") else "nee"
    r["cam"] = "ja" if r.get("camera") else "nee"
    rows.append(r)

AUTO_TITLE = re.compile(r"automaat|\baut\.|\bdsg\b|\bedc\b|\bcvt\b|\beat\d|\bdct\b|s-tronic|tiptronic|automatic|\bat\b|\bdkg\b", re.I)
out = []
conflicts = []
for r in rows:
    if not (r["reg"] >= min_reg() and r["km"] <= 50000 and r["price"] <= 20000):
        continue
    if AUTO_TITLE.search(" ".join([r.get("version") or "", r.get("title") or ""])):
        conflicts.append(r)  # data says manual but the title says automatic: leave out, do not guess
        continue
    g = r.get("gears")
    r["gearsKnown"] = g
    if g is None:
        # 70 kW (95 PK) VW-group 1.0 TSI is a 5-speed; everything else unknown here
        if r["make"] in ("Skoda", "SEAT", "Volkswagen") and r.get("powerKw") and r["powerKw"] <= 70:
            g = 5
    r["gearsEff"] = g
    if g is not None and g < 6:
        continue
    r["gearsOk"] = g is not None and g >= 6
    r["ok"] = r["aa"] != "nee" and r["cam"] == "ja"
    r["pt"] = bool(PURETECH.search(r.get("version") or "")) or r["make"] in ("Citroen", "Peugeot", "Opel", "DS")
    r["big"] = (r["model"] or "").lower() in BIG
    out.append(r)


def score(r):
    s = 0
    s += 40 if r["ok"] else (15 if (r["aa"] != "nee" or r["cam"] == "ja") else 0)
    s += 10 if r["gearsEff"] and r["gearsEff"] >= 6 else 0
    s += 8 if r["big"] else 0
    s -= 12 if r["pt"] else 0
    s += 6 if (r.get("powerKw") or 0) >= 85 else 0
    d = r.get("distanceKm")
    s += max(0, 12 - (d or 120) / 10)
    s += max(0, (50000 - r["km"]) / 5000)
    s += max(0, (20000 - r["price"]) / 1500)
    return s


out.sort(key=score, reverse=True)
print(len(conflicts), "left out: title says automatic although the data says manual:", [(c["model"], c["town"]) for c in conflicts][:10])
json.dump(out, open("merged.json", "w"), ensure_ascii=False, indent=1)
print(len(rows), "records,", len(out), "pass age/km/price/gears;", sum(1 for r in out if r["ok"]), "have Android Auto + camera")
for r in out[:45]:
    print(f"{r['source'][:5]:5} {r['make']} {r['model']} {str(r.get('version'))[:34]:34} {r['reg']} {r['km']:>6} km EUR{r['price']:>6} {str(r.get('town'))[:14]:14} d={r.get('distanceKm')} AA={r['aa'][:5]:5} cam={r['cam']} g={r['gearsEff']} {'PT' if r['pt'] else ''}")
