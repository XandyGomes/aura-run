import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientId = process.env.STRAVA_CLIENT_ID;

  if (!clientId) {
    console.error('[Strava Login] STRAVA_CLIENT_ID não configurado.');
    return new NextResponse('Configuração do servidor incompleta.', { status: 500 });
  }

  const host = request.headers.get('host') || '';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const redirectUri = `${baseUrl}/api/auth/strava/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
  });

  // URL para o browser (sempre funciona)
  const webUrl = `https://www.strava.com/oauth/authorize?${params}`;
  // Deep link para o app nativo do Strava (iOS e Android)
  const appUrl = `strava://oauth/mobile/authorize?${params}`;

  // Detecta se é mobile pelo User-Agent
  const userAgent = request.headers.get('user-agent') || '';
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(userAgent);

  // Desktop: redireciona direto para o browser
  if (!isMobile) {
    return NextResponse.redirect(webUrl);
  }

  // Mobile: página ponte que tenta abrir o app e cai no browser se não tiver instalado
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Conectando ao Strava...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #080810;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 20px;
      padding: 24px;
    }
    .logo {
      width: 64px; height: 64px;
      background: #fc4c02;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
    }
    h2 { font-size: 20px; font-weight: 600; }
    p { color: rgba(255,255,255,0.5); font-size: 14px; text-align: center; line-height: 1.5; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #fc4c02;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .fallback-btn {
      margin-top: 8px;
      color: #fc4c02;
      font-size: 13px;
      text-decoration: underline;
      cursor: pointer;
      background: none;
      border: none;
    }
  </style>
</head>
<body>
  <div class="logo">&#127939;</div>
  <h2>Abrindo o Strava...</h2>
  <div class="spinner"></div>
  <p>Se o app não abrir automaticamente,<br>toque no botão abaixo.</p>
  <button class="fallback-btn" onclick="window.location.href='${webUrl}'">
    Abrir no navegador
  </button>
  <script>
    // Tenta abrir o app nativo do Strava imediatamente
    window.location.href = '${appUrl}';

    // Se o app não responder em 2.5s, abre no browser automaticamente
    var fallbackTimer = setTimeout(function() {
      window.location.href = '${webUrl}';
    }, 2500);

    // Se o usuário voltou para esta aba (app abriu mas voltou), cancela o timer
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) clearTimeout(fallbackTimer);
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
