'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────
interface Activity {
  id: number | string; name: string; type: string; sport_type: string;
  distance: number; moving_time: number; elapsed_time: number;
  total_elevation_gain: number; start_date: string;
  average_heartrate?: number; max_heartrate?: number;
  average_speed: number; max_speed: number; suffer_score?: number;
  map?: { summary_polyline?: string };
  is_local?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────
const pace = (dist: number, time: number) => {
  if (!dist || !time) return '--:--';
  const s = time / (dist / 1000);
  return `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`;
};
const fmtTime = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
};
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const actColor: Record<string, string> = {
  Run: '#FF4D00', Walk: '#00E5FF', Ride: '#00E5A0', Swim: '#4A90E2',
  Hike: '#A78BFA', Workout: '#FFB020', Treadmill: '#FF6B9D',
};
const actIcon: Record<string, string> = {
  Run: '🏃', Walk: '🚶', Ride: '🚴', Swim: '🏊', Hike: '🥾', Workout: '💪', Treadmill: '🏃',
};

// ── Animated Number ────────────────────────────────────────────────
function AnimatedNum({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    const dur = 900;
    const startT = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startT) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const cur = start + diff * ease;
      setDisplay(cur);
      ref.current = cur;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

// ── Sparkline SVG ──────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.001);
  const w = 80; const h = 32;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.85 - 2}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

