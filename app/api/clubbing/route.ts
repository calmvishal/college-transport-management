import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/apiAuth";
import {
  findDailyOperation,
  getAllStudents,
  getAllVehicles,
  getDailyOperationsForDate,
  recordClubbingHistory,
  setOperationalVehicle,
} from "@/lib/repository";
import { validateClubbingMove } from "@/lib/transportLogic";

const clubbingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  studentIds: z.array(z.string()).min(1),
  toVehicleId: z.string().min(1),
  reason: z.string().optional().default(""),
  allowCapacityOverride: z.boolean().optional().default(false),
});

/** POST /api/clubbing — Route Incharge moves one or more booked students to
 * a different vehicle for a specific date. Default vehicle is untouched;
 * only the DailyOperations row's operational vehicle changes. */
export async function POST(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = clubbingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { date, studentIds, toVehicleId, reason, allowCapacityOverride } =
    parsed.data;

  const [vehicles, students, existingOps] = await Promise.all([
    getAllVehicles(),
    getAllStudents(),
    getDailyOperationsForDate(date),
  ]);

  const destinationVehicle = vehicles.find((v) => v.vehicleId === toVehicleId);
  if (!destinationVehicle) {
    return NextResponse.json(
      { error: "Destination vehicle not found." },
      { status: 404 },
    );
  }

  const currentOperationalCount = existingOps.filter(
    (op) =>
      op.operationalVehicleId === destinationVehicle.vehicleId ||
      op.operationalVehicleId === destinationVehicle.vehicleNumber,
  ).length;
  const validationErrors = validateClubbingMove({
    studentIds,
    destinationVehicle,
    currentOperationalCountOnDestination: currentOperationalCount,
    allowCapacityOverride,
  });
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: validationErrors.join(" ") },
      { status: 400 },
    );
  }

  const results: { studentId: string; success: boolean; message?: string }[] =
    [];

  for (const studentId of studentIds) {
    const student = students.find((s) => s.studentId === studentId);
    if (!student) {
      results.push({
        studentId,
        success: false,
        message: "Student not found.",
      });
      continue;
    }

    const dailyOp = await findDailyOperation(date, studentId);
    if (!dailyOp) {
      results.push({
        studentId,
        success: false,
        message: "Student has no booking for this date, so cannot be clubbed.",
      });
      continue;
    }

    if (
      dailyOp.operationalVehicleId === toVehicleId ||
      dailyOp.operationalVehicleId === destinationVehicle.vehicleNumber
    ) {
      results.push({
        studentId,
        success: false,
        message: "Student is already operationally assigned to that vehicle.",
      });
      continue;
    }

    const fromVehicleId = dailyOp.operationalVehicleId;

    const updated = await setOperationalVehicle(
      date,
      studentId,
      toVehicleId,
      session.user.name || session.user.id,
      reason,
    );

    if (!updated) {
      results.push({
        studentId,
        success: false,
        message: "Failed to update operational vehicle.",
      });
      continue;
    }

    await recordClubbingHistory({
      date,
      studentId,
      studentName: student.name,
      fromVehicleId,
      toVehicleId,
      changedBy: session.user.name || session.user.id,
      timestamp: new Date().toISOString(),
      reason,
    });

    results.push({ studentId, success: true });
  }

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    success: successCount > 0,
    movedCount: successCount,
    totalRequested: studentIds.length,
    results,
  });
}
