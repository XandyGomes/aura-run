import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const clientId = '237783'; // Forçando o ID direto para não ter erro de leitura
    
    const host = request.headers.get('host') || 'aura-run.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    const redirectUri = `${baseUrl}/api/auth/strava/callback`;
    
    // Simplificando o scope para apenas o necessário
    const stravaUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all`;

    console.log('Redirecting to Strava with URI:', redirectUri);
    
    return NextResponse.redirect(stravaUrl);
  } catch (error) {
    console.error('Login Route Error:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
