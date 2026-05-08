'use client';

import { useState, useRef, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';

interface Message {
  role: 'user' | 'aura';
  content: string;
}

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'aura', content: 'Olá! Sou a Aura, sua treinadora de corrida com IA. 👋\n\nPosso te ajudar com:\n• Estratégias de treino\n• Prevenção de lesões\n• Nutrição para corredores\n• Metas e planejamento\n\nO que você gostaria de saber hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'aura', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'aura', content: 'Ops, tive um problema de conexão. Tente novamente!' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '500px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '40px 20px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #00F2FF, #0072FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>✨</div>
          <div>
            <h1 style={{ fontSize: '20px' }}>Aura AI Coach</h1>
            <p style={{ fontSize: '12px', color: '#00E676' }}>● Online agora</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '160px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              background: msg.role === 'user' ? 'linear-gradient(135deg, #FC4C02, #FF9500)' : 'rgba(255,255,255,0.08)',
              border: msg.role === 'aura' ? '1px solid rgba(0, 242, 255, 0.3)' : 'none',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              color: 'white',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: '20px 20px 20px 4px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,242,255,0.3)', fontSize: '20px' }}>
              ⏳
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: '460px', display: 'flex', gap: '10px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Pergunte à Aura..."
          style={{
            flex: 1, padding: '14px 18px', borderRadius: '20px',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'white', fontSize: '15px', outline: 'none',
          }}
        />
        <button onClick={sendMessage} className="btn-primary" style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0, fontSize: '20px' }}>
          ➤
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
