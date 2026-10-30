/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AchievementDef,
  AppSettings,
  GameState,
  HatType,
  LevelInfo,
  MatchResultRecord,
  RankEntry,
  ScoreBreakdown,
  UserAccount,
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
const STORAGE_KEY_RANKING_LOCAL = 'muros_locos_ranking_local_v1';
const STORAGE_KEY_HISTORY = 'muros_locos_historial_v1';
const STORAGE_KEY_SETTINGS = 'muros_locos_settings_v1';

let cloudKvConnected: boolean = false;
let lastCloudSyncTime: number = 0;

export function estaKvConectado(): boolean {
  return cloudKvConnected;
}

export function getApiBaseUrl(endpoint: string): string {
  if (typeof window !== 'undefined') {
    const clean = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const path = window.location.pathname;
    if (path.includes('/app/muro')) {
      return `/app/muro/${clean}`;
    }
    return `/${clean}`;
  }
  return endpoint;
}

export async function sincronizarConNube(forzar: boolean = false): Promise<{
  ok: boolean;
  kvConectado: boolean;
  rankingCount: number;
  cuentasCount: number;
}> {
  const now = Date.now();
  if (!forzar && now - lastCloudSyncTime < 3000) {
    return {
      ok: true,
      kvConectado: cloudKvConnected,
      rankingCount: Object.keys(cargarRanking()).length,
      cuentasCount: Object.keys(cargarCuentas()).length,
    };
  }
  lastCloudSyncTime = now;
  let anyKvActive = false;

  // 1. Sincronizar Ranking global
  try {
    const res = await fetch(getApiBaseUrl('/api/ranking'), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      if (res.headers.get('X-KV-Bound') === 'true') {
        anyKvActive = true;
      }
      const cloudData = await res.json();
      if (cloudData && typeof cloudData === 'object' && !Array.isArray(cloudData)) {
        const local = cargarRanking();
        if (anyKvActive) {
          // Si KV está vacío inicialmente y local tenía entradas, inicializarlo una sola vez si no es forzado
          if (Object.keys(cloudData).length === 0 && Object.keys(local).length > 0 && !forzar) {
            fetch(getApiBaseUrl('/api/ranking'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(local),
            }).catch(() => {});
          } else {
            // Cloudflare KV es la fuente autoritativa: adoptar su estado exactamente
            safeSet(STORAGE_KEY_RANKING, JSON.stringify(cloudData));
          }
        } else {
          // Modo local sin KV
          const merged: Record<string, RankEntry> = { ...local, ...cloudData };
          safeSet(STORAGE_KEY_RANKING, JSON.stringify(merged));
        }
      }
    }
  } catch (err) {
    console.warn('Fallo sincronización ranking:', err);
  }

  // 2. Sincronizar Cuentas globales
  try {
    const res = await fetch(getApiBaseUrl('/api/cuentas'), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      if (res.headers.get('X-KV-Bound') === 'true') {
        anyKvActive = true;
      }
      const cloudAccounts = await res.json();
      if (cloudAccounts && typeof cloudAccounts === 'object' && !Array.isArray(cloudAccounts)) {
        const local = cargarCuentas();
        if (anyKvActive) {
          if (Object.keys(cloudAccounts).length === 0 && Object.keys(local).length > 1 && !forzar) {
            fetch(getApiBaseUrl('/api/cuentas'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(local),
            }).catch(() => {});
          } else {
            const finalAccounts = { ...cloudAccounts };
            if (!finalAccounts['admin']) {
              finalAccounts['admin'] = local['admin'];
            }
            safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(finalAccounts));
          }
        } else {
          const merged: Record<string, UserAccount> = { ...cloudAccounts, ...local };
          if (!merged['admin']) merged['admin'] = local['admin'];
          safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(merged));
        }
      }
    }
  } catch (err) {
    console.warn('Fallo sincronización cuentas:', err);
  }

  cloudKvConnected = anyKvActive;
  return {
    ok: true,
    kvConectado: cloudKvConnected,
    rankingCount: Object.keys(cargarRanking()).length,
    cuentasCount: Object.keys(cargarCuentas()).length,
  };
}

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
  try {
    fetch(getApiBaseUrl('/api/ranking'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ranking),
    }).catch(() => {});
  } catch {}
}

