// Google OAuth Setup Instructions:
// 1. Go to https://console.cloud.google.com/
// 2. Create a project or select existing
// 3. Go to APIs & Services > Credentials
// 4. Create OAuth 2.0 Client ID (Web application)
// 5. Add authorized redirect URI:
//    - Production: https://your-domain.vercel.app/api/auth/callback/google
//    - Development: http://localhost:3000/api/auth/callback/google
// 6. Copy Client ID and Client Secret to .env.local as:
//    GOOGLE_CLIENT_ID=your-client-id
//    GOOGLE_CLIENT_SECRET=your-client-secret

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
