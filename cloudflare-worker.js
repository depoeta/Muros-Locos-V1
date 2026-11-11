/**
 * Cloudflare Worker unificado para Muros Locos (Cloudflare D1 SQL + KV Persistence, Admin Supremo y Salas P2P)
 *
 * Variables / Secrets en Cloudflare Dashboard:
 * - ADMIN_USERNAME: Nombre de usuario del Admin Supremo (por defecto: "admin")
 * - ADMIN_SECRET_KEY: Clave secreta del Admin Supremo (requerida en producción)
 *
 * Cloudflare D1 SQL Binding:
 * - DB, DATABASE, MUROS_D1, D1
 *
 * KV Namespace Binding (fallback y redundancia):
 * - MUROS_KV, MUROS_DB, muros_db, KV, MUROS_DATA
 */

function resolveD1(env) {
  if (!env || typeof env !== 'object') return null;
  const d1Keys = [
    'DB',
    'DATABASE',
    'MUROS_D1',
    'muros_d1',
    'D1',
    'muros_db',
    'MUROS_DB',
    'db',
    'database',
    'd1',
  ];
  for (const k of d1Keys) {
    const candidate = env[k];
    if (candidate && typeof candidate.prepare === 'function') {
      return candidate;
    }
  }
  for (const val of Object.values(env)) {
    if (val && typeof val === 'object' && typeof val.prepare === 'function') {
      return val;
    }
  }
  return null;
}

let d1Initialized = false;
async function ensureD1Tables(db) {
  if (d1Initialized || !db) return;
  try {
    if (typeof db.exec === 'function') {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS cuentas (
          id TEXT PRIMARY KEY,
          nombre TEXT NOT NULL,
          clave_hash TEXT,
          clave_salt TEXT,
          clave_iter INTEGER DEFAULT 100000,
          clave_plano TEXT,
          rol TEXT DEFAULT 'jugador',
          puntos INTEGER DEFAULT 0,
          victorias INTEGER DEFAULT 0,
          derrotas INTEGER DEFAULT 0,
          empates INTEGER DEFAULT 0,
          partidas INTEGER DEFAULT 0,
          elo INTEGER DEFAULT 1000,
          avatar_color TEXT,
          avatar_hat TEXT,
          avatar_ropa TEXT DEFAULT 'ninguna',
          avatar_aura TEXT DEFAULT 'ninguna',
          inventario_json TEXT,
          tema_board TEXT,
          creado_en TEXT,
          ultima_conexion TEXT,
          historial_json TEXT
        );
        CREATE TABLE IF NOT EXISTS sesiones (
          token_hash TEXT PRIMARY KEY,
          usuario_id TEXT NOT NULL,
          rol TEXT NOT NULL,
          expira_en INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ranking_semanal (
          semana_key TEXT NOT NULL,
          id TEXT NOT NULL,
          nombre TEXT NOT NULL,
          avatar_color TEXT,
          puntos INTEGER DEFAULT 0,
          victorias INTEGER DEFAULT 0,
          PRIMARY KEY (semana_key, id)
        );
        CREATE TABLE IF NOT EXISTS d1_db (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at INTEGER
        );
      `);
      // Migraciones seguras para bases de datos existentes
      try { await db.prepare("ALTER TABLE cuentas ADD COLUMN inventario_json TEXT").run(); } catch {}
      try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_ropa TEXT DEFAULT 'ninguna'").run(); } catch {}
      try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_aura TEXT DEFAULT 'ninguna'").run(); } catch {}
      try { await db.prepare("INSERT OR IGNORE INTO d1_db SELECT * FROM d1_kv").run(); } catch {}
      d1Initialized = true;
      return;
    }
  } catch (err) {
    console.warn('db.exec falló, intentando prepare individual:', err);
  }

  // Fallback con prepare individual si exec falló o no soporta múltiples sentencias
  try {
    await db
      .prepare(
        'CREATE TABLE IF NOT EXISTS cuentas (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, clave_hash TEXT, clave_salt TEXT, clave_iter INTEGER DEFAULT 100000, clave_plano TEXT, rol TEXT DEFAULT \'jugador\', puntos INTEGER DEFAULT 0, victorias INTEGER DEFAULT 0, derrotas INTEGER DEFAULT 0, empates INTEGER DEFAULT 0, partidas INTEGER DEFAULT 0, elo INTEGER DEFAULT 1000, avatar_color TEXT, avatar_hat TEXT, avatar_ropa TEXT DEFAULT \'ninguna\', avatar_aura TEXT DEFAULT \'ninguna\', inventario_json TEXT, tema_board TEXT, creado_en TEXT, ultima_conexion TEXT, historial_json TEXT)'
      )
      .run();
    await db
      .prepare(
        'CREATE TABLE IF NOT EXISTS sesiones (token_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, rol TEXT NOT NULL, expira_en INTEGER NOT NULL)'
      )
      .run();
    await db
      .prepare(
        'CREATE TABLE IF NOT EXISTS ranking_semanal (semana_key TEXT NOT NULL, id TEXT NOT NULL, nombre TEXT NOT NULL, avatar_color TEXT, puntos INTEGER DEFAULT 0, victorias INTEGER DEFAULT 0, PRIMARY KEY (semana_key, id))'
      )
      .run();
    await db
      .prepare(
        'CREATE TABLE IF NOT EXISTS d1_db (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)'
      )
      .run();
    try { await db.prepare("ALTER TABLE cuentas ADD COLUMN inventario_json TEXT").run(); } catch {}
    try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_ropa TEXT DEFAULT 'ninguna'").run(); } catch {}
    try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_aura TEXT DEFAULT 'ninguna'").run(); } catch {}
    try { await db.prepare("INSERT OR IGNORE INTO d1_db SELECT * FROM d1_kv").run(); } catch {}
    d1Initialized = true;
  } catch (err2) {
    console.error('Error inicializando tablas D1 fallback:', err2);
  }
}

function d1RowToAccount(row) {
  if (!row) return null;
  let hist = [];
  try {
    hist = JSON.parse(row.historial_json || '[]');
  } catch {}
  let inv = { personajes: [], activoId: undefined };
  try {
    inv = JSON.parse(row.inventario_json || '{"personajes":[]}');
    if (!inv || !Array.isArray(inv.personajes)) inv = { personajes: [] };
  } catch {}

  const isSup = row.id === 'admin';
  return {
    id: row.id,
    nombre: row.nombre,
    claveHash: row.clave_hash || undefined,
    claveSalt: row.clave_salt || undefined,
    claveIter: row.clave_iter || 100000,
    clave: row.clave_plano || undefined,
    rol: isSup ? 'dev' : (row.rol || 'jugador'),
    esSupremo: isSup,
    puntos: Number(row.puntos) || 0,
    victorias: Number(row.victorias) || 0,
    derrotas: Number(row.derrotas) || 0,
    empates: Number(row.empates) || 0,
    partidas: Number(row.partidas) || 0,
    elo: Number(row.elo) || 1000,
    avatarColor: row.avatar_color || '#ff6b6b',
    avatarHat: row.avatar_hat || 'corona',
    avatarRopa: row.avatar_ropa || 'ninguna',
    avatarAura: row.avatar_aura || 'ninguna',
    inventario: inv,
    temaTablero: row.tema_board || 'madera',
    creadoEn: row.creado_en || new Date().toISOString(),
    ultimaConexion: row.ultima_conexion || new Date().toISOString(),
    historialPartidas: hist,
  };
}

const textEncoder = new TextEncoder();
const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function hashClavePBKDF2(clave, saltB64, iterations = 100000) {
  const salt = saltB64 ? fromBase64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const importedKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(clave),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
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

function timeConstantCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', textEncoder.encode(str));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function verificarClaveCuenta(cuenta, candidateClave) {
  if (!cuenta || typeof candidateClave !== 'string') return false;
  if (cuenta.claveHash && cuenta.claveSalt) {
    const computed = await hashClavePBKDF2(candidateClave, cuenta.claveSalt, cuenta.claveIter || 100000);
    return timeConstantCompare(computed.claveHash, cuenta.claveHash);
  }
  // Migración transparente: cuenta antigua con clave en texto plano
  if (typeof cuenta.clave === 'string' && cuenta.clave.length > 0 && cuenta.clave !== '***SUPREMO***') {
    return timeConstantCompare(cuenta.clave, candidateClave);
  }
  return false;
}

async function crearSesion(env, usuarioId, rol, duracionHoras = 720) {
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(rawBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  const expiraEn = Date.now() + duracionHoras * 3600 * 1000;

  const mem = getKvMemCache();
  mem[`sesion:${tokenHash}`] = { usuarioId, rol, expiraEn };

  const d1 = resolveD1(env);
  if (d1) {
    await ensureD1Tables(d1);
    try {
      await d1
        .prepare('INSERT OR REPLACE INTO sesiones (token_hash, usuario_id, rol, expira_en) VALUES (?, ?, ?, ?)')
        .bind(tokenHash, usuarioId, rol, expiraEn)
        .run();
    } catch {}
  }
  const kv = resolveKV(env);
  if (kv) {
    try {
      await kv.put(`sesion:${tokenHash}`, JSON.stringify({ usuarioId, rol, expiraEn }), {
        expirationTtl: Math.max(60, Math.floor(duracionHoras * 3600)),
      });
    } catch {}
  }
  return { token, tokenHash, expiraEn, usuarioId, rol };
}

async function resolverSesion(request, env) {
  let token = '';
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    token = (request.headers.get('X-Admin-Token') || '').trim();
  }
  if (!token) return null;

  const rawAdminPass = env?.ADMIN_SECRET_KEY || env?.ADMIN_KEY || env?.ADMIN_PASSWORD;
  const ADMIN_PASS = String(rawAdminPass || 'muros2026').trim();
  if (timeConstantCompare(token, ADMIN_PASS)) {
    return { usuarioId: 'admin', rol: 'admin', token };
  }

  const tokenHash = await sha256Hex(token);
  const now = Date.now();

  const d1 = resolveD1(env);
  if (d1) {
    await ensureD1Tables(d1);
    try {
      const row = await d1
        .prepare('SELECT usuario_id, rol, expira_en FROM sesiones WHERE token_hash = ?')
        .bind(tokenHash)
        .first();
      if (row && Number(row.expira_en) > now) {
        return { usuarioId: row.usuario_id, rol: row.rol, tokenHash, token };
      }
    } catch {}
  }

  const kv = resolveKV(env);
  if (kv) {
    try {
      const raw = await kv.get(`sesion:${tokenHash}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Number(parsed.expiraEn) > now) {
          return { usuarioId: parsed.usuarioId, rol: parsed.rol, tokenHash, token };
        }
      }
    } catch {}
  }

  const mem = getKvMemCache();
  if (mem[`sesion:${tokenHash}`]) {
    const s = mem[`sesion:${tokenHash}`];
    if (s && Number(s.expiraEn) > now) {
      return { usuarioId: s.usuarioId, rol: s.rol, tokenHash, token };
    }
  }

  return null;
}

