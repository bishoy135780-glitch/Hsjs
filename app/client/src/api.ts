import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "./config";
import type { Track } from "./types";

export type PlaylistData = { id: string; title: string; tracks: Track[] };

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { signal });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(message), { status: response.status });
  }
  // An old deployment answers unknown /api/* paths with index.html (200) — treat that as "not found".
  if (!(response.headers.get("content-type") ?? "").includes("json")) {
    throw Object.assign(new Error("Not an API response"), { status: 404 });
  }
  return (await response.json()) as T;
}

/** Older deployments only expose tRPC-style URLs; used as a fallback when /api/search is 404. */
async function legacy<T>(procedure: string, input: unknown, signal?: AbortSignal): Promise<T> {
  // getJson prefixes API_BASE; keep this path relative to avoid producing
  // https://hosthttps://host/... inside the Android client.
  const url = `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const payload = await getJson<{ result?: { data?: { json?: T } } }>(url, signal);
  const data = payload.result?.data?.json;
  if (data === undefined) throw new Error("Unexpected API response");
  return data;
}

async function withLegacy<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    if ((error as { status?: number }).status === 404) return fallback();
    throw error;
  }
}

async function nativeSearch(query: string, limit: number): Promise<Track[]> {
  const plugins = (window as unknown as {
    Capacitor?: {
      Plugins?: {
        YoutubeSearch?: {
          search?: (input: { query: string; limit: number }) => Promise<{ results?: Track[] }>;
        };
      };
    };
  }).Capacitor?.Plugins;
  const search = plugins?.YoutubeSearch?.search;
  if (!search) throw new Error("لا يوجد محرك بحث بديل داخل التطبيق");
  const result = await search({ query, limit: Math.min(limit, 20) });
  if (!Array.isArray(result.results)) throw new Error("محرك البحث أعاد صيغة غير صحيحة");
  return result.results;
}

export const api = {
  search: async (q: string, limit = 12, signal?: AbortSignal) => {
    try {
      return await getJson<Track[]>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`, signal);
    } catch (primaryError) {
      try {
        return await legacy<Track[]>("youtube.search", { query: q, limit: Math.min(limit, 20) }, signal);
      } catch (legacyError) {
        try {
          return await nativeSearch(q, limit);
        } catch {
          throw legacyError instanceof Error ? legacyError : primaryError;
        }
      }
    }
  },
  playlist: (idOrUrl: string) =>
    withLegacy(
      () => getJson<PlaylistData>(`/api/playlist?id=${encodeURIComponent(idOrUrl)}`),
      async () => {
        const id = idOrUrl.match(/[?&]list=([\w-]+)/)?.[1] ?? idOrUrl.trim();
        const tracks = await legacy<Track[]>("youtube.playlist", { playlistId: id });
        return { id, title: "", tracks };
      }
    ),
  suggest: (q: string, signal?: AbortSignal) =>
    getJson<string[]>(`/api/suggest?q=${encodeURIComponent(q)}`, signal).catch(() => [] as string[]),
};

/* ---- tiny cached async hook (replaces react-query) ---- */

const store = new Map<string, { data?: unknown; error?: Error; at: number; promise?: Promise<void> }>();
const STALE_MS = 10 * 60_000;

export function useAsync<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  enabled = true
): { data: T | undefined; error: Error | undefined; loading: boolean; retry: () => void } {
  const [, force] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    (fresh = false) => {
      if (!key) return;
      const entry = store.get(key);
      if (entry?.promise) return;
      if (!fresh && entry?.data !== undefined && Date.now() - entry.at < STALE_MS) return;
      const promise = fetcherRef
        .current()
        .then(data => {
          store.set(key, { data, at: Date.now() });
        })
        .catch((error: unknown) => {
          store.set(key, {
            data: entry?.data,
            error: error instanceof Error ? error : new Error(String(error)),
            at: 0,
          });
        })
        .finally(() => force(n => n + 1));
      store.set(key, { ...(entry ?? { at: 0 }), error: undefined, promise });
      force(n => n + 1);
    },
    [key]
  );

  useEffect(() => {
    if (enabled) run();
  }, [enabled, run]);

  const entry = key ? store.get(key) : undefined;
  return {
    data: entry?.data as T | undefined,
    error: entry?.promise ? undefined : entry?.error,
    loading: Boolean(key && enabled && !entry?.error && entry?.data === undefined),
    retry: () => run(true),
  };
}

export function useSearch(query: string | null, limit = 12, enabled = true) {
  return useAsync<Track[]>(
    query ? `search:${query}:${limit}` : null,
    () => api.search(query as string, limit),
    enabled
  );
}
