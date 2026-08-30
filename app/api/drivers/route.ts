import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { requireRole } from "@/lib/apiAuth";
import { createDriver, getAllDrivers, recordAudit, updateDriver } from "@/lib/repository";

export async function GET() {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const drivers = await getAllDrivers();
  return NextResponse.json({ drivers: drivers.filter((d) => d.route === session.user.route) });
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  licenseInfo: z.string().optional().default(""),
  vehicleId: z.string().optional().default(""),
  route: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const driverId = `DRV-${uuid().slice(0, 8).toUpperCase()}`;
  await createDriver({ driverId, status: "Active", ...parsed.data });
  await recordAudit(session.user.name || session.user.id, "CREATE", "Driver", driverId, "", JSON.stringify(parsed.data));

  return NextResponse.json({ success: true, driverId });
}

const updateSchema = z.object({
  driverId: z.string().min(1),
  name: z.string().optional(),
  phone: z.string().optional(),
  licenseInfo: z.string().optional(),
  vehicleId: z.string().optional(),
  route: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export async function PATCH(req: Request) {
  const session = await requireRole(["incharge"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { driverId, ...patch } = parsed.data;

  const updated = await updateDriver(driverId, patch);
  if (!updated) {
    return NextResponse.json({ error: "Driver not found." }, { status: 404 });
  }

  await recordAudit(session.user.name || session.user.id, "UPDATE", "Driver", driverId, "", JSON.stringify(patch));

  return NextResponse.json({ success: true });
}
