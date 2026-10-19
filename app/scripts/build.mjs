// Builds the client (esbuild) into dist/public (or ./public on Vercel) and bundles the Node server.
import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch");
const onVercel = Boolean(process.env.VERCEL);
const outDir = onVercel ? path.join(root, "public") : path.join(root, "dist", "public");

async function writeHtml(metafile) {
  const outputs = Object.keys(metafile.outputs).map(file => path.relative(outDir, path.resolve(root, file)).split(path.sep).join("/"));
  const js = outputs.find(f => f.endsWith(".js"));
  const css = outputs.find(f => f.endsWith(".css"));
  let html = await readFile(path.join(root, "client", "index.html"), "utf8");
  html = html.replace("/assets/main.js", `/${js}`).replace("/assets/main.css", `/${css}`);
  await writeFile(path.join(outDir, "index.html"), html);
}

const clientOptions = {
  entryPoints: [path.join(root, "client/src/main.tsx")],
  bundle: true,
  format: "esm",
  target: "es2020",
  jsx: "automatic",
  outdir: path.join(outDir, "assets"),
  entryNames: "[name]-[hash]",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  metafile: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  logLevel: "info",
  plugins: [
    {
      name: "html",
      setup(b) {
        b.onEnd(async result => {
          if (result.metafile) await writeHtml(result.metafile);
        });
      },
    },
  ],
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(path.join(root, "client", "public"), outDir, { recursive: true });

if (watch) {
  const ctx = await context(clientOptions);
  await ctx.watch();
  console.log("Watching client… (refresh the browser after changes)");
} else {
  await build(clientOptions);
  if (!onVercel) {
    await build({
      entryPoints: [path.join(root, "server/index.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node20",
      outfile: path.join(root, "dist", "index.js"),
      packages: "external",
      logLevel: "info",
    });
  }
}
