import { NextResponse } from 'next/server';
import { getActivities } from '@/lib/strava';
import { generateTrainingSuggestion } from '@/lib/gemini';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('strava_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const activities = await getActivities(token);
    const suggestion = await generateTrainingSuggestion(activities);
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    return NextResponse.json({ error: 'Erro ao gerar treino' }, { status: 500 });
  }
}
