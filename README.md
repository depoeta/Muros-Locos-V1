# Muros Locos

Juego web de estrategia por turnos para **2 o 4 jugadores** (e incluye el pasatiempo de lógica **Candado**), con soporte para partidas locales, bots, modo torneo, salas online P2P, ranking y personalización de avatares.

---

## ¿Cómo funciona el juego?

### Muros Locos
- **Objetivo:** Llevar tu avatar desde tu borde inicial hasta el borde opuesto del tablero antes que tus rivales.
- **Tableros:** `5×5`, `7×7` o `9×9`.
- **En tu turno puedes elegir una de dos acciones:**
  1. **Mover tu avatar:** Avanza 1 casilla en vertical u horizontal (o salta sobre un jugador adyacente si está en tu camino).
  2. **Colocar un muro:** Ubica una barrera de 2 casillas para desviar o frenar a los oponentes. Siempre debe quedar al menos un camino válido hacia la meta para cada jugador.
- **Modos:** Partida Rápida (local o contra bots), Modo Torneo y Salas Online (P2P).

### Candado
- Pasatiempo de deducción para descubrir combinaciones numéricas ocultas en modo **Candado Lógico** o **Mayor / Menor**, en solitario o duelo online 1v1.

---

## Cómo descargarlo y correrlo en local

**Requisitos:** [Node.js](https://nodejs.org/) (v18 o superior).

1. Clona el repositorio e instala las dependencias:
   ```bash
   git clone <URL_DE_TU_REPOSITORIO>
   cd muros-locos
   npm install
   ```
2. *(Opcional)* Crea un archivo `.env` a partir de `.env.example` si deseas personalizar las credenciales del panel de administración:
   ```bash
   cp .env.example .env
   ```
3. Inicia la aplicación en modo desarrollo:
   ```bash
   npm run dev
   ```
4. Abre `http://localhost:3000` en tu navegador.

---

## Cómo desplegarlo en Cloudflare Pages con GitHub

El proyecto ya incluye la función `/functions/api/[[route]].ts` conectada a `cloudflare-worker.js` para servir tanto el frontend como la API sobre **Cloudflare Pages + D1**.

1. **Sube este proyecto a tu repositorio en GitHub.**
2. En **Cloudflare Dashboard**, ve a **Workers & Pages → Create → Pages → Connect to Git** y selecciona tu repositorio:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Crea y enlaza una base de datos D1:**
   - Crea una base de datos D1 en **Storage & Databases → D1 SQL Database**.
   - En tu proyecto de Pages ve a **Settings → Functions → D1 database bindings** y añade un binding llamado **`DB`** apuntando a tu base de datos (las tablas se crean automáticamente).
4. **Configura las variables de entorno** en **Settings → Environment variables**:
   - `ADMIN_USERNAME` (por ejemplo: `admin`)
   - `ADMIN_SECRET_KEY` (tu contraseña secreta de administrador)
5. Guarda y despliega (**Save and Deploy**). A partir de ese momento, cada `git push` actualizará la web automáticamente.
