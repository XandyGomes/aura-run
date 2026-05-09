import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function refreshToken(): Promise<boolean> {
  try {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://aura-run.vercel.app' 
      : 'http://localhost:3000';
    const refreshResponse = await fetch(`${baseUrl}/api/auth/strava/refresh`, {
      method: 'POST',
    });
    return refreshResponse.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const { distance, raceDate, goalTime, level, weeklyKm } = await request.json();

  if (!GROQ_API_KEY) {
    return NextResponse.json({ plan: 'Chave de API não configurada.' }, { status: 500 });
  }

  const cookieStore = await cookies();
  let token = cookieStore.get('strava_token')?.value;

  let activityContext = '';
  if (token) {
    const after = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    let res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=5&after=${after}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) {
        token = cookieStore.get('strava_token')?.value || '';
        res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=5&after=${after}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    }
    
    if (res.ok) {
      const acts = await res.json();
      if (acts.length > 0) {
        activityContext = `\n\nÚltimas atividades do atleta no Strava:\n${acts.map((a: any) =>
          `- ${a.name}: ${(a.distance / 1000).toFixed(1)}km em ${(a.moving_time / 60).toFixed(0)}min`
        ).join('\n')}`;
      }
    }
  }

  const weeksUntilRace = Math.max(1, Math.round((new Date(raceDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));

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
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 3000,
      }),
    });

    const data = await response.json();
    const plan = data.choices?.[0]?.message?.content || 'Não consegui gerar o plano. Tente novamente!';
    return NextResponse.json({ plan });
  } catch (error) {
    console.error('Plan generation error:', error);
    return NextResponse.json({ plan: 'Erro de conexão. Tente novamente!' }, { status: 500 });
  }
}
