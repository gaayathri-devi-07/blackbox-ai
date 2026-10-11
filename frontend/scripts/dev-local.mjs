/**
 * One-command local development without installing PostgreSQL or Docker.
 *
 *   npm run dev:local        start database → migrate → seed → next dev
 *   npm run db:local         start only the database (keep the terminal open)
 *
 * The database runs from an npm-provided PostgreSQL 17 binary and stores its
 * data in frontend/.local-db (git-ignored). Stop with Ctrl+C.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, ".local-db");
const PORT = Number(process.env.LOCAL_DB_PORT ?? 54320);
const DB_NAME = "blackbox";
const DATABASE_URL = `postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}?schema=public`;
const dbOnly = process.argv.includes("--db-only");

const log = (msg) => console.log(`\x1b[36m[local]\x1b[0m ${msg}`);

const server = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: "postgres",
  password: "postgres",
  persistent: true,
  // UTF-8 regardless of the Windows locale (the question bank has non-ASCII text).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (e) => {
    const text = String(e ?? "");
    if (/error|fatal/i.test(text)) console.error(text);
  },
});

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    // All arguments are fixed strings, so a single command line is safe here.
    const child = spawn([command, ...args].join(" "), {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, DATABASE_URL, ...extraEnv },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`))));
  });
}

let nextProcess = null;
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  log("Shutting down…");
  nextProcess?.kill();
  try {
    await server.stop();
  } catch {
    /* already stopped */
  }
  process.exit(code);
}
process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

/** GET a local JSON endpoint (plain http, no keep-alive), or null on any failure. */
function getJson(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { agent: false, timeout: 3000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

/** True if something already answers on the given local port. */
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/**
 * A second copy can't share the .next lock or the database port, so explain
 * what is already running instead of crashing. Returns an exit code to stop
 * with, or null to continue.
 */
async function preflight() {
  if (await portInUse(3000)) {
    let health = null;
    // A degraded app answers 503 with a JSON body, so read it regardless of status.
    health = await getJson("http://127.0.0.1:3000/api/health");
    if (health && "database" in health && health.database === "ok") {
      log("Blackbox is already running — open http://localhost:3000 in your browser.");
      log("To restart it, press Ctrl+C in the terminal where it's running, then run this again.");
      return 0;
    }
    if (health && "database" in health) {
      log("Blackbox is running on port 3000 WITHOUT its database (started with `npm run dev`).");
      log("Press Ctrl+C in that terminal to stop it, then run `npm run dev:local` — it starts the database and the site together.");
      return 1;
    }
    log("Port 3000 is used by another program. Close it, then run this again.");
    return 1;
  }
  if (await portInUse(PORT)) {
    log(`Port ${PORT} (the local database) is already in use. Close the other terminal running Blackbox, or set LOCAL_DB_PORT to another port.`);
    return 1;
  }
  return null;
}

async function main() {
  const stop = await preflight();
  if (stop !== null) {
    // Let the process end naturally; process.exit() here can trip a libuv assertion on Windows.
    process.exitCode = stop;
    return;
  }

  try {
    if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
      log("First run: initialising a local PostgreSQL 17 database (one-time, ~10 s)…");
      await server.initialise();
    }
    await server.start();
    log(`PostgreSQL running on port ${PORT}`);

    const admin = new pg.Client({ connectionString: `postgresql://postgres:postgres@localhost:${PORT}/postgres` });
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
    if (!exists.rowCount) {
      await admin.query(`CREATE DATABASE ${DB_NAME} WITH ENCODING 'UTF8' TEMPLATE template0`);
      log(`Created database "${DB_NAME}"`);
    }
    await admin.end();

    log("Applying migrations…");
    await run("npx", ["prisma", "migrate", "deploy"]);
    log("Seeding the practice question bank…");
    await run("npx", ["prisma", "db", "seed"]);

    if (dbOnly) {
      log(`Database ready. DATABASE_URL=${DATABASE_URL}`);
      log("Leave this terminal open; press Ctrl+C to stop.");
    } else {
      log("Starting the website at http://localhost:3000 …");
      nextProcess = spawn("npx next dev", {
        cwd: ROOT,
        stdio: "inherit",
        shell: true,
        env: { ...process.env, DATABASE_URL },
      });
      nextProcess.on("exit", (code) => void shutdown(code ?? 0));
    }
  } catch (error) {
    console.error(error);
    if (String(error).includes("EADDRINUSE") || String(error).includes("already in use")) {
      console.error(`Port ${PORT} is busy. Set LOCAL_DB_PORT to another port and retry.`);
    }
    await shutdown(1);
  }
}

await main();
