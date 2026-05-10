import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('strava_token')?.value;

  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const all: any[] = [];
    let page = 1;
    while (page <= 5) {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < 200) break;
      page++;
    }
    return NextResponse.json(all);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
