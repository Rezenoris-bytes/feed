import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";

// Shared hosting (Hostinger) limits how many MySQL connections one account may hold. Prisma's default pool is
// 2 × CPUs + 1 per process, and Hostinger servers report many CPUs; during a redeploy the old and new app run
// side by side, so the default pool can exhaust the limit and new connections get refused ("Can't reach
// database server"). A small pool is plenty for this app. Values already in DATABASE_URL win.
function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const defaults = { connection_limit: "5", pool_timeout: "10", connect_timeout: "5" };
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

function createClient() {
  return new PrismaClient({ log: ["error"], datasourceUrl: databaseUrl() }).$extends({
    query: {
      async $allOperations({ args, query }) {
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
      },
    },
  });
}

const g = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };
export const prisma = g.prisma ?? createClient();
// Keep one client per process in production too, so hot paths never open a second pool.
g.prisma = prisma;
