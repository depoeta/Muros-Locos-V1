# MUROS LOCOS — Especificación completa del juego

> **Para la IA que lea esto (Google AI Studio):** este documento es la especificación completa de un juego de mesa digital. Tu tarea es **implementarlo entero** como una aplicación web que funcione sin servidor. Todo lo que necesitas está aquí: reglas, lógica, algoritmos, sistema de puntos, ranking, manejo de errores, diseño visual, animaciones y criterios de aceptación. Si algo no está definido, elige la opción más sencilla y coherente con el resto del documento. No dejes funciones a medias ni "TODO": entrega todo funcionando.

---

## 0. Instrucciones de entrega (léelas primero)

1. Entrega una aplicación web **autocontenida**, sin backend y sin claves de API. Debe poder abrirse y jugarse directamente.
2. Tecnología recomendada: **un único `index.html`** con HTML + CSS + JavaScript puro (sin frameworks). Si el entorno obliga a usar React/TypeScript, mantén exactamente la misma lógica, separando el motor del juego (puro, sin interfaz) de la capa visual.
3. No uses imágenes externas. Todos los gráficos son **SVG inline y CSS** (estilo cartoon 2D). Nada en 3D.
4. El sonido se genera con **WebAudio** (osciladores), sin archivos de audio.
5. Idioma de la interfaz: **español**.
6. El juego es **local** (varios amigos en el mismo dispositivo, por turnos) y también permite **bots**. No hay multijugador en línea.
7. Guarda datos en `localStorage` (con `try/catch`; si falla, usa memoria y avisa al usuario).
8. Funciona en móvil y ordenador (táctil y ratón). Debe verse bien desde 320 px de ancho.
9. Al terminar, revisa la lista de criterios de aceptación de la sección 17 y comprueba cada punto.

---

## 1. Concepto

**Muros Locos** es un juego de estrategia por turnos para **2 o 4 jugadores** (humanos y/o bots) inspirado en los clásicos juegos de carrera con muros. Cada jugador controla un personajito cartoon en un tablero de **9×9 casillas**. Gana quien llegue primero al **lado opuesto** del tablero.

En su turno, el jugador **hace una sola cosa**: mueve su personaje una casilla **o** coloca un muro para alargar el camino de los demás. La gracia está en que **nunca se puede cerrar del todo el camino** a nadie: siempre debe quedar al menos una ruta.

Tono del juego: alegre, colorido, divertido, tipo dibujo animado. Pensado para jugar con amigos, con reacciones y risas.

---

## 2. Reglas del juego (autoridad máxima)

### 2.1 Tablero

- Cuadrícula de **9 filas × 9 columnas** (filas 0–8 de arriba abajo; columnas 0–8 de izquierda a derecha).
- Entre casillas hay **ranuras** (huecos finos) donde se colocan los muros.
- Hay **8×8 = 64 intersecciones** posibles donde puede centrarse un muro (índices `r` y `c` de 0 a 7).

### 2.2 Jugadores, posiciones y metas

**Partida de 2 jugadores** (orden de turno: J1, J2):

| Jugador | Color | Sombrero | Sale de | Meta |
|---|---|---|---|---|
| J1 | Rojo `#ff6b6b` | Corona | fila 8, col 4 (abajo centro) | cualquier casilla de la fila 0 |
| J2 | Azul `#4dabf7` | Gorro con pompón | fila 0, col 4 (arriba centro) | cualquier casilla de la fila 8 |

**Partida de 4 jugadores** (orden de turno: J1, J2, J3, J4, en sentido de las agujas del reloj):

| Jugador | Color | Sombrero | Sale de | Meta |
|---|---|---|---|---|
| J1 | Rojo `#ff6b6b` | Corona | fila 8, col 4 (abajo) | fila 0 |
| J2 | Azul `#4dabf7` | Gorro con pompón | fila 4, col 0 (izquierda) | columna 8 |
| J3 | Amarillo `#ffd43b` | Antena con bola roja | fila 0, col 4 (arriba) | fila 8 |
| J4 | Verde `#51cf66` | Brote de hojas | fila 4, col 8 (derecha) | columna 0 |

- La **franja de meta** de cada jugador se pinta en el tablero con el color del jugador (tinte suave) para que todos sepan a dónde va cada uno.
- Muros disponibles por jugador: **10 muros** en partidas de 2, **5 muros** en partidas de 4. Los muros **no se recuperan**.
- Empieza siempre el J1 (opción en ajustes: "empieza un jugador al azar").

### 2.3 El turno

Elige **una** de estas acciones:

**A) Mover el personaje**
- Una casilla en vertical u horizontal (no en diagonal, salvo en el caso especial de salto).
- No se puede atravesar un muro.
- No se puede salir del tablero.
- No se puede acabar en una casilla ocupada.

