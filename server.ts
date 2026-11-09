import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  next();
});

const DATA_DIR = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CUENTAS_FILE = path.join(DATA_DIR, 'cuentas.json');
const RANKING_FILE = path.join(DATA_DIR, 'ranking.json');
const SALAS_FILE = path.join(DATA_DIR, 'salas.json');

function readJsonFile(filePath: string, fallback: any = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: any) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

const getAdminCredentials = () => ({
  user: String(process.env.ADMIN_USERNAME || process.env.ADMIN_USER || 'admin').trim(),
  pass: String(process.env.ADMIN_SECRET_KEY || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || 'muros2026').trim(),
});

function sanitizeCuentas(cuentas: Record<string, any>) {
  const copy = { ...(cuentas || {}) };
  if (copy['admin']) {
    copy['admin'] = {
      ...copy['admin'],
      id: 'admin',
      rol: 'admin',
      esSupremo: true,
      clave: '***SUPREMO***',
    };
  }
  return copy;
}

function buildSupremeProfile(cuentas: Record<string, any>) {
  const existing = cuentas['admin'] || {};
  return {
    id: 'admin',
    nombre: existing.nombre || 'Admin Supremo',
    clave: '***SUPREMO***',
    rol: 'admin' as const,
    esSupremo: true,
    avatarColor: existing.avatarColor || '#ffd43b',
    avatarHat: existing.avatarHat || 'corona',
    temaTablero: existing.temaTablero || 'madera',
    puntos: typeof existing.puntos === 'number' ? existing.puntos : 0,
    partidas: typeof existing.partidas === 'number' ? existing.partidas : 0,
    victorias: typeof existing.victorias === 'number' ? existing.victorias : 0,
    elo: typeof existing.elo === 'number' ? existing.elo : 0,
    creadoEn: existing.creadoEn || new Date().toISOString(),
    ultimaConexion: new Date().toISOString(),
    historialPartidas: existing.historialPartidas || [],
  };
}

// Ensure Supreme Admin public entry exists without storing raw secret key
let cuentasInit = readJsonFile(CUENTAS_FILE, {});
cuentasInit['admin'] = buildSupremeProfile(cuentasInit);
writeJsonFile(CUENTAS_FILE, sanitizeCuentas(cuentasInit));

let salasPublicas: Record<string, any> = readJsonFile(SALAS_FILE, {});
const salasActivas: Map<string, any> = new Map(Object.entries(salasPublicas));
let lastKvUpdate = Date.now();

function normalizeSalaCode(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, '');
}

function syncPublicSalasFile() {
  const pub: Record<string, any> = {};
  for (const [code, r] of salasActivas.entries()) {
    if (
      r &&
      r.publica !== false &&
      !r.enPartida &&
      (r.jugadoresConectados || 1) < (r.maxJugadores || 2)
    ) {
      pub[code] = {
        codigo: r.codigo,
        nombre: r.nombre,
        anfitrion: r.anfitrion,
        color: r.color,
        hat: r.hat,
        maxJugadores: r.maxJugadores,
        publica: true,
        enPartida: false,
        jugadoresConectados: r.jugadoresConectados || 1,
        creadoEn: r.creadoEn,
        ultimoCambio: r.ultimoCambio,
      };
    }
  }
  salasPublicas = pub;
  writeJsonFile(SALAS_FILE, pub);
}

function cleanExpiredRooms() {
  const now = Date.now();
  let changed = false;
  for (const [code, r] of salasActivas.entries()) {
    const age = now - (r.creadoEn || 0);
    const idle = now - (r.ultimoCambio || r.creadoEn || 0);
    const maxIdle = r.enPartida ? 15 * 60 * 1000 : 5 * 60 * 1000;
    if (age > 60 * 60 * 1000 || idle > maxIdle) {
      salasActivas.delete(code);
      changed = true;
    }
  }
  if (changed) {
    syncPublicSalasFile();
  }
}

app.get('/api/ping', (_req, res) => {
  cleanExpiredRooms();
  const cuentasData = readJsonFile(CUENTAS_FILE, {});
  const adminUserConfigured = Boolean(process.env.ADMIN_USERNAME || process.env.ADMIN_USER);
  const adminKeyConfigured = Boolean(
    process.env.ADMIN_SECRET_KEY || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD
  );
  res.setHeader('X-KV-Bound', 'true');
  res.setHeader('X-DB-Bound', 'true');
  res.setHeader('X-Database-Bound', 'true');
  res.json({
    ok: true,
    kvBound: true,
    dbBound: true,
    d1Bound: true,
    dbType: 'D1 (Database Local / Dev)',
    adminUserConfigured,
    adminKeyConfigured,
    source: 'local_database_store',
    timestamp: Date.now(),
    lastUpdate: lastKvUpdate,
    salasCount: Object.keys(salasPublicas).length,
    cuentasCount: Object.keys(cuentasData).length,
  });
});

const textEncoder = new TextEncoder();
const toBase64 = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64');
const fromBase64 = (str: string) => Buffer.from(str, 'base64');

async function hashClavePBKDF2(clave: string, saltB64?: string, iterations = 100000) {
  const salt = saltB64 ? fromBase64(saltB64) : globalThis.crypto.getRandomValues(new Uint8Array(16));
  const importedKey = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(clave),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    importedKey,
    256
  );
  return {
    claveHash: toBase64(derivedBits),
    claveSalt: toBase64(salt),
    claveIter: iterations,
  };
}

function timeConstantCompare(a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(str: string) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(str));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function verificarClaveCuenta(cuenta: any, candidateClave: string) {
  if (!cuenta || typeof candidateClave !== 'string') return false;
  if (cuenta.claveHash && cuenta.claveSalt) {
    const computed = await hashClavePBKDF2(candidateClave, cuenta.claveSalt, cuenta.claveIter || 100000);
    return timeConstantCompare(computed.claveHash, cuenta.claveHash);
  }
  if (typeof cuenta.clave === 'string' && cuenta.clave.length > 0 && cuenta.clave !== '***SUPREMO***') {
    return timeConstantCompare(cuenta.clave, candidateClave);
  }
  return false;
}

