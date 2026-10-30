/**
 * Cloudflare Pages Functions: Global User Accounts API
 * Route: /api/cuentas
 * 
 * Si vinculas un KV Namespace con el nombre 'MUROS_DB' en Cloudflare Pages,
 * este endpoint almacenará los perfiles de usuario de forma global en la nube.
 */

interface Env {
  MUROS_DB?: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
  };
}

export const onRequestGet = async (context: { env: Env }) => {
  const { env } = context;
  try {
    if (env.MUROS_DB) {
      const data = await env.MUROS_DB.get('cuentas');
      if (data) {
        return new Response(data, {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
    return new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  try {
    const body = await request.text();
    if (env.MUROS_DB) {
      await env.MUROS_DB.put('cuentas', body);
      return new Response(JSON.stringify({ ok: true, source: 'cloudflare_kv' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    return new Response(JSON.stringify({ ok: true, source: 'local' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
