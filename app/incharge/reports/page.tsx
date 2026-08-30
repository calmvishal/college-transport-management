"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import { useToast } from "@/components/ToastProvider";

interface Vehicle {
  vehicleId: string;
  vehicleNumber: string;
}
interface Student {
  studentId: string;
  name: string;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const { showToast } = useToast();
  const [month, setMonth] = useState(currentYearMonth());
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((d) => setVehicles(d.vehicles || []));
    fetch("/api/students")
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []));
  }, []);

  async function generate() {
    setGenerating(true);
    const params = new URLSearchParams({ month });
    if (vehicleId) params.set("vehicleId", vehicleId);
    if (studentId) params.set("studentId", studentId);

    const res = await fetch(`/api/reports/monthly?${params.toString()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Failed to generate report.", "error");
      setGenerating(false);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transport-report-${month}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast("Report downloaded.", "success");
    setGenerating(false);
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">Monthly Reports</h1>
        <p className="text-sm text-slate-500">
          Generate an official PDF attendance report for a calendar month.
        </p>

        <div className="card mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Filter by Vehicle (optional)</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All vehicles</option>
              {vehicles.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.vehicleNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Filter by Student (optional)</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All students</option>
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-primary w-full" onClick={generate} disabled={generating}>
            {generating ? "Generating…" : "Generate Monthly PDF"}
          </button>
        </div>
      </main>
    </div>
  );
}
