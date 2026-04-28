import { getServerSession as nextAuthGetServerSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Refresh a Google OAuth access token using the stored refresh token.
 * Called from the jwt() callback when the access token has expired.
 *
 * Returns a new token object with refreshed credentials, or — on failure —
 * the original token with `error: "RefreshAccessTokenError"` so the
 * session() callback can surface it and the UI can prompt re-auth.
 */
async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  try {
    const refreshToken = (token as any).refreshToken as string | undefined;
    if (!refreshToken) {
      return { ...token, error: "RefreshAccessTokenError" } as JWT;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) {
      throw new Error(refreshed.error_description || refreshed.error || "Token refresh failed");
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      // Google may rotate the refresh token; keep old one if not returned
      refreshToken: refreshed.refresh_token ?? refreshToken,
      error: undefined,
    } as JWT;
  } catch (error) {
    console.error("[auth] Google token refresh failed:", error);
    return { ...token, error: "RefreshAccessTokenError" } as JWT;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/analytics.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || "zhealth.net";
      if (!user.email || !user.email.endsWith(`@${allowedDomain}`)) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // Initial sign-in: capture profile + Google OAuth credentials
      if (account && user) {
        token.email = user.email;
        token.picture = user.image;
        (token as any).accessToken = account.access_token;
        (token as any).refreshToken = account.refresh_token;
        (token as any).accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
        (token as any).error = undefined;
        return token;
      }

      // Subsequent calls — refresh if access token is expired (or about to be)
      const expiresAt = (token as any).accessTokenExpires as number | undefined;
      const skewMs = 60 * 1000; // refresh 1 minute before actual expiry
      if (expiresAt && Date.now() < expiresAt - skewMs) {
        return token;
      }

      // Expired: try to refresh
      return refreshGoogleAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
      }
      (session as any).accessToken = (token as any).accessToken;
      (session as any).error = (token as any).error;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new AuthError("Unauthorized");
  }
  return session;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
