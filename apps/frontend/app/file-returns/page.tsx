'use client';

/**
 * @file apps/frontend/app/file-returns/page.tsx
 * @description File Returns — Period Selector page.
 * Users choose Financial Year, Quarter, and Month then click SEARCH
 * to navigate to the list of returns for that period.
 *
 * Phase 8: GST portal-style period selector.
 */

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

const FINANCIAL_YEARS = ['2024-25', '2023-24', '2022-23'] as const;

const QUARTERS = [
  { value: 'Q1', label: 'Q1 (Apr – Jun)' },
  { value: 'Q2', label: 'Q2 (Jul – Sep)' },
  { value: 'Q3', label: 'Q3 (Oct – Dec)' },
  { value: 'Q4', label: 'Q4 (Jan – Mar)' },
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Common select CSS properties for the period dropdowns. */
const SELECT_ST: CSSProperties = {
  width: '100%',
  background: '#0d0d0d',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#e0e0e0',
  fontSize: 13,
  outline: 'none',
  fontFamily: "'DM Sans', sans-serif",
  cursor: 'pointer',
};

/**
 * Period Selector page for filing GST returns.
 */
export default function FileReturnsPage(): React.ReactElement {
  const router = useRouter();
  const [fy, setFy] = useState<string>('2024-25');
  const [quarter, setQuarter] = useState<string>('Q2');
  const [month, setMonth] = useState<string>('July');

  const handleSearch = () => {
    router.push(`/file-returns/returns?fy=${encodeURIComponent(fy)}&month=${encodeURIComponent(month)}`);
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>File Returns</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>Select a financial year, quarter, and month to search for available returns.</p>

      {/* Period selector card */}
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 16 }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 22px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>Select Period</p>
        </div>
        <div style={{ padding: '22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Financial Year */}
            <div>
              <label htmlFor="fy" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 7 }}>Financial Year</label>
              <select id="fy" value={fy} onChange={(e) => setFy(e.target.value)} style={SELECT_ST}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {FINANCIAL_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Quarter */}
            <div>
              <label htmlFor="quarter" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 7 }}>Quarter</label>
              <select id="quarter" value={quarter} onChange={(e) => setQuarter(e.target.value)} style={SELECT_ST}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>

            {/* Month */}
            <div>
              <label htmlFor="month" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 7 }}>Period (Month)</label>
              <select id="month" value={month} onChange={(e) => setMonth(e.target.value)} style={SELECT_ST}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <button onClick={handleSearch} className="btn-primary">
            Search Returns
          </button>
        </div>
      </div>

      {/* Info note */}
      <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '13px 16px', fontSize: 13, color: '#555', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ flexShrink: 0, color: '#3b82f6', fontWeight: 700 }}>i</span>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: '#888' }}>Note:</strong> GSTR-1 and GSTR-3B shall be filed for each month of the quarter.
        </p>
      </div>
    </div>
  );
}
