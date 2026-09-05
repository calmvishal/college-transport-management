import "server-only";
import {
  SHEET,
  appendRow,
  appendRows,
  batchReadSheets,
  deleteRowByKey,
  findRowByCompositeKey,
  readSheet,
  updateRowByCompositeKey,
  updateRowByKey,
} from "./sheets";
import type {
  AttendanceRecord,
  BookingRecord,
  ClubbingHistoryRecord,
  DailyOperationRecord,
  DriverRecord,
  NonWorkingDayRecord,
  StudentRecord,
  UserRecord,
  VehicleDailyStatusRecord,
  VehicleRecord,
} from "@/types";

// ============================================================================
// USERS
// ============================================================================
export async function getAllUsers(): Promise<UserRecord[]> {
  const rows = await readSheet(SHEET.Users);
  return rows.map((r) => ({
    userId: r["User ID"],
    name: r["Name"],
    role: r["Role"] as UserRecord["role"],
    authId: r["Auth ID"],
    passwordHash: r["Password Hash"],
    route: r["Route"],
    vehicleId: r["Vehicle ID"],
    studentId: r["Student ID"],
    status: r["Status"] as UserRecord["status"],
  }));
}

export async function getUserByAuthId(authId: string): Promise<UserRecord | null> {
  const users = await getAllUsers();
  return users.find((u) => u.authId.toLowerCase() === authId.toLowerCase()) || null;
}

// ============================================================================
// STUDENTS
// ============================================================================
export async function getAllStudents(): Promise<StudentRecord[]> {
  const rows = await readSheet(SHEET.Students);
  return rows.map((r) => ({
    studentId: r["Student ID"],
    name: r["Name"],
    classCourse: r["Class/Course"],
    route: r["Route"],
    defaultVehicleId: r["Default Vehicle"],
    contact: r["Contact"],
    status: r["Status"] as StudentRecord["status"],
  }));
}

export async function getStudentById(studentId: string): Promise<StudentRecord | null> {
  const students = await getAllStudents();
  return students.find((s) => s.studentId === studentId) || null;
}

export async function createStudent(student: StudentRecord): Promise<void> {
  await appendRow(SHEET.Students, [
    student.studentId,
    student.name,
    student.classCourse,
    student.route,
    student.defaultVehicleId,
    student.contact,
    student.status,
  ]);
}

export async function updateStudent(
  studentId: string,
  patch: Partial<Omit<StudentRecord, "studentId">>
): Promise<boolean> {
  const columnMap: Record<string, string> = {
    name: "Name",
    classCourse: "Class/Course",
    route: "Route",
    defaultVehicleId: "Default Vehicle",
    contact: "Contact",
    status: "Status",
  };
  const sheetPatch: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) sheetPatch[columnMap[k]] = String(v);
  }
  return updateRowByKey(SHEET.Students, "Student ID", studentId, sheetPatch);
}

// ============================================================================
// VEHICLES
// ============================================================================
export async function getAllVehicles(): Promise<VehicleRecord[]> {
  const rows = await readSheet(SHEET.Vehicles);
  return rows.map((r) => ({
    vehicleId: r["Vehicle ID"],
    vehicleNumber: r["Vehicle Number"],
    route: r["Route"],
    capacity: Number(r["Capacity"] || 0),
    driverId: r["Driver ID"],
    status: r["Status"] as VehicleRecord["status"],
    dateAdded: r["Date Added"],
  }));
}

export async function createVehicle(vehicle: VehicleRecord): Promise<void> {
  await appendRow(SHEET.Vehicles, [
    vehicle.vehicleId,
    vehicle.vehicleNumber,
    vehicle.route,
    vehicle.capacity,
    vehicle.driverId,
    vehicle.status,
    vehicle.dateAdded,
  ]);
}

export async function updateVehicle(
  vehicleId: string,
  patch: Partial<Omit<VehicleRecord, "vehicleId">>
): Promise<boolean> {
  const columnMap: Record<string, string> = {
    vehicleNumber: "Vehicle Number",
    route: "Route",
    capacity: "Capacity",
    driverId: "Driver ID",
    status: "Status",
    dateAdded: "Date Added",
  };
  const sheetPatch: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) sheetPatch[columnMap[k]] = String(v);
  }
  return updateRowByKey(SHEET.Vehicles, "Vehicle ID", vehicleId, sheetPatch);
}

