/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor lógico puro e independiente de Candado (Mecánica A: Lógico + Mecánica B: Mayor/Menor).
 */

import {
  CandadoConfig,
  DigitosCandado,
  EstadoCandado,
  EvaluacionDigitoLogico,
  IntentoLogico,
  IntentoMayorMenor,
  ModoCandado,
  NivelProximidad,
} from './types';

export const DIGITOS_LOGICO: DigitosCandado[] = [4, 5, 6, 8, 10, 14, 16];
export const DIGITOS_MAYOR_MENOR: DigitosCandado[] = [4, 5, 6, 8, 10];

export function normalizarConfigCandado(config: CandadoConfig): CandadoConfig {
  let digitos = config.digitos;
  if (config.modo === 'mayor_menor' && digitos > 10) {
    digitos = 10;
  }
  // Con 14 o 16 dígitos es matemáticamente obligatorio permitir repetidos (solo hay 10 cifras 0–9)
  const permitirRepetidos =
    config.modo === 'logico' && digitos > 10 ? true : Boolean(config.permitirRepetidos);

  return {
    ...config,
    digitos,
    permitirRepetidos,
  };
}

function enteroAleatorio(maxExclusivo: number): number {
  if (maxExclusivo <= 1) return 0;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    const limite = Math.floor(0xffffffff / maxExclusivo) * maxExclusivo;
    let r = 0;
    do {
      crypto.getRandomValues(arr);
      r = arr[0];
    } while (r >= limite);
    return r % maxExclusivo;
  }
  return Math.floor(Math.random() * maxExclusivo);
}

export function generarSecreto(
  digitos: DigitosCandado,
  modo: ModoCandado,
  permitirRepetidos: boolean
): string {
  if (modo === 'logico' && !permitirRepetidos && digitos <= 10) {
    const pool = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = enteroAleatorio(i + 1);
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, digitos).join('');
  }

  let out = '';
  for (let i = 0; i < digitos; i++) {
    out += String(enteroAleatorio(10));
  }
  return out;
}

export function formatearNumeroConCeros(valor: number, digitos: DigitosCandado): string {
  const safeDigits = Math.min(digitos, 10);
  const clamped = Math.max(0, Math.min(10 ** safeDigits - 1, Math.floor(valor)));
  return String(clamped).padStart(digitos, '0');
}

export function evaluarIntentoLogico(
  entrada: string,
  secreto: string
): {
  digitos: EvaluacionDigitoLogico[];
  exactos: number;
  desubicados: number;
  ausentes: number;
  gano: boolean;
} {
  const len = secreto.length;
  const resultado: EvaluacionDigitoLogico[] = new Array(len);
  const conteoRestante: Record<string, number> = {};

  let exactos = 0;
  let desubicados = 0;
  let ausentes = 0;

  // Pasada 1: coincidencias exactas en su posición
  for (let i = 0; i < len; i++) {
    if (entrada[i] === secreto[i]) {
      resultado[i] = { digito: entrada[i], estado: 'exacto' };
      exactos++;
    } else {
      const ch = secreto[i];
      conteoRestante[ch] = (conteoRestante[ch] || 0) + 1;
    }
  }

  // Pasada 2: dígitos en posición incorrecta vs ausentes
  for (let i = 0; i < len; i++) {
    if (resultado[i]) continue;
    const ch = entrada[i];
    if ((conteoRestante[ch] || 0) > 0) {
      conteoRestante[ch]--;
      resultado[i] = { digito: ch, estado: 'desubicado' };
      desubicados++;
    } else {
      resultado[i] = { digito: ch, estado: 'ausente' };
      ausentes++;
    }
  }

  return {
    digitos: resultado,
    exactos,
    desubicados,
    ausentes,
    gano: exactos === len,
  };
}

export function evaluarIntentoMayorMenor(
  entrada: string,
  secreto: string,
  rangoMinActual: number,
  rangoMaxActual: number
): {
  direccion: 'alto' | 'bajo' | 'exacto';
  proximidad: NivelProximidad;
  exactosEnPosicion: number;
  rangoMin: number;
  rangoMax: number;
  gano: boolean;
} {
  const valIntento = Number(entrada);
  const valSecreto = Number(secreto);
  const maxTotal = 10 ** secreto.length;

  let exactosEnPosicion = 0;
  for (let i = 0; i < secreto.length; i++) {
    if (entrada[i] === secreto[i]) exactosEnPosicion++;
  }

  if (valIntento === valSecreto) {
    return {
      direccion: 'exacto',
      proximidad: 'exacto',
      exactosEnPosicion,
      rangoMin: valSecreto,
      rangoMax: valSecreto,
      gano: true,
    };
  }

  const direccion: 'alto' | 'bajo' = valSecreto > valIntento ? 'alto' : 'bajo';
  const ratio = Math.abs(valSecreto - valIntento) / maxTotal;

  let proximidad: NivelProximidad = 'muy_frio';
  if (ratio <= 0.005) proximidad = 'hirviendo';
  else if (ratio <= 0.025) proximidad = 'caliente';
  else if (ratio <= 0.1) proximidad = 'tibio';
  else if (ratio <= 0.3) proximidad = 'frio';

  const nuevoMin = direccion === 'alto' ? Math.max(rangoMinActual, valIntento + 1) : rangoMinActual;
  const nuevoMax = direccion === 'bajo' ? Math.min(rangoMaxActual, valIntento - 1) : rangoMaxActual;

  return {
    direccion,
    proximidad,
    exactosEnPosicion,
    rangoMin: Math.min(nuevoMin, nuevoMax),
    rangoMax: Math.max(nuevoMin, nuevoMax),
    gano: false,
  };
}

