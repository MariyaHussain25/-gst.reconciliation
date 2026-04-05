/**
 * @file apps/frontend/app/upload/page.tsx
 * @description Document upload page.
 * Allows users to upload Purchase Books (GSTR-2A) and GSTR-2B Excel files,
 * then triggers the reconciliation pipeline and redirects to the results page.
 *
 * Phase 3: Fully functional file upload form connected to the FastAPI backend.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Upload page — users select and upload their GST documents.
 * Sends files to /api/upload-docs (proxied to FastAPI backend),
 * triggers /api/process/{user_id}, then redirects to /results.
 */
export default function UploadPage(): React.ReactElement {
  const router = useRouter();

  const [userId, setUserId] = useState('');
  const [fileBooks, setFileBooks] = useState<File | null>(null);
  const [fileGstr2b, setFileGstr2b] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadLog, setUploadLog] = useState<string[]>([]);

  function appendLog(msg: string): void {
    setUploadLog((prev) => [...prev, msg]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    if (!userId.trim()) {
      setError('Please enter your User ID / GSTIN.');
      return;
    }
    if (!fileBooks) {
      setError('Please select your Purchase Books (GSTR-2A) file.');
      return;
    }
    if (!fileGstr2b) {
      setError('Please select your GSTR-2B file.');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadLog([]);

    try {
      // ── Step 1: Upload Purchase Books (GSTR-2A) ──────────────────────────
      appendLog('Uploading Purchase Books (GSTR-2A)…');
      const form1 = new FormData();
      form1.append('file', fileBooks);
      form1.append('user_id', userId.trim());

      const res1 = await fetch('/api/upload-docs', { method: 'POST', body: form1 });
      if (!res1.ok) {
        const body = (await res1.json()) as { error?: string; detail?: string };
        throw new Error(body.error ?? body.detail ?? `Upload failed (HTTP ${res1.status})`);
      }
      const data1 = (await res1.json()) as { records_parsed?: number };
      appendLog(`✓ Purchase Books uploaded — ${data1.records_parsed ?? 0} records parsed.`);

      // ── Step 2: Upload GSTR-2B ────────────────────────────────────────────
      appendLog('Uploading GSTR-2B…');
      const form2 = new FormData();
      form2.append('file', fileGstr2b);
      form2.append('user_id', userId.trim());

      const res2 = await fetch('/api/upload-docs', { method: 'POST', body: form2 });
      if (!res2.ok) {
        const body = (await res2.json()) as { error?: string; detail?: string };
        throw new Error(body.error ?? body.detail ?? `Upload failed (HTTP ${res2.status})`);
      }
      const data2 = (await res2.json()) as { records_parsed?: number };
      appendLog(`✓ GSTR-2B uploaded — ${data2.records_parsed ?? 0} records parsed.`);

      // ── Step 3: Run reconciliation pipeline ──────────────────────────────
      appendLog('Running AI reconciliation pipeline…');
      const res3 = await fetch(`/api/process/${encodeURIComponent(userId.trim())}`, {
        method: 'POST',
      });
      if (!res3.ok) {
        const body = (await res3.json()) as { error?: string; detail?: string };
        throw new Error(
          body.error ?? body.detail ?? `Reconciliation failed (HTTP ${res3.status})`,
        );
      }
      appendLog('✓ Reconciliation complete! Redirecting to Results…');

      // ── Redirect to results ───────────────────────────────────────────────
      router.push(`/results?user_id=${encodeURIComponent(userId.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-8">
      <h1 className="mb-2 text-3xl font-bold text-foreground">Upload Documents</h1>
      <p className="mb-8 text-muted-foreground">
        Upload your Purchase Books (GSTR-2A) and GSTR-2B returns to begin AI-powered
        reconciliation.
      </p>

      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-xl border border-border bg-surface p-8 shadow-sm"
        >
          {/* User ID / GSTIN */}
          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="userId">
              User ID / GSTIN
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. 27AAPFU0939F1ZV"
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Purchase Books (GSTR-2A) */}
          <div className="mb-6">
            <label
              className="mb-1 block text-sm font-medium text-foreground"
              htmlFor="fileBooks"
            >
              Purchase Books (GSTR-2A) &mdash; <span className="text-muted-foreground">.xlsx or .xls</span>
            </label>
            <input
              id="fileBooks"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFileBooks(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
            />
          </div>

          {/* GSTR-2B */}
          <div className="mb-6">
            <label
              className="mb-1 block text-sm font-medium text-foreground"
              htmlFor="fileGstr2b"
            >
              GSTR-2B &mdash; <span className="text-muted-foreground">.xlsx or .xls</span>
            </label>
            <input
              id="fileGstr2b"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFileGstr2b(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
            />
          </div>

          {/* Error banner */}
          {error !== null && (
            <div className="mb-4 rounded-lg border border-status-danger-text bg-status-danger-bg px-4 py-3 text-sm text-status-danger-text">
              {error}
            </div>
          )}

          {/* Upload progress log */}
          {uploadLog.length > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
              {uploadLog.map((msg, i) => (
                <p key={i} className="leading-relaxed">
                  {msg}
                </p>
              ))}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {loading ? 'Processing…' : 'Upload & Reconcile'}
          </button>
        </form>
      </div>
    </div>
  );
}
