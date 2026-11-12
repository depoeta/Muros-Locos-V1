/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AchievementDef,
  AppSettings,
  BoardTheme,
  GameState,
  HatType,
  LevelInfo,
  MatchResultRecord,
  PERSONAJES_REGISTRO,
  PersonajeColeccionable,
  RankEntry,
  SalaPersonalizada,
  ScoreBreakdown,
  SolicitudResetRanking,
  UserAccount,
  WeeklyBoardData,
  WeeklyPlayerEntry,
  WeeklyRankingResponse,
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
  { id: 'mil_puntos', titulo: 'Centenario de élite', descripcion: 'Llegar a 250 puntos totales', icono: '💎' },
];

export type { LevelInfo };

export function obtenerNivelYTitulo(puntos: number): LevelInfo {
  if (puntos < 20) {
    return { nivel: 1, titulo: 'Novato', minPuntos: 0, maxPuntos: 20, icono: '🥚' };
  }
  if (puntos < 50) {
    return { nivel: 2, titulo: 'Aprendiz de muros', minPuntos: 20, maxPuntos: 50, icono: '🐣' };
  }
  if (puntos < 100) {
    return { nivel: 3, titulo: 'Albañil astuto', minPuntos: 50, maxPuntos: 100, icono: '🧱' };
  }
  if (puntos < 180) {
    return { nivel: 4, titulo: 'Explorador del laberinto', minPuntos: 100, maxPuntos: 180, icono: '🧭' };
  }
  if (puntos < 300) {
    return { nivel: 5, titulo: 'Estratega loco', minPuntos: 180, maxPuntos: 300, icono: '🧠' };
  }
  if (puntos < 500) {
    return { nivel: 6, titulo: 'Maestro de los muros', minPuntos: 300, maxPuntos: 500, icono: '👑' };
  }
  return { nivel: 7, titulo: 'Leyenda de Muros Locos', minPuntos: 500, maxPuntos: 1000, icono: '🌟' };
}

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

function safeRemove(key: string) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {}
  delete memoryStore[key];
}

const STORAGE_KEY_RANKING = 'muros_locos_ranking_v1';
const STORAGE_KEY_RANKING_LOCAL = 'muros_locos_ranking_local_v1';
const STORAGE_KEY_HISTORY = 'muros_locos_historial_v1';
const STORAGE_KEY_SETTINGS = 'muros_locos_settings_v1';
export const STORAGE_KEY_ACCOUNTS = 'muros_locos_accounts_v1';
export const STORAGE_KEY_CURRENT_USER = 'muros_locos_current_user_v1';
const STORAGE_KEY_SUPREME_TOKEN = 'muros_locos_supreme_token_v1';
const STORAGE_KEY_SEMANAL = 'muros_locos_semanal_v1';

let cloudDbConectado: boolean = false;
let lastCloudSyncTime: number = 0;

export type NetworkDiagnostic = {
  checkedOnce: boolean;
  isOnline: boolean;
  dbConectado: boolean;
  serverPingMs: number;
  lastPingTime: number;
  lastError: string | null;
  salasCount: number;
  cuentasCount: number;
};

let currentDiagnostic: NetworkDiagnostic = {
  checkedOnce: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  dbConectado: true,
  serverPingMs: 0,
  lastPingTime: Date.now(),
  lastError: null,
  salasCount: 0,
  cuentasCount: 0,
};

const diagnosticListeners = new Set<(d: NetworkDiagnostic) => void>();
let lastKnownDbUpdate: number = 0;
let pingIntervalId: any = null;

export function obtenerDiagnosticoRed(): NetworkDiagnostic {
  return { ...currentDiagnostic };
}

export function suscribirDiagnostico(cb: (d: NetworkDiagnostic) => void): () => void {
  diagnosticListeners.add(cb);
  cb({ ...currentDiagnostic });
  return () => {
    diagnosticListeners.delete(cb);
  };
}

export function reportarDiagnostico(diag: Partial<NetworkDiagnostic>) {
  currentDiagnostic = { ...currentDiagnostic, ...diag };
  diagnosticListeners.forEach((l) => {
    try {
      l({ ...currentDiagnostic });
    } catch {}
  });
}

export function getApiBaseUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    const base = envUrl.trim().replace(/\/+$/, '');
    return `${base}/${clean}`;
  }
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.includes('/app/muro')) {
      return `/app/muro/${clean}`;
    }
    return `/${clean}`;
  }
  return endpoint;
}

let inFlightPingPromise: Promise<NetworkDiagnostic> | null = null;

