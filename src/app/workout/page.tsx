'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

// ── Fórmula de Haversine para distância entre dois pontos GPS ──
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── Formatadores ──
function formatTime(ms: number): string {
  const cs = Math.floor((ms % 1000) / 10);
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '--:--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatKm(km: number): string {
  return km.toFixed(2);
}

type WorkoutState = 'idle' | 'running' | 'paused' | 'finished';

interface GpsPoint { lat: number; lon: number; ts: number; }

// Mensagens motivacionais da Aura por marco
const AURA_MESSAGES: Record<string, string> = {
  start: '🏃 Vamos lá! Aqueça nos primeiros 5 minutos.',
  km1: '✅ Primeiro km! Mantenha o ritmo e respire fundo.',
  km2: '🔥 2km! Você está num ótimo fluxo.',
  km5: '⭐ 5km concluídos! Performance excelente!',
  km10: '🏆 10km! Incrível resistência. Siga em frente!',
  min5: '💧 5 minutos de treino! Lembre-se de respirar.',
  min20: '💧 Hora de hidratar! 20 minutos de esforço.',
  min40: '💪 40 minutos! Seu corpo está em modo queima total.',
};

export default function WorkoutPage() {
  const router = useRouter();

  const [workoutState, setWorkoutState] = useState<WorkoutState>('idle');
  const [elapsed, setElapsed] = useState(0);           // ms
  const [distance, setDistance] = useState(0);          // km
  const [currentPace, setCurrentPace] = useState(0);    // sec/km
  const [splits, setSplits] = useState<{ km: number; time: number }[]>([]);
  const [auraMsg, setAuraMsg] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'waiting' | 'ok' | 'error'>('waiting');
  const [calories, setCalories] = useState(0);

  // Refs para não re-render
  const startTimeRef = useRef(0);
  const pausedElapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const gpsPointsRef = useRef<GpsPoint[]>([]);
  const distanceRef = useRef(0);
  const nextSplitKmRef = useRef(1);
  const splitStartRef = useRef(0);
  const firedMilestonesRef = useRef(new Set<string>());
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const dotMarkerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // ── Aura message helper ──
  const showAura = useCallback((msg: string) => {
    setAuraMsg(msg);
    setTimeout(() => setAuraMsg(''), 6000);
  }, []);


  function initMap() {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([-23.5505, -46.6333], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    polylineRef.current = L.polyline([], {
      color: '#fc4c02',
      weight: 5,
      opacity: 0.9,
    }).addTo(map);

    mapRef.current = map;
  }

  // ── Timer (10ms interval → centésimos visíveis) ──
  useEffect(() => {
    if (workoutState === 'running') {
      timerRef.current = setInterval(() => {
        const ms = Date.now() - startTimeRef.current + pausedElapsedRef.current;
        setElapsed(ms);
        setCalories(Math.floor((ms / 1000 / 60) * 8.5)); // ~8.5 kcal/min estimado

        // Milestones de tempo
        const mins = ms / 60000;
        if (mins >= 5 && !firedMilestonesRef.current.has('min5')) {
          firedMilestonesRef.current.add('min5');
          showAura(AURA_MESSAGES.min5);
        }
        if (mins >= 20 && !firedMilestonesRef.current.has('min20')) {
          firedMilestonesRef.current.add('min20');
          showAura(AURA_MESSAGES.min20);
        }
        if (mins >= 40 && !firedMilestonesRef.current.has('min40')) {
          firedMilestonesRef.current.add('min40');
          showAura(AURA_MESSAGES.min40);
        }
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [workoutState, showAura]);

  // ── GPS watcher ──
  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus('ok');
        const L = (window as any).L;
        const { latitude: lat, longitude: lon } = pos.coords;
        const now = Date.now();
        const newPt: GpsPoint = { lat, lon, ts: now };

        // Record points and calculate distance only if running
        if (workoutState === 'running') {
          const pts = gpsPointsRef.current;
          if (pts.length > 0) {
            const prev = pts[pts.length - 1];
            const delta = haversine(prev.lat, prev.lon, lat, lon);
            const newDist = distanceRef.current + delta;
            distanceRef.current = newDist;
            setDistance(newDist);

            // Pace: último segmento (km por hora → min/km)
            const dtSec = (now - prev.ts) / 1000;
            if (delta > 0.001 && dtSec > 0) {
              setCurrentPace(dtSec / delta);
            }

            // Split por km
            if (newDist >= nextSplitKmRef.current) {
              const km = nextSplitKmRef.current;
              const splitMs = now - splitStartRef.current;
              setSplits((s) => [...s, { km, time: splitMs }]);
              splitStartRef.current = now;
              nextSplitKmRef.current = km + 1;

              const splitPace = formatPace(splitMs / 1000);
              showAura(`🏁 Split ${km}km: ${splitPace} min/km`);

              // Mensagens por km
              const key = `km${km}`;
              if (AURA_MESSAGES[key] && !firedMilestonesRef.current.has(key)) {
                firedMilestonesRef.current.add(key);
                setTimeout(() => showAura(AURA_MESSAGES[key]), 4000);
              }
            }
          } else {
            splitStartRef.current = now;
          }
          gpsPointsRef.current = [...pts, newPt];
        }

        // Atualiza mapa
        if (L && mapRef.current) {
          const latLngs = gpsPointsRef.current.map((p) => [p.lat, p.lon]);
          polylineRef.current?.setLatLngs(latLngs);
          mapRef.current.setView([lat, lon], 17, { animate: true });

          if (dotMarkerRef.current) {
            dotMarkerRef.current.setLatLng([lat, lon]);
          } else {
            dotMarkerRef.current = L.circleMarker([lat, lon], {
              radius: 10,
              color: '#ffffff',
              fillColor: '#fc4c02',
              fillOpacity: 1,
              weight: 3,
            }).addTo(mapRef.current);
          }
        }
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }, [showAura, workoutState]);

  const stopGps = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // ── Carrega Leaflet via CDN ──
  useEffect(() => {
    // CSS
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = initMap;
    document.body.appendChild(script);

    // Warm up GPS on mount
    startGps();

    return () => {
      document.head.removeChild(css);
      document.body.removeChild(script);
      stopGps();
    };
  }, [startGps]);

  // ── Controles ──
  const handleStart = () => {
    startTimeRef.current = Date.now();
    pausedElapsedRef.current = 0;
    gpsPointsRef.current = [];
    distanceRef.current = 0;
    nextSplitKmRef.current = 1;
    firedMilestonesRef.current = new Set();
    setSplits([]);
    setDistance(0);
    setElapsed(0);
    setCurrentPace(0);
    setCalories(0);
    setWorkoutState('running');
    showAura(AURA_MESSAGES.start);
  };

  const handlePause = () => {
    pausedElapsedRef.current += Date.now() - startTimeRef.current;
    setWorkoutState('paused');
  };

  const handleResume = () => {
    startTimeRef.current = Date.now();
    setWorkoutState('running');
  };

  const handleFinish = () => {
    stopGps();
    if (timerRef.current) clearInterval(timerRef.current);
    setWorkoutState('finished');
  };

  // ── Tela de resumo ──
  if (workoutState === 'finished') {
    const totalPaceSec = distance > 0 ? (elapsed / 1000) / distance : 0;
    return (
      <div className={styles.summaryScreen}>
        <div className={styles.summaryHeader}>
          <h1>🏁 Treino Concluído!</h1>
          <p>Aqui está o seu resumo da sessão</p>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.summaryMainStat}>
            <span className={styles.summaryBig}>{formatKm(distance)}</span>
            <span className={styles.summaryUnit}>km</span>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryVal}>{formatTime(elapsed)}</span>
              <span className={styles.summaryLbl}>Tempo</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryVal}>{formatPace(totalPaceSec)}</span>
              <span className={styles.summaryLbl}>Ritmo Médio</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryVal}>{calories}</span>
              <span className={styles.summaryLbl}>kcal</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryVal}>{splits.length}</span>
              <span className={styles.summaryLbl}>Splits</span>
            </div>
          </div>
        </div>

        {splits.length > 0 && (
          <div className={styles.splitsBox}>
            <h3>Splits por km</h3>
            <div className={styles.splitsList}>
              {splits.map((s) => (
                <div key={s.km} className={styles.splitRow}>
                  <span className={styles.splitKm}>km {s.km}</span>
                  <span className={styles.splitTime}>{formatPace(s.time / 1000)} min/km</span>
                  <span className={styles.splitMs}>{formatTime(s.time)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.summaryActions}>
          <button className={styles.summaryBtn} onClick={() => router.push('/')}>
            🏠 Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // ── Tela principal ──
  const isRunning = workoutState === 'running';
  const isIdle = workoutState === 'idle';
  const isPaused = workoutState === 'paused';

  return (
    <div className={styles.container}>
      {/* Mapa */}
      <div className={styles.mapWrapper}>
        <div ref={mapContainerRef} id="workout-map" className={styles.map} />

        {/* Status GPS */}
        <div className={`${styles.gpsBadge} ${gpsStatus === 'ok' ? styles.gpsOk : gpsStatus === 'error' ? styles.gpsError : ''}`}>
          {gpsStatus === 'waiting' ? '📡 Aguardando GPS...' : gpsStatus === 'ok' ? '📍 GPS OK' : '⚠️ Sem GPS'}
        </div>

        {/* Cronômetro overlay no mapa */}
        <div className={styles.timerOverlay}>
          <span className={styles.timerMain}>{formatTime(elapsed)}</span>
        </div>
      </div>

      {/* Mensagem da Aura */}
      {auraMsg && (
        <div className={styles.auraMessage}>
          <span>🤖 Aura</span>
          <p>{auraMsg}</p>
        </div>
      )}

      {/* Métricas */}
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{formatKm(distance)}</span>
          <span className={styles.metricLabel}>km</span>
        </div>
        <div className={styles.metricDivider} />
        <div className={styles.metric}>
          <span className={styles.metricValue}>{formatPace(currentPace)}</span>
          <span className={styles.metricLabel}>min/km</span>
        </div>
        <div className={styles.metricDivider} />
        <div className={styles.metric}>
          <span className={styles.metricValue}>{calories}</span>
          <span className={styles.metricLabel}>kcal</span>
        </div>
        <div className={styles.metricDivider} />
        <div className={styles.metric}>
          <span className={styles.metricValue}>{splits.length}</span>
          <span className={styles.metricLabel}>splits</span>
        </div>
      </div>

      {/* Splits rápidos */}
      {splits.length > 0 && (
        <div className={styles.splitsBar}>
          {splits.slice(-3).map((s) => (
            <div key={s.km} className={styles.splitChip}>
              km {s.km} · {formatPace(s.time / 1000)}
            </div>
          ))}
        </div>
      )}

      {/* Controles */}
      <div className={styles.controls}>
        {isIdle && (
          <button className={styles.startBtn} onClick={handleStart}>
            ▶ Iniciar Treino
          </button>
        )}

        {isRunning && (
          <>
            <button className={styles.secondaryBtn} onClick={handlePause}>⏸ Pausar</button>
            <button className={styles.finishBtn} onClick={handleFinish}>■ Finalizar</button>
          </>
        )}

        {isPaused && (
          <>
            <button className={styles.startBtn} onClick={handleResume}>▶ Retomar</button>
            <button className={styles.finishBtn} onClick={handleFinish}>■ Finalizar</button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
