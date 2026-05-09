import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('strava_token')?.value;

    // Converte os papéis (roles) para o formato que a Groq entende
    const formattedMessages = messages.map((m: any) => ({
      role: m.role === 'aura' ? 'assistant' : m.role,
      content: m.content
    }));

    let activityContext = "O usuário ainda não conectou o Strava ou não há atividades recentes.";
    
    if (token) {
      try {
        const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (stravaRes.ok) {
          const activities = await stravaRes.json();
          if (Array.isArray(activities) && activities.length > 0) {
            const summary = activities.map((a: any) => ({
              nome: a.name,
              distancia: (a.distance / 1000).toFixed(2) + "km",
              data: new Date(a.start_date).toLocaleDateString('pt-BR'),
            }));
            activityContext = `Últimas atividades do usuário: ${JSON.stringify(summary)}`;
          }
        }
      } catch (e) {
        console.error('Strava Fetch Error:', e);
      }
    }

    const systemPrompt = {
      role: "system",
      content: `Você é a Aura, uma treinadora de corrida expert. 
      Dados do Atleta: ${activityContext}
      Responda de forma motivadora e técnica em Português.`
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [systemPrompt, ...formattedMessages],
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      console.error('Groq Error:', data);
      return NextResponse.json({ reply: "Tive um problema técnico com a IA. Pode tentar de novo?" });
    }

    return NextResponse.json({ reply: data.choices[0].message.content });
  } catch (error: any) {
    console.error('Chat Route Error:', error);
    return NextResponse.json({ reply: "Ops, algo deu errado. Vamos tentar de novo?" });
  }
}
