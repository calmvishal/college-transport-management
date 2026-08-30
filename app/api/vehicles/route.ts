import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { requireRole, requireSession } from "@/lib/apiAuth";
import { createVehicle, getAllVehicles, recordAudit, updateVehicle } from "@/lib/repository";

/** GET /api/vehicles — any authenticated role can list vehicles (students
 * and drivers need this for read-only display; only incharge can mutate). */
export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const vehicles = await getAllVehicles();
  const scoped =
    session.user.role === "incharge"
      ? vehicles.filter((v) => v.route === session.user.route)
      : vehicles;

  return NextResponse.json({ vehicles: scoped });
}

const createSchema = z.object({
  vehicleNumber: z.string().min(1),
  route: z.string().min(1),
  capacity: z.number().int().positive(),
  driverId: z.string().optional().default(""),
});

/** POST /api/vehicles — add a new vehicle. */
export async function POST(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const vehicleId = `VEH-${uuid().slice(0, 8).toUpperCase()}`;
  await createVehicle({
    vehicleId,
    status: "Active",
    dateAdded: new Date().toISOString().slice(0, 10),
    ...parsed.data,
  });
  await recordAudit(session.user.name || session.user.id, "CREATE", "Vehicle", vehicleId, "", JSON.stringify(parsed.data));

  return NextResponse.json({ success: true, vehicleId });
}

const updateSchema = z.object({
  vehicleId: z.string().min(1),
  vehicleNumber: z.string().optional(),
  route: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  driverId: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

/** PATCH /api/vehicles — edit capacity/route/driver assignment, or
 * activate/deactivate. Deactivating never deletes historical
 * Attendance/ClubbingHistory/VehicleDailyStatus rows referencing this
 * vehicle ID. */
export async function PATCH(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { vehicleId, ...patch } = parsed.data;

  const updated = await updateVehicle(vehicleId, patch);
  if (!updated) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  await recordAudit(session.user.name || session.user.id, "UPDATE", "Vehicle", vehicleId, "", JSON.stringify(patch));

  return NextResponse.json({ success: true });
}
