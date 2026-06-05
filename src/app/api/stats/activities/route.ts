import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('strava_token')?.value;
  const athleteId = cookieStore.get('strava_athlete_id')?.value;

  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const stravaActs: any[] = [];
    let page = 1;
    while (page <= 5) {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      stravaActs.push(...batch);
      if (batch.length < 200) break;
      page++;
    }

    let localActs: any[] = [];
    if (athleteId) {
      const { data, error } = await supabase
        .from('recorded_workouts')
        .select('*')
        .eq('athlete_id', Number(athleteId))
        .order('start_date', { ascending: false });

      if (!error && data) {
        localActs = data.map((w: any) => ({
          id: w.id,
          name: w.name,
          type: 'Run',
          sport_type: 'Run',
          distance: w.distance * 1000, // metros
          moving_time: w.moving_time,
          elapsed_time: Math.floor(w.elapsed_time / 1000),
          total_elevation_gain: 0,
          start_date: w.start_date,
          average_speed: w.moving_time > 0 ? (w.distance * 1000) / w.moving_time : 0, // metros/segundo
          max_speed: w.moving_time > 0 ? (w.distance * 1000) / w.moving_time : 0,
          is_local: true,
        }));
      }
    }

    const combined = [...localActs, ...stravaActs].sort(
      (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );

    return NextResponse.json(combined);
  } catch (err: any) {
    console.error('[Stats API] Erro ao mesclar atividades:', err.message);
    return NextResponse.json([], { status: 500 });
  }
}
