import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete('strava_token');
  cookieStore.delete('user_name');
  cookieStore.delete('user_photo');
  
  return NextResponse.redirect(new URL('/', request.url));
}