**B) Colocar un muro** (si quedan muros)
- Ocupa exactamente 2 casillas de largo (horizontal o vertical) y se coloca en las ranuras.
- No puede solaparse ni cruzarse con otro muro.
- **No puede cortar por completo el acceso a la meta de ningún jugador** (ver 2.6).

### 2.4 Saltos

Si el personaje contrario está justo al lado en la dirección en que quieres moverte:

1. **Salto recto:** puedes saltarlo y caer en la casilla inmediatamente detrás, **si** entre ambos no hay muro, esa casilla está dentro del tablero y está libre.
2. **Salto diagonal:** si no es posible el salto recto (porque detrás hay un muro, el borde del tablero u otro personaje), puedes ir a una de las dos casillas **laterales** al personaje saltado (perpendiculares a tu dirección), siempre que no haya muro entre el personaje saltado y esa casilla, y que esté libre.

### 2.5 Fin de la partida

- Gana el primer jugador que **pise cualquier casilla de su franja de meta**.
- La partida termina inmediatamente.

### 2.6 Regla del camino garantizado (muy importante)

Después de colocar un muro **hipotético**, para **cada** jugador (no solo para el rival) debe existir al menos un camino desde su posición actual hasta alguna casilla de su meta. El camino se calcula **ignorando a los demás personajes** (solo cuentan muros y bordes). Si algún jugador queda sin camino, el muro es **ilegal**.

### 2.7 Casos especiales

- **Jugador sin movimientos y sin muros:** pasa turno automáticamente, con mensaje ("X no puede moverse y pasa turno"). Esto puede pasar en 4 jugadores por bloqueos entre personajes.
- **Jugador sin movimientos pero con muros:** debe colocar un muro obligatoriamente (el modo "Mover" se muestra vacío y se avisa).
- **Sin muros restantes:** el botón de muro se desactiva con mensaje "¡Ya no te quedan muros!".
- **Empate:** imposible por diseño (el primero que llega gana). Si pasan **200 turnos totales** sin ganador (por ejemplo, todos pasando), se declara **empate** y se reparten puntos de empate (ver sección 7).

---

## 3. Modelo de datos (motor del juego)

Separa el **motor** (lógica pura, sin DOM) de la **interfaz**. El motor debe poder probarse solo.

```text
Partida {
  n: 2 | 4,
  jugadores: [ { r, c, muros, nombre, tipo, color, estadisticas } ],
  murosH: matriz 8x8,   // -1 = vacío, o índice del jugador dueño
  murosV: matriz 8x8,   // -1 = vacío, o índice del jugador dueño
  turnoActual: 0..n-1,
  turnosTotales: número,
  terminada: booleano,
  ganador: índice | null
}
```

**Convención de muros (cumple esto exactamente):**

- `murosH[r][c]` = muro **horizontal** situado **debajo de la fila `r`**, que ocupa las columnas `c` y `c+1`.
- `murosV[r][c]` = muro **vertical** situado a la **derecha de la columna `c`**, que ocupa las filas `r` y `r+1`.
- `r` y `c` van de 0 a 7.

**Tipos de jugador:** `humano`, `bot_facil`, `bot_normal`, `bot_dificil`.

**Historial:** guarda una copia (snapshot) del estado **antes de cada acción** para poder deshacer.

---

## 4. Algoritmos (pseudocódigo exacto)

### 4.1 ¿Hay muro bloqueando un paso?

Para pasar de la casilla `(r,c)` en la dirección `(dr,dc)`:

```text
bloqueado(r, c, dr, dc):
  si dr == -1 (arriba):   return H(r-1, c)  O  H(r-1, c-1)
  si dr == +1 (abajo):    return H(r,   c)  O  H(r,   c-1)
  si dc == +1 (derecha):  return V(r,   c)  O  V(r-1, c)
  si dc == -1 (izquierda):return V(r,   c-1) O V(r-1, c-1)

H(r,c) = (0 <= r < 8) Y (0 <= c < 8) Y murosH[r][c] != -1
V(r,c) = (0 <= r < 8) Y (0 <= c < 8) Y murosV[r][c] != -1
```

### 4.2 Movimientos legales (incluye saltos)

```text
movimientosLegales(jugador):
  resultado = []
  para cada dirección (dr,dc) en [(-1,0),(1,0),(0,-1),(0,1)]:
    si bloqueado(jugador.r, jugador.c, dr, dc): continuar
    (nr,nc) = (jugador.r+dr, jugador.c+dc)
    si fuera del tablero: continuar
    si nadie en (nr,nc): añadir (nr,nc); continuar
    // hay un personaje delante: intentar salto
    (jr,jc) = (nr+dr, nc+dc)
    si (jr,jc) dentro Y NO bloqueado(nr,nc,dr,dc) Y nadie en (jr,jc):
        añadir (jr,jc); continuar
    // salto recto imposible: diagonales
    laterales = si dr==0 entonces [(-1,0),(1,0)] sino [(0,-1),(0,1)]
    para cada (er,ec) en laterales:
      si NO bloqueado(nr,nc,er,ec):
        (sr,sc) = (nr+er, nc+ec)
        si dentro Y nadie en (sr,sc): añadir (sr,sc)
  devolver resultado
```

