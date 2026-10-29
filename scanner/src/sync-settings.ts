// Entry point for .github/workflows/settings.yml: npm run sync-settings (needs NTFY_TOPIC in the environment).
import { parseTopic, syncNtfyTopic } from "./settings.ts";

await syncNtfyTopic(parseTopic(process.env.NTFY_TOPIC ?? ""));
console.log("ntfy topic is stored"); // never log the topic itself
