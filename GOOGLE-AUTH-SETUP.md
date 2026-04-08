# Google OAuth Setup for Z-Health AI

## Prerequisites
- Google Workspace admin access on @zhealth.net
- Access to Google Cloud Console (console.cloud.google.com)

## Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your **@zhealth.net** admin account
3. Click the project dropdown at the very top
4. Click **New Project**
5. Name: "Z-Health AI"
6. Organization: select your zhealth.net org
7. Click **Create**
8. Switch to the new project

## Step 2: Fix Permissions (if needed)

If you see "You don't have permission to view OAuth clients":

1. Go to **IAM & Admin > IAM** (left sidebar) or visit: `https://console.cloud.google.com/iam-admin/iam`
2. Click **Grant Access** (or **+ Add**)
3. New principal: your @zhealth.net email
4. Role: **Basic > Owner**
5. Save

If you can't access IAM either, create a brand new project (Step 1) — you'll have Owner access automatically since you created it.

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **Internal** (only @zhealth.net users can sign in)
3. App name: "Z-Health AI"
4. User support email: your @zhealth.net email
5. Developer contact: your @zhealth.net email
6. Click **Save and Continue** through the remaining screens (Scopes, Test Users, Summary)

## Step 4: Create OAuth Client ID

1. Go to **APIs & Services > Credentials**
2. Click **+ Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: "Z-Health AI"
5. Authorized redirect URIs — add both:
   - `https://zhealth-ai.vercel.app/api/auth/callback/google` (replace with your actual Vercel URL)
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** (you'll only see the secret once)

## Step 5: Add Environment Variables to Vercel

Go to Vercel > Project > Settings > Environment Variables and add:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | The Client ID from Step 4 |
| `GOOGLE_CLIENT_SECRET` | The Client Secret from Step 4 |
| `NEXTAUTH_SECRET` | Any random string (e.g., run `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Your Vercel deployment URL (e.g., `https://zhealth-ai.vercel.app`) |
| `ALLOWED_EMAIL_DOMAIN` | `zhealth.net` |

## Step 6: Re-enable Auth in Code

Two files need to be uncommented:

### `src/middleware.ts`
Uncomment the auth middleware code and remove the `export {};` line.

### `src/lib/auth.ts`
In the `requireAuth()` function, uncomment the session check and remove `return null;`.

## Step 7: Redeploy

Push the code changes and Vercel will auto-deploy. Only @zhealth.net Google accounts will be able to access the app.

## Troubleshooting

- **"Server error" on load**: Make sure `NEXTAUTH_SECRET` is set in Vercel env vars
- **Redirect URI mismatch**: The URI in Google Console must exactly match your Vercel URL + `/api/auth/callback/google`
- **"Access blocked" on sign-in**: Make sure the OAuth consent screen is set to Internal, or add your email as a test user if set to External
- **Wrong account signing in**: Only @zhealth.net emails are allowed. Others get blocked at sign-in.
