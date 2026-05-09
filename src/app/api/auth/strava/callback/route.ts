import { NextResponse } from 'next/server';
import { exchangeToken } from '@/lib/strava';
import { cookies } from 'next/headers';

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

  try {
    // Forçando as credenciais para garantir que não haja erro de variável de ambiente
    const clientId = '237783';
    const clientSecret = 'c5f5ec1f6c4af546951e67c0534b972ff201ddd3';

    console.log('Exchanging token for code:', code);

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
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
      secure: true,
      maxAge: data.expires_in,
      path: '/',
    });
    
    cookieStore.set('user_name', data.athlete.firstname, { path: '/' });
    cookieStore.set('user_photo', data.athlete.profile_medium || data.athlete.profile || '', { path: '/' });

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error: any) {
    console.error('Callback Catch Error:', error);
    return new NextResponse(`Erro Interno: ${error.message}`, { status: 500 });
  }
}