// ============================================================================
// DRIVERS
// ============================================================================
export async function getAllDrivers(): Promise<DriverRecord[]> {
  const rows = await readSheet(SHEET.Drivers);
  return rows.map((r) => ({
    driverId: r["Driver ID"],
    name: r["Name"],
    phone: r["Phone"],
    licenseInfo: r["License Info"],
    vehicleId: r["Vehicle ID"],
    route: r["Route"],
    status: r["Status"] as DriverRecord["status"],
  }));
}

export async function createDriver(driver: DriverRecord): Promise<void> {
  await appendRow(SHEET.Drivers, [
    driver.driverId,
    driver.name,
    driver.phone,
    driver.licenseInfo,
    driver.vehicleId,
    driver.route,
    driver.status,
  ]);
}

export async function updateDriver(
  driverId: string,
  patch: Partial<Omit<DriverRecord, "driverId">>
): Promise<boolean> {
  const columnMap: Record<string, string> = {
    name: "Name",
    phone: "Phone",
    licenseInfo: "License Info",
    vehicleId: "Vehicle ID",
    route: "Route",
    status: "Status",
  };
  const sheetPatch: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) sheetPatch[columnMap[k]] = String(v);
  }
  return updateRowByKey(SHEET.Drivers, "Driver ID", driverId, sheetPatch);
}

// ============================================================================
// BOOKINGS
// ============================================================================
export async function getAllBookings(): Promise<BookingRecord[]> {
  const rows = await readSheet(SHEET.Bookings);
  return rows.map((r) => ({
    bookingId: r["Booking ID"],
    travelDate: r["Travel Date"],
    studentId: r["Student ID"],
    defaultVehicleId: r["Default Vehicle"],
    bookingStatus: r["Booking Status"] as BookingRecord["bookingStatus"],
    timestamp: r["Timestamp"],
  }));
}

export async function getBookingsForDate(date: string): Promise<BookingRecord[]> {
  const all = await getAllBookings();
  return all.filter((b) => b.travelDate === date && b.bookingStatus === "Booked");
}

export async function findExistingBooking(
  studentId: string,
  date: string
): Promise<BookingRecord | null> {
  const all = await getAllBookings();
  return (
    all.find(
      (b) => b.studentId === studentId && b.travelDate === date && b.bookingStatus === "Booked"
    ) || null
  );
}

export async function createBooking(booking: BookingRecord): Promise<void> {
  await appendRow(SHEET.Bookings, [
    booking.bookingId,
    booking.travelDate,
    booking.studentId,
    booking.defaultVehicleId,
    booking.bookingStatus,
    booking.timestamp,
  ]);
}

// ============================================================================
// DAILY OPERATIONS (this is where the operational-vehicle / clubbing state lives)
// ============================================================================
export async function getAllDailyOperations(): Promise<DailyOperationRecord[]> {
  const rows = await readSheet(SHEET.DailyOperations);
  return rows.map((r) => ({
    date: r["Date"],
    studentId: r["Student ID"],
    defaultVehicleId: r["Default Vehicle"],
    operationalVehicleId: r["Operational Vehicle"],
    clubbed: r["Clubbed"] === "TRUE" || r["Clubbed"] === "true",
    changedBy: r["Changed By"],
    changedAt: r["Changed At"],
    reason: r["Reason"],
  }));
}

export async function getDailyOperationsForDate(date: string): Promise<DailyOperationRecord[]> {
  const all = await getAllDailyOperations();
  return all.filter((op) => op.date === date);
}

/** Creates the initial DailyOperations row for a student on booking day,
 * with operationalVehicleId == defaultVehicleId (no clubbing yet). */
export async function initDailyOperation(op: DailyOperationRecord): Promise<void> {
  await appendRow(SHEET.DailyOperations, [
    op.date,
    op.studentId,
    op.defaultVehicleId,
    op.operationalVehicleId,
    op.clubbed ? "TRUE" : "FALSE",
    op.changedBy,
    op.changedAt,
    op.reason,
  ]);
}

/** Updates a student's operational vehicle for a date (clubbing). Because
 * a student/date pair can appear only once, we find-and-update the existing
 * row in place rather than appending a duplicate — this is what enforces
 * "a student can have only one final operational vehicle for a particular
 * date." Returns false if no DailyOperations row exists yet for that
 * student/date (the student must have a booking first). */
export async function setOperationalVehicle(
  date: string,
  studentId: string,
  newOperationalVehicleId: string,
  changedBy: string,
  reason: string
): Promise<boolean> {
  return updateRowByCompositeKey(SHEET.DailyOperations, "Date", date, "Student ID", studentId, {
    "Operational Vehicle": newOperationalVehicleId,
    Clubbed: "TRUE",
    "Changed By": changedBy,
    "Changed At": new Date().toISOString(),
    Reason: reason,
  });
}

