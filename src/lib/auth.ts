import { getServerSession as nextAuthGetServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

export async function requireAuth() {
  // Auth temporarily disabled for testing.
  // Uncomment below when Google OAuth is configured.
  // const session = await getServerSession();
  // if (!session) {
  //   throw new AuthError("Unauthorized");
  // }
  // return session;
  return null;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