const localSessions = new Map<string, { usuarioId: string; rol: string; expiraEn: number }>();

async function crearSesionLocal(usuarioId: string, rol: string, duracionHoras = 720) {
  const rawBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(rawBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  const expiraEn = Date.now() + duracionHoras * 3600 * 1000;
  localSessions.set(tokenHash, { usuarioId, rol, expiraEn });
  return { token, tokenHash, expiraEn, usuarioId, rol };
}

async function resolverSesionLocal(req: express.Request) {
  const authHeader = req.header('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const s = localSessions.get(tokenHash);
  if (s && s.expiraEn > Date.now()) {
    return s;
  }
  return null;
}

function sanitizeCuentaParaEnviar(acc: any) {
  if (!acc || typeof acc !== 'object') return null;
  const copy = { ...acc };
  delete copy.clave;
  delete copy.clave_plano;
  delete copy.clave_hash;
  delete copy.claveHash;
  delete copy.clave_salt;
  delete copy.claveSalt;
  delete copy.clave_iter;
  delete copy.claveIter;
  return copy;
}

function sanitizeCuentasParaEnviar(cuentasMap: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const [id, acc] of Object.entries(cuentasMap || {})) {
    result[id] = sanitizeCuentaParaEnviar(acc);
  }
  return result;
}

// 1. /api/login — Login seguro en servidor con PBKDF2 y sesiones
app.post('/api/login', async (req, res) => {
  const { usuario, clave } = req.body || {};
  const trimmedUser = String(usuario || '').trim();
  const trimmedKey = String(clave || '').trim();
  const { user: ADMIN_USER, pass: ADMIN_PASS } = getAdminCredentials();

  if (!trimmedUser || !trimmedKey) {
    return res.status(400).json({ ok: false, error: 'Usuario y clave requeridos.' });
  }

  // A) Admin Supremo
  if (trimmedUser.toLowerCase() === ADMIN_USER.toLowerCase()) {
    if (!timeConstantCompare(trimmedKey, ADMIN_PASS)) {
      return res.status(401).json({ ok: false, error: 'Clave del Admin Supremo incorrecta.' });
    }
    const cuentasData = readJsonFile(CUENTAS_FILE, {});
    const supremeUser = buildSupremeProfile(cuentasData);
    cuentasData['admin'] = supremeUser;
    writeJsonFile(CUENTAS_FILE, cuentasData);
    const sesion = await crearSesionLocal('admin', 'admin', 24);
    res.setHeader('X-KV-Bound', 'true');
    return res.json({
      ok: true,
      isSupremeAdmin: true,
      token: sesion.token,
      user: supremeUser,
    });
  }

  // B) Usuario normal o admin delegado
  const cuentasData = readJsonFile(CUENTAS_FILE, {});
  const search = trimmedUser.toLowerCase();
  let cuentaFound: any = null;
  for (const acc of Object.values(cuentasData)) {
    if (!acc || typeof acc !== 'object' || (acc as any).id === 'admin') continue;
    if (
      String((acc as any).nombre || '').trim().toLowerCase() === search ||
      String((acc as any).id || '').trim().toLowerCase() === search
    ) {
      cuentaFound = acc;
      break;
    }
  }

  if (!cuentaFound) {
    return res.status(404).json({ ok: false, error: 'Usuario no encontrado. Regístrate para jugar.' });
  }

  const passValida = await verificarClaveCuenta(cuentaFound, trimmedKey);
  if (!passValida) {
    return res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
  }

  // Migración transparente a PBKDF2
  if (!cuentaFound.claveHash || cuentaFound.clave) {
    const hashData = await hashClavePBKDF2(trimmedKey);
    cuentaFound.claveHash = hashData.claveHash;
    cuentaFound.claveSalt = hashData.claveSalt;
    cuentaFound.claveIter = hashData.claveIter;
    delete cuentaFound.clave;
    cuentasData[cuentaFound.id] = cuentaFound;
    writeJsonFile(CUENTAS_FILE, cuentasData);
  }

  cuentaFound.ultimaConexion = new Date().toISOString();
  cuentasData[cuentaFound.id] = cuentaFound;
  writeJsonFile(CUENTAS_FILE, cuentasData);

  const sesion = await crearSesionLocal(cuentaFound.id, cuentaFound.rol || 'jugador', 720);
  res.setHeader('X-KV-Bound', 'true');
  return res.json({
    ok: true,
    isSupremeAdmin: false,
    token: sesion.token,
    user: sanitizeCuentaParaEnviar(cuentaFound),
  });
});

// 2. /api/registro — Registro directo con hash PBKDF2
app.post('/api/registro', async (req, res) => {
  const { id, nombre, clave, avatarColor, avatarHat, temaTablero } = req.body || {};
  const cleanId = String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanName = String(nombre || '').trim();
  const cleanKey = String(clave || '').trim();

  if (!cleanId || cleanName.length < 3 || cleanName.length > 15) {
    return res.status(400).json({ ok: false, error: 'El nombre debe tener entre 3 y 15 letras.' });
  }
  if (cleanKey.length < 4) {
    return res.status(400).json({ ok: false, error: 'La clave debe tener al menos 4 caracteres.' });
  }
  if (cleanId === 'admin' || cleanName.toLowerCase() === 'admin') {
    return res.status(400).json({ ok: false, error: 'Ese nombre está reservado.' });
  }

  const cuentasData = readJsonFile(CUENTAS_FILE, {});
  for (const acc of Object.values(cuentasData)) {
    if (!acc || typeof acc !== 'object') continue;
    if (
      (acc as any).id?.toLowerCase() === cleanId ||
      String((acc as any).nombre || '').trim().toLowerCase() === cleanName.toLowerCase()
    ) {
      return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese nombre.' });
    }
  }

  const hashData = await hashClavePBKDF2(cleanKey);
  const nuevaCuenta = {
    id: cleanId,
    nombre: cleanName,
    claveHash: hashData.claveHash,
    claveSalt: hashData.claveSalt,
    claveIter: hashData.claveIter,
    rol: 'jugador',
    puntos: 0,
    victorias: 0,
    derrotas: 0,
    empates: 0,
    partidas: 0,
    elo: 1000,
    avatarColor: avatarColor || '#ff6b6b',
    avatarHat: avatarHat || 'corona',
    temaTablero: temaTablero || 'madera',
    creadoEn: new Date().toISOString(),
    ultimaConexion: new Date().toISOString(),
    historialPartidas: [],
  };

  cuentasData[cleanId] = nuevaCuenta;
  writeJsonFile(CUENTAS_FILE, cuentasData);

  const sesion = await crearSesionLocal(cleanId, 'jugador', 720);
  res.setHeader('X-KV-Bound', 'true');
  return res.json({
    ok: true,
    token: sesion.token,
    user: sanitizeCuentaParaEnviar(nuevaCuenta),
  });
});

// 3. /api/admin/restablecer-clave
app.post('/api/admin/restablecer-clave', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const cuentasData = readJsonFile(CUENTAS_FILE, {});
  const { isSupreme } = verifyExpressCallerAdmin(req, cuentasData);
  const esAutorizado = (sesion && sesion.usuarioId === 'admin') || isSupreme;

  if (!esAutorizado) {
    return res.status(403).json({ ok: false, error: 'Solo el Admin Supremo puede restablecer claves.' });
  }

  const targetId = String(req.body?.targetId || '').trim();
  const target = cuentasData[targetId];
  if (!target || targetId === 'admin') {
    return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
  }

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let claveTemporal = 'Muros-';
  for (let i = 0; i < 6; i++) {
    claveTemporal += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const hashData = await hashClavePBKDF2(claveTemporal);
  target.claveHash = hashData.claveHash;
  target.claveSalt = hashData.claveSalt;
  target.claveIter = hashData.claveIter;
  delete target.clave;
  cuentasData[targetId] = target;
  writeJsonFile(CUENTAS_FILE, cuentasData);

  return res.json({
    ok: true,
    usuarioNombre: target.nombre,
    claveTemporal,
  });
});

// Login verification for Supreme Admin (compatibilidad)
app.post('/api/admin/verify', async (req, res) => {
  const { usuario, clave } = req.body || {};
  const trimmedUser = String(usuario || '').trim();
  const trimmedKey = String(clave || '').trim();
  const { user: ADMIN_USER, pass: ADMIN_PASS } = getAdminCredentials();

  const isSupremeUsername = trimmedUser.toLowerCase() === ADMIN_USER.toLowerCase();

  if (isSupremeUsername) {
    if (trimmedKey === ADMIN_PASS) {
      const cuentasData = readJsonFile(CUENTAS_FILE, {});
      const supremeUser = buildSupremeProfile(cuentasData);
      cuentasData['admin'] = supremeUser;
      writeJsonFile(CUENTAS_FILE, sanitizeCuentas(cuentasData));
      const sesion = await crearSesionLocal('admin', 'admin', 24);
      res.setHeader('X-KV-Bound', 'true');
      return res.json({
        ok: true,
        isSupremeAdmin: true,
        isCloudAdmin: true,
        kvBound: true,
        adminUser: ADMIN_USER,
        adminToken: sesion.token,
        token: sesion.token,
        user: supremeUser,
      });
    }
    return res.status(401).json({
      ok: false,
      isSupremeAttempt: true,
      error: 'Clave del Admin Supremo incorrecta.',
    });
  }

  return res.json({ ok: false, isSupremeAttempt: false });
});

// Action verification checked automatically before EVERY admin action
app.post('/api/admin/verify-action', async (req, res) => {
  const { usuarioId, usuarioClave, adminUser, adminToken, requiereSupremo } = req.body || {};
  const { user: ADMIN_USER, pass: ADMIN_PASS } = getAdminCredentials();

  // 1. Supreme Admin
  if (
    usuarioId === 'admin' &&
    ((adminUser && adminToken && String(adminUser).trim().toLowerCase() === ADMIN_USER.toLowerCase() && String(adminToken).trim() === ADMIN_PASS) ||
     (await resolverSesionLocal(req))?.usuarioId === 'admin')
  ) {
    res.setHeader('X-KV-Bound', 'true');
    return res.json({ ok: true, isSupremeAdmin: true, isCloudAdmin: true, kvBound: true });
  }

  if (requiereSupremo) {
    return res.status(403).json({
      ok: false,
      revoked: false,
      error: 'Solo el Admin Supremo puede otorgar o quitar el rol de Administrador.',
    });
  }

  // 2. Delegated Admin
  if (usuarioId && usuarioId !== 'admin') {
    const cuentasData = readJsonFile(CUENTAS_FILE, {});
    const acc = cuentasData[usuarioId];
    if (acc && acc.rol === 'admin') {
      res.setHeader('X-KV-Bound', 'true');
      return res.json({ ok: true, isSupremeAdmin: false, isCloudAdmin: true, kvBound: true });
    }
  }

  return res.status(403).json({
    ok: false,
    revoked: true,
    error: 'Tus permisos de administrador no son válidos o fueron revocados.',
  });
});

function verifyExpressCallerAdmin(req: express.Request, existingCuentas: Record<string, any>) {
  const { user: ADMIN_USER, pass: ADMIN_PASS } = getAdminCredentials();
  const hSupremeUser = String(req.header('X-Admin-User') || '').trim();
  const hSupremeToken = String(req.header('X-Admin-Token') || '').trim();
  const hAdminId = String(req.header('X-Admin-Id') || '').trim();
  const hAdminKey = String(req.header('X-Admin-Key') || '').trim();

  const hasAdminIntent = Boolean(hSupremeUser || hSupremeToken || hAdminId);
  const isSupreme =
    Boolean(hSupremeUser && hSupremeToken) &&
    hSupremeUser.toLowerCase() === ADMIN_USER.toLowerCase() &&
    hSupremeToken === ADMIN_PASS;

  let isDelegated = false;
  if (!isSupreme && hAdminId && hAdminId !== 'admin') {
    const actor = existingCuentas[hAdminId];
    if (actor && actor.rol === 'admin' && hAdminKey && actor.clave === hAdminKey) {
      isDelegated = true;
    }
  }

  return { hasAdminIntent, isSupreme, isDelegated, hAdminId };
}

app.get('/api/cuentas', (_req, res) => {
  const data = sanitizeCuentasParaEnviar(readJsonFile(CUENTAS_FILE, {}));
  res.setHeader('X-KV-Bound', 'true');
  res.json(data);
});

app.post('/api/cuentas', (req, res) => {
  const raw = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const incoming = sanitizeCuentas(raw);
  const existing = sanitizeCuentas(readJsonFile(CUENTAS_FILE, {}));
  const { hasAdminIntent, isSupreme, isDelegated, hAdminId } = verifyExpressCallerAdmin(req, existing);

  if (hasAdminIntent && !isSupreme && !isDelegated) {
    res.setHeader('X-KV-Bound', 'true');
    return res.status(403).json({
      ok: false,
      revoked: true,
      error: 'Tus permisos de administrador fueron revocados.',
    });
  }

  let finalCuentas: Record<string, any> = {};

  if (isSupreme) {
    finalCuentas = { ...incoming };
  } else if (isDelegated) {
    for (const [id, acc] of Object.entries(incoming)) {
      if (!acc || typeof acc !== 'object' || id === 'admin') continue;
      const prevAcc = existing[id];
      if (prevAcc && prevAcc.rol === 'admin' && id !== hAdminId) {
        finalCuentas[id] = prevAcc;
      } else {
        finalCuentas[id] = {
          ...(acc as any),
          id,
          rol: prevAcc?.rol === 'admin' ? 'admin' : 'jugador',
        };
      }
    }
    for (const [id, prevAcc] of Object.entries(existing)) {
      if (id !== 'admin' && prevAcc && prevAcc.rol === 'admin' && !finalCuentas[id]) {
        finalCuentas[id] = prevAcc;
      }
    }
  } else {
    finalCuentas = { ...existing };
    const registerId = String(req.header('X-Register-Id') || '').trim();
    const selfDelId = String(req.header('X-Self-Delete-Id') || '').trim();
    const selfDelKey = String(req.header('X-Self-Delete-Key') || '').trim();
    if (
      selfDelId &&
      selfDelId !== 'admin' &&
      existing[selfDelId] &&
      existing[selfDelId].clave === selfDelKey &&
      !incoming[selfDelId]
    ) {
      delete finalCuentas[selfDelId];
    } else {
      for (const [id, acc] of Object.entries(incoming)) {
        if (!acc || typeof acc !== 'object' || id === 'admin') continue;
        const accObj = acc as any;
        const prevAcc = existing[id];
        if (!prevAcc && id !== registerId) continue;

        finalCuentas[id] = {
          ...(prevAcc || {}),
          ...accObj,
          id,
          rol: prevAcc?.rol === 'admin' ? 'admin' : 'jugador',
          clave: accObj.clave && accObj.clave !== '***SUPREMO***' ? accObj.clave : prevAcc?.clave || '',
        };
      }
    }
  }

  finalCuentas['admin'] = buildSupremeProfile(isSupreme && incoming['admin'] ? incoming : existing);
  const cleanFinal = sanitizeCuentas(finalCuentas);

  writeJsonFile(CUENTAS_FILE, cleanFinal);
  lastKvUpdate = Date.now();
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, source: 'local_dev_kv', kvBound: true, lastUpdate: lastKvUpdate });
});