/** Returns the existing DailyOperations row for a student/date, if any. */
export async function findDailyOperation(
  date: string,
  studentId: string
): Promise<DailyOperationRecord | null> {
  const row = await findRowByCompositeKey(SHEET.DailyOperations, "Date", date, "Student ID", studentId);
  if (!row) return null;
  return {
    date: row["Date"],
    studentId: row["Student ID"],
    defaultVehicleId: row["Default Vehicle"],
    operationalVehicleId: row["Operational Vehicle"],
    clubbed: row["Clubbed"] === "TRUE",
    changedBy: row["Changed By"],
    changedAt: row["Changed At"],
    reason: row["Reason"],
  };
}

// ============================================================================
// VEHICLE DAILY STATUS
// ============================================================================
export async function getAllVehicleDailyStatus(): Promise<VehicleDailyStatusRecord[]> {
  const rows = await readSheet(SHEET.VehicleDailyStatus);
  return rows.map((r) => ({
    date: r["Date"],
    vehicleId: r["Vehicle"],
    status: r["Status"] as VehicleDailyStatusRecord["status"],
    reason: r["Reason"],
    updatedBy: r["Updated By"],
    updatedAt: r["Updated At"],
  }));
}

export async function getVehicleStatusForDate(
  date: string
): Promise<VehicleDailyStatusRecord[]> {
  const all = await getAllVehicleDailyStatus();
  return all.filter((v) => v.date === date);
}

export async function setVehicleDailyStatus(record: VehicleDailyStatusRecord): Promise<void> {
  const updated = await updateRowByCompositeKey(
    SHEET.VehicleDailyStatus,
    "Date",
    record.date,
    "Vehicle",
    record.vehicleId,
    {
      Status: record.status,
      Reason: record.reason,
      "Updated By": record.updatedBy,
      "Updated At": record.updatedAt,
    }
  );
  if (updated) return;

  await appendRow(SHEET.VehicleDailyStatus, [
    record.date,
    record.vehicleId,
    record.status,
    record.reason,
    record.updatedBy,
    record.updatedAt,
  ]);
}

// ============================================================================
// ATTENDANCE
// ============================================================================
export async function getAllAttendance(): Promise<AttendanceRecord[]> {
  const rows = await readSheet(SHEET.Attendance);
  return rows.map((r) => ({
    attendanceId: r["Attendance ID"],
    date: r["Date"],
    studentId: r["Student ID"],
    studentName: r["Student Name"],
    defaultVehicleId: r["Default Vehicle"],
    operationalVehicleId: r["Operational Vehicle"],
    vehicleId: r["Vehicle"],
    driverId: r["Driver"],
    status: r["Status"] as AttendanceRecord["status"],
    absenceReason: r["Absence Reason"],
    timestamp: r["Timestamp"],
  }));
}

export async function getAttendanceForDate(date: string): Promise<AttendanceRecord[]> {
  const all = await getAllAttendance();
  return all.filter((a) => a.date === date);
}

export async function upsertAttendance(record: AttendanceRecord): Promise<void> {
  const updated = await updateRowByCompositeKey(
    SHEET.Attendance,
    "Date",
    record.date,
    "Student ID",
    record.studentId,
    {
      Status: record.status,
      "Absence Reason": record.absenceReason,
      Driver: record.driverId,
      Timestamp: record.timestamp,
    }
  );
  if (updated) return;

  await appendRow(SHEET.Attendance, [
    record.attendanceId,
    record.date,
    record.studentId,
    record.studentName,
    record.defaultVehicleId,
    record.operationalVehicleId,
    record.vehicleId,
    record.driverId,
    record.status,
    record.absenceReason,
    record.timestamp,
  ]);
}

export async function bulkInsertAttendance(records: AttendanceRecord[]): Promise<void> {
  await appendRows(
    SHEET.Attendance,
    records.map((record) => [
      record.attendanceId,
      record.date,
      record.studentId,
      record.studentName,
      record.defaultVehicleId,
      record.operationalVehicleId,
      record.vehicleId,
      record.driverId,
      record.status,
      record.absenceReason,
      record.timestamp,
    ])
  );
}

