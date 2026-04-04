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
