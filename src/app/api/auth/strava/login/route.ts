import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    
    // Detecta o host atual de forma segura
    const host = request.headers.get('host') || 'aura-run.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    const redirectUri = `${baseUrl}/api/auth/strava/callback`;
    
    const stravaUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=activity:read_all,read`;

    return NextResponse.redirect(stravaUrl);
  } catch (error) {
    console.error('Login Route Error:', error);
    // Em caso de erro catastrófico, volta para a home
    return NextResponse.redirect(new URL('/', request.url));
  }
}
