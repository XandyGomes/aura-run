import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';

export const dynamic = 'force-dynamic';

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

  const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const athlete = athleteRes.ok ? await athleteRes.json() : null;

  const statsData = athlete
    ? await fetch(`https://www.strava.com/api/v3/athletes/${athlete.id}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : null)
    : null;

  const totalKm = statsData?.all_run_totals?.distance ? (statsData.all_run_totals.distance / 1000) : 0;
  const totalRuns = statsData?.all_run_totals?.count ?? 0;
  const totalHours = statsData?.all_run_totals?.moving_time ? Math.floor(statsData.all_run_totals.moving_time / 3600) : 0;
  const ytdKm = statsData?.ytd_run_totals?.distance ? (statsData.ytd_run_totals.distance / 1000) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Hero header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,77,0,0.15) 0%, transparent 100%)',
        padding: '52px 20px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ position: 'relative' }}>
          {athlete?.profile_medium ? (
            <Image src={athlete.profile_medium} alt={athlete.firstname} width={96} height={96}
              style={{ borderRadius: '50%', border: '3px solid #FF4D00', objectFit: 'cover', boxShadow: '0 0 24px rgba(255,77,0,0.4)' }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg, #FF4D00, #FF9240)', boxShadow: '0 0 24px rgba(255,77,0,0.4)' }} />
          )}
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, background: '#FC4C02', borderRadius: '50%', border: '2px solid #080810', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>S</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', marginBottom: '6px' }}>{athlete?.firstname} {athlete?.lastname}</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>
            {[athlete?.city, athlete?.country].filter(Boolean).join(', ') || 'Atleta Strava'}
          </p>
        </div>

        {/* Follower stats */}
        <div style={{ display: 'flex', gap: '32px', marginTop: '4px' }}>
          {[
            { label: 'Seguidores', value: athlete?.follower_count ?? '—' },
            { label: 'Seguindo', value: athlete?.friend_count ?? '—' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'white' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>

        {/* All-time stats */}
        <div>
          <p className="label" style={{ marginBottom: '12px' }}>Estatísticas de Corrida</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {[
              { label: 'Total km', value: `${totalKm.toFixed(0)} km`, icon: '🛣️' },
              { label: 'Total Corridas', value: totalRuns, icon: '🏃' },
              { label: 'Horas Correndo', value: `${totalHours}h`, icon: '⏱️' },
              { label: `km em ${new Date().getFullYear()}`, value: `${ytdKm.toFixed(0)} km`, icon: '📅' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '16px' }}>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>{s.icon}</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#FF4D00', marginBottom: '3px' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <p className="label" style={{ marginBottom: '12px' }}>Acesso Rápido</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { href: '/races', label: '🏁 Minhas Corridas', sub: 'Gerencie seu calendário de provas' },
              { href: '/plan', label: '📋 Planilha de Treino', sub: 'Monte seu plano para a próxima prova' },
              { href: '/stats', label: '📊 Estatísticas', sub: 'Veja sua evolução detalhada' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{item.sub}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Account */}
        <div>
          <p className="label" style={{ marginBottom: '12px' }}>Conta</p>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
            <Link href="/api/auth/strava/login" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '18px' }}>🔄</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#FF4D00' }}>Reconectar Strava</span>
            </Link>
            <Link href="/api/auth/logout" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
              <span style={{ fontSize: '18px' }}>🚪</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>Sair</span>
            </Link>
          </div>
        </div>

        <div style={{ textAlign: 'center', paddingTop: '8px' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px', fontWeight: '700', textTransform: 'uppercase' }}>BY XANDY GOMES</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
