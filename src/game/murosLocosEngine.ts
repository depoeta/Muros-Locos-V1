/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor unificado de juego + Sistema de audio (Web Audio API)
 */

import {
  ConfigDePartida,
  Coordenada,
  DesglosePuntos,
  EstadoDeJuego,
  EstadoTorneo,
  EstadisticasJugador,
  JugadorEnJuego,
  OrientacionMuro,
  TamanoTablero,
} from '../types/murosLocos';

// =========================================================================
// SISTEMA DE AUDIO SINTETIZADO (Unificado aquí para reducir archivos)
// =========================================================================
class SoundSystem {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('muros_locos_sonido') : null;
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch {
      this.enabled = true;
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      localStorage.setItem('muros_locos_sonido', String(enabled));
    } catch {}
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playClick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1100, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }

  public playMove() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(540, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {}
  }

  public playWall() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(160, t);
      osc1.frequency.exponentialRampToValueAtTime(50, t + 0.16);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(95, t);
      osc2.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.2);
      osc2.stop(t + 0.2);
    } catch {}
  }

  public playWallPlace() {
    this.playWall();
  }

  public playError() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.linearRampToValueAtTime(110, t + 0.18);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    } catch {}
  }

  public playTurn() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    } catch {}
  }

  public playVictory() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.36);
      });
    } catch {}
  }

  public playWin() {
    this.playVictory();
  }

  public playAchievement() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const notes = [659.25, 880.0];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.32);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.33);
      });
    } catch {}
  }
}

export const sounds = new SoundSystem();

// =========================================================================
// MOTOR DE REGLAS Y BOTS DE MUROS LOCOS
// =========================================================================
export const BOARD_SIZE = 9;
export const WALL_GRID_SIZE = 8;

export function normalizarTamanoTablero(valor: unknown): TamanoTablero {
  const num = Number(valor);
  if (num === 5 || num === 7 || num === 9) {
    return num;
  }
  return 9;
}

export function coordToAlgebraic(r: number, c: number, boardSize: number = BOARD_SIZE): string {
  const colLetter = String.fromCharCode(65 + c);
  const rowNum = boardSize - r;
  return `${colLetter}${rowNum}`;
}

export function createEmptyGrid(val: number = -1, wallGridSize: number = WALL_GRID_SIZE): number[][] {
  const g: number[][] = [];
  for (let r = 0; r < wallGridSize; r++) {
    const row: number[] = [];
    for (let c = 0; c < wallGridSize; c++) {
      row.push(val);
    }
    g.push(row);
  }
  return g;
}

export function createInitialStats(): EstadisticasJugador {
  return {
    acciones: 0,
    movimientos: 0,
    saltos: 0,
    murosColocados: 0,
    murosMaestros: 0,
    usosPista: 0,
    usosDeshacer: 0,
    intentosMuroInvalido: 0,
    turnosAgotados: 0,
    maxDesventaja: 0,
    remontada: false,
    partidaLimpia: true,
  };
}

export function crearEstadoTorneo(totalRondas: number, numJugadores: number): EstadoTorneo {
  const puntosAcumulados: Record<number, number> = {};
  const victoriasAcumuladas: Record<number, number> = {};
  for (let i = 0; i < numJugadores; i++) {
    puntosAcumulados[i] = 0;
    victoriasAcumuladas[i] = 0;
  }
  return {
    activo: true,
    rondaActual: 1,
    totalRondas,
    puntosAcumulados,
    victoriasAcumuladas,
    historialRondas: [],
    terminado: false,
    ganadorGlobalId: null,
  };
}

