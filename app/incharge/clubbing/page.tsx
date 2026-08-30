"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import NavBar from "@/components/NavBar";
import DateNav from "@/components/DateNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/ToastProvider";
import { nextBookableDateKey, formatDisplayDate } from "@/lib/dateUtils";

interface VehicleView {
  vehicleId: string;
  vehicleNumber: string;
  capacity: number;
  operationalStudents: number;
}

interface StudentView {
  studentId: string;
  studentName: string;
  defaultVehicleId: string;
  operationalVehicleId: string | null;
  booked: boolean;
}

export default function ClubbingPage() {
  const { showToast } = useToast();
  const [date, setDate] = useState(nextBookableDateKey());
  const [vehicles, setVehicles] = useState<VehicleView[]>([]);
  const [students, setStudents] = useState<StudentView[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromVehicleId, setFromVehicleId] = useState("");
  const [toVehicleId, setToVehicleId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/daily-dashboard?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setVehicles(data.vehicles);
      setStudents(data.students);
    }
    setLoading(false);
    setSelected(new Set());
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const candidateStudents = useMemo(() => {
    const fromVehicle = vehicles.find((v) => v.vehicleId === fromVehicleId);

    if (!fromVehicle) return [];

    return students.filter(
      (s) =>
        s.booked &&
        (s.operationalVehicleId === fromVehicle.vehicleId ||
          s.operationalVehicleId === fromVehicle.vehicleNumber),
    );
  }, [students, vehicles, fromVehicleId]);

  const destinationVehicle = vehicles.find((v) => v.vehicleId === toVehicleId);

  function toggle(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(candidateStudents.map((s) => s.studentId)));
  }

  async function confirmClub() {
    setSubmitting(true);
    const res = await fetch("/api/clubbing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        studentIds: Array.from(selected),
        toVehicleId,
        reason,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(
        `Moved ${data.movedCount} student(s) to ${destinationVehicle?.vehicleNumber}.`,
        "success",
      );
      setConfirmOpen(false);
      setReason("");
      load();
    } else {
      showToast(data.error || "Clubbing failed.", "error");
    }
    setSubmitting(false);
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-bold">Student Clubbing</h1>
        <p className="text-sm text-slate-500">
          Move booked students from a low-booking vehicle into another for a
          specific date.
        </p>

        <div className="mt-4">
          <DateNav date={date} onChange={setDate} />
        </div>

        {loading ? (
          <div className="card mt-6 animate-pulse text-slate-400">Loading…</div>
        ) : (
          <div className="card mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  From Vehicle
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={fromVehicleId}
                  onChange={(e) => {
                    setFromVehicleId(e.target.value);
                    setSelected(new Set());
                  }}
                >
                  <option value="">Select vehicle…</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId}>
                      {v.vehicleNumber} ({v.operationalStudents} booked)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Move to Vehicle
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={toVehicleId}
                  onChange={(e) => setToVehicleId(e.target.value)}
                >
                  <option value="">Select vehicle…</option>
                  {vehicles
                    .filter((v) => v.vehicleId !== fromVehicleId)
                    .map((v) => (
                      <option key={v.vehicleId} value={v.vehicleId}>
                        {v.vehicleNumber} ({v.operationalStudents}/{v.capacity})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {fromVehicleId && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    Booked students on this vehicle ({candidateStudents.length})
                  </span>
                  <button
                    className="text-sm text-brand-600 underline"
                    onClick={selectAll}
                  >
                    Select all
                  </button>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        <th>Student</th>
                        <th>Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidateStudents.map((s) => (
                        <tr key={s.studentId}>
                          <td>
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={selected.has(s.studentId)}
                              onChange={() => toggle(s.studentId)}
                            />
                          </td>
                          <td>{s.studentName}</td>
                          <td>{s.defaultVehicleId}</td>
                        </tr>
                      ))}
                      {candidateStudents.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="text-center text-slate-400"
                          >
                            No booked students on this vehicle for {date}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Low bookings on Bus 1"
              />
            </div>

            <button
              className="btn-primary w-full sm:w-auto"
              disabled={selected.size === 0 || !toVehicleId}
              onClick={() => setConfirmOpen(true)}
            >
              Club {selected.size} student(s) to{" "}
              {destinationVehicle?.vehicleNumber || "…"}
            </button>
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title="Confirm Clubbing"
          message={`${selected.size} student(s) will be moved from ${
            vehicles.find((v) => v.vehicleId === fromVehicleId)?.vehicleNumber
          } to ${destinationVehicle?.vehicleNumber} for ${formatDisplayDate(date)}.`}
          confirmLabel="Move Students"
          onConfirm={confirmClub}
          onCancel={() => setConfirmOpen(false)}
          loading={submitting}
        />
      </main>
    </div>
  );
}