// ============================================================================
// CLUBBING HISTORY (append-only audit trail)
// ============================================================================
export async function recordClubbingHistory(record: ClubbingHistoryRecord): Promise<void> {
  await appendRow(SHEET.ClubbingHistory, [
    record.date,
    record.studentId,
    record.studentName,
    record.fromVehicleId,
    record.toVehicleId,
    record.changedBy,
    record.timestamp,
    record.reason,
  ]);
}

export async function getAllClubbingHistory(): Promise<ClubbingHistoryRecord[]> {
  const rows = await readSheet(SHEET.ClubbingHistory);
  return rows.map((r) => ({
    date: r["Date"],
    studentId: r["Student ID"],
    studentName: r["Student Name"],
    fromVehicleId: r["From Vehicle"],
    toVehicleId: r["To Vehicle"],
    changedBy: r["Changed By"],
    timestamp: r["Timestamp"],
    reason: r["Reason"],
  }));
}

// ============================================================================
// AUDIT LOG (append-only, for all administrative changes)
// ============================================================================
export async function recordAudit(
  actor: string,
  action: string,
  entity: string,
  entityId: string,
  oldValue: string,
  newValue: string
): Promise<void> {
  await appendRow(SHEET.AuditLog, [
    new Date().toISOString(),
    actor,
    action,
    entity,
    entityId,
    oldValue,
    newValue,
  ]);
}

// ============================================================================
// PERFORMANCE: BATCHED BUNDLE READS
// ============================================================================
// Row-mapper functions extracted from the getAll* functions above so they
// can be reused against rows that arrive via batchReadSheets (one network
// round trip for several sheets) instead of readSheet (one round trip per
// sheet). Field mappings here MUST stay identical to their getAll*
// counterparts above.

function mapStudentRow(r: Record<string, string>): StudentRecord {
  return {
    studentId: r["Student ID"],
    name: r["Name"],
    classCourse: r["Class/Course"],
    route: r["Route"],
    defaultVehicleId: r["Default Vehicle"],
    contact: r["Contact"],
    status: r["Status"] as StudentRecord["status"],
  };
}

function mapVehicleRow(r: Record<string, string>): VehicleRecord {
  return {
    vehicleId: r["Vehicle ID"],
    vehicleNumber: r["Vehicle Number"],
    route: r["Route"],
    capacity: Number(r["Capacity"] || 0),
    driverId: r["Driver ID"],
    status: r["Status"] as VehicleRecord["status"],
    dateAdded: r["Date Added"],
  };
}

function mapBookingRow(r: Record<string, string>): BookingRecord {
  return {
    bookingId: r["Booking ID"],
    travelDate: r["Travel Date"],
    studentId: r["Student ID"],
    defaultVehicleId: r["Default Vehicle"],
    bookingStatus: r["Booking Status"] as BookingRecord["bookingStatus"],
    timestamp: r["Timestamp"],
  };
}

function mapDailyOperationRow(r: Record<string, string>): DailyOperationRecord {
  return {
    date: r["Date"],
    studentId: r["Student ID"],
    defaultVehicleId: r["Default Vehicle"],
    operationalVehicleId: r["Operational Vehicle"],
    clubbed: r["Clubbed"] === "TRUE" || r["Clubbed"] === "true",
    changedBy: r["Changed By"],
    changedAt: r["Changed At"],
    reason: r["Reason"],
  };
}

function mapVehicleDailyStatusRow(r: Record<string, string>): VehicleDailyStatusRecord {
  return {
    date: r["Date"],
    vehicleId: r["Vehicle"],
    status: r["Status"] as VehicleDailyStatusRecord["status"],
    reason: r["Reason"],
    updatedBy: r["Updated By"],
    updatedAt: r["Updated At"],
  };
}

function mapAttendanceRow(r: Record<string, string>): AttendanceRecord {
  return {
    attendanceId: r["Attendance ID"],
    date: r["Date"],
    studentId: r["Student ID"],
    studentName: r["Student Name"],
    defaultVehicleId: r["Default Vehicle"],
    operationalVehicleId: r["Operational Vehicle"],
    vehicleId: r["Vehicle"],
    driverId: r["Driver"],
    status: r["Status"] as AttendanceRecord["status"],
    absenceReason: r["Absence Reason"],
    timestamp: r["Timestamp"],
  };
}

function mapClubbingHistoryRow(r: Record<string, string>): ClubbingHistoryRecord {
  return {
    date: r["Date"],
    studentId: r["Student ID"],
    studentName: r["Student Name"],
    fromVehicleId: r["From Vehicle"],
    toVehicleId: r["To Vehicle"],
    changedBy: r["Changed By"],
    timestamp: r["Timestamp"],
    reason: r["Reason"],
  };
}

