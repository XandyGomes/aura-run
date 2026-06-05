'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import BottomNav from '@/components/BottomNav';
import { useSearchParams } from 'next/navigation';

interface Message { role: 'user' | 'aura'; content: string; ts: Date; }

const SUGGESTIONS = [
  'Como melhorar meu ritmo?',
  'Quanto devo treinar por semana?',
  'Dicas para evitar lesões',
  'Nutrição antes de correr',
];

function CoachContent() {
  const searchParams = useSearchParams();
  const initialTip = searchParams.get('tip');

  const [messages, setMessages] = useState<Message[]>([
    { role: 'aura', content: 'Olá! 👋 Sou a **Aura**, sua treinadora de esportes com IA.\n\nTenho acesso ao seu histórico completo no Strava e posso te ajudar com:\n• Treinos de corrida e ciclismo (pedais)\n• Análise de performance e evolução\n• Prevenção de lesões\n• Nutrição e recuperação\n\nO que você gostaria de saber?', ts: new Date() },
  ]);

  useEffect(() => {
    if (initialTip && messages.length === 1) {
      setMessages(prev => [...prev, { role: 'aura', content: `Aqui está o detalhe do seu treino sugerido:\n\n${initialTip}`, ts: new Date() }]);
    }
  }, [initialTip]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');
    const newMsg: Message = { role: 'user', content: msg, ts: new Date() };
    setMessages(prev => [...prev, newMsg]);
    setLoading(true);
    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, newMsg] }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'aura', content: data.reply || 'Desculpe, tente novamente.', ts: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'aura', content: 'Ops, problema de conexão. Tente novamente!', ts: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  // Render markdown-lite (bold, bullet)
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const boldLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return <p key={i} style={{ margin: '2px 0', lineHeight: '1.55', fontSize: '14px', color: 'inherit' }} dangerouslySetInnerHTML={{ __html: boldLine || '&nbsp;' }} />;
    });
  };

  const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: '500px', margin: '0 auto', background: 'linear-gradient(180deg, #080810 0%, #0a0a16 100%)' }}>

      {/* Header */}
      <div style={{
        padding: '52px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(8,8,16,0.9)',
        backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 48, height: 48, borderRadius: '16px', background: 'linear-gradient(135deg, #00C8E8, #0072FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 0 20px rgba(0,114,255,0.3)' }}>
              🤖
            </div>
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, background: '#00E5A0', border: '2px solid #080810', borderRadius: '50%' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800' }}>Aura AI Coach</h1>
            <p style={{ fontSize: '12px', color: '#00E5A0', fontWeight: '600' }}>● Online · Histórico Strava carregado</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '220px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '4px', animation: 'fadeUp 0.3s ease both' }}>
            {msg.role === 'aura' && (
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.3)', marginLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aura</span>
            )}
            <div style={{
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '20px 20px 6px 20px' : '6px 20px 20px 20px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #FF4D00, #FF7340)'
                : 'rgba(255,255,255,0.06)',
              border: msg.role === 'aura' ? '1px solid rgba(0,229,255,0.15)' : 'none',
              boxShadow: msg.role === 'user' ? '0 4px 16px rgba(255,77,0,0.25)' : 'none',
            }}>
              {renderContent(msg.content)}
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginLeft: msg.role === 'aura' ? '4px' : '0', marginRight: msg.role === 'user' ? '4px' : '0' }}>
              {fmtTime(msg.ts)}
            </span>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.3)', marginLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aura</span>
            <div style={{ padding: '14px 18px', borderRadius: '6px 20px 20px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', display: 'flex', gap: '5px', alignItems: 'center' }}>
              {[0, 1, 2].map(j => (
                <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: '#00E5FF', animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        position: 'fixed', bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)', maxWidth: '476px',
        background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '20px 20px 0 0',
        padding: '12px 12px 8px',
        zIndex: 50,
      }}>
        {/* Suggestion chips (only before first user message) */}
        {messages.length === 1 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', transition: 'background 0.2s' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Pergunte à Aura..."
            rows={1}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: '16px',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'white', fontSize: '15px', outline: 'none',
              fontFamily: 'inherit', resize: 'none', lineHeight: '1.4',
              maxHeight: '100px', overflowY: 'auto',
            }}
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{
            width: 46, height: 46, borderRadius: '14px', flexShrink: 0,
            background: input.trim() ? 'linear-gradient(135deg,#FF4D00,#FF7340)' : 'rgba(255,255,255,0.07)',
            border: 'none', color: 'white', fontSize: '18px', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s, transform 0.15s',
            boxShadow: input.trim() ? '0 4px 16px rgba(255,77,0,0.3)' : 'none',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default function CoachPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <CoachContent />
    </Suspense>
  );
}
