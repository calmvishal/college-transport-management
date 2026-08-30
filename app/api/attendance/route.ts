import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/apiAuth";
import {
  getAllStudents,
  getAttendanceForDate,
  getBookingsForDate,
  getDailyOperationsForDate,
  getVehicleStatusForDate,
  upsertAttendance,
  getAllVehicles,
} from "@/lib/repository";
import { buildStudentDailyViews, buildVehicleSentMap } from "@/lib/transportLogic";

/** GET /api/attendance?date=yyyy-MM-dd — the driver's final roster for
 * their assigned vehicle: every student whose OPERATIONAL vehicle (post-
 * clubbing) is this driver's vehicle. Includes students clubbed IN, and
 * excludes students clubbed OUT, automatically because it's derived from
 * DailyOperations rather than each student's default vehicle. */
export async function GET(req: Request) {
  const session = await requireRole(["driver"]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid ?date=yyyy-MM-dd is required." }, { status: 400 });
  }

  const vehicleId = session.user.vehicleId;
  if (!vehicleId) {
    return NextResponse.json({ error: "This driver has no assigned vehicle." }, { status: 400 });
  }

  const [
  students,
  bookings,
  dailyOps,
  vehicleStatuses,
  attendance,
  vehicles,
] = await Promise.all([
  getAllStudents(),
  getBookingsForDate(date),
  getDailyOperationsForDate(date),
  getVehicleStatusForDate(date),
  getAttendanceForDate(date),
  getAllVehicles(),
]);

  const vehicleSentMap = buildVehicleSentMap(vehicleStatuses);
  const allViews = buildStudentDailyViews({
  date,
  students,
  bookings,
  dailyOps,
  vehicleSentMap,
  attendance,
  vehicles,
});

  const roster = allViews.filter((v) => v.operationalVehicleId === vehicleId);
  const vehicleSent = vehicleSentMap.get(vehicleId) ?? null;

  return NextResponse.json({
    date,
    vehicleId,
    vehicleSent, // true | false | null (not yet marked)
    roster,
  });
}

const submitSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marks: z
    .array(
      z.object({
        studentId: z.string(),
        present: z.boolean(),
        absenceReason: z.string().optional().default(""),
      })
    )
    .min(1),
});

/** POST /api/attendance — driver submits Present/Absent for their roster.
 * Students on a vehicle already marked "Not Sent" should not be submitted
 * here at all (the UI hides them / the dashboard auto-derives their
 * status), but if one slips through we simply refuse to overwrite the
 * "Absent - Vehicle Not Sent" outcome with the driver's mark, since vehicle
 * status always takes precedence per the FINAL BUSINESS RULE. */
export async function POST(req: Request) {
  const session = await requireRole(["driver"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { date, marks } = parsed.data;
  const vehicleId = session.user.vehicleId;

  const [students, vehicleStatuses] = await Promise.all([
    getAllStudents(),
    getVehicleStatusForDate(date),
  ]);
  const vehicleSentMap = buildVehicleSentMap(vehicleStatuses);
  const vehicleSent = vehicleSentMap.get(vehicleId);

  if (vehicleSent === false) {
    return NextResponse.json(
      {
        error:
          "This vehicle is marked Not Sent for this date. All scheduled students are automatically " +
          "Absent - Vehicle Not Sent; no manual attendance is needed.",
      },
      { status: 409 }
    );
  }

  const timestamp = new Date().toISOString();

  for (const mark of marks) {
    const student = students.find((s) => s.studentId === mark.studentId);
    if (!student) continue;

    await upsertAttendance({
      attendanceId: `${date}-${mark.studentId}`,
      date,
      studentId: mark.studentId,
      studentName: student.name,
      defaultVehicleId: student.defaultVehicleId,
      operationalVehicleId: vehicleId,
      vehicleId,
      driverId: session.user.id,
      status: mark.present ? "Present" : "Absent - Student",
      absenceReason: mark.present ? "" : mark.absenceReason,
      timestamp,
    });
  }

  return NextResponse.json({ success: true, count: marks.length });
}
