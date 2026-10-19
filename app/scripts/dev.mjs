// Dev: rebuilds the client on change and restarts the server on change.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = args => spawn(process.execPath, args, { cwd: root, stdio: "inherit", env: process.env });

const client = run(["scripts/build.mjs", "--watch"]);
const server = run(["--import", "tsx", "--watch", "server/index.ts"]);

const stop = () => {
  client.kill();
  server.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
client.on("exit", code => code && stop());
server.on("exit", code => code && stop());
