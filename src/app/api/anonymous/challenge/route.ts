import { NextResponse } from "next/server";
import { handler } from "@/server/http";
import { issueChallenge } from "@/server/pow";

export const GET = handler(async () => NextResponse.json(issueChallenge(), { headers: { "Cache-Control": "no-store" } }));