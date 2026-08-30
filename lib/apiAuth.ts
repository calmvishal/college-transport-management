import "server-only";
import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import type { Role } from "@/types";

/**
 * Every protected API route should start with:
 *
 *   const session = await requireRole(["incharge"]);
 *   if (session instanceof NextResponse) return session; // 401/403 already built
 *
 * This is the ONE place role enforcement happens for the API layer. Never
 * rely on hiding a button in the UI as the only protection — the server
 * must independently check the session on every request.
 */
export async function requireRole(
  allowedRoles: Role[]
): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json(
      { error: "You do not have permission to perform this action." },
      { status: 403 }
    );
  }

  return session;
}

/** For routes any authenticated user can call, but where we still need the
 * session to scope results to "my own data" (e.g. a student viewing only
 * their own bookings). */
export async function requireSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return session;
}