export function cargarRankingLocal(): Record<string, RankEntry> {
  const raw = safeGet(STORAGE_KEY_RANKING_LOCAL);
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

export function guardarRankingLocal(ranking: Record<string, RankEntry>) {
  safeSet(STORAGE_KEY_RANKING_LOCAL, JSON.stringify(ranking));
}

export function borrarRankingLocal() {
  safeSet(STORAGE_KEY_RANKING_LOCAL, JSON.stringify({}));
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
  const rankingLocal = cargarRankingLocal();
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

    if (j.tipo !== 'humano') continue;

    const cleanJName = j.nombre.trim().toLowerCase();

    // Actualizar ranking local (para todas las partidas jugadas en este navegador, invitados o registrados)
    const lKey = cleanJName;
    const lEntry = rankingLocal[lKey]
      ? normalizarRankEntry(rankingLocal[lKey], j.nombre)
      : normalizarRankEntry(
          {
            nombre: j.nombre,
            avatarColor: j.color,
            avatarHat: j.hat,
            elo: 1000,
          },
          j.nombre
        );

    lEntry.partidas++;
    lEntry.murosColocados += j.estadisticas.murosColocados;
    lEntry.saltos += j.estadisticas.saltos;
    lEntry.puntosTotales += puntos;
    lEntry.fechaUltimaPartida = new Date().toISOString();
    if (puntos > lEntry.mejorPartida) lEntry.mejorPartida = puntos;
    if (esGanador) {
      lEntry.victorias++;
      lEntry.rachaActual++;
      lEntry.elo = Math.round(lEntry.elo + 25);
      if (lEntry.rachaActual > lEntry.mejorRacha) lEntry.mejorRacha = lEntry.rachaActual;
      if (j.estadisticas.acciones < lEntry.partidaMasRapida) lEntry.partidaMasRapida = j.estadisticas.acciones;
    } else if (estado.ganador === -1) {
      lEntry.empates++;
      lEntry.rachaActual = 0;
    } else {
      lEntry.derrotas++;
      lEntry.rachaActual = 0;
      lEntry.elo = Math.max(100, Math.round(lEntry.elo - 15));
    }
    rankingLocal[lKey] = lEntry;

    // Solo humanos con perfil registrado acumulan ranking global
    const cuentas = cargarCuentas();
    const matchingAcc = Object.values(cuentas).find(
      (acc) => acc.nombre.trim().toLowerCase() === cleanJName
    );

    // Si el jugador no tiene cuenta registrada, NO entra en el ranking global
    if (!matchingAcc) continue;

    const key = cleanJName;
    const entry = ranking[key]
      ? normalizarRankEntry(ranking[key], j.nombre)
      : normalizarRankEntry(
          {
            nombre: matchingAcc.nombre,
            avatarColor: matchingAcc.avatarColor || j.color,
            avatarHat: matchingAcc.avatarHat || j.hat,
            elo: matchingAcc.elo || 1000,
          },
          matchingAcc.nombre
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

    // Sync with UserAccount
    matchingAcc.puntos = entry.puntosTotales;
    matchingAcc.partidas = entry.partidas;
    matchingAcc.victorias = entry.victorias;
    matchingAcc.elo = entry.elo;
    matchingAcc.ultimaConexion = new Date().toISOString();
    cuentas[matchingAcc.id] = matchingAcc;
    guardarCuentas(cuentas);
    const cur = obtenerUsuarioActual();
    if (cur && cur.id === matchingAcc.id) {
      guardarUsuarioActual(matchingAcc);
    }
  }

  guardarRankingLocal(rankingLocal);
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
      localStorage.removeItem(STORAGE_KEY_ACCOUNTS);
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }
  } catch {
    // ignore
  }
  Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
}

// =========================================================================
// CUENTAS DE USUARIO Y PANEL DE ADMINISTRADOR SECRETO
// =========================================================================
export const STORAGE_KEY_ACCOUNTS = 'muros_locos_accounts_v1';
export const STORAGE_KEY_CURRENT_USER = 'muros_locos_current_user_v1';

export function cargarCuentas(): Record<string, UserAccount> {
  const raw = safeGet(STORAGE_KEY_ACCOUNTS);
  let accounts: Record<string, UserAccount> = {};
  if (raw) {
    try {
      accounts = JSON.parse(raw);
    } catch {}
  }

  // Usuario Admin Secreto predeterminado (para gestionar otros perfiles y ranking)
  if (!accounts['admin']) {
    accounts['admin'] = {
      id: 'admin',
      nombre: 'Admin Supremo',
      clave: 'muros2026',
      rol: 'admin',
      avatarColor: '#ffd43b',
      avatarHat: 'corona',
      puntos: 9999,
      partidas: 100,
      victorias: 99,
      elo: 2500,
      creadoEn: new Date().toISOString(),
      ultimaConexion: new Date().toISOString(),
    };
    safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
  }
  return accounts;
}

