/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Protocolo puro y determinista para el flujo de turnos P2P de Candado.
 * Garantiza bloqueo optimista al enviar, validación estricta de turno
 * e idempotencia ante reintentos WebRTC/HTTP o clics rápidos repetidos.
 */

import { evaluarIntentoLogico, evaluarIntentoMayorMenor } from './candadoEngine';
import {
  EstadoDueloP2P,
  IntentoLogico,
  IntentoMayorMenor,
  MensajeCandadoP2P,
} from './types';

export type ResultadoEnvioP2P =
  | {
      ok: false;
      error?: string;
      silencioso?: boolean;
    }
  | {
      ok: true;
      nuevoEstado: EstadoDueloP2P;
      mensaje: Extract<MensajeCandadoP2P, { type: 'CANDADO_GUESS' }>;
      pendiente: NonNullable<EstadoDueloP2P['intentoPendiente']>;
    };

export function prepararEnvioIntentoP2P(
  duelo: EstadoDueloP2P | null,
  entradaActual: string[],
  bloqueoSincronoActivo: string | null,
  now: number = Date.now()
): ResultadoEnvioP2P {
  if (!duelo || duelo.fase !== 'jugando') {
    return { ok: false, silencioso: true };
  }
  if (bloqueoSincronoActivo || duelo.intentoPendiente) {
    return { ok: false, silencioso: true };
  }
  if (duelo.turnoActual !== duelo.miJugadorId) {
    return { ok: false, error: 'Espera tu turno para probar combinación.' };
  }

  const saltosMios = duelo.turnosSaltadosPorJugador?.[duelo.miJugadorId] ?? 0;
  if (
    duelo.config.maxIntentos > 0 &&
    duelo.misIntentos.length + saltosMios >= duelo.config.maxIntentos
  ) {
    return { ok: false, error: 'Ya alcanzaste el límite de intentos de la sala.' };
  }

  const entrada = entradaActual.join('');
  if (entrada.length !== duelo.config.digitos || entradaActual.some((x) => x === '')) {
    return { ok: false, error: `Completa los ${duelo.config.digitos} dígitos.` };
  }
  if (duelo.config.modo === 'logico' && !duelo.config.permitirRepetidos) {
    if (new Set(entrada.split('')).size !== duelo.config.digitos) {
      return { ok: false, error: 'Cada dígito debe ser diferente en modo únicos.' };
    }
  }
  if (duelo.misIntentos.some((it) => it.entrada === entrada)) {
    return { ok: false, error: `Ya probaste ${entrada}.` };
  }

  const numeroIntento = duelo.misIntentos.length + 1;
  const actionId = `g_${now.toString(36)}_${numeroIntento}_${Math.random().toString(36).slice(2, 6)}`;
  const pendiente = {
    actionId,
    entrada,
    numeroIntento,
    enviadoAt: now,
  };

  return {
    ok: true,
    pendiente,
    nuevoEstado: {
      ...duelo,
      intentoPendiente: pendiente,
      ultimoIntentoExpiradoPorLag: null,
    },
    mensaje: {
      type: 'CANDADO_GUESS',
      matchId: duelo.matchId,
      jugadorId: duelo.miJugadorId,
      numeroIntento,
      entrada,
      actionId,
    },
  };
}

export type ClueEmitida = Extract<MensajeCandadoP2P, { type: 'CANDADO_CLUE' }>;

export interface CacheCluesEmitidas {
  porActionId: Map<string, ClueEmitida>;
  porNumero: Map<number, { entrada: string; clue: ClueEmitida }>;
}

export function crearCacheCluesEmitidas(): CacheCluesEmitidas {
  return {
    porActionId: new Map(),
    porNumero: new Map(),
  };
}

export type ResultadoGuessRivalP2P =
  | {
      kind: 'ignore';
      reason: string;
    }
  | {
      kind: 'resend_clue';
      clue: ClueEmitida;
      revealNecesario: boolean;
    }
  | {
      kind: 'evaluated';
      nuevoEstado: EstadoDueloP2P;
      clue: ClueEmitida;
      partidaTerminada: boolean;
      desenlace: EstadoDueloP2P['desenlaceParaMi'];
    };

