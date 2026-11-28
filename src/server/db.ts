import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";

// Shared hosting (Hostinger) limits how many MySQL connections one account may hold at once. Two things here keep
// this app well under that limit, including during redeploys when an old copy of the app may still be running:
//  1. a small pool (3 connections) instead of Prisma's default of 2 × CPUs + 1, and
//  2. letting go of the database completely after 30 s without queries (it reconnects on the next request),
//     so an idle or left-over copy of the app holds no connections at all.
// Values already present in DATABASE_URL win over these defaults.
function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const defaults = { connection_limit: "3", pool_timeout: "10", connect_timeout: "5" };
    for (const [k, v] of Object.entries(defaults)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return raw;
  }
}

// Errors where the query never reached the database, so trying again cannot run it twice:
// P1001 can't reach server, P1002 server timed out, P2024 no free connection in the pool.
const TRANSIENT = new Set(["P1001", "P1002", "P2024"]);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const IDLE_MS = 30_000;

function createClient() {
  const base = new PrismaClient({ log: ["error"], datasourceUrl: databaseUrl() });
  let inFlight = 0;
  let lastUsed = Date.now();
  let connected = false;
  let disconnecting: Promise<void> | null = null;

  // Close the pool when nothing has run for a while. unref(): never keeps the process alive on its own.
  setInterval(() => {
    if (!connected || inFlight > 0 || disconnecting || Date.now() - lastUsed < IDLE_MS) return;
    connected = false;
    disconnecting = base.$disconnect().catch(() => {}).finally(() => { disconnecting = null; });
  }, 10_000).unref();

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        if (disconnecting) await disconnecting; // never start a query while the pool is being closed
        inFlight++; connected = true;
        try {
          for (let attempt = 0; ; attempt++) {
            try {
              return await query(args);
            } catch (e) {
              const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code
                : e instanceof Prisma.PrismaClientInitializationError ? e.errorCode : undefined;
              if (!code || !TRANSIENT.has(code) || attempt >= 2) throw e;
              await wait(1000 * (attempt + 1)); // 1s, then 2s: rides out the few seconds a redeploy takes
            }
          }
        } finally {
          inFlight--; lastUsed = Date.now();
        }
      },
    },
  });
}

const g = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };
export const prisma = g.prisma ?? createClient();
// Keep one client per process in production too, so hot paths never open a second pool.
g.prisma = prisma;
