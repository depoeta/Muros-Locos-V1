/**
 * Cloudflare Worker unificado para Muros Locos
 * Base de Datos: Cloudflare D1 SQL (8 tablas dedicadas)
 *
 * Variables / Secrets en Cloudflare Dashboard:
 * - ADMIN_USERNAME: Nombre de user del Dev Supremo (por defecto: "admin")
 * - ADMIN_SECRET_KEY: Clave secreta del Dev Supremo (requerida en producción)
 *
 * Binding de Cloudflare D1:
 * - DB, DATABASE, MUROS_D1, D1, db, database
 */

function obtenerD1(env) {
  if (!env || typeof env !== 'object') return null;
  const clavesD1 = [
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
  for (const k of clavesD1) {
    const candidato = env[k];
    if (candidato && typeof candidato.prepare === 'function') {
      return candidato;
    }
  }
  for (const val of Object.values(env)) {
    if (val && typeof val === 'object' && typeof val.prepare === 'function') {
      return val;
    }
  }
  return null;
}

const DESBLOQUEOS_POR_DEFECTO = {
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

let d1Inicializado = false;

async function asegurarTablasD1(d1) {
  if (d1Inicializado || !d1) return;

  const sentencias = [
    `CREATE TABLE IF NOT EXISTS cuentas (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      clave_hash TEXT,
      clave_salt TEXT,
      clave_iter INTEGER DEFAULT 100000,
      rol TEXT DEFAULT 'jugador',
      creacion TEXT,
      ultima_conexion TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS historial (
      id TEXT PRIMARY KEY,
      puntos INTEGER DEFAULT 0,
      total_partida INTEGER DEFAULT 0,
      victorias INTEGER DEFAULT 0,
      derrotas INTEGER DEFAULT 0,
      empates INTEGER DEFAULT 0,
      historial_partida TEXT DEFAULT '[]',
      actualizado_en INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS inventario (
      id TEXT PRIMARY KEY,
      avatar_color TEXT DEFAULT '#ff6b6b',
      avatar_hat TEXT DEFAULT 'corona',
      avatar_ropa TEXT DEFAULT 'ninguna',
      avatar_ropa_color TEXT,
      avatar_aura TEXT DEFAULT 'ninguna',
      tema_tablero TEXT DEFAULT 'madera',
      activo_id TEXT,
      personajes_json TEXT DEFAULT '[]'
    )`,
    `CREATE TABLE IF NOT EXISTS ranking (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      puntos INTEGER DEFAULT 0,
      total_partida INTEGER DEFAULT 0,
      victorias INTEGER DEFAULT 0,
      derrotas INTEGER DEFAULT 0,
      empates INTEGER DEFAULT 0,
      avatar_color TEXT DEFAULT '#ff6b6b',
      avatar_hat TEXT DEFAULT 'corona',
      avatar_ropa TEXT DEFAULT 'ninguna',
      avatar_ropa_color TEXT,
      avatar_aura TEXT DEFAULT 'ninguna',
      semana_actual_id TEXT,
      semana_actual_pts INTEGER DEFAULT 0,
      semana_actual_vic INTEGER DEFAULT 0,
      semana_actual_part INTEGER DEFAULT 0,
      semana_pasada_id TEXT,
      semana_pasada_pts INTEGER DEFAULT 0,
      semana_pasada_premio TEXT,
      actualizado_en INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS sesiones (
      id TEXT NOT NULL,
      token_hash TEXT PRIMARY KEY,
      rol TEXT NOT NULL,
      creado_en INTEGER NOT NULL,
      expira_en INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS salas_personalizadas (
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
    )`,
    `CREATE TABLE IF NOT EXISTS salas_online (
      codigo TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      ultimo_cambio INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT,
      actualizado_en INTEGER
    )`,
  ];

  try {
    if (typeof d1.exec === 'function') {
      await d1.exec(sentencias.join(';\n') + ';');
    } else {
      for (const sql of sentencias) {
        await d1.prepare(sql).run();
      }
    }
    d1Inicializado = true;
  } catch (err) {
    console.warn('Error en bloque exec D1, intentando prepare individual:', err);
    try {
      for (const sql of sentencias) {
        await d1.prepare(sql).run();
      }
      d1Inicializado = true;
    } catch (err2) {
      console.error('Error fatal creando tablas D1:', err2);
    }
  }
}

// ==========================================
// HELPERS TABLA CONFIG
// ==========================================

async function d1LeerConfig(d1, clave, respaldo = null) {
  if (!d1) return respaldo;
  try {
    await asegurarTablasD1(d1);
    const fila = await d1.prepare('SELECT valor FROM config WHERE clave = ?').bind(clave).first();
    if (fila && typeof fila.valor === 'string') {
      try {
        return JSON.parse(fila.valor);
      } catch {
        return fila.valor;
      }
    }
  } catch (err) {
    console.error(`Error leyendo config (${clave}):`, err);
  }
  return respaldo;
}

async function d1GuardarConfig(d1, clave, valor) {
  if (!d1) return;
  try {
    await asegurarTablasD1(d1);
    const str = typeof valor === 'string' ? valor : JSON.stringify(valor);
    await d1
      .prepare('INSERT OR REPLACE INTO config (clave, valor, actualizado_en) VALUES (?, ?, ?)')
      .bind(clave, str, Date.now())
      .run();
  } catch (err) {
    console.error(`Error guardando config (${clave}):`, err);
  }
}

async function d1EliminarConfig(d1, clave) {
  if (!d1) return;
  try {
    await asegurarTablasD1(d1);
    await d1.prepare('DELETE FROM config WHERE clave = ?').bind(clave).run();
  } catch (err) {
    console.error(`Error eliminando config (${clave}):`, err);
  }
}

async function tocarUltimaActualizacion(d1) {
  if (!d1) return Date.now();
  const ahora = Date.now();
  await d1GuardarConfig(d1, 'last_update', ahora);
  return ahora;
}

// ==========================================
// CRYPTO & SESIONES (MAX 2 SESIONES POR ID)
// ==========================================

const codificadorTexto = new TextEncoder();
const aBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const desdeBase64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function hashClavePBKDF2(clave, saltB64, iteraciones = 100000) {
  const salt = saltB64 ? desdeBase64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const llaveImportada = await crypto.subtle.importKey(
    'raw',
    codificadorTexto.encode(clave),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bitsDerivados = await crypto.subtle.deriveBits(
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

function compararTiempoConstante(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', codificadorTexto.encode(str));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function verificarClaveCuenta(cuenta, claveCandidata) {
  if (!cuenta || typeof claveCandidata !== 'string') return false;
  if (cuenta.claveHash && cuenta.claveSalt) {
    const calculado = await hashClavePBKDF2(claveCandidata, cuenta.claveSalt, cuenta.claveIter || 100000);
    return compararTiempoConstante(calculado.claveHash, cuenta.claveHash);
  }
  return false;
}

/**
 * Política estricta de sesiones en D1:
 * - Máximo 2 sesiones activas por cuenta (id).
 * - Si el user inicia una 3ª sesión, se eliminan TODAS las sesiones anteriores de ese id.
 */
async function crearSesion(d1, userId, rol, duracionHoras = 720) {
  const ahora = Date.now();
  const rolFinal = userId === 'admin' ? 'dev' : (rol || 'jugador');

  if (d1) {
    await asegurarTablasD1(d1);
    try {
      await d1.prepare('DELETE FROM sesiones WHERE expira_en <= ?').bind(ahora).run();
      const activas = await d1.prepare('SELECT token_hash FROM sesiones WHERE id = ? AND expira_en > ?').bind(userId, ahora).all();
      if (activas && activas.results && activas.results.length >= 2) {
        await d1.prepare('DELETE FROM sesiones WHERE id = ?').bind(userId).run();
      }
    } catch (err) {
      console.error('Error limpiando sesiones previas en D1:', err);
    }
  }

  const bytesAleatorios = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytesAleatorios, (b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  const expiraEn = ahora + duracionHoras * 3600 * 1000;

  if (d1) {
    try {
      await d1
        .prepare('INSERT OR REPLACE INTO sesiones (id, token_hash, rol, creado_en, expira_en) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, tokenHash, rolFinal, ahora, expiraEn)
        .run();
    } catch (err) {
      console.error('Error guardando nueva sesion en D1:', err);
    }
  }

  return { token, tokenHash, expiraEn, userId, rol: rolFinal };
}

async function resolverSesion(request, env, d1) {
  const authHeader = request.headers.get('Authorization') || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  const headerAdminToken = (request.headers.get('X-Admin-Token') || '').trim();
  const rawAdminPass = env?.ADMIN_SECRET_KEY || env?.ADMIN_KEY || env?.ADMIN_PASSWORD;
  const ADMIN_PASS = rawAdminPass ? String(rawAdminPass).trim() : '';

  if (ADMIN_PASS && headerAdminToken && compararTiempoConstante(headerAdminToken, ADMIN_PASS)) {
    return { userId: 'admin', rol: 'dev', token: headerAdminToken, porClaveMaestra: true };
  }

  if (!token) token = headerAdminToken;
  if (!token) return null;

  if (ADMIN_PASS && compararTiempoConstante(token, ADMIN_PASS)) {
    return { userId: 'admin', rol: 'dev', token, porClaveMaestra: true };
  }

  const tokenHash = await sha256Hex(token);
  const ahora = Date.now();
  if (d1) {
    await asegurarTablasD1(d1);
    try {
      const fila = await d1
        .prepare('SELECT id, rol, expira_en FROM sesiones WHERE token_hash = ?')
        .bind(tokenHash)
        .first();
      if (fila && Number(fila.expira_en) > ahora) {
        return { userId: fila.id, rol: fila.id === 'admin' ? 'dev' : fila.rol, tokenHash, token };
      }
      return { revocada: true, userId: null, rol: null };
    } catch (err) {
      console.error('Error consultando sesion D1:', err);
    }
  }
  return null;
}

// ==========================================
// HIDRATACIÓN UNIFICADA DESDE LAS 8 TABLAS D1
// ==========================================

function construirPerfilSupremo(previo = {}) {
  return {
    id: 'admin',
    nombre: previo.nombre || 'Admin Supremo',
    rol: 'dev',
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

function sanitizarCuentaPublica(acc, incluirPrivados = true) {
  if (!acc || typeof acc !== 'object') return null;
  const copia = { ...acc };
  delete copia.clave;
  delete copia.claveHash;
  delete copia.claveSalt;
  delete copia.claveIter;
  if (copia.id === 'admin') {
    copia.rol = 'dev';
    copia.esSupremo = true;
  } else {
    copia.esSupremo = false;
  }
  if (!incluirPrivados) {
    delete copia.historialPartidas;
    delete copia.fechaRegistro;
    delete copia.ultimaConexion;
    copia.inventario = {
      personajes: [],
      ...(copia.inventario?.activoId ? { activoId: copia.inventario.activoId } : {}),
    };
  }
  return copia;
}

function sanitizarMapaCuentasPublicas(mapa, opciones = {}) {
  const esStaff = Boolean(opciones?.esStaff);
  const selfId = opciones?.selfId ? String(opciones.selfId) : null;
  const out = {};
  for (const [id, acc] of Object.entries(mapa || {})) {
    const incluirPrivados = esStaff || (selfId !== null && id === selfId);
    const pub = sanitizarCuentaPublica(acc, incluirPrivados);
    if (pub) out[id] = pub;
  }
  return out;
}

async function d1ObtenerTodasCuentas(d1) {
  if (!d1) return {};
  await asegurarTablasD1(d1);
  try {
    const [resCuentas, resHistorial, resInventario] = await Promise.all([
      d1.prepare('SELECT * FROM cuentas').all(),
      d1.prepare('SELECT * FROM historial').all(),
      d1.prepare('SELECT * FROM inventario').all(),
    ]);

    const histMap = {};
    for (const h of resHistorial?.results || []) {
      let arr = [];
      try {
        arr = JSON.parse(h.historial_partida || '[]');
        if (!Array.isArray(arr)) arr = [];
      } catch {}
      histMap[h.id] = {
        puntos: Number(h.puntos) || 0,
        partidas: Number(h.total_partida) || 0,
        victorias: Number(h.victorias) || 0,
        derrotas: Number(h.derrotas) || 0,
        empates: Number(h.empates) || 0,
        historialPartidas: arr,
      };
    }

    const invMap = {};
    for (const inv of resInventario?.results || []) {
      let personajes = [];
      try {
        personajes = JSON.parse(inv.personajes_json || '[]');
        if (!Array.isArray(personajes)) personajes = [];
      } catch {}
      invMap[inv.id] = {
        avatarColor: inv.avatar_color || '#ff6b6b',
        avatarHat: inv.avatar_hat || 'corona',
        avatarRopa: inv.avatar_ropa || 'ninguna',
        avatarRopaColor: inv.avatar_ropa_color || undefined,
        avatarAura: inv.avatar_aura || 'ninguna',
        temaTablero: inv.tema_tablero || 'madera',
        inventario: {
          personajes,
          activoId: inv.activo_id || undefined,
        },
      };
    }

    const salida = {};
    for (const c of resCuentas?.results || []) {
      const h = histMap[c.id] || {
        puntos: 0,
        partidas: 0,
        victorias: 0,
        derrotas: 0,
        empates: 0,
        historialPartidas: [],
      };
      const inv = invMap[c.id] || {
        avatarColor: c.id === 'admin' ? '#ffd43b' : '#ff6b6b',
        avatarHat: 'corona',
        avatarRopa: c.id === 'admin' ? 'capa' : 'ninguna',
        avatarRopaColor: c.id === 'admin' ? '#c92a2a' : undefined,
        avatarAura: c.id === 'admin' ? 'dorada' : 'ninguna',
        temaTablero: 'madera',
        inventario: { personajes: [] },
      };

      const esSup = c.id === 'admin';
      salida[c.id] = {
        id: c.id,
        nombre: c.nombre || c.id,
        claveHash: c.clave_hash || undefined,
        claveSalt: c.clave_salt || undefined,
        claveIter: Number(c.clave_iter) || 100000,
        rol: esSup ? 'dev' : (c.rol || 'jugador'),
        esSupremo: esSup,
        creadoEn: c.creacion || new Date().toISOString(),
        ultimaConexion: c.ultima_conexion || new Date().toISOString(),
        puntos: h.puntos,
        partidas: h.partidas,
        victorias: h.victorias,
        derrotas: h.derrotas,
        empates: h.empates,
        historialPartidas: h.historialPartidas,
        avatarColor: inv.avatarColor,
        avatarHat: inv.avatarHat,
        avatarRopa: inv.avatarRopa,
        avatarRopaColor: inv.avatarRopaColor,
        avatarAura: inv.avatarAura,
        temaTablero: inv.temaTablero,
        inventario: inv.inventario,
      };
    }
    return salida;
  } catch (err) {
    console.error('Error hidratando cuentas de D1:', err);
    return {};
  }
}

async function d1GuardarCuentaCompleta(d1, acc, tocarUpdate = true) {
  if (!d1 || !acc || !acc.id) return;
  await asegurarTablasD1(d1);
  const ahora = Date.now();
  const esSup = acc.id === 'admin';
  const rolFinal = esSup ? 'dev' : (acc.rol || 'jugador');

  try {
    let prevCuenta = null;
    try {
      prevCuenta = await d1
        .prepare('SELECT clave_hash, clave_salt, clave_iter, creacion FROM cuentas WHERE id = ?')
        .bind(acc.id)
        .first();
    } catch {}

    await d1
      .prepare(`
        INSERT OR REPLACE INTO cuentas (
          id, nombre, clave_hash, clave_salt, clave_iter, rol, creacion, ultima_conexion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        acc.id,
        acc.nombre || acc.id,
        acc.claveHash || prevCuenta?.clave_hash || null,
        acc.claveSalt || prevCuenta?.clave_salt || null,
        Number(acc.claveIter) || Number(prevCuenta?.clave_iter) || 100000,
        rolFinal,
        acc.creadoEn || prevCuenta?.creacion || new Date().toISOString(),
        acc.ultimaConexion || new Date().toISOString()
      )
      .run();

    await d1
      .prepare(`
        INSERT OR REPLACE INTO historial (
          id, puntos, total_partida, victorias, derrotas, empates, historial_partida, actualizado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        acc.id,
        Math.max(0, Number(acc.puntos) || 0),
        Math.max(0, Number(acc.partidas) || 0),
        Math.max(0, Number(acc.victorias) || 0),
        Math.max(0, Number(acc.derrotas) || 0),
        Math.max(0, Number(acc.empates) || 0),
        JSON.stringify(Array.isArray(acc.historialPartidas) ? acc.historialPartidas.slice(0, 50) : []),
        ahora
      )
      .run();

    const inv = acc.inventario || { personajes: [] };
    await d1
      .prepare(`
        INSERT OR REPLACE INTO inventario (
          id, avatar_color, avatar_hat, avatar_ropa, avatar_ropa_color, avatar_aura, tema_tablero, activo_id, personajes_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        acc.id,
        acc.avatarColor || '#ff6b6b',
        acc.avatarHat || 'corona',
        acc.avatarRopa || 'ninguna',
        acc.avatarRopaColor || null,
        acc.avatarAura || 'ninguna',
        acc.temaTablero || 'madera',
        inv.activoId || null,
        JSON.stringify(Array.isArray(inv.personajes) ? inv.personajes : [])
      )
      .run();

    // Sincronizar fila de ranking si no es 'admin' o si ya tenía partidas
    if (!esSup || (Number(acc.partidas) || 0) > 0 || (Number(acc.puntos) || 0) > 0) {
      let prevRank = null;
      try {
        prevRank = await d1.prepare('SELECT * FROM ranking WHERE id = ?').bind(acc.id).first();
      } catch {}

      await d1
        .prepare(`
          INSERT OR REPLACE INTO ranking (
            id, nombre, puntos, total_partida, victorias, derrotas, empates,
            avatar_color, avatar_hat, avatar_ropa, avatar_ropa_color, avatar_aura,
            semana_actual_id, semana_actual_pts, semana_actual_vic, semana_actual_part,
            semana_pasada_id, semana_pasada_pts, semana_pasada_premio, actualizado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          acc.id,
          acc.nombre || acc.id,
          Math.max(0, Number(acc.puntos) || 0),
          Math.max(0, Number(acc.partidas) || 0),
          Math.max(0, Number(acc.victorias) || 0),
          Math.max(0, Number(acc.derrotas) || 0),
          Math.max(0, Number(acc.empates) || 0),
          acc.avatarColor || '#ff6b6b',
          acc.avatarHat || 'corona',
          acc.avatarRopa || 'ninguna',
          acc.avatarRopaColor || null,
          acc.avatarAura || 'ninguna',
          prevRank?.semana_actual_id || obtenerInfoSemana().semanaActualId,
          Number(prevRank?.semana_actual_pts) || 0,
          Number(prevRank?.semana_actual_vic) || 0,
          Number(prevRank?.semana_actual_part) || 0,
          prevRank?.semana_pasada_id || obtenerInfoSemana().semanaPasadaId,
          Number(prevRank?.semana_pasada_pts) || 0,
          prevRank?.semana_pasada_premio || null,
          ahora
        )
        .run();
    }

    if (tocarUpdate) {
      await tocarUltimaActualizacion(d1);
    }
  } catch (err) {
    console.error(`Error guardando cuenta completa (${acc.id}) en D1:`, err);
  }
}

async function d1EliminarCuentaCompleta(d1, targetId) {
  if (!d1 || !targetId || targetId === 'admin') return;
  await asegurarTablasD1(d1);
  try {
    await d1.prepare('DELETE FROM cuentas WHERE id = ?').bind(targetId).run();
    await d1.prepare('DELETE FROM historial WHERE id = ?').bind(targetId).run();
    await d1.prepare('DELETE FROM inventario WHERE id = ?').bind(targetId).run();
    await d1.prepare('DELETE FROM ranking WHERE id = ?').bind(targetId).run();
    await d1.prepare('DELETE FROM sesiones WHERE id = ?').bind(targetId).run();
    await d1.prepare('DELETE FROM salas_personalizadas WHERE creador_id = ?').bind(targetId).run();
    await tocarUltimaActualizacion(d1);
  } catch (err) {
    console.error(`Error eliminando cuenta (${targetId}) de D1:`, err);
  }
}

async function d1RenombrarIdEnCascada(d1, oldId, newId) {
  if (!d1 || !oldId || !newId || oldId === 'admin' || newId === 'admin' || oldId === newId) return false;
  await asegurarTablasD1(d1);
  try {
    await d1.prepare('UPDATE cuentas SET id = ? WHERE id = ?').bind(newId, oldId).run();
    await d1.prepare('UPDATE historial SET id = ? WHERE id = ?').bind(newId, oldId).run();
    await d1.prepare('UPDATE inventario SET id = ? WHERE id = ?').bind(newId, oldId).run();
    await d1.prepare('UPDATE ranking SET id = ? WHERE id = ?').bind(newId, oldId).run();
    await d1.prepare('UPDATE sesiones SET id = ? WHERE id = ?').bind(newId, oldId).run();
    await d1.prepare('UPDATE salas_personalizadas SET creador_id = ? WHERE creador_id = ?').bind(newId, oldId).run();
    await tocarUltimaActualizacion(d1);
    return true;
  } catch (err) {
    console.error(`Error renombrando ID en cascada (${oldId} -> ${newId}):`, err);
    return false;
  }
}

// ==========================================
// RANKING & SEMANA EN TABLA `ranking`
// ==========================================

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

async function d1LeerRanking(d1) {
  if (!d1) return {};
  await asegurarTablasD1(d1);
  try {
    const [filasRank, filasHist, filasCuentas] = await Promise.all([
      d1.prepare('SELECT * FROM ranking').all(),
      d1.prepare('SELECT id, historial_partida FROM historial').all(),
      d1.prepare('SELECT id, ultima_conexion FROM cuentas').all(),
    ]);

    const histMap = {};
    for (const h of filasHist?.results || []) {
      try {
        const arr = JSON.parse(h.historial_partida || '[]');
        if (Array.isArray(arr)) histMap[h.id] = arr;
      } catch {}
    }

    const ultimaMap = {};
    for (const c of filasCuentas?.results || []) {
      ultimaMap[c.id] = c.ultima_conexion;
    }

    const salida = {};
    for (const r of filasRank?.results || []) {
      if (r.id === 'admin' && (Number(r.total_partida) || 0) === 0 && (Number(r.puntos) || 0) === 0) {
        continue;
      }
      const hist = histMap[r.id] || [];
      let rachaActual = 0;
      let mejorRacha = 0;
      let tmp = 0;
      let murosColocados = 0;
      let saltos = 0;
      let mejorPartida = 0;
      let partidaMasRapida = 999;
      let partidasLimpias = 0;
      const logrosSet = new Set();

      // Recorremos de más antiguo a más reciente
      const cronologico = [...hist].reverse();
      for (const m of cronologico) {
        if (!m) continue;
        const pts = Math.max(0, Number(m.puntos) || 0);
        if (pts > mejorPartida) mejorPartida = pts;
        murosColocados += Math.max(0, Number(m.murosColocados) || 0);
        saltos += Math.max(0, Number(m.saltos) || 0);
        if (m.partidaLimpia) partidasLimpias++;
        if (Array.isArray(m.logros)) {
          for (const l of m.logros) logrosSet.add(l);
        }
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

      const key = String(r.nombre || r.id).trim().toLowerCase();
      salida[key] = {
        id: r.id,
        nombre: r.nombre || r.id,
        puntosTotales: Number(r.puntos) || 0,
        partidas: Number(r.total_partida) || 0,
        victorias: Number(r.victorias) || 0,
        derrotas: Number(r.derrotas) || 0,
        empates: Number(r.empates) || 0,
        rachaActual,
        mejorRacha,
        murosColocados,
        saltos,
        mejorPartida,
        partidaMasRapida,
        partidasLimpias,
        fechaUltimaPartida: ultimaMap[r.id] || new Date(Number(r.actualizado_en) || Date.now()).toISOString(),
        logros: Array.from(logrosSet),
        avatarColor: r.avatar_color || '#ff6b6b',
        avatarHat: r.avatar_hat || 'corona',
        avatarRopa: r.avatar_ropa || 'ninguna',
        avatarRopaColor: r.avatar_ropa_color || undefined,
        avatarAura: r.avatar_aura || 'ninguna',
      };
    }
    return salida;
  } catch (err) {
    console.error('Error leyendo ranking D1:', err);
    return {};
  }
}

async function d1AsegurarSemanaEnRanking(d1, infoSemana) {
  if (!d1) return;
  await asegurarTablasD1(d1);
  try {
    const filas = await d1.prepare('SELECT * FROM ranking').all();
    for (const r of filas?.results || []) {
      const sa = r.semana_actual_id;
      if (sa && sa !== infoSemana.semanaActualId) {
        // Hubo cambio de semana: si sa era la semana pasada, desplazamos a semana_pasada_*
        const esSemanaPasada = sa === infoSemana.semanaPasadaId;
        await d1
          .prepare(`
            UPDATE ranking SET
              semana_pasada_id = ?,
              semana_pasada_pts = ?,
              semana_actual_id = ?,
              semana_actual_pts = 0,
              semana_actual_vic = 0,
              semana_actual_part = 0
            WHERE id = ?
          `)
          .bind(
            infoSemana.semanaPasadaId,
            esSemanaPasada ? (Number(r.semana_actual_pts) || 0) : 0,
            infoSemana.semanaActualId,
            r.id
          )
          .run();
      } else if (!sa) {
        await d1
          .prepare('UPDATE ranking SET semana_actual_id = ?, semana_pasada_id = ? WHERE id = ?')
          .bind(infoSemana.semanaActualId, infoSemana.semanaPasadaId, r.id)
          .run();
      }
    }
  } catch (err) {
    console.error('Error rotando semana en ranking D1:', err);
  }
}

// ==========================================
// SALAS PERSONALIZADAS & SALAS ONLINE (D1)
// ==========================================

async function d1LeerSalasPersonalizadas(d1) {
  if (!d1) return [];
  await asegurarTablasD1(d1);
  try {
    const filas = await d1.prepare('SELECT * FROM salas_personalizadas ORDER BY creado_en DESC LIMIT 25').all();
    return (filas?.results || []).map((r) => ({
      id: `sp_${r.codigo}`,
      codigo: r.codigo,
      nombre: r.nombre,
      creador: r.creador,
      creadorId: r.creador_id,
      creadorRol: r.creador_rol,
      maxJugadores: Number(r.max_jugadores) || 2,
      modoMuros: r.modo_muros || 'estandar',
      tamanoTablero: normalizarTamanoTablero(r.tamano_tablero),
      destacada: Boolean(r.destacada),
      mensajeEspecial: r.mensaje_especial || '',
      creadoEn: Number(r.creado_en) || Date.now(),
    }));
  } catch (err) {
    console.error('Error leyendo salas_personalizadas D1:', err);
    return [];
  }
}

async function d1GuardarSalaPersonalizada(d1, sala) {
  if (!d1 || !sala) return;
  await asegurarTablasD1(d1);
  try {
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
        sala.maxJugadores === 4 ? 4 : 2,
        sala.modoMuros || 'estandar',
        normalizarTamanoTablero(sala.tamanoTablero),
        sala.destacada ? 1 : 0,
        sala.mensajeEspecial || '',
        sala.creadoEn || Date.now()
      )
      .run();
  } catch (err) {
    console.error('Error guardando sala_personalizada en D1:', err);
  }
}

async function d1EliminarSalaPersonalizada(d1, codigo) {
  if (!d1 || !codigo) return;
  await asegurarTablasD1(d1);
  try {
    await d1.prepare('DELETE FROM salas_personalizadas WHERE codigo = ?').bind(codigo).run();
    await d1.prepare('DELETE FROM salas_online WHERE codigo = ?').bind(codigo).run();
  } catch (err) {
    console.error('Error eliminando sala_personalizada de D1:', err);
  }
}

function normalizarCodigoSala(raw) {
  return String(raw || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
}

function normalizarTamanoTablero(raw) {
  const num = Number(raw);
  if (num === 5 || num === 7 || num === 9) return num;
  return 9;
}

async function d1LimpiarSalasExpiradas(d1) {
  if (!d1) return;
  await asegurarTablasD1(d1);
  try {
    const limite = Date.now() - 30 * 60 * 1000;
    await d1.prepare('DELETE FROM salas_online WHERE ultimo_cambio < ?').bind(limite).run();
  } catch {}
}

async function d1LeerSalaOnline(d1, codigo) {
  const limpio = normalizarCodigoSala(codigo);
  if (!d1 || !limpio) return null;
  await asegurarTablasD1(d1);

  try {
    const fila = await d1.prepare('SELECT data_json, ultimo_cambio FROM salas_online WHERE codigo = ?').bind(limpio).first();
    if (fila && typeof fila.data_json === 'string') {
      const parsed = JSON.parse(fila.data_json);
      const ahora = Date.now();
      const maxInactividad = parsed.enPartida ? 25 * 60 * 1000 : 15 * 60 * 1000;
      if (ahora - (Number(fila.ultimo_cambio) || parsed.ultimoCambio || 0) <= maxInactividad) {
        return parsed;
      }
      await d1.prepare('DELETE FROM salas_online WHERE codigo = ?').bind(limpio).run();
    }

    // Si es una sala personalizada oficial creada por Staff, hidratarla y guardarla en D1 salas_online
    const customRow = await d1.prepare('SELECT * FROM salas_personalizadas WHERE codigo = ?').bind(limpio).first();
    if (customRow) {
      const ahora = Date.now();
      const salaNueva = {
        codigo: customRow.codigo,
        nombre: customRow.nombre,
        anfitrion: customRow.creador || 'Staff',
        hostPeerId: `host_${limpio.toLowerCase()}`,
        color: '#ffd43b',
        hat: 'corona',
        ropa: 'capa',
        ropaColor: '#c92a2a',
        aura: 'dorada',
        maxJugadores: Number(customRow.max_jugadores) === 4 ? 4 : 2,
        publica: true,
        enPartida: false,
        jugadoresConectados: 0,
        jugadores: [],
        signals: {},
        seq: 0,
        mensajes: [],
        creadoEn: Number(customRow.creado_en) || ahora,
        ultimoCambio: ahora,
        modoMuros: customRow.modo_muros || 'estandar',
        tamanoTablero: normalizarTamanoTablero(customRow.tamano_tablero),
        esOficialStaff: true,
      };
      await d1GuardarSalaOnline(d1, limpio, salaNueva);
      return salaNueva;
    }
  } catch (err) {
    console.error(`Error leyendo sala_online (${limpio}):`, err);
  }
  return null;
}

async function d1GuardarSalaOnline(d1, codigo, salaObj) {
  const limpio = normalizarCodigoSala(codigo);
  if (!d1 || !limpio || !salaObj) return;
  await asegurarTablasD1(d1);
  const ahora = Date.now();
  salaObj.ultimoCambio = ahora;
  try {
    await d1
      .prepare('INSERT OR REPLACE INTO salas_online (codigo, data_json, ultimo_cambio) VALUES (?, ?, ?)')
      .bind(limpio, JSON.stringify(salaObj), ahora)
      .run();
  } catch (err) {
    console.error(`Error guardando sala_online (${limpio}):`, err);
  }
}

async function d1ActualizarSalaAtomica(d1, codigo, mutador) {
  const limpio = normalizarCodigoSala(codigo);
  if (!d1 || !limpio) return { ok: false, status: 404, error: 'Sala no disponible' };
  await asegurarTablasD1(d1);

  for (let intento = 0; intento < 5; intento++) {
    let fila = await d1
      .prepare('SELECT data_json, ultimo_cambio FROM salas_online WHERE codigo = ?')
      .bind(limpio)
      .first();

    if (!fila || typeof fila.data_json !== 'string') {
      const hidratada = await d1LeerSalaOnline(d1, limpio);
      if (!hidratada) return { ok: false, status: 404, error: 'Sala no disponible' };
      fila = await d1
        .prepare('SELECT data_json, ultimo_cambio FROM salas_online WHERE codigo = ?')
        .bind(limpio)
        .first();
      if (!fila || typeof fila.data_json !== 'string') {
        return { ok: false, status: 404, error: 'Sala no disponible' };
      }
    }

    let sala;
    try {
      sala = JSON.parse(fila.data_json);
    } catch {
      return { ok: false, status: 500, error: 'Estado de sala corrupto' };
    }

    const ahora = Date.now();
    const maxInactividad = sala.enPartida ? 25 * 60 * 1000 : 15 * 60 * 1000;
    const prevCambio = Number(fila.ultimo_cambio) || sala.ultimoCambio || 0;
    if (ahora - prevCambio > maxInactividad) {
      await d1.prepare('DELETE FROM salas_online WHERE codigo = ?').bind(limpio).run();
      return { ok: false, status: 404, error: 'Sala expirada o cerrada' };
    }

    const resMut = await mutador(sala);
    if (resMut && resMut.abort) {
      return { ok: false, status: resMut.status || 409, error: resMut.error || 'Conflicto en sala' };
    }

    const nuevoCambio = Math.max(Date.now(), prevCambio + 1);
    sala.ultimoCambio = nuevoCambio;
    sala.version = (Number(sala.version) || 0) + 1;

    const upd = await d1
      .prepare('UPDATE salas_online SET data_json = ?, ultimo_cambio = ? WHERE codigo = ? AND ultimo_cambio = ?')
      .bind(JSON.stringify(sala), nuevoCambio, limpio, fila.ultimo_cambio)
      .run();

    if ((upd?.meta?.changes ?? 1) > 0) {
      return { ok: true, sala, extra: resMut };
    }
  }

  return { ok: false, status: 409, error: 'Conflicto de concurrencia en sala, reintenta.' };
}

async function d1EliminarSalaOnline(d1, codigo) {
  const limpio = normalizarCodigoSala(codigo);
  if (!d1 || !limpio) return;
  await asegurarTablasD1(d1);
  try {
    await d1.prepare('DELETE FROM salas_online WHERE codigo = ?').bind(limpio).run();
  } catch {}
}

// ==========================================
// MANEJADOR PRINCIPAL DE LA API
// ==========================================

function resolverOriginPermitido(request, env, url) {
  const origin = (request.headers.get('Origin') || '').trim();
  if (!origin) return url.origin;

  const listaEnv = String(env?.ALLOWED_ORIGIN || env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (listaEnv.includes(origin) || origin === url.origin) {
    return origin;
  }

  try {
    const oUrl = new URL(origin);
    if (
      oUrl.hostname === 'localhost' ||
      oUrl.hostname === '127.0.0.1' ||
      oUrl.hostname.endsWith('.pages.dev') ||
      oUrl.hostname.endsWith('.workers.dev') ||
      oUrl.hostname.endsWith('.run.app')
    ) {
      return origin;
    }
  } catch {}

  return url.origin;
}

async function manejarPeticionApi(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const allowOrigin = resolverOriginPermitido(request, env, url);

  const cabecerasJson = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-User, X-Admin-Token, X-Self-Delete-Id, X-Self-Delete-Key, X-Register-Id',
    'Access-Control-Expose-Headers': 'X-DB-Bound, X-Database-Bound',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'X-DB-Bound': 'true',
    'X-Database-Bound': 'true',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabecerasJson });
  }

  const d1 = obtenerD1(env);
  const dbBound = Boolean(d1);

  if (d1) {
    await asegurarTablasD1(d1);
  }

  const rawAdminPass = env?.ADMIN_SECRET_KEY || env?.ADMIN_KEY || env?.ADMIN_PASSWORD;
  const rawAdminUser = env?.ADMIN_USERNAME || env?.ADMIN_USER;
  const ADMIN_PASS = rawAdminPass ? String(rawAdminPass).trim() : '';
  const ADMIN_USER = String(rawAdminUser || 'admin').trim();
  const adminKeyConfigurada = Boolean(ADMIN_PASS.length > 0);
  const adminUserConfigurada = Boolean(rawAdminUser && rawAdminUser.trim().length > 0);

  async function verificarPermisosLlamante(cuentas, sesion) {
    const hUser = String(request.headers.get('X-Admin-User') || '').trim().toLowerCase();
    const hToken = String(request.headers.get('X-Admin-Token') || '').trim();

    if (
      ADMIN_PASS &&
      hToken &&
      (compararTiempoConstante(hToken, ADMIN_PASS) ||
        (hUser === ADMIN_USER.toLowerCase() && compararTiempoConstante(hToken, ADMIN_PASS)))
    ) {
      return {
        esSupremoUnico: true,
        esDev: true,
        esAdmin: true,
        esMod: false,
        actor: { id: 'admin', nombre: 'Admin Supremo', rol: 'dev' },
      };
    }

    if (!sesion || sesion.revocada || !sesion.userId) {
      return {
        esSupremoUnico: false,
        esDev: false,
        esAdmin: false,
        esMod: false,
        actor: null,
      };
    }

    if (sesion.userId === 'admin') {
      return {
        esSupremoUnico: true,
        esDev: true,
        esAdmin: true,
        esMod: false,
        actor: { id: 'admin', nombre: 'Admin Supremo', rol: 'dev' },
      };
    }

    const cuentaLlamante = cuentas[sesion.userId] || null;

    if (cuentaLlamante) {
      const rol = cuentaLlamante.rol || 'jugador';
      if (rol === 'dev') {
        return {
          esSupremoUnico: false,
          esDev: true,
          esAdmin: true,
          esMod: false,
          actor: cuentaLlamante,
        };
      }
      if (rol === 'admin') {
        return {
          esSupremoUnico: false,
          esDev: false,
          esAdmin: true,
          esMod: false,
          actor: cuentaLlamante,
        };
      }
      if (rol === 'mod') {
        return {
          esSupremoUnico: false,
          esDev: false,
          esAdmin: false,
          esMod: true,
          actor: cuentaLlamante,
        };
      }
    }

    return {
      esSupremoUnico: false,
      esDev: false,
      esAdmin: false,
      esMod: false,
      actor: cuentaLlamante || null,
    };
  }

  // ==========================================
  // 1. GET /api/ping
  // ==========================================
  if (pathname === '/api/ping') {
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const lastUpdate = d1 ? await d1LeerConfig(d1, 'last_update', Date.now()) : Date.now();
    const sesion = await resolverSesion(request, env, d1);
    const tieneAuthHeader = Boolean(request.headers.get('Authorization'));

    let salasCount = 0;
    if (d1) {
      try {
        await d1LimpiarSalasExpiradas(d1);
        const fSalas = await d1.prepare('SELECT COUNT(*) as c FROM salas_online').first();
        salasCount = Number(fSalas?.c) || 0;
      } catch {}
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dbBound,
        d1Bound: dbBound,
        dbType: 'Cloudflare D1 SQL Database (8 Tablas)',
        adminUserConfigured: adminUserConfigurada,
        adminKeyConfigured: adminKeyConfigurada,
        source: 'cloudflare_d1_database',
        timestamp: Date.now(),
        lastUpdate,
        salasCount,
        cuentasCount: Object.keys(cuentas).length,
        sesionValida: tieneAuthHeader ? Boolean(sesion && sesion.userId && !sesion.revocada) : true,
        sesionRevocada: tieneAuthHeader && Boolean(sesion?.revocada),
      }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 2. POST /api/login
  // ==========================================
  if (pathname === '/api/login' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const userTrim = String(body.user || '').trim();
    const claveTrim = String(body.clave || '').trim();

    if (!userTrim || !claveTrim) {
      return new Response(JSON.stringify({ ok: false, error: 'User y clave requeridos.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }

    // A) Dev Supremo ('admin' o ADMIN_USERNAME)
    const esUserSupremo =
      userTrim.toLowerCase() === ADMIN_USER.toLowerCase() ||
      userTrim.toLowerCase() === 'admin';
    if (esUserSupremo) {
      if (!ADMIN_PASS) {
        return new Response(JSON.stringify({ ok: false, error: 'ADMIN_SECRET_KEY no configurada en el servidor.' }), {
          status: 503,
          headers: cabecerasJson,
        });
      }
      const claveValida = compararTiempoConstante(claveTrim, ADMIN_PASS);
      if (!claveValida) {
        return new Response(JSON.stringify({ ok: false, error: 'Clave del Dev Supremo incorrecta.' }), {
          status: 401,
          headers: cabecerasJson,
        });
      }
      const cuentas = await d1ObtenerTodasCuentas(d1);
      const perfilSupremo = construirPerfilSupremo(cuentas['admin']);
      perfilSupremo.ultimaConexion = new Date().toISOString();
      await d1GuardarCuentaCompleta(d1, perfilSupremo, false);
      const sesion = await crearSesion(d1, 'admin', 'dev', 24);

      return new Response(
        JSON.stringify({
          ok: true,
          isSupremeAdmin: true,
          token: sesion.token,
          user: sanitizarCuentaPublica(perfilSupremo),
        }),
        { headers: cabecerasJson }
      );
    }

    // B) User registrado / Staff
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const busqueda = userTrim.toLowerCase();
    let cuentaEncontrada = null;
    for (const acc of Object.values(cuentas)) {
      if (!acc || typeof acc !== 'object' || acc.id === 'admin') continue;
      if (String(acc.id || '').trim().toLowerCase() === busqueda) {
        cuentaEncontrada = acc;
        break;
      }
    }

    if (!cuentaEncontrada) {
      return new Response(JSON.stringify({ ok: false, error: 'User ID no encontrado. Usa tu ID exacto o regístrate.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }

    const claveValida = await verificarClaveCuenta(cuentaEncontrada, claveTrim);
    if (!claveValida) {
      return new Response(JSON.stringify({ ok: false, error: 'Contraseña incorrecta.' }), {
        status: 401,
        headers: cabecerasJson,
      });
    }

    cuentaEncontrada.ultimaConexion = new Date().toISOString();
    await d1GuardarCuentaCompleta(d1, cuentaEncontrada, false);
    const sesion = await crearSesion(d1, cuentaEncontrada.id, cuentaEncontrada.rol || 'jugador', 720);

    return new Response(
      JSON.stringify({
        ok: true,
        isSupremeAdmin: cuentaEncontrada.rol === 'dev',
        token: sesion.token,
        user: sanitizarCuentaPublica(cuentaEncontrada),
      }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 3. POST /api/registro
  // ==========================================
  if (pathname === '/api/registro' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const nombreLimpio = String(body.nombre || '').trim();
    const idLimpio = String(body.id || nombreLimpio || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    const claveLimpia = String(body.clave || '').trim();

    if (!idLimpio || nombreLimpio.length < 3 || nombreLimpio.length > 15) {
      return new Response(JSON.stringify({ ok: false, error: 'El nombre debe tener entre 3 y 15 letras.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }
    if (claveLimpia.length < 4) {
      return new Response(JSON.stringify({ ok: false, error: 'La clave debe tener al menos 4 caracteres.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }
    if (idLimpio === 'admin' || nombreLimpio.toLowerCase() === 'admin' || nombreLimpio.toLowerCase() === 'admin supremo') {
      return new Response(JSON.stringify({ ok: false, error: 'Ese nombre está reservado.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }

    const cuentas = await d1ObtenerTodasCuentas(d1);
    for (const acc of Object.values(cuentas)) {
      if (!acc || typeof acc !== 'object') continue;
      if (
        acc.id?.toLowerCase() === idLimpio ||
        String(acc.nombre || '').trim().toLowerCase() === nombreLimpio.toLowerCase()
      ) {
        return new Response(JSON.stringify({ ok: false, error: 'Ya existe un user con ese nombre o ID.' }), {
          status: 409,
          headers: cabecerasJson,
        });
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
      avatarColor: body.avatarColor || '#ff6b6b',
      avatarHat: body.avatarHat || 'corona',
      avatarRopa: body.avatarRopa || 'ninguna',
      avatarRopaColor: body.avatarRopaColor || undefined,
      avatarAura: body.avatarAura || 'ninguna',
      inventario: { personajes: [] },
      temaTablero: body.temaTablero || 'madera',
      creadoEn: ahoraIso,
      ultimaConexion: ahoraIso,
      historialPartidas: [],
    };

    await d1GuardarCuentaCompleta(d1, nuevaCuenta, true);
    const sesion = await crearSesion(d1, idLimpio, 'jugador', 720);

    return new Response(
      JSON.stringify({
        ok: true,
        token: sesion.token,
        user: sanitizarCuentaPublica(nuevaCuenta),
      }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 3b. POST /api/perfil/actualizar (Nombre visible, aspecto, tablero)
  // ==========================================
  if (pathname === '/api/perfil/actualizar' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    if (!sesion || !sesion.userId) {
      return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida o expirada.' }), {
        status: 401,
        headers: cabecerasJson,
      });
    }

    const body = await request.json().catch(() => ({}));
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const actual = cuentas[sesion.userId];
    if (!actual) {
      return new Response(JSON.stringify({ ok: false, error: 'Cuenta no encontrada.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }

    // Validar cambio de nombre visible (solo nombre, nunca el id desde perfil normal)
    if (typeof body.nombre === 'string' && body.nombre.trim() !== actual.nombre) {
      const nuevoNombre = body.nombre.trim();
      if (nuevoNombre.length < 3 || nuevoNombre.length > 15) {
        return new Response(JSON.stringify({ ok: false, error: 'El nombre debe tener entre 3 y 15 caracteres.' }), {
          status: 400,
          headers: cabecerasJson,
        });
      }
      if (actual.id !== 'admin' && ['admin', 'administrador', 'admin supremo'].includes(nuevoNombre.toLowerCase())) {
        return new Response(JSON.stringify({ ok: false, error: 'Nombre reservado.' }), {
          status: 400,
          headers: cabecerasJson,
        });
      }
      const ocupado = Object.values(cuentas).some(
        (acc) => acc.id !== actual.id && String(acc.nombre || '').trim().toLowerCase() === nuevoNombre.toLowerCase()
      );
      if (ocupado) {
        return new Response(JSON.stringify({ ok: false, error: 'Ese nombre ya está en uso por otro jugador.' }), {
          status: 409,
          headers: cabecerasJson,
        });
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
      // Solo equipar un activoId que realmente pertenezca al inventario del user
      const valido = !nuevoActivo || lista.some((p) => p.id === nuevoActivo);
      actual.inventario = {
        personajes: lista,
        activoId: valido ? (nuevoActivo || undefined) : invPrev.activoId,
      };
    }

    actual.ultimaConexion = new Date().toISOString();
    await d1GuardarCuentaCompleta(d1, actual, true);

    return new Response(
      JSON.stringify({
        ok: true,
        user: sanitizarCuentaPublica(actual),
      }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 3c. POST /api/perfil/cambiar-clave
  // ==========================================
  if (pathname === '/api/perfil/cambiar-clave' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    if (!sesion || !sesion.userId) {
      return new Response(JSON.stringify({ ok: false, error: 'Debes iniciar sesión para cambiar tu contraseña.' }), {
        status: 401,
        headers: cabecerasJson,
      });
    }

    const body = await request.json().catch(() => ({}));
    const nuevaLimpia = String(body.nuevaClave || '').trim();
    const actualLimpia = String(body.claveActual || '').trim();

    if (!nuevaLimpia || nuevaLimpia.length < 4) {
      return new Response(JSON.stringify({ ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }

    if (sesion.userId === 'admin') {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'La clave del Dev Supremo se administra desde ADMIN_SECRET_KEY en Cloudflare.',
        }),
        { status: 400, headers: cabecerasJson }
      );
    }

    const cuentas = await d1ObtenerTodasCuentas(d1);
    const cuenta = cuentas[sesion.userId];
    if (!cuenta) {
      return new Response(JSON.stringify({ ok: false, error: 'Cuenta no encontrada.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }

    const valida = await verificarClaveCuenta(cuenta, actualLimpia);
    if (!valida) {
      return new Response(JSON.stringify({ ok: false, error: 'La contraseña actual no es correcta.' }), {
        status: 401,
        headers: cabecerasJson,
      });
    }

    const hashData = await hashClavePBKDF2(nuevaLimpia);
    cuenta.claveHash = hashData.claveHash;
    cuenta.claveSalt = hashData.claveSalt;
    cuenta.claveIter = hashData.claveIter;
    cuenta.ultimaConexion = new Date().toISOString();

    await d1GuardarCuentaCompleta(d1, cuenta, true);
    const nuevaSesion = await crearSesion(d1, cuenta.id, cuenta.rol || 'jugador', 720);

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: 'Contraseña cambiada con éxito.',
        token: nuevaSesion.token,
        user: sanitizarCuentaPublica(cuenta),
      }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 3d. POST /api/perfil/dar-de-baja
  // ==========================================
  if (pathname === '/api/perfil/dar-de-baja' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    if (!sesion || !sesion.userId) {
      return new Response(JSON.stringify({ ok: false, error: 'Sesión no válida.' }), {
        status: 401,
        headers: cabecerasJson,
      });
    }
    if (sesion.userId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'El Dev Supremo no puede darse de baja.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }

    await d1EliminarCuentaCompleta(d1, sesion.userId);
    return new Response(JSON.stringify({ ok: true, mensaje: 'Cuenta eliminada definitivamente.' }), {
      headers: cabecerasJson,
    });
  }

  // ==========================================
  // 4. GET / POST /api/cuentas
  // ==========================================
  if (pathname === '/api/cuentas') {
    if (request.method === 'GET') {
      const sesion = await resolverSesion(request, env, d1);
      const cuentas = await d1ObtenerTodasCuentas(d1);
      if (!cuentas['admin']) {
        cuentas['admin'] = construirPerfilSupremo();
      }
      const perm = await verificarPermisosLlamante(cuentas, sesion);
      const esStaff = Boolean(perm.esDev || perm.esAdmin || perm.esMod);
      const selfId = sesion && !sesion.revocada && sesion.userId ? sesion.userId : null;
      return new Response(
        JSON.stringify(sanitizarMapaCuentasPublicas(cuentas, { esStaff, selfId })),
        { headers: cabecerasJson }
      );
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const sesion = await resolverSesion(request, env, d1);
      const cuentasActuales = await d1ObtenerTodasCuentas(d1);
      const perm = await verificarPermisosLlamante(cuentasActuales, sesion);

      if (sesion && !sesion.revocada && sesion.userId && body && typeof body === 'object') {
        const entradaPropia = body[sesion.userId];
        if (entradaPropia && !perm.esDev && !perm.esAdmin) {
          const prev = cuentasActuales[sesion.userId];
          if (prev) {
            const invPrev = prev.inventario?.personajes || [];
            const activoSolicitado = entradaPropia.inventario?.activoId;
            const activoValido =
              activoSolicitado && invPrev.some((p) => p && p.id === activoSolicitado)
                ? activoSolicitado
                : undefined;
            const actualizada = {
              ...prev,
              avatarColor: entradaPropia.avatarColor || prev.avatarColor,
              avatarHat: entradaPropia.avatarHat || prev.avatarHat,
              avatarRopa: entradaPropia.avatarRopa ?? prev.avatarRopa,
              avatarRopaColor: entradaPropia.avatarRopaColor ?? prev.avatarRopaColor,
              avatarAura: entradaPropia.avatarAura ?? prev.avatarAura,
              temaTablero: entradaPropia.temaTablero || prev.temaTablero,
              inventario: entradaPropia.inventario
                ? { personajes: invPrev, activoId: activoValido }
                : prev.inventario,
              ultimaConexion: new Date().toISOString(),
            };
            await d1GuardarCuentaCompleta(d1, actualizada, true);
            return new Response(JSON.stringify({ ok: true, dbBound }), { headers: cabecerasJson });
          }
        }
      }

      if (!perm.esDev && !perm.esAdmin) {
        return new Response(
          JSON.stringify({ ok: false, revoked: true, error: 'Permisos insuficientes o revocados.' }),
          { status: 403, headers: cabecerasJson }
        );
      }

      for (const [id, rawAcc] of Object.entries(body || {})) {
        if (!rawAcc || typeof rawAcc !== 'object' || id === 'admin') continue;
        const prev = cuentasActuales[id] || {};
        let nuevoRol = prev.rol || 'jugador';
        const rolSolicitado = rawAcc.rol;
        if (rolSolicitado && ['dev', 'admin', 'mod', 'jugador'].includes(rolSolicitado)) {
          if (perm.esSupremoUnico) {
            nuevoRol = rolSolicitado;
          } else if (perm.esDev) {
            if (prev.rol !== 'dev' && rolSolicitado !== 'dev') nuevoRol = rolSolicitado;
          } else if (perm.esAdmin) {
            if (prev.rol !== 'dev' && prev.rol !== 'admin' && (rolSolicitado === 'mod' || rolSolicitado === 'jugador')) {
              nuevoRol = rolSolicitado;
            }
          }
        }

        const fusionada = {
          ...prev,
          nombre: typeof rawAcc.nombre === 'string' && rawAcc.nombre.trim() ? rawAcc.nombre.trim() : prev.nombre,
          avatarColor: rawAcc.avatarColor || prev.avatarColor,
          avatarHat: rawAcc.avatarHat || prev.avatarHat,
          avatarRopa: rawAcc.avatarRopa ?? prev.avatarRopa,
          avatarRopaColor: rawAcc.avatarRopaColor ?? prev.avatarRopaColor,
          avatarAura: rawAcc.avatarAura ?? prev.avatarAura,
          temaTablero: rawAcc.temaTablero || prev.temaTablero,
          id,
          rol: nuevoRol,
          puntos: prev.puntos ?? 0,
          partidas: prev.partidas ?? 0,
          victorias: prev.victorias ?? 0,
          derrotas: prev.derrotas ?? 0,
          empates: prev.empates ?? 0,
          historialPartidas: Array.isArray(prev.historialPartidas) ? prev.historialPartidas : [],
          inventario: prev.inventario || { personajes: [] },
          claveHash: prev.claveHash,
          claveSalt: prev.claveSalt,
          claveIter: prev.claveIter,
        };
        await d1GuardarCuentaCompleta(d1, fusionada, false);
      }

      await tocarUltimaActualizacion(d1);
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: cabecerasJson });
    }
  }

  // ==========================================
  // 4b. POST /api/admin/actualizar-user (Staff: Roles, puntos, nombre, clave)
  // ==========================================
  if (pathname === '/api/admin/actualizar-user' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);

    if (!perm.esDev && !perm.esAdmin) {
      return new Response(
        JSON.stringify({ ok: false, revoked: true, error: 'Permisos de administración insuficientes o revocados.' }),
        { status: 403, headers: cabecerasJson }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.targetId || body.id || '').trim().toLowerCase();
    const patch = body.patch || body || {};

    if (!targetId || targetId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'El Dev Supremo no puede editarse aquí.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }

    const target = cuentas[targetId];
    if (!target) {
      return new Response(JSON.stringify({ ok: false, error: 'User no encontrado en D1.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }

    // Proteger a users con rango 'dev' frente a cualquiera que no sea el Dev Supremo Único
    if (target.rol === 'dev' && !perm.esSupremoUnico) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Solo el Dev Supremo único puede modificar o quitar el rango a otro Dev.' }),
        { status: 403, headers: cabecerasJson }
      );
    }

    // Validar nombre si cambia
    if (typeof patch.nombre === 'string') {
      const cleanNew = patch.nombre.trim();
      if (cleanNew.length < 3 || cleanNew.length > 15) {
        return new Response(JSON.stringify({ ok: false, error: 'El nombre debe tener entre 3 y 15 caracteres.' }), {
          status: 400,
          headers: cabecerasJson,
        });
      }
      if (['admin', 'administrador', 'admin supremo'].includes(cleanNew.toLowerCase())) {
        return new Response(JSON.stringify({ ok: false, error: 'Nombre reservado.' }), {
          status: 400,
          headers: cabecerasJson,
        });
      }
      const ocupado = Object.values(cuentas).some(
        (acc) => acc.id !== targetId && String(acc.nombre || '').trim().toLowerCase() === cleanNew.toLowerCase()
      );
      if (ocupado) {
        return new Response(JSON.stringify({ ok: false, error: 'Ese nombre ya está en uso.' }), {
          status: 409,
          headers: cabecerasJson,
        });
      }
      target.nombre = cleanNew;
    }

    // Asignación estricta de rol según jerarquía
    if (patch.rol && ['dev', 'admin', 'mod', 'jugador'].includes(patch.rol) && patch.rol !== target.rol) {
      if (perm.esSupremoUnico) {
        target.rol = patch.rol;
      } else if (perm.esDev) {
        if (patch.rol === 'dev') {
          return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev Supremo único puede otorgar rango Dev.' }), {
            status: 403,
            headers: cabecerasJson,
          });
        }
        target.rol = patch.rol;
      } else if (perm.esAdmin) {
        if (target.rol === 'admin') {
          return new Response(JSON.stringify({ ok: false, error: 'Un Admin no puede degradar a otro Admin.' }), {
            status: 403,
            headers: cabecerasJson,
          });
        }
        if (patch.rol !== 'mod' && patch.rol !== 'jugador') {
          return new Response(JSON.stringify({ ok: false, error: 'Un Admin solo puede asignar rango Moderador o Jugador.' }), {
            status: 403,
            headers: cabecerasJson,
          });
        }
        target.rol = patch.rol;
      }
    }

    if (typeof patch.puntos === 'number' && !isNaN(patch.puntos)) {
      target.puntos = Math.max(0, Math.round(patch.puntos));
    }
    if (typeof patch.victorias === 'number' && !isNaN(patch.victorias)) {
      target.victorias = Math.max(0, Math.round(patch.victorias));
    }
    if (typeof patch.partidas === 'number' && !isNaN(patch.partidas)) {
      target.partidas = Math.max(0, Math.round(patch.partidas));
    }

    if (typeof patch.clave === 'string' && patch.clave.trim().length >= 4 && perm.esDev) {
      const hashData = await hashClavePBKDF2(patch.clave.trim());
      target.claveHash = hashData.claveHash;
      target.claveSalt = hashData.claveSalt;
      target.claveIter = hashData.claveIter;
    }

    await d1GuardarCuentaCompleta(d1, target, true);

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: `User "${target.nombre}" actualizado en D1.`,
        user: sanitizarCuentaPublica(target),
      }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 4c. POST /api/admin/cambiar-id (Exclusivo Dev: cambia el ID en cascada en las 8 tablas)
  // ==========================================
  if (pathname === '/api/admin/cambiar-id' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);

    if (!perm.esDev) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev puede cambiar el ID de una cuenta.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }

    const body = await request.json().catch(() => ({}));
    const oldId = String(body.oldId || '').trim().toLowerCase();
    const newId = String(body.newId || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (!oldId || oldId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'ID original inválido o intocable.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }
    if (!newId || newId.length < 3 || newId.length > 20 || newId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'El nuevo ID debe tener entre 3 y 20 caracteres válidos.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }
    if (!cuentas[oldId]) {
      return new Response(JSON.stringify({ ok: false, error: 'La cuenta original no existe.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }
    if (cuentas[newId]) {
      return new Response(JSON.stringify({ ok: false, error: `El ID "${newId}" ya está en uso.` }), {
        status: 409,
        headers: cabecerasJson,
      });
    }

    const ok = await d1RenombrarIdEnCascada(d1, oldId, newId);
    if (!ok) {
      return new Response(JSON.stringify({ ok: false, error: 'No se pudo renombrar el ID en D1.' }), {
        status: 500,
        headers: cabecerasJson,
      });
    }

    return new Response(JSON.stringify({ ok: true, oldId, newId, mensaje: `ID cambiado de "${oldId}" a "${newId}".` }), {
      headers: cabecerasJson,
    });
  }

  // ==========================================
  // 4d. POST /api/admin/eliminar-user
  // ==========================================
  if (pathname === '/api/admin/eliminar-user' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);

    if (!perm.esDev) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev puede eliminar users.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.targetId || body.id || '').trim().toLowerCase();
    if (!targetId || targetId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'El Dev Supremo no puede eliminarse.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }
    const targetAcc = cuentas[targetId];
    if (targetAcc && targetAcc.rol === 'dev' && !perm.esSupremoUnico) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev Supremo único puede eliminar a otro Dev.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }

    await d1EliminarCuentaCompleta(d1, targetId);
    return new Response(JSON.stringify({ ok: true, mensaje: `User ${targetId} eliminado definitivamente.` }), {
      headers: cabecerasJson,
    });
  }

  // ==========================================
  // 4e. POST /api/admin/restablecer-clave
  // ==========================================
  if (pathname === '/api/admin/restablecer-clave' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);

    if (!perm.esDev) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev puede restablecer claves.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.targetId || '').trim().toLowerCase();
    const target = cuentas[targetId];
    if (!target || targetId === 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'User no encontrado.' }), {
        status: 404,
        headers: cabecerasJson,
      });
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
    await d1GuardarCuentaCompleta(d1, target, true);

    return new Response(
      JSON.stringify({ ok: true, userNombre: target.nombre, claveTemporal }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 4f. POST /api/admin/verify & /api/admin/verify-action
  // ==========================================
  if (pathname === '/api/admin/verify' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const trimmedUser = String(body.user || '').trim();
    const trimmedKey = String(body.clave || '').trim();
    if (trimmedUser.toLowerCase() === ADMIN_USER.toLowerCase() || trimmedUser.toLowerCase() === 'admin') {
      if (!ADMIN_PASS) {
        return new Response(JSON.stringify({ ok: false, isSupremeAttempt: true, error: 'ADMIN_SECRET_KEY no configurada en el servidor.' }), {
          status: 503,
          headers: cabecerasJson,
        });
      }
      if (compararTiempoConstante(trimmedKey, ADMIN_PASS)) {
        const cuentas = await d1ObtenerTodasCuentas(d1);
        const supremo = construirPerfilSupremo(cuentas['admin']);
        await d1GuardarCuentaCompleta(d1, supremo, false);
        const sesion = await crearSesion(d1, 'admin', 'dev', 24);
        return new Response(
          JSON.stringify({
            ok: true,
            isSupremeAdmin: true,
            isCloudAdmin: true,
            dbBound,
            adminUser: ADMIN_USER,
            adminToken: sesion.token,
            token: sesion.token,
            user: sanitizarCuentaPublica(supremo),
          }),
          { headers: cabecerasJson }
        );
      }
      return new Response(JSON.stringify({ ok: false, isSupremeAttempt: true, error: 'Clave incorrecta.' }), {
        status: 401,
        headers: cabecerasJson,
      });
    }
    return new Response(JSON.stringify({ ok: false, isSupremeAttempt: false }), { headers: cabecerasJson });
  }

  if (pathname === '/api/admin/verify-action' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const body = await request.json().catch(() => ({}));
    const { requiereSupremo, adminToken } = body || {};

    if (ADMIN_PASS && adminToken && compararTiempoConstante(String(adminToken).trim(), ADMIN_PASS)) {
      return new Response(
        JSON.stringify({ ok: true, isSupremeAdmin: true, isCloudAdmin: true, rol: 'dev', dbBound }),
        { headers: cabecerasJson }
      );
    }

    const perm = await verificarPermisosLlamante(cuentas, sesion);
    if (perm.esDev) {
      return new Response(
        JSON.stringify({ ok: true, isSupremeAdmin: true, isCloudAdmin: true, rol: 'dev', dbBound }),
        { headers: cabecerasJson }
      );
    }
    if (requiereSupremo) {
      return new Response(JSON.stringify({ ok: false, revoked: false, error: 'Acción exclusiva del Dev.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }
    if (perm.esAdmin || perm.esMod) {
      return new Response(
        JSON.stringify({
          ok: true,
          isSupremeAdmin: false,
          isCloudAdmin: true,
          rol: perm.esAdmin ? 'admin' : 'mod',
          dbBound,
        }),
        { headers: cabecerasJson }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, revoked: true, error: 'Tus permisos de Staff no son válidos o fueron revocados.' }),
      { status: 403, headers: cabecerasJson }
    );
  }

  // ==========================================
  // 4g. PERSONAJES EXCLUSIVOS: REGALAR / QUITAR / MOVER
  // ==========================================
  if (pathname === '/api/admin/personajes/regalar' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);

    if (!perm.esDev && !perm.esAdmin) {
      return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes para regalar personajes.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.targetId || '').trim().toLowerCase();
    const rawPj = body.personaje;
    const targetAcc = cuentas[targetId];

    if (!targetAcc) {
      return new Response(JSON.stringify({ ok: false, error: 'User destinatario no encontrado.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }

    if (!targetAcc.inventario || typeof targetAcc.inventario !== 'object') {
      targetAcc.inventario = { personajes: [] };
    }
    if (!Array.isArray(targetAcc.inventario.personajes)) {
      targetAcc.inventario.personajes = [];
    }

    const actorName = perm.esDev ? (perm.actor?.nombre || 'Dev Supremo') : (perm.actor?.nombre || 'Admin');
    const nuevoPersonaje = {
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

    // IMPORTANTE: SOLO se agrega al inventario de targetId. Nunca modifica el aspecto equipado ni al actor.
    targetAcc.inventario.personajes.push(nuevoPersonaje);
    await d1GuardarCuentaCompleta(d1, targetAcc, true);

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: `Personaje "${nuevoPersonaje.nombre}" entregado al inventario de ${targetAcc.nombre}.`,
        personaje: nuevoPersonaje,
        targetId,
        inventario: targetAcc.inventario,
      }),
      { headers: cabecerasJson }
    );
  }

  if (pathname === '/api/admin/personajes/quitar' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);

    // Tanto Dev como Admin pueden retirar personajes exclusivos de inventarios
    if (!perm.esDev && !perm.esAdmin) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo Dev o Admin pueden retirar personajes de inventarios.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.targetId || '').trim().toLowerCase();
    const personajeId = String(body.personajeId || '').trim();
    const targetAcc = cuentas[targetId];
    if (!targetAcc) {
      return new Response(JSON.stringify({ ok: false, error: 'User no encontrado.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }

    if (targetAcc.inventario && Array.isArray(targetAcc.inventario.personajes)) {
      targetAcc.inventario.personajes = targetAcc.inventario.personajes.filter((p) => p.id !== personajeId);
      if (targetAcc.inventario.activoId === personajeId) {
        targetAcc.inventario.activoId = undefined;
        targetAcc.avatarRopa = 'ninguna';
        targetAcc.avatarRopaColor = undefined;
        targetAcc.avatarAura = 'ninguna';
      }
      await d1GuardarCuentaCompleta(d1, targetAcc, true);
    }

    return new Response(
      JSON.stringify({ ok: true, mensaje: 'Personaje retirado del inventario.', inventario: targetAcc.inventario }),
      { headers: cabecerasJson }
    );
  }

  if (pathname === '/api/admin/personajes/mover' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);

    // Tanto Dev como Admin pueden mover/transferir personajes exclusivos entre cuentas
    if (!perm.esDev && !perm.esAdmin) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo Dev o Admin pueden mover personajes entre users.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }

    const body = await request.json().catch(() => ({}));
    const fromId = String(body.fromId || '').trim().toLowerCase();
    const toId = String(body.toId || '').trim().toLowerCase();
    const personajeId = String(body.personajeId || '').trim();

    if (!fromId || !toId || fromId === toId) {
      return new Response(JSON.stringify({ ok: false, error: 'Selecciona origen y destino diferentes.' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }

    const origenAcc = cuentas[fromId];
    const destinoAcc = cuentas[toId];
    if (!origenAcc || !destinoAcc) {
      return new Response(JSON.stringify({ ok: false, error: 'User de origen o destino no encontrado.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }

    const listaOrigen = Array.isArray(origenAcc.inventario?.personajes) ? origenAcc.inventario.personajes : [];
    const charMovido = listaOrigen.find((p) => p.id === personajeId);
    if (!charMovido) {
      return new Response(JSON.stringify({ ok: false, error: 'El personaje ya no existe en el inventario origen.' }), {
        status: 404,
        headers: cabecerasJson,
      });
    }

    origenAcc.inventario.personajes = listaOrigen.filter((p) => p.id !== personajeId);
    if (origenAcc.inventario.activoId === personajeId) {
      origenAcc.inventario.activoId = undefined;
      origenAcc.avatarRopa = 'ninguna';
      origenAcc.avatarRopaColor = undefined;
      origenAcc.avatarAura = 'ninguna';
    }

    if (!destinoAcc.inventario || typeof destinoAcc.inventario !== 'object') {
      destinoAcc.inventario = { personajes: [] };
    }
    if (!Array.isArray(destinoAcc.inventario.personajes)) {
      destinoAcc.inventario.personajes = [];
    }
    destinoAcc.inventario.personajes.push({
      ...charMovido,
      fechaAdquisicion: new Date().toISOString(),
    });

    await d1GuardarCuentaCompleta(d1, origenAcc, false);
    await d1GuardarCuentaCompleta(d1, destinoAcc, true);

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: `"${charMovido.nombre}" movido de ${origenAcc.nombre} a ${destinoAcc.nombre}.`,
        inventarioOrigen: origenAcc.inventario,
        inventarioDestino: destinoAcc.inventario,
      }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 4h. PREMIO SEMANAL, CONFIG SEMANAL & DESBLOQUEOS
  // ==========================================
  if (pathname === '/api/admin/premio-semanal' || pathname === '/api/admin/personajes/fijar-premio-semanal') {
    const w = obtenerInfoSemana();
    const defaultPremio = {
      id: 'premio_dragon_dorado',
      nombre: 'Dragón Imperial Dorado',
      color: '#ffd43b',
      hat: 'dragon',
      ropa: 'armadura',
      ropaColor: '#ffd43b',
      aura: 'arcoiris',
      descripcion: 'Premio exclusivo del Torneo Semanal',
      origen: {
        tipo: 'torneo_semanal',
        otorgadoPor: `Torneo Semanal ${w.semanaActualId}`,
        fecha: new Date().toISOString(),
      },
    };

    if (request.method === 'GET') {
      const premio = await d1LeerConfig(d1, 'premio_semanal_global', defaultPremio);
      return new Response(
        JSON.stringify({ ok: true, semanaId: w.semanaActualId, premio, premioSemanal: premio }),
        { headers: cabecerasJson }
      );
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env, d1);
      const cuentas = await d1ObtenerTodasCuentas(d1);
      const perm = await verificarPermisosLlamante(cuentas, sesion);

      if (!perm.esDev && !perm.esAdmin) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: cabecerasJson,
        });
      }

      const body = await request.json().catch(() => ({}));
      const raw = body.personaje || body.premio || body;
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

      await d1GuardarConfig(d1, 'premio_semanal_global', premio);
      await tocarUltimaActualizacion(d1);

      return new Response(
        JSON.stringify({ ok: true, mensaje: `Premio semanal "${premio.nombre}" guardado.`, premio, premioSemanal: premio }),
        { headers: cabecerasJson }
      );
    }
  }

  if (pathname === '/api/admin/config-semanal') {
    if (request.method === 'GET') {
      const cfg = await d1LeerConfig(d1, 'config_semanal_puntos', CONFIG_SEMANAL_POR_DEFECTO);
      const premioSemanal = await d1LeerConfig(d1, 'premio_semanal_global', null);
      return new Response(JSON.stringify({ ok: true, config: cfg, premioSemanal }), { headers: cabecerasJson });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env, d1);
      const cuentas = await d1ObtenerTodasCuentas(d1);
      const perm = await verificarPermisosLlamante(cuentas, sesion);

      if (!perm.esDev && !perm.esAdmin) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: cabecerasJson,
        });
      }

      const body = await request.json().catch(() => ({}));
      const cfg = {
        puntosVictoria: typeof body.puntosVictoria === 'number' ? Math.max(0, body.puntosVictoria) : 3,
        puntosEmpate: typeof body.puntosEmpate === 'number' ? Math.max(0, body.puntosEmpate) : 1,
        primerLugar: typeof body.primerLugar === 'number' ? Math.max(0, body.primerLugar) : 50,
        segundoLugar: typeof body.segundoLugar === 'number' ? Math.max(0, body.segundoLugar) : 25,
        tercerLugar: typeof body.tercerLugar === 'number' ? Math.max(0, body.tercerLugar) : 15,
        participacion: typeof body.participacion === 'number' ? Math.max(0, body.participacion) : 5,
      };

      await d1GuardarConfig(d1, 'config_semanal_puntos', cfg);
      await tocarUltimaActualizacion(d1);
      return new Response(JSON.stringify({ ok: true, config: cfg, mensaje: 'Puntos semanales guardados.' }), {
        headers: cabecerasJson,
      });
    }
  }

  if (pathname === '/api/admin/desbloqueos-personajes') {
    if (request.method === 'GET') {
      const raw = await d1LeerConfig(d1, 'config_desbloqueos_personajes', DESBLOQUEOS_POR_DEFECTO);
      const desbloqueos = { ...DESBLOQUEOS_POR_DEFECTO, ...(raw || {}) };
      return new Response(JSON.stringify({ ok: true, desbloqueos }), { headers: cabecerasJson });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env, d1);
      const cuentas = await d1ObtenerTodasCuentas(d1);
      const perm = await verificarPermisosLlamante(cuentas, sesion);

      if (!perm.esDev) {
        return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev puede configurar desbloqueos.' }), {
          status: 403,
          headers: cabecerasJson,
        });
      }

      const body = await request.json().catch(() => ({}));
      const entrante = body.desbloqueos || body || {};
      const limpio = { ...DESBLOQUEOS_POR_DEFECTO };
      for (const k of Object.keys(DESBLOQUEOS_POR_DEFECTO)) {
        if (typeof entrante[k] === 'number' && !isNaN(entrante[k])) {
          limpio[k] = Math.max(0, Math.round(entrante[k]));
        }
      }
      await d1GuardarConfig(d1, 'config_desbloqueos_personajes', limpio);
      await tocarUltimaActualizacion(d1);

      return new Response(
        JSON.stringify({ ok: true, desbloqueos: limpio, mensaje: 'Puntos de desbloqueo guardados.' }),
        { headers: cabecerasJson }
      );
    }
  }

  // ==========================================
  // 4i. SALAS PERSONALIZADAS EN LÍNEA (MOD / ADMIN / DEV)
  // ==========================================
  if (pathname === '/api/admin/salas-personalizadas' || pathname.startsWith('/api/admin/salas-personalizadas/')) {
    if (request.method === 'GET') {
      const salas = await d1LeerSalasPersonalizadas(d1);
      return new Response(JSON.stringify({ ok: true, salas }), { headers: cabecerasJson });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env, d1);
      const cuentas = await d1ObtenerTodasCuentas(d1);
      const perm = await verificarPermisosLlamante(cuentas, sesion);

      if (!perm.esMod && !perm.esAdmin && !perm.esDev) {
        return new Response(JSON.stringify({ ok: false, error: 'Solo el Staff (Mod, Admin, Dev) puede crear salas oficiales.' }), {
          status: 403,
          headers: cabecerasJson,
        });
      }

      const body = await request.json().catch(() => ({}));
      const codigo = normalizarCodigoSala(body.codigo);
      const nombre = String(body.nombre || `Sala Oficial ${codigo}`).trim();

      if (!codigo || codigo.length < 3) {
        return new Response(JSON.stringify({ ok: false, error: 'El código debe tener al menos 3 caracteres.' }), {
          status: 400,
          headers: cabecerasJson,
        });
      }

      const creadorRol = perm.esDev ? 'dev' : perm.esAdmin ? 'admin' : 'mod';
      const ahora = Date.now();
      const nuevaSala = {
        id: `sp_${codigo}`,
        codigo,
        nombre: nombre.slice(0, 32),
        creador: perm.actor?.nombre || 'Staff',
        creadorId: perm.actor?.id || 'admin',
        creadorRol,
        creadoEn: ahora,
        maxJugadores: body.maxJugadores === 4 ? 4 : 2,
        modoMuros: body.modoMuros === 'caos' ? 'caos' : (body.modoMuros === 'tactico' ? 'tactico' : 'estandar'),
        tamanoTablero: normalizarTamanoTablero(body.tamanoTablero),
        destacada: true,
        mensajeEspecial: String(body.mensajeEspecial || '').trim().slice(0, 80),
      };

      await d1GuardarSalaPersonalizada(d1, nuevaSala);

      // Persistir inmediatamente en D1 `salas_online` para disponibilidad multi-aislamiento
      await d1GuardarSalaOnline(d1, codigo, {
        codigo,
        nombre: nuevaSala.nombre,
        anfitrion: nuevaSala.creador,
        hostPeerId: `host_${codigo.toLowerCase()}`,
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

      const lista = await d1LeerSalasPersonalizadas(d1);
      await tocarUltimaActualizacion(d1);

      return new Response(
        JSON.stringify({ ok: true, sala: nuevaSala, salas: lista, mensaje: `Sala oficial "${nuevaSala.nombre}" creada.` }),
        { headers: cabecerasJson }
      );
    }

    if (request.method === 'DELETE') {
      const sesion = await resolverSesion(request, env, d1);
      const cuentas = await d1ObtenerTodasCuentas(d1);
      const perm = await verificarPermisosLlamante(cuentas, sesion);

      if (!perm.esMod && !perm.esAdmin && !perm.esDev) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: cabecerasJson,
        });
      }

      let codigo = '';
      if (pathname.startsWith('/api/admin/salas-personalizadas/')) {
        codigo = normalizarCodigoSala(decodeURIComponent(pathname.slice('/api/admin/salas-personalizadas/'.length)));
      }
      if (!codigo) {
        const body = await request.json().catch(() => ({}));
        codigo = normalizarCodigoSala(body.codigo);
      }

      if (codigo) {
        await d1EliminarSalaPersonalizada(d1, codigo);
        await tocarUltimaActualizacion(d1);
      }

      const lista = await d1LeerSalasPersonalizadas(d1);
      return new Response(JSON.stringify({ ok: true, salas: lista, mensaje: `Sala "${codigo}" eliminada.` }), {
        headers: cabecerasJson,
      });
    }
  }

  // ==========================================
  // 4j. SOLICITUDES Y REINICIO DE RANKING
  // ==========================================
  if (pathname === '/api/admin/ranking/solicitud-reset' && request.method === 'GET') {
    const solicitud = await d1LeerConfig(d1, 'solicitud_reset_ranking', null);
    return new Response(JSON.stringify({ ok: true, solicitud }), { headers: cabecerasJson });
  }

  if (pathname === '/api/admin/ranking/solicitar-reset') {
    if (request.method === 'GET') {
      const solicitud = await d1LeerConfig(d1, 'solicitud_reset_ranking', null);
      return new Response(JSON.stringify({ ok: true, solicitud }), { headers: cabecerasJson });
    }
    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env, d1);
      const cuentas = await d1ObtenerTodasCuentas(d1);
      const perm = await verificarPermisosLlamante(cuentas, sesion);

      if (!perm.esDev && !perm.esAdmin) {
        return new Response(JSON.stringify({ ok: false, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: cabecerasJson,
        });
      }

      const body = await request.json().catch(() => ({}));
      const solicitud = {
        solicitada: true,
        porNombre: perm.actor?.nombre || 'Admin',
        porId: perm.actor?.id || 'admin',
        motivo: String(body.motivo || 'Reinicio periódico del ranking').trim().slice(0, 140),
        fecha: new Date().toISOString(),
      };
      await d1GuardarConfig(d1, 'solicitud_reset_ranking', solicitud);
      await tocarUltimaActualizacion(d1);

      return new Response(JSON.stringify({ ok: true, mensaje: 'Solicitud enviada al Dev.', solicitud }), {
        headers: cabecerasJson,
      });
    }
  }

  async function ejecutarReinicioRankingD1() {
    if (!d1) return;
    await asegurarTablasD1(d1);
    const w = obtenerInfoSemana();
    await d1.prepare('DELETE FROM ranking').run();
    await d1
      .prepare('UPDATE historial SET puntos = 0, total_partida = 0, victorias = 0, derrotas = 0, empates = 0, actualizado_en = ?')
      .bind(Date.now())
      .run();
    await d1EliminarConfig(d1, 'solicitud_reset_ranking');
    await d1EliminarConfig(d1, `semanal_${w.semanaActualId}`);
    await d1GuardarConfig(d1, `semanal_${w.semanaPasadaId}`, { semanaId: w.semanaPasadaId, premiada: true, premiados: [] });
    await tocarUltimaActualizacion(d1);
  }

  if (pathname === '/api/admin/ranking/aprobar-reset' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);
    if (!perm.esDev) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev puede reiniciar el Ranking Global.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }
    await ejecutarReinicioRankingD1();
    return new Response(JSON.stringify({ ok: true, mensaje: 'Ranking reiniciado a 0 en D1.' }), { headers: cabecerasJson });
  }

  if (pathname === '/api/admin/ranking/rechazar-reset' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);
    if (!perm.esDev) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev puede rechazar solicitudes.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }
    await d1EliminarConfig(d1, 'solicitud_reset_ranking');
    await tocarUltimaActualizacion(d1);
    return new Response(JSON.stringify({ ok: true, mensaje: 'Solicitud de reinicio desestimada.' }), {
      headers: cabecerasJson,
    });
  }

  if (pathname === '/api/admin/ranking/resolver-solicitud' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const perm = await verificarPermisosLlamante(cuentas, sesion);
    if (!perm.esDev) {
      return new Response(JSON.stringify({ ok: false, error: 'Solo el Dev puede aprobar o rechazar.' }), {
        status: 403,
        headers: cabecerasJson,
      });
    }
    const body = await request.json().catch(() => ({}));
    if (body?.accion === 'aprobar') {
      await ejecutarReinicioRankingD1();
      return new Response(JSON.stringify({ ok: true, mensaje: 'Ranking reiniciado a 0 en D1.' }), { headers: cabecerasJson });
    }
    await d1EliminarConfig(d1, 'solicitud_reset_ranking');
    await tocarUltimaActualizacion(d1);
    return new Response(JSON.stringify({ ok: true, mensaje: 'Solicitud rechazada.' }), { headers: cabecerasJson });
  }

  // ==========================================
  // 5. GET / POST /api/ranking
  // ==========================================
  if (pathname === '/api/ranking') {
    if (request.method === 'GET') {
      const rank = await d1LeerRanking(d1);
      return new Response(JSON.stringify(rank), { headers: cabecerasJson });
    }

    if (request.method === 'POST') {
      const sesion = await resolverSesion(request, env, d1);
      const cuentas = await d1ObtenerTodasCuentas(d1);
      const perm = await verificarPermisosLlamante(cuentas, sesion);

      if (!perm.esDev && !perm.esAdmin) {
        return new Response(JSON.stringify({ ok: false, revoked: true, error: 'Permisos insuficientes.' }), {
          status: 403,
          headers: cabecerasJson,
        });
      }

      const body = await request.json().catch(() => ({}));
      if (Object.keys(body || {}).length === 0) {
        await ejecutarReinicioRankingD1();
        return new Response(JSON.stringify({ ok: true, dbBound }), { headers: cabecerasJson });
      }

      const w = obtenerInfoSemana();
      for (const [k, r] of Object.entries(body || {})) {
        if (!r || typeof r !== 'object') continue;
        const cleanId = String(r.id || k).trim().toLowerCase();
        const acc = cuentas[cleanId] || Object.values(cuentas).find((a) => a.nombre.trim().toLowerCase() === String(r.nombre || k).trim().toLowerCase());
        if (!acc) continue;

        await d1
          .prepare(`
            INSERT OR REPLACE INTO ranking (
              id, nombre, puntos, total_partida, victorias, derrotas, empates,
              avatar_color, avatar_hat, avatar_ropa, avatar_ropa_color, avatar_aura,
              semana_actual_id, semana_actual_pts, semana_actual_vic, semana_actual_part,
              semana_pasada_id, semana_pasada_pts, semana_pasada_premio, actualizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            acc.id,
            acc.nombre,
            Number(r.puntosTotales ?? r.puntos ?? acc.puntos) || 0,
            Number(r.partidas ?? acc.partidas) || 0,
            Number(r.victorias ?? acc.victorias) || 0,
            Number(r.derrotas ?? acc.derrotas) || 0,
            Number(r.empates ?? acc.empates) || 0,
            r.avatarColor || acc.avatarColor || '#ff6b6b',
            r.avatarHat || acc.avatarHat || 'corona',
            r.avatarRopa || acc.avatarRopa || 'ninguna',
            r.avatarRopaColor || acc.avatarRopaColor || null,
            r.avatarAura || acc.avatarAura || 'ninguna',
            w.semanaActualId,
            0,
            0,
            0,
            w.semanaPasadaId,
            0,
            null,
            Date.now()
          )
          .run();
      }
      await tocarUltimaActualizacion(d1);
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: cabecerasJson });
    }
  }

  // ==========================================
  // 5b. POST /api/partida y POST /api/partidas/sincronizar
  // ==========================================
  async function procesarPartidaUnificada(body, sesion, cuentas) {
    const w = obtenerInfoSemana();
    await d1AsegurarSemanaEnRanking(d1, w);
    const cfgSemanal = (await d1LeerConfig(d1, 'config_semanal_puntos', CONFIG_SEMANAL_POR_DEFECTO)) || CONFIG_SEMANAL_POR_DEFECTO;

    const partidaId = String(body.partidaId || body.matchId || `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`).trim();
    const fecha = typeof body.fecha === 'string' ? body.fecha : new Date().toISOString();
    const modo = String(body.modo || 'local').trim();
    const duracionSeg = Math.max(0, Number(body.duracionSeg) || 0);

    // Soportar tanto el nuevo formato `participantes[]` como respaldo legacy `cuentasPatch`
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

    const guardados = [];
    for (const p of participantes) {
      if (!p) continue;
      const buscadoId = String(p.cuentaId || '').trim().toLowerCase();
      let acc = buscadoId ? cuentas[buscadoId] : null;
      if (!acc && p.nombre) {
        const nomLower = String(p.nombre).trim().toLowerCase();
        acc = Object.values(cuentas).find((a) => String(a.nombre || '').trim().toLowerCase() === nomLower);
      }
      if (!acc) continue;

      const autorizado = sesion && !sesion.revocada && (sesion.userId === acc.id || sesion.rol === 'dev');
      if (!autorizado) continue;

      const histPrev = Array.isArray(acc.historialPartidas) ? acc.historialPartidas : [];
      if (histPrev.some((h) => h && h.id === partidaId)) {
        guardados.push(acc.id);
        continue; // Idempotente: no duplicar si ya se guardó (cola offline / reintento)
      }

      const MAX_PUNTOS_PARTIDA_MUROS = 35;
      const MAX_PUNTOS_DIARIOS_MUROS = 250;
      const hoyUtc = new Date().toISOString().slice(0, 10);
      const ptsHoy = histPrev.reduce((sum, h) => {
        if (!h || typeof h.fecha !== 'string') return sum;
        return h.fecha.slice(0, 10) === hoyUtc ? sum + Math.max(0, Number(h.puntos) || 0) : sum;
      }, 0);
      const cupoDiarioRestante = Math.max(0, MAX_PUNTOS_DIARIOS_MUROS - ptsHoy);

      const resultado = p.resultado === 'victoria' || p.resultado === 'empate' ? p.resultado : 'derrota';
      const puntosSolicitados = Math.max(0, Math.round(Number(p.puntosGanados) || 0));
      const puntosGanados = Math.min(puntosSolicitados, MAX_PUNTOS_PARTIDA_MUROS, cupoDiarioRestante);
      const ptsSemanalPartida =
        puntosGanados > 0
          ? puntosGanados
          : resultado === 'victoria'
          ? Math.min(cupoDiarioRestante, Number(cfgSemanal.puntosVictoria ?? 3))
          : resultado === 'empate'
          ? Math.min(cupoDiarioRestante, Number(cfgSemanal.puntosEmpate ?? 1))
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

      await d1GuardarCuentaCompleta(d1, acc, false);

      // Actualizar contadores semanales en la fila de `ranking`
      try {
        const filaRank = await d1.prepare('SELECT * FROM ranking WHERE id = ?').bind(acc.id).first();
        const mismoSem = filaRank?.semana_actual_id === w.semanaActualId;
        const nuevoSemPts = (mismoSem ? Number(filaRank?.semana_actual_pts) || 0 : 0) + ptsSemanalPartida;
        const nuevoSemVic = (mismoSem ? Number(filaRank?.semana_actual_vic) || 0 : 0) + (resultado === 'victoria' ? 1 : 0);
        const nuevoSemPart = (mismoSem ? Number(filaRank?.semana_actual_part) || 0 : 0) + 1;

        await d1
          .prepare(`
            UPDATE ranking SET
              semana_actual_id = ?,
              semana_actual_pts = ?,
              semana_actual_vic = ?,
              semana_actual_part = ?,
              actualizado_en = ?
            WHERE id = ?
          `)
          .bind(w.semanaActualId, nuevoSemPts, nuevoSemVic, nuevoSemPart, Date.now(), acc.id)
          .run();
      } catch (err) {
        console.error('Error actualizando ranking semanal en D1:', err);
      }

      guardados.push(acc.id);
    }

    if (guardados.length > 0) {
      await tocarUltimaActualizacion(d1);
    }

    return guardados;
  }

  if (pathname === '/api/partida' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    if (!sesion || !sesion.userId || sesion.revocada) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Sesión no válida o expirada.', guardados: [] }),
        { status: 401, headers: cabecerasJson }
      );
    }
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const body = await request.json().catch(() => ({}));
    const guardados = await procesarPartidaUnificada(body, sesion, cuentas);

    if (guardados.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          dbBound,
          guardados,
          error: 'No autorizado o cuenta no encontrada para registrar esta partida.',
        }),
        { status: 403, headers: cabecerasJson }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dbBound,
        guardados,
        activeAccountIds: Object.keys(cuentas),
      }),
      { headers: cabecerasJson }
    );
  }

  if (pathname === '/api/partidas/sincronizar' && request.method === 'POST') {
    const sesion = await resolverSesion(request, env, d1);
    if (!sesion || !sesion.userId || sesion.revocada) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Sesión no válida o expirada.', sincronizadas: [] }),
        { status: 401, headers: cabecerasJson }
      );
    }
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const body = await request.json().catch(() => ({}));
    const cola = Array.isArray(body.partidas) ? body.partidas : [];
    const sincronizadas = [];

    for (const item of cola) {
      const g = await procesarPartidaUnificada(item, sesion, cuentas);
      if (g.length > 0) sincronizadas.push(item.partidaId || item.matchId);
    }

    return new Response(
      JSON.stringify({ ok: true, dbBound, sincronizadas }),
      { headers: cabecerasJson }
    );
  }

  // ==========================================
  // 5c. GET / POST /api/semanal (Calculado sobre `ranking` + liquidación semanal)
  // ==========================================
  if (pathname === '/api/semanal') {
    const w = obtenerInfoSemana();
    await d1AsegurarSemanaEnRanking(d1, w);
    const cuentas = await d1ObtenerTodasCuentas(d1);
    const cfg = (await d1LeerConfig(d1, 'config_semanal_puntos', CONFIG_SEMANAL_POR_DEFECTO)) || CONFIG_SEMANAL_POR_DEFECTO;
    const premioGlobal = await d1LeerConfig(d1, 'premio_semanal_global', null);

    const metaActual = (await d1LeerConfig(d1, `semanal_${w.semanaActualId}`, {})) || {};
    const metaPasada = (await d1LeerConfig(d1, `semanal_${w.semanaPasadaId}`, { premiada: false, premiados: [] })) || {};

    if (request.method === 'GET') {
      const filasRank = d1 ? await d1.prepare('SELECT * FROM ranking').all() : { results: [] };
      const jugadoresActual = {};
      const jugadoresPasada = {};

      for (const r of filasRank?.results || []) {
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

      // Respaldo hidratado desde historial de cuentas por si hubo cambio de semana o tabla nueva
      for (const acc of Object.values(cuentas)) {
        if (!acc || typeof acc !== 'object') continue;
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

      // Liquidación automática de premios de la semana pasada (si aún no se premió)
      if (!metaPasada.premiada) {
        const candidatos = Object.values(jugadoresPasada).filter((j) => j && j.partidas > 0 && j.puntos > 0);
        if (candidatos.length > 0) {
          candidatos.sort((a, b) => {
            if (b.puntos !== a.puntos) return b.puntos - a.puntos;
            if (b.victorias !== a.victorias) return b.victorias - a.victorias;
            return b.partidas - a.partidas;
          });

          const bonos = [
            Number(cfg.primerLugar ?? 50),
            Number(cfg.segundoLugar ?? 25),
            Number(cfg.tercerLugar ?? 15),
          ];
          const premiados = [];

          for (let i = 0; i < Math.min(3, candidatos.length); i++) {
            const cand = candidatos[i];
            const acc = cuentas[cand.id];
            if (!acc) continue;
            const bono = bonos[i] || 0;
            acc.puntos = (Number(acc.puntos) || 0) + bono;

            let personajePremio = undefined;
            const premioSemana = metaPasada.premioSemanal || premioGlobal;
            if (i === 0 && premioSemana && premioSemana.nombre) {
              if (!acc.inventario || typeof acc.inventario !== 'object') acc.inventario = { personajes: [] };
              if (!Array.isArray(acc.inventario.personajes)) acc.inventario.personajes = [];
              const premioIdUnico = `${premioSemana.id}_${w.semanaPasadaId}`;
              const yaLoTiene = acc.inventario.personajes.some((p) => p.id === premioIdUnico || p.id === premioSemana.id);
              if (!yaLoTiene) {
                personajePremio = {
                  ...premioSemana,
                  id: premioIdUnico,
                  fechaAdquisicion: new Date().toISOString(),
                  origen: {
                    tipo: 'torneo_semanal',
                    otorgadoPor: `Campeón Torneo Semanal ${w.semanaPasadaId}`,
                    fecha: new Date().toISOString(),
                    semanaTorneo: w.semanaPasadaId,
                  },
                };
                acc.inventario.personajes.push(personajePremio);
                if (d1) {
                  await d1
                    .prepare('UPDATE ranking SET semana_pasada_premio = ? WHERE id = ?')
                    .bind(personajePremio.nombre, acc.id)
                    .run();
                }
              }
            }
            await d1GuardarCuentaCompleta(d1, acc, false);
            premiados.push({ nombre: acc.nombre, puesto: i + 1, bono, personajePremio });
          }

          metaPasada.premiada = true;
          metaPasada.premiados = premiados;
          await d1GuardarConfig(d1, `semanal_${w.semanaPasadaId}`, metaPasada);
          await tocarUltimaActualizacion(d1);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          dbBound,
          semanaActualId: w.semanaActualId,
          semanaPasadaId: w.semanaPasadaId,
          cierraEnMs: w.cierraEnMs,
          actual: {
            semanaId: w.semanaActualId,
            premioSemanal: metaActual.premioSemanal || premioGlobal || undefined,
            puntosConfig: {
              primerLugar: Number(cfg.primerLugar ?? 50),
              segundoLugar: Number(cfg.segundoLugar ?? 25),
              tercerLugar: Number(cfg.tercerLugar ?? 15),
            },
            jugadores: jugadoresActual,
          },
          pasada: {
            semanaId: w.semanaPasadaId,
            premiada: Boolean(metaPasada.premiada),
            premiados: Array.isArray(metaPasada.premiados) ? metaPasada.premiados : [],
            premioSemanal: metaPasada.premioSemanal || premioGlobal || undefined,
            jugadores: jugadoresPasada,
          },
        }),
        { headers: cabecerasJson }
      );
    }

    if (request.method === 'POST') {
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: cabecerasJson });
    }
  }

  // ==========================================
  // 6. SALAS ONLINE P2P PERSISTENTES EN D1 `salas_online`
  // ==========================================
  if (pathname === '/api/salas') {
    await d1LimpiarSalasExpiradas(d1);

    if (request.method === 'GET') {
      const filas = d1 ? await d1.prepare('SELECT data_json, ultimo_cambio FROM salas_online').all() : { results: [] };
      const ahora = Date.now();
      const validas = [];
      for (const f of filas?.results || []) {
        try {
          const r = JSON.parse(f.data_json);
          if (
            r &&
            r.publica !== false &&
            !r.enPartida &&
            (r.jugadoresConectados || 0) < (r.maxJugadores || 2) &&
            ahora - (Number(f.ultimo_cambio) || r.ultimoCambio || 0) < 15 * 60 * 1000
          ) {
            validas.push(r);
          }
        } catch {}
      }
      validas.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
      return new Response(JSON.stringify(validas), { headers: cabecerasJson });
    }

    if (request.method === 'POST') {
      const room = await request.json().catch(() => ({}));
      const ahora = Date.now();
      const codigo = normalizarCodigoSala(room?.codigo);
      if (!codigo) {
        return new Response(JSON.stringify({ ok: false, error: 'Código inválido' }), {
          status: 400,
          headers: cabecerasJson,
        });
      }

      const existente = await d1LeerSalaOnline(d1, codigo);
      const esPublica = room.publica !== undefined ? Boolean(room.publica) : existente?.publica ?? true;
      const hostPeerId = room.hostPeerId || existente?.hostPeerId || `host_${codigo.toLowerCase()}`;
      const maxJugadores = room.maxJugadores === 4 ? 4 : existente?.maxJugadores || 2;
      const anfitrion = String(room.anfitrion || existente?.anfitrion || 'Anfitrión').trim();
      const color = room.color || existente?.color || '#ff6b6b';
      const hat = room.hat || existente?.hat || 'corona';
      const ropa = room.ropa || existente?.ropa || 'ninguna';
      const ropaColor = room.ropaColor || existente?.ropaColor;
      const aura = room.aura || existente?.aura || 'ninguna';

      const listaHostPorDefecto = [
        {
          id: 0,
          peerId: hostPeerId,
          cuentaId: room.cuentaId || undefined,
          nombre: anfitrion,
          color,
          hat,
          ropa,
          ropaColor,
          aura,
          listo: true,
          conectado: true,
          esAnfitrion: true,
        },
      ];

      const jugadores =
        Array.isArray(room.jugadores) && room.jugadores.length > 0
          ? room.jugadores
          : existente?.jugadores?.length
          ? existente.jugadores
          : listaHostPorDefecto;

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

      await d1GuardarSalaOnline(d1, codigo, salaCompleta);
      return new Response(JSON.stringify({ ok: true, dbBound, sala: salaCompleta, timestamp: ahora }), {
        headers: cabecerasJson,
      });
    }
  }

  if (pathname.startsWith('/api/salas/')) {
    const rest = pathname.slice('/api/salas/'.length);
    const partes = rest.split('/').filter(Boolean);
    const codigo = normalizarCodigoSala(decodeURIComponent(partes[0] || ''));
    const subaccion = partes[1] || '';

    if (!codigo) {
      return new Response(JSON.stringify({ ok: false, error: 'Código vacío' }), {
        status: 400,
        headers: cabecerasJson,
      });
    }

    // GET /api/salas/:codigo
    if (!subaccion && request.method === 'GET') {
      const sala = await d1LeerSalaOnline(d1, codigo);
      if (!sala) {
        return new Response(JSON.stringify({ ok: false, error: 'Sala no disponible' }), {
          status: 404,
          headers: cabecerasJson,
        });
      }
      const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
      const peerId = (url.searchParams.get('peerId') || '').trim();
      const mensajesNuevos = Array.isArray(sala.mensajes)
        ? sala.mensajes.filter(
            (m) => m && m.seq > since && (!peerId || m.from !== peerId) && (!m.to || m.to === peerId)
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
            modoMuros: sala.modoMuros,
            tamanoTablero: normalizarTamanoTablero(sala.tamanoTablero),
            esOficialStaff: Boolean(sala.esOficialStaff),
            mensajesNuevos,
          },
        }),
        { headers: cabecerasJson }
      );
    }

    // POST /api/salas/:codigo/join
    if (subaccion === 'join' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const peerId = String(body.peerId || '').trim();
      const cuentaId = body.cuentaId ? String(body.cuentaId).trim().toLowerCase() : undefined;
      const nombre = String(body.nombre || 'Invitado').trim() || 'Invitado';
      const color = body.color || '#4dabf7';
      const hat = body.hat || 'pompon';
      const ropa = body.ropa || 'ninguna';
      const ropaColor = body.ropaColor || undefined;
      const aura = body.aura || 'ninguna';
      const offer = body.offer || null;

      if (!peerId) {
        return new Response(JSON.stringify({ ok: false, error: 'Falta peerId' }), {
          status: 400,
          headers: cabecerasJson,
        });
      }

      const resultado = await d1ActualizarSalaAtomica(d1, codigo, (sala) => {
        if (!Array.isArray(sala.jugadores)) sala.jugadores = [];
        if (!sala.signals || typeof sala.signals !== 'object') sala.signals = {};

        let existente = sala.jugadores.find((p) => p.peerId === peerId);
        if (!existente && sala.enPartida) {
          const porNombre = sala.jugadores.find(
            (p) => !p.esAnfitrion && String(p.nombre || '').toLowerCase() === nombre.toLowerCase()
          );
          if (porNombre) {
            porNombre.peerId = peerId;
            porNombre.conectado = true;
            existente = porNombre;
          } else {
            return { abort: true, status: 409, error: 'La partida en esta sala ya comenzó.' };
          }
        }

        let esAnfitrionResultado = false;
        if (existente) {
          existente.nombre = nombre;
          existente.cuentaId = cuentaId || existente.cuentaId;
          existente.color = color || existingColor(existente.color);
          existente.hat = hat || existente.hat;
          existente.ropa = ropa || existente.ropa || 'ninguna';
          existente.ropaColor = ropaColor !== undefined ? ropaColor : existente.ropaColor;
          existente.aura = aura || existente.aura || 'ninguna';
          existente.conectado = true;
          esAnfitrionResultado = Boolean(existente.esAnfitrion);
        } else {
          if (sala.jugadores.length >= (sala.maxJugadores || 2)) {
            return { abort: true, status: 409, error: 'La sala ya está llena.' };
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
          sala.signals[peerId] = {
            ...(sala.signals[peerId] || {}),
            offer,
            answer: null,
            updatedAt: Date.now(),
          };
        }

        sala.jugadoresConectados = sala.jugadores.length;
        return { esAnfitrion: esAnfitrionResultado };
      });

      if (!resultado.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: resultado.status === 404 ? `La sala ${codigo} no existe o el anfitrión ya la cerró.` : resultado.error,
          }),
          { status: resultado.status || 409, headers: cabecerasJson }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, sala: resultado.sala, esAnfitrion: Boolean(resultado.extra?.esAnfitrion) }),
        { headers: cabecerasJson }
      );
    }

    // POST /api/salas/:codigo/signal
    if (subaccion === 'signal' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const clientPeerId = String(body.clientPeerId || '').trim();
      if (!clientPeerId) {
        const sala = await d1LeerSalaOnline(d1, codigo);
        if (!sala) {
          return new Response(JSON.stringify({ ok: false, error: 'Sala no disponible' }), {
            status: 404,
            headers: cabecerasJson,
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: cabecerasJson });
      }

      const resultado = await d1ActualizarSalaAtomica(d1, codigo, (sala) => {
        if (!sala.signals || typeof sala.signals !== 'object') sala.signals = {};
        const prev = sala.signals[clientPeerId] || {};
        sala.signals[clientPeerId] = {
          ...prev,
          ...(body.offer !== undefined ? { offer: body.offer } : {}),
          ...(body.answer !== undefined ? { answer: body.answer } : {}),
          updatedAt: Date.now(),
        };
      });

      if (!resultado.ok) {
        return new Response(JSON.stringify({ ok: false, error: resultado.error || 'Sala no disponible' }), {
          status: resultado.status || 404,
          headers: cabecerasJson,
        });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: cabecerasJson });
    }

    // POST /api/salas/:codigo/msg
    if (subaccion === 'msg' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body || !body.msg) {
        const sala = await d1LeerSalaOnline(d1, codigo);
        if (!sala) {
          return new Response(JSON.stringify({ ok: false, error: 'Sala no disponible' }), {
            status: 404,
            headers: cabecerasJson,
          });
        }
        return new Response(JSON.stringify({ ok: true, seq: sala.seq || 0 }), { headers: cabecerasJson });
      }

      const resultado = await d1ActualizarSalaAtomica(d1, codigo, (sala) => {
        sala.seq = (sala.seq || 0) + 1;
        if (!Array.isArray(sala.mensajes)) sala.mensajes = [];
        sala.mensajes.push({
          seq: sala.seq,
          from: String(body.from || ''),
          to: body.to ? String(body.to) : null,
          msg: body.msg,
          ts: Date.now(),
        });
        if (sala.mensajes.length > 40) sala.mensajes = sala.mensajes.slice(-40);
        if (body.msg.type === 'START_GAME') {
          sala.enPartida = true;
        }
        return { seq: sala.seq };
      });

      if (!resultado.ok) {
        return new Response(JSON.stringify({ ok: false, error: resultado.error || 'Sala no disponible' }), {
          status: resultado.status || 404,
          headers: cabecerasJson,
        });
      }
      return new Response(JSON.stringify({ ok: true, seq: resultado.extra?.seq || 0 }), { headers: cabecerasJson });
    }

    // POST /api/salas/:codigo/leave
    if (subaccion === 'leave' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const peerId = String(body.peerId || '').trim();
      const nombre = String(body.nombre || 'El otro jugador').trim();
      const jugadorId = typeof body.jugadorId === 'number' ? body.jugadorId : 1;

      await d1ActualizarSalaAtomica(d1, codigo, (sala) => {
        if (!sala.enPartida && Array.isArray(sala.jugadores)) {
          sala.jugadores = sala.jugadores.filter((p) => (sala.esOficialStaff ? p.peerId !== peerId : (p.esAnfitrion || p.peerId !== peerId)));
          sala.jugadores.forEach((p, idx) => {
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
          const saliente = sala.jugadores.find((p) => p.peerId === peerId || p.id === jugadorId);
          if (saliente) saliente.conectado = false;
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
        if (sala.mensajes.length > 40) sala.mensajes = sala.mensajes.slice(-40);
      });
      return new Response(JSON.stringify({ ok: true }), { headers: cabecerasJson });
    }

    // DELETE /api/salas/:codigo
    if (!subaccion && request.method === 'DELETE') {
      await d1EliminarSalaOnline(d1, codigo);
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: cabecerasJson });
    }

    // PATCH /api/salas/:codigo
    if (!subaccion && request.method === 'PATCH') {
      const body = await request.json().catch(() => ({}));
      await d1ActualizarSalaAtomica(d1, codigo, (sala) => {
        if (typeof body.jugadoresConectados === 'number') sala.jugadoresConectados = body.jugadoresConectados;
        if (typeof body.enPartida === 'boolean') sala.enPartida = body.enPartida;
      });
      return new Response(JSON.stringify({ ok: true, dbBound }), { headers: cabecerasJson });
    }
  }

  return new Response(JSON.stringify({ error: 'Ruta API no encontrada' }), {
    status: 404,
    headers: cabecerasJson,
  });
}

function existingColor(c) {
  return c || '#4dabf7';
}

export { manejarPeticionApi, manejarPeticionApi as handleApiRequest };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.includes('/api/')) {
      return manejarPeticionApi(request, env);
    }
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }
    return new Response('Muros Locos API Worker activo (Cloudflare D1)', { status: 200 });
  },
};
