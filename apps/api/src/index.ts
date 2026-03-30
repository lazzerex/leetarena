import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { syncRoutes } from './routes/sync';
import { packRoutes } from './routes/packs';
import { battleRoutes } from './routes/battle';
import { cardRoutes } from './routes/cards';
import { dailySyncCron } from './cron/daily-sync';
import { revalidateCatalogManifestCron } from './cron/catalog-revalidate';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  QSTASH_TOKEN: string;
  RESEND_API_KEY: string;
  FRONTEND_URL: string;
  LEETCODE_SYNC_ENABLED?: string;
  LEETCODE_EXTENDED_SYNC_ENABLED?: string;
  PACK_VARIETY_MODE_ENABLED?: string;
  RANKED_CORE_ONLY?: string;
};

const app = new Hono<{ Bindings: Env }>();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = [c.env.FRONTEND_URL, 'http://localhost:5173'];
      return allowed.includes(origin) ? origin : allowed[0] ?? '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ ok: true, version: '1.0.0' }));

// ─── Route Modules ────────────────────────────────────────────────────────────

app.route('/sync', syncRoutes);
app.route('/packs', packRoutes);
app.route('/battle', battleRoutes);
app.route('/cards', cardRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  const status =
    typeof err === 'object' && err !== null && 'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;

  if (status >= 500) {
    return c.json({ error: 'Internal server error' }, status);
  }

  const message = err instanceof Error ? err.message : 'Request failed';
  return c.json({ error: message }, status);
});

const DAILY_SYNC_CRON = '0 0 * * *';
const CATALOG_REVALIDATE_CRON = '30 0 * * *';

const worker: ExportedHandler<Env> = {
  fetch: app.fetch,
  scheduled(event, env, ctx) {
    if (event.cron === DAILY_SYNC_CRON) {
      ctx.waitUntil(dailySyncCron(env));
    }

    if (event.cron === CATALOG_REVALIDATE_CRON) {
      ctx.waitUntil(revalidateCatalogManifestCron());
    }
  },
};

export default worker;
