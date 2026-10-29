export type Source = "AutoScout24.be" | "Autohero" | "Cardoen.be";

/** One posting, read from the site's own pages. Every scanner returns this shape. */
export interface Car {
  source: Source;
  id: string;
  url: string;
  make: string;
  model: string;
  version: string;
  /** First registration as YYYY-MM. */
  reg: string;
  km: number;
  price: number;
  town: string | null;
  zip: string | null;
  /** Estimated road km from Ieper, null when the seller has no fixed location (delivery). */
  distanceKm: number | null;
  seller: string | null;
  privateSeller: boolean;
  phone: string | null;
  /** Equipment lines exactly as the posting lists them. */
  equipment: string[];
  description: string;
  gears: number | null;
  powerKw: number | null;
  owners: number | null;
  accident: boolean | null;
  serviceHistory: boolean | null;
  /** "Android Auto" is written in the posting. */
  aaExplicit: boolean;
  /** Not written, but the posting names a system that includes it (App-Connect, Full Link, SmartLink). */
  aaInferred: boolean;
  aaNeedsActivation: boolean;
  camera: boolean;
}

/** A Car after filtering and ranking. */
export interface Ranked extends Car {
  gearsEff: number | null;
  gearsOk: boolean;
  /** Stellantis PureTech engine family: ranked last (poor reliability numbers). */
  pt: boolean;
  /** A bigger crossover, closer to a Karoq. */
  big: boolean;
  aaOk: boolean;
  /** Android Auto and a camera are both in the posting. */
  ok: boolean;
  score: number;
}

/** A row of the Supabase table `listings` (see supabase/migrations/0001_init.sql). */
export interface ListingRow {
  id: string;
  source: Source;
  make: string;
  model: string;
  title: string;
  price: number;
  first_registration: string;
  km: number;
  gears: number | null;
  seller: string | null;
  phone: string | null;
  town: string | null;
  zip: string | null;
  distance_km: number | null;
  android_auto: "confirmed" | "missing";
  camera: "confirmed" | "missing";
  evidence: string | null;
  url: string;
  match: "full" | "partial";
  bigger: boolean;
  owners: number | null;
  no_accident: boolean;
  service_history: boolean;
  private_seller: boolean;
  is_new: boolean;
}
