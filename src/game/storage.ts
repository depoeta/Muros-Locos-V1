import {
  AjustesDeApp,
  AvatarTipoDeAura,
  AvatarTipoDeGorro,
  AvatarTipoDeRopa,
  UserCuenta,
  DefLogro,
  DesglosePuntos,
  EntradaRanking,
  EstadoDeJuego,
  InfoNivel,
  UserInventario,
  RegDeAvatar,
  AvatarColeccionable,
  RespuestaRankingSemanal,
  UserRol,
  SalaPersonalizada,
  SolicitudResetRanking,
  TemaTablero,
} from '../types/murosLocos';

const RANKING_LOCAL_KEY = 'muros_locos_ranking_v2';
const RANKING_GLOBAL_CACHE_KEY = 'muros_locos_ranking_global_cache_v2';
const AJUSTES_KEY = 'muros_locos_ajustes_v2';
const CUENTAS_CACHE_KEY = 'muros_locos_cuentas_cache_v2';
const SESION_KEY = 'muros_locos_sesion_v2';
const SESION_TOKEN_KEY = 'muros_locos_token_v2';
const COLA_OFFLINE_KEY = 'muros_locos_cola_offline_v1';
const DESBLOQUEOS_LOCAL_KEY = 'muros_locos_desbloqueos_cache_v1';

// ============================================================================
// DIAGNÓSTICO DE RED Y SINCRONIZACIÓN AUTOMÁTICA D1
// ============================================================================

export interface DiagnosticoDeRed {
  isOnline: boolean;
  dbConectado: boolean;
  d1Conectado: boolean;
  ultimoPingOk: boolean;
  ultimaSincronizacion: string | null;
  ultimoError: string | null;
  serverPingMs: number | null;
  checkedOnce: boolean;
  lastUpdate: number;
}

let redDiag: DiagnosticoDeRed = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  dbConectado: false,
  d1Conectado: false,
  ultimoPingOk: false,
  ultimaSincronizacion: null,
  ultimoError: null,
  serverPingMs: null,
  checkedOnce: false,
  lastUpdate: 0,
};

const diagListeners = new Set<(diag: DiagnosticoDeRed) => void>();
const nubeListeners = new Set<
  (data: { cuentas: Record<string, UserCuenta>; ranking: Record<string, EntradaRanking> }) => void
>();
const sesionRevocadaListeners = new Set<(motivo: string) => void>();

function emitDiag() {
  const snapshot = { ...redDiag };
  diagListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // ignorar
    }
  });
}

function emitNube(
  cuentas: Record<string, UserCuenta>,
  ranking: Record<string, EntradaRanking>
) {
  nubeListeners.forEach((cb) => {
    try {
      cb({ cuentas, ranking });
    } catch {
      // ignorar
    }
  });
}

function emitSesionRevocada(motivo: string) {
  sesionRevocadaListeners.forEach((cb) => {
    try {
      cb(motivo);
    } catch {
      // ignorar
    }
  });
}

export function obtenerDiagnosticoRed(): DiagnosticoDeRed {
  return { ...redDiag };
}

export function suscribirDiagnostico(cb: (diag: DiagnosticoDeRed) => void): () => void {
  diagListeners.add(cb);
  cb({ ...redDiag });
  return () => {
    diagListeners.delete(cb);
  };
}

export function suscribirCambiosNube(
  cb: (data: { cuentas: Record<string, UserCuenta>; ranking: Record<string, EntradaRanking> }) => void
): () => void {
  nubeListeners.add(cb);
  return () => {
    nubeListeners.delete(cb);
  };
}

export function suscribirSesionRevocada(cb: (motivo: string) => void): () => void {
  sesionRevocadaListeners.add(cb);
  return () => {
    sesionRevocadaListeners.delete(cb);
  };
}

// ============================================================================
// TOKEN DE SESIÓN Y CABECERAS DE AUTENTICACIÓN
// ============================================================================