export async function pingServidor(): Promise<NetworkDiagnostic> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    cloudDbConectado = false;
    reportarDiagnostico({
      checkedOnce: true,
      isOnline: false,
      dbConectado: false,
      lastError: 'Sin conexión a internet (modo sin conexión)',
    });
    return obtenerDiagnosticoRed();
  }

  if (inFlightPingPromise) return inFlightPingPromise;

  inFlightPingPromise = (async () => {
    const startTime = Date.now();
    try {
      const res = await fetch(getApiBaseUrl('/api/ping'), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const pingMs = Math.max(1, Date.now() - startTime);
        const data = await res.json();
        const isDb =
          res.headers.get('X-DB-Bound') === 'true' ||
          res.headers.get('X-Database-Bound') === 'true' ||
          Boolean(data.dbBound || data.d1Bound);
        cloudDbConectado = isDb;

        reportarDiagnostico({
          checkedOnce: true,
          isOnline: true,
          dbConectado: isDb,
          serverPingMs: pingMs,
          lastPingTime: Date.now(),
          lastError: isDb ? null : data.warning || 'Database (D1) no vinculada',
          salasCount: data.salasCount || 0,
          cuentasCount: data.cuentasCount || 0,
        });

        if (isDb && data.lastUpdate && data.lastUpdate !== lastKnownDbUpdate) {
          lastKnownDbUpdate = data.lastUpdate;
          await sincronizarConNube(true);
        }
      } else {
        cloudDbConectado = false;
        reportarDiagnostico({
          checkedOnce: true,
          isOnline: false,
          dbConectado: false,
          lastError: !contentType.includes('application/json')
            ? 'API / Worker de Database no detectado en esta ruta'
            : `Servidor HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      cloudDbConectado = false;
      reportarDiagnostico({
        checkedOnce: true,
        isOnline: false,
        dbConectado: false,
        lastError: err?.message || 'Sin conexión con el servidor / Database (D1)',
      });
    } finally {
      inFlightPingPromise = null;
    }
    return obtenerDiagnosticoRed();
  })();

  return inFlightPingPromise;
}

let networkEventsBound = false;

export function iniciarHeartbeatGlobal() {
  if (typeof window === 'undefined' || networkEventsBound) return;
  networkEventsBound = true;

  window.addEventListener('online', async () => {
    // Reconexión automática al detectar internet / wifi: sincroniza por sí solo sin pedir acción al usuario
    try {
      const diag = await pingServidor();
      if (diag.dbConectado) {
        await sincronizarConNube(true);
      }
    } catch {}
  });

  window.addEventListener('offline', () => {
    cloudDbConectado = false;
    reportarDiagnostico({
      checkedOnce: true,
      isOnline: false,
      dbConectado: false,
      lastError: 'Sin conexión a internet (modo sin conexión)',
    });
  });
}

if (typeof window !== 'undefined') {
  iniciarHeartbeatGlobal();
}

export function estaDatabaseConectada(): boolean {
  return cloudDbConectado;
}

export const STORAGE_KEY_AUTH_TOKEN = 'muros_locos_auth_token';

export function guardarTokenSesion(token: string | null) {
  if (!token) {
    safeRemove(STORAGE_KEY_AUTH_TOKEN);
  } else {
    safeSet(STORAGE_KEY_AUTH_TOKEN, token);
  }
}

export function obtenerTokenSesion(): string {
  return safeGet(STORAGE_KEY_AUTH_TOKEN) || '';
}

export function guardarTokenAdminSupremo(creds: { user: string; token: string } | null) {
  if (!creds) {
    safeRemove(STORAGE_KEY_SUPREME_TOKEN);
  } else {
    safeSet(STORAGE_KEY_SUPREME_TOKEN, JSON.stringify(creds));
  }
}

export function obtenerTokenAdminSupremo(): { user: string; token: string } | null {
  const raw = safeGet(STORAGE_KEY_SUPREME_TOKEN);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.user && parsed.token) return parsed;
  } catch {}
  return null;
}

interface DatabaseWriteOptions {
  asAdmin?: boolean;
  selfDelete?: { id: string; clave: string };
  registerId?: string;
}

async function enviarJsonADatabase(
  endpoint: string,
  payload: unknown,
  options?: DatabaseWriteOptions
): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const authToken = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (options?.asAdmin) {
      if (cur?.id === 'admin' && sup) {
        headers['X-Admin-User'] = sup.user;
        headers['X-Admin-Token'] = sup.token;
      } else if (cur && cur.id !== 'admin') {
        headers['X-Admin-Id'] = cur.id;
      }
    }

    if (options?.selfDelete) {
      headers['X-Self-Delete-Id'] = options.selfDelete.id;
      headers['X-Self-Delete-Key'] = options.selfDelete.clave;
    }

    if (options?.registerId) {
      headers['X-Register-Id'] = options.registerId;
    }

    const res = await fetch(getApiBaseUrl(endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const isBound =
      res.headers.get('X-DB-Bound') === 'true' ||
      res.headers.get('X-Database-Bound') === 'true';

    if (res.status === 403 && isBound) {
      cloudDbConectado = true;
      reportarDiagnostico({ checkedOnce: true, isOnline: true, dbConectado: true, lastError: null });
      await sincronizarConNube(true);
      return false;
    }

    if (res.ok && isBound) {
      cloudDbConectado = true;
      reportarDiagnostico({ checkedOnce: true, isOnline: true, dbConectado: true, lastError: null });
      return true;
    }
    cloudDbConectado = false;
    reportarDiagnostico({
      checkedOnce: true,
      dbConectado: false,
      lastError: 'No se pudo guardar en la Database (D1 desconectada)',
    });
    return false;
  } catch {
    cloudDbConectado = false;
    reportarDiagnostico({
      checkedOnce: true,
      isOnline: false,
      dbConectado: false,
      lastError: 'Error de red al enviar cambios a la Database (D1)',
    });
    return false;
  }
}

type CloudChangeListener = (data: {
  cuentas: Record<string, UserAccount>;
  ranking: Record<string, RankEntry>;
}) => void;
const cloudChangeListeners = new Set<CloudChangeListener>();

export function suscribirCambiosNube(listener: CloudChangeListener): () => void {
  cloudChangeListeners.add(listener);
  return () => {
    cloudChangeListeners.delete(listener);
  };
}

function reconciliarYNotificarNube() {
  const cuentas = cargarCuentas();
  const ranking = cargarRanking();

  const current = obtenerUsuarioActual();
  if (current) {
    const updated = cuentas[current.id];
    if (!updated) {
      if (current.id !== 'admin') {
        cerrarSesion();
      }
    } else {
      const inventarioCambiado =
        JSON.stringify(updated.inventario || {}) !== JSON.stringify(current.inventario || {});
      const ropaCambiada =
        updated.avatarRopa !== current.avatarRopa || updated.avatarRopaColor !== current.avatarRopaColor;
      const auraCambiada = updated.avatarAura !== current.avatarAura;
      const aspectoCambiado =
        updated.avatarHat !== current.avatarHat || updated.avatarColor !== current.avatarColor;
      const statsCambiadas =
        updated.rol !== current.rol ||
        updated.puntos !== current.puntos ||
        updated.victorias !== current.victorias ||
        updated.nombre !== current.nombre ||
        updated.temaTablero !== current.temaTablero;

      if (inventarioCambiado || ropaCambiada || auraCambiada || aspectoCambiado || statsCambiadas) {
        const merged: UserAccount = {
          ...current,
          ...updated,
          id: current.id,
          esSupremo: current.id === 'admin' ? true : updated.esSupremo,
          rol: current.id === 'admin' ? 'dev' : updated.rol,
          clave: current.id === 'admin' ? '***SUPREMO***' : (current.clave || updated.clave),
        };
        guardarUsuarioActual(merged);
      }
    }
  }

  cloudChangeListeners.forEach((l) => {
    try {
      l({ cuentas, ranking });
    } catch (err) {
      console.error('Error in cloud change listener:', err);
    }
  });
}

let inFlightSyncPromise: Promise<{
  ok: boolean;
  dbConectado: boolean;
  rankingCount: number;
  cuentasCount: number;
}> | null = null;

export async function sincronizarConNube(forzar: boolean = false): Promise<{
  ok: boolean;
  dbConectado: boolean;
  rankingCount: number;
  cuentasCount: number;
}> {
  if (inFlightSyncPromise) return inFlightSyncPromise;

  const now = Date.now();
  if (!forzar && now - lastCloudSyncTime < 10000) {
    return {
      ok: cloudDbConectado,
      dbConectado: cloudDbConectado,
      rankingCount: Object.keys(cargarRanking()).length,
      cuentasCount: Object.keys(cargarCuentas()).length,
    };
  }

  inFlightSyncPromise = (async () => {
    try {
      lastCloudSyncTime = Date.now();
      let dbRankingOk = false;
      let dbCuentasOk = false;

      await Promise.all([
        (async () => {
          try {
            const res = await fetch(getApiBaseUrl('/api/ranking'), {
              method: 'GET',
              headers: { Accept: 'application/json' },
              cache: 'no-store',
            });
            const ct = res.headers.get('content-type') || '';
            if (res.ok && ct.includes('application/json')) {
              const isBound =
                res.headers.get('X-DB-Bound') === 'true' ||
                res.headers.get('X-Database-Bound') === 'true';
              if (isBound) dbRankingOk = true;
              const cloudData = await res.json();
              if (cloudData && typeof cloudData === 'object' && !Array.isArray(cloudData) && isBound) {
                safeSet(STORAGE_KEY_RANKING, JSON.stringify(cloudData));
              }
            }
          } catch (err) {
            console.warn('Fallo sincronización ranking:', err);
          }
        })(),
        (async () => {
          try {
            const res = await fetch(getApiBaseUrl('/api/cuentas'), {
              method: 'GET',
              headers: { Accept: 'application/json' },
              cache: 'no-store',
            });
            const ct = res.headers.get('content-type') || '';
            if (res.ok && ct.includes('application/json')) {
              const isBound =
                res.headers.get('X-DB-Bound') === 'true' ||
                res.headers.get('X-Database-Bound') === 'true';
              if (isBound) dbCuentasOk = true;
              const cloudAccounts = await res.json();
              if (
                cloudAccounts &&
                typeof cloudAccounts === 'object' &&
                !Array.isArray(cloudAccounts) &&
                isBound
              ) {
                safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cloudAccounts));
              }
            }
          } catch (err) {
            console.warn('Fallo sincronización cuentas:', err);
          }
        })(),
      ]);

      const anyDbActive = dbRankingOk || dbCuentasOk;
      cloudDbConectado = anyDbActive;
      reportarDiagnostico({
        checkedOnce: true,
        dbConectado: anyDbActive,
        isOnline: anyDbActive ? true : currentDiagnostic.isOnline,
        lastError: anyDbActive ? null : 'Sin conexión activa a la Database',
      });

      if (anyDbActive) {
        reconciliarYNotificarNube();
      }

      return {
        ok: anyDbActive,
        dbConectado: cloudDbConectado,
        rankingCount: Object.keys(cargarRanking()).length,
        cuentasCount: Object.keys(cargarCuentas()).length,
      };
    } finally {
      inFlightSyncPromise = null;
    }
  })();

  return inFlightSyncPromise;
}

export function iniciarEscuchaNube(intervaloMs: number = 90000): () => void {
  let isChecking = false;
  let initialSynced = false;

  const verificar = async () => {
    // Pausar peticiones si no hay conexión a internet o la pestaña está en segundo plano
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    if (isChecking) return;
    isChecking = true;
    try {
      const prevTs = lastKnownDbUpdate;
      const diag = await pingServidor();
      if (!diag.dbConectado) return;

      // pingServidor() solo descarga cuentas/ranking cuando lastUpdate cambia en Database (D1);
      // forzamos únicamente la primera sincronización inicial al abrir la página.
      if (!initialSynced || (prevTs === 0 && lastKnownDbUpdate === 0)) {
        initialSynced = true;
        await sincronizarConNube(true);
      }
    } catch {
      // ignore transient network errors
    } finally {
      isChecking = false;
    }
  };

  if (pingIntervalId) clearInterval(pingIntervalId);
  pingIntervalId = setInterval(verificar, intervaloMs);

  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      verificar();
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  verificar();
  return () => {
    if (pingIntervalId) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
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
    cambiarVistaPorTurno: false,
    vistaPropiaOnline: true,
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
  const validHat = PERSONAJES_REGISTRO.some((p) => p.id === raw.avatarHat)
    ? (raw.avatarHat as HatType)
    : 'corona';

  return {
    nombre: String(raw.nombre || fallbackName).trim().slice(0, 15),
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
    fechaUltimaPartida:
      typeof raw.fechaUltimaPartida === 'string' ? raw.fechaUltimaPartida : new Date().toISOString(),
    logros: Array.isArray(raw.logros) ? raw.logros.filter((x): x is string => typeof x === 'string') : [],
    avatarColor: typeof raw.avatarColor === 'string' ? raw.avatarColor : '#ff6b6b',
    avatarHat: validHat,
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
  enviarJsonADatabase('/api/ranking', ranking);
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

export function actualizarNombreInvitadoLocal(nombreAntiguo: string, nombreNuevo: string): void {
  const cleanOld = nombreAntiguo.trim().toLowerCase();
  const cleanNew = nombreNuevo.trim().toLowerCase();
  if (!cleanNew || cleanOld === cleanNew) return;
  const local = cargarRankingLocal();
  if (local[cleanOld]) {
    const entry = local[cleanOld];
    entry.nombre = nombreNuevo.trim().slice(0, 15);
    local[cleanNew] = entry;
    delete local[cleanOld];
    guardarRankingLocal(local);
  }
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
  const trimmed = historial.slice(-50);
  safeSet(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
}

function getClientWeekInfo(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const utcDay = d.getUTCDay();
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const mondayUtc = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + diffToMonday,
    0,
    0,
    0,
    0
  );
  const lastMondayUtc = mondayUtc - 7 * 86400000;
  const nextMondayUtc = mondayUtc + 7 * 86400000;
  return {
    mondayUtc,
    lastMondayUtc,
    nextMondayUtc,
    cierraEnMs: Math.max(0, nextMondayUtc - nowMs),
    semanaActualId: new Date(mondayUtc).toISOString().slice(0, 10),
    semanaPasadaId: new Date(lastMondayUtc).toISOString().slice(0, 10),
  };
}

function construirRankingSemanalFallback(): WeeklyRankingResponse {
  const w = getClientWeekInfo();
  const cuentas = cargarCuentas();
  const ranking = cargarRanking();

  const buildRangeBoard = (semanaId: string, startMs: number, endMs: number): WeeklyBoardData => {
    const jugadores: Record<string, WeeklyPlayerEntry> = {};
    for (const acc of Object.values(cuentas)) {
      if (!acc || !Array.isArray(acc.historialPartidas)) continue;
      const key = acc.nombre.trim().toLowerCase();
      for (const h of acc.historialPartidas) {
        const t = new Date(h.fecha).getTime();
        if (isNaN(t) || t < startMs || t >= endMs) continue;
        const cur = jugadores[key] || {
          nombre: acc.nombre,
          avatarColor: acc.avatarColor || '#ff6b6b',
          avatarHat: acc.avatarHat || 'corona',
          puntos: 0,
          partidas: 0,
          victorias: 0,
          elo: ranking[key]?.elo || acc.elo || 1000,
          partidasIds: [],
        };
        if (cur.partidasIds && cur.partidasIds.includes(h.id)) continue;
        cur.puntos += Math.max(0, Number(h.puntos) || 0);
        cur.partidas += 1;
        if (h.resultado === 'victoria') cur.victorias += 1;
        cur.partidasIds?.push(h.id);
        jugadores[key] = cur;
      }
    }
    return { semanaId, jugadores };
  };

  try {
    const cachedRaw = safeGet(STORAGE_KEY_SEMANAL);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as WeeklyRankingResponse;
      if (cached && cached.semanaActualId === w.semanaActualId) {
        return { ...cached, cierraEnMs: w.cierraEnMs };
      }
    }
  } catch {}

  return {
    ok: false,
    d1Bound: false,
    semanaActualId: w.semanaActualId,
    semanaPasadaId: w.semanaPasadaId,
    cierraEnMs: w.cierraEnMs,
    actual: buildRangeBoard(w.semanaActualId, w.mondayUtc, w.nextMondayUtc),
    pasada: buildRangeBoard(w.semanaPasadaId, w.lastMondayUtc, w.mondayUtc),
  };
}

export async function obtenerRankingSemanalAsync(): Promise<WeeklyRankingResponse> {
  try {
    const res = await fetch(getApiBaseUrl('/api/semanal'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = (await res.json()) as WeeklyRankingResponse;
      if (data && data.actual && data.pasada) {
        safeSet(STORAGE_KEY_SEMANAL, JSON.stringify(data));
        return data;
      }
    }
  } catch {}
  return construirRankingSemanalFallback();
}

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

  const sortedPlayers = [...estado.jugadores].sort((a, b) => {
    if (a.id === estado.ganador) return -1;
    if (b.id === estado.ganador) return 1;
    const da = bfsCamino(a, estado.murosH, estado.murosV, undefined, estado.n).distancia;
    const db = bfsCamino(b, estado.murosH, estado.murosV, undefined, estado.n).distancia;
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

  const cuentas = cargarCuentas();
  const cuentasPatch: Record<string, UserAccount> = {};
  const rankingPatch: Record<string, RankEntry> = {};
  const entradasSemanal: {
    nombre: string;
    avatarColor: string;
    puntos: number;
    victoria: boolean;
  }[] = [];

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
    lEntry.avatarColor = j.color;
    lEntry.avatarHat = j.hat;
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
    puntosGanadosMap.set(lKey, puntos);

    // SEGURIDAD CRÍTICA: Solo el usuario que tiene su sesión iniciada legítimamente
    // puede sumar puntos o alterar estadísticas de su cuenta en la nube.
    // Los invitados quedan registrados únicamente en su ranking local.
    const cur = obtenerUsuarioActual();
    const esCuentaDelUsuarioAutenticado = Boolean(
      cur && cur.id && cur.nombre.trim().toLowerCase() === cleanJName
    );

    if (!esCuentaDelUsuarioAutenticado) {
      continue;
    }

    const matchingAcc = (cur && cuentas[cur.id]) || Object.values(cuentas).find(
      (acc) => acc.id === cur?.id
    );

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
    puntosGanadosMap.set(key, puntos);

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
      subidasNivelMap.set(key, { anterior: prevLevel, nuevo: newLevel });
    }

    const newlyUnlocked: AchievementDef[] = [];
    const checkLogro = (id: string, cond: boolean) => {
      if (cond && !entry.logros.includes(id)) {
        entry.logros.push(id);
        const def = LOGROS_LISTA.find((l) => l.id === id);
        if (def) newlyUnlocked.push(def);
      }
    };

    const cualquierRivalA1Paso = estado.jugadores.some(
      (rival) =>
        rival.id !== j.id &&
        bfsCamino(rival, estado.murosH, estado.murosV, undefined, estado.n).distancia <= 1
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
    checkLogro('mil_puntos', entry.puntosTotales >= 250);

    if (newlyUnlocked.length > 0) {
      nuevosLogrosMap.set(key, newlyUnlocked);
    }

    ranking[key] = entry;

    matchingAcc.puntos = entry.puntosTotales;
    matchingAcc.partidas = entry.partidas;
    matchingAcc.victorias = entry.victorias;
    matchingAcc.elo = entry.elo;
    matchingAcc.ultimaConexion = new Date().toISOString();

    if (!matchingAcc.historialPartidas) {
      matchingAcc.historialPartidas = [];
    }
    const rivalesNombres = estado.jugadores
      .filter((rj) => rj.id !== j.id)
      .map((rj) => rj.nombre)
      .join(', ');

    const resultadoJ: 'victoria' | 'derrota' | 'empate' = esGanador
      ? 'victoria'
      : estado.ganador === -1
      ? 'empate'
      : 'derrota';

    matchingAcc.historialPartidas.unshift({
      id: matchRecord.id,
      fecha: matchRecord.fecha,
      resultado: resultadoJ,
      puntos,
      rivales: rivalesNombres || 'Bot',
      duracionSegundos,
    });
    if (matchingAcc.historialPartidas.length > 20) {
      matchingAcc.historialPartidas = matchingAcc.historialPartidas.slice(0, 20);
    }

    cuentas[matchingAcc.id] = matchingAcc;
    cuentasPatch[matchingAcc.id] = matchingAcc;
    rankingPatch[key] = entry;
    entradasSemanal.push({
      nombre: matchingAcc.nombre,
      avatarColor: matchingAcc.avatarColor || j.color,
      puntos,
      victoria: esGanador,
    });

    if (cur && cur.id === matchingAcc.id) {
      guardarUsuarioActual(matchingAcc);
    }
  }

  guardarRankingLocal(rankingLocal);
  historial.push(matchRecord);
  guardarHistorial(historial);

  // Solo contactar con Cloudflare D1 si participó al menos una cuenta registrada (0 peticiones a la Database en modo Invitado)
  if (Object.keys(cuentasPatch).length > 0) {
    safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));
    safeSet(STORAGE_KEY_RANKING, JSON.stringify(ranking));

    (async () => {
      try {
        const authToken = obtenerTokenSesion();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        const res = await fetch(getApiBaseUrl('/api/partida'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            matchId: matchRecord.id,
            fecha: matchRecord.fecha,
            cuentasPatch,
            rankingPatch,
            entradasSemanal,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && Array.isArray(data.activeAccountIds)) {
            const cur = obtenerUsuarioActual();
            if (cur && cur.id !== 'admin' && !data.activeAccountIds.includes(cur.id)) {
              cerrarSesion();
              await sincronizarConNube(true);
            }
          }
        }
      } catch {
        // Fallback silencioso offline
      }
    })();
  }

  return {
    nuevosLogrosPorJugador: nuevosLogrosMap,
    subidasNivelPorJugador: subidasNivelMap,
    puntosGanadosPorJugador: puntosGanadosMap,
  };
}

export function penalizarAbandono(nombre: string, puntosPerdidos: number = 5): { puntosTotales: number } {
  const cuentas = cargarCuentas();
  const key = nombre.trim().toLowerCase();
  const matchingAcc = Object.values(cuentas).find((a) => a.nombre.trim().toLowerCase() === key);
  if (!matchingAcc) {
    return { puntosTotales: 0 };
  }

  const ranking = cargarRanking();
  const entry = ranking[key]
    ? normalizarRankEntry(ranking[key], nombre)
    : normalizarRankEntry({ nombre }, nombre);

  entry.puntosTotales = Math.max(0, entry.puntosTotales - puntosPerdidos);
  entry.derrotas++;
  entry.partidas++;
  entry.rachaActual = 0;
  entry.elo = Math.max(100, entry.elo - 15);
  entry.fechaUltimaPartida = new Date().toISOString();

  ranking[key] = entry;
  matchingAcc.puntos = entry.puntosTotales;
  matchingAcc.partidas = entry.partidas;
  matchingAcc.elo = entry.elo;
  cuentas[matchingAcc.id] = matchingAcc;

  safeSet(STORAGE_KEY_RANKING, JSON.stringify(ranking));
  safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));
  const cur = obtenerUsuarioActual();
  if (cur && cur.id === matchingAcc.id) {
    guardarUsuarioActual(matchingAcc);
  }

  enviarJsonADatabase('/api/partida', {
    matchId: `abandono_${Date.now()}`,
    fecha: entry.fechaUltimaPartida,
    cuentasPatch: { [matchingAcc.id]: matchingAcc },
    rankingPatch: { [key]: entry },
    entradasSemanal: [],
  }).catch(() => {});

  return { puntosTotales: entry.puntosTotales };
}

export function exportarDatosJSON(): string {
  const ranking = cargarRanking();
  const cuentas = cargarCuentas();
  const historial = cargarHistorial();
  const settings = cargarAjustes();
  return JSON.stringify({ version: 2, ranking, cuentas, historial, settings }, null, 2);
}

export async function importarDatosJSONAsync(jsonStr: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return false;

    let importedAnything = false;

    if (data.cuentas && typeof data.cuentas === 'object') {
      const ok = await enviarJsonADatabase('/api/cuentas', data.cuentas, { asAdmin: true });
      if (!ok) return false;
      safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(data.cuentas));
      importedAnything = true;
    }

    if (data.ranking && typeof data.ranking === 'object') {
      const normalized: Record<string, RankEntry> = {};
      for (const [k, v] of Object.entries(data.ranking)) {
        if (v && typeof v === 'object') {
          normalized[k] = normalizarRankEntry(v as Partial<RankEntry>, k);
        }
      }
      const ok = await enviarJsonADatabase('/api/ranking', normalized, { asAdmin: true });
      if (!ok) return false;
      safeSet(STORAGE_KEY_RANKING, JSON.stringify(normalized));
      importedAnything = true;
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

// =========================================================================
// CUENTAS DE USUARIO Y AUTENTICACIÓN UNIFICADA (ADMIN SUPREMO + DELEGADOS)
// =========================================================================

export function cargarCuentas(): Record<string, UserAccount> {
  const raw = safeGet(STORAGE_KEY_ACCOUNTS);
  let accounts: Record<string, UserAccount> = {};
  if (raw) {
    try {
      accounts = JSON.parse(raw);
    } catch {}
  }

  // Perfil público del Admin Supremo (sin guardar jamás su clave real en texto plano)
  if (!accounts['admin']) {
    accounts['admin'] = {
      id: 'admin',
      nombre: 'Admin Supremo',
      clave: '***SUPREMO***',
      rol: 'admin',
      esSupremo: true,
      avatarColor: '#ffd43b',
      avatarHat: 'corona',
      temaTablero: 'madera',
      puntos: 9999,
      partidas: 100,
      victorias: 99,
      elo: 2500,
      creadoEn: new Date().toISOString(),
      ultimaConexion: new Date().toISOString(),
    };
  } else {
    accounts['admin'].rol = 'admin';
    accounts['admin'].esSupremo = true;
    accounts['admin'].clave = '***SUPREMO***';
  }
  return accounts;
}

export function guardarCuentas(cuentas: Record<string, UserAccount>) {
  const copy = { ...cuentas };
  if (copy['admin']) {
    copy['admin'] = { ...copy['admin'], rol: 'dev', esSupremo: true, clave: '***SUPREMO***' };
  }
  safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(copy));
  enviarJsonADatabase('/api/cuentas', copy);
}

export function obtenerUsuarioActual(): UserAccount | null {
  const raw = safeGet(STORAGE_KEY_CURRENT_USER);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserAccount;
    if (parsed.id === 'admin') {
      // Si es Admin Supremo, necesita tener token de sesión activo
      if (!obtenerTokenAdminSupremo()) return null;
      const accounts = cargarCuentas();
      return { ...(accounts['admin'] || parsed), id: 'admin', rol: 'dev', esSupremo: true };
    }
    const accounts = cargarCuentas();
    return accounts[parsed.id] || parsed;
  } catch {
    return null;
  }
}

export function guardarUsuarioActual(user: UserAccount | null) {
  if (!user) {
    safeRemove(STORAGE_KEY_CURRENT_USER);
  } else {
    safeSet(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
  }
}

/**
 * Login seguro en servidor (/api/login):
 * - Valida contraseñas con PBKDF2 y migra de forma transparente cuentas antiguas.
 * - Soporta tanto al Admin Supremo como a jugadores y admins delegados.
 * - Guarda el token de sesión Bearer en el almacenamiento seguro del cliente.
 */
export async function iniciarSesionAsync(
  nombre: string,
  clave: string
): Promise<{ ok: boolean; error?: string; user?: UserAccount }> {
  const cleanUser = nombre.trim();
  const cleanKey = clave.trim();

  try {
    const res = await fetch(getApiBaseUrl('/api/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: cleanUser, clave: cleanKey }),
    });

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const info = await res.json().catch(() => null);
      if (res.ok && info && info.ok && info.user) {
        if (info.token) {
          guardarTokenSesion(info.token);
        }
        if (info.isSupremeAdmin) {
          guardarTokenAdminSupremo({
            user: cleanUser,
            token: info.token || cleanKey,
          });
        } else {
          guardarTokenAdminSupremo(null);
        }
        guardarUsuarioActual(info.user);
        await sincronizarConNube(true);
        return { ok: true, user: info.user };
      }
      return { ok: false, error: info?.error || 'Usuario o clave incorrectos.' };
    }
    return { ok: false, error: 'Respuesta inesperada del servidor.' };
  } catch (err: any) {
    return { ok: false, error: '⚠️ Error de conexión con el servidor: ' + (err?.message || 'Verifica tu red.') };
  }
}

/**
 * Registro de nuevo usuario en servidor (/api/registro):
 * - La contraseña se hashea con PBKDF2 en el servidor y nunca se expone en texto plano.
 * - Inicia sesión inmediatamente emitiendo un token Bearer seguro.
 */
export async function registrarUsuarioAsync(
  nombre: string,
  clave: string,
  avatarColor: string,
  avatarHat: HatType,
  temaTablero: BoardTheme = 'madera'
): Promise<{ ok: boolean; error?: string; user?: UserAccount }> {
  const cleanName = nombre.trim();
  const cleanKey = clave.trim();

  if (cleanName.length < 3 || cleanName.length > 15) {
    return { ok: false, error: 'El nombre debe tener entre 3 y 15 letras.' };
  }
  const validChars = /^[a-zA-Z0-9_ñÑáéíóúÁÉÍÓÚ\s]+$/;
  if (!validChars.test(cleanName)) {
    return { ok: false, error: 'El nombre solo puede contener letras, números y espacios.' };
  }
  if (cleanKey.length < 4) {
    return { ok: false, error: 'La clave debe tener al menos 4 caracteres.' };
  }

  const cleanId = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '');

  try {
    const res = await fetch(getApiBaseUrl('/api/registro'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: cleanId,
        nombre: cleanName,
        clave: cleanKey,
        avatarColor,
        avatarHat,
        temaTablero,
      }),
    });

    const info = await res.json().catch(() => null);
    if (res.ok && info && info.ok && info.user) {
      if (info.token) {
        guardarTokenSesion(info.token);
      }
      guardarUsuarioActual(info.user);
      await sincronizarConNube(true);
      return { ok: true, user: info.user };
    }
    return { ok: false, error: info?.error || 'No se pudo crear la cuenta.' };
  } catch (err: any) {
    return { ok: false, error: '⚠️ Error de conexión al registrar: ' + (err?.message || 'Inténtalo de nuevo.') };
  }
}

/**
 * Restablecimiento de clave por el Admin Supremo (/api/admin/restablecer-clave)
 */
export async function restablecerClaveUsuarioAsync(
  targetId: string
): Promise<{ ok: boolean; claveTemporal?: string; error?: string }> {
  try {
    const token = obtenerTokenSesion();
    const sup = obtenerTokenAdminSupremo();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    }
    const res = await fetch(getApiBaseUrl('/api/admin/restablecer-clave'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok && data.claveTemporal) {
      return { ok: true, claveTemporal: data.claveTemporal };
    }
    return { ok: false, error: data?.error || 'No se pudo restablecer la clave.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de conexión.' };
  }
}

export function cerrarSesion() {
  guardarTokenAdminSupremo(null);
  guardarTokenSesion(null);
  guardarUsuarioActual(null);
}

/**
 * Verifica en tiempo real contra el Worker y Database (D1) si el usuario actual sigue teniendo permisos
 * de administrador (Dev Supremo con su token de login, o Staff con rol 'dev', 'admin' o 'mod').
 * Nunca pide clave al usuario otra vez.
 */
export async function D1_VerificarAccionAdmin(
  usuario: UserAccount | null,
  requiereSupremo: boolean = false
): Promise<{
  ok: boolean;
  esSupremo?: boolean;
  dbDesconectado?: boolean;
  /** @deprecated compatibilidad */
  revocado?: boolean;
  error?: string;
}> {
  if (!usuario) {
    return { ok: false, error: 'Debes iniciar sesión con tu cuenta de Staff primero.' };
  }

  try {
    const supremeCreds = usuario.id === 'admin' ? obtenerTokenAdminSupremo() : null;
    const tokenSesion = obtenerTokenSesion();
    const res = await fetch(getApiBaseUrl('/api/admin/verify-action'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tokenSesion ? { Authorization: `Bearer ${tokenSesion}` } : {}),
      },
      body: JSON.stringify({
        usuarioId: usuario.id,
        usuarioClave: usuario.id === 'admin' ? undefined : usuario.clave,
        adminUser: supremeCreds?.user,
        adminToken: supremeCreds?.token,
        requiereSupremo,
      }),
    });

    const isBound =
      res.headers.get('X-DB-Bound') === 'true' ||
      res.headers.get('X-Database-Bound') === 'true';
    const ct = res.headers.get('content-type') || '';

    if (res.status === 503 || !isBound || !ct.includes('application/json')) {
      cloudDbConectado = false;
      reportarDiagnostico({
        checkedOnce: true,
        dbConectado: false,
        lastError: 'Sin conexión a la Database (D1)',
      });
      return {
        ok: false,
        dbDesconectado: true,
        error: '⚠️ No hay conexión con la Database (D1). Conéctate para enviar o recibir cambios.',
      };
    }

    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (data.revoked) {
        await sincronizarConNube(true);
        const cuentas = cargarCuentas();
        if (usuario.id === 'admin' || !cuentas[usuario.id]) {
          cerrarSesion();
        } else {
          guardarUsuarioActual(cuentas[usuario.id]);
        }
        return {
          ok: false,
          revocado: true,
          error: data.error || '⛔ Tus permisos de administrador fueron revocados en la Database.',
        };
      }
      return {
        ok: false,
        error: data.error || 'No tienes permiso para realizar esta acción.',
      };
    }

    cloudDbConectado = true;
    reportarDiagnostico({ checkedOnce: true, isOnline: true, dbConectado: true, lastError: null });
    return { ok: true, esSupremo: Boolean(data.isSupremeAdmin) };
  } catch {
    cloudDbConectado = false;
    reportarDiagnostico({
      checkedOnce: true,
      isOnline: false,
      dbConectado: false,
      lastError: 'Error de red con la Database',
    });
    return {
      ok: false,
      dbDesconectado: true,
      error: '⚠️ Sin conexión al servidor / Database (D1). No se pueden enviar cambios.',
    };
  }
}

export function actualizarCuentaUsuario(id: string, patch: Partial<UserAccount>): UserAccount | null {
  const cuentas = cargarCuentas();
  if (!cuentas[id]) return null;
  const current = cuentas[id];
  const updated: UserAccount = {
    ...current,
    ...patch,
    id: current.id,
    // Jamás sobrescribir el rol desde acciones normales de perfil/aspecto; solo adminActualizarUsuarioAsync puede
    rol: current.id === 'admin' ? 'admin' : current.rol,
    clave: current.id === 'admin' ? '***SUPREMO***' : patch.clave || current.clave,
  };
  cuentas[id] = updated;
  guardarCuentas(cuentas);
  const cur = obtenerUsuarioActual();
  if (cur && cur.id === id) {
    guardarUsuarioActual(updated);
  }
  const ranking = cargarRanking();
  const rankKey = updated.nombre.trim().toLowerCase();
  if (ranking[rankKey]) {
    if (patch.avatarColor) ranking[rankKey].avatarColor = patch.avatarColor;
    if (patch.avatarHat) ranking[rankKey].avatarHat = patch.avatarHat;
    guardarRanking(ranking);
  }
  return updated;
}

export async function actualizarCuentaAsync(usuario: UserAccount): Promise<UserAccount> {
  const cuentas = cargarCuentas();
  const current = cuentas[usuario.id] || usuario;
  const isDevOrAdmin = usuario.id === 'admin' || current.rol === 'admin' || current.rol === 'dev';

  const updated: UserAccount = {
    ...current,
    avatarHat: usuario.avatarHat,
    avatarColor: usuario.avatarColor,
    avatarRopa: usuario.avatarRopa,
    avatarRopaColor: usuario.avatarRopaColor,
    avatarAura: usuario.avatarAura,
    inventario: usuario.inventario || current.inventario,
    temaTablero: usuario.temaTablero || current.temaTablero,
    id: current.id,
    rol: current.id === 'admin' ? 'dev' : current.rol,
    clave: current.id === 'admin' ? '***SUPREMO***' : (current.clave || usuario.clave),
  };

  cuentas[usuario.id] = updated;
  safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));

  const cur = obtenerUsuarioActual();
  if (cur && cur.id === usuario.id) {
    guardarUsuarioActual(updated);
  }

  const ranking = cargarRanking();
  const rankKey = updated.nombre.trim().toLowerCase();
  if (ranking[rankKey]) {
    if (updated.avatarColor) ranking[rankKey].avatarColor = updated.avatarColor;
    if (updated.avatarHat) ranking[rankKey].avatarHat = updated.avatarHat;
    safeSet(STORAGE_KEY_RANKING, JSON.stringify(ranking));
  }

  // Persistir inmediatamente a la Base de Datos (D1 / Server)
  try {
    await Promise.all([
      enviarJsonADatabase('/api/cuentas', cuentas, { asAdmin: isDevOrAdmin }),
      ranking[rankKey]
        ? enviarJsonADatabase('/api/ranking', ranking, { asAdmin: isDevOrAdmin })
        : Promise.resolve(true),
    ]);
  } catch (err) {
    console.warn('Error al guardar aspecto en Database:', err);
  }

  reconciliarYNotificarNube();
  return updated;
}

export async function cambiarClaveUsuarioAsync(
  claveActual: string,
  nuevaClave: string
): Promise<{ ok: boolean; error?: string }> {
  const token = obtenerTokenSesion();
  if (!token) {
    return { ok: false, error: 'Debes tener una sesión activa para cambiar tu contraseña.' };
  }
  if (!nuevaClave || nuevaClave.length < 4) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
  }
  try {
    const res = await fetch(getApiBaseUrl('/api/perfil/cambiar-clave'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ claveActual, nuevaClave }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'No se pudo cambiar la contraseña.' };
    }
    if (data.token) {
      guardarTokenSesion(data.token);
    }
    await sincronizarConNube(true);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: 'Error de red al cambiar la contraseña: ' + (err?.message || 'Reintente.') };
  }
}

export async function adminActualizarUsuarioAsync(
  id: string,
  patch: Partial<UserAccount>
): Promise<{ ok: boolean; error?: string }> {
  if (id === 'admin') {
    return { ok: false, error: 'El Admin Supremo es intocable.' };
  }

  await sincronizarConNube(true);
  const cuentas = cargarCuentas();
  if (!cuentas[id]) {
    return { ok: false, error: 'El usuario ya no existe en la base de datos.' };
  }

  if (patch.nombre) {
    const cleanNew = patch.nombre.trim();
    if (cleanNew.length < 3 || cleanNew.length > 15) {
      return { ok: false, error: 'El nombre debe tener entre 3 y 15 caracteres.' };
    }
    const validChars = /^[a-zA-Z0-9_ñÑáéíóúÁÉÍÓÚ\s]+$/;
    if (!validChars.test(cleanNew)) {
      return { ok: false, error: 'Caracteres inválidos en el nombre.' };
    }
    if (['admin', 'administrador', 'admin supremo'].includes(cleanNew.toLowerCase())) {
      return { ok: false, error: 'Nombre reservado para el Admin Supremo.' };
    }
    const isTaken = Object.values(cuentas).some(
      (acc) => acc.id !== id && acc.nombre.trim().toLowerCase() === cleanNew.toLowerCase()
    );
    if (isTaken) {
      return { ok: false, error: 'Ese nombre ya está en uso por otro jugador.' };
    }
  }

  const current = cuentas[id];
  const oldName = current.nombre.trim().toLowerCase();
  const updatedUser: UserAccount = { ...current, ...patch, id };
  cuentas[id] = updatedUser;

  const ranking = cargarRanking();
  const newName = updatedUser.nombre.trim().toLowerCase();

  if (oldName !== newName) {
    delete ranking[oldName];
    for (const key of Object.keys(ranking)) {
      if (ranking[key].nombre.trim().toLowerCase() === oldName) {
        delete ranking[key];
      }
    }
  }

  const existingRank =
    ranking[newName] || normalizarRankEntry({ nombre: updatedUser.nombre }, updatedUser.nombre);

  ranking[newName] = {
    ...existingRank,
    nombre: updatedUser.nombre,
    puntosTotales: patch.puntos !== undefined ? patch.puntos : existingRank.puntosTotales,
    elo: patch.elo !== undefined ? patch.elo : existingRank.elo,
    victorias: patch.victorias !== undefined ? patch.victorias : existingRank.victorias,
    partidas: patch.partidas !== undefined ? patch.partidas : existingRank.partidas,
    avatarColor: updatedUser.avatarColor || existingRank.avatarColor,
    avatarHat: updatedUser.avatarHat || existingRank.avatarHat,
  };

  const [okCuentas, okRanking] = await Promise.all([
    enviarJsonADatabase('/api/cuentas', cuentas, { asAdmin: true }),
    enviarJsonADatabase('/api/ranking', ranking, { asAdmin: true }),
  ]);

  if (!okCuentas) {
    return {
      ok: false,
      error: '⚠️ No se pudieron enviar los cambios (Database desconectada o permisos revocados).',
    };
  }

  safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));
  safeSet(STORAGE_KEY_RANKING, JSON.stringify(ranking));

  const cur = obtenerUsuarioActual();
  if (cur && cur.id === id) {
    guardarUsuarioActual(updatedUser);
  }

  reconciliarYNotificarNube();
  return { ok: true };
}

export async function adminEliminarUsuarioAsync(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  if (id === 'admin') {
    return { ok: false, error: 'El Admin Supremo no puede eliminarse.' };
  }

  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const authToken = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    } else if (cur && cur.id !== 'admin') {
      headers['X-Admin-Id'] = cur.id;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/eliminar-usuario'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId: id }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || '⚠️ No se pudo eliminar (permisos revocados o desconexión).' };
    }

    // Limpiar localmente tras confirmación del servidor
    const cuentas = cargarCuentas();
    const targetName = cuentas[id]?.nombre?.trim().toLowerCase();
    delete cuentas[id];
    safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));

    const ranking = cargarRanking();
    if (targetName) delete ranking[targetName];
    delete ranking[id.toLowerCase()];
    for (const key of Object.keys(ranking)) {
      if (
        ranking[key]?.nombre?.trim().toLowerCase() === targetName ||
        key.toLowerCase() === targetName ||
        key.toLowerCase() === id.toLowerCase()
      ) {
        delete ranking[key];
      }
    }
    safeSet(STORAGE_KEY_RANKING, JSON.stringify(ranking));

    if (cur && cur.id === id) {
      cerrarSesion();
    }

    reconciliarYNotificarNube();
    await sincronizarConNube(true);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: '⚠️ Error de red al eliminar usuario: ' + (err?.message || 'Reintente.') };
  }
}

export async function darDeBajaUsuarioAsync(id: string): Promise<boolean> {
  if (id === 'admin') return false;
  await sincronizarConNube(true);
  const cuentas = cargarCuentas();
  const target = cuentas[id];
  if (!target) return false;

  const clavePropia = target.clave;
  const targetName = target.nombre.trim().toLowerCase();
  delete cuentas[id];

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

  const [okCuentas, okRanking] = await Promise.all([
    enviarJsonADatabase('/api/cuentas', cuentas, clavePropia ? { selfDelete: { id, clave: clavePropia } } : undefined),
    enviarJsonADatabase('/api/ranking', ranking),
  ]);

  if (!okCuentas || !okRanking) {
    return false;
  }

  safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));
  safeSet(STORAGE_KEY_RANKING, JSON.stringify(ranking));
  cerrarSesion();
  reconciliarYNotificarNube();
  return true;
}

export async function adminResetearRankingAsync(): Promise<{ ok: boolean; error?: string }> {
  await sincronizarConNube(true);
  const rankingVacio: Record<string, RankEntry> = {};
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

  const [okRanking, okCuentas] = await Promise.all([
    enviarJsonADatabase('/api/ranking', rankingVacio, { asAdmin: true }),
    enviarJsonADatabase('/api/cuentas', cuentas, { asAdmin: true }),
  ]);

  if (!okRanking || !okCuentas) {
    return {
      ok: false,
      error: '⚠️ No se pudo borrar el Ranking Global (Database desconectada o permisos revocados).',
    };
  }

  safeSet(STORAGE_KEY_RANKING, JSON.stringify(rankingVacio));
  safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));

  const cur = obtenerUsuarioActual();
  if (cur && cur.id !== 'admin' && cuentas[cur.id]) {
    guardarUsuarioActual(cuentas[cur.id]);
  }

  reconciliarYNotificarNube();
  return { ok: true };
}

export async function regalarPersonajeAsync(
  targetId: string,
  personaje: Partial<PersonajeColeccionable>
): Promise<{ ok: boolean; mensaje?: string; error?: string; inventario?: any }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    } else if (cur && cur.id !== 'admin') {
      headers['X-Admin-Id'] = cur.id;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/personajes/regalar'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId, personaje }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      const cuentas = cargarCuentas();
      if (cuentas[targetId]) {
        cuentas[targetId].inventario = data.inventario || {
          personajes: [...(cuentas[targetId].inventario?.personajes || []), data.personaje].filter(Boolean),
        };
        safeSet(STORAGE_KEY_ACCOUNTS, JSON.stringify(cuentas));
      }
      if (cur && cur.id === targetId) {
        cur.inventario = data.inventario || cuentas[targetId]?.inventario;
        guardarUsuarioActual(cur);
      }
      reconciliarYNotificarNube();
      await sincronizarConNube(true);
      return { ok: true, mensaje: data.mensaje, inventario: data.inventario };
    }
    return { ok: false, error: data?.error || 'No se pudo entregar el personaje.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.' };
  }
}

export async function quitarPersonajeInventarioAsync(
  targetId: string,
  personajeId: string
): Promise<{ ok: boolean; mensaje?: string; error?: string }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/personajes/quitar'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId, personajeId }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      await sincronizarConNube(true);
      return { ok: true, mensaje: data.mensaje };
    }
    return { ok: false, error: data?.error || 'No se pudo revocar el personaje.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.' };
  }
}

export async function fijarPremioSemanalAsync(
  personaje: Partial<PersonajeColeccionable> | null
): Promise<{ ok: boolean; mensaje?: string; error?: string; premioSemanal?: any }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    } else if (cur && cur.id !== 'admin') {
      headers['X-Admin-Id'] = cur.id;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/personajes/fijar-premio-semanal'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ personaje }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true, mensaje: data.mensaje, premioSemanal: data.premioSemanal };
    }
    return { ok: false, error: data?.error || 'No se pudo fijar el premio semanal.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.' };
  }
}

export async function obtenerConfigSemanalAsync(): Promise<{
  primerLugar: number;
  segundoLugar: number;
  tercerLugar: number;
  participacion?: number;
  premioSemanal?: PersonajeColeccionable;
}> {
  try {
    const res = await fetch(getApiBaseUrl('/api/admin/config-semanal'));
    const data = await res.json().catch(() => null);
    if (data?.ok) {
      return {
        primerLugar: data.config?.primerLugar ?? 50,
        segundoLugar: data.config?.segundoLugar ?? 30,
        tercerLugar: data.config?.tercerLugar ?? 15,
        participacion: data.config?.participacion ?? 5,
        premioSemanal: data.premioSemanal,
      };
    }
  } catch {}
  return { primerLugar: 50, segundoLugar: 30, tercerLugar: 15, participacion: 5 };
}

export async function guardarConfigSemanalAsync(cfg: {
  primerLugar: number;
  segundoLugar: number;
  tercerLugar: number;
  participacion?: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    } else if (cur && cur.id !== 'admin') {
      headers['X-Admin-Id'] = cur.id;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/config-semanal'), {
      method: 'POST',
      headers,
      body: JSON.stringify(cfg),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true };
    }
    return { ok: false, error: data?.error || 'No se pudo guardar la configuración.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de conexión.' };
  }
}

export async function solicitarResetRankingAsync(
  motivo?: string
): Promise<{ ok: boolean; mensaje?: string; error?: string }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    } else if (cur && cur.id !== 'admin') {
      headers['X-Admin-Id'] = cur.id;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/ranking/solicitar-reset'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ motivo }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true, mensaje: data.mensaje };
    }
    return { ok: false, error: data?.error || 'No se pudo solicitar el reseteo.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de conexión.' };
  }
}

export async function obtenerSolicitudResetRankingAsync(): Promise<SolicitudResetRanking | null> {
  try {
    const res = await fetch(getApiBaseUrl('/api/admin/ranking/solicitud-reset'));
    const data = await res.json().catch(() => null);
    return data?.solicitud || null;
  } catch {
    return null;
  }
}

export async function aprobarResetRankingAsync(): Promise<{ ok: boolean; mensaje?: string; error?: string }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/ranking/aprobar-reset'), {
      method: 'POST',
      headers,
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      await sincronizarConNube(true);
      return { ok: true, mensaje: data.mensaje };
    }
    return { ok: false, error: data?.error || 'No se pudo aprobar el reseteo.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de conexión.' };
  }
}

export async function rechazarResetRankingAsync(): Promise<{ ok: boolean; error?: string }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/ranking/rechazar-reset'), {
      method: 'POST',
      headers,
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true };
    }
    return { ok: false, error: data?.error || 'No se pudo rechazar.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de conexión.' };
  }
}

export function equiparPersonajeInventario(
  usuario: UserAccount,
  personajeId: string | null
): UserAccount {
  const inv = usuario.inventario || { personajes: [] };
  let patch: Partial<UserAccount> = {};

  if (!personajeId) {
    // Desequipar
    patch = {
      inventario: { ...inv, activoId: undefined },
      avatarRopa: 'ninguna',
      avatarRopaColor: undefined,
      avatarAura: 'ninguna',
    };
  } else {
    const item = (inv.personajes || []).find((p) => p.id === personajeId);
    if (item) {
      patch = {
        inventario: { ...inv, activoId: item.id },
        avatarColor: item.color,
        avatarHat: item.hat,
        avatarRopa: item.ropa || 'ninguna',
        avatarRopaColor: item.ropaColor,
        avatarAura: item.aura || 'ninguna',
      };
    }
  }

  const updated: UserAccount = { ...usuario, ...patch };
  actualizarCuentaUsuario(usuario.id, patch);
  return updated;
}

const STORAGE_KEY_DESBLOQUEOS = 'muros_locos_desbloqueos_v1';

export function obtenerDesbloqueosLocales(): Record<string, number> {
  const defaults: Record<string, number> = {
    gatito: 30,
    zorro: 60,
    robot: 120,
    dragon: 200,
    ninja: 300,
    navidad: 400,
    granjero: 500,
    vikingo: 650,
    copa: 800,
    gorra: 950,
    boina: 1100,
    espacial: 1300,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DESBLOQUEOS);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

export async function obtenerDesbloqueosPersonajesAsync(): Promise<Record<string, number>> {
  const local = obtenerDesbloqueosLocales();
  try {
    const res = await fetch(getApiBaseUrl('/api/admin/desbloqueos-personajes'));
    const data = await res.json().catch(() => null);
    if (data?.ok && data.desbloqueos) {
      safeSet(STORAGE_KEY_DESBLOQUEOS, JSON.stringify(data.desbloqueos));
      return { ...local, ...data.desbloqueos };
    }
  } catch {}
  return local;
}

export async function guardarDesbloqueosPersonajesAsync(
  desbloqueos: Record<string, number>
): Promise<{ ok: boolean; error?: string }> {
  try {
    safeSet(STORAGE_KEY_DESBLOQUEOS, JSON.stringify(desbloqueos));
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    } else if (cur && cur.id !== 'admin') {
      headers['X-Admin-Id'] = cur.id;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/desbloqueos-personajes'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ desbloqueos }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true };
    }
    return { ok: false, error: data?.error || 'No se pudieron guardar los requisitos de desbloqueo en Database.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de conexión.' };
  }
}

// ==========================================
// SALAS PERSONALIZADAS EN LÍNEA (STAFF: DEV, ADMIN, MOD)
// ==========================================

const STORAGE_KEY_SALAS_PERSONALIZADAS = 'muros_salas_personalizadas_cache';

export async function obtenerSalasPersonalizadasAsync(): Promise<SalaPersonalizada[]> {
  try {
    const res = await fetch(getApiBaseUrl('/api/admin/salas-personalizadas'));
    const data = await res.json().catch(() => null);
    if (data?.ok && Array.isArray(data.salas)) {
      safeSet(STORAGE_KEY_SALAS_PERSONALIZADAS, JSON.stringify(data.salas));
      return data.salas;
    }
  } catch {}
  try {
    const local = localStorage.getItem(STORAGE_KEY_SALAS_PERSONALIZADAS);
    if (local) return JSON.parse(local);
  } catch {}
  return [];
}

export async function crearSalaPersonalizadaAsync(
  sala: Partial<SalaPersonalizada>
): Promise<{ ok: boolean; error?: string; sala?: SalaPersonalizada }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    } else if (cur && cur.id !== 'admin') {
      headers['X-Admin-Id'] = cur.id;
    }

    const res = await fetch(getApiBaseUrl('/api/admin/salas-personalizadas'), {
      method: 'POST',
      headers,
      body: JSON.stringify(sala),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true, sala: data.sala };
    }
    return { ok: false, error: data?.error || 'No se pudo crear la sala personalizada.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.' };
  }
}

export async function eliminarSalaPersonalizadaAsync(
  codigo: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cur = obtenerUsuarioActual();
    const sup = obtenerTokenAdminSupremo();
    const token = obtenerTokenSesion() || (cur?.id === 'admin' && sup ? sup.token : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sup) {
      headers['X-Admin-User'] = sup.user;
      headers['X-Admin-Token'] = sup.token;
    } else if (cur && cur.id !== 'admin') {
      headers['X-Admin-Id'] = cur.id;
    }

    const res = await fetch(getApiBaseUrl(`/api/admin/salas-personalizadas/${encodeURIComponent(codigo)}`), {
      method: 'DELETE',
      headers,
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true };
    }
    return { ok: false, error: data?.error || 'No se pudo eliminar la sala.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.' };
  }
}

