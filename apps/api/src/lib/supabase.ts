/**
 * Minimal Supabase REST helper for Cloudflare Workers.
 * (No npm client — uses raw fetch to stay edge-compatible.)
 */
export class SupabaseClient {
  private url: string;
  private key: string;

  constructor(url: string, serviceRoleKey: string) {
    this.url = url.replace(/\/$/, '');
    this.key = serviceRoleKey;
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      Prefer: 'return=representation',
    };
  }

  async from(table: string) {
    const base = `${this.url}/rest/v1/${table}`;
    const headers = this.headers();

    return {
      select: async (query = '*', filters: Record<string, string> = {}) => {
        const params = new URLSearchParams({ select: query, ...filters });
        const res = await fetch(`${base}?${params}`, { headers });
        return res.json();
      },
      insert: async (data: unknown) => {
        const res = await fetch(base, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });
        return res.json();
      },
      update: async (data: unknown, filters: Record<string, string>) => {
        const params = new URLSearchParams(filters);
        const res = await fetch(`${base}?${params}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(data),
        });
        return res.json();
      },
      upsert: async (data: unknown) => {
        const res = await fetch(base, {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(data),
        });
        return res.json();
      },
      delete: async (filters: Record<string, string>) => {
        const params = new URLSearchParams(filters);
        const res = await fetch(`${base}?${params}`, { method: 'DELETE', headers });
        return res.json();
      },
    };
  }

  /** Execute raw SQL via the rpc endpoint */
  async rpc(fn: string, params: Record<string, unknown> = {}) {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    return res.json();
  }
}

export function createSupabase(url: string, key: string) {
  return new SupabaseClient(url, key);
}
