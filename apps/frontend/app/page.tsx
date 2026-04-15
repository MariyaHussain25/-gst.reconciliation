'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, IndianRupee, TrendingUp, TriangleAlert } from 'lucide-react';
import {
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Legend,
} from 'recharts';
import { parseJwtUserId } from '../lib/auth';
import { apiFetchWithAuth } from '../lib/api';
import { formatCurrency } from '../lib/utils';

interface LookupItem {
  reconciliation_id: string;
  period: string;
  financial_year: string;
  status: string;
  created_at: string;
  summary: Record<string, number>;
}

interface LookupResponse {
  reconciliations: LookupItem[];
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

function num(summary: Record<string, number>, key: string): number {
  const value = summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const [records, setRecords] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard(): Promise<void> {
      const token = localStorage.getItem('token') ?? '';
      const userId = parseJwtUserId(token);
      if (!token || !userId) {
        router.replace('/login');
        return;
      }

      try {
        const response = await apiFetchWithAuth(`/api/generate-pdf/by-user/${encodeURIComponent(userId)}/lookup`);
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(payload.detail ?? 'Failed to load dashboard data.');
        }

        const payload = (await response.json()) as LookupResponse;
        const sorted = [...(payload.reconciliations ?? [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setRecords(sorted);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [router]);

  const metrics = useMemo(() => {
    return records.reduce(
      (acc, item) => {
        const summary = item.summary ?? {};
        acc.totalInvoices += num(summary, 'total_invoices');
        acc.matched += num(summary, 'matched_count');
        acc.fuzzy += num(summary, 'fuzzy_match_count');
        acc.needsReview += num(summary, 'needs_review_count');
        acc.missing += num(summary, 'missing_in_2a_count') + num(summary, 'missing_in_2b_count');
        acc.totalDifference += num(summary, 'total_blocked_itc') + num(summary, 'total_ineligible_itc');
        if (item.status !== 'COMPLETED') acc.inProgress += 1;
        return acc;
      },
      {
        totalInvoices: 0,
        matched: 0,
        fuzzy: 0,
        needsReview: 0,
        missing: 0,
        totalDifference: 0,
        inProgress: 0,
      },
    );
  }, [records]);

  const mismatchedCount = metrics.fuzzy + metrics.needsReview + metrics.missing;
  const completionPercent = metrics.totalInvoices > 0 ? Math.round((metrics.matched / metrics.totalInvoices) * 100) : 0;

  const lineData = useMemo(() => {
    const monthAgg = new Map<string, { matched: number; mismatched: number }>();
    records.forEach((item) => {
      const parts = item.period.split('-');
      if (parts.length !== 2) return;
      const [yearText, monthText] = parts;
      if (!/^\d{4}$/.test(yearText) || !/^\d{2}$/.test(monthText)) return;
      const year = Number(yearText);
      const monthIndex = Number(monthText) - 1;
      if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return;
      if (Number.isNaN(year)) return;
      const monthLabel = new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'short' });
      if (!MONTH_LABELS.includes(monthLabel)) return;

      const existing = monthAgg.get(monthLabel) ?? { matched: 0, mismatched: 0 };
      existing.matched += num(item.summary, 'matched_count');
      existing.mismatched +=
        num(item.summary, 'fuzzy_match_count') +
        num(item.summary, 'needs_review_count') +
        num(item.summary, 'missing_in_2a_count') +
        num(item.summary, 'missing_in_2b_count');
      monthAgg.set(monthLabel, existing);
    });

    return MONTH_LABELS.map((month) => ({
      month,
      matched: monthAgg.get(month)?.matched ?? 0,
      mismatched: monthAgg.get(month)?.mismatched ?? 0,
    }));
  }, [records]);

  const pieData = useMemo(() => {
    return [
      { name: 'Matched', value: metrics.matched, color: '#16a34a' },
      { name: 'Mismatched', value: mismatchedCount, color: '#d97706' },
      { name: 'Missing', value: metrics.missing, color: '#dc2626' },
      { name: 'In Progress', value: metrics.inProgress, color: '#2563eb' },
    ].filter((item) => item.value > 0);
  }, [metrics.inProgress, metrics.matched, metrics.missing, mismatchedCount]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563eb]/30 border-t-[#2563eb]" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Reconciliation Status</p>
            <TrendingUp size={18} className="text-[#16a34a]" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{completionPercent}%</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Total Invoices</p>
            <FileText size={18} className="text-[#2563eb]" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{metrics.totalInvoices}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Mismatched Invoices</p>
            <TriangleAlert size={18} className="text-[#d97706]" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{mismatchedCount}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Total Difference</p>
            <IndianRupee size={18} className="text-[#dc2626]" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatCurrency(metrics.totalDifference)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Reconciliation Overview</h2>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="matched" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="mismatched" stroke="#d97706" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Reconciliation Summary</h2>
          <div className="mt-4 grid grid-cols-1 items-center gap-4 md:grid-cols-2">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {pieData.map((item) => {
                const percentage = metrics.totalInvoices > 0 ? ((item.value / metrics.totalInvoices) * 100).toFixed(1) : '0.0';
                return (
                  <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{item.name}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {item.value} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Recent Reconciliation</h2>
          <Link href="/reports" className="text-sm font-medium text-[#2563eb] hover:underline">
            View All
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Tax Period</th>
                <th className="px-4 py-3">Total Invoices</th>
                <th className="px-4 py-3">Matched</th>
                <th className="px-4 py-3">Mismatched</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 8).map((item) => {
                const rowMismatched =
                  num(item.summary, 'fuzzy_match_count') +
                  num(item.summary, 'needs_review_count') +
                  num(item.summary, 'missing_in_2a_count') +
                  num(item.summary, 'missing_in_2b_count');
                const isComplete = item.status === 'COMPLETED';

                return (
                  <tr key={item.reconciliation_id} className="border-t border-slate-100 text-slate-700">
                    <td className="px-4 py-3">GSTR Reconciliation</td>
                    <td className="px-4 py-3">{item.period}</td>
                    <td className="px-4 py-3">{num(item.summary, 'total_invoices')}</td>
                    <td className="px-4 py-3">{num(item.summary, 'matched_count')}</td>
                    <td className="px-4 py-3">{rowMismatched}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          isComplete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {isComplete ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/reports?reconciliation_id=${encodeURIComponent(item.reconciliation_id)}`}
                        className="font-medium text-[#2563eb] hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
