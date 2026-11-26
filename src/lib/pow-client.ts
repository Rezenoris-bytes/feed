"use client";

/** Solves the server's proof-of-work challenge in the browser (Web Crypto, no third party). */
export async function solveChallenge(): Promise<{ challenge: string; counter: string }> {
  const res = await fetch("/api/anonymous/challenge", { cache: "no-store" });
  if (!res.ok) throw new Error("Anonymous submissions are not available right now");
  const { challenge, difficulty } = (await res.json()) as { challenge: string; difficulty: number };
  const enc = new TextEncoder();
  const BATCH = 512;
  for (let start = 0; start < 50_000_000; start += BATCH) {
    const hashes = await Promise.all(
      Array.from({ length: BATCH }, (_, i) => crypto.subtle.digest("SHA-256", enc.encode(`${challenge}:${start + i}`))),
    );
    for (let i = 0; i < BATCH; i++) if (zeroBits(new Uint8Array(hashes[i])) >= difficulty) return { challenge, counter: String(start + i) };
  }
  throw new Error("Security check failed. Please try again.");
}

function zeroBits(b: Uint8Array) {
  let bits = 0;
  for (const x of b) {
    if (x === 0) { bits += 8; continue; }
    return bits + Math.clz32(x) - 24;
  }
  return bits;
}