export function guardarCuentas(cuentas: Record<string, UserAccount>) {
  safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));
  try {
    fetch(getApiBaseUrl('/api/cuentas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuentas),
    }).catch(() => {});
  } catch {}
}

export function obtenerUsuarioActual(): UserAccount | null {
  const raw = safeGet(STORAGE_KEY_CURRENT_USER);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const accounts = cargarCuentas();
    return accounts[parsed.id] || parsed;
  } catch {
    return null;
  }
}

export function guardarUsuarioActual(user: UserAccount | null) {
  if (!user) {
    try {
      if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    } catch {}
    delete memoryStore[STORAGE_KEY_CURRENT_USER];
  } else {
    safeSet(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
  }
}

export function iniciarSesion(
  nombre: string,
  clave: string
): { ok: boolean; error?: string; user?: UserAccount } {
  const cuentas = cargarCuentas();
  const search = nombre.trim().toLowerCase();

  const entry = Object.values(cuentas).find(
    (acc) => acc.nombre.trim().toLowerCase() === search || acc.id.toLowerCase() === search
  );

  if (!entry) {
    return { ok: false, error: 'Usuario no encontrado. Crea un perfil con ese nombre.' };
  }

  if (entry.clave !== clave.trim()) {
    return { ok: false, error: 'Clave incorrecta.' };
  }

  entry.ultimaConexion = new Date().toISOString();
  cuentas[entry.id] = entry;
  guardarCuentas(cuentas);
  guardarUsuarioActual(entry);

  return { ok: true, user: entry };
}

export async function iniciarSesionAsync(
  nombre: string,
  clave: string
): Promise<{ ok: boolean; error?: string; user?: UserAccount }> {
  const localAttempt = iniciarSesion(nombre, clave);
  if (localAttempt.ok) return localAttempt;

  // Si no se encuentra localmente, sincronizamos con la nube Cloudflare KV
  await sincronizarConNube(true);
  return iniciarSesion(nombre, clave);
}

export function registrarUsuario(
  nombre: string,
  clave: string,
  avatarColor: string,
  avatarHat: HatType
): { ok: boolean; error?: string; user?: UserAccount } {
  const cleanName = nombre.trim();
  if (cleanName.length < 3 || cleanName.length > 15) {
    return { ok: false, error: 'El nombre debe tener entre 3 y 15 caracteres.' };
  }
  const validChars = /^[a-zA-Z0-9_ñÑáéíóúÁÉÍÓÚ\s]+$/;
  if (!validChars.test(cleanName)) {
    return { ok: false, error: 'El nombre solo puede contener letras, números y espacios.' };
  }
  if (clave.trim().length < 3) {
    return { ok: false, error: 'La clave debe tener al menos 3 caracteres.' };
  }

  const cuentas = cargarCuentas();
  const search = cleanName.toLowerCase();

  if (search === 'admin' || search === 'administrador') {
    return { ok: false, error: 'Ese nombre está reservado para la administración.' };
  }

  const ranking = cargarRanking();
  const existe =
    Object.values(cuentas).some(
      (acc) => acc.nombre.trim().toLowerCase() === search || acc.id.toLowerCase() === search
    ) || Boolean(ranking[search]);

  if (existe) {
    return { ok: false, error: 'Ese nombre de usuario ya está registrado. Por favor elige otro o inicia sesión.' };
  }

  // Generar ID único, limpio y fácil de identificar (ej: ML-782415)
  const id = `ML-${Math.floor(100000 + Math.random() * 900000)}`;
  const newUser: UserAccount = {
    id,
    nombre: cleanName.slice(0, 15),
    clave: clave.trim(),
    rol: 'jugador',
    avatarColor,
    avatarHat,
    puntos: 100,
    partidas: 0,
    victorias: 0,
    elo: 1000,
    creadoEn: new Date().toISOString(),
    ultimaConexion: new Date().toISOString(),
  };

  cuentas[id] = newUser;
  guardarCuentas(cuentas);
  guardarUsuarioActual(newUser);

  // Sync to ranking
  ranking[cleanName.toLowerCase()] = normalizarRankEntry(
    {
      nombre: cleanName,
      puntosTotales: 100,
      partidas: 0,
      victorias: 0,
      elo: 1000,
      avatarColor,
      avatarHat,
    },
    cleanName
  );
  guardarRanking(ranking);

  return { ok: true, user: newUser };
}

export async function registrarUsuarioAsync(
  nombre: string,
  clave: string,
  avatarColor: string,
  avatarHat: HatType
): Promise<{ ok: boolean; error?: string; user?: UserAccount }> {
  await sincronizarConNube(true);
  return registrarUsuario(nombre, clave, avatarColor, avatarHat);
}

export function cerrarSesion() {
  guardarUsuarioActual(null);
}

export function adminActualizarUsuario(
  id: string,
  patch: Partial<UserAccount>
): boolean {
  if (id === 'admin') return false; // El usuario supremo 'admin' es intocable
  const cuentas = cargarCuentas();
  if (!cuentas[id]) return false;

  // Validar nombre si se edita
  if (patch.nombre) {
    const cleanNew = patch.nombre.trim();
    if (cleanNew.length < 3 || cleanNew.length > 15) return false;
    const validChars = /^[a-zA-Z0-9_ñÑáéíóúÁÉÍÓÚ\s]+$/;
    if (!validChars.test(cleanNew)) return false;
    if (cleanNew.toLowerCase() === 'admin' || cleanNew.toLowerCase() === 'administrador') return false;
    const isTaken = Object.values(cuentas).some(
      (acc) => acc.id !== id && acc.nombre.trim().toLowerCase() === cleanNew.toLowerCase()
    );
    if (isTaken) return false;
  }

  const current = cuentas[id];
  const oldName = current.nombre.trim().toLowerCase();

  cuentas[id] = { ...current, ...patch };
  guardarCuentas(cuentas);

  const ranking = cargarRanking();
  const newName = (patch.nombre || current.nombre).trim().toLowerCase();

  // Limpiar cualquier entrada antigua en el ranking
  if (oldName !== newName) {
    delete ranking[oldName];
    for (const key of Object.keys(ranking)) {
      if (ranking[key].nombre.trim().toLowerCase() === oldName) {
        delete ranking[key];
      }
    }
  }

  // Actualizar o crear entrada en el ranking con los datos nuevos
  const targetName = patch.nombre || current.nombre;
  const existingRank = ranking[newName] || normalizarRankEntry({ nombre: targetName }, targetName);

  ranking[newName] = {
    ...existingRank,
    nombre: targetName,
    puntosTotales: patch.puntos !== undefined ? patch.puntos : existingRank.puntosTotales,
    elo: patch.elo !== undefined ? patch.elo : existingRank.elo,
    victorias: patch.victorias !== undefined ? patch.victorias : existingRank.victorias,
    partidas: patch.partidas !== undefined ? patch.partidas : existingRank.partidas,
    avatarColor: patch.avatarColor || current.avatarColor || existingRank.avatarColor,
    avatarHat: patch.avatarHat || current.avatarHat || existingRank.avatarHat,
  };

  guardarRanking(ranking);

  const cur = obtenerUsuarioActual();
  if (cur && cur.id === id) {
    guardarUsuarioActual(cuentas[id]);
  }

  return true;
}

export function adminEliminarUsuario(id: string): boolean {
  if (id === 'admin') return false; // Usuario supremo intocable
  const cuentas = cargarCuentas();
  if (!cuentas[id]) return false;

  const targetName = cuentas[id].nombre.trim().toLowerCase();
  delete cuentas[id];
  guardarCuentas(cuentas);

  // Borrar del ranking cualquier rastro del usuario
  const ranking = cargarRanking();
  delete ranking[targetName];
  delete ranking[id.toLowerCase()];
  for (const key of Object.keys(ranking)) {
    if (
      ranking[key].nombre.trim().toLowerCase() === targetName ||
      key.toLowerCase() === targetName ||
      key.toLowerCase() === id.toLowerCase()
    ) {
      delete ranking[key];
    }
  }
  guardarRanking(ranking);

  const cur = obtenerUsuarioActual();
  if (cur && cur.id === id) {
    guardarUsuarioActual(null);
  }

  return true;
}

export function adminResetearRanking(): boolean {
  // Limpia el ranking a cero y resetea puntuaciones acumuladas en las cuentas
  const rankingVacio: Record<string, RankEntry> = {};
  safeSet(STORAGE_KEY_RANKING, JSON.stringify(rankingVacio));
  fetch(getApiBaseUrl('/api/ranking'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rankingVacio),
  }).catch(() => {});

  const cuentas = cargarCuentas();
  for (const [id, acc] of Object.entries(cuentas)) {
    if (id !== 'admin') {
      cuentas[id] = {
        ...acc,
        puntos: 0,
        partidas: 0,
        victorias: 0,
        elo: 1000,
      };
    }
  }
  guardarCuentas(cuentas);
  return true;
}

