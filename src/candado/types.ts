/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tipos independientes del minijuego Candado (Beta Local).
 */

export type ModoCandado = 'logico' | 'mayor_menor';

export type DigitosCandado = 4 | 5 | 6 | 8 | 10 | 14 | 16;

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

export type NotaDigito = 'neutro' | 'descartado';

export type TiempoTurnoCandado = 0 | 30 | 45 | 60;

export interface JugadorCandadoOnline {
  id: number;
  peerId: string;
  cuentaId?: string;
  nombre: string;
  color: string;
  hat: string;
  ropa?: string;
  ropaColor?: string;
  aura?: string;
  conectado: boolean;
  esAnfitrion: boolean;
}

export interface InfoSalaCandado {
  codigo: string;
  juego: 'candado';
  nombre: string;
  anfitrion: string;
  color?: string;
  hat?: string;
  ropa?: string;
  ropaColor?: string;
  aura?: string;
  maxJugadores: number;
  publica: boolean;
  enPartida: boolean;
  jugadoresConectados: number;
  jugadores?: JugadorCandadoOnline[];
  modoCandado: ModoCandado;
  digitosCandado: DigitosCandado;
  permitirRepetidos: boolean;
  maxIntentos: LimiteIntentosCandado;
  tiempoTurnoSeg: TiempoTurnoCandado;
  creadoEn: number;
}

export interface ConfigDueloCandadoP2P extends CandadoConfig {
  tiempoTurnoSeg: TiempoTurnoCandado;
}

export type FaseDueloP2P =
  | 'preparando_claves'
  | 'jugando'
  | 'terminada';

export type DesenlaceDueloP2P = 'victoria' | 'derrota' | 'empate' | null;

export interface EstadoDueloP2P {
  matchId: string;
  codigoSala: string;
  config: ConfigDueloCandadoP2P;
  miJugadorId: 0 | 1;
  turnoActual: 0 | 1;
  fase: FaseDueloP2P;
  miSecreto: string;
  miSal: string;
  miCommitHash: string;
  rivalCommitHash: string;
  rivalSecretoRevelado: string | null;
  rivalSalRevelada: string | null;
  verificacionRival: {
    verificado: boolean;
    commitValido: boolean;
    pistasValidas: boolean;
    motivo?: string;
  } | null;
  /** Intentos que YO hice contra el candado del rival */
  misIntentos: IntentoCandado[];
  /** Intentos que el RIVAL hizo contra MI candado */
  intentosRival: IntentoCandado[];
  miRangoMin: number;
  miRangoMax: number;
  rivalRangoMin: number;
  rivalRangoMax: number;
  /** Quién ya descifró la clave contraria */
  yoDescifre: boolean;
  rivalDescifro: boolean;
  /** Si P0 acierta primero, P1 tiene derecho a su turno igualador en el mismo índice */
  turnoIgualadorPendiente: boolean;
  ganadorId: 0 | 1 | 'empate' | null;
  desenlaceParaMi: DesenlaceDueloP2P;
  motivoFin?: string;
  tiempoRestanteTurno: number;
  inicioMs: number;
  finMs: number | null;
}

export type MensajeCandadoP2P =
  | {
      type: 'CANDADO_START';
      matchId: string;
      config: ConfigDueloCandadoP2P;
      startId: string;
    }
  | {
      type: 'CANDADO_COMMIT';
      matchId: string;
      jugadorId: number;
      commitHash: string;
    }
  | {
      type: 'CANDADO_GUESS';
      matchId: string;
      jugadorId: number;
      numeroIntento: number;
      entrada: string;
      actionId: string;
    }
  | {
      type: 'CANDADO_CLUE';
      matchId: string;
      objetivoJugadorId: number;
      intento: IntentoCandado;
      descifrado: boolean;
      siguienteTurno: 0 | 1;
      turnoIgualadorPendiente: boolean;
      partidaTerminada: boolean;
      ganadorId: 0 | 1 | 'empate' | null;
      motivoFin?: string;
    }
  | {
      type: 'CANDADO_TIMEOUT_SKIP';
      matchId: string;
      jugadorId: number;
      siguienteTurno: 0 | 1;
      partidaTerminada: boolean;
      ganadorId: 0 | 1 | 'empate' | null;
      motivoFin?: string;
      actionId: string;
    }
  | {
      type: 'CANDADO_REVEAL';
      matchId: string;
      jugadorId: number;
      secreto: string;
      sal: string;
    }
  | {
      type: 'CANDADO_SURRENDER';
      matchId: string;
      jugadorId: number;
      nombre: string;
    }
  | {
      type: 'CANDADO_REACTION';
      jugadorId: number;
      emoji: string;
    }
  | {
      type: 'CANDADO_REMATCH_REQUEST';
      jugadorId: number;
      nombre: string;
    }
  | {
      type: 'CANDADO_REMATCH_RESPONSE';
      jugadorId: number;
      nombre: string;
      aceptada: boolean;
    }
  | {
      type: 'HEARTBEAT';
      peerId: string;
      jugadorId: number;
    }
  | {
      type: 'PLAYER_LEFT';
      jugadorId: number;
      nombre: string;
    }
  | {
      type: 'LOBBY_UPDATE';
      jugadores: JugadorCandadoOnline[];
      config?: ConfigDueloCandadoP2P;
    };

