/**
 * YouTube helpers (no API key needed).
 * Uses the same internal "youtubei" endpoints the web client uses.
 * Shared by the local Node server and the Vercel function.
 */

export type Track = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  published: string;
  thumbnail: string;
  url: string;
};

export type PlaylistData = {
  id: string;
  title: string;
  tracks: Track[];
};

export type PlaylistSearchResult = {
  id: string;
  title: string;
  channel: string;
  videoCount: string;
  thumbnail: string;
  url: string;
};

const BASE = "https://www.youtube.com/youtubei/v1";
export const SEARCH_URL = `${BASE}/search?prettyPrint=false`;
export const BROWSE_URL = `${BASE}/browse?prettyPrint=false`;
const SUGGEST_URL = "https://suggestqueries.google.com/complete/search";
const CLIENT_VERSION = process.env.YT_CLIENT_VERSION || "2.20241010.01.00";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
  Accept: "application/json",
  "Content-Type": "application/json",
  Origin: "https://www.youtube.com",
  Referer: "https://www.youtube.com/",
};

/* ----------------------------- parsing ----------------------------- */

type Json = Record<string, unknown>;

export function textFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const item = value as { simpleText?: string; runs?: Array<{ text?: string }> };
  if (typeof item.simpleText === "string") return item.simpleText;
  return Array.isArray(item.runs)
    ? item.runs.map(run => run.text ?? "").join("")
    : "";
}

/** Depth-first search for every object stored under `key`. */
export function findAll(value: unknown, key: string, out: Json[] = []): Json[] {
  if (Array.isArray(value)) {
    for (const item of value) findAll(item, key, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  const obj = value as Json;
  const hit = obj[key];
  if (hit && typeof hit === "object") out.push(hit as Json);
  for (const child of Object.values(obj)) findAll(child, key, out);
  return out;
}

function pickThumbnail(item: Json, id: string): string {
  const thumbs = (item.thumbnail as { thumbnails?: Array<{ url?: string }> } | undefined)
    ?.thumbnails;
  const url = thumbs?.at(-1)?.url;
  if (typeof url === "string" && url.startsWith("http")) return url;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function pickPlaylistThumbnail(item: Json, id: string): string {
  const thumbs = (item.thumbnails as Array<{ thumbnails?: Array<{ url?: string }> }> | undefined)
    ?.flatMap(group => group.thumbnails ?? []);
  const url = thumbs?.at(-1)?.url;
  return typeof url === "string" && url.startsWith("http")
    ? url
    : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function toTrack(item: Json, channelKeys: string[]): Track | null {
  const id = typeof item.videoId === "string" ? item.videoId : "";
  if (!/^[\w-]{11}$/.test(id)) return null;
  let channel = "";
  for (const key of channelKeys) {
    channel = textFrom(item[key]);
    if (channel) break;
  }
  const live = Array.isArray(item.badges)
    ? JSON.stringify(item.badges).includes("LIVE")
    : false;
  return {
    id,
    title: textFrom(item.title) || "بدون عنوان",
    channel: channel || "قناة غير معروفة",
    duration: textFrom(item.lengthText) || (live ? "مباشر" : ""),
    views: textFrom(item.viewCountText),
    published: textFrom(item.publishedTimeText),
    thumbnail: pickThumbnail(item, id),
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

export function parseSearch(data: unknown, limit: number): Track[] {
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const item of findAll(data, "videoRenderer")) {
    const track = toTrack(item, ["ownerText", "longBylineText", "shortBylineText"]);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
    if (tracks.length >= limit) break;
  }
  return tracks;
}

export function parseSearchPlaylists(data: unknown, limit: number): PlaylistSearchResult[] {
  const playlists: PlaylistSearchResult[] = [];
  const seen = new Set<string>();
  for (const item of findAll(data, "playlistRenderer")) {
    const id = typeof item.playlistId === "string" ? item.playlistId : "";
    if (!/^[\w-]{10,64}$/.test(id) || seen.has(id)) continue;
    const title = textFrom(item.title).trim();
    if (!title) continue;
    seen.add(id);
    playlists.push({
      id,
      title,
      channel: textFrom(item.longBylineText) || textFrom(item.shortBylineText) || "",
      videoCount: textFrom(item.videoCountText),
      thumbnail: pickPlaylistThumbnail(item, id),
      url: `https://www.youtube.com/playlist?list=${id}`,
    });
    if (playlists.length >= limit) break;
  }
  return playlists;
}

export function parsePlaylist(data: unknown, id: string, limit = 200): PlaylistData {
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const item of findAll(data, "playlistVideoRenderer")) {
    const track = toTrack(item, ["shortBylineText", "longBylineText"]);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
    if (tracks.length >= limit) break;
  }
  const title =
    textFrom(findAll(data, "playlistHeaderRenderer")[0]?.title) ||
    textFrom(findAll(data, "playlistMetadataRenderer")[0]?.title) ||
    "";
  return { id, title: title.trim(), tracks };
}

/* ------------------------------ cache ------------------------------ */

const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_CACHE = 300;

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const promise = load()
    .then(value => {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export function clearCache() {
  cache.clear();
  inflight.clear();
}

/* ------------------------------ network ----------------------------- */

async function post(url: string, body: unknown): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return await response.json();
      lastError = new Error(`YouTube returned ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("YouTube request failed");
}

function context() {
  return { client: { clientName: "WEB", clientVersion: CLIENT_VERSION, hl: "ar", gl: "EG" } };
}

export function searchYouTube(query: string, limit = 12): Promise<Track[]> {
  const q = query.trim();
  return cached(`s:${q.toLowerCase()}:${limit}`, 10 * 60_000, async () => {
    const data = await post(SEARCH_URL, { context: context(), query: q });
    return parseSearch(data, limit);
  });
}

export function searchPlaylists(query: string, limit = 8): Promise<PlaylistSearchResult[]> {
  const q = query.trim();
  return cached(`sp:${q.toLowerCase()}:${limit}`, 10 * 60_000, async () => {
    const data = await post(SEARCH_URL, { context: context(), query: q });
    return parseSearchPlaylists(data, limit);
  });
}

export function getPlaylist(playlistId: string): Promise<PlaylistData> {
  return cached(`p:${playlistId}`, 10 * 60_000, async () => {
    const data = await post(BROWSE_URL, { context: context(), browseId: `VL${playlistId}` });
    return parsePlaylist(data, playlistId);
  });
}

export function suggest(query: string): Promise<string[]> {
  const q = query.trim();
  return cached(`g:${q.toLowerCase()}`, 30 * 60_000, async () => {
    const url = `${SUGGEST_URL}?client=firefox&ds=yt&hl=ar&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": HEADERS["User-Agent"] },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`Suggest returned ${response.status}`);
    const data: unknown = await response.json();
    const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    return list.filter((s): s is string => typeof s === "string").slice(0, 8);
  });
}
