import { NextResponse } from 'next/server';
import { getActivities } from '@/lib/strava';
import { callAI } from '@/lib/ai';
import { cookies } from 'next/headers';

// Desabilita cache para garantir sugestão sempre atualizada
export const dynamic = 'force-dynamic';

const getBaseUrl = () =>
  process.env.NODE_ENV === 'production' ? 'https://aura-run.vercel.app' : 'http://localhost:3000';

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/auth/strava/refresh`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

const buildPrompt = (activities: any[]): string | null => {
  const runs = activities.filter((a: any) => a.type === 'Run' || a.sport_type === 'Run');
  if (runs.length === 0) return null;

  const stats = runs.reduce(
    (acc: any, a: any) => ({
      totalDistance: acc.totalDistance + (a.distance || 0),
      totalTime: acc.totalTime + (a.moving_time || 0),
      count: acc.count + 1,
    }),
    { totalDistance: 0, totalTime: 0, count: 0 }
  );

  const avgPace =
    stats.count > 0 ? (stats.totalTime / (stats.totalDistance / 1000)).toFixed(0) : 0;

  const last30Days = runs.filter((a: any) => {
    const date = new Date(a.start_date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return date >= cutoff;
  });

  const last30Km = last30Days.reduce((s: number, a: any) => s + (a.distance || 0), 0) / 1000;

  const summary = runs.slice(0, 30).map((a: any) => ({
    name: a.name,
    distance: (a.distance / 1000).toFixed(2) + 'km',
    moving_time: (a.moving_time / 60).toFixed(0) + 'min',
    pace:
      a.distance > 0
        ? ((a.moving_time / 60) / (a.distance / 1000)).toFixed(1) + 'min/km'
        : 'N/A',
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    elevation: a.total_elevation_gain ? Math.round(a.total_elevation_gain) + 'm' : null,
    date: new Date(a.start_date).toLocaleDateString('pt-BR'),
  }));

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return `Você é a Aura, uma treinadora de corrida de elite com IA.
Hoje é ${hoje}. Analise TODO o histórico de corridas deste atleta e crie um treino específico para HOJE.

📊 ESTATÍSTICAS GERAIS:
- Total de corridas: ${stats.count}
- Distância total: ${(stats.totalDistance / 1000).toFixed(1)}km
- Tempo total: ${(stats.totalTime / 3600).toFixed(1)}h
- Ritmo médio: ${avgPace} min/km
- Distância últimos 30 dias: ${last30Km.toFixed(1)}km
- Média semanal: ${(last30Km / 4).toFixed(1)}km

🏃 ÚLTIMAS CORRIDAS (até 30):
${JSON.stringify(summary, null, 2)}

Responda em PORTUGUÊS seguindo este formato:
1. TIPO DE TREINO (ex: Intervalado de Velocidade, Rodagem em Zona 2, Treino de Subida)
2. JUSTIFICATIVA (Por que este treino hoje? Baseado nos dados acima)
3. ESTRUTURA DO TREINO:
   - Aquecimento (tempo e intensidade)
   - Parte Principal (detalhe séries, ritmos ou zonas de FC)
   - Desaquecimento (tempo)

Seja técnico, motivador e baseado nos dados reais. Foco em evolução e prevenção de lesões.`;
};

export async function GET() {
  const cookieStore = await cookies();
  let token = cookieStore.get('strava_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    let activities = await getActivities(token);

    // Se o token expirou, tenta renovar
    if (activities.errors || activities.message?.includes('Unauthorized')) {
      const refreshed = await tryRefreshToken();
      if (!refreshed) {
        return NextResponse.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
      }
      token = cookieStore.get('strava_token')?.value || '';
      activities = await getActivities(token);
    }

    const prompt = buildPrompt(activities);
    if (!prompt) {
      return NextResponse.json({ suggestion: 'Nenhuma corrida encontrada no seu histórico.' });
    }

    // Chama a IA com fallback automático Groq → Gemini
    const suggestion = await callAI([{ role: 'user', content: prompt }], 600);
    return NextResponse.json({ suggestion });

  } catch (error: any) {
    console.error('[Suggestion] Erro:', error);
    return NextResponse.json({ error: 'Erro ao gerar sugestão de treino.' }, { status: 500 });
  }
}
