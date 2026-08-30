/**
 * Run once (or safely re-run) to provision every sheet tab this app needs,
 * with the exact header row the rest of the app expects.
 *
 * Usage:
 *   1. Fill in .env.local with GOOGLE_SHEETS_SPREADSHEET_ID,
 *      GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
 *   2. npm run setup:sheets
 *
 * This script is idempotent: it will create any missing tab and will not
 * touch a tab that already exists (so it's safe to re-run after adding a
 * new sheet definition below without wiping existing data).
 */
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SHEETS: Record<string, string[]> = {
  Users: ["User ID", "Name", "Role", "Auth ID", "Password Hash", "Route", "Vehicle ID", "Student ID", "Status"],
  Students: ["Student ID", "Name", "Class/Course", "Route", "Default Vehicle", "Contact", "Status"],
  Vehicles: ["Vehicle ID", "Vehicle Number", "Route", "Capacity", "Driver ID", "Status", "Date Added"],
  Drivers: ["Driver ID", "Name", "Phone", "License Info", "Vehicle ID", "Route", "Status"],
  Bookings: ["Booking ID", "Travel Date", "Student ID", "Default Vehicle", "Booking Status", "Timestamp"],
  DailyOperations: [
    "Date",
    "Student ID",
    "Default Vehicle",
    "Operational Vehicle",
    "Clubbed",
    "Changed By",
    "Changed At",
    "Reason",
  ],
  VehicleDailyStatus: ["Date", "Vehicle", "Status", "Reason", "Updated By", "Updated At"],
  Attendance: [
    "Attendance ID",
    "Date",
    "Student ID",
    "Student Name",
    "Default Vehicle",
    "Operational Vehicle",
    "Vehicle",
    "Driver",
    "Status",
    "Absence Reason",
    "Timestamp",
  ],
  ClubbingHistory: [
    "Date",
    "Student ID",
    "Student Name",
    "From Vehicle",
    "To Vehicle",
    "Changed By",
    "Timestamp",
    "Reason",
  ],
  AuditLog: ["Timestamp", "Actor", "Action", "Entity", "Entity ID", "Old Value", "New Value"],
};

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!spreadsheetId || !email || !key) {
    console.error(
      "Missing env vars. Ensure .env.local has GOOGLE_SHEETS_SPREADSHEET_ID, " +
        "GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
    process.exit(1);
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const existing = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(
    (existing.data.sheets || []).map((s) => s.properties?.title).filter(Boolean)
  );

  const requests: any[] = [];
  for (const title of Object.keys(SHEETS)) {
    if (!existingTitles.has(title)) {
      console.log(`Creating sheet tab: ${title}`);
      requests.push({ addSheet: { properties: { title } } });
    } else {
      console.log(`Sheet tab already exists, skipping creation: ${title}`);
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  // Write header rows (safe to overwrite row 1 even if it already matches).
  for (const [title, headers] of Object.entries(SHEETS)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    console.log(`Header row written for: ${title}`);
  }

  console.log("\nAll sheet tabs are provisioned. Next: run `npm run seed:demo` for sample data,");
  console.log("or add your first Route Incharge user manually to the Users tab.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