// ── Bar Chart ──────────────────────────────────────────────────────
function BarChart({ data, selectedIdx, onSelect }: {
  data: { label: string; value: number; count: number }[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  const max = Math.max(...data.map(d => d.value), 0.001);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', paddingTop: '8px' }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const active = i === selectedIdx;
        return (
          <div key={i} onClick={() => onSelect(i)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: active ? '#FF4D00' : 'transparent', transition: 'color 0.2s' }}>
              {d.value.toFixed(1)}
            </span>
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '8px 8px 0 0', height: '80px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
              <div style={{
                width: '100%',
                height: `${Math.max(pct, 3)}%`,
                background: active
                  ? 'linear-gradient(to top, #FF4D00, #FF7340)'
                  : 'linear-gradient(to top, rgba(255,77,0,0.4), rgba(255,115,64,0.4))',
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.6s cubic-bezier(0.2,0.8,0.2,1), background 0.2s',
              }} />
            </div>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontWeight: '500' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity Modal ─────────────────────────────────────────────────
function ActivityModal({ act, onClose, onDeleteSuccess }: { act: Activity; onClose: () => void; onDeleteSuccess: (id: string | number) => void }) {
  const color = actColor[act.type] || '#888';
  const icon = actIcon[act.type] || '🏅';
  const distKm = act.distance / 1000;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleDelete = async () => {
    if (!confirm('Deseja realmente excluir este treino permanentemente?')) return;
    try {
      const rawId = typeof act.id === 'string' && act.id.startsWith('local_')
        ? act.id.replace('local_', '')
        : act.id;
      
      const { error } = await supabase
        .from('recorded_workouts')
        .delete()
        .eq('id', rawId);

      if (error) throw error;
      alert('Treino excluído com sucesso!');
      onDeleteSuccess(act.id);
    } catch (err: any) {
      console.error('Erro ao excluir treino:', err);
      alert('Erro ao excluir treino: ' + err.message);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', padding: '0',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '500px', margin: '0 auto',
        background: 'linear-gradient(180deg, #13131F 0%, #0C0C18 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: 'none',
        borderRadius: '28px 28px 0 0',
        padding: '0 0 40px',
        animation: 'slideUp 0.35s cubic-bezier(0.2,0.8,0.2,1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '8px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '2px' }}>{act.name}</h2>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{fmtDate(act.start_date)} · {act.type}</p>
            </div>
          </div>
        </div>

        {/* Main stat */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 24px 16px', gap: '32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', fontWeight: '900', color, lineHeight: 1 }}>{distKm.toFixed(2)}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600' }}>km</div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '0 20px 20px' }}>
          {[
            { label: 'Tempo', value: fmtTime(act.moving_time) },
            { label: 'Pace', value: `${pace(act.distance, act.moving_time)}/km` },
            { label: 'Elevação', value: `${Math.round(act.total_elevation_gain)}m` },
            act.average_heartrate ? { label: 'FC Média', value: `${Math.round(act.average_heartrate)} bpm` } : null,
            act.max_heartrate ? { label: 'FC Máx', value: `${Math.round(act.max_heartrate)} bpm` } : null,
            act.suffer_score ? { label: 'Sofrimento', value: `${act.suffer_score}` } : null,
          ].filter(Boolean).map((s: any) => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '600' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {act.is_local && (
            <button onClick={handleDelete} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.3)', color: '#ff6b6b', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              🗑️ Excluir Treino
            </button>
          )}
          <button onClick={onClose} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
function StatsContent() {
  const searchParams = useSearchParams();
  const activityId = searchParams.get('id');

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [barIdx, setBarIdx] = useState(-1);
  const [activeFilter, setActiveFilter] = useState<string>('Todos');

  const handleDeleteSuccess = (id: string | number) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    setSelected(null);
  };

  useEffect(() => {
    fetch('/api/stats/activities')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActivities(data);
          // Check for activityId in URL and select it
          if (activityId) {
            const found = data.find((a: Activity) => a.id.toString() === activityId);
            if (found) setSelected(found);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activityId]);

  const types = ['Todos', ...Array.from(new Set(activities.map(a => a.type)))];
  const filtered = activeFilter === 'Todos' ? activities : activities.filter(a => a.type === activeFilter);
  const runs = activities.filter(a => a.type === 'Run');

  // Weekly bar chart data (last 8 weeks)
  const weeklyData = (() => {
    const weeks: Record<string, { value: number; count: number }> = {};
    activities.forEach(a => {
      const d = new Date(a.start_date);
      const monday = new Date(d); monday.setDate(d.getDate() - d.getDay() + 1);
      const key = monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!weeks[key]) weeks[key] = { value: 0, count: 0 };
      weeks[key].value += a.distance / 1000;
      weeks[key].count++;
    });
    return Object.entries(weeks).slice(-8).map(([label, v]) => ({ label, ...v }));
  })();

  // Summary stats
  const totalKm = filtered.reduce((s, a) => s + a.distance, 0) / 1000;
  const totalTime = filtered.reduce((s, a) => s + a.moving_time, 0);
  const avgPaceRuns = runs.length > 0 ? runs.reduce((s, a) => s + (a.moving_time / (a.distance / 1000)), 0) / runs.length : 0;
  const longestRun = runs.length > 0 ? Math.max(...runs.map(a => a.distance)) / 1000 : 0;

  // Sparkline data (last 7 activities distances)
  const spark7 = activities.slice(0, 7).map(a => a.distance / 1000).reverse();

  const selectedWeek = barIdx >= 0 && weeklyData[barIdx];

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '40px 20px 120px' }}>
      <div style={{ height: 28, width: 140, marginBottom: 8 }} className="skeleton" />
      <div style={{ height: 16, width: 100, marginBottom: 32 }} className="skeleton" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <div key={i} style={{ height: 90 }} className="skeleton" />)}
      </div>
      <div style={{ height: 180 }} className="skeleton" />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '48px 16px 120px', maxWidth: '500px', margin: '0 auto' }}>

      {/* Header */}
      <div className="animate-fade-in" style={{ marginBottom: '28px' }}>
        <p className="label" style={{ marginBottom: '6px' }}>Seu progresso</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>Estatísticas</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,77,0,0.1)', border: '1px solid rgba(255,77,0,0.25)', padding: '5px 12px', borderRadius: '100px' }}>
            <Sparkline data={spark7} color="#FF4D00" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px', animationDelay: '0.1s' }}>
        {[
          { label: 'Distância Total', value: <><AnimatedNum value={totalKm} decimals={1} /> km</>, sub: `${filtered.length} atividades` },
          { label: 'Tempo Total', value: fmtTime(totalTime), sub: 'tempo em movimento' },
          { label: 'Ritmo Médio', value: `${pace(1000, avgPaceRuns)}/km`, sub: `${runs.length} corridas` },
          { label: 'Corrida Mais Longa', value: <><AnimatedNum value={longestRun} decimals={2} /> km</>, sub: 'recorde pessoal' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>{s.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#FF4D00', marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <div className="card animate-fade-in" style={{ marginBottom: '24px', animationDelay: '0.25s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <h3 style={{ marginBottom: '2px' }}>Distância Semanal</h3>
            <p style={{ fontSize: '12px' }}>Toque em uma barra para detalhes</p>
          </div>
          {selectedWeek && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#FF4D00' }}>{selectedWeek.value.toFixed(1)} km</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{selectedWeek.count} atividades</div>
            </div>
          )}
        </div>
        {weeklyData.length === 0
          ? <p style={{ textAlign: 'center', padding: '20px 0' }}>Nenhuma atividade encontrada</p>
          : <BarChart data={weeklyData} selectedIdx={barIdx} onSelect={i => setBarIdx(i === barIdx ? -1 : i)} />
        }
      </div>

      {/* Activity filter */}
      <div className="animate-fade-in" style={{ marginBottom: '16px', animationDelay: '0.3s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '18px' }}>Atividades</h2>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{filtered.length} registros</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {types.map(t => (
            <button key={t} onClick={() => setActiveFilter(t)} style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer',
              background: activeFilter === t ? 'linear-gradient(135deg,#FF4D00,#FF7340)' : 'rgba(255,255,255,0.06)',
              border: activeFilter === t ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: activeFilter === t ? 'white' : 'rgba(255,255,255,0.5)',
              boxShadow: activeFilter === t ? '0 4px 16px rgba(255,77,0,0.3)' : 'none',
              transition: 'all 0.2s',
            }}>{actIcon[t] || '🏅'} {t}</button>
          ))}
        </div>
      </div>

      {/* Activities list */}
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px', animationDelay: '0.35s' }}>
        {filtered.map((act, idx) => {
          const color = actColor[act.type] || '#888';
          const icon = actIcon[act.type] || '🏅';
          const distKm = act.distance / 1000;
          return (
            <div key={act.id} onClick={() => setSelected(act)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '20px', padding: '16px',
                cursor: 'pointer',
                transition: 'background 0.2s, transform 0.15s',
                animationDelay: `${0.35 + idx * 0.03}s`,
              }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.985)')}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: `${color}18`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.name}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{fmtDate(act.start_date)} · {fmtTime(act.moving_time)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: '800', fontSize: '17px', color }}>{distKm.toFixed(2)}<span style={{ fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.4)', marginLeft: '2px' }}>km</span></div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{pace(act.distance, act.moving_time)}/km</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>

              {act.average_heartrate && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '16px' }}>
                  <span style={{ fontSize: '11px', color: '#FF6B8A' }}>❤️ {Math.round(act.average_heartrate)} bpm</span>
                  {act.total_elevation_gain > 0 && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>⛰️ +{Math.round(act.total_elevation_gain)}m</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && <ActivityModal act={selected} onClose={() => setSelected(null)} onDeleteSuccess={handleDeleteSuccess} />}
      <BottomNav />

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '40px 20px 120px' }}>
        <div style={{ height: 28, width: 140, marginBottom: 8 }} className="skeleton" />
        <div style={{ height: 16, width: 100, marginBottom: 32 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ height: 90 }} className="skeleton" />)}
        </div>
        <div style={{ height: 180 }} className="skeleton" />
      </div>
    }>
      <StatsContent />
    </Suspense>
  );
}
