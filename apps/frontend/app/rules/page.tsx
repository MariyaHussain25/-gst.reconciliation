/**
 * @file apps/frontend/app/rules/page.tsx
 * @description GST Rules upload page — Phase 6 RAG Document Ingestion.
 * Allows administrators to upload text or PDF files containing GST rules.
 * The backend chunks the document, generates OpenAI embeddings, and stores
 * each chunk in MongoDB Atlas so the chatbot can retrieve relevant rules.
 */

'use client';

import React, { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface UploadResult {
  success: boolean;
  chunks_saved?: number;
  message?: string;
  error?: string;
}

/**
 * Rules Upload page.
 * Accepts a .txt or .pdf file along with an optional GST section label and
 * category, then POSTs to `/api/rules/upload` for vector ingestion.
 */
export default function RulesUploadPage(): React.ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [section, setSection] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    if (!file) {
      setError('Please select a .txt or .pdf file to upload.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (section.trim()) formData.append('section', section.trim());
      formData.append('category', category);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_BASE}/api/rules/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data: UploadResult = (await res.json()) as UploadResult;

      if (res.ok && data.success) {
        setResult(data);
        setFile(null);
        setSection('');
        // Reset file input visually
        const fileInput = document.getElementById('ruleFile') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
      } else {
        setError(data.error ?? `Upload failed (HTTP ${res.status})`);
      }
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-8">
      <h1 className="mb-2 text-3xl font-bold text-foreground">GST Rules Knowledge Base</h1>
      <p className="mb-8 text-muted-foreground">
        Upload text or PDF files containing GST rules. The system will chunk the document,
        generate vector embeddings, and store them in MongoDB so the AI chatbot can retrieve
        relevant rules when answering user questions.
      </p>

      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-xl border border-border bg-surface p-8 shadow-sm"
        >
          {/* File upload */}
          <div className="mb-6">
            <label
              className="mb-1 block text-sm font-medium text-foreground"
              htmlFor="ruleFile"
            >
              GST Rules Document &mdash;{' '}
              <span className="text-muted-foreground">.txt or .pdf</span>
            </label>
            <input
              id="ruleFile"
              type="file"
              accept=".txt,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Maximum file size: 10 MB. Larger documents will be chunked automatically.
            </p>
          </div>

          {/* GST Section label */}
          <div className="mb-6">
            <label
              className="mb-1 block text-sm font-medium text-foreground"
              htmlFor="section"
            >
              GST Section <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="section"
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. Section 16, Rule 36, Schedule II"
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Category selector */}
          <div className="mb-6">
            <label
              className="mb-1 block text-sm font-medium text-foreground"
              htmlFor="category"
            >
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="GENERAL">General</option>
              <option value="ITC_ELIGIBILITY">ITC Eligibility</option>
              <option value="BLOCKED_ITC">Blocked ITC</option>
              <option value="RCM">Reverse Charge Mechanism (RCM)</option>
              <option value="EXEMPT">Exempt Supplies</option>
              <option value="MATCHING">Invoice Matching</option>
            </select>
          </div>

          {/* Error banner */}
          {error !== null && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Success banner */}
          {result !== null && result.success && (
            <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">✓ Ingestion complete</p>
              <p className="mt-1">{result.message}</p>
              {result.chunks_saved !== undefined && (
                <p className="mt-1 text-xs text-green-600">
                  {result.chunks_saved} chunk(s) saved to MongoDB.
                </p>
              )}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !file}
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
            {loading ? 'Ingesting document…' : 'Upload & Ingest Rules'}
          </button>
        </form>

        {/* How it works */}
        <div className="mt-8 rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          <h2 className="mb-3 text-base font-semibold text-foreground">How it works</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Your document is uploaded securely to the backend.</li>
            <li>
              The text is extracted (PDF pages are merged) and split into overlapping
              chunks of ~500 characters to preserve context.
            </li>
            <li>
              Each chunk is converted into a 1,536-dimensional vector using{' '}
              <span className="font-medium text-foreground">OpenAI text-embedding-3-small</span>.
            </li>
            <li>
              All chunks are stored in{' '}
              <span className="font-medium text-foreground">MongoDB Atlas</span> ready for
              semantic retrieval.
            </li>
            <li>
              When a user asks a question in the{' '}
              <a href="/chat" className="text-primary underline hover:opacity-80">
                Chat
              </a>{' '}
              tab, the system retrieves the most relevant chunks and passes them to the AI
              as context.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