export function obtenerTokenSesion(): string | null {
  try {
    return localStorage.getItem(SESION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function guardarTokenSesion(token: string | null) {
  try {
    if (token) localStorage.setItem(SESION_TOKEN_KEY, token);
    else localStorage.removeItem(SESION_TOKEN_KEY);
  } catch {
    // ignorar
  }
}

export function getApiBaseUrl(path: string = ''): string {
  return path;
}

function crearHeadersAutenticados(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
  const token = obtenerTokenSesion();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// COLA OFFLINE DE PARTIDAS PARA D1
// ============================================================================

interface ParticipantePartidaPayload {
  cuentaId?: string;
  nombre: string;
  resultado: 'victoria' | 'derrota' | 'empate';
  puntosGanados: number;
  movimientos: number;
  murosColocados: number;
  saltos: number;
  partidaLimpia: boolean;
  rival: string;
  logros: string[];
}

interface PartidaD1Payload {
  partidaId: string;
  fecha: string;
  modo: string;
  duracionSeg: number;
  participantes: ParticipantePartidaPayload[];
}

function leerColaOffline(): PartidaD1Payload[] {
  try {
    const raw = localStorage.getItem(COLA_OFFLINE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function guardarColaOffline(cola: PartidaD1Payload[]) {
  try {
    if (cola.length === 0) localStorage.removeItem(COLA_OFFLINE_KEY);
    else localStorage.setItem(COLA_OFFLINE_KEY, JSON.stringify(cola.slice(-30)));
  } catch {
    // ignorar
  }
}

function encolarPartidaOffline(payload: PartidaD1Payload) {
  const cola = leerColaOffline();
  if (!cola.some((p) => p.partidaId === payload.partidaId)) {
    cola.push(payload);
    guardarColaOffline(cola);
  }
}

export async function sincronizarColaPartidasOffline(): Promise<number> {
  const cola = leerColaOffline();
  if (cola.length === 0) return 0;

  try {
    const res = await fetch('/api/partidas/sincronizar', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ partidas: cola }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const sincronizadas = new Set<string>(Array.isArray(data?.sincronizadas) ? data.sincronizadas : []);
    if (sincronizadas.size > 0) {
      const restantes = cola.filter((p) => !sincronizadas.has(p.partidaId));
      guardarColaOffline(restantes);
      await sincronizarConNube(true);
    }
    return sincronizadas.size;
  } catch {
    return 0;
  }
}

// ============================================================================
// PING AL SERVIDOR Y ESCUCHA EN SEGUNDO PLANO
// ============================================================================

let syncInFlight: Promise<{ ok: boolean; dbConectado: boolean }> | null = null;
let lastPingAt = 0;

export async function pingServidor(): Promise<{ ok: boolean; dbConectado: boolean; lastUpdate: number }> {
  const now = Date.now();
  if (now - lastPingAt < 2500 && redDiag.checkedOnce) {
    return {
      ok: redDiag.ultimoPingOk,
      dbConectado: redDiag.dbConectado,
      lastUpdate: redDiag.lastUpdate,
    };
  }
  lastPingAt = now;
  const t0 = performance.now();
  try {
    const token = obtenerTokenSesion();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/ping?_t=${now}`, { cache: 'no-store', headers });
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) {
      redDiag = {
        ...redDiag,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        dbConectado: false,
        d1Conectado: false,
        ultimoPingOk: false,
        ultimoError: `HTTP ${res.status}`,
        serverPingMs: ms,
        checkedOnce: true,
      };
      emitDiag();
      return { ok: false, dbConectado: false, lastUpdate: redDiag.lastUpdate };
    }
    const data = await res.json();
    const isDb = Boolean(data?.dbBound ?? data?.d1Bound);
    const serverLastUpdate = Number(data?.lastUpdate) || 0;
    const prevLastUpdate = redDiag.lastUpdate;

    if (data?.sesionRevocada === true) {
      cerrarSesion();
      emitSesionRevocada('Se inició sesión en otro dispositivo (máximo 2 sesiones por cuenta).');
    }

    redDiag = {
      ...redDiag,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      dbConectado: isDb,
      d1Conectado: isDb,
      ultimoPingOk: true,
      ultimoError: null,
      serverPingMs: ms,
      checkedOnce: true,
      lastUpdate: serverLastUpdate,
    };
    emitDiag();

    if (isDb && leerColaOffline().length > 0) {
      sincronizarColaPartidasOffline().catch(() => {});
    }

    if (serverLastUpdate > 0 && serverLastUpdate !== prevLastUpdate) {
      sincronizarConNube(false).catch(() => {});
    }

    return { ok: true, dbConectado: isDb, lastUpdate: serverLastUpdate };
  } catch (err: any) {
    redDiag = {
      ...redDiag,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
      dbConectado: false,
      d1Conectado: false,
      ultimoPingOk: false,
      ultimoError: err?.message || 'Error de conexión con D1',
      serverPingMs: null,
      checkedOnce: true,
    };
    emitDiag();
    return { ok: false, dbConectado: false, lastUpdate: redDiag.lastUpdate };
  }
}

export function iniciarEscuchaNube(intervalMs: number = 30000): () => void {
  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    pingServidor().catch(() => {});
  }, intervalMs);

  return () => clearInterval(interval);
}

// ============================================================================
// LOGROS Y NIVELES
// ============================================================================

export const LOGROS_LISTA: DefLogro[] = [
  { id: 'primera_victoria', titulo: 'Primera Corona', descripcion: 'Gana tu primera partida en Muros Locos', icono: '👑' },
  { id: 'constructor', titulo: 'Arquitecto Experto', descripcion: 'Coloca al menos 8 muros en una partida ganada', icono: '🧱' },
  { id: 'saltarin', titulo: 'Saltarín Ágil', descripcion: 'Salta por encima de un rival 2 veces en una partida', icono: '🦘' },
  { id: 'partida_limpia', titulo: 'Paso Impecable', descripcion: 'Gana una partida completa sin cometer errores', icono: '✨' },
  { id: 'velocista', titulo: 'Rayo Veloz', descripcion: 'Gana una partida en menos de 20 movimientos', icono: '⚡' },
  { id: 'bot_dificil', titulo: 'Maestro Estratega', descripcion: 'Vence al Bot Maestro en modo Difícil', icono: '🤖' },
  { id: 'cuatro_jugadores', titulo: 'Rey de la Arena', descripcion: 'Gana una batalla campal de 4 jugadores', icono: '⚔️' },
  { id: 'racha_3', titulo: 'Imparable x3', descripcion: 'Consigue una racha de 3 victorias seguidas', icono: '🔥' },
];

export const NIVELES: InfoNivel[] = [
  { nivel: 1, titulo: 'Novato', icono: '🥚', minPuntos: 0, siguientePuntos: 100 },
  { nivel: 2, titulo: 'Aprendiz', icono: '🐥', minPuntos: 100, siguientePuntos: 300 },
  { nivel: 3, titulo: 'Constructor', icono: '🧱', minPuntos: 300, siguientePuntos: 600 },
  { nivel: 4, titulo: 'Estratega', icono: '🧭', minPuntos: 600, siguientePuntos: 1000 },
  { nivel: 5, titulo: 'Maestro', icono: '🛡️', minPuntos: 1000, siguientePuntos: 1800 },
  { nivel: 6, titulo: 'Leyenda', icono: '👑', minPuntos: 1800, siguientePuntos: null },
];

export function obtenerNivelYTitulo(puntosTotales: number): InfoNivel {
  for (let i = NIVELES.length - 1; i >= 0; i--) {
    if (puntosTotales >= NIVELES[i].minPuntos) {
      return NIVELES[i];
    }
  }
  return NIVELES[0];
}

// ============================================================================
// RANKING LOCAL VS GLOBAL (SEPARADOS ESTRICTAMENTE)
// ============================================================================

function normalizarEntradaRanking(key: string, raw: any): EntradaRanking | null {
  if (!raw || typeof raw !== 'object') return null;
  const nombre = String(raw.nombre || key || 'Jugador').trim().slice(0, 20);
  if (!nombre) return null;

  return {
    id: raw.id ? String(raw.id).trim().toLowerCase() : undefined,
    nombre,
    puntosTotales: Math.max(0, Math.round(Number(raw.puntosTotales) || 0)),
    partidas: Math.max(0, Math.round(Number(raw.partidas) || 0)),
    victorias: Math.max(0, Math.round(Number(raw.victorias) || 0)),
    derrotas: Math.max(0, Math.round(Number(raw.derrotas) || 0)),
    empates: Math.max(0, Math.round(Number(raw.empates) || 0)),
    rachaActual: Math.max(0, Math.round(Number(raw.rachaActual) || 0)),
    mejorRacha: Math.max(0, Math.round(Number(raw.mejorRacha) || 0)),
    murosTotales: Math.max(0, Math.round(Number(raw.murosTotales) || 0)),
    saltosTotales: Math.max(0, Math.round(Number(raw.saltosTotales) || 0)),
    partidasLimpias: Math.max(0, Math.round(Number(raw.partidasLimpias) || 0)),
    logros: Array.isArray(raw.logros)
      ? raw.logros
      : Array.isArray(raw.logrosDesbloqueados)
      ? raw.logrosDesbloqueados
      : [],
    ultimaPartida: typeof raw.ultimaPartida === 'string' ? raw.ultimaPartida : new Date().toISOString(),
    avatarColor: typeof raw.avatarColor === 'string' ? raw.avatarColor : '#ff6b6b',
    avatarHat: (raw.avatarHat as AvatarTipoDeGorro) || 'corona',
    avatarRopa: (raw.avatarRopa as AvatarTipoDeRopa) || 'ninguna',
    avatarRopaColor: raw.avatarRopaColor ? String(raw.avatarRopaColor) : undefined,
    avatarAura: (raw.avatarAura as AvatarTipoDeAura) || 'ninguna',
  };
}

export function cargarRankingLocal(): Record<string, EntradaRanking> {
  try {
    const raw = localStorage.getItem(RANKING_LOCAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: Record<string, EntradaRanking> = {};
    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([k, v]) => {
        const clean = normalizarEntradaRanking(k, v);
        if (clean) out[k] = clean;
      });
    }
    return out;
  } catch {
    return {};
  }
}

export function borrarRankingLocal() {
  try {
    localStorage.removeItem(RANKING_LOCAL_KEY);
  } catch {
    // ignorar
  }
}

export function actualizarNombreInvitadoLocal(nombreAnterior: string, nombreNuevo: string) {
  const cleanOld = nombreAnterior.trim().toLowerCase();
  const cleanNew = nombreNuevo.trim().slice(0, 15);
  if (!cleanNew || cleanOld === cleanNew.toLowerCase()) return;
  const local = cargarRankingLocal();
  const prev = local[cleanOld];
  if (prev) {
    delete local[cleanOld];
    prev.nombre = cleanNew;
    local[cleanNew.toLowerCase()] = prev;
    guardarRankingLocal(local);
  }
}

export function cargarRanking(): Record<string, EntradaRanking> {
  try {
    const raw = localStorage.getItem(RANKING_GLOBAL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: Record<string, EntradaRanking> = {};
    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([k, v]) => {
        const clean = normalizarEntradaRanking(k, v);
        if (!clean) return;
        const canonKey = (clean.id || k).trim().toLowerCase();
        const prev = out[canonKey];
        if (!prev) {
          out[canonKey] = clean;
        } else {
          out[canonKey] = {
            ...prev,
            ...clean,
            id: clean.id || prev.id,
            puntosTotales: Math.max(prev.puntosTotales, clean.puntosTotales),
            partidas: Math.max(prev.partidas, clean.partidas),
            victorias: Math.max(prev.victorias, clean.victorias),
          };
        }
      });
    }
    return out;
  } catch {
    return {};
  }
}

function guardarRankingLocal(data: Record<string, EntradaRanking>) {
  try {
    localStorage.setItem(RANKING_LOCAL_KEY, JSON.stringify(data));
  } catch {
    // ignorar
  }
}

function guardarRankingGlobalCache(data: Record<string, EntradaRanking>) {
  try {
    localStorage.setItem(RANKING_GLOBAL_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignorar
  }
}

// ============================================================================
// SINCRONIZACIÓN DE CUENTAS Y RANKING CON LA DATABASE D1
// ============================================================================

export async function sincronizarConNube(forzar: boolean = false): Promise<{
  ok: boolean;
  dbConectado: boolean;
  cuentas: Record<string, UserCuenta>;
  ranking: Record<string, EntradaRanking>;
}> {
  if (syncInFlight && !forzar) {
    const r = await syncInFlight;
    return { ...r, cuentas: cargarCuentas(), ranking: cargarRanking() };
  }

  const run = async (): Promise<{ ok: boolean; dbConectado: boolean }> => {
    const t0 = performance.now();
    try {
      const ts = Date.now();
      const token = obtenerTokenSesion();
      const [pingRes, cuentasRes, rankingRes] = await Promise.all([
        fetch(`/api/ping?_t=${ts}`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`/api/cuentas?_t=${ts}`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`/api/ranking?_t=${ts}`, { cache: 'no-store' }),
      ]);
      const ms = Math.round(performance.now() - t0);

      let isDb = false;
      let serverLastUpdate = redDiag.lastUpdate;
      if (pingRes.ok) {
        const pingData = await pingRes.json();
        isDb = Boolean(pingData?.dbBound ?? pingData?.d1Bound);
        serverLastUpdate = Number(pingData?.lastUpdate) || serverLastUpdate;
        if (pingData?.sesionRevocada === true) {
          cerrarSesion();
          emitSesionRevocada('Tu sesión expiró al superarse el límite de 2 sesiones activas.');
        }
      }

      if (!cuentasRes.ok || !rankingRes.ok) {
        redDiag = {
          ...redDiag,
          isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
          dbConectado: false,
          d1Conectado: false,
          ultimoPingOk: false,
          ultimoError: `Error HTTP cuentas:${cuentasRes.status} ranking:${rankingRes.status}`,
          serverPingMs: ms,
          checkedOnce: true,
        };
        emitDiag();
        return { ok: false, dbConectado: false };
      }

      const rawCuentas = await cuentasRes.json();
      const rawRanking = await rankingRes.json();

      const cuentasLimpias: Record<string, UserCuenta> = {};
      if (rawCuentas && typeof rawCuentas === 'object') {
        Object.entries(rawCuentas).forEach(([idKey, acc]: [string, any]) => {
          if (!acc || typeof acc !== 'object') return;
          const isSupremo = idKey === 'admin' || acc.id === 'admin' || Boolean(acc.esSupremo);
          const { claveHash: _h, claveSalt: _s, claveIter: _i, clave: _c, ...sinSecretos } = acc;
          cuentasLimpias[idKey] = {
            ...sinSecretos,
            id: acc.id || idKey,
            nombre: acc.nombre || idKey,
            rol: isSupremo ? 'dev' : (acc.rol || 'jugador'),
            esSupremo: isSupremo,
            avatarColor: acc.avatarColor || '#ff6b6b',
            avatarHat: (acc.avatarHat as AvatarTipoDeGorro) || 'corona',
            avatarRopa: (acc.avatarRopa as AvatarTipoDeRopa) || 'ninguna',
            avatarRopaColor: acc.avatarRopaColor || undefined,
            avatarAura: (acc.avatarAura as AvatarTipoDeAura) || 'ninguna',
            inventario:
              acc.inventario && typeof acc.inventario === 'object'
                ? {
                    personajes: Array.isArray(acc.inventario.personajes) ? acc.inventario.personajes : [],
                    activoId: acc.inventario.activoId || undefined,
                  }
                : { personajes: [] },
            puntos: Math.max(0, Number(acc.puntos) || 0),
            partidas: Math.max(0, Number(acc.partidas) || 0),
            victorias: Math.max(0, Number(acc.victorias) || 0),
            derrotas: Math.max(0, Number(acc.derrotas) || 0),
            empates: Math.max(0, Number(acc.empates) || 0),
            logrosDesbloqueados: Array.isArray(acc.logrosDesbloqueados) ? acc.logrosDesbloqueados : [],
            temaTablero: acc.temaTablero || 'madera',
            historialPartidas: Array.isArray(acc.historialPartidas) ? acc.historialPartidas : [],
            fechaRegistro: acc.fechaRegistro || new Date().toISOString(),
            ultimaConexion: acc.ultimaConexion || new Date().toISOString(),
          };
        });
      }

      const rankingLimpio: Record<string, EntradaRanking> = {};
      if (rawRanking && typeof rawRanking === 'object') {
        Object.entries(rawRanking).forEach(([k, v]) => {
          const norm = normalizarEntradaRanking(k, v);
          if (!norm) return;
          const canonKey = (norm.id || k).trim().toLowerCase();
          const prev = rankingLimpio[canonKey];
          if (!prev) {
            rankingLimpio[canonKey] = norm;
          } else {
            rankingLimpio[canonKey] = {
              ...prev,
              ...norm,
              id: norm.id || prev.id,
              puntosTotales: Math.max(prev.puntosTotales, norm.puntosTotales),
              partidas: Math.max(prev.partidas, norm.partidas),
              victorias: Math.max(prev.victorias, norm.victorias),
              derrotas: Math.max(prev.derrotas || 0, norm.derrotas || 0),
              empates: Math.max(prev.empates || 0, norm.empates || 0),
            };
          }
        });
      }

      Object.values(cuentasLimpias).forEach((acc) => {
        if (!acc) return;
        const key = String(acc.id).trim().toLowerCase();
        if (key === 'admin' && (acc.partidas || 0) === 0 && (acc.puntos || 0) === 0) return;

        // Si el backend antiguo envió una entrada con la clave del nombre en lugar del ID, fusionarla y limpiarla
        const legacyNameKey = String(acc.nombre || '').trim().toLowerCase();
        const legacyByName = legacyNameKey && legacyNameKey !== key ? rankingLimpio[legacyNameKey] : undefined;
        if (legacyByName && (!legacyByName.id || legacyByName.id === key)) {
          delete rankingLimpio[legacyNameKey];
        }

        const existing = rankingLimpio[key] || (legacyByName && (!legacyByName.id || legacyByName.id === key) ? legacyByName : undefined);
        rankingLimpio[key] = {
          id: key,
          nombre: acc.nombre,
          puntosTotales: Math.max(acc.puntos || 0, existing?.puntosTotales || 0),
          partidas: Math.max(acc.partidas || 0, existing?.partidas || 0),
          victorias: Math.max(acc.victorias || 0, existing?.victorias || 0),
          derrotas: Math.max(acc.derrotas || 0, existing?.derrotas || 0),
          empates: Math.max(acc.empates || 0, existing?.empates || 0),
          rachaActual: existing?.rachaActual || 0,
          mejorRacha: existing?.mejorRacha || 0,
          murosTotales: existing?.murosTotales || 0,
          saltosTotales: existing?.saltosTotales || 0,
          partidasLimpias: existing?.partidasLimpias || 0,
          logros: acc.logrosDesbloqueados || existing?.logros || [],
          ultimaPartida: acc.ultimaConexion || existing?.ultimaPartida || new Date().toISOString(),
          avatarColor: acc.avatarColor || existing?.avatarColor || '#ff6b6b',
          avatarHat: acc.avatarHat || existing?.avatarHat || 'corona',
          avatarRopa: acc.avatarRopa || existing?.avatarRopa || 'ninguna',
          avatarRopaColor: acc.avatarRopaColor || existing?.avatarRopaColor || undefined,
          avatarAura: acc.avatarAura || existing?.avatarAura || 'ninguna',
        };
      });

      guardarCuentasCache(cuentasLimpias);
      guardarRankingGlobalCache(rankingLimpio);

      const cur = obteneruserActual();
      if (cur && cur.id !== 'admin') {
        const fresh = cuentasLimpias[cur.id];
        if (fresh) {
          guardarUserActual(fresh);
        }
      }

      redDiag = {
        ...redDiag,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        dbConectado: isDb,
        d1Conectado: isDb,
        ultimoPingOk: true,
        ultimaSincronizacion: new Date().toLocaleTimeString(),
        ultimoError: null,
        serverPingMs: ms,
        checkedOnce: true,
        lastUpdate: serverLastUpdate,
      };
      emitDiag();
      emitNube(cuentasLimpias, rankingLimpio);

      return { ok: true, dbConectado: isDb };
    } catch (err: any) {
      redDiag = {
        ...redDiag,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
        dbConectado: false,
        d1Conectado: false,
        ultimoPingOk: false,
        ultimoError: err?.message || 'Error de red sincronizando D1',
        serverPingMs: null,
        checkedOnce: true,
      };
      emitDiag();
      return { ok: false, dbConectado: false };
    }
  };

  syncInFlight = run().finally(() => {
    syncInFlight = null;
  });

  const result = await syncInFlight;
  return { ...result, cuentas: cargarCuentas(), ranking: cargarRanking() };
}

// ============================================================================
// REGISTRO DE PARTIDAS EN LOCAL + DATABASE D1 (/api/partida)
// ============================================================================

export function actualizarDespuesDePartida(
  estadoFinal: EstadoDeJuego,
  desgloses: Map<number, DesglosePuntos>,
  duracionSegundos: number = 0
): {
  nuevosLogrosPorJugador: Map<string, DefLogro[]>;
  subidasNivelPorJugador: Map<string, { anterior: InfoNivel; nuevo: InfoNivel }>;
} {
  const cuentas = cargarCuentas();
  const rankingLocal = cargarRankingLocal();
  const rankingGlobal = cargarRanking();
  const sesionActiva = obteneruserActual();
  const nowIso = new Date().toISOString();
  const partidaId = `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const nuevosLogrosPorJugador = new Map<string, DefLogro[]>();
  const subidasNivelPorJugador = new Map<string, { anterior: InfoNivel; nuevo: InfoNivel }>();
  const participantesD1: ParticipantePartidaPayload[] = [];

  const ganadorId = estadoFinal.ganador;
  const hayBotDificil = estadoFinal.jugadores.some((j) => j.tipo === 'bot_dificil');
  const esCuatroJugadores = estadoFinal.n === 4;
  const modoTexto = estadoFinal.modoOnline
    ? 'online'
    : estadoFinal.torneo?.activo
    ? 'torneo'
    : 'local';

  for (const j of estadoFinal.jugadores) {
    if (j.tipo !== 'humano') continue;

    const cleanNombre = j.nombre.trim();
    const localKey = cleanNombre.toLowerCase();
    const gano = ganadorId === j.id;
    const empato = ganadorId === -1 || ganadorId === null;
    const puntosGanados = desgloses.get(j.id)?.total || 0;

    // 1) Ranking Local del dispositivo
    const lEntry: EntradaRanking = rankingLocal[localKey] || {
      nombre: cleanNombre,
      puntosTotales: 0,
      partidas: 0,
      victorias: 0,
      derrotas: 0,
      empates: 0,
      rachaActual: 0,
      mejorRacha: 0,
      murosTotales: 0,
      saltosTotales: 0,
      partidasLimpias: 0,
      logros: [],
      ultimaPartida: nowIso,
      avatarColor: j.color,
      avatarHat: j.hat,
      avatarRopa: j.ropa || 'ninguna',
      avatarRopaColor: j.ropaColor,
      avatarAura: j.aura || 'ninguna',
    };

    const nivelAntesLocal = obtenerNivelYTitulo(lEntry.puntosTotales);
    lEntry.partidas += 1;
    lEntry.puntosTotales = Math.max(0, lEntry.puntosTotales + puntosGanados);
    lEntry.murosTotales += j.estadisticas.murosColocados;
    lEntry.saltosTotales += j.estadisticas.saltos;
    if (j.estadisticas.partidaLimpia && gano) lEntry.partidasLimpias += 1;

    if (gano) {
      lEntry.victorias += 1;
      lEntry.rachaActual += 1;
      if (lEntry.rachaActual > lEntry.mejorRacha) lEntry.mejorRacha = lEntry.rachaActual;
    } else if (empato) {
      lEntry.empates = (lEntry.empates || 0) + 1;
    } else {
      lEntry.derrotas += 1;
      lEntry.rachaActual = 0;
    }

    // Calcular logros nuevos
    const logrosPrevios = new Set(lEntry.logros || []);
    const nuevosIds: string[] = [];
    const evalLogro = (id: string, cond: boolean) => {
      if (cond && !logrosPrevios.has(id)) {
        logrosPrevios.add(id);
        nuevosIds.push(id);
      }
    };
    evalLogro('primera_victoria', gano);
    evalLogro('constructor', gano && j.estadisticas.murosColocados >= 8);
    evalLogro('saltarin', j.estadisticas.saltos >= 2);
    evalLogro('partida_limpia', gano && j.estadisticas.partidaLimpia);
    evalLogro('velocista', gano && j.estadisticas.movimientos < 20);
    evalLogro('bot_dificil', gano && hayBotDificil);
    evalLogro('cuatro_jugadores', gano && esCuatroJugadores);
    evalLogro('racha_3', lEntry.rachaActual >= 3);

    lEntry.logros = Array.from(logrosPrevios);
    lEntry.ultimaPartida = nowIso;
    lEntry.avatarColor = j.color;
    lEntry.avatarHat = j.hat;
    lEntry.avatarRopa = j.ropa || 'ninguna';
    lEntry.avatarRopaColor = j.ropaColor;
    lEntry.avatarAura = j.aura || 'ninguna';
    rankingLocal[localKey] = lEntry;

    if (nuevosIds.length > 0) {
      nuevosLogrosPorJugador.set(
        localKey,
        LOGROS_LISTA.filter((d) => nuevosIds.includes(d.id))
      );
    }

    const nivelDespuesLocal = obtenerNivelYTitulo(lEntry.puntosTotales);
    if (nivelDespuesLocal.nivel > nivelAntesLocal.nivel) {
      subidasNivelPorJugador.set(localKey, {
        anterior: nivelAntesLocal,
        nuevo: nivelDespuesLocal,
      });
    }

    // 2) Identificar cuenta registrada vinculada en D1 (por cuentaId o coincidencia exacta)
    let matchingAcc: UserCuenta | undefined;
    if (j.cuentaId && cuentas[j.cuentaId]) {
      matchingAcc = cuentas[j.cuentaId];
    } else if (
      sesionActiva &&
      (sesionActiva.id === j.cuentaId ||
        sesionActiva.nombre.trim().toLowerCase() === cleanNombre.toLowerCase())
    ) {
      matchingAcc = cuentas[sesionActiva.id] || sesionActiva;
    } else {
      matchingAcc = Object.values(cuentas).find(
        (acc) => acc.nombre.trim().toLowerCase() === cleanNombre.toLowerCase()
      );
    }

    if (!matchingAcc) continue;

    const otrosNombres = estadoFinal.jugadores
      .filter((o) => o.id !== j.id)
      .map((o) => o.nombre);
    const rivalLabel = otrosNombres.join(' vs ') || 'Rival';
    const resultadoLabel: 'victoria' | 'derrota' | 'empate' = gano
      ? 'victoria'
      : empato
      ? 'empate'
      : 'derrota';

    const entry: EntradaRanking = rankingGlobal[matchingAcc.id] || {
      id: matchingAcc.id,
      nombre: matchingAcc.nombre,
      puntosTotales: matchingAcc.puntos || 0,
      partidas: matchingAcc.partidas || 0,
      victorias: matchingAcc.victorias || 0,
      derrotas: matchingAcc.derrotas || 0,
      empates: matchingAcc.empates || 0,
      rachaActual: 0,
      mejorRacha: 0,
      murosTotales: 0,
      saltosTotales: 0,
      partidasLimpias: 0,
      logros: matchingAcc.logrosDesbloqueados || [],
      ultimaPartida: nowIso,
      avatarColor: matchingAcc.avatarColor,
      avatarHat: matchingAcc.avatarHat,
      avatarRopa: matchingAcc.avatarRopa,
      avatarRopaColor: matchingAcc.avatarRopaColor,
      avatarAura: matchingAcc.avatarAura,
    };

    const nivelAntesCloud = obtenerNivelYTitulo(entry.puntosTotales);
    entry.partidas += 1;
    entry.puntosTotales = Math.max(0, entry.puntosTotales + puntosGanados);
    entry.murosTotales += j.estadisticas.murosColocados;
    entry.saltosTotales += j.estadisticas.saltos;
    if (j.estadisticas.partidaLimpia && gano) entry.partidasLimpias += 1;
    if (gano) {
      entry.victorias += 1;
      entry.rachaActual += 1;
      if (entry.rachaActual > entry.mejorRacha) entry.mejorRacha = entry.rachaActual;
    } else if (empato) {
      entry.empates = (entry.empates || 0) + 1;
    } else {
      entry.derrotas += 1;
      entry.rachaActual = 0;
    }
    entry.ultimaPartida = nowIso;
    const setLogrosG = new Set([...(entry.logros || []), ...lEntry.logros]);
    entry.logros = Array.from(setLogrosG);
    rankingGlobal[matchingAcc.id] = entry;

    const nivelDespuesCloud = obtenerNivelYTitulo(entry.puntosTotales);
    if (nivelDespuesCloud.nivel > nivelAntesCloud.nivel) {
      subidasNivelPorJugador.set(localKey, {
        anterior: nivelAntesCloud,
        nuevo: nivelDespuesCloud,
      });
    }

    const nuevaEntradaHist = {
      id: partidaId,
      fecha: nowIso,
      rival: rivalLabel,
      resultado: resultadoLabel,
      puntosGanados,
      movimientos: j.estadisticas.movimientos,
      murosColocados: j.estadisticas.murosColocados,
      saltos: j.estadisticas.saltos,
      partidaLimpia: j.estadisticas.partidaLimpia,
      modo: modoTexto,
      duracionSegundos: Math.round(duracionSegundos),
      logros: nuevosIds,
    };

    matchingAcc.puntos = entry.puntosTotales;
    matchingAcc.partidas = entry.partidas;
    matchingAcc.victorias = entry.victorias;
    matchingAcc.derrotas = entry.derrotas;
    matchingAcc.empates = entry.empates;
    matchingAcc.logrosDesbloqueados = entry.logros;
    matchingAcc.ultimaConexion = nowIso;
    matchingAcc.historialPartidas = [
      nuevaEntradaHist,
      ...(matchingAcc.historialPartidas || []),
    ].slice(0, 50);
    cuentas[matchingAcc.id] = matchingAcc;

    if (sesionActiva && sesionActiva.id === matchingAcc.id) {
      guardarUserActual(matchingAcc);
    }

    participantesD1.push({
      cuentaId: matchingAcc.id,
      nombre: matchingAcc.nombre,
      resultado: resultadoLabel,
      puntosGanados,
      movimientos: j.estadisticas.movimientos,
      murosColocados: j.estadisticas.murosColocados,
      saltos: j.estadisticas.saltos,
      partidaLimpia: j.estadisticas.partidaLimpia,
      rival: rivalLabel,
      logros: nuevosIds,
    });
  }

  guardarRankingLocal(rankingLocal);
  guardarRankingGlobalCache(rankingGlobal);
  guardarCuentasCache(cuentas);

  if (participantesD1.length > 0) {
    const payloadD1: PartidaD1Payload = {
      partidaId,
      fecha: nowIso,
      modo: modoTexto,
      duracionSeg: Math.max(0, Math.round(duracionSegundos)),
      participantes: participantesD1,
    };

    fetch('/api/partida', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify(payloadD1),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data?.guardados) || data.guardados.length === 0) {
          encolarPartidaOffline(payloadD1);
          return;
        }
        await sincronizarConNube(true);
      })
      .catch(() => {
        encolarPartidaOffline(payloadD1);
      });
  }

  return { nuevosLogrosPorJugador, subidasNivelPorJugador };
}

export function penalizarAbandono(
  nombre: string,
  puntosPerdidos: number = 5,
  cuentaId?: string
) {
  const cleanNombre = nombre.trim();
  const sesionActiva = obteneruserActual();
  const cuentas = cargarCuentas();
  const rankingLocal = cargarRankingLocal();
  const rankingGlobal = cargarRanking();
  const nowIso = new Date().toISOString();
  const partidaId = `pt_ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const localKey = cleanNombre.toLowerCase();
  if (rankingLocal[localKey]) {
    rankingLocal[localKey].partidas += 1;
    rankingLocal[localKey].derrotas += 1;
    rankingLocal[localKey].rachaActual = 0;
    rankingLocal[localKey].puntosTotales = Math.max(0, rankingLocal[localKey].puntosTotales - puntosPerdidos);
    guardarRankingLocal(rankingLocal);
  }

  let matchingAcc: UserCuenta | undefined;
  if (cuentaId && cuentas[cuentaId]) {
    matchingAcc = cuentas[cuentaId];
  } else if (
    sesionActiva &&
    (sesionActiva.id === cuentaId ||
      sesionActiva.nombre.trim().toLowerCase() === cleanNombre.toLowerCase())
  ) {
    matchingAcc = cuentas[sesionActiva.id] || sesionActiva;
  } else {
    matchingAcc = Object.values(cuentas).find(
      (acc) => acc.nombre.trim().toLowerCase() === cleanNombre.toLowerCase()
    );
  }

  if (!matchingAcc) return;

  matchingAcc.partidas = (matchingAcc.partidas || 0) + 1;
  matchingAcc.derrotas = (matchingAcc.derrotas || 0) + 1;
  matchingAcc.puntos = Math.max(0, (matchingAcc.puntos || 0) - puntosPerdidos);
  matchingAcc.ultimaConexion = nowIso;
  matchingAcc.historialPartidas = [
    {
      id: partidaId,
      fecha: nowIso,
      rival: 'Abandono de partida',
      resultado: 'derrota' as const,
      puntosGanados: 0,
      movimientos: 0,
      murosColocados: 0,
      saltos: 0,
      partidaLimpia: false,
      modo: 'abandono',
      duracionSegundos: 0,
      logros: [],
    },
    ...(matchingAcc.historialPartidas || []),
  ].slice(0, 50);
  cuentas[matchingAcc.id] = matchingAcc;

  if (rankingGlobal[matchingAcc.id]) {
    rankingGlobal[matchingAcc.id].partidas += 1;
    rankingGlobal[matchingAcc.id].derrotas += 1;
    rankingGlobal[matchingAcc.id].rachaActual = 0;
    rankingGlobal[matchingAcc.id].puntosTotales = matchingAcc.puntos;
    guardarRankingGlobalCache(rankingGlobal);
  }

  guardarCuentasCache(cuentas);
  if (sesionActiva && sesionActiva.id === matchingAcc.id) {
    guardarUserActual(matchingAcc);
  }

  const payloadD1: PartidaD1Payload = {
    partidaId,
    fecha: nowIso,
    modo: 'abandono',
    duracionSeg: 0,
    participantes: [
      {
        cuentaId: matchingAcc.id,
        nombre: matchingAcc.nombre,
        resultado: 'derrota',
        puntosGanados: 0,
        movimientos: 0,
        murosColocados: 0,
        saltos: 0,
        partidaLimpia: false,
        rival: 'Abandono de partida',
        logros: [],
      },
    ],
  };

  fetch('/api/partida', {
    method: 'POST',
    headers: crearHeadersAutenticados(),
    body: JSON.stringify(payloadD1),
  })
    .then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !Array.isArray(data?.guardados) || data.guardados.length === 0) {
        encolarPartidaOffline(payloadD1);
        return;
      }
      await sincronizarConNube(true);
    })
    .catch(() => {
      encolarPartidaOffline(payloadD1);
    });
}

// ============================================================================
// AJUSTES LOCALES DE LA APLICACIÓN
// ============================================================================

export function cargarAjustes(): AjustesDeApp {
  try {
    const raw = localStorage.getItem(AJUSTES_KEY);
    if (!raw) {
      return {
        sonido: true,
        mostrarDistancia: true,
        mostrarCoordenadas: true,
        modoDaltonico: false,
        animacionesReducidas: false,
        permitirDeshacer: true,
        permitirPistas: true,
        temaTablero: 'madera',
        cambiarVistaPorTurno: false,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      sonido: parsed.sonido !== false,
      mostrarDistancia: parsed.mostrarDistancia !== false,
      mostrarCoordenadas: parsed.mostrarCoordenadas !== false,
      modoDaltonico: Boolean(parsed.modoDaltonico),
      animacionesReducidas: Boolean(parsed.animacionesReducidas),
      permitirDeshacer: parsed.permitirDeshacer !== false,
      permitirPistas: parsed.permitirPistas !== false,
      temaTablero: (parsed.temaTablero as TemaTablero) || 'madera',
      cambiarVistaPorTurno: Boolean(parsed.cambiarVistaPorTurno),
    };
  } catch {
    return {
      sonido: true,
      mostrarDistancia: true,
      mostrarCoordenadas: true,
      modoDaltonico: false,
      animacionesReducidas: false,
      permitirDeshacer: true,
      permitirPistas: true,
      temaTablero: 'madera',
      cambiarVistaPorTurno: false,
    };
  }
}

export function guardarAjustes(ajustes: AjustesDeApp) {
  try {
    localStorage.setItem(AJUSTES_KEY, JSON.stringify(ajustes));
  } catch {
    // ignorar
  }
}

// ============================================================================
// RESPALDO EXPORTACIÓN / IMPORTACIÓN LOCAL
// ============================================================================

export function exportarDatosJSON(): string {
  return JSON.stringify(
    {
      rankingLocal: cargarRankingLocal(),
      ajustes: cargarAjustes(),
      fechaExportacion: new Date().toISOString(),
    },
    null,
    2
  );
}

export async function importarDatosJSONAsync(jsonString: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const data = JSON.parse(jsonString);
    if (data.rankingLocal && typeof data.rankingLocal === 'object') {
      guardarRankingLocal(data.rankingLocal);
    }
    if (data.ajustes && typeof data.ajustes === 'object') {
      guardarAjustes(data.ajustes);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'El archivo JSON no tiene un formato válido.' };
  }
}

// ============================================================================
// GESTIÓN DE CUENTAS Y SESIONES CON DATABASE D1
// ============================================================================

export function cargarCuentas(): Record<string, UserCuenta> {
  let out: Record<string, UserCuenta> = {};
  try {
    const raw = localStorage.getItem(CUENTAS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([k, v]: [string, any]) => {
          if (!v || typeof v !== 'object') return;
          const { clave: _c, claveHash: _h, claveSalt: _s, claveIter: _i, ...sinSecretos } = v;
          out[k] = sinSecretos as UserCuenta;
        });
      }
    }
  } catch {
    out = {};
  }

  // Perfil reservado del Dev Supremo Único (estadísticas reales a 0, sin clave en cliente)
  const adminPrev = out['admin'];
  out['admin'] = {
    id: 'admin',
    nombre: adminPrev?.nombre || 'Dev Supremo',
    rol: 'dev',
    esSupremo: true,
    avatarColor: adminPrev?.avatarColor || '#ffd43b',
    avatarHat: adminPrev?.avatarHat || 'corona',
    avatarRopa: adminPrev?.avatarRopa || 'ninguna',
    avatarRopaColor: adminPrev?.avatarRopaColor || undefined,
    avatarAura: adminPrev?.avatarAura || 'ninguna',
    inventario: adminPrev?.inventario || { personajes: [] },
    puntos: Number(adminPrev?.puntos) || 0,
    partidas: Number(adminPrev?.partidas) || 0,
    victorias: Number(adminPrev?.victorias) || 0,
    derrotas: Number(adminPrev?.derrotas) || 0,
    empates: Number(adminPrev?.empates) || 0,
    logrosDesbloqueados: adminPrev?.logrosDesbloqueados || [],
    temaTablero: adminPrev?.temaTablero || 'madera',
    historialPartidas: adminPrev?.historialPartidas || [],
    fechaRegistro: adminPrev?.fechaRegistro || '2026-01-01T00:00:00.000Z',
    ultimaConexion: adminPrev?.ultimaConexion || new Date().toISOString(),
  };

  return out;
}

function guardarCuentasCache(cuentas: Record<string, UserCuenta>) {
  try {
    const limpias: Record<string, UserCuenta> = {};
    Object.entries(cuentas).forEach(([k, v]) => {
      if (!v) return;
      const { clave: _c, ...rest } = v;
      limpias[k] = rest;
    });
    localStorage.setItem(CUENTAS_CACHE_KEY, JSON.stringify(limpias));
  } catch {
    // ignorar
  }
}

export function obteneruserActual(): UserCuenta | null {
  try {
    const raw = localStorage.getItem(SESION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;
    const cuentas = cargarCuentas();
    if (parsed.id === 'admin') {
      return {
        ...cuentas['admin'],
        ...parsed,
        id: 'admin',
        rol: 'dev',
        esSupremo: true,
        clave: '',
      };
    }
    return cuentas[parsed.id] || { ...parsed, clave: '' };
  } catch {
    return null;
  }
}

export function guardarUserActual(user: UserCuenta | null) {
  try {
    if (!user) {
      localStorage.removeItem(SESION_KEY);
      guardarTokenSesion(null);
      return;
    }
    const { clave: _c, ...userLimpio } = user;
    if (userLimpio.id === 'admin') {
      userLimpio.rol = 'dev';
      userLimpio.esSupremo = true;
    }
    localStorage.setItem(SESION_KEY, JSON.stringify(userLimpio));
  } catch {
    // ignorar
  }
}

export function cerrarSesion() {
  guardarUserActual(null);
}

export async function iniciarSesionAsync(
  nombre: string,
  clave: string
): Promise<{ ok: boolean; user?: UserCuenta; error?: string; offline?: boolean }> {
  const cleanNombre = nombre.trim();
  const cleanClave = clave.trim();
  if (!cleanNombre || !cleanClave) {
    return { ok: false, error: 'Ingresa tu User ID y contraseña.' };
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: cleanNombre, clave: cleanClave }),
    });
    const data = await res.json();

    if (res.ok && data?.ok && data?.user) {
      if (data.token) guardarTokenSesion(data.token);
      const user: UserCuenta = {
        ...data.user,
        rol: data.user.id === 'admin' ? 'dev' : (data.user.rol || 'jugador'),
        esSupremo: Boolean(data.user.id === 'admin' || data.user.esSupremo),
      };
      guardarUserActual(user);
      const cuentas = cargarCuentas();
      cuentas[user.id] = user;
      guardarCuentasCache(cuentas);
      await sincronizarConNube(true);
      return { ok: true, user: obteneruserActual() || user };
    }

    return { ok: false, error: data?.error || 'User ID o contraseña incorrectos.' };
  } catch {
    return {
      ok: false,
      offline: true,
      error: 'Sin conexión a la Database D1. Verifica tu red para iniciar sesión.',
    };
  }
}

export const autenticarUserAsync = iniciarSesionAsync;

export async function registrarUserAsync(
  nombre: string,
  clave: string,
  avatarColor: string,
  avatarHat: AvatarTipoDeGorro,
  temaTablero: TemaTablero = 'madera'
): Promise<{ ok: boolean; user?: UserCuenta; error?: string; offline?: boolean }> {
  const cleanNombre = nombre.trim();
  const cleanClave = clave.trim();

  if (cleanNombre.length < 3 || cleanNombre.length > 15) {
    return { ok: false, error: 'El nombre debe tener entre 3 y 15 caracteres.' };
  }
  if (cleanClave.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
  }

  try {
    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: cleanNombre,
        clave: cleanClave,
        avatarColor,
        avatarHat,
        temaTablero,
      }),
    });
    const data = await res.json();

    if (res.ok && data?.ok && data?.user) {
      if (data.token) guardarTokenSesion(data.token);
      const user: UserCuenta = {
        ...data.user,
        rol: data.user.rol || 'jugador',
      };
      guardarUserActual(user);
      const cuentas = cargarCuentas();
      cuentas[user.id] = user;
      guardarCuentasCache(cuentas);
      await sincronizarConNube(true);
      return { ok: true, user: obteneruserActual() || user };
    }

    return { ok: false, error: data?.error || 'No se pudo completar el registro.' };
  } catch {
    return {
      ok: false,
      offline: true,
      error: 'No se pudo conectar con la Database D1 para crear la cuenta.',
    };
  }
}

export async function D1_VerificarAccionAdmin(
  user: UserCuenta | null,
  requiereSupremo: boolean = false
): Promise<{
  ok: boolean;
  revocado?: boolean;
  error?: string;
  rolActual?: UserRol;
}> {
  if (!user) {
    return { ok: false, error: 'Debes iniciar sesión como Staff.' };
  }

  try {
    const res = await fetch('/api/admin/verify-action', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({
        actorId: user.id,
        requiereSupremo,
      }),
    });
    const data = await res.json();

    if (res.ok && data?.ok) {
      return { ok: true, rolActual: (data.rol as UserRol) || user.rol };
    }
    return {
      ok: false,
      revocado: Boolean(data?.revoked),
      error: data?.error || 'Permisos de administración inválidos o revocados.',
    };
  } catch {
    const esLocalValido =
      user.id === 'admin' ||
      user.rol === 'dev' ||
      (!requiereSupremo && (user.rol === 'admin' || user.rol === 'mod'));
    return esLocalValido
      ? { ok: true, rolActual: user.rol }
      : { ok: false, error: 'No se pudo verificar con la Database.' };
  }
}

export async function actualizarCuentaAsync(
  userActual: UserCuenta,
  patch: {
    nombre?: string;
    avatarColor?: string;
    avatarHat?: AvatarTipoDeGorro;
    avatarRopa?: AvatarTipoDeRopa;
    avatarRopaColor?: string;
    avatarAura?: AvatarTipoDeAura;
    temaTablero?: TemaTablero;
    inventario?: UserInventario;
  }
): Promise<{ ok: boolean; user?: UserCuenta; error?: string }> {
  try {
    const res = await fetch('/api/perfil/actualizar', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({
        nombre: patch.nombre,
        avatarColor: patch.avatarColor,
        avatarHat: patch.avatarHat,
        avatarRopa: patch.avatarRopa,
        avatarRopaColor: patch.avatarRopaColor,
        avatarAura: patch.avatarAura,
        temaTablero: patch.temaTablero,
        inventario: patch.inventario,
      }),
    });
    const data = await res.json();

    if (res.ok && data?.ok && data?.user) {
      const updated: UserCuenta = {
        ...userActual,
        ...data.user,
      };
      guardarUserActual(updated);
      const cuentas = cargarCuentas();
      cuentas[updated.id] = updated;
      guardarCuentasCache(cuentas);
      await sincronizarConNube(true);
      return { ok: true, user: obteneruserActual() || updated };
    }
    return { ok: false, error: data?.error || 'No se pudo guardar en la Database.' };
  } catch {
    return { ok: false, error: 'Error de red guardando perfil.' };
  }
}

export async function cambiarClaveUserAsync(
  claveActual: string,
  claveNueva: string
): Promise<{ ok: boolean; error?: string; mensaje?: string }> {
  const cur = obteneruserActual();
  if (!cur) return { ok: false, error: 'Debes iniciar sesión.' };

  try {
    const res = await fetch('/api/perfil/cambiar-clave', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({
        userId: cur.id,
        claveActual,
        nuevaClave: claveNueva,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'No se pudo cambiar la clave.' };
    }
    if (data.token) {
      guardarTokenSesion(data.token);
    }
    if (data.user) {
      guardarUserActual({ ...cur, ...data.user });
    }
    return { ok: true, mensaje: data.mensaje || 'Clave actualizada con éxito.' };
  } catch {
    return { ok: false, error: 'Error de red contactando D1.' };
  }
}

export async function darDeBajaUserAsync(
  claveConfirmacion: string
): Promise<{ ok: boolean; error?: string }> {
  const cur = obteneruserActual();
  if (!cur) return { ok: false, error: 'Debes iniciar sesión.' };
  if (cur.id === 'admin') {
    return { ok: false, error: 'La cuenta del Dev Supremo no puede darse de baja.' };
  }

  try {
    const res = await fetch('/api/perfil/dar-de-baja', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({
        userId: cur.id,
        clave: claveConfirmacion,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'No se pudo dar de baja tu cuenta.' };
    }
    cerrarSesion();
    await sincronizarConNube(true);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Error de red al eliminar la cuenta.' };
  }
}

// ============================================================================
// FUNCIONES ADMINISTRATIVAS (DEV / ADMIN / MOD)
// ============================================================================

export async function adminActualizarUserAsync(
  targetId: string,
  patch: {
    nombre?: string;
    rol?: UserRol;
    puntos?: number;
    victorias?: number;
    partidas?: number;
    clave?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/actualizar-user', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ targetId, patch }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'No se pudo actualizar el user.' };
    }
    await sincronizarConNube(true);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Error de red actualizando user en D1.' };
  }
}

export async function adminCambiarIdUserAsync(
  oldId: string,
  newId: string
): Promise<{ ok: boolean; error?: string; mensaje?: string }> {
  try {
    const res = await fetch('/api/admin/cambiar-id', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ oldId, newId }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'No se pudo cambiar el ID.' };
    }
    await sincronizarConNube(true);
    return { ok: true, mensaje: data.mensaje };
  } catch {
    return { ok: false, error: 'Error de red cambiando ID en cascada.' };
  }
}

export async function adminEliminarUserAsync(
  targetId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/eliminar-user', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ targetId }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'No se pudo eliminar el user.' };
    }
    await sincronizarConNube(true);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Error de red al eliminar user.' };
  }
}

export async function restablecerClaveUserAsync(
  targetId: string
): Promise<{ ok: boolean; claveTemporal?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/restablecer-clave', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ targetId }),
    });
    const data = await res.json();
    if (res.ok && data?.ok && data?.claveTemporal) {
      return { ok: true, claveTemporal: data.claveTemporal };
    }
    return { ok: false, error: data?.error || 'No se pudo restablecer la clave.' };
  } catch {
    return { ok: false, error: 'Error de conexión con la Database.' };
  }
}

export async function adminResetearRankingAsync(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/ranking/aprobar-reset', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'No se pudo reiniciar el Ranking.' };
    }
    await sincronizarConNube(true);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Error de red reiniciando el Ranking.' };
  }
}

export const aprobarResetRankingAsync = adminResetearRankingAsync;

export async function solicitarResetRankingAsync(
  motivo: string = 'Solicitud de reinicio desde panel Admin'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/ranking/solicitar-reset', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ motivo }),
    });
    const data = await res.json();
    return res.ok && data?.ok ? { ok: true } : { ok: false, error: data?.error };
  } catch {
    return { ok: false, error: 'Error enviando solicitud.' };
  }
}

export async function obtenerSolicitudResetRankingAsync(): Promise<SolicitudResetRanking | null> {
  try {
    const res = await fetch(`/api/admin/ranking/solicitud-reset?_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.solicitud || null;
  } catch {
    return null;
  }
}

export async function rechazarResetRankingAsync(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/ranking/rechazar-reset', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    return res.ok && data?.ok ? { ok: true } : { ok: false, error: data?.error };
  } catch {
    return { ok: false, error: 'Error rechazando solicitud.' };
  }
}

// ============================================================================
// PERSONAJES EXCLUSIVOS, REGALOS, MOVIMIENTO Y RETIRO
// ============================================================================

export async function regalarPersonajeAsync(
  targetId: string,
  personaje: {
    nombre: string;
    color: string;
    hat: AvatarTipoDeGorro;
    ropa: AvatarTipoDeRopa;
    ropaColor?: string;
    aura: AvatarTipoDeAura;
    descripcion?: string;
  }
): Promise<{ ok: boolean; error?: string; personaje?: AvatarColeccionable }> {
  try {
    const res = await fetch('/api/admin/personajes/regalar', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ targetId, personaje }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'Error al regalar avatar.' };
    }
    // Solo recargar la nube; jamás cambiar el aspecto equipado del administrador que regala
    await sincronizarConNube(true);
    return { ok: true, personaje: data.personaje };
  } catch {
    return { ok: false, error: 'Error de red enviando avatar.' };
  }
}

export async function quitarPersonajeInventarioAsync(
  targetId: string,
  personajeId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/personajes/quitar', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ targetId, personajeId }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'Error al retirar avatar.' };
    }
    await sincronizarConNube(true);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Error de red retirando avatar.' };
  }
}

