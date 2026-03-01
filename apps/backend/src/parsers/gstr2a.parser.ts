/**
 * @file apps/backend/src/parsers/gstr2a.parser.ts
 * @description Excel parser for GSTR-2A Voucher Register files.
 * Extracts file header metadata and invoice rows from the exact column format
 * used in real GSTR-2A exports.
 *
 * Expected Excel format:
 *   - Rows 1–6: File header (Company, Report, Period, GST Registration, etc.)
 *   - Data table: Starts at the row containing "Date" in the first column
 *   - Columns: Date | Particulars | Party GSTIN/UIN | Vch Type | Vch No. |
 *              Taxable Amount | IGST | CGST | SGST/UTGST | Cess | Tax Amount | Invoice Amount
 *
 * Phase 2: Parser implemented based on real data samples.
 * Phase 4: Called during file upload to persist records into MongoDB.
 */

import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata extracted from the GSTR-2A file header rows */
export interface Gstr2AMetadata {
  companyName: string;
  periodStart: string;
  periodEnd: string;
  gstin: string;
}

/** A single parsed invoice row from the GSTR-2A data table */
export interface Gstr2AInvoice {
  date: string;
  particulars: string;
  partyGstin: string;
  vchType: string;
  vchNo: number;
  taxableAmount: number;
  igst: number;
  cgst: number;
  sgstUtgst: number;
  cess: number;
  taxAmount: number;
  invoiceAmount: number;
}

/** Full result returned by the GSTR-2A parser */
export interface Gstr2AParseResult {
  metadata: Gstr2AMetadata;
  invoices: Gstr2AInvoice[];
}

// ---------------------------------------------------------------------------
// Required column names (exact match from real Excel files)
// ---------------------------------------------------------------------------

const REQUIRED_COLUMNS = [
  'Date',
  'Particulars',
  'Party GSTIN/UIN',
  'Vch Type',
  'Vch No.',
  'Taxable Amount',
  'IGST',
  'CGST',
  'SGST/UTGST',
  'Cess',
  'Tax Amount',
  'Invoice Amount',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely converts a cell value to a number.
 * Returns 0 for null, undefined, empty string, or non-numeric values.
 *
 * @param value - Raw cell value from xlsx
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Safely converts a cell value to a string.
 * Returns empty string for null or undefined.
 *
 * @param value - Raw cell value from xlsx
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Extracts header metadata from the top rows of the GSTR-2A sheet.
 * Expected layout:
 *   Row 1: Company:   NEXUS PROFILES
 *   Row 2: Report:    GSTR-2A Reconciliation - Voucher Register
 *   Row 3: Period:    1-Mar-23 to 31-Mar-23
 *   Row 4: GST Registration: 36BOTPJ1566A1ZX
 *
 * @param rows - All rows from the worksheet as arrays
 */
function extractMetadata(rows: unknown[][]): Gstr2AMetadata {
  let companyName = '';
  let periodStart = '';
  let periodEnd = '';
  let gstin = '';

  for (const row of rows) {
    const label = toString(row[0]).toLowerCase();
    const value = toString(row[1]);

    if (label.startsWith('company')) {
      companyName = value;
    } else if (label.startsWith('period')) {
      // Format: "1-Mar-23 to 31-Mar-23"
      const parts = value.split(' to ');
      if (parts.length === 2) {
        periodStart = parts[0].trim();
        periodEnd = parts[1].trim();
      } else {
        periodStart = value;
        periodEnd = value;
      }
    } else if (label.startsWith('gst registration')) {
      gstin = value;
    }
  }

  return { companyName, periodStart, periodEnd, gstin };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parses a GSTR-2A Excel file (Voucher Register format) and returns
 * the file metadata and all invoice rows.
 *
 * @param fileBuffer - Binary content of the uploaded Excel file
 * @param fileName   - Original file name (used for logging only)
 * @throws Error if required columns are missing or no data rows are found
 */
export function parseGstr2A(fileBuffer: Buffer, fileName: string): Gstr2AParseResult {
  console.log(`[GSTR-2A Parser] Parsing file: ${fileName}`);

  // Parse the workbook
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });

  // Use the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('[GSTR-2A Parser] Excel file contains no sheets');
  }

  console.log(`[GSTR-2A Parser] Reading sheet: "${sheetName}"`);
  const worksheet = workbook.Sheets[sheetName];

  // Convert to array of arrays (raw values)
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  if (allRows.length === 0) {
    throw new Error('[GSTR-2A Parser] Sheet is empty');
  }

  // Extract metadata from top header rows (rows before the data table)
  const metadata = extractMetadata(allRows);
  console.log(
    `[GSTR-2A Parser] Metadata — Company: "${metadata.companyName}", Period: ${metadata.periodStart} to ${metadata.periodEnd}, GSTIN: ${metadata.gstin}`,
  );

  // Find the header row (the row where first cell = "Date")
  let headerRowIndex = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (toString(allRows[i][0]).toLowerCase() === 'date') {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      '[GSTR-2A Parser] Could not find data table header row (expected "Date" in first column)',
    );
  }

  const headerRow = allRows[headerRowIndex].map((cell) => toString(cell));
  console.log(`[GSTR-2A Parser] Header row found at row ${headerRowIndex + 1}: ${headerRow.join(' | ')}`);

  // Verify all required columns are present
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !headerRow.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(
      `[GSTR-2A Parser] Missing required columns: ${missingColumns.join(', ')}`,
    );
  }

  // Build column index map
  const columnIndex: Record<string, number> = {};
  for (const col of REQUIRED_COLUMNS) {
    columnIndex[col] = headerRow.indexOf(col);
  }

  // Parse data rows (everything after the header row)
  const invoices: Gstr2AInvoice[] = [];

  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const row = allRows[i];

    // Skip completely empty rows
    if (!row || row.every((cell) => cell === null || cell === '')) continue;

    const dateValue = toString(row[columnIndex['Date']]);
    const particularsValue = toString(row[columnIndex['Particulars']]);

    // Skip the totals row (usually has "Total" in Particulars column)
    if (particularsValue.toLowerCase().includes('total')) {
      console.log(`[GSTR-2A Parser] Skipping totals row at row ${i + 1}`);
      continue;
    }

    // Skip rows without a date (sub-headers or empty separator rows)
    if (!dateValue) continue;

    const invoice: Gstr2AInvoice = {
      date: dateValue,
      particulars: particularsValue,
      partyGstin: toString(row[columnIndex['Party GSTIN/UIN']]),
      vchType: toString(row[columnIndex['Vch Type']]),
      vchNo: toNumber(row[columnIndex['Vch No.']]),
      taxableAmount: toNumber(row[columnIndex['Taxable Amount']]),
      igst: toNumber(row[columnIndex['IGST']]),
      cgst: toNumber(row[columnIndex['CGST']]),
      sgstUtgst: toNumber(row[columnIndex['SGST/UTGST']]),
      cess: toNumber(row[columnIndex['Cess']]),
      taxAmount: toNumber(row[columnIndex['Tax Amount']]),
      invoiceAmount: toNumber(row[columnIndex['Invoice Amount']]),
    };

    invoices.push(invoice);
  }

  console.log(`[GSTR-2A Parser] Parsed ${invoices.length} invoice rows from "${fileName}"`);

  if (invoices.length === 0) {
    throw new Error('[GSTR-2A Parser] No invoice rows found in file');
  }

  return { metadata, invoices };
}
