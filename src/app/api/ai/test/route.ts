import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, any> = {};

  // ── Testa Groq ──
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    results.groq = { ok: false, error: 'GROQ_API_KEY não configurada' };
  } else {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Responda apenas: OK' }],
          max_tokens: 10,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        results.groq = { ok: false, status: res.status, error: err.slice(0, 200) };
      } else {
        const data = await res.json();
        results.groq = { ok: true, reply: data.choices?.[0]?.message?.content };
      }
    } catch (e: any) {
      results.groq = { ok: false, error: e.message };
    }
  }

  // ── Testa Gemini ──
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    results.gemini = { ok: false, error: 'GEMINI_API_KEY não configurada' };
  } else {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        results.gemini = { ok: false, status: res.status, error: err.slice(0, 200) };
      } else {
        const data = await res.json();
        results.gemini = { ok: true, reply: data.candidates?.[0]?.content?.parts?.[0]?.text };
      }
    } catch (e: any) {
      results.gemini = { ok: false, error: e.message };
    }
  }

  // ── Testa Strava ──
  const stravaId = process.env.STRAVA_CLIENT_ID;
  const stravaSecret = process.env.STRAVA_CLIENT_SECRET;
  results.strava_env = {
    client_id: stravaId ? `${stravaId.slice(0, 4)}...` : 'NÃO CONFIGURADO',
    client_secret: stravaSecret ? `${stravaSecret.slice(0, 4)}...` : 'NÃO CONFIGURADO',
  };

  const allOk = results.groq?.ok || results.gemini?.ok;

  return NextResponse.json({
    status: allOk ? 'OPERACIONAL' : 'COM PROBLEMAS',
    timestamp: new Date().toISOString(),
    ...results,
  });
}