export async function moverPersonajeInventarioAsync(
  fromId: string,
  toId: string,
  personajeId: string
): Promise<{ ok: boolean; error?: string; mensaje?: string }> {
  try {
    const res = await fetch('/api/admin/personajes/mover', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ fromId, toId, personajeId }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'Error al mover avatar.' };
    }
    await sincronizarConNube(true);
    return { ok: true, mensaje: data.mensaje };
  } catch {
    return { ok: false, error: 'Error de red moviendo avatar.' };
  }
}

export async function equiparPersonajeInventario(
  user: UserCuenta,
  personajeId: string | null
): Promise<{ ok: boolean; user?: UserCuenta; error?: string }> {
  const invActual: UserInventario = user.inventario || { personajes: [] };
  let nuevoColor = user.avatarColor;
  let nuevoHat = user.avatarHat;
  let nuevaRopa: AvatarTipoDeRopa = 'ninguna';
  let nuevoRopaColor: string | undefined = undefined;
  let nuevaAura: AvatarTipoDeAura = 'ninguna';
  let nuevoActivoId: string | undefined = undefined;

  if (personajeId) {
    const found = invActual.personajes.find((p) => p.id === personajeId);
    if (!found) {
      return { ok: false, error: 'Avatar no encontrado en tu inventario.' };
    }
    nuevoColor = found.color;
    nuevoHat = found.hat;
    nuevaRopa = found.ropa || 'ninguna';
    nuevoRopaColor = found.ropaColor;
    nuevaAura = found.aura || 'ninguna';
    nuevoActivoId = found.id;
  }

  return actualizarCuentaAsync(user, {
    avatarColor: nuevoColor,
    avatarHat: nuevoHat,
    avatarRopa: nuevaRopa,
    avatarRopaColor: nuevoRopaColor,
    avatarAura: nuevaAura,
    inventario: {
      ...invActual,
      activoId: nuevoActivoId,
    },
  });
}

