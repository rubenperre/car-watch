import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Access } from "./components/Access";
import { CarList } from "./components/CarList";
import { Message } from "./components/Message";
import { configured, supabase } from "./supabase";
import type { Role } from "./types";

type AccessState =
  | { state: "loading" }
  | { state: "denied" }
  | { state: "error"; message: string }
  | { state: "ok"; role: Role };
type Tab = "cars" | "access";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [access, setAccess] = useState<AccessState>({ state: "loading" });
  const [tab, setTab] = useState<Tab>("cars");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Ask the database who this is. The answer comes from my_role(): null unless signed in with
  // Google and on the allowlist. The same check is what lets the database return rows at all.
  useEffect(() => {
    if (!supabase || !session) return;
    setAccess({ state: "loading" });
    supabase.rpc("my_role").then(({ data, error }) => {
      // An error is not the same as "not on the list": show it, so a broken setup is not mistaken for no access.
      if (error) setAccess({ state: "error", message: error.message });
      else if (data !== "admin" && data !== "viewer") setAccess({ state: "denied" });
      else setAccess({ state: "ok", role: data });
    });
  }, [session]);

  if (!configured || !supabase) {
    return (
      <Message title="Niet ingesteld">
        <p>
          Deze build mist <code>VITE_SUPABASE_URL</code> of <code>VITE_SUPABASE_ANON_KEY</code>. Kopieer{" "}
          <code>app/.env.example</code> naar <code>app/.env</code> en vul de waarden in.
        </p>
      </Message>
    );
  }

  if (session === undefined) return <Message title="Laden..." />;

  if (session === null) {
    return (
      <Message title="Autozoeker Ieper">
        <p>Log in met je Google-account om de lijst te zien.</p>
        <button
          className="btn"
          type="button"
          onClick={() =>
            supabase?.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
            })
          }
        >
          Inloggen met Google
        </button>
      </Message>
    );
  }

  const email = session.user.email ?? "onbekend";
  const signOut = () => supabase?.auth.signOut();

  if (access.state === "loading") return <Message title="Laden..." />;

  if (access.state === "error") {
    return (
      <Message title="Er ging iets mis">
        <p>
          De toegangscontrole is mislukt voor <b>{email}</b>. Dit is een fout in de instelling, geen weigering.
        </p>
        <p>
          <code>{access.message}</code>
        </p>
        <button className="btn secondary" type="button" onClick={signOut}>
          Uitloggen
        </button>
      </Message>
    );
  }

  if (access.state === "denied") {
    return (
      <Message title="Geen toegang">
        <p>
          Je bent ingelogd als <b>{email}</b>, maar dit account staat niet op de lijst. Vraag Ruben om toegang
          te geven, of log in met een ander Google-account.
        </p>
        <button className="btn secondary" type="button" onClick={signOut}>
          Uitloggen
        </button>
      </Message>
    );
  }

  return (
    <div className="wrap">
      <nav aria-label="Navigatie">
        <button type="button" aria-current={tab === "cars" ? "page" : undefined} onClick={() => setTab("cars")}>
          Auto's
        </button>
        {access.role === "admin" && (
          <button type="button" aria-current={tab === "access" ? "page" : undefined} onClick={() => setTab("access")}>
            Toegang
          </button>
        )}
        <span className="who">{email}</span>
        <button type="button" className="quiet" onClick={signOut}>
          Uitloggen
        </button>
      </nav>
      {tab === "cars" || access.role !== "admin" ? <CarList /> : <Access myEmail={email} />}
    </div>
  );
}
