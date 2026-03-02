/**
 * @file apps/backend/src/services/mappers/gstr2a.mapper.ts
 * @description Maps parsed GSTR-2A invoice data to the canonical RawInvoiceData format.
 * Converts field names, coerces types, and normalises date strings to YYYY-MM-DD.
 *
 * Phase 4: Implemented.
 */

import type { RawInvoiceData } from '@gst/shared';
import type { Gstr2AInvoice, Gstr2AMetadata } from '../../parsers/gstr2a.parser.js';
import { formatDateToISO } from '../../utils/date.utils.js';

/**
 * Converts an array of parsed GSTR-2A invoice rows into `RawInvoiceData` objects
 * ready for the standardization pipeline.
 *
 * Field mapping:
 *   partyGstin       → gstin
 *   particulars      → vendorName
 *   vchNo (number)   → invoiceNumber (string)
 *   date             → invoiceDate (YYYY-MM-DD via formatDateToISO)
 *   taxableAmount    → taxableAmount
 *   igst             → igst
 *   cgst             → cgst
 *   sgstUtgst        → sgst
 *   particulars      → description
 *
 * @param invoices - Parsed invoice rows from the GSTR-2A parser
 * @param metadata - File-level metadata from the GSTR-2A parser
 * @returns Array of `RawInvoiceData` objects
 */
export function mapGstr2AToRawInvoices(
  invoices: Gstr2AInvoice[],
  metadata: Gstr2AMetadata,
): RawInvoiceData[] {
  void metadata; // metadata is available for future use (e.g. userId enrichment at upload time)

  return invoices.map((inv) => ({
    gstin: inv.partyGstin,
    vendorName: inv.particulars,
    invoiceNumber: String(inv.vchNo),
    invoiceDate: formatDateToISO(inv.date),
    taxableAmount: inv.taxableAmount,
    igst: inv.igst,
    cgst: inv.cgst,
    sgst: inv.sgstUtgst,
    description: inv.particulars,
  }));
}
