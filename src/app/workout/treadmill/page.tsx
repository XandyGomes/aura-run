'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function fmtPace(distKm: number, timeSec: number): string {
  if (!distKm || !timeSec) return '--:--';
  const s = timeSec / distKm;
  return `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`;
}

function secToDisplay(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function displayToSec(val: string): number {
  const parts = val.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(val) || 0;
}

export default function TreadmillPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'choose' | 'photo' | 'manual' | 'review' | 'saved'>('choose');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);

  // Form data
  const [form, setForm] = useState({
    name: `Esteira – ${new Date().toLocaleDateString('pt-BR')}`,
    distance: '',
    timeDisplay: '',
    speed: '',
    calories: '',
    incline: '',
  });

  const [confidence, setConfidence] = useState<number | null>(null);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
    };
    reader.readAsDataURL(file);

    // Send to AI
    setScanning(true);
    setScanError('');

    try {
      const base64Reader = new FileReader();
      base64Reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        // Remove the "data:image/...;base64," prefix
        const base64 = dataUrl.split(',')[1];
        const mimeType = file.type || 'image/jpeg';

        const res = await fetch('/api/ai/treadmill-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Falha ao analisar imagem');
        }

        const d = json.data;
        setForm((prev) => ({
          ...prev,
          distance: d.distance != null ? String(d.distance) : prev.distance,
          timeDisplay: d.time != null ? secToDisplay(d.time) : prev.timeDisplay,
          speed: d.speed != null ? String(d.speed) : prev.speed,
          calories: d.calories != null ? String(d.calories) : prev.calories,
          incline: d.incline != null ? String(d.incline) : prev.incline,
        }));
        setConfidence(d.confidence);
        setMode('manual'); // Mostra form com dados pré-preenchidos
      };
      base64Reader.readAsDataURL(file);
    } catch (err: any) {
      setScanError(err.message || 'Erro ao analisar imagem');
      setMode('manual');
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    const distKm = parseFloat(form.distance);
    const timeSec = displayToSec(form.timeDisplay);
    const speed = parseFloat(form.speed) || 0;
    const cals = parseInt(form.calories) || 0;

    if (!distKm || distKm <= 0) {
      alert('Por favor, informe a distância.');
      return;
    }
    if (!timeSec || timeSec <= 0) {
      alert('Por favor, informe o tempo (ex: 30:00).');
      return;
    }

    const idStr = getCookie('strava_athlete_id');
    if (!idStr) {
      alert('Você precisa estar conectado ao Strava para salvar treinos.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('recorded_workouts').insert({
        athlete_id: Number(idStr),
        name: form.name,
        distance: distKm,
        moving_time: timeSec,
        elapsed_time: timeSec * 1000,
        calories: cals,
        start_date: new Date().toISOString(),
        workout_type: 'treadmill',
        source: imagePreview ? 'photo_scan' : 'manual',
        gps_points: [],
        splits: [],
        avg_speed: speed,
        incline: parseFloat(form.incline) || 0,
      });

      if (error) throw error;
      setMode('saved');
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const distKm = parseFloat(form.distance) || 0;
  const timeSec = displayToSec(form.timeDisplay);

  // ── Tela de sucesso ──
  if (mode === 'saved') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', paddingBottom: '120px' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #00E5A0, #00C87A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 24, boxShadow: '0 0 40px rgba(0,229,160,0.4)' }}>
          ✅
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>Treino Salvo!</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32 }}>
          Sua corrida na esteira foi registrada com sucesso.
        </p>

        {/* Stats rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 360, marginBottom: 32 }}>
          {[
            { label: 'Distância', value: `${distKm.toFixed(2)} km` },
            { label: 'Tempo', value: secToDisplay(timeSec) },
            { label: 'Pace', value: `${fmtPace(distKm, timeSec)}/km` },
            { label: 'Calorias', value: form.calories ? `${form.calories} kcal` : '--' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FF4D00', marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <button onClick={() => router.push('/stats')} style={{ width: '100%', maxWidth: 360, padding: '16px', borderRadius: 18, background: 'linear-gradient(135deg,#FF4D00,#FF7340)', border: 'none', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
          📊 Ver Estatísticas
        </button>
        <button onClick={() => router.push('/')} style={{ width: '100%', maxWidth: 360, padding: '14px', borderRadius: 18, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          🏠 Início
        </button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingBottom: '120px', maxWidth: 500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,rgba(255,77,0,0.2),rgba(255,77,0,0.1))', border: '1px solid rgba(255,77,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
            🏃
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Esteira</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Registre seu treino na esteira</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 20px' }}>

        {/* ── ESCOLHA: Foto ou Manual ── */}
        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              Como deseja registrar seu treino?
            </p>

            {/* Opção: Foto */}
            <button
              onClick={() => { setMode('photo'); setTimeout(() => fileInputRef.current?.click(), 100); }}
              style={{
                padding: '24px 20px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                background: 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(0,114,255,0.05))',
                border: '1px solid rgba(0,229,255,0.2)',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>📷</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 4 }}>Tirar Foto do Painel</div>
              <div style={{ fontSize: 13, color: 'rgba(0,229,255,0.7)' }}>
                IA analisa automaticamente distância, tempo, velocidade e calorias
              </div>
            </button>

            {/* Opção: Manual */}
            <button
              onClick={() => setMode('manual')}
              style={{
                padding: '24px 20px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>✏️</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 4 }}>Inserir Manualmente</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                Preencha os dados do treino você mesmo
              </div>
            </button>
          </div>
        )}

        {/* ── FOTO: Scanning ── */}
        {mode === 'photo' && scanning && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '40px 0' }}>
            {imagePreview && (
              <div style={{ position: 'relative', width: '100%', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,229,255,0.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Painel da esteira" style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                  <div style={{ width: 40, height: 40, border: '3px solid rgba(0,229,255,0.3)', borderTop: '3px solid #00E5FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ color: '#00E5FF', fontWeight: 600, fontSize: 14 }}>Analisando painel...</span>
                </div>
              </div>
            )}
            {!imagePreview && (
              <>
                <div style={{ width: 60, height: 60, border: '3px solid rgba(0,229,255,0.3)', borderTop: '3px solid #00E5FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ color: '#00E5FF', fontWeight: 600 }}>Analisando painel com IA...</p>
              </>
            )}
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' }}>
              Gemini Vision está lendo os dados do painel da esteira
            </p>
          </div>
        )}

        {/* ── FORMULÁRIO (manual ou pós-scan) ── */}
        {(mode === 'manual' || (mode === 'photo' && !scanning)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Preview da foto (se tirou foto) */}
            {imagePreview && (
              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Painel escaneado" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
              </div>
            )}

            {/* Badge de confiança */}
            {confidence != null && (
              <div style={{
                padding: '10px 16px', borderRadius: 12,
                background: confidence > 0.7 ? 'rgba(0,229,160,0.1)' : 'rgba(255,176,32,0.1)',
                border: `1px solid ${confidence > 0.7 ? 'rgba(0,229,160,0.3)' : 'rgba(255,176,32,0.3)'}`,
                fontSize: 13, fontWeight: 600,
                color: confidence > 0.7 ? '#00E5A0' : '#FFB020',
              }}>
                {confidence > 0.7 ? '✅' : '⚠️'} IA leu com {Math.round(confidence * 100)}% de confiança — revise os dados abaixo
              </div>
            )}

            {scanError && (
              <div style={{ padding: '10px 16px', borderRadius: 12, background: 'rgba(255,77,0,0.1)', border: '1px solid rgba(255,77,0,0.25)', fontSize: 13, color: '#FF4D00' }}>
                ⚠️ {scanError} — preencha manualmente.
              </div>
            )}

            {/* Nome */}
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Nome do Treino</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
              />
            </div>

            {/* Distância + Tempo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Distância (km) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="5.00"
                  value={form.distance}
                  onChange={e => setForm(f => ({ ...f, distance: e.target.value }))}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Tempo (mm:ss) *</label>
                <input
                  type="text"
                  placeholder="30:00"
                  value={form.timeDisplay}
                  onChange={e => setForm(f => ({ ...f, timeDisplay: e.target.value }))}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Velocidade + Inclinação */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Velocidade (km/h)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="10.0"
                  value={form.speed}
                  onChange={e => setForm(f => ({ ...f, speed: e.target.value }))}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Inclinação (%)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="0"
                  value={form.incline}
                  onChange={e => setForm(f => ({ ...f, incline: e.target.value }))}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Calorias */}
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Calorias (kcal)</label>
              <input
                type="number"
                placeholder="300"
                value={form.calories}
                onChange={e => setForm(f => ({ ...f, calories: e.target.value }))}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
              />
            </div>

            {/* Preview das estatísticas */}
            {distKm > 0 && timeSec > 0 && (
              <div style={{ background: 'linear-gradient(135deg, rgba(255,77,0,0.1), rgba(255,77,0,0.05))', border: '1px solid rgba(255,77,0,0.2)', borderRadius: 16, padding: '16px 20px' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,77,0,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Estatísticas Calculadas</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Pace', value: `${fmtPace(distKm, timeSec)}/km` },
                    { label: 'Distância', value: `${distKm.toFixed(2)} km` },
                    { label: 'Tempo', value: secToDisplay(timeSec) },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#FF4D00' }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botões */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '16px', borderRadius: 18, border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                background: saving ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#FF4D00,#FF7340)',
                color: 'white',
                transition: 'background 0.2s',
                boxShadow: saving ? 'none' : '0 4px 24px rgba(255,77,0,0.35)',
              }}
            >
              {saving ? '💾 Salvando...' : '💾 Salvar Treino'}
            </button>

            {imagePreview && (
              <button
                onClick={() => { setImagePreview(''); setConfidence(null); fileInputRef.current?.click(); }}
                style={{ width: '100%', padding: '13px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                📷 Tirar Outra Foto
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoCapture}
      />

      <BottomNav />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