export function procesarGuessRivalP2P(
  cur: EstadoDueloP2P | null,
  msg: Extract<MensajeCandadoP2P, { type: 'CANDADO_GUESS' }>,
  nombres: { miNombre: string; rivalNombre: string },
  cache: CacheCluesEmitidas,
  now: number = Date.now()
): ResultadoGuessRivalP2P {
  if (!cur || msg.matchId !== cur.matchId) {
    return { kind: 'ignore', reason: 'match_mismatch' };
  }
  if (msg.jugadorId === cur.miJugadorId) {
    return { kind: 'ignore', reason: 'self_guess' };
  }

  const entrada = String(msg.entrada || '').trim();

  // 1) Idempotencia por actionId (ej. reintento HTTP tras caída silenciosa de WebRTC)
  const cachedPorAccion = msg.actionId ? cache.porActionId.get(msg.actionId) : undefined;
  if (cachedPorAccion) {
    return {
      kind: 'resend_clue',
      clue: cachedPorAccion,
      revealNecesario: cachedPorAccion.partidaTerminada,
    };
  }

  // 2) Idempotencia por número de intento + misma combinación
  const cachedPorNum = cache.porNumero.get(msg.numeroIntento);
  if (cachedPorNum && cachedPorNum.entrada === entrada) {
    if (msg.actionId) {
      cache.porActionId.set(msg.actionId, cachedPorNum.clue);
    }
    return {
      kind: 'resend_clue',
      clue: cachedPorNum.clue,
      revealNecesario: cachedPorNum.clue.partidaTerminada,
    };
  }

  // 3) Guardias estrictos de fase, turno y secuencia
  if (cur.fase !== 'jugando') {
    return { kind: 'ignore', reason: 'not_playing' };
  }
  if (msg.jugadorId !== cur.turnoActual) {
    return { kind: 'ignore', reason: 'out_of_turn' };
  }
  const numeroEsperado = cur.intentosRival.length + 1;
  if (msg.numeroIntento !== numeroEsperado) {
    return { kind: 'ignore', reason: 'unexpected_attempt_number' };
  }
  if (!new RegExp(`^\\d{${cur.config.digitos}}$`).test(entrada)) {
    return { kind: 'ignore', reason: 'invalid_digits' };
  }
  if (cur.intentosRival.some((it) => it.entrada === entrada)) {
    return { kind: 'ignore', reason: 'duplicate_combination' };
  }

  let intentoGenerado: IntentoLogico | IntentoMayorMenor;
  let descifrado = false;
  let nuevoMin = cur.rivalRangoMin;
  let nuevoMax = cur.rivalRangoMax;

  if (cur.config.modo === 'logico') {
    const ev = evaluarIntentoLogico(entrada, cur.miSecreto);
    descifrado = ev.gano;
    intentoGenerado = {
      numero: numeroEsperado,
      entrada,
      digitos: ev.digitos,
      exactos: ev.exactos,
      desubicados: ev.desubicados,
      ausentes: ev.ausentes,
      timestamp: now,
    };
  } else {
    const evB = evaluarIntentoMayorMenor(
      entrada,
      cur.miSecreto,
      cur.rivalRangoMin,
      cur.rivalRangoMax
    );
    descifrado = evB.gano;
    nuevoMin = evB.rangoMin;
    nuevoMax = evB.rangoMax;
    intentoGenerado = {
      numero: numeroEsperado,
      entrada,
      direccion: evB.direccion,
      proximidad: evB.proximidad,
      exactosEnPosicion: evB.exactosEnPosicion,
      rangoMin: evB.rangoMin,
      rangoMax: evB.rangoMax,
      timestamp: now,
    };
  }

  let partidaTerminada = false;
  let ganadorId: 0 | 1 | 'empate' | null = null;
  let motivoFin: string | undefined;
  let siguienteTurno: 0 | 1 = cur.miJugadorId;
  let turnoIgualador = cur.turnoIgualadorPendiente;

  if (msg.jugadorId === 0) {
    if (descifrado) {
      turnoIgualador = true;
      siguienteTurno = 1;
    } else {
      siguienteTurno = 1;
    }
  } else {
    if (cur.turnoIgualadorPendiente || cur.yoDescifre) {
      partidaTerminada = true;
      if (descifrado) {
        ganadorId = 'empate';
        motivoFin = '¡Ambos descifraron el candado en la misma ronda!';
      } else {
        ganadorId = 0;
        motivoFin = `${nombres.miNombre} descifró el candado primero.`;
      }
    } else if (descifrado) {
      partidaTerminada = true;
      ganadorId = 1;
      motivoFin = `${nombres.rivalNombre} descifró tu candado en ${numeroEsperado} intentos.`;
    } else {
      const saltosMios = cur.turnosSaltadosPorJugador?.[cur.miJugadorId] ?? 0;
      const saltosRival = cur.turnosSaltadosPorJugador?.[1] ?? 0;
      const consumidosMios = cur.misIntentos.length + saltosMios;
      const consumidosRival = numeroEsperado + saltosRival;
      if (
        cur.config.maxIntentos > 0 &&
        consumidosRival >= cur.config.maxIntentos &&
        consumidosMios >= cur.config.maxIntentos
      ) {
        partidaTerminada = true;
        ganadorId = 'empate';
        motivoFin = 'Se agotó el límite de intentos para ambos.';
      } else {
        siguienteTurno = 0;
      }
    }
  }

  const desenlace: EstadoDueloP2P['desenlaceParaMi'] = partidaTerminada
    ? ganadorId === 'empate'
      ? 'empate'
      : ganadorId === cur.miJugadorId
      ? 'victoria'
      : 'derrota'
    : null;

  const nuevoEstado: EstadoDueloP2P = {
    ...cur,
    intentosRival: [intentoGenerado, ...cur.intentosRival],
    rivalRangoMin: nuevoMin,
    rivalRangoMax: nuevoMax,
    rivalDescifro: cur.rivalDescifro || descifrado,
    turnoIgualadorPendiente: turnoIgualador,
    turnoActual: siguienteTurno,
    fase: partidaTerminada ? 'terminada' : 'jugando',
    ganadorId,
    desenlaceParaMi: desenlace,
    motivoFin,
    tiempoRestanteTurno: cur.config.tiempoTurnoSeg,
    finMs: partidaTerminada ? now : null,
  };

  const clue: ClueEmitida = {
    type: 'CANDADO_CLUE',
    matchId: cur.matchId,
    objetivoJugadorId: msg.jugadorId,
    intento: intentoGenerado,
    descifrado,
    siguienteTurno,
    turnoIgualadorPendiente: turnoIgualador,
    partidaTerminada,
    ganadorId,
    motivoFin,
    actionId: msg.actionId ? `c_${msg.actionId}` : undefined,
  };

  if (msg.actionId) {
    cache.porActionId.set(msg.actionId, clue);
  }
  cache.porNumero.set(numeroEsperado, { entrada, clue });

  return {
    kind: 'evaluated',
    nuevoEstado,
    clue,
    partidaTerminada,
    desenlace,
  };
}

