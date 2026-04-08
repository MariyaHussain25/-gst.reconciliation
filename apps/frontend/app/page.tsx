/**
 * @file apps/frontend/app/page.tsx
 * @description Main GST Reconciliation Dashboard.
 * Displays company info, returns filing calendar, profile card, and AI chatbot.
 *
 * Phase 1: Static landing page.
 * Phase 8: GST portal-style dashboard with returns calendar and sidebar links.
 * Phase 11: Replaced Quick Links sidebar with Profile Card and AI Chatbot card.
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FilingStatusBadge, type FilingStatus } from '../components/ui/StatusBadge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const COMPANY = 'ABC Industries Private Limited';
const GSTIN = '29AABCI1234G1Z5';
const FINANCIAL_YEAR = '2024-25';

const PERIODS = ['Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25'] as const;

interface ReturnRow {
  type: string;
  description: string;
  statuses: FilingStatus[];
}

const RETURN_ROWS: ReturnRow[] = [
  {
    type: 'GSTR-1',
    description: 'Details of outward supplies',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'To be Filed'],
  },
  {
    type: 'GSTR-2A',
    description: 'Auto drafted – view only',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'To be Filed'],
  },
  {
    type: 'GSTR-2B',
    description: 'Auto-drafted ITC statement',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'Not Filed'],
  },
  {
    type: 'GSTR-3B',
    description: 'Monthly summary return',
    statuses: ['Filed', 'Filed', 'Filed', 'To be Filed', 'Not Filed'],
  },
];

const CHATBOT_SUGGESTIONS = [
  'What is my ITC mismatch?',
  'Show filing status summary',
  'How to reconcile GSTR-2A?',
];

interface ChatMessage {
  id: number;
  role: 'bot' | 'user';
  text: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 0,
    role: 'bot',
    text: '👋 Hi! I\'m your GST AI Assistant. Ask me anything about your returns, ITC, or reconciliation!',
  },
];

/**
 * Main dashboard page displayed at the root URL (/).
 * Shows a GST portal-style returns calendar, profile card, and AI chatbot.
 */
export default function DashboardPage(): React.ReactElement {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  async function sendMessage(text?: string): Promise<void> {
    const msg = text ?? input;
    if (!msg.trim() || chatLoading) return;

    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: prev.length, role: 'user' as const, text: msg },
    ]);
    setChatLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: msg }),
      });

      if (res.ok) {
        const data: { reply: string } = await res.json();
        setMessages((prev) => [
          ...prev,
          { id: prev.length, role: 'bot' as const, text: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: prev.length, role: 'bot' as const, text: 'Sorry, I encountered an error. Please try again.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: prev.length, role: 'bot' as const, text: 'Unable to connect to the server. Please try again.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div>
      {/* Company / GSTIN header strip */}
      <div className="mb-6 rounded-xl border border-border bg-surface px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{COMPANY}</h1>
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">GSTIN: {GSTIN}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            Financial Year:{' '}
            <span className="font-semibold text-foreground">{FINANCIAL_YEAR}</span>
          </div>
        </div>
      </div>

      {/* Main content + right sidebar */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Returns Calendar table */}
        <div className="min-w-0 flex-1">
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                Returns Calendar — FY {FINANCIAL_YEAR}
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Return Type
                    </th>
                    {PERIODS.map((p) => (
                      <th
                        key={p}
                        className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {RETURN_ROWS.map((row) => (
                    <tr key={row.type} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">{row.type}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{row.description}</span>
                      </td>
                      {row.statuses.map((status, idx) => (
                        <td key={idx} className="px-4 py-3 text-center">
                          <FilingStatusBadge status={status} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/file-returns"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              File Returns
            </Link>
            <Link
              href="/gstr2a"
              className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              View GSTR-2A
            </Link>
            <Link
              href="/itc-summary"
              className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              ITC Summary
            </Link>
            <Link
              href="/upload"
              className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Upload Files
            </Link>
          </div>
        </div>

        {/* Right sidebar – Profile Card + Chatbot */}
        <aside className="flex w-full flex-col gap-5 lg:w-64 lg:flex-shrink-0">

          {/* ── Profile Card ── */}
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold text-foreground">Profile</h2>
            </div>
            <div className="flex flex-col items-center gap-3 px-5 py-5">
              {/* Avatar placeholder */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow">
                A
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">ABC Industries</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{GSTIN}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Regular Taxpayer</p>
              </div>
              <button
                type="button"
                className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* ── GST AI Chatbot Card ── */}
          <div className="flex flex-col rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <h2 className="text-base font-semibold text-foreground">GST AI Assistant</h2>
              </div>
            </div>

            {/* Message list */}
            <div className="flex max-h-52 flex-col gap-2 overflow-y-auto px-4 py-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <span
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2">
              {CHATBOT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendMessage(s)}
                  className="rounded-full border border-border bg-transparent px-2 py-0.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div className="border-t border-border px-3 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  aria-label="Chat with GST AI Assistant"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !input.trim()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {chatLoading ? '…' : 'Send'}
                </button>
              </form>
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}
