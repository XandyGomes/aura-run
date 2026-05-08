import { NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(request: Request) {
  const { message } = await request.json();

  if (!GROQ_API_KEY) {
    return NextResponse.json({ reply: 'Chave de API não configurada.' }, { status: 500 });
  }

  const systemPrompt = `Você é a Aura, uma treinadora de corrida de elite com IA. 
Você é especialista em treinamento de corrida, fisiologia do exercício, nutrição esportiva e prevenção de lesões.
Responda SEMPRE em português brasileiro de forma técnica mas acessível.
Seja motivadora, empática e objetiva. Máximo de 3 parágrafos por resposta.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Não consegui processar sua pergunta. Tente novamente!';
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Coach chat error:', error);
    return NextResponse.json({ reply: 'Erro de conexão. Tente novamente!' }, { status: 500 });
  }
}
