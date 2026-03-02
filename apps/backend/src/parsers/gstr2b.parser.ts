/**
 * @file apps/backend/src/parsers/gstr2b.parser.ts
 * @description Excel parser for GSTR-2B multi-sheet files.
 * Extracts file header metadata, B2B invoice rows, and ITC summary totals
 * from the exact column and sheet format used in real GSTR-2B downloads.
 *
 * Expected sheets:
 *   - "Read me"            — File header (Financial Year, Tax Period, GSTIN, etc.)
 *   - "B2B"               — B2B invoice rows
 *   - "ITC Available"      — ITC available summary (Part A and Part B)
 *   - "ITC not available"  — Blocked/ineligible ITC summary (Part A and Part B)
 *
 * B2B columns (exact names):
 *   GSTIN of supplier | Trade/Legal name | Invoice number | Invoice type |
 *   Invoice date | Invoice Value(₹) | Place of supply | Supply Attracts Reverse Charge |
 *   Rate(%) | Taxable value | Integrated Tax | Central Tax | State/UT tax | Cess |
 *   GSTR-1/IFF/GSTR-5 Period | GSTR-1/IFF/GSTR-5 Filing Date | ITC Availability |
 *   Reason | Applicable % of Tax Rate | Source | IRN | IRN date
 *
 * Phase 2: Parser implemented based on real data samples.
 * Phase 4: Called during file upload to persist records into MongoDB.
 */

import ExcelJS from 'exceljs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata extracted from the "Read me" sheet */
export interface Gstr2BMetadata {
  financialYear: string;
  taxPeriod: string;
  buyerGstin: string;
  legalName: string;
  tradeName: string;
  dateOfGeneration: string;
}

/** A single parsed B2B invoice row */
export interface Gstr2BInvoice {
  sheetName: string;
  supplierGstin: string;
  supplierTradeName: string;
  invoiceNumber: string;
  invoiceType: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  supplyAttractsReverseCharge: string;
  taxRate: number | null;
  taxableValue: number;
  integratedTax: number;
  centralTax: number;
  stateUtTax: number;
  cess: number;
  gstr1Period: string | null;
  gstr1FilingDate: string | null;
  itcAvailability: string;
  itcUnavailableReason: string | null;
  applicableTaxRatePercent: number | null;
  source: string;
  irn: string | null;
  irnDate: string | null;
}

/** ITC summary totals from ITC Available / ITC not available sheets */
export interface ItcSummary {
  partA: Record<string, number>;
  partB: Record<string, number>;
}

/** Full result returned by the GSTR-2B parser */
export interface Gstr2BParseResult {
  metadata: Gstr2BMetadata;
  b2bInvoices: Gstr2BInvoice[];
  itcAvailableSummary: ItcSummary;
  itcNotAvailableSummary: ItcSummary;
}

// ---------------------------------------------------------------------------
// Required B2B columns (exact names from real files)
// ---------------------------------------------------------------------------