### 4.3 Camino más corto (BFS) a la meta, ignorando personajes

```text
distancia(jugador, desde = posición actual):
  cola = [desde]; visitado[desde] = 0
  mientras cola no vacía:
    actual = sacar primero
    si esMeta(jugador, actual): return visitado[actual]  // y camino si se pide
    para cada dirección: si no bloqueado y dentro y no visitado: añadir con +1
  return INFINITO
```

`esMeta(jugador, r, c)`: según la tabla de 2.2 (fila 0, fila 8, columna 0 o columna 8).

Para la **pista visual** se necesita también el camino (guardar el "anterior" de cada casilla y reconstruirlo).

### 4.4 Validación de muro

```text
validarMuro(orientación, r, c):
  si r o c fuera de 0..7:                       return "fuera"
  si murosH[r][c] != -1 O murosV[r][c] != -1:   return "solape"   // mismo sitio o cruce
  si orientación == H:
     si H(r, c-1) O H(r, c+1):                  return "solape"   // se solapa con contiguo
  si orientación == V:
     si V(r-1, c) O V(r+1, c):                  return "solape"
  colocar muro temporalmente
  para cada jugador: si distancia(jugador) == INFINITO: quitar muro; return "bloquea"
  quitar muro temporalmente
  return "ok"
```

Los códigos de resultado se traducen a mensajes de error en la sección 9.

### 4.5 Colocar un muro / mover

```text
ejecutarMovimiento(r,c): guardar snapshot; mover; contar salto si distancia Manhattan == 2 o diagonal; comprobar victoria; si no, pasar turno
ejecutarMuro(o,r,c):     guardar snapshot; muros--; marcar matriz; pasar turno
pasarTurno():            turnoActual = (turnoActual+1) % n; turnosTotales++
```

---

## 5. Inteligencia artificial (bots)

Tres niveles. Todos usan únicamente movimientos y muros **legales** (validados con 4.2 y 4.4).

### Bot Fácil
- 30 % de las veces mueve a una casilla legal aleatoria.
- Si no, avanza por el camino más corto.
- Solo usa muros con un 15 % de probabilidad y solo si el muro alarga al rival al menos 1 paso.

### Bot Normal
1. Calcula su distancia (`miD`) y la del rival más cercano a ganar (`rivalD`).
2. Busca la mejor casilla legal: la que minimiza su distancia restante (desempata al azar).
3. Si le quedan muros y `rivalD <= miD + 1`, evalúa **todos los muros válidos** (hasta 128 posiciones) y puntúa cada uno:
   `ganancia = (aumento de distancia del rival) − (aumento de distancia propia) + pequeño azar`
4. Pone el mejor muro si: `ganancia ≥ 2` y el rival no está muy atrás, o `rivalD ≤ 2` y `ganancia ≥ 1`, o `ganancia ≥ 3`. En otro caso, mueve.
5. En partidas de 4, el "rival" objetivo es el de menor distancia a su meta.

### Bot Difícil (opcional pero recomendado)
- Búsqueda tipo **minimax con poda alfa-beta de profundidad 2** (su jugada + respuesta del rival más peligroso).
- Evaluación: `(distancia_rival − distancia_propia) + 0,3 × (muros_propios − muros_rival)`.
- Limita el número de muros candidatos a los **12 mejores** por heurística para que responda en menos de 1 segundo.
- Si tarda demasiado (más de 1,5 s), cae a la lógica de Bot Normal.

### Comportamiento visual de los bots
- "Piensan" entre 0,9 y 1,4 segundos (con puntos animados "pensando…") antes de actuar, para que se sienta natural.
- Nunca se bloquean: si no hay jugada posible, pasan turno con mensaje.

---

## 6. Flujo de pantallas

```text
[Menú principal] → [Configuración de partida] → [Partida] → [Pantalla de victoria] → (Revancha | Menú | Ver tablero)
         ↓
   [Ranking] [Estadísticas] [Logros] [Ajustes] [Cómo se juega]
```

Las transiciones entre pantallas son **animadas** (fundido + deslizamiento + rebote suave, ~0,5 s). Nada aparece ni desaparece de golpe.

### 6.1 Menú principal
- Título animado "MUROS LOCOS" con letras de colores que botan una a una.
- Cuatro mascotas (los personajes) flotando.
- Botones: **Jugar**, **Ranking**, **Logros**, **Cómo se juega**, **Ajustes**.

