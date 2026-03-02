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

import ExcelJS from 'exceljs';

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
 * Extracts a plain primitive value from an ExcelJS cell value.
 * ExcelJS cells can contain rich text objects, formula results, hyperlinks, etc.
 * This function always returns a string, number, boolean, Date, or null.
 *
 * @param cellValue - Raw cell value from ExcelJS
 */
function extractCellValue(
  cellValue: ExcelJS.CellValue,
): string | number | boolean | Date | null {
  if (cellValue === null || cellValue === undefined) return null;
  if (typeof cellValue === 'string') return cellValue;
  if (typeof cellValue === 'number') return cellValue;
  if (typeof cellValue === 'boolean') return cellValue;
  if (cellValue instanceof Date) return cellValue;

  // Formula cell: return the cached result
  if (typeof cellValue === 'object' && 'result' in cellValue) {
    const result = (cellValue as ExcelJS.CellFormulaValue).result;
    return extractCellValue(result as ExcelJS.CellValue);
  }

  // Rich text cell: concatenate all text runs
  if (typeof cellValue === 'object' && 'richText' in cellValue) {
    return (cellValue as ExcelJS.CellRichTextValue).richText
      .map((run) => run.text)
      .join('');
  }

  // Hyperlink cell: return the display text
  if (typeof cellValue === 'object' && 'text' in cellValue) {
    const text = (cellValue as ExcelJS.CellHyperlinkValue).text;
    return typeof text === 'string' ? text : null;
  }

  return null;
}

/**
 * Safely converts an ExcelJS cell value to a number.
 * Returns 0 for null, undefined, empty string, or non-numeric values.
 *
 * @param cellValue - Raw cell value from ExcelJS
 */
function toNumber(cellValue: ExcelJS.CellValue): number {
  const value = extractCellValue(cellValue);
  if (value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Safely converts an ExcelJS cell value to a string.
 * Returns empty string for null or undefined.
 *
 * @param cellValue - Raw cell value from ExcelJS
 */
function toString(cellValue: ExcelJS.CellValue): string {
  const value = extractCellValue(cellValue);
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('en-GB');
  return String(value).trim();
}

/**
 * Reads all rows from an ExcelJS worksheet as a 2D array of raw cell values.
 * Skips completely empty rows.
 *
 * @param worksheet - The ExcelJS worksheet to read
 */
function readAllRows(worksheet: ExcelJS.Worksheet): ExcelJS.CellValue[][] {
  const rows: ExcelJS.CellValue[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    // row.values is 1-indexed (index 0 is null); slice from index 1
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    rows.push(values);
  });
  return rows;
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
function extractMetadata(rows: ExcelJS.CellValue[][]): Gstr2AMetadata {
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
export async function parseGstr2A(
  fileBuffer: Buffer,
  fileName: string,
): Promise<Gstr2AParseResult> {
  console.log(`[GSTR-2A Parser] Parsing file: ${fileName}`);

  const workbook = new ExcelJS.Workbook();
  // Convert Node.js Buffer to ArrayBuffer to satisfy ExcelJS type definitions
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);

  // Use the first sheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('[GSTR-2A Parser] Excel file contains no sheets');
  }

  console.log(`[GSTR-2A Parser] Reading sheet: "${worksheet.name}"`);

  const allRows = readAllRows(worksheet);

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
  console.log(
    `[GSTR-2A Parser] Header row found at row ${headerRowIndex + 1}: ${headerRow.join(' | ')}`,
  );

  // Verify all required columns are present
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !headerRow.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(`[GSTR-2A Parser] Missing required columns: ${missingColumns.join(', ')}`);
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
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === '')) continue;

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
