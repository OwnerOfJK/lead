'use client';
import React from 'react'
import { UserContext } from '@/app/types';
import { useState, useRef, useEffect } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
    context: UserContext;
}

export default function ChatCard({ context, onClose }: Props & { onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, currentResponse]);

  async function handleChatSubmit() {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage(''); // Clear input immediately
    setIsLoading(true);
    setCurrentResponse('');

    // Add user message to chat history
    const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
    setChatHistory(prev => [...prev, newUserMessage]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context, message: userMessage, chatHistory }),
      });

      if (!res.ok) {
        throw new Error('Failed to get response');
      }

      // Read the stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let accumulatedResponse = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and append to response
        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;
        setCurrentResponse(accumulatedResponse);
      }

      // Add assistant's complete response to chat history
      const assistantMessage: ChatMessage = { role: 'assistant', content: accumulatedResponse };
      setChatHistory(prev => [...prev, assistantMessage]);
      setCurrentResponse('');
    } catch (error) {
      console.error('Error streaming response:', error);
      const errorMessage: ChatMessage = { role: 'assistant', content: 'Error: Failed to get response. Please try again.' };
      setChatHistory(prev => [...prev, errorMessage]);
      setCurrentResponse('');
    } finally {
      setIsLoading(false);
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleChatSubmit();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-[350px] h-[500px] bg-gray-400 rounded-xl shadow-xl border flex flex-col p-4 z-50">
      <div className='flex items-center justify-between mb-2'>
        <h3 className="font-semibold">💬 AI Assistant</h3>
        <button onClick={onClose}>
          ❌
        </button>
      </div>
      <div className="flex-1 overflow-auto text-sm mb-2 space-y-3 pb-2">
        {chatHistory.length === 0 && !isLoading && (
          <div className="text-gray-500 text-center mt-4">
            Ask me anything about this lead!
          </div>
        )}
        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 text-white'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap bg-gray-600 text-white">
              {currentResponse}
            </div>
          </div>
        )}
        {isLoading && !currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-lg bg-gray-600 text-white">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <input
        type="text"
        placeholder="Type your question..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={isLoading}
        className="px-2 py-1 border rounded w-full text-sm mb-2 disabled:bg-gray-200 disabled:cursor-not-allowed"
      />
      <button
        onClick={handleChatSubmit}
        disabled={isLoading || !message.trim()}
        className="bg-blue-600 text-white rounded px-3 py-1 text-sm z-60 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}