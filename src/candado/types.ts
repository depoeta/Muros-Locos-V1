/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tipos independientes del minijuego Candado (Beta Local).
 */

export type ModoCandado = 'logico' | 'mayor_menor';

export type DigitosCandado = 4 | 5 | 6;

/** 0 representa intentos ilimitados (opción por defecto en local) */
export type LimiteIntentosCandado = 0 | 10 | 12 | 15 | 20;

export type EstadoDigitoLogico = 'exacto' | 'desubicado' | 'ausente';

export type NivelProximidad =
  | 'exacto'
  | 'hirviendo'
  | 'caliente'
  | 'tibio'
  | 'frio'
  | 'muy_frio';

export interface EvaluacionDigitoLogico {
  digito: string;
  estado: EstadoDigitoLogico;
}

export interface IntentoLogico {
  numero: number;
  entrada: string;
  digitos: EvaluacionDigitoLogico[];
  exactos: number;
  desubicados: number;
  ausentes: number;
  timestamp: number;
}

export interface IntentoMayorMenor {
  numero: number;
  entrada: string;
  direccion: 'alto' | 'bajo' | 'exacto';
  proximidad: NivelProximidad;
  exactosEnPosicion: number;
  rangoMin: number;
  rangoMax: number;
  timestamp: number;
}

export type IntentoCandado = IntentoLogico | IntentoMayorMenor;

export interface CandadoConfig {
  modo: ModoCandado;
  digitos: DigitosCandado;
  /** 0 = ilimitado (default), >= 10 = límite de intentos */
  maxIntentos: LimiteIntentosCandado;
  /** Solo aplica en Mecánica A ('logico') */
  permitirRepetidos: boolean;
}

export type FasePartidaCandado = 'jugando' | 'ganada' | 'perdida';

export interface EstadoCandado {
  config: CandadoConfig;
  secreto: string;
  fase: FasePartidaCandado;
  intentos: IntentoCandado[];
  rangoMinActual: number;
  rangoMaxActual: number;
  inicioMs: number;
  finMs: number | null;
}

export type NotaDigito = 'neutro' | 'descartado' | 'posible';
