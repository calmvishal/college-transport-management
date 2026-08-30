import "server-only";
import type {
  AttendanceRecord,
  AttendanceStatus,
  BookingRecord,
  DailyDashboardSummary,
  DailyOperationRecord,
  StudentDailyView,
  StudentRecord,
  VehicleDailyStatusRecord,
  VehicleDailyView,
  VehicleRecord,
} from "@/types";

/**
 * ============================================================================
 * SINGLE SOURCE OF TRUTH FOR TRANSPORT LOGIC
 * ============================================================================
 * Every dashboard, API route, and PDF report MUST call into these functions
 * rather than re-deriving operational-vehicle or attendance logic locally.
 * This is what keeps the daily dashboard and monthly PDF numbers consistent.
 *
 * The pipeline, always in this order:
 *   Booking -> Clubbing (DailyOperations) -> Final Operational Vehicle
 *   -> Vehicle Sent/Not Sent -> Attendance
 * ============================================================================
 */

/** Resolves a student's operational vehicle for a date. Falls back to the
 * booking's snapshot of the default vehicle if no DailyOperations row
 * exists yet (i.e. booked but not yet clubbed either way). Returns null if
 * the student has no booking for that date at all. */
export function resolveOperationalVehicle(
  studentId: string,
  booking: BookingRecord | null,
  dailyOp: DailyOperationRecord | null
): string | null {
  if (dailyOp) return dailyOp.operationalVehicleId;
  if (booking) return booking.defaultVehicleId;
  return null;
}

/**
 * Determines a student's attendance status for a date, given:
 *  - their resolved operational vehicle,
 *  - whether that vehicle was sent to college on that date,
 *  - whether the driver has explicitly marked them present/absent.
 *
 * Rules (must match FINAL BUSINESS RULE in the spec exactly):
 *  1. No operational vehicle (not booked) -> not applicable, no attendance row.
 *  2. Operational vehicle NOT SENT -> "Absent - Vehicle Not Sent", regardless
 *     of anything the driver does (drivers never need to mark these students).
 *  3. Operational vehicle SENT, driver marked present -> "Present".
 *  4. Operational vehicle SENT, driver marked absent / did not mark -> "Absent - Student".
 */
export function deriveAttendanceStatus(params: {
  operationalVehicleId: string | null;
  vehicleSent: boolean | null; // null = no status recorded yet for that vehicle/date
  driverMarkedPresent: boolean | null; // null = driver hasn't submitted yet
}): AttendanceStatus | "Pending" | "Not Booked" {
  const { operationalVehicleId, vehicleSent, driverMarkedPresent } = params;

  if (!operationalVehicleId) return "Not Booked";
  if (vehicleSent === false) return "Absent - Vehicle Not Sent";
  if (vehicleSent === null) return "Pending"; // vehicle status not yet set for the date
  if (driverMarkedPresent === true) return "Present";
  if (driverMarkedPresent === false) return "Absent - Student";
  return "Pending"; // vehicle sent but driver hasn't submitted attendance yet
}

/** Builds the vehicle-sent lookup map for a date: vehicleId -> sent boolean. */
export function buildVehicleSentMap(
  statuses: VehicleDailyStatusRecord[]
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const s of statuses) {
    map.set(s.vehicleId, s.status === "Sent");
  }
  return map;
}

/** Builds a per-student view for a specific date, combining bookings,
 * clubbing (DailyOperations), vehicle sent/not-sent status, and any
 * attendance already recorded by a driver. This is the exact same
 * resolution path used by the student dashboard, the incharge daily
 * dashboard, the driver attendance screen, and the monthly PDF — so all
 * four always agree. */
function resolveVehicleId(
  vehicleRef: string | null | undefined,
  vehicles: VehicleRecord[]
): string | null {
  if (!vehicleRef) return null;

  const vehicle = vehicles.find(
    (v) =>
      v.vehicleId === vehicleRef ||
      v.vehicleNumber === vehicleRef
  );

  return vehicle?.vehicleId ?? null;
}

export function buildStudentDailyViews(params: {
  date: string;
  students: StudentRecord[];
  bookings: BookingRecord[];
  dailyOps: DailyOperationRecord[];
  vehicleSentMap: Map<string, boolean>;
  attendance: AttendanceRecord[];
  vehicles: VehicleRecord[];
}): StudentDailyView[] {
  const { students, bookings, dailyOps, vehicleSentMap, attendance , vehicles,} = params;

  const bookingByStudent = new Map(bookings.map((b) => [b.studentId, b]));
  const opByStudent = new Map(dailyOps.map((o) => [o.studentId, o]));
  const attendanceByStudent = new Map(attendance.map((a) => [a.studentId, a]));

  const views: StudentDailyView[] = [];

  for (const student of students) {
    const booking = bookingByStudent.get(student.studentId) || null;
    if (!booking) continue; // only students who booked appear in the daily view

    const dailyOp = opByStudent.get(student.studentId) || null;
    const operationalVehicleRef = resolveOperationalVehicle(
  student.studentId,
  booking,
  dailyOp
);

const operationalVehicleId = resolveVehicleId(
  operationalVehicleRef,
  vehicles
);
    const vehicleSent = operationalVehicleId ? vehicleSentMap.get(operationalVehicleId) ?? null : null;

    const existingAttendance = attendanceByStudent.get(student.studentId) || null;
    const driverMarkedPresent =
      existingAttendance && existingAttendance.status !== "Absent - Vehicle Not Sent"
        ? existingAttendance.status === "Present"
        : null;

    const attendanceStatus = deriveAttendanceStatus({
      operationalVehicleId,
      vehicleSent,
      driverMarkedPresent,
    });

    views.push({
      studentId: student.studentId,
      studentName: student.name,
      defaultVehicleId: resolveVehicleId(student.defaultVehicleId, vehicles) ??
  student.defaultVehicleId,
      operationalVehicleId,
      booked: true,
      attendance: attendanceStatus,
    });
  }

  return views;
}

