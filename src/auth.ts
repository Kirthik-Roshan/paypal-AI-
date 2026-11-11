import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
// Next's listening address (0.0.0.0) is not the browser-facing OAuth origin.
// Auth.js reads AUTH_URL for both its request URL and generated callbacks.
const authOrigin = process.env.NEXTAUTH_URL || process.env.APP_URL;
if (!process.env.AUTH_URL && authOrigin) process.env.AUTH_URL = authOrigin;
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || "",
      clientSecret: process.env.AUTH_GITHUB_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
    async signIn({ profile }) {
      const login = (profile as { login?: string })?.login?.toLowerCase();
      return (
        !!login &&
        (process.env.AUTH_OWNER_GITHUB_LOGINS || "")
          .toLowerCase()
          .split(",")
          .map((s) => s.trim())
          .includes(login)
      );
    },
  },
});
