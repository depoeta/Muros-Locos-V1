/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PlayerType = 'humano' | 'bot_facil' | 'bot_normal' | 'bot_dificil';
export type HatType = 'corona' | 'pompon' | 'antena' | 'brote';
export type WallOrientation = 'H' | 'V';

export interface Coord {
  r: number;
  c: number;
}

export interface PlayerStats {
  acciones: number;
  movimientos: number;
  saltos: number;
  murosColocados: number;
  murosMaestros: number;
  usosPista: number;
  usosDeshacer: number;
  intentosMuroInvalido: number;
  turnosAgotados: number;
  maxDesventaja: number;
  remontada: boolean;
  partidaLimpia: boolean;
}

export interface Player {
  id: number;
  nombre: string;
  tipo: PlayerType;
  color: string;
  hat: HatType;
  r: number;
  c: number;
  muros: number;
  targetType: 'row' | 'col';
  targetValue: number; // e.g. row 0, row 8, col 8, col 0
  estadisticas: PlayerStats;
}

export interface MatchConfig {
  numJugadores: 2 | 4;
  jugadores: {
    nombre: string;
    tipo: PlayerType;
  }[];
  empiezaAlAzar: boolean;
  permitirDeshacer: boolean;
  permitirPistas: boolean;
  modoConTiempo: boolean;
  segundosPorTurno: number; // 15 | 30 | 60
  esTorneo?: boolean;
  totalRondasTorneo?: number; // 3 | 5
}

export interface AccionRegistro {
  id: string;
  turnoNumero: number;
  jugadorId: number;
  jugadorNombre: string;
  jugadorColor: string;
  tipo: 'mover' | 'muro' | 'pasar';
  descripcion: string;
  detalle?: string;
  coordOrigen?: Coord;
  coordDestino?: Coord;
  orientacion?: WallOrientation;
  coordMuro?: Coord;
  esSalto?: boolean;
  esMuroMaestro?: boolean;
  tiempo: string;
}

export interface GameSnapshot {
  jugadores: {
    id: number;
    tipo: PlayerType;
    r: number;
    c: number;
    muros: number;
    estadisticas: PlayerStats;
  }[];
  murosH: number[][];
  murosV: number[][];
  turnoActual: number;
  turnosTotales: number;
  registroAcciones: AccionRegistro[];
}

export interface TorneoRondaRecord {
  ronda: number;
  ganadorId: number;
  ganadorNombre: string;
  puntosRonda: Record<number, number>;
}

export interface TorneoState {
  activo: boolean;
  rondaActual: number; // 1-indexed (e.g. 1, 2, 3)
  totalRondas: number; // 3 o 5
  puntosAcumulados: Record<number, number>; // jugadorId -> puntos acumulados
  victoriasAcumuladas: Record<number, number>; // jugadorId -> victorias
  historialRondas: TorneoRondaRecord[];
  terminado: boolean;
  ganadorGlobalId: number | null;
}

export interface OnlinePlayerInfo {
  id: number;
  peerId: string;
  nombre: string;
  color: string;
  hat: HatType;
  listo: boolean;
  conectado: boolean;
  esAnfitrion: boolean;
}

export type OnlineMessage =
  | { type: 'JOIN_REQUEST'; nombre: string; color: string; hat: HatType }
  | { type: 'LOBBY_UPDATE'; roomCode: string; maxJugadores: 2 | 4; jugadores: OnlinePlayerInfo[] }
  | { type: 'START_GAME'; config: MatchConfig; initialState: GameState }
  | { type: 'PLAYER_ACTION'; jugadorId: number; accion: 'mover' | 'muro' | 'pasar'; payload: any }
  | { type: 'STATE_SYNC'; state: GameState }
  | { type: 'REACTION'; jugadorId: number; emoji: string }
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'HOST_DISCONNECT_WARNING'; tiempoRestante: number }
  | { type: 'HOST_RESUMED'; state: GameState };

export interface ActiveOnlineSession {
  roomCode: string;
  role: 'host' | 'client';
  myPlayerId: number;
  myName: string;
  myColor: string;
  myHat: HatType;
  lastState?: GameState;
  timestamp: number;
}

export interface GameState {
  n: 2 | 4;
  jugadores: Player[];
  murosH: number[][]; // 8x8: -1 = vacío, o player id
  murosV: number[][]; // 8x8: -1 = vacío, o player id
  turnoActual: number;
  turnosTotales: number;
  terminada: boolean;
  ganador: number | null; // index of winner, or -1 for tie
  modoAccion: 'mover' | 'muro';
  orientacionMuro: WallOrientation;
  muroPrevisualizado: Coord | null;
  caminoPista: Coord[] | null;
  historial: GameSnapshot[];
  registroAcciones: AccionRegistro[];
  config: MatchConfig;
  tiempoRestante: number;
  pensandoBot: boolean;
  ultimoMensaje: string;
  torneo?: TorneoState;
  modoOnline?: boolean;
  miJugadorId?: number;
  codigoSala?: string;
  esAnfitrion?: boolean;
  reaccionActiva?: { jugadorId: number; emoji: string; ts: number } | null;
}

export interface ScoreBreakdown {
  resultado: number;
  ahorrador: number;
  rapidez: number;
  saltador: number;
  muroMaestro: number;
  remontada: number;
  racha: number;
  partidaLimpia: number;
  penalizaciones: {
    pistas: number;
    deshacer: number;
    murosInvalidos: number;
    tiempoAgotado: number;
    abandonar: number;
    total: number;
  };
  multiplicador: number;
  total: number;
}

export interface MatchResultRecord {
  id: string;
  fecha: string;
  numJugadores: 2 | 4;
  ganadorNombre: string;
  duracionSegundos: number;
  turnosTotales: number;
  puntosPorJugador: {
    nombre: string;
    color: string;
    puntos: number;
    puesto: number;
    esHumano: boolean;
  }[];
  esTorneo?: boolean;
}

export interface RankEntry {
  nombre: string;
  puntosTotales: number;
  partidas: number;
  victorias: number;
  derrotas: number;
  empates: number;
  rachaActual: number;
  mejorRacha: number;
  murosColocados: number;
  saltos: number;
  mejorPartida: number;
  partidaMasRapida: number;
  partidasLimpias: number;
  elo: number;
  fechaUltimaPartida: string;
  logros: string[];
  avatarColor: string;
  avatarHat: HatType;
}

export interface AchievementDef {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
}

export interface AppSettings {
  sonido: boolean;
  animacionesReducidas: boolean;
  mostrarDistancia: boolean;
  permitirDeshacer: boolean;
  permitirPistas: boolean;
  modoDaltonico: boolean;
}

export interface LevelInfo {
  nivel: number;
  titulo: string;
  minPuntos: number;
  maxPuntos: number;
  icono: string;
}

export interface UserAccount {
  id: string;
  nombre: string;
  clave: string;
  rol: 'jugador' | 'admin';
  avatarColor: string;
  avatarHat: HatType;
  puntos: number;
  partidas: number;
  victorias: number;
  elo: number;
  creadoEn: string;
  ultimaConexion: string;
}

export type Screen = 'menu' | 'config' | 'juego' | 'ranking' | 'logros' | 'como_jugar' | 'ajustes' | 'online_lobby';
