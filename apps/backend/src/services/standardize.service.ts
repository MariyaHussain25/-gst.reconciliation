/**
 * @file apps/backend/src/services/standardize.service.ts
 * @description Data normalization and standardization service.
 * Converts raw invoice data from various document formats into a
 * consistent, normalized structure for the matching engine.
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 4: Implement actual normalization logic (string cleaning, date parsing, etc.)
 */

import type { RawInvoiceData } from '@gst/shared';
import type { IInvoice } from '../models/invoice.model.js';
import { derivePeriodFromDateStr, parseGstDate } from '../utils/date.utils.js';

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Common prefixes to strip from vendor names (with optional trailing dot/space) */
const VENDOR_PREFIX_RE =
  /^(?:m\/s\.?\s*|messrs\.?\s*)/i;

/** Suffix normalisation map (order matters: more specific first) */
const SUFFIX_REPLACEMENTS: [RegExp, string][] = [
  [/\bprivate\s+limited\b/gi, 'pvt ltd'],
  [/\bpvt\.?\s+ltd\.?\b/gi, 'pvt ltd'],
  [/\bprivate\s+ltd\.?\b/gi, 'pvt ltd'],
  [/\blimited\b/gi, 'ltd'],
  [/\bltd\.?\b/gi, 'ltd'],
];

/**
 * Normalizes a vendor name for consistent comparison during matching.
 *
 * Processing steps:
 *   1. Strip common Indian business prefixes (M/S, M/s., MESSRS)
 *   2. Normalise legal suffixes (PRIVATE LIMITED → pvt ltd, etc.)
 *   3. Replace `&` with `and`
 *   4. Remove remaining punctuation (keep letters, digits, spaces)
 *   5. Collapse multiple spaces, lowercase, trim
 *
 * Examples:
 *   `"M/S LIBERTY GLASS CRETIONS"` → `"liberty glass cretions"`
 *   `"SHARDA DOORS & PLYWOOD"`     → `"sharda doors and plywood"`
 *   `"M/S ABC TRADERS PVT. LTD."` → `"abc traders pvt ltd"`
 *
 * @param vendorName - Raw vendor name from source document
 * @returns Normalized vendor name string
 */
export function normalizeVendorName(vendorName: string): string {
  let name = vendorName.trim();

  // 1. Remove common prefixes
  name = name.replace(VENDOR_PREFIX_RE, '');

  // 2. Normalise legal suffixes
  for (const [pattern, replacement] of SUFFIX_REPLACEMENTS) {
    name = name.replace(pattern, replacement);
  }

  // 3. Replace & with and
  name = name.replace(/&/g, 'and');

  // 4. Remove punctuation except word chars and spaces
  name = name.replace(/[^a-zA-Z0-9\s]/g, ' ');

  // 5. Collapse spaces, lowercase, trim
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Normalizes an invoice number for consistent comparison.
 *
 * Processing steps:
 *   1. Remove all non-alphanumeric characters
 *   2. Convert to uppercase
 *   3. Strip leading zeros only if the result is entirely numeric
 *      (preserves leading zeros in alphanumeric numbers like "INV001")
 *
 * Examples:
 *   `"INV/2024/001"` → `"INV2024001"`
 *   `"544"`          → `"544"`
 *   `"001"`          → `"1"`
 *   `"INV001"`       → `"INV001"`
 *
 * @param invoiceNumber - Raw invoice number from source document
 * @returns Normalized invoice number string
 */
export function normalizeInvoiceNumber(invoiceNumber: string): string {
  const stripped = invoiceNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Strip leading zeros only for purely numeric invoice numbers
  if (/^\d+$/.test(stripped)) {
    return String(parseInt(stripped, 10));
  }

  return stripped;
}

/**
 * Derives the tax period (`YYYY-MM`) from an invoice date string.
 * Delegates to the shared `derivePeriodFromDateStr()` utility so ALL
 * six GST date formats are handled correctly.
 *
 * Examples:
 *   `"15-Mar-23"`   → `"2023-03"`
 *   `"25/03/2023"`  → `"2023-03"`
 *   `"2023-03-25"`  → `"2023-03"`
 *   `"15-03-23"`    → `"2023-03"`
 *   `"15.03.23"`    → `"2023-03"`
 *
 * @param invoiceDate - Invoice date string in any supported GST format
 * @returns Period string in `YYYY-MM` format
 */
export function derivePeriodFromDate(invoiceDate: string): string {
  return derivePeriodFromDateStr(invoiceDate);
}

// ---------------------------------------------------------------------------
// Return type compatible with IInvoice (minus Mongoose Document fields)
// ---------------------------------------------------------------------------

type StandardizedInvoice = Omit<IInvoice, keyof import('mongoose').Document | 'createdAt'>;

/**
 * Standardizes a batch of raw invoice records into objects ready for MongoDB insertion.
 *
 * For each raw invoice:
 *   - Normalizes vendor name and invoice number
 *   - Parses the invoice date into a JS Date (any supported GST format)
 *   - Derives the YYYY-MM period
 *   - Computes totalAmount with 2-decimal rounding
 *   - Sets default reconciliation fields (UNMATCHED, confidence 0, ITC null)
 *
 * @param rawInvoices - Array of raw invoice data objects
 * @param userId      - ID of the user the invoices belong to
 * @param source      - Source type: 'BOOKS' | 'GSTR_2A' | 'GSTR_2B'
 * @returns Array of standardized invoice objects ready for `InvoiceModel.insertMany()`
 */
export function standardizeInvoices(
  rawInvoices: RawInvoiceData[],
  userId: string,
  source: 'BOOKS' | 'GSTR_2A' | 'GSTR_2B',
): StandardizedInvoice[] {
  return rawInvoices.map((rawInvoice) => ({
    userId,
    source,
    gstin: rawInvoice.gstin,
    vendorName: rawInvoice.vendorName,
    normalizedVendorName: normalizeVendorName(rawInvoice.vendorName),
    invoiceNumber: rawInvoice.invoiceNumber,
    normalizedInvoiceNumber: normalizeInvoiceNumber(rawInvoice.invoiceNumber),
    invoiceDate: parseGstDate(rawInvoice.invoiceDate),
    period: derivePeriodFromDate(rawInvoice.invoiceDate),
    taxableAmount: rawInvoice.taxableAmount,
    igst: rawInvoice.igst,
    cgst: rawInvoice.cgst,
    sgst: rawInvoice.sgst,
    totalAmount:
      Math.round(
        (rawInvoice.taxableAmount + rawInvoice.igst + rawInvoice.cgst + rawInvoice.sgst) * 100,
      ) / 100,
    matchStatus: 'UNMATCHED' as const,
    itcCategory: null,
    matchConfidence: 0,
    description: rawInvoice.description,
  }));
}
