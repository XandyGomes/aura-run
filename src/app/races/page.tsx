'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

const mapRace = (row: any): Race => ({
  id: row.id,
  name: row.name,
  date: row.date,
  distance: row.distance,
  city: row.city || '',
  goalTime: row.goal_time || '',
  notes: row.notes || '',
  status: row.status,
  kitDate: row.kit_date || '',
});

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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
  const [athleteId, setAthleteId] = useState<number | null>(null);

  const loadRaces = async (id: number) => {
    try {
      const { data, error } = await supabase
        .from('races')
        .select('*')
        .eq('athlete_id', id)
        .order('date', { ascending: true });

      if (error) throw error;
      setRaces((data || []).map(mapRace));
    } catch (err) {
      console.error('Erro ao carregar corridas:', err);
    }
  };

  const migrateLocalRaces = async (id: number) => {
    try {
      const STORAGE_KEY = 'aura_races_v1';
      const localData = localStorage.getItem(STORAGE_KEY);
      if (!localData) return;

      const localRaces = JSON.parse(localData);
      if (Array.isArray(localRaces) && localRaces.length > 0) {
        console.log('Migrando corridas locais para o Supabase...');
        const racesToInsert = localRaces.map((r: any) => ({
          athlete_id: id,
          name: r.name,
          date: r.date,
          distance: r.distance,
          city: r.city || null,
          goal_time: r.goalTime || null,
          notes: r.notes || null,
          kit_date: r.kitDate || null,
          status: r.status || 'upcoming'
        }));

        const { error } = await supabase
          .from('races')
          .insert(racesToInsert);

        if (error) throw error;
        console.log('Migração de dados locais concluída com sucesso!');
      }
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Erro na migração de corridas locais:', err);
    }
  };

  useEffect(() => {
    const idStr = getCookie('strava_athlete_id');
    if (idStr) {
      const id = Number(idStr);
      setAthleteId(id);
      migrateLocalRaces(id).then(() => {
        loadRaces(id);
      });
    }

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

  // Registra automaticamente a inscrição se a permissão já foi concedida anteriormente
  useEffect(() => {
    const autoSubscribe = async () => {
      if (athleteId && permission === 'granted' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BDE93rVC1zLJPB6EXpZYfqHKimxro-PVkcu3UNDYVnvmeCobyBMU7QPrdJeqk7HZLUo0-vCsZP1j90ZrnPVicHU').trim();
          const convertedKey = urlBase64ToUint8Array(publicKey);
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });
          await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription, athleteId })
          });
          console.log('Dispositivo registrado automaticamente em segundo plano.');
        } catch (err) {
          console.warn('Erro ao auto-registrar notificações:', err);
        }
      }
    };
    autoSubscribe();
  }, [athleteId, permission]);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('Seu dispositivo ou navegador não suporta notificações web.');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm === 'granted' && athleteId) {
        // Registra o Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registrado:', registration);

        // Aguarda a ativação do Service Worker se necessário
        await navigator.serviceWorker.ready;

        // Gera a inscrição de push
        const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BDE93rVC1zLJPB6EXpZYfqHKimxro-PVkcu3UNDYVnvmeCobyBMU7QPrdJeqk7HZLUo0-vCsZP1j90ZrnPVicHU').trim();
        const convertedKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });

        // Envia para o Supabase via API
        const res = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription, athleteId })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro ao registrar no banco de dados.');
        }
        console.log('Inscrição de push salva com sucesso no Supabase!');
      }
    } catch (err: any) {
      console.error('Erro ao ativar notificações:', err);
      alert('Erro ao ativar lembretes: ' + err.message);
    }
  };

  const sendTestNotification = async () => {
    if (!athleteId) return;
    try {
      const res = await fetch(`/api/notifications/send-daily?test_athlete_id=${athleteId}`);
      if (!res.ok) {
        const data = await res.json();
        
        // Se der erro de dispositivo não registrado, tenta registrar na hora e re-enviar
        if (data.error && data.error.includes('Nenhum dispositivo registrado')) {
          console.log('Inscrição não encontrada. Tentando registrar dispositivo agora...');
          
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BDE93rVC1zLJPB6EXpZYfqHKimxro-PVkcu3UNDYVnvmeCobyBMU7QPrdJeqk7HZLUo0-vCsZP1j90ZrnPVicHU').trim();
            const convertedKey = urlBase64ToUint8Array(publicKey);
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey
            });
            await fetch('/api/notifications/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription, athleteId })
            });
            
            // Tenta enviar o teste novamente
            const retryRes = await fetch(`/api/notifications/send-daily?test_athlete_id=${athleteId}`);
            if (!retryRes.ok) {
              const retryData = await retryRes.json();
              throw new Error(retryData.error || 'Erro ao enviar teste após registro.');
            }
            alert('Seu dispositivo foi registrado com sucesso e a notificação de teste foi enviada! 🚀');
            return;
          }
        }
        
        throw new Error(data.error || 'Erro ao enviar teste');
      }
      alert('Notificação de teste disparada! Chegará em breve no seu celular. 🚀');
    } catch (err: any) {
      console.error('Erro ao testar push:', err);
      alert('Erro no teste de notificação: ' + err.message);
    }
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

  const submit = async () => {
    if (!athleteId) {
      alert('Você precisa estar conectado ao Strava para gerenciar suas corridas.');
      return;
    }
    if (!form.name || !form.date) return;
    
    const finalDistance = isCustom ? form.customDistance : form.distance;
    const data = { 
      athlete_id: athleteId,
      name: form.name, 
      date: form.date, 
      distance: finalDistance || form.distance, 
      city: form.city, 
      goal_time: form.goalTime || null, 
      notes: form.notes || null,
      kit_date: form.kitDate || null,
      status: 'upcoming'
    };

    try {
      if (editId) {
        const { error } = await supabase
          .from('races')
          .update(data)
          .eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('races')
          .insert([data]);
        if (error) throw error;
      }
      
      await loadRaces(athleteId);
      setShowForm(false);
    } catch (err: any) {
      console.error('Erro ao salvar corrida:', err);
      alert('Erro ao salvar corrida: ' + (err.message || 'Verifique as permissões do banco de dados (RLS) no Supabase.'));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta corrida?')) return;
    try {
      const { error } = await supabase
        .from('races')
        .delete()
        .eq('id', id);
      if (error) throw error;

      setRaces(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      console.error('Erro ao deletar corrida:', err);
      alert('Erro ao excluir corrida: ' + (err.message || 'Erro de permissão no Supabase.'));
    }
  };

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
