/**
 * Daily LeetCode sync cron job.
 * Triggered by Vercel Cron → hits this endpoint via QStash or direct HTTP.
 * Add this handler to your Hono app or expose as a separate Cloudflare Worker.
 */
import { createSupabase } from '../lib/supabase';
import { performSync } from '../routes/sync';
import type { Env } from '../index';

export async function dailySyncCron(env: Env) {
  const db = createSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Fetch all users with a LeetCode username
  const users = (await (await db.from('users')).select(
    'id,leetcode_username',
    { leetcode_username: 'not.is.null' }
  )) as Array<{ id: string; leetcode_username: string }>;

  console.log(`[cron] Syncing ${users.length} users...`);

  const results = await Promise.allSettled(
    users.map((user) => performSync(user.id, user.leetcode_username, db))
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`[cron] Done. Succeeded: ${succeeded}, Failed: ${failed}`);
  return { succeeded, failed };
}