function sanitizeCuentaParaEnviar(acc) {
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

function sanitizeCuentasParaEnviar(cuentasMap) {
  const result = {};
  for (const [id, acc] of Object.entries(cuentasMap || {})) {
    result[id] = sanitizeCuentaParaEnviar(acc);
  }
  return result;
}

function createD1KvAdapter(d1) {
  return {
    async get(key) {
      try {
        await ensureD1Tables(d1);
        const row = await d1.prepare('SELECT value FROM d1_db WHERE key = ?').bind(key).first();
        return row && typeof row.value === 'string' ? row.value : null;
      } catch (err) {
        console.error('Error en D1 Database get:', err);
        return null;
      }
    },
    async put(key, value) {
      try {
        await ensureD1Tables(d1);
        const strVal = typeof value === 'string' ? value : JSON.stringify(value);
        await d1
          .prepare('INSERT OR REPLACE INTO d1_db (key, value, updated_at) VALUES (?, ?, ?)')
          .bind(key, strVal, Date.now())
          .run();
      } catch (err) {
        console.error('Error en D1 Database put:', err);
      }
    },
    async delete(key) {
      try {
        await ensureD1Tables(d1);
        await d1.prepare('DELETE FROM d1_db WHERE key = ?').bind(key).run();
      } catch (err) {
        console.error('Error en D1 Database delete:', err);
      }
    },
  };
}

function resolveRealKV(env) {
  if (!env || typeof env !== 'object') return null;
  const knownKeys = ['MUROS_KV', 'KV', 'MUROS_DATA', 'muros_kv'];
  for (const k of knownKeys) {
    const candidate = env[k];
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.get === 'function' &&
      typeof candidate.put === 'function' &&
      typeof candidate.delete === 'function' &&
      typeof candidate.prepare !== 'function' &&
      typeof candidate.batch !== 'function' &&
      typeof candidate.exec !== 'function'
    ) {
      return candidate;
    }
  }
  return null;
}

function resolveKV(env) {
  if (!env || typeof env !== 'object') return null;
  const d1 = resolveD1(env);
  if (d1) {
    return createD1KvAdapter(d1);
  }
  return resolveRealKV(env);
}

