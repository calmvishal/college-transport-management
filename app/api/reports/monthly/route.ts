import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { requireRole } from "@/lib/apiAuth";
import { getMonthlyReportBundle } from "@/lib/repository";
import { buildStudentDailyViews, buildVehicleSentMap } from "@/lib/transportLogic";
import { monthRange, formatDisplayDate } from "@/lib/dateUtils";

/**
 * GET /api/reports/monthly?month=2026-08&vehicleId=&studentId=
 *
 * Builds the monthly PDF by re-running the exact same per-date resolution
 * (buildStudentDailyViews) used by the daily dashboard and driver roster,
 * once per day in the month, then aggregating. This guarantees the PDF's
 * totals can never drift from what the dashboards showed on any given day.
 *
 * PERFORMANCE: all sheet reads happen via getMonthlyReportBundle(), a
 * single batched Google API call, instead of seven separate round trips.
 */
export async function GET(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // yyyy-MM
  const vehicleFilter = searchParams.get("vehicleId") || null;
  const studentFilter = searchParams.get("studentId") || null;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "?month=yyyy-MM is required." }, { status: 400 });
  }

  const { start, end } = monthRange(month);

  const {
    vehicles: allVehicles,
    students: allStudents,
    bookings: allBookings,
    dailyOps: allDailyOps,
    vehicleStatuses: allVehicleStatus,
    attendance: allAttendance,
    clubbingHistory: allClubbing,
  } = await getMonthlyReportBundle();

  const vehicles = allVehicles.filter(
    (v) => v.route === session.user.route && (!vehicleFilter || v.vehicleId === vehicleFilter)
  );
  const students = allStudents.filter(
    (s) => s.route === session.user.route && (!studentFilter || s.studentId === studentFilter)
  );

  // Walk every date in the month and re-derive that date's student views.
  const dateKeys: string[] = [];
  for (let d = start; d <= end; ) {
    dateKeys.push(d);
    const [y, m, day] = d.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, day + 1));
    d = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
      next.getUTCDate()
    ).padStart(2, "0")}`;
  }

  type DayResult = ReturnType<typeof buildStudentDailyViews>;
  const perDate: Record<string, DayResult> = {};

  for (const date of dateKeys) {
    const bookings = allBookings.filter((b) => b.travelDate === date && b.bookingStatus === "Booked");
    const dailyOps = allDailyOps.filter((o) => o.date === date);
    const statuses = allVehicleStatus.filter((v) => v.date === date);
    const attendance = allAttendance.filter((a) => a.date === date);
    const vehicleSentMap = buildVehicleSentMap(statuses);

    perDate[date] = buildStudentDailyViews({
      date,
      students,
      bookings,
      dailyOps,
      vehicleSentMap,
      attendance,
    });
  }

  // ---- Aggregate totals ----
  let totalBookings = 0;
  let totalPresent = 0;
  let totalAbsentStudent = 0;
  let totalAbsentVehicleNotSent = 0;
  let totalClubbed = 0;

  const vehicleAgg = new Map(
    vehicles.map((v) => [
      v.vehicleId,
      { operatingDays: 0, bookings: 0, present: 0, absent: 0, notSentDays: 0 },
    ])
  );
  const studentAgg = new Map(
    students.map((s) => [s.studentId, { booked: 0, present: 0, absent: 0, clubbed: 0 }])
  );
  const vehicleNotSentRows: { date: string; vehicleId: string; affected: number; reason: string }[] = [];

  for (const date of dateKeys) {
    const views = perDate[date];
    const statuses = allVehicleStatus.filter((v) => v.date === date);

    for (const v of views) {
      totalBookings++;
      const sAgg = studentAgg.get(v.studentId);
      if (sAgg) sAgg.booked++;

      if (v.attendance === "Present") {
        totalPresent++;
        if (sAgg) sAgg.present++;
      } else if (v.attendance === "Absent - Student") {
        totalAbsentStudent++;
        if (sAgg) sAgg.absent++;
      } else if (v.attendance === "Absent - Vehicle Not Sent") {
        totalAbsentVehicleNotSent++;
        if (sAgg) sAgg.absent++;
      }

      if (v.operationalVehicleId && v.operationalVehicleId !== v.defaultVehicleId) {
        totalClubbed++;
        if (sAgg) sAgg.clubbed++;
      }

      if (v.operationalVehicleId) {
        const vAgg = vehicleAgg.get(v.operationalVehicleId);
        if (vAgg) {
          vAgg.bookings++;
          if (v.attendance === "Present") vAgg.present++;
          if (v.attendance === "Absent - Student" || v.attendance === "Absent - Vehicle Not Sent")
            vAgg.absent++;
        }
      }
    }

    for (const status of statuses) {
      const vAgg = vehicleAgg.get(status.vehicleId);
      if (!vAgg) continue;
      if (status.status === "Sent") vAgg.operatingDays++;
      if (status.status === "Not Sent") {
        vAgg.notSentDays++;
        const affected = views.filter(
          (v) => v.operationalVehicleId === status.vehicleId && v.attendance === "Absent - Vehicle Not Sent"
        ).length;
        vehicleNotSentRows.push({ date, vehicleId: status.vehicleId, affected, reason: status.reason });
      }
    }
  }

  const clubbingRows = allClubbing.filter(
    (c) => c.date >= start && c.date <= end && (!vehicleFilter || c.toVehicleId === vehicleFilter || c.fromVehicleId === vehicleFilter) && (!studentFilter || c.studentId === studentFilter)
  );

  // ---- Render PDF ----
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const vehicleNumber = (id: string) => vehicles.find((v) => v.vehicleId === id)?.vehicleNumber ?? id;
  const studentName = (id: string) => students.find((s) => s.studentId === id)?.name ?? id;

  const pdfDone = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // --- Cover / Summary ---
  doc.fontSize(18).text("COLLEGE TRANSPORT ATTENDANCE REPORT", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Month: ${month}`, { align: "center" });
  doc.text(`Route: ${session.user.route}`, { align: "center" });
  doc.moveDown(1);

  doc.fontSize(11);
  const summaryLines = [
    `Total Vehicles: ${vehicles.length}`,
    `Total Students: ${students.length}`,
    `Total Bookings: ${totalBookings}`,
    `Total Present: ${totalPresent}`,
    `Total Absent: ${totalAbsentStudent + totalAbsentVehicleNotSent}`,
    `  - Absent (Student): ${totalAbsentStudent}`,
    `  - Absent (Vehicle Not Sent): ${totalAbsentVehicleNotSent}`,
    `Vehicle-Not-Sent Occurrences: ${vehicleNotSentRows.length}`,
    `Total Clubbed Assignments: ${totalClubbed}`,
  ];
  summaryLines.forEach((line) => doc.text(line));
  doc.moveDown(1.5);

  // --- Vehicle-wise summary ---
  doc.fontSize(14).text("Vehicle-wise Summary", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  drawTableHeader(doc, ["Vehicle", "Operating Days", "Bookings", "Present", "Absent", "Not Sent"]);
  for (const v of vehicles) {
    const agg = vehicleAgg.get(v.vehicleId)!;
    drawTableRow(doc, [
      v.vehicleNumber,
      String(agg.operatingDays),
      String(agg.bookings),
      String(agg.present),
      String(agg.absent),
      String(agg.notSentDays),
    ]);
  }
  doc.moveDown(1.5);

  // --- Student-wise summary ---
  doc.addPage();
  doc.fontSize(14).text("Student-wise Summary", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(9);
  drawTableHeader(doc, ["Student ID", "Name", "Default Vehicle", "Booked", "Present", "Absent", "Clubbed"]);
  for (const s of students) {
    const agg = studentAgg.get(s.studentId)!;
    drawTableRow(doc, [
      s.studentId,
      s.name,
      vehicleNumber(s.defaultVehicleId),
      String(agg.booked),
      String(agg.present),
      String(agg.absent),
      String(agg.clubbed),
    ]);
  }

  // --- Vehicle Not Sent report ---
  doc.addPage();
  doc.fontSize(14).text("Vehicle Not Sent Report", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(9);
  drawTableHeader(doc, ["Date", "Vehicle", "Affected Students", "Reason"]);
  for (const row of vehicleNotSentRows) {
    drawTableRow(doc, [
      formatDisplayDate(row.date),
      vehicleNumber(row.vehicleId),
      String(row.affected),
      row.reason || "-",
    ]);
  }

  // --- Clubbing history ---
  doc.addPage();
  doc.fontSize(14).text("Clubbing History", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(9);
  drawTableHeader(doc, ["Date", "Student", "From", "To", "Changed By"]);
  for (const c of clubbingRows) {
    drawTableRow(doc, [
      formatDisplayDate(c.date),
      studentName(c.studentId),
      vehicleNumber(c.fromVehicleId),
      vehicleNumber(c.toVehicleId),
      c.changedBy,
    ]);
  }

  doc.end();
  const buffer = await pdfDone;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="transport-report-${month}.pdf"`,
    },
  });
}

function drawTableHeader(doc: PDFKit.PDFDocument, cols: string[]) {
  const colWidth = (doc.page.width - 80) / cols.length;
  const y = doc.y;
  cols.forEach((c, i) => {
    doc.font("Helvetica-Bold").text(c, 40 + i * colWidth, y, { width: colWidth });
  });
  doc.moveDown(0.5);
  doc.font("Helvetica");
}

function drawTableRow(doc: PDFKit.PDFDocument, cols: string[]) {
  if (doc.y > doc.page.height - 60) {
    doc.addPage();
  }
  const colWidth = (doc.page.width - 80) / cols.length;
  const y = doc.y;
  cols.forEach((c, i) => {
    doc.text(c, 40 + i * colWidth, y, { width: colWidth });
  });
  doc.moveDown(0.3);
}
