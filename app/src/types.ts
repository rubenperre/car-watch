export type Role = "admin" | "viewer";

export interface Listing {
  id: string;
  source: string;
  make: string | null;
  model: string | null;
  title: string;
  price: number;
  first_registration: string | null;
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
  first_seen: string;
  last_seen: string;
  status: "new" | "active" | "gone";
}

export interface AllowedEmail {
  email: string;
  role: Role;
  added_at: string;
}

/** Someone who signed in with Google but is not on the allowlist (from the database function access_requests). */
export interface AccessRequest {
  email: string;
  requested_at: string;
  last_sign_in_at: string | null;
}
