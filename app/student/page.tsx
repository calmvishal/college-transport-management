"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import StatusBadge from "@/components/StatusBadge";
import DateNav from "@/components/DateNav";
import { useToast } from "@/components/ToastProvider";
import { todayKey, nextBookableDateKey, addDays } from "@/lib/dateUtils";

interface StudentStatus {
  date: string;
  isToday: boolean;
  isBookableDay: boolean;
  bookableDate: string;
  defaultVehicleId: string;
  defaultVehicleNumber: string;
  booked: boolean;
  operationalVehicleId: string | null;
  operationalVehicleNumber: string | null;
  clubbed: boolean;
  vehicleStatus: "Sent" | "Not Sent" | null;
  attendance: string;
  holidayOnBookableDate: string | null;
}

export default function StudentPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [date, setDate] = useState(todayKey());
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/student/status?date=${date}`);
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBook() {
    setBooking(true);
    const res = await fetch("/api/booking", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      showToast("Booking confirmed.", "success");
      load();
    } else {
      showToast(data.error || "Booking failed.", "error");
    }
    setBooking(false);
  }

  // A student can look a week into the past, but never past tomorrow —
  // there's nothing to show beyond the next bookable day.
  const minViewDate = addDays(todayKey(), -7);
  const maxViewDate = nextBookableDateKey();

  const dayLabel = !status
    ? ""
    : status.isToday
    ? "Today"
    : status.date === status.bookableDate
    ? "Tomorrow"
    : status.date < todayKey()
    ? "Past"
    : "";

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">Hi, {session?.user?.name}</h1>
        <p className="text-sm text-slate-500">Browse yesterday, today, or tomorrow's transport status.</p>

        <div className="mt-4">
          <DateNav date={date} onChange={setDate} minDate={minViewDate} maxDate={maxViewDate} />
        </div>

        {loading || !status ? (
          <div className="card mt-6 animate-pulse text-slate-400">Loading…</div>
        ) : (
          <div className="card mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{dayLabel}</span>
              <span className="font-semibold">{status.date}</span>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-slate-500">Default Vehicle</span>
              <span className="font-medium">{status.defaultVehicleNumber}</span>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-slate-500">Booking</span>
              <StatusBadge status={status.booked ? "Booked" : "Not Booked"} />
            </div>

            {status.booked && (
              <>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-slate-500">Operational Vehicle</span>
                  <span className="font-medium">{status.operationalVehicleNumber}</span>
                </div>

                {status.clubbed && (
                  <div className="rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700">
                    You were clubbed from {status.defaultVehicleNumber} to{" "}
                    {status.operationalVehicleNumber} on {status.date}.
                  </div>
                )}

                {status.vehicleStatus && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-slate-500">Vehicle Status</span>
                    <StatusBadge status={status.vehicleStatus} />
                  </div>
                )}

                {status.attendance !== "Not Booked" && status.attendance !== "Pending" && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-slate-500">Attendance</span>
                    <StatusBadge status={status.attendance} />
                  </div>
                )}
              </>
            )}

            {status.isBookableDay &&
              !status.booked &&
              (status.holidayOnBookableDate ? (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {status.date} is a non-working day ({status.holidayOnBookableDate}). Booking is not
                  available.
                </div>
              ) : (
                <button className="btn-primary w-full" onClick={handleBook} disabled={booking}>
                  {booking ? "Booking…" : `Book transport for ${status.date}`}
                </button>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