function sanitizeCuentas(cuentas) {
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

function buildSupremeProfile(cuentas) {
  const existing = (cuentas && cuentas['admin']) || {};
  return {
    id: 'admin',
    nombre: existing.nombre || 'Admin Supremo',
    clave: '***SUPREMO***',
    rol: 'dev',
    esSupremo: true,
    avatarColor: existing.avatarColor || '#ffd43b',
    avatarHat: existing.avatarHat || 'corona',
    avatarRopa: existing.avatarRopa || 'capa',
    avatarAura: existing.avatarAura || 'dorada',
    inventario: existing.inventario || { personajes: [] },
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

const PREMIOS_SEMANALES = [25, 15, 10];

function getKvMemCache() {
  if (!globalThis.__MUROS_KV_MEM__) {
    globalThis.__MUROS_KV_MEM__ = {
      cuentas: null,
      cuentasAt: 0,
      ranking: null,
      rankingAt: 0,
      lastUpdate: 0,
      lastUpdateAt: 0,
      publicIndex: null,
      publicIndexAt: 0,
    };
  }
  return globalThis.__MUROS_KV_MEM__;
}

async function kvGetCuentasCached(kv, maxAgeMs = 10000) {
  const mem = getKvMemCache();
  const now = Date.now();
  if (mem.cuentas && now - mem.cuentasAt < maxAgeMs) {
    return JSON.parse(JSON.stringify(mem.cuentas));
  }
  let parsed = {};
  try {
    parsed = sanitizeCuentas(JSON.parse((await kv.get('cuentas')) || '{}'));
  } catch {}
  mem.cuentas = parsed;
  mem.cuentasAt = now;
  return JSON.parse(JSON.stringify(parsed));
}

async function kvPutCuentasCached(kv, cleanCuentas, touchGlobalUpdate = false) {
  const mem = getKvMemCache();
  const now = Date.now();
  const sanitized = sanitizeCuentas(cleanCuentas);
  await kv.put('cuentas', JSON.stringify(sanitized));
  mem.cuentas = sanitized;
  mem.cuentasAt = now;
  mem.lastUpdate = now;
  mem.lastUpdateAt = now;
  if (touchGlobalUpdate) {
    await kv.put('last_update', String(now));
  }
  return now;
}

async function dbGetCuentas(env) {
  const d1 = resolveD1(env);
  const kv = resolveKV(env);

  if (d1) {
    await ensureD1Tables(d1);
    try {
      const rows = await d1.prepare('SELECT * FROM cuentas').all();
      if (rows && rows.results && rows.results.length > 0) {
        const map = {};
        for (const row of rows.results) {
          const acc = d1RowToAccount(row);
          if (acc) map[acc.id] = acc;
        }
        return map;
      }
      // Si D1 está vacío pero hay datos en KV, migrar automáticamente
      if (kv) {
        const kvCuentas = await kvGetCuentasCached(kv, 0);
        if (Object.keys(kvCuentas).length > 0) {
          for (const [id, acc] of Object.entries(kvCuentas)) {
            if (!acc || typeof acc !== 'object') continue;
            await d1
              .prepare(`
                INSERT OR REPLACE INTO cuentas (
                  id, nombre, clave_hash, clave_salt, clave_iter, clave_plano,
                  rol, puntos, victorias, derrotas, empates, partidas, elo,
                  avatar_color, avatar_hat, avatar_ropa, avatar_aura, inventario_json,
                  tema_board, creado_en, ultima_conexion, historial_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .bind(
                id,
                acc.nombre || id,
                acc.claveHash || null,
                acc.claveSalt || null,
                acc.claveIter || 100000,
                acc.clave || null,
                id === 'admin' ? 'dev' : (acc.rol || 'jugador'),
                acc.puntos || 0,
                acc.victorias || 0,
                acc.derrotas || 0,
                acc.empates || 0,
                acc.partidas || 0,
                acc.elo || 1000,
                acc.avatarColor || '#ff6b6b',
                acc.avatarHat || 'corona',
                acc.avatarRopa || 'ninguna',
                acc.avatarAura || 'ninguna',
                JSON.stringify(acc.inventario || { personajes: [] }),
                acc.temaTablero || 'madera',
                acc.creadoEn || new Date().toISOString(),
                acc.ultimaConexion || new Date().toISOString(),
                JSON.stringify(acc.historialPartidas || [])
              )
              .run();
          }
          return kvCuentas;
        }
      }
      return {};
    } catch (err) {
      console.error('Error leyendo cuentas de D1, usando KV:', err);
    }
  }

  if (kv) {
    return await kvGetCuentasCached(kv, 5000);
  }
  return {};
}

async function dbInsertOrUpdateCuenta(env, acc, touchGlobalUpdate = true) {
  if (!acc || !acc.id) return;
  const d1 = resolveD1(env);
  const kv = resolveKV(env);

  if (d1) {
    await ensureD1Tables(d1);
    try {
      await d1
        .prepare(`
          INSERT OR REPLACE INTO cuentas (
            id, nombre, clave_hash, clave_salt, clave_iter, clave_plano,
            rol, puntos, victorias, derrotas, empates, partidas, elo,
            avatar_color, avatar_hat, avatar_ropa, avatar_aura, inventario_json,
            tema_board, creado_en, ultima_conexion, historial_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          acc.id,
          acc.nombre || acc.id,
          acc.claveHash || null,
          acc.claveSalt || null,
          Number(acc.claveIter) || 100000,
          acc.clave || null,
          acc.id === 'admin' ? 'dev' : (acc.rol || 'jugador'),
          Number(acc.puntos) || 0,
          Number(acc.victorias) || 0,
          Number(acc.derrotas) || 0,
          Number(acc.empates) || 0,
          Number(acc.partidas) || 0,
          Number(acc.elo) || 1000,
          acc.avatarColor || '#ff6b6b',
          acc.avatarHat || 'corona',
          acc.avatarRopa || 'ninguna',
          acc.avatarAura || 'ninguna',
          JSON.stringify(acc.inventario || { personajes: [] }),
          acc.temaTablero || 'madera',
          acc.creadoEn || new Date().toISOString(),
          acc.ultimaConexion || new Date().toISOString(),
          JSON.stringify(acc.historialPartidas || [])
        )
        .run();
    } catch (err) {
      console.error('Error insertando cuenta individual en D1:', err);
    }
  }

  // Mantener actualizado en memoria y en la tabla de respaldo d1_db
  const mem = getKvMemCache();
  if (mem.cuentas) {
    mem.cuentas[acc.id] = sanitizeCuentas({ [acc.id]: acc })[acc.id];
  }
  if (kv) {
    const existing = await kvGetCuentasCached(kv, 0);
    existing[acc.id] = acc;
    await kvPutCuentasCached(kv, existing, touchGlobalUpdate);
  }
}

async function dbSaveCuentas(env, cleanCuentas, touchGlobalUpdate = false, allowDeletions = false) {
  const d1 = resolveD1(env);
  const kv = resolveKV(env);

  if (d1) {
    await ensureD1Tables(d1);
    try {
      const existingRows = await d1.prepare('SELECT id FROM cuentas').all();
      const existingIds = new Set((existingRows?.results || []).map((r) => r.id));
      const incomingIds = new Set(Object.keys(cleanCuentas));

      // Solo borrar cuentas si la llamada proviene explícitamente de una acción de eliminación
      if (allowDeletions) {
        for (const oldId of existingIds) {
          if (!incomingIds.has(oldId) && oldId !== 'admin') {
            await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(oldId).run();
          }
        }
      }

      for (const [id, acc] of Object.entries(cleanCuentas)) {
        if (!acc || typeof acc !== 'object') continue;
        await d1
          .prepare(`
            INSERT OR REPLACE INTO cuentas (
              id, nombre, clave_hash, clave_salt, clave_iter, clave_plano,
              rol, puntos, victorias, derrotas, empates, partidas, elo,
              avatar_color, avatar_hat, avatar_ropa, avatar_aura, inventario_json,
              tema_board, creado_en, ultima_conexion, historial_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            id,
            acc.nombre || id,
            acc.claveHash || null,
            acc.claveSalt || null,
            Number(acc.claveIter) || 100000,
            acc.clave || null,
            id === 'admin' ? 'dev' : (acc.rol || 'jugador'),
            Number(acc.puntos) || 0,
            Number(acc.victorias) || 0,
            Number(acc.derrotas) || 0,
            Number(acc.empates) || 0,
            Number(acc.partidas) || 0,
            Number(acc.elo) || 1000,
            acc.avatarColor || '#ff6b6b',
            acc.avatarHat || 'corona',
            acc.avatarRopa || 'ninguna',
            acc.avatarAura || 'ninguna',
            JSON.stringify(acc.inventario || { personajes: [] }),
            acc.temaTablero || 'madera',
            acc.creadoEn || new Date().toISOString(),
            acc.ultimaConexion || new Date().toISOString(),
            JSON.stringify(acc.historialPartidas || [])
          )
          .run();
      }
    } catch (err) {
      console.error('Error guardando cuentas en D1:', err);
    }
  }

  if (kv) {
    await kvPutCuentasCached(kv, cleanCuentas, touchGlobalUpdate);
  }
}

async function kvGetRankingCached(kv, maxAgeMs = 10000) {
  const mem = getKvMemCache();
  const now = Date.now();
  if (mem.ranking && now - mem.rankingAt < maxAgeMs) {
    return JSON.parse(JSON.stringify(mem.ranking));
  }
  let parsed = {};
  try {
    parsed = JSON.parse((await kv.get('ranking')) || '{}') || {};
  } catch {}
  mem.ranking = parsed;
  mem.rankingAt = now;
  return JSON.parse(JSON.stringify(parsed));
}

async function kvPutRankingCached(kv, finalRank, touchGlobalUpdate = false) {
  const mem = getKvMemCache();
  const now = Date.now();
  await kv.put('ranking', JSON.stringify(finalRank));
  mem.ranking = finalRank;
  mem.rankingAt = now;
  mem.lastUpdate = now;
  mem.lastUpdateAt = now;
  if (touchGlobalUpdate) {
    await kv.put('last_update', String(now));
  }
  return now;
}

async function kvGetLastUpdateCached(kv, maxAgeMs = 45000) {
  const mem = getKvMemCache();
  const now = Date.now();
  if (mem.lastUpdateAt > 0 && now - mem.lastUpdateAt < maxAgeMs) {
    return mem.lastUpdate;
  }
  const raw = (await kv.get('last_update')) || '0';
  const parsed = parseInt(raw, 10) || 0;
  mem.lastUpdate = Math.max(mem.lastUpdate, parsed);
  mem.lastUpdateAt = now;
  return mem.lastUpdate;
}

function getWeekInfo(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const utcDay = d.getUTCDay();
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const mondayUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday, 0, 0, 0, 0);
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

function hydrateWeeklyFromAccounts(board, rangeStartMs, rangeEndMs, existingCuentas) {
  let modified = false;
  const activeMap = new Map();
  for (const acc of Object.values(existingCuentas || {})) {
    if (!acc || typeof acc !== 'object' || !acc.nombre) continue;
    activeMap.set(String(acc.nombre).trim().toLowerCase(), acc);
  }

  // Filtrar cuentas eliminadas
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

  // Incorporar partidas del historial de cuentas activas que aún no estén contabilizadas
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

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const d1 = resolveD1(env);
  const d1Bound = Boolean(d1);
  const realKv = resolveRealKV(env);
  const kv = resolveKV(env);
  const dbBound = Boolean(d1 || realKv);
  const kvBound = dbBound;

  const rawAdminUser = env?.ADMIN_USERNAME || env?.ADMIN_USER;
  const rawAdminPass = env?.ADMIN_SECRET_KEY || env?.ADMIN_KEY || env?.ADMIN_PASSWORD;
  const adminUserConfigured = Boolean(rawAdminUser && String(rawAdminUser).trim().length > 0);
  const adminKeyConfigured = Boolean(rawAdminPass && String(rawAdminPass).trim().length > 0);

  const ADMIN_USER = String(rawAdminUser || 'admin').trim();
  const ADMIN_PASS = String(rawAdminPass || 'muros2026').trim();

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Admin-User, X-Admin-Token, X-Admin-Id, X-Admin-Key, X-Self-Delete-Id, X-Self-Delete-Key, X-Register-Id',
    'Access-Control-Expose-Headers': 'X-KV-Bound, X-DB-Bound, X-Database-Bound, X-KV-Notice',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
  };

  const jsonHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'X-KV-Bound': kvBound ? 'true' : 'false',
    'X-DB-Bound': d1Bound ? 'true' : 'false',
    'X-Database-Bound': dbBound ? 'true' : 'false',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  async function verifyCallerAdmin(existingCuentas, precomputedSesion = null) {
    const hSupremeUser = (request.headers.get('X-Admin-User') || '').trim();
    const hSupremeToken = (request.headers.get('X-Admin-Token') || '').trim();
    const hAdminId = (request.headers.get('X-Admin-Id') || '').trim();
    const hAdminKey = (request.headers.get('X-Admin-Key') || '').trim();

    const sesion = precomputedSesion !== null ? precomputedSesion : await resolverSesion(request, env);

    // 1. Identificar actor
    const actorId = sesion?.usuarioId || hAdminId || (hSupremeUser ? 'admin' : null);
    const actor = actorId ? existingCuentas[actorId] : null;

    // 2. Comprobar si es el Dev Supremo único ('admin' o clave de entorno ADMIN_PASS)
    const isDirectSupremePass = Boolean(
      (hSupremeToken && timeConstantCompare(hSupremeToken, ADMIN_PASS)) ||
      (sesion?.token && timeConstantCompare(sesion.token, ADMIN_PASS))
    );
    const isSupremeOwner = Boolean(
      (sesion && sesion.usuarioId === 'admin') ||
      (actorId === 'admin' && (isDirectSupremePass || sesion)) ||
      (hSupremeUser && hSupremeUser.toLowerCase() === ADMIN_USER.toLowerCase() && isDirectSupremePass)
    );

    // 3. Obtener el rol efectivo (el de la cuenta en Database tiene prioridad sobre el token viejo)
    const effectiveRole = isSupremeOwner
      ? 'dev'
      : (actor?.rol || sesion?.rol || 'jugador');

    // 4. Jerarquía de privilegios: Dev > Admin > Mod > Jugador
    const isDev = isSupremeOwner || effectiveRole === 'dev';
    const isAdmin = isDev || effectiveRole === 'admin';
    const isMod = isAdmin || effectiveRole === 'mod';

    const hasAdminIntent = Boolean(
      hSupremeUser ||
      hSupremeToken ||
      hAdminId ||
      (sesion && (sesion.rol === 'admin' || sesion.rol === 'dev' || sesion.rol === 'mod' || sesion.usuarioId === 'admin'))
    );

    return {
      hasAdminIntent,
      isSupremeOwner, // Exclusivo del Dev único ('admin')
      isSupreme: isDev, // Compatibilidad: cualquier Dev tiene permisos de ejecución Dev
      isDev,
      isAdmin,
      isMod,
      isDelegated: isAdmin, // Compatibilidad: administradores y devs
      actorId,
      actor,
      effectiveRole,
      sesion,
    };
  }

  function verifyCallerAdminHeaders(existingCuentas) {
    const hSupremeUser = (request.headers.get('X-Admin-User') || '').trim();
    const hSupremeToken = (request.headers.get('X-Admin-Token') || '').trim();
    const hAdminId = (request.headers.get('X-Admin-Id') || '').trim();
    const hAdminKey = (request.headers.get('X-Admin-Key') || '').trim();

    const hasAdminIntent = Boolean(hSupremeUser || hSupremeToken || hAdminId);
    const isSupremeOwner =
      (Boolean(hSupremeUser && hSupremeToken) &&
        hSupremeUser.toLowerCase() === ADMIN_USER.toLowerCase() &&
        timeConstantCompare(hSupremeToken, ADMIN_PASS)) ||
      (hSupremeToken && timeConstantCompare(hSupremeToken, ADMIN_PASS));

    const actor = hAdminId ? existingCuentas[hAdminId] : null;
    const effectiveRole = isSupremeOwner ? 'dev' : (actor?.rol || 'jugador');

    const isDev = isSupremeOwner || effectiveRole === 'dev';
    const isAdmin = isDev || effectiveRole === 'admin';
    const isMod = isAdmin || effectiveRole === 'mod';

    return { hasAdminIntent, isSupremeOwner, isSupreme: isDev, isDev, isAdmin, isMod, isDelegated: isAdmin };
  }

  // Normalizar ruta por si está montado bajo subruta como /app/muro/api/...
  const apiIndex = url.pathname.indexOf('/api/');
  const pathname = apiIndex >= 0 ? url.pathname.slice(apiIndex) : url.pathname;

  // 1. /api/ping — Informa si D1 o KV están vinculados y si el Admin Supremo está configurado
  if (pathname === '/api/ping') {
    if (d1) {
      await ensureD1Tables(d1);
    }
    const lastUpdate = kv ? await kvGetLastUpdateCached(kv, 45000) : Date.now();
    return new Response(
      JSON.stringify({
        ok: true,
        d1Bound,
        dbBound,
        kvBound,
        dbType: d1Bound ? 'D1 (Database SQL)' : realKv ? 'KV' : 'Ninguno',
        adminUserConfigured,
        adminKeyConfigured,
        timestamp: Date.now(),
        lastUpdate,
      }),
      { headers: jsonHeaders }
    );
  }

  // 1b. /api/setup-d1 — Diagnóstico y auto-creación de tablas D1
  if (pathname === '/api/setup-d1' || pathname === '/api/init-d1') {
    if (!d1) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'No se detectó el binding de D1 en el Worker. En Cloudflare Worker > Settings > Bindings > D1 Database, añade el binding con Variable Name "DB".',
          d1Bound: false,
        }),
        { status: 503, headers: jsonHeaders }
      );
    }
    await ensureD1Tables(d1);
    let tables = [];
    try {
      const res = await d1.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      tables = (res?.results || []).map((t) => t.name);
    } catch {}
    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: 'Tablas de D1 verificadas y listas para usar.',
        d1Bound: true,
        tablas: tables,
      }),
      { headers: jsonHeaders }
    );
  }

  // 2. /api/login — Login seguro en servidor con PBKDF2 y migración automática
  if (pathname === '/api/login' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const trimmedUser = String(body.usuario || '').trim();
      const trimmedKey = String(body.clave || '').trim();

      if (!trimmedUser || !trimmedKey) {
        return new Response(JSON.stringify({ ok: false, error: 'Usuario y clave son obligatorios.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      // A) Comprobar si es el Admin Supremo
      if (trimmedUser.toLowerCase() === ADMIN_USER.toLowerCase()) {
        if (!timeConstantCompare(trimmedKey, ADMIN_PASS)) {
          return new Response(JSON.stringify({ ok: false, error: 'Clave del Admin Supremo incorrecta.' }), {
            status: 401,
            headers: jsonHeaders,
          });
        }
        const cuentas = await dbGetCuentas(env);
        const supremeProfile = buildSupremeProfile(cuentas);
        cuentas['admin'] = supremeProfile;
        await dbSaveCuentas(env, cuentas, false);
        const sesion = await crearSesion(env, 'admin', 'admin', 24);
        return new Response(
          JSON.stringify({
            ok: true,
            isSupremeAdmin: true,
            token: sesion.token,
            user: supremeProfile,
          }),
          { headers: jsonHeaders }
        );
      }

      // B) Comprobar si es un jugador normal o admin delegado
      const cuentas = await dbGetCuentas(env);
      const search = trimmedUser.toLowerCase();
      let cuentaFound = null;
      for (const acc of Object.values(cuentas)) {
        if (!acc || typeof acc !== 'object') continue;
        if (acc.id === 'admin') continue;
        if (
          String(acc.nombre || '').trim().toLowerCase() === search ||
          String(acc.id || '').trim().toLowerCase() === search
        ) {
          cuentaFound = acc;
          break;
        }
      }

      if (!cuentaFound) {
        return new Response(JSON.stringify({ ok: false, error: 'Usuario no encontrado. Regístrate para jugar.' }), {
          status: 404,
          headers: jsonHeaders,
        });
      }

      const passValida = await verificarClaveCuenta(cuentaFound, trimmedKey);
      if (!passValida) {
        return new Response(JSON.stringify({ ok: false, error: 'Contraseña incorrecta.' }), {
          status: 401,
          headers: jsonHeaders,
        });
      }

      // MIGRACIÓN AUTOMÁTICA: Si la cuenta aún tenía clave en plano, hashear con PBKDF2 y borrar el plano
      if (!cuentaFound.claveHash || cuentaFound.clave) {
        const hashData = await hashClavePBKDF2(trimmedKey);
        cuentaFound.claveHash = hashData.claveHash;
        cuentaFound.claveSalt = hashData.claveSalt;
        cuentaFound.claveIter = hashData.claveIter;
        delete cuentaFound.clave;
        delete cuentaFound.clave_plano;
        cuentas[cuentaFound.id] = cuentaFound;
        await dbSaveCuentas(env, cuentas, false);
      }

      cuentaFound.ultimaConexion = new Date().toISOString();
      cuentas[cuentaFound.id] = cuentaFound;
      await dbSaveCuentas(env, cuentas, false);

      const sesion = await crearSesion(env, cuentaFound.id, cuentaFound.rol || 'jugador', 720);
      return new Response(
        JSON.stringify({
          ok: true,
          isSupremeAdmin: false,
          token: sesion.token,
          user: sanitizeCuentaParaEnviar(cuentaFound),
        }),
        { headers: jsonHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 3. /api/registro — Registro con contraseña hasheada directamente en servidor
  if (pathname === '/api/registro' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const cleanId = String(body.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanName = String(body.nombre || '').trim();
      const cleanKey = String(body.clave || '').trim();

      if (!cleanId || cleanName.length < 3 || cleanName.length > 15) {
        return new Response(JSON.stringify({ ok: false, error: 'El nombre debe tener entre 3 y 15 caracteres.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      if (cleanKey.length < 4) {
        return new Response(JSON.stringify({ ok: false, error: 'La clave debe tener al menos 4 caracteres.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      if (cleanId === 'admin' || cleanName.toLowerCase() === 'admin' || cleanName.toLowerCase() === 'admin supremo') {
        return new Response(JSON.stringify({ ok: false, error: 'Ese nombre está reservado para el administrador.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const cuentas = await dbGetCuentas(env);
      for (const acc of Object.values(cuentas)) {
        if (!acc || typeof acc !== 'object') continue;
        if (
          acc.id.toLowerCase() === cleanId ||
          String(acc.nombre || '').trim().toLowerCase() === cleanName.toLowerCase()
        ) {
          return new Response(JSON.stringify({ ok: false, error: 'Ya existe un usuario con ese nombre.' }), {
            status: 409,
            headers: jsonHeaders,
          });
        }
      }

      if (!d1 && !realKv) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              '⚠️ La Database D1 no está vinculada al Worker en Cloudflare. Configúrala en: Workers > tu-worker > Settings > Bindings > D1 Database (Variable: DB).',
          }),
          { status: 503, headers: jsonHeaders }
        );
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
        avatarColor: body.avatarColor || '#ff6b6b',
        avatarHat: body.avatarHat || 'corona',
        temaTablero: body.temaTablero || 'madera',
        creadoEn: new Date().toISOString(),
        ultimaConexion: new Date().toISOString(),
        historialPartidas: [],
      };

      await dbInsertOrUpdateCuenta(env, nuevaCuenta, true);

      const sesion = await crearSesion(env, cleanId, 'jugador', 720);
      return new Response(
        JSON.stringify({
          ok: true,
          token: sesion.token,
          user: sanitizeCuentaParaEnviar(nuevaCuenta),
        }),
        { headers: jsonHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 4. /api/admin/restablecer-clave — Solo el Admin Supremo puede generar clave temporal
  if (pathname === '/api/admin/restablecer-clave' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme } = await verifyCallerAdmin(cuentas, sesion);
    const esAutorizado = (sesion && sesion.usuarioId === 'admin') || isSupreme;

    if (!esAutorizado) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Admin Supremo puede restablecer claves.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const targetId = String(body.targetId || '').trim();
      const cuentas = await dbGetCuentas(env);
      const target = cuentas[targetId];

      if (!target || targetId === 'admin') {
        return new Response(JSON.stringify({ ok: false, error: 'Usuario no encontrado o no modificable.' }), {
          status: 404,
          headers: jsonHeaders,
        });
      }

      // Generar clave temporal limpia
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
      delete target.clave_plano;
      cuentas[targetId] = target;
      await dbSaveCuentas(env, cuentas, false);

      return new Response(
        JSON.stringify({
          ok: true,
          usuarioNombre: target.nombre,
          claveTemporal,
          nota: 'Entrega esta clave al jugador. Al iniciar sesión se le pedirá cambiarla.',
        }),
        { headers: jsonHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 4b. /api/admin/eliminar-usuario — Elimina definitivamente un usuario de D1, KV, sesiones y ranking
  if (pathname === '/api/admin/eliminar-usuario' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme } = await verifyCallerAdmin(cuentas, sesion);
    const esAutorizado = (sesion && (sesion.usuarioId === 'admin' || sesion.rol === 'admin' || sesion.rol === 'dev')) || isSupreme;

    if (!esAutorizado) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Admin Supremo (Dev) puede eliminar usuarios.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const targetId = String(body.targetId || body.id || '').trim().toLowerCase();

      if (!targetId || targetId === 'admin') {
        return new Response(JSON.stringify({ ok: false, error: 'El Admin Supremo no puede eliminarse.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      // 1. Eliminar de D1
      if (d1) {
        await ensureD1Tables(d1);
        try {
          await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(targetId).run();
          await d1.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(targetId).run();
        } catch (err) {
          console.error('Error eliminando de D1:', err);
        }
      }

      // 2. Eliminar de memoria y mapa de cuentas
      const existing = await dbGetCuentas(env);
      const targetAcc = existing[targetId];
      const targetName = targetAcc?.nombre ? String(targetAcc.nombre).trim().toLowerCase() : targetId;
      delete existing[targetId];

      const mem = getKvMemCache();
      if (mem.cuentas) delete mem.cuentas[targetId];

      // 3. Eliminar de ranking
      if (kv) {
        await kvPutCuentasCached(kv, existing, true);
        const rank = await kvGetRankingCached(kv, 0);
        delete rank[targetId];
        delete rank[targetName];
        for (const [k, v] of Object.entries(rank)) {
          if (String(v?.nombre || '').trim().toLowerCase() === targetName || k.toLowerCase() === targetId) {
            delete rank[k];
          }
        }
        await kvPutRankingCached(kv, rank, true);
      }

      // 4. Guardar cuentas actualizadas en D1 con eliminación permitida
      await dbSaveCuentas(env, existing, true, true);

      return new Response(
        JSON.stringify({ ok: true, mensaje: `Usuario ${targetId} eliminado definitivamente.` }),
        { headers: jsonHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 5. /api/admin/verify — Valida usuario + clave del Admin Supremo y emite token de sesión seguro
  if (pathname === '/api/admin/verify' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const trimmedUser = String(body.usuario || '').trim();
      const trimmedKey = String(body.clave || '').trim();

      const isSupremeUsername = trimmedUser.toLowerCase() === ADMIN_USER.toLowerCase();

      if (isSupremeUsername) {
        if (!timeConstantCompare(trimmedKey, ADMIN_PASS)) {
          return new Response(
            JSON.stringify({
              ok: false,
              isSupremeAttempt: true,
              error: 'Clave del Admin Supremo incorrecta.',
            }),
            { status: 401, headers: jsonHeaders }
          );
        }

        const cuentas = await dbGetCuentas(env);
        const hadAdmin = Boolean(cuentas['admin']);
        const supremeProfile = buildSupremeProfile(cuentas);
        cuentas['admin'] = supremeProfile;
        if (!hadAdmin) {
          await dbSaveCuentas(env, cuentas, false);
        }

        const sesion = await crearSesion(env, 'admin', 'admin', 24);

        return new Response(
          JSON.stringify({
            ok: true,
            isSupremeAdmin: true,
            isCloudAdmin: true,
            kvBound: kvBound || d1Bound,
            adminUserConfigured,
            adminKeyConfigured,
            adminUser: ADMIN_USER,
            adminToken: sesion.token,
            token: sesion.token,
            user: supremeProfile,
          }),
          { headers: jsonHeaders }
        );
      }

      return new Response(JSON.stringify({ ok: false, isSupremeAttempt: false }), {
        headers: jsonHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
  }

  // 5b. /api/admin/verify-action — Valida sesión o credenciales antes de acciones administrativas
  if (pathname === '/api/admin/verify-action' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const { usuarioId, adminUser, adminToken, requiereSupremo } = body || {};
      const sesion = await resolverSesion(request, env);

      const isSupreme =
        (Boolean(adminUser && adminToken) &&
          String(adminUser).trim().toLowerCase() === ADMIN_USER.toLowerCase() &&
          (timeConstantCompare(String(adminToken).trim(), ADMIN_PASS) || (sesion && (sesion.usuarioId === 'admin' || sesion.rol === 'dev')))) ||
        (sesion && (sesion.usuarioId === 'admin' || sesion.rol === 'dev'));

      if ((usuarioId === 'admin' || sesion?.usuarioId === 'admin') && isSupreme) {
        return new Response(
          JSON.stringify({ ok: true, isSupremeAdmin: true, isCloudAdmin: true, rol: 'dev', kvBound: kvBound || d1Bound }),
          { headers: { ...jsonHeaders, 'X-KV-Bound': 'true' } }
        );
      }

      if (requiereSupremo) {
        return new Response(
          JSON.stringify({ ok: false, revoked: false, error: 'Acción exclusiva del Dev (Admin Supremo).' }),
          { status: 403, headers: { ...jsonHeaders, 'X-KV-Bound': 'true' } }
        );
      }

      if (usuarioId && usuarioId !== 'admin') {
        const cuentas = await dbGetCuentas(env);
        const acc = cuentas[usuarioId];
        if (acc && (acc.rol === 'admin' || acc.rol === 'mod')) {
          return new Response(
            JSON.stringify({ ok: true, isSupremeAdmin: false, isCloudAdmin: true, rol: acc.rol, kvBound: kvBound || d1Bound }),
            { headers: { ...jsonHeaders, 'X-KV-Bound': 'true' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ ok: false, revoked: true, error: 'Tus permisos de administración no son válidos o fueron revocados.' }),
        { status: 403, headers: { ...jsonHeaders, 'X-KV-Bound': 'true' } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
  }

  // 5c. /api/admin/personajes/regalar — Dev o Admin regala un personaje personalizado al inventario de un usuario
  if (pathname === '/api/admin/personajes/regalar' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme, isDelegated } = await verifyCallerAdmin(cuentas, sesion);
    const puedeRegalar = isSupreme || isDelegated;

    if (!puedeRegalar) {
      return new Response(JSON.stringify({ ok: false, error: 'No tienes permisos de Administrador o Dev para regalar personajes.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const targetId = String(body.targetId || '').trim().toLowerCase();
      const rawPersonaje = body.personaje;

      if (!targetId || !rawPersonaje || !rawPersonaje.nombre) {
        return new Response(JSON.stringify({ ok: false, error: 'Usuario destino y datos del personaje requeridos.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const targetAcc = cuentas[targetId];
      if (!targetAcc) {
        return new Response(JSON.stringify({ ok: false, error: 'El usuario destino no existe en la Database.' }), {
          status: 404,
          headers: jsonHeaders,
        });
      }

      if (!targetAcc.inventario || typeof targetAcc.inventario !== 'object') {
        targetAcc.inventario = { personajes: [] };
      }
      if (!Array.isArray(targetAcc.inventario.personajes)) {
        targetAcc.inventario.personajes = [];
      }

      const actorName = isSupreme ? 'Dev Supremo' : (sesion?.usuarioId && cuentas[sesion.usuarioId]?.nombre) || 'Admin';
      const nuevoPersonaje = {
        id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nombre: String(rawPersonaje.nombre).trim().slice(0, 24),
        color: rawPersonaje.color || '#ffd43b',
        hat: rawPersonaje.hat || 'corona',
        ropa: rawPersonaje.ropa || 'ninguna',
        aura: rawPersonaje.aura || 'ninguna',
        descripcion: rawPersonaje.descripcion || `Personaje exclusivo regalado`,
        origen: {
          tipo: isSupreme ? 'regalo_dev' : 'regalo_admin',
          otorgadoPor: isSupreme ? `Dev ${actorName}` : `Admin ${actorName}`,
          fecha: new Date().toISOString(),
        },
      };

      targetAcc.inventario.personajes.push(nuevoPersonaje);
      cuentas[targetId] = targetAcc;
      await dbSaveCuentas(env, cuentas, true);

      return new Response(
        JSON.stringify({
          ok: true,
          mensaje: `Personaje "${nuevoPersonaje.nombre}" añadido al inventario de ${targetAcc.nombre}.`,
          personaje: nuevoPersonaje,
          inventario: targetAcc.inventario,
        }),
        { headers: jsonHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 5d. /api/admin/personajes/quitar — Exclusivo Dev: retira un personaje del inventario de un usuario
  if (pathname === '/api/admin/personajes/quitar' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme } = await verifyCallerAdmin(cuentas, sesion);

    if (!isSupreme) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev puede retirar personajes de un inventario.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const targetId = String(body.targetId || '').trim().toLowerCase();
      const personajeId = String(body.personajeId || '').trim();

      const targetAcc = cuentas[targetId];
      if (!targetAcc) {
        return new Response(JSON.stringify({ ok: false, error: 'Usuario no encontrado.' }), {
          status: 404,
          headers: jsonHeaders,
        });
      }

      if (targetAcc.inventario && Array.isArray(targetAcc.inventario.personajes)) {
        targetAcc.inventario.personajes = targetAcc.inventario.personajes.filter((p) => p.id !== personajeId);
        if (targetAcc.inventario.activoId === personajeId) {
          targetAcc.inventario.activoId = undefined;
          targetAcc.avatarRopa = 'ninguna';
          targetAcc.avatarAura = 'ninguna';
        }
        cuentas[targetId] = targetAcc;
        await dbSaveCuentas(env, cuentas, true);
      }

      return new Response(
        JSON.stringify({ ok: true, mensaje: 'Personaje revocado del inventario.', inventario: targetAcc.inventario }),
        { headers: jsonHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 5e. /api/admin/personajes/fijar-premio-semanal — Dev o Admin fija el personaje premio del torneo semanal
  if (pathname === '/api/admin/personajes/fijar-premio-semanal' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isDev, isAdmin, isSupremeOwner } = await verifyCallerAdmin(cuentas, sesion);

    if (!isDev && !isAdmin) {
      return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes para fijar premios semanales.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const rawPersonaje = body.personaje;
      const actorName = isSupremeOwner ? 'Dev Supremo' : (sesion?.usuarioId && cuentas[sesion.usuarioId]?.nombre) || (isDev ? 'Dev' : 'Admin');

      const w = getWeekInfo();
      const keyActual = `semanal_${w.semanaActualId}`;
      let actual = { semanaId: w.semanaActualId, jugadores: {} };
      if (kv) {
        try {
          const rawA = await kv.get(keyActual);
          if (rawA) actual = { ...actual, ...JSON.parse(rawA) };
        } catch {}
      }

      let premio = null;
      if (rawPersonaje) {
        premio = {
          id: `premio_semanal_${w.semanaActualId}`,
          nombre: String(rawPersonaje.nombre).trim().slice(0, 24),
          color: rawPersonaje.color || '#ffd43b',
          hat: rawPersonaje.hat || 'corona',
          ropa: rawPersonaje.ropa || 'ninguna',
          ropaColor: rawPersonaje.ropaColor,
          aura: rawPersonaje.aura || 'dorada',
          descripcion: `Premio exclusivo de la Semana ${w.semanaActualId}`,
          origen: {
            tipo: 'torneo_semanal',
            otorgadoPor: `Torneo Semanal (${w.semanaActualId}) fijado por ${actorName}`,
            fecha: new Date().toISOString(),
            semanaTorneo: w.semanaActualId,
          },
        };
      }

      actual.premioSemanal = premio || undefined;
      if (kv) {
        await kv.put(keyActual, JSON.stringify(actual));
        await kv.put('premio_semanal_global', JSON.stringify(premio || {}));
      }

      return new Response(
        JSON.stringify({ ok: true, mensaje: 'Premio del torneo semanal actualizado y guardado en Database.', premioSemanal: premio }),
        { headers: jsonHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 5f. /api/admin/config-semanal — Dev y Admin configuran los puntos semanales y consultan premio
  if (pathname === '/api/admin/config-semanal') {
    if (request.method === 'GET') {
      let cfg = { primerLugar: 50, segundoLugar: 30, tercerLugar: 15, participacion: 5 };
      let premioSemanal = null;
      if (kv) {
        try {
          const raw = await kv.get('config_semanal_puntos');
          if (raw) cfg = { ...cfg, ...JSON.parse(raw) };
          const rawP = await kv.get('premio_semanal_global');
          if (rawP) {
            const p = JSON.parse(rawP);
            if (p && p.id) premioSemanal = p;
          }
        } catch {}
      }
      return new Response(JSON.stringify({ ok: true, config: cfg, premioSemanal }), { headers: jsonHeaders });
    }
    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isDev, isAdmin } = await verifyCallerAdmin(cuentas, sesion);
      if (!isDev && !isAdmin) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }
      const body = await request.json().catch(() => ({}));
      const cfg = {
        primerLugar: Math.max(1, Number(body.primerLugar) || 50),
        segundoLugar: Math.max(0, Number(body.segundoLugar) || 30),
        tercerLugar: Math.max(0, Number(body.tercerLugar) || 15),
        participacion: Math.max(0, Number(body.participacion) || 5),
      };
      if (kv) {
        await kv.put('config_semanal_puntos', JSON.stringify(cfg));
      }
      return new Response(JSON.stringify({ ok: true, config: cfg, mensaje: 'Puntos semanales guardados en Database.' }), {
        headers: jsonHeaders,
      });
    }
  }

  // 5f2. /api/admin/desbloqueos-personajes — Obtener y configurar puntos requeridos para personajes
  if (pathname === '/api/admin/desbloqueos-personajes') {
    if (request.method === 'GET') {
      let desbloqueos = {
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
      if (kv) {
        try {
          const raw = await kv.get('config_desbloqueos_personajes');
          if (raw) desbloqueos = { ...desbloqueos, ...JSON.parse(raw) };
        } catch {}
      }
      return new Response(JSON.stringify({ ok: true, desbloqueos }), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isDev } = await verifyCallerAdmin(cuentas, sesion);
      if (!isDev) {
        return new Response(JSON.stringify({ ok: false, error: 'Exclusivo del rol Dev.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }
      const body = await request.json().catch(() => ({}));
      const desbloqueos = body.desbloqueos || {};
      if (kv) {
        await kv.put('config_desbloqueos_personajes', JSON.stringify(desbloqueos));
      }
      return new Response(JSON.stringify({ ok: true, desbloqueos, mensaje: 'Requisitos de desbloqueo guardados en Database.' }), {
        headers: jsonHeaders,
      });
    }
  }

  // 5f3. /api/admin/salas-personalizadas — Moderadores, Admins y Devs gestionan salas personalizadas
  if (pathname === '/api/admin/salas-personalizadas') {
    if (request.method === 'GET') {
      let salas = [];
      if (kv) {
        try {
          const raw = await kv.get('salas_personalizadas');
          if (raw) salas = JSON.parse(raw);
          if (!Array.isArray(salas)) salas = [];
        } catch {}
      }
      return new Response(JSON.stringify({ ok: true, salas }), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isMod, isAdmin, isDev } = await verifyCallerAdmin(cuentas, sesion);
      if (!isMod && !isAdmin && !isDev) {
        return new Response(JSON.stringify({ ok: false, error: 'Exclusivo para Moderadores, Admins o Dev.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }

      const body = await request.json().catch(() => ({}));
      const codigo = String(body.codigo || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      const nombre = String(body.nombre || '').trim();
      if (!codigo || !nombre) {
        return new Response(JSON.stringify({ ok: false, error: 'Código y nombre de la sala requeridos.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const creadorNombre = (sesion?.usuarioId && cuentas[sesion.usuarioId]?.nombre) || (isDev ? 'Dev' : 'Moderador');
      const nuevaSala = {
        id: `custom_${codigo}`,
        codigo,
        nombre: nombre.slice(0, 30),
        creador: creadorNombre,
        creadorId: sesion?.usuarioId || 'admin',
        creadoEn: Date.now(),
        maxJugadores: body.maxJugadores === 4 ? 4 : 2,
        modoMuros: body.modoMuros === 'caos' ? 'caos' : (body.modoMuros === 'tactico' ? 'tactico' : 'estandar'),
        tamanoTablero: body.tamanoTablero === 7 ? 7 : 9,
        destacada: true,
      };

      let lista = [];
      if (kv) {
        try {
          const raw = await kv.get('salas_personalizadas');
          if (raw) lista = JSON.parse(raw);
          if (!Array.isArray(lista)) lista = [];
        } catch {}
      }

      lista = lista.filter((s) => s.codigo !== codigo);
      lista.unshift(nuevaSala);
      if (lista.length > 20) lista = lista.slice(0, 20);

      if (kv) {
        await kv.put('salas_personalizadas', JSON.stringify(lista));
      }

      return new Response(JSON.stringify({ ok: true, sala: nuevaSala, salas: lista, mensaje: `Sala oficial "${nuevaSala.nombre}" creada y destacada.` }), {
        headers: jsonHeaders,
      });
    }

    if (request.method === 'DELETE') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isMod, isAdmin, isDev } = await verifyCallerAdmin(cuentas, sesion);
      if (!isMod && !isAdmin && !isDev) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }
      const body = await request.json().catch(() => ({}));
      const codigo = String(body.codigo || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      let lista = [];
      if (kv) {
        try {
          const raw = await kv.get('salas_personalizadas');
          if (raw) lista = JSON.parse(raw);
          if (!Array.isArray(lista)) lista = [];
        } catch {}
        lista = lista.filter((s) => s.codigo !== codigo);
        await kv.put('salas_personalizadas', JSON.stringify(lista));
      }
      return new Response(JSON.stringify({ ok: true, salas: lista }), { headers: jsonHeaders });
    }
  }

  // 5g. /api/admin/ranking/solicitar-reset — Admin solicita reset de ranking al Dev
  if (pathname === '/api/admin/ranking/solicitar-reset' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme, isDelegated } = await verifyCallerAdmin(cuentas, sesion);

    if (!isSupreme && !isDelegated) {
      return new Response(JSON.stringify({ ok: false, error: 'Debes ser Administrador para solicitar el reseteo.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const actorName = isSupreme ? 'Dev Supremo' : (sesion?.usuarioId && cuentas[sesion.usuarioId]?.nombre) || 'Admin';
      const solicitud = {
        solicitada: true,
        porNombre: actorName,
        porId: sesion?.usuarioId || 'admin',
        fecha: new Date().toISOString(),
        motivo: String(body.motivo || 'Reinicio periódico del ranking solicitado por admin').trim(),
      };
      if (kv) {
        await kv.put('solicitud_reset_ranking', JSON.stringify(solicitud));
      }
      return new Response(
        JSON.stringify({ ok: true, mensaje: 'Solicitud enviada. Requiere aprobación del Dev Supremo.', solicitud }),
        { headers: jsonHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 5h. /api/admin/ranking/solicitud-reset — Consulta si hay una solicitud pendiente
  if (pathname === '/api/admin/ranking/solicitud-reset' && request.method === 'GET') {
    let solicitud = null;
    if (kv) {
      try {
        const raw = await kv.get('solicitud_reset_ranking');
        if (raw) solicitud = JSON.parse(raw);
      } catch {}
    }
    return new Response(JSON.stringify({ ok: true, solicitud }), { headers: jsonHeaders });
  }

  // 5i. /api/admin/ranking/aprobar-reset — Exclusivo Dev: aprueba y borra el ranking
  if (pathname === '/api/admin/ranking/aprobar-reset' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme } = await verifyCallerAdmin(cuentas, sesion);

    if (!isSupreme) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev Supremo puede aprobar el reseteo del ranking.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    try {
      // 1. Limpiar ranking en KV y D1
      if (kv) {
        await kvPutRankingCached(kv, {}, true);
        await kv.delete('solicitud_reset_ranking');
        const w = getWeekInfo();
        await kv.put(`semanal_${w.semanaActualId}`, JSON.stringify({ semanaId: w.semanaActualId, jugadores: {} }));
      }
      // 2. Resetear puntos de jugadores a cero
      for (const [id, acc] of Object.entries(cuentas)) {
        if (id !== 'admin') {
          cuentas[id] = { ...acc, puntos: 0, partidas: 0, victorias: 0, derrotas: 0, empates: 0, elo: 1000 };
        }
      }
      await dbSaveCuentas(env, cuentas, true);

      return new Response(JSON.stringify({ ok: true, mensaje: 'Ranking reseteado exitosamente con aprobación del Dev.' }), {
        headers: jsonHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  // 5j. /api/admin/ranking/rechazar-reset — Exclusivo Dev: rechaza solicitud de reseteo
  if (pathname === '/api/admin/ranking/rechazar-reset' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme } = await verifyCallerAdmin(cuentas, sesion);

    if (!isSupreme) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev Supremo puede rechazar la solicitud.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    if (kv) {
      await kv.delete('solicitud_reset_ranking');
    }
    return new Response(JSON.stringify({ ok: true, mensaje: 'Solicitud de reseteo desestimada.' }), {
      headers: jsonHeaders,
    });
  }

  // 6. /api/cuentas — GET sanitizado y POST protegido
  if (pathname === '/api/cuentas') {
    if (request.method === 'GET') {
      const cuentas = await dbGetCuentas(env);
      return new Response(JSON.stringify(sanitizeCuentasParaEnviar(cuentas)), { headers: jsonHeaders });
    }
    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const text = await request.text();
      let incoming = {};
      try {
        incoming = JSON.parse(text || '{}');
      } catch {}

      const existing = await dbGetCuentas(env);
      const { isSupremeOwner, isDev, isAdmin } = await verifyCallerAdmin(existing, sesion);
      const esAdmin = isDev || isAdmin;

      let finalCuentas = { ...existing };

      if (esAdmin) {
        // Dev Supremo / Dev / Admin: gestiona según jerarquía estricta
        for (const [id, acc] of Object.entries(incoming)) {
          if (!acc || typeof acc !== 'object') continue;
          if (id === 'admin') continue;
          const prevAcc = existing[id];

          let assignedRol = prevAcc?.rol || 'jugador';
          if (isSupremeOwner) {
            // El Dev Supremo único ('admin') puede asignar o revocar CUALQUIER rol, incluyendo DEV
            assignedRol = acc.rol || prevAcc?.rol || 'jugador';
          } else if (isDev) {
            // Un Dev delegado NO puede modificar a usuarios con rol dev ni puede otorgar rol dev
            if (prevAcc && prevAcc.rol === 'dev') {
              continue;
            }
            if (acc.rol === 'dev') {
              assignedRol = prevAcc?.rol || 'jugador'; // Solo el Dev Supremo único puede dar poder de Dev
            } else {
              assignedRol = acc.rol || prevAcc?.rol || 'jugador';
            }
          } else if (isAdmin) {
            // Un Admin regular no puede modificar a Devs ni a otros Admins
            if (prevAcc && (prevAcc.rol === 'admin' || prevAcc.rol === 'dev')) {
              continue;
            }
            if (acc.rol === 'mod' || acc.rol === 'jugador') {
              assignedRol = acc.rol;
            }
          }

          finalCuentas[id] = {
            ...(prevAcc || {}),
            ...acc,
            id,
            rol: assignedRol,
            inventario: acc.inventario || prevAcc?.inventario || { personajes: [] },
          };

          // CLAVE: Solo el Dev (isSupreme) puede alterar la contraseña
          if (isSupreme && acc.clave && acc.clave !== '***SUPREMO***') {
            const h = await hashClavePBKDF2(acc.clave);
            finalCuentas[id].claveHash = h.claveHash;
            finalCuentas[id].claveSalt = h.claveSalt;
            finalCuentas[id].claveIter = h.claveIter;
            delete finalCuentas[id].clave;
          } else {
            // Eliminar clave en plano si un admin regular intentó enviarla
            delete finalCuentas[id].clave;
          }
        }
      } else if (sesion && sesion.usuarioId && finalCuentas[sesion.usuarioId]) {
        // Usuario normal solo puede actualizar sus preferencias visuales y personaje equipado
        const id = sesion.usuarioId;
        const myPatch = incoming[id];
        if (myPatch && typeof myPatch === 'object') {
          finalCuentas[id] = {
            ...finalCuentas[id],
            nombre: myPatch.nombre && myPatch.nombre.length >= 3 && myPatch.nombre.length <= 15 ? myPatch.nombre : finalCuentas[id].nombre,
            avatarColor: myPatch.avatarColor || finalCuentas[id].avatarColor,
            avatarHat: myPatch.avatarHat || finalCuentas[id].avatarHat,
            avatarRopa: myPatch.avatarRopa || finalCuentas[id].avatarRopa || 'ninguna',
            avatarAura: myPatch.avatarAura || finalCuentas[id].avatarAura || 'ninguna',
            inventario: myPatch.inventario || finalCuentas[id].inventario || { personajes: [] },
            temaTablero: myPatch.temaTablero || finalCuentas[id].temaTablero,
            ultimaConexion: new Date().toISOString(),
          };
        }
      } else {
        // Petición no autorizada
        return new Response(JSON.stringify({ ok: false, error: 'Inicia sesión para modificar tu cuenta.' }), {
          status: 401,
          headers: jsonHeaders,
        });
      }

      const delId = (request.headers.get('X-Admin-Delete-Id') || '').trim().toLowerCase();
      if (esAdmin && delId && delId !== 'admin') {
        delete finalCuentas[delId];
        if (d1) {
          try {
            await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(delId).run();
            await d1.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(delId).run();
          } catch {}
        }
      }

      const selfDelId = (request.headers.get('X-Self-Delete-Id') || '').trim().toLowerCase();
      const selfDelKey = (request.headers.get('X-Self-Delete-Key') || '').trim();
      if (selfDelId && selfDelId !== 'admin' && existing[selfDelId]) {
        const canSelfDel = (sesion && sesion.usuarioId === selfDelId) || (selfDelKey && (await verificarClaveCuenta(existing[selfDelId], selfDelKey)));
        if (canSelfDel) {
          delete finalCuentas[selfDelId];
          if (d1) {
            try {
              await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(selfDelId).run();
              await d1.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(selfDelId).run();
            } catch {}
          }
        }
      }

      finalCuentas['admin'] = buildSupremeProfile(finalCuentas);
      await dbSaveCuentas(env, finalCuentas, true, Boolean(delId || selfDelId));

      return new Response(
        JSON.stringify({ ok: true, cuentas: sanitizeCuentasParaEnviar(finalCuentas) }),
        { headers: jsonHeaders }
      );
    }
  }

  // 5. /api/ranking
  if (pathname === '/api/ranking') {
    if (!kv) {
      return new Response(JSON.stringify({}), { status: request.method === 'POST' ? 503 : 200, headers: jsonHeaders });
    }
    if (request.method === 'GET') {
      const data = await kvGetRankingCached(kv, 8000);
      return new Response(JSON.stringify(data), { headers: jsonHeaders });
    }
    if (request.method === 'POST') {
      const existingCuentas = await kvGetCuentasCached(kv, 5000);
      const sesion = await resolverSesion(request, env);
      const { hasAdminIntent, isSupreme, isDelegated } = await verifyCallerAdmin(existingCuentas, sesion);
      if (hasAdminIntent && !isSupreme && !isDelegated) {
        return new Response(
          JSON.stringify({
            ok: false,
            revoked: true,
            error: 'Tus permisos de administrador fueron revocados.',
          }),
          { status: 403, headers: jsonHeaders }
        );
      }

      const text = await request.text();
      let incomingRank = {};
      try {
        incomingRank = JSON.parse(text || '{}') || {};
      } catch {}

      let finalRank = {};
      if (isSupreme || isDelegated) {
        finalRank = incomingRank;
      } else {
        // Escritura normal: conservar ranking actual en KV y aceptar únicamente cuentas activas en KV
        const existingRank = await kvGetRankingCached(kv, 0);

        const activeNames = new Set(
          Object.values(existingCuentas)
            .filter((a) => a && typeof a === 'object' && a.nombre)
            .map((a) => String(a.nombre).trim().toLowerCase())
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

      if ((isSupreme || isDelegated) && Object.keys(finalRank).length === 0) {
        const w = getWeekInfo();
        await kv.put(
          `semanal_${w.semanaActualId}`,
          JSON.stringify({ semanaId: w.semanaActualId, jugadores: {} }),
          { expirationTtl: 60 * 60 * 24 * 28 }
        );
        await kv.put(
          `semanal_${w.semanaPasadaId}`,
          JSON.stringify({ semanaId: w.semanaPasadaId, premiada: true, jugadores: {} }),
          { expirationTtl: 60 * 60 * 24 * 28 }
        );
      }
      const now = await kvPutRankingCached(kv, finalRank, isSupreme || isDelegated);
      return new Response(
        JSON.stringify({ ok: true, kvBound: true, lastUpdate: now }),
        { headers: jsonHeaders }
      );
    }
  }

  // 5a. /api/partida — Endpoint unificado post-partida (con validación de sesión y persistencia en D1 / KV)
  if (pathname === '/api/partida' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const body = await request.json().catch(() => ({}));
    const matchId = String(body.matchId || `m_${Date.now()}`).trim();
    const cuentasPatch = body.cuentasPatch && typeof body.cuentasPatch === 'object' ? body.cuentasPatch : {};
    const rankingPatch = body.rankingPatch && typeof body.rankingPatch === 'object' ? body.rankingPatch : {};
    const entradasSemanal = Array.isArray(body.entradasSemanal) ? body.entradasSemanal : [];

    const existingCuentas = await dbGetCuentas(env);
    const existingRank = kv ? await kvGetRankingCached(kv, 0) : {};

    let cuentasChanged = false;
    for (const [id, patchAcc] of Object.entries(cuentasPatch)) {
      if (!patchAcc || typeof patchAcc !== 'object' || id === 'admin') continue;

      // SEGURIDAD CRÍTICA: Solo se permite modificar una cuenta registrada si el jugador
      // ha iniciado sesión legítimamente con ese mismo id (o es Admin Supremo).
      // Si un invitado jugó con ese nombre, la petición es ignorada y la cuenta no se altera.
      const esPropietario = sesion && (sesion.usuarioId === id || sesion.rol === 'admin');
      if (!esPropietario) continue;

      const prevAcc = existingCuentas[id];
      if (!prevAcc) continue;

      existingCuentas[id] = {
        ...prevAcc,
        puntos: typeof patchAcc.puntos === 'number' ? patchAcc.puntos : prevAcc.puntos,
        partidas: typeof patchAcc.partidas === 'number' ? patchAcc.partidas : prevAcc.partidas,
        victorias: typeof patchAcc.victorias === 'number' ? patchAcc.victorias : prevAcc.victorias,
        derrotas: typeof patchAcc.derrotas === 'number' ? patchAcc.derrotas : prevAcc.derrotas,
        empates: typeof patchAcc.empates === 'number' ? patchAcc.empates : prevAcc.empates,
        elo: typeof patchAcc.elo === 'number' ? patchAcc.elo : prevAcc.elo,
        ultimaConexion: new Date().toISOString(),
        historialPartidas: Array.isArray(patchAcc.historialPartidas) ? patchAcc.historialPartidas : prevAcc.historialPartidas,
      };
      cuentasChanged = true;
    }

    const activeByName = new Map();
    for (const acc of Object.values(existingCuentas)) {
      if (acc && typeof acc === 'object' && acc.nombre) {
        activeByName.set(String(acc.nombre).trim().toLowerCase(), acc);
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
      const entryName = String(v.nombre || k).trim().toLowerCase();
      if (activeByName.has(entryName) || activeByName.has(k.toLowerCase())) {
        existingRank[k] = v;
        rankChanged = true;
      }
    }

    if (cuentasChanged) {
      existingCuentas['admin'] = buildSupremeProfile(existingCuentas);
      await dbSaveCuentas(env, existingCuentas, false);
    }
    if (rankChanged && kv) {
      await kvPutRankingCached(kv, existingRank, false);
    }

    if (entradasSemanal.length > 0) {
      const w = getWeekInfo();
      const keyActual = `semanal_${w.semanaActualId}`;
      let actual = { semanaId: w.semanaActualId, jugadores: {} };
      try {
        const rawA = await kv.get(keyActual);
        if (rawA) actual = { ...actual, ...JSON.parse(rawA) };
      } catch {}
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
        await kv.put(keyActual, JSON.stringify(actual), { expirationTtl: 60 * 60 * 24 * 28 });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        kvBound: true,
        activeAccountIds: Object.keys(existingCuentas),
      }),
      { headers: jsonHeaders }
    );
  }

  // 5b. /api/semanal — Clasificación semanal separada por claves KV (sin inflar un único string) + premios automáticos
  if (pathname === '/api/semanal') {
    const w = getWeekInfo();
    const emptyActual = { semanaId: w.semanaActualId, jugadores: {} };
    const emptyPasada = { semanaId: w.semanaPasadaId, jugadores: {} };

    if (!kv) {
      return new Response(
        JSON.stringify({
          ok: false,
          kvBound: false,
          semanaActualId: w.semanaActualId,
          semanaPasadaId: w.semanaPasadaId,
          cierraEnMs: w.cierraEnMs,
          actual: emptyActual,
          pasada: emptyPasada,
        }),
        { status: request.method === 'POST' ? 503 : 200, headers: jsonHeaders }
      );
    }

    const keyActual = `semanal_${w.semanaActualId}`;
    const keyPasada = `semanal_${w.semanaPasadaId}`;

    let existingCuentas = {};
    try {
      existingCuentas = await dbGetCuentas(env);
    } catch {}

    if (request.method === 'GET') {
      let actual = emptyActual;
      let pasada = emptyPasada;
      try {
        const rawA = await kv.get(keyActual);
        if (rawA) actual = { ...emptyActual, ...JSON.parse(rawA) };
      } catch {}
      try {
        const rawP = await kv.get(keyPasada);
        if (rawP) pasada = { ...emptyPasada, ...JSON.parse(rawP) };
      } catch {}

      // Si actual no tiene premioSemanal explícito pero hay uno fijado globalmente, asignarlo
      if (!actual.premioSemanal) {
        try {
          const rawGlob = await kv.get('premio_semanal_global');
          if (rawGlob) {
            const pGlob = JSON.parse(rawGlob);
            if (pGlob && pGlob.id) actual.premioSemanal = pGlob;
          }
        } catch {}
      }

      const modActual = hydrateWeeklyFromAccounts(actual, w.mondayUtc, w.nextMondayUtc, existingCuentas);
      const modPasada = hydrateWeeklyFromAccounts(pasada, w.lastMondayUtc, w.mondayUtc, existingCuentas);

      // Liquidar premios de la semana pasada una única vez para quien quedó encima
      const candidatosPasada = Object.values(pasada.jugadores || {}).filter((j) => j && j.partidas > 0 && j.puntos > 0);
      if (!pasada.premiada) {
        if (candidatosPasada.length > 0) {
          candidatosPasada.sort((a, b) => {
            if (b.puntos !== a.puntos) return b.puntos - a.puntos;
            if (b.victorias !== a.victorias) return b.victorias - a.victorias;
            return b.partidas - a.partidas;
          });

          let existingRank = {};
          try {
            existingRank = JSON.parse((await kv.get('ranking')) || '{}') || {};
          } catch {}

          const premiados = [];
          let cuentasChanged = false;
          let rankChanged = false;

          let bonosSemanales = PREMIOS_SEMANALES;
          try {
            const rawCfg = await kv.get('config_semanal_puntos');
            if (rawCfg) {
              const parsedCfg = JSON.parse(rawCfg);
              if (parsedCfg && typeof parsedCfg.primerLugar === 'number') {
                bonosSemanales = [parsedCfg.primerLugar, parsedCfg.segundoLugar || 15, parsedCfg.tercerLugar || 10];
              }
            }
          } catch {}

          candidatosPasada.slice(0, 3).forEach((ganadorSem, idx) => {
            const bono = bonosSemanales[idx] || 0;
            const normName = String(ganadorSem.nombre).trim().toLowerCase();
            const accEntry = Object.values(existingCuentas).find(
              (a) => a && typeof a === 'object' && String(a.nombre || '').trim().toLowerCase() === normName
            );
            let personajePremio = undefined;
            if (accEntry && accEntry.id) {
              accEntry.puntos = (Number(accEntry.puntos) || 0) + bono;

              // Otorgar personaje de premio semanal al ganador del 1er puesto
              if (idx === 0 && pasada.premioSemanal) {
                if (!accEntry.inventario || typeof accEntry.inventario !== 'object') {
                  accEntry.inventario = { personajes: [] };
                }
                if (!Array.isArray(accEntry.inventario.personajes)) {
                  accEntry.inventario.personajes = [];
                }
                personajePremio = {
                  ...pasada.premioSemanal,
                  id: `premio_${pasada.semanaId}_${Date.now()}`,
                  origen: {
                    tipo: 'torneo_semanal',
                    otorgadoPor: `Torneo Semanal (${pasada.semanaId})`,
                    fecha: new Date().toISOString(),
                    semanaTorneo: pasada.semanaId,
                  },
                };
                accEntry.inventario.personajes.push(personajePremio);
              }

              existingCuentas[accEntry.id] = accEntry;
              cuentasChanged = true;
            }
            if (existingRank[normName]) {
              existingRank[normName].puntosTotales =
                (Number(existingRank[normName].puntosTotales) || 0) + bono;
              rankChanged = true;
            }
            premiados.push({ nombre: ganadorSem.nombre, puesto: idx + 1, bono, personajePremio });
          });

          pasada.premiada = true;
          pasada.premiados = premiados;
          await kv.put(keyPasada, JSON.stringify(pasada), { expirationTtl: 60 * 60 * 24 * 28 });
          if (cuentasChanged) {
            await kv.put('cuentas', JSON.stringify(sanitizeCuentas(existingCuentas)));
          }
          if (rankChanged) {
            await kv.put('ranking', JSON.stringify(existingRank));
          }
          if (cuentasChanged || rankChanged) {
            await kv.put('last_update', String(Date.now()));
          }
        } else if (modPasada) {
          await kv.put(keyPasada, JSON.stringify(pasada), { expirationTtl: 60 * 60 * 24 * 28 });
        }
      } else if (modPasada) {
        await kv.put(keyPasada, JSON.stringify(pasada), { expirationTtl: 60 * 60 * 24 * 28 });
      }

      if (modActual) {
        await kv.put(keyActual, JSON.stringify(actual), { expirationTtl: 60 * 60 * 24 * 28 });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          kvBound: true,
          semanaActualId: w.semanaActualId,
          semanaPasadaId: w.semanaPasadaId,
          cierraEnMs: w.cierraEnMs,
          actual,
          pasada,
        }),
        { headers: jsonHeaders }
      );
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const matchId = String(body.matchId || `m_${Date.now()}`).trim();
      const entradas = Array.isArray(body.entradas) ? body.entradas : [];

      const activeByName = new Map();
      for (const acc of Object.values(existingCuentas)) {
        if (acc && typeof acc === 'object' && acc.nombre) {
          activeByName.set(String(acc.nombre).trim().toLowerCase(), acc);
        }
      }

      let actual = emptyActual;
      try {
        const rawA = await kv.get(keyActual);
        if (rawA) actual = { ...emptyActual, ...JSON.parse(rawA) };
      } catch {}
      if (!actual.jugadores) actual.jugadores = {};

      let updated = false;
      for (const item of entradas) {
        if (!item || !item.nombre) continue;
        const key = String(item.nombre).trim().toLowerCase();
        const acc = activeByName.get(key);
        if (!acc) continue; // Ignorar invitados o cuentas eliminadas en KV

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
        await kv.put(keyActual, JSON.stringify(actual), { expirationTtl: 60 * 60 * 24 * 28 });
      }

      return new Response(JSON.stringify({ ok: true, kvBound: true }), { headers: jsonHeaders });
    }
  }

  // 6. /api/salas — Descubrimiento público + Señalización WebRTC propia + Respaldo CGNAT
  const memSalas = globalThis.__MUROS_SALAS_MEM__ || (globalThis.__MUROS_SALAS_MEM__ = new Map());
  const memSalasMeta = globalThis.__MUROS_SALAS_META__ || (globalThis.__MUROS_SALAS_META__ = new Map());

  function prunePublicRoomsMap(salasObj, now = Date.now()) {
    let changed = false;
    const cleaned = { ...(salasObj || {}) };
    for (const [code, r] of Object.entries(cleaned)) {
      if (!r || typeof r !== 'object') {
        delete cleaned[code];
        changed = true;
        continue;
      }
      const age = now - (r.creadoEn || 0);
      const idle = now - (r.ultimoCambio || r.creadoEn || 0);
      if (age > 30 * 60 * 1000 || idle > 5 * 60 * 1000 || r.enPartida || r.publica === false) {
        delete cleaned[code];
        changed = true;
      }
    }
    return { cleaned, changed };
  }

  async function readPublicIndex(maxAgeMs = 6000) {
    if (!kv) {
      const obj = {};
      for (const [k, r] of memSalas.entries()) {
        if (r && r.publica !== false && !r.enPartida) obj[k] = r;
      }
      return obj;
    }
    const mem = getKvMemCache();
    const now = Date.now();
    if (mem.publicIndex && now - mem.publicIndexAt < maxAgeMs) {
      return JSON.parse(JSON.stringify(mem.publicIndex));
    }
    const raw = (await kv.get('salas_publicas')) || '{}';
    try {
      const parsed = JSON.parse(raw);
      const obj = Array.isArray(parsed)
        ? Object.fromEntries(parsed.map((r) => [r.codigo, r]))
        : parsed || {};
      mem.publicIndex = obj;
      mem.publicIndexAt = now;
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return {};
    }
  }

  async function writePublicIndex(salasObj) {
    const { cleaned } = prunePublicRoomsMap(salasObj);
    const mem = getKvMemCache();
    mem.publicIndex = cleaned;
    mem.publicIndexAt = Date.now();
    if (kv) {
      await kv.put('salas_publicas', JSON.stringify(cleaned));
    }
  }

  async function readRoomState(code, maxAgeMs = 2000) {
    const clean = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!clean) return null;
    const now = Date.now();
    const meta = memSalasMeta.get(clean);
    if (memSalas.has(clean) && meta && now - meta.readAt < maxAgeMs) {
      return memSalas.get(clean);
    }
    if (kv) {
      const raw = await kv.get(`sala_${clean}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          memSalas.set(clean, parsed);
          memSalasMeta.set(clean, {
            readAt: now,
            writtenAt: meta?.writtenAt || parsed.ultimoCambio || now,
          });
          return parsed;
        } catch {}
      }
      const pub = await readPublicIndex(6000);
      if (pub[clean]) {
        return {
          ...pub[clean],
          codigo: clean,
          publica: true,
          enPartida: false,
          jugadores: pub[clean].jugadores || [],
          signals: {},
          seq: 0,
          mensajes: [],
        };
      }
      return null;
    }
    return memSalas.get(clean) || null;
  }

  async function writeRoomState(code, roomObj) {
    const clean = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!clean) return;
    const now = Date.now();
    memSalas.set(clean, roomObj);
    memSalasMeta.set(clean, { readAt: now, writtenAt: now });
    if (kv) {
      await kv.put(`sala_${clean}`, JSON.stringify(roomObj), { expirationTtl: 3600 });
    }
  }

  async function deleteRoomState(code) {
    const clean = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!clean) return;
    memSalas.delete(clean);
    memSalasMeta.delete(clean);
    if (kv) {
      try {
        await kv.delete(`sala_${clean}`);
      } catch {}
    }
  }

  if (pathname === '/api/salas') {
    if (request.method === 'GET') {
      // Filtrado en lectura sin escribir en KV durante GET (elimina cientos de escrituras KV innecesarias)
      const salasObj = await readPublicIndex(6000);
      const { cleaned } = prunePublicRoomsMap(salasObj);
      const valid = Object.values(cleaned).filter(
        (r) => r && (r.jugadoresConectados || 1) < (r.maxJugadores || 2)
      );
      valid.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
      return new Response(JSON.stringify(valid), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const room = await request.json().catch(() => ({}));
      const now = Date.now();
      const code = String(room?.codigo || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      if (!code) {
        return new Response(JSON.stringify({ ok: false, error: 'Código inválido' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const existing = await readRoomState(code);
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

      await writeRoomState(code, fullRoom);

      if (esPublica) {
        const salas = await readPublicIndex();
        salas[code] = {
          codigo: code,
          nombre: fullRoom.nombre,
          anfitrion: fullRoom.anfitrion,
          color: fullRoom.color,
          hat: fullRoom.hat,
          maxJugadores: fullRoom.maxJugadores,
          publica: true,
          enPartida: false,
          jugadoresConectados: fullRoom.jugadoresConectados,
          creadoEn: fullRoom.creadoEn,
          ultimoCambio: now,
        };
        await writePublicIndex(salas);
      }

      return new Response(JSON.stringify({ ok: true, kvBound, sala: fullRoom, timestamp: now }), {
        headers: jsonHeaders,
      });
    }
  }

  if (pathname.startsWith('/api/salas/')) {
    const rest = pathname.slice('/api/salas/'.length);
    const parts = rest.split('/').filter(Boolean);
    const codigo = decodeURIComponent(parts[0] || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const subaction = parts[1] || '';

    if (!codigo) {
      return new Response(JSON.stringify({ ok: false, error: 'Código vacío' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // GET /api/salas/:codigo?peerId=...&since=...
    if (!subaction && request.method === 'GET') {
      const sala = await readRoomState(codigo);
      if (!sala || Date.now() - (sala.ultimoCambio || sala.creadoEn || 0) > 15 * 60 * 1000) {
        return new Response(JSON.stringify({ ok: false, error: 'Sala no disponible' }), {
          status: 404,
          headers: jsonHeaders,
        });
      }
      const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
      const peerId = (url.searchParams.get('peerId') || '').trim();
      const mensajesNuevos = Array.isArray(sala.mensajes)
        ? sala.mensajes.filter(
            (m) =>
              m &&
              m.seq > since &&
              (!peerId || m.from !== peerId) &&
              (!m.to || m.to === peerId)
          )
        : [];

      return new Response(
        JSON.stringify({
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
        }),
        { headers: jsonHeaders }
      );
    }

    // POST /api/salas/:codigo/join
    if (subaction === 'join' && request.method === 'POST') {
      const sala = await readRoomState(codigo);
      if (!sala) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `La sala ${codigo} no existe o el anfitrión ya la cerró.`,
          }),
          { status: 404, headers: jsonHeaders }
        );
      }

      const body = await request.json().catch(() => ({}));
      const peerId = String(body.peerId || '').trim();
      const nombre = String(body.nombre || 'Invitado').trim() || 'Invitado';
      const color = body.color || '#4dabf7';
      const hat = body.hat || 'pompon';
      const offer = body.offer || null;

      if (!peerId) {
        return new Response(JSON.stringify({ ok: false, error: 'Falta peerId' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      if (!Array.isArray(sala.jugadores)) sala.jugadores = [];
      if (!sala.signals || typeof sala.signals !== 'object') sala.signals = {};

      let existing = sala.jugadores.find((p) => p.peerId === peerId);
      if (!existing && sala.enPartida) {
        // Permitir reconexión por nombre si ya estaba en la partida
        const byName = sala.jugadores.find(
          (p) => !p.esAnfitrion && String(p.nombre || '').toLowerCase() === nombre.toLowerCase()
        );
        if (byName) {
          byName.peerId = peerId;
          byName.conectado = true;
          existing = byName;
        } else {
          return new Response(
            JSON.stringify({ ok: false, error: 'La partida en esta sala ya comenzó.' }),
            { status: 409, headers: jsonHeaders }
          );
        }
      }

      if (existing) {
        existing.nombre = nombre;
        existing.color = color || existing.color;
        existing.hat = hat || existing.hat;
        existing.conectado = true;
      } else {
        if (sala.jugadores.length >= (sala.maxJugadores || 2)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'La sala ya está llena.' }),
            { status: 409, headers: jsonHeaders }
          );
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
      await writeRoomState(codigo, sala);

      if (sala.publica !== false) {
        const pub = await readPublicIndex();
        if (sala.jugadoresConectados >= (sala.maxJugadores || 2)) {
          if (pub[codigo]) {
            delete pub[codigo];
            await writePublicIndex(pub);
          }
        } else if (pub[codigo]) {
          pub[codigo].jugadoresConectados = sala.jugadoresConectados;
          pub[codigo].ultimoCambio = sala.ultimoCambio;
          await writePublicIndex(pub);
        }
      }

      return new Response(JSON.stringify({ ok: true, sala }), { headers: jsonHeaders });
    }

    // POST /api/salas/:codigo/signal
    if (subaction === 'signal' && request.method === 'POST') {
      const sala = await readRoomState(codigo);
      if (!sala) {
        return new Response(JSON.stringify({ ok: false, error: 'Sala no disponible' }), {
          status: 404,
          headers: jsonHeaders,
        });
      }
      const body = await request.json().catch(() => ({}));
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
        await writeRoomState(codigo, sala);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    // POST /api/salas/:codigo/msg
    if (subaction === 'msg' && request.method === 'POST') {
      const sala = await readRoomState(codigo);
      if (!sala) {
        return new Response(JSON.stringify({ ok: false, error: 'Sala no disponible' }), {
          status: 404,
          headers: jsonHeaders,
        });
      }
      const body = await request.json().catch(() => ({}));
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
          if (sala.publica !== false) {
            const pub = await readPublicIndex();
            if (pub[codigo]) {
              delete pub[codigo];
              await writePublicIndex(pub);
            }
          }
        }
        sala.ultimoCambio = Date.now();
        await writeRoomState(codigo, sala);
      }
      return new Response(JSON.stringify({ ok: true, seq: sala.seq || 0 }), {
        headers: jsonHeaders,
      });
    }

    // POST /api/salas/:codigo/leave
    if (subaction === 'leave' && request.method === 'POST') {
      const sala = await readRoomState(codigo, 0);
      if (sala) {
        const body = await request.json().catch(() => ({}));
        const peerId = String(body.peerId || '').trim();
        const nombre = String(body.nombre || 'El otro jugador').trim();
        const jugadorId = typeof body.jugadorId === 'number' ? body.jugadorId : 1;

        if (!sala.enPartida && Array.isArray(sala.jugadores)) {
          sala.jugadores = sala.jugadores.filter((p) => p.esAnfitrion || p.peerId !== peerId);
          sala.jugadores.forEach((p, idx) => {
            p.id = idx;
          });
          sala.jugadoresConectados = sala.jugadores.length;
          if (sala.signals && peerId) {
            delete sala.signals[peerId];
          }
          if (sala.publica !== false) {
            const pub = await readPublicIndex(0);
            if (pub[codigo]) {
              pub[codigo].jugadoresConectados = sala.jugadoresConectados;
              pub[codigo].ultimoCambio = Date.now();
              await writePublicIndex(pub);
            }
          }
        } else if (Array.isArray(sala.jugadores)) {
          const leaving = sala.jugadores.find((p) => p.peerId === peerId || p.id === jugadorId);
          if (leaving) leaving.conectado = false;
        }

        // Registrar siempre mensaje PLAYER_LEFT para avisar de inmediato a rivales por polling o WebRTC
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
        await writeRoomState(codigo, sala);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    if (!subaction && request.method === 'DELETE') {
      await deleteRoomState(codigo);
      const salas = await readPublicIndex(0);
      if (salas[codigo]) {
        delete salas[codigo];
        await writePublicIndex(salas);
      }
      return new Response(JSON.stringify({ ok: true, kvBound }), { headers: jsonHeaders });
    }

    if (!subaction && request.method === 'PATCH') {
      const body = await request.json().catch(() => ({}));
      const now = Date.now();
      const sala = await readRoomState(codigo, 5000);
      const meta = memSalasMeta.get(codigo);
      const elapsedSinceWrite = now - (meta?.writtenAt || 0);
      let stateChanged = false;

      if (sala) {
        if (
          typeof body.jugadoresConectados === 'number' &&
          body.jugadoresConectados !== sala.jugadoresConectados
        ) {
          sala.jugadoresConectados = body.jugadoresConectados;
          stateChanged = true;
        }
        if (typeof body.enPartida === 'boolean' && body.enPartida !== sala.enPartida) {
          sala.enPartida = body.enPartida;
          stateChanged = true;
        }
        sala.ultimoCambio = now;
        memSalas.set(codigo, sala);
        if (stateChanged || elapsedSinceWrite >= 90000) {
          await writeRoomState(codigo, sala);
        }
      }

      if (stateChanged || elapsedSinceWrite >= 90000) {
        const pub = await readPublicIndex(6000);
        if (pub[codigo]) {
          if (sala?.enPartida) {
            delete pub[codigo];
          } else {
            pub[codigo] = {
              ...pub[codigo],
              jugadoresConectados:
                typeof body.jugadoresConectados === 'number'
                  ? body.jugadoresConectados
                  : sala?.jugadoresConectados || pub[codigo].jugadoresConectados || 1,
              ultimoCambio: now,
            };
          }
          await writePublicIndex(pub);
        }
      }
      return new Response(JSON.stringify({ ok: true, kvBound }), { headers: jsonHeaders });
    }
  }

  return new Response(JSON.stringify({ error: 'Ruta API no encontrada' }), {
    status: 404,
    headers: jsonHeaders,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.includes('/api/')) {
      return handleApiRequest(request, env);
    }
    // Si el Worker sirve también assets estáticos (Workers Assets)
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }
    return new Response('Muros Locos API Worker activo', { status: 200 });
  },
};
