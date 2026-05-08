import styles from "./page.module.css";
import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import { generateTrainingSuggestion } from '@/lib/gemini';
import BottomNav from '@/components/BottomNav';

async function getActivitiesData(token: string) {
  const after = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);
  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=10&after=${after}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

async function getAthleteProfile(token: string) {
  const res = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('strava_token')?.value;

  if (!token) {
    return (
      <div className={styles.container} style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className="animate-fade-in" style={{ marginBottom: '24px' }}>
          <Image
            src="/logo.png"
            alt="Aura Run Logo"
            width={120}
            height={120}
            style={{ borderRadius: '24px', boxShadow: '0 10px 30px rgba(252, 76, 2, 0.3)' }}
          />
        </div>
        <h1 className="text-gradient-primary" style={{ marginBottom: '16px', fontSize: '40px' }}>Aura Run</h1>
        <p style={{ marginBottom: '40px', color: 'var(--text-dim)' }}>Conecte seu Strava para que a Aura possa analisar seus treinos e criar planilhas inteligentes para você.</p>
        <Link href="/api/auth/strava/login" className="btn-primary" style={{ display: 'inline-block', padding: '16px 32px' }}>
          Conectar com Strava
        </Link>
      </div>
    );
  }

  const [activities, athlete] = await Promise.all([
    getActivitiesData(token),
    getAthleteProfile(token),
  ]);

  const userName = athlete?.firstname || 'Atleta';
  const userPhoto = athlete?.profile_medium || athlete?.profile || '';

  // Distância real dos últimos 7 dias
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyDist = activities
    ? activities
        .filter((a: any) => new Date(a.start_date).getTime() > oneWeekAgo)
        .reduce((acc: number, curr: any) => acc + curr.distance, 0) / 1000
    : 0;

  // Treino gerado pela IA
  let aiWorkout = "Analisando seus treinos para gerar a melhor recomendação...";
  if (activities && activities.length > 0) {
    aiWorkout = await generateTrainingSuggestion(activities);
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={`${styles.header} animate-fade-in`}>
        <div className={styles.profileInfo}>
          <div className={styles.avatar}>
            {userPhoto ? (
              <Image
                src={userPhoto}
                alt={`Foto de ${userName}`}
                width={48}
                height={48}
                style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid #FC4C02' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #FC4C02, #FF9500)', borderRadius: '50%' }}></div>
            )}
          </div>
          <div>
            <p className={styles.greeting}>Bem-vindo de volta,</p>
            <h2 className={styles.userName}>{userName}</h2>
          </div>
        </div>
        <div className="glass" style={{ padding: '8px', borderRadius: '12px' }}>
          <span style={{ fontSize: '20px' }}>🔔</span>
        </div>
      </header>

      {/* Stats Summary */}
      <section className={`${styles.statsGrid} animate-fade-in`} style={{ animationDelay: '0.1s' }}>
        <div className={`${styles.statCard} glass-card`}>
          <span className={styles.statLabel}>Distância (7 dias)</span>
          <div className={styles.statValue}>
            {weeklyDist.toFixed(1)} <span className={styles.statUnit}>km</span>
          </div>
        </div>
        <div className={`${styles.statCard} glass-card`}>
          <span className={styles.statLabel}>Atividades (7 dias)</span>
          <div className={styles.statValue}>
            {activities
              ? activities.filter((a: any) => new Date(a.start_date).getTime() > oneWeekAgo).length
              : 0}
            <span className={styles.statUnit}> corridas</span>
          </div>
        </div>
      </section>

      {/* AI Coach */}
      <section className={`${styles.aiSection} animate-fade-in`} style={{ animationDelay: '0.2s' }}>
        <div className={`${styles.aiCard} glass-card`}>
          <div className={styles.aiTitle}>
            <span>✨</span>
            <span>Seu Treino Aura para Hoje</span>
          </div>
          <div style={{ margin: '16px 0', borderLeft: '2px solid var(--secondary)', paddingLeft: '12px' }}>
            <div className={styles.aiSuggestion} style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {aiWorkout}
            </div>
          </div>
          <Link href="/workout" className="btn-ai" style={{ width: '100%', display: 'block', textAlign: 'center' }}>
            Iniciar Treino
          </Link>
        </div>
      </section>

      {/* Race Plan Card */}
      <section className="animate-fade-in" style={{ animationDelay: '0.25s', marginBottom: '24px' }}>
        <Link href="/plan" style={{ textDecoration: 'none', display: 'block' }}>
          <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.1) 0%, rgba(0,114,255,0.1) 100%)', border: '1px solid rgba(0,242,255,0.3)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '40px' }}>🎯</div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>Planilha para Prova</h3>
              <p style={{ fontSize: '13px', lineHeight: '1.4' }}>Treinar para uma corrida? A Aura monta sua planilha semana a semana baseada no seu histórico.</p>
            </div>
            <span style={{ fontSize: '20px', color: 'var(--secondary)', marginLeft: 'auto' }}>→</span>
          </div>
        </Link>
      </section>

      {/* Recent Activities */}
      <section style={{ animationDelay: '0.3s' }}>
        <div className={styles.sectionTitle}>
          <span>Suas Atividades</span>
          <Link href="#" className={styles.seeAll}>Ver tudo</Link>
        </div>
        <div className={styles.activityList}>
          {activities && activities.length > 0 ? (
            activities.map((act: any) => (
              <div key={act.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600' }}>{act.name}</h4>
                  <p style={{ fontSize: '13px' }}>{(act.distance / 1000).toFixed(2)} km • {act.type}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700' }}>
                    {Math.floor(act.moving_time / 60)}:{(act.moving_time % 60).toString().padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    {new Date(act.start_date).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Nenhuma atividade neste período.</p>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
