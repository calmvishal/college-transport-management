/**
 * Seeds a small demo dataset so you can log in and click through the app
 * immediately after `npm run setup:sheets`. Safe to run once; running it
 * twice will duplicate rows, since it always appends.
 *
 * Usage: npm run seed:demo
 *
 * After seeding, log in with (see printed output at the end):
 *   Incharge:  incharge@example.com   / incharge123
 *   Driver:    driver1@example.com    / driver123
 *   Student:   student1@example.com   / student123
 */
import { google } from "googleapis";
import * as path from "path";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID as string;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL as string;
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  async function append(sheetName: string, rows: (string | number)[][]) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
  }

  const ROUTE = "Route 15";
  const today = new Date().toISOString().slice(0, 10);

  // --- Vehicles ---
  await append("Vehicles", [
    ["VEH-BUS1", "Bus 1", ROUTE, 40, "DRV-D1", "Active", today],
    ["VEH-BUS2", "Bus 2", ROUTE, 40, "DRV-D2", "Active", today],
    ["VEH-BUS3", "Bus 3", ROUTE, 40, "DRV-D3", "Active", today],
  ]);

  // --- Drivers ---
  await append("Drivers", [
    ["DRV-D1", "Ramesh Kumar", "9990000001", "DL-001", "VEH-BUS1", ROUTE, "Active"],
    ["DRV-D2", "Suresh Yadav", "9990000002", "DL-002", "VEH-BUS2", ROUTE, "Active"],
    ["DRV-D3", "Mahesh Singh", "9990000003", "DL-003", "VEH-BUS3", ROUTE, "Active"],
  ]);

  // --- Students ---
  await append("Students", [
    ["STU-RAHUL", "Rahul Sharma", "B.Tech CSE 2nd Yr", ROUTE, "VEH-BUS1", "9998887771", "Active"],
    ["STU-AMAN", "Aman Verma", "B.Tech ECE 3rd Yr", ROUTE, "VEH-BUS1", "9998887772", "Active"],
    ["STU-NEHA", "Neha Gupta", "BBA 1st Yr", ROUTE, "VEH-BUS3", "9998887773", "Active"],
  ]);

  // --- Users (login accounts) ---
  const inchargePass = await bcrypt.hash("incharge123", 10);
  const driverPass = await bcrypt.hash("driver123", 10);
  const studentPass = await bcrypt.hash("student123", 10);

  await append("Users", [
    ["USR-INCHARGE1", "Priya Nair", "incharge", "incharge@example.com", inchargePass, ROUTE, "", "", "Active"],
    ["USR-DRIVER1", "Ramesh Kumar", "driver", "driver1@example.com", driverPass, ROUTE, "VEH-BUS1", "", "Active"],
    ["USR-STUDENT1", "Rahul Sharma", "student", "student1@example.com", studentPass, ROUTE, "", "STU-RAHUL", "Active"],
  ]);

  console.log("Demo data seeded successfully.\n");
  console.log("Login credentials:");
  console.log("  Route Incharge -> incharge@example.com / incharge123");
  console.log("  Driver (Bus 1) -> driver1@example.com   / driver123");
  console.log("  Student (Rahul, default Bus 1) -> student1@example.com / student123");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
