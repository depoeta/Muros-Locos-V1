import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// In-memory + file persistence for local development
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
    fs.writeFileSync(filePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Admin credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || 'muros2026';

// Ensure default admin user
let cuentasData = readJsonFile(CUENTAS_FILE, {});
if (!cuentasData[ADMIN_USERNAME]) {
  cuentasData[ADMIN_USERNAME] = {
    id: ADMIN_USERNAME,
    nombre: 'Admin Supremo',
    clave: ADMIN_SECRET_KEY,
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
  writeJsonFile(CUENTAS_FILE, cuentasData);
} else if (cuentasData[ADMIN_USERNAME].clave !== ADMIN_SECRET_KEY) {
  cuentasData[ADMIN_USERNAME].clave = ADMIN_SECRET_KEY;
  writeJsonFile(CUENTAS_FILE, cuentasData);
}

// In-memory public rooms registry (with timestamp pruning)
let salasPublicas: Record<
  string,
  {
    codigo: string;
    nombre: string;
    anfitrion: string;
    color: string;
    hat: string;
    maxJugadores: number;
    creadoEn: number;
  }
> = readJsonFile(SALAS_FILE, {});

// Track last data modification timestamp
let lastKvUpdate = Date.now();

function cleanExpiredRooms() {
  const now = Date.now();
  let changed = false;
  for (const [code, r] of Object.entries(salasPublicas)) {
    const roomAny = r as any;
    // Rooms with 0 players that have been idle for > 60 seconds are removed
    if (roomAny.jugadoresConectados === 0 && now - (roomAny.ultimoCambio || roomAny.creadoEn) > 60 * 1000) {
      delete salasPublicas[code];
      changed = true;
    }
    // Hard limit: rooms older than 30 minutes get pruned
    else if (now - r.creadoEn > 30 * 60 * 1000) {
      delete salasPublicas[code];
      changed = true;
    }
  }
  if (changed) {
    writeJsonFile(SALAS_FILE, salasPublicas);
  }
}

// 0. Ping / Heartbeat API for real-time status and KV change detection
app.get('/api/ping', (req, res) => {
  cleanExpiredRooms();
  res.setHeader('X-KV-Bound', 'true');
  res.json({
    ok: true,
    kvBound: true,
    timestamp: Date.now(),
    lastUpdate: lastKvUpdate,
    salasCount: Object.keys(salasPublicas).length,
    cuentasCount: Object.keys(cuentasData).length,
  });
});

app.post('/api/admin/verify', (req, res) => {
  const { usuario, clave } = req.body || {};
  const trimmedKey = String(clave || '').trim();
  const trimmedUser = String(usuario || '').trim();

  // 1. Cloud Secret Key
  if (trimmedKey === ADMIN_SECRET_KEY) {
    return res.json({ ok: true, isCloudAdmin: true, level: 'cloud_kv' });
  }

  // 2. Local default credentials (admin / muros2026) -> local only
  if (trimmedKey === 'muros2026' && (trimmedUser === 'admin' || !trimmedUser)) {
    return res.json({
      ok: true,
      isCloudAdmin: false,
      localOnly: true,
      level: 'local_only',
      message: 'Acceso concedido exclusivamente para administración local.',
    });
  }

  // 3. User account with rol === 'admin'
  cuentasData = readJsonFile(CUENTAS_FILE, {});
  const userAcc = cuentasData[trimmedUser];
  if (userAcc && userAcc.clave === trimmedKey && userAcc.rol === 'admin') {
    return res.json({ ok: true, isCloudAdmin: true, level: 'cloud_kv' });
  }

  return res.status(401).json({ ok: false, error: 'Credenciales de administrador inválidas' });
});

// Verify action endpoint: checked before EVERY admin action
app.post('/api/admin/verify-action', (req, res) => {
  const { usuarioId, adminKey } = req.body || {};
  cuentasData = readJsonFile(CUENTAS_FILE, {});

  // 1. Master Cloud Key
  if (adminKey && String(adminKey).trim() === ADMIN_SECRET_KEY) {
    return res.json({ ok: true, isCloudAdmin: true });
  }

  // 2. Check if user is still an active admin in current database
  if (usuarioId && cuentasData[usuarioId]) {
    const acc = cuentasData[usuarioId];
    if (acc.rol === 'admin') {
      return res.json({ ok: true, isCloudAdmin: true });
    }
  }

  return res.status(403).json({
    ok: false,
    revoked: true,
    error: 'El usuario ya no tiene permisos de administrador en la base de datos.',
  });
});

// 1. Cuentas API
app.get('/api/cuentas', (req, res) => {
  const data = readJsonFile(CUENTAS_FILE, {});
  res.setHeader('X-KV-Bound', 'true');
  res.json(data);
});

app.post('/api/cuentas', (req, res) => {
  const body = req.body;
  writeJsonFile(CUENTAS_FILE, body);
  lastKvUpdate = Date.now();
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, source: 'local_kv_store', kv_bound: true, lastUpdate: lastKvUpdate });
});

// 2. Ranking API
app.get('/api/ranking', (req, res) => {
  const data = readJsonFile(RANKING_FILE, {});
  res.setHeader('X-KV-Bound', 'true');
  res.json(data);
});

app.post('/api/ranking', (req, res) => {
  const body = req.body;
  writeJsonFile(RANKING_FILE, body);
  lastKvUpdate = Date.now();
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, source: 'local_kv_store', kv_bound: true, lastUpdate: lastKvUpdate });
});

// 3. Salas Públicas API
app.get('/api/salas', (req, res) => {
  salasPublicas = readJsonFile(SALAS_FILE, {});
  cleanExpiredRooms();
  res.setHeader('X-KV-Bound', 'true');
  res.json(Object.values(salasPublicas));
});

app.post('/api/salas', (req, res) => {
  salasPublicas = readJsonFile(SALAS_FILE, {});
  cleanExpiredRooms();
  const room = req.body;
  if (room && room.codigo) {
    salasPublicas[room.codigo] = {
      ...room,
      creadoEn: Date.now(),
      ultimoCambio: Date.now(),
      jugadoresConectados: typeof room.jugadoresConectados === 'number' ? room.jugadoresConectados : 1,
    };
    writeJsonFile(SALAS_FILE, salasPublicas);
    lastKvUpdate = Date.now();
  }
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true });
});

// Update room player count or heartbeat
app.patch('/api/salas/:codigo', (req, res) => {
  salasPublicas = readJsonFile(SALAS_FILE, {});
  const code = req.params.codigo;
  if (code && salasPublicas[code]) {
    const current = salasPublicas[code] as any;
    const { jugadoresConectados } = req.body || {};
    salasPublicas[code] = {
      ...current,
      jugadoresConectados: typeof jugadoresConectados === 'number' ? jugadoresConectados : current.jugadoresConectados,
      ultimoCambio: Date.now(),
    };
    writeJsonFile(SALAS_FILE, salasPublicas);
  }
  cleanExpiredRooms();
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true });
});

app.delete('/api/salas/:codigo', (req, res) => {
  salasPublicas = readJsonFile(SALAS_FILE, {});
  const code = req.params.codigo;
  if (code && salasPublicas[code]) {
    delete salasPublicas[code];
    writeJsonFile(SALAS_FILE, salasPublicas);
    lastKvUpdate = Date.now();
  }
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true });
});

async function start() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
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
