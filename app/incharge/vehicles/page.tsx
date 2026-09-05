"use client";

import { useEffect, useState, useCallback } from "react";
import NavBar from "@/components/NavBar";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/ToastProvider";

interface Vehicle {
  vehicleId: string;
  vehicleNumber: string;
  route: string;
  capacity: number;
  driverId: string;
  status: "Active" | "Inactive";
}

export default function VehiclesPage() {
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ vehicleNumber: "", capacity: 40, driverId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/vehicles");
    if (res.ok) setVehicles((await res.json()).vehicles);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Vehicle added.", "success");
      setShowAdd(false);
      setForm({ vehicleNumber: "", capacity: 40, driverId: "" });
      load();
    } else {
      showToast(data.error || "Failed to add vehicle.", "error");
    }
    setSaving(false);
  }

  async function toggleStatus(vehicleId: string, current: "Active" | "Inactive") {
    const status = current === "Active" ? "Inactive" : "Active";
    const res = await fetch("/api/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, status }),
    });
    if (res.ok) {
      showToast(`Vehicle marked ${status}.`, "success");
      load();
    }
  }

  const filtered = vehicles.filter(
    (v) =>
      v.vehicleNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.route.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Vehicles</h1>
          <button className="btn-primary" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "+ Add Vehicle"}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addVehicle} className="card mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Vehicle number (e.g. Bus 4)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.vehicleNumber}
              onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
            />
            <input
              required
              type="number"
              min={1}
              placeholder="Capacity"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
            <input
              placeholder="Driver ID (optional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            />
            <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">
              {saving ? "Saving…" : "Save Vehicle"}
            </button>
          </form>
        )}

        <input
          placeholder="Search vehicles…"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="table-scroll mt-4">
          {loading ? (
            <div className="p-4 text-slate-400">Loading…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Route</th>
                  <th>Capacity</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.vehicleId}>
                    <td className="font-medium">{v.vehicleNumber}</td>
                    <td>{v.route}</td>
                    <td>{v.capacity}</td>
                    <td>{v.driverId || "-"}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>
                      <button
                        className="text-sm text-brand-600 underline"
                        onClick={() => toggleStatus(v.vehicleId, v.status)}
                      >
                        {v.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
