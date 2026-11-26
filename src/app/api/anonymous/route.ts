import { NextResponse } from "next/server";
import { assertSameOrigin, handler } from "@/server/http";
import { AnonSubmitInput, submitAnonymous } from "@/server/anonymous";

/** No login. Deliberately reads nothing about the caller: no session, IP, or user agent. */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const form = await req.formData();
  const input = AnonSubmitInput.parse({
    title: form.get("title"), description: form.get("description"), categoryId: form.get("categoryId"),
    priorityId: form.get("priorityId"), departmentId: form.get("departmentId") ?? "",
    accessCode: form.get("accessCode") ?? "", challenge: form.get("challenge"), counter: form.get("counter"),
  });
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const result = await submitAnonymous(input, files);
  return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
});
