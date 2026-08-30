import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import {
  findDailyOperation,
  findExistingBooking,
  getAllVehicles,
  getStudentById,
  getVehicleStatusForDate,
} from "@/lib/repository";
import { nextBookableDateKey } from "@/lib/dateUtils";
import { resolveOperationalVehicle } from "@/lib/transportLogic";

/** GET /api/student/status — the data behind the "Tomorrow's Transport"
 * card on the student dashboard: default vehicle, booking status,
 * operational vehicle (post-clubbing), and whether that vehicle was
 * marked sent/not-sent, if already known. */
export async function GET() {
  const session = await requireRole(["student"]);
  if (session instanceof NextResponse) return session;

  const studentId = session.user.studentId;
  const student = await getStudentById(studentId);
  if (!student) {
    return NextResponse.json({ error: "Student record not found." }, { status: 404 });
  }

  const travelDate = nextBookableDateKey();
  const booking = await findExistingBooking(studentId, travelDate);
  const dailyOp = await findDailyOperation(travelDate, studentId);
  const operationalVehicleId = resolveOperationalVehicle(studentId, booking, dailyOp);

  const vehicles = await getAllVehicles();
  const vehicleStatuses = await getVehicleStatusForDate(travelDate);
  const statusForOperationalVehicle = operationalVehicleId
    ? vehicleStatuses.find((v) => v.vehicleId === operationalVehicleId)?.status ?? null
    : null;

  const vehicleNumber = (id: string) =>
    vehicles.find((v) => v.vehicleId === id)?.vehicleNumber ?? id;

  return NextResponse.json({
    travelDate,
    defaultVehicleId: student.defaultVehicleId,
    defaultVehicleNumber: vehicleNumber(student.defaultVehicleId),
    booked: !!booking,
    operationalVehicleId,
    operationalVehicleNumber: operationalVehicleId ? vehicleNumber(operationalVehicleId) : null,
    clubbed: !!dailyOp?.clubbed,
    vehicleStatus: statusForOperationalVehicle, // "Sent" | "Not Sent" | null
  });
}
