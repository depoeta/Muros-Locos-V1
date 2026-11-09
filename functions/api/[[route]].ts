/**
 * Cloudflare Pages Catch-All API Route: /functions/api/[[route]].ts
 * Reemplaza cuentas.ts, ranking.ts y salas.ts en UN SOLO ARCHIVO y añade /api/ping y /api/admin/*
 * reutilizando exactamente la misma lógica que cloudflare-worker.js.
 */

import { handleApiRequest } from '../../cloudflare-worker.js';

export const onRequest = async (context: { request: Request; env: Record<string, unknown> }) => {
  return handleApiRequest(context.request, context.env);
};
