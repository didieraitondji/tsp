import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { EMAIL_AUTH_FEATURES_ENABLED } from "@/lib/auth/constants";
import { canUseTwoFactor } from "@/lib/auth/permissions";
import { usersRepo } from "@/lib/db/collections";
import { normalizePhone, phonesMatch } from "@/lib/phone";
import type { Role } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string;
      name: string;
      role: Role;
      memberId?: string | null;
      email?: string | null;
      mustChangePassword?: boolean;
      twoFactorEnabled?: boolean;
      twoFactorPending?: boolean;
    };
  }

  interface User {
    id: string;
    phone: string;
    name: string;
    role: Role;
    memberId?: string | null;
    email?: string | null;
    mustChangePassword?: boolean;
    twoFactorEnabled?: boolean;
    twoFactorPending?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    phone: string;
    role: Role;
    memberId?: string | null;
    email?: string | null;
    mustChangePassword?: boolean;
    twoFactorEnabled?: boolean;
    twoFactorPending?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phone: { label: "Téléphone", type: "tel" },
        password: { label: "Mot de passe", type: "password" },
        twoFactorVerified: { label: "2FA", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials.password) return null;
        const phone = normalizePhone(credentials.phone);
        if (!phone) return null;
        const users = await usersRepo.all();
        const user = users.find((u) => phonesMatch(u.phone, phone) && u.active);
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        const twoFactorEnabled =
          EMAIL_AUTH_FEATURES_ENABLED &&
          Boolean(user.twoFactorEnabled) &&
          canUseTwoFactor(user.role);
        const twoFactorVerified = credentials.twoFactorVerified === "1";
        const twoFactorPending =
          twoFactorEnabled && Boolean(user.email) && !user.mustChangePassword && !twoFactorVerified;

        return {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          memberId: user.memberId ?? null,
          email: user.email ?? null,
          mustChangePassword: Boolean(user.mustChangePassword),
          twoFactorEnabled,
          twoFactorPending,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
        token.role = user.role;
        token.memberId = user.memberId ?? null;
        token.email = user.email ?? null;
        token.mustChangePassword = user.mustChangePassword;
        token.twoFactorEnabled = user.twoFactorEnabled;
        token.twoFactorPending = user.twoFactorPending;
      }
      if (trigger === "update" && session) {
        const s = session as {
          mustChangePassword?: boolean;
          twoFactorPending?: boolean;
          twoFactorEnabled?: boolean;
          email?: string | null;
        };
        if (typeof s.mustChangePassword === "boolean") {
          token.mustChangePassword = s.mustChangePassword;
        }
        if (typeof s.twoFactorPending === "boolean") {
          token.twoFactorPending = s.twoFactorPending;
        }
        if (typeof s.twoFactorEnabled === "boolean") {
          token.twoFactorEnabled = s.twoFactorEnabled;
        }
        if (s.email !== undefined) token.email = s.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.phone = token.phone;
        session.user.role = token.role;
        session.user.memberId = token.memberId;
        session.user.email = token.email;
        session.user.mustChangePassword = token.mustChangePassword;
        session.user.twoFactorEnabled = token.twoFactorEnabled;
        session.user.twoFactorPending = token.twoFactorPending;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
