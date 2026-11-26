import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handler } from "@/server/http";
import { anonymousMessage } from "@/server/anonymous";

const Body = z.object({ reference: z.string().max(30), body: z.string().trim().min(1).max(5000) });

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const { reference, body } = Body.parse(await req.json());
  await anonymousMessage(reference, body);
  return NextResponse.json({ ok: true });
});
