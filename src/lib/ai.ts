/**
 * Módulo centralizado de IA com fallback automático: Gemini → Groq
 *
 * Usa Gemini 2.5 Flash como primário (melhor qualidade), Groq como fallback.
 */

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/* ── Gemini ── */
const callGemini = async (messages: Message[], maxTokens: number): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado');

  const systemMsg = messages.find(m => m.role === 'system');
  const conversation = messages.filter(m => m.role !== 'system');

  // Garante alternância user/model correta (Gemini exige isso)
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of conversation) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    // Mescla mensagens consecutivas do mesmo role
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += '\n' + m.content;
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }

  // Garante que começa com 'user'
  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '.' }] });
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    // Fallback para gemini-2.0-flash se 2.5 não disponível
    if (response.status === 404 || response.status === 400) {
      return callGeminiFlash(messages, maxTokens);
    }
    throw new Error(`Gemini ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    // Se finishReason for SAFETY ou similar, tenta flash
    const reason = data.candidates?.[0]?.finishReason;
    if (reason && reason !== 'STOP') {
      return callGeminiFlash(messages, maxTokens);
    }
    throw new Error('Resposta vazia do Gemini 2.5');
  }
  return text;
};

/* Fallback para gemini-2.0-flash */
const callGeminiFlash = async (messages: Message[], maxTokens: number): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado');

  const systemMsg = messages.find(m => m.role === 'system');
  const conversation = messages.filter(m => m.role !== 'system');

  const contents = conversation.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: '.' }] });
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Flash ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Resposta vazia do Gemini Flash');
  return text;
};

/* ── Groq (fallback final) ── */
const callGroq = async (messages: Message[], maxTokens: number): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurado');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Resposta vazia do Groq');
  return text;
};

// Estado do disjuntor (circuit breaker) para o Gemini
let isGeminiDisabledUntil = 0;

/**
 * Chama a IA com fallback automático: Gemini 2.5 Flash → Gemini 2.0 Flash → Groq Llama 3.3.
 * @param messages Array de mensagens no formato OpenAI ({role, content})
 * @param maxTokens Máximo de tokens na resposta (padrão: 1000)
 */
export const callAI = async (messages: Message[], maxTokens = 1000): Promise<string> => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    throw new Error('Nenhuma chave de IA configurada. Adicione GEMINI_API_KEY ou GROQ_API_KEY.');
  }

  const now = Date.now();
  const tryGemini = geminiKey && now > isGeminiDisabledUntil;

  // 1. Tenta Gemini 2.5/2.0 se não estiver temporariamente desativado
  if (tryGemini) {
    try {
      return await callGemini(messages, maxTokens);
    } catch (err: any) {
      console.warn('[AI] Gemini falhou, tentando Groq:', err.message);

      // Se falhou por limite de cota (429), erro de autenticação ou chaves inválidas (400/403/401),
      // desativa o Gemini temporariamente por 5 minutos para evitar lentidão nas respostas subsequentes
      const errMsg = err.message || '';
      if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('403') || errMsg.includes('401') || errMsg.includes('billing')) {
        console.warn('[AI] Gemini reportou erro de cota ou faturamento. Desativando Gemini temporariamente para otimizar tempo de resposta.');
        isGeminiDisabledUntil = Date.now() + 5 * 60 * 1000; // 5 minutos de bypass
      }
    }
  }

  // 2. Fallback: Groq Llama 3.3
  if (groqKey) {
    try {
      return await callGroq(messages, maxTokens);
    } catch (err: any) {
      console.error('[AI] Groq também falhou:', err.message);

      // Se o Groq falhou mas não tentamos o Gemini devido ao circuit breaker,
      // tentamos o Gemini agora como última alternativa antes de dar erro
      if (geminiKey && !tryGemini) {
        try {
          console.log('[AI] Groq falhou e Gemini estava em bypass. Tentando Gemini como último recurso...');
          return await callGemini(messages, maxTokens);
        } catch (geminiErr: any) {
          console.error('[AI] Gemini (último recurso) também falhou:', geminiErr.message);
        }
      }

      throw new Error(`Todos os serviços de IA falharam. Último erro: ${err.message}`);
    }
  }

  // Se caímos aqui e o Gemini estava em bypass mas não temos Groq configurado, tenta Gemini
  if (geminiKey && !tryGemini) {
    try {
      return await callGemini(messages, maxTokens);
    } catch (err: any) {
      throw new Error(`Serviço de IA indisponível. Gemini falhou após bypass: ${err.message}`);
    }
  }

  throw new Error('Nenhuma chave de IA disponível no momento.');
};
