import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { imageBase64, mimeType = 'image/jpeg' } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Imagem não fornecida' }, { status: 400 });
    }

    const prompt = `Você é um assistente que analisa painéis de esteiras ergométricas.
Analise a imagem do painel da esteira e extraia os seguintes dados com precisão máxima.

Retorne APENAS um JSON válido com este formato exato (sem markdown, sem texto extra):
{
  "distance": <número em km, ex: 3.5>,
  "time": <tempo em segundos, ex: 1800 para 30 minutos>,
  "speed": <velocidade em km/h, ex: 9.5>,
  "calories": <calorias, ex: 280>,
  "incline": <inclinação em %, ex: 2.0>,
  "confidence": <0 a 1, indica quão certo você está dos dados>
}

Se um campo não estiver visível no painel, use null.
Converta o tempo para segundos: se vir "30:00" = 1800 segundos.
Se a distância estiver em milhas, converta para km (1 milha = 1.609 km).`;

    const tryModel = async (model: string) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: imageBase64 } },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
          }),
        }
      );
      if (!response.ok) throw new Error(`Model ${model} error: ${response.status}`);
      return response;
    };

    let response;
    try {
      response = await tryModel('gemini-2.5-flash-preview-05-20');
    } catch {
      response = await tryModel('gemini-2.0-flash');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Resposta vazia da IA');
    }

    // Extrai JSON da resposta (remove possíveis backticks de markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('IA não retornou JSON válido');
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, data: extracted });
  } catch (err: any) {
    console.error('[Treadmill Scan] Erro:', err.message);
    return NextResponse.json({ error: err.message || 'Erro ao processar imagem' }, { status: 500 });
  }
}