export type ResultadoClueRecibidaP2P =
  | {
      ok: false;
      reason: string;
    }
  | {
      ok: true;
      nuevoEstado: EstadoDueloP2P;
      desenlace: EstadoDueloP2P['desenlaceParaMi'];
    };

export function procesarClueRecibidaP2P(
  cur: EstadoDueloP2P | null,
  msg: ClueEmitida,
  now: number = Date.now()
): ResultadoClueRecibidaP2P {
  if (!cur || msg.matchId !== cur.matchId) {
    return { ok: false, reason: 'match_mismatch' };
  }
  if (msg.objetivoJugadorId !== cur.miJugadorId) {
    return { ok: false, reason: 'not_target_player' };
  }
  if (cur.fase === 'terminada') {
    return { ok: false, reason: 'already_finished' };
  }

  // Idempotencia estricta: evitar aplicar dos veces el mismo número de intento o uno fuera de secuencia
  const numeroEsperado = cur.misIntentos.length + 1;
  if (
    msg.intento.numero !== numeroEsperado ||
    cur.misIntentos.some((it) => it.numero === msg.intento.numero)
  ) {
    return { ok: false, reason: 'duplicate_or_stale_clue' };
  }

  const esLogico = cur.config.modo === 'logico';
  const itB = !esLogico ? (msg.intento as IntentoMayorMenor) : null;
  const desenlace: EstadoDueloP2P['desenlaceParaMi'] = msg.partidaTerminada
    ? msg.ganadorId === 'empate'
      ? 'empate'
      : msg.ganadorId === cur.miJugadorId
      ? 'victoria'
      : 'derrota'
    : null;

  const lagExp = cur.ultimoIntentoExpiradoPorLag;
  const esRecuperacionDeLag = Boolean(
    lagExp &&
      (msg.actionId === `c_${lagExp.actionId}` || msg.intento.numero === lagExp.numeroIntento)
  );
  const saltosActuales: [number, number] = cur.turnosSaltadosPorJugador
    ? [cur.turnosSaltadosPorJugador[0], cur.turnosSaltadosPorJugador[1]]
    : [0, 0];
  if (esRecuperacionDeLag) {
    saltosActuales[cur.miJugadorId] = Math.max(0, saltosActuales[cur.miJugadorId] - 1);
  }

  const nuevoEstado: EstadoDueloP2P = {
    ...cur,
    misIntentos: [msg.intento, ...cur.misIntentos],
    miRangoMin: itB ? itB.rangoMin : cur.miRangoMin,
    miRangoMax: itB ? itB.rangoMax : cur.miRangoMax,
    yoDescifre: cur.yoDescifre || msg.descifrado,
    turnoIgualadorPendiente: msg.turnoIgualadorPendiente,
    turnoActual: msg.siguienteTurno,
    turnosSaltadosPorJugador: saltosActuales,
    fase: msg.partidaTerminada ? 'terminada' : 'jugando',
    ganadorId: msg.ganadorId,
    desenlaceParaMi: desenlace,
    motivoFin: msg.motivoFin,
    tiempoRestanteTurno: cur.config.tiempoTurnoSeg,
    finMs: msg.partidaTerminada ? now : null,
    intentoPendiente: null,
    ultimoIntentoExpiradoPorLag: null,
  };

  return {
    ok: true,
    nuevoEstado,
    desenlace,
  };
}
