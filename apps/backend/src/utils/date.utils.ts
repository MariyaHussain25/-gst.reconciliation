/**
 * @file apps/backend/src/utils/date.utils.ts
 * @description Shared date parsing utilities for Indian GST document formats.
 * Handles all real-world date formats encountered in GSTR-2A (Tally exports)
 * and GSTR-2B (government portal downloads).
 *
 * Supported formats:
 *   1. `15-Mar-23`   (D-Mon-YY)       — GSTR-2A Tally exports
 *   2. `25/03/2023`  (DD/MM/YYYY)     — GSTR-2B government portal
 *   3. `2023-03-25`  (YYYY-MM-DD)     — ISO standard / RawInvoiceData schema
 *   4. `25-03-2023`  (DD-MM-YYYY)     — Some GSTR-2B variants
 *   5. `15-03-23`    (DD-MM-YY)       — Numeric short year with dashes
 *   6. `15.03.23`    (DD.MM.YY)       — Numeric short year with dots
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_ABBR_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Expands a 2-digit year to a 4-digit year using the convention:
 *   00–49 → 2000–2049
 *   50–99 → 1950–1999
 *
 * @param yy - 2-digit year as a number
 */
function expandYear(yy: number): number {
  return yy <= 49 ? 2000 + yy : 1900 + yy;
}

/**
 * Builds a UTC midnight Date from year, month (1-based), and day.
 * Throws if the resulting date is invalid.
 */
function buildDate(year: number, month: number, day: number): Date {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date components: year=${year}, month=${month}, day=${day}`);
  }
  return d;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Parses any Indian GST date string into a JavaScript Date object (UTC midnight).
 *
 * Supported formats:
 *   1. `15-Mar-23`   (D-Mon-YY)       — GSTR-2A Tally exports
 *   2. `25/03/2023`  (DD/MM/YYYY)     — GSTR-2B government portal
 *   3. `2023-03-25`  (YYYY-MM-DD)     — ISO standard
 *   4. `25-03-2023`  (DD-MM-YYYY)     — GSTR-2B variants
 *   5. `15-03-23`    (DD-MM-YY)       — Numeric short year, dashes
 *   6. `15.03.23`    (DD.MM.YY)       — Numeric short year, dots
 *
 * @param dateStr - Raw date string from a GST document
 * @returns Parsed Date object set to UTC midnight
 * @throws Error with a descriptive message for unrecognised formats
 */
export function parseGstDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error(`parseGstDate: received empty or non-string value: ${String(dateStr)}`);
  }

  const s = dateStr.trim();

  // Format 3: YYYY-MM-DD (ISO standard) — must be tested before Format 4
  // Matches: 2023-03-25
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return buildDate(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10), parseInt(isoMatch[3], 10));
  }

  // Format 2: DD/MM/YYYY — GSTR-2B government portal
  // Matches: 25/03/2023
  const slashFullMatch = s.match(/^(\d{1,2})\/(\d{2})\/(\d{4})$/);
  if (slashFullMatch) {
    return buildDate(parseInt(slashFullMatch[3], 10), parseInt(slashFullMatch[2], 10), parseInt(slashFullMatch[1], 10));
  }

  // Format 4: DD-MM-YYYY — some GSTR-2B variants
  // Matches: 25-03-2023 (4-digit year after last dash)
  const dashFullMatch = s.match(/^(\d{1,2})-(\d{2})-(\d{4})$/);
  if (dashFullMatch) {
    return buildDate(parseInt(dashFullMatch[3], 10), parseInt(dashFullMatch[2], 10), parseInt(dashFullMatch[1], 10));
  }

  // Format 1: D-Mon-YY — GSTR-2A Tally exports
  // Matches: 15-Mar-23, 1-Apr-23
  const tallyMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (tallyMatch) {
    const day = parseInt(tallyMatch[1], 10);
    const monthKey = tallyMatch[2].toLowerCase();
    const month = MONTH_ABBR_MAP[monthKey];
    if (!month) {
      throw new Error(`parseGstDate: unrecognised month abbreviation "${tallyMatch[2]}" in "${s}"`);
    }
    const year = expandYear(parseInt(tallyMatch[3], 10));
    return buildDate(year, month, day);
  }

  // Format 5: DD-MM-YY — numeric short year with dashes
  // Matches: 15-03-23
  const dashShortMatch = s.match(/^(\d{1,2})-(\d{2})-(\d{2})$/);
  if (dashShortMatch) {
    const year = expandYear(parseInt(dashShortMatch[3], 10));
    return buildDate(year, parseInt(dashShortMatch[2], 10), parseInt(dashShortMatch[1], 10));
  }

  // Format 6: DD.MM.YY — numeric short year with dots
  // Matches: 15.03.23
  const dotShortMatch = s.match(/^(\d{1,2})\.(\d{2})\.(\d{2})$/);
  if (dotShortMatch) {
    const year = expandYear(parseInt(dotShortMatch[3], 10));
    return buildDate(year, parseInt(dotShortMatch[2], 10), parseInt(dotShortMatch[1], 10));
  }

  throw new Error(
    `parseGstDate: unrecognised date format "${s}". ` +
      'Expected one of: D-Mon-YY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD-MM-YY, DD.MM.YY',
  );
}

/**
 * Parses any Indian GST date string and returns it as an ISO `YYYY-MM-DD` string.
 *
 * @param dateStr - Raw date string from a GST document
 * @returns ISO date string in `YYYY-MM-DD` format
 * @throws Error for unrecognised formats
 */
export function formatDateToISO(dateStr: string): string {
  const d = parseGstDate(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Derives the tax period (`YYYY-MM`) from any Indian GST date string.
 *
 * Examples:
 *   `"15-Mar-23"` → `"2023-03"`
 *   `"25/03/2023"` → `"2023-03"`
 *   `"2023-03-25"` → `"2023-03"`
 *   `"15-03-23"`  → `"2023-03"`
 *   `"15.03.23"`  → `"2023-03"`
 *
 * @param dateStr - Raw date string from a GST document
 * @returns Period string in `YYYY-MM` format
 * @throws Error for unrecognised formats
 */
export function derivePeriodFromDateStr(dateStr: string): string {
  const d = parseGstDate(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}
