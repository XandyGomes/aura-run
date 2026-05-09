import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return new NextResponse(`Erro do Strava: ${errorParam}`, { status: 400 });
  }

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    console.error('Missing Strava credentials');
    return new NextResponse('Configuração incompleta', { status: 500 });
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();
    
    if (data.errors || !data.access_token) {
      console.error('Strava Exchange Error:', data);
      return new NextResponse(`Erro na troca de token: ${JSON.stringify(data)}`, { status: 400 });
    }

    const cookieStore = await cookies();
    cookieStore.set('strava_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: data.expires_in,
      path: '/',
      sameSite: 'strict',
    });

    cookieStore.set('strava_refresh_token', data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      sameSite: 'strict',
    });
    
    cookieStore.set('user_name', data.athlete.firstname, { 
      path: '/',
      sameSite: 'strict',
    });
    cookieStore.set('user_photo', data.athlete.profile_medium || data.athlete.profile || '', { 
      path: '/',
      sameSite: 'strict',
    });

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error: any) {
    console.error('Callback Catch Error:', error);
    return new NextResponse(`Erro Interno: ${error.message}`, { status: 500 });
  }
}
