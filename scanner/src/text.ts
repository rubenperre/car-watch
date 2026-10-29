// Small pure helpers for reading posting text. No network, easy to test.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripHtml(s: string | null | undefined): string {
  const noBreaks = (s ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  return decodeEntities(noBreaks).replace(/\s+/g, " ").trim();
}

/** "41.795 km" -> 41795 */
export function digits(s: string | null | undefined): number | null {
  const d = (s ?? "").replace(/[^\d]/g, "");
  return d ? Number(d) : null;
}

/** Straight-line distance in km between two points. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Road distance estimate: straight line times 1.3. */
export const roadKm = (straight: number): number => Math.round(straight * 1.3);
