import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase";
import type { AccessRequest, AllowedEmail, Role } from "../types";

const when = (iso: string) => new Date(iso).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });

// Admin tab: who may see the list, and who is asking. Row-level security lets only admins read or change
// the allowlist, and access_requests() returns rows to admins only.
export function Access({ myEmail }: { myEmail: string }) {
  const [rows, setRows] = useState<AllowedEmail[] | null>(null);
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [allowed, asking] = await Promise.all([
      supabase.from("allowed_emails").select("*").order("added_at"),
      supabase.rpc("access_requests"),
    ]);
    if (allowed.error) setMessage("De lijst kon niet geladen worden.");
    else setRows((allowed.data ?? []) as AllowedEmail[]);
    if (asking.error) setMessage("De aanvragen konden niet geladen worden.");
    else setRequests((asking.data ?? []) as AccessRequest[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function allow(target: string, as: Role) {
    if (!supabase) return;
    const clean = target.trim().toLowerCase();
    const { error } = await supabase.from("allowed_emails").upsert({ email: clean, role: as });
    setMessage(error ? "Toegang geven is niet gelukt." : `${clean} heeft nu toegang.`);
    await load();
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setMessage("Dat is geen geldig e-mailadres.");
      return;
    }
    await allow(clean, role);
    setEmail("");
  }

  async function remove(target: string) {
    if (!supabase) return;
    const { error } = await supabase.from("allowed_emails").delete().eq("email", target);
    setMessage(error ? "Verwijderen is niet gelukt." : `${target} heeft geen toegang meer.`);
    await load();
  }

  return (
    <>
      <header>
        <h1>Toegang</h1>
        <p className="sub">
          Alleen deze Google-accounts zien de lijst. Gebruik het adres waarmee iemand in Google inlogt (op een
          Android-telefoon is dat het hoofdadres van de telefoon).
        </p>
      </header>

      {message && (
        <p className="sub" role="status">
          {message}
        </p>
      )}

      <section aria-labelledby="requests-title">
        <h2 id="requests-title">Aanvragen</h2>
        <ul>
          {requests !== null && requests.length === 0 && <li className="empty">Niemand wacht op toegang.</li>}
          {(requests ?? []).map((r) => (
            <li key={r.email} className="car">
              <div className="title">{r.email}</div>
              <div className="price">{when(r.requested_at)}</div>
              <div className="actions">
                <button className="btn" type="button" onClick={() => allow(r.email, "viewer")}>
                  Toegang geven
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="allowed-title">
        <h2 id="allowed-title">Heeft toegang</h2>
        <form className="row" onSubmit={add}>
          <label htmlFor="new-email">E-mailadres</label>
          <input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="new-role">Rol</label>
          <select id="new-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="viewer">Kijken</option>
            <option value="admin">Beheerder</option>
          </select>
          <button className="btn" type="submit">
            Toevoegen
          </button>
        </form>

        <ul>
          {(rows ?? []).map((r) => (
            <li key={r.email} className="car">
              <div className="title">{r.email}</div>
              <div className="price">{r.role === "admin" ? "Beheerder" : "Kijken"}</div>
              <div className="actions">
                {r.email === myEmail ? (
                  <span className="src">Dit ben jij</span>
                ) : (
                  <button className="btn secondary" type="button" onClick={() => remove(r.email)}>
                    Toegang intrekken
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
