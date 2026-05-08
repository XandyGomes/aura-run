import { NextResponse } from 'next/server';
import { exchangeToken } from '@/lib/strava';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const data = await exchangeToken(code);
    
    if (data.access_token) {
      const cookieStore = await cookies();
      cookieStore.set('strava_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: data.expires_in,
        path: '/',
      });
      
      // Store user info for the UI
      cookieStore.set('user_name', data.athlete.firstname, { path: '/' });
      cookieStore.set('user_photo', data.athlete.profile_medium || data.athlete.profile || '', { path: '/' });
    }

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Strava OAuth Error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}
