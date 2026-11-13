/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sistema criptográfico anti-trampas Commit-Reveal (SHA-256) para duelos P2P de Candado.
 * Garantiza que ningún jugador pueda cambiar su código secreto a mitad de la partida
 * y permite auditar todas las pistas entregadas al revelar secreto + sal al final.
 */

import { evaluarIntentoLogico, evaluarIntentoMayorMenor } from './candadoEngine';
import {
  DigitosCandado,
  IntentoCandado,
  IntentoLogico,
  IntentoMayorMenor,
  ModoCandado,
} from './types';

function bytesAHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function generarSalAleatoria(numBytes: number = 16): string {
  const arr = new Uint8Array(numBytes);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < numBytes; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesAHex(arr);
}

export async function calcularCommitHash(secreto: string, sal: string): Promise<string> {
  const texto = `${secreto}:${sal}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return bytesAHex(hashBuf);
  }
  // Fallback determinista de emergencia si un contexto no-HTTPS carece de subtle
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    h1 = Math.imul(h1 ^ data[i], 0x01000193);
    h2 = Math.imul(h2 ^ (data[i] + i), 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export interface ResultadoVerificacionReveal {
  verificado: boolean;
  commitValido: boolean;
  pistasValidas: boolean;
  motivo?: string;
}

export async function verificarCommitYHistorial(params: {
  secreto: string;
  sal: string;
  commitHash: string;
  modo: ModoCandado;
  digitos: DigitosCandado;
  permitirRepetidos: boolean;
  intentosRealizadosContraEsteSecreto: IntentoCandado[];
}): Promise<ResultadoVerificacionReveal> {
  const {
    secreto,
    sal,
    commitHash,
    modo,
    digitos,
    permitirRepetidos,
    intentosRealizadosContraEsteSecreto,
  } = params;

  if (!new RegExp(`^\\d{${digitos}}$`).test(secreto)) {
    return {
      verificado: false,
      commitValido: false,
      pistasValidas: false,
      motivo: `El código revelado (${secreto}) no tiene ${digitos} dígitos válidos.`,
    };
  }

  if (modo === 'logico' && !permitirRepetidos && new Set(secreto.split('')).size !== digitos) {
    return {
      verificado: false,
      commitValido: false,
      pistasValidas: false,
      motivo: 'El código revelado viola la regla de dígitos únicos.',
    };
  }

  const hashCalculado = await calcularCommitHash(secreto, sal);
  const commitValido = Boolean(commitHash) && hashCalculado === commitHash;
  if (!commitValido) {
    return {
      verificado: false,
      commitValido: false,
      pistasValidas: false,
      motivo: 'El sello SHA-256 no coincide con el compromiso inicial de la partida.',
    };
  }

  // Re-evaluar en orden cronológico (los intentos se almacenan más reciente primero)
  const cronologicos = [...intentosRealizadosContraEsteSecreto].sort(
    (a, b) => a.numero - b.numero
  );

  const safeDigits = Math.min(digitos, 10);
  let rMin = 0;
  let rMax = 10 ** safeDigits - 1;

  for (const it of cronologicos) {
    if (modo === 'logico') {
      const itA = it as IntentoLogico;
      const evReal = evaluarIntentoLogico(itA.entrada, secreto);
      if (
        evReal.exactos !== itA.exactos ||
        evReal.desubicados !== itA.desubicados ||
        evReal.ausentes !== itA.ausentes
      ) {
        return {
          verificado: false,
          commitValido: true,
          pistasValidas: false,
          motivo: `La pista del intento #${itA.numero} (${itA.entrada}) no coincide con el código revelado.`,
        };
      }
    } else {
      const itB = it as IntentoMayorMenor;
      const evReal = evaluarIntentoMayorMenor(itB.entrada, secreto, rMin, rMax);
      rMin = evReal.rangoMin;
      rMax = evReal.rangoMax;
      if (
        evReal.direccion !== itB.direccion ||
        evReal.proximidad !== itB.proximidad ||
        evReal.exactosEnPosicion !== itB.exactosEnPosicion
      ) {
        return {
          verificado: false,
          commitValido: true,
          pistasValidas: false,
          motivo: `La pista del intento #${itB.numero} (${itB.entrada}) no coincide con el código revelado.`,
        };
      }
    }
  }

  return {
    verificado: true,
    commitValido: true,
    pistasValidas: true,
  };
}
