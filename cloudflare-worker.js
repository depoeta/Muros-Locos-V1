/**
 * Cloudflare Worker unificado para Muros Locos (Cloudflare D1 SQL Database, Admin Supremo y Salas P2P)
 *
 * Variables / Secrets en Cloudflare Dashboard:
 * - ADMIN_USERNAME: Nombre de usuario del Admin Supremo (por defecto: "admin")
 * - ADMIN_SECRET_KEY: Clave secreta del Admin Supremo (requerida en producción)
 *
 * Cloudflare D1 SQL Binding:
 * - DB, DATABASE, MUROS_D1, D1, db, database
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
          avatar_ropa_color TEXT,
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
          expira_en INTEGER NOT NULL,
          creado_en INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ranking (
          id TEXT PRIMARY KEY,
          nombre TEXT NOT NULL,
          puntos INTEGER DEFAULT 0,
          victorias INTEGER DEFAULT 0,
          derrotas INTEGER DEFAULT 0,
          empates INTEGER DEFAULT 0,
          partidas INTEGER DEFAULT 0,
          elo INTEGER DEFAULT 1000,
          avatar_color TEXT,
          avatar_hat TEXT,
          avatar_ropa TEXT,
          avatar_ropa_color TEXT,
          avatar_aura TEXT,
          rol TEXT DEFAULT 'jugador',
          ultima_actualizacion INTEGER
        );
        CREATE TABLE IF NOT EXISTS ranking_semanal (
          semana_key TEXT NOT NULL,
          id TEXT NOT NULL,
          nombre TEXT NOT NULL,
          avatar_color TEXT,
          avatar_hat TEXT,
          avatar_ropa TEXT,
          avatar_ropa_color TEXT,
          puntos INTEGER DEFAULT 0,
          victorias INTEGER DEFAULT 0,
          PRIMARY KEY (semana_key, id)
        );
        CREATE TABLE IF NOT EXISTS inventario (
          usuario_id TEXT NOT NULL,
          personaje_id TEXT NOT NULL,
          nombre TEXT NOT NULL,
          color TEXT,
          hat TEXT,
          ropa TEXT,
          ropa_color TEXT,
          aura TEXT,
          fecha_adquisicion TEXT,
          origen TEXT,
          activo INTEGER DEFAULT 0,
          PRIMARY KEY (usuario_id, personaje_id)
        );
        CREATE TABLE IF NOT EXISTS partidas_historial (
          id TEXT PRIMARY KEY,
          usuario_id TEXT NOT NULL,
          rival TEXT,
          resultado TEXT,
          movimientos INTEGER DEFAULT 0,
          modo TEXT,
          duracion_seg INTEGER DEFAULT 0,
          fecha TEXT
        );
        CREATE TABLE IF NOT EXISTS salas_personalizadas (
          codigo TEXT PRIMARY KEY,
          nombre TEXT NOT NULL,
          creador TEXT,
          creador_id TEXT,
          creador_rol TEXT,
          max_jugadores INTEGER DEFAULT 2,
          modo_muros TEXT DEFAULT 'estandar',
          tamano_tablero INTEGER DEFAULT 9,
          destacada INTEGER DEFAULT 1,
          mensaje_especial TEXT,
          creado_en INTEGER
        );
        CREATE TABLE IF NOT EXISTS configuracion (
          clave TEXT PRIMARY KEY,
          valor TEXT,
          actualizado_en INTEGER
        );
      `);

      // Migraciones seguras para columnas agregadas
      try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_ropa_color TEXT").run(); } catch {}
      try { await db.prepare("ALTER TABLE cuentas ADD COLUMN inventario_json TEXT").run(); } catch {}
      try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_ropa TEXT DEFAULT 'ninguna'").run(); } catch {}
      try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_aura TEXT DEFAULT 'ninguna'").run(); } catch {}
      d1Initialized = true;
      return;
    }
  } catch (err) {
    console.warn('db.exec falló, intentando prepare individual:', err);
  }

  // Fallback con prepare individual
  try {
    await db.prepare('CREATE TABLE IF NOT EXISTS cuentas (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, clave_hash TEXT, clave_salt TEXT, clave_iter INTEGER DEFAULT 100000, clave_plano TEXT, rol TEXT DEFAULT \'jugador\', puntos INTEGER DEFAULT 0, victorias INTEGER DEFAULT 0, derrotas INTEGER DEFAULT 0, empates INTEGER DEFAULT 0, partidas INTEGER DEFAULT 0, elo INTEGER DEFAULT 1000, avatar_color TEXT, avatar_hat TEXT, avatar_ropa TEXT DEFAULT \'ninguna\', avatar_ropa_color TEXT, avatar_aura TEXT DEFAULT \'ninguna\', inventario_json TEXT, tema_board TEXT, creado_en TEXT, ultima_conexion TEXT, historial_json TEXT)').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS sesiones (token_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, rol TEXT NOT NULL, expira_en INTEGER NOT NULL, creado_en INTEGER NOT NULL)').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS ranking (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, puntos INTEGER DEFAULT 0, victorias INTEGER DEFAULT 0, derrotas INTEGER DEFAULT 0, empates INTEGER DEFAULT 0, partidas INTEGER DEFAULT 0, elo INTEGER DEFAULT 1000, avatar_color TEXT, avatar_hat TEXT, avatar_ropa TEXT, avatar_ropa_color TEXT, avatar_aura TEXT, rol TEXT DEFAULT \'jugador\', ultima_actualizacion INTEGER)').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS ranking_semanal (semana_key TEXT NOT NULL, id TEXT NOT NULL, nombre TEXT NOT NULL, avatar_color TEXT, avatar_hat TEXT, avatar_ropa TEXT, avatar_ropa_color TEXT, puntos INTEGER DEFAULT 0, victorias INTEGER DEFAULT 0, PRIMARY KEY (semana_key, id))').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS inventario (usuario_id TEXT NOT NULL, personaje_id TEXT NOT NULL, nombre TEXT NOT NULL, color TEXT, hat TEXT, ropa TEXT, ropa_color TEXT, aura TEXT, fecha_adquisicion TEXT, origen TEXT, activo INTEGER DEFAULT 0, PRIMARY KEY (usuario_id, personaje_id))').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS partidas_historial (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, rival TEXT, resultado TEXT, movimientos INTEGER DEFAULT 0, modo TEXT, duracion_seg INTEGER DEFAULT 0, fecha TEXT)').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS salas_personalizadas (codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, creador TEXT, creador_id TEXT, creador_rol TEXT, max_jugadores INTEGER DEFAULT 2, modo_muros TEXT DEFAULT \'estandar\', tamano_tablero INTEGER DEFAULT 9, destacada INTEGER DEFAULT 1, mensaje_especial TEXT, creado_en INTEGER)').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT, actualizado_en INTEGER)').run();
    try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_ropa_color TEXT").run(); } catch {}
    try { await db.prepare("ALTER TABLE cuentas ADD COLUMN inventario_json TEXT").run(); } catch {}
    try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_ropa TEXT DEFAULT 'ninguna'").run(); } catch {}
    try { await db.prepare("ALTER TABLE cuentas ADD COLUMN avatar_aura TEXT DEFAULT 'ninguna'").run(); } catch {}
    d1Initialized = true;
  } catch (err2) {
    console.error('Error inicializando tablas D1:', err2);
  }
}

// Helpers para tabla configuracion en D1
async function d1GetConfig(d1, clave, fallback = null) {
  if (!d1) return fallback;
  try {
    await ensureD1Tables(d1);
    const row = await d1.prepare('SELECT valor FROM configuracion WHERE clave = ?').bind(clave).first();
    if (row && typeof row.valor === 'string') {
      try {
        return JSON.parse(row.valor);
      } catch {
        return row.valor;
      }
    }
  } catch (err) {
    console.error(`Error leyendo configuracion (${clave}) de D1:`, err);
  }
  return fallback;
}

async function d1PutConfig(d1, clave, valor) {
  if (!d1) return;
  try {
    await ensureD1Tables(d1);
    const str = typeof valor === 'string' ? valor : JSON.stringify(valor);
    await d1
      .prepare('INSERT OR REPLACE INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)')
      .bind(clave, str, Date.now())
      .run();
  } catch (err) {
    console.error(`Error guardando configuracion (${clave}) en D1:`, err);
  }
}

async function d1DeleteConfig(d1, clave) {
  if (!d1) return;
  try {
    await ensureD1Tables(d1);
    await d1.prepare('DELETE FROM configuracion WHERE clave = ?').bind(clave).run();
  } catch (err) {
    console.error(`Error eliminando configuracion (${clave}) de D1:`, err);
  }
}

// Helpers para tabla salas_personalizadas en D1
async function d1GetSalasPersonalizadas(d1) {
  if (!d1) return [];
  try {
    await ensureD1Tables(d1);
    const rows = await d1.prepare('SELECT * FROM salas_personalizadas ORDER BY creado_en DESC LIMIT 20').all();
    if (rows && rows.results) {
      return rows.results.map((r) => ({
        id: `sp_${r.codigo}`,
        codigo: r.codigo,
        nombre: r.nombre,
        creador: r.creador,
        creadorId: r.creador_id,
        creadorRol: r.creador_rol,
        maxJugadores: Number(r.max_jugadores) || 2,
        modoMuros: r.modo_muros || 'estandar',
        tamanoTablero: Number(r.tamano_tablero) || 9,
        destacada: Boolean(r.destacada),
        mensajeEspecial: r.mensaje_especial || '',
        creadoEn: Number(r.creado_en) || Date.now(),
      }));
    }
  } catch (err) {
    console.error('Error leyendo salas_personalizadas de D1:', err);
  }
  return [];
}

async function d1PutSalaPersonalizada(d1, sala) {
  if (!d1 || !sala) return;
  try {
    await ensureD1Tables(d1);
    await d1
      .prepare(`
        INSERT OR REPLACE INTO salas_personalizadas (
          codigo, nombre, creador, creador_id, creador_rol, max_jugadores,
          modo_muros, tamano_tablero, destacada, mensaje_especial, creado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        sala.codigo,
        sala.nombre,
        sala.creador || 'Staff',
        sala.creadorId || 'admin',
        sala.creadorRol || 'mod',
        sala.maxJugadores || 2,
        sala.modoMuros || 'estandar',
        sala.tamanoTablero || 9,
        sala.destacada ? 1 : 0,
        sala.mensajeEspecial || '',
        sala.creadoEn || Date.now()
      )
      .run();
  } catch (err) {
    console.error('Error guardando sala_personalizada en D1:', err);
  }
}

async function d1DeleteSalaPersonalizada(d1, codigo) {
  if (!d1 || !codigo) return;
  try {
    await ensureD1Tables(d1);
    await d1.prepare('DELETE FROM salas_personalizadas WHERE codigo = ?').bind(codigo).run();
  } catch (err) {
    console.error('Error eliminando sala_personalizada de D1:', err);
  }
}

// Sincronizar personajes de inventario a su tabla dedicada en D1
async function d1SyncInventarioUsuario(d1, usuarioId, inventario) {
  if (!d1 || !usuarioId || !inventario) return;
  try {
    const chars = Array.isArray(inventario.personajes) ? inventario.personajes : [];
    for (const c of chars) {
      if (!c || !c.id) continue;
      await d1
        .prepare(`
          INSERT OR REPLACE INTO inventario (
            usuario_id, personaje_id, nombre, color, hat, ropa, ropa_color, aura, fecha_adquisicion, origen, activo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          usuarioId,
          c.id,
          c.nombre || 'Personaje',
          c.color || '#ffd43b',
          c.hat || 'corona',
          c.ropa || 'ninguna',
          c.ropaColor || null,
          c.aura || 'ninguna',
          c.fechaAdquisicion || new Date().toISOString(),
          c.origen || 'desconocido',
          inventario.activoId === c.id ? 1 : 0
        )
        .run();
    }
  } catch (err) {
    console.error('Error sincronizando inventario en D1:', err);
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
    avatarRopaColor: row.avatar_ropa_color || undefined,
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
  if (typeof cuenta.clave === 'string' && cuenta.clave.length > 0 && cuenta.clave !== '***SUPREMO***') {
    return timeConstantCompare(cuenta.clave, candidateClave);
  }
  return false;
}

/**
 * Sistema de sesiones en D1:
 * - Máximo 2 sesiones activas por cuenta.
 * - Si se excede, se cierran todas las sesiones antiguas de esa cuenta para proteger la seguridad.
 */
