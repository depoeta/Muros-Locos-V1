/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AccionRegistro,
  Coord,
  GameState,
  MatchConfig,
  Player,
  PlayerStats,
  ScoreBreakdown,
  TorneoState,
  WallOrientation,
} from '../types/murosLocos';

export const BOARD_SIZE = 9;
export const WALL_GRID_SIZE = 8;

export function coordToAlgebraic(r: number, c: number): string {
  const colLetter = String.fromCharCode(65 + c);
  const rowNum = 9 - r;
  return `${colLetter}${rowNum}`;
}

export function createEmptyGrid(val: number = -1): number[][] {
  const g: number[][] = [];
  for (let r = 0; r < WALL_GRID_SIZE; r++) {
    const row: number[] = [];
    for (let c = 0; c < WALL_GRID_SIZE; c++) {
      row.push(val);
    }
    g.push(row);
  }
  return g;
}

export function createInitialStats(): PlayerStats {
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

export function crearEstadoTorneo(totalRondas: number, numJugadores: number): TorneoState {
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

export function inicializarPartida(config: MatchConfig): GameState {
  const n = config.numJugadores;
  const initialWalls = n === 2 ? 10 : 5;

  let jugadores: Player[] = [];

  if (n === 2) {
    jugadores = [
      {
        id: 0,
        nombre: config.jugadores[0]?.nombre || 'Jugador 1',
        tipo: config.jugadores[0]?.tipo || 'humano',
        color: config.jugadores[0]?.color || '#ff6b6b',
        hat: config.jugadores[0]?.hat || 'corona',
        r: 8,
        c: 4,
        muros: initialWalls,
        targetType: 'row',
        targetValue: 0,
        estadisticas: createInitialStats(),
      },
      {
        id: 1,
        nombre: config.jugadores[1]?.nombre || 'Bot Normal',
        tipo: config.jugadores[1]?.tipo || 'bot_normal',
        color: config.jugadores[1]?.color || '#4dabf7',
        hat: config.jugadores[1]?.hat || 'pompon',
        r: 0,
        c: 4,
        muros: initialWalls,
        targetType: 'row',
        targetValue: 8,
        estadisticas: createInitialStats(),
      },
    ];
  } else {
    // 4 Players clockwise: J1 (bottom), J2 (left), J3 (top), J4 (right)
    jugadores = [
      {
        id: 0,
        nombre: config.jugadores[0]?.nombre || 'Jugador 1',
        tipo: config.jugadores[0]?.tipo || 'humano',
        color: config.jugadores[0]?.color || '#ff6b6b',
        hat: config.jugadores[0]?.hat || 'corona',
        r: 8,
        c: 4,
        muros: initialWalls,
        targetType: 'row',
        targetValue: 0,
        estadisticas: createInitialStats(),
      },
      {
        id: 1,
        nombre: config.jugadores[1]?.nombre || 'Jugador 2',
        tipo: config.jugadores[1]?.tipo || 'bot_normal',
        color: config.jugadores[1]?.color || '#4dabf7',
        hat: config.jugadores[1]?.hat || 'pompon',
        r: 4,
        c: 0,
        muros: initialWalls,
        targetType: 'col',
        targetValue: 8,
        estadisticas: createInitialStats(),
      },
      {
        id: 2,
        nombre: config.jugadores[2]?.nombre || 'Jugador 3',
        tipo: config.jugadores[2]?.tipo || 'bot_normal',
        color: config.jugadores[2]?.color || '#ffd43b',
        hat: config.jugadores[2]?.hat || 'antena',
        r: 0,
        c: 4,
        muros: initialWalls,
        targetType: 'row',
        targetValue: 8,
        estadisticas: createInitialStats(),
      },
      {
        id: 3,
        nombre: config.jugadores[3]?.nombre || 'Jugador 4',
        tipo: config.jugadores[3]?.tipo || 'bot_facil',
        color: config.jugadores[3]?.color || '#51cf66',
        hat: config.jugadores[3]?.hat || 'brote',
        r: 4,
        c: 8,
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
    jugadores,
    murosH: createEmptyGrid(-1),
    murosV: createEmptyGrid(-1),
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
    config,
    tiempoRestante: config.segundosPorTurno || 30,
    pensandoBot: false,
    ultimoMensaje: msjInicial,
    torneo,
  };
}


// 4.1 Wall check helper
export function isH(r: number, c: number, murosH: number[][]): boolean {
  return r >= 0 && r < WALL_GRID_SIZE && c >= 0 && c < WALL_GRID_SIZE && murosH[r][c] !== -1;
}

export function isV(r: number, c: number, murosV: number[][]): boolean {
  return r >= 0 && r < WALL_GRID_SIZE && c >= 0 && c < WALL_GRID_SIZE && murosV[r][c] !== -1;
}

export function bloqueado(
  r: number,
  c: number,
  dr: number,
  dc: number,
  murosH: number[][],
  murosV: number[][]
): boolean {
  if (dr === -1) {
    // Up
    return isH(r - 1, c, murosH) || isH(r - 1, c - 1, murosH);
  }
  if (dr === 1) {
    // Down
    return isH(r, c, murosH) || isH(r, c - 1, murosH);
  }
  if (dc === 1) {
    // Right
    return isV(r, c, murosV) || isV(r - 1, c, murosV);
  }
  if (dc === -1) {
    // Left
    return isV(r, c - 1, murosV) || isV(r - 1, c - 1, murosV);
  }
  return false;
}

// 4.2 Legal moves with straight & diagonal jumps
export function movimientosLegales(jugador: Player, estado: GameState): Coord[] {
  const res: Coord[] = [];
  const direcciones = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  const ocupadoPor = (r: number, c: number): Player | undefined => {
    return estado.jugadores.find((p) => p.r === r && p.c === c);
  };

  for (const { dr, dc } of direcciones) {
    if (bloqueado(jugador.r, jugador.c, dr, dc, estado.murosH, estado.murosV)) {
      continue;
    }
    const nr = jugador.r + dr;
    const nc = jugador.c + dc;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
      continue;
    }

    const ocupante = ocupadoPor(nr, nc);
    if (!ocupante) {
      res.push({ r: nr, c: nc });
      continue;
    }

    // Attempt straight jump over opponent
    const jr = nr + dr;
    const jc = nc + dc;
    const canJumpStraight =
      jr >= 0 &&
      jr < BOARD_SIZE &&
      jc >= 0 &&
      jc < BOARD_SIZE &&
      !bloqueado(nr, nc, dr, dc, estado.murosH, estado.murosV) &&
      !ocupadoPor(jr, jc);

    if (canJumpStraight) {
      res.push({ r: jr, c: jc });
      continue;
    }

    // Straight jump blocked: attempt diagonal jumps
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
        if (sr >= 0 && sr < BOARD_SIZE && sc >= 0 && sc < BOARD_SIZE && !ocupadoPor(sr, sc)) {
          // Avoid duplicate positions
          if (!res.some((p) => p.r === sr && p.c === sc)) {
            res.push({ r: sr, c: sc });
          }
        }
      }
    }
  }

  return res;
}

// Check if position reaches goal
export function esMeta(jugador: Player, r: number, c: number): boolean {
  if (jugador.targetType === 'row') {
    return r === jugador.targetValue;
  }
  return c === jugador.targetValue;
}

// 4.3 Shortest path (BFS) to goal
export function bfsCamino(
  jugador: Player,
  murosH: number[][],
  murosV: number[][],
  desde?: Coord
): { distancia: number; camino: Coord[] } {
  const start = desde || { r: jugador.r, c: jugador.c };

  // Fast check: already at goal
  if (esMeta(jugador, start.r, start.c)) {
    return { distancia: 0, camino: [start] };
  }

  const dist: number[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(Infinity)
  );
  const parent: (Coord | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null)
  );

  const queue: Coord[] = [start];
  dist[start.r][start.c] = 0;

  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  let goalNode: Coord | null = null;

  while (queue.length > 0) {
    const cur = queue.shift()!;

    if (esMeta(jugador, cur.r, cur.c)) {
      goalNode = cur;
      break;
    }

    for (const { dr, dc } of dirs) {
      if (!bloqueado(cur.r, cur.c, dr, dc, murosH, murosV)) {
        const nr = cur.r + dr;
        const nc = cur.c + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
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

  // Reconstruct path
  const path: Coord[] = [];
  let curr: Coord | null = goalNode;
  while (curr) {
    path.unshift(curr);
    curr = parent[curr.r][curr.c];
  }

  return { distancia: dist[goalNode.r][goalNode.c], camino: path };
}

// 4.4 Validate wall placement
export function validarMuro(
  orientacion: WallOrientation,
  r: number,
  c: number,
  murosH: number[][],
  murosV: number[][],
  jugadores: Player[]
): 'ok' | 'fuera' | 'solape' | 'bloquea' {
  if (r < 0 || r >= WALL_GRID_SIZE || c < 0 || c >= WALL_GRID_SIZE) {
    return 'fuera';
  }

  // Crossing check or existing wall at same intersection
  if (murosH[r][c] !== -1 || murosV[r][c] !== -1) {
    return 'solape';
  }

  if (orientacion === 'H') {
    // Must not overlap horizontally with adjacent wall
    if (isH(r, c - 1, murosH) || isH(r, c + 1, murosH)) {
      return 'solape';
    }
  } else {
    // Must not overlap vertically with adjacent wall
    if (isV(r - 1, c, murosV) || isV(r + 1, c, murosV)) {
      return 'solape';
    }
  }

  // Temporarily place wall
  if (orientacion === 'H') {
    murosH[r][c] = 999;
  } else {
    murosV[r][c] = 999;
  }

  // Check path guarantee for EVERY player
  let allHavePath = true;
  for (const j of jugadores) {
    const { distancia } = bfsCamino(j, murosH, murosV);
    if (distancia === Infinity) {
      allHavePath = false;
      break;
    }
  }

  // Remove temporary wall
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

// Deep copy snapshot for undo
export function tomarSnapshot(estado: GameState) {
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

// Execute player movement
export function aplicarMovimiento(
  estado: GameState,
  destino: Coord
): { ganador: boolean; esSalto: boolean; mensaje: string } {
  const jugador = estado.jugadores[estado.turnoActual];
  const origenCoord = { r: jugador.r, c: jugador.c };

  // Save snapshot before mutating
  estado.historial.push(tomarSnapshot(estado));

  // Determine if it was a jump (Manhattan distance > 1 or diagonal)
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

  // Register in chronological history
  const notacionOrigen = coordToAlgebraic(origenCoord.r, origenCoord.c);
  const notacionDestino = coordToAlgebraic(destino.r, destino.c);
  estado.registroAcciones.push({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    turnoNumero: estado.turnosTotales + 1,
    jugadorId: jugador.id,
    jugadorNombre: jugador.nombre,
    jugadorColor: jugador.color,
    tipo: 'mover',
    descripcion: esSalto
      ? `🦘 Salto a ${notacionDestino}`
      : `🚶 Paso a ${notacionDestino}`,
    detalle: esSalto
      ? `Salto sobre rival de ${notacionOrigen} a ${notacionDestino}`
      : `Desde ${notacionOrigen}`,
    coordOrigen: origenCoord,
    coordDestino: destino,
    esSalto,
    tiempo: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  });

  // Track remontada stats: calculate current disadvantage vs closest rival
  actualizarDesventaja(estado);

  // Check victory
  if (esMeta(jugador, jugador.r, jugador.c)) {
    estado.terminada = true;
    estado.ganador = estado.turnoActual;
    const msg = `👑 ¡${jugador.nombre} ha ganado la partida!`;
    estado.ultimoMensaje = msg;
    return { ganador: true, esSalto, mensaje: msg };
  }

  // Pass turn
  avanzarTurno(estado);
  const proximo = estado.jugadores[estado.turnoActual];
  const mensaje = esSalto
    ? `¡${jugador.nombre} saltó y le toca a ${proximo.nombre}!`
    : `Turno de ${proximo.nombre}`;
  estado.ultimoMensaje = mensaje;

  return { ganador: false, esSalto, mensaje };
}

// Execute wall placement
export function aplicarMuro(
  estado: GameState,
  orientacion: WallOrientation,
  r: number,
  c: number
): { esMuroMaestro: boolean; mensaje: string } {
  const jugador = estado.jugadores[estado.turnoActual];

  // Calculate rival distance increase before placing to check "Muro maestro"
  const leadingRivalBefore = obtenerRivalMasPeligroso(estado, jugador.id);
  const rivalDistBefore = leadingRivalBefore
    ? bfsCamino(leadingRivalBefore, estado.murosH, estado.murosV).distancia
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

  // Check Muro maestro: increases closest rival's distance by >= 4
  let esMuroMaestro = false;
  if (leadingRivalBefore) {
    const rivalDistAfter = bfsCamino(leadingRivalBefore, estado.murosH, estado.murosV).distancia;
    if (rivalDistAfter - rivalDistBefore >= 4) {
      esMuroMaestro = true;
      jugador.estadisticas.murosMaestros++;
    }
  }

  // Register wall action in chronological history
  const notacionMuro = `${String.fromCharCode(65 + c)}${9 - r}`;
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

  // Pass turn
  avanzarTurno(estado);
  const proximo = estado.jugadores[estado.turnoActual];
  const mensaje = esMuroMaestro
    ? `🧱 ¡Muro maestro de ${jugador.nombre}! Le toca a ${proximo.nombre}`
    : `Muro colocado. Turno de ${proximo.nombre}`;
  estado.ultimoMensaje = mensaje;

  return { esMuroMaestro, mensaje };
}

// Tournament round handlers
export function registrarResultadoRondaTorneo(
  torneo: TorneoState,
  ganadorId: number,
  ganadorNombre: string,
  puntosPorJugador: Record<number, number>
): TorneoState {
  const nextTorneo: TorneoState = {
    ...torneo,
    puntosAcumulados: { ...torneo.puntosAcumulados },
    victoriasAcumuladas: { ...torneo.victoriasAcumuladas },
    historialRondas: [...torneo.historialRondas],
  };

  Object.entries(puntosPorJugador).forEach(([idStr, pts]) => {
    const id = Number(idStr);
    nextTorneo.puntosAcumulados[id] = (nextTorneo.puntosAcumulados[id] || 0) + pts;
  });

  if (ganadorId >= 0) {
    nextTorneo.victoriasAcumuladas[ganadorId] = (nextTorneo.victoriasAcumuladas[ganadorId] || 0) + 1;
  }

  nextTorneo.historialRondas.push({
    ronda: torneo.rondaActual,
    ganadorId,
    ganadorNombre,
    puntosRonda: { ...puntosPorJugador },
  });

  if (nextTorneo.rondaActual >= nextTorneo.totalRondas) {
    nextTorneo.terminado = true;
    let maxPts = -1;
    let bestId = 0;
    Object.entries(nextTorneo.puntosAcumulados).forEach(([idStr, pts]) => {
      const id = Number(idStr);
      if (pts > maxPts) {
        maxPts = pts;
        bestId = id;
      }
    });
    nextTorneo.ganadorGlobalId = bestId;
  }

  return nextTorneo;
}

export function reiniciarTableroParaSiguienteRonda(estado: GameState): GameState {
  if (!estado.torneo) return estado;
  const config = estado.config;
  const n = config.numJugadores;
  const initialWalls = n === 2 ? 10 : 5;

  const proximaRonda = estado.torneo.rondaActual + 1;
  const torneoActualizado: TorneoState = {
    ...estado.torneo,
    rondaActual: proximaRonda,
  };

  // Reset player board positions and walls for the new match
  const jugadores: Player[] = estado.jugadores.map((p) => {
    let startR = 8;
    let startC = 4;
    let targetType: 'row' | 'col' = 'row';
    let targetValue = 0;

    if (n === 2) {
      if (p.id === 0) {
        startR = 8; startC = 4; targetType = 'row'; targetValue = 0;
      } else {
        startR = 0; startC = 4; targetType = 'row'; targetValue = 8;
      }
    } else {
      if (p.id === 0) { startR = 8; startC = 4; targetType = 'row'; targetValue = 0; }
      else if (p.id === 1) { startR = 4; startC = 0; targetType = 'col'; targetValue = 8; }
      else if (p.id === 2) { startR = 0; startC = 4; targetType = 'row'; targetValue = 8; }
      else { startR = 4; startC = 8; targetType = 'col'; targetValue = 0; }
    }

    return {
      ...p,
      r: startR,
      c: startC,
      muros: initialWalls,
      targetType,
      targetValue,
      estadisticas: createInitialStats(),
    };
  });

  const turnoInicial = config.empiezaAlAzar ? Math.floor(Math.random() * n) : 0;

  return {
    ...estado,
    jugadores,
    murosH: createEmptyGrid(-1),
    murosV: createEmptyGrid(-1),
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
    tiempoRestante: config.segundosPorTurno || 30,
    pensandoBot: false,
    ultimoMensaje: `🏆 Ronda ${proximaRonda} de ${torneoActualizado.totalRondas}: ¡Turno de ${jugadores[turnoInicial].nombre}!`,
    torneo: torneoActualizado,
  };
}

// Track remontada stats for every player
function actualizarDesventaja(estado: GameState) {
  for (const p of estado.jugadores) {
    const myDist = bfsCamino(p, estado.murosH, estado.murosV).distancia;
    let minRivalDist = Infinity;
    for (const other of estado.jugadores) {
      if (other.id !== p.id) {
        const d = bfsCamino(other, estado.murosH, estado.murosV).distancia;
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

// Find closest opponent to their own goal
export function obtenerRivalMasPeligroso(estado: GameState, myPlayerId: number): Player | null {
  let closest: Player | null = null;
  let minDist = Infinity;

  for (const p of estado.jugadores) {
    if (p.id !== myPlayerId) {
      const dist = bfsCamino(p, estado.murosH, estado.murosV).distancia;
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
  }

  return closest;
}

// Advance turn, check ties & auto-pass
export function avanzarTurno(estado: GameState) {
  estado.turnosTotales++;
  estado.caminoPista = null;
  estado.muroPrevisualizado = null;
  estado.tiempoRestante = estado.config.segundosPorTurno || 30;

  // Check 200 turn tie
  if (estado.turnosTotales >= 200) {
    estado.terminada = true;
    estado.ganador = -1; // Tie
    estado.ultimoMensaje = '⚖️ ¡Empate por alcanzar los 200 turnos!';
    return;
  }

  let nextIdx = (estado.turnoActual + 1) % estado.n;
  let attempts = 0;

  while (attempts < estado.n) {
    const nextPlayer = estado.jugadores[nextIdx];
    const moves = movimientosLegales(nextPlayer, estado);

    // If player has moves or walls, they can take their turn
    if (moves.length > 0 || nextPlayer.muros > 0) {
      estado.turnoActual = nextIdx;
      // Default to move mode if moves exist, otherwise wall mode
      estado.modoAccion = moves.length > 0 ? 'mover' : 'muro';
      return;
    }

    // Auto-pass if no moves and no walls
    nextIdx = (nextIdx + 1) % estado.n;
    attempts++;
  }

  // All players stuck? Tie
  estado.terminada = true;
  estado.ganador = -1;
  estado.ultimoMensaje = '⚖️ ¡Todos los jugadores bloqueados! Empate.';
}

// Bot AI Implementation (Section 5)
export function calcularJugadaBot(
  jugador: Player,
  estado: GameState
): { tipo: 'mover'; coord: Coord } | { tipo: 'muro'; orientacion: WallOrientation; coord: Coord } | { tipo: 'pasar' } {
  const moves = movimientosLegales(jugador, estado);

  // If no moves and no walls, pass
  if (moves.length === 0 && jugador.muros === 0) {
    return { tipo: 'pasar' };
  }

  const tipoBot = jugador.tipo;

  // Helper: shortest path step towards goal
  const bestMoveToGoal = (): Coord | null => {
    if (moves.length === 0) return null;
    let bestDist = Infinity;
    let candidates: Coord[] = [];

    for (const m of moves) {
      const { distancia } = bfsCamino(jugador, estado.murosH, estado.murosV, m);
      if (distancia < bestDist) {
        bestDist = distancia;
        candidates = [m];
      } else if (distancia === bestDist) {
        candidates.push(m);
      }
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  // 1. Bot Fácil
  if (tipoBot === 'bot_facil') {
    // 15% probability of placing a wall if walls remain
    if (jugador.muros > 0 && Math.random() < 0.15) {
      const leadingRival = obtenerRivalMasPeligroso(estado, jugador.id);
      if (leadingRival) {
        const rivalDist0 = bfsCamino(leadingRival, estado.murosH, estado.murosV).distancia;
        // Sample candidate positions
        for (let tries = 0; tries < 20; tries++) {
          const r = Math.floor(Math.random() * WALL_GRID_SIZE);
          const c = Math.floor(Math.random() * WALL_GRID_SIZE);
          const o: WallOrientation = Math.random() < 0.5 ? 'H' : 'V';
          if (validarMuro(o, r, c, estado.murosH, estado.murosV, estado.jugadores) === 'ok') {
            // Check if it lengthens rival by at least 1
            if (o === 'H') estado.murosH[r][c] = jugador.id;
            else estado.murosV[r][c] = jugador.id;
            const newDist = bfsCamino(leadingRival, estado.murosH, estado.murosV).distancia;
            if (o === 'H') estado.murosH[r][c] = -1;
            else estado.murosV[r][c] = -1;

            if (newDist >= rivalDist0 + 1) {
              return { tipo: 'muro', orientacion: o, coord: { r, c } };
            }
          }
        }
      }
    }

    // 30% random legal move, else shortest path
    if (moves.length > 0) {
      if (Math.random() < 0.3) {
        return { tipo: 'mover', coord: moves[Math.floor(Math.random() * moves.length)] };
      }
      const bm = bestMoveToGoal();
      if (bm) return { tipo: 'mover', coord: bm };
    }

    if (jugador.muros > 0) {
      // Emergency random valid wall
      const anyWall = buscarCualquierMuroValido(estado, jugador);
      if (anyWall) return anyWall;
    }

    return { tipo: 'pasar' };
  }

  // 2. Bot Normal & Bot Difícil
  const myDist = bfsCamino(jugador, estado.murosH, estado.murosV).distancia;
  const leadingRival = obtenerRivalMasPeligroso(estado, jugador.id);
  const rivalDist = leadingRival
    ? bfsCamino(leadingRival, estado.murosH, estado.murosV).distancia
    : Infinity;

  // Instant victory check: if any legal move wins the game right now, take it!
  const winningMove = moves.find((m) => esMeta(jugador, m.r, m.c));
  if (winningMove) {
    return { tipo: 'mover', coord: winningMove };
  }

  // 2. Bot Difícil: 2-ply Lookahead Evaluation & Strategic Blocking
  if (tipoBot === 'bot_dificil') {
    let bestAction:
      | { tipo: 'mover'; coord: Coord; score: number }
      | { tipo: 'muro'; orientacion: WallOrientation; coord: Coord; score: number }
      | null = null;

    // Evaluate all legal moves
    for (const m of moves) {
      const { distancia: myNewDist } = bfsCamino(jugador, estado.murosH, estado.murosV, m);
      // Lead advantage after this move
      const score = (rivalDist - myNewDist) * 3 + (myDist - myNewDist) * 2;
      if (!bestAction || score > bestAction.score) {
        bestAction = { tipo: 'mover', coord: m, score };
      }
    }

    // Evaluate candidate walls if walls remain
    if (jugador.muros > 0 && leadingRival) {
      const candidateWalls: { o: WallOrientation; r: number; c: number }[] = [];
      const rivalPath = bfsCamino(leadingRival, estado.murosH, estado.murosV).camino;

      for (const pt of rivalPath) {
        for (const dr of [-1, 0, 1]) {
          for (const dc of [-1, 0, 1]) {
            const wr = pt.r + dr;
            const wc = pt.c + dc;
            if (wr >= 0 && wr < WALL_GRID_SIZE && wc >= 0 && wc < WALL_GRID_SIZE) {
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

          const newRivalDist = bfsCamino(leadingRival, estado.murosH, estado.murosV).distancia;
          const newMyDist = bfsCamino(jugador, estado.murosH, estado.murosV).distancia;

          if (w.o === 'H') estado.murosH[w.r][w.c] = -1;
          else estado.murosV[w.r][w.c] = -1;

          const rivalDetour = newRivalDist - rivalDist;
          const selfPenalty = newMyDist - myDist;

          // Only consider walls that actually delay the rival without hurting self more
          if (rivalDetour >= 1 && selfPenalty <= 1) {
            let wallScore = rivalDetour * 4 - selfPenalty * 5 + (newRivalDist - newMyDist) * 3;
            // Massive bonus if rival is 1-2 steps from winning and this wall blocks them
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
      } else {
        return { tipo: 'muro', orientacion: bestAction.orientacion, coord: bestAction.coord };
      }
    }
  }

  // 3. Bot Normal
  let bestWall: { orientacion: WallOrientation; coord: Coord; ganancia: number } | null = null;

  if (jugador.muros > 0 && leadingRival && rivalDist <= myDist + 1) {
    const wallsToTest: { o: WallOrientation; r: number; c: number }[] = [];
    const rivalPath = bfsCamino(leadingRival, estado.murosH, estado.murosV).camino;

    for (const pt of rivalPath) {
      for (const dr of [-1, 0, 1]) {
        for (const dc of [-1, 0, 1]) {
          const wr = pt.r + dr;
          const wc = pt.c + dc;
          if (wr >= 0 && wr < WALL_GRID_SIZE && wc >= 0 && wc < WALL_GRID_SIZE) {
            wallsToTest.push({ o: 'H', r: wr, c: wc });
            wallsToTest.push({ o: 'V', r: wr, c: wc });
          }
        }
      }
    }

    const tested = new Set<string>();
    let maxGain = -999;

    for (const w of wallsToTest) {
      const key = `${w.o}_${w.r}_${w.c}`;
      if (tested.has(key)) continue;
      tested.add(key);

      if (validarMuro(w.o, w.r, w.c, estado.murosH, estado.murosV, estado.jugadores) === 'ok') {
        if (w.o === 'H') estado.murosH[w.r][w.c] = jugador.id;
        else estado.murosV[w.r][w.c] = jugador.id;

        const newRivalDist = bfsCamino(leadingRival, estado.murosH, estado.murosV).distancia;
        const newMyDist = bfsCamino(jugador, estado.murosH, estado.murosV).distancia;

        if (w.o === 'H') estado.murosH[w.r][w.c] = -1;
        else estado.murosV[w.r][w.c] = -1;

        const rivalGain = newRivalDist - rivalDist;
        const myLoss = newMyDist - myDist;
        const jitter = Math.random() * 0.3 - 0.15;
        const ganancia = rivalGain - myLoss + jitter;

        if (ganancia > maxGain) {
          maxGain = ganancia;
          bestWall = { orientacion: w.o, coord: { r: w.r, c: w.c }, ganancia };
        }
      }
    }
  }

  // Normal decision rule:
  if (
    bestWall &&
    ((bestWall.ganancia >= 2 && rivalDist <= 7) ||
      (rivalDist <= 2 && bestWall.ganancia >= 1) ||
      bestWall.ganancia >= 3)
  ) {
    return { tipo: 'muro', orientacion: bestWall.orientacion, coord: bestWall.coord };
  }

  // Otherwise, make best move to goal
  const bm = bestMoveToGoal();
  if (bm) {
    return { tipo: 'mover', coord: bm };
  }

  // Fallback if blocked
  if (bestWall && bestWall.ganancia >= 0) {
    return { tipo: 'muro', orientacion: bestWall.orientacion, coord: bestWall.coord };
  }

  return { tipo: 'pasar' };
}

function buscarCualquierMuroValido(
  estado: GameState,
  jugador: Player
): { tipo: 'muro'; orientacion: WallOrientation; coord: Coord } | null {
  for (let r = 0; r < WALL_GRID_SIZE; r++) {
    for (let c = 0; c < WALL_GRID_SIZE; c++) {
      for (const o of ['H', 'V'] as WallOrientation[]) {
        if (validarMuro(o, r, c, estado.murosH, estado.murosV, estado.jugadores) === 'ok') {
          return { tipo: 'muro', orientacion: o, coord: { r, c } };
        }
      }
    }
  }
  return null;
}

// 7. Score Calculation Formula
export function calcularDesglosePuntos(
  jugador: Player,
  estado: GameState,
  rachaActual: number
): ScoreBreakdown {
  const n = estado.n;
  const esGanador = estado.ganador === jugador.id;
  const stats = jugador.estadisticas;

  // 7.1 Puntos por resultado
  let resultado = 0;
  if (esGanador) {
    resultado = n === 2 ? 100 : 150;
  } else if (estado.ganador === -1) {
    // Empate
    resultado = 20;
  } else {
    // Order non-winners in 4P by distance to goal, then remaining walls, then turn order
    if (n === 2) {
      resultado = 20;
    } else {
      const nonWinners = estado.jugadores
        .filter((p) => p.id !== estado.ganador)
        .sort((a, b) => {
          const da = bfsCamino(a, estado.murosH, estado.murosV).distancia;
          const db = bfsCamino(b, estado.murosH, estado.murosV).distancia;
          if (da !== db) return da - db;
          if (b.muros !== a.muros) return b.muros - a.muros;
          return a.id - b.id;
        });

      const puesto = nonWinners.findIndex((p) => p.id === jugador.id);
      if (puesto === 0) resultado = 60; // 2nd place
      else if (puesto === 1) resultado = 35; // 3rd place
      else resultado = 15; // 4th place
    }
  }

  // 7.2 Bonificaciones
  const ahorrador = esGanador ? jugador.muros * 5 : 0;
  const rapidez = esGanador ? Math.max(0, 40 - stats.acciones) : 0;
  const saltador = Math.min(15, stats.saltos * 3);
  const muroMaestro = Math.min(30, stats.murosMaestros * 10);
  const remontada = esGanador && stats.remontada ? 25 : 0;
  const racha = esGanador ? Math.min(50, rachaActual * 10) : 0;

  const esPartidaLimpia =
    esGanador &&
    stats.usosDeshacer === 0 &&
    stats.usosPista === 0 &&
    stats.intentosMuroInvalido === 0;
  const partidaLimpia = esPartidaLimpia ? 10 : 0;

  // 7.4 Penalizaciones
  const pPistas = stats.usosPista * 5;
  const pDeshacer = stats.usosDeshacer * 10;
  const pMurosInvalidos = Math.min(10, stats.intentosMuroInvalido * 1);
  const pTiempoAgotado = stats.turnosAgotados * 8;
  const pAbandonar = 0; // handled if abandoned

  const totalPenalizaciones = pPistas + pDeshacer + pMurosInvalidos + pTiempoAgotado + pAbandonar;

  // 7.3 Multiplicador por dificultad
  let mult = 1.0;
  const bots = estado.jugadores.filter((p) => p.tipo !== 'humano');
  if (bots.length > 0) {
    const hasDificil = bots.some((b) => b.tipo === 'bot_dificil');
    const hasNormal = bots.some((b) => b.tipo === 'bot_normal');
    if (hasDificil) mult = 1.5;
    else if (hasNormal) mult = 1.0;
    else mult = 0.5; // only fácil
  }

  // Bonus for multiple human rivals in 4P
  const humanRivals = estado.jugadores.filter((p) => p.tipo === 'humano' && p.id !== jugador.id);
  if (n === 4 && humanRivals.length > 1) {
    mult += 0.1;
  }

  const subtotal =
    resultado +
    ahorrador +
    rapidez +
    saltador +
    muroMaestro +
    remontada +
    racha +
    partidaLimpia -
    totalPenalizaciones;

  const total = Math.max(0, Math.round(subtotal * mult));

  return {
    resultado,
    ahorrador,
    rapidez,
    saltador,
    muroMaestro,
    remontada,
    racha,
    partidaLimpia,
    penalizaciones: {
      pistas: pPistas,
      deshacer: pDeshacer,
      murosInvalidos: pMurosInvalidos,
      tiempoAgotado: pTiempoAgotado,
      abandonar: pAbandonar,
      total: totalPenalizaciones,
    },
    multiplicador: mult,
    total,
  };
}
