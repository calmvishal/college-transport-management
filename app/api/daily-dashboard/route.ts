import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { getDailyDashboardBundle, getNonWorkingDay } from "@/lib/repository";
import {
  buildDailyDashboardSummary,
  buildStudentDailyViews,
  buildVehicleDailyViews,
  buildVehicleSentMap,
} from "@/lib/transportLogic";
import { todayKey } from "@/lib/dateUtils";

/** GET /api/daily-dashboard?date=yyyy-MM-dd — powers the Route Incharge's
 * Daily Dashboard: top summary cards, vehicle-wise table with post-clubbing
 * operational counts, and a per-student breakdown. Defaults to today if no
 * date is given. Every number here is derived from the same transportLogic
 * functions used by the driver roster and monthly PDF, so totals always
 * reconcile.
 *
 * PERFORMANCE: all sheet reads happen via getDailyDashboardBundle(), which
 * fetches every sheet this page needs in a single Google API call, instead
 * of six separate round trips. Nothing here is cached — see the note in
 * lib/sheets.ts on why an earlier caching layer was removed. */
export async function GET(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be yyyy-MM-dd." }, { status: 400 });
  }

  const [bundle, holiday] = await Promise.all([getDailyDashboardBundle(), getNonWorkingDay(date)]);

  // Scope to the incharge's authorized route.
  const vehicles = bundle.vehicles.filter((v) => v.route === session.user.route);
  const students = bundle.students.filter((s) => s.route === session.user.route);
  const bookings = bundle.bookings.filter((b) => b.travelDate === date);
  const dailyOps = bundle.dailyOps.filter((o) => o.date === date);
  const vehicleStatuses = bundle.vehicleStatuses.filter((v) => v.date === date);
  const attendance = bundle.attendance.filter((a) => a.date === date);

  let vehicleSentMap = buildVehicleSentMap(vehicleStatuses);

  // If this date is marked a non-working day (holiday), every vehicle is
  // treated as Not Sent automatically — the incharge shouldn't have to
  // separately mark each vehicle Not Sent on top of marking the holiday.
  // This overrides any individually recorded vehicle status for the date.
  if (holiday) {
    vehicleSentMap = new Map(vehicles.map((v) => [v.vehicleId, false]));
  }

  const studentViews = buildStudentDailyViews({
    date,
    students,
    bookings,
    dailyOps,
    vehicleSentMap,
    attendance,
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
    holiday: holiday ? holiday.reason : null,
  });
}