const PREMIOS_SEMANALES = [25, 15, 10];

function getWeekInfo(nowMs = Date.now()) {
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
  const semanaActualId = new Date(mondayUtc).toISOString().slice(0, 10);
  const semanaPasadaId = new Date(lastMondayUtc).toISOString().slice(0, 10);
  return {
    mondayUtc,
    lastMondayUtc,
    nextMondayUtc,
    cierraEnMs: Math.max(0, nextMondayUtc - nowMs),
    semanaActualId,
    semanaPasadaId,
  };
}

function getSemanalFile(semanaId: string) {
  return path.join(DATA_DIR, `semanal_${semanaId}.json`);
}

function hydrateWeeklyFromAccounts(
  board: any,
  rangeStartMs: number,
  rangeEndMs: number,
  existingCuentas: Record<string, any>
) {
  let modified = false;
  const activeMap = new Map<string, any>();
  for (const acc of Object.values(existingCuentas || {})) {
    if (!acc || typeof acc !== 'object' || !acc.nombre) continue;
    activeMap.set(String(acc.nombre).trim().toLowerCase(), acc);
  }

  for (const key of Object.keys(board.jugadores || {})) {
    if (!activeMap.has(key)) {
      delete board.jugadores[key];
      modified = true;
    } else {
      const acc = activeMap.get(key);
      board.jugadores[key].elo = acc.elo || 1000;
      board.jugadores[key].avatarColor = acc.avatarColor || board.jugadores[key].avatarColor;
      board.jugadores[key].avatarHat = acc.avatarHat || board.jugadores[key].avatarHat;
    }
  }

  for (const [key, acc] of activeMap.entries()) {
    if (!Array.isArray(acc.historialPartidas)) continue;
    for (const h of acc.historialPartidas) {
      if (!h || !h.id || !h.fecha) continue;
      const t = new Date(h.fecha).getTime();
      if (isNaN(t) || t < rangeStartMs || t >= rangeEndMs) continue;
      const cur = board.jugadores[key] || {
        nombre: acc.nombre,
        avatarColor: acc.avatarColor || '#ff6b6b',
        avatarHat: acc.avatarHat || 'corona',
        puntos: 0,
        partidas: 0,
        victorias: 0,
        elo: acc.elo || 1000,
        partidasIds: [],
      };
      if (!Array.isArray(cur.partidasIds)) cur.partidasIds = [];
      if (cur.partidasIds.includes(h.id)) continue;
      cur.puntos += Math.max(0, Number(h.puntos) || 0);
      cur.partidas += 1;
      if (h.resultado === 'victoria') cur.victorias += 1;
      cur.partidasIds.push(h.id);
      if (cur.partidasIds.length > 40) cur.partidasIds = cur.partidasIds.slice(-40);
      board.jugadores[key] = cur;
      modified = true;
    }
  }

  return modified;
}

app.get('/api/ranking', (_req, res) => {
  const data = readJsonFile(RANKING_FILE, {});
  res.setHeader('X-KV-Bound', 'true');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.json(data);
});

app.post('/api/ranking', (req, res) => {
  const existingCuentas = readJsonFile(CUENTAS_FILE, {});
  const { hasAdminIntent, isSupreme, isDelegated } = verifyExpressCallerAdmin(req, existingCuentas);
  if (hasAdminIntent && !isSupreme && !isDelegated) {
    res.setHeader('X-KV-Bound', 'true');
    return res.status(403).json({
      ok: false,
      revoked: true,
      error: 'Tus permisos de administrador fueron revocados.',
    });
  }

  const incomingRank = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as Record<string, any>;
  let finalRank: Record<string, any> = {};

  if (isSupreme || isDelegated) {
    finalRank = incomingRank;
  } else {
    const existingRank = readJsonFile(RANKING_FILE, {}) as Record<string, any>;
    const activeNames = new Set(
      Object.values(existingCuentas)
        .filter((a: any) => a && typeof a === 'object' && a.nombre)
        .map((a: any) => String(a.nombre).trim().toLowerCase())
    );

    for (const [k, v] of Object.entries(existingRank)) {
      const entryName = String(v?.nombre || k).trim().toLowerCase();
      if (activeNames.has(entryName) || activeNames.has(k.toLowerCase())) {
        finalRank[k] = v;
      }
    }
    for (const [k, v] of Object.entries(incomingRank)) {
      if (!v || typeof v !== 'object') continue;
      const entryName = String(v.nombre || k).trim().toLowerCase();
      if (activeNames.has(entryName) || activeNames.has(k.toLowerCase())) {
        finalRank[k] = v;
      }
    }
  }

  writeJsonFile(RANKING_FILE, finalRank);
  if ((isSupreme || isDelegated) && Object.keys(finalRank).length === 0) {
    const w = getWeekInfo();
    writeJsonFile(getSemanalFile(w.semanaActualId), { semanaId: w.semanaActualId, jugadores: {} });
    writeJsonFile(getSemanalFile(w.semanaPasadaId), {
      semanaId: w.semanaPasadaId,
      premiada: true,
      jugadores: {},
    });
  }
  lastKvUpdate = Date.now();
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, source: 'local_dev_kv', kvBound: true, lastUpdate: lastKvUpdate });
});

app.post('/api/partida', async (req, res) => {
  const sesion = await resolverSesionLocal(req);
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const matchId = String(body.matchId || `m_${Date.now()}`).trim();
  const cuentasPatch = body.cuentasPatch && typeof body.cuentasPatch === 'object' ? body.cuentasPatch : {};
  const rankingPatch = body.rankingPatch && typeof body.rankingPatch === 'object' ? body.rankingPatch : {};
  const entradasSemanal = Array.isArray(body.entradasSemanal) ? body.entradasSemanal : [];

  const existingCuentas = sanitizeCuentas(readJsonFile(CUENTAS_FILE, {}));
  const existingRank = readJsonFile(RANKING_FILE, {}) as Record<string, any>;

  let cuentasChanged = false;
  for (const [id, patchAcc] of Object.entries(cuentasPatch)) {
    if (!patchAcc || typeof patchAcc !== 'object' || id === 'admin') continue;

    // Solo se permite modificar si la sesión coincide con la cuenta o es admin
    const esPropietario = sesion && (sesion.usuarioId === id || sesion.rol === 'admin');
    if (!esPropietario) continue;

    const prevAcc = existingCuentas[id];
    if (!prevAcc) continue;
    existingCuentas[id] = {
      ...prevAcc,
      puntos: typeof (patchAcc as any).puntos === 'number' ? (patchAcc as any).puntos : prevAcc.puntos,
      partidas: typeof (patchAcc as any).partidas === 'number' ? (patchAcc as any).partidas : prevAcc.partidas,
      victorias: typeof (patchAcc as any).victorias === 'number' ? (patchAcc as any).victorias : prevAcc.victorias,
      derrotas: typeof (patchAcc as any).derrotas === 'number' ? (patchAcc as any).derrotas : prevAcc.derrotas,
      empates: typeof (patchAcc as any).empates === 'number' ? (patchAcc as any).empates : prevAcc.empates,
      elo: typeof (patchAcc as any).elo === 'number' ? (patchAcc as any).elo : prevAcc.elo,
      ultimaConexion: new Date().toISOString(),
      historialPartidas: Array.isArray((patchAcc as any).historialPartidas) ? (patchAcc as any).historialPartidas : prevAcc.historialPartidas,
    };
    cuentasChanged = true;
  }

  const activeByName = new Map<string, any>();
  for (const acc of Object.values(existingCuentas)) {
    if (acc && typeof acc === 'object' && (acc as any).nombre) {
      activeByName.set(String((acc as any).nombre).trim().toLowerCase(), acc);
    }
  }

  let rankChanged = false;
  for (const k of Object.keys(existingRank)) {
    const entryName = String(existingRank[k]?.nombre || k).trim().toLowerCase();
    if (!activeByName.has(entryName) && !activeByName.has(k.toLowerCase())) {
      delete existingRank[k];
      rankChanged = true;
    }
  }
  for (const [k, v] of Object.entries(rankingPatch)) {
    if (!v || typeof v !== 'object') continue;
    const entryName = String((v as any).nombre || k).trim().toLowerCase();
    if (activeByName.has(entryName) || activeByName.has(k.toLowerCase())) {
      existingRank[k] = v;
      rankChanged = true;
    }
  }

  if (cuentasChanged) {
    existingCuentas['admin'] = buildSupremeProfile(existingCuentas);
    writeJsonFile(CUENTAS_FILE, sanitizeCuentas(existingCuentas));
  }
  if (rankChanged) {
    writeJsonFile(RANKING_FILE, existingRank);
  }
  if (cuentasChanged || rankChanged) {
    lastKvUpdate = Date.now();
  }

  if (entradasSemanal.length > 0) {
    const w = getWeekInfo();
    const emptyActual = { semanaId: w.semanaActualId, jugadores: {} as Record<string, any> };
    const actual = { ...emptyActual, ...readJsonFile(getSemanalFile(w.semanaActualId), emptyActual) };
    if (!actual.jugadores) actual.jugadores = {};
    let semUpdated = false;
    for (const item of entradasSemanal) {
      if (!item || !item.nombre) continue;
      const key = String(item.nombre).trim().toLowerCase();
      const acc = activeByName.get(key);
      if (!acc) continue;
      const cur = actual.jugadores[key] || {
        nombre: acc.nombre,
        avatarColor: acc.avatarColor || item.avatarColor || '#ff6b6b',
        avatarHat: acc.avatarHat || item.avatarHat || 'corona',
        puntos: 0,
        partidas: 0,
        victorias: 0,
        elo: acc.elo || 1000,
        partidasIds: [],
      };
      if (!Array.isArray(cur.partidasIds)) cur.partidasIds = [];
      if (cur.partidasIds.includes(matchId)) continue;
      cur.puntos += Math.max(0, Number(item.puntos) || 0);
      cur.partidas += 1;
      if (item.victoria) cur.victorias += 1;
      cur.avatarColor = acc.avatarColor || item.avatarColor || cur.avatarColor;
      cur.avatarHat = acc.avatarHat || item.avatarHat || cur.avatarHat;
      cur.elo = acc.elo || cur.elo || 1000;
      cur.partidasIds.push(matchId);
      if (cur.partidasIds.length > 40) cur.partidasIds = cur.partidasIds.slice(-40);
      actual.jugadores[key] = cur;
      semUpdated = true;
    }
    if (semUpdated) {
      writeJsonFile(getSemanalFile(w.semanaActualId), actual);
    }
  }

  res.setHeader('X-KV-Bound', 'true');
  res.json({
    ok: true,
    kvBound: true,
    activeAccountIds: Object.keys(existingCuentas),
  });
});

