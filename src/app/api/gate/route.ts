import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const COOKIE_NAME = "shield_site_access";
const COOKIE_VALUE = "1";

/** Compare UTF-8 strings in constant time (length differences still observable at coarse level; good enough for a launch gate). */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  const len = Math.max(bufA.length, bufB.length);
  const paddedA = new Uint8Array(len);
  const paddedB = new Uint8Array(len);
  paddedA.set(bufA);
  paddedB.set(bufB);
  return bufA.length === bufB.length && timingSafeEqual(paddedA, paddedB);
}

export async function POST(request: Request) {
  const expected = process.env.SITE_PASSWORD?.trim();
  if (!expected) {
    return NextResponse.json({ error: "Site gate is not enabled" }, { status: 503 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const submitted = typeof body.password === "string" ? body.password : "";
  if (!constantTimeEqual(submitted, expected)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
