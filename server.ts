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

// Ensure default admin user
let cuentasData = readJsonFile(CUENTAS_FILE, {});
if (!cuentasData['admin']) {
  cuentasData['admin'] = {
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

function cleanExpiredRooms() {
  const now = Date.now();
  let changed = false;
  for (const [code, r] of Object.entries(salasPublicas)) {
    // Rooms older than 30 minutes get cleaned up
    if (now - r.creadoEn > 30 * 60 * 1000) {
      delete salasPublicas[code];
      changed = true;
    }
  }
  if (changed) {
    writeJsonFile(SALAS_FILE, salasPublicas);
  }
}

// 1. Cuentas API
app.get('/api/cuentas', (req, res) => {
  const data = readJsonFile(CUENTAS_FILE, {});
  res.setHeader('X-KV-Bound', 'true');
  res.json(data);
});

app.post('/api/cuentas', (req, res) => {
  const body = req.body;
  writeJsonFile(CUENTAS_FILE, body);
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, source: 'local_kv_store', kv_bound: true });
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
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true, source: 'local_kv_store', kv_bound: true });
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
    };
    writeJsonFile(SALAS_FILE, salasPublicas);
  }
  res.setHeader('X-KV-Bound', 'true');
  res.json({ ok: true });
});

app.delete('/api/salas/:codigo', (req, res) => {
  salasPublicas = readJsonFile(SALAS_FILE, {});
  const code = req.params.codigo;
  if (code && salasPublicas[code]) {
    delete salasPublicas[code];
    writeJsonFile(SALAS_FILE, salasPublicas);
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
