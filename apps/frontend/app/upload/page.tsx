/**
 * @file apps/frontend/app/upload/page.tsx
 * @description Minimal upload + process UI wired to backend APIs via Next rewrites.
 */
'use client';

import React, { useState } from 'react';

export default function UploadPage(): React.ReactElement {
  const [userId, setUserId] = useState('test-user-1');
  const [period, setPeriod] = useState('2024-07');
  const [file2a, setFile2a] = useState<File | null>(null);
  const [file2b, setFile2b] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadOne(file: File | null): Promise<void> {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('user_id', userId.trim());
    const res = await fetch('/api/upload-docs', { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Upload failed (${res.status})`);
    }
  }

  async function handleUpload(): Promise<void> {
    try {
      setBusy(true);
      setStatus('Uploading files…');
      if (!userId.trim()) throw new Error('Please enter a User ID');
      if (!file2a && !file2b) throw new Error('Choose at least one file to upload');
      if (file2a) await uploadOne(file2a);
      if (file2b) await uploadOne(file2b);
      setStatus('Upload complete.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleProcess(): Promise<void> {
    try {
      setBusy(true);
      setStatus('Starting reconciliation…');
      const url = `/api/process/${encodeURIComponent(userId.trim())}?period=${encodeURIComponent(period.trim())}`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Process failed (${res.status})`);
      }
      const data = await res.json();
      setStatus(`Reconciliation complete: ${data.summary?.total_invoices ?? 0} invoices.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Reconciliation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Upload & Process</h1>
      <p className="mb-6 text-gray-500">Upload GSTR-2A and GSTR-2B, then run reconciliation.</p>

      <div className="grid gap-4 rounded-lg border border-[#dddbd7] bg-white p-6 shadow-sm sm:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[#191d26]">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded border border-[#dddbd7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#182844]"
            placeholder="e.g. test-user-1"
          />
          <label className="block text-sm font-medium text-[#191d26]">Period (YYYY-MM)</label>
          <input
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded border border-[#dddbd7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#182844]"
            placeholder="e.g. 2024-07"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-[#191d26]">GSTR-2A Excel</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile2a(e.target.files?.[0] ?? null)}
            className="w-full rounded border border-[#dddbd7] px-3 py-2 text-sm"
          />
          <label className="block text-sm font-medium text-[#191d26]">GSTR-2B Excel</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile2b(e.target.files?.[0] ?? null)}
            className="w-full rounded border border-[#dddbd7] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={busy}
          className="rounded bg-[#182844] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={() => void handleProcess()}
          disabled={busy}
          className="rounded border border-[#182844] bg-white px-5 py-2 text-sm font-semibold text-[#182844] transition hover:bg-[#edece9] disabled:opacity-60"
        >
          {busy ? 'Processing…' : 'Run Reconciliation'}
        </button>
      </div>

      {status && (
        <div className="mt-4 rounded-lg border border-[#dddbd7] bg-white px-4 py-3 text-sm">
          {status}
        </div>
      )}
    </div>
  );
}
