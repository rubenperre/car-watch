const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** GET a page like a browser would. Throws on any non-2xx answer. */
export async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "nl-BE,nl;q=0.9" },
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Obj = Record<string, any>;

/** The JSON that Next.js sites embed in <script id="__NEXT_DATA__">. */
export function nextData(html: string): Obj | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s.exec(html);
  return m?.[1] ? (JSON.parse(m[1]) as Obj) : null;
}

/** Every <script type="application/ld+json"> block that parses. */
export function ldJson(html: string): Obj[] {
  const out: Obj[] = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
    try {
      out.push(JSON.parse(m[1] ?? "") as Obj);
    } catch {
      /* ignore blocks that are not valid JSON */
    }
  }
  return out;
}