// ============================================================================
// CONFIGURACIÓN SEMANAL, DESBLOQUEOS Y SALAS PERSONALIZADAS
// ============================================================================

export async function fijarPremioSemanalAsync(personaje: {
  nombre: string;
  color: string;
  hat: AvatarTipoDeGorro;
  ropa: AvatarTipoDeRopa;
  ropaColor?: string;
  aura: AvatarTipoDeAura;
  descripcion?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/personajes/fijar-premio-semanal', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ personaje }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'No se pudo fijar el premio semanal.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Error de red guardando premio semanal.' };
  }
}

export async function obtenerConfigSemanalAsync(): Promise<{
  puntosConfig: {
    puntosVictoria: number;
    puntosEmpate: number;
    primerLugar: number;
    segundoLugar: number;
    tercerLugar: number;
    participacion: number;
  };
  premioSemanal: AvatarColeccionable | null;
}> {
  try {
    const [cfgRes, semRes] = await Promise.all([
      fetch(`/api/admin/config-semanal?_t=${Date.now()}`, { cache: 'no-store' }),
      fetch(`/api/admin/premio-semanal?_t=${Date.now()}`, { cache: 'no-store' }),
    ]);
    const cfgData = cfgRes.ok ? await cfgRes.json() : {};
    const semData = semRes.ok ? await semRes.json() : {};
    const c = cfgData?.config || {};
    return {
      puntosConfig: {
        puntosVictoria: Number(c.puntosVictoria ?? 3),
        puntosEmpate: Number(c.puntosEmpate ?? 1),
        primerLugar: Number(c.primerLugar ?? 50),
        segundoLugar: Number(c.segundoLugar ?? 25),
        tercerLugar: Number(c.tercerLugar ?? 15),
        participacion: Number(c.participacion ?? 5),
      },
      premioSemanal: semData?.premio || cfgData?.premioSemanal || null,
    };
  } catch {
    return {
      puntosConfig: {
        puntosVictoria: 3,
        puntosEmpate: 1,
        primerLugar: 50,
        segundoLugar: 25,
        tercerLugar: 15,
        participacion: 5,
      },
      premioSemanal: null,
    };
  }
}

