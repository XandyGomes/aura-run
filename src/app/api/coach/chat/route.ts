import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callAI } from '@/lib/ai';

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

// Monta um contexto completo e rico para a IA
function buildStravaContext(activities: any[]): string {
  if (!activities.length) return 'Usuário sem atividades registradas no Strava.';

  const runs = activities.filter((a) => a.type === 'Run' || a.sport_type === 'Run');

  if (runs.length === 0) return 'Usuário não possui corridas registradas no Strava.';

  // ── Estatísticas gerais ───────────────────────────────────────────
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

  // ── Médias por mês (últimos 6 meses) ─────────────────────────────
  const monthly: Record<string, { count: number; km: number; sec: number }> = {};
  runs.forEach((a) => {
    const d = new Date(a.start_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) monthly[key] = { count: 0, km: 0, sec: 0 };
    monthly[key].count++;
    monthly[key].km += (a.distance || 0) / 1000;
    monthly[key].sec += a.moving_time || 0;
  });

  const monthlyLines = Object.entries(monthly)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .map(([month, s]) => {
      const pace = s.km > 0 ? ((s.sec / 60) / s.km).toFixed(1) : 'N/A';
      return `  ${month}: ${s.count} corridas | ${s.km.toFixed(1)}km | ritmo médio ${pace}min/km`;
    })
    .join('\n');

  // ── Últimas 30 corridas (detalhe) ─────────────────────────────────
  const recentLines = runs.slice(0, 30).map((a) => {
    const km = (a.distance / 1000).toFixed(2);
    const min = Math.floor(a.moving_time / 60);
    const pace = a.distance > 0 ? ((a.moving_time / 60) / (a.distance / 1000)).toFixed(1) : 'N/A';
    const hr = a.average_heartrate ? ` | FC ${Math.round(a.average_heartrate)}bpm` : '';
    const elev = a.total_elevation_gain ? ` | +${Math.round(a.total_elevation_gain)}m` : '';
    const date = new Date(a.start_date).toLocaleDateString('pt-BR');
    return `  [${date}] ${a.name} — ${km}km em ${min}min | ${pace}min/km${hr}${elev}`;
  }).join('\n');

  return `📊 HISTÓRICO COMPLETO NO STRAVA (${runs.length} corridas no total)

═══ ESTATÍSTICAS GERAIS ═══
• Total de corridas: ${runs.length}
• Distância total acumulada: ${totalKm.toFixed(1)}km
• Tempo total: ${(totalSec / 3600).toFixed(1)}h
• Ganho de elevação total: ${totalElev.toFixed(0)}m
• Ritmo médio geral: ${avgPaceSec.toFixed(1)}min/km
• Corrida mais longa: ${longestRun.toFixed(2)}km
• Melhor ritmo registrado: ${fastestPaceRun.pace.toFixed(1)}min/km (${fastestPaceRun.name}, ${new Date(fastestPaceRun.date).toLocaleDateString('pt-BR')})
• Período de dados: ${new Date(runs[runs.length - 1].start_date).toLocaleDateString('pt-BR')} até hoje

═══ EVOLUÇÃO POR MÊS (últimos 6 meses) ═══
${monthlyLines}

═══ ÚLTIMAS 30 CORRIDAS (detalhe) ═══
${recentLines}`;
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('strava_token')?.value;

    // Busca TODAS as atividades do Strava
    let stravaContext = 'O usuário ainda não conectou o Strava.';
    if (token) {
      try {
        const activities = await fetchAllActivities(token);
        stravaContext = buildStravaContext(activities);
      } catch (e) {
        console.error('[Chat] Erro ao buscar atividades:', e);
        stravaContext = 'Não foi possível carregar as atividades do Strava neste momento.';
      }
    }

    const hoje = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });

    const systemMessage = {
      role: 'system' as const,
      content: `Você é a Aura, uma treinadora de corrida de elite com IA. Hoje é ${hoje}.

Você tem acesso COMPLETO ao histórico de corridas do atleta no Strava. Use esses dados para responder qualquer pergunta sobre performance, evolução, recordes, volume de treino, etc.

${stravaContext}

INSTRUÇÕES:
- Responda SEMPRE em português do Brasil
- Seja técnica, motivadora e baseada nos dados reais do atleta
- Quando responder sobre estatísticas, cite os números exatos dos dados acima
- Se o atleta perguntar sobre uma corrida específica, busque nos dados
- Se não encontrar a informação nos dados, diga que não há esse registro no Strava`,
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
    console.error('[Chat] Erro:', error);
    return NextResponse.json({
      reply: 'Ops, tive um problema técnico. Pode tentar de novo?',
    });
  }
}
