export interface AuthenticatedUser {
  id: string;
  email?: string;
}

interface AuthContextLike {
  req: {
    header: (name: string) => string | undefined;
  };
  env: {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
  };
}

function readBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

export async function getAuthenticatedUser(c: AuthContextLike): Promise<AuthenticatedUser | null> {
  const token = readBearerToken(c.req.header('Authorization'));
  if (!token) return null;

  const authUrl = `${c.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`;
  const res = await fetch(authUrl, {
    method: 'GET',
    headers: {
      apikey: c.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return null;
  }

  const user = (await res.json()) as { id?: string; email?: string };
  if (!user?.id) return null;

  return {
    id: user.id,
    email: user.email,
  };
}

export function isOwner(authUser: AuthenticatedUser, userId: string): boolean {
  return authUser.id === userId;
}
