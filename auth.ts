import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { assertAuthSecretConfigured, checkRateLimit, getClientIp } from '@/lib/auth/security';

assertAuthSecretConfigured();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: process.env.AUTH_TRUST_HOST === 'true' || process.env.VERCEL === '1',
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email || '').trim().toLowerCase();
        const password = String(credentials?.password || '');
        const clientIp = request ? getClientIp(request) : 'unknown';

        const ipLimit = await checkRateLimit(`login:ip:${clientIp}`, 20, 15 * 60 * 1000);
        if (!ipLimit.allowed) {
          return null;
        }

        if (email) {
          const emailLimit = await checkRateLimit(`login:email:${email}`, 8, 15 * 60 * 1000);
          if (!emailLimit.allowed) {
            return null;
          }
        }

        if (!email || !password) {
          return null;
        }

        const result = await query(
          `SELECT id, email, name, password_hash, image
           FROM kazikastudio.app_users
           WHERE lower(email) = $1
           LIMIT 1`,
          [email]
        );

        const user = result.rows[0];
        if (!user || !verifyPassword(password, user.password_hash)) {
          if (user?.id) {
            await query(
              `UPDATE kazikastudio.app_users
               SET login_failed_count = COALESCE(login_failed_count, 0) + 1,
                   last_failed_login_at = timezone('utc'::text, now())
               WHERE id = $1`,
              [user.id]
            );
          }
          return null;
        }

        await query(
          `UPDATE kazikastudio.app_users
           SET login_failed_count = 0,
               last_login_at = timezone('utc'::text, now())
           WHERE id = $1`,
          [user.id]
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          image: user.image || null,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
        return true;
      }
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = String(token.id);
      }
      return session;
    },
  },
});
