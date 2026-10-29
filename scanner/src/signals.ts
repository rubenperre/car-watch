// Reading Android Auto, camera and gears out of posting text. Pass the text lower-cased or not, it is case-insensitive.

export const aaExplicit = (text: string): boolean => /android\s*auto/i.test(text);

/** Systems that include Android Auto but do not name it. A weaker signal than aaExplicit. */
export const aaInferred = (text: string): boolean => /app[- ]?connect|full link|smartlink|mirrorlink/i.test(text);

export const hasCamera = (text: string): boolean => /camera|caméra/i.test(text);

// "6 speed", "6 versnellingen", "man 6", "6mt", "mt6", "m5f". Only 4 to 9: the old Python version also matched
// the "0 mt" in "1.0 mt tce" and treated such cars as having 0 gears.
const GEARS = /\b([4-9])\s*[- ]?(?:speed|versnellingen|vitesses|gangen)|\bman(?:ueel)?[ -]?([4-9])\b|\b([4-9])\s?mt\b|\bmt([4-9])\b|\bm([4-9])f?\b/i;

export function gearsFromText(text: string): number | null {
  const m = GEARS.exec(text);
  const found = m?.slice(1).find((g) => g !== undefined);
  return found ? Number(found) : null;
}
