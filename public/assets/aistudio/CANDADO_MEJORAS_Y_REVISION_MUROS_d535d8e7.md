# Instrucciones para la IA: mejoras de Candado + revisión de Muros Locos

Contexto: el proyecto es "Muros Locos" (React + TypeScript + Vite, Cloudflare Pages + Worker + D1). Candado es un minijuego nuevo en la misma página. **No rompas nada de lo que ya funciona. Cambios mínimos, quirúrgicos.** Todo cambio de backend debe hacerse en `cloudflare-worker.js` y reflejarse en `server.ts` (que solo es para desarrollo).

---

## PARTE 1 — Antes de tocar Candado: verifica Muros Locos

Revisa el código actual y confirma o descarta cada punto. **No arregles nada todavía.** Al terminar, dame un informe: qué está bien, qué falla, y la solución propuesta para cada fallo, indicando qué archivos y funciones tocaría y cómo evitar que se rompa algo más. Después **pregúntame explícitamente si quiero que lo arregle**, y espera mi respuesta.

Puntos a verificar:

1. **Guardado de partidas falso "ok".** `/api/partida` responde `ok:true` aunque `guardados` esté vacío (sesión que no coincide con la cuenta, o revocada). El cliente no reencola y la partida se pierde sin aviso. Propuesta: devolver 401/409 si no se guardó ningún participante, y que el cliente reencole.
2. **Puntos sin tope.** `puntosGanados` lo manda el cliente sin límite. Propuesta: máximo por partida calculado con las reglas del motor, y límite diario.
3. **Unión a salas (condición de carrera).** El `join` lee el JSON de `salas_online`, lo modifica y lo guarda entero. Dos jugadores entrando a la vez pueden pisarse (síntoma: "en la sala de torneo solo aparece uno"). Propuesta: versión/`seq` y reintento si cambió al guardar.
4. **Sesiones.** `crearSesion` borra todas las sesiones al llegar a 2. Confirma que dos logins simultáneos no se pisan y que el cliente maneja bien la sesión revocada.
5. **Seguridad pendiente.** Fallback `'muros2026'` en login, `verifyCallerAdmin` y `resolverSesion`; CORS `*`; `GET /api/cuentas` público.
6. **Último en escribir gana.** `POST /api/cuentas` de Dev/Admin fusiona mapas completos (`...prev, ...rawAcc`) y un cliente desactualizado puede pisar puntos o inventario.
7. **Doble backend.** Verifica que `server.ts` y el worker tengan la misma lógica (roles, `participantes`, `cambiar-id`, salas).
8. **Comprobaciones de funcionamiento:** asignar Admin/Mod/Dev; regalar un personaje (no debe cambiar el aspecto de quien regala); partida guardada con puntos, victorias, historial y ranking semanal; sala de torneo con 2 y 4 jugadores.

---

## PARTE 2 — Mejoras al plan de Candado

Aplica esto al `implementation_plan.md` antes de programar. Empieza por el **modo local** (no toca la base de datos) y deja el P2P para después de la Parte 1.

1. **Anti-trampas en P2P (commit-reveal).** Al empezar, cada jugador publica `hash(secreto + sal)`. Al terminar, revela secreto y sal; el otro lo verifica. Así nadie puede mentir en las pistas ni cambiar su código.
2. **Puntos de confianza.** `POST /api/candado/puntos` debe tener:
   - tope por partida y por día,
   - `matchId` de un solo uso,
   - que ambos jugadores reporten el mismo resultado,
   - que sume solo `puntos` (sin `partidas_historial`, victorias ni partidas).
3. **Economía.** Los puntos (local 10/18/28 + bonos; online 25 + 3 por dígito sobre 4; perdedor 5) inflan rápido frente a los umbrales de avatares. Simula números antes de fijar valores.
4. **Reglas por cerrar:** ventaja de quien empieza (alternar o igualar turnos), empate, abandono (victoria al rival), temporizador de turno. Con 10 dígitos únicos la partida es muy larga: considera limitar a 4–8 dígitos.
5. **Un solo contrato de backend.** Implementa el endpoint en worker y `server.ts` con el mismo formato, o añade un test de contrato.
6. **Salas.** Filtra por `juego: 'muros' | 'candado'` y `digitosCandado`, y usa el mismo mecanismo versionado de la Parte 1 punto 3.
7. **Selector `🕹️ Juegos`.** Sustituye el "➕ Próximo juego" por Candado sin tocar el resto de `MenuScreens.tsx`.

---

## PARTE 3 — Antes de empezar: cuestiónate el enfoque

Antes de programar, respóndeme brevemente: **¿es "Mastermind con candado" la mejor opción para este juego, o hay una alternativa mejor?** (por ejemplo, otra mecánica de adivinar combinaciones que encaje mejor con un duelo P2P o con la estética de Muros Locos). Compara 2–3 opciones, di sus pros y contras, recomienda una y espera mi visto bueno. Si tu recomendación es la del plan, dilo y sigue.

## PARTE 4 — Que se vea y se sienta interesante

Candado debe ser atractivo, no solo funcional. Mantén el estilo cartoon de Muros Locos (mismos colores, bordes y sombras) y añade:

- Un **candado/caja fuerte 2D animado** en el centro: cada dígito es una rueda que gira al cambiarlo; al acertar, la rueda "hace clic" y se ilumina en verde; al ganar, el candado se abre con animación.
- **Pistas con animación** (verde/amarillo/gris que aparecen una a una con rebote) y sonidos cortos (clic de rueda, acierto, fallo, apertura).
- Un **historial de intentos** visible, con las pistas de cada intento.
- Dificultad creciente (4/5/6 dígitos) con la caja fuerte cambiando de aspecto.
- En duelo P2P: ver el candado del rival y sus intentos (sin revelar su secreto) para dar tensión.
- Respeta `prefers-reduced-motion` y que funcione bien en móvil.

## PARTE 5 — Plan de construcción (beta que se conserva)

1. **Beta = modo local.** Todo dentro de la carpeta `candado/`, sin tocar la base de datos ni salas, y accesible desde el selector `🕹️ Juegos`. Escríbela **ya con calidad final** (tipos, estructura, estilos), no como prototipo desechable.
2. Yo la pruebo. Te diré "todo se ve bien y funciona" o qué cambiar.
3. **No borres la beta ni la rehagas desde cero.** Solo si encuentras que la base está mal planteada, propón qué rehacer y por qué, y espera mi permiso. Si funciona, se conserva y se le añade lo siguiente.
4. Después, por etapas y probando cada una: puntos (con topes), P2P con commit-reveal, filtro de salas.
5. En cada etapa, revisa cómo interactúa con Muros Locos (salas, sesiones, puntos, ranking) para no romper nada.

---

## Orden de trabajo

1. Informe de la Parte 1 → **preguntarme si arreglo los fallos** → esperar respuesta.
2. Respuesta de la Parte 3 (¿es la mejor opción?) → esperar mi visto bueno.
3. Aplicar solo lo que yo apruebe de la Parte 1.
4. Construir la beta local (Partes 4 y 5) → yo pruebo.
5. Añadir puntos y P2P por etapas.