### 6.2 Configuración de partida
- Selector deslizante **2 / 4 jugadores** (con píldora que se desliza).
- Una fila por jugador: personaje, **nombre** (máx. 12 caracteres), **tipo** (humano / bot fácil / bot normal / bot difícil).
- Las filas sobrantes se pliegan con animación al cambiar de 4 a 2.
- Opciones: "Empieza al azar", "Permitir deshacer", "Permitir pistas", "Modo con tiempo" (ver 6.5).
- Botón grande **¡Jugar!**.
- Validación: nombres vacíos se rellenan con el nombre por defecto; nombres repetidos se diferencian añadiendo "(2)"; al menos **un humano** salvo el modo "Espectáculo" (bots contra bots, útil para demos).

### 6.3 Pantalla de partida
- **Barra superior:** botón Menú, **mensaje de estado** (turno de quién / "piensa…"), botón de sonido.
- **Tarjetas de jugadores:** personaje, nombre, ladrillos (muros restantes), distancia a la meta ("👣 7"), puntos de la partida. La tarjeta del jugador activo **crece, se eleva y cambia de color** con una animación de rebote.
- **Tablero** con marco de madera, casillas alternas, franjas de meta tintadas.
- **Barra de acciones:** `🚶 Mover` | `🧱 Muro (n)` | (en modo muro: `🔄 Rotar` y `✔ Poner`) | `💡 Pista` | `↩ Deshacer`.
- Los botones se bloquean visualmente durante turnos de bots y animaciones.

### 6.4 Interacciones

**Mover:** las casillas legales muestran una **burbuja discontinua que pulsa y gira**. Al tocar una, el personaje salta hasta ella.

**Poner muro:**
- *Ratón:* en modo muro, al mover el cursor aparece una **vista previa fantasma** (verde = válido, roja = inválido). La orientación se deduce de qué ranura está más cerca del cursor, y se puede fijar con `Rotar` o la tecla `R`. Un clic confirma.
- *Táctil:* el primer toque sitúa la vista previa; se ajusta con `🔄 Rotar`; se confirma con `✔ Poner` o tocando de nuevo el mismo sitio.
- Si el muro es inválido: la vista previa **tiembla**, suena un tono de error y aparece un aviso con el motivo.

**Pista (💡):** muestra con puntos animados el camino más corto del jugador actual. Cuesta puntos (ver sección 7.4).

**Deshacer (↩):** revierte la última jugada **del jugador humano** (y las de bots posteriores). Cuesta puntos (7.4). Se desactiva si no hay historial.

**Atajos de teclado:** `W` muro · `M` mover · `R` rotar · `Enter` poner muro · `Z` deshacer · `P` pista · `Esc` cerrar ventanas · `Espacio` saltar animaciones (opcional).

### 6.5 Modo con tiempo (opcional, desactivado por defecto)
- 30 segundos por turno (configurable 15/30/60). Barra de tiempo que se vacía con color cambiante (verde → amarillo → rojo) y pequeño "temblor" en los últimos 5 s.
- Si se agota: el juego realiza **automáticamente** un paso por el camino más corto y el jugador recibe una penalización de puntos (7.4).

### 6.6 Pantalla de victoria
- Fondo oscurecido, tarjeta que entra con rebote y rotación.
- El personaje ganador **baila** y cae **confeti** de colores (canvas, ~5–7 s).
- Resumen: ganador, número de jugadas, **puntos obtenidos por cada jugador con desglose** (ver sección 7), nuevos logros desbloqueados, cambio en el ranking.
- Botones: **Revancha** (mismos jugadores), **Ver tablero**, **Menú**, **Ranking**.

---

## 7. Sistema de puntos

Los puntos premian ganar, pero también jugar bien. Se calculan **al terminar la partida** a partir de estadísticas que se van acumulando durante el juego. Muestra un **desglose animado** (los números suben contando) en la pantalla de victoria.

### 7.1 Puntos por resultado

| Situación | Partida de 2 | Partida de 4 |
|---|---|---|
| 1.º (ganador) | **+100** | **+150** |
| 2.º | +20 | +60 |
| 3.º | — | +35 |
| 4.º | — | +15 |

**Cómo se ordena a los que no ganan** (partidas de 4): por menor distancia restante a su meta; si empatan, por más muros sin gastar; si persiste, por orden de turno.

### 7.2 Bonificaciones (se suman)

| Bono | Puntos | Condición |
|---|---|---|
| **Ahorrador** | +5 por muro sin usar | Muros restantes al terminar (solo ganador) |
| **Rapidez** | +`max(0, 40 − turnos propios)` | Solo ganador; turnos propios = acciones del ganador |
| **Saltador** | +3 por salto, máx. +15 | Saltos sobre otros personajes |
| **Muro maestro** | +10 por muro, máx. +30 | Muro que aumenta ≥ 4 pasos la distancia del rival más cercano |
| **Remontada** | +25 | Ganar habiendo ido por detrás (distancia ≥ 4 pasos mayor que el rival en algún momento) |
| **Racha de victorias** | +10 × racha, máx. +50 | Victorias consecutivas contra humanos o bots |
| **Partida limpia** | +10 | Ganar sin deshacer, sin pistas y sin intentos de muro ilegal |

