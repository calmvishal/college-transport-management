import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/apiAuth";
import { setVehicleDailyStatus } from "@/lib/repository";

const statusSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehicleId: z.string().min(1),
  status: z.enum(["Sent", "Not Sent"]),
  reason: z.string().optional().default(""),
});

/** POST /api/vehicle-status — Route Incharge marks a vehicle Sent / Not
 * Sent for a specific date. Marking "Not Sent" does NOT write attendance
 * rows directly — the daily dashboard and driver screens derive "Absent -
 * Vehicle Not Sent" for affected students automatically via
 * deriveAttendanceStatus, so there's exactly one place that logic lives. */
export async function POST(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { date, vehicleId, status, reason } = parsed.data;

  if (status === "Not Sent" && !reason) {
    return NextResponse.json(
      { error: "A reason is required when marking a vehicle as Not Sent." },
      { status: 400 }
    );
  }

  await setVehicleDailyStatus({
    date,
    vehicleId,
    status,
    reason,
    updatedBy: session.user.name || session.user.id,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
