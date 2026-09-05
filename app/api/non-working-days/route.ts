import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireSession } from "@/lib/apiAuth";
import { addNonWorkingDay, getAllNonWorkingDays, recordAudit, removeNonWorkingDay } from "@/lib/repository";

/** GET /api/non-working-days — any authenticated role can read the list.
 * Students need this to know if their bookable day is a holiday before
 * they try to book. */
export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const nonWorkingDays = await getAllNonWorkingDays();
  return NextResponse.json({ nonWorkingDays });
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1),
});

/** POST /api/non-working-days — Route Incharge marks a date as a
 * non-working day (holiday). Students cannot book transport for it — see
 * the check in app/api/booking/route.ts. */
export async function POST(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  await addNonWorkingDay({
    date: parsed.data.date,
    reason: parsed.data.reason,
    markedBy: session.user.name || session.user.id,
    markedAt: new Date().toISOString(),
  });
  await recordAudit(
    session.user.name || session.user.id,
    "CREATE",
    "NonWorkingDay",
    parsed.data.date,
    "",
    parsed.data.reason
  );

  return NextResponse.json({ success: true });
}

const deleteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** DELETE /api/non-working-days — un-mark a date so bookings are allowed
 * again (e.g. a holiday got cancelled/rescheduled). */
export async function DELETE(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const removed = await removeNonWorkingDay(parsed.data.date);
  if (!removed) {
    return NextResponse.json({ error: "That date was not marked as a non-working day." }, { status: 404 });
  }
  await recordAudit(session.user.name || session.user.id, "DELETE", "NonWorkingDay", parsed.data.date, "", "");

  return NextResponse.json({ success: true });
}