export function inicializarPartida(config: ConfigDePartida): EstadoDeJuego {
  const n = config.numJugadores;
  const boardSize = normalizarTamanoTablero(config.tamanoTablero);
  const wallGridSize = boardSize - 1;
  const mid = Math.floor(boardSize / 2);
  const last = boardSize - 1;

  const murosPorTamano2P: Record<TamanoTablero, number> = { 5: 4, 7: 7, 9: 10 };
  const murosPorTamano4P: Record<TamanoTablero, number> = { 5: 2, 7: 4, 9: 5 };
  const initialWalls = n === 2 ? murosPorTamano2P[boardSize] : murosPorTamano4P[boardSize];

  let jugadores: JugadorEnJuego[] = [];

  if (n === 2) {
    jugadores = [
      {
        id: 0,
        cuentaId: config.jugadores[0]?.cuentaId,
        nombre: config.jugadores[0]?.nombre || 'Jugador 1',
        tipo: config.jugadores[0]?.tipo || 'humano',
        color: config.jugadores[0]?.color || '#ff6b6b',
        hat: (config.jugadores[0]?.tipo || 'humano') !== 'humano' ? 'bot_cpu' : (config.jugadores[0]?.hat || 'corona'),
        ropa: config.jugadores[0]?.ropa || 'ninguna',
        ropaColor: config.jugadores[0]?.ropaColor,
        aura: config.jugadores[0]?.aura || 'ninguna',
        r: last,
        c: mid,
        muros: initialWalls,
        targetType: 'row',
        targetValue: 0,
        estadisticas: createInitialStats(),
      },
      {
        id: 1,
        cuentaId: config.jugadores[1]?.cuentaId,
        nombre: config.jugadores[1]?.nombre || 'Bot Normal',
        tipo: config.jugadores[1]?.tipo || 'bot_normal',
        color: config.jugadores[1]?.color || '#4dabf7',
        hat: (config.jugadores[1]?.tipo || 'bot_normal') !== 'humano' ? 'bot_cpu' : (config.jugadores[1]?.hat || 'pompon'),
        ropa: config.jugadores[1]?.ropa || 'ninguna',
        ropaColor: config.jugadores[1]?.ropaColor,
        aura: config.jugadores[1]?.aura || 'ninguna',
        r: 0,
        c: mid,
        muros: initialWalls,
        targetType: 'row',
        targetValue: last,
        estadisticas: createInitialStats(),
      },
    ];
  } else {
    jugadores = [
      {
        id: 0,
        cuentaId: config.jugadores[0]?.cuentaId,
        nombre: config.jugadores[0]?.nombre || 'Jugador 1',
        tipo: config.jugadores[0]?.tipo || 'humano',
        color: config.jugadores[0]?.color || '#ff6b6b',
        hat: (config.jugadores[0]?.tipo || 'humano') !== 'humano' ? 'bot_cpu' : (config.jugadores[0]?.hat || 'corona'),
        ropa: config.jugadores[0]?.ropa || 'ninguna',
        ropaColor: config.jugadores[0]?.ropaColor,
        aura: config.jugadores[0]?.aura || 'ninguna',
        r: last,
        c: mid,
        muros: initialWalls,
        targetType: 'row',
        targetValue: 0,
        estadisticas: createInitialStats(),
      },
      {
        id: 1,
        cuentaId: config.jugadores[1]?.cuentaId,
        nombre: config.jugadores[1]?.nombre || 'Jugador 2',
        tipo: config.jugadores[1]?.tipo || 'bot_normal',
        color: config.jugadores[1]?.color || '#4dabf7',
        hat: (config.jugadores[1]?.tipo || 'bot_normal') !== 'humano' ? 'bot_cpu' : (config.jugadores[1]?.hat || 'pompon'),
        ropa: config.jugadores[1]?.ropa || 'ninguna',
        ropaColor: config.jugadores[1]?.ropaColor,
        aura: config.jugadores[1]?.aura || 'ninguna',
        r: mid,
        c: 0,
        muros: initialWalls,
        targetType: 'col',
        targetValue: last,
        estadisticas: createInitialStats(),
      },
      {
        id: 2,
        cuentaId: config.jugadores[2]?.cuentaId,
        nombre: config.jugadores[2]?.nombre || 'Jugador 3',
        tipo: config.jugadores[2]?.tipo || 'bot_normal',
        color: config.jugadores[2]?.color || '#ffd43b',
        hat: (config.jugadores[2]?.tipo || 'bot_normal') !== 'humano' ? 'bot_cpu' : (config.jugadores[2]?.hat || 'antena'),
        ropa: config.jugadores[2]?.ropa || 'ninguna',
        ropaColor: config.jugadores[2]?.ropaColor,
        aura: config.jugadores[2]?.aura || 'ninguna',
        r: 0,
        c: mid,
        muros: initialWalls,
        targetType: 'row',
        targetValue: last,
        estadisticas: createInitialStats(),
      },
      {
        id: 3,
        cuentaId: config.jugadores[3]?.cuentaId,
        nombre: config.jugadores[3]?.nombre || 'Jugador 4',
        tipo: config.jugadores[3]?.tipo || 'bot_facil',
        color: config.jugadores[3]?.color || '#51cf66',
        hat: (config.jugadores[3]?.tipo || 'bot_facil') !== 'humano' ? 'bot_cpu' : (config.jugadores[3]?.hat || 'brote'),
        ropa: config.jugadores[3]?.ropa || 'ninguna',
        ropaColor: config.jugadores[3]?.ropaColor,
        aura: config.jugadores[3]?.aura || 'ninguna',
        r: mid,
        c: last,
        muros: initialWalls,
        targetType: 'col',
        targetValue: 0,
        estadisticas: createInitialStats(),
      },
    ];
  }

  const turnoInicial = config.empiezaAlAzar ? Math.floor(Math.random() * n) : 0;
  const torneo = config.esTorneo
    ? crearEstadoTorneo(config.totalRondasTorneo || 3, n)
    : undefined;

  const msjInicial = torneo
    ? `🏆 Torneo: Ronda 1 de ${torneo.totalRondas} — ¡Comienza ${jugadores[turnoInicial].nombre}!`
    : `¡Comienza ${jugadores[turnoInicial].nombre}!`;

  return {
    n,
    tamanoTablero: boardSize,
    jugadores,
    murosH: createEmptyGrid(-1, wallGridSize),
    murosV: createEmptyGrid(-1, wallGridSize),
    turnoActual: turnoInicial,
    turnosTotales: 0,
    terminada: false,
    ganador: null,
    modoAccion: 'mover',
    orientacionMuro: 'H',
    muroPrevisualizado: null,
    caminoPista: null,
    historial: [],
    registroAcciones: [],
    config: { ...config, tamanoTablero: boardSize },
    tiempoRestante: config.segundosPorTurno || 30,
    pensandoBot: false,
    ultimoMensaje: msjInicial,
    torneo,
  };
}

export function isH(r: number, c: number, murosH: number[][]): boolean {
  const gridSize = murosH.length;
  return r >= 0 && r < gridSize && c >= 0 && c < gridSize && murosH[r][c] !== -1;
}