const B2B_REQUIRED_COLUMNS = [
  'GSTIN of supplier',
  'Trade/Legal name',
  'Invoice number',
  'Invoice type',
  'Invoice date',
  'Invoice Value(₹)',
  'Place of supply',
  'Supply Attracts Reverse Charge',
  'Rate(%)',
  'Taxable value',
  'Integrated Tax',
  'Central Tax',
  'State/UT tax',
  'Cess',
  'GSTR-1/IFF/GSTR-5 Period',
  'GSTR-1/IFF/GSTR-5 Filing Date',
  'ITC Availability',
  'Reason',
  'Applicable % of Tax Rate',
  'Source',
  'IRN',
  'IRN date',
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
 * Safely converts an ExcelJS cell value to a number, returning null for empty values.
 * Used for optional numeric fields.
 *
 * @param cellValue - Raw cell value from ExcelJS
 */
function toNumberOrNull(cellValue: ExcelJS.CellValue): number | null {
  const value = extractCellValue(cellValue);
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (cleaned === '') return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
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
 * Converts an ExcelJS cell value to a nullable string.
 * Returns null for empty/missing values.
 *
 * @param cellValue - Raw cell value from ExcelJS
 */
function toStringOrNull(cellValue: ExcelJS.CellValue): string | null {
  const str = toString(cellValue);
  return str === '' ? null : str;
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
 * Extracts metadata from the "Read me" sheet.
 * Expected layout (each key-value pair in two adjacent columns):
 *   Financial Year:     2022-23
 *   Tax Period:         March
 *   GSTIN:              36BOTPJ1566A1ZX
 *   Legal Name:         JUMANA
 *   Trade Name:         NEXUS PROFILES
 *   Date of generation: 14/04/2023
 *
 * @param rows - All rows from the "Read me" sheet as arrays
 */
function extractReadMeMetadata(rows: ExcelJS.CellValue[][]): Gstr2BMetadata {
  let financialYear = '';
  let taxPeriod = '';
  let buyerGstin = '';
  let legalName = '';
  let tradeName = '';
  let dateOfGeneration = '';

  for (const row of rows) {
    const label = toString(row[0]).toLowerCase();
    const value = toString(row[1]);

    if (label.includes('financial year')) {
      financialYear = value;
    } else if (label.includes('tax period')) {
      taxPeriod = value;
    } else if (label.startsWith('gstin')) {
      buyerGstin = value;
    } else if (label.includes('legal name')) {
      legalName = value;
    } else if (label.includes('trade name')) {
      tradeName = value;
    } else if (label.includes('date of generation')) {
      dateOfGeneration = value;
    }
  }

  return { financialYear, taxPeriod, buyerGstin, legalName, tradeName, dateOfGeneration };
}

/**
 * Parses invoice rows from a B2B-type worksheet.
 * Finds the header row by looking for "GSTIN of supplier" in any cell,
 * then maps each subsequent row using the confirmed column names.
 *
 * @param worksheet  - The ExcelJS worksheet object
 * @param sheetLabel - Sheet name used for logging and stored in each record
 */
function parseB2BSheet(worksheet: ExcelJS.Worksheet, sheetLabel: string): Gstr2BInvoice[] {
  const allRows = readAllRows(worksheet);

  if (allRows.length === 0) {
    console.log(`[GSTR-2B Parser] Sheet "${sheetLabel}" is empty`);
    return [];
  }

  // Find the header row (contains "GSTIN of supplier")
  let headerRowIndex = -1;
  for (let i = 0; i < allRows.length; i++) {
    const rowStrings = allRows[i].map((cell) => toString(cell));
    if (rowStrings.some((cell) => cell.toLowerCase().includes('gstin of supplier'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.log(`[GSTR-2B Parser] No header row found in sheet "${sheetLabel}" — skipping`);
    return [];
  }

  const headerRow = allRows[headerRowIndex].map((cell) => toString(cell));

  // Verify all required columns are present
  const missingColumns = B2B_REQUIRED_COLUMNS.filter((col) => !headerRow.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(
      `[GSTR-2B Parser] Sheet "${sheetLabel}" is missing required columns: ${missingColumns.join(', ')}`,
    );
  }

  // Build column index map
  const columnIndex: Record<string, number> = {};
  for (const col of B2B_REQUIRED_COLUMNS) {
    columnIndex[col] = headerRow.indexOf(col);
  }

  const invoices: Gstr2BInvoice[] = [];

  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const row = allRows[i];

    // Skip empty rows
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === '')) continue;

    const supplierGstin = toString(row[columnIndex['GSTIN of supplier']]);

    // Skip rows that are section headers or sub-totals (no GSTIN)
    if (!supplierGstin) continue;

    const invoice: Gstr2BInvoice = {
      sheetName: sheetLabel,
      supplierGstin,
      supplierTradeName: toString(row[columnIndex['Trade/Legal name']]),
      invoiceNumber: toString(row[columnIndex['Invoice number']]),
      invoiceType: toString(row[columnIndex['Invoice type']]),
      invoiceDate: toString(row[columnIndex['Invoice date']]),
      invoiceValue: toNumber(row[columnIndex['Invoice Value(₹)']]),
      placeOfSupply: toString(row[columnIndex['Place of supply']]),
      supplyAttractsReverseCharge: toString(row[columnIndex['Supply Attracts Reverse Charge']]),
      taxRate: toNumberOrNull(row[columnIndex['Rate(%)']]),
      taxableValue: toNumber(row[columnIndex['Taxable value']]),
      integratedTax: toNumber(row[columnIndex['Integrated Tax']]),
      centralTax: toNumber(row[columnIndex['Central Tax']]),
      stateUtTax: toNumber(row[columnIndex['State/UT tax']]),
      cess: toNumber(row[columnIndex['Cess']]),
      gstr1Period: toStringOrNull(row[columnIndex['GSTR-1/IFF/GSTR-5 Period']]),
      gstr1FilingDate: toStringOrNull(row[columnIndex['GSTR-1/IFF/GSTR-5 Filing Date']]),
      itcAvailability: toString(row[columnIndex['ITC Availability']]),
      itcUnavailableReason: toStringOrNull(row[columnIndex['Reason']]),
      applicableTaxRatePercent: toNumberOrNull(row[columnIndex['Applicable % of Tax Rate']]),
      source: toString(row[columnIndex['Source']]),
      irn: toStringOrNull(row[columnIndex['IRN']]),
      irnDate: toStringOrNull(row[columnIndex['IRN date']]),
    };

    invoices.push(invoice);
  }

  return invoices;
}

/**
 * Parses an ITC summary sheet (e.g. "ITC Available" or "ITC not available").
 * Extracts key-value totals from Part A and Part B sections.
 *
 * @param worksheet  - The ExcelJS worksheet object
 * @param sheetLabel - Sheet name used for logging
 */
function parseItcSummarySheet(worksheet: ExcelJS.Worksheet, sheetLabel: string): ItcSummary {
  const allRows = readAllRows(worksheet);
  const partA: Record<string, number> = {};
  const partB: Record<string, number> = {};
  let currentPart = '';

  for (const row of allRows) {
    const cellZero = toString(row[0]).toLowerCase();
    const cellOne = toString(row[1]).toLowerCase();

    // Detect part headings
    if (cellZero.includes('part a') || cellOne.includes('part a')) {
      currentPart = 'A';
      continue;
    }
    if (cellZero.includes('part b') || cellOne.includes('part b')) {
      currentPart = 'B';
      continue;
    }

    // Extract label-value pairs
    const label = toString(row[0]);
    // Look for a numeric value in the last non-null column
    const numericValue = [...row]
      .reverse()
      .find((cell) => cell !== null && cell !== undefined && cell !== '');
    const amount = toNumber(numericValue ?? null);

    if (label && amount !== 0) {
      if (currentPart === 'A') {
        partA[label] = amount;
      } else if (currentPart === 'B') {
        partB[label] = amount;
      }
    }
  }

  console.log(
    `[GSTR-2B Parser] ITC summary "${sheetLabel}": Part A keys=${Object.keys(partA).length}, Part B keys=${Object.keys(partB).length}`,
  );

  return { partA, partB };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parses a GSTR-2B Excel file (multi-sheet format) and returns file metadata,
 * B2B invoice rows, and ITC summary totals.
 *
 * @param fileBuffer - Binary content of the uploaded Excel file
 * @param fileName   - Original file name (used for logging only)
 * @throws Error if required sheets or columns are missing
 */
export async function parseGstr2B(
  fileBuffer: Buffer,
  fileName: string,
): Promise<Gstr2BParseResult> {
  console.log(`[GSTR-2B Parser] Parsing file: ${fileName}`);

  const workbook = new ExcelJS.Workbook();
  // Convert Node.js Buffer to ArrayBuffer to satisfy ExcelJS type definitions
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  console.log(`[GSTR-2B Parser] Sheets found: ${sheetNames.join(', ')}`);

  // Find the "Read me" sheet (case-insensitive)
  const readMeSheet = workbook.worksheets.find((ws) =>
    ws.name.toLowerCase().includes('read me'),
  );
  if (!readMeSheet) {
    throw new Error('[GSTR-2B Parser] Required "Read me" sheet not found');
  }

  // Extract metadata from "Read me" sheet
  const readMeRows = readAllRows(readMeSheet);
  const metadata = extractReadMeMetadata(readMeRows);
  console.log(
    `[GSTR-2B Parser] Metadata — FY: ${metadata.financialYear}, Period: ${metadata.taxPeriod}, GSTIN: ${metadata.buyerGstin}`,
  );

  // Find and parse the "B2B" sheet (exact match, case-insensitive)
  const b2bSheet = workbook.worksheets.find((ws) => ws.name.toUpperCase() === 'B2B');
  if (!b2bSheet) {
    throw new Error('[GSTR-2B Parser] Required "B2B" sheet not found');
  }

  const b2bInvoices = parseB2BSheet(b2bSheet, b2bSheet.name);
  console.log(`[GSTR-2B Parser] Parsed ${b2bInvoices.length} B2B invoice rows`);

  // Parse "ITC Available" sheet (optional — warn if missing)
  let itcAvailableSummary: ItcSummary = { partA: {}, partB: {} };
  const itcAvailSheet = workbook.worksheets.find(
    (ws) =>
      ws.name.toLowerCase().includes('itc available') &&
      !ws.name.toLowerCase().includes('not'),
  );
  if (itcAvailSheet) {
    itcAvailableSummary = parseItcSummarySheet(itcAvailSheet, itcAvailSheet.name);
  } else {
    console.warn('[GSTR-2B Parser] "ITC Available" sheet not found — summary will be empty');
  }

  // Parse "ITC not available" sheet (optional — warn if missing)
  let itcNotAvailableSummary: ItcSummary = { partA: {}, partB: {} };
  const itcNotAvailSheet = workbook.worksheets.find((ws) =>
    ws.name.toLowerCase().includes('itc not available'),
  );
  if (itcNotAvailSheet) {
    itcNotAvailableSummary = parseItcSummarySheet(itcNotAvailSheet, itcNotAvailSheet.name);
  } else {
    console.warn(
      '[GSTR-2B Parser] "ITC not available" sheet not found — summary will be empty',
    );
  }

  return { metadata, b2bInvoices, itcAvailableSummary, itcNotAvailableSummary };
}
