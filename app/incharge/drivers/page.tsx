"use client";

import { useEffect, useState, useCallback } from "react";
import NavBar from "@/components/NavBar";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/ToastProvider";

interface Driver {
  driverId: string;
  name: string;
  phone: string;
  vehicleId: string;
  route: string;
  status: "Active" | "Inactive";
}
interface Vehicle {
  vehicleId: string;
  vehicleNumber: string;
}

export default function DriversPage() {
  const { showToast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", vehicleId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [dRes, vRes] = await Promise.all([fetch("/api/drivers"), fetch("/api/vehicles")]);
    if (dRes.ok) setDrivers((await dRes.json()).drivers);
    if (vRes.ok) setVehicles((await vRes.json()).vehicles);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Driver added.", "success");
      setShowAdd(false);
      setForm({ name: "", phone: "", vehicleId: "" });
      load();
    } else {
      showToast(data.error || "Failed to add driver.", "error");
    }
    setSaving(false);
  }

  async function changeVehicle(driverId: string, vehicleId: string) {
    const res = await fetch("/api/drivers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, vehicleId }),
    });
    if (res.ok) {
      showToast("Vehicle assignment updated.", "success");
      load();
    }
  }

  async function toggleStatus(driverId: string, current: "Active" | "Inactive") {
    const status = current === "Active" ? "Inactive" : "Active";
    const res = await fetch("/api/drivers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, status }),
    });
    if (res.ok) {
      showToast(`Driver marked ${status}.`, "success");
      load();
    }
  }

  const vehicleNumber = (id: string) => vehicles.find((v) => v.vehicleId === id)?.vehicleNumber || "-";

  const filtered = drivers.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Drivers</h1>
          <button className="btn-primary" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "+ Add Driver"}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addDriver} className="card mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Full name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              required
              placeholder="Phone"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
            >
              <option value="">Assign vehicle (optional)…</option>
              {vehicles.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.vehicleNumber}
                </option>
              ))}
            </select>
            <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">
              {saving ? "Saving…" : "Save Driver"}
            </button>
          </form>
        )}

        <input
          placeholder="Search drivers…"
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
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.driverId}>
                    <td className="font-medium">{d.name}</td>
                    <td>{d.phone}</td>
                    <td>
                      <select
                        defaultValue={d.vehicleId}
                        onChange={(e) => changeVehicle(d.driverId, e.target.value)}
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {vehicles.map((v) => (
                          <option key={v.vehicleId} value={v.vehicleId}>
                            {v.vehicleNumber}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>
                      <button
                        className="text-sm text-brand-600 underline"
                        onClick={() => toggleStatus(d.driverId, d.status)}
                      >
                        {d.status === "Active" ? "Deactivate" : "Activate"}
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
