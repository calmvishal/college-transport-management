"use client";

import { addDays, formatDisplayDate } from "@/lib/dateUtils";

export default function DateNav({
  date,
  onChange,
  minDate,
  maxDate,
}: {
  date: string;
  onChange: (newDate: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const atMin = !!minDate && date <= minDate;
  const atMax = !!maxDate && date >= maxDate;

  return (
    <div className="card flex flex-col items-center justify-between gap-3 sm:flex-row">
      <button
        className="btn-secondary w-full sm:w-auto"
        onClick={() => onChange(addDays(date, -1))}
        disabled={atMin}
      >
        ← Previous Day
      </button>

      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-semibold">{formatDisplayDate(date)}</span>
        <input
          type="date"
          value={date}
          min={minDate}
          max={maxDate}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </div>

      <button
        className="btn-secondary w-full sm:w-auto"
        onClick={() => onChange(addDays(date, 1))}
        disabled={atMax}
      >
        Next Day →
      </button>
    </div>
  );
}
