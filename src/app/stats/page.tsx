import { cookies } from 'next/headers';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

export default async function StatsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('strava_token')?.value;

  if (!token) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', padding: '20px', textAlign: 'center' }}>
        <h1>Estatísticas</h1>
        <p>Conecte seu Strava para ver suas estatísticas.</p>
        <Link href="/api/auth/strava/login" className="btn-primary">Conectar com Strava</Link>
      </div>
    );
  }

  // Últimas 8 semanas de atividades
  const after = Math.floor((Date.now() - 56 * 24 * 60 * 60 * 1000) / 1000);
  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=30&after=${after}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const activities = res.ok ? await res.json() : [];

  // Calcula métricas
  const totalDist = activities.reduce((s: number, a: any) => s + a.distance, 0) / 1000;
  const totalTime = activities.reduce((s: number, a: any) => s + a.moving_time, 0) / 60;
  const avgPace = activities.length > 0
    ? activities.reduce((s: number, a: any) => s + (a.moving_time / 60) / (a.distance / 1000), 0) / activities.length
    : 0;
  const avgHR = activities.filter((a: any) => a.average_heartrate).length > 0
    ? Math.round(activities.filter((a: any) => a.average_heartrate).reduce((s: number, a: any) => s + a.average_heartrate, 0) / activities.filter((a: any) => a.average_heartrate).length)
    : null;

  const formatPace = (pace: number) => {
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Agrupar por semana
  const weeklyData: { [key: string]: number } = {};
  activities.forEach((a: any) => {
    const date = new Date(a.start_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    weeklyData[key] = (weeklyData[key] || 0) + a.distance / 1000;
  });
  const weeks = Object.entries(weeklyData).slice(-6);
  const maxWeekDist = Math.max(...weeks.map(([, v]) => v), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '40px 20px 100px', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Estatísticas</h1>
      <p style={{ marginBottom: '28px', fontSize: '14px' }}>Últimas 8 semanas</p>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Distância Total', value: `${totalDist.toFixed(1)} km` },
          { label: 'Tempo Total', value: `${Math.floor(totalTime / 60)}h ${Math.round(totalTime % 60)}min` },
          { label: 'Ritmo Médio', value: avgPace > 0 ? `${formatPace(avgPace)}/km` : '—' },
          { label: 'BPM Médio', value: avgHR ? `${avgHR} bpm` : '—' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#FC4C02' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly Distance Bar Chart */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Distância por Semana</h2>
        {weeks.length === 0 ? (
          <p style={{ textAlign: 'center', fontSize: '14px' }}>Nenhuma atividade no período.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100px' }}>
            {weeks.map(([week, dist]) => (
              <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ fontSize: '10px', color: '#FC4C02', fontWeight: '700' }}>{dist.toFixed(1)}</div>
                <div style={{
                  width: '100%',
                  height: `${(dist / maxWeekDist) * 80}px`,
                  background: 'linear-gradient(to top, #FC4C02, #FF9500)',
                  borderRadius: '6px 6px 0 0',
                  minHeight: '4px',
                }} />
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', textAlign: 'center' }}>{week}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activities List */}
      <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Atividades ({activities.length})</h2>
      {activities.slice(0, 10).map((act: any) => (
        <div key={act.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: '600' }}>{act.name}</h4>
            <p style={{ fontSize: '12px' }}>{(act.distance / 1000).toFixed(2)} km • {new Date(act.start_date).toLocaleDateString('pt-BR')}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: '700' }}>{formatPace((act.moving_time / 60) / (act.distance / 1000))}/km</div>
            {act.average_heartrate && <div style={{ fontSize: '11px', color: '#00E676' }}>❤️ {Math.round(act.average_heartrate)} bpm</div>}
          </div>
        </div>
      ))}

      <BottomNav />
    </div>
  );
}