### 7.3 Multiplicador por dificultad (solo contra bots)

El total de la partida de un humano se multiplica según el bot más difícil al que se enfrenta:

| Rival | Multiplicador |
|---|---|
| Solo humanos | ×1,0 |
| Bot fácil | ×0,5 |
| Bot normal | ×1,0 |
| Bot difícil | ×1,5 |

En partidas mixtas se usa el multiplicador del bot más difícil. En 4 jugadores, +0,1 si hay más de un rival humano.

### 7.4 Penalizaciones (se restan, el total de la partida nunca baja de 0)

| Penalización | Puntos |
|---|---|
| Usar **pista** | −5 por uso |
| **Deshacer** una jugada | −10 por uso |
| Intento de **muro inválido** | −1 (máx. −10 por partida) |
| Turno agotado (modo con tiempo) | −8 |
| **Abandonar** una partida en curso | −20 |

### 7.5 Fórmula final

```text
puntosPartida(jugador) = max(0,
     (puntosResultado + sumaBonos − sumaPenalizaciones) × multiplicadorDificultad )
```

Redondear al entero más cercano. Los **bots no acumulan** puntos en el ranking (sí se muestran en el desglose para comparar).

### 7.6 Ejemplo resuelto
Partida a 2, humano vs bot normal. El humano gana en 22 acciones con 4 muros sin usar, 2 saltos, 1 muro maestro, usó 1 pista:
- Resultado 100 + Ahorrador 20 + Rapidez 18 + Saltador 6 + Muro maestro 10 − Pista 5 = **149**
- Multiplicador ×1,0 → **149 puntos**.

---

## 8. Ranking, niveles y logros

### 8.1 Ranking local (clasificación de amigos)

- Se identifica a cada jugador humano **por su nombre** (sin cuentas). El nombre es la clave (sin distinguir mayúsculas/minúsculas).
- Se guardan en `localStorage`, por jugador:

```text
{
  nombre, puntosTotales, partidas, victorias, derrotas, empates,
  rachaActual, mejorRacha, murosColocados, saltos,
  mejorPartida (puntos), partidaMasRapida (turnos),
  eloOpcional, fechaUltimaPartida, logros: [ids]
}
```

- **Pantalla de ranking** con pestañas: `Global`, `2 jugadores`, `4 jugadores`, `Esta semana`.
- Ordenación: **puntos totales** (desc.); desempate por % de victorias, luego por partidas jugadas.
- Cada fila: posición (🥇🥈🥉 para el podio), personaje/avatar, nombre, nivel/título, puntos, victorias/partidas y % de victorias.
- Las filas **entran con animación escalonada**; al terminar una partida, quien suba o baje puestos se **desliza hasta su nueva posición** con animación y una flechita ▲/▼ con el cambio.
- Botón **Borrar ranking** (con confirmación doble) y **Exportar / Importar** como archivo JSON.
- Para "Esta semana": se guarda también un registro de partidas con fecha para filtrar por los últimos 7 días.

### 8.2 Niveles y títulos (según puntos totales)

| Puntos totales | Título |
|---|---|
| 0 – 199 | 🥚 Novato |
| 200 – 599 | 🐣 Aprendiz de muros |
| 600 – 1.199 | 🧱 Albañil astuto |
| 1.200 – 2.399 | 🧭 Explorador del laberinto |
| 2.400 – 4.499 | 🧠 Estratega loco |
| 4.500 – 7.999 | 👑 Maestro de los muros |
| 8.000 o más | 🌟 Leyenda de Muros Locos |

Muestra una **barra de progreso** hacia el siguiente nivel; al subir de nivel hay una animación de celebración.

### 8.3 Logros (con insignias y animación al desbloquearse)

| ID | Logro | Condición |
|---|---|---|
| primera_vez | Primer paso | Jugar la primera partida |
| primera_victoria | ¡Victoria! | Ganar una partida |
| diez_victorias | Imparable | 10 victorias |
| racha_3 | En racha | 3 victorias seguidas |
| racha_7 | Intocable | 7 victorias seguidas |
| sin_muros | Corredor puro | Ganar sin colocar ningún muro |
| constructor | Constructor | Colocar 50 muros en total |
| saltarin | Saltarín | 25 saltos en total |
| remontada | De cero a héroe | Lograr el bono de Remontada |
| ultimo_segundo | Por los pelos | Ganar con el rival a 1 paso de la meta |
| bot_dificil | Domador de robots | Ganar al Bot Difícil |
| partida_limpia | Manos limpias | 5 partidas limpias |
| cuatro_jugadores | Fiesta total | Ganar una partida de 4 jugadores |
| rapido | Rayo | Ganar en 15 acciones o menos |
| maestro_muros | Arquitecto cruel | 3 muros maestros en una sola partida |
| mil_puntos | Mil y contando | Llegar a 1.000 puntos totales |