export function isV(r: number, c: number, murosV: number[][]): boolean {
  const gridSize = murosV.length;
  return r >= 0 && r < gridSize && c >= 0 && c < gridSize && murosV[r][c] !== -1;
}

export function bloqueado(
  r: number,
  c: number,
  dr: number,
  dc: number,
  murosH: number[][],
  murosV: number[][]
): boolean {
  if (dr === -1) return isH(r - 1, c, murosH) || isH(r - 1, c - 1, murosH);
  if (dr === 1) return isH(r, c, murosH) || isH(r, c - 1, murosH);
  if (dc === 1) return isV(r, c, murosV) || isV(r - 1, c, murosV);
  if (dc === -1) return isV(r, c - 1, murosV) || isV(r - 1, c - 1, murosV);
  return false;
}

export function movimientosLegales(jugador: JugadorEnJuego, estado: EstadoDeJuego): Coordenada[] {
  const boardSize = estado.murosH.length > 0 ? estado.murosH.length + 1 : BOARD_SIZE;
  const res: Coordenada[] = [];
  const direcciones = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  const ocupadoPor = (r: number, c: number): JugadorEnJuego | undefined => {
    return estado.jugadores.find((p) => p.r === r && p.c === c);
  };

  for (const { dr, dc } of direcciones) {
    if (bloqueado(jugador.r, jugador.c, dr, dc, estado.murosH, estado.murosV)) {
      continue;
    }
    const nr = jugador.r + dr;
    const nc = jugador.c + dc;
    if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) {
      continue;
    }

    const ocupante = ocupadoPor(nr, nc);
    if (!ocupante) {
      res.push({ r: nr, c: nc });
      continue;
    }

    const jr = nr + dr;
    const jc = nc + dc;
    const canJumpStraight =
      jr >= 0 &&
      jr < boardSize &&
      jc >= 0 &&
      jc < boardSize &&
      !bloqueado(nr, nc, dr, dc, estado.murosH, estado.murosV) &&
      !ocupadoPor(jr, jc);

    if (canJumpStraight) {
      res.push({ r: jr, c: jc });
      continue;
    }

    const laterales =
      dr === 0
        ? [
            { er: -1, ec: 0 },
            { er: 1, ec: 0 },
          ]
        : [
            { er: 0, ec: -1 },
            { er: 0, ec: 1 },
          ];

    for (const { er, ec } of laterales) {
      if (!bloqueado(nr, nc, er, ec, estado.murosH, estado.murosV)) {
        const sr = nr + er;
        const sc = nc + ec;
        if (sr >= 0 && sr < boardSize && sc >= 0 && sc < boardSize && !ocupadoPor(sr, sc)) {
          if (!res.some((p) => p.r === sr && p.c === sc)) {
            res.push({ r: sr, c: sc });
          }
        }
      }
    }
  }

  return res;
}

export function esMeta(
  jugador: JugadorEnJuego,
  r: number,
  c: number,
  numJugadores: number = 2,
  boardSize: number = BOARD_SIZE
): boolean {
  if (numJugadores === 4) {
    const last = boardSize - 1;
    if ((r === 0 || r === last) && (c === 0 || c === last)) {
      return false;
    }
  }
  if (jugador.targetType === 'row') {
    return r === jugador.targetValue;
  }
  return c === jugador.targetValue;
}

export function bfsCamino(
  jugador: JugadorEnJuego,
  murosH: number[][],
  murosV: number[][],
  desde?: Coordenada,
  numJugadores: number = 2
): { distancia: number; camino: Coordenada[] } {
  const boardSize = murosH.length > 0 ? murosH.length + 1 : BOARD_SIZE;
  const start = desde || { r: jugador.r, c: jugador.c };

  if (esMeta(jugador, start.r, start.c, numJugadores, boardSize)) {
    return { distancia: 0, camino: [start] };
  }

  const dist: number[][] = Array.from({ length: boardSize }, () =>
    Array(boardSize).fill(Infinity)
  );
  const parent: (Coordenada | null)[][] = Array.from({ length: boardSize }, () =>
    Array(boardSize).fill(null)
  );

  const queue: Coordenada[] = [start];
  dist[start.r][start.c] = 0;

  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  let goalNode: Coordenada | null = null;

  while (queue.length > 0) {
    const cur = queue.shift()!;

    if (esMeta(jugador, cur.r, cur.c, numJugadores, boardSize)) {
      goalNode = cur;
      break;
    }

    for (const { dr, dc } of dirs) {
      if (!bloqueado(cur.r, cur.c, dr, dc, murosH, murosV)) {
        const nr = cur.r + dr;
        const nc = cur.c + dc;
        if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
          if (dist[nr][nc] === Infinity) {
            dist[nr][nc] = dist[cur.r][cur.c] + 1;
            parent[nr][nc] = cur;
            queue.push({ r: nr, c: nc });
          }
        }
      }
    }
  }

  if (!goalNode) {
    return { distancia: Infinity, camino: [] };
  }

  const path: Coordenada[] = [];
  let curr: Coordenada | null = goalNode;
  while (curr) {
    path.unshift(curr);
    curr = parent[curr.r][curr.c];
  }

  return { distancia: dist[goalNode.r][goalNode.c], camino: path };
}

