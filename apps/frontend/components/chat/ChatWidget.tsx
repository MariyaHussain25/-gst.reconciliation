'use client';

import { useRef, useState } from 'react';
import { MessageCircle, Minimize2, Send, X } from 'lucide-react';
import { parseJwtUserId } from '../../lib/auth';
import { apiFetchWithAuth } from '../../lib/api';

interface ChatMessage {
  id: number;
  role: 'bot' | 'user';
  text: string;
}

const SUGGESTED_QUESTIONS = [
  'How do I reconcile GSTR-2A with GSTR-2B?',
  'Why is there a difference in my report?',
  'How to upload GSTR files?',
  'What are common reconciliation errors?',
];

export function ChatWidget(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'bot', text: 'Hi! Ask me anything about GST reconciliation.' },
  ]);
  const nextIdRef = useRef(2);

  async function sendMessage(text: string): Promise<void> {
    const token = localStorage.getItem('token') ?? '';
    const userId = parseJwtUserId(token);
    if (!text.trim() || !userId) return;

    const userMessage: ChatMessage = { id: nextIdRef.current, role: 'user', text };
    nextIdRef.current += 1;
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiFetchWithAuth('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, user_id: userId, query: text }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(payload.detail ?? 'Unable to get response from assistant.');
      }

      const payload = (await response.json()) as { reply?: string };
      setMessages((prev) => [
        ...prev,
        { id: nextIdRef.current, role: 'bot', text: payload.reply ?? 'I could not generate a response.' },
      ]);
      nextIdRef.current += 1;
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextIdRef.current,
          role: 'bot',
          text: error instanceof Error ? error.message : 'Unable to get response from assistant.',
        },
      ]);
      nextIdRef.current += 1;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="flex w-[340px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">GST Assistant</p>
              <span className="rounded-full bg-[#2563eb]/10 px-2 py-0.5 text-xs font-semibold text-[#2563eb]">Beta</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Minimize chat">
                <Minimize2 size={14} />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close chat">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-[280px] space-y-3 overflow-y-auto bg-[#f8fafc] p-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'rounded-br-none bg-[#2563eb] text-white'
                      : 'rounded-bl-none border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {loading && <p className="text-xs text-slate-500">Assistant is typing...</p>}
          </div>

          <div className="border-t border-slate-200 p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void sendMessage(question)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {question}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(input);
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your question..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb]"
              />
              <button type="submit" className="rounded-lg bg-[#2563eb] p-2 text-white hover:bg-[#1e40af]" aria-label="Send message">
                <Send size={14} />
              </button>
            </form>

            <p className="mt-2 text-center text-xs text-slate-500">Powered by AI</p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-lg hover:bg-[#1e40af]"
          aria-label="Open chat assistant"
        >
          <MessageCircle size={22} />
        </button>
      )}
    </div>
  );
}
