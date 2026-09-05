"use client";

import { useEffect, useState, useCallback } from "react";
import NavBar from "@/components/NavBar";
import DateNav from "@/components/DateNav";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/ToastProvider";
import { todayKey, isPastDate, nextBookableDateKey } from "@/lib/dateUtils";

interface VehicleView {
  vehicleId: string;
  vehicleNumber: string;
  capacity: number;
  booked: number;
  operationalStudents: number;
  present: number;
  absent: number;
  status: "Sent" | "Not Sent" | "Unmarked";
}

interface StudentView {
  studentId: string;
  studentName: string;
  defaultVehicleId: string;
  operationalVehicleId: string | null;
  booked: boolean;
  attendance: string;
}

interface Summary {
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

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function IncharageDailyDashboard() {
  const { showToast } = useToast();
  const [date, setDate] = useState(todayKey());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vehicles, setVehicles] = useState<VehicleView[]>([]);
  const [students, setStudents] = useState<StudentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStudents, setShowStudents] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [holiday, setHoliday] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/daily-dashboard?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setSummary(data.summary);
      setVehicles(data.vehicles);
      setStudents(data.students);
      setHoliday(data.holiday || null);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const totalAbsent = summary
    ? summary.studentsAbsentStudent + summary.studentsAbsentVehicleNotSent
    : 0;

  async function markVehicleStatus(vehicleId: string, status: "Sent" | "Not Sent") {
    let reason = "";
    if (status === "Not Sent") {
      reason = window.prompt("Reason for Not Sent (required):") || "";
      if (!reason) {
        showToast("A reason is required to mark a vehicle Not Sent.", "error");
        return;
      }
    }
    setStatusUpdating(vehicleId);
    const res = await fetch("/api/vehicle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, vehicleId, status, reason }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Vehicle marked ${status}.`, "success");
      load();
    } else {
      showToast(data.error || "Failed to update vehicle status.", "error");
    }
    setStatusUpdating(null);
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-xl font-bold">Daily Dashboard</h1>
        <p className="text-sm text-slate-500">Complete transport status for a selected date.</p>

        <div className="mt-4">
          <DateNav date={date} onChange={setDate} />
        </div>

        <div className="mt-2 flex justify-center gap-2">
          <button
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              date === todayKey() ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setDate(todayKey())}
          >
            Today
          </button>
          <button
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              date === nextBookableDateKey() ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setDate(nextBookableDateKey())}
          >
            Tomorrow (bookable day)
          </button>
        </div>

        {isPastDate(date) && (
          <div className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            You're viewing a past date. This view is read-only; use attendance corrections or
            authorized admin actions if changes are genuinely needed.
          </div>
        )}

        {holiday && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {date} is marked a non-working day ({holiday}). All vehicles are automatically shown as
            Not Sent, and students could not book for this date.
          </div>
        )}

        {loading || !summary ? (
          <div className="card mt-6 animate-pulse text-slate-400">Loading…</div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <SummaryCard label="Vehicles" value={`${summary.vehiclesSent} / ${summary.totalVehicles}`} sub="Sent" />
              <SummaryCard label="Students Booked" value={summary.studentsBooked} />
              <SummaryCard label="Students Present" value={summary.studentsPresent} />
              <SummaryCard label="Students Absent" value={totalAbsent} />
              <SummaryCard label="Clubbed" value={summary.clubbedStudents} />
              <SummaryCard label="Vehicles Not Sent" value={summary.vehiclesNotSent} />
            </div>

            <div className="card mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">
                  Vehicles Present: {summary.vehiclesSent} / {summary.totalVehicles}
                </h2>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Capacity</th>
                      <th>Booked</th>
                      <th>Operational</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.vehicleId}>
                        <td className="font-medium">{v.vehicleNumber}</td>
                        <td>{v.capacity}</td>
                        <td>{v.booked}</td>
                        <td>{v.operationalStudents}</td>
                        <td>{v.present}</td>
                        <td>{v.absent}</td>
                        <td>
                          <StatusBadge status={v.status} />
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn-secondary px-2 py-1 text-xs"
                              disabled={statusUpdating === v.vehicleId || isPastDate(date) || !!holiday}
                              onClick={() => markVehicleStatus(v.vehicleId, "Sent")}
                            >
                              Sent
                            </button>
                            <button
                              className="btn-secondary px-2 py-1 text-xs"
                              disabled={statusUpdating === v.vehicleId || isPastDate(date) || !!holiday}
                              onClick={() => markVehicleStatus(v.vehicleId, "Not Sent")}
                            >
                              Not Sent
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card mt-6">
              <button
                className="flex w-full items-center justify-between text-left font-semibold"
                onClick={() => setShowStudents((s) => !s)}
              >
                Student-wise Daily View
                <span className="text-sm text-slate-400">{showStudents ? "Hide" : "Show"}</span>
              </button>

              {showStudents && (
                <div className="table-scroll mt-3">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Default Vehicle</th>
                        <th>Operational Vehicle</th>
                        <th>Booking</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.studentId}>
                          <td>{s.studentName}</td>
                          <td>{s.defaultVehicleId}</td>
                          <td>{s.operationalVehicleId || "-"}</td>
                          <td>
                            <StatusBadge status={s.booked ? "Booked" : "Not Booked"} />
                          </td>
                          <td>
                            <StatusBadge status={s.attendance} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
