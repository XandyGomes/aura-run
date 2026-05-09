import { NextResponse } from 'next/server';
import { getActivities } from '@/lib/strava';
import { generateTrainingSuggestion } from '@/lib/gemini';
import { cookies } from 'next/headers';

async function refreshToken(): Promise<boolean> {
  try {
    const refreshResponse = await fetch(new URL('/api/auth/strava/refresh', 'http://localhost:3000'), {
      method: 'POST',
    });
    return refreshResponse.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const cookieStore = await cookies();
  let token = cookieStore.get('strava_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    let activities = await getActivities(token);
    
    if (activities.errors || activities.message?.includes('Unauthorized')) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
      }
      token = cookieStore.get('strava_token')?.value || '';
      activities = await getActivities(token);
    }
    
    const suggestion = await generateTrainingSuggestion(activities);
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    return NextResponse.json({ error: 'Erro ao gerar treino' }, { status: 500 });
  }
}
