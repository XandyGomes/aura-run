import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callAI } from '@/lib/ai';

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

export async function POST(request: Request) {
  const { distance, raceDate, goalTime, level, weeklyKm } = await request.json();

  const cookieStore = await cookies();
  let token = cookieStore.get('strava_token')?.value;

  // Busca atividades recentes do Strava para enriquecer o plano
  let activityContext = '';
  if (token) {
    const after = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    let res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=5&after=${after}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        token = cookieStore.get('strava_token')?.value || '';
        res = await fetch(
          `https://www.strava.com/api/v3/athlete/activities?per_page=5&after=${after}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    }

    if (res.ok) {
      const acts = await res.json();
      if (acts.length > 0) {
        activityContext = `\n\nÚltimas atividades do atleta no Strava:\n${acts
          .map((a: any) => `- ${a.name}: ${(a.distance / 1000).toFixed(1)}km em ${(a.moving_time / 60).toFixed(0)}min`)
          .join('\n')}`;
      }
    }
  }

  const weeksUntilRace = Math.max(
    1,
    Math.round((new Date(raceDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
  );

  const prompt = `Você é a Aura, uma treinadora de corrida de elite com IA.
Crie uma planilha de treino COMPLETA e DETALHADA em português para o seguinte atleta:

🎯 OBJETIVO: Prova de ${distance}
📅 Data da prova: ${new Date(raceDate).toLocaleDateString('pt-BR')} (${weeksUntilRace} semanas)
⏱️ Tempo alvo: ${goalTime || 'Completar a prova'}
📊 Nível: ${level}
🏃 Volume semanal atual: ${weeklyKm} km/semana
${activityContext}

Crie uma planilha estruturada com as SEMANAS de treino. Para cada semana inclua:
- Número da semana e foco principal
- Sessões de treino (Segunda a Domingo), especificando:
  • Tipo: Descanso / Rodagem / Intervalado / Longão / Treino Específico
  • Distância ou tempo
  • Ritmo ou zona de frequência cardíaca
- Volume total da semana em km

Use linguagem técnica mas acessível. Inclua semanas de descarga a cada 3-4 semanas.
Finalize com dicas de nutrição e estratégia de prova.`;

  try {
    // Chama a IA com fallback automático Groq → Gemini
    const plan = await callAI([{ role: 'user', content: prompt }], 3000);
    return NextResponse.json({ plan });
  } catch (error: any) {
    console.error('[Plan] Erro na geração do plano:', error);
    return NextResponse.json(
      { plan: 'Erro ao gerar o plano de treino. Verifique as chaves de API.' },
      { status: 500 }
    );
  }
}
