/**
 * @file apps/frontend/app/upload/page.tsx
 * @description Document upload page â€” drag-and-drop zones, step progress, toast feedback.
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, CheckCircle, Loader2 } from 'lucide-react';
import { parseJwtUserId } from '../../lib/auth';
import { apiFetch, readApiErrorMessage, readApiJson } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type StepStatus = 'idle' | 'active' | 'done' | 'error';

interface Step {
  label: string;
  status: StepStatus;
}

const INITIAL_STEPS: Step[] = [
  { label: 'Upload GSTR-2A (Purchase Books)', status: 'idle' },
  { label: 'Upload GSTR-2B Return',           status: 'idle' },
  { label: 'Run Reconciliation Pipeline',     status: 'idle' },
];

// â”€â”€ DropZone component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DropZone({
  label,
  hint,
  file,
  onFile,
  disabled,
}: {
  label: string;
  hint: string;
  file: File | null;
  onFile: (f: File) => void;
  disabled: boolean;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [disabled, onFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const borderColor = dragging
    ? '#3b82f6'
    : file
      ? 'rgba(34,197,94,0.5)'
      : 'rgba(255,255,255,0.1)';

  const bgColor = dragging
    ? 'rgba(59,130,246,0.07)'
    : file
      ? 'rgba(34,197,94,0.05)'
      : 'rgba(255,255,255,0.02)';

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Upload zone for ${label}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 14,
        padding: '36px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.2s ease, background 0.2s ease, transform 0.15s ease',
        background: bgColor,
        opacity: disabled ? 0.55 : 1,
        minHeight: 190,
        textAlign: 'center',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          // Reset input so same file can be re-selected
          e.target.value = '';
        }}
      />

      {file ? (
        <>
          <FileSpreadsheet size={32} color="#4ade80" />
          <div>
            <p style={{ color: '#4ade80', fontSize: 13, fontWeight: 500 }}>{file.name}</p>
            <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} KB &bull; Click to replace
            </p>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            <Upload size={22} color="#556" />
          </div>
          <div>
            <p style={{ color: '#ccc', fontSize: 13, fontWeight: 500 }}>{label}</p>
            <p style={{ color: '#555', fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{hint}</p>
          </div>
        </>
      )}
    </div>
  );
}

// â”€â”€ Step list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepList({ steps }: { steps: Step[] }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const circleColor =
          step.status === 'done' ? '#22c55e'
          : step.status === 'active' ? '#3b82f6'
          : step.status === 'error' ? '#e53e3e'
          : 'rgba(255,255,255,0.08)';

        const labelColor =
          step.status === 'done' ? '#4ade80'
          : step.status === 'active' ? '#60a5fa'
          : step.status === 'error' ? '#f87171'
          : '#555';

        return (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {/* Circle + vertical line */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 24,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: circleColor,
                  border: `2px solid ${step.status === 'idle' ? 'rgba(255,255,255,0.12)' : circleColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.3s ease, border-color 0.3s ease',
                }}
              >
                {step.status === 'done' && <CheckCircle size={13} color="#fff" />}
                {step.status === 'active' && (
                  <Loader2 size={13} color="#fff" className="animate-spin" />
                )}
                {step.status === 'error' && (
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>!</span>
                )}
                {step.status === 'idle' && (
                  <span style={{ fontSize: 10, color: '#555', fontWeight: 600 }}>{i + 1}</span>
                )}
              </div>
              {!isLast && (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 20,
                    marginTop: 3,
                    background: step.status === 'done' ? '#22c55e' : 'rgba(255,255,255,0.07)',
                    transition: 'background 0.4s ease',
                  }}
                />
              )}
            </div>

            {/* Label */}
            <div style={{ paddingTop: 2, paddingBottom: isLast ? 0 : 22 }}>
              <p
                style={{
                  fontSize: 13,
                  color: labelColor,
                  fontWeight: step.status !== 'idle' ? 500 : 400,
                  transition: 'color 0.3s ease',
                }}
              >
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UploadPage(): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      void router.push('/login');
    }
  }, [router]);

  const [fileBooks, setFileBooks] = useState<File | null>(null);
  const [fileGstr2b, setFileGstr2b] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);

  function setStepStatus(index: number, status: StepStatus): void {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, status } : s)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    const token = localStorage.getItem('token') ?? '';
    const userId = parseJwtUserId(token)?.trim();

    if (!token || !userId) {
      toast('error', 'Unable to identify your account. Please log in again.');
      return;
    }
    if (!fileBooks) {
      toast('error', 'Please select your Purchase Books (GSTR-2A) file.');
      return;
    }
    if (!fileGstr2b) {
      toast('error', 'Please select your GSTR-2B file.');
      return;
    }

    setLoading(true);
    setSteps(INITIAL_STEPS);

    try {
      // ── Step 1: Upload GSTR-2A ────────────────────────────────────────────
      setStepStatus(0, 'active');
      const form1 = new FormData();
      form1.append('file', fileBooks);
      form1.append('user_id', userId);

      const res1 = await apiFetch('/api/upload-docs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form1,
      });
      if (!res1.ok) {
        throw new Error(await readApiErrorMessage(res1, `Upload failed (HTTP ${res1.status})`));
      }
      const data1 = await readApiJson<{ records_parsed?: number }>(res1);
      setStepStatus(0, 'done');
      toast('success', `GSTR-2A uploaded — ${data1.records_parsed ?? 0} records parsed.`);

      // ── Step 2: Upload GSTR-2B ────────────────────────────────────────────
      setStepStatus(1, 'active');
      const form2 = new FormData();
      form2.append('file', fileGstr2b);
      form2.append('user_id', userId);

      const res2 = await apiFetch('/api/upload-docs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form2,
      });
      if (!res2.ok) {
        throw new Error(await readApiErrorMessage(res2, `Upload failed (HTTP ${res2.status})`));
      }
      const data2 = await readApiJson<{ records_parsed?: number }>(res2);
      setStepStatus(1, 'done');
      toast('success', `GSTR-2B uploaded — ${data2.records_parsed ?? 0} records parsed.`);

      // ── Step 3: Run reconciliation ────────────────────────────────────────
      setStepStatus(2, 'active');
      const res3 = await apiFetch(`/api/process/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res3.ok) {
        throw new Error(await readApiErrorMessage(res3, `Reconciliation failed (HTTP ${res3.status})`));
      }
      setStepStatus(2, 'done');
      toast('success', 'Reconciliation complete! Redirecting to results…');
      void router.push('/results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast('error', msg);
      setSteps((prev) =>
        prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)),
      );
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && fileBooks !== null && fileGstr2b !== null;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
        Upload Documents
      </h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
        Drag &amp; drop or click to select your GSTR-2A and GSTR-2B returns, then hit
        &ldquo;Upload &amp; Reconcile&rdquo; to run the reconciliation workflow.
      </p>

      <div style={{ maxWidth: 760 }}>
        <form onSubmit={(e) => void handleSubmit(e)}>
          {/* ── Drop zones ── */}
          <div className="upload-grid" style={{ marginBottom: 24 }}>
            <DropZone
              label="Purchase Books (GSTR-2A)"
              hint="Drag & drop here · .xlsx or .xls"
              file={fileBooks}
              onFile={setFileBooks}
              disabled={loading}
            />
            <DropZone
              label="GSTR-2B Return"
              hint="Drag & drop here · .xlsx or .xls"
              file={fileGstr2b}
              onFile={setFileGstr2b}
              disabled={loading}
            />
          </div>

          {/* ── Step progress (shown once processing starts) ── */}
          {steps.some((s) => s.status !== 'idle') && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: '20px 22px',
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  marginBottom: 16,
                }}
              >
                Progress
              </p>
              <StepList steps={steps} />
            </div>
          )}

          {/* ── Submit button ── */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '13px 20px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 10,
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              pointerEvents: canSubmit ? 'auto' : 'none',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing&hellip;
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload &amp; Reconcile
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

