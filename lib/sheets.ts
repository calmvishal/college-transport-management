import "server-only";
import { google, sheets_v4 } from "googleapis";

/**
 * SERVER-ONLY Google Sheets client.
 *
 * This file must never be imported from a "use client" component. The
 * `server-only` import above will throw a build error if that happens,
 * which is exactly what we want: service-account credentials must never
 * reach the browser bundle.
 */

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID as string;

let cachedClient: sheets_v4.Sheets | null = null;

function getPrivateKey(): string {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
  // .env files store literal "\n" — convert back to real newlines.
  return raw.replace(/\\n/g, "\n");
}

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    !SPREADSHEET_ID
  ) {
    throw new Error(
      "Missing Google Sheets environment variables. Check GOOGLE_SHEETS_SPREADSHEET_ID, " +
        "GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/** Sheet tab names — single source of truth so a typo doesn't silently
 * create a mismatched range. Must match scripts/setupSheets.ts exactly. */
export const SHEET = {
  Users: "Users",
  Students: "Students",
  Vehicles: "Vehicles",
  Drivers: "Drivers",
  Bookings: "Bookings",
  DailyOperations: "DailyOperations",
  VehicleDailyStatus: "VehicleDailyStatus",
  Attendance: "Attendance",
  ClubbingHistory: "ClubbingHistory",
  AuditLog: "AuditLog",
  NonWorkingDays: "NonWorkingDays",
} as const;

export type SheetName = (typeof SHEET)[keyof typeof SHEET];

/**
 * ---------------------------------------------------------------------
 * IN-MEMORY READ CACHE
 * ---------------------------------------------------------------------
 * Every dashboard load triggers several full-sheet reads (Students,
 * Vehicles, Bookings, DailyOperations, VehicleDailyStatus, Attendance).
 * Google Sheets is not a real database — each read is a network round
 * trip that gets slower as sheets grow. This cache holds each sheet's
 * rows in memory for a short TTL so repeated reads within that window
 * (multiple widgets on one dashboard, quick tab-switching, etc.) don't
 * re-fetch from Google every single time.
 *
 * Any write (append/update) to a sheet immediately invalidates that
 * sheet's cache entry, so nobody ever sees stale data after an action
 * they just performed. The tradeoff only applies to concurrent *other*
 * readers within the TTL window — an acceptable staleness window for a
 * planning tool like this, not a payments system.
 *
 * NOTE: on serverless platforms (Vercel), each function instance has its
 * own memory, so this cache is per-instance, not shared globally. It
 * still meaningfully cuts down repeated reads within a single request's
 * lifetime and across quick successive requests hitting a warm instance.
 */
const CACHE_TTL_MS = 15_000;
const sheetCache = new Map<string, { data: Record<string, string>[]; expiresAt: number }>();

function getCached(sheetName: string): Record<string, string>[] | null {
  const entry = sheetCache.get(sheetName);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sheetCache.delete(sheetName);
    return null;
  }
  return entry.data;
}

function setCached(sheetName: string, data: Record<string, string>[]): void {
  sheetCache.set(sheetName, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCache(sheetName: string): void {
  sheetCache.delete(sheetName);
}

function parseRows(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== ""))
    .map((row) => {
      const obj: Record<string, string> = {};
      headerRow.forEach((header, i) => {
        obj[header] = row[i] !== undefined ? String(row[i]) : "";
      });
      return obj;
    });
}

/** Reads all rows of a sheet (row 1 = headers) and returns them as an
 * array of objects keyed by header text. Served from the in-memory cache
 * when fresh; falls through to the Sheets API and repopulates it otherwise. */
export async function readSheet(sheetName: SheetName): Promise<Record<string, string>[]> {
  const cached = getCached(sheetName);
  if (cached) return cached;

  const client = getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:ZZ`,
  });
  const parsed = parseRows(res.data.values || []);
  setCached(sheetName, parsed);
  return parsed;
}

/**
 * Reads MULTIPLE sheets in a single Google API call instead of one call
 * per sheet. This is the main latency win for pages like the daily
 * dashboard and monthly report, which previously fired off 5-6 separate
 * HTTP requests to Google (one per sheet) even though they ran in
 * parallel via Promise.all — each one still paid its own network/auth
 * overhead. batchGet collapses all of them into one round trip.
 *
 * Sheets already warm in the cache are served from memory and excluded
 * from the batch request; only the missing ones are actually fetched.
 */
export async function batchReadSheets<T extends SheetName>(
  sheetNames: T[]
): Promise<Record<T, Record<string, string>[]>> {
  const result = {} as Record<T, Record<string, string>[]>;
  const toFetch: T[] = [];

  for (const name of sheetNames) {
    const cached = getCached(name);
    if (cached) {
      result[name] = cached;
    } else {
      toFetch.push(name);
    }
  }

  if (toFetch.length > 0) {
    const client = getClient();
    const res = await client.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: toFetch.map((name) => `${name}!A1:ZZ`),
    });

    (res.data.valueRanges || []).forEach((range, i) => {
      const name = toFetch[i];
      const parsed = parseRows(range.values || []);
      setCached(name, parsed);
      result[name] = parsed;
    });
  }

  return result;
}


/** Appends a single row to the end of a sheet. `values` must be in the
 * exact column order the sheet was created with. */
export async function appendRow(sheetName: SheetName, values: (string | number)[]): Promise<void> {
  const client = getClient();
  await client.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
  invalidateCache(sheetName);
}

/** Appends multiple rows in a single API call (avoids rate-limit issues
 * during bulk operations like clubbing many students at once). */
export async function appendRows(sheetName: SheetName, rows: (string | number)[][]): Promise<void> {
  if (rows.length === 0) return;
  const client = getClient();
  await client.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
  invalidateCache(sheetName);
}

/** Finds the 1-indexed spreadsheet row number of the first row whose
 * `matchColumn` header equals `matchValue`. Returns null if not found.
 * Used to locate a specific record before an in-place update. */
export async function findRowNumber(
  sheetName: SheetName,
  matchColumn: string,
  matchValue: string
): Promise<{ rowNumber: number; headers: string[]; row: string[] } | null> {
  const client = getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:ZZ`,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return null;
  const headers = rows[0];
  const colIndex = headers.indexOf(matchColumn);
  if (colIndex === -1) return null;

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][colIndex] || "") === matchValue) {
      return { rowNumber: i + 1, headers, row: rows[i] };
    }
  }
  return null;
}

