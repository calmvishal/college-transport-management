"use client";

import { useEffect, useState, useCallback } from "react";
import NavBar from "@/components/NavBar";
import StatusBadge from "@/components/StatusBadge";
import DateNav from "@/components/DateNav";
import { useToast } from "@/components/ToastProvider";
import { todayKey } from "@/lib/dateUtils";

interface RosterEntry {
  studentId: string;
  studentName: string;
  defaultVehicleId: string;
  operationalVehicleId: string | null;
  attendance: string;
}

export default function DriverPage() {
  const { showToast } = useToast();
  const [date, setDate] = useState(todayKey());
  const [vehicleSent, setVehicleSent] = useState<boolean | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/attendance?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setVehicleSent(data.vehicleSent);
      setRoster(data.roster);
      const initialMarks: Record<string, boolean> = {};
      data.roster.forEach((r: RosterEntry) => {
        initialMarks[r.studentId] = r.attendance === "Present";
      });
      setMarks(initialMarks);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setSubmitting(true);
    const payload = {
      date,
      marks: roster.map((r) => ({ studentId: r.studentId, present: !!marks[r.studentId] })),
    };
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Attendance submitted.", "success");
      load();
    } else {
      showToast(data.error || "Submission failed.", "error");
    }
    setSubmitting(false);
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold">Attendance</h1>
        <div className="mt-4">
          <DateNav date={date} onChange={setDate} />
        </div>

        {loading ? (
          <div className="card mt-6 animate-pulse text-slate-400">Loading…</div>
        ) : vehicleSent === false ? (
          <div className="card mt-6 bg-amber-50 text-amber-800">
            This vehicle is marked <strong>Not Sent</strong> for {date}. All scheduled students are
            automatically recorded as <em>Absent — Vehicle Not Sent</em>. No action needed.
          </div>
        ) : roster.length === 0 ? (
          <div className="card mt-6 text-slate-500">No students scheduled on your vehicle for this date.</div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Default</th>
                    <th>Operational</th>
                    <th>Present?</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.studentId}>
                      <td>{r.studentName}</td>
                      <td>{r.defaultVehicleId}</td>
                      <td>{r.operationalVehicleId}</td>
                      <td>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-5 w-5"
                            checked={!!marks[r.studentId]}
                            onChange={(e) =>
                              setMarks((m) => ({ ...m, [r.studentId]: e.target.checked }))
                            }
                          />
                          <StatusBadge status={marks[r.studentId] ? "Present" : "Absent - Student"} />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="btn-primary w-full sm:w-auto" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Attendance"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
