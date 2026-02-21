import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma, withTenantScope } from "@/lib/db";
import type { Role } from "@/lib/constants";
import { resolveTenantIdFromHeaders } from "@/lib/tenant-resolution";

function _getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET must be configured");
  }
  return secret;
}

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
  secret: process.env.NEXTAUTH_SECRET ?? "nextauth-secret-not-set",
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const tenantId = request?.headers
          ? await resolveTenantIdFromHeaders(request.headers)
          : null;
        if (!tenantId) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await withTenantScope(tenantId, async () =>
          prisma.tenantUser.findFirst({
            where: {
              tenantId,
              email,
              isActive: true,
              deletedAt: null,
              tenant: {
                status: { in: ["active", "trial"] },
                deletedAt: null,
              },
            },
          })
        );

        if (!user) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const passwordValid = await compare(password, user.passwordHash);

        if (!passwordValid) {
          const attempts = user.loginAttempts + 1;
          await withTenantScope(tenantId, async () => {
            await prisma.tenantUser.update({
              where: { id: user.id },
              data: {
                loginAttempts: attempts,
                lockedUntil:
                  attempts >= 5
                    ? new Date(Date.now() + 15 * 60 * 1000)
                    : undefined,
              },
            });
          });
          return null;
        }

        await withTenantScope(tenantId, async () => {
          await prisma.tenantUser.update({
            where: { id: user.id },
            data: {
              loginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
            },
          });
        });

        return {
          id: user.id,
          email: user.email,
          role: user.role as Role,
          tenantId: user.tenantId,
          firstName: user.firstName,
          lastName: user.lastName,
        };
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
