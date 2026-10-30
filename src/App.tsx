/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  aplicarMovimiento,
  aplicarMuro,
  avanzarTurno,
  bfsCamino,
  calcularDesglosePuntos,
  calcularJugadaBot,
  inicializarPartida,
  movimientosLegales,
  registrarResultadoRondaTorneo,
  reiniciarTableroParaSiguienteRonda,
} from './game/murosLocosEngine';
import {
  actualizarDespuesDePartida,
  cargarAjustes,
  cargarRanking,
  guardarAjustes,
  penalizarAbandono,
} from './game/storage';
import { onlineService } from './game/onlineService';
import { sounds } from './audio/murosAudio';
import {
  AchievementDef,
  AppSettings,
  Coord,
  GameState,
  LevelInfo,
  MatchConfig,
  ScoreBreakdown,
  Screen,
  WallOrientation,
} from './types/murosLocos';
import { ActionBar, HistorialPanel, PlayerCards } from './components/GameControls';
import {
  AjustesModal,
  ComoSeJuegaModal,
  LogrosModal,
  OnlineDisconnectModal,
  RankingModal,
  TorneoModal,
  VictoryModal,
} from './components/Modals';
import { ConfigScreen } from './components/ConfigScreen';
import { MenuScreen } from './components/MenuScreen';
import { MurosBoard } from './components/MurosBoard';
import { OnlineLobbyScreen } from './components/OnlineLobbyScreen';