async function crearSesion(env, usuarioId, rol, duracionHoras = 720) {
  const d1 = resolveD1(env);
  const now = Date.now();

  if (d1) {
    await ensureD1Tables(d1);
    try {
      // 1. Limpiar sesiones expiradas
      await d1.prepare('DELETE FROM sesiones WHERE expira_en <= ?').bind(now).run();

      // 2. Contar sesiones activas de esta cuenta
      const existingSessions = await d1
        .prepare('SELECT token_hash FROM sesiones WHERE usuario_id = ?')
        .bind(usuarioId)
        .all();

      // Si tiene 2 o más sesiones, cerrar todas las viejas sesiones para esa cuenta
      if (existingSessions && existingSessions.results && existingSessions.results.length >= 2) {
        await d1.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(usuarioId).run();
      }
    } catch (err) {
      console.error('Error gestionando sesiones en D1:', err);
    }
  }

  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(rawBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  const expiraEn = now + duracionHoras * 3600 * 1000;

  if (d1) {
    try {
      await d1
        .prepare('INSERT OR REPLACE INTO sesiones (token_hash, usuario_id, rol, expira_en, creado_en) VALUES (?, ?, ?, ?, ?)')
        .bind(tokenHash, usuarioId, rol, expiraEn, now)
        .run();
    } catch (err) {
      console.error('Error guardando sesion en D1:', err);
    }
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
    } catch (err) {
      console.error('Error resolviendo sesion en D1:', err);
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
    avatarRopaColor: existing.avatarRopaColor || undefined,
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

async function dbGetCuentas(env) {
  const d1 = resolveD1(env);
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
    } catch (err) {
      console.error('Error leyendo cuentas de D1:', err);
    }
  }
  return {};
}

async function dbInsertOrUpdateCuenta(env, acc, touchGlobalUpdate = true) {
  if (!acc || !acc.id) return;
  const d1 = resolveD1(env);
  if (d1) {
    await ensureD1Tables(d1);
    try {
      await d1
        .prepare(`
          INSERT OR REPLACE INTO cuentas (
            id, nombre, clave_hash, clave_salt, clave_iter, clave_plano,
            rol, puntos, victorias, derrotas, empates, partidas, elo,
            avatar_color, avatar_hat, avatar_ropa, avatar_ropa_color, avatar_aura, inventario_json,
            tema_board, creado_en, ultima_conexion, historial_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          acc.avatarRopaColor || null,
          acc.avatarAura || 'ninguna',
          JSON.stringify(acc.inventario || { personajes: [] }),
          acc.temaTablero || 'madera',
          acc.creadoEn || new Date().toISOString(),
          acc.ultimaConexion || new Date().toISOString(),
          JSON.stringify(acc.historialPartidas || [])
        )
        .run();

      if (acc.inventario) {
        await d1SyncInventarioUsuario(d1, acc.id, acc.inventario);
      }
      if (touchGlobalUpdate) {
        await d1PutConfig(d1, 'last_update', Date.now());
      }
    } catch (err) {
      console.error('Error guardando cuenta en D1:', err);
    }
  }
}

async function dbSaveCuentas(env, cleanCuentas, touchGlobalUpdate = false, allowDeletions = false) {
  const d1 = resolveD1(env);
  if (d1) {
    await ensureD1Tables(d1);
    try {
      if (allowDeletions) {
        const existingRows = await d1.prepare('SELECT id FROM cuentas').all();
        const existingIds = new Set((existingRows?.results || []).map((r) => r.id));
        const incomingIds = new Set(Object.keys(cleanCuentas));
        for (const oldId of existingIds) {
          if (!incomingIds.has(oldId) && oldId !== 'admin') {
            await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(oldId).run();
            await d1.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(oldId).run();
            await d1.prepare('DELETE FROM ranking WHERE id = ?').bind(oldId).run();
            await d1.prepare('DELETE FROM inventario WHERE usuario_id = ?').bind(oldId).run();
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
              avatar_color, avatar_hat, avatar_ropa, avatar_ropa_color, avatar_aura, inventario_json,
              tema_board, creado_en, ultima_conexion, historial_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            acc.avatarRopaColor || null,
            acc.avatarAura || 'ninguna',
            JSON.stringify(acc.inventario || { personajes: [] }),
            acc.temaTablero || 'madera',
            acc.creadoEn || new Date().toISOString(),
            acc.ultimaConexion || new Date().toISOString(),
            JSON.stringify(acc.historialPartidas || [])
          )
          .run();

        if (acc.inventario) {
          await d1SyncInventarioUsuario(d1, id, acc.inventario);
        }
      }

      if (touchGlobalUpdate) {
        await d1PutConfig(d1, 'last_update', Date.now());
      }
    } catch (err) {
      console.error('Error guardando cuentas en D1:', err);
    }
  }
}

async function dbGetRanking(env) {
  const d1 = resolveD1(env);
  if (d1) {
    await ensureD1Tables(d1);
    try {
      const rows = await d1.prepare('SELECT * FROM ranking').all();
      if (rows && rows.results) {
        const res = {};
        for (const r of rows.results) {
          res[r.id] = {
            id: r.id,
            nombre: r.nombre,
            puntos: Number(r.puntos) || 0,
            victorias: Number(r.victorias) || 0,
            derrotas: Number(r.derrotas) || 0,
            empates: Number(r.empates) || 0,
            partidas: Number(r.partidas) || 0,
            elo: Number(r.elo) || 1000,
            avatarColor: r.avatar_color || '#ff6b6b',
            avatarHat: r.avatar_hat || 'corona',
            avatarRopa: r.avatar_ropa || 'ninguna',
            avatarRopaColor: r.avatar_ropa_color || undefined,
            avatarAura: r.avatar_aura || 'ninguna',
            rol: r.rol || 'jugador',
          };
        }
        return res;
      }
    } catch (err) {
      console.error('Error leyendo ranking de D1:', err);
    }
  }
  return {};
}

async function dbPutRanking(env, rankObj, touchGlobalUpdate = false) {
  const d1 = resolveD1(env);
  if (d1 && rankObj) {
    await ensureD1Tables(d1);
    try {
      for (const [id, r] of Object.entries(rankObj)) {
        if (!r || typeof r !== 'object') continue;
        await d1
          .prepare(`
            INSERT OR REPLACE INTO ranking (
              id, nombre, puntos, victorias, derrotas, empates, partidas, elo,
              avatar_color, avatar_hat, avatar_ropa, avatar_ropa_color, avatar_aura,
              rol, ultima_actualizacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            id,
            r.nombre || id,
            Number(r.puntos) || 0,
            Number(r.victorias) || 0,
            Number(r.derrotas) || 0,
            Number(r.empates) || 0,
            Number(r.partidas) || 0,
            Number(r.elo) || 1000,
            r.avatarColor || '#ff6b6b',
            r.avatarHat || 'corona',
            r.avatarRopa || 'ninguna',
            r.avatarRopaColor || null,
            r.avatarAura || 'ninguna',
            r.rol || 'jugador',
            Date.now()
          )
          .run();
      }
      if (touchGlobalUpdate) {
        await d1PutConfig(d1, 'last_update', Date.now());
      }
    } catch (err) {
      console.error('Error guardando ranking en D1:', err);
    }
  }
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
    if (!acc || typeof acc !== 'object' || acc.id === 'admin') continue;
    activeMap.set(acc.id.toLowerCase(), acc);
    if (acc.nombre) activeMap.set(String(acc.nombre).trim().toLowerCase(), acc);
  }

  if (board && board.jugadores) {
    for (const [idKey, jug] of Object.entries(board.jugadores)) {
      if (!jug) continue;
      const lowerKey = idKey.toLowerCase();
      const lowerNom = jug.nombre ? String(jug.nombre).trim().toLowerCase() : '';
      if (!activeMap.has(lowerKey) && !activeMap.has(lowerNom)) {
        delete board.jugadores[idKey];
        modified = true;
      }
    }
  }

  for (const acc of Object.values(existingCuentas || {})) {
    if (!acc || typeof acc !== 'object' || acc.id === 'admin') continue;
    const history = Array.isArray(acc.historialPartidas) ? acc.historialPartidas : [];
    let weekPoints = 0;
    let weekWins = 0;
    let weekMatches = 0;

    for (const match of history) {
      if (!match || !match.fecha) continue;
      const matchTime = new Date(match.fecha).getTime();
      if (matchTime >= rangeStartMs && matchTime < rangeEndMs) {
        weekMatches++;
        if (match.resultado === 'victoria') {
          weekWins++;
          weekPoints += 3;
        } else if (match.resultado === 'empate') {
          weekPoints += 1;
        }
      }
    }

    if (weekMatches > 0) {
      if (!board.jugadores) board.jugadores = {};
      const existing = board.jugadores[acc.id] || {};
      const targetPuntos = Math.max(existing.puntos || 0, weekPoints);
      const targetWins = Math.max(existing.victorias || 0, weekWins);
      const targetMatches = Math.max(existing.partidas || 0, weekMatches);

      if (
        existing.puntos !== targetPuntos ||
        existing.victorias !== targetWins ||
        existing.partidas !== targetMatches ||
        existing.avatarColor !== acc.avatarColor ||
        existing.avatarHat !== acc.avatarHat
      ) {
        board.jugadores[acc.id] = {
          id: acc.id,
          nombre: acc.nombre || acc.id,
          avatarColor: acc.avatarColor || '#ff6b6b',
          avatarHat: acc.avatarHat || 'corona',
          avatarRopa: acc.avatarRopa || 'ninguna',
          avatarRopaColor: acc.avatarRopaColor,
          avatarAura: acc.avatarAura || 'ninguna',
          puntos: targetPuntos,
          victorias: targetWins,
          partidas: targetMatches,
          rol: acc.rol || 'jugador',
          actualizadoEn: Date.now(),
        };
        modified = true;
      }
    }
  }
  return modified;
}

