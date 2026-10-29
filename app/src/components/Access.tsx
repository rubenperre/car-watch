import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase";
import type { AllowedEmail, Role } from "../types";

// Admin tab: who may see the list. Row-level security lets only admins read or change this table.
export function Access({ myEmail }: { myEmail: string }) {
  const [rows, setRows] = useState<AllowedEmail[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("allowed_emails").select("*").order("added_at");
    if (error) setMessage("De lijst kon niet geladen worden.");
    else setRows((data ?? []) as AllowedEmail[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean) || !supabase) {
      setMessage("Dat is geen geldig e-mailadres.");
      return;
    }
    const { error } = await supabase.from("allowed_emails").upsert({ email: clean, role });
    setMessage(error ? "Toevoegen is niet gelukt." : `${clean} heeft nu toegang.`);
    if (!error) setEmail("");
    await load();
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

      {message && (
        <p className="sub" role="status">
          {message}
        </p>
      )}

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
    </>
  );
}
