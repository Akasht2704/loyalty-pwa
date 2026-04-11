import jwt from "jsonwebtoken";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { parseAuthJwtPayload } from "@/lib/auth";

const getJwtSecret = () => {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Auth secret is not configured");
  }
  return secret;
};

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: getJwtSecret(),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        token: { label: "Token", type: "text" },
        user: { label: "User", type: "text" },
      },
      async authorize(credentials) {
        const rawToken = credentials?.token;
        if (!rawToken || typeof rawToken !== "string") {
          return null;
        }

        const decoded = jwt.verify(rawToken, getJwtSecret());
        const payload = parseAuthJwtPayload(decoded);
        if (!payload) {
          return null;
        }

        let parsedUser: Record<string, unknown> = {};
        if (typeof credentials?.user === "string" && credentials.user.trim()) {
          try {
            parsedUser = JSON.parse(credentials.user) as Record<string, unknown>;
          } catch {
            parsedUser = {};
          }
        }

        return {
          id: String(payload.userId),
          name: String(
            typeof parsedUser.name === "string" && parsedUser.name
              ? parsedUser.name
              : payload.name,
          ),
          phone: payload.phone,
          appId: payload.appId,
          roleId: payload.roleId,
          brandId: payload.brandId,
          accessToken: rawToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.phone = (user as { phone?: string }).phone;
        token.appId = (user as { appId?: number }).appId;
        token.roleId = (user as { roleId?: number }).roleId;
        token.brandId = (user as { brandId?: number | null }).brandId;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.user = {
        ...session.user,
        id: token.sub ?? "",
        phone: token.phone as string | undefined,
        appId: token.appId as number | undefined,
        roleId: token.roleId as number | undefined,
        brandId: token.brandId as number | null | undefined,
      };
      return session;
    },
  },
};
