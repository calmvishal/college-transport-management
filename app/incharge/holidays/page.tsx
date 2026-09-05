"use client";

import { useEffect, useState, useCallback } from "react";
import NavBar from "@/components/NavBar";
import { useToast } from "@/components/ToastProvider";
import { formatDisplayDate, todayKey } from "@/lib/dateUtils";

interface Holiday {
  date: string;
  reason: string;
  markedBy: string;
  markedAt: string;
}

export default function HolidaysPage() {
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/non-working-days");
    if (res.ok) {
      const data = await res.json();
      setHolidays(
        (data.nonWorkingDays as Holiday[]).slice().sort((a, b) => a.date.localeCompare(b.date))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/non-working-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Marked as a non-working day. Students can't book for it.", "success");
      setDate("");
      setReason("");
      load();
    } else {
      showToast(data.error || "Failed to mark this date.", "error");
    }
    setSaving(false);
  }

  async function removeHoliday(d: string) {
    const res = await fetch("/api/non-working-days", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: d }),
    });
    if (res.ok) {
      showToast("Removed. Booking is allowed again for that date.", "success");
      load();
    }
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">Non-Working Days</h1>
        <p className="text-sm text-slate-500">
          Mark college holidays or off days. Students will not be able to book transport for these
          dates, no matter which vehicle they're assigned to.
        </p>

        <form onSubmit={addHoliday} className="card mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input
            type="date"
            required
            min={todayKey()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Reason (e.g. Diwali, College Anniversary)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Mark"}
          </button>
        </form>

        <div className="table-scroll mt-4">
          {loading ? (
            <div className="p-4 text-slate-400">Loading…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Marked By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.date}>
                    <td className="font-medium">{formatDisplayDate(h.date)}</td>
                    <td>{h.reason}</td>
                    <td>{h.markedBy}</td>
                    <td>
                      <button className="text-sm text-red-600 underline" onClick={() => removeHoliday(h.date)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {holidays.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-slate-400">
                      No non-working days marked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
