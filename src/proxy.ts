import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy (anteriormente Middleware) para auto-renovar o token do Strava.
 *
 * Fluxo:
 * 1. Se há strava_token → deixa passar (token ativo).
 * 2. Se NÃO há strava_token mas há strava_refresh_token → renova automaticamente.
 * 3. Se não há nenhum → deixa passar (a página vai pedir login se precisar).
 *
 * Isso garante que o usuário não precise autenticar a cada 6 horas.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignora rotas que não precisam de autenticação
  if (
    pathname.startsWith('/api/auth/strava') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const stravaToken = request.cookies.get('strava_token')?.value;
  const refreshToken = request.cookies.get('strava_refresh_token')?.value;

  // Token ativo → deixa passar
  if (stravaToken) {
    return NextResponse.next();
  }

  // Sem token mas com refresh token → renova automaticamente
  if (refreshToken && !stravaToken) {
    try {
      const clientId = process.env.STRAVA_CLIENT_ID;
      const clientSecret = process.env.STRAVA_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return NextResponse.next();
      }

      const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Number(clientId),
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) {
        // Refresh falhou (token revogado) → deixa a página lidar com o estado
        return NextResponse.next();
      }

      const data = await res.json();

      if (!data.access_token) {
        return NextResponse.next();
      }

      // Renova com sucesso → injeta os novos cookies na resposta
      const response = NextResponse.next();

      response.cookies.set('strava_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: data.expires_in || 21600,
        path: '/',
        sameSite: 'strict',
      });

      if (data.refresh_token) {
        response.cookies.set('strava_refresh_token', data.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 30, // 30 dias
          path: '/',
          sameSite: 'strict',
        });
      }

      console.log('[Proxy] Token Strava renovado automaticamente.');
      return response;
    } catch (err) {
      console.error('[Proxy] Erro ao renovar token Strava:', err);
      return NextResponse.next();
    }
  }

  // Nenhum token → deixa a página lidar
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplica a todas as rotas exceto assets estáticos e API de auth
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
};
