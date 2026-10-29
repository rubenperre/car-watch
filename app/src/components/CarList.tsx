import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type { Listing } from "../types";

type Filter = "full" | "all" | "near" | "big";
type Sort = "distance" | "price" | "km" | "reg";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "full", label: "Android Auto + camera" },
  { key: "all", label: "Ook met één van de twee" },
  { key: "near", label: "Binnen 60 km" },
  { key: "big", label: "Grotere SUV" },
];

const num = (n: number) => n.toLocaleString("nl-BE");
const dist = (l: Listing) => l.distance_km ?? 500;

function safeUrl(url: string): string | null {
  return /^https:\/\//.test(url) ? url : null;
}

export function CarList() {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("full");
  const [sort, setSort] = useState<Sort>("distance");

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("listings")
      .select("*")
      .neq("status", "gone")
      .then(({ data, error: err }) => {
        if (err) setError("De lijst kon niet geladen worden.");
        else setRows((data ?? []) as Listing[]);
      });
  }, []);

  const shown = useMemo(() => {
    const list = (rows ?? []).filter((l) => {
      if (filter === "full") return l.match === "full";
      if (filter === "near") return l.match === "full" && dist(l) <= 60;
      if (filter === "big") return l.match === "full" && l.bigger;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "price") return a.price - b.price;
      if (sort === "km") return a.km - b.km;
      if (sort === "reg") return (b.first_registration ?? "").localeCompare(a.first_registration ?? "");
      return dist(a) - dist(b) || a.price - b.price;
    });
  }, [rows, filter, sort]);

  const full = (rows ?? []).filter((l) => l.match === "full");
  const latest = (rows ?? []).reduce((m, l) => (l.last_seen > m ? l.last_seen : m), "");

  return (
    <>
      <header>
        <h1>Autozoeker Ieper</h1>
        <p className="sub">
          Benzine met handgeschakelde bak. Elke auto is gelezen op zijn eigen advertentie. Klik op "Open
          advertentie" om de auto te bekijken of de verkoper te bellen.
        </p>
        <div className="crit">
          {["Vanaf 11/2022", "Max 50.000 km", "Max €20.000", "Manueel, min. 6 versnellingen", "Benzine", "Android Auto + camera", "Liefst SUV", "Binnen 110 km van Ieper"].map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </header>

      <div className="bar" aria-live="polite">
        {error ? (
          error
        ) : rows === null ? (
          "Laden..."
        ) : (
          <>
            <span>
              Auto's met Android Auto + camera: <b>{full.length}</b>
            </span>
            <span>
              Binnen 60 km: <b>{full.filter((l) => dist(l) <= 60).length}</b>
            </span>
            <span>
              Laatst bijgewerkt: <b>{latest || "nog niets"}</b>
            </span>
          </>
        )}
      </div>

      <div className="controls">
        <div className="filters" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <label htmlFor="sort">
          Sorteer op{" "}
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="distance">Afstand tot Ieper</option>
            <option value="price">Prijs</option>
            <option value="km">Kilometerstand</option>
            <option value="reg">Nieuwste eerst</option>
          </select>
        </label>
      </div>

      <ul>
        {rows !== null && shown.length === 0 && (
          <li className="empty">{rows.length ? "Geen auto's voor dit filter." : "Nog geen auto's. De dagelijkse zoekronde vult deze lijst."}</li>
        )}
        {shown.map((l) => {
          const link = safeUrl(l.url);
          return (
            <li key={l.id} className="car">
              <div className="title">{l.title}</div>
              <div className="price">€{num(l.price)}</div>
              <div className="meta">
                <span className="n">{l.first_registration}</span>
                <span className="n">{num(l.km)} km</span>
                {l.gears != null && <span className="n">{l.gears} versnellingen</span>}
                {l.seller && <span>{l.seller}</span>}
                <span>
                  {l.town}
                  {l.distance_km != null && ` (ca. ${l.distance_km} km van Ieper)`}
                </span>
              </div>
              <div className="pills">
                {l.is_new && <span className="pill new">nieuw of demo</span>}
                {l.status === "new" && <span className="pill new">nieuw op de lijst</span>}
                <span className={`pill ${l.android_auto === "confirmed" ? "ok" : "miss"}`}>
                  Android Auto {l.android_auto === "confirmed" ? "in advertentie" : "niet vermeld"}
                </span>
                <span className={`pill ${l.camera === "confirmed" ? "ok" : "miss"}`}>
                  Camera {l.camera === "confirmed" ? "in advertentie" : "niet vermeld"}
                </span>
                {l.bigger && <span className="pill info">grotere SUV</span>}
                {l.no_accident && <span className="pill info">ongevalvrij</span>}
                {l.service_history && <span className="pill info">onderhoudshistoriek</span>}
                {l.private_seller && <span className="pill miss">particulier, geen dealergarantie</span>}
              </div>
              {l.evidence && <div className="note">Uit de advertentie: {l.evidence}</div>}
              <div className="actions">
                {link && (
                  <a className="open" href={link} target="_blank" rel="noopener noreferrer">
                    Open advertentie
                  </a>
                )}
                {l.phone && <span className="phone">{l.phone}</span>}
                <span className="src">{l.source}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
