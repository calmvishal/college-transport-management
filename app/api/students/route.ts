import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { requireRole } from "@/lib/apiAuth";
import { createStudent, getAllStudents, recordAudit, updateStudent } from "@/lib/repository";

/** GET /api/students — list all students on the incharge's route. */
export async function GET() {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const students = await getAllStudents();
  return NextResponse.json({
    students: students.filter((s) => s.route === session.user.route),
  });
}

const createSchema = z.object({
  name: z.string().min(1),
  classCourse: z.string().min(1),
  defaultVehicleId: z.string().min(1),
  contact: z.string().optional().default(""),
});

/** POST /api/students — add a new student.
 *
 * Route is ALWAYS taken from the logged-in incharge's own session, never
 * from client input. Previously it was a free-typed field, so a stray
 * space or different capitalization meant the record was written to the
 * sheet correctly but then silently excluded from every list view (which
 * filters by exact route match) — the incharge would see "success" but
 * the record would appear to vanish. Locking it server-side makes that
 * class of bug impossible and also stops an incharge from accidentally
 * (or deliberately) creating a record outside their authorized route. */
export async function POST(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const studentId = `STU-${uuid().slice(0, 8).toUpperCase()}`;
  await createStudent({
    studentId,
    status: "Active",
    route: session.user.route,
    ...parsed.data,
  });
  await recordAudit(
    session.user.name || session.user.id,
    "CREATE",
    "Student",
    studentId,
    "",
    JSON.stringify({ ...parsed.data, route: session.user.route })
  );

  return NextResponse.json({ success: true, studentId });
}

const updateSchema = z.object({
  studentId: z.string().min(1),
  name: z.string().optional(),
  classCourse: z.string().optional(),
  defaultVehicleId: z.string().optional(),
  contact: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

/** PATCH /api/students — edit a student, change their default vehicle, or
 * deactivate them. Never deletes — see Section 15/18 of the spec: inactive
 * students keep all historical bookings/attendance/clubbing rows intact,
 * and changing defaultVehicleId here only affects future dates because
 * every past Booking/DailyOperations row already snapshotted its own
 * default vehicle at the time. */
export async function PATCH(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { studentId, ...patch } = parsed.data;

  const updated = await updateStudent(studentId, patch);
  if (!updated) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  await recordAudit(session.user.name || session.user.id, "UPDATE", "Student", studentId, "", JSON.stringify(patch));

  return NextResponse.json({ success: true });
}
