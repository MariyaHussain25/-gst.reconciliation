/**
 * @file apps/frontend/app/rules/page.tsx
 * @description GST Rules upload page — Phase 6 RAG Document Ingestion.
 * Allows administrators to upload text or PDF files containing GST rules.
 * The backend chunks the document and stores searchable rule records in
 * MongoDB so the chatbot can retrieve relevant rules.
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Upload, BookOpen } from 'lucide-react';
import { apiFetch, readApiErrorMessage, readApiJson } from '../../lib/api';

interface UploadResult {
  success: boolean;
  chunks_saved?: number;
  message?: string;
  error?: string;
}

/**
 * Rules Upload page.
 * Accepts a .txt or .pdf file along with an optional GST section label and
 * category, then POSTs to `/api/rules/upload` for rule ingestion.
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
      const res = await apiFetch('/api/rules/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, `Upload failed (HTTP ${res.status})`));
      }

      const data = await readApiJson<UploadResult>(res);

      if (data.success) {
        setResult(data);
        setFile(null);
        setSection('');
        // Reset file input visually
        const fileInput = document.getElementById('ruleFile') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
      } else {
        setError(data.error ?? 'Upload failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>GST Rules Knowledge Base</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
        Upload text or PDF files containing GST rules. The system chunks the document, stores searchable
        rule records in MongoDB, and uses them as retrieval context for chat and explanations.
      </p>

      <div style={{ maxWidth: 600 }}>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '24px' }}>

          {/* File drop zone */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 8 }}>GST Rules Document — .txt or .pdf</label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => document.getElementById('ruleFile')?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('ruleFile')?.click(); }}
              style={{
                border: `2px dashed ${file ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                background: file ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'border-color 0.2s, background 0.2s',
                outline: 'none',
              }}
            >
              <input id="ruleFile" type="file" accept=".txt,.pdf" style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <BookOpen size={26} color="#4ade80" style={{ marginBottom: 8 }} />
                  <p style={{ color: '#4ade80', fontSize: 13, fontWeight: 500 }}>{file.name}</p>
                  <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
                </>
              ) : (
                <>
                  <Upload size={22} color="#444" style={{ marginBottom: 10 }} />
                  <p style={{ color: '#888', fontSize: 13 }}>Click to select a .txt or .pdf file</p>
                  <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>Maximum 10 MB · Larger documents are chunked automatically</p>
                </>
              )}
            </div>
          </div>

          {/* Section label */}
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="section" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 7 }}>
              GST Section <span style={{ color: '#444' }}>(optional)</span>
            </label>
            <input
              id="section" type="text" value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. Section 16, Rule 36, Schedule II"
              style={{ ...inputSt, color: section ? '#e0e0e0' : undefined }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="category" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 7 }}>Category</label>
            <select
              id="category" value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ ...inputSt, cursor: 'pointer' }}
            >
              <option value="GENERAL">General</option>
              <option value="ITC_ELIGIBILITY">ITC Eligibility</option>
              <option value="BLOCKED_ITC">Blocked ITC</option>
              <option value="RCM">Reverse Charge Mechanism (RCM)</option>
              <option value="EXEMPT">Exempt Supplies</option>
              <option value="MATCHING">Invoice Matching</option>
            </select>
          </div>

          {/* Error */}
          {error !== null && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '11px 14px', color: '#f87171', fontSize: 13, marginBottom: 18 }}>
              {error}
            </div>
          )}

          {/* Success */}
          {result !== null && result.success && (
            <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 8, padding: '11px 14px', fontSize: 13, marginBottom: 18 }}>
              <p style={{ color: '#4ade80', fontWeight: 600, margin: '0 0 4px' }}>✓ Ingestion complete</p>
              <p style={{ color: '#86efac', margin: 0 }}>{result.message}</p>
              {result.chunks_saved !== undefined && (
                <p style={{ color: '#555', fontSize: 11, margin: '4px 0 0' }}>{result.chunks_saved} chunk(s) saved to MongoDB.</p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !file}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: 14, opacity: (loading || !file) ? 0.45 : 1, cursor: (loading || !file) ? 'not-allowed' : 'pointer', pointerEvents: (loading || !file) ? 'none' : 'auto' }}
          >
            {loading ? <><Loader2 size={15} className="animate-spin" /> Ingesting document…</> : <><Upload size={15} /> Upload &amp; Ingest Rules</>}
          </button>
        </form>

        {/* How it works */}
        <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '20px 22px', marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', marginBottom: 14 }}>How it works</p>
          <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10, margin: 0 }}>
            {[
              'Your document is uploaded securely to the backend.',
              'The text is extracted and split into overlapping ~500-character chunks.',
              'Each chunk is stored as a searchable GST rule record in MongoDB Atlas.',
              'Keyword matching retrieves the most relevant rule chunks for the current query.',
              'Those retrieved rules are passed into chat and explanation requests as context.',
            ].map((step, i) => (
              <li key={i} style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
