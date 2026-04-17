/**
 * @file apps/frontend/app/chat/page.tsx
 * @description Chatbot / RAG interface — lets users ask free-text GST
 * questions that are answered by an OpenRouter-backed assistant augmented with ITC rules.
 * Uses Server-Sent Events for real-time token streaming with a typing effect.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { readApiErrorMessage } from '../../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage(): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your GST compliance assistant. Ask me anything about Input Tax Credit (ITC), GSTR-2A/2B reconciliation, or GST rules.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingText, scrollToBottom]);

  async function handleSend(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);
    setStreamingText('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok || !res.body) {
        const message = res.ok
          ? 'Sorry, I encountered an error. Please try again.'
          : await readApiErrorMessage(res, 'Sorry, I encountered an error. Please try again.');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: message },
        ]);
        setLoading(false);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload) as { token: string };
            accumulated += parsed.token;
            setStreamingText(accumulated);
          } catch {
            // skip malformed chunk
          }
        }
      }

      // Finalize: move accumulated text into messages
      const finalText = accumulated || 'No response received.';
      setMessages((prev) => [...prev, { role: 'assistant', content: finalText }]);
      setStreamingText('');
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Unable to connect to the server. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>GST Assistant</h1>
        <p style={{ color: '#555', fontSize: 13 }}>Ask anything about ITC eligibility, GSTR-2A/2B reconciliation, or GST rules.</p>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1, overflowY: 'auto', background: '#141414',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
          padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10 }}
          >
            {msg.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
                background: 'linear-gradient(135deg, #e53e3e, #c53030)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', userSelect: 'none',
              }}>G</div>
            )}
            <div
              style={{
                maxWidth: '72%',
                borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                padding: '10px 14px', fontSize: 13, lineHeight: 1.65,
                background: msg.role === 'user' ? 'rgba(229,62,62,0.14)' : '#1e1e1e',
                color: msg.role === 'user' ? '#f0f0f0' : '#ccc',
                border: msg.role === 'user' ? '1px solid rgba(229,62,62,0.2)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
              background: 'linear-gradient(135deg, #e53e3e, #c53030)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', userSelect: 'none',
            }}>G</div>
            <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px 16px 16px 16px', padding: '10px 14px', maxWidth: '72%', fontSize: 13, lineHeight: 1.65, color: '#ccc' }}>
              {streamingText ? (
                <span>
                  {streamingText}
                  <span style={{ display: 'inline-block', width: 2, height: 14, background: '#e53e3e', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink-cursor 0.8s steps(2) infinite' }} />
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={13} color="#555" className="animate-spin" />
                  <span style={{ color: '#555' }}>Thinking…</span>
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={(e) => void handleSend(e)} style={{ display: 'flex', gap: 10, marginTop: 12, flexShrink: 0 }}>
        <input
          type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a GST question…"
          disabled={loading}
          style={{
            flex: 1, background: '#141414', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '11px 16px', fontSize: 13, color: '#e0e0e0',
            outline: 'none', fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.5 : 1,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary"
          style={{ borderRadius: 12, padding: '11px 20px', flexShrink: 0, opacity: (loading || !input.trim()) ? 0.4 : 1, cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer', pointerEvents: (loading || !input.trim()) ? 'none' : 'auto' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
