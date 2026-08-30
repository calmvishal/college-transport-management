import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { requireRole } from "@/lib/apiAuth";
import {
  createBooking,
  findExistingBooking,
  getStudentById,
  initDailyOperation,
} from "@/lib/repository";
import { nextBookableDateKey } from "@/lib/dateUtils";

/** POST /api/booking — a student books transport for the next bookable day. */
export async function POST() {
  const session = await requireRole(["student"]);
  if (session instanceof NextResponse) return session;

  const studentId = session.user.studentId;
  if (!studentId) {
    return NextResponse.json(
      { error: "This account is not linked to a student record." },
      { status: 400 }
    );
  }

  const student = await getStudentById(studentId);
  if (!student || student.status !== "Active") {
    return NextResponse.json({ error: "Student record not found or inactive." }, { status: 404 });
  }

  const travelDate = nextBookableDateKey();

  const existing = await findExistingBooking(studentId, travelDate);
  if (existing) {
    return NextResponse.json(
      { error: `You already have a booking for ${travelDate}.` },
      { status: 409 }
    );
  }

  const timestamp = new Date().toISOString();

  await createBooking({
    bookingId: uuid(),
    travelDate,
    studentId,
    defaultVehicleId: student.defaultVehicleId,
    bookingStatus: "Booked",
    timestamp,
  });

  // Seed the DailyOperations row immediately with operational == default.
  // Clubbing later updates this row in place; it never creates a duplicate.
  await initDailyOperation({
    date: travelDate,
    studentId,
    defaultVehicleId: student.defaultVehicleId,
    operationalVehicleId: student.defaultVehicleId,
    clubbed: false,
    changedBy: "",
    changedAt: timestamp,
    reason: "",
  });

  return NextResponse.json({
    success: true,
    travelDate,
    defaultVehicleId: student.defaultVehicleId,
  });
}
