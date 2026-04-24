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
  MATCHED:         { bg: '#dcfce7',  color: '#15803d', border: 'rgba(22,163,74,0.3)',   label: 'Matched' },
  FUZZY_MATCH:     { bg: '#fef9c3',  color: '#92400e', border: 'rgba(161,98,7,0.3)',    label: 'Fuzzy Match' },
  MISSING_IN_2A:   { bg: '#ffedd5',  color: '#c2410c', border: 'rgba(194,65,12,0.3)',   label: 'Missing 2A' },
  MISSING_IN_2B:   { bg: '#fee2e2',  color: '#b91c1c', border: 'rgba(185,28,28,0.3)',   label: 'Missing 2B' },
  VALUE_MISMATCH:  { bg: '#fef9c3',  color: '#92400e', border: 'rgba(161,98,7,0.3)',    label: 'Value Diff' },
  GSTIN_MISMATCH:  { bg: '#f3e8ff',  color: '#7e22ce', border: 'rgba(126,34,206,0.3)',  label: 'GSTIN Diff' },
  UNMATCHED:       { bg: '#f1f5f9',  color: '#475569', border: 'rgba(71,85,105,0.25)', label: 'Unmatched' },
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
  COMPLETED:  { bg: '#dcfce7',  color: '#15803d', border: 'rgba(22,163,74,0.3)' },
  PROCESSING: { bg: '#dbeafe',  color: '#1d4ed8', border: 'rgba(29,78,216,0.3)' },
  PENDING:    { bg: '#f1f5f9',  color: '#475569', border: 'rgba(71,85,105,0.25)' },
  FAILED:     { bg: '#fee2e2',  color: '#b91c1c', border: 'rgba(185,28,28,0.3)' },
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
