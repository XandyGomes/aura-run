import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { headers } = request;
  const host = headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = `${baseUrl}/api/auth/strava/callback`;
  
  const stravaUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all,read`;

  console.log('Redirecting to Strava from:', baseUrl);
  
  return NextResponse.redirect(stravaUrl);
}
