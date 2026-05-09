const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
  console.warn('Strava credentials not configured');
}

const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') return 'https://aura-run.vercel.app';
  return 'http://localhost:3000';
};

export const getStravaAuthUrl = () => {
  if (!STRAVA_CLIENT_ID) {
    throw new Error('STRAVA_CLIENT_ID is not configured');
  }
  const redirectUri = `${getBaseUrl()}/api/auth/strava/callback`;
  return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all,read`;
};

export const exchangeToken = async (code: string) => {
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
    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error exchanging token:', error);
    throw error;
  }
};

export const getActivities = async (accessToken: string, perPage: number = 100) => {
  try {
    const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
};

export const refreshAccessToken = async (refreshToken: string) => {
  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
};
