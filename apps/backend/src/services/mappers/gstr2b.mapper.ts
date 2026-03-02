/**
 * @file apps/backend/src/services/mappers/gstr2b.mapper.ts
 * @description Maps parsed GSTR-2B invoice data to the canonical RawInvoiceData format.
 * Converts field names, coerces types, and normalises date strings to YYYY-MM-DD.
 *
 * Phase 4: Implemented.
 */

import type { RawInvoiceData } from '@gst/shared';
import type { Gstr2BInvoice, Gstr2BMetadata } from '../../parsers/gstr2b.parser.js';
import { formatDateToISO } from '../../utils/date.utils.js';

/**
 * Converts an array of parsed GSTR-2B B2B invoice rows into `RawInvoiceData` objects
 * ready for the standardization pipeline.
 *
 * Field mapping:
 *   supplierGstin    → gstin
 *   supplierTradeName → vendorName
 *   invoiceNumber    → invoiceNumber (already string)
 *   invoiceDate      → invoiceDate (YYYY-MM-DD via formatDateToISO)
 *   taxableValue     → taxableAmount
 *   integratedTax    → igst
 *   centralTax       → cgst
 *   stateUtTax       → sgst
 *
 * @param invoices - Parsed B2B invoice rows from the GSTR-2B parser
 * @param metadata - File-level metadata from the GSTR-2B parser
 * @returns Array of `RawInvoiceData` objects
 */
export function mapGstr2BToRawInvoices(
  invoices: Gstr2BInvoice[],
  metadata: Gstr2BMetadata,
): RawInvoiceData[] {
  void metadata; // metadata is available for future use (e.g. userId enrichment at upload time)

  return invoices.map((inv) => ({
    gstin: inv.supplierGstin,
    vendorName: inv.supplierTradeName,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: formatDateToISO(inv.invoiceDate),
    taxableAmount: inv.taxableValue,
    igst: inv.integratedTax,
    cgst: inv.centralTax,
    sgst: inv.stateUtTax,
  }));
}
