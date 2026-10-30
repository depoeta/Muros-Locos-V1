/**
 * Cloudflare Pages Functions: Global User Accounts API
 * Route: /api/cuentas
 * 
 * Detecta automáticamente cualquier KV vinculado en Cloudflare Pages
 * (ya sea nombrado MUROS_DB, muros_db, DB, KV o cualquier otro nombre).
 */

interface KVLike {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet = async (context: { env: Record<string, unknown> }) => {
  const { env } = context;
  try {
    const kv = resolveKV(env);

    if (kv) {
      const data = await kv.get('cuentas');
      if (data) {
        return new Response(data, {
          headers: {
            ...CORS_HEADERS,
            'X-KV-Bound': 'true',
          },
        });
      }
      return new Response(JSON.stringify({}), {
        headers: {
          ...CORS_HEADERS,
          'X-KV-Bound': 'true',
        },
      });
    }

    return new Response(JSON.stringify({}), {
      headers: {
        ...CORS_HEADERS,
        'X-KV-Bound': 'false',
        'X-KV-Notice': 'Vincular KV en Cloudflare Pages > Settings > Functions > KV namespace bindings',
      },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err), kv_bound: false }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};

export const onRequestPost = async (context: { request: Request; env: Record<string, unknown> }) => {
  const { request, env } = context;
  try {
    const body = await request.text();
    const kv = resolveKV(env);

    if (kv) {
      await kv.put('cuentas', body);
      return new Response(JSON.stringify({ ok: true, source: 'cloudflare_kv', kv_bound: true }), {
        headers: {
          ...CORS_HEADERS,
          'X-KV-Bound': 'true',
        },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'local_fallback',
        kv_bound: false,
        warning: 'KV namespace no detectado. Revisa el binding en Cloudflare Pages.',
      }),
      {
        headers: {
          ...CORS_HEADERS,
          'X-KV-Bound': 'false',
        },
      }
    );
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err), kv_bound: false }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
