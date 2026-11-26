import { NextResponse } from "next/server";
import { destroySession } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  await destroySession();
  return NextResponse.json({ ok: true });
});
