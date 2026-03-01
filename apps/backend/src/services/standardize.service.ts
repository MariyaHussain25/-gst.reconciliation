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

/**
 * Normalizes a vendor name for consistent comparison during matching.
 * Removes punctuation, converts to lowercase, trims whitespace.
 *
 * Example: "M/S ABC TRADERS PVT. LTD." → "abc traders pvt ltd"
 *
 * @param vendorName - Raw vendor name from source document
 * @returns Normalized vendor name string
 *
 * TODO (Phase 4): Implement full normalization (handle abbreviations, legal suffixes, etc.)
 */
export function normalizeVendorName(vendorName: string): string {
  // TODO (Phase 4): Handle common GST vendor name variations
  return vendorName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Normalizes an invoice number for consistent comparison.
 * Removes special characters and converts to uppercase.
 *
 * Example: "INV/2024/001" → "INV2024001"
 *
 * @param invoiceNumber - Raw invoice number from source document
 * @returns Normalized invoice number string
 *
 * TODO (Phase 4): Handle edge cases (leading zeros, separators, etc.)
 */
export function normalizeInvoiceNumber(invoiceNumber: string): string {
  // TODO (Phase 4): Implement full normalization
  return invoiceNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Derives the tax period (YYYY-MM) from an invoice date.
 *
 * @param invoiceDate - Invoice date string in YYYY-MM-DD format
 * @returns Period string in YYYY-MM format
 *
 * TODO (Phase 4): Handle fiscal year period mapping
 */
export function derivePeriodFromDate(invoiceDate: string): string {
  // TODO (Phase 4): Implement fiscal period derivation
  return invoiceDate.substring(0, 7);
}

/**
 * Standardizes a batch of raw invoice records.
 *
 * @param rawInvoices - Array of raw invoice data objects
 * @param userId - ID of the user the invoices belong to
 * @param source - Source type of the invoice batch
 * @returns Array of standardized invoice data ready for the matching engine
 *
 * TODO (Phase 4): Implement full standardization pipeline
 */
export function standardizeInvoices(
  rawInvoices: RawInvoiceData[],
  userId: string,
  source: 'BOOKS' | 'GSTR_2A' | 'GSTR_2B',
): Record<string, unknown>[] {
  // TODO (Phase 4): Replace with actual standardized invoice objects

  return rawInvoices.map((rawInvoice) => ({
    userId,
    source,
    gstin: rawInvoice.gstin,
    vendorName: rawInvoice.vendorName,
    normalizedVendorName: normalizeVendorName(rawInvoice.vendorName),
    invoiceNumber: rawInvoice.invoiceNumber,
    normalizedInvoiceNumber: normalizeInvoiceNumber(rawInvoice.invoiceNumber),
    invoiceDate: new Date(rawInvoice.invoiceDate),
    period: derivePeriodFromDate(rawInvoice.invoiceDate),
    taxableAmount: rawInvoice.taxableAmount,
    igst: rawInvoice.igst,
    cgst: rawInvoice.cgst,
    sgst: rawInvoice.sgst,
    totalAmount:
      Math.round(
        (rawInvoice.taxableAmount + rawInvoice.igst + rawInvoice.cgst + rawInvoice.sgst) * 100,
      ) / 100, // Round to 2 decimal places to avoid floating-point precision issues
    matchStatus: 'UNMATCHED',
    itcCategory: null,
    matchConfidence: 0,
    description: rawInvoice.description,
  }));
}
