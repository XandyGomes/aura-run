import { NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/strava';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('strava_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    const data = await refreshAccessToken(refreshToken);

    if (!data.access_token) {
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: 400 });
    }

    cookieStore.set('strava_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: data.expires_in,
      path: '/',
      sameSite: 'strict',
    });

    if (data.refresh_token) {
      cookieStore.set('strava_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'strict',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 });
  }
}