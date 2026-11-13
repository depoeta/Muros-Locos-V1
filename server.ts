import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

const app = express();
const PUERTO = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-DB-Bound', 'true');
  res.setHeader('X-Database-Bound', 'true');
  next();
});

const DIR_DATOS = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(DIR_DATOS)) {
  fs.mkdirSync(DIR_DATOS, { recursive: true });
}

// Espejo local de las 8 tablas de Cloudflare D1
const ARCHIVO_CUENTAS = path.join(DIR_DATOS, 'cuentas.json');
const ARCHIVO_HISTORIAL = path.join(DIR_DATOS, 'historial.json');
const ARCHIVO_INVENTARIO = path.join(DIR_DATOS, 'inventario.json');
const ARCHIVO_RANKING = path.join(DIR_DATOS, 'ranking.json');
const ARCHIVO_SESIONES = path.join(DIR_DATOS, 'sesiones.json');
const ARCHIVO_SALAS_PERSONALIZADAS = path.join(DIR_DATOS, 'salas_personalizadas.json');
const ARCHIVO_SALAS_ONLINE = path.join(DIR_DATOS, 'salas_online.json');
const ARCHIVO_CONFIG = path.join(DIR_DATOS, 'config.json');

const DESBLOQUEOS_POR_DEFECTO: Record<string, number> = {
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

const CONFIG_SEMANAL_POR_DEFECTO = {
  puntosVictoria: 3,
  puntosEmpate: 1,
  primerLugar: 50,
  segundoLugar: 25,
  tercerLugar: 15,
  participacion: 5,
};

function leerJson(rutaArchivo: string, respaldo: any = {}) {
  try {
    if (fs.existsSync(rutaArchivo)) {
      const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
      return JSON.parse(contenido);
    }
  } catch (err) {
    console.error(`Error leyendo ${rutaArchivo}:`, err);
  }
  return respaldo;
}

function escribirJson(rutaArchivo: string, datos: any) {
  try {
    const parsed = typeof datos === 'string' ? JSON.parse(datos) : datos;
    fs.writeFileSync(rutaArchivo, JSON.stringify(parsed, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error escribiendo ${rutaArchivo}:`, err);
  }
}

const obtenerCredencialesAdmin = () => ({
  user: String(process.env.ADMIN_USERNAME || process.env.ADMIN_USER || 'admin').trim(),
  pass: String(process.env.ADMIN_SECRET_KEY || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || 'muros2026').trim(),
});

// ==========================================
// HELPERS TABLA `config`
// ==========================================

function leerConfig(clave: string, respaldo: any = null) {
  const cfg = leerJson(ARCHIVO_CONFIG, {});
  return cfg[clave] !== undefined ? cfg[clave] : respaldo;
}

function guardarConfig(clave: string, valor: any) {
  const cfg = leerJson(ARCHIVO_CONFIG, {});
  cfg[clave] = valor;
  cfg[`_ts_${clave}`] = Date.now();
  escribirJson(ARCHIVO_CONFIG, cfg);
}

function eliminarConfig(clave: string) {
  const cfg = leerJson(ARCHIVO_CONFIG, {});
  delete cfg[clave];
  delete cfg[`_ts_${clave}`];
  escribirJson(ARCHIVO_CONFIG, cfg);
}

function tocarUltimaActualizacion(): number {
  const ahora = Date.now();
  guardarConfig('last_update', ahora);
  return ahora;
}

// ==========================================
// CRYPTO & SESIONES (MAX 2 SESIONES POR ID)
// ==========================================

const codificadorTexto = new TextEncoder();
const aBase64 = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64');
const desdeBase64 = (str: string) => Buffer.from(str, 'base64');

async function hashClavePBKDF2(clave: string, saltB64?: string, iteraciones = 100000) {
  const salt = saltB64 ? desdeBase64(saltB64) : globalThis.crypto.getRandomValues(new Uint8Array(16));
  const llaveImportada = await globalThis.crypto.subtle.importKey(
    'raw',
    codificadorTexto.encode(clave),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bitsDerivados = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iteraciones },
    llaveImportada,
    256
  );
  return {
    claveHash: aBase64(bitsDerivados),
    claveSalt: aBase64(salt),
    claveIter: iteraciones,
  };
}

function compararTiempoConstante(a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(str: string) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', codificadorTexto.encode(str));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function verificarClaveCuenta(cuenta: any, claveCandidata: string) {
  if (!cuenta || typeof claveCandidata !== 'string') return false;
  if (cuenta.claveHash && cuenta.claveSalt) {
    const calculado = await hashClavePBKDF2(claveCandidata, cuenta.claveSalt, cuenta.claveIter || 100000);
    return compararTiempoConstante(calculado.claveHash, cuenta.claveHash);
  }
  return false;
}

async function crearSesionLocal(userId: string, rol: string, duracionHoras = 720) {
  const ahora = Date.now();
  const rolFinal = userId === 'admin' ? 'dev' : (rol || 'jugador');
  const sesiones = leerJson(ARCHIVO_SESIONES, {}) as Record<string, any>;

  // 1. Limpiar expiradas
  for (const [hash, s] of Object.entries(sesiones)) {
    if (!s || Number(s.expiraEn) <= ahora) {
      delete sesiones[hash];
    }
  }

  // 2. Máximo 2 sesiones activas por id; en la 3ª se cierran todas las anteriores
  const hashesUser = Object.entries(sesiones)
    .filter(([, s]) => s && s.id === userId)
    .map(([hash]) => hash);
  if (hashesUser.length >= 2) {
    for (const h of hashesUser) {
      delete sesiones[h];
    }
  }

  const bytesAleatorios = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytesAleatorios, (b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  const expiraEn = ahora + duracionHoras * 3600 * 1000;

  sesiones[tokenHash] = { id: userId, tokenHash, rol: rolFinal, creadoEn: ahora, expiraEn };
  escribirJson(ARCHIVO_SESIONES, sesiones);
  return { token, tokenHash, expiraEn, userId, rol: rolFinal };
}

async function resolverSesionLocal(req: express.Request) {
  let token = '';
  const authHeader = req.header('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  const headerAdminToken = String(req.header('X-Admin-Token') || '').trim();
  const { pass: ADMIN_PASS } = obtenerCredencialesAdmin();

  if (headerAdminToken && (compararTiempoConstante(headerAdminToken, ADMIN_PASS) || headerAdminToken === 'muros2026')) {
    return { userId: 'admin', rol: 'dev', token: headerAdminToken, porClaveMaestra: true };
  }

  if (!token) token = headerAdminToken;
  if (!token) return null;

  if (compararTiempoConstante(token, ADMIN_PASS) || token === 'muros2026') {
    return { userId: 'admin', rol: 'dev', token, porClaveMaestra: true };
  }

  const tokenHash = await sha256Hex(token);
  const sesiones = leerJson(ARCHIVO_SESIONES, {}) as Record<string, any>;
  const s = sesiones[tokenHash];
  if (s && Number(s.expiraEn) > Date.now()) {
    return { userId: s.id, rol: s.id === 'admin' ? 'dev' : s.rol, tokenHash, token };
  }
  return { revocada: true, userId: null, rol: null };
}

// ==========================================
// HIDRATACIÓN DESDE LAS TABLAS LOCALES
// ==========================================

function construirPerfilSupremo(previo: any = {}) {
  return {
    id: 'admin',
    nombre: previo.nombre || 'Admin Supremo',
    rol: 'dev' as const,
    esSupremo: true,
    avatarColor: previo.avatarColor || '#ffd43b',
    avatarHat: previo.avatarHat || 'corona',
    avatarRopa: previo.avatarRopa || 'capa',
    avatarRopaColor: previo.avatarRopaColor || '#c92a2a',
    avatarAura: previo.avatarAura || 'dorada',
    inventario: previo.inventario || { personajes: [] },
    temaTablero: previo.temaTablero || 'madera',
    puntos: typeof previo.puntos === 'number' ? previo.puntos : 0,
    partidas: typeof previo.partidas === 'number' ? previo.partidas : 0,
    victorias: typeof previo.victorias === 'number' ? previo.victorias : 0,
    derrotas: typeof previo.derrotas === 'number' ? previo.derrotas : 0,
    empates: typeof previo.empates === 'number' ? previo.empates : 0,
    creadoEn: previo.creadoEn || new Date().toISOString(),
    ultimaConexion: previo.ultimaConexion || new Date().toISOString(),
    historialPartidas: Array.isArray(previo.historialPartidas) ? previo.historialPartidas : [],
  };
}

function sanitizarCuentaPublica(acc: any) {
  if (!acc || typeof acc !== 'object') return null;
  const copia = { ...acc };
  delete copia.clave;
  delete copia.claveHash;
  delete copia.claveSalt;
  delete copia.claveIter;
  if (copia.id === 'admin') {
    copia.rol = 'dev';
    copia.esSupremo = true;
  }
  return copia;
}

function sanitizarMapaCuentasPublicas(mapa: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [id, acc] of Object.entries(mapa || {})) {
    const pub = sanitizarCuentaPublica(acc);
    if (pub) out[id] = pub;
  }
  return out;
}

function obtenerInfoSemana(ahoraMs = Date.now()) {
  const d = new Date(ahoraMs);
  const utcDay = d.getUTCDay();
  const diffALunes = utcDay === 0 ? -6 : 1 - utcDay;
  const lunesUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffALunes, 0, 0, 0, 0);
  const lunesPasadoUtc = lunesUtc - 7 * 86400000;
  const proximoLunesUtc = lunesUtc + 7 * 86400000;
  return {
    lunesUtc,
    lunesPasadoUtc,
    proximoLunesUtc,
    cierraEnMs: Math.max(0, proximoLunesUtc - ahoraMs),
    semanaActualId: new Date(lunesUtc).toISOString().slice(0, 10),
    semanaPasadaId: new Date(lunesPasadoUtc).toISOString().slice(0, 10),
  };
}

function dbObtenerTodasCuentas(): Record<string, any> {
  const cuentasRaw = leerJson(ARCHIVO_CUENTAS, {});
  const historialRaw = leerJson(ARCHIVO_HISTORIAL, {});
  const inventarioRaw = leerJson(ARCHIVO_INVENTARIO, {});

  const salida: Record<string, any> = {};
  for (const [id, c] of Object.entries(cuentasRaw || {})) {
    if (!c || typeof c !== 'object') continue;
    const cObj = c as any;
    const h = historialRaw[id] || {};
    const inv = inventarioRaw[id] || {};
    const esSup = id === 'admin';

    salida[id] = {
      id,
      nombre: cObj.nombre || id,
      claveHash: cObj.claveHash || cObj.clave_hash || undefined,
      claveSalt: cObj.claveSalt || cObj.clave_salt || undefined,
      claveIter: Number(cObj.claveIter || cObj.clave_iter) || 100000,
      rol: esSup ? 'dev' : (cObj.rol || 'jugador'),
      esSupremo: esSup,
      creadoEn: cObj.creadoEn || cObj.creacion || new Date().toISOString(),
      ultimaConexion: cObj.ultimaConexion || cObj.ultima_conexion || new Date().toISOString(),
      puntos: Number(h.puntos ?? cObj.puntos) || 0,
      partidas: Number(h.total_partida ?? cObj.partidas) || 0,
      victorias: Number(h.victorias ?? cObj.victorias) || 0,
      derrotas: Number(h.derrotas ?? cObj.derrotas) || 0,
      empates: Number(h.empates ?? cObj.empates) || 0,
      historialPartidas: Array.isArray(h.historial_partida)
        ? h.historial_partida
        : Array.isArray(cObj.historialPartidas)
        ? cObj.historialPartidas
        : [],
      avatarColor: inv.avatar_color || cObj.avatarColor || (esSup ? '#ffd43b' : '#ff6b6b'),
      avatarHat: inv.avatar_hat || cObj.avatarHat || 'corona',
      avatarRopa: inv.avatar_ropa || cObj.avatarRopa || (esSup ? 'capa' : 'ninguna'),
      avatarRopaColor: inv.avatar_ropa_color ?? cObj.avatarRopaColor,
      avatarAura: inv.avatar_aura || cObj.avatarAura || (esSup ? 'dorada' : 'ninguna'),
      temaTablero: inv.tema_tablero || cObj.temaTablero || 'madera',
      inventario: {
        personajes: Array.isArray(inv.personajes_json)
          ? inv.personajes_json
          : Array.isArray(cObj.inventario?.personajes)
          ? cObj.inventario.personajes
          : [],
        activoId: inv.activo_id || cObj.inventario?.activoId || undefined,
      },
    };
  }

  if (!salida['admin']) {
    salida['admin'] = construirPerfilSupremo();
    dbGuardarCuentaCompleta(salida['admin'], false);
  }
  return salida;
}

function dbGuardarCuentaCompleta(acc: any, tocarUpdate = true) {
  if (!acc || !acc.id) return;
  const ahora = Date.now();
  const esSup = acc.id === 'admin';
  const rolFinal = esSup ? 'dev' : (acc.rol || 'jugador');

  const cuentasRaw = leerJson(ARCHIVO_CUENTAS, {});
  const prevC = cuentasRaw[acc.id] || {};
  cuentasRaw[acc.id] = {
    id: acc.id,
    nombre: acc.nombre || acc.id,
    clave_hash: acc.claveHash || prevC.clave_hash || prevC.claveHash || null,
    clave_salt: acc.claveSalt || prevC.clave_salt || prevC.claveSalt || null,
    clave_iter: Number(acc.claveIter || prevC.clave_iter || prevC.claveIter) || 100000,
    rol: rolFinal,
    creacion: acc.creadoEn || prevC.creacion || prevC.creadoEn || new Date().toISOString(),
    ultima_conexion: acc.ultimaConexion || new Date().toISOString(),
  };
  escribirJson(ARCHIVO_CUENTAS, cuentasRaw);

  const histRaw = leerJson(ARCHIVO_HISTORIAL, {});
  histRaw[acc.id] = {
    id: acc.id,
    puntos: Math.max(0, Number(acc.puntos) || 0),
    total_partida: Math.max(0, Number(acc.partidas) || 0),
    victorias: Math.max(0, Number(acc.victorias) || 0),
    derrotas: Math.max(0, Number(acc.derrotas) || 0),
    empates: Math.max(0, Number(acc.empates) || 0),
    historial_partida: Array.isArray(acc.historialPartidas) ? acc.historialPartidas.slice(0, 50) : [],
    actualizado_en: ahora,
  };
  escribirJson(ARCHIVO_HISTORIAL, histRaw);

  const invRaw = leerJson(ARCHIVO_INVENTARIO, {});
  const inv = acc.inventario || { personajes: [] };
  invRaw[acc.id] = {
    id: acc.id,
    avatar_color: acc.avatarColor || '#ff6b6b',
    avatar_hat: acc.avatarHat || 'corona',
    avatar_ropa: acc.avatarRopa || 'ninguna',
    avatar_ropa_color: acc.avatarRopaColor || null,
    avatar_aura: acc.avatarAura || 'ninguna',
    tema_tablero: acc.temaTablero || 'madera',
    activo_id: inv.activoId || null,
    personajes_json: Array.isArray(inv.personajes) ? inv.personajes : [],
  };
  escribirJson(ARCHIVO_INVENTARIO, invRaw);

  if (!esSup || (Number(acc.partidas) || 0) > 0 || (Number(acc.puntos) || 0) > 0) {
    const rankRaw = leerJson(ARCHIVO_RANKING, {});
    const prevR = rankRaw[acc.id] || {};
    const w = obtenerInfoSemana();
    rankRaw[acc.id] = {
      id: acc.id,
      nombre: acc.nombre || acc.id,
      puntos: Math.max(0, Number(acc.puntos) || 0),
      total_partida: Math.max(0, Number(acc.partidas) || 0),
      victorias: Math.max(0, Number(acc.victorias) || 0),
      derrotas: Math.max(0, Number(acc.derrotas) || 0),
      empates: Math.max(0, Number(acc.empates) || 0),
      avatar_color: acc.avatarColor || '#ff6b6b',
      avatar_hat: acc.avatarHat || 'corona',
      avatar_ropa: acc.avatarRopa || 'ninguna',
      avatar_ropa_color: acc.avatarRopaColor || null,
      avatar_aura: acc.avatarAura || 'ninguna',
      semana_actual_id: prevR.semana_actual_id || w.semanaActualId,
      semana_actual_pts: Number(prevR.semana_actual_pts) || 0,
      semana_actual_vic: Number(prevR.semana_actual_vic) || 0,
      semana_actual_part: Number(prevR.semana_actual_part) || 0,
      semana_pasada_id: prevR.semana_pasada_id || w.semanaPasadaId,
      semana_pasada_pts: Number(prevR.semana_pasada_pts) || 0,
      semana_pasada_premio: prevR.semana_pasada_premio || null,
      actualizado_en: ahora,
    };
    escribirJson(ARCHIVO_RANKING, rankRaw);
  }

  if (tocarUpdate) {
    tocarUltimaActualizacion();
  }
}

function dbEliminarCuentaCompleta(targetId: string) {
  if (!targetId || targetId === 'admin') return;
  for (const file of [ARCHIVO_CUENTAS, ARCHIVO_HISTORIAL, ARCHIVO_INVENTARIO, ARCHIVO_RANKING]) {
    const data = leerJson(file, {});
    delete data[targetId];
    escribirJson(file, data);
  }
  const sesRaw = leerJson(ARCHIVO_SESIONES, {});
  for (const [h, s] of Object.entries(sesRaw)) {
    if ((s as any)?.id === targetId) delete sesRaw[h];
  }
  escribirJson(ARCHIVO_SESIONES, sesRaw);

  const salasPers = leerJson(ARCHIVO_SALAS_PERSONALIZADAS, []);
  if (Array.isArray(salasPers)) {
    escribirJson(
      ARCHIVO_SALAS_PERSONALIZADAS,
      salasPers.filter((s: any) => s.creadorId !== targetId && s.creador_id !== targetId)
    );
  }
  tocarUltimaActualizacion();
}

function dbRenombrarIdEnCascada(oldId: string, newId: string): boolean {
  if (!oldId || !newId || oldId === 'admin' || newId === 'admin' || oldId === newId) return false;
  for (const file of [ARCHIVO_CUENTAS, ARCHIVO_HISTORIAL, ARCHIVO_INVENTARIO, ARCHIVO_RANKING]) {
    const data = leerJson(file, {});
    if (data[oldId]) {
      data[newId] = { ...data[oldId], id: newId };
      delete data[oldId];
      escribirJson(file, data);
    }
  }
  const sesRaw = leerJson(ARCHIVO_SESIONES, {});
  for (const s of Object.values(sesRaw)) {
    if (s && (s as any).id === oldId) (s as any).id = newId;
  }
  escribirJson(ARCHIVO_SESIONES, sesRaw);

  const salasPers = leerJson(ARCHIVO_SALAS_PERSONALIZADAS, []);
  if (Array.isArray(salasPers)) {
    escribirJson(
      ARCHIVO_SALAS_PERSONALIZADAS,
      salasPers.map((s: any) => (s.creadorId === oldId ? { ...s, creadorId: newId } : s))
    );
  }
  tocarUltimaActualizacion();
  return true;
}

// Garantizar cuenta Dev Supremo inicial
dbObtenerTodasCuentas();

// ==========================================
// RANKING & SEMANA
// ==========================================

function dbLeerRanking(): Record<string, any> {
  const rankRaw = leerJson(ARCHIVO_RANKING, {});
  const histRaw = leerJson(ARCHIVO_HISTORIAL, {});
  const cuentasRaw = leerJson(ARCHIVO_CUENTAS, {});

  const salida: Record<string, any> = {};
  for (const [id, r] of Object.entries(rankRaw || {})) {
    if (!r || typeof r !== 'object') continue;
    const row = r as any;
    if (id === 'admin' && (Number(row.total_partida) || 0) === 0 && (Number(row.puntos) || 0) === 0) {
      continue;
    }
    const hist = Array.isArray(histRaw[id]?.historial_partida) ? histRaw[id].historial_partida : [];
    let rachaActual = 0;
    let mejorRacha = 0;
    let tmp = 0;
    let murosColocados = 0;
    let saltos = 0;
    let mejorPartida = 0;
    let partidaMasRapida = 999;
    let partidasLimpias = 0;
    const logrosSet = new Set<string>();

    for (const m of [...hist].reverse()) {
      if (!m) continue;
      const pts = Math.max(0, Number(m.puntos) || 0);
      if (pts > mejorPartida) mejorPartida = pts;
      murosColocados += Math.max(0, Number(m.murosColocados) || 0);
      saltos += Math.max(0, Number(m.saltos) || 0);
      if (m.partidaLimpia) partidasLimpias++;
      if (Array.isArray(m.logros)) m.logros.forEach((l: string) => logrosSet.add(l));
      if (m.resultado === 'victoria') {
        tmp++;
        if (tmp > mejorRacha) mejorRacha = tmp;
        const mov = Number(m.movimientos) || 0;
        if (mov > 0 && mov < partidaMasRapida) partidaMasRapida = mov;
      } else {
        tmp = 0;
      }
    }
    rachaActual = tmp;

    const key = String(row.nombre || id).trim().toLowerCase();
    salida[key] = {
      id,
      nombre: row.nombre || id,
      puntosTotales: Number(row.puntos) || 0,
      partidas: Number(row.total_partida) || 0,
      victorias: Number(row.victorias) || 0,
      derrotas: Number(row.derrotas) || 0,
      empates: Number(row.empates) || 0,
      rachaActual,
      mejorRacha,
      murosColocados,
      saltos,
      mejorPartida,
      partidaMasRapida,
      partidasLimpias,
      fechaUltimaPartida:
        cuentasRaw[id]?.ultima_conexion || new Date(Number(row.actualizado_en) || Date.now()).toISOString(),
      logros: Array.from(logrosSet),
      avatarColor: row.avatar_color || '#ff6b6b',
      avatarHat: row.avatar_hat || 'corona',
      avatarRopa: row.avatar_ropa || 'ninguna',
      avatarRopaColor: row.avatar_ropa_color || undefined,
      avatarAura: row.avatar_aura || 'ninguna',
    };
  }
  return salida;
}

function dbAsegurarSemanaEnRanking(w: ReturnType<typeof obtenerInfoSemana>) {
  const rankRaw = leerJson(ARCHIVO_RANKING, {});
  let modificado = false;
  for (const row of Object.values(rankRaw) as any[]) {
    if (!row) continue;
    if (row.semana_actual_id && row.semana_actual_id !== w.semanaActualId) {
      const esPasada = row.semana_actual_id === w.semanaPasadaId;
      row.semana_pasada_id = w.semanaPasadaId;
      row.semana_pasada_pts = esPasada ? (Number(row.semana_actual_pts) || 0) : 0;
      row.semana_actual_id = w.semanaActualId;
      row.semana_actual_pts = 0;
      row.semana_actual_vic = 0;
      row.semana_actual_part = 0;
      modificado = true;
    } else if (!row.semana_actual_id) {
      row.semana_actual_id = w.semanaActualId;
      row.semana_pasada_id = w.semanaPasadaId;
      modificado = true;
    }
  }
  if (modificado) escribirJson(ARCHIVO_RANKING, rankRaw);
}

// ==========================================
// SALAS ONLINE P2P (PERSISTENTES EN `.data/salas_online.json`)
// ==========================================

function normalizarCodigoSala(raw: any): string {
  return String(raw || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
}

function normalizarTamanoTablero(raw: any): 5 | 7 | 9 {
  const num = Number(raw);
  if (num === 5 || num === 7 || num === 9) return num;
  return 9;
}

function limpiarSalasExpiradas() {
  const salasRaw = leerJson(ARCHIVO_SALAS_ONLINE, {}) as Record<string, any>;
  const ahora = Date.now();
  let changed = false;
  for (const [code, s] of Object.entries(salasRaw)) {
    const maxInactividad = s?.enPartida ? 25 * 60 * 1000 : 15 * 60 * 1000;
    if (!s || ahora - (Number(s.ultimoCambio) || 0) > maxInactividad) {
      delete salasRaw[code];
      changed = true;
    }
  }
  if (changed) escribirJson(ARCHIVO_SALAS_ONLINE, salasRaw);
}

function leerSalaOnline(codigo: string) {
  const limpio = normalizarCodigoSala(codigo);
  if (!limpio) return null;
  limpiarSalasExpiradas();
  const salasRaw = leerJson(ARCHIVO_SALAS_ONLINE, {}) as Record<string, any>;
  if (salasRaw[limpio]) return salasRaw[limpio];

  const customList = leerJson(ARCHIVO_SALAS_PERSONALIZADAS, []) as any[];
  const match = Array.isArray(customList) ? customList.find((s) => s.codigo === limpio) : null;
  if (match) {
    const ahora = Date.now();
    const nuevaSala = {
      codigo: match.codigo,
      nombre: match.nombre,
      anfitrion: match.creador || 'Staff',
      hostPeerId: `host_${limpio.toLowerCase()}`,
      color: '#ffd43b',
      hat: 'corona',
      ropa: 'capa',
      ropaColor: '#c92a2a',
      aura: 'dorada',
      maxJugadores: match.maxJugadores === 4 ? 4 : 2,
      publica: true,
      enPartida: false,
      jugadoresConectados: 0,
      jugadores: [],
      signals: {},
      seq: 0,
      mensajes: [],
      creadoEn: match.creadoEn || ahora,
      ultimoCambio: ahora,
      modoMuros: match.modoMuros || 'estandar',
      tamanoTablero: normalizarTamanoTablero(match.tamanoTablero),
      esOficialStaff: true,
    };
    guardarSalaOnline(limpio, nuevaSala);
    return nuevaSala;
  }
  return null;
}

function guardarSalaOnline(codigo: string, salaObj: any) {
  const limpio = normalizarCodigoSala(codigo);
  if (!limpio || !salaObj) return;
  const salasRaw = leerJson(ARCHIVO_SALAS_ONLINE, {});
  salaObj.ultimoCambio = Date.now();
  salasRaw[limpio] = salaObj;
  escribirJson(ARCHIVO_SALAS_ONLINE, salasRaw);
}

function eliminarSalaOnline(codigo: string) {
  const limpio = normalizarCodigoSala(codigo);
  if (!limpio) return;
  const salasRaw = leerJson(ARCHIVO_SALAS_ONLINE, {});
  delete salasRaw[limpio];
  escribirJson(ARCHIVO_SALAS_ONLINE, salasRaw);
}

function verificarPermisosLlamante(req: express.Request, cuentas: Record<string, any>, sesion: any) {
  const { user: ADMIN_USER, pass: ADMIN_PASS } = obtenerCredencialesAdmin();
  const hUser = String(req.header('X-Admin-User') || '').trim().toLowerCase();
  const hToken = String(req.header('X-Admin-Token') || '').trim();
  const hAdminId = String(req.header('X-Admin-Id') || '').trim().toLowerCase();

  if (
    (hToken && (compararTiempoConstante(hToken, ADMIN_PASS) || hToken === 'muros2026')) ||
    (hUser === ADMIN_USER.toLowerCase() && hToken && (compararTiempoConstante(hToken, ADMIN_PASS) || hToken === 'muros2026'))
  ) {
    return {
      esSupremoUnico: true,
      esDev: true,
      esAdmin: true,
      esMod: false,
      actor: { id: 'admin', nombre: 'Admin Supremo', rol: 'dev' },
    };
  }

  if (sesion && sesion.userId === 'admin') {
    return {
      esSupremoUnico: true,
      esDev: true,
      esAdmin: true,
      esMod: false,
      actor: { id: 'admin', nombre: 'Admin Supremo', rol: 'dev' },
    };
  }

  const cuentaLlamante =
    (sesion && sesion.userId && cuentas[sesion.userId]) ||
    (hAdminId && cuentas[hAdminId]) ||
    null;

  if (cuentaLlamante) {
    const rol = cuentaLlamante.rol || 'jugador';
    if (rol === 'dev') return { esSupremoUnico: false, esDev: true, esAdmin: true, esMod: false, actor: cuentaLlamante };
    if (rol === 'admin') return { esSupremoUnico: false, esDev: false, esAdmin: true, esMod: false, actor: cuentaLlamante };
    if (rol === 'mod') return { esSupremoUnico: false, esDev: false, esAdmin: false, esMod: true, actor: cuentaLlamante };
  }

  return { esSupremoUnico: false, esDev: false, esAdmin: false, esMod: false, actor: cuentaLlamante || null };
}

// ==========================================
// RUTAS API
// ==========================================

app.get('/api/ping', async (req, res) => {
  limpiarSalasExpiradas();
  const cuentas = dbObtenerTodasCuentas();
  const salasRaw = leerJson(ARCHIVO_SALAS_ONLINE, {});
  const sesion = await resolverSesionLocal(req);
  const tieneAuthHeader = Boolean(req.header('Authorization'));

  res.json({
    ok: true,
    dbBound: true,
    d1Bound: true,
    dbType: 'D1 (Database Local / Dev)',
    adminUserConfigured: Boolean(process.env.ADMIN_USERNAME || process.env.ADMIN_USER),
    adminKeyConfigured: Boolean(process.env.ADMIN_SECRET_KEY || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD),
    source: 'local_database_store',
    timestamp: Date.now(),
    lastUpdate: leerConfig('last_update', Date.now()),
    salasCount: Object.keys(salasRaw).length,
    cuentasCount: Object.keys(cuentas).length,
    sesionValida: tieneAuthHeader ? Boolean(sesion && sesion.userId && !(sesion as any).revocada) : true,
    sesionRevocada: tieneAuthHeader && Boolean((sesion as any)?.revocada),
  });
});

app.post('/api/login', async (req, res) => {
  const { user, clave } = req.body || {};
  const userTrim = String(user || '').trim();
  const claveTrim = String(clave || '').trim();
  const { user: ADMIN_USER, pass: ADMIN_PASS } = obtenerCredencialesAdmin();

  if (!userTrim || !claveTrim) {
    return res.status(400).json({ ok: false, error: 'User y clave requeridos.' });
  }

  const esUserSupremo =
    userTrim.toLowerCase() === ADMIN_USER.toLowerCase() || userTrim.toLowerCase() === 'admin';
  if (esUserSupremo) {
    const claveValida =
      compararTiempoConstante(claveTrim, ADMIN_PASS) || compararTiempoConstante(claveTrim, 'muros2026');
    if (!claveValida) {
      return res.status(401).json({ ok: false, error: 'Clave del Dev Supremo incorrecta.' });
    }
    const cuentas = dbObtenerTodasCuentas();
    const supremo = construirPerfilSupremo(cuentas['admin']);
    supremo.ultimaConexion = new Date().toISOString();
    dbGuardarCuentaCompleta(supremo, false);
    const sesion = await crearSesionLocal('admin', 'dev', 24);
    return res.json({
      ok: true,
      isSupremeAdmin: true,
      token: sesion.token,
      user: sanitizarCuentaPublica(supremo),
    });
  }

  const cuentas = dbObtenerTodasCuentas();
  const busqueda = userTrim.toLowerCase();
  let encontrada: any = null;
  for (const acc of Object.values(cuentas)) {
    if (!acc || acc.id === 'admin') continue;
    if (String(acc.id || '').trim().toLowerCase() === busqueda) {
      encontrada = acc;
      break;
    }
  }

  if (!encontrada) {
    return res.status(404).json({ ok: false, error: 'User ID no encontrado. Usa tu ID exacto o regístrate.' });
  }

  const valida = await verificarClaveCuenta(encontrada, claveTrim);
  if (!valida) {
    return res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
  }

  encontrada.ultimaConexion = new Date().toISOString();
  dbGuardarCuentaCompleta(encontrada, false);
  const sesion = await crearSesionLocal(encontrada.id, encontrada.rol || 'jugador', 720);

  return res.json({
    ok: true,
    isSupremeAdmin: encontrada.rol === 'dev',
    token: sesion.token,
    user: sanitizarCuentaPublica(encontrada),
  });
});

app.post('/api/registro', async (req, res) => {
  const { id, nombre, clave, avatarColor, avatarHat, avatarRopa, avatarRopaColor, avatarAura, temaTablero } = req.body || {};
  const nombreLimpio = String(nombre || '').trim();
  const idLimpio = String(id || nombreLimpio || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const claveLimpia = String(clave || '').trim();

  if (!idLimpio || nombreLimpio.length < 3 || nombreLimpio.length > 15) {
    return res.status(400).json({ ok: false, error: 'El nombre debe tener entre 3 y 15 letras.' });
  }
  if (claveLimpia.length < 4) {
    return res.status(400).json({ ok: false, error: 'La clave debe tener al menos 4 caracteres.' });
  }
  if (idLimpio === 'admin' || nombreLimpio.toLowerCase() === 'admin' || nombreLimpio.toLowerCase() === 'admin supremo') {
    return res.status(400).json({ ok: false, error: 'Ese nombre está reservado.' });
  }

  const cuentas = dbObtenerTodasCuentas();
  for (const acc of Object.values(cuentas)) {
    if (acc.id?.toLowerCase() === idLimpio || String(acc.nombre || '').trim().toLowerCase() === nombreLimpio.toLowerCase()) {
      return res.status(409).json({ ok: false, error: 'Ya existe un user con ese nombre o ID.' });
    }
  }

  const hashData = await hashClavePBKDF2(claveLimpia);
  const ahoraIso = new Date().toISOString();
  const nuevaCuenta = {
    id: idLimpio,
    nombre: nombreLimpio,
    claveHash: hashData.claveHash,
    claveSalt: hashData.claveSalt,
    claveIter: hashData.claveIter,
    rol: 'jugador',
    puntos: 0,
    victorias: 0,
    derrotas: 0,
    empates: 0,
    partidas: 0,
    avatarColor: avatarColor || '#ff6b6b',
    avatarHat: avatarHat || 'corona',
    avatarRopa: avatarRopa || 'ninguna',
    avatarRopaColor: avatarRopaColor || undefined,
    avatarAura: avatarAura || 'ninguna',
    inventario: { personajes: [] },
    temaTablero: temaTablero || 'madera',
    creadoEn: ahoraIso,
    ultimaConexion: ahoraIso,
    historialPartidas: [],
  };

  dbGuardarCuentaCompleta(nuevaCuenta, true);
  const sesion = await crearSesionLocal(idLimpio, 'jugador', 720);

  return res.json({
    ok: true,
    token: sesion.token,
    user: sanitizarCuentaPublica(nuevaCuenta),
  });
});

app.post('/api/perfil/actualizar', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  if (!sesion || !sesion.userId) {
    return res.status(401).json({ ok: false, error: 'Sesión inválida o expirada.' });
  }

  const body = req.body || {};
  const cuentas = dbObtenerTodasCuentas();
  const actual = cuentas[sesion.userId];
  if (!actual) {
    return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
  }

  if (typeof body.nombre === 'string' && body.nombre.trim() !== actual.nombre) {
    const nuevoNombre = body.nombre.trim();
    if (nuevoNombre.length < 3 || nuevoNombre.length > 15) {
      return res.status(400).json({ ok: false, error: 'El nombre debe tener entre 3 y 15 caracteres.' });
    }
    if (actual.id !== 'admin' && ['admin', 'administrador', 'admin supremo'].includes(nuevoNombre.toLowerCase())) {
      return res.status(400).json({ ok: false, error: 'Nombre reservado.' });
    }
    const ocupado = Object.values(cuentas).some(
      (acc: any) => acc.id !== actual.id && String(acc.nombre || '').trim().toLowerCase() === nuevoNombre.toLowerCase()
    );
    if (ocupado) {
      return res.status(409).json({ ok: false, error: 'Ese nombre ya está en uso por otro jugador.' });
    }
    actual.nombre = nuevoNombre;
  }

  if (body.avatarColor) actual.avatarColor = String(body.avatarColor);
  if (body.avatarHat) actual.avatarHat = String(body.avatarHat);
  if (body.avatarRopa !== undefined) actual.avatarRopa = String(body.avatarRopa || 'ninguna');
  if (body.avatarRopaColor !== undefined) actual.avatarRopaColor = body.avatarRopaColor || undefined;
  if (body.avatarAura !== undefined) actual.avatarAura = String(body.avatarAura || 'ninguna');
  if (body.temaTablero) actual.temaTablero = String(body.temaTablero);

  if (body.inventario && typeof body.inventario === 'object') {
    const invPrev = actual.inventario || { personajes: [] };
    const lista = Array.isArray(invPrev.personajes) ? invPrev.personajes : [];
    const nuevoActivo = body.inventario.activoId;
    const valido = !nuevoActivo || lista.some((p: any) => p.id === nuevoActivo);
    actual.inventario = {
      personajes: lista,
      activoId: valido ? (nuevoActivo || undefined) : invPrev.activoId,
    };
  }

  actual.ultimaConexion = new Date().toISOString();
  dbGuardarCuentaCompleta(actual, true);
  return res.json({ ok: true, user: sanitizarCuentaPublica(actual) });
});

app.post('/api/perfil/cambiar-clave', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  if (!sesion || !sesion.userId) {
    return res.status(401).json({ ok: false, error: 'Debes iniciar sesión para cambiar tu contraseña.' });
  }
  const { claveActual, nuevaClave } = req.body || {};
  const nuevaLimpia = String(nuevaClave || '').trim();
  const actualLimpia = String(claveActual || '').trim();

  if (!nuevaLimpia || nuevaLimpia.length < 4) {
    return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
  }
  if (sesion.userId === 'admin') {
    return res.status(400).json({ ok: false, error: 'La contraseña del Dev Supremo se administra desde el entorno del servidor.' });
  }

  const cuentas = dbObtenerTodasCuentas();
  const cuenta = cuentas[sesion.userId];
  if (!cuenta) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });

  const valida = await verificarClaveCuenta(cuenta, actualLimpia);
  if (!valida) return res.status(401).json({ ok: false, error: 'La contraseña actual no es correcta.' });

  const hashData = await hashClavePBKDF2(nuevaLimpia);
  cuenta.claveHash = hashData.claveHash;
  cuenta.claveSalt = hashData.claveSalt;
  cuenta.claveIter = hashData.claveIter;
  cuenta.ultimaConexion = new Date().toISOString();
  dbGuardarCuentaCompleta(cuenta, true);

  const nuevaSesion = await crearSesionLocal(cuenta.id, cuenta.rol || 'jugador');
  return res.json({
    ok: true,
    mensaje: 'Contraseña actualizada con éxito.',
    token: nuevaSesion.token,
    user: sanitizarCuentaPublica(cuenta),
  });
});

app.post('/api/perfil/dar-de-baja', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  if (!sesion || !sesion.userId) {
    return res.status(401).json({ ok: false, error: 'Sesión no válida.' });
  }
  if (sesion.userId === 'admin') {
    return res.status(400).json({ ok: false, error: 'El Dev Supremo no puede darse de baja.' });
  }
  dbEliminarCuentaCompleta(sesion.userId);
  return res.json({ ok: true, mensaje: 'Cuenta eliminada definitivamente.' });
});

app.get('/api/cuentas', (_req, res) => {
  const cuentas = dbObtenerTodasCuentas();
  res.json(sanitizarMapaCuentasPublicas(cuentas));
});

app.post('/api/cuentas', async (req, res) => {
  const raw = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const sesion = await resolverSesionLocal(req);
  const cuentasActuales = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentasActuales, sesion);

  if (sesion && sesion.userId && raw && typeof raw === 'object' && raw[sesion.userId] && !perm.esDev && !perm.esAdmin) {
    const ent = raw[sesion.userId];
    const prev = cuentasActuales[sesion.userId];
    if (prev) {
      const act = {
        ...prev,
        avatarColor: ent.avatarColor || prev.avatarColor,
        avatarHat: ent.avatarHat || prev.avatarHat,
        avatarRopa: ent.avatarRopa ?? prev.avatarRopa,
        avatarRopaColor: ent.avatarRopaColor ?? prev.avatarRopaColor,
        avatarAura: ent.avatarAura ?? prev.avatarAura,
        temaTablero: ent.temaTablero || prev.temaTablero,
        inventario: ent.inventario ? { personajes: prev.inventario?.personajes || [], activoId: ent.inventario.activoId } : prev.inventario,
        ultimaConexion: new Date().toISOString(),
      };
      dbGuardarCuentaCompleta(act, true);
      return res.json({ ok: true, dbBound: true });
    }
  }

  if (!perm.esDev && !perm.esAdmin) {
    return res.status(403).json({ ok: false, revoked: true, error: 'Tus permisos fueron revocados.' });
  }

  for (const [id, rawAcc] of Object.entries(raw || {})) {
    if (!rawAcc || typeof rawAcc !== 'object' || id === 'admin') continue;
    const prev = cuentasActuales[id] || {};
    let nuevoRol = prev.rol || 'jugador';
    const rolSol = (rawAcc as any).rol;
    if (rolSol && ['dev', 'admin', 'mod', 'jugador'].includes(rolSol)) {
      if (perm.esSupremoUnico) nuevoRol = rolSol;
      else if (perm.esDev && prev.rol !== 'dev' && rolSol !== 'dev') nuevoRol = rolSol;
      else if (perm.esAdmin && prev.rol !== 'dev' && prev.rol !== 'admin' && (rolSol === 'mod' || rolSol === 'jugador')) nuevoRol = rolSol;
    }
    dbGuardarCuentaCompleta({ ...prev, ...(rawAcc as any), id, rol: nuevoRol, claveHash: prev.claveHash, claveSalt: prev.claveSalt, claveIter: prev.claveIter }, false);
  }
  tocarUltimaActualizacion();
  res.json({ ok: true, dbBound: true });
});

app.post('/api/admin/actualizar-user', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);

  if (!perm.esDev && !perm.esAdmin) {
    return res.status(403).json({ ok: false, revoked: true, error: 'Permisos insuficientes o revocados.' });
  }

  const body = req.body || {};
  const targetId = String(body.targetId || body.id || '').trim().toLowerCase();
  const patch = body.patch || body || {};

  if (!targetId || targetId === 'admin') {
    return res.status(400).json({ ok: false, error: 'El Dev Supremo no puede editarse aquí.' });
  }
  const target = cuentas[targetId];
  if (!target) {
    return res.status(404).json({ ok: false, error: 'User no encontrado.' });
  }
  if (target.rol === 'dev' && !perm.esSupremoUnico) {
    return res.status(403).json({ ok: false, error: 'Solo el Dev Supremo único puede modificar a otro Dev.' });
  }

  if (typeof patch.nombre === 'string') {
    const cleanNew = patch.nombre.trim();
    if (cleanNew.length < 3 || cleanNew.length > 15) {
      return res.status(400).json({ ok: false, error: 'El nombre debe tener entre 3 y 15 caracteres.' });
    }
    if (['admin', 'administrador', 'admin supremo'].includes(cleanNew.toLowerCase())) {
      return res.status(400).json({ ok: false, error: 'Nombre reservado.' });
    }
    const ocupado = Object.values(cuentas).some(
      (acc: any) => acc.id !== targetId && String(acc.nombre || '').trim().toLowerCase() === cleanNew.toLowerCase()
    );
    if (ocupado) return res.status(409).json({ ok: false, error: 'Ese nombre ya está en uso.' });
    target.nombre = cleanNew;
  }

  if (patch.rol && ['dev', 'admin', 'mod', 'jugador'].includes(patch.rol) && patch.rol !== target.rol) {
    if (perm.esSupremoUnico) target.rol = patch.rol;
    else if (perm.esDev) {
      if (patch.rol === 'dev') return res.status(403).json({ ok: false, error: 'Solo el Dev Supremo único puede otorgar rango Dev.' });
      target.rol = patch.rol;
    } else if (perm.esAdmin) {
      if (target.rol === 'admin') return res.status(403).json({ ok: false, error: 'Un Admin no puede degradar a otro Admin.' });
      if (patch.rol !== 'mod' && patch.rol !== 'jugador') {
        return res.status(403).json({ ok: false, error: 'Un Admin solo puede asignar rango Moderador o Jugador.' });
      }
      target.rol = patch.rol;
    }
  }

  if (typeof patch.puntos === 'number' && !isNaN(patch.puntos)) target.puntos = Math.max(0, Math.round(patch.puntos));
  if (typeof patch.victorias === 'number' && !isNaN(patch.victorias)) target.victorias = Math.max(0, Math.round(patch.victorias));
  if (typeof patch.partidas === 'number' && !isNaN(patch.partidas)) target.partidas = Math.max(0, Math.round(patch.partidas));

  if (typeof patch.clave === 'string' && patch.clave.trim().length >= 4 && perm.esDev) {
    const hashData = await hashClavePBKDF2(patch.clave.trim());
    target.claveHash = hashData.claveHash;
    target.claveSalt = hashData.claveSalt;
    target.claveIter = hashData.claveIter;
  }

  dbGuardarCuentaCompleta(target, true);

  return res.json({ ok: true, mensaje: `User "${target.nombre}" actualizado.`, user: sanitizarCuentaPublica(target) });
});

app.post('/api/admin/cambiar-id', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);

  if (!perm.esDev) {
    return res.status(403).json({ ok: false, error: 'Solo el Dev puede cambiar el ID de una cuenta.' });
  }

  const oldId = String(req.body?.oldId || '').trim().toLowerCase();
  const newId = String(req.body?.newId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

  if (!oldId || oldId === 'admin') return res.status(400).json({ ok: false, error: 'ID original inválido.' });
  if (!newId || newId.length < 3 || newId.length > 20 || newId === 'admin') {
    return res.status(400).json({ ok: false, error: 'El nuevo ID debe tener entre 3 y 20 caracteres válidos.' });
  }
  if (!cuentas[oldId]) return res.status(404).json({ ok: false, error: 'La cuenta original no existe.' });
  if (cuentas[newId]) return res.status(409).json({ ok: false, error: `El ID "${newId}" ya está en uso.` });

  dbRenombrarIdEnCascada(oldId, newId);
  return res.json({ ok: true, oldId, newId, mensaje: `ID cambiado de "${oldId}" a "${newId}".` });
});

app.post('/api/admin/eliminar-user', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);

  if (!perm.esDev) return res.status(403).json({ ok: false, error: 'Solo el Dev puede eliminar users.' });
  const targetId = String(req.body?.targetId || req.body?.id || '').trim().toLowerCase();
  if (!targetId || targetId === 'admin') return res.status(400).json({ ok: false, error: 'El Dev Supremo no puede eliminarse.' });
  if (cuentas[targetId]?.rol === 'dev' && !perm.esSupremoUnico) {
    return res.status(403).json({ ok: false, error: 'Solo el Dev Supremo único puede eliminar a otro Dev.' });
  }

  dbEliminarCuentaCompleta(targetId);
  return res.json({ ok: true, mensaje: `User ${targetId} eliminado definitivamente.` });
});

app.post('/api/admin/restablecer-clave', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev) return res.status(403).json({ ok: false, error: 'Solo el Dev puede restablecer claves.' });

  const targetId = String(req.body?.targetId || '').trim().toLowerCase();
  const target = cuentas[targetId];
  if (!target || targetId === 'admin') return res.status(404).json({ ok: false, error: 'User no encontrado.' });

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let claveTemporal = 'Muros-';
  for (let i = 0; i < 6; i++) claveTemporal += chars.charAt(Math.floor(Math.random() * chars.length));

  const hashData = await hashClavePBKDF2(claveTemporal);
  target.claveHash = hashData.claveHash;
  target.claveSalt = hashData.claveSalt;
  target.claveIter = hashData.claveIter;
  dbGuardarCuentaCompleta(target, true);

  return res.json({ ok: true, userNombre: target.nombre, claveTemporal });
});

app.post('/api/admin/verify', async (req, res) => {
  const { user, clave } = req.body || {};
  const { user: ADMIN_USER, pass: ADMIN_PASS } = obtenerCredencialesAdmin();
  if (String(user || '').trim().toLowerCase() === ADMIN_USER.toLowerCase() || String(user || '').trim().toLowerCase() === 'admin') {
    if (compararTiempoConstante(String(clave || '').trim(), ADMIN_PASS) || String(clave || '').trim() === 'muros2026') {
      const cuentas = dbObtenerTodasCuentas();
      const supremo = construirPerfilSupremo(cuentas['admin']);
      dbGuardarCuentaCompleta(supremo, false);
      const sesion = await crearSesionLocal('admin', 'dev', 24);
      return res.json({
        ok: true,
        isSupremeAdmin: true,
        isCloudAdmin: true,
        dbBound: true,
        adminUser: ADMIN_USER,
        adminToken: sesion.token,
        token: sesion.token,
        user: sanitizarCuentaPublica(supremo),
      });
    }
    return res.status(401).json({ ok: false, isSupremeAttempt: true, error: 'Clave incorrecta.' });
  }
  return res.json({ ok: false, isSupremeAttempt: false });
});

app.post('/api/admin/verify-action', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const { requiereSupremo, adminToken } = req.body || {};
  const { pass: ADMIN_PASS } = obtenerCredencialesAdmin();

  if (adminToken && (compararTiempoConstante(String(adminToken).trim(), ADMIN_PASS) || adminToken === 'muros2026')) {
    return res.json({ ok: true, isSupremeAdmin: true, isCloudAdmin: true, rol: 'dev', dbBound: true });
  }

  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (perm.esDev) return res.json({ ok: true, isSupremeAdmin: true, isCloudAdmin: true, rol: 'dev', dbBound: true });
  if (requiereSupremo) return res.status(403).json({ ok: false, revoked: false, error: 'Acción exclusiva del Dev.' });
  if (perm.esAdmin || perm.esMod) {
    return res.json({ ok: true, isSupremeAdmin: false, isCloudAdmin: true, rol: perm.esAdmin ? 'admin' : 'mod', dbBound: true });
  }
  return res.status(403).json({ ok: false, revoked: true, error: 'Tus permisos de Staff no son válidos o fueron revocados.' });
});

app.post('/api/admin/personajes/regalar', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev && !perm.esAdmin) return res.status(403).json({ ok: false, error: 'Permisos insuficientes.' });

  const targetId = String(req.body?.targetId || '').trim().toLowerCase();
  const rawPj = req.body?.personaje;
  const targetAcc = cuentas[targetId];
  if (!targetAcc) return res.status(404).json({ ok: false, error: 'User no encontrado.' });

  if (!targetAcc.inventario || typeof targetAcc.inventario !== 'object') targetAcc.inventario = { personajes: [] };
  if (!Array.isArray(targetAcc.inventario.personajes)) targetAcc.inventario.personajes = [];

  const actorName = perm.actor?.nombre || (perm.esDev ? 'Dev Supremo' : 'Admin');
  const nuevoPj = {
    id: `pj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    nombre: String(rawPj?.nombre || 'Héroe Exclusivo').trim().slice(0, 24),
    color: rawPj?.color || '#ffd43b',
    hat: rawPj?.hat || 'corona',
    ropa: rawPj?.ropa || 'ninguna',
    ropaColor: rawPj?.ropa && rawPj.ropa !== 'ninguna' ? (rawPj?.ropaColor || undefined) : undefined,
    aura: rawPj?.aura || 'ninguna',
    descripcion: rawPj?.descripcion || 'Personaje exclusivo otorgado',
    fechaAdquisicion: new Date().toISOString(),
    origen: {
      tipo: perm.esDev ? 'regalo_dev' : 'regalo_admin',
      otorgadoPor: perm.esDev ? `Dev ${actorName}` : `Admin ${actorName}`,
      fecha: new Date().toISOString(),
    },
  };

  targetAcc.inventario.personajes.push(nuevoPj);
  dbGuardarCuentaCompleta(targetAcc, true);

  return res.json({
    ok: true,
    mensaje: `Personaje "${nuevoPj.nombre}" entregado al inventario de ${targetAcc.nombre}.`,
    personaje: nuevoPj,
    targetId,
    inventario: targetAcc.inventario,
  });
});

app.post('/api/admin/personajes/quitar', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev && !perm.esAdmin) {
    return res.status(403).json({ ok: false, error: 'Solo Dev o Admin pueden retirar personajes.' });
  }

  const targetId = String(req.body?.targetId || '').trim().toLowerCase();
  const personajeId = String(req.body?.personajeId || '').trim();
  const targetAcc = cuentas[targetId];
  if (!targetAcc) return res.status(404).json({ ok: false, error: 'User no encontrado.' });

  if (targetAcc.inventario && Array.isArray(targetAcc.inventario.personajes)) {
    targetAcc.inventario.personajes = targetAcc.inventario.personajes.filter((p: any) => p.id !== personajeId);
    if (targetAcc.inventario.activoId === personajeId) {
      targetAcc.inventario.activoId = undefined;
      targetAcc.avatarRopa = 'ninguna';
      targetAcc.avatarRopaColor = undefined;
      targetAcc.avatarAura = 'ninguna';
    }
    dbGuardarCuentaCompleta(targetAcc, true);
  }
  return res.json({ ok: true, mensaje: 'Personaje retirado del inventario.', inventario: targetAcc.inventario });
});

app.post('/api/admin/personajes/mover', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev && !perm.esAdmin) {
    return res.status(403).json({ ok: false, error: 'Solo Dev o Admin pueden mover personajes entre users.' });
  }

  const fromId = String(req.body?.fromId || '').trim().toLowerCase();
  const toId = String(req.body?.toId || '').trim().toLowerCase();
  const personajeId = String(req.body?.personajeId || '').trim();
  if (!fromId || !toId || fromId === toId) {
    return res.status(400).json({ ok: false, error: 'Selecciona origen y destino diferentes.' });
  }
  const origenAcc = cuentas[fromId];
  const destinoAcc = cuentas[toId];
  if (!origenAcc || !destinoAcc) return res.status(404).json({ ok: false, error: 'User no encontrado.' });

  const listaOrigen = Array.isArray(origenAcc.inventario?.personajes) ? origenAcc.inventario.personajes : [];
  const charMovido = listaOrigen.find((p: any) => p.id === personajeId);
  if (!charMovido) return res.status(404).json({ ok: false, error: 'Personaje no encontrado en origen.' });

  origenAcc.inventario.personajes = listaOrigen.filter((p: any) => p.id !== personajeId);
  if (origenAcc.inventario.activoId === personajeId) {
    origenAcc.inventario.activoId = undefined;
    origenAcc.avatarRopa = 'ninguna';
    origenAcc.avatarRopaColor = undefined;
    origenAcc.avatarAura = 'ninguna';
  }
  if (!destinoAcc.inventario || typeof destinoAcc.inventario !== 'object') destinoAcc.inventario = { personajes: [] };
  if (!Array.isArray(destinoAcc.inventario.personajes)) destinoAcc.inventario.personajes = [];
  destinoAcc.inventario.personajes.push({ ...charMovido, fechaAdquisicion: new Date().toISOString() });

  dbGuardarCuentaCompleta(origenAcc, false);
  dbGuardarCuentaCompleta(destinoAcc, true);

  return res.json({
    ok: true,
    mensaje: `"${charMovido.nombre}" movido de ${origenAcc.nombre} a ${destinoAcc.nombre}.`,
    inventarioOrigen: origenAcc.inventario,
    inventarioDestino: destinoAcc.inventario,
  });
});

const manejarFijarPremioSemanal = async (req: express.Request, res: express.Response) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev && !perm.esAdmin) return res.status(403).json({ ok: false, error: 'Permisos insuficientes.' });

  const w = obtenerInfoSemana();
  const raw = req.body?.personaje || req.body?.premio || req.body;
  const actorName = perm.actor?.nombre || 'Staff';
  const premio = {
    id: String(raw?.id || `premio_${w.semanaActualId}`).trim(),
    nombre: String(raw?.nombre || 'Héroe Semanal').trim().slice(0, 30),
    color: raw?.color || '#ffd43b',
    hat: raw?.hat || 'corona',
    ropa: raw?.ropa || 'ninguna',
    ropaColor: raw?.ropa && raw.ropa !== 'ninguna' ? (raw?.ropaColor || undefined) : undefined,
    aura: raw?.aura || 'ninguna',
    descripcion: raw?.descripcion || 'Premio exclusivo del Torneo Semanal',
    origen: {
      tipo: 'torneo_semanal',
      otorgadoPor: `Torneo Semanal fijado por ${actorName}`,
      fecha: new Date().toISOString(),
    },
  };
  guardarConfig('premio_semanal_global', premio);
  tocarUltimaActualizacion();
  return res.json({ ok: true, mensaje: `Premio semanal "${premio.nombre}" actualizado.`, premio, premioSemanal: premio });
};

app.post('/api/admin/personajes/fijar-premio-semanal', manejarFijarPremioSemanal);
app.post('/api/admin/premio-semanal', manejarFijarPremioSemanal);
app.get('/api/admin/premio-semanal', (_req, res) => {
  const w = obtenerInfoSemana();
  const premio = leerConfig('premio_semanal_global', null);
  res.json({ ok: true, semanaId: w.semanaActualId, premio, premioSemanal: premio });
});

app.get('/api/admin/config-semanal', (_req, res) => {
  const cfg = leerConfig('config_semanal_puntos', CONFIG_SEMANAL_POR_DEFECTO);
  const premioSemanal = leerConfig('premio_semanal_global', null);
  res.json({ ok: true, config: cfg, premioSemanal });
});

app.post('/api/admin/config-semanal', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev && !perm.esAdmin) return res.status(403).json({ ok: false, error: 'Permisos insuficientes.' });

  const cfg = {
    puntosVictoria: typeof req.body?.puntosVictoria === 'number' ? Math.max(0, req.body.puntosVictoria) : 3,
    puntosEmpate: typeof req.body?.puntosEmpate === 'number' ? Math.max(0, req.body.puntosEmpate) : 1,
    primerLugar: Math.max(0, Number(req.body?.primerLugar) || 50),
    segundoLugar: Math.max(0, Number(req.body?.segundoLugar) || 25),
    tercerLugar: Math.max(0, Number(req.body?.tercerLugar) || 15),
    participacion: Math.max(0, Number(req.body?.participacion) || 5),
  };
  guardarConfig('config_semanal_puntos', cfg);
  tocarUltimaActualizacion();
  return res.json({ ok: true, config: cfg, mensaje: 'Puntos semanales guardados.' });
});

app.get('/api/admin/desbloqueos-personajes', (_req, res) => {
  const raw = leerConfig('config_desbloqueos_personajes', DESBLOQUEOS_POR_DEFECTO);
  res.json({ ok: true, desbloqueos: { ...DESBLOQUEOS_POR_DEFECTO, ...(raw || {}) } });
});

app.post('/api/admin/desbloqueos-personajes', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev) return res.status(403).json({ ok: false, error: 'Solo el Dev puede configurar desbloqueos.' });

  const entrante = req.body?.desbloqueos || req.body || {};
  const limpio = { ...DESBLOQUEOS_POR_DEFECTO };
  for (const k of Object.keys(DESBLOQUEOS_POR_DEFECTO)) {
    if (typeof entrante[k] === 'number' && !isNaN(entrante[k])) limpio[k] = Math.max(0, Math.round(entrante[k]));
  }
  guardarConfig('config_desbloqueos_personajes', limpio);
  tocarUltimaActualizacion();
  return res.json({ ok: true, desbloqueos: limpio, mensaje: 'Requisitos de desbloqueo guardados.' });
});

app.get('/api/admin/salas-personalizadas', (_req, res) => {
  const salas = leerJson(ARCHIVO_SALAS_PERSONALIZADAS, []);
  res.json({ ok: true, salas: Array.isArray(salas) ? salas : [] });
});

app.post('/api/admin/salas-personalizadas', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esMod && !perm.esAdmin && !perm.esDev) {
    return res.status(403).json({ ok: false, error: 'Solo Staff puede crear salas oficiales.' });
  }

  const { codigo, nombre, maxJugadores, modoMuros, tamanoTablero, mensajeEspecial } = req.body || {};
  const codigoLimpio = normalizarCodigoSala(codigo);
  if (!codigoLimpio || codigoLimpio.length < 3) {
    return res.status(400).json({ ok: false, error: 'El código de sala debe tener al menos 3 caracteres.' });
  }

  const ahora = Date.now();
  const nuevaSala = {
    id: `sp_${codigoLimpio}`,
    codigo: codigoLimpio,
    nombre: String(nombre || `Sala Oficial ${codigoLimpio}`).trim().slice(0, 32),
    creador: perm.actor?.nombre || 'Staff',
    creadorId: perm.actor?.id || 'admin',
    creadorRol: perm.esDev ? 'dev' : perm.esAdmin ? 'admin' : 'mod',
    creadoEn: ahora,
    maxJugadores: maxJugadores === 4 ? 4 : 2,
    modoMuros: modoMuros === 'caos' ? 'caos' : modoMuros === 'tactico' ? 'tactico' : 'estandar',
    tamanoTablero: normalizarTamanoTablero(tamanoTablero),
    destacada: true,
    mensajeEspecial: String(mensajeEspecial || '').trim().slice(0, 80),
  };

  let lista = leerJson(ARCHIVO_SALAS_PERSONALIZADAS, []);
  if (!Array.isArray(lista)) lista = [];
  lista = lista.filter((s: any) => s.codigo !== codigoLimpio);
  lista.unshift(nuevaSala);
  escribirJson(ARCHIVO_SALAS_PERSONALIZADAS, lista.slice(0, 25));

  guardarSalaOnline(codigoLimpio, {
    codigo: codigoLimpio,
    nombre: nuevaSala.nombre,
    anfitrion: nuevaSala.creador,
    hostPeerId: `host_${codigoLimpio.toLowerCase()}`,
    color: '#ffd43b',
    hat: 'corona',
    ropa: 'capa',
    ropaColor: '#c92a2a',
    aura: 'dorada',
    maxJugadores: nuevaSala.maxJugadores,
    publica: true,
    enPartida: false,
    jugadoresConectados: 0,
    jugadores: [],
    signals: {},
    seq: 0,
    mensajes: [],
    creadoEn: ahora,
    ultimoCambio: ahora,
    modoMuros: nuevaSala.modoMuros,
    tamanoTablero: nuevaSala.tamanoTablero,
    esOficialStaff: true,
  });

  tocarUltimaActualizacion();
  return res.json({ ok: true, sala: nuevaSala, salas: lista.slice(0, 25), mensaje: `Sala personalizada "${codigoLimpio}" creada.` });
});

app.delete('/api/admin/salas-personalizadas/:codigo', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esMod && !perm.esAdmin && !perm.esDev) {
    return res.status(403).json({ ok: false, error: 'Solo Staff puede gestionar salas oficiales.' });
  }

  const codigoLimpio = normalizarCodigoSala(req.params.codigo);
  let lista = leerJson(ARCHIVO_SALAS_PERSONALIZADAS, []);
  if (Array.isArray(lista)) {
    lista = lista.filter((s: any) => s.codigo !== codigoLimpio);
    escribirJson(ARCHIVO_SALAS_PERSONALIZADAS, lista);
  }
  eliminarSalaOnline(codigoLimpio);
  tocarUltimaActualizacion();
  return res.json({ ok: true, salas: lista, mensaje: `Sala "${codigoLimpio}" eliminada.` });
});

function ejecutarReinicioRankingLocal() {
  const w = obtenerInfoSemana();
  escribirJson(ARCHIVO_RANKING, {});
  const histRaw = leerJson(ARCHIVO_HISTORIAL, {});
  for (const h of Object.values(histRaw) as any[]) {
    if (h) {
      h.puntos = 0;
      h.total_partida = 0;
      h.victorias = 0;
      h.derrotas = 0;
      h.empates = 0;
      h.actualizado_en = Date.now();
    }
  }
  escribirJson(ARCHIVO_HISTORIAL, histRaw);
  eliminarConfig('solicitud_reset_ranking');
  eliminarConfig(`semanal_${w.semanaActualId}`);
  guardarConfig(`semanal_${w.semanaPasadaId}`, { semanaId: w.semanaPasadaId, premiada: true, premiados: [] });
  tocarUltimaActualizacion();
}

app.get('/api/admin/ranking/solicitud-reset', (_req, res) => {
  res.json({ ok: true, solicitud: leerConfig('solicitud_reset_ranking', null) });
});

app.get('/api/admin/ranking/solicitar-reset', (_req, res) => {
  res.json({ ok: true, solicitud: leerConfig('solicitud_reset_ranking', null) });
});

app.post('/api/admin/ranking/solicitar-reset', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev && !perm.esAdmin) return res.status(403).json({ ok: false, error: 'Permisos insuficientes.' });

  const solicitud = {
    solicitada: true,
    porNombre: perm.actor?.nombre || 'Admin',
    porId: perm.actor?.id || 'admin',
    fecha: new Date().toISOString(),
    motivo: String(req.body?.motivo || 'Reinicio periódico solicitado').trim().slice(0, 140),
  };
  guardarConfig('solicitud_reset_ranking', solicitud);
  tocarUltimaActualizacion();
  return res.json({ ok: true, mensaje: 'Solicitud enviada al Dev.', solicitud });
});

app.post('/api/admin/ranking/aprobar-reset', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev) return res.status(403).json({ ok: false, error: 'Solo el Dev puede aprobar el reseteo.' });

  ejecutarReinicioRankingLocal();
  return res.json({ ok: true, mensaje: 'Ranking reseteado a 0.' });
});

app.post('/api/admin/ranking/rechazar-reset', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev) return res.status(403).json({ ok: false, error: 'Solo el Dev puede rechazar solicitudes.' });

  eliminarConfig('solicitud_reset_ranking');
  tocarUltimaActualizacion();
  return res.json({ ok: true, mensaje: 'Solicitud de reseteo desestimada.' });
});

app.post('/api/admin/ranking/resolver-solicitud', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev) return res.status(403).json({ ok: false, error: 'Solo el Dev puede resolver solicitudes.' });

  if (req.body?.accion === 'aprobar') {
    ejecutarReinicioRankingLocal();
    return res.json({ ok: true, mensaje: 'Ranking reiniciado a 0.' });
  }
  eliminarConfig('solicitud_reset_ranking');
  tocarUltimaActualizacion();
  return res.json({ ok: true, mensaje: 'Solicitud rechazada.' });
});

app.get('/api/ranking', (_req, res) => {
  res.json(dbLeerRanking());
});

app.post('/api/ranking', async (req, res) => {
  const cuentas = dbObtenerTodasCuentas();
  const sesion = await resolverSesionLocal(req);
  const perm = verificarPermisosLlamante(req, cuentas, sesion);
  if (!perm.esDev && !perm.esAdmin) {
    return res.status(403).json({ ok: false, revoked: true, error: 'Permisos insuficientes.' });
  }
  const incoming = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as Record<string, any>;
  if (Object.keys(incoming).length === 0) {
    ejecutarReinicioRankingLocal();
    return res.json({ ok: true, dbBound: true });
  }

  const rankRaw = leerJson(ARCHIVO_RANKING, {});
  const w = obtenerInfoSemana();
  for (const [k, r] of Object.entries(incoming)) {
    if (!r || typeof r !== 'object') continue;
    const cleanId = String((r as any).id || k).trim().toLowerCase();
    const acc = cuentas[cleanId] || Object.values(cuentas).find((a: any) => a.nombre.trim().toLowerCase() === String((r as any).nombre || k).trim().toLowerCase());
    if (!acc) continue;
    rankRaw[acc.id] = {
      id: acc.id,
      nombre: acc.nombre,
      puntos: Number((r as any).puntosTotales ?? (r as any).puntos ?? acc.puntos) || 0,
      total_partida: Number((r as any).partidas ?? acc.partidas) || 0,
      victorias: Number((r as any).victorias ?? acc.victorias) || 0,
      derrotas: Number((r as any).derrotas ?? acc.derrotas) || 0,
      empates: Number((r as any).empates ?? acc.empates) || 0,
      avatar_color: (r as any).avatarColor || acc.avatarColor || '#ff6b6b',
      avatar_hat: (r as any).avatarHat || acc.avatarHat || 'corona',
      avatar_ropa: (r as any).avatarRopa || acc.avatarRopa || 'ninguna',
      avatar_ropa_color: (r as any).avatarRopaColor || acc.avatarRopaColor || null,
      avatar_aura: (r as any).avatarAura || acc.avatarAura || 'ninguna',
      semana_actual_id: rankRaw[acc.id]?.semana_actual_id || w.semanaActualId,
      semana_actual_pts: rankRaw[acc.id]?.semana_actual_pts || 0,
      semana_actual_vic: rankRaw[acc.id]?.semana_actual_vic || 0,
      semana_actual_part: rankRaw[acc.id]?.semana_actual_part || 0,
      semana_pasada_id: rankRaw[acc.id]?.semana_pasada_id || w.semanaPasadaId,
      semana_pasada_pts: rankRaw[acc.id]?.semana_pasada_pts || 0,
      semana_pasada_premio: rankRaw[acc.id]?.semana_pasada_premio || null,
      actualizado_en: Date.now(),
    };
  }
  escribirJson(ARCHIVO_RANKING, rankRaw);
  tocarUltimaActualizacion();
  res.json({ ok: true, dbBound: true });
});

function procesarPartidaLocal(body: any, sesion: any, cuentas: Record<string, any>) {
  const w = obtenerInfoSemana();
  dbAsegurarSemanaEnRanking(w);
  const cfgSemanal = leerConfig('config_semanal_puntos', CONFIG_SEMANAL_POR_DEFECTO) || CONFIG_SEMANAL_POR_DEFECTO;

  const partidaId = String(body.partidaId || body.matchId || `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`).trim();
  const fecha = typeof body.fecha === 'string' ? body.fecha : new Date().toISOString();
  const modo = String(body.modo || 'local').trim();
  const duracionSeg = Math.max(0, Number(body.duracionSeg) || 0);

  let participantes = Array.isArray(body.participantes) ? body.participantes : [];
  if (participantes.length === 0 && (body.userId || sesion?.userId)) {
    const fallbackId = String(body.userId || sesion?.userId || '').trim().toLowerCase();
    if (fallbackId) {
      participantes = [
        {
          cuentaId: fallbackId,
          nombre: body.nombre || cuentas[fallbackId]?.nombre || fallbackId,
          resultado: body.resultado || 'derrota',
          puntosGanados: Math.max(0, Number(body.puntosGanados ?? body.puntos) || 0),
          movimientos: Math.max(0, Number(body.movimientos) || 0),
          murosColocados: Math.max(0, Number(body.murosColocados) || 0),
          saltos: Math.max(0, Number(body.saltos) || 0),
          partidaLimpia: Boolean(body.partidaLimpia),
          rival: String(body.rival || 'Rival'),
          logros: Array.isArray(body.logros) ? body.logros : [],
        },
      ];
    }
  }

  const guardados: string[] = [];
  for (const p of participantes) {
    if (!p) continue;
    const buscadoId = String(p.cuentaId || '').trim().toLowerCase();
    let acc = buscadoId ? cuentas[buscadoId] : null;
    if (!acc && p.nombre) {
      const nomLower = String(p.nombre).trim().toLowerCase();
      acc = Object.values(cuentas).find((a: any) => String(a.nombre || '').trim().toLowerCase() === nomLower);
    }
    if (!acc) continue;

    const autorizado = sesion && (sesion.userId === acc.id || sesion.rol === 'dev');
    if (!autorizado) continue;

    const histPrev = Array.isArray(acc.historialPartidas) ? acc.historialPartidas : [];
    if (histPrev.some((h: any) => h && h.id === partidaId)) {
      guardados.push(acc.id);
      continue;
    }

    const resultado = p.resultado === 'victoria' || p.resultado === 'empate' ? p.resultado : 'derrota';
    const puntosGanados = Math.max(0, Number(p.puntosGanados) || 0);
    const ptsSemanalPartida =
      puntosGanados > 0
        ? puntosGanados
        : resultado === 'victoria'
        ? Number(cfgSemanal.puntosVictoria ?? 3)
        : resultado === 'empate'
        ? Number(cfgSemanal.puntosEmpate ?? 1)
        : 0;

    const registroPartida = {
      id: partidaId,
      rival: String(p.rival || 'Rival').slice(0, 40),
      resultado,
      movimientos: Math.max(0, Number(p.movimientos) || 0),
      murosColocados: Math.max(0, Number(p.murosColocados) || 0),
      saltos: Math.max(0, Number(p.saltos) || 0),
      partidaLimpia: Boolean(p.partidaLimpia),
      modo,
      duracionSegundos: duracionSeg,
      puntos: puntosGanados,
      logros: Array.isArray(p.logros) ? p.logros : [],
      fecha,
    };

    acc.puntos = Math.max(0, (Number(acc.puntos) || 0) + puntosGanados);
    acc.partidas = (Number(acc.partidas) || 0) + 1;
    if (resultado === 'victoria') acc.victorias = (Number(acc.victorias) || 0) + 1;
    else if (resultado === 'empate') acc.empates = (Number(acc.empates) || 0) + 1;
    else acc.derrotas = (Number(acc.derrotas) || 0) + 1;

    acc.ultimaConexion = new Date().toISOString();
    acc.historialPartidas = [registroPartida, ...histPrev].slice(0, 50);
    dbGuardarCuentaCompleta(acc, false);

    const rankRaw = leerJson(ARCHIVO_RANKING, {});
    const filaRank = rankRaw[acc.id];
    if (filaRank) {
      const mismoSem = filaRank.semana_actual_id === w.semanaActualId;
      filaRank.semana_actual_id = w.semanaActualId;
      filaRank.semana_actual_pts = (mismoSem ? Number(filaRank.semana_actual_pts) || 0 : 0) + ptsSemanalPartida;
      filaRank.semana_actual_vic = (mismoSem ? Number(filaRank.semana_actual_vic) || 0 : 0) + (resultado === 'victoria' ? 1 : 0);
      filaRank.semana_actual_part = (mismoSem ? Number(filaRank.semana_actual_part) || 0 : 0) + 1;
      filaRank.actualizado_en = Date.now();
      rankRaw[acc.id] = filaRank;
      escribirJson(ARCHIVO_RANKING, rankRaw);
    }
    guardados.push(acc.id);
  }

  if (guardados.length > 0) tocarUltimaActualizacion();
  return guardados;
}

app.post('/api/partida', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const guardados = procesarPartidaLocal(body, sesion, cuentas);
  res.json({ ok: true, dbBound: true, guardados, activeAccountIds: Object.keys(cuentas) });
});

app.post('/api/partidas/sincronizar', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentas = dbObtenerTodasCuentas();
  const cola = Array.isArray(req.body?.partidas) ? req.body.partidas : [];
  const sincronizadas: string[] = [];
  for (const item of cola) {
    const g = procesarPartidaLocal(item, sesion, cuentas);
    if (g.length > 0) sincronizadas.push(item.partidaId || item.matchId);
  }
  res.json({ ok: true, dbBound: true, sincronizadas });
});

app.get('/api/semanal', (_req, res) => {
  const w = obtenerInfoSemana();
  dbAsegurarSemanaEnRanking(w);
  const cuentas = dbObtenerTodasCuentas();
  const cfg = leerConfig('config_semanal_puntos', CONFIG_SEMANAL_POR_DEFECTO) || CONFIG_SEMANAL_POR_DEFECTO;
  const premioGlobal = leerConfig('premio_semanal_global', null);
  const metaActual = leerConfig(`semanal_${w.semanaActualId}`, {}) || {};
  const metaPasada = leerConfig(`semanal_${w.semanaPasadaId}`, { premiada: false, premiados: [] }) || {};

  const rankRaw = leerJson(ARCHIVO_RANKING, {});
  const jugadoresActual: Record<string, any> = {};
  const jugadoresPasada: Record<string, any> = {};

  for (const r of Object.values(rankRaw) as any[]) {
    if (!r) continue;
    const key = String(r.nombre || r.id).trim().toLowerCase();
    if (r.semana_actual_id === w.semanaActualId && (Number(r.semana_actual_part) > 0 || Number(r.semana_actual_pts) > 0)) {
      jugadoresActual[key] = {
        id: r.id,
        nombre: r.nombre || r.id,
        avatarColor: r.avatar_color || '#ff6b6b',
        avatarHat: r.avatar_hat || 'corona',
        avatarRopa: r.avatar_ropa || 'ninguna',
        avatarRopaColor: r.avatar_ropa_color || undefined,
        avatarAura: r.avatar_aura || 'ninguna',
        puntos: Number(r.semana_actual_pts) || 0,
        partidas: Number(r.semana_actual_part) || 0,
        victorias: Number(r.semana_actual_vic) || 0,
      };
    }
    if (r.semana_pasada_id === w.semanaPasadaId && Number(r.semana_pasada_pts) > 0) {
      jugadoresPasada[key] = {
        id: r.id,
        nombre: r.nombre || r.id,
        avatarColor: r.avatar_color || '#ff6b6b',
        avatarHat: r.avatar_hat || 'corona',
        avatarRopa: r.avatar_ropa || 'ninguna',
        avatarRopaColor: r.avatar_ropa_color || undefined,
        avatarAura: r.avatar_aura || 'ninguna',
        puntos: Number(r.semana_pasada_pts) || 0,
        partidas: 1,
        victorias: 0,
      };
    }
  }

  for (const acc of Object.values(cuentas)) {
    const hist = Array.isArray(acc.historialPartidas) ? acc.historialPartidas : [];
    const key = String(acc.nombre || acc.id).trim().toLowerCase();
    let actPts = 0, actPart = 0, actVic = 0;
    let pasPts = 0, pasPart = 0, pasVic = 0;

    for (const m of hist) {
      if (!m || !m.fecha) continue;
      const t = new Date(m.fecha).getTime();
      if (isNaN(t)) continue;
      const ptsM = Math.max(0, Number(m.puntos) || 0);
      if (t >= w.lunesUtc && t < w.proximoLunesUtc) {
        actPart++;
        actPts += ptsM > 0 ? ptsM : (m.resultado === 'victoria' ? (cfg.puntosVictoria || 3) : m.resultado === 'empate' ? (cfg.puntosEmpate || 1) : 0);
        if (m.resultado === 'victoria') actVic++;
      } else if (t >= w.lunesPasadoUtc && t < w.lunesUtc) {
        pasPart++;
        pasPts += ptsM > 0 ? ptsM : (m.resultado === 'victoria' ? (cfg.puntosVictoria || 3) : m.resultado === 'empate' ? (cfg.puntosEmpate || 1) : 0);
        if (m.resultado === 'victoria') pasVic++;
      }
    }
    if (actPart > 0) {
      const prevA = jugadoresActual[key];
      jugadoresActual[key] = {
        id: acc.id,
        nombre: acc.nombre,
        avatarColor: acc.avatarColor || '#ff6b6b',
        avatarHat: acc.avatarHat || 'corona',
        avatarRopa: acc.avatarRopa || 'ninguna',
        avatarRopaColor: acc.avatarRopaColor,
        avatarAura: acc.avatarAura || 'ninguna',
        puntos: Math.max(prevA?.puntos || 0, actPts),
        partidas: Math.max(prevA?.partidas || 0, actPart),
        victorias: Math.max(prevA?.victorias || 0, actVic),
      };
    }
    if (pasPart > 0) {
      const prevP = jugadoresPasada[key];
      jugadoresPasada[key] = {
        id: acc.id,
        nombre: acc.nombre,
        avatarColor: acc.avatarColor || '#ff6b6b',
        avatarHat: acc.avatarHat || 'corona',
        avatarRopa: acc.avatarRopa || 'ninguna',
        avatarRopaColor: acc.avatarRopaColor,
        avatarAura: acc.avatarAura || 'ninguna',
        puntos: Math.max(prevP?.puntos || 0, pasPts),
        partidas: Math.max(prevP?.partidas || 0, pasPart),
        victorias: Math.max(prevP?.victorias || 0, pasVic),
      };
    }
  }

  if (!metaPasada.premiada) {
    const candidatos = Object.values(jugadoresPasada).filter((j: any) => j && j.partidas > 0 && j.puntos > 0);
    if (candidatos.length > 0) {
      candidatos.sort((a: any, b: any) => (b.puntos !== a.puntos ? b.puntos - a.puntos : b.victorias - a.victorias));
      const bonos = [Number(cfg.primerLugar ?? 50), Number(cfg.segundoLugar ?? 25), Number(cfg.tercerLugar ?? 15)];
      const premiados: any[] = [];
      for (let i = 0; i < Math.min(3, candidatos.length); i++) {
        const cand = candidatos[i] as any;
        const acc = cuentas[cand.id];
        if (!acc) continue;
        const bono = bonos[i] || 0;
        acc.puntos = (Number(acc.puntos) || 0) + bono;
        let personajePremio = undefined;
        const premioSem = metaPasada.premioSemanal || premioGlobal;
        if (i === 0 && premioSem && premioSem.nombre) {
          if (!acc.inventario) acc.inventario = { personajes: [] };
          if (!Array.isArray(acc.inventario.personajes)) acc.inventario.personajes = [];
          const pId = `${premioSem.id}_${w.semanaPasadaId}`;
          if (!acc.inventario.personajes.some((p: any) => p.id === pId || p.id === premioSem.id)) {
            personajePremio = {
              ...premioSem,
              id: pId,
              fechaAdquisicion: new Date().toISOString(),
              origen: {
                tipo: 'torneo_semanal',
                otorgadoPor: `Campeón Torneo Semanal ${w.semanaPasadaId}`,
                fecha: new Date().toISOString(),
                semanaTorneo: w.semanaPasadaId,
              },
            };
            acc.inventario.personajes.push(personajePremio);
          }
        }
        dbGuardarCuentaCompleta(acc, false);
        premiados.push({ nombre: acc.nombre, puesto: i + 1, bono, personajePremio });
      }
      metaPasada.premiada = true;
      metaPasada.premiados = premiados;
      guardarConfig(`semanal_${w.semanaPasadaId}`, metaPasada);
      tocarUltimaActualizacion();
    }
  }

  res.json({
    ok: true,
    dbBound: true,
    semanaActualId: w.semanaActualId,
    semanaPasadaId: w.semanaPasadaId,
    cierraEnMs: w.cierraEnMs,
    actual: {
      semanaId: w.semanaActualId,
      premioSemanal: metaActual.premioSemanal || premioGlobal || undefined,
      puntosConfig: { primerLugar: Number(cfg.primerLugar ?? 50), segundoLugar: Number(cfg.segundoLugar ?? 25), tercerLugar: Number(cfg.tercerLugar ?? 15) },
      jugadores: jugadoresActual,
    },
    pasada: {
      semanaId: w.semanaPasadaId,
      premiada: Boolean(metaPasada.premiada),
      premiados: Array.isArray(metaPasada.premiados) ? metaPasada.premiados : [],
      premioSemanal: metaPasada.premioSemanal || premioGlobal || undefined,
      jugadores: jugadoresPasada,
    },
  });
});

app.post('/api/semanal', (_req, res) => {
  res.json({ ok: true, dbBound: true });
});