Al desbloquear uno, aparece un **aviso flotante** (toast) con la insignia, que entra con rebote. Los logros se ven en la pantalla "Logros" (bloqueados en gris con candado).

### 8.4 Sistema Elo (opcional)
Si se implementa, usar Elo estándar (`K = 32`, inicial 1000) solo para **partidas de 2 jugadores entre humanos**. Se muestra como columna adicional en el ranking.

---

## 9. Errores, validaciones y mensajes

Principio: **nunca** dejes que el juego se rompa ni se quede colgado. Todo error se muestra con un **mensaje amable** (toast animado que entra desde abajo, 2–3 s) y la partida continúa.

### 9.1 Acciones del jugador

| Situación | Qué ocurre | Mensaje |
|---|---|---|
| Muro que cierra el camino a un jugador | Se rechaza; la vista previa se pone roja y tiembla; sonido de error; −1 pt | "🚫 No puedes encerrar a un jugador: debe quedarle camino" |
| Muro que se solapa o cruza con otro | Se rechaza (igual) | "🚫 Ahí ya hay un muro o se cruzaría con otro" |
| Muro fuera del tablero | Se ajusta al más cercano válido, sin error | — |
| Intentar poner muro sin muros restantes | Se mantiene en modo mover | "¡Ya no te quedan muros! Mueve tu personaje." |
| Tocar una casilla no permitida | Casilla hace un pequeño "no" (sacudida) | "Ese movimiento no está permitido" |
| Pulsar Confirmar sin elegir posición | Nada | "Primero elige dónde poner el muro" |
| Pulsar Deshacer sin historial | Nada | "No hay nada que deshacer" |
| Pulsar acciones durante turno de bot / animación | Ignorado (botones bloqueados) | — |
| Jugador sin movimientos ni muros | Pasa turno automáticamente | "X no puede moverse y pasa turno" |
| Tiempo agotado (modo con tiempo) | Mueve automáticamente | "⏰ Se acabó el tiempo de X" |
| Doble clic / doble toque rápido | Se procesa una sola vez | — |

### 9.2 Errores del sistema

| Situación | Qué hacer |
|---|---|
| `localStorage` no disponible o lleno | Usar memoria temporal; mostrar aviso único: "No se pudo guardar el ranking en este navegador. Se perderá al cerrar." |
| Datos guardados corruptos (JSON inválido) | Hacer copia del dato roto en otra clave, reiniciar el ranking vacío y avisar; nunca lanzar excepción |
| Datos guardados de una versión anterior | Usar campo `version`; migrar si es posible; si no, ignorar con aviso |
| `AudioContext` bloqueado por el navegador | Reanudar al primer toque del usuario; si falla, jugar sin sonido en silencio |
| El bot tarda demasiado (> 1,5 s) | Usar jugada de emergencia (camino más corto) |
| El bot no devuelve jugada válida | Pasar turno o mover aleatoriamente; nunca bloquear la partida |
| Importar JSON de ranking inválido | Rechazar sin tocar los datos actuales: "El archivo no es válido" |
| Pantalla muy pequeña / rotación | Recalcular tamaño del tablero (`resize`); nunca desbordar horizontalmente |
| Excepción inesperada en JavaScript | `window.onerror` y `unhandledrejection`: mostrar toast "Ups, algo falló. La partida sigue" y registrar en consola |

### 9.3 Coherencia (autocomprobación interna)
En modo desarrollo (por ejemplo, con `?debug=1`), tras cada acción comprueba: todos los jugadores con camino a su meta, ningún muro solapado, dos personajes nunca en la misma casilla, muros restantes ≥ 0. Si algo falla, escribe un error en consola.

---

## 10. Diseño visual (estilo cartoon 2D)

### 10.1 Estilo general
- **Todo en 2D**, sin perspectiva ni 3D. Aspecto de dibujos animados: **contornos gruesos oscuros** (`#2b2140`, 3–4 px), colores vivos, sombras duras desplazadas (sin difuminar), esquinas redondeadas, brillos blancos.
- Fondo: cielo celeste degradado con **nubes con contorno** que se desplazan lentamente de izquierda a derecha, y pradera verde en la parte inferior.
- Tipografía: redondeada y amigable (Fredoka / Baloo 2 de Google Fonts, con fallback a `Trebuchet MS`, `Comic Sans MS`, `sans-serif`).
- Paleta base: tinta `#2b2140`, papel `#fff8e7`, amarillo botón `#ffd43b`, y los 4 colores de jugador de la sección 2.2.

