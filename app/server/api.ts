import type { IncomingMessage, ServerResponse } from "node:http";
import { getPlaylist, searchYouTube, suggest } from "./youtube.js";

function cors(res: ServerResponse) {
  // The Android app (https://localhost) calls this API cross-origin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  cacheControl = "no-store"
) {
  cors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  res.end(JSON.stringify(body));
}

const PUBLIC_CACHE = "public, max-age=60, s-maxage=600, stale-while-revalidate=3600";

/** Extracts a playlist id from a full URL or returns the raw id. */
export function parsePlaylistId(value: string): string {
  const match = value.match(/[?&]list=([\w-]+)/);
  const id = (match?.[1] ?? value).trim();
  return /^[\w-]{10,64}$/.test(id) ? id : "";
}

/**
 * Handles every /api/* request. Works as a plain Node handler, so it can be
 * used by the local server and exported as a Vercel function.
 */
export default async function handleApi(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");

  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    // Legacy tRPC-style URLs (older app builds): /api/trpc/youtube.search?input={"json":{...}}
    if (route.startsWith("trpc/")) return await legacyTrpc(route.slice(5), url, res);

    if (route === "health") return send(res, 200, { ok: true });

    if (route === "search") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q || q.length > 120) return send(res, 400, { error: "q is required (max 120 chars)" });
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 12, 1), 30);
      return send(res, 200, await searchYouTube(q, limit), PUBLIC_CACHE);
    }

    if (route === "playlist") {
      const id = parsePlaylistId(url.searchParams.get("id") ?? "");
      if (!id) return send(res, 400, { error: "Invalid playlist id or link" });
      const playlist = await getPlaylist(id);
      if (!playlist.tracks.length) return send(res, 404, { error: "Playlist is empty or private" });
      return send(res, 200, playlist, PUBLIC_CACHE);
    }

    if (route === "suggest") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q || q.length > 80) return send(res, 200, []);
      try {
        return send(res, 200, await suggest(q), PUBLIC_CACHE);
      } catch {
        return send(res, 200, []); // suggestions are optional
      }
    }

    return send(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("[api]", route, error);
    return send(res, 502, {
      error: error instanceof Error ? error.message : "Upstream request failed",
    });
  }
}

/** Keeps apps built against the previous tRPC API working. */
async function legacyTrpc(procedure: string, url: URL, res: ServerResponse) {
  const ok = (data: unknown) => send(res, 200, { result: { data: { json: data } } }, PUBLIC_CACHE);
  const fail = (status: number, message: string) =>
    send(res, status, { error: { json: { message, code: -32603, data: { httpStatus: status, path: procedure } } } });

  let input: Record<string, unknown> = {};
  try {
    const raw = url.searchParams.get("input");
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const first = parsed["0"] as { json?: Record<string, unknown> } | undefined;
      input = (first?.json ?? (parsed.json as Record<string, unknown>) ?? parsed) as Record<string, unknown>;
    }
  } catch {
    return fail(400, "Invalid input");
  }

  try {
    if (procedure === "system.health") return ok({ ok: true });
    if (procedure === "youtube.search") {
      const q = typeof input.query === "string" ? input.query.trim() : "";
      if (!q || q.length > 120) return fail(400, "Search query is required");
      const limit = Math.min(Math.max(Math.trunc(Number(input.limit)) || 8, 1), 20);
      return ok(await searchYouTube(q, limit));
    }
    if (procedure === "youtube.playlist") {
      const id = parsePlaylistId(typeof input.playlistId === "string" ? input.playlistId : "");
      if (!id) return fail(400, "Playlist ID is required");
      return ok((await getPlaylist(id)).tracks);
    }
    return fail(404, "Unknown API procedure");
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Request failed");
  }
}
