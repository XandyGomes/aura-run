'use client';

import { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

const distances = [
  { label: '5 km', value: '5km' },
  { label: '10 km', value: '10km' },
  { label: '15 km', value: '15km' },
  { label: '21 km (Meia Maratona)', value: '21km' },
  { label: '42 km (Maratona)', value: '42km' },
];

const levels = [
  { label: '🟢 Iniciante', value: 'Iniciante (menos de 6 meses correndo)' },
  { label: '🟡 Intermediário', value: 'Intermediário (1-3 anos de corrida)' },
  { label: '🔴 Avançado', value: 'Avançado (3+ anos, provas regulares)' },
];

export default function PlanPage() {
  const [distance, setDistance] = useState('10km');
  const [raceDate, setRaceDate] = useState('');
  const [goalTime, setGoalTime] = useState('');
  const [level, setLevel] = useState(levels[1].value);
  const [weeklyKm, setWeeklyKm] = useState('20');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState('');
  const [error, setError] = useState('');

  const generatePlan = async () => {
    if (!raceDate) { setError('Por favor, selecione a data da prova.'); return; }
    if (new Date(raceDate) <= new Date()) { setError('A data da prova deve ser no futuro.'); return; }
    setError('');
    setLoading(true);
    setPlan('');

    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distance, raceDate, goalTime, level, weeklyKm }),
      });
      const data = await res.json();
      setPlan(data.plan);
    } catch {
      setError('Erro ao gerar o plano. Tente novamente!');
    } finally {
      setLoading(false);
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '40px 20px 100px', maxWidth: '500px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <Link href="/" style={{ fontSize: '14px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
          ← Voltar
        </Link>
        <h1 style={{ fontSize: '28px', marginBottom: '4px' }}>🎯 Planilha de Prova</h1>
        <p style={{ fontSize: '14px' }}>A Aura AI vai criar um plano personalizado baseado no seu histórico no Strava.</p>
      </div>

      {!plan ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Distance */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Distância da Prova</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {distances.map(d => (
                <button key={d.value} onClick={() => setDistance(d.value)} style={{
                  padding: '12px', borderRadius: '14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  background: distance === d.value ? 'var(--primary)' : 'var(--surface)',
                  border: distance === d.value ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
                  color: 'white', transition: 'all 0.2s ease',
                  boxShadow: distance === d.value ? '0 4px 15px var(--primary-glow)' : 'none',
                }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Race Date */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Data da Prova</label>
            <input type="date" value={raceDate} min={minDateStr} onChange={e => setRaceDate(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'white', fontSize: '15px', colorScheme: 'dark' }}
            />
          </div>

          {/* Level */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Seu Nível</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {levels.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)} style={{
                  padding: '12px 16px', borderRadius: '14px', fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                  background: level === l.value ? 'rgba(252, 76, 2, 0.15)' : 'var(--surface)',
                  border: level === l.value ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
                  color: 'white', transition: 'all 0.2s ease',
                }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly KM */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Volume Semanal Atual: <strong style={{ color: 'white' }}>{weeklyKm} km</strong>
            </label>
            <input type="range" min="5" max="100" step="5" value={weeklyKm} onChange={e => setWeeklyKm(e.target.value)}
              style={{ width: '100%', accentColor: '#FC4C02' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>5 km</span><span>100 km</span>
            </div>
          </div>

          {/* Goal Time (Optional) */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Tempo Alvo (Opcional)</label>
            <input type="text" value={goalTime} onChange={e => setGoalTime(e.target.value)} placeholder="Ex: 50:00, 1h45, sub-2h..."
              style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'white', fontSize: '15px' }}
            />
          </div>

          {error && <p style={{ color: 'var(--error)', fontSize: '14px', textAlign: 'center' }}>{error}</p>}

          <button onClick={generatePlan} disabled={loading} className="btn-ai" style={{ width: '100%', opacity: loading ? 0.7 : 1, fontSize: '17px', padding: '16px' }}>
            {loading ? '✨ Gerando sua planilha...' : '✨ Gerar Planilha com IA'}
          </button>

          {loading && (
            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-dim)', animation: 'pulse 1.5s infinite' }}>
              A Aura está analisando suas corridas e montando seu plano personalizado...
            </p>
          )}
        </div>
      ) : (
        <div>
          <div className="glass-card" style={{ marginBottom: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: 'var(--secondary)', fontWeight: '700' }}>✨ Planilha {distance} gerada!</span>
            <button onClick={() => setPlan('')} style={{ background: 'none', border: '1px solid var(--surface-border)', color: 'var(--text-dim)', padding: '6px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' }}>
              Nova Planilha
            </button>
          </div>
          <div className="glass-card" style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7', color: 'var(--text)' }}>
            {plan}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
