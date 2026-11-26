import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./rbac";

/** Wraps a route handler: maps known errors to safe messages, never leaks internals. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.publicMessage }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json({ error: "Invalid input", fields: e.issues.map((i) => i.path.join(".")) }, { status: 400 });
      }
      console.error("[api]", e instanceof Error ? e.message : "unknown error");
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

/** CSRF: SameSite=Strict cookies + same-origin check on mutating requests. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new HttpError(403, "Forbidden");
}
