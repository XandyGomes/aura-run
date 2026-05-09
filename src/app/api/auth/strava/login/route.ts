import { NextResponse } from 'next/server';
import { getStravaAuthUrl } from '@/lib/strava';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = getStravaAuthUrl();
  return NextResponse.redirect(url);
}
