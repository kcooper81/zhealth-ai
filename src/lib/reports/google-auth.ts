/**
 * Google OAuth access-token refresh using the project's long-lived refresh token.
 * Used by SEO/traffic report cron endpoints (GSC + GA4 read-only).
 *
 * Stateless: each call refreshes from the refresh_token. We rely on Vercel/Next
 * cold-starts being infrequent; tokens last 1 hour, so caching is unnecessary at
 * weekly/monthly cron cadence.
 */

export async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN");
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!r.ok) {
    throw new Error(`Google token refresh failed (${r.status}): ${await r.text()}`);
  }
  const data = await r.json();
  return data.access_token as string;
}

// In-memory memo so we don't do an OAuth round-trip on every report render
// within a warm serverless instance. Access tokens last ~1h; memo for 50m.
let _memo: { token: string; exp: number } | null = null;

export async function getGoogleAccessTokenCached(): Promise<string> {
  if (_memo && _memo.exp > Date.now()) return _memo.token;
  const token = await getGoogleAccessToken();
  _memo = { token, exp: Date.now() + 50 * 60 * 1000 };
  return token;
}

/**
 * Resolve the GA4/GSC access token for portal reports. Prefers the project's
 * service refresh token — it reliably has access to the company GA4 + Search
 * Console, so every report shows data regardless of which teammate is signed
 * in (and the same token works for cron pre-warming). Falls back to the
 * signed-in user's OAuth token if the service token can't be minted.
 */
export async function getPortalGa4Token(sessionToken?: string): Promise<string | undefined> {
  try {
    return await getGoogleAccessTokenCached();
  } catch {
    return sessionToken;
  }
}
