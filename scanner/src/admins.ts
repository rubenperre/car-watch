import { createClient } from "@supabase/supabase-js";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "A@x.com, b@y.com;c@z.com" -> ["a@x.com", "b@y.com", "c@z.com"] (lower case, no duplicates). */
export function parseEmails(input: string): string[] {
  const emails = input
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Do not echo the offending value: it may be a real address and the log is public.
  if (emails.some((e) => !EMAIL.test(e))) throw new Error("ADMIN_EMAILS contains something that is not an email address");
  return [...new Set(emails)];
}

/** Makes these emails admins. People who are already admins stay admins; nobody is removed. */
export async function syncAdmins(emails: string[]): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from("allowed_emails").upsert(
    emails.map((email) => ({ email, role: "admin" })),
    { onConflict: "email" },
  );
  if (error) throw new Error(`could not add admins: ${error.message}`);
}
