// The search criteria. Change them here (and in app/src/components/CarList.tsx, which shows them).
export const MAX_KM = 50_000;
export const MAX_PRICE = 20_000;
/** Cars from AutoScout24 further than this (estimated road km from Ieper) are not uploaded. */
export const NEAR_KM = 110;
/** A car missing from this many scans in a row is marked "gone". */
export const GONE_AFTER_RUNS = 3;
export const IEPER = { lat: 50.8514, lon: 2.885 };

/**
 * Earliest allowed first registration as YYYY-MM: the car must be under 4 years old.
 * 29 Oct 2026 gives "2022-11". It moves forward one month each month.
 */
export function minReg(today: Date = new Date()): string {
  let year = today.getFullYear() - 4;
  let month = today.getMonth() + 2; // getMonth() is 0-based, and the month after is the first allowed one
  if (month === 13) {
    year += 1;
    month = 1;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export const minRegYear = (today: Date = new Date()): number => Number(minReg(today).slice(0, 4));

/** Brands that are never wanted (standing rule from the earlier car searches). Compared without accents or case. */
const EXCLUDED_MAKES = ["dacia", "citroen"];

export function isExcludedMake(make: string | null | undefined): boolean {
  const plain = (make ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
  return EXCLUDED_MAKES.includes(plain);
}

/** Flanders: Belgian postcodes 1500-3999 and 8000-9999 (Wallonia and Brussels are out). */
export function isFlanders(zip: string | number | null | undefined): boolean {
  const z = Number(String(zip ?? "").slice(0, 4));
  return (z >= 1500 && z <= 3999) || (z >= 8000 && z <= 9999);
}