### 10.2 Personajes (SVG)
Cuerpo en forma de **bola redonda** con:
- Ojos grandes blancos con pupila y un destello; **parpadean** cada pocos segundos (animación de `scaleY`, con retraso distinto por personaje).
- Mejillas rosadas y sonrisa.
- Dos pies pequeños.
- Sombrero distinto por jugador (corona, gorro con pompón, antena, brote).
- Sombra elíptica en el suelo.
- El personaje activo "respira" (estira y aplasta suavemente).

### 10.3 Tablero
- Marco de madera con borde grueso y sombra dura inferior.
- Casillas en damero de dos tonos crema, con borde oscuro redondeado.
- Franjas de meta tintadas con el color de cada jugador.
- Muros: **tablones del color del jugador que los puso**, con contorno, degradado, brillo claro y ligera sombra.

### 10.4 Responsive
- El tablero siempre es cuadrado y se adapta: ancho = mín(94 % del ancho de pantalla, alto disponible − espacio de controles, 660 px).
- En móvil, tarjetas de jugadores arriba (con salto de línea) y controles abajo.
- Objetivos táctiles ≥ 44 px.
- Respetar `prefers-reduced-motion`: reducir animaciones casi a cero.

---

## 11. Animaciones y transiciones (requisito obligatorio)

Todo cambio visible debe ser **fluido**. Lista mínima:

| Elemento | Animación |
|---|---|
| Movimiento del personaje | Desliza a la casilla con rebote (`cubic-bezier(.3,1.35,.5,1)`, ~0,55 s) + **salto** (estira al despegar, aplasta al aterrizar) + nubecita de polvo al caer |
| Salto sobre un rival | Igual, con arco más alto |
| Colocar un muro | **Cae desde arriba** haciéndose pequeño, rebota y asienta; el tablero da una pequeña sacudida |
| Quitar muro (deshacer) | Se encoge y rota hasta desaparecer |
| Vista previa del muro | Sigue al cursor con suavidad; cambia verde/rojo con transición; tiembla si es inválido |
| Casillas destino | Burbuja discontinua que gira y pulsa; escala al pasar el cursor |
| Tarjeta del jugador activo | Sube, crece y cambia de color con rebote |
| Ladrillos de muros | El gastado se encoge, rota y se difumina |
| Mensaje de estado | Aparece con pequeño "pop" cada cambio |
| Pantallas y ventanas | Fundido + deslizamiento + rebote al entrar y salir |
| Botones | Se elevan al pasar el cursor, se hunden al pulsarlos |
| Selector 2/4 jugadores | La píldora amarilla se desliza |
| Filas de jugadores en configuración | Se pliegan y despliegan con altura animada |
| Botones de Rotar/Poner | Aparecen deslizando solo en modo muro |
| Victoria | Personaje baila, confeti con física, tarjeta con rebote, números de puntos contando |
| Ranking | Filas entran escalonadas; cambios de posición deslizan |
| Logros | Toast con rebote + insignia que gira |
| Pista | Puntos del camino aparecen escalonados con "pop" |
| Nubes de fondo | Deriva lenta y continua |

Duraciones: 0,15–0,2 s para botones, 0,3–0,6 s para el resto, nunca más de 0,8 s en acciones del jugador. Mientras algo se anima, **bloquea la entrada** para evitar jugadas dobles.

---

## 12. Sonido (WebAudio, sin archivos)

| Evento | Sonido |
|---|---|
| Clic de botón | Bip corto agudo (triangular) |
| Mover | Boing ascendente breve |
| Colocar muro | Golpe grave tipo "toc" (onda cuadrada que baja + seno grave) |
| Error | Zumbido breve descendente (diente de sierra) |
| Cambio de turno | Bip muy suave |
| Victoria | Arpegio ascendente de 5 notas |
| Logro / subida de nivel | Dos notas rápidas brillantes |

- Botón de sonido (🔊/🔇) que se **recuerda** entre sesiones.
- Volumen bajo y agradable. Crear el `AudioContext` solo tras el primer gesto del usuario.

---

## 13. Pantalla "Cómo se juega"
Ventana modal con: objetivo, qué se puede hacer en el turno, saltos (con mini-ilustraciones SVG animadas), reglas de los muros, cómo se colocan en ordenador y en móvil, atajos de teclado y resumen del sistema de puntos. Además, una **partida tutorial guiada opcional** de 4 pasos (mover, saltar, poner muro, ganar) con globos de diálogo que señalan elementos.

---

## 14. Ajustes
- Sonido activado/desactivado.
- Animaciones: normales / reducidas.
- Mostrar distancia a la meta en las tarjetas (sí/no).
- Permitir deshacer (sí/no) y pistas (sí/no) por defecto.
- Modo daltónico: añade **formas/símbolos distintos** en los sombreros y patrón en las franjas de meta, para no depender solo del color.
- Borrar todos los datos (con doble confirmación).

