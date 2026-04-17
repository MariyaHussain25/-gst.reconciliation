'use client';

import { useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';

interface ChatMessage {
  id: number;
  role: 'bot' | 'user';
  text: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 0, role: 'bot', text: 'Hello! I can help with ITC claims, reconciliation, and GST compliance.' },
];

export function ChatWidget(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [unread, setUnread] = useState(true);
  const [input, setInput] = useState('');
  const nextMessageId = useRef(INITIAL_MESSAGES.length);

  function handleOpen(): void {
    setIsOpen(true);
    setUnread(false);
  }

  function handleSend(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const messageId = nextMessageId.current;
    nextMessageId.current += 1;
    const replyId = nextMessageId.current;
    nextMessageId.current += 1;
    setMessages((prev) => [
      ...prev,
      { id: messageId, role: 'user', text },
      { id: replyId, role: 'bot', text: 'Thanks — I can help break this down further if you share more details.' },
    ]);
    setInput('');
  }

  return (
    <>
      {/* Chat panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 82,
          right: 24,
          width: 300,
          background: 'var(--bg-card)',
          border: '0.5px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 50,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transform: isOpen ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.2s, transform 0.2s',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '0.5px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              GST AI Assistant
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Powered by OpenRouter
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
            style={{
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            overflowY: 'auto',
            maxHeight: 220,
            minHeight: 160,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '90%',
                  padding: '8px 11px',
                  fontSize: 12,
                  ...(message.role === 'user'
                    ? {
                        background: '#1e40af',
                        color: '#fff',
                        borderRadius: '10px 10px 0 10px',
                        alignSelf: 'flex-end',
                      }
                    : {
                        background: 'var(--bg-page)',
                        border: '0.5px solid var(--border)',
                        borderRadius: '10px 10px 10px 0',
                        color: 'var(--text-primary)',
                        alignSelf: 'flex-start',
                      }),
                }}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input row */}
        <div
          style={{
            padding: '8px 10px',
            borderTop: '0.5px solid var(--border)',
          }}
        >
          <form style={{ display: 'flex', gap: 8 }} onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message"
              aria-label="Type your message"
              style={{
                flex: 1,
                minWidth: 0,
                border: '0.5px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
                padding: '6px 10px',
                outline: 'none',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontFamily: "'DM Sans', sans-serif",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--blue-accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
            <button
              type="submit"
              style={{
                background: '#0a1628',
                color: '#fff',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1e293b'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0a1628'; }}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* FAB button */}
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }
          handleOpen();
        }}
        aria-label="Toggle chat widget"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#ffffff',
          border: '0.5px solid #e2e8f0',
          boxShadow: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#ffffff'; }}
      >
        <MessageSquare size={20} color="#1e40af" />
        {!isOpen && unread && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 14,
              height: 14,
              background: '#dc2626',
              borderRadius: '50%',
              border: '2px solid var(--bg-page)',
              fontSize: 9,
              color: '#fff',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        )}
      </button>
    </>
  );
}
