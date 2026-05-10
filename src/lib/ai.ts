/**
 * Módulo centralizado de IA com fallback automático: Groq → Gemini
 */

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const callGroq = async (messages: Message[], maxTokens: number): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurado');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
    throw new Error(`Groq ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Resposta vazia do Groq');
  return text;
};

const callGemini = async (messages: Message[], maxTokens: number): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado');

  // Separa a mensagem de sistema das demais
  const systemMsg = messages.find(m => m.role === 'system');
  const conversation = messages.filter(m => m.role !== 'system');

  // Converte para o formato do Gemini (role: "model" em vez de "assistant")
  const contents = conversation.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Resposta vazia do Gemini');
  return text;
};

/**
 * Chama a IA com fallback automático: tenta Groq primeiro, se falhar usa Gemini.
 * @param messages Array de mensagens no formato OpenAI ({role, content})
 * @param maxTokens Máximo de tokens na resposta (padrão: 1000)
 */
export const callAI = async (messages: Message[], maxTokens = 1000): Promise<string> => {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    throw new Error('Nenhuma chave de IA configurada. Adicione GROQ_API_KEY ou GEMINI_API_KEY.');
  }

  if (groqKey) {
    try {
      return await callGroq(messages, maxTokens);
    } catch (err: any) {
      console.warn('[AI] Groq falhou, assumindo com Gemini:', err.message);
    }
  }

  if (geminiKey) {
    try {
      return await callGemini(messages, maxTokens);
    } catch (err: any) {
      console.error('[AI] Gemini também falhou:', err.message);
      throw err;
    }
  }

  throw new Error('Ambas as IAs falharam.');
};