app.get('/api/semanal', (_req, res) => {
  const w = getWeekInfo();
  const emptyActual = { semanaId: w.semanaActualId, jugadores: {} as Record<string, any> };
  const emptyPasada = {
    semanaId: w.semanaPasadaId,
    premiada: false,
    premiados: [] as any[],
    jugadores: {} as Record<string, any>,
  };

  const existingCuentas = sanitizeCuentas(readJsonFile(CUENTAS_FILE, {}));
  const actual = { ...emptyActual, ...readJsonFile(getSemanalFile(w.semanaActualId), emptyActual) };
  const pasada = { ...emptyPasada, ...readJsonFile(getSemanalFile(w.semanaPasadaId), emptyPasada) };

  const modActual = hydrateWeeklyFromAccounts(actual, w.mondayUtc, w.nextMondayUtc, existingCuentas);
  const modPasada = hydrateWeeklyFromAccounts(pasada, w.lastMondayUtc, w.mondayUtc, existingCuentas);

  const candidatosPasada = Object.values(pasada.jugadores || {}).filter(
    (j: any) => j && j.partidas > 0 && j.puntos > 0
  );

  if (!pasada.premiada) {
    if (candidatosPasada.length > 0) {
      candidatosPasada.sort((a: any, b: any) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.victorias !== a.victorias) return b.victorias - a.victorias;
        return b.partidas - a.partidas;
      });

      const existingRank = readJsonFile(RANKING_FILE, {}) as Record<string, any>;
      const premiados: { nombre: string; puesto: number; bono: number }[] = [];
      let cuentasChanged = false;
      let rankChanged = false;

      candidatosPasada.slice(0, 3).forEach((ganadorSem: any, idx: number) => {
        const bono = PREMIOS_SEMANALES[idx] || 0;
        if (bono <= 0) return;
        const normName = String(ganadorSem.nombre).trim().toLowerCase();
        const accEntry = Object.values(existingCuentas).find(
          (a: any) =>
            a && typeof a === 'object' && String(a.nombre || '').trim().toLowerCase() === normName
        ) as any;
        if (accEntry && accEntry.id) {
          accEntry.puntos = (Number(accEntry.puntos) || 0) + bono;
          existingCuentas[accEntry.id] = accEntry;
          cuentasChanged = true;
        }
        if (existingRank[normName]) {
          existingRank[normName].puntosTotales =
            (Number(existingRank[normName].puntosTotales) || 0) + bono;
          rankChanged = true;
        }
        premiados.push({ nombre: ganadorSem.nombre, puesto: idx + 1, bono });
      });

      pasada.premiada = true;
      pasada.premiados = premiados;
      writeJsonFile(getSemanalFile(w.semanaPasadaId), pasada);
      if (cuentasChanged) writeJsonFile(CUENTAS_FILE, sanitizeCuentas(existingCuentas));
      if (rankChanged) writeJsonFile(RANKING_FILE, existingRank);
      if (cuentasChanged || rankChanged) lastKvUpdate = Date.now();
    } else if (modPasada) {
      writeJsonFile(getSemanalFile(w.semanaPasadaId), pasada);
    }
  } else if (modPasada) {
    writeJsonFile(getSemanalFile(w.semanaPasadaId), pasada);
  }

  if (modActual) {
    writeJsonFile(getSemanalFile(w.semanaActualId), actual);
  }

  res.setHeader('X-KV-Bound', 'true');
  res.json({
    ok: true,
    kvBound: true,
    semanaActualId: w.semanaActualId,
    semanaPasadaId: w.semanaPasadaId,
    cierraEnMs: w.cierraEnMs,
    actual,
    pasada,
  });
});

