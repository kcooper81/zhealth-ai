import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Exclude cron/refresh endpoints — they enforce their own auth
    // (CRON_SECRET bearer or a signed-in session) inside the route handler.
    "/((?!login|api/auth|api/cron|api/portal/page-flows/refresh|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.).*)",
  ],
};