/** Fetches everything the Route Incharge's Daily Dashboard needs in ONE
 * Google API call (via batchGet) instead of six separate ones. This is
 * the main latency fix for that page — filtering by date/route still
 * happens in memory afterwards, same as before, but the network round
 * trip count drops from 6 to (at most) 1. */
export async function getDailyDashboardBundle(): Promise<{
  vehicles: VehicleRecord[];
  students: StudentRecord[];
  bookings: BookingRecord[];
  dailyOps: DailyOperationRecord[];
  vehicleStatuses: VehicleDailyStatusRecord[];
  attendance: AttendanceRecord[];
}> {
  const sheets = await batchReadSheets([
    SHEET.Vehicles,
    SHEET.Students,
    SHEET.Bookings,
    SHEET.DailyOperations,
    SHEET.VehicleDailyStatus,
    SHEET.Attendance,
  ]);

  return {
    vehicles: sheets[SHEET.Vehicles].map(mapVehicleRow),
    students: sheets[SHEET.Students].map(mapStudentRow),
    bookings: sheets[SHEET.Bookings].map(mapBookingRow).filter((b) => b.bookingStatus === "Booked"),
    dailyOps: sheets[SHEET.DailyOperations].map(mapDailyOperationRow),
    vehicleStatuses: sheets[SHEET.VehicleDailyStatus].map(mapVehicleDailyStatusRow),
    attendance: sheets[SHEET.Attendance].map(mapAttendanceRow),
  };
}

/** Fetches everything the monthly PDF report needs in ONE batched call. */
export async function getMonthlyReportBundle(): Promise<{
  vehicles: VehicleRecord[];
  students: StudentRecord[];
  bookings: BookingRecord[];
  dailyOps: DailyOperationRecord[];
  vehicleStatuses: VehicleDailyStatusRecord[];
  attendance: AttendanceRecord[];
  clubbingHistory: ClubbingHistoryRecord[];
}> {
  const sheets = await batchReadSheets([
    SHEET.Vehicles,
    SHEET.Students,
    SHEET.Bookings,
    SHEET.DailyOperations,
    SHEET.VehicleDailyStatus,
    SHEET.Attendance,
    SHEET.ClubbingHistory,
  ]);

  return {
    vehicles: sheets[SHEET.Vehicles].map(mapVehicleRow),
    students: sheets[SHEET.Students].map(mapStudentRow),
    bookings: sheets[SHEET.Bookings].map(mapBookingRow),
    dailyOps: sheets[SHEET.DailyOperations].map(mapDailyOperationRow),
    vehicleStatuses: sheets[SHEET.VehicleDailyStatus].map(mapVehicleDailyStatusRow),
    attendance: sheets[SHEET.Attendance].map(mapAttendanceRow),
    clubbingHistory: sheets[SHEET.ClubbingHistory].map(mapClubbingHistoryRow),
  };
}

// ============================================================================
// NON-WORKING DAYS (college-wide holidays — booking is blocked on these dates)
// ============================================================================
export async function getAllNonWorkingDays(): Promise<NonWorkingDayRecord[]> {
  const rows = await readSheet(SHEET.NonWorkingDays);
  return rows.map((r) => ({
    date: r["Date"],
    reason: r["Reason"],
    markedBy: r["Marked By"],
    markedAt: r["Marked At"],
  }));
}

/** Returns the NonWorkingDay record for a date, or null if it's a normal
 * working day. Every booking attempt checks this before creating a row. */
export async function getNonWorkingDay(date: string): Promise<NonWorkingDayRecord | null> {
  const all = await getAllNonWorkingDays();
  return all.find((d) => d.date === date) || null;
}

/** Marks a date as non-working. Idempotent — marking an already-marked
 * date just updates the reason instead of creating a duplicate row. */
export async function addNonWorkingDay(record: NonWorkingDayRecord): Promise<void> {
  const updated = await updateRowByKey(SHEET.NonWorkingDays, "Date", record.date, {
    Reason: record.reason,
    "Marked By": record.markedBy,
    "Marked At": record.markedAt,
  });
  if (updated) return;

  await appendRow(SHEET.NonWorkingDays, [record.date, record.reason, record.markedBy, record.markedAt]);
}

/** Un-marks a date, allowing bookings again. */
export async function removeNonWorkingDay(date: string): Promise<boolean> {
  return deleteRowByKey(SHEET.NonWorkingDays, "Date", date);
}
