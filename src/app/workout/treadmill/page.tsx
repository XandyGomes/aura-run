'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import styles from './treadmill.module.css';

/* ── Helpers ── */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const v = `; ${document.cookie}`;
  const p = v.split(`; ${name}=`);
  if (p.length === 2) return p.pop()?.split(';').shift() || null;
  return null;
}

function fmtPace(distKm: number, timeSec: number): string {
  if (!distKm || !timeSec) return '--:--';
  const s = timeSec / distKm;
  return `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`;
}

function secToDisplay(sec: number): string {
  if (!sec) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function displayToSec(val: string): number {
  const parts = val.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return Number(val) || 0;
}

function estCalories(distKm: number, timeSec: number): number {
  if (!distKm || !timeSec) return 0;
  return Math.round(distKm * 60); // ~60 kcal/km estimado
}

function compressImage(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.8): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter o contexto 2D do Canvas.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ dataUrl, base64 });
      };
      img.onerror = () => {
        reject(new Error('Falha ao carregar a imagem para compressão.'));
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Falha ao ler o arquivo original.'));
    };
    reader.readAsDataURL(file);
  });
}

/* ── Types ── */
type Mode = 'choose' | 'photo' | 'form' | 'saved';

export default function TreadmillPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('choose');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: `Esteira – ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
    distance: '',
    timeDisplay: '',
    speed: '',
    calories: '',
    incline: '',
  });

  /* ── Photo capture ── */
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanError('');
    setMode('photo');

    try {
      // Compress image to fit Vercel payload limits (max size 4.5MB)
      const { dataUrl, base64 } = await compressImage(file);
      setImagePreview(dataUrl);

      const res = await fetch('/api/ai/treadmill-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao analisar');

      const d = json.data;
      setForm(prev => ({
        ...prev,
        distance: d.distance != null ? String(d.distance) : prev.distance,
        timeDisplay: d.time != null ? secToDisplay(d.time) : prev.timeDisplay,
        speed: d.speed != null ? String(d.speed) : prev.speed,
        calories: d.calories != null ? String(Math.round(d.calories)) : prev.calories,
        incline: d.incline != null ? String(d.incline) : prev.incline,
      }));
      setConfidence(d.confidence ?? null);
    } catch (err: any) {
      setScanError(err.message || 'Erro ao analisar imagem');
    } finally {
      setScanning(false);
      setMode('form');
    }
  };

  /* ── Save ── */
  const handleSave = async () => {
    const distKm = parseFloat(form.distance);
    const timeSec = displayToSec(form.timeDisplay);
    if (!distKm || distKm <= 0) return alert('Informe a distância em km.');
    if (!timeSec || timeSec <= 0) return alert('Informe o tempo (ex: 30:00).');
    const athleteIdStr = getCookie('strava_athlete_id');
    if (!athleteIdStr) return alert('Você precisa estar conectado ao Strava para salvar.');

    const cals = parseInt(form.calories) || estCalories(distKm, timeSec);
    setSaving(true);
    try {
      const { error } = await supabase.from('recorded_workouts').insert({
        athlete_id: Number(athleteIdStr),
        name: form.name,
        distance: distKm,
        moving_time: timeSec,
        elapsed_time: timeSec * 1000,
        calories: cals,
        start_date: new Date().toISOString(),
        gps_points: [{ is_treadmill: true, source: imagePreview ? 'photo_scan' : 'manual' }],
        splits: [],
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
  const cals = parseInt(form.calories) || (distKm > 0 && timeSec > 0 ? estCalories(distKm, timeSec) : 0);

  /* ────────────────────────────────────────────
     SUCCESS SCREEN
  ──────────────────────────────────────────── */
  if (mode === 'saved') {
    return (
      <div className={styles.savedContainer}>
        <div className={styles.savedScrollable}>
          {/* Success icon */}
          <div className={styles.successIcon}>✅</div>

          <h1 className={styles.successTitle}>
            Treino Salvo!
          </h1>
          <p className={styles.successDesc}>
            Sua corrida na esteira foi registrada com sucesso.
          </p>

          {/* Stats */}
          <div className={styles.statsGrid}>
            {[
              { icon: '📏', label: 'Distância', value: `${distKm.toFixed(2)} km` },
              { icon: '⏱️', label: 'Tempo', value: secToDisplay(timeSec) },
              { icon: '⚡', label: 'Pace', value: `${fmtPace(distKm, timeSec)}/km` },
              { icon: '🔥', label: 'Calorias', value: `${cals} kcal` },
            ].map(s => (
              <div key={s.label} className={styles.statCard}>
                <div className={styles.statCardIcon}>{s.icon}</div>
                <div className={styles.statCardVal}>{s.value}</div>
                <div className={styles.statCardLbl}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.actionsColumn}>
            <button onClick={() => router.push('/stats')} className={styles.btnPrimaryAction}>
              📊 Ver Estatísticas
            </button>
            <button onClick={() => router.push('/')} className={styles.btnSecondaryAction}>
              🏠 Início
            </button>
            {/* Espaçador para evitar sobreposição do BottomNav */}
            <div style={{ height: 40, flexShrink: 0 }} />
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  /* ────────────────────────────────────────────
     SCANNING SCREEN
  ──────────────────────────────────────────── */
  if (mode === 'photo' && scanning) {
    return (
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button onClick={() => { setScanning(false); setMode('choose'); }} className={styles.btnBack}>
            ← Cancelar
          </button>
        </div>

        <div className={styles.content} style={{ justifyContent: 'center', alignItems: 'center' }}>
          {/* Photo preview with scan effect */}
          {imagePreview && (
            <div className={styles.scanContainer}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Painel" className={styles.scanImg} />
              <div className={styles.scanOverlay}>
                <div className={styles.spinner} />
                <span className={styles.scanText}>Analisando painel...</span>
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Gemini Vision ativo</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.6 }}>
              A IA está lendo distância, tempo,<br />velocidade e calorias do painel
            </p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  /* ────────────────────────────────────────────
     CHOOSE MODE SCREEN
  ──────────────────────────────────────────── */
  if (mode === 'choose') {
    return (
      <div className={styles.container}>
        {/* Header */}
        <div className={`${styles.header} ${styles.headerChoose}`}>
          <button onClick={() => router.back()} className={styles.btnBack}>
            ← Voltar
          </button>
          <div className={styles.titleRow}>
            <div className={styles.titleIcon}>🏃</div>
            <div className={styles.titleText}>
              <h1>Corrida na Esteira</h1>
              <p>Registre com IA ou manualmente</p>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          {/* AI Photo option */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={styles.cardAi}
          >
            <div>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIcon} ${styles.cardIconAi}`}>📷</div>
                <div>
                  <div className={styles.cardTitle}>Foto do Painel</div>
                  <div className={`${styles.cardSubtitle} ${styles.cardSubtitleAi}`}>Gemini Vision AI</div>
                </div>
              </div>
              <p className={styles.cardDesc}>
                Tire uma foto do painel da esteira e a IA preenche automaticamente distância, tempo, velocidade, inclinação e calorias.
              </p>
              <div className={styles.cardTags}>
                {['Distância', 'Tempo', 'Velocidade', 'Calorias', 'Inclinação'].map(tag => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            </div>
          </button>

          {/* Manual option */}
          <button
            onClick={() => setMode('form')}
            className={styles.cardManual}
          >
            <div className={styles.cardHeader}>
              <div className={`${styles.cardIcon} ${styles.cardIconManual}`}>✏️</div>
              <div>
                <div className={styles.cardTitle}>Inserir Manualmente</div>
                <div className={`${styles.cardSubtitle} ${styles.cardSubtitleManual}`}>Preencha os dados você mesmo</div>
              </div>
            </div>
            <p className={styles.cardDesc}>
              Ideal quando o painel é difícil de fotografar ou você preferir digitar os valores.
            </p>
          </button>

          {/* Espaçador para evitar sobreposição do BottomNav */}
          <div style={{ height: 80, flexShrink: 0 }} />
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoCapture} />
        <BottomNav />
      </div>
    );
  }

  /* ────────────────────────────────────────────
     FORM SCREEN (manual + post-scan)
  ──────────────────────────────────────────── */
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => setMode('choose')} className={styles.btnBack}>
          ← Voltar
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          {imagePreview ? '📷 Dados do Painel' : '✏️ Inserir Dados'}
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Preencha ou corrija os dados do treino</p>
      </div>

      {/* Scrollable content */}
      <div className={styles.content}>
        {/* Photo preview */}
        {imagePreview && (
          <div className={styles.photoPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Painel escaneado" className={styles.previewImg} />
            <button
              onClick={() => { setImagePreview(''); setConfidence(null); fileInputRef.current?.click(); }}
              className={styles.btnNewPhoto}
            >
              📷 Nova foto
            </button>
          </div>
        )}

        {/* Confidence badge */}
        {confidence != null && !scanError && (
          <div className={`${styles.badgeConfidence} ${confidence > 0.75 ? styles.badgeOk : styles.badgeWarn}`}>
            <span style={{ fontSize: 20 }}>{confidence > 0.75 ? '✅' : '⚠️'}</span>
            <div>
              <div className={styles.badgeTextTitle}>
                IA leu com {Math.round(confidence * 100)}% de confiança
              </div>
              <div className={styles.badgeTextDesc}>
                {confidence > 0.75 ? 'Dados preenchidos automaticamente' : 'Revise os dados abaixo'}
              </div>
            </div>
          </div>
        )}

        {/* Scan error */}
        {scanError && (
          <div className={styles.badgeError}>
            ⚠️ {scanError} — preencha os dados manualmente.
          </div>
        )}

        {/* Nome */}
        <div>
          <label className={styles.label}>Nome do Treino</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={styles.input} />
        </div>

        {/* Distância + Tempo */}
        <div className={styles.grid2}>
          <div>
            <label className={styles.label}>Distância (km) *</label>
            <input type="number" step="0.01" placeholder="5.00" value={form.distance} onChange={e => setForm(f => ({ ...f, distance: e.target.value }))} className={styles.input} />
          </div>
          <div>
            <label className={styles.label}>Tempo (mm:ss) *</label>
            <input type="text" placeholder="30:00" value={form.timeDisplay} onChange={e => setForm(f => ({ ...f, timeDisplay: e.target.value }))} className={styles.input} />
          </div>
        </div>

        {/* Velocidade + Inclinação */}
        <div className={styles.grid2}>
          <div>
            <label className={styles.label}>Velocidade (km/h)</label>
            <input type="number" step="0.1" placeholder="10.0" value={form.speed} onChange={e => setForm(f => ({ ...f, speed: e.target.value }))} className={styles.input} />
          </div>
          <div>
            <label className={styles.label}>Inclinação (%)</label>
            <input type="number" step="0.5" placeholder="0" value={form.incline} onChange={e => setForm(f => ({ ...f, incline: e.target.value }))} className={styles.input} />
          </div>
        </div>

        {/* Calorias */}
        <div>
          <label className={styles.label}>Calorias (kcal)</label>
          <input
            type="number" placeholder={distKm > 0 ? `~${estCalories(distKm, timeSec)} (estimado)` : '300'}
            value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} className={styles.input}
          />
        </div>

        {/* Live stats preview */}
        {distKm > 0 && timeSec > 0 && (
          <div className={styles.previewBox}>
            <p className={styles.previewBoxTitle}>
              Prévia das Estatísticas
            </p>
            <div className={styles.previewGrid}>
              {[
                { label: 'Pace', value: `${fmtPace(distKm, timeSec)}/km` },
                { label: 'Distância', value: `${distKm.toFixed(2)} km` },
                { label: 'Tempo', value: secToDisplay(timeSec) },
              ].map(s => (
                <div key={s.label} className={styles.previewStat}>
                  <div className={styles.previewVal}>{s.value}</div>
                  <div className={styles.previewLbl}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={saving ? styles.btnSaveDisabled : styles.btnSave}
        >
          {saving ? '💾 Salvando...' : '💾 Salvar Treino'}
        </button>

        {/* Espaçador para evitar sobreposição do BottomNav */}
        <div style={{ height: 100, flexShrink: 0 }} />
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoCapture} />

      <BottomNav />
    </div>
  );
}
