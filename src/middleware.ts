import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth (NextAuth routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt, etc.
     * - Static files with extensions
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.).*)",
  ],
};