export default function App() {
  const [pantalla, setPantalla] = useState<Screen>('menu');
  const [esModoTorneoConfig, setEsModoTorneoConfig] = useState<boolean>(false);
  const [modalAbierto, setModalAbierto] = useState<
    'ranking' | 'logros' | 'como_jugar' | 'ajustes' | 'victoria' | 'torneo' | null
  >(null);
  const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false);
  const [confirmandoAbandono, setConfirmandoAbandono] = useState<boolean>(false);
  const [desconexionSegundos, setDesconexionSegundos] = useState<number | null>(null);

  const [ajustes, setAjustes] = useState<AppSettings>(() => cargarAjustes());
  const [estado, setEstado] = useState<GameState>(() =>
    inicializarPartida({
      numJugadores: 2,
      jugadores: [
        { nombre: 'Tú', tipo: 'humano' },
        { nombre: 'Bot Normal', tipo: 'bot_normal' },
      ],
      empiezaAlAzar: false,
      permitirDeshacer: true,
      permitirPistas: true,
      modoConTiempo: false,
      segundosPorTurno: 30,
    })
  );

  const [bloqueadoPorAnimacion, setBloqueadoPorAnimacion] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [desgloses, setDesgloses] = useState<Map<number, ScoreBreakdown>>(new Map());
  const [nuevosLogros, setNuevosLogros] = useState<Map<string, AchievementDef[]>>(new Map());
  const [subidasNivel, setSubidasNivel] = useState<Map<string, { anterior: LevelInfo; nuevo: LevelInfo }>>(
    new Map()
  );

  const startTimeRef = useRef<number>(Date.now());
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global exception safety
  useEffect(() => {
    const handleErr = () => {
      showToast('Ups, algo falló. La partida sigue.');
    };
    window.addEventListener('error', handleErr);
    window.addEventListener('unhandledrejection', handleErr);
    return () => {
      window.removeEventListener('error', handleErr);
      window.removeEventListener('unhandledrejection', handleErr);
    };
  }, []);

  // Detect ?sala=CODE on initial load
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sala')) {
        setPantalla('online_lobby');
      }
    } catch {
      // ignore
    }
  }, []);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Wire Online P2P Callbacks
  useEffect(() => {
    onlineService.setCallbacks({
      onLobbyFull: (maxPlayers) => {
        // Auto-start immediately when the other player enters!
        if (onlineService.getRole() === 'host') {
          handleIniciarPartidaOnline(maxPlayers);
        }
      },
      onGameStart: (initialState) => {
        const myId = onlineService.getMyPlayerId();
        const role = onlineService.getRole();
        setEstado({
          ...initialState,
          miJugadorId: myId,
          esAnfitrion: role === 'host',
          modoOnline: true,
        });
        setPantalla('juego');
        setModalAbierto(null);
        setMostrarHistorial(false);
        setConfirmandoAbandono(false);
        setDesconexionSegundos(null);
        sounds.playTurn();
      },
      onStateSync: (syncedState) => {
        const myId = onlineService.getMyPlayerId();
        const role = onlineService.getRole();
        setEstado((prev) => {
          return {
            ...syncedState,
            miJugadorId: myId,
            esAnfitrion: role === 'host',
            modoOnline: true,
            codigoSala: prev.codigoSala || onlineService.getRoomCode(),
          };
        });
        sounds.playTurn();
        if (syncedState.terminada && syncedState.ganador !== null) {
          concluirPartida(syncedState);
        }
      },
      onClientAction: (jugadorId, accion, payload) => {
        // Authoritative Host processes client action
        setEstado((current) => {
          if (current.terminada || current.turnoActual !== jugadorId) return current;

          const next = structuredClone(current);
          if (accion === 'mover' && payload.destino) {
            const res = aplicarMovimiento(next, payload.destino);
            sounds.playMove();
            if (res.ganador) {
              concluirPartida(next);
            } else {
              sounds.playTurn();
            }
          } else if (
            accion === 'muro' &&
            payload.orientacion &&
            payload.r !== undefined &&
            payload.c !== undefined
          ) {
            aplicarMuro(next, payload.orientacion, payload.r, payload.c);
            sounds.playWall();
            sounds.playTurn();
          }

          onlineService.syncGameStateFromHost(next);
          return next;
        });
      },
      onReaction: (jugadorId, emoji) => {
        sounds.playClick();
        setEstado((s) => ({
          ...s,
          reaccionActiva: { jugadorId, emoji, ts: Date.now() },
        }));
        setTimeout(() => {
          setEstado((s) => (s.reaccionActiva?.ts ? { ...s, reaccionActiva: null } : s));
        }, 2500);
      },
      onHostDisconnected: (sec) => {
        setDesconexionSegundos(sec);
      },
      onHostReconnected: () => {
        setDesconexionSegundos(null);
        showToast('¡Anfitrión reconectado! Reanudando partida...');
        sounds.playAchievement();
      },
      onDisconnectTimeout: () => {
        showToast('Tiempo de reconexión agotado');
      },
      onError: (err) => {
        showToast(err);
      },
    });
  }, []);

  // Conclude game and calculate scores
  const concluirPartida = (est: GameState) => {
    const duracion = Math.round((Date.now() - startTimeRef.current) / 1000);
    const breakdownMap = new Map<number, ScoreBreakdown>();
    const puntosRondaObj: Record<number, number> = {};
    const rankingActual = cargarRanking();

    est.jugadores.forEach((p) => {
      const prevEntry = rankingActual[p.nombre.trim().toLowerCase()];
      const rachaPrevia = prevEntry?.rachaActual || 0;
      const rachaParaDesglose = est.ganador === p.id ? rachaPrevia + 1 : 0;
      const breakdown = calcularDesglosePuntos(p, est, rachaParaDesglose);
      breakdownMap.set(p.id, breakdown);
      puntosRondaObj[p.id] = breakdown.total;
    });

    setDesgloses(breakdownMap);

    const { nuevosLogrosPorJugador, subidasNivelPorJugador } = actualizarDespuesDePartida(
      est,
      breakdownMap,
      duracion
    );

    setNuevosLogros(nuevosLogrosPorJugador);
    setSubidasNivel(subidasNivelPorJugador);

    // If tournament mode is active, update tournament state
    if (est.torneo && est.torneo.activo) {
      const ganadorNombre =
        est.ganador !== null && est.ganador >= 0
          ? est.jugadores[est.ganador].nombre
          : 'Empate';
      const torneoActualizado = registrarResultadoRondaTorneo(
        est.torneo,
        est.ganador ?? -1,
        ganadorNombre,
        puntosRondaObj
      );
      est.torneo = torneoActualizado;

      sounds.playVictory();
      setModalAbierto('torneo');
    } else {
      sounds.playVictory();
      setModalAbierto('victoria');
    }
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (confirmandoAbandono) {
        if (e.key === 'Escape') setConfirmandoAbandono(false);
        return;
      }

      if (mostrarHistorial) {
        if (e.key === 'Escape') setMostrarHistorial(false);
        return;
      }

      if (modalAbierto) {
        if (e.key === 'Escape') {
          setModalAbierto(null);
        }
        return;
      }

      if (pantalla !== 'juego' || bloqueadoPorAnimacion) return;

      const jugador = estado.jugadores[estado.turnoActual];
      if (jugador.tipo !== 'humano') return;
      if (estado.modoOnline && estado.miJugadorId !== undefined && estado.turnoActual !== estado.miJugadorId) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'w':
          if (jugador.muros > 0) {
            sounds.playClick();
            setEstado((s) => ({ ...s, modoAccion: 'muro' }));
          } else {
            sounds.playError();
            showToast('¡Ya no te quedan muros!');
          }
          break;
        case 'm':
          sounds.playClick();
          setEstado((s) => ({ ...s, modoAccion: 'mover' }));
          break;
        case 'r':
          sounds.playClick();
          setEstado((s) => ({
            ...s,
            orientacionMuro: s.orientacionMuro === 'H' ? 'V' : 'H',
          }));
          break;
        case 'p':
          pedirPista();
          break;
        case 'z':
          deshacer();
          break;
        case 'h':
          setMostrarHistorial((prev) => !prev);
          break;
        case 'escape':
          if (pantalla === 'juego' && !estado.terminada) {
            setConfirmandoAbandono(true);
          } else {
            setBloqueadoPorAnimacion(false);
            setPantalla('menu');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pantalla, modalAbierto, mostrarHistorial, confirmandoAbandono, bloqueadoPorAnimacion, estado]);

  // Turn timer interval (Host authoritative in online mode)
  useEffect(() => {
    if (pantalla !== 'juego' || estado.terminada || !estado.config.modoConTiempo) return;
    if (estado.modoOnline && !estado.esAnfitrion) return; // Client receives sync from host

    const timer = setInterval(() => {
      if (estado.terminada || !estado.config.modoConTiempo) return;

      if (estado.tiempoRestante <= 1) {
        const next = structuredClone(estado);
        const curPlayer = next.jugadores[next.turnoActual];
        curPlayer.estadisticas.turnosAgotados++;

        const { camino } = bfsCamino(curPlayer, next.murosH, next.murosV);
        const legales = movimientosLegales(curPlayer, next);
        const pasoDeseado = camino.length > 1 ? camino[1] : null;
        const destino =
          pasoDeseado && legales.some((m) => m.r === pasoDeseado.r && m.c === pasoDeseado.c)
            ? pasoDeseado
            : legales.length > 0
            ? legales[0]
            : null;

        if (destino) {
          const res = aplicarMovimiento(next, destino);
          sounds.playMove();
          if (res.ganador) {
            concluirPartida(next);
          } else {
            sounds.playTurn();
          }
        } else {
          avanzarTurno(next);
          sounds.playTurn();
        }

        sounds.playError();
        showToast(`⏰ Se acabó el tiempo de ${curPlayer.nombre}`);

        if (next.modoOnline) {
          onlineService.syncGameStateFromHost(next);
        }
        setEstado(next);
      } else {
        setEstado((prev) => ({ ...prev, tiempoRestante: prev.tiempoRestante - 1 }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pantalla, estado.terminada, estado.config.modoConTiempo, estado.turnoActual, estado.tiempoRestante, estado.modoOnline, estado.esAnfitrion]);

  // Bot Turn Logic (Only in local games)
  useEffect(() => {
    if (pantalla !== 'juego' || estado.terminada || estado.modoOnline) return;

    const jugador = estado.jugadores[estado.turnoActual];
    if (jugador.tipo === 'humano') return;

    setBloqueadoPorAnimacion(true);
    setEstado((s) => ({
      ...s,
      pensandoBot: true,
      ultimoMensaje: `🤖 ${jugador.nombre} está pensando...`,
    }));

    // Natural bot delay (0.8s - 1.2s)
    const delay = Math.floor(Math.random() * 400) + 800;
    const botTimeout = setTimeout(() => {
      if (estado.terminada) {
        setBloqueadoPorAnimacion(false);
        return;
      }

      const next = structuredClone(estado);
      const botPlayer = next.jugadores[next.turnoActual];
      const jugada = calcularJugadaBot(botPlayer, next);

      if (jugada.tipo === 'mover') {
        const res = aplicarMovimiento(next, jugada.coord);
        sounds.playMove();
        if (res.ganador) {
          concluirPartida(next);
        }
      } else if (jugada.tipo === 'muro') {
        aplicarMuro(next, jugada.orientacion, jugada.coord.r, jugada.coord.c);
        sounds.playWall();
      } else {
        // Pass turn
        avanzarTurno(next);
        sounds.playTurn();
        showToast(`${botPlayer.nombre} pasa turno`);
      }

      next.pensandoBot = false;
      setBloqueadoPorAnimacion(false);
      setEstado(next);
    }, delay);

    return () => {
      clearTimeout(botTimeout);
      setBloqueadoPorAnimacion(false);
    };
  }, [pantalla, estado.turnoActual, estado.terminada, estado.modoOnline]);

  // Actions
  const handleMover = (destino: Coord) => {
    if (bloqueadoPorAnimacion || estado.terminada) return;

    if (estado.modoOnline) {
      if (estado.miJugadorId !== undefined && estado.turnoActual !== estado.miJugadorId) {
        showToast('No es tu turno');
        return;
      }

      if (estado.esAnfitrion) {
        const next = structuredClone(estado);
        const res = aplicarMovimiento(next, destino);
        sounds.playMove();
        if (res.ganador) concluirPartida(next);
        else sounds.playTurn();
        onlineService.syncGameStateFromHost(next);
        setEstado(next);
      } else {
        sounds.playMove();
        onlineService.sendAction('mover', { destino });
      }
      return;
    }

    const next = structuredClone(estado);
    const res = aplicarMovimiento(next, destino);
    sounds.playMove();

    if (res.ganador) {
      concluirPartida(next);
    } else {
      sounds.playTurn();
    }

    setEstado(next);
  };

  const handlePonerMuro = (orientacion: WallOrientation, r: number, c: number) => {
    if (bloqueadoPorAnimacion || estado.terminada) return;

    if (estado.modoOnline) {
      if (estado.miJugadorId !== undefined && estado.turnoActual !== estado.miJugadorId) {
        showToast('No es tu turno');
        return;
      }

      if (estado.esAnfitrion) {
        const next = structuredClone(estado);
        const res = aplicarMuro(next, orientacion, r, c);
        sounds.playWall();
        if (res.esMuroMaestro) showToast('🧱 ¡Muro maestro!');
        sounds.playTurn();
        onlineService.syncGameStateFromHost(next);
        setEstado(next);
      } else {
        sounds.playWall();
        onlineService.sendAction('muro', { orientacion, r, c });
      }
      return;
    }

    const next = structuredClone(estado);
    const res = aplicarMuro(next, orientacion, r, c);
    sounds.playWall();

    if (res.esMuroMaestro) {
      showToast('🧱 ¡Muro maestro! (+10 pts de bonificación)');
    }
    sounds.playTurn();
    setEstado(next);
  };

  const pedirPista = () => {
    if (
      bloqueadoPorAnimacion ||
      estado.terminada ||
      estado.modoOnline ||
      !estado.config.permitirPistas ||
      !ajustes.permitirPistas
    ) {
      showToast('Las pistas están desactivadas');
      return;
    }
    const jugador = estado.jugadores[estado.turnoActual];

    const { camino } = bfsCamino(jugador, estado.murosH, estado.murosV);
    if (camino.length > 0) {
      jugador.estadisticas.usosPista++;
      sounds.playAchievement();
      showToast('💡 Pista mostrada (-5 puntos)');
      setEstado((s) => ({ ...s, caminoPista: camino }));
    }
  };

  const deshacer = () => {
    if (
      bloqueadoPorAnimacion ||
      estado.terminada ||
      estado.modoOnline ||
      estado.historial.length === 0 ||
      !estado.config.permitirDeshacer ||
      !ajustes.permitirDeshacer
    ) {
      showToast('No hay nada que deshacer');
      return;
    }

    const next = structuredClone(estado);
    if (next.historial.length === 0) return;

    // Retain cumulative undo count so it is never wiped out by older snapshots
    const currentUndos = next.jugadores.map((p) => p.estadisticas.usosDeshacer);

    // Pop previous state
    let snap = next.historial.pop();
    if (!snap) return;

    // If playing against bots, rewind through all consecutive bot turns back to the human's turn
    while (
      next.historial.length > 0 &&
      snap.jugadores[snap.turnoActual].tipo !== 'humano'
    ) {
      snap = next.historial.pop()!;
    }

    next.jugadores.forEach((p, i) => {
      p.r = snap!.jugadores[i].r;
      p.c = snap!.jugadores[i].c;
      p.muros = snap!.jugadores[i].muros;
      p.estadisticas = { ...snap!.jugadores[i].estadisticas };
      p.estadisticas.usosDeshacer = currentUndos[i];
    });
    next.murosH = snap.murosH;
    next.murosV = snap.murosV;
    next.turnoActual = snap.turnoActual;
    next.turnosTotales = snap.turnosTotales;
    next.caminoPista = null;
    next.muroPrevisualizado = null;
    next.pensandoBot = false;
    next.modoAccion = 'mover';
    next.tiempoRestante = next.config.segundosPorTurno || 30;
    if (snap.registroAcciones) {
      next.registroAcciones = snap.registroAcciones;
    }

    // Charge the penalty to the human player who gets to re-take their turn
    const jugadorPenalizado = next.jugadores[next.turnoActual];
    jugadorPenalizado.estadisticas.usosDeshacer++;
    next.ultimoMensaje = `↩ Turno de ${jugadorPenalizado.nombre} (jugada deshecha)`;

    sounds.playClick();
    showToast(`↩ Jugada deshecha por ${jugadorPenalizado.nombre} (-10 pts)`);
    setEstado(next);
  };

  const iniciarNuevaPartida = (config: MatchConfig) => {
    setBloqueadoPorAnimacion(false);
    startTimeRef.current = Date.now();
    const nueva = inicializarPartida(config);
    setEstado(nueva);
    setPantalla('juego');
    setModalAbierto(null);
    setMostrarHistorial(false);
    setConfirmandoAbandono(false);
    sounds.playTurn();
  };

  const handleIniciarPartidaOnline = (maxJugadores: 2 | 4) => {
    setBloqueadoPorAnimacion(false);
    startTimeRef.current = Date.now();

    const lobbyPlayers = onlineService.getLobbyPlayers();
    const fallbackColors = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66'];
    const fallbackHats = ['corona', 'pompon', 'antena', 'brote'] as const;

    const jugadoresConfig = Array.from({ length: maxJugadores }).map((_, idx) => {
      const lp = lobbyPlayers[idx];
      return {
        nombre: lp ? lp.nombre : `Jugador ${idx + 1}`,
        tipo: 'humano' as const,
        color: lp ? lp.color : fallbackColors[idx] || '#4dabf7',
        hat: lp ? lp.hat : fallbackHats[idx] || 'corona',
      };
    });

    const nueva = inicializarPartida({
      numJugadores: maxJugadores,
      jugadores: jugadoresConfig,
      empiezaAlAzar: false,
      permitirDeshacer: false,
      permitirPistas: false,
      modoConTiempo: true,
      segundosPorTurno: 30,
    });

    nueva.modoOnline = true;
    nueva.miJugadorId = 0;
    nueva.codigoSala = onlineService.getRoomCode();
    nueva.esAnfitrion = true;

    onlineService.startGameAsHost(nueva);
    setEstado(nueva);
    setPantalla('juego');
    setModalAbierto(null);
    setMostrarHistorial(false);
    setConfirmandoAbandono(false);
    sounds.playTurn();
  };

  const revancha = () => {
    setBloqueadoPorAnimacion(false);
    if (estado.modoOnline) {
      handleIniciarPartidaOnline(estado.n);
    } else {
      iniciarNuevaPartida(estado.config);
    }
  };

  const handleSiguienteRondaTorneo = () => {
    setBloqueadoPorAnimacion(false);
    startTimeRef.current = Date.now();
    const siguiente = reiniciarTableroParaSiguienteRonda(estado);
    setEstado(siguiente);
    setModalAbierto(null);
    setMostrarHistorial(false);
    setConfirmandoAbandono(false);
    sounds.playTurn();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col font-['Fredoka',system-ui,sans-serif] bg-gradient-to-b from-[#74c0fc] via-[#a5d8ff] to-[#d0ebff] select-none text-[#2b2140]">
      {/* Cartoon Background Clouds Animation (Fluid & Puffy, Zero Cut-offs) */}
      <div
        className={`absolute inset-0 pointer-events-none overflow-hidden z-0 ${
          ajustes.animacionesReducidas ? '[&_*]:!animation-none' : ''
        }`}
      >
        {/* Cloud Layer 1 - High altitude, drifting gracefully */}
        <div className="absolute top-5 left-0 animate-[cloudDriftA_54s_linear_infinite] [animation-delay:-18s] opacity-90 pointer-events-none">
          <div className="animate-[cloudBob1_7.2s_ease-in-out_infinite]">
            <svg width="240" height="110" viewBox="0 0 240 110" className="drop-shadow-[0_6px_0_rgba(43,33,64,0.12)] overflow-visible">
              <path
                d="M 60 82 C 38 82, 20 74, 18 58 C 16 42, 32 32, 48 34 C 56 18, 80 12, 104 20 C 118 8, 150 8, 168 20 C 188 14, 214 24, 218 44 C 226 56, 218 74, 200 80 C 185 85, 162 82, 146 79 C 126 84, 96 85, 60 82 Z"
                fill="#ffffff"
                stroke="#2b2140"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d="M 28 66 C 42 74, 58 76, 75 75 C 105 78, 135 76, 155 72 C 175 76, 192 73, 204 68 C 192 78, 168 81, 146 78 C 126 83, 96 84, 60 81 C 42 81, 30 74, 28 66 Z"
                fill="#e7f5ff"
              />
            </svg>
          </div>
        </div>

        {/* Cloud Layer 2 - Mid altitude, wider puffy cloud */}
        <div className="absolute top-28 left-0 animate-[cloudDriftB_70s_linear_infinite] [animation-delay:-45s] opacity-80 pointer-events-none">
          <div className="animate-[cloudBob2_8.6s_ease-in-out_infinite]">
            <svg width="290" height="120" viewBox="0 0 290 120" className="drop-shadow-[0_7px_0_rgba(43,33,64,0.12)] overflow-visible">
              <path
                d="M 70 92 C 42 92, 22 82, 20 64 C 18 46, 36 34, 56 36 C 66 18, 96 10, 126 18 C 144 6, 186 6, 208 18 C 232 10, 264 22, 268 44 C 278 58, 270 78, 248 88 C 226 94, 196 90, 178 86 C 152 93, 114 94, 70 92 Z"
                fill="#ffffff"
                stroke="#2b2140"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d="M 32 72 C 48 82, 70 85, 95 84 C 130 87, 168 85, 190 80 C 215 85, 238 82, 252 76 C 238 87, 210 90, 182 86 C 152 92, 114 93, 70 91 C 48 91, 35 82, 32 72 Z"
                fill="#e7f5ff"
              />
            </svg>
          </div>
        </div>

        {/* Cloud Layer 3 - Gentle companion cloud */}
        <div className="absolute top-48 left-0 animate-[cloudDriftC_62s_linear_infinite] [animation-delay:-12s] opacity-75 pointer-events-none">
          <div className="animate-[cloudBob3_6.8s_ease-in-out_infinite]">
            <svg width="200" height="95" viewBox="0 0 200 95" className="drop-shadow-[0_5px_0_rgba(43,33,64,0.10)] overflow-visible">
              <path
                d="M 52 74 C 32 74, 18 65, 18 50 C 18 36, 32 28, 48 29 C 56 16, 80 12, 102 18 C 120 12, 148 18, 156 34 C 168 44, 164 62, 148 70 C 134 75, 112 73, 98 70 C 84 74, 68 75, 52 74 Z"
                fill="#ffffff"
                stroke="#2b2140"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d="M 28 58 C 42 66, 62 68, 80 67 C 105 70, 126 68, 142 63 C 132 71, 112 74, 98 71 C 84 75, 68 75, 52 74 C 38 73, 30 66, 28 58 Z"
                fill="#e7f5ff"
              />
            </svg>
          </div>
        </div>

        {/* Cartoon Meadow Hill at Bottom */}
        <div className="absolute -bottom-16 left-0 right-0 h-32 bg-[#51cf66] rounded-[50%_50%_0_0] border-t-4 border-[#2b2140] shadow-[inset_0_8px_0_#69db7c]" />
      </div>

      {/* Screen Views */}
      {pantalla === 'menu' && (
        <MenuScreen
          onIniciarPartida={() => {
            setEsModoTorneoConfig(false);
            setPantalla('config');
          }}
          onIniciarTorneo={() => {
            setEsModoTorneoConfig(true);
            setPantalla('config');
          }}
          onAbrirOnline={() => setPantalla('online_lobby')}
          onAbrirRanking={() => setModalAbierto('ranking')}
          onAbrirLogros={() => setModalAbierto('logros')}
          onAbrirComoJugar={() => setModalAbierto('como_jugar')}
          onAbrirAjustes={() => setModalAbierto('ajustes')}
        />
      )}

      {pantalla === 'online_lobby' && (
        <OnlineLobbyScreen
          onIniciarPartidaOnline={handleIniciarPartidaOnline}
          onVolverAlMenu={() => setPantalla('menu')}
          onShowToast={showToast}
        />
      )}

      {pantalla === 'config' && (
        <ConfigScreen
          ajustes={ajustes}
          esTorneoInicial={esModoTorneoConfig}
          onIniciar={iniciarNuevaPartida}
          onVolver={() => setPantalla('menu')}
        />
      )}

      {pantalla === 'juego' && (
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-2 sm:p-3 overflow-y-auto">
          {/* Top Bar */}
          <div className="w-full max-w-[620px] mx-auto flex items-center justify-between gap-2 mb-1">
            <button
              onClick={() => {
                sounds.playClick();
                if (!estado.terminada) {
                  setConfirmandoAbandono(true);
                } else {
                  setBloqueadoPorAnimacion(false);
                  onlineService.cleanUp();
                  setPantalla('menu');
                }
              }}
              className="py-1.5 px-3 rounded-xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-xs font-black text-[#2b2140] hover:bg-[#ffe3e3] active:translate-y-0.5 cursor-pointer flex items-center gap-1"
            >
              🏠 Menú
            </button>

            {/* Room code badge or Tournament badge */}
            <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
              {estado.codigoSala && (
                <div className="py-1 px-2.5 bg-[#4dabf7] text-[#183247] rounded-xl border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-xs font-black whitespace-nowrap flex-shrink-0 animate-pulse">
                  🌐 Sala {estado.codigoSala}
                </div>
              )}

              {estado.torneo && (
                <div className="py-1 px-2.5 bg-[#ffd43b] text-[#5c3c00] rounded-xl border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-xs font-black whitespace-nowrap flex-shrink-0 animate-pulse">
                  🏆 R{estado.torneo.rondaActual}/{estado.torneo.totalRondas}
                </div>
              )}

              <div className="flex-1 text-center py-1.5 px-3 bg-[#fff8e7] rounded-xl border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] truncate">
                <span className="text-xs sm:text-sm font-extrabold text-[#2b2140]">
                  {estado.modoOnline &&
                  estado.miJugadorId !== undefined &&
                  estado.turnoActual !== estado.miJugadorId
                    ? `⏳ Esperando a ${estado.jugadores[estado.turnoActual]?.nombre}...`
                    : estado.pensandoBot
                    ? '🤖 Pensando...'
                    : estado.ultimoMensaje}
                </span>
              </div>
            </div>

            {/* Quick Historial Log Toggle Button */}
            <button
              onClick={() => {
                sounds.playClick();
                setMostrarHistorial((prev) => !prev);
              }}
              className="w-9 h-9 rounded-xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-sm font-bold flex items-center justify-center hover:bg-[#e7f5ff] active:translate-y-0.5 cursor-pointer"
              title="Abrir historial de jugadas"
            >
              📜
            </button>

            {/* Sound Toggle Button */}
            <button
              onClick={() => {
                const nextSound = !ajustes.sonido;
                sounds.setEnabled(nextSound);
                setAjustes((a) => {
                  const updated = { ...a, sonido: nextSound };
                  guardarAjustes(updated);
                  return updated;
                });
              }}
              className="w-9 h-9 rounded-xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-sm font-bold flex items-center justify-center hover:bg-[#f1f3f5] active:translate-y-0.5 cursor-pointer"
              title={ajustes.sonido ? 'Silenciar' : 'Activar sonido'}
            >
              {ajustes.sonido ? '🔊' : '🔇'}
            </button>
          </div>

          {/* Turn Timer Bar (if enabled) */}
          {estado.config.modoConTiempo && (
            <div className="w-full max-w-[620px] mx-auto mb-1">
              <div className="w-full bg-[#ede4d0] h-2.5 rounded-full border-2 border-[#2b2140] overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    estado.tiempoRestante <= 5
                      ? 'bg-[#ff6b6b] animate-pulse'
                      : estado.tiempoRestante <= 10
                      ? 'bg-[#ffd43b]'
                      : 'bg-[#51cf66]'
                  }`}
                  style={{
                    width: `${
                      (estado.tiempoRestante / (estado.config.segundosPorTurno || 30)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Players Status Cards */}
          <PlayerCards
            estado={estado}
            mostrarDistancia={ajustes.mostrarDistancia}
          />

          {/* Interactive 2D Cartoon Board */}
          <MurosBoard
            estado={estado}
            modoDaltonico={ajustes.modoDaltonico}
            animacionesReducidas={ajustes.animacionesReducidas}
            onMover={handleMover}
            onPonerMuro={handlePonerMuro}
            onRotarMuro={() =>
              setEstado((s) => ({
                ...s,
                orientacionMuro: s.orientacionMuro === 'H' ? 'V' : 'H',
              }))
            }
            onInvalidWallAttempt={(motivo) => {
              const jugador = estado.jugadores[estado.turnoActual];
              jugador.estadisticas.intentosMuroInvalido++;
              showToast(motivo);
            }}
            bloqueadoPorAnimacion={
              bloqueadoPorAnimacion ||
              Boolean(
                estado.modoOnline &&
                  estado.miJugadorId !== undefined &&
                  estado.turnoActual !== estado.miJugadorId
              )
            }
          />

          {/* Bottom Action Bar with Reaction emojis */}
          <ActionBar
            estado={estado}
            onCambiarModo={(m) => {
              sounds.playClick();
              setEstado((s) => ({ ...s, modoAccion: m }));
            }}
            onRotarMuro={() => {
              sounds.playClick();
              setEstado((s) => ({
                ...s,
                orientacionMuro: s.orientacionMuro === 'H' ? 'V' : 'H',
              }));
            }}
            onPedirPista={pedirPista}
            onDeshacer={deshacer}
            onAbrirHistorial={() => {
              sounds.playClick();
              setMostrarHistorial(true);
            }}
            onEnviarReaccion={(emoji) => onlineService.sendReaction(emoji)}
            deshabilitado={
              bloqueadoPorAnimacion ||
              Boolean(
                estado.modoOnline &&
                  estado.miJugadorId !== undefined &&
                  estado.turnoActual !== estado.miJugadorId
              ) ||
              estado.jugadores[estado.turnoActual].tipo !== 'humano'
            }
          />
        </div>
      )}

      {/* Floating Animated Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#2b2140] text-white text-xs sm:text-sm font-extrabold py-2 px-5 rounded-full shadow-[0_6px_20px_rgba(0,0,0,0.35)] border-2 border-white/30 animate-[bounce_0.3s_ease-out] whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      {/* Disconnection Grace Period Countdown Modal */}
      {desconexionSegundos !== null && (
        <OnlineDisconnectModal
          segundosRestantes={desconexionSegundos}
          esAnfitrion={onlineService.getRole() === 'host'}
          onVolverAlMenu={() => {
            onlineService.cleanUp();
            setDesconexionSegundos(null);
            setPantalla('menu');
          }}
        />
      )}

      {/* Abandon Confirmation Modal (-20 ranking penalty) */}
      {confirmandoAbandono && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
          <div className="relative w-full max-w-sm bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col text-center">
            <div className="text-4xl mb-2">🏳️</div>
            <h3 className="text-xl font-black text-[#2b2140] mb-2">
              ¿Abandonar partida?
            </h3>
            <p className="text-xs text-[#593922] mb-4 leading-relaxed">
              Si te rindes o sales al menú ahora, se considerará una retirada y{' '}
              <strong className="text-[#c92a2a] underline font-black">
                perderás 20 puntos de ranking
              </strong>
              .
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setConfirmandoAbandono(false)}
                className="w-full py-2.5 px-4 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
              >
                Seguir jugando
              </button>

              <button
                onClick={() => {
                  const humano = estado.jugadores.find((p) => p.tipo === 'humano');
                  if (humano) {
                    penalizarAbandono(humano.nombre, 20);
                  }
                  sounds.playError();
                  showToast('🏳️ Partida abandonada (-20 puntos en ranking)');
                  setConfirmandoAbandono(false);
                  setBloqueadoPorAnimacion(false);
                  onlineService.cleanUp();
                  setEstado((s) => ({ ...s, pensandoBot: false }));
                  setPantalla('menu');
                }}
                className="w-full py-2 px-4 rounded-xl font-black text-xs bg-white text-[#c92a2a] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#ffe3e3] active:translate-y-0.5 cursor-pointer"
              >
                Abandonar (-20 pts)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historial Panel Overlay */}
      {mostrarHistorial && (
        <HistorialPanel
          acciones={estado.registroAcciones}
          onCerrar={() => setMostrarHistorial(false)}
          rondaActual={estado.torneo?.rondaActual}
          totalRondas={estado.torneo?.totalRondas}
        />
      )}

      {/* Modals */}
      {modalAbierto === 'ranking' && (
        <RankingModal onCerrar={() => setModalAbierto(null)} />
      )}

      {modalAbierto === 'logros' && (
        <LogrosModal onCerrar={() => setModalAbierto(null)} />
      )}

      {modalAbierto === 'como_jugar' && (
        <ComoSeJuegaModal onCerrar={() => setModalAbierto(null)} />
      )}

      {modalAbierto === 'ajustes' && (
        <AjustesModal
          ajustes={ajustes}
          onGuardar={(nuevos) => {
            setAjustes(nuevos);
            setEstado((s) => ({
              ...s,
              config: {
                ...s.config,
                permitirDeshacer: nuevos.permitirDeshacer,
                permitirPistas: nuevos.permitirPistas,
              },
            }));
          }}
          onCerrar={() => setModalAbierto(null)}
        />
      )}

      {modalAbierto === 'victoria' && (
        <VictoryModal
          estado={estado}
          desgloses={desgloses}
          nuevosLogros={nuevosLogros}
          subidasNivel={subidasNivel}
          onRevancha={revancha}
          onVerTablero={() => setModalAbierto(null)}
          onIrAlMenu={() => {
            setModalAbierto(null);
            onlineService.cleanUp();
            setPantalla('menu');
          }}
          onVerRanking={() => setModalAbierto('ranking')}
        />
      )}

      {modalAbierto === 'torneo' && estado.torneo && (
        <TorneoModal
          estado={estado}
          torneo={estado.torneo}
          onSiguienteRonda={handleSiguienteRondaTorneo}
          onFinalizarTorneo={() => {
            setModalAbierto(null);
            setPantalla('menu');
          }}
          onVerTablero={() => setModalAbierto(null)}
        />
      )}
    </div>
  );
}
