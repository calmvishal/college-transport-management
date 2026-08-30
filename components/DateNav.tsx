"use client";

import { addDays, formatDisplayDate } from "@/lib/dateUtils";

export default function DateNav({
  date,
  onChange,
}: {
  date: string;
  onChange: (newDate: string) => void;
}) {
  return (
    <div className="card flex flex-col items-center justify-between gap-3 sm:flex-row">
      <button className="btn-secondary w-full sm:w-auto" onClick={() => onChange(addDays(date, -1))}>
        ← Previous Day
      </button>

      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-semibold">{formatDisplayDate(date)}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </div>

      <button className="btn-secondary w-full sm:w-auto" onClick={() => onChange(addDays(date, 1))}>
        Next Day →
      </button>
    </div>
  );
}
