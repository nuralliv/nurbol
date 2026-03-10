import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || 'sk-mock-key';

const SYSTEM_PROMPT = `You are MediSense AI, a compassionate and knowledgeable health triage assistant. Your role is to help users understand their symptoms and guide them on the urgency of seeking medical care.

RULES:
1. Never provide a definitive diagnosis. Always recommend consulting a healthcare professional.
2. Ask clarifying questions about symptoms when needed.
3. Provide general health education and first-aid suggestions where appropriate.
4. Always end your response with a triage urgency tag on its own line:
   - [GREEN] — Symptoms appear non-urgent. Self-care or routine appointment suggested.
   - [YELLOW] — Symptoms may need medical attention soon. Consider visiting a clinic.
   - [RED] — Symptoms may be serious or life-threatening. Seek emergency care immediately.
5. Be empathetic, clear, and concise.
6. Remind users that you are an AI and not a substitute for professional medical advice.`;

export default function Chat() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(
    localStorage.getItem('medisense_current_user') || 'null'
  );

  useEffect(() => {
    if (!currentUser) navigate('/login');
  }, [currentUser, navigate]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [urgency, setUrgency] = useState('green');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, loading]);

  /* Auto-resize textarea */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const extractUrgency = (text) => {
    if (text.includes('[RED]')) return 'red';
    if (text.includes('[YELLOW]')) return 'yellow';
    return 'green';
  };

  const cleanResponse = (text) =>
    text.replace(/\[(GREEN|YELLOW|RED)\]/g, '').trim();

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 600,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.error?.message || `API error ${res.status}`
        );
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || 'No response.';
      const level = extractUrgency(raw);
      setUrgency(level);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: cleanResponse(raw) },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Something went wrong: ${err.message}. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('medisense_current_user');
    navigate('/login');
  };

  if (!currentUser) return null;

  const urgencyLabels = {
    green: 'Non-Urgent',
    yellow: 'Moderate',
    red: 'Urgent',
  };

  return (
    <div className="chat-layout">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-logo">
            <svg viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
          <div className="chat-header-info">
            <h2>MediSense AI</h2>
            <span>Hi, {currentUser.name}</span>
          </div>
        </div>
        <div className="chat-header-right">
          <div className={`urgency-badge urgency-${urgency}`}>
            <span className="dot"></span>
            {urgencyLabels[urgency]}
          </div>
          <button className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {/* Disclaimer */}
        <div className="disclaimer">
          <div className="disclaimer-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            Medical Disclaimer
          </div>
          <p>
            MediSense AI is not a substitute for professional medical advice,
            diagnosis, or treatment. Always seek the advice of a qualified
            healthcare provider. If you are experiencing a medical emergency,
            call your local emergency number immediately.
          </p>
        </div>

        {messages.length === 0 && (
          <div className="welcome-msg">
            <h3>How can I help you today?</h3>
            <p>Describe your symptoms and I'll help you understand them.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'assistant' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              ) : (
                currentUser.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="message-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Describe your symptoms…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
