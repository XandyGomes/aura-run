import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('strava_token')?.value;

    let activityContext = "O usuário ainda não conectou o Strava ou não há atividades recentes.";
    
    if (token) {
      try {
        const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (stravaRes.ok) {
          const activities = await stravaRes.json();
          if (Array.isArray(activities) && activities.length > 0) {
            const summary = activities.map((a: any) => ({
              nome: a.name,
              distancia: (a.distance / 1000).toFixed(2) + "km",
              data: new Date(a.start_date).toLocaleDateString('pt-BR'),
              ritmo: a.average_speed ? (16.666 / a.average_speed).toFixed(2) + " min/km" : "N/A"
            }));
            activityContext = `Últimas atividades do usuário: ${JSON.stringify(summary)}`;
          }
        }
      } catch (e) {
        console.error('Error fetching activities for chat:', e);
        activityContext = "Erro ao buscar dados do Strava, responda de forma genérica.";
      }
    }

    const systemPrompt = {
      role: "system",
      content: `Você é a Aura, uma treinadora de corrida de elite. 
      Dados do Atleta: ${activityContext}
      Responda em Português do Brasil de forma motivadora e técnica.`
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

    if (!groqRes.ok) {
      const errorData = await groqRes.json();
      console.error('Groq API Error:', errorData);
      return NextResponse.json({ message: "Desculpe, tive um problema ao processar sua resposta na Groq. Tente novamente." });
    }

    const data = await groqRes.json();
    return NextResponse.json({ reply: data.choices[0].message.content });
  } catch (error: any) {
    console.error('Full Chat Route Error:', error);
    return NextResponse.json({ reply: "Ocorreu um erro interno no chat. Por favor, tente novamente." }, { status: 200 });
  }
}
