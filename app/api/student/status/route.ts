import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import {
  findDailyOperation,
  findExistingBooking,
  getAllVehicles,
  getAttendanceForDate,
  getNonWorkingDay,
  getStudentById,
  getVehicleStatusForDate,
} from "@/lib/repository";
import { nextBookableDateKey, todayKey } from "@/lib/dateUtils";
import { deriveAttendanceStatus, resolveOperationalVehicle } from "@/lib/transportLogic";

/**
 * GET /api/student/status?date=yyyy-MM-dd — the data behind the student's
 * "My Transport" card, for ANY date the student navigates to (yesterday,
 * today, or the next bookable day), not just "tomorrow".
 *
 * This matters because a student books at night for what is "tomorrow" at
 * that moment; by the next morning that date IS today. Without a real
 * per-date view, the dashboard kept re-computing "tomorrow" relative to
 * the current moment and the student could never see today's actual
 * operational vehicle once it arrived — this endpoint fixes that by
 * resolving the same Booking -> Clubbing -> Operational Vehicle -> Sent/
 * Not-Sent -> Attendance pipeline for whatever date is requested.
 *
 * Defaults to today if no date is given.
 */
export async function GET(req: Request) {
  const session = await requireRole(["student"]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be yyyy-MM-dd." }, { status: 400 });
  }

  const studentId = session.user.studentId;
  const student = await getStudentById(studentId);
  if (!student) {
    return NextResponse.json({ error: "Student record not found." }, { status: 404 });
  }

  const bookableDate = nextBookableDateKey();
  const isBookableDay = date === bookableDate;

  const [booking, dailyOp, vehicles, vehicleStatuses, attendanceForDate, holidayOnBookableDate] =
    await Promise.all([
      findExistingBooking(studentId, date),
      findDailyOperation(date, studentId),
      getAllVehicles(),
      getVehicleStatusForDate(date),
      getAttendanceForDate(date),
      isBookableDay ? getNonWorkingDay(bookableDate) : Promise.resolve(null),
    ]);

  const operationalVehicleId = resolveOperationalVehicle(studentId, booking, dailyOp);
  const statusForOperationalVehicle = operationalVehicleId
    ? vehicleStatuses.find((v) => v.vehicleId === operationalVehicleId)?.status ?? null
    : null;
  const vehicleSent =
    statusForOperationalVehicle === "Sent" ? true : statusForOperationalVehicle === "Not Sent" ? false : null;

  const myAttendance = attendanceForDate.find((a) => a.studentId === studentId) || null;
  const driverMarkedPresent = myAttendance ? myAttendance.status === "Present" : null;

  const attendance = deriveAttendanceStatus({
    operationalVehicleId,
    vehicleSent,
    driverMarkedPresent,
  });

  const vehicleNumber = (id: string | null) =>
    id ? vehicles.find((v) => v.vehicleId === id)?.vehicleNumber ?? id : null;

  return NextResponse.json({
    date,
    isToday: date === todayKey(),
    isBookableDay,
    bookableDate,
    defaultVehicleId: student.defaultVehicleId,
    defaultVehicleNumber: vehicleNumber(student.defaultVehicleId),
    booked: !!booking,
    operationalVehicleId,
    operationalVehicleNumber: vehicleNumber(operationalVehicleId),
    clubbed: !!dailyOp?.clubbed,
    vehicleStatus: statusForOperationalVehicle, // "Sent" | "Not Sent" | null
    attendance, // "Present" | "Absent - Student" | "Absent - Vehicle Not Sent" | "Pending" | "Not Booked"
    holidayOnBookableDate: holidayOnBookableDate ? holidayOnBookableDate.reason : null,
  });
}