export function validarMuro(
  orientacion: OrientacionMuro,
  r: number,
  c: number,
  murosH: number[][],
  murosV: number[][],
  jugadores: JugadorEnJuego[]
): 'ok' | 'fuera' | 'solape' | 'bloquea' {
  const wallGridSize = murosH.length;
  if (r < 0 || r >= wallGridSize || c < 0 || c >= wallGridSize) {
    return 'fuera';
  }

  if (murosH[r][c] !== -1 || murosV[r][c] !== -1) {
    return 'solape';
  }

  if (orientacion === 'H') {
    if (isH(r, c - 1, murosH) || isH(r, c + 1, murosH)) {
      return 'solape';
    }
  } else {
    if (isV(r - 1, c, murosV) || isV(r + 1, c, murosV)) {
      return 'solape';
    }
  }

  if (orientacion === 'H') {
    murosH[r][c] = 999;
  } else {
    murosV[r][c] = 999;
  }

  let allHavePath = true;
  for (const j of jugadores) {
    const { distancia } = bfsCamino(j, murosH, murosV, undefined, jugadores.length);
    if (distancia === Infinity) {
      allHavePath = false;
      break;
    }
  }

  if (orientacion === 'H') {
    murosH[r][c] = -1;
  } else {
    murosV[r][c] = -1;
  }

  if (!allHavePath) {
    return 'bloquea';
  }

  return 'ok';
}

export function tomarSnapshot(estado: EstadoDeJuego) {
  return {
    jugadores: estado.jugadores.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      r: p.r,
      c: p.c,
      muros: p.muros,
      estadisticas: { ...p.estadisticas },
    })),
    murosH: estado.murosH.map((row) => [...row]),
    murosV: estado.murosV.map((row) => [...row]),
    turnoActual: estado.turnoActual,
    turnosTotales: estado.turnosTotales,
    registroAcciones: [...estado.registroAcciones],
  };
}

export function aplicarMovimiento(
  estado: EstadoDeJuego,
  destino: Coordenada
): { ganador: boolean; esSalto: boolean; mensaje: string } {
  const jugador = estado.jugadores[estado.turnoActual];
  const origenCoordenada = { r: jugador.r, c: jugador.c };

  estado.historial.push(tomarSnapshot(estado));

  const manhattan = Math.abs(destino.r - jugador.r) + Math.abs(destino.c - jugador.c);
  const isDiagonal = Math.abs(destino.r - jugador.r) === 1 && Math.abs(destino.c - jugador.c) === 1;
  const esSalto = manhattan === 2 || isDiagonal;

  jugador.r = destino.r;
  jugador.c = destino.c;
  jugador.estadisticas.acciones++;
  jugador.estadisticas.movimientos++;
  if (esSalto) {
    jugador.estadisticas.saltos++;
  }

  const boardSize = estado.murosH.length > 0 ? estado.murosH.length + 1 : BOARD_SIZE;
  const notacionOrigen = coordToAlgebraic(origenCoordenada.r, origenCoordenada.c, boardSize);
  const notacionDestino = coordToAlgebraic(destino.r, destino.c, boardSize);
  estado.registroAcciones.push({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    turnoNumero: estado.turnosTotales + 1,
    jugadorId: jugador.id,
    jugadorNombre: jugador.nombre,
    jugadorColor: jugador.color,
    tipo: 'mover',
    descripcion: esSalto ? `🦘 Salto a ${notacionDestino}` : `🚶 Paso a ${notacionDestino}`,
    detalle: esSalto
      ? `Salto sobre rival de ${notacionOrigen} a ${notacionDestino}`
      : `Desde ${notacionOrigen}`,
    coordOrigen: origenCoordenada,
    coordDestino: destino,
    esSalto,
    tiempo: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  });

  actualizarDesventaja(estado);

  if (esMeta(jugador, jugador.r, jugador.c, estado.n, boardSize)) {
    estado.terminada = true;
    estado.ganador = estado.turnoActual;
    const msg = `👑 ¡${jugador.nombre} ha ganado la partida!`;
    estado.ultimoMensaje = msg;
    return { ganador: true, esSalto, mensaje: msg };
  }

  avanzarTurno(estado);
  const proximo = estado.jugadores[estado.turnoActual];
  const mensaje = esSalto
    ? `¡${jugador.nombre} saltó y le toca a ${proximo.nombre}!`
    : `Turno de ${proximo.nombre}`;
  estado.ultimoMensaje = mensaje;

  return { ganador: false, esSalto, mensaje };
}