export async function adminActualizarUsuarioAsync(
  id: string,
  patch: Partial<UserAccount>
): Promise<boolean> {
  const ok = adminActualizarUsuario(id, patch);
  if (!ok) return false;
  const cuentas = cargarCuentas();
  const ranking = cargarRanking();
  try {
    await Promise.all([
      fetch(getApiBaseUrl('/api/cuentas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuentas),
      }),
      fetch(getApiBaseUrl('/api/ranking'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ranking),
      }),
    ]);
  } catch (err) {
    console.error('Error actualizando en la nube:', err);
  }
  return true;
}

export async function adminEliminarUsuarioAsync(id: string): Promise<boolean> {
  const ok = adminEliminarUsuario(id);
  if (!ok) return false;
  const cuentas = cargarCuentas();
  const ranking = cargarRanking();
  try {
    await Promise.all([
      fetch(getApiBaseUrl('/api/cuentas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuentas),
      }),
      fetch(getApiBaseUrl('/api/ranking'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ranking),
      }),
    ]);
  } catch (err) {
    console.error('Error eliminando en la nube:', err);
  }
  return true;
}

export async function darDeBajaUsuarioAsync(id: string): Promise<boolean> {
  if (id === 'admin') return false; // Supreme admin is untouchable
  const ok = await adminEliminarUsuarioAsync(id);
  cerrarSesion();
  return ok;
}

