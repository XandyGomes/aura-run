import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callAI } from '@/lib/ai';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Busca TODAS as atividades do Strava com paginação (máx 1000)
async function fetchAllActivities(token: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;

  while (page <= 5) { // 5 páginas × 200 = até 1000 atividades
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) break;

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    all.push(...batch);
    if (batch.length < 200) break; // última página
    page++;
  }

  return all;
}

// Busca treinos gravados diretamente no aplicativo via Supabase
async function fetchLocalWorkouts(athleteId: number): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('recorded_workouts')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return (data || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      type: 'Run',
      sport_type: 'Run',
      distance: w.distance * 1000, // metros
      moving_time: w.moving_time,
      elapsed_time: Math.floor(w.elapsed_time / 1000),
      total_elevation_gain: 0,
      start_date: w.start_date,
      average_speed: w.moving_time > 0 ? (w.distance * 1000) / w.moving_time : 0,
      is_local: true,
    }));
  } catch (err) {
    console.error('[Chat] Erro ao buscar treinos do Supabase para a IA:', err);
    return [];
  }
}

// Monta um contexto completo e rico para a IA
function buildStravaContext(activities: any[]): string {
  if (!activities.length) return 'Usuário sem atividades registradas no Strava.';

  const runs = activities.filter(
    (a) => a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun'
  );
  const rides = activities.filter(
    (a) =>
      a.type === 'Ride' ||
      a.sport_type === 'Ride' ||
      a.sport_type === 'MountainBikeRide' ||
      a.sport_type === 'GravelRide' ||
      a.sport_type === 'EBikeRide'
  );

  let context = '📊 RESUMO DAS ATIVIDADES NO STRAVA\n\n';

  // ── CORRIDAS (RUNS) ───────────────────────────────────────────────
  if (runs.length > 0) {
    const totalKm = runs.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
    const totalSec = runs.reduce((s, a) => s + (a.moving_time || 0), 0);
    const totalElev = runs.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);
    const avgPaceSec = totalKm > 0 ? (totalSec / 60) / totalKm : 0;
    const longestRun = Math.max(...runs.map((a) => a.distance || 0)) / 1000;
    const fastestPaceRun = runs
      .filter((a) => a.distance > 0)
      .reduce((best, a) => {
        const pace = (a.moving_time / 60) / (a.distance / 1000);
        return pace < best.pace ? { pace, name: a.name, date: a.start_date } : best;
      }, { pace: Infinity, name: '', date: '' });

    context += `🏃 CORRIDAS:
• Total de corridas: ${runs.length}
• Distância total: ${totalKm.toFixed(1)}km
• Tempo total: ${(totalSec / 3600).toFixed(1)}h
• Ritmo médio geral: ${avgPaceSec.toFixed(1)}min/km
• Corrida mais longa: ${longestRun.toFixed(2)}km
• Ganho de elevação acumulado: ${totalElev.toFixed(0)}m
• Melhor ritmo: ${fastestPaceRun.pace !== Infinity ? `${fastestPaceRun.pace.toFixed(1)}min/km (${fastestPaceRun.name}, ${new Date(fastestPaceRun.date).toLocaleDateString('pt-BR')})` : 'N/A'}\n\n`;
  } else {
    context += `🏃 CORRIDAS:\n• Nenhuma corrida registrada.\n\n`;
  }

  // ── PEDALADAS (RIDES) ─────────────────────────────────────────────
  if (rides.length > 0) {
    const totalKm = rides.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
    const totalSec = rides.reduce((s, a) => s + (a.moving_time || 0), 0);
    const totalElev = rides.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);
    const avgSpeed = totalSec > 0 ? (totalKm / (totalSec / 3600)) : 0;
    const longestRide = Math.max(...rides.map((a) => a.distance || 0)) / 1000;
    const fastestSpeedRide = rides.reduce((best, a) => {
      const speed = (a.average_speed || 0) * 3.6;
      return speed > best.speed ? { speed, name: a.name, date: a.start_date } : best;
    }, { speed: 0, name: '', date: '' });

    context += `🚴 PEDALADAS / CICLISMO:
• Total de pedaladas: ${rides.length}
• Distância total: ${totalKm.toFixed(1)}km
• Tempo total: ${(totalSec / 3600).toFixed(1)}h
• Ganho de elevação total: ${totalElev.toFixed(0)}m
• Velocidade média geral: ${avgSpeed.toFixed(1)}km/h
• Pedalada mais longa: ${longestRide.toFixed(2)}km
• Melhor velocidade média: ${fastestSpeedRide.speed > 0 ? `${fastestSpeedRide.speed.toFixed(1)}km/h (${fastestSpeedRide.name}, ${new Date(fastestSpeedRide.date).toLocaleDateString('pt-BR')})` : 'N/A'}\n\n`;
  } else {
    context += `🚴 PEDALADAS / CICLISMO:\n• Nenhuma pedalada registrada.\n\n`;
  }

  // ── OUTRAS ATIVIDADES ─────────────────────────────────────────────
  const otherActs = activities.filter(
    (a) =>
      a.type !== 'Run' && a.sport_type !== 'Run' && a.sport_type !== 'TrailRun' &&
      a.type !== 'Ride' && a.sport_type !== 'Ride' && a.sport_type !== 'MountainBikeRide' && a.sport_type !== 'GravelRide' && a.sport_type !== 'EBikeRide'
  );
  if (otherActs.length > 0) {
    const totalKm = otherActs.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
    const totalSec = otherActs.reduce((s, a) => s + (a.moving_time || 0), 0);
    context += `💪 OUTRAS ATIVIDADES (Caminhada, Natação, Funcional, etc.):
• Total de outras atividades: ${otherActs.length}
• Distância total: ${totalKm.toFixed(1)}km
• Tempo total: ${(totalSec / 3600).toFixed(1)}h\n\n`;
  }

  // ── EVOLUÇÃO POR MÊS (últimos 6 meses) ──
  const monthly: Record<string, { runCount: number; runKm: number; rideCount: number; rideKm: number }> = {};
  activities.forEach((a) => {
    const isRun = a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun';
    const isRide = a.type === 'Ride' || a.sport_type === 'Ride' || a.sport_type === 'MountainBikeRide' || a.sport_type === 'GravelRide' || a.sport_type === 'EBikeRide';
    if (!isRun && !isRide) return;

    const d = new Date(a.start_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) monthly[key] = { runCount: 0, runKm: 0, rideCount: 0, rideKm: 0 };
    
    if (isRun) {
      monthly[key].runCount++;
      monthly[key].runKm += (a.distance || 0) / 1000;
    } else if (isRide) {
      monthly[key].rideCount++;
      monthly[key].rideKm += (a.distance || 0) / 1000;
    }
  });

  const monthlyLines = Object.entries(monthly)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .map(([month, s]) => {
      const parts = [];
      if (s.runCount > 0) parts.push(`🏃 ${s.runCount} corridas (${s.runKm.toFixed(1)}km)`);
      if (s.rideCount > 0) parts.push(`🚴 ${s.rideCount} pedais (${s.rideKm.toFixed(1)}km)`);
      return `  ${month}: ${parts.join(' | ') || 'Sem atividades'}`;
    })
    .join('\n');

  if (monthlyLines) {
    context += `═══ EVOLUÇÃO POR MÊS (últimos 6 meses) ═══\n${monthlyLines}\n\n`;
  }

  // ── ÚLTIMAS 30 ATIVIDADES (detalhe) ───────────────────────────────
  const recentActs = activities.slice(0, 30);
  const recentLines = recentActs.map((a) => {
    const isRun = a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun';
    const isRide = a.type === 'Ride' || a.sport_type === 'Ride' || a.sport_type === 'MountainBikeRide' || a.sport_type === 'GravelRide' || a.sport_type === 'EBikeRide';
    
    const icon = isRun ? '🏃' : isRide ? '🚴' : '🏅';
    const km = (a.distance / 1000).toFixed(2);
    const min = Math.floor(a.moving_time / 60);
    
    let performance = '';
    if (isRun) {
      const pace = a.distance > 0 ? ((a.moving_time / 60) / (a.distance / 1000)).toFixed(1) : 'N/A';
      performance = `${pace}min/km`;
    } else if (isRide) {
      const speed = a.moving_time > 0 ? ((a.distance / 1000) / (a.moving_time / 3600)).toFixed(1) : 'N/A';
      performance = `${speed}km/h`;
    } else {
      performance = `${min}min`;
    }

    const hr = a.average_heartrate ? ` | FC ${Math.round(a.average_heartrate)}bpm` : '';
    const elev = a.total_elevation_gain ? ` | +${Math.round(a.total_elevation_gain)}m` : '';
    const date = new Date(a.start_date).toLocaleDateString('pt-BR');
    
    return `  ${icon} [${date}] ${a.name} — ${km}km em ${min}min | ${performance}${hr}${elev}`;
  }).join('\n');

  context += `═══ ÚLTIMAS 30 ATIVIDADES (detalhe) ═══\n${recentLines}`;

  return context;
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('strava_token')?.value;
    const athleteId = cookieStore.get('strava_athlete_id')?.value;

    // Busca atividades do Strava e do Supabase
    let stravaContext = 'O usuário ainda não possui treinos cadastrados.';
    if (token || athleteId) {
      try {
        const stravaActivities = token ? await fetchAllActivities(token) : [];
        const localActivities = athleteId ? await fetchLocalWorkouts(Number(athleteId)) : [];
        
        const combined = [...localActivities, ...stravaActivities].sort(
          (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );
        
        stravaContext = buildStravaContext(combined);
      } catch (e) {
        console.error('[Chat] Erro ao buscar atividades:', e);
        stravaContext = 'Não foi possível carregar o histórico de atividades neste momento.';
      }
    }

    const hoje = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });

    const systemMessage = {
      role: 'system' as const,
      content: `Você é a Aura, uma treinadora de esportes de elite com IA, especialista tanto em corrida quanto em ciclismo (pedais) e condicionamento físico. Hoje é ${hoje}.

Você tem acesso COMPLETO ao histórico de atividades do atleta (corridas, pedaladas, etc., obtidos via Strava ou gravados diretamente pelo aplicativo com GPS). Use esses dados para responder qualquer pergunta sobre performance, evolução, recordes, volume de treino, dicas de ritmo ou velocidade, etc.

${stravaContext}

INSTRUÇÕES:
- Responda SEMPRE em português do Brasil
- Seja técnica, motivadora e baseada nos dados reais do atleta
- Quando responder sobre estatísticas, cite os números exatos e unidades apropriadas (ex: min/km para corrida, km/h para pedaladas/ciclismo)
- Se o atleta perguntar sobre uma atividade específica, busque nos dados
- Se não encontrar a informação nos dados, diga que não há esse registro no Strava ou gravado no aplicativo`,
    };

    // Converte mensagens para formato padrão
    const formattedMessages = messages.map((m: any) => ({
      role: (m.role === 'aura' ? 'assistant' : m.role) as 'user' | 'assistant',
      content: m.content,
    }));

    // Chama a IA com fallback automático Groq → Gemini
    const reply = await callAI([systemMessage, ...formattedMessages], 1000);
    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error('[Chat] Erro detalhado:', error?.message || error);

    let friendlyMsg = 'Ops, tive um problema técnico. Pode tentar de novo?';

    if (error?.message?.includes('GROQ') || error?.message?.includes('Groq')) {
      friendlyMsg = '⚠️ Serviço de IA temporariamente indisponível. Estou tentando me recuperar...';
    } else if (error?.message?.includes('GEMINI') || error?.message?.includes('Gemini')) {
      friendlyMsg = '⚠️ Serviço de IA com instabilidade. Tente novamente em instantes.';
    } else if (error?.message?.includes('chave') || error?.message?.includes('API')) {
      friendlyMsg = '🔧 IA não configurada. Verifique as chaves GROQ_API_KEY e GEMINI_API_KEY no servidor.';
    }

    return NextResponse.json({ reply: friendlyMsg });
  }
}