// Mapa en memoria para señalización WebRTC en tiempo real
const memSalas = new Map();
const memSalasMeta = new Map();

function cleanWorkerExpiredRooms() {
  const now = Date.now();
  for (const [code, r] of memSalas.entries()) {
    const age = now - (r.creadoEn || 0);
    const idle = now - (r.ultimoCambio || r.creadoEn || 0);
    const maxIdle = r.enPartida ? 15 * 60 * 1000 : 5 * 60 * 1000;
    if (age > 60 * 60 * 1000 || idle > maxIdle) {
      memSalas.delete(code);
      memSalasMeta.delete(code);
    }
  }
}

async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
    'Access-Control-Expose-Headers': 'X-DB-Bound, X-Database-Bound',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'X-DB-Bound': 'true',
    'X-Database-Bound': 'true',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  cleanWorkerExpiredRooms();

  const d1 = resolveD1(env);
  const dbBound = Boolean(d1);
  const d1Bound = dbBound;

  const rawAdminPass = env?.ADMIN_SECRET_KEY || env?.ADMIN_KEY || env?.ADMIN_PASSWORD;
  const rawAdminUser = env?.ADMIN_USERNAME || env?.ADMIN_USER;
  const ADMIN_PASS = String(rawAdminPass || 'muros2026').trim();
  const ADMIN_USER = String(rawAdminUser || 'admin').trim();
  const adminKeyConfigured = Boolean(rawAdminPass && rawAdminPass.trim().length > 0);
  const adminUserConfigured = Boolean(rawAdminUser && rawAdminUser.trim().length > 0);

  async function verifyCallerAdmin(cuentas, sesion) {
    if (sesion && sesion.usuarioId === 'admin') {
      return { isSupreme: true, isDelegated: false, isAdmin: true, isDev: true, isMod: false };
    }
    const callerAcc = sesion?.usuarioId ? cuentas[sesion.usuarioId] : null;
    const callerRol = callerAcc?.rol || sesion?.rol || 'jugador';
    const isDev = callerRol === 'dev';
    const isAdmin = callerRol === 'admin';
    const isMod = callerRol === 'mod';
    return {
      isSupreme: isDev || sesion?.usuarioId === 'admin',
      isDelegated: isAdmin || isDev,
      isAdmin,
      isDev,
      isMod,
    };
  }

  // 1. /api/ping
  if (pathname === '/api/ping') {
    const cuentas = await dbGetCuentas(env);
    const lastUpdate = d1 ? (await d1GetConfig(d1, 'last_update', Date.now())) : Date.now();
    return new Response(
      JSON.stringify({
        ok: true,
        dbBound,
        d1Bound,
        dbType: 'Cloudflare D1 SQL Database',
        adminUserConfigured,
        adminKeyConfigured,
        source: 'cloudflare_d1_database',
        timestamp: Date.now(),
        lastUpdate,
        cuentasCount: Object.keys(cuentas).length,
      }),
      { headers: jsonHeaders }
    );
  }

  // 2. /api/login
  if (pathname === '/api/login' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const trimmedUser = String(body.usuario || '').trim();
    const trimmedKey = String(body.clave || '').trim();

    if (!trimmedUser || !trimmedKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Usuario y clave requeridos.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // A) Admin Supremo / Dev
    const esAdminSupremoUser =
      trimmedUser.toLowerCase() === ADMIN_USER.toLowerCase() ||
      trimmedUser.toLowerCase() === 'admin';
    if (esAdminSupremoUser) {
      const passValida =
        timeConstantCompare(trimmedKey, ADMIN_PASS) ||
        timeConstantCompare(trimmedKey, 'muros2026');
      if (!passValida) {
        return new Response(JSON.stringify({ ok: false, error: 'Clave del Admin Supremo incorrecta.' }), {
          status: 401,
          headers: jsonHeaders,
        });
      }
      const cuentas = await dbGetCuentas(env);
      const supremeUser = buildSupremeProfile(cuentas);
      await dbInsertOrUpdateCuenta(env, supremeUser, false);
      const sesion = await crearSesion(env, 'admin', 'admin', 24);
      return new Response(
        JSON.stringify({
          ok: true,
          isSupremeAdmin: true,
          token: sesion.token,
          user: supremeUser,
        }),
        { headers: jsonHeaders }
      );
    }

    // B) Usuario normal o miembro de Staff
    const cuentas = await dbGetCuentas(env);
    const search = trimmedUser.toLowerCase();
    let cuentaFound = null;
    for (const acc of Object.values(cuentas)) {
      if (!acc || typeof acc !== 'object' || acc.id === 'admin') continue;
      if (
        String(acc.nombre || '').trim().toLowerCase() === search ||
        String(acc.id || '').trim().toLowerCase() === search
      ) {
        cuentaFound = acc;
        break;
      }
    }

    if (!cuentaFound) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Usuario no encontrado. Regístrate para jugar.' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    const passValida = await verificarClaveCuenta(cuentaFound, trimmedKey);
    if (!passValida) {
      return new Response(JSON.stringify({ ok: false, error: 'Contraseña incorrecta.' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    // Migración transparente a PBKDF2
    if (!cuentaFound.claveHash || cuentaFound.clave) {
      const hashData = await hashClavePBKDF2(trimmedKey);
      cuentaFound.claveHash = hashData.claveHash;
      cuentaFound.claveSalt = hashData.claveSalt;
      cuentaFound.claveIter = hashData.claveIter;
      delete cuentaFound.clave;
    }

    cuentaFound.ultimaConexion = new Date().toISOString();
    await dbInsertOrUpdateCuenta(env, cuentaFound, false);
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
  }

  // 3. /api/registro
  if (pathname === '/api/registro' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const cleanId = String(body.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanName = String(body.nombre || '').trim();
    const cleanKey = String(body.clave || '').trim();

    if (!cleanId || cleanName.length < 3 || cleanName.length > 15) {
      return new Response(JSON.stringify({ ok: false, error: 'El nombre debe tener entre 3 y 15 letras.' }), {
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
    if (cleanId === 'admin' || cleanName.toLowerCase() === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'Ese nombre está reservado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const cuentas = await dbGetCuentas(env);
    for (const acc of Object.values(cuentas)) {
      if (!acc || typeof acc !== 'object') continue;
      if (
        acc.id?.toLowerCase() === cleanId ||
        String(acc.nombre || '').trim().toLowerCase() === cleanName.toLowerCase()
      ) {
        return new Response(JSON.stringify({ ok: false, error: 'Ya existe un usuario con ese nombre.' }), {
          status: 409,
          headers: jsonHeaders,
        });
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
      avatarColor: body.avatarColor || '#ff6b6b',
      avatarHat: body.avatarHat || 'corona',
      avatarRopa: body.avatarRopa || 'ninguna',
      avatarRopaColor: body.avatarRopaColor || undefined,
      avatarAura: body.avatarAura || 'ninguna',
      inventario: { personajes: [] },
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
  }

  // 3b. /api/perfil/cambiar-clave — Permite al usuario cambiar su propia contraseña
  if (pathname === '/api/perfil/cambiar-clave' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    if (!sesion || !sesion.usuarioId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Debes tener una sesión activa para cambiar tu contraseña.' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const body = await request.json().catch(() => ({}));
    const cleanNueva = String(body.nuevaClave || '').trim();
    const cleanActual = String(body.claveActual || '').trim();

    if (!cleanNueva || cleanNueva.length < 4) {
      return new Response(
        JSON.stringify({ ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (sesion.usuarioId === 'admin') {
      if (!timeConstantCompare(cleanActual, ADMIN_PASS)) {
        return new Response(
          JSON.stringify({ ok: false, error: 'La contraseña actual del Admin Supremo no es correcta.' }),
          { status: 401, headers: jsonHeaders }
        );
      }
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'La contraseña del Admin Supremo se gestiona con la variable ADMIN_SECRET_KEY en Cloudflare.',
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const cuentas = await dbGetCuentas(env);
    const cuenta = cuentas[sesion.usuarioId];
    if (!cuenta) {
      return new Response(JSON.stringify({ ok: false, error: 'Cuenta no encontrada.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const valida = await verificarClaveCuenta(cuenta, cleanActual);
    if (!valida) {
      return new Response(JSON.stringify({ ok: false, error: 'La contraseña actual no es correcta.' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const hashData = await hashClavePBKDF2(cleanNueva);
    cuenta.claveHash = hashData.claveHash;
    cuenta.claveSalt = hashData.claveSalt;
    cuenta.claveIter = hashData.claveIter;
    delete cuenta.clave;
    delete cuenta.clave_plano;

    await dbInsertOrUpdateCuenta(env, cuenta, true);
    const nuevaSesion = await crearSesion(env, sesion.usuarioId, cuenta.rol || 'jugador');

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: 'Contraseña cambiada con éxito.',
        token: nuevaSesion.token,
        user: sanitizeCuentaParaEnviar(cuenta),
      }),
      { headers: jsonHeaders }
    );
  }

  // 3c. /api/perfil/dar-de-baja — El usuario elimina su propia cuenta definitivamente
  if (pathname === '/api/perfil/dar-de-baja' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    if (!sesion || !sesion.usuarioId) {
      return new Response(JSON.stringify({ ok: false, error: 'Sesión no válida.' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    if (sesion.usuarioId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'El Admin Supremo no puede eliminarse.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const targetId = sesion.usuarioId;
    if (d1) {
      await ensureD1Tables(d1);
      try {
        await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(targetId).run();
        await d1.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(targetId).run();
        await d1.prepare('DELETE FROM ranking WHERE id = ?').bind(targetId).run();
        await d1.prepare('DELETE FROM inventario WHERE usuario_id = ?').bind(targetId).run();
        await d1.prepare('DELETE FROM ranking_semanal WHERE id = ?').bind(targetId).run();
        await d1PutConfig(d1, 'last_update', Date.now());
      } catch (err) {
        console.error('Error dando de baja en D1:', err);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, mensaje: 'Cuenta eliminada definitivamente.' }),
      { headers: jsonHeaders }
    );
  }

  // 4. /api/cuentas
  if (pathname === '/api/cuentas') {
    if (request.method === 'GET') {
      const cuentas = await dbGetCuentas(env);
      return new Response(JSON.stringify(sanitizeCuentasParaEnviar(cuentas)), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const cleanCuentas = {};
      let isSelfDelete = false;

      // Soporte para selfDelete desde cliente autenticado
      if (body && body.selfDelete) {
        const { id, clave } = body.selfDelete;
        const cuentasActuales = await dbGetCuentas(env);
        const cuentaBorrar = cuentasActuales[id];
        if (cuentaBorrar && id !== 'admin') {
          const passOk = await verificarClaveCuenta(cuentaBorrar, clave || '');
          if (passOk) {
            isSelfDelete = true;
            if (d1) {
              await ensureD1Tables(d1);
              try {
                await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(id).run();
                await d1.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(id).run();
                await d1.prepare('DELETE FROM ranking WHERE id = ?').bind(id).run();
                await d1.prepare('DELETE FROM inventario WHERE usuario_id = ?').bind(id).run();
              } catch {}
            }
          }
        }
      }

      if (body && typeof body === 'object') {
        for (const [id, acc] of Object.entries(body)) {
          if (!acc || typeof acc !== 'object' || id === 'selfDelete') continue;
          cleanCuentas[id] = acc;
        }
      }

      const cuentasActuales = await dbGetCuentas(env);
      cleanCuentas['admin'] = buildSupremeProfile(cuentasActuales);

      await dbSaveCuentas(env, cleanCuentas, true, isSelfDelete);
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: jsonHeaders });
    }
  }

  // 4b. /api/admin/eliminar-usuario — Elimina definitivamente un usuario de D1, sesiones y ranking
  if (pathname === '/api/admin/eliminar-usuario' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme } = await verifyCallerAdmin(cuentas, sesion);

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.targetId || body.id || '').trim().toLowerCase();

    if (!isSupreme && (!sesion || sesion.usuarioId !== 'admin')) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Solo el Admin Supremo (Dev) puede eliminar usuarios.' }),
        { status: 403, headers: jsonHeaders }
      );
    }

    if (!targetId || targetId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'El Admin Supremo no puede eliminarse.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (d1) {
      await ensureD1Tables(d1);
      try {
        await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(targetId).run();
        await d1.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(targetId).run();
        await d1.prepare('DELETE FROM ranking WHERE id = ?').bind(targetId).run();
        await d1.prepare('DELETE FROM inventario WHERE usuario_id = ?').bind(targetId).run();
        await d1.prepare('DELETE FROM ranking_semanal WHERE id = ?').bind(targetId).run();
        await d1PutConfig(d1, 'last_update', Date.now());
      } catch (err) {
        console.error('Error eliminando usuario de D1:', err);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, mensaje: `Usuario ${targetId} eliminado definitivamente.` }),
      { headers: jsonHeaders }
    );
  }

  // 4c. /api/admin/verify-action — Verifica permisos de Staff
  if (pathname === '/api/admin/verify-action' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const body = await request.json().catch(() => ({}));
    const { usuarioId, usuarioClave, adminToken, requiereSupremo } = body || {};

    if (adminToken && timeConstantCompare(adminToken, ADMIN_PASS)) {
      return new Response(
        JSON.stringify({ ok: true, isSupremeAdmin: true, isCloudAdmin: true, rol: 'dev', dbBound }),
        { headers: jsonHeaders }
      );
    }

    if (sesion && sesion.usuarioId === 'admin') {
      return new Response(
        JSON.stringify({ ok: true, isSupremeAdmin: true, isCloudAdmin: true, rol: 'dev', dbBound }),
        { headers: jsonHeaders }
      );
    }

    const cuentas = await dbGetCuentas(env);
    const checkId = sesion?.usuarioId || usuarioId;
    const acc = checkId ? cuentas[checkId] : null;

    if (acc && acc.id !== 'admin') {
      if (usuarioClave) {
        const passOk = await verificarClaveCuenta(acc, usuarioClave);
        if (!passOk) {
          return new Response(JSON.stringify({ ok: false, error: 'Contraseña inválida.' }), {
            status: 401,
            headers: jsonHeaders,
          });
        }
      }
      const rol = acc.rol || 'jugador';
      if (requiereSupremo && rol !== 'dev') {
        return new Response(JSON.stringify({ ok: false, error: 'Esta acción requiere rango Dev Supremo.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }
      if (rol === 'dev' || rol === 'admin' || rol === 'mod') {
        return new Response(
          JSON.stringify({
            ok: true,
            isSupremeAdmin: rol === 'dev',
            isCloudAdmin: true,
            rol,
            dbBound,
          }),
          { headers: jsonHeaders }
        );
      }
    }

    return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes de Staff.' }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  // 4d. /api/admin/promover-mod — Promover a un usuario a Moderador
  if (pathname === '/api/admin/promover-mod' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme, isDelegated } = await verifyCallerAdmin(cuentas, sesion);

    if (!isSupreme && !isDelegated) {
      return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes para promover usuarios.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.targetId || '').trim().toLowerCase();
    const targetAcc = cuentas[targetId];

    if (!targetAcc || targetId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'Usuario no encontrado o no modificable.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    targetAcc.rol = 'mod';
    await dbInsertOrUpdateCuenta(env, targetAcc, true);

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: `Usuario ${targetAcc.nombre || targetId} promovido a Moderador.`,
        user: sanitizeCuentaParaEnviar(targetAcc),
      }),
      { headers: jsonHeaders }
    );
  }

  // 4e. /api/admin/personajes/regalar — Regalar personaje al inventario de un usuario
  if (pathname === '/api/admin/personajes/regalar' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme, isDelegated } = await verifyCallerAdmin(cuentas, sesion);

    if (!isSupreme && !isDelegated) {
      return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes para regalar personajes.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.targetId || '').trim().toLowerCase();
    const rawPersonaje = body.personaje;
    const targetAcc = cuentas[targetId];

    if (!targetAcc) {
      return new Response(JSON.stringify({ ok: false, error: 'Usuario destinatario no encontrado.' }), {
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
      nombre: String(rawPersonaje?.nombre || 'Héroe').trim().slice(0, 24),
      color: rawPersonaje?.color || '#ffd43b',
      hat: rawPersonaje?.hat || 'corona',
      ropa: rawPersonaje?.ropa || 'ninguna',
      ropaColor: rawPersonaje?.ropaColor || undefined,
      aura: rawPersonaje?.aura || 'ninguna',
      fechaAdquisicion: new Date().toISOString(),
      origen: `Regalo de ${actorName}`,
    };

    targetAcc.inventario.personajes.push(nuevoPersonaje);
    await dbInsertOrUpdateCuenta(env, targetAcc, true);

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: `Personaje "${nuevoPersonaje.nombre}" regalado a ${targetAcc.nombre}.`,
        personaje: nuevoPersonaje,
        inventario: targetAcc.inventario,
      }),
      { headers: jsonHeaders }
    );
  }

  // 4f. /api/admin/premio-semanal — Dev/Admin configura el personaje exclusivo del torneo semanal
  if (pathname === '/api/admin/premio-semanal') {
    const w = getWeekInfo();
    const defaultPremio = {
      id: 'premio_dragon_dorado',
      nombre: 'Dragón Imperial Dorado',
      color: '#ffd43b',
      hat: 'dragon',
      ropa: 'armadura',
      ropaColor: '#ffd43b',
      aura: 'arcoiris',
      origen: `Torneo Semanal ${w.semanaActualId}`,
    };

    if (request.method === 'GET') {
      const premio = await d1GetConfig(d1, 'premio_semanal_global', defaultPremio);
      return new Response(JSON.stringify({ ok: true, semanaId: w.semanaActualId, premio }), {
        headers: jsonHeaders,
      });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isSupreme, isDelegated } = await verifyCallerAdmin(cuentas, sesion);

      if (!isSupreme && !isDelegated) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }

      const body = await request.json().catch(() => ({}));
      const raw = body.premio || body;
      const premio = {
        id: String(raw.id || `premio_${w.semanaActualId}`).trim(),
        nombre: String(raw.nombre || 'Héroe Semanal').trim().slice(0, 30),
        color: raw.color || '#ffd43b',
        hat: raw.hat || 'corona',
        ropa: raw.ropa || 'ninguna',
        ropaColor: raw.ropaColor || undefined,
        aura: raw.aura || 'ninguna',
        origen: `Torneo Semanal ${w.semanaActualId}`,
      };

      await d1PutConfig(d1, 'premio_semanal_global', premio);
      return new Response(
        JSON.stringify({
          ok: true,
          mensaje: `Premio de la semana "${premio.nombre}" guardado con éxito.`,
          premio,
        }),
        { headers: jsonHeaders }
      );
    }
  }

  // 4g. /api/admin/config-semanal — Puntos de victoria y bonos semanales
  if (pathname === '/api/admin/config-semanal') {
    const defaultCfg = {
      puntosVictoria: 3,
      puntosEmpate: 1,
      primerLugar: 25,
      segundoLugar: 15,
      tercerLugar: 10,
    };

    if (request.method === 'GET') {
      const cfg = await d1GetConfig(d1, 'config_semanal_puntos', defaultCfg);
      return new Response(JSON.stringify({ ok: true, config: cfg }), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isSupreme, isDelegated } = await verifyCallerAdmin(cuentas, sesion);

      if (!isSupreme && !isDelegated) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }

      const body = await request.json().catch(() => ({}));
      const cfg = {
        puntosVictoria: typeof body.puntosVictoria === 'number' ? body.puntosVictoria : 3,
        puntosEmpate: typeof body.puntosEmpate === 'number' ? body.puntosEmpate : 1,
        primerLugar: typeof body.primerLugar === 'number' ? body.primerLugar : 25,
        segundoLugar: typeof body.segundoLugar === 'number' ? body.segundoLugar : 15,
        tercerLugar: typeof body.tercerLugar === 'number' ? body.tercerLugar : 10,
      };

      await d1PutConfig(d1, 'config_semanal_puntos', cfg);
      return new Response(JSON.stringify({ ok: true, config: cfg, mensaje: 'Puntos semanales guardados.' }), {
        headers: jsonHeaders,
      });
    }
  }

  // 4h. /api/admin/desbloqueos-personajes — Puntos requeridos para desbloquear personajes
  if (pathname === '/api/admin/desbloqueos-personajes') {
    const defaultDesbloqueos = {
      gatito: 30,
      zorro: 60,
      robot: 120,
      dragon: 200,
      ninja: 300,
      navidad: 400,
      granjero: 500,
      astronauta: 650,
      cyberbot: 800,
      mago: 1000,
    };

    if (request.method === 'GET') {
      const desbloqueos = await d1GetConfig(d1, 'config_desbloqueos_personajes', defaultDesbloqueos);
      return new Response(JSON.stringify({ ok: true, desbloqueos }), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isSupreme } = await verifyCallerAdmin(cuentas, sesion);

      if (!isSupreme && (!sesion || sesion.usuarioId !== 'admin')) {
        return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev Supremo puede configurar desbloqueos.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }

      const body = await request.json().catch(() => ({}));
      const desbloqueos = { ...defaultDesbloqueos, ...(body.desbloqueos || body) };
      await d1PutConfig(d1, 'config_desbloqueos_personajes', desbloqueos);
      return new Response(
        JSON.stringify({ ok: true, desbloqueos, mensaje: 'Puntos de desbloqueo actualizados.' }),
        { headers: jsonHeaders }
      );
    }
  }

  // 4i. /api/admin/salas-personalizadas (GET, POST, DELETE)
  if (pathname === '/api/admin/salas-personalizadas' || pathname.startsWith('/api/admin/salas-personalizadas/')) {
    if (request.method === 'GET') {
      const salas = await d1GetSalasPersonalizadas(d1);
      return new Response(JSON.stringify({ ok: true, salas }), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isMod, isAdmin, isDev } = await verifyCallerAdmin(cuentas, sesion);

      if (!isMod && !isAdmin && !isDev) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes para crear salas oficiales.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }

      const body = await request.json().catch(() => ({}));
      const codigo = String(body.codigo || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      const nombre = String(body.nombre || `Sala Oficial ${codigo}`).trim();

      if (!codigo || codigo.length < 3) {
        return new Response(JSON.stringify({ ok: false, error: 'El código debe tener al menos 3 caracteres.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const creadorNombre = isDev ? 'Dev Supremo' : (sesion?.usuarioId && cuentas[sesion.usuarioId]?.nombre) || 'Moderador';
      const creadorRol = isDev ? 'dev' : isAdmin ? 'admin' : 'mod';
      const now = Date.now();

      const nuevaSala = {
        codigo,
        nombre: nombre.slice(0, 32),
        creador: creadorNombre,
        creadorId: sesion?.usuarioId || 'admin',
        creadorRol,
        creadoEn: now,
        maxJugadores: body.maxJugadores === 4 ? 4 : 2,
        modoMuros: body.modoMuros === 'caos' ? 'caos' : (body.modoMuros === 'tactico' ? 'tactico' : 'estandar'),
        tamanoTablero: body.tamanoTablero === 7 ? 7 : 9,
        destacada: true,
        mensajeEspecial: String(body.mensajeEspecial || '').trim().slice(0, 80),
      };

      await d1PutSalaPersonalizada(d1, nuevaSala);

      // Hidratar inmediatamente en la memoria de señalización
      const roomObj = {
        codigo,
        nombre: nuevaSala.nombre,
        anfitrion: nuevaSala.creador,
        hostPeerId: `host_${codigo.toLowerCase()}`,
        color: '#ffd43b',
        hat: 'corona',
        maxJugadores: nuevaSala.maxJugadores,
        publica: true,
        enPartida: false,
        jugadoresConectados: 0,
        jugadores: [],
        signals: {},
        seq: 0,
        mensajes: [],
        creadoEn: now,
        ultimoCambio: now,
        modoMuros: nuevaSala.modoMuros,
        tamanoTablero: nuevaSala.tamanoTablero,
        esOficialStaff: true,
      };
      memSalas.set(codigo, roomObj);
      memSalasMeta.set(codigo, { readAt: now, writtenAt: now });

      const lista = await d1GetSalasPersonalizadas(d1);
      return new Response(
        JSON.stringify({
          ok: true,
          sala: nuevaSala,
          salas: lista,
          mensaje: `Sala oficial "${nuevaSala.nombre}" creada y disponible.`,
        }),
        { headers: jsonHeaders }
      );
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

      let codigo = '';
      if (pathname.startsWith('/api/admin/salas-personalizadas/')) {
        codigo = decodeURIComponent(pathname.slice('/api/admin/salas-personalizadas/'.length)).toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      }
      if (!codigo) {
        const body = await request.json().catch(() => ({}));
        codigo = String(body.codigo || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      }

      if (codigo) {
        await d1DeleteSalaPersonalizada(d1, codigo);
        memSalas.delete(codigo);
        memSalasMeta.delete(codigo);
      }

      const lista = await d1GetSalasPersonalizadas(d1);
      return new Response(JSON.stringify({ ok: true, salas: lista, mensaje: `Sala "${codigo}" eliminada.` }), {
        headers: jsonHeaders,
      });
    }
  }

  // 4j. /api/admin/ranking/solicitar-reset & /api/admin/ranking/resolver-solicitud
  if (pathname === '/api/admin/ranking/solicitar-reset') {
    if (request.method === 'GET') {
      const solicitud = await d1GetConfig(d1, 'solicitud_reset_ranking', null);
      return new Response(JSON.stringify({ ok: true, solicitud }), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isSupreme, isDelegated } = await verifyCallerAdmin(cuentas, sesion);

      if (!isSupreme && !isDelegated) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }

      const body = await request.json().catch(() => ({}));
      const solicitud = {
        id: `sol_${Date.now()}`,
        solicitanteId: sesion?.usuarioId || 'admin',
        solicitanteNombre: (sesion?.usuarioId && cuentas[sesion.usuarioId]?.nombre) || 'Admin',
        motivo: String(body.motivo || 'Reinicio periódico del ranking').trim().slice(0, 140),
        fecha: new Date().toISOString(),
        estado: 'pendiente',
      };

      await d1PutConfig(d1, 'solicitud_reset_ranking', solicitud);
      return new Response(
        JSON.stringify({
          ok: true,
          mensaje: 'Solicitud enviada al Dev Supremo.',
          solicitud,
        }),
        { headers: jsonHeaders }
      );
    }
  }

  if (pathname === '/api/admin/ranking/resolver-solicitud' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const cuentas = await dbGetCuentas(env);
    const { isSupreme } = await verifyCallerAdmin(cuentas, sesion);

    if (!isSupreme && (!sesion || sesion.usuarioId !== 'admin')) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev Supremo puede aprobar o rechazar el reinicio.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const body = await request.json().catch(() => ({}));
    const { accion } = body || {};

    if (accion === 'aprobar') {
      if (d1) {
        await ensureD1Tables(d1);
        try {
          await d1.prepare('DELETE FROM ranking').run();
          await d1.prepare('DELETE FROM ranking_semanal').run();
          await d1.prepare("UPDATE cuentas SET puntos = 0, partidas = 0, victorias = 0, derrotas = 0, empates = 0, elo = 1000 WHERE id != 'admin'").run();
          await d1DeleteConfig(d1, 'solicitud_reset_ranking');
          await d1PutConfig(d1, 'last_update', Date.now());
        } catch (err) {
          console.error('Error aprobando reset de ranking en D1:', err);
        }
      }
      return new Response(JSON.stringify({ ok: true, mensaje: 'Ranking reiniciado correctamente por el Dev Supremo.' }), {
        headers: jsonHeaders,
      });
    }

    await d1DeleteConfig(d1, 'solicitud_reset_ranking');
    return new Response(JSON.stringify({ ok: true, mensaje: 'Solicitud de reinicio rechazada.' }), {
      headers: jsonHeaders,
    });
  }

  // 5. /api/ranking
  if (pathname === '/api/ranking') {
    if (request.method === 'GET') {
      const rank = await dbGetRanking(env);
      return new Response(JSON.stringify(rank), { headers: jsonHeaders });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env);
      const cuentas = await dbGetCuentas(env);
      const { isSupreme, isDelegated } = await verifyCallerAdmin(cuentas, sesion);

      const body = await request.json().catch(() => ({}));
      const incoming = body && typeof body === 'object' ? body : {};

      const existingRank = await dbGetRanking(env);
      const finalRank = { ...existingRank };

      for (const [id, r] of Object.entries(incoming)) {
        if (!r || typeof r !== 'object') continue;
        const cleanId = String(r.id || id).trim().toLowerCase();
        const acc = cuentas[cleanId];
        if (!acc && !isSupreme && !isDelegated) continue;

        finalRank[cleanId] = {
          id: cleanId,
          nombre: r.nombre || acc?.nombre || cleanId,
          puntos: typeof r.puntos === 'number' ? r.puntos : acc?.puntos || 0,
          victorias: typeof r.victorias === 'number' ? r.victorias : acc?.victorias || 0,
          derrotas: typeof r.derrotas === 'number' ? r.derrotas : acc?.derrotas || 0,
          empates: typeof r.empates === 'number' ? r.empates : acc?.empates || 0,
          partidas: typeof r.partidas === 'number' ? r.partidas : acc?.partidas || 0,
          elo: typeof r.elo === 'number' ? r.elo : acc?.elo || 1000,
          avatarColor: r.avatarColor || acc?.avatarColor || '#ff6b6b',
          avatarHat: r.avatarHat || acc?.avatarHat || 'corona',
          avatarRopa: r.avatarRopa || acc?.avatarRopa || 'ninguna',
          avatarRopaColor: r.avatarRopaColor || acc?.avatarRopaColor,
          avatarAura: r.avatarAura || acc?.avatarAura || 'ninguna',
          rol: acc?.rol || r.rol || 'jugador',
        };
      }

      await dbPutRanking(env, finalRank, isSupreme || isDelegated);
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: jsonHeaders });
    }
  }

  // 5b. /api/partida — Endpoint unificado post-partida
  if (pathname === '/api/partida' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env);
    const body = await request.json().catch(() => ({}));
    const { usuarioId, resultado, movimientos, rival, modo, duracionSeg } = body || {};

    const cleanId = String(usuarioId || sesion?.usuarioId || '').trim().toLowerCase();
    if (!cleanId) {
      return new Response(JSON.stringify({ ok: false, error: 'Falta usuarioId.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const cuentas = await dbGetCuentas(env);
    const cuenta = cuentas[cleanId];

    if (cuenta) {
      cuenta.partidas = (cuenta.partidas || 0) + 1;
      let ptsGained = 0;
      if (resultado === 'victoria') {
        cuenta.victorias = (cuenta.victorias || 0) + 1;
        cuenta.elo = (cuenta.elo || 1000) + 15;
        ptsGained = 3;
      } else if (resultado === 'derrota') {
        cuenta.derrotas = (cuenta.derrotas || 0) + 1;
        cuenta.elo = Math.max(800, (cuenta.elo || 1000) - 10);
      } else if (resultado === 'empate') {
        cuenta.empates = (cuenta.empates || 0) + 1;
        cuenta.elo = (cuenta.elo || 1000) + 2;
        ptsGained = 1;
      }
      cuenta.puntos = (cuenta.puntos || 0) + ptsGained;

      if (!Array.isArray(cuenta.historialPartidas)) {
        cuenta.historialPartidas = [];
      }
      const matchRecord = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        rival: String(rival || 'Rival').slice(0, 24),
        resultado: resultado || 'desconocido',
        movimientos: Number(movimientos) || 0,
        modo: modo || 'local',
        duracionSeg: Number(duracionSeg) || 0,
        fecha: new Date().toISOString(),
      };
      cuenta.historialPartidas.unshift(matchRecord);
      if (cuenta.historialPartidas.length > 50) {
        cuenta.historialPartidas = cuenta.historialPartidas.slice(0, 50);
      }

      await dbInsertOrUpdateCuenta(env, cuenta, false);

      // Guardar en tabla partidas_historial
      if (d1) {
        try {
          await d1
            .prepare(`
              INSERT OR REPLACE INTO partidas_historial (
                id, usuario_id, rival, resultado, movimientos, modo, duracion_seg, fecha
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              matchRecord.id,
              cleanId,
              matchRecord.rival,
              matchRecord.resultado,
              matchRecord.movimientos,
              matchRecord.modo,
              matchRecord.duracionSeg,
              matchRecord.fecha
            )
            .run();
        } catch {}
      }

      // Actualizar ranking general
      const ranking = await dbGetRanking(env);
      ranking[cleanId] = {
        id: cleanId,
        nombre: cuenta.nombre || cleanId,
        puntos: cuenta.puntos,
        victorias: cuenta.victorias,
        derrotas: cuenta.derrotas,
        empates: cuenta.empates,
        partidas: cuenta.partidas,
        elo: cuenta.elo,
        avatarColor: cuenta.avatarColor,
        avatarHat: cuenta.avatarHat,
        avatarRopa: cuenta.avatarRopa,
        avatarRopaColor: cuenta.avatarRopaColor,
        avatarAura: cuenta.avatarAura,
        rol: cuenta.rol || 'jugador',
      };
      await dbPutRanking(env, ranking, false);
    }

    return new Response(JSON.stringify({ ok: true, dbBound }), { headers: jsonHeaders });
  }

  // 5c. /api/semanal — Clasificación semanal y premios de torneo
  if (pathname === '/api/semanal') {
    const w = getWeekInfo();
    const emptyActual = { semanaId: w.semanaActualId, jugadores: {} };
    const emptyPasada = { semanaId: w.semanaPasadaId, jugadores: {} };

    const keyActual = `semanal_${w.semanaActualId}`;
    const keyPasada = `semanal_${w.semanaPasadaId}`;

    const existingCuentas = await dbGetCuentas(env);

    if (request.method === 'GET') {
      let actual = (await d1GetConfig(d1, keyActual, emptyActual)) || emptyActual;
      let pasada = (await d1GetConfig(d1, keyPasada, emptyPasada)) || emptyPasada;

      if (!actual.premioSemanal) {
        const pGlob = await d1GetConfig(d1, 'premio_semanal_global', null);
        if (pGlob && pGlob.id) actual.premioSemanal = pGlob;
      }

      const modActual = hydrateWeeklyFromAccounts(actual, w.mondayUtc, w.nextMondayUtc, existingCuentas);
      const modPasada = hydrateWeeklyFromAccounts(pasada, w.lastMondayUtc, w.mondayUtc, existingCuentas);

      // Liquidar premios de la semana pasada si no se premió aún
      if (!pasada.premiada) {
        const candidatos = Object.values(pasada.jugadores || {}).filter((j) => j && j.partidas > 0 && j.puntos > 0);
        if (candidatos.length > 0) {
          candidatos.sort((a, b) => {
            if (b.puntos !== a.puntos) return b.puntos - a.puntos;
            if (b.victorias !== a.victorias) return b.victorias - a.victorias;
            return b.partidas - a.partidas;
          });

          const cfg = (await d1GetConfig(d1, 'config_semanal_puntos', null)) || {};
          const bonos = [
            typeof cfg.primerLugar === 'number' ? cfg.primerLugar : 25,
            typeof cfg.segundoLugar === 'number' ? cfg.segundoLugar : 15,
            typeof cfg.tercerLugar === 'number' ? cfg.tercerLugar : 10,
          ];

          for (let i = 0; i < Math.min(3, candidatos.length); i++) {
            const cand = candidatos[i];
            const acc = existingCuentas[cand.id];
            if (!acc) continue;
            const bono = bonos[i] || 0;
            acc.puntos = (acc.puntos || 0) + bono;

            // Al ganador del 1er lugar se le otorga el personaje exclusivo semanal en su inventario
            if (i === 0 && pasada.premioSemanal) {
              if (!acc.inventario || typeof acc.inventario !== 'object') acc.inventario = { personajes: [] };
              if (!Array.isArray(acc.inventario.personajes)) acc.inventario.personajes = [];
              const yaLoTiene = acc.inventario.personajes.some((p) => p.id === pasada.premioSemanal.id);
              if (!yaLoTiene) {
                acc.inventario.personajes.push({
                  ...pasada.premioSemanal,
                  fechaAdquisicion: new Date().toISOString(),
                  origen: `Ganador 1er Lugar Torneo Semanal (${pasada.semanaId})`,
                });
              }
            }
            await dbInsertOrUpdateCuenta(env, acc, false);
          }
          pasada.premiada = true;
          await d1PutConfig(d1, keyPasada, pasada);
        }
      }

      if (modActual) {
        await d1PutConfig(d1, keyActual, actual);
      }
      if (modPasada) {
        await d1PutConfig(d1, keyPasada, pasada);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          dbBound,
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
      const incomingJugadores = body?.jugadores || {};
      let actual = (await d1GetConfig(d1, keyActual, emptyActual)) || emptyActual;

      if (!actual.jugadores) actual.jugadores = {};

      for (const [id, j] of Object.entries(incomingJugadores)) {
        if (!j || typeof j !== 'object') continue;
        const cleanId = String(j.id || id).trim().toLowerCase();
        const acc = existingCuentas[cleanId];
        if (!acc) continue;

        actual.jugadores[cleanId] = {
          id: cleanId,
          nombre: acc.nombre || j.nombre || cleanId,
          avatarColor: acc.avatarColor || j.avatarColor || '#ff6b6b',
          avatarHat: acc.avatarHat || j.avatarHat || 'corona',
          avatarRopa: acc.avatarRopa || j.avatarRopa || 'ninguna',
          avatarRopaColor: acc.avatarRopaColor || j.avatarRopaColor,
          avatarAura: acc.avatarAura || j.avatarAura || 'ninguna',
          puntos: typeof j.puntos === 'number' ? j.puntos : 0,
          victorias: typeof j.victorias === 'number' ? j.victorias : 0,
          partidas: typeof j.partidas === 'number' ? j.partidas : 0,
          rol: acc.rol || 'jugador',
          actualizadoEn: Date.now(),
        };

        // Guardar en tabla ranking_semanal en D1
        if (d1) {
          try {
            await d1
              .prepare(`
                INSERT OR REPLACE INTO ranking_semanal (
                  semana_key, id, nombre, avatar_color, avatar_hat, avatar_ropa, avatar_ropa_color, puntos, victorias
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .bind(
                w.semanaActualId,
                cleanId,
                acc.nombre || cleanId,
                acc.avatarColor || '#ff6b6b',
                acc.avatarHat || 'corona',
                acc.avatarRopa || 'ninguna',
                acc.avatarRopaColor || null,
                actual.jugadores[cleanId].puntos,
                actual.jugadores[cleanId].victorias
              )
              .run();
          } catch {}
        }
      }

      await d1PutConfig(d1, keyActual, actual);
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: jsonHeaders });
    }
  }

  // 6. /api/salas — Salas P2P en línea
  async function readRoomState(code) {
    const clean = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!clean) return null;
    const now = Date.now();
    if (memSalas.has(clean)) {
      return memSalas.get(clean);
    }
    // Si no está en memoria, verificar si es una sala oficial de staff guardada en D1
    if (d1) {
      try {
        const customSalas = await d1GetSalasPersonalizadas(d1);
        const match = customSalas.find((s) => s.codigo === clean);
        if (match) {
          const roomObj = {
            codigo: match.codigo,
            nombre: match.nombre,
            anfitrion: match.creador || 'Staff',
            hostPeerId: `host_${clean.toLowerCase()}`,
            color: '#ffd43b',
            hat: 'corona',
            maxJugadores: match.maxJugadores || 2,
            publica: true,
            enPartida: false,
            jugadoresConectados: 0,
            jugadores: [],
            signals: {},
            seq: 0,
            mensajes: [],
            creadoEn: match.creadoEn || now,
            ultimoCambio: now,
            modoMuros: match.modoMuros,
            tamanoTablero: match.tamanoTablero,
            esOficialStaff: true,
          };
          memSalas.set(clean, roomObj);
          memSalasMeta.set(clean, { readAt: now, writtenAt: now });
          return roomObj;
        }
      } catch {}
    }
    return null;
  }

  async function writeRoomState(code, roomObj) {
    const clean = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!clean) return;
    const now = Date.now();
    memSalas.set(clean, roomObj);
    memSalasMeta.set(clean, { readAt: now, writtenAt: now });
  }

  async function deleteRoomState(code) {
    const clean = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!clean) return;
    memSalas.delete(clean);
    memSalasMeta.delete(clean);
  }

  if (pathname === '/api/salas') {
    if (request.method === 'GET') {
      const valid = [];
      const now = Date.now();
      for (const r of memSalas.values()) {
        if (
          r &&
          r.publica !== false &&
          !r.enPartida &&
          (r.jugadoresConectados || 0) < (r.maxJugadores || 2) &&
          now - (r.ultimoCambio || r.creadoEn || 0) < 15 * 60 * 1000
        ) {
          valid.push(r);
        }
      }
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
      return new Response(JSON.stringify({ ok: true, dbBound, sala: fullRoom, timestamp: now }), {
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

    // GET /api/salas/:codigo
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

      let esAnfitrionResultado = false;

      if (existing) {
        existing.nombre = nombre;
        existing.color = color || existing.color;
        existing.hat = hat || existing.hat;
        existing.conectado = true;
        esAnfitrionResultado = Boolean(existing.esAnfitrion);
      } else {
        if (sala.jugadores.length >= (sala.maxJugadores || 2)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'La sala ya está llena.' }),
            { status: 409, headers: jsonHeaders }
          );
        }
        const playerColors = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66'];
        const playerHats = ['corona', 'pompon', 'antena', 'brote'];
        const isFirstPlayer = sala.jugadores.length === 0;
        const newId = sala.jugadores.length;
        const nuevoJugador = {
          id: newId,
          peerId,
          nombre,
          color: color || playerColors[newId] || '#4dabf7',
          hat: hat || playerHats[newId] || 'pompon',
          listo: true,
          conectado: true,
          esAnfitrion: isFirstPlayer,
        };
        if (isFirstPlayer) {
          sala.hostPeerId = peerId;
          sala.anfitrion = nombre;
        }
        sala.jugadores.push(nuevoJugador);
        esAnfitrionResultado = isFirstPlayer;
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

      return new Response(JSON.stringify({ ok: true, sala, esAnfitrion: esAnfitrionResultado }), {
        headers: jsonHeaders,
      });
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
      const sala = await readRoomState(codigo);
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
        } else if (Array.isArray(sala.jugadores)) {
          const leaving = sala.jugadores.find((p) => p.peerId === peerId || p.id === jugadorId);
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
        await writeRoomState(codigo, sala);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    // DELETE /api/salas/:codigo
    if (!subaction && request.method === 'DELETE') {
      await deleteRoomState(codigo);
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: jsonHeaders });
    }

    // PATCH /api/salas/:codigo
    if (!subaction && request.method === 'PATCH') {
      const body = await request.json().catch(() => ({}));
      const now = Date.now();
      const sala = await readRoomState(codigo);
      if (sala) {
        if (
          typeof body.jugadoresConectados === 'number' &&
          body.jugadoresConectados !== sala.jugadoresConectados
        ) {
          sala.jugadoresConectados = body.jugadoresConectados;
        }
        if (typeof body.enPartida === 'boolean' && body.enPartida !== sala.enPartida) {
          sala.enPartida = body.enPartida;
        }
        sala.ultimoCambio = now;
        memSalas.set(codigo, sala);
        await writeRoomState(codigo, sala);
      }
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: jsonHeaders });
    }
  }

  return new Response(JSON.stringify({ error: 'Ruta API no encontrada' }), {
    status: 404,
    headers: jsonHeaders,
  });
}

export { handleApiRequest };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.includes('/api/')) {
      return handleApiRequest(request, env);
    }
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }
    return new Response('Muros Locos API Worker activo (Cloudflare D1)', { status: 200 });
  },
};
