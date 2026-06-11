import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "./db";
import User from "./models/User";
import type { Plan, PlanStatus } from "./plans";

declare module "next-auth" {
  interface User {
    role?: string;
    plan?: Plan;
    planStatus?: PlanStatus;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      plan: Plan;
      planStatus: PlanStatus;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    plan?: string;
    planStatus?: string;
  }
}

const googleProvider =
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...googleProvider,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase(),
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          plan: user.plan,
          planStatus: user.planStatus,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        if (!token.email) throw new Error("Google account missing email");
        await connectDB();
        const dbUser = await User.findOneAndUpdate(
          { email: token.email },
          {
            $set: { name: token.name, image: token.picture },
            $setOnInsert: { email: token.email },
          },
          { upsert: true, new: true }
        );
        token.id = dbUser._id.toString();
        token.role = dbUser.role;
        token.plan = dbUser.plan ?? "free";
        token.planStatus = dbUser.planStatus ?? "active";
      } else if (user) {
        token.id = user.id;
        token.role = user.role;
        token.plan = user.plan ?? "free";
        token.planStatus = user.planStatus ?? "active";
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as string;
      session.user.plan = (token.plan ?? "free") as Plan;
      session.user.planStatus = (token.planStatus ?? "active") as PlanStatus;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
