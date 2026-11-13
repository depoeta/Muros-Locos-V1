/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cliente aislado para acreditar y consultar puntos de Candado (/api/candado/puntos).
 * Solo afecta `puntos` del jugador sin alterar estadísticas ni historial de Muros Locos.
 */

import { getApiBaseUrl, obtenerTokenSesion } from '../game/storage';
import { CandadoConfig, DigitosCandado, ModoCandado } from './types';

export interface RespuestaPuntosCandado {
  ok: boolean;
  confirmado?: boolean;
  pendienteConsenso?: boolean;
  conflicto?: boolean;
  duplicado?: boolean;
  puntosOtorgados: number;
  puntosTotales?: number;
  cupoDiarioRestante?: number;
  topeDiarioAlcanzado?: boolean;
  error?: string;
}

export function generarMatchIdCandado(prefijo: 'cndl' | 'cndp' = 'cndl'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${Date.now().toString(36)}_${rand}`;
}

export function calcularPreviewPuntosLocal(
  config: CandadoConfig,
  intentosUsados: number
): number {
  if (intentosUsados < 1) return 0;
  const tabla: Record<number, { base: number; limiteRapido: number; bonoRapido: number; bonoLimite: number }> = {
    4: { base: 3, limiteRapido: 6, bonoRapido: 1, bonoLimite: 1 },
    5: { base: 5, limiteRapido: 7, bonoRapido: 2, bonoLimite: 2 },
    6: { base: 8, limiteRapido: 8, bonoRapido: 3, bonoLimite: 3 },
    8: { base: 10, limiteRapido: 10, bonoRapido: 3, bonoLimite: 2 },
    10: { base: 12, limiteRapido: 12, bonoRapido: 4, bonoLimite: 2 },
    14: { base: 14, limiteRapido: 15, bonoRapido: 4, bonoLimite: 2 },
    16: { base: 16, limiteRapido: 18, bonoRapido: 4, bonoLimite: 2 },
  };
  const regla = tabla[config.digitos] || tabla[4];
  let total = regla.base;
  if (intentosUsados <= regla.limiteRapido) total += regla.bonoRapido;
  if (config.maxIntentos > 0) total += regla.bonoLimite;
  return total;
}

export function calcularPreviewPuntosP2P(
  digitos: DigitosCandado,
  resultado: 'victoria' | 'derrota' | 'empate',
  abandono: boolean = false
): number {
  if (abandono) return 0;
  if (resultado === 'victoria') return 10 + Math.min(6, Math.max(0, digitos - 4));
  if (resultado === 'empate') return 6;
  return 2;
}

export async function reportarPuntosCandadoAsync(payload: {
  matchId: string;
  modalidad: 'local' | 'p2p';
  modo: ModoCandado;
  digitos: DigitosCandado;
  conLimite: boolean;
  intentosUsados: number;
  resultado: 'victoria' | 'derrota' | 'empate';
  abandono?: boolean;
  codigoSala?: string;
  rivalCuentaId?: string;
  abandonoPorDesconexion?: boolean;
}): Promise<RespuestaPuntosCandado> {
  const token = obtenerTokenSesion();
  if (!token) {
    return {
      ok: false,
      puntosOtorgados: 0,
      error: 'Inicia sesión para guardar puntos.',
    };
  }

  try {
    const res = await fetch(getApiBaseUrl('/api/candado/puntos'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        conflicto: Boolean(data?.conflicto),
        duplicado: Boolean(data?.duplicado),
        puntosOtorgados: 0,
        error: data?.error || `Error HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      confirmado: Boolean(data?.confirmado),
      pendienteConsenso: Boolean(data?.pendienteConsenso),
      puntosOtorgados: Number(data?.puntosOtorgados) || 0,
      puntosTotales: typeof data?.puntosTotales === 'number' ? data.puntosTotales : undefined,
      cupoDiarioRestante:
        typeof data?.cupoDiarioRestante === 'number' ? data.cupoDiarioRestante : undefined,
      topeDiarioAlcanzado: Boolean(data?.topeDiarioAlcanzado),
    };
  } catch {
    return {
      ok: false,
      puntosOtorgados: 0,
      error: 'Sin conexión con el servidor para acreditar puntos.',
    };
  }
}

export async function consultarPuntosCandadoAsync(
  matchId: string
): Promise<RespuestaPuntosCandado> {
  const token = obtenerTokenSesion();
  if (!token) {
    return { ok: false, puntosOtorgados: 0, error: 'Sin sesión' };
  }

  try {
    const base = getApiBaseUrl('/api/candado/puntos');
    const url = `${base}?matchId=${encodeURIComponent(matchId)}&_t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, puntosOtorgados: 0, error: data?.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      confirmado: Boolean(data?.confirmado),
      pendienteConsenso: Boolean(data?.pendienteConsenso),
      conflicto: Boolean(data?.conflicto),
      puntosOtorgados: Number(data?.puntosOtorgados) || 0,
      puntosTotales: typeof data?.puntosTotales === 'number' ? data.puntosTotales : undefined,
      cupoDiarioRestante:
        typeof data?.cupoDiarioRestante === 'number' ? data.cupoDiarioRestante : undefined,
    };
  } catch {
    return { ok: false, puntosOtorgados: 0, error: 'Error de red' };
  }
}
