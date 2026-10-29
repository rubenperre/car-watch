import { createClient } from "@supabase/supabase-js";

// The topic is the password of the push channel on ntfy.sh, so it must be long and random.
const TOPIC = /^[A-Za-z0-9_-]{20,64}$/;

export function parseTopic(input: string): string {
  const topic = input.trim();
  // Do not echo the value: the log of this public repo must not contain it.
  if (!TOPIC.test(topic)) throw new Error("NTFY_TOPIC must be 20 to 64 characters: letters, digits, - and _");
  return topic;
}

/** Stores the topic in the locked app_settings table, where only the sign-up trigger can read it. */
export async function syncNtfyTopic(topic: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from("app_settings").upsert({ key: "ntfy_topic", value: topic }, { onConflict: "key" });
  if (error) throw new Error(`could not store the topic: ${error.message}`);
}
