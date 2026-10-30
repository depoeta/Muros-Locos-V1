/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AchievementDef,
  AppSettings,
  GameState,
  LevelInfo,
  MatchResultRecord,
  RankEntry,
  ScoreBreakdown,
} from '../types/murosLocos';
import { bfsCamino } from './murosLocosEngine';

export const LOGROS_LISTA: AchievementDef[] = [
  { id: 'primera_vez', titulo: 'Primer paso', descripcion: 'Jugar la primera partida', icono: '👣' },
  { id: 'primera_victoria', titulo: '¡Victoria!', descripcion: 'Ganar una partida', icono: '🏆' },
  { id: 'diez_victorias', titulo: 'Imparable', descripcion: '10 victorias conseguidas', icono: '⚡' },
  { id: 'racha_3', titulo: 'En racha', descripcion: '3 victorias seguidas', icono: '🔥' },
  { id: 'racha_7', titulo: 'Intocable', descripcion: '7 victorias seguidas', icono: '👑' },
  { id: 'sin_muros', titulo: 'Corredor puro', descripcion: 'Ganar sin colocar ningún muro', icono: '👟' },
  { id: 'constructor', titulo: 'Constructor', descripcion: 'Colocar 50 muros en total', icono: '🧱' },
  { id: 'saltarin', titulo: 'Saltarín', descripcion: '25 saltos en total', icono: '🦘' },
  { id: 'remontada', titulo: 'De cero a héroe', descripcion: 'Lograr el bono de Remontada', icono: '🏹' },
  { id: 'ultimo_segundo', titulo: 'Por los pelos', descripcion: 'Ganar con el rival a 1 paso de la meta', icono: '⏱️' },
  { id: 'bot_dificil', titulo: 'Domador de robots', descripcion: 'Ganar al Bot Difícil', icono: '🤖' },
  { id: 'partida_limpia', titulo: 'Manos limpias', descripcion: '5 partidas limpias logradas', icono: '✨' },
  { id: 'cuatro_jugadores', titulo: 'Fiesta total', descripcion: 'Ganar una partida de 4 jugadores', icono: '🎉' },
  { id: 'rapido', titulo: 'Rayo', descripcion: 'Ganar en 15 acciones o menos', icono: '⚡' },
  { id: 'maestro_muros', titulo: 'Arquitecto cruel', descripcion: '3 muros maestros en una sola partida', icono: '🏰' },
  { id: 'mil_puntos', titulo: 'Mil y contando', descripcion: 'Llegar a 1.000 puntos totales', icono: '💎' },
];

export type { LevelInfo };

export function obtenerNivelYTitulo(puntos: number): LevelInfo {
  if (puntos < 200) {
    return { nivel: 1, titulo: 'Novato', minPuntos: 0, maxPuntos: 200, icono: '🥚' };
  }
  if (puntos < 600) {
    return { nivel: 2, titulo: 'Aprendiz de muros', minPuntos: 200, maxPuntos: 600, icono: '🐣' };
  }
  if (puntos < 1200) {
    return { nivel: 3, titulo: 'Albañil astuto', minPuntos: 600, maxPuntos: 1200, icono: '🧱' };
  }
  if (puntos < 2400) {
    return { nivel: 4, titulo: 'Explorador del laberinto', minPuntos: 1200, maxPuntos: 2400, icono: '🧭' };
  }
  if (puntos < 4500) {
    return { nivel: 5, titulo: 'Estratega loco', minPuntos: 2400, maxPuntos: 4500, icono: '🧠' };
  }
  if (puntos < 8000) {
    return { nivel: 6, titulo: 'Maestro de los muros', minPuntos: 4500, maxPuntos: 8000, icono: '👑' };
  }
  return { nivel: 7, titulo: 'Leyenda de Muros Locos', minPuntos: 8000, maxPuntos: 15000, icono: '🌟' };
}

// Memory fallback store if localStorage is blocked/unavailable
const memoryStore: Record<string, string> = {};

function safeGet(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return memoryStore[key] || null;
  }
}

function safeSet(key: string, val: string): boolean {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, val);
    }
    return true;
  } catch {
    memoryStore[key] = val;
    return false;
  }
}

