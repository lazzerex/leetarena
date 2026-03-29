/**
 * Minimal Supabase REST helper for Cloudflare Workers.
 * (No npm client — uses raw fetch to stay edge-compatible.)
 */
export class SupabaseRequestError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'SupabaseRequestError';
    this.status = status;
    this.details = details;
  }
}

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

  private parseBody(raw: string): unknown {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  private errorMessage(details: unknown, fallback: string): string {
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      const detailObj = details as Record<string, unknown>;
      const maybeMessage = detailObj.message ?? detailObj.error ?? detailObj.hint;
      if (typeof maybeMessage === 'string' && maybeMessage.length > 0) {
        return maybeMessage;
      }
    }
    return fallback;
  }

  private async request<T>(url: string, init: RequestInit, fallbackError: string): Promise<T> {
    const res = await fetch(url, init);
    const raw = await res.text();
    const body = this.parseBody(raw);

    if (!res.ok) {
      const message = this.errorMessage(body, `${fallbackError} (${res.status})`);
      throw new SupabaseRequestError(message, res.status, body);
    }

    return body as T;
  }

  async from(table: string) {
    const base = `${this.url}/rest/v1/${table}`;
    const headers = this.headers();

    return {
      select: async <T = unknown>(query = '*', filters: Record<string, string> = {}) => {
        const params = new URLSearchParams({ select: query, ...filters });
        return this.request<T>(
          `${base}?${params}`,
          { headers },
          `Supabase select failed for ${table}`
        );
      },
      insert: async <T = unknown>(data: unknown) => {
        return this.request<T>(base, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        }, `Supabase insert failed for ${table}`);
      },
      update: async <T = unknown>(data: unknown, filters: Record<string, string>) => {
        const params = new URLSearchParams(filters);
        return this.request<T>(`${base}?${params}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(data),
        }, `Supabase update failed for ${table}`);
      },
      upsert: async <T = unknown>(data: unknown) => {
        return this.request<T>(base, {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(data),
        }, `Supabase upsert failed for ${table}`);
      },
      delete: async <T = unknown>(filters: Record<string, string>) => {
        const params = new URLSearchParams(filters);
        return this.request<T>(
          `${base}?${params}`,
          { method: 'DELETE', headers },
          `Supabase delete failed for ${table}`
        );
      },
    };
  }

  /** Execute raw SQL via the rpc endpoint */
  async rpc<T = unknown>(fn: string, params: Record<string, unknown> = {}) {
    return this.request<T>(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    }, `Supabase rpc failed for ${fn}`);
  }
}

export function createSupabase(url: string, key: string) {
  return new SupabaseClient(url, key);
}