---

## 15. Estructura del código recomendada

```text
index.html
 ├─ <style>        estilos, variables CSS, keyframes
 ├─ HTML           pantallas (menu, config, partida, ranking, logros, ajustes), modales, toast, canvas de confeti
 └─ <script>
     ├─ MOTOR (puro, sin DOM)
     │    constantes, crearPartida, bloqueado, movimientosLegales, bfs,
     │    validarMuro, aplicarMovimiento, aplicarMuro, calcularPuntos, botJugada
     ├─ ALMACENAMIENTO
     │    cargar, guardar, migrar, exportar, importar (todo con try/catch)
     ├─ AUDIO
     ├─ GRÁFICOS (SVG de personajes y decoraciones)
     ├─ INTERFAZ (render, eventos, animaciones, pantallas)
     └─ ARRANQUE (inicializar, registrar manejadores de error globales)
```

Principios: el motor **no toca el DOM**; la interfaz **no contiene reglas**. Funciones pequeñas y con nombres claros en español o inglés (consistente). Comentarios útiles donde la lógica no sea obvia.

---

## 16. Estadísticas por partida (las que debe registrar el motor)

Por jugador: acciones totales, movimientos, saltos, muros colocados, muros maestros, usos de pista, usos de deshacer, intentos de muro inválido, turnos agotados, distancia mínima/máxima respecto al rival, si fue "remontada". Por partida: duración (segundos), turnos totales, ganador, configuración, fecha.

Guarda un **historial** de las últimas 50 partidas (resumen) para la pestaña de estadísticas.

---

## 17. Criterios de aceptación (checklist final)

Comprueba **todo** antes de dar la tarea por terminada:

**Reglas**
- [ ] Tablero 9×9 con meta correcta para 2 y 4 jugadores.
- [ ] Mover una casilla; no atraviesa muros; no sale del tablero.
- [ ] Salto recto y salto diagonal funcionan según 2.4.
- [ ] Muros: no se solapan, no se cruzan, no cierran el camino de **ningún** jugador.
- [ ] 10 muros (2 jugadores) y 5 muros (4 jugadores), no recuperables.
- [ ] Gana el primero que llega a su franja de meta.
- [ ] Pasar turno automático si no hay movimientos ni muros; empate a los 200 turnos.

**Bots**
- [ ] Tres niveles funcionando, jugadas siempre legales, nunca cuelgan la partida.
- [ ] Animación "pensando…" y retraso natural.

**Puntos y ranking**
- [ ] Desglose de puntos animado en la victoria, con bonificaciones, multiplicador y penalizaciones.
- [ ] Ranking persistente con pestañas, ordenación y desempates correctos.
- [ ] Niveles con barra de progreso, logros con aviso, exportar/importar.

**Errores**
- [ ] Todos los mensajes de la sección 9 implementados.
- [ ] La app sobrevive a datos corruptos, falta de almacenamiento y bloqueo de audio.

**Interfaz**
- [ ] Estilo cartoon 2D coherente, sin nada en 3D.
- [ ] Todas las animaciones de la sección 11.
- [ ] Funciona con ratón, táctil y teclado.
- [ ] Se ve bien desde 320 px; sin desbordamiento horizontal.
- [ ] Sonido con botón de silencio; respeta `prefers-reduced-motion`.

**Calidad**
- [ ] Sin dependencias externas obligatorias (solo la tipografía opcional).
- [ ] Sin errores en consola durante una partida completa de 2 y de 4 jugadores.
- [ ] Código separado en motor / almacenamiento / interfaz.

---

## 18. Prompt breve para pegar en AI Studio

> Lee la especificación completa de `MUROS_LOCOS_ESPECIFICACION.md` y desarrolla el juego **Muros Locos** entero como una app web autocontenida (un solo `index.html` con HTML, CSS y JavaScript puro). Respeta exactamente las reglas, los algoritmos, el sistema de puntos, el ranking, los logros, el manejo de errores, el diseño cartoon 2D y las animaciones fluidas descritas. No omitas ninguna sección y al terminar verifica la lista de criterios de aceptación de la sección 17.

---

## 19. Ideas opcionales (solo si queda margen y todo lo anterior funciona)

- Más temas visuales (noche, nieve, playa) que cambien fondo y tablero.
- Más personajes y sombreros desbloqueables con puntos.
- Modo "Muros extra": cada 5 turnos se obtiene un muro más.
- Modo "Caos": cada 10 turnos aparece un evento aleatorio (un muro desaparece, dos jugadores intercambian sitio…), siempre respetando el camino garantizado.
- Repetición de la última partida (reproducir jugadas con animación).
- Compartir resultado como texto copiable ("¡Gané en 18 jugadas con 142 puntos en Muros Locos!").
