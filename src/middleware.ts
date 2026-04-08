// Auth middleware — disabled temporarily for testing.
// To enable Google OAuth login, uncomment the code below
// and set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET,
// NEXTAUTH_URL, and ALLOWED_EMAIL_DOMAIN in your environment variables.

// import { withAuth } from "next-auth/middleware";
//
// export default withAuth({
//   pages: {
//     signIn: "/login",
//   },
// });
//
// export const config = {
//   matcher: [
//     "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.).*)",
//   ],
// };

export {};