export function iniciarPartidaCandado(configRaw: CandadoConfig): EstadoCandado {
  const config = normalizarConfigCandado(configRaw);
  const ahora = Date.now();
  const safeDigits = Math.min(config.digitos, 10);
  const maxValor = 10 ** safeDigits - 1;
  return {
    config,
    secreto: generarSecreto(config.digitos, config.modo, config.permitirRepetidos),
    fase: 'jugando',
    intentos: [],
    rangoMinActual: 0,
    rangoMaxActual: maxValor,
    inicioMs: ahora,
    finMs: null,
  };
}

export interface ResultadoAccionIntento {
  ok: boolean;
  error?: string;
  estado: EstadoCandado;
  intento?: IntentoLogico | IntentoMayorMenor;
}

export function registrarIntentoCandado(
  estado: EstadoCandado,
  entradaBruta: string
): ResultadoAccionIntento {
  if (estado.fase !== 'jugando') {
    return { ok: false, error: 'La partida ya finalizó.', estado };
  }

  const entrada = String(entradaBruta || '').trim();
  const { digitos, modo, maxIntentos, permitirRepetidos } = estado.config;

  if (!new RegExp(`^\\d{${digitos}}$`).test(entrada)) {
    return { ok: false, error: `Ingresa exactamente ${digitos} dígitos (0–9).`, estado };
  }

  if (modo === 'logico' && !permitirRepetidos) {
    const unicos = new Set(entrada.split(''));
    if (unicos.size !== digitos) {
      return { ok: false, error: 'En modo sin repetidos, cada dígito debe ser diferente.', estado };
    }
  }

  if (estado.intentos.some((it) => it.entrada === entrada)) {
    return { ok: false, error: `Ya probaste la combinación ${entrada}.`, estado };
  }

  const ahora = Date.now();
  const numeroIntento = estado.intentos.length + 1;

  if (modo === 'logico') {
    const ev = evaluarIntentoLogico(entrada, estado.secreto);
    const intento: IntentoLogico = {
      numero: numeroIntento,
      entrada,
      digitos: ev.digitos,
      exactos: ev.exactos,
      desubicados: ev.desubicados,
      ausentes: ev.ausentes,
      timestamp: ahora,
    };

    const nuevosIntentos = [intento, ...estado.intentos];
    const perdio = !ev.gano && maxIntentos > 0 && nuevosIntentos.length >= maxIntentos;
    const nuevaFase = ev.gano ? 'ganada' : perdio ? 'perdida' : 'jugando';

    return {
      ok: true,
      intento,
      estado: {
        ...estado,
        intentos: nuevosIntentos,
        fase: nuevaFase,
        finMs: nuevaFase === 'jugando' ? null : ahora,
      },
    };
  }

  const evB = evaluarIntentoMayorMenor(
    entrada,
    estado.secreto,
    estado.rangoMinActual,
    estado.rangoMaxActual
  );
  const intento: IntentoMayorMenor = {
    numero: numeroIntento,
    entrada,
    direccion: evB.direccion,
    proximidad: evB.proximidad,
    exactosEnPosicion: evB.exactosEnPosicion,
    rangoMin: evB.rangoMin,
    rangoMax: evB.rangoMax,
    timestamp: ahora,
  };

  const nuevosIntentos = [intento, ...estado.intentos];
  const perdio = !evB.gano && maxIntentos > 0 && nuevosIntentos.length >= maxIntentos;
  const nuevaFase = evB.gano ? 'ganada' : perdio ? 'perdida' : 'jugando';

  return {
    ok: true,
    intento,
    estado: {
      ...estado,
      intentos: nuevosIntentos,
      rangoMinActual: evB.rangoMin,
      rangoMaxActual: evB.rangoMax,
      fase: nuevaFase,
      finMs: nuevaFase === 'jugando' ? null : ahora,
    },
  };
}
