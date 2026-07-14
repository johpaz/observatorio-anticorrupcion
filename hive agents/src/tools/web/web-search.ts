/**
 * web_search - Search the web for current information
 *
 * @category web
 * @seedId web_search
 * @spanish buscar en internet, búsqueda web, noticias, información
 */

import type { Tool } from "../types.ts";
import { logger } from "../../utils/logger.ts";

const log = logger.child("web-search");

const TIMEOUT_MS = 10_000;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchResponse {
  results: SearchResult[];
  engine: "duckduckgo" | "bing";
}

function decodeHtml(value: string): string {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeUddg(href: string): string {
  try {
    const uddg = new URL("https:" + href).searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

function isAdUrl(url: string): boolean {
  return url.includes("duckduckgo.com/y.js") || url.includes("ad_provider") || url.includes("ad_domain");
}

async function searchDuckDuckGo(query: string, numResults: number): Promise<SearchResult[]> {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  log.info(`Requesting DuckDuckGo HTML: ${searchUrl}`);

  const response = await fetch(searchUrl, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo request failed: ${response.status}`);
  }

  const html = await response.text();

  // DuckDuckGo responde 202 con un challenge anti-bot que no contiene resultados.
  if (response.status === 202 || /anomaly|captcha/i.test(html)) {
    throw new Error("DuckDuckGo anti-bot challenge");
  }

  // Extract links: href contains //duckduckgo.com/l/?uddg=ENCODED_URL
  const hrefs = [...html.matchAll(/<a[^>]+class="result__a"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const titles = [...html.matchAll(/<a[^>]+class="result__a"[^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim());
  const rawSnippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]{0,400}?)<\/a>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim()
  );

  log.debug(`DDG parsed: ${hrefs.length} links, ${titles.length} titles, ${rawSnippets.length} snippets`);

  const results: SearchResult[] = [];
  let snippetIdx = 0;

  for (let i = 0; i < hrefs.length && results.length < numResults; i++) {
    const rawUrl = hrefs[i] ?? "";
    const url = decodeUddg(rawUrl);

    // Skip ads
    if (isAdUrl(url) || isAdUrl(rawUrl)) {
      snippetIdx++; // ads also consume a snippet slot
      continue;
    }

    // Advance snippet index past ads
    while (snippetIdx < rawSnippets.length && isAdUrl(rawSnippets[snippetIdx] ?? "")) {
      snippetIdx++;
    }

    results.push({
      title: titles[i] ?? url,
      url,
      snippet: rawSnippets[snippetIdx] ?? "",
    });
    snippetIdx++;
  }

  return results;
}

async function searchBingRss(query: string, numResults: number): Promise<SearchResult[]> {
  const searchUrl = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  log.info(`Requesting Bing RSS fallback: ${searchUrl}`);

  const response = await fetch(searchUrl, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; HiveBot/1.0)" },
  });
  if (!response.ok) throw new Error(`Bing request failed: ${response.status}`);

  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  return items.slice(0, numResults).map(([, item]) => ({
    title: decodeHtml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    url: decodeHtml(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? ""),
    snippet: decodeHtml(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? ""),
  })).filter(result => result.url.startsWith("http"));
}

async function searchWeb(query: string, numResults: number): Promise<SearchResponse> {
  try {
    const results = await searchDuckDuckGo(query, numResults);
    if (results.length > 0) return { results, engine: "duckduckgo" };
    log.warn("DuckDuckGo returned no parseable results; using Bing RSS fallback");
  } catch (error) {
    log.warn(`DuckDuckGo unavailable: ${(error as Error).message}; using Bing RSS fallback`);
  }

  return { results: await searchBingRss(query, numResults), engine: "bing" };
}

export const webSearchTool: Tool = {
  name: "web_search",
  description: "Search the web for current information and research. Spanish: buscar en internet, búsqueda web, noticias, información",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query - be specific and include relevant keywords",
      },
      numResults: {
        type: "number",
        description: "Number of results to return (default: 5, max: 10)",
      },
    },
    required: ["query"],
  },
  execute: async (params: Record<string, unknown>) => {
    const query = params.query as string;
    const numResults = Math.min((params.numResults as number) ?? 5, 10);

    log.info(`Web search: "${query}"`);

    try {
      const { results, engine } = await searchWeb(query, numResults);
      log.info(`Web search returned ${results.length} results for "${query}"`);
      return { ok: true, results, query, count: results.length, engine };
    } catch (error) {
      log.error(`Search failed: ${(error as Error).message}`);
      return { ok: false, error: `Web search failed: ${(error as Error).message}` };
    }
  },
};
