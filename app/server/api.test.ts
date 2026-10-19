import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, before, after, describe, it } from "node:test";
import { parsePlaylistId } from "./api.js";
import { createAppServer } from "./index.js";
import { clearCache, parsePlaylist, parseSearch } from "./youtube.js";

const realFetch = globalThis.fetch;

const searchPayload = {
  contents: [
    {
      videoRenderer: {
        videoId: "abcdefghijk",
        title: { runs: [{ text: "Late Night " }, { text: "Mix" }] },
        ownerText: { runs: [{ text: "YMusic Radio" }] },
        lengthText: { simpleText: "1:02:03" },
        viewCountText: { simpleText: "1.2M views" },
        publishedTimeText: { simpleText: "2 days ago" },
        thumbnail: {
          thumbnails: [{ url: "https://img.test/s.jpg" }, { url: "https://img.test/l.jpg" }],
        },
      },
    },
    // duplicate id and an invalid id must both be skipped
    { videoRenderer: { videoId: "abcdefghijk", title: { simpleText: "dup" } } },
    { videoRenderer: { videoId: "bad", title: { simpleText: "bad id" } } },
    {
      videoRenderer: {
        videoId: "ZZZZZZZZZZZ",
        title: { simpleText: "Second" },
        badges: [{ metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_LIVE_NOW" } }],
      },
    },
  ],
};

function mockFetch(handler: (url: string) => unknown, status = 200) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return new Response(JSON.stringify(handler(url)), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

describe("youtube parsing", () => {
  it("parses search results, de-duplicates and fills defaults", () => {
    const tracks = parseSearch(searchPayload, 10);
    assert.equal(tracks.length, 2);
    assert.deepEqual(tracks[0], {
      id: "abcdefghijk",
      title: "Late Night Mix",
      channel: "YMusic Radio",
      duration: "1:02:03",
      views: "1.2M views",
      published: "2 days ago",
      thumbnail: "https://img.test/l.jpg",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
    });
    assert.equal(tracks[1].duration, "مباشر");
    assert.equal(tracks[1].thumbnail, "https://i.ytimg.com/vi/ZZZZZZZZZZZ/hqdefault.jpg");
  });

  it("respects the limit", () => {
    assert.equal(parseSearch(searchPayload, 1).length, 1);
  });

  it("parses a playlist with its title", () => {
    const data = {
      metadata: { playlistMetadataRenderer: { title: "My Mix" } },
      contents: [
        {
          playlistVideoRenderer: {
            videoId: "abcdefghijk",
            title: { runs: [{ text: "One" }] },
            shortBylineText: { runs: [{ text: "Chan" }] },
            lengthText: { simpleText: "3:00" },
          },
        },
      ],
    };
    const playlist = parsePlaylist(data, "PL123");
    assert.equal(playlist.title, "My Mix");
    assert.equal(playlist.tracks[0].channel, "Chan");
  });

  it("extracts playlist ids from links", () => {
    assert.equal(parsePlaylistId("https://youtube.com/watch?v=x&list=PLabc_123-xyz"), "PLabc_123-xyz");
    assert.equal(parsePlaylistId("PLabc_123-xyz"), "PLabc_123-xyz");
    assert.equal(parsePlaylistId("nope!"), "");
  });
});

describe("HTTP server", () => {
  let base = "";
  let server: ReturnType<typeof createAppServer>;
  const dir = mkdtempSync(path.join(os.tmpdir(), "ymusic-"));

  before(async () => {
    mkdirSync(path.join(dir, "assets"));
    writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>spa</title>");
    writeFileSync(path.join(dir, "assets", "a.js"), "console.log(1)");
    writeFileSync(path.join(path.dirname(dir), "secret.txt"), "secret");
    server = createAppServer(dir);
    await new Promise<void>(resolve => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());
  afterEach(() => {
    globalThis.fetch = realFetch;
    clearCache();
  });

  // Requests to our own server must use the real fetch.
  const get = (p: string) => realFetch(base + p);

  it("GET /api/search returns tracks and caches upstream", async () => {
    const calls = mockFetch(() => searchPayload);
    const first = await (await get("/api/search?q=hello&limit=5")).json();
    const second = await (await get("/api/search?q=hello&limit=5")).json();
    assert.equal(first.length, 2);
    assert.deepEqual(first, second);
    assert.equal(calls.filter(u => u.includes("youtubei/v1/search")).length, 1);
  });

  it("validates search input", async () => {
    const calls = mockFetch(() => searchPayload);
    assert.equal((await get("/api/search?q=%20%20")).status, 400);
    assert.equal((await get("/api/search")).status, 400);
    assert.equal(calls.length, 0);
  });

  it("maps upstream failures to 502", async () => {
    mockFetch(() => ({}), 500);
    const res = await get("/api/search?q=fail");
    assert.equal(res.status, 502);
  });

  it("GET /api/playlist imports a playlist", async () => {
    mockFetch(() => ({
      metadata: { playlistMetadataRenderer: { title: "Imported" } },
      contents: [{ playlistVideoRenderer: { videoId: "abcdefghijk", title: { simpleText: "T" } } }],
    }));
    const res = await get("/api/playlist?id=" + encodeURIComponent("https://youtube.com/playlist?list=PLabcdefghij"));
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.title, "Imported");
    assert.equal(body.tracks.length, 1);
    assert.equal((await get("/api/playlist?id=%21%21")).status, 400);
  });

  it("GET /api/suggest returns strings and never fails", async () => {
    mockFetch(() => ["q", ["lofi", "lofi hip hop"]]);
    assert.deepEqual(await (await get("/api/suggest?q=lo")).json(), ["lofi", "lofi hip hop"]);
    mockFetch(() => ({}), 500);
    assert.deepEqual(await (await get("/api/suggest?q=zz")).json(), []);
  });

  it("sends CORS headers and answers preflight", async () => {
    mockFetch(() => searchPayload);
    const res = await get("/api/search?q=cors");
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    const pre = await realFetch(base + "/api/search", { method: "OPTIONS" });
    assert.equal(pre.status, 204);
  });

  it("still answers legacy tRPC URLs (older app builds)", async () => {
    mockFetch(() => searchPayload);
    const input = encodeURIComponent(JSON.stringify({ json: { query: "legacy", limit: 5 } }));
    const body = await (await get(`/api/trpc/youtube.search?input=${input}`)).json();
    assert.equal(body.result.data.json.length, 2);
    const health = await (await get("/api/trpc/system.health")).json();
    assert.equal(health.result.data.json.ok, true);
  });

  it("serves static files, SPA fallback, 404 for missing assets", async () => {
    assert.equal((await get("/assets/a.js")).status, 200);
    const spa = await get("/library");
    assert.match(await spa.text(), /spa/);
    assert.equal((await get("/missing.js")).status, 404);
    assert.equal((await get("/api/nope")).status, 404);
  });

  it("blocks path traversal", async () => {
    const res = await get("/..%2fsecret.txt");
    assert.notEqual(res.status, 200);
    assert.doesNotMatch(await res.text(), /secret$/);
  });
});
