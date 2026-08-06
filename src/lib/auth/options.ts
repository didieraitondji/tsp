import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
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
    };
  }

  interface User {
    id: string;
    phone: string;
    name: string;
    role: Role;
    memberId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    phone: string;
    role: Role;
    memberId?: string | null;
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
        return {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          memberId: user.memberId ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
        token.role = user.role;
        token.memberId = user.memberId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.phone = token.phone;
        session.user.role = token.role;
        session.user.memberId = token.memberId;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
