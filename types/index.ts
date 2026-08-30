// ============================================================================
// CORE DOMAIN TYPES
// These mirror the Google Sheets schema 1:1. Every sheet row maps to one of
// these shapes. Keep this file as the single source of truth for field names
// so API routes, business logic, and UI never drift apart.
// ============================================================================

export type Role = "student" | "driver" | "incharge";
export type Status = "Active" | "Inactive";
export type BookingStatus = "Booked" | "Cancelled";
export type VehicleDailyStatusValue = "Sent" | "Not Sent";
export type AttendanceStatus =
  | "Present"
  | "Absent - Student"
  | "Absent - Vehicle Not Sent";

export interface UserRecord {
  userId: string;
  name: string;
  role: Role;
  authId: string; // email or username used to log in
  passwordHash: string; // bcrypt hash, never sent to the client
  route: string;
  vehicleId: string; // relevant for drivers only
  studentId: string; // relevant for students only, links Users -> Students
  status: Status;
}

export interface StudentRecord {
  studentId: string;
  name: string;
  classCourse: string;
  route: string;
  defaultVehicleId: string;
  contact: string;
  status: Status;
}

export interface VehicleRecord {
  vehicleId: string;
  vehicleNumber: string;
  route: string;
  capacity: number;
  driverId: string;
  status: Status;
  dateAdded: string;
}

export interface DriverRecord {
  driverId: string;
  name: string;
  phone: string;
  licenseInfo: string;
  vehicleId: string;
  route: string;
  status: Status;
}

export interface BookingRecord {
  bookingId: string;
  travelDate: string; // yyyy-MM-dd
  studentId: string;
  defaultVehicleId: string; // snapshot at time of booking
  bookingStatus: BookingStatus;
  timestamp: string;
}

/** One row per student per date once they have a booking. This is where
 * clubbing lives: defaultVehicleId never changes here, operationalVehicleId
 * does. If no clubbing has happened, operationalVehicleId === defaultVehicleId. */
export interface DailyOperationRecord {
  date: string;
  studentId: string;
  defaultVehicleId: string;
  operationalVehicleId: string;
  clubbed: boolean;
  changedBy: string;
  changedAt: string;
  reason: string;
}

export interface VehicleDailyStatusRecord {
  date: string;
  vehicleId: string;
  status: VehicleDailyStatusValue;
  reason: string;
  updatedBy: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  attendanceId: string;
  date: string;
  studentId: string;
  studentName: string;
  defaultVehicleId: string;
  operationalVehicleId: string;
  vehicleId: string; // == operationalVehicleId, kept for report readability
  driverId: string;
  status: AttendanceStatus;
  absenceReason: string;
  timestamp: string;
}

export interface ClubbingHistoryRecord {
  date: string;
  studentId: string;
  studentName: string;
  fromVehicleId: string;
  toVehicleId: string;
  changedBy: string;
  timestamp: string;
  reason: string;
}

export interface AuditLogRecord {
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue: string;
  newValue: string;
}

// ============================================================================
// DERIVED / COMPUTED VIEW-MODEL TYPES (never stored, always calculated)
// ============================================================================

export interface StudentDailyView {
  studentId: string;
  studentName: string;
  defaultVehicleId: string;
  operationalVehicleId: string | null;
  booked: boolean;
  attendance: AttendanceStatus | "Pending" | "Not Booked";
}

export interface VehicleDailyView {
  vehicleId: string;
  vehicleNumber: string;
  capacity: number;
  booked: number;
  operationalStudents: number;
  present: number;
  absent: number;
  status: VehicleDailyStatusValue | "Unmarked";
}

export interface DailyDashboardSummary {
  date: string;
  totalVehicles: number;
  vehiclesSent: number;
  vehiclesNotSent: number;
  studentsBooked: number;
  studentsPresent: number;
  studentsAbsentStudent: number;
  studentsAbsentVehicleNotSent: number;
  clubbedStudents: number;
}