app.get('/api/salas', (_req, res) => {
  limpiarSalasExpiradas();
  const salasRaw = leerJson(ARCHIVO_SALAS_ONLINE, {}) as Record<string, any>;
  const validas = Object.values(salasRaw)
    .filter((r: any) => r && r.publica !== false && !r.enPartida && (r.jugadoresConectados || 0) < (r.maxJugadores || 2))
    .sort((a: any, b: any) => (b.creadoEn || 0) - (a.creadoEn || 0));
  res.json(validas);
});

app.post('/api/salas', (req, res) => {
  limpiarSalasExpiradas();
  const room = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const codigo = normalizarCodigoSala(room.codigo);
  if (!codigo) return res.status(400).json({ ok: false, error: 'Código inválido' });

  const ahora = Date.now();
  const existente = leerSalaOnline(codigo);
  const esPublica = room.publica !== undefined ? Boolean(room.publica) : existente?.publica ?? true;
  const hostPeerId = room.hostPeerId || existente?.hostPeerId || `host_${codigo.toLowerCase()}`;
  const maxJugadores = room.maxJugadores === 4 ? 4 : existente?.maxJugadores || 2;
  const anfitrion = String(room.anfitrion || existente?.anfitrion || 'Anfitrión').trim();
  const color = room.color || existente?.color || '#ff6b6b';
  const hat = room.hat || existente?.hat || 'corona';
  const ropa = room.ropa || existente?.ropa || 'ninguna';
  const ropaColor = room.ropaColor || existente?.ropaColor;
  const aura = room.aura || existente?.aura || 'ninguna';

  const jugadores =
    Array.isArray(room.jugadores) && room.jugadores.length > 0
      ? room.jugadores
      : existente?.jugadores?.length
      ? existente.jugadores
      : [{ id: 0, peerId: hostPeerId, cuentaId: room.cuentaId, nombre: anfitrion, color, hat, ropa, ropaColor, aura, listo: true, conectado: true, esAnfitrion: true }];

  const salaCompleta = {
    codigo,
    nombre: String(room.nombre || existente?.nombre || `Sala de ${anfitrion}`).trim(),
    anfitrion,
    hostPeerId,
    color,
    hat,
    ropa,
    ropaColor,
    aura,
    maxJugadores,
    publica: esPublica,
    enPartida: false,
    jugadoresConectados: jugadores.length,
    jugadores,
    signals: existente?.signals || {},
    seq: existente?.seq || 0,
    mensajes: existente?.mensajes || [],
    creadoEn: existente?.creadoEn || ahora,
    ultimoCambio: ahora,
    modoMuros: existente?.modoMuros || room.modoMuros,
    tamanoTablero: normalizarTamanoTablero(existente?.tamanoTablero ?? room.tamanoTablero),
    esOficialStaff: Boolean(existente?.esOficialStaff),
  };

  guardarSalaOnline(codigo, salaCompleta);
  res.json({ ok: true, dbBound: true, sala: salaCompleta, timestamp: ahora });
});

app.get('/api/salas/:codigo', (req, res) => {
  const sala = leerSalaOnline(req.params.codigo);
  if (!sala) return res.status(404).json({ ok: false, error: 'Sala no disponible' });

  const since = parseInt(String(req.query.since || '0'), 10) || 0;
  const peerId = String(req.query.peerId || '').trim();
  const mensajesNuevos = Array.isArray(sala.mensajes)
    ? sala.mensajes.filter((m: any) => m && m.seq > since && (!peerId || m.from !== peerId) && (!m.to || m.to === peerId))
    : [];

  res.json({
    ok: true,
    sala: {
      codigo: sala.codigo,
      nombre: sala.nombre,
      anfitrion: sala.anfitrion,
      hostPeerId: sala.hostPeerId,
      maxJugadores: sala.maxJugadores,
      publica: sala.publica,
      enPartida: Boolean(sala.enPartida),
      jugadores: sala.jugadores || [],
      signals: sala.signals || {},
      seq: sala.seq || 0,
      ultimoCambio: sala.ultimoCambio || sala.creadoEn || 0,
      modoMuros: sala.modoMuros,
      tamanoTablero: normalizarTamanoTablero(sala.tamanoTablero),
      esOficialStaff: Boolean(sala.esOficialStaff),
      mensajesNuevos,
    },
  });
});

app.post('/api/salas/:codigo/join', (req, res) => {
  const codigo = normalizarCodigoSala(req.params.codigo);
  const sala = leerSalaOnline(codigo);
  if (!sala) return res.status(404).json({ ok: false, error: `La sala ${codigo} no existe o ya cerró.` });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const peerId = String(body.peerId || '').trim();
  const cuentaId = body.cuentaId ? String(body.cuentaId).trim().toLowerCase() : undefined;
  const nombre = String(body.nombre || 'Invitado').trim() || 'Invitado';
  const color = body.color || '#4dabf7';
  const hat = body.hat || 'pompon';
  const ropa = body.ropa || 'ninguna';
  const ropaColor = body.ropaColor || undefined;
  const aura = body.aura || 'ninguna';
  const offer = body.offer || null;

  if (!peerId) return res.status(400).json({ ok: false, error: 'Falta peerId' });
  if (!Array.isArray(sala.jugadores)) sala.jugadores = [];
  if (!sala.signals || typeof sala.signals !== 'object') sala.signals = {};

  let existente = sala.jugadores.find((p: any) => p.peerId === peerId);
  if (!existente && sala.enPartida) {
    const porNombre = sala.jugadores.find((p: any) => !p.esAnfitrion && String(p.nombre || '').toLowerCase() === nombre.toLowerCase());
    if (porNombre) {
      porNombre.peerId = peerId;
      porNombre.conectado = true;
      existente = porNombre;
    } else {
      return res.status(409).json({ ok: false, error: 'La partida en esta sala ya comenzó.' });
    }
  }

  let esAnfitrionResultado = false;
  if (existente) {
    existente.nombre = nombre;
    existente.cuentaId = cuentaId || existente.cuentaId;
    existente.color = color || existente.color;
    existente.hat = hat || existente.hat;
    existente.ropa = ropa || existente.ropa || 'ninguna';
    existente.ropaColor = ropaColor !== undefined ? ropaColor : existente.ropaColor;
    existente.aura = aura || existente.aura || 'ninguna';
    existente.conectado = true;
    esAnfitrionResultado = Boolean(existente.esAnfitrion);
  } else {
    if (sala.jugadores.length >= (sala.maxJugadores || 2)) {
      return res.status(409).json({ ok: false, error: 'La sala ya está llena.' });
    }
    const coloresBase = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66'];
    const gorrosBase = ['corona', 'pompon', 'antena', 'brote'];
    const esPrimero = sala.jugadores.length === 0;
    const nuevoId = sala.jugadores.length;
    const nuevoJugador = {
      id: nuevoId,
      peerId,
      cuentaId,
      nombre,
      color: color || coloresBase[nuevoId] || '#4dabf7',
      hat: hat || gorrosBase[nuevoId] || 'pompon',
      ropa,
      ropaColor,
      aura,
      listo: true,
      conectado: true,
      esAnfitrion: esPrimero,
    };
    if (esPrimero) {
      sala.hostPeerId = peerId;
      sala.anfitrion = nombre;
    }
    sala.jugadores.push(nuevoJugador);
    esAnfitrionResultado = esPrimero;
  }

  if (offer && !esAnfitrionResultado) {
    sala.signals[peerId] = { ...(sala.signals[peerId] || {}), offer, answer: null, updatedAt: Date.now() };
  }

  sala.jugadoresConectados = sala.jugadores.length;
  guardarSalaOnline(codigo, sala);
  res.json({ ok: true, sala, esAnfitrion: esAnfitrionResultado });
});

app.post('/api/salas/:codigo/signal', (req, res) => {
  const codigo = normalizarCodigoSala(req.params.codigo);
  const sala = leerSalaOnline(codigo);
  if (!sala) return res.status(404).json({ ok: false, error: 'Sala no disponible' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const clientPeerId = String(body.clientPeerId || '').trim();
  if (clientPeerId) {
    if (!sala.signals || typeof sala.signals !== 'object') sala.signals = {};
    const prev = sala.signals[clientPeerId] || {};
    sala.signals[clientPeerId] = {
      ...prev,
      ...(body.offer !== undefined ? { offer: body.offer } : {}),
      ...(body.answer !== undefined ? { answer: body.answer } : {}),
      updatedAt: Date.now(),
    };
    guardarSalaOnline(codigo, sala);
  }
  res.json({ ok: true });
});

app.post('/api/salas/:codigo/msg', (req, res) => {
  const codigo = normalizarCodigoSala(req.params.codigo);
  const sala = leerSalaOnline(codigo);
  if (!sala) return res.status(404).json({ ok: false, error: 'Sala no disponible' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (body && body.msg) {
    sala.seq = (sala.seq || 0) + 1;
    if (!Array.isArray(sala.mensajes)) sala.mensajes = [];
    sala.mensajes.push({ seq: sala.seq, from: String(body.from || ''), to: body.to ? String(body.to) : null, msg: body.msg, ts: Date.now() });
    if (sala.mensajes.length > 40) sala.mensajes = sala.mensajes.slice(-40);
    if (body.msg.type === 'START_GAME') sala.enPartida = true;
    guardarSalaOnline(codigo, sala);
  }
  res.json({ ok: true, seq: sala.seq || 0 });
});

app.post('/api/salas/:codigo/leave', (req, res) => {
  const codigo = normalizarCodigoSala(req.params.codigo);
  const sala = leerSalaOnline(codigo);
  if (sala) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const peerId = String(body.peerId || '').trim();
    const nombre = String(body.nombre || 'El otro jugador').trim();
    const jugadorId = typeof body.jugadorId === 'number' ? body.jugadorId : 1;

    if (!sala.enPartida && Array.isArray(sala.jugadores)) {
      sala.jugadores = sala.jugadores.filter((p: any) => (sala.esOficialStaff ? p.peerId !== peerId : (p.esAnfitrion || p.peerId !== peerId)));
      sala.jugadores.forEach((p: any, idx: number) => {
        p.id = idx;
        p.esAnfitrion = idx === 0;
      });
      if (sala.jugadores.length > 0 && sala.esOficialStaff) {
        sala.hostPeerId = sala.jugadores[0].peerId;
        sala.anfitrion = sala.jugadores[0].nombre;
      }
      sala.jugadoresConectados = sala.jugadores.length;
      if (sala.signals && peerId) delete sala.signals[peerId];
    } else if (Array.isArray(sala.jugadores)) {
      const saliente = sala.jugadores.find((p: any) => p.peerId === peerId || p.id === jugadorId);
      if (saliente) saliente.conectado = false;
    }

    sala.seq = (sala.seq || 0) + 1;
    if (!Array.isArray(sala.mensajes)) sala.mensajes = [];
    sala.mensajes.push({ seq: sala.seq, from: peerId, to: null, msg: { type: 'PLAYER_LEFT', jugadorId, nombre }, ts: Date.now() });
    if (sala.mensajes.length > 40) sala.mensajes = sala.mensajes.slice(-40);
    guardarSalaOnline(codigo, sala);
  }
  res.json({ ok: true });
});

app.patch('/api/salas/:codigo', (req, res) => {
  const codigo = normalizarCodigoSala(req.params.codigo);
  const sala = leerSalaOnline(codigo);
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (sala) {
    if (typeof body.jugadoresConectados === 'number') sala.jugadoresConectados = body.jugadoresConectados;
    if (typeof body.enPartida === 'boolean') sala.enPartida = body.enPartida;
    guardarSalaOnline(codigo, sala);
  }
  res.json({ ok: true, dbBound: true });
});

app.delete('/api/salas/:codigo', (req, res) => {
  eliminarSalaOnline(req.params.codigo);
  res.json({ ok: true, dbBound: true });
});

async function iniciarServidor() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PUERTO, '0.0.0.0', () => {
    console.log(`Servidor Muros Locos escuchando en http://0.0.0.0:${PUERTO}`);
  });
}

iniciarServidor().catch((err) => {
  console.error('Fallo al iniciar el servidor:', err);
});
