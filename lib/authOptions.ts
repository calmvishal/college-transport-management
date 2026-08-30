import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByAuthId } from "./repository";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        authId: { label: "Email or ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.authId || !credentials?.password) return null;

        const user = await getUserByAuthId(credentials.authId);
        if (!user || user.status !== "Active") return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.userId,
          name: user.name,
          email: user.authId,
          role: user.role,
          route: user.route,
          vehicleId: user.vehicleId,
          studentId: user.studentId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.route = (user as any).route;
        token.vehicleId = (user as any).vehicleId;
        token.studentId = (user as any).studentId;
        token.userId = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).route = token.route;
        (session.user as any).vehicleId = token.vehicleId;
        (session.user as any).studentId = token.studentId;
        (session.user as any).id = token.userId;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
