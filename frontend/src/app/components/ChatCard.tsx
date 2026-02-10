'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ChatCardProps {
  onClose: () => void;
  contactId: string;
}

export default function ChatCard({ onClose, contactId }: ChatCardProps) {
  const { token } = useAuth();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `${API_URL}/chat`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: { contactId },
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage({ text });
  }

  function getMessageText(msg: (typeof messages)[number]): string {
    return msg.parts
      .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }

  return (
    <div className="fixed bottom-4 right-4 w-[380px] h-[500px] bg-[var(--background)] border rounded-xl shadow-xl flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">AI Assistant</h3>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-red-500"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-auto text-sm px-4 py-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="text-gray-500 text-center mt-8">
            Ask me anything about this contact.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'border text-[var(--foreground)]'
              }`}
            >
              {getMessageText(msg)}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-lg border text-gray-500">
              Thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-lg bg-red-600 text-white">
              Error: {error.message}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 px-4 py-3 border-t">
        <input
          type="text"
          placeholder="Type your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="px-3 py-1.5 border rounded flex-1 text-sm bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
