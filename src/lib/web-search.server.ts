// Server-side web search helper.
// Uses Firecrawl (v2 /search) when FIRECRAWL_API_KEY is set; otherwise returns
// { available: false } so callers can gracefully fall back to LLM knowledge.

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  available: boolean;
  results: WebSearchResult[];
  error?: string;
}

const NEEDS_LIVE_INFO = [
  /\b(latest|recent|current|today|yesterday|this week|this month|this year)\b/i,
  /\b(news|update|announced|price|stock|weather|score|winner|won|released|launched)\b/i,
  /\b(202[4-9]|20[3-9]\d)\b/,
  /\b(who is|what is|when did|when will|where is)\b.*(now|currently|today)/i,
];

export function shouldSearchWeb(query: string): boolean {
  return NEEDS_LIVE_INFO.some((re) => re.test(query));
}

export async function webSearch(query: string, limit = 5): Promise<WebSearchResponse> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { available: false, results: [], error: "no-key" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, limit }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[webSearch] Firecrawl error", res.status, body.slice(0, 200));
      return { available: false, results: [], error: `firecrawl-${res.status}` };
    }
    const data = (await res.json()) as {
      data?: Array<{ title?: string; url?: string; description?: string; markdown?: string }>;
      web?: Array<{ title?: string; url?: string; description?: string }>;
    };
    const raw = data.data ?? data.web ?? [];
    const results: WebSearchResult[] = raw
      .filter((r) => r.url && r.title)
      .slice(0, limit)
      .map((r) => ({
        title: (r.title ?? "").trim(),
        url: r.url!,
        snippet: ((r as { description?: string; markdown?: string }).description ?? (r as { markdown?: string }).markdown ?? "").slice(0, 400),
      }));
    return { available: true, results };
  } catch (e) {
    console.warn("[webSearch] failed", e);
    return { available: false, results: [], error: (e as Error).message };
  }
}