app.post('/api/semanal', (req, res) => {
  const w = getWeekInfo();
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const matchId = String(body.matchId || `m_${Date.now()}`).trim();
  const entradas = Array.isArray(body.entradas) ? body.entradas : [];

  const existingCuentas = sanitizeCuentas(readJsonFile(CUENTAS_FILE, {}));
  const activeByName = new Map<string, any>();
  for (const acc of Object.values(existingCuentas)) {
    if (acc && typeof acc === 'object' && (acc as any).nombre) {
      activeByName.set(String((acc as any).nombre).trim().toLowerCase(), acc);
    }
  }

  const emptyActual = { semanaId: w.semanaActualId, jugadores: {} as Record<string, any> };
  const actual = { ...emptyActual, ...readJsonFile(getSemanalFile(w.semanaActualId), emptyActual) };
  if (!actual.jugadores) actual.jugadores = {};

  let updated = false;
  for (const item of entradas) {
    if (!item || !item.nombre) continue;
    const key = String(item.nombre).trim().toLowerCase();
    const acc = activeByName.get(key);
    if (!acc) continue;

    const cur = actual.jugadores[key] || {
      nombre: acc.nombre,
      avatarColor: acc.avatarColor || item.avatarColor || '#ff6b6b',
      avatarHat: acc.avatarHat || item.avatarHat || 'corona',
      puntos: 0,
      partidas: 0,
      victorias: 0,
      elo: acc.elo || 1000,
      partidasIds: [],
    };
    if (!Array.isArray(cur.partidasIds)) cur.partidasIds = [];
    if (cur.partidasIds.includes(matchId)) continue;

    cur.puntos += Math.max(0, Number(item.puntos) || 0);
    cur.partidas += 1;
    if (item.victoria) cur.victorias += 1;
    cur.avatarColor = acc.avatarColor || item.avatarColor || cur.avatarColor;
    cur.avatarHat = acc.avatarHat || item.avatarHat || cur.avatarHat;
    cur.elo = acc.elo || cur.elo || 1000;
    cur.partidasIds.push(matchId);
    if (cur.partidasIds.length > 40) cur.partidasIds = cur.partidasIds.slice(-40);

    actual.jugadores[key] = cur;
    updated = true;
  }

  if (updated) {
    writeJsonFile(getSemanalFile(w.semanaActualId), actual);
  }

  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, kvBound: true });
});

app.get('/api/salas', (_req, res) => {
  cleanExpiredRooms();
  res.setHeader('X-KV-Bound', 'true');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const valid = Array.from(salasActivas.values())
    .filter(
      (r: any) =>
        r &&
        r.publica !== false &&
        !r.enPartida &&
        (r.jugadoresConectados || 1) < (r.maxJugadores || 2)
    )
    .sort((a: any, b: any) => (b.creadoEn || 0) - (a.creadoEn || 0));
  res.json(valid);
});

app.post('/api/salas', (req, res) => {
  cleanExpiredRooms();
  const room = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const code = normalizeSalaCode(room.codigo);
  if (!code) {
    res.status(400).json({ ok: false, error: 'Código inválido' });
    return;
  }

  const now = Date.now();
  const existing = salasActivas.get(code);
  const esPublica = room.publica !== undefined ? Boolean(room.publica) : existing?.publica ?? true;
  const hostPeerId = room.hostPeerId || existing?.hostPeerId || `host_${code.toLowerCase()}`;
  const maxJugadores = room.maxJugadores === 4 ? 4 : existing?.maxJugadores || 2;
  const anfitrion = String(room.anfitrion || existing?.anfitrion || 'Anfitrión').trim();
  const color = room.color || existing?.color || '#ff6b6b';
  const hat = room.hat || existing?.hat || 'corona';

  const defaultHostList = [
    {
      id: 0,
      peerId: hostPeerId,
      nombre: anfitrion,
      color,
      hat,
      listo: true,
      conectado: true,
      esAnfitrion: true,
    },
  ];

  const jugadores =
    Array.isArray(room.jugadores) && room.jugadores.length > 0
      ? room.jugadores
      : existing?.jugadores?.length
      ? existing.jugadores
      : defaultHostList;

  const fullRoom = {
    codigo: code,
    nombre: String(room.nombre || existing?.nombre || `Sala de ${anfitrion}`).trim(),
    anfitrion,
    hostPeerId,
    color,
    hat,
    maxJugadores,
    publica: esPublica,
    enPartida: false,
    jugadoresConectados: jugadores.length,
    jugadores,
    signals: existing?.signals || {},
    seq: existing?.seq || 0,
    mensajes: existing?.mensajes || [],
    creadoEn: existing?.creadoEn || now,
    ultimoCambio: now,
  };

  salasActivas.set(code, fullRoom);
  syncPublicSalasFile();

  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, kvBound: true, sala: fullRoom, timestamp: now });
});

app.get('/api/salas/:codigo', (req, res) => {
  cleanExpiredRooms();
  const code = normalizeSalaCode(req.params.codigo);
  const sala = salasActivas.get(code);
  res.setHeader('X-KV-Bound', 'true');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (!sala) {
    res.status(404).json({ ok: false, error: 'Sala no disponible' });
    return;
  }

  const since = parseInt(String(req.query.since || '0'), 10) || 0;
  const peerId = String(req.query.peerId || '').trim();
  const mensajesNuevos = Array.isArray(sala.mensajes)
    ? sala.mensajes.filter(
        (m: any) =>
          m &&
          m.seq > since &&
          (!peerId || m.from !== peerId) &&
          (!m.to || m.to === peerId)
      )
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
      mensajesNuevos,
    },
  });
});

