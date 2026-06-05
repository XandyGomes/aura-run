'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
  city: string;
  goalTime: string;
  notes: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  kitDate?: string;
}

const DISTANCES = ['5km', '10km', '15km', '21km (Meia)', '42km (Maratona)', 'Trail', 'Outro'];
const STORAGE_KEY = 'aura_races_v1';

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const race = new Date(dateStr + 'T00:00:00');
  return Math.ceil((race.getTime() - today.getTime()) / 86400000);
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'long', year: 'numeric',
  });
}

function CountdownBadge({ days }: { days: number }) {
  if (days < 0) return <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: '100px' }}>Finalizada</span>;
  if (days === 0) return <span style={{ fontSize: '11px', fontWeight: '700', color: '#FF4D00', background: 'rgba(255,77,0,0.15)', border: '1px solid rgba(255,77,0,0.3)', padding: '3px 10px', borderRadius: '100px' }}>🔥 Hoje!</span>;
  if (days <= 7) return <span style={{ fontSize: '11px', fontWeight: '700', color: '#FFB020', background: 'rgba(255,176,32,0.12)', border: '1px solid rgba(255,176,32,0.3)', padding: '3px 10px', borderRadius: '100px' }}>⚡ {days}d</span>;
  if (days <= 30) return <span style={{ fontSize: '11px', fontWeight: '700', color: '#00E5A0', background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.25)', padding: '3px 10px', borderRadius: '100px' }}>{days} dias</span>;
  return <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '100px' }}>{days} dias</span>;
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', date: '', distance: '10km', city: '', goalTime: '', notes: '', kitDate: '', customDistance: '' });
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [isCustom, setIsCustom] = useState(false);

  const [notificationSupport, setNotificationSupport] = useState(false);
  const [permission, setPermission] = useState<string>('default');
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRaces(JSON.parse(saved));
    } catch {}

    if (typeof window !== 'undefined') {
      const hasNotification = 'Notification' in window;
      setNotificationSupport(hasNotification);
      if (hasNotification) {
        setPermission(Notification.permission);
      }
      
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(iOS);
      
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsStandalone(standalone);
    }
  }, []);

  const requestNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(perm => {
        setPermission(perm);
      });
    }
  };

  const sendTestNotification = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('🏃 Aura Run', {
        body: 'Parabéns! Suas notificações estão ativas e funcionando no seu celular. 🚀',
        icon: '/logo.png'
      });
    }
  };

  const save = (updated: Race[]) => {
    setRaces(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const openAdd = () => {
    setForm({ name: '', date: '', distance: '10km', city: '', goalTime: '', notes: '', kitDate: '', customDistance: '' });
    setEditId(null);
    setIsCustom(false);
    setShowForm(true);
  };

  const openEdit = (r: Race) => {
    const isCustomDist = !DISTANCES.includes(r.distance);
    setForm({ 
      name: r.name, 
      date: r.date, 
      distance: isCustomDist ? 'Outro' : r.distance, 
      city: r.city, 
      goalTime: r.goalTime, 
      notes: r.notes, 
      kitDate: r.kitDate || '',
      customDistance: isCustomDist ? r.distance : ''
    });
    setIsCustom(isCustomDist);
    setEditId(r.id);
    setShowForm(true);
  };

  const submit = () => {
    if (!form.name || !form.date) return;
    const finalDistance = isCustom ? form.customDistance : form.distance;
    const data = { 
      name: form.name, 
      date: form.date, 
      distance: finalDistance || form.distance, 
      city: form.city, 
      goalTime: form.goalTime, 
      notes: form.notes,
      kitDate: form.kitDate
    };

    if (editId) {
      save(races.map(r => r.id === editId ? { ...r, ...data } : r));
    } else {
      const newRace: Race = { id: Date.now().toString(), ...data, status: 'upcoming' };
      save([...races, newRace].sort((a, b) => a.date.localeCompare(b.date)));
    }
    setShowForm(false);
  };

  const remove = (id: string) => save(races.filter(r => r.id !== id));

  const upcoming = races.filter(r => daysUntil(r.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const past = races.filter(r => daysUntil(r.date) < 0).sort((a, b) => b.date.localeCompare(a.date));
  const list = tab === 'upcoming' ? upcoming : past;
  const nextRace = upcoming[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ padding: '52px 16px 24px', background: 'linear-gradient(180deg, rgba(255,77,0,0.08) 0%, transparent 100%)' }}>
        <p className="label" style={{ marginBottom: '6px' }}>Seu calendário</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>Minhas Corridas</h1>
          <button onClick={openAdd} style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg,#FF4D00,#FF7340)', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(255,77,0,0.35)' }}>+</button>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>

        {/* Banner de Notificações */}
        {isIOS && !isStandalone ? (
          <div style={{ background: 'rgba(255,176,32,0.06)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: '20px', padding: '16px', color: 'white', fontSize: '13px', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>📲</span>
              <span style={{ fontWeight: '800', color: '#FFB020' }}>Instale o App para ver Alertas</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              No iPhone, as notificações de corrida e kit só funcionam se você adicionar o Aura Run à Tela de Início.
            </p>
            <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '10px' }}>
              <span>Toque em Compartilhar 📤 e escolha <strong>"Adicionar à Tela de Início"</strong></span>
            </div>
          </div>
        ) : notificationSupport && permission === 'default' ? (
          <div style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '20px', padding: '16px', color: 'white', fontSize: '13px', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <span style={{ fontWeight: '800', color: '#00E5FF' }}>Ativar Lembretes no Celular</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>
              Deseja receber avisos no seu celular no dia das corridas e na data de retirada do kit?
            </p>
            <button onClick={requestNotificationPermission} style={{ width: '100%', padding: '11px', borderRadius: '12px', background: 'linear-gradient(135deg, #00E5FF, #0072FF)', border: 'none', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,114,255,0.25)' }}>
              Permitir Notificações
            </button>
          </div>
        ) : notificationSupport && permission === 'denied' ? (
          <div style={{ background: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: '20px', padding: '16px', color: 'white', fontSize: '13px', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span style={{ fontWeight: '800', color: '#FF6B6B' }}>Notificações Bloqueadas</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              As notificações estão bloqueadas no seu navegador. Para receber alertas, ative as permissões nas configurações do seu celular ou navegador.
            </p>
          </div>
        ) : notificationSupport && permission === 'granted' ? (
          <div style={{ background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: '20px', padding: '16px', color: 'white', fontSize: '13px', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>✅</span>
              <span style={{ fontWeight: '800', color: '#00E5A0' }}>Notificações Ativas!</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>
              Você receberá lembretes das provas e da retirada de kits. Certifique-se de manter o app aberto ou em segundo plano.
            </p>
            <button onClick={sendTestNotification} style={{ width: '100%', padding: '9px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Testar Notificação no Celular
            </button>
          </div>
        ) : null}

        {/* Next race hero */}
        {nextRace && (
          <div style={{ background: 'linear-gradient(135deg, rgba(255,77,0,0.15) 0%, rgba(255,77,0,0.05) 100%)', border: '1px solid rgba(255,77,0,0.25)', borderRadius: '24px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#FF4D00', textTransform: 'uppercase', letterSpacing: '1px' }}>🏁 Próxima Corrida</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>{nextRace.name}</h2>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>{fmtDate(nextRace.date)}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#FF4D00', background: 'rgba(255,77,0,0.12)', padding: '3px 10px', borderRadius: '8px' }}>{nextRace.distance}</span>
                  {nextRace.city && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '8px' }}>📍 {nextRace.city}</span>}
                  {nextRace.goalTime && <span style={{ fontSize: '12px', color: '#00E5A0', background: 'rgba(0,229,160,0.08)', padding: '3px 10px', borderRadius: '8px' }}>🎯 {nextRace.goalTime}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: '40px', fontWeight: '900', color: '#FF4D00', lineHeight: 1 }}>{daysUntil(nextRace.date)}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase' }}>dias</div>
              </div>
            </div>

            {nextRace.kitDate && daysUntil(nextRace.kitDate) === 0 && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,77,0,0.1)', border: '1px solid #FF4D00', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🎁</span>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '800', color: '#FF4D00' }}>HOJE: Retirada de Kit!</p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Não esqueça seus documentos para {nextRace.name}.</p>
                </div>
              </div>
            )}

            {nextRace.goalTime && (
              <Link href={`/plan?distance=${nextRace.distance}&date=${nextRace.date}&goal=${nextRace.goalTime}`} style={{ textDecoration: 'none' }}>
                <div style={{ marginTop: '14px', padding: '10px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>📋 Gerar planilha de treino com Aura</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '4px' }}>
          {(['upcoming', 'past'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '9px', borderRadius: '10px', border: 'none', fontFamily: 'inherit', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', background: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent', color: tab === t ? 'white' : 'rgba(255,255,255,0.4)' }}>
              {t === 'upcoming' ? `Próximas (${upcoming.length})` : `Passadas (${past.length})`}
            </button>
          ))}
        </div>

        {/* Race list */}
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏁</div>
            <h3 style={{ marginBottom: '8px' }}>{tab === 'upcoming' ? 'Nenhuma corrida agendada' : 'Nenhuma corrida passada'}</h3>
            <p style={{ fontSize: '13px', marginBottom: '20px' }}>{tab === 'upcoming' ? 'Adicione suas provas e nunca perca uma data!' : 'Suas corridas concluídas aparecerão aqui.'}</p>
            {tab === 'upcoming' && <button onClick={openAdd} className="btn-primary" style={{ fontSize: '14px', padding: '12px 24px' }}>+ Adicionar Corrida</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {list.map(r => {
              const days = daysUntil(r.date);
              return (
                <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h3 style={{ fontSize: '16px' }}>{r.name}</h3>
                        <CountdownBadge days={days} />
                      </div>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{fmtDate(r.date)}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                      <button onClick={() => openEdit(r)} style={{ width: 32, height: 32, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                      <button onClick={() => remove(r.id)} style={{ width: 32, height: 32, borderRadius: '10px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', color: '#FF6B6B', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#FF4D00', background: 'rgba(255,77,0,0.1)', padding: '3px 10px', borderRadius: '8px' }}>{r.distance}</span>
                    {r.city && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '8px' }}>📍 {r.city}</span>}
                    {r.goalTime && <span style={{ fontSize: '12px', color: '#00E5A0', background: 'rgba(0,229,160,0.08)', padding: '3px 10px', borderRadius: '8px' }}>🎯 {r.goalTime}</span>}
                    {r.kitDate && (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: daysUntil(r.kitDate) === 0 ? '#FF4D00' : 'rgba(255,255,255,0.4)', background: daysUntil(r.kitDate) === 0 ? 'rgba(255,77,0,0.15)' : 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '8px', border: daysUntil(r.kitDate) === 0 ? '1px solid rgba(255,77,0,0.3)' : 'none' }}>
                        🎁 Kit: {daysUntil(r.kitDate) === 0 ? 'HOJE!' : daysUntil(r.kitDate) === 1 ? 'Amanhã' : fmtDate(r.kitDate)}
                      </span>
                    )}
                  </div>
                  {r.notes && <p style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: '1.5', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>{r.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', margin: '0 auto', background: '#12121E', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', borderRadius: '28px 28px 0 0', padding: '0 20px 40px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px', paddingTop: '8px' }}>
              {editId ? '✏️ Editar Corrida' : '🏁 Nova Corrida'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Nome da Corrida *', key: 'name', placeholder: 'Ex: Corrida do Parque 2025', type: 'text' },
                { label: 'Data *', key: 'date', placeholder: '', type: 'date' },
                { label: 'Data Retirada do Kit', key: 'kitDate', placeholder: '', type: 'date' },
                { label: 'Cidade', key: 'city', placeholder: 'Ex: São Paulo - SP', type: 'text' },
                { label: 'Tempo Meta', key: 'goalTime', placeholder: 'Ex: 55:00', type: 'text' },
                { label: 'Anotações', key: 'notes', placeholder: 'Lembrete, largada...', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '15px', outline: 'none', fontFamily: 'inherit', colorScheme: 'dark' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>Distância</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: isCustom ? '12px' : '0' }}>
                  {DISTANCES.map(d => (
                    <button key={d} onClick={() => { setForm(p => ({ ...p, distance: d })); setIsCustom(d === 'Outro'); }} style={{ padding: '8px 14px', borderRadius: '10px', border: form.distance === d ? 'none' : '1px solid rgba(255,255,255,0.1)', background: form.distance === d ? 'linear-gradient(135deg,#FF4D00,#FF7340)' : 'rgba(255,255,255,0.05)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', boxShadow: form.distance === d ? '0 4px 12px rgba(255,77,0,0.3)' : 'none' }}>
                      {d}
                    </button>
                  ))}
                </div>
                {isCustom && (
                  <input
                    type="text"
                    value={form.customDistance}
                    onChange={e => setForm(prev => ({ ...prev, customDistance: e.target.value }))}
                    placeholder="Ex: 6km, 8km, 12km..."
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,77,0,0.05)', border: '1px solid rgba(255,77,0,0.3)', color: 'white', fontSize: '15px', outline: 'none', fontFamily: 'inherit', marginTop: '8px' }}
                  />
                )}
              </div>

              <button onClick={submit} disabled={!form.name || !form.date} className="btn-primary" style={{ width: '100%', marginTop: '8px', opacity: (!form.name || !form.date) ? 0.5 : 1 }}>
                {editId ? 'Salvar Alterações' : '+ Adicionar Corrida'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ width: '100%', padding: '13px', borderRadius: '14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
