const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const buildPrompt = (activities: any[]) => {
  const runningActivities = activities.filter((a: any) => 
    a.type === 'Run' || a.sport_type === 'Run'
  );

  if (runningActivities.length === 0) return { prompt: '', error: "Nenhuma corrida encontrada no seu histórico." };

  const totalStats = runningActivities.reduce((acc: any, a: any) => ({
    totalDistance: acc.totalDistance + (a.distance || 0),
    totalTime: acc.totalTime + (a.moving_time || 0),
    count: acc.count + 1,
  }), { totalDistance: 0, totalTime: 0, count: 0 });

  const avgPace = totalStats.count > 0 
    ? (totalStats.totalTime / (totalStats.totalDistance / 1000)).toFixed(0) 
    : 0;

  const last30Days = runningActivities.filter((a: any) => {
    const activityDate = new Date(a.start_date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return activityDate >= thirtyDaysAgo;
  });

  const last30Km = last30Days.reduce((sum: number, a: any) => sum + (a.distance || 0), 0) / 1000;
  const weeklyAvg = (last30Km / 4).toFixed(1);

  const summary = runningActivities.slice(0, 30).map((a: any) => ({
    name: a.name,
    distance: (a.distance / 1000).toFixed(2) + 'km',
    moving_time: (a.moving_time / 60).toFixed(0) + 'min',
    pace: a.distance > 0 ? ((a.moving_time / 60) / (a.distance / 1000)).toFixed(1) + 'min/km' : 'N/A',
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    elevation: a.total_elevation_gain ? Math.round(a.total_elevation_gain) + 'm' : null,
    date: new Date(a.start_date).toLocaleDateString('pt-BR'),
  }));

  const prompt = `Você é a Aura, uma treinadora de corrida de elite com IA.
Analise TODO o histórico de corridas deste atleta e crie um treino específico para HOJE.

📊 ESTATÍSTICAS GERAIS:
- Total de corridas: ${totalStats.count}
- Distância total: ${(totalStats.totalDistance / 1000).toFixed(1)}km
- Tempo total: ${(totalStats.totalTime / 3600).toFixed(1)}h
- Ritmo médio: ${avgPace} min/km
- Distância últimos 30 dias: ${last30Km.toFixed(1)}km
- Média semanal: ${weeklyAvg}km

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

  return { prompt, error: null };
};

const callGroq = async (prompt: string): Promise<string> => {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  throw new Error('Empty response from Groq');
};

const callGemini = async (prompt: string): Promise<string> => {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }
  throw new Error('Empty response from Gemini');
};

export const generateTrainingSuggestion = async (activities: any[]) => {
  if (!activities || activities.length === 0) return "Comece a correr para que eu possa analisar sua performance!";

  const { prompt, error } = buildPrompt(activities);
  if (error) return error;

  if (!GROQ_API_KEY && !GEMINI_API_KEY) {
    return "Configuração pendente: Insira GROQ_API_KEY ou GEMINI_API_KEY no arquivo .env.local";
  }

  let lastError = '';

  if (GROQ_API_KEY) {
    try {
      return await callGroq(prompt);
    } catch (err: any) {
      console.warn('Groq failed, trying Gemini:', err.message);
      lastError = err.message;
    }
  }

  if (GEMINI_API_KEY) {
    try {
      return await callGemini(prompt);
    } catch (err: any) {
      console.error('Gemini also failed:', err.message);
      lastError = err.message;
    }
  }

  return `Erro com ambas as IAs. Verifique suas chaves de API. (Último erro: ${lastError})`;
};
