import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Strava Callback] Credenciais não configuradas nas variáveis de ambiente.');
    return new NextResponse('Configuração do servidor incompleta.', { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return new NextResponse(`Erro do Strava: ${errorParam}`, { status: 400 });
  }

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Strava requer client_id como número inteiro e não precisa de redirect_uri no token exchange
  const tokenBody = {
    client_id: Number(clientId),
    client_secret: clientSecret.trim(), // trim para remover qualquer whitespace invisível
    code,
    grant_type: 'authorization_code',
  };

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenBody),
    });

    const data = await response.json();

    if (data.errors || !data.access_token) {
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
    console.error('[Strava Callback] Erro:', error);
    return new NextResponse(`Erro Interno: ${error.message}`, { status: 500 });
  }
}
