import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActivities } from '@/lib/strava';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('strava_token')?.value;

    let activityContext = "O usuário ainda não conectou o Strava ou não há atividades recentes.";
    
    if (token) {
      const activities = await getActivities(token);
      if (Array.isArray(activities) && activities.length > 0) {
        const summary = activities.slice(0, 10).map((a: any) => ({
          nome: a.name,
          distancia: (a.distance / 1000).toFixed(2) + "km",
          data: new Date(a.start_date).toLocaleDateString('pt-BR'),
          ritmo: a.average_speed ? (16.666 / a.average_speed).toFixed(2) + " min/km" : "N/A"
        }));
        activityContext = `Aqui estão as últimas atividades do usuário no Strava: ${JSON.stringify(summary)}. 
        USE ESSES DADOS para responder perguntas sobre quilometragem, ritmo e progresso. 
        Se o usuário perguntar "quanto corri essa semana", calcule com base nessas datas.`;
      }
    }

    const systemPrompt = {
      role: "system",
      content: `Você é a Aura, uma treinadora de corrida de elite, técnica, motivadora e expert em fisiologia do exercício.
      Sua personalidade é encorajadora mas profissional. 
      CONTEXTO ATUAL DO ATLETA: ${activityContext}
      
      REGRAS:
      1. Use os dados acima para dar respostas precisas.
      2. Se o usuário perguntar sobre volume semanal, some as distâncias das atividades dos últimos 7 dias.
      3. Responda em Português do Brasil.
      4. Seja concisa mas técnica (fale de pace, zonas de FC, cadência se necessário).`
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [systemPrompt, ...messages],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    return NextResponse.json({ message: data.choices[0].message.content });
  } catch (error) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: "Erro ao processar sua mensagem." }, { status: 500 });
  }
}
