import clsx from "clsx";

const STYLES: Record<string, string> = {
  Present: "bg-emerald-100 text-emerald-700",
  "Absent - Student": "bg-red-100 text-red-700",
  "Absent - Vehicle Not Sent": "bg-amber-100 text-amber-800",
  Booked: "bg-blue-100 text-blue-700",
  "Not Booked": "bg-slate-100 text-slate-500",
  Pending: "bg-slate-100 text-slate-500",
  Sent: "bg-emerald-100 text-emerald-700",
  "Not Sent": "bg-red-100 text-red-700",
  Unmarked: "bg-slate-100 text-slate-500",
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-slate-200 text-slate-600",
  Clubbed: "bg-purple-100 text-purple-700",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        STYLES[status] || "bg-slate-100 text-slate-600"
      )}
    >
      {status}
    </span>
  );
}