export async function guardarConfigSemanalAsync(config: {
  puntosVictoria?: number;
  puntosEmpate?: number;
  primerLugar: number;
  segundoLugar: number;
  tercerLugar: number;
  participacion?: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/config-semanal', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify(config),
    });
    const data = await res.json();
    return res.ok && data?.ok
      ? { ok: true }
      : { ok: false, error: data?.error || 'Error guardando puntos semanales.' };
  } catch {
    return { ok: false, error: 'Error de conexión.' };
  }
}

export function obtenerDesbloqueosLocales(): Record<string, number> {
  const defaults: Record<string, number> = {};
  RegDeAvatar.forEach((p) => {
    if (p.desbloqueoTipo === 'puntos') defaults[p.id] = p.puntosRequeridos;
  });
  try {
    const raw = localStorage.getItem(DESBLOQUEOS_LOCAL_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export async function obtenerDesbloqueosPersonajesAsync(): Promise<Record<string, number>> {
  const defaults = obtenerDesbloqueosLocales();
  try {
    const res = await fetch(`/api/admin/desbloqueos-personajes?_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return defaults;
    const data = await res.json();
    const merged = { ...defaults, ...(data?.desbloqueos || {}) };
    try {
      localStorage.setItem(DESBLOQUEOS_LOCAL_KEY, JSON.stringify(merged));
    } catch {
      // ignorar
    }
    return merged;
  } catch {
    return defaults;
  }
}

export async function guardarDesbloqueosPersonajesAsync(
  desbloqueos: Record<string, number>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/desbloqueos-personajes', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify({ desbloqueos }),
    });
    const data = await res.json();
    if (res.ok && data?.ok) {
      try {
        localStorage.setItem(DESBLOQUEOS_LOCAL_KEY, JSON.stringify(desbloqueos));
      } catch {
        // ignorar
      }
      return { ok: true };
    }
    return { ok: false, error: data?.error || 'Error guardando requisitos.' };
  } catch {
    return { ok: false, error: 'Error de red.' };
  }
}

export async function obtenerSalasPersonalizadasAsync(): Promise<SalaPersonalizada[]> {
  try {
    const res = await fetch(`/api/admin/salas-personalizadas?_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.salas) ? data.salas : [];
  } catch {
    return [];
  }
}

export async function crearSalaPersonalizadaAsync(
  sala: Omit<SalaPersonalizada, 'creadaEn' | 'creador' | 'creadorRol'>
): Promise<{ ok: boolean; error?: string; sala?: SalaPersonalizada }> {
  try {
    const res = await fetch('/api/admin/salas-personalizadas', {
      method: 'POST',
      headers: crearHeadersAutenticados(),
      body: JSON.stringify(sala),
    });
    const data = await res.json();
    return res.ok && data?.ok
      ? { ok: true, sala: data.sala }
      : { ok: false, error: data?.error || 'No se pudo publicar la sala oficial.' };
  } catch {
    return { ok: false, error: 'Error de red creando sala.' };
  }
}

export async function eliminarSalaPersonalizadaAsync(
  codigo: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/salas-personalizadas/${encodeURIComponent(codigo)}`, {
      method: 'DELETE',
      headers: crearHeadersAutenticados(),
    });
    const data = await res.json();
    return res.ok && data?.ok ? { ok: true } : { ok: false, error: data?.error };
  } catch {
    return { ok: false, error: 'Error de red eliminando sala.' };
  }
}

export async function obtenerRankingSemanalAsync(): Promise<RespuestaRankingSemanal | null> {
  try {
    const res = await fetch(`/api/semanal?_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.ok ? (data as RespuestaRankingSemanal) : null;
  } catch {
    return null;
  }
}
