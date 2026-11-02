/**
 * Cloudflare Pages Functions: Public Rooms API
 * Route: /api/salas
 */

interface KVLike {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function resolveKV(env: Record<string, unknown>): KVLike | null {
  if (!env || typeof env !== 'object') return null;
  const knownKeys = ['MUROS_DB', 'muros_db', 'DB', 'KV', 'MUROS_DATA', 'DATABASE'];
  for (const k of knownKeys) {
    const candidate = env[k] as Partial<KVLike> | undefined;
    if (candidate && typeof candidate.get === 'function' && typeof candidate.put === 'function') {
      return candidate as KVLike;
    }
  }
  for (const val of Object.values(env)) {
    const candidate = val as Partial<KVLike> | undefined;
    if (candidate && typeof candidate.get === 'function' && typeof candidate.put === 'function') {
      return candidate as KVLike;
    }
  }
  return null;
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet = async (context: { env: Record<string, unknown> }) => {
  const { env } = context;
  try {
    const kv = resolveKV(env);
    if (kv) {
      const data = await kv.get('salas_publicas');
      const list = data ? JSON.parse(data) : [];
      // Filter out rooms older than 30 mins
      const now = Date.now();
      const valid = list.filter((r: { creadoEn?: number }) => (now - (r.creadoEn || 0)) < 30 * 60 * 1000);
      return new Response(JSON.stringify(valid), {
        headers: { ...CORS_HEADERS, 'X-KV-Bound': 'true' },
      });
    }
    return new Response(JSON.stringify([]), {
      headers: { ...CORS_HEADERS, 'X-KV-Bound': 'false' },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};

export const onRequestPost = async (context: { request: Request; env: Record<string, unknown> }) => {
  const { request, env } = context;
  try {
    const body = await request.json() as any;
    const kv = resolveKV(env);
    if (kv && body && body.codigo) {
      const data = await kv.get('salas_publicas');
      const list = data ? JSON.parse(data) : [];
      const updated = list.filter((r: { codigo: string }) => r.codigo !== body.codigo);
      updated.push({
        ...body,
        creadoEn: Date.now(),
      });
      await kv.put('salas_publicas', JSON.stringify(updated));
    }
    return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