app.post('/api/salas/:codigo/join', (req, res) => {
  cleanExpiredRooms();
  const code = normalizeSalaCode(req.params.codigo);
  const sala = salasActivas.get(code);
  res.setHeader('X-KV-Bound', 'true');

  if (!sala) {
    res.status(404).json({
      ok: false,
      error: `La sala ${code} no existe o el anfitrión ya la cerró.`,
    });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const peerId = String(body.peerId || '').trim();
  const nombre = String(body.nombre || 'Invitado').trim() || 'Invitado';
  const color = body.color || '#4dabf7';
  const hat = body.hat || 'pompon';
  const offer = body.offer || null;

  if (!peerId) {
    res.status(400).json({ ok: false, error: 'Falta peerId' });
    return;
  }

  if (!Array.isArray(sala.jugadores)) sala.jugadores = [];
  if (!sala.signals || typeof sala.signals !== 'object') sala.signals = {};

  let existing = sala.jugadores.find((p: any) => p.peerId === peerId);
  if (!existing && sala.enPartida) {
    const byName = sala.jugadores.find(
      (p: any) => !p.esAnfitrion && String(p.nombre || '').toLowerCase() === nombre.toLowerCase()
    );
    if (byName) {
      byName.peerId = peerId;
      byName.conectado = true;
      existing = byName;
    } else {
      res.status(409).json({ ok: false, error: 'La partida en esta sala ya comenzó.' });
      return;
    }
  }

  if (existing) {
    existing.nombre = nombre;
    existing.color = color || existing.color;
    existing.hat = hat || existing.hat;
    existing.conectado = true;
  } else {
    if (sala.jugadores.length >= (sala.maxJugadores || 2)) {
      res.status(409).json({ ok: false, error: 'La sala ya está llena.' });
      return;
    }
    const playerColors = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66'];
    const playerHats = ['corona', 'pompon', 'antena', 'brote'];
    const newId = sala.jugadores.length;
    sala.jugadores.push({
      id: newId,
      peerId,
      nombre,
      color: color || playerColors[newId] || '#4dabf7',
      hat: hat || playerHats[newId] || 'pompon',
      listo: true,
      conectado: true,
      esAnfitrion: false,
    });
  }

  if (offer) {
    sala.signals[peerId] = {
      ...(sala.signals[peerId] || {}),
      offer,
      answer: null,
      updatedAt: Date.now(),
    };
  }

  sala.jugadoresConectados = sala.jugadores.length;
  sala.ultimoCambio = Date.now();
  salasActivas.set(code, sala);
  syncPublicSalasFile();

  res.json({ ok: true, sala });
});

app.post('/api/salas/:codigo/signal', (req, res) => {
  const code = normalizeSalaCode(req.params.codigo);
  const sala = salasActivas.get(code);
  res.setHeader('X-KV-Bound', 'true');
  if (!sala) {
    res.status(404).json({ ok: false, error: 'Sala no disponible' });
    return;
  }
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
    sala.ultimoCambio = Date.now();
    salasActivas.set(code, sala);
  }
  res.json({ ok: true });
});

app.post('/api/salas/:codigo/msg', (req, res) => {
  const code = normalizeSalaCode(req.params.codigo);
  const sala = salasActivas.get(code);
  res.setHeader('X-KV-Bound', 'true');
  if (!sala) {
    res.status(404).json({ ok: false, error: 'Sala no disponible' });
    return;
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (body && body.msg) {
    sala.seq = (sala.seq || 0) + 1;
    if (!Array.isArray(sala.mensajes)) sala.mensajes = [];
    sala.mensajes.push({
      seq: sala.seq,
      from: String(body.from || ''),
      to: body.to ? String(body.to) : null,
      msg: body.msg,
      ts: Date.now(),
    });
    if (sala.mensajes.length > 35) {
      sala.mensajes = sala.mensajes.slice(-35);
    }
    if (body.msg.type === 'START_GAME') {
      sala.enPartida = true;
      syncPublicSalasFile();
    }
    sala.ultimoCambio = Date.now();
    salasActivas.set(code, sala);
  }
  res.json({ ok: true, seq: sala.seq || 0 });
});

app.post('/api/salas/:codigo/leave', (req, res) => {
  const code = normalizeSalaCode(req.params.codigo);
  const sala = salasActivas.get(code);
  res.setHeader('X-KV-Bound', 'true');
  if (sala) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const peerId = String(body.peerId || '').trim();
    const nombre = String(body.nombre || 'El otro jugador').trim();
    const jugadorId = typeof body.jugadorId === 'number' ? body.jugadorId : 1;

    if (!sala.enPartida && Array.isArray(sala.jugadores)) {
      sala.jugadores = sala.jugadores.filter((p: any) => p.esAnfitrion || p.peerId !== peerId);
      sala.jugadores.forEach((p: any, idx: number) => {
        p.id = idx;
      });
      sala.jugadoresConectados = sala.jugadores.length;
      if (sala.signals && peerId) {
        delete sala.signals[peerId];
      }
      syncPublicSalasFile();
    } else if (Array.isArray(sala.jugadores)) {
      const leaving = sala.jugadores.find((p: any) => p.peerId === peerId || p.id === jugadorId);
      if (leaving) leaving.conectado = false;
    }

    sala.seq = (sala.seq || 0) + 1;
    if (!Array.isArray(sala.mensajes)) sala.mensajes = [];
    sala.mensajes.push({
      seq: sala.seq,
      from: peerId,
      to: null,
      msg: { type: 'PLAYER_LEFT', jugadorId, nombre },
      ts: Date.now(),
    });
    if (sala.mensajes.length > 35) sala.mensajes = sala.mensajes.slice(-35);

    sala.ultimoCambio = Date.now();
    salasActivas.set(code, sala);
  }
  res.json({ ok: true });
});

app.patch('/api/salas/:codigo', (req, res) => {
  const code = normalizeSalaCode(req.params.codigo);
  const sala = salasActivas.get(code);
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (sala) {
    if (typeof body.jugadoresConectados === 'number') {
      sala.jugadoresConectados = body.jugadoresConectados;
    }
    if (typeof body.enPartida === 'boolean') {
      sala.enPartida = body.enPartida;
    }
    sala.ultimoCambio = Date.now();
    salasActivas.set(code, sala);
  }
  cleanExpiredRooms();
  syncPublicSalasFile();
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, kvBound: true });
});

app.delete('/api/salas/:codigo', (req, res) => {
  const code = normalizeSalaCode(req.params.codigo);
  salasActivas.delete(code);
  syncPublicSalasFile();
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, kvBound: true });
});

async function start() {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
});
