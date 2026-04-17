/**
 * @file apps/frontend/components/ui/StatusBadge.tsx
 * @description Reusable status badge components for GST return filing statuses.
 * FilingStatusBadge: Filed (green) / To be Filed (orange) / Not Filed (red).
 * YNBadge: Y (green) / N (red) — used in Supplier Filing Status table.
 *
 * Phase 8: Added for GST Dashboard UI.
 */

/** The three possible filing statuses displayed on the Returns Calendar. */
export type FilingStatus = 'Filed' | 'To be Filed' | 'Not Filed';

const filingStatusStyles: Record<FilingStatus, string> = {
  'Filed': 'bg-status-success-bg text-status-success-text',
  'To be Filed': 'bg-status-warning-bg text-status-warning-text',
  'Not Filed': 'bg-status-danger-bg text-status-danger-text',
};

/**
 * Inline badge showing one of three GST filing statuses.
 * Colours match the design tokens defined in globals.css.
 */
export function FilingStatusBadge({
  status,
}: {
  status: FilingStatus;
}): React.ReactElement {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium tracking-wide ${filingStatusStyles[status]}`}
    >
      {status}
    </span>
  );
}

/**
 * Small circular badge for "Y" (green) or "N" (red) binary statuses.
 * Used in the Supplier Filing Status table.
 */
export function YNBadge({ status }: { status: 'Y' | 'N' }): React.ReactElement {
  const style =
    status === 'Y'
      ? 'bg-status-success-bg text-status-success-text'
      : 'bg-status-danger-bg text-status-danger-text';
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${style}`}
    >
      {status}
    </span>
  );
}

/** Pill badge for reconciliation match_status values returned by the backend. */
const MATCH_STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  MATCHED:         { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', border: 'rgba(34,197,94,0.25)',  label: 'Matched' },
  FUZZY_MATCH:     { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)', label: 'Fuzzy Match' },
  MISSING_IN_2A:   { bg: 'rgba(245,158,11,0.12)', color: '#fb923c', border: 'rgba(245,158,11,0.25)', label: 'Missing 2A' },
  MISSING_IN_2B:   { bg: 'rgba(229,62,62,0.12)',  color: '#f87171', border: 'rgba(229,62,62,0.25)',  label: 'Missing 2B' },
  VALUE_MISMATCH:  { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)', label: 'Value Diff' },
  GSTIN_MISMATCH:  { bg: 'rgba(139,92,246,0.12)', color: '#c084fc', border: 'rgba(139,92,246,0.25)', label: 'GSTIN Diff' },
  UNMATCHED:       { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: 'rgba(107,114,128,0.25)', label: 'Unmatched' },
};

export function MatchStatusBadge({ status }: { status: string }): React.ReactElement {
  const s = MATCH_STATUS_STYLES[status] ?? MATCH_STATUS_STYLES['UNMATCHED'];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '3px 10px',
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

/** Pill badge for a Reconciliation document's overall status (PENDING/PROCESSING/COMPLETED/FAILED). */
const RECON_STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  COMPLETED:  { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', border: 'rgba(34,197,94,0.25)' },
  PROCESSING: { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  PENDING:    { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: 'rgba(107,114,128,0.25)' },
  FAILED:     { bg: 'rgba(229,62,62,0.12)',  color: '#f87171', border: 'rgba(229,62,62,0.25)' },
};

export function ReconStatusBadge({ status }: { status: string }): React.ReactElement {
  const s = RECON_STATUS_STYLES[status] ?? RECON_STATUS_STYLES['PENDING'];
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '3px 10px',
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