/** Aggregates per-vehicle counts for a date: capacity, booked, operational
 * students (post-clubbing), present, absent, and sent/not-sent status. */
export function buildVehicleDailyViews(params: {
  vehicles: VehicleRecord[];
  studentViews: StudentDailyView[];
  vehicleSentMap: Map<string, boolean>;
}): VehicleDailyView[] {
  const { vehicles, studentViews, vehicleSentMap } = params;

  return vehicles.map((vehicle) => {
    const bookedCount = studentViews.filter(
      (s) =>
        s.defaultVehicleId === vehicle.vehicleId ||
        s.defaultVehicleId === vehicle.vehicleNumber
    ).length;

    const operationalStudents = studentViews.filter(
      (s) =>
        s.operationalVehicleId === vehicle.vehicleId ||
        s.operationalVehicleId === vehicle.vehicleNumber
    );

    const present = operationalStudents.filter(
      (s) => s.attendance === "Present"
    ).length;

    const absent = operationalStudents.filter(
      (s) =>
        s.attendance === "Absent - Student" ||
        s.attendance === "Absent - Vehicle Not Sent"
    ).length;

    const sent = vehicleSentMap.get(vehicle.vehicleId);

    const status: VehicleDailyView["status"] =
      sent === true
        ? "Sent"
        : sent === false
          ? "Not Sent"
          : "Unmarked";

    return {
      vehicleId: vehicle.vehicleId,
      vehicleNumber: vehicle.vehicleNumber,
      capacity: vehicle.capacity,
      booked: bookedCount,
      operationalStudents: operationalStudents.length,
      present,
      absent,
      status,
    };
  });
}

/** Builds the top-level summary cards for the Route Incharge daily dashboard. */
export function buildDailyDashboardSummary(params: {
  date: string;
  vehicles: VehicleRecord[];
  vehicleSentMap: Map<string, boolean>;
  studentViews: StudentDailyView[];
}): DailyDashboardSummary {
  const { date, vehicles, vehicleSentMap, studentViews } = params;

  const vehiclesSent = vehicles.filter((v) => vehicleSentMap.get(v.vehicleId) === true).length;
  const vehiclesNotSent = vehicles.filter((v) => vehicleSentMap.get(v.vehicleId) === false).length;

  const studentsBooked = studentViews.length;
  const studentsPresent = studentViews.filter((s) => s.attendance === "Present").length;
  const studentsAbsentStudent = studentViews.filter((s) => s.attendance === "Absent - Student").length;
  const studentsAbsentVehicleNotSent = studentViews.filter(
    (s) => s.attendance === "Absent - Vehicle Not Sent"
  ).length;
  const clubbedStudents = studentViews.filter(
    (s) => s.operationalVehicleId !== null && s.operationalVehicleId !== s.defaultVehicleId
  ).length;

  return {
    date,
    totalVehicles: vehicles.length,
    vehiclesSent,
    vehiclesNotSent,
    studentsBooked,
    studentsPresent,
    studentsAbsentStudent,
    studentsAbsentVehicleNotSent,
    clubbedStudents,
  };
}

/** Validates a proposed clubbing move before it's committed. Returns a list
 * of human-readable error strings; empty array means the move is valid. */
export function validateClubbingMove(params: {
  studentIds: string[];
  destinationVehicle: VehicleRecord;
  currentOperationalCountOnDestination: number;
  allowCapacityOverride: boolean;
}): string[] {
  const { studentIds, destinationVehicle, currentOperationalCountOnDestination, allowCapacityOverride } =
    params;
  const errors: string[] = [];

  if (destinationVehicle.status !== "Active") {
    errors.push(`${destinationVehicle.vehicleNumber} is inactive and cannot receive students.`);
  }

  const projectedCount = currentOperationalCountOnDestination + studentIds.length;
  if (projectedCount > destinationVehicle.capacity && !allowCapacityOverride) {
    errors.push(
      `Moving ${studentIds.length} student(s) would put ${destinationVehicle.vehicleNumber} at ` +
        `${projectedCount}/${destinationVehicle.capacity}, over capacity. Enable capacity override to proceed anyway.`
    );
  }

  if (studentIds.length === 0) {
    errors.push("No students selected.");
  }

  return errors;
}