export function aplicarMuro(
  estado: EstadoDeJuego,
  orientacion: OrientacionMuro,
  r: number,
  c: number
): { esMuroMaestro: boolean; mensaje: string } {
  const jugador = estado.jugadores[estado.turnoActual];

  const leadingRivalBefore = obtenerRivalMasPeligroso(estado, jugador.id);
  const rivalDistBefore = leadingRivalBefore
    ? bfsCamino(leadingRivalBefore, estado.murosH, estado.murosV, undefined, estado.n).distancia
    : 0;

  estado.historial.push(tomarSnapshot(estado));

  if (orientacion === 'H') {
    estado.murosH[r][c] = jugador.id;
  } else {
    estado.murosV[r][c] = jugador.id;
  }

  jugador.muros--;
  jugador.estadisticas.acciones++;
  jugador.estadisticas.murosColocados++;

  let esMuroMaestro = false;
  if (leadingRivalBefore) {
    const rivalDistAfter = bfsCamino(leadingRivalBefore, estado.murosH, estado.murosV, undefined, estado.n).distancia;
    if (rivalDistAfter - rivalDistBefore >= 4) {
      esMuroMaestro = true;
      jugador.estadisticas.murosMaestros++;
    }
  }

  const boardSize = estado.murosH.length > 0 ? estado.murosH.length + 1 : BOARD_SIZE;
  const notacionMuro = coordToAlgebraic(r, c, boardSize);
  const orientacionTexto = orientacion === 'H' ? 'Horizontal' : 'Vertical';
  estado.registroAcciones.push({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    turnoNumero: estado.turnosTotales + 1,
    jugadorId: jugador.id,
    jugadorNombre: jugador.nombre,
    jugadorColor: jugador.color,
    tipo: 'muro',
    descripcion: esMuroMaestro
      ? `🏰 Muro Maestro en ${notacionMuro}`
      : `🧱 Muro ${orientacionTexto} en ${notacionMuro}`,
    detalle: esMuroMaestro
      ? `+4 pasos de desvío al rival (${orientacionTexto})`
      : `Ranura ${orientacionTexto} en ${notacionMuro}`,
    orientacion,
    coordMuro: { r, c },
    esMuroMaestro,
    tiempo: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  });

  actualizarDesventaja(estado);

  avanzarTurno(estado);
  const proximo = estado.jugadores[estado.turnoActual];
  const mensaje = esMuroMaestro
    ? `🧱 ¡Muro maestro de ${jugador.nombre}! Le toca a ${proximo.nombre}`
    : `Muro colocado. Turno de ${proximo.nombre}`;
  estado.ultimoMensaje = mensaje;

  return { esMuroMaestro, mensaje };
}

function actualizarDesventaja(estado: EstadoDeJuego) {
  for (const p of estado.jugadores) {
    const myDist = bfsCamino(p, estado.murosH, estado.murosV, undefined, estado.n).distancia;
    let minRivalDist = Infinity;
    for (const other of estado.jugadores) {
      if (other.id !== p.id) {
        const d = bfsCamino(other, estado.murosH, estado.murosV, undefined, estado.n).distancia;
        if (d < minRivalDist) {
          minRivalDist = d;
        }
      }
    }
    const desventaja = myDist - minRivalDist;
    if (desventaja > p.estadisticas.maxDesventaja) {
      p.estadisticas.maxDesventaja = desventaja;
    }
    if (p.estadisticas.maxDesventaja >= 4) {
      p.estadisticas.remontada = true;
    }
  }
}