const STORAGE_KEY_RANKING = 'muros_locos_ranking_v1';
const STORAGE_KEY_HISTORY = 'muros_locos_historial_v1';
const STORAGE_KEY_SETTINGS = 'muros_locos_settings_v1';

export function cargarAjustes(): AppSettings {
  const def: AppSettings = {
    sonido: true,
    animacionesReducidas: false,
    mostrarDistancia: true,
    permitirDeshacer: true,
    permitirPistas: true,
    modoDaltonico: false,
  };
  const raw = safeGet(STORAGE_KEY_SETTINGS);
  if (!raw) return def;
  try {
    return { ...def, ...JSON.parse(raw) };
  } catch {
    return def;
  }
}

export function guardarAjustes(settings: AppSettings) {
  safeSet(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

export function normalizarRankEntry(raw: Partial<RankEntry>, fallbackName: string): RankEntry {
  return {
    nombre: String(raw.nombre || fallbackName).trim().slice(0, 14),
    puntosTotales: typeof raw.puntosTotales === 'number' ? Math.max(0, raw.puntosTotales) : 0,
    partidas: typeof raw.partidas === 'number' ? Math.max(0, raw.partidas) : 0,
    victorias: typeof raw.victorias === 'number' ? Math.max(0, raw.victorias) : 0,
    derrotas: typeof raw.derrotas === 'number' ? Math.max(0, raw.derrotas) : 0,
    empates: typeof raw.empates === 'number' ? Math.max(0, raw.empates) : 0,
    rachaActual: typeof raw.rachaActual === 'number' ? Math.max(0, raw.rachaActual) : 0,
    mejorRacha: typeof raw.mejorRacha === 'number' ? Math.max(0, raw.mejorRacha) : 0,
    murosColocados: typeof raw.murosColocados === 'number' ? Math.max(0, raw.murosColocados) : 0,
    saltos: typeof raw.saltos === 'number' ? Math.max(0, raw.saltos) : 0,
    mejorPartida: typeof raw.mejorPartida === 'number' ? Math.max(0, raw.mejorPartida) : 0,
    partidaMasRapida: typeof raw.partidaMasRapida === 'number' ? raw.partidaMasRapida : 999,
    partidasLimpias: typeof raw.partidasLimpias === 'number' ? Math.max(0, raw.partidasLimpias) : 0,
    elo: typeof raw.elo === 'number' ? Math.max(100, Math.round(raw.elo)) : 1000,
    fechaUltimaPartida: typeof raw.fechaUltimaPartida === 'string' ? raw.fechaUltimaPartida : new Date().toISOString(),
    logros: Array.isArray(raw.logros) ? raw.logros.filter((x): x is string => typeof x === 'string') : [],
    avatarColor: typeof raw.avatarColor === 'string' ? raw.avatarColor : '#ff6b6b',
    avatarHat: (['corona', 'pompon', 'antena', 'brote'].includes(raw.avatarHat as string)
      ? raw.avatarHat
      : 'corona') as RankEntry['avatarHat'],
  };
}

export function cargarRanking(): Record<string, RankEntry> {
  const raw = safeGet(STORAGE_KEY_RANKING);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const normalized: Record<string, RankEntry> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (val && typeof val === 'object') {
        normalized[key] = normalizarRankEntry(val as Partial<RankEntry>, key);
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

export function guardarRanking(ranking: Record<string, RankEntry>) {
  safeSet(STORAGE_KEY_RANKING, JSON.stringify(ranking));
}

export function cargarHistorial(): MatchResultRecord[] {
  const raw = safeGet(STORAGE_KEY_HISTORY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function guardarHistorial(historial: MatchResultRecord[]) {
  // Keep last 50 matches
  const trimmed = historial.slice(-50);
  safeSet(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
}

// Check and unlock achievements & update stats
export function actualizarDespuesDePartida(
  estado: GameState,
  desgloses: Map<number, ScoreBreakdown>,
  duracionSegundos: number
): {
  nuevosLogrosPorJugador: Map<string, AchievementDef[]>;
  subidasNivelPorJugador: Map<string, { anterior: LevelInfo; nuevo: LevelInfo }>;
  puntosGanadosPorJugador: Map<string, number>;
} {
  const ranking = cargarRanking();
  const historial = cargarHistorial();
  const nuevosLogrosMap = new Map<string, AchievementDef[]>();
  const subidasNivelMap = new Map<string, { anterior: LevelInfo; nuevo: LevelInfo }>();
  const puntosGanadosMap = new Map<string, number>();

  // Determine true 1st..4th places based on goal distance
  const sortedPlayers = [...estado.jugadores].sort((a, b) => {
    if (a.id === estado.ganador) return -1;
    if (b.id === estado.ganador) return 1;
    const da = bfsCamino(a, estado.murosH, estado.murosV).distancia;
    const db = bfsCamino(b, estado.murosH, estado.murosV).distancia;
    if (da !== db) return da - db;
    if (b.muros !== a.muros) return b.muros - a.muros;
    return a.id - b.id;
  });

  const puestoMap = new Map<number, number>();
  sortedPlayers.forEach((p, idx) => {
    puestoMap.set(p.id, idx + 1);
  });

  const matchRecord: MatchResultRecord = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fecha: new Date().toISOString(),
    numJugadores: estado.n,
    ganadorNombre:
      estado.ganador !== null && estado.ganador >= 0
        ? estado.jugadores[estado.ganador].nombre
        : 'Empate',
    duracionSegundos,
    turnosTotales: estado.turnosTotales,
    puntosPorJugador: [],
  };

  for (const j of estado.jugadores) {
    const desglose = desgloses.get(j.id) || { total: 0 };
    const puntos = desglose.total || 0;
    const esGanador = estado.ganador === j.id;
    const puestoReal = puestoMap.get(j.id) || (esGanador ? 1 : 2);

    matchRecord.puntosPorJugador.push({
      nombre: j.nombre,
      color: j.color,
      puntos,
      puesto: puestoReal,
      esHumano: j.tipo === 'humano',
    });

    // Only humans accumulate persistent ranking points, Elo and achievements
    if (j.tipo !== 'humano') continue;

    const key = j.nombre.trim().toLowerCase();
    const entry = ranking[key]
      ? normalizarRankEntry(ranking[key], j.nombre)
      : normalizarRankEntry(
          {
            nombre: j.nombre,
            avatarColor: j.color,
            avatarHat: j.hat,
            elo: 1000,
          },
          j.nombre
        );

    const prevLevel = obtenerNivelYTitulo(entry.puntosTotales);

    entry.partidas++;
    entry.murosColocados += j.estadisticas.murosColocados;
    entry.saltos += j.estadisticas.saltos;
    entry.puntosTotales += puntos;
    entry.fechaUltimaPartida = new Date().toISOString();
    puntosGanadosMap.set(j.nombre, puntos);

    if (puntos > entry.mejorPartida) {
      entry.mejorPartida = puntos;
    }

    if (esGanador) {
      entry.victorias++;
      entry.rachaActual++;
      entry.elo = Math.round(entry.elo + 25);
      if (entry.rachaActual > entry.mejorRacha) {
        entry.mejorRacha = entry.rachaActual;
      }
      if (j.estadisticas.acciones < entry.partidaMasRapida) {
        entry.partidaMasRapida = j.estadisticas.acciones;
      }
    } else if (estado.ganador === -1) {
      entry.empates++;
      entry.rachaActual = 0;
    } else {
      entry.derrotas++;
      entry.rachaActual = 0;
      entry.elo = Math.max(100, Math.round(entry.elo - 15));
    }

    const newLevel = obtenerNivelYTitulo(entry.puntosTotales);
    if (newLevel.nivel > prevLevel.nivel) {
      subidasNivelMap.set(j.nombre, { anterior: prevLevel, nuevo: newLevel });
    }

    // Check achievements
    const newlyUnlocked: AchievementDef[] = [];
    const checkLogro = (id: string, cond: boolean) => {
      if (cond && !entry.logros.includes(id)) {
        entry.logros.push(id);
        const def = LOGROS_LISTA.find((l) => l.id === id);
        if (def) newlyUnlocked.push(def);
      }
    };

    const cualquierRivalA1Paso = estado.jugadores.some(
      (rival) => rival.id !== j.id && bfsCamino(rival, estado.murosH, estado.murosV).distancia === 1
    );

    const esPartidaLimpiaActual =
      esGanador &&
      j.estadisticas.usosDeshacer === 0 &&
      j.estadisticas.usosPista === 0 &&
      j.estadisticas.intentosMuroInvalido === 0 &&
      j.estadisticas.turnosAgotados === 0;

    if (esPartidaLimpiaActual) {
      entry.partidasLimpias = (entry.partidasLimpias || 0) + 1;
    }

    checkLogro('primera_vez', entry.partidas >= 1);
    checkLogro('primera_victoria', entry.victorias >= 1);
    checkLogro('diez_victorias', entry.victorias >= 10);
    checkLogro('racha_3', entry.rachaActual >= 3);
    checkLogro('racha_7', entry.rachaActual >= 7);
    checkLogro('sin_muros', esGanador && j.estadisticas.murosColocados === 0);
    checkLogro('constructor', entry.murosColocados >= 50);
    checkLogro('saltarin', entry.saltos >= 25);
    checkLogro('remontada', esGanador && j.estadisticas.remontada);
    checkLogro('ultimo_segundo', esGanador && cualquierRivalA1Paso);
    checkLogro('bot_dificil', esGanador && estado.jugadores.some((p) => p.tipo === 'bot_dificil'));
    checkLogro('partida_limpia', entry.partidasLimpias >= 5);
    checkLogro('cuatro_jugadores', esGanador && estado.n === 4);
    checkLogro('rapido', esGanador && j.estadisticas.acciones <= 15);
    checkLogro('maestro_muros', j.estadisticas.murosMaestros >= 3);
    checkLogro('mil_puntos', entry.puntosTotales >= 1000);

    if (newlyUnlocked.length > 0) {
      nuevosLogrosMap.set(j.nombre, newlyUnlocked);
    }

    ranking[key] = entry;
  }

  guardarRanking(ranking);
  historial.push(matchRecord);
  guardarHistorial(historial);

  return {
    nuevosLogrosPorJugador: nuevosLogrosMap,
    subidasNivelPorJugador: subidasNivelMap,
    puntosGanadosPorJugador: puntosGanadosMap,
  };
}

export function penalizarAbandono(nombre: string, puntosPerdidos: number = 20): { puntosTotales: number } {
  const ranking = cargarRanking();
  const key = nombre.trim().toLowerCase();
  const entry = ranking[key]
    ? normalizarRankEntry(ranking[key], nombre)
    : normalizarRankEntry({ nombre }, nombre);

  entry.puntosTotales = Math.max(0, entry.puntosTotales - puntosPerdidos);
  entry.derrotas++;
  entry.partidas++;
  entry.rachaActual = 0;
  entry.elo = Math.max(100, entry.elo - 20);
  entry.fechaUltimaPartida = new Date().toISOString();

  ranking[key] = entry;
  guardarRanking(ranking);
  return { puntosTotales: entry.puntosTotales };
}

export function exportarDatosJSON(): string {
  const ranking = cargarRanking();
  const historial = cargarHistorial();
  const settings = cargarAjustes();
  return JSON.stringify({ version: 1, ranking, historial, settings }, null, 2);
}

export function importarDatosJSON(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return false;

    let importedAnything = false;

    if (data.ranking && typeof data.ranking === 'object' && Object.keys(data.ranking).length > 0) {
      const normalized: Record<string, RankEntry> = {};
      for (const [k, v] of Object.entries(data.ranking)) {
        if (v && typeof v === 'object') {
          normalized[k] = normalizarRankEntry(v as Partial<RankEntry>, k);
        }
      }
      if (Object.keys(normalized).length > 0) {
        guardarRanking(normalized);
        importedAnything = true;
      }
    }

    if (Array.isArray(data.historial) && data.historial.length > 0) {
      guardarHistorial(data.historial);
      importedAnything = true;
    }

    if (data.settings && typeof data.settings === 'object') {
      guardarAjustes(data.settings);
      importedAnything = true;
    }

    return importedAnything;
  } catch {
    return false;
  }
}

export function borrarTodosLosDatos() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_RANKING);
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      localStorage.removeItem(STORAGE_KEY_SETTINGS);
    }
  } catch {
    // ignore
  }
  Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
}
