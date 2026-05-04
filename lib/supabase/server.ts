import { createKazikaClient } from '@/lib/kazika-db-client';

// Compatibility shim for older server routes while the codebase finishes moving
// from Supabase-shaped queries to direct Neon/Postgres helpers.
export async function createClient() {
  const client = await createKazikaClient();
  return {
    ...client,
    auth: {
      ...client.auth,
      async exchangeCodeForSession() {
        return { error: null };
      },
    },
  };
}
