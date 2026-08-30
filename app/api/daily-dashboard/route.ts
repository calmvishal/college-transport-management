import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { getDailyDashboardBundle } from "@/lib/repository";
import {
  buildDailyDashboardSummary,
  buildStudentDailyViews,
  buildVehicleDailyViews,
  buildVehicleSentMap,
} from "@/lib/transportLogic";
import { todayKey } from "@/lib/dateUtils";

/** GET /api/daily-dashboard?date=yyyy-MM-dd — powers the Route Incharge's
 * Daily Dashboard (Section 23): top summary cards, vehicle-wise table with
 * post-clubbing operational counts, and a per-student breakdown. Defaults
 * to today if no date is given. Every number here is derived from the same
 * transportLogic functions used by the driver roster and monthly PDF, so
 * totals always reconcile.
 *
 * PERFORMANCE: all sheet reads happen via getDailyDashboardBundle(), which
 * fetches every sheet this page needs in a single Google API call (with a
 * short in-memory cache on top), instead of six separate round trips. */
export async function GET(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be yyyy-MM-dd." }, { status: 400 });
  }

  const bundle = await getDailyDashboardBundle();

  // Scope to the incharge's authorized route.
  const vehicles = bundle.vehicles.filter((v) => v.route === session.user.route);
  const students = bundle.students.filter((s) => s.route === session.user.route);
  const bookings = bundle.bookings.filter((b) => b.travelDate === date);
  const dailyOps = bundle.dailyOps.filter((o) => o.date === date);
  const vehicleStatuses = bundle.vehicleStatuses.filter((v) => v.date === date);
  const attendance = bundle.attendance.filter((a) => a.date === date);

  const vehicleSentMap = buildVehicleSentMap(vehicleStatuses);

  const studentViews = buildStudentDailyViews({
  date,
  students,
  bookings,
  dailyOps,
  vehicleSentMap,
  attendance,
  vehicles,
});

  const vehicleViews = buildVehicleDailyViews({ vehicles, studentViews, vehicleSentMap });

  const summary = buildDailyDashboardSummary({
    date,
    vehicles,
    vehicleSentMap,
    studentViews,
  });

  return NextResponse.json({
    date,
    summary,
    vehicles: vehicleViews,
    students: studentViews,
  });
}
