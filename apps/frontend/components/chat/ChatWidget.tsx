'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';

interface ChatMessage {
  role: 'bot' | 'user';
  text: string;
}

export function ChatWidget(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: 'Hello! I can help with ITC claims, reconciliation, and GST compliance.' },
  ]);
  const [unread, setUnread] = useState(true);
  const [input, setInput] = useState('');

  function handleOpen(): void {
    setIsOpen(true);
    setUnread(false);
  }

  function handleSend(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className={`pointer-events-auto absolute right-6 w-[300px] overflow-hidden rounded-[12px] border border-[color:var(--border)] bg-[var(--bg-card)] transition-[opacity,transform] duration-200 ${
          isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
        style={{ bottom: 76, borderWidth: '0.5px' }}
      >
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-[14px] py-[10px]" style={{ borderBottomWidth: '0.5px' }}>
          <div>
            <p className="text-[12px] font-semibold">GST AI Assistant</p>
            <p className="text-[10px] text-[var(--text-muted)]">Powered by Gemini</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[var(--text-muted)]"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        <div className="flex max-h-[220px] min-h-[160px] flex-col gap-2 overflow-y-auto px-3 py-[10px]">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] px-[11px] py-2 text-[12px] ${
                  message.role === 'user'
                    ? 'rounded-[10px_10px_0_10px] bg-[#1e40af] text-white'
                    : 'rounded-[10px_10px_10px_0] border border-[color:var(--border)] bg-[var(--bg-page)]'
                }`}
                style={message.role === 'bot' ? { borderWidth: '0.5px' } : undefined}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[color:var(--border)] px-[10px] py-2" style={{ borderTopWidth: '0.5px' }}>
          <form className="flex gap-2" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-[color:var(--border)] px-[10px] py-1.5 text-[12px] outline-none focus:border-[#3b82f6]"
              style={{ borderWidth: '0.5px' }}
              placeholder="Type your message"
            />
            <button type="submit" className="rounded-md bg-[#1e40af] px-3 py-1.5 text-[12px] text-white">
              Send
            </button>
          </form>
        </div>
      </div>

      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className="pointer-events-auto fixed rounded-full border border-[#e2e8f0] bg-white text-[#1e40af] transition hover:bg-[#f8fafc]"
        style={{ right: 24, bottom: 24, width: 44, height: 44, borderWidth: '0.5px' }}
        aria-label="Toggle chat widget"
      >
        <MessageSquare size={20} color="#1e40af" />
        {!isOpen && unread ? (
          <span
            className="absolute rounded-full bg-[#dc2626]"
            style={{ top: -3, right: -3, width: 14, height: 14 }}
            aria-hidden="true"
          />
        ) : null}
      </button>
    </div>
  );
}
