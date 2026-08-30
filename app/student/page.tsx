"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/ToastProvider";

interface StudentStatus {
  travelDate: string;
  defaultVehicleId: string;
  defaultVehicleNumber: string;
  booked: boolean;
  operationalVehicleId: string | null;
  operationalVehicleNumber: string | null;
  clubbed: boolean;
  vehicleStatus: "Sent" | "Not Sent" | null;
}

export default function StudentPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/student/status");
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBook() {
    setBooking(true);
    const res = await fetch("/api/booking", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      showToast("Booking confirmed for tomorrow.", "success");
      load();
    } else {
      showToast(data.error || "Booking failed.", "error");
    }
    setBooking(false);
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">Hi, {session?.user?.name}</h1>
        <p className="text-sm text-slate-500">Here's your transport status for tomorrow.</p>

        {loading || !status ? (
          <div className="card mt-6 animate-pulse text-slate-400">Loading…</div>
        ) : (
          <div className="card mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Tomorrow</span>
              <span className="font-semibold">{status.travelDate}</span>
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
                    You've been clubbed from {status.defaultVehicleNumber} to{" "}
                    {status.operationalVehicleNumber} for {status.travelDate}.
                  </div>
                )}

                {status.vehicleStatus && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-slate-500">Vehicle Status</span>
                    <StatusBadge status={status.vehicleStatus} />
                  </div>
                )}
              </>
            )}

            {!status.booked && (
              <button className="btn-primary w-full" onClick={handleBook} disabled={booking}>
                {booking ? "Booking…" : `Book transport for ${status.travelDate}`}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