/** Updates specific columns of an already-located row in place. Pass a
 * partial object of { headerName: newValue }. Untouched columns are left
 * as-is. This is how we do "edit student", "mark vehicle status", etc.
 * without ever deleting/re-appending (which would break row-based history
 * links elsewhere). */
export async function updateRowByKey(
  sheetName: SheetName,
  matchColumn: string,
  matchValue: string,
  patch: Record<string, string | number>
): Promise<boolean> {
  const found = await findRowNumber(sheetName, matchColumn, matchValue);
  if (!found) return false;
  const { rowNumber, headers, row } = found;

  const newRow = [...row];
  while (newRow.length < headers.length) newRow.push("");

  for (const [key, value] of Object.entries(patch)) {
    const idx = headers.indexOf(key);
    if (idx !== -1) newRow[idx] = String(value);
  }

  const client = getClient();
  await client.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowNumber}:${columnLetter(headers.length)}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [newRow] },
  });
  invalidateCache(sheetName);
  return true;
}

/** Updates a row matched by TWO columns (a composite key), e.g. (Date,
 * Student ID) in DailyOperations where neither column alone is unique.
 * Returns false if no matching row was found. */
export async function updateRowByCompositeKey(
  sheetName: SheetName,
  matchColumnA: string,
  matchValueA: string,
  matchColumnB: string,
  matchValueB: string,
  patch: Record<string, string | number>
): Promise<boolean> {
  const client = getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:ZZ`,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return false;
  const headers = rows[0];
  const colA = headers.indexOf(matchColumnA);
  const colB = headers.indexOf(matchColumnB);
  if (colA === -1 || colB === -1) return false;

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][colA] || "") === matchValueA && (rows[i][colB] || "") === matchValueB) {
      const newRow = [...rows[i]];
      while (newRow.length < headers.length) newRow.push("");
      for (const [key, value] of Object.entries(patch)) {
        const idx = headers.indexOf(key);
        if (idx !== -1) newRow[idx] = String(value);
      }
      await client.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A${i + 1}:${columnLetter(headers.length)}${i + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [newRow] },
      });
      invalidateCache(sheetName);
      return true;
    }
  }
  return false;
}

/** Finds a row matched by a composite key and returns its data, without
 * updating anything. Used for existence checks (e.g. "does a
 * DailyOperations row already exist for this student/date"). */
export async function findRowByCompositeKey(
  sheetName: SheetName,
  matchColumnA: string,
  matchValueA: string,
  matchColumnB: string,
  matchValueB: string
): Promise<Record<string, string> | null> {
  const rows = await readSheet(sheetName);
  return (
    rows.find((r) => r[matchColumnA] === matchValueA && r[matchColumnB] === matchValueB) || null
  );
}

function columnLetter(colCount: number): string {
  let letter = "";
  let n = colCount;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/** Deletes the row matched by a single column value (e.g. un-marking a
 * non-working day). Unlike updates, deleting requires the sheet's numeric
 * sheetId (not just its title), so this fetches spreadsheet metadata first.
 * Returns false if no matching row was found. */
export async function deleteRowByKey(
  sheetName: SheetName,
  matchColumn: string,
  matchValue: string
): Promise<boolean> {
  const client = getClient();

  const meta = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetMeta = (meta.data.sheets || []).find((s) => s.properties?.title === sheetName);
  const sheetId = sheetMeta?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return false;

  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:ZZ`,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return false;
  const headers = rows[0];
  const colIndex = headers.indexOf(matchColumn);
  if (colIndex === -1) return false;

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][colIndex] || "") === matchValue) {
      await client.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 },
              },
            },
          ],
        },
      });
      invalidateCache(sheetName);
      return true;
    }
  }
  return false;
}
