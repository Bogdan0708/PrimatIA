import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import type { Role } from "@/lib/constants";
import { authorizeStaffCredentials } from "@/lib/staff-auth";
import { resolveTenantIdFromHeaders } from "@/lib/tenant-resolution";

declare module "next-auth" {
  interface User {
    role: Role;
    tenantId: string;
    firstName: string;
    lastName: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      role: Role;
      tenantId: string;
      firstName: string;
      lastName: string;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "Authenticator Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const tenantId = await resolveTenantIdFromHeaders(await headers());
        if (!tenantId) {
          return null;
        }

        return authorizeStaffCredentials({
          email: credentials.email as string,
          password: credentials.password as string,
          totpCode: (credentials.totpCode as string | undefined) ?? null,
          tenantId,
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.tenantId = token.tenantId as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
});
