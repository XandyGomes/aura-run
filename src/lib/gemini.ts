const GROQ_API_KEY = process.env.GROQ_API_KEY;

export const generateTrainingSuggestion = async (activities: any[]) => {
  if (!GROQ_API_KEY) {
    console.error("ERRO: Variável GROQ_API_KEY não encontrada no .env.local");
    return "Configuração pendente: Insira sua GROQ_API_KEY no arquivo .env.local";
  }

  if (!activities || activities.length === 0) return "Comece a correr para que eu possa analisar sua performance!";

  const summary = activities.slice(0, 5).map((a: any) => ({
    name: a.name,
    distance: (a.distance / 1000).toFixed(2) + 'km',
    moving_time: (a.moving_time / 60).toFixed(0) + 'min',
    avg_hr: a.average_heartrate,
    max_hr: a.max_heartrate,
    date: a.start_date,
  }));

  const prompt = `Você é a Aura, uma treinadora de corrida de elite com IA.
Analise as últimas corridas deste atleta e crie um treino específico para HOJE.

Dados do atleta: ${JSON.stringify(summary, null, 2)}

Responda em PORTUGUÊS seguindo este formato:
1. TIPO DE TREINO (ex: Intervalado de Velocidade, Rodagem em Zona 2, Treino de Subida)
2. JUSTIFICATIVA (Por que este treino hoje? Baseado nos dados acima)
3. ESTRUTURA DO TREINO:
   - Aquecimento (tempo e intensidade)
   - Parte Principal (detalhe séries, ritmos ou zonas de FC)
   - Desaquecimento (tempo)

Seja técnico, motivador e baseado nos dados reais. Foco em evolução e prevenção de lesões.`;

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
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API Error (Status ${response.status}):`, errorText);
      return "Aura está inicializando. Verifique sua GROQ_API_KEY no .env.local!";
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      console.error("Groq API Empty Response:", data);
      return "Aura recebeu uma resposta vazia. Tente novamente!";
    }
  } catch (error) {
    console.error("Erro de conexão com Groq:", error);
    return "Erro de conexão com a IA. Verifique sua internet!";
  }
};
