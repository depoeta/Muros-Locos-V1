/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PlayerType = 'humano' | 'bot_facil' | 'bot_normal' | 'bot_dificil';
export type HatType =
  | 'corona'
  | 'pompon'
  | 'antena'
  | 'brote'
  | 'mago'
  | 'gatito'
  | 'zorro'
  | 'robot'
  | 'dragon'
  | 'ninja'
  | 'bot_cpu';
export type EstiloVisual = 'clasico' | 'minimalista';
export type WallOrientation = 'H' | 'V';

export interface CharacterDef {
  id: HatType;
  label: string;
  icon: string;
  defaultColor: string;
  puntosRequeridos: number;
  descripcion: string;
}

export const PERSONAJES_REGISTRO: CharacterDef[] = [
  { id: 'corona', label: 'Corona', icon: '👑', defaultColor: '#ff6b6b', puntosRequeridos: 0, descripcion: 'Inicial' },
  { id: 'pompon', label: 'Pompón', icon: '🧶', defaultColor: '#4dabf7', puntosRequeridos: 0, descripcion: 'Inicial' },
  { id: 'antena', label: 'Antena', icon: '📡', defaultColor: '#ffd43b', puntosRequeridos: 0, descripcion: 'Inicial' },
  { id: 'brote', label: 'Brote', icon: '🌱', defaultColor: '#51cf66', puntosRequeridos: 0, descripcion: 'Inicial' },
  { id: 'mago', label: 'Mago', icon: '🧙', defaultColor: '#9775fa', puntosRequeridos: 0, descripcion: 'Inicial' },
  { id: 'gatito', label: 'Gatito', icon: '🐱', defaultColor: '#f06595', puntosRequeridos: 0, descripcion: 'Inicial' },
  { id: 'zorro', label: 'Zorro Astuto', icon: '🦊', defaultColor: '#f76707', puntosRequeridos: 25, descripcion: 'Requiere 25 pts' },
  { id: 'robot', label: 'Cyber Bot', icon: '🤖', defaultColor: '#22b8cf', puntosRequeridos: 60, descripcion: 'Requiere 60 pts' },
  { id: 'dragon', label: 'Dragón Mítico', icon: '🐲', defaultColor: '#12b886', puntosRequeridos: 120, descripcion: 'Requiere 120 pts' },
  { id: 'ninja', label: 'Sombra Ninja', icon: '🥷', defaultColor: '#495057', puntosRequeridos: 200, descripcion: 'Requiere 200 pts' },
];

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
  targetValue: number;
  estadisticas: PlayerStats;
}

export interface MatchConfig {
  numJugadores: 2 | 4;
  jugadores: {
    nombre: string;
    tipo: PlayerType;
    color?: string;
    hat?: HatType;
  }[];
  empiezaAlAzar: boolean;
  permitirDeshacer: boolean;
  permitirPistas: boolean;
  modoConTiempo: boolean;
  segundosPorTurno: number;
  esTorneo?: boolean;
  totalRondasTorneo?: number;
  temaTablero?: BoardTheme;
  rotationMode?: boolean;
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
  rondaActual: number;
  totalRondas: number;
  puntosAcumulados: Record<number, number>;
  victoriasAcumuladas: Record<number, number>;
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
  | { type: 'JOIN_REJECTED'; motivo: string }
  | { type: 'LOBBY_UPDATE'; roomCode: string; maxJugadores: 2 | 4; jugadores: OnlinePlayerInfo[] }
  | { type: 'START_GAME'; config: MatchConfig; initialState: GameState; _startId?: string }
  | { type: 'PLAYER_ACTION'; jugadorId: number; accion: 'mover' | 'muro' | 'pasar'; payload: any; _actionId?: string }
  | { type: 'STATE_SYNC'; state: GameState }
  | { type: 'REACTION'; jugadorId: number; emoji: string }
  | { type: 'REMATCH_REQUEST'; jugadorId: number; nombre?: string }
  | { type: 'REMATCH_RESPONSE'; jugadorId: number; nombre?: string; aceptada: boolean }
  | { type: 'REMATCH_ACCEPT'; state: GameState }
  | { type: 'PLAYER_LEFT'; jugadorId: number; nombre?: string }
  | { type: 'REQUEST_SYNC'; jugadorId: number; turnosTotales?: number }
  | { type: 'PING'; turnosTotales?: number; turnoActual?: number; terminada?: boolean }
  | { type: 'PONG'; turnosTotales?: number; turnoActual?: number; terminada?: boolean }
  | { type: 'DIAG_PING'; ts: number }
  | { type: 'DIAG_PONG'; ts: number }
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
  murosH: number[][];
  murosV: number[][];
  turnoActual: number;
  turnosTotales: number;
  terminada: boolean;
  ganador: number | null;
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
  murosUsados: number;
  finalCerrado: number;
  bonoTorneo: number;
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

export type BoardTheme = 'madera' | 'neon' | 'hielo' | 'lava';

export interface AppSettings {
  sonido: boolean;
  animacionesReducidas: boolean;
  mostrarDistancia: boolean;
  permitirDeshacer: boolean;
  permitirPistas: boolean;
  modoDaltonico: boolean;
  temaTablero?: BoardTheme;
  cambiarVistaPorTurno?: boolean;
  vistaPropiaOnline?: boolean;
}

export interface LevelInfo {
  nivel: number;
  titulo: string;
  minPuntos: number;
  maxPuntos: number;
  icono: string;
}

export interface PublicRoomInfo {
  codigo: string;
  nombre: string;
  anfitrion: string;
  color: string;
  hat: HatType;
  maxJugadores: 2 | 4;
  creadoEn: number;
}

export interface UserAccount {
  id: string;
  nombre: string;
  clave: string;
  rol: 'jugador' | 'admin';
  esSupremo?: boolean;
  avatarColor: string;
  avatarHat: HatType;
  puntos: number;
  partidas: number;
  victorias: number;
  elo: number;
  creadoEn: string;
  ultimaConexion: string;
  temaTablero?: BoardTheme;
  historialPartidas?: {
    id: string;
    fecha: string;
    resultado: 'victoria' | 'derrota' | 'empate';
    puntos: number;
    rivales: string;
    duracionSegundos: number;
  }[];
}

export type Screen = 'menu' | 'config' | 'juego' | 'ranking' | 'logros' | 'como_jugar' | 'ajustes' | 'online_lobby';

export interface WeeklyPlayerEntry {
  nombre: string;
  avatarColor: string;
  avatarHat: HatType;
  puntos: number;
  partidas: number;
  victorias: number;
  elo?: number;
  partidasIds?: string[];
}

export interface WeeklyBoardData {
  semanaId: string;
  premiada?: boolean;
  premiados?: { nombre: string; puesto: number; bono: number }[];
  jugadores: Record<string, WeeklyPlayerEntry>;
}

export interface WeeklyRankingResponse {
  ok: boolean;
  kvBound?: boolean;
  semanaActualId: string;
  semanaPasadaId: string;
  cierraEnMs: number;
  actual: WeeklyBoardData;
  pasada: WeeklyBoardData;
}

export interface OnlineDiagnosticData {
  status: 'conectado' | 'negociando' | 'reconectando' | 'desconectado';
  pingMs: number | null;
  calidad: 'excelente' | 'buena' | 'inestable' | 'critica' | 'desconectado';
  miPeerId: string;
  rivalPeerId: string | null;
  role: 'host' | 'client' | 'none';
  iceState: string;
  dataChannelState: string;
  logs: { ts: string; tipo: 'info' | 'warn' | 'error'; mensaje: string }[];
}
