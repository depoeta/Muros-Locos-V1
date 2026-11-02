/**
 * Cloudflare Worker for Muros Locos KV Persistence & Room Registry
 *
 * Environment Secrets / Variables in Cloudflare Dashboard:
 * - ADMIN_USERNAME: "admin" (or your custom secret username)
 * - ADMIN_SECRET_KEY: "your-strong-secret-key"
 *
 * KV Namespace Bindings:
 * - MUROS_KV: Cloudflare KV Namespace
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ADMIN_USER = env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASS = env.ADMIN_SECRET_KEY || 'muros2026';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
      'Access-Control-Expose-Headers': 'X-KV-Bound',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // /api/ping
    if (url.pathname === '/api/ping') {
      const lastUpdate = (await env.MUROS_KV.get('last_update')) || '0';
      return new Response(
        JSON.stringify({
          ok: true,
          kvBound: true,
          timestamp: Date.now(),
          lastUpdate: parseInt(lastUpdate, 10),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-KV-Bound': 'true' } }
      );
    }

    // /api/admin/verify
    if (url.pathname === '/api/admin/verify' && request.method === 'POST') {
      try {
        const body = await request.json();
        const trimmedKey = String(body.clave || '').trim();
        const trimmedUser = String(body.usuario || '').trim();

        if (trimmedKey === ADMIN_PASS) {
          return new Response(JSON.stringify({ ok: true, isCloudAdmin: true, level: 'cloud_kv' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (trimmedKey === 'muros2026' && (trimmedUser === 'admin' || !trimmedUser)) {
          return new Response(
            JSON.stringify({ ok: true, isCloudAdmin: false, localOnly: true, level: 'local_only' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = (await env.MUROS_KV.get('cuentas')) || '{}';
        const cuentas = JSON.parse(data);
        const userAcc = cuentas[trimmedUser];
        if (userAcc && userAcc.clave === trimmedKey && userAcc.rol === 'admin') {
          return new Response(JSON.stringify({ ok: true, isCloudAdmin: true, level: 'cloud_kv' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch {}
      return new Response(JSON.stringify({ ok: false, error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /api/admin/verify-action: Checked before EVERY admin action
    if (url.pathname === '/api/admin/verify-action' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.adminKey && String(body.adminKey).trim() === ADMIN_PASS) {
          return new Response(JSON.stringify({ ok: true, isCloudAdmin: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (body.usuarioId) {
          const data = (await env.MUROS_KV.get('cuentas')) || '{}';
          const cuentas = JSON.parse(data);
          const acc = cuentas[body.usuarioId];
          if (acc && acc.rol === 'admin') {
            return new Response(JSON.stringify({ ok: true, isCloudAdmin: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch {}
      return new Response(
        JSON.stringify({ ok: false, revoked: true, error: 'Acceso de administrador revocado en la base de datos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // /api/cuentas
    if (url.pathname === '/api/cuentas') {
      if (request.method === 'GET') {
        const data = (await env.MUROS_KV.get('cuentas')) || '{}';
        return new Response(data, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-KV-Bound': 'true' },
        });
      }
      if (request.method === 'POST') {
        const text = await request.text();
        await env.MUROS_KV.put('cuentas', text);
        const now = Date.now().toString();
        await env.MUROS_KV.put('last_update', now);
        return new Response(JSON.stringify({ ok: true, lastUpdate: parseInt(now, 10) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-KV-Bound': 'true' },
        });
      }
    }

    // /api/ranking
    if (url.pathname === '/api/ranking') {
      if (request.method === 'GET') {
        const data = (await env.MUROS_KV.get('ranking')) || '{}';
        return new Response(data, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-KV-Bound': 'true' },
        });
      }
      if (request.method === 'POST') {
        const text = await request.text();
        await env.MUROS_KV.put('ranking', text);
        const now = Date.now().toString();
        await env.MUROS_KV.put('last_update', now);
        return new Response(JSON.stringify({ ok: true, lastUpdate: parseInt(now, 10) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-KV-Bound': 'true' },
        });
      }
    }

    // /api/salas
    if (url.pathname === '/api/salas') {
      if (request.method === 'GET') {
        const salasRaw = (await env.MUROS_KV.get('salas_publicas')) || '{}';
        const salas = JSON.parse(salasRaw);
        return new Response(JSON.stringify(Object.values(salas)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-KV-Bound': 'true' },
        });
      }
      if (request.method === 'POST') {
        const room = await request.json();
        const salasRaw = (await env.MUROS_KV.get('salas_publicas')) || '{}';
        const salas = JSON.parse(salasRaw);
        salas[room.codigo] = { ...room, creadoEn: Date.now() };
        await env.MUROS_KV.put('salas_publicas', JSON.stringify(salas));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname.startsWith('/api/salas/') && request.method === 'DELETE') {
      const codigo = url.pathname.replace('/api/salas/', '').toUpperCase();
      const salasRaw = (await env.MUROS_KV.get('salas_publicas')) || '{}';
      const salas = JSON.parse(salasRaw);
      delete salas[codigo];
      await env.MUROS_KV.put('salas_publicas', JSON.stringify(salas));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
