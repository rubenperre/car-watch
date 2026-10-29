// Entry point for .github/workflows/admins.yml: npm run sync-admins (needs ADMIN_EMAILS in the environment).
import { parseEmails, syncAdmins } from "./admins.ts";

const emails = parseEmails(process.env.ADMIN_EMAILS ?? "");
if (emails.length === 0) {
  console.error("ADMIN_EMAILS is empty: set the secret to one or more addresses, separated by commas.");
  process.exit(1);
}
await syncAdmins(emails);
// Only the count is logged. The addresses stay secret in this public repo.
console.log(`${emails.length} admin(s) are in place`);
