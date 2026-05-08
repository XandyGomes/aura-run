import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('strava_token')?.value;

  if (!token) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', padding: '20px', textAlign: 'center' }}>
        <h1>Perfil</h1>
        <p>Conecte seu Strava para ver seu perfil.</p>
        <Link href="/api/auth/strava/login" className="btn-primary">Conectar com Strava</Link>
      </div>
    );
  }

  const [athleteRes, statsRes] = await Promise.all([
    fetch('https://www.strava.com/api/v3/athlete', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('https://www.strava.com/api/v3/athletes/stats', { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  const athlete = athleteRes.ok ? await athleteRes.json() : null;
  // Stats endpoint requires athlete ID
  const statsUrl = athlete ? `https://www.strava.com/api/v3/athletes/${athlete.id}/stats` : null;
  const statsData = statsUrl
    ? await fetch(statsUrl, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null)
    : null;

  const totalDist = statsData?.all_run_totals?.distance ? (statsData.all_run_totals.distance / 1000).toFixed(0) : '—';
  const totalRuns = statsData?.all_run_totals?.count ?? '—';
  const ytdDist = statsData?.ytd_run_totals?.distance ? (statsData.ytd_run_totals.distance / 1000).toFixed(0) : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '40px 20px 100px', maxWidth: '500px', margin: '0 auto' }}>
      {/* Profile Header */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '32px 20px' }}>
        {athlete?.profile_medium ? (
          <Image src={athlete.profile_medium} alt={athlete.firstname} width={96} height={96}
            style={{ borderRadius: '50%', border: '3px solid #FC4C02', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(45deg, #FC4C02, #FF9500)' }} />
        )}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>{athlete?.firstname} {athlete?.lastname}</h1>
          <p style={{ fontSize: '14px' }}>{athlete?.city}{athlete?.city && athlete?.country ? ', ' : ''}{athlete?.country}</p>
        </div>
      </div>

      {/* Stats */}
      <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Suas Estatísticas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total km', value: totalDist },
          { label: 'Corridas', value: totalRuns },
          { label: 'km em 2025', value: ytdDist },
        ].map(stat => (
          <div key={stat.label} className="glass-card" style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#FC4C02' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Link href="/api/auth/strava/login" style={{ color: '#FC4C02', fontWeight: '600', fontSize: '15px' }}>
          🔄 Reconectar Strava
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
