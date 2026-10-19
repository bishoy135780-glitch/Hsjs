import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handleApi from "./api.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

/** dist/public next to the bundled server, or ../dist/public when run from source. */
export function resolvePublicDir(): string {
  const candidates = [
    path.resolve(here, "public"),
    path.resolve(here, "..", "dist", "public"),
    path.resolve(here, "..", "public"),
  ];
  return candidates.find(dir => existsSync(path.join(dir, "index.html"))) ?? candidates[1];
}

export function createAppServer(publicDir = resolvePublicDir()): Server {
  const root = path.resolve(publicDir);
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      void handleApi(req, res);
      return;
    }

    let pathname = "/";
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.statusCode = 400;
      res.end("Bad request");
      return;
    }

    let file = path.join(root, pathname);
    // Block path traversal outside the public folder.
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    const isFile = existsSync(file) && statSync(file).isFile();
    if (!isFile) {
      // Real assets that don't exist are a 404; everything else is the SPA.
      if (path.extname(pathname)) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      file = path.join(root, "index.html");
      if (!existsSync(file)) {
        res.statusCode = 500;
        res.end("Client build not found. Run: pnpm build");
        return;
      }
    }

    const ext = path.extname(file);
    res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
    res.setHeader(
      "Cache-Control",
      /\/assets\//.test(file) || ext === ".svg" ? "public, max-age=31536000, immutable" : "no-cache"
    );
    createReadStream(file).pipe(res);
  });
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

export async function start() {
  const preferred = parseInt(process.env.PORT || "3000", 10);
  let port = preferred;
  while (!(await isPortFree(port)) && port < preferred + 20) port += 1;
  const server = createAppServer();
  server.listen(port, () => {
    if (port !== preferred) console.log(`Port ${preferred} busy, using ${port}`);
    console.log(`YMusic running on http://localhost:${port}/`);
  });
  return server;
}

// Run only when executed directly (not when imported by tests).
const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url) || /dist[\\/]index\.js$/.test(entry)) {
  void start();
}
