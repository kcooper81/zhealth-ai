/**
 * Basecamp 4 API helpers — auth refresh + Message Board posting.
 *
 * Refresh tokens last ~10 years per Basecamp policy; access tokens last 2 weeks.
 * For weekly/monthly cron we refresh on every run for simplicity.
 */

const UA = "Z-Health Reporting (kade@zhealth.net)";

export async function getBasecampAccessToken(): Promise<string> {
  const clientId = process.env.BASECAMP_CLIENT_ID;
  const clientSecret = process.env.BASECAMP_CLIENT_SECRET;
  const refreshToken = process.env.BASECAMP_REFRESH_TOKEN;
  const redirectUri = process.env.BASECAMP_REDIRECT_URI || "https://localhost/callback";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing BASECAMP_CLIENT_ID / BASECAMP_CLIENT_SECRET / BASECAMP_REFRESH_TOKEN");
  }

  const url =
    "https://launchpad.37signals.com/authorization/token?type=refresh" +
    "&refresh_token=" + encodeURIComponent(refreshToken) +
    "&client_id=" + encodeURIComponent(clientId) +
    "&client_secret=" + encodeURIComponent(clientSecret) +
    "&redirect_uri=" + encodeURIComponent(redirectUri);

  const r = await fetch(url, { method: "POST", headers: { "User-Agent": UA }});
  if (!r.ok) {
    throw new Error(`Basecamp refresh failed (${r.status}): ${await r.text()}`);
  }
  const data = await r.json();
  return data.access_token as string;
}

export async function postMessageToBoard({
  subject,
  content,
}: {
  subject: string;
  content: string;
}): Promise<{ url: string; id: number }> {
  const accountId = process.env.BASECAMP_ACCOUNT_ID;
  const projectId = process.env.BASECAMP_PROJECT_ID;
  const boardId = process.env.BASECAMP_MESSAGE_BOARD_ID;
  if (!accountId || !projectId || !boardId) {
    throw new Error("Missing BASECAMP_ACCOUNT_ID / BASECAMP_PROJECT_ID / BASECAMP_MESSAGE_BOARD_ID");
  }

  const token = await getBasecampAccessToken();
  const url = `https://3.basecampapi.com/${accountId}/buckets/${projectId}/message_boards/${boardId}/messages.json`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ subject, content, status: "active" }),
  });
  if (!r.ok) {
    throw new Error(`Basecamp message POST failed (${r.status}): ${await r.text()}`);
  }
  const msg = await r.json();
  return { url: msg.app_url, id: msg.id };
}
