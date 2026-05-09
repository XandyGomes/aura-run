const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') return 'https://aura-run.vercel.app';
  return 'http://localhost:3000';
};

export const getStravaAuthUrl = () => {
  const redirectUri = `${getBaseUrl()}/api/auth/strava/callback`;
  return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all,read`;
};

export const exchangeToken = async (code: string) => {
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
  return response.json();
};

export const getActivities = async (accessToken: string) => {
  const response = await fetch('https://www.strava.com/api/v3/athlete/activities', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
};
