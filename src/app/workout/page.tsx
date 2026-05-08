'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

export default function WorkoutPage() {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else if (!isActive && seconds !== 0) {
      if (interval) clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggle = () => setIsActive(!isActive);
  
  const handleStop = () => {
    if (confirm('Deseja finalizar o treino?')) {
      router.push('/');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.closeBtn} onClick={() => router.push('/')}>✕</button>
        <div className={styles.workoutTitle}>
          <h1>Aura AI Workout</h1>
          <p>Intervalado de Limiar</p>
        </div>
        <div style={{ width: '40px' }}></div> {/* Spacer */}
      </header>

      <div className={styles.timerContainer}>
        <div className={styles.currentStep}>Aquecimento</div>
        <div className={styles.time}>{formatTime(seconds)}</div>
        <div className={styles.nextStep}>Próximo: 4 x 1km @ 4:30</div>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metric}>
          <span className={styles.metricValue}>148</span>
          <span className={styles.metricLabel}>BPM</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>5:12</span>
          <span className={styles.metricLabel}>Ritmo</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>1.2</span>
          <span className={styles.metricLabel}>Dist (km)</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>124</span>
          <span className={styles.metricLabel}>kcal</span>
        </div>
      </div>

      <div className={styles.controls}>
        <button className={styles.stopBtn} onClick={handleStop}>■</button>
        <button className={styles.playPauseBtn} onClick={handleToggle}>
          {isActive ? '⏸' : '▶'}
        </button>
        <button className={styles.stopBtn} style={{ color: 'var(--secondary)' }}>⏭</button>
      </div>

      <div className={styles.progressContainer}>
        <div className={styles.progressBar} style={{ width: '30%' }}></div>
      </div>
      <BottomNav />
    </div>
  );
}