export function obtenerRivalMasPeligroso(estado: EstadoDeJuego, myJugadorEnJuegoId: number): JugadorEnJuego | null {
  let closest: JugadorEnJuego | null = null;
  let minDist = Infinity;

  for (const p of estado.jugadores) {
    if (p.id !== myJugadorEnJuegoId) {
      const dist = bfsCamino(p, estado.murosH, estado.murosV, undefined, estado.n).distancia;
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
  }

  return closest;
}

export function avanzarTurno(estado: EstadoDeJuego) {
  estado.turnosTotales++;
  estado.caminoPista = null;
  estado.muroPrevisualizado = null;
  estado.tiempoRestante = estado.config.segundosPorTurno || 30;

  if (estado.turnosTotales >= 200) {
    estado.terminada = true;
    estado.ganador = -1;
    estado.ultimoMensaje = '⚖️ ¡Empate por alcanzar los 200 turnos!';
    return;
  }

  let nextIdx = (estado.turnoActual + 1) % estado.n;
  let attempts = 0;

  while (attempts < estado.n) {
    const nextJugadorEnJuego = estado.jugadores[nextIdx];
    const moves = movimientosLegales(nextJugadorEnJuego, estado);

    if (moves.length > 0 || nextJugadorEnJuego.muros > 0) {
      estado.turnoActual = nextIdx;
      estado.modoAccion = moves.length > 0 ? 'mover' : 'muro';
      return;
    }

    nextIdx = (nextIdx + 1) % estado.n;
    attempts++;
  }

  estado.terminada = true;
  estado.ganador = -1;
  estado.ultimoMensaje = '⚖️ ¡Todos los jugadores bloqueados! Empate.';
}

export function calcularJugadaBot(
  jugador: JugadorEnJuego,
  estado: EstadoDeJuego
):
  | { tipo: 'mover'; coord: Coordenada }
  | { tipo: 'muro'; orientacion: OrientacionMuro; coord: Coordenada }
  | { tipo: 'pasar' } {
  const wallGridSize = estado.murosH.length > 0 ? estado.murosH.length : WALL_GRID_SIZE;
  const boardSize = wallGridSize + 1;
  const moves = movimientosLegales(jugador, estado);

  if (moves.length === 0 && jugador.muros === 0) {
    return { tipo: 'pasar' };
  }

  const tipoBot = jugador.tipo;

  const bestMoveToGoal = (): Coordenada | null => {
    if (moves.length === 0) return null;
    let bestDist = Infinity;
    let candidates: Coordenada[] = [];

    for (const m of moves) {
      const { distancia } = bfsCamino(jugador, estado.murosH, estado.murosV, m, estado.n);
      if (distancia < bestDist) {
        bestDist = distancia;
        candidates = [m];
      } else if (distancia === bestDist) {
        candidates.push(m);
      }
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  if (tipoBot === 'bot_facil') {
    if (jugador.muros > 0 && Math.random() < 0.15) {
      const leadingRival = obtenerRivalMasPeligroso(estado, jugador.id);
      if (leadingRival) {
        const rivalDist0 = bfsCamino(leadingRival, estado.murosH, estado.murosV, undefined, estado.n).distancia;
        for (let tries = 0; tries < 20; tries++) {
          const r = Math.floor(Math.random() * wallGridSize);
          const c = Math.floor(Math.random() * wallGridSize);
          const o: OrientacionMuro = Math.random() < 0.5 ? 'H' : 'V';
          if (validarMuro(o, r, c, estado.murosH, estado.murosV, estado.jugadores) === 'ok') {
            if (o === 'H') estado.murosH[r][c] = jugador.id;
            else estado.murosV[r][c] = jugador.id;
            const newDist = bfsCamino(leadingRival, estado.murosH, estado.murosV, undefined, estado.n).distancia;
            if (o === 'H') estado.murosH[r][c] = -1;
            else estado.murosV[r][c] = -1;

            if (newDist >= rivalDist0 + 1) {
              return { tipo: 'muro', orientacion: o, coord: { r, c } };
            }
          }
        }
      }
    }

    if (moves.length > 0) {
      if (Math.random() < 0.3) {
        return { tipo: 'mover', coord: moves[Math.floor(Math.random() * moves.length)] };
      }
      const bm = bestMoveToGoal();
      if (bm) return { tipo: 'mover', coord: bm };
    }

    if (jugador.muros > 0) {
      const anyWall = buscarCualquierMuroValido(estado);
      if (anyWall) return anyWall;
    }

    return { tipo: 'pasar' };
  }

  const myDist = bfsCamino(jugador, estado.murosH, estado.murosV, undefined, estado.n).distancia;
  const leadingRival = obtenerRivalMasPeligroso(estado, jugador.id);
  const rivalDist = leadingRival
    ? bfsCamino(leadingRival, estado.murosH, estado.murosV, undefined, estado.n).distancia
    : Infinity;

  const winningMove = moves.find((m) => esMeta(jugador, m.r, m.c, estado.n, boardSize));
  if (winningMove) {
    return { tipo: 'mover', coord: winningMove };
  }

  if (tipoBot === 'bot_dificil') {
    let bestAction:
      | { tipo: 'mover'; coord: Coordenada; score: number }
      | { tipo: 'muro'; orientacion: OrientacionMuro; coord: Coordenada; score: number }
      | null = null;

    for (const m of moves) {
      const { distancia: myNewDist } = bfsCamino(jugador, estado.murosH, estado.murosV, m, estado.n);
      const score = (rivalDist - myNewDist) * 3 + (myDist - myNewDist) * 2;
      if (!bestAction || score > bestAction.score) {
        bestAction = { tipo: 'mover', coord: m, score };
      }
    }

    if (jugador.muros > 0 && leadingRival) {
      const candidateWalls: { o: OrientacionMuro; r: number; c: number }[] = [];
      const rivalPath = bfsCamino(leadingRival, estado.murosH, estado.murosV, undefined, estado.n).camino;

      for (const pt of rivalPath) {
        for (const dr of [-1, 0, 1]) {
          for (const dc of [-1, 0, 1]) {
            const wr = pt.r + dr;
            const wc = pt.c + dc;
            if (wr >= 0 && wr < wallGridSize && wc >= 0 && wc < wallGridSize) {
              candidateWalls.push({ o: 'H', r: wr, c: wc });
              candidateWalls.push({ o: 'V', r: wr, c: wc });
            }
          }
        }
      }

      const tested = new Set<string>();
      for (const w of candidateWalls) {
        const key = `${w.o}_${w.r}_${w.c}`;
        if (tested.has(key)) continue;
        tested.add(key);

        if (validarMuro(w.o, w.r, w.c, estado.murosH, estado.murosV, estado.jugadores) === 'ok') {
          if (w.o === 'H') estado.murosH[w.r][w.c] = jugador.id;
          else estado.murosV[w.r][w.c] = jugador.id;

          const newRivalDist = bfsCamino(leadingRival, estado.murosH, estado.murosV, undefined, estado.n).distancia;
          const newMyDist = bfsCamino(jugador, estado.murosH, estado.murosV, undefined, estado.n).distancia;

          if (w.o === 'H') estado.murosH[w.r][w.c] = -1;
          else estado.murosV[w.r][w.c] = -1;

          const rivalDetour = newRivalDist - rivalDist;
          const selfPenalty = newMyDist - myDist;

          if (rivalDetour >= 1 && selfPenalty <= 1) {
            let wallScore = rivalDetour * 4 - selfPenalty * 5 + (newRivalDist - newMyDist) * 3;
            if (rivalDist <= 2 && rivalDetour >= 1) {
              wallScore += 20;
            } else if (rivalDist <= 4 && rivalDetour >= 2) {
              wallScore += 8;
            }

            if (!bestAction || wallScore > bestAction.score) {
              bestAction = {
                tipo: 'muro',
                orientacion: w.o,
                coord: { r: w.r, c: w.c },
                score: wallScore,
              };
            }
          }
        }
      }
    }

    if (bestAction) {
      if (bestAction.tipo === 'mover') {
        return { tipo: 'mover', coord: bestAction.coord };
      }
      return { tipo: 'muro', orientacion: bestAction.orientacion, coord: bestAction.coord };
    }
  }

  const deseaAvanzar = Math.random() < 0.7;
  const rivalMuyCerca = rivalDist <= 3;

  if (deseaAvanzar && !rivalMuyCerca) {
    const bm = bestMoveToGoal();
    if (bm) return { tipo: 'mover', coord: bm };
  }

  let bestWall: { orientacion: OrientacionMuro; coord: Coordenada; ganancia: number } | null = null;

  if (jugador.muros > 0 && leadingRival && rivalDist <= 6) {
    const candidatePool: { o: OrientacionMuro; r: number; c: number }[] = [];
    const rivalPath = bfsCamino(leadingRival, estado.murosH, estado.murosV, undefined, estado.n).camino;

    for (const pt of rivalPath.slice(0, 3)) {
      for (const dr of [-1, 0, 1]) {
        for (const dc of [-1, 0, 1]) {
          const wr = pt.r + dr;
          const wc = pt.c + dc;
          if (wr >= 0 && wr < wallGridSize && wc >= 0 && wc < wallGridSize) {
            candidatePool.push({ o: 'H', r: wr, c: wc });
            candidatePool.push({ o: 'V', r: wr, c: wc });
          }
        }
      }
    }

    const shuffled = candidatePool.sort(() => 0.5 - Math.random()).slice(0, 8);
    let maxGain = -999;

    for (const w of shuffled) {
      if (validarMuro(w.o, w.r, w.c, estado.murosH, estado.murosV, estado.jugadores) === 'ok') {
        if (w.o === 'H') estado.murosH[w.r][w.c] = jugador.id;
        else estado.murosV[w.r][w.c] = jugador.id;

        const newRivalDist = bfsCamino(leadingRival, estado.murosH, estado.murosV, undefined, estado.n).distancia;
        const newMyDist = bfsCamino(jugador, estado.murosH, estado.murosV, undefined, estado.n).distancia;

        if (w.o === 'H') estado.murosH[w.r][w.c] = -1;
        else estado.murosV[w.r][w.c] = -1;

        const rivalGain = newRivalDist - rivalDist;
        const myLoss = newMyDist - myDist;
        const jitter = Math.random() * 0.4 - 0.2;
        const ganancia = rivalGain - myLoss + jitter;

        if (ganancia > maxGain) {
          maxGain = ganancia;
          bestWall = { orientacion: w.o, coord: { r: w.r, c: w.c }, ganancia };
        }
      }
    }
  }

  if (
    bestWall &&
    ((bestWall.ganancia >= 1.5 && rivalDist <= 5) || (rivalMuyCerca && bestWall.ganancia >= 1))
  ) {
    return { tipo: 'muro', orientacion: bestWall.orientacion, coord: bestWall.coord };
  }

  const bm = bestMoveToGoal();
  if (bm) {
    return { tipo: 'mover', coord: bm };
  }

  if (bestWall && bestWall.ganancia >= 0) {
    return { tipo: 'muro', orientacion: bestWall.orientacion, coord: bestWall.coord };
  }

  return { tipo: 'pasar' };
}

function buscarCualquierMuroValido(
  estado: EstadoDeJuego
): { tipo: 'muro'; orientacion: OrientacionMuro; coord: Coordenada } | null {
  const wallGridSize = estado.murosH.length > 0 ? estado.murosH.length : WALL_GRID_SIZE;
  for (let r = 0; r < wallGridSize; r++) {
    for (let c = 0; c < wallGridSize; c++) {
      for (const o of ['H', 'V'] as OrientacionMuro[]) {
        if (validarMuro(o, r, c, estado.murosH, estado.murosV, estado.jugadores) === 'ok') {
          return { tipo: 'muro', orientacion: o, coord: { r, c } };
        }
      }
    }
  }
  return null;
}

export function calcularDesglosePuntos(
  jugador: JugadorEnJuego,
  estado: EstadoDeJuego,
  _rachaActual: number = 0,
  bonoTorneo: number = 0
): DesglosePuntos {
  const esGanador = estado.ganador === jugador.id;
  const stats = jugador.estadisticas;
  const boardSize = estado.murosH.length > 0 ? estado.murosH.length + 1 : BOARD_SIZE;
  const mid = Math.floor(boardSize / 2);
  const last = boardSize - 1;

  // Sistema de puntos gradual:
  // - Victoria: +5 pts (derrota o empate: 0 pts)
  // - Muros colocados: +1 pt por cada muro usado
  // - Final cerrado (ganar cuando un rival estaba a 1 casilla de su meta): +5 pts
  // - Bono de campeón de torneo (al ganar el torneo completo): +10 pts
  const resultado = esGanador ? 5 : 0;
  const murosUsados = stats.murosColocados * 1;

  let rivalACasillaDeGanar = false;
  let rivalCercaDeInicio = false;
  if (esGanador) {
    for (const otro of estado.jugadores) {
      if (otro.id !== jugador.id) {
        const { distancia } = bfsCamino(otro, estado.murosH, estado.murosV, undefined, estado.n);
        if (distancia <= 1) {
          rivalACasillaDeGanar = true;
        }

        // Puesto inicial de cada jugador según el número de participantes y tamaño del tablero
        const startPos =
          (estado.n === 2
            ? { 0: { r: last, c: mid }, 1: { r: 0, c: mid } }[otro.id]
            : { 0: { r: last, c: mid }, 1: { r: mid, c: 0 }, 2: { r: 0, c: mid }, 3: { r: mid, c: last } }[otro.id]) || {
            r: 0,
            c: mid,
          };
        const distManhattan = Math.abs(otro.r - startPos.r) + Math.abs(otro.c - startPos.c);
        // Si el oponente está a 2 casillas o menos de su puesto inicial al ganar: +2 pts extra
        if (distManhattan <= 2) {
          rivalCercaDeInicio = true;
        }
      }
    }
  }
  const finalCerrado = esGanador && rivalACasillaDeGanar ? 5 : 0;
  const bonoDominacion = esGanador && rivalCercaDeInicio ? 2 : 0;

  const pPistas = stats.usosPista * 1;
  const pDeshacer = stats.usosDeshacer * 2;
  const pMurosInvalidos = 0;
  const pTiempoAgotado = stats.turnosAgotados * 1;
  const pAbandonar = 0;

  const totalPenalizaciones = pPistas + pDeshacer + pMurosInvalidos + pTiempoAgotado + pAbandonar;

  const subtotal = resultado + murosUsados + finalCerrado + bonoDominacion + bonoTorneo - totalPenalizaciones;
  const total = Math.max(0, subtotal);

  return {
    resultado,
    murosUsados,
    finalCerrado,
    bonoDominacion,
    bonoTorneo,
    ahorrador: 0,
    rapidez: 0,
    saltador: 0,
    muroMaestro: 0,
    remontada: 0,
    racha: 0,
    partidaLimpia: 0,
    penalizaciones: {
      pistas: pPistas,
      deshacer: pDeshacer,
      murosInvalidos: pMurosInvalidos,
      tiempoAgotado: pTiempoAgotado,
      abandonar: pAbandonar,
      total: totalPenalizaciones,
    },
    multiplicador: 1,
    total,
  };
}

export const iniciarPartida = inicializarPartida;

export function calcularDesglosesPuntuacion(estado: EstadoDeJuego): Map<number, DesglosePuntos> {
  const map = new Map<number, DesglosePuntos>();
  estado.jugadores.forEach((p) => {
    map.set(p.id, calcularDesglosePuntos(p, estado, p.estadisticas.remontada ? 1 : 0));
  });
  return map;
}

function clonarEstadoParaAccion(estado: EstadoDeJuego): EstadoDeJuego {
  return {
    ...estado,
    jugadores: estado.jugadores.map((p) => ({
      ...p,
      estadisticas: { ...p.estadisticas },
    })),
    murosH: estado.murosH.map((row) => [...row]),
    murosV: estado.murosV.map((row) => [...row]),
    historial: [...estado.historial],
    registroAcciones: [...estado.registroAcciones],
  };
}

export function ejecutarAccionMover(estado: EstadoDeJuego, destino: Coordenada, _jugadorId?: number): EstadoDeJuego {
  const copia = clonarEstadoParaAccion(estado);
  aplicarMovimiento(copia, destino);
  return copia;
}

export function ejecutarAccionMuro(
  estado: EstadoDeJuego,
  coord: Coordenada,
  orientacion: OrientacionMuro,
  _jugadorId?: number
): EstadoDeJuego {
  const copia = clonarEstadoParaAccion(estado);
  aplicarMuro(copia, orientacion, coord.r, coord.c);
  return copia;
}

export function ejecutarTurnoBot(estado: EstadoDeJuego): { nuevoEstado: EstadoDeJuego; accion: any } {
  const copia = clonarEstadoParaAccion(estado);
  const jugador = copia.jugadores[copia.turnoActual];
  const jugada = calcularJugadaBot(jugador, copia);
  if (jugada.tipo === 'mover') {
    aplicarMovimiento(copia, jugada.coord);
  } else if (jugada.tipo === 'muro') {
    aplicarMuro(copia, jugada.orientacion, jugada.coord.r, jugada.coord.c);
  } else {
    avanzarTurno(copia);
  }
  return { nuevoEstado: copia, accion: jugada };
}

export function obtenerCaminoPista(
  jugador: JugadorEnJuego,
  murosH: number[][],
  murosV: number[][],
  numJugadores: number = 2
): Coordenada[] {
  const { camino } = bfsCamino(jugador, murosH, murosV, undefined, numJugadores);
  return camino;
}

export function deshacerJugada(estado: EstadoDeJuego): EstadoDeJuego {
  if (estado.historial.length === 0) return estado;
  const snapshot = estado.historial.pop()!;

  return {
    ...estado,
    jugadores: snapshot.jugadores.map((sj) => {
      const orig = estado.jugadores.find((p) => p.id === sj.id)!;
      const prevUsos = Math.max(orig.estadisticas.usosDeshacer, sj.estadisticas.usosDeshacer);
      return {
        ...orig,
        r: sj.r,
        c: sj.c,
        muros: sj.muros,
        estadisticas: {
          ...sj.estadisticas,
          usosDeshacer: sj.id === snapshot.turnoActual ? prevUsos + 1 : prevUsos,
          partidaLimpia: sj.id === snapshot.turnoActual ? false : sj.estadisticas.partidaLimpia,
        },
      };
    }),
    murosH: snapshot.murosH.map((r) => [...r]),
    murosV: snapshot.murosV.map((r) => [...r]),
    turnoActual: snapshot.turnoActual,
    turnosTotales: snapshot.turnosTotales,
    registroAcciones: snapshot.registroAcciones ? [...snapshot.registroAcciones] : estado.registroAcciones,
    terminada: false,
    ganador: null,
    caminoPista: null,
    muroPrevisualizado: null,
    ultimoMensaje: '↩ Jugada deshecha (-2 pts)',
  };
}