export async function adminResetearRankingAsync(): Promise<boolean> {
  adminResetearRanking();
  const ranking = cargarRanking();
  const cuentas = cargarCuentas();
  try {
    await Promise.all([
      fetch(getApiBaseUrl('/api/ranking'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ranking),
      }),
      fetch(getApiBaseUrl('/api/cuentas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuentas),
      }),
    ]);
  } catch (err) {
    console.error('Error reseteando en la nube:', err);
  }
  return true;
}

export function verificarCambiosUsuario(usuarioActual: UserAccount | null): {
  cambiado: boolean;
  eliminado: boolean;
  usuarioActualizado?: UserAccount;
  mensaje?: string;
} {
  if (!usuarioActual) return { cambiado: false, eliminado: false };
  const cuentas = cargarCuentas();
  const cuentaFresca = cuentas[usuarioActual.id];

  // Si la cuenta ya no existe en las cuentas
  if (!cuentaFresca) {
    return {
      cambiado: true,
      eliminado: true,
      mensaje: '⚠️ Tu cuenta ha sido eliminada por el administrador. Has sido desconectado.',
    };
  }

  // Detectar cambios relevantes
  if (cuentaFresca.rol !== usuarioActual.rol) {
    const esAdmin = cuentaFresca.rol === 'admin';
    return {
      cambiado: true,
      eliminado: false,
      usuarioActualizado: cuentaFresca,
      mensaje: esAdmin
        ? '👑 ¡Felicidades! Un administrador te ha otorgado permisos de Administrador.'
        : 'ℹ️ Tus permisos de Administrador han sido revocados.',
    };
  }

  if (cuentaFresca.clave !== usuarioActual.clave) {
    return {
      cambiado: true,
      eliminado: false,
      usuarioActualizado: cuentaFresca,
      mensaje: `🔐 Tu clave de acceso fue modificada por el administrador. Nueva clave: "${cuentaFresca.clave}".`,
    };
  }

  if (cuentaFresca.nombre !== usuarioActual.nombre) {
    return {
      cambiado: true,
      eliminado: false,
      usuarioActualizado: cuentaFresca,
      mensaje: `📢 Tu nombre de usuario fue actualizado a "${cuentaFresca.nombre}".`,
    };
  }

  if (cuentaFresca.puntos !== usuarioActual.puntos || cuentaFresca.victorias !== usuarioActual.victorias) {
    return {
      cambiado: true,
      eliminado: false,
      usuarioActualizado: cuentaFresca,
      mensaje: `⚡ Tus puntos de ranking fueron actualizados por el administrador (${cuentaFresca.puntos} pts).`,
    };
  }

  return { cambiado: false, eliminado: false };
}
