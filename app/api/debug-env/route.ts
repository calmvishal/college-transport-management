import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";

  return NextResponse.json({
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID
      ? "SET (length " + process.env.GOOGLE_SHEETS_SPREADSHEET_ID.length + ")"
      : "MISSING",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      ? "SET: " + process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      : "MISSING",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_length: key.length,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_starts_with: key.slice(0, 30),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ends_with: key.slice(-30),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_has_literal_backslash_n: key.includes("\\n"),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_has_real_newline: key.includes("\n"),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "MISSING",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET" : "MISSING",
  });
}