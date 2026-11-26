import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handler } from "@/server/http";
import { closeTracking, openTracking } from "@/server/anonymous";

const Body = z.object({ reference: z.string().max(30), key: z.string().max(60) });

/** POST: unlock one case with reference + secret key (sets a 30-minute cookie). DELETE: lock it again. */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const { reference, key } = Body.parse(await req.json());
  const ref = await openTracking(reference, key);
  return NextResponse.json({ next: `/track/${ref}` });
});

export const DELETE = handler(async (req: Request) => {
  assertSameOrigin(req);
  await closeTracking();
  return NextResponse.json({ ok: true });
});
