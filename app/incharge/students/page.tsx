"use client";

import { useEffect, useState, useCallback } from "react";
import NavBar from "@/components/NavBar";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/ToastProvider";

interface Student {
  studentId: string;
  name: string;
  classCourse: string;
  route: string;
  defaultVehicleId: string;
  contact: string;
  status: "Active" | "Inactive";
}
interface Vehicle {
  vehicleId: string;
  vehicleNumber: string;
}

export default function StudentsPage() {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    classCourse: "",
    route: "",
    defaultVehicleId: "",
    contact: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, vRes] = await Promise.all([fetch("/api/students"), fetch("/api/vehicles")]);
    if (sRes.ok) setStudents((await sRes.json()).students);
    if (vRes.ok) setVehicles((await vRes.json()).vehicles);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Student added.", "success");
      setShowAdd(false);
      setForm({ name: "", classCourse: "", route: "", defaultVehicleId: "", contact: "" });
      load();
    } else {
      showToast(data.error || "Failed to add student.", "error");
    }
    setSaving(false);
  }

  async function changeDefaultVehicle(studentId: string, defaultVehicleId: string) {
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, defaultVehicleId }),
    });
    if (res.ok) {
      showToast("Default vehicle updated. Past history is unaffected.", "success");
      load();
    }
    setEditingId(null);
  }

  async function toggleStatus(studentId: string, current: "Active" | "Inactive") {
    const status = current === "Active" ? "Inactive" : "Active";
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, status }),
    });
    if (res.ok) {
      showToast(`Student marked ${status}.`, "success");
      load();
    }
  }

  const vehicleNumber = (id: string) => vehicles.find((v) => v.vehicleId === id)?.vehicleNumber || id;

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Students</h1>
          <button className="btn-primary" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "+ Add Student"}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addStudent} className="card mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Full name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              required
              placeholder="Class / Course"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.classCourse}
              onChange={(e) => setForm({ ...form, classCourse: e.target.value })}
            />
            <input
              required
              placeholder="Route"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.route}
              onChange={(e) => setForm({ ...form, route: e.target.value })}
            />
            <select
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.defaultVehicleId}
              onChange={(e) => setForm({ ...form, defaultVehicleId: e.target.value })}
            >
              <option value="">Default vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.vehicleNumber}
                </option>
              ))}
            </select>
            <input
              placeholder="Contact"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
            <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">
              {saving ? "Saving…" : "Save Student"}
            </button>
          </form>
        )}

        <input
          placeholder="Search by name or ID…"
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
                  <th>Class</th>
                  <th>Default Vehicle</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.studentId}>
                    <td className="font-medium">{s.name}</td>
                    <td>{s.classCourse}</td>
                    <td>
                      {editingId === s.studentId ? (
                        <select
                          autoFocus
                          defaultValue={s.defaultVehicleId}
                          onBlur={(e) => changeDefaultVehicle(s.studentId, e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          {vehicles.map((v) => (
                            <option key={v.vehicleId} value={v.vehicleId}>
                              {v.vehicleNumber}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          className="underline decoration-dotted"
                          onClick={() => setEditingId(s.studentId)}
                        >
                          {vehicleNumber(s.defaultVehicleId)}
                        </button>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>
                      <button
                        className="text-sm text-brand-600 underline"
                        onClick={() => toggleStatus(s.studentId, s.status)}
                      >
                        {s.status === "Active" ? "Deactivate" : "Activate"}
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
