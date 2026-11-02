/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sounds } from './audio/murosAudio';
import {
  AchievementDef,
  AppSettings,
  BoardTheme,
  GameState,
  HatType,
  LevelInfo,
  MatchConfig,
  ScoreBreakdown,
  Screen,
  TorneoState,
  UserAccount,
} from './types/murosLocos';
import {
  calcularDesglosesPuntuacion,
  deshacerJugada,
  ejecutarAccionMover,
  ejecutarAccionMuro,
  ejecutarTurnoBot,
  iniciarPartida,
  obtenerCaminoPista,
} from './game/murosLocosEngine';
import {
  actualizarDespuesDePartida,
  cargarAjustes,
  guardarAjustes,
  guardarUsuarioActual,
  obtenerUsuarioActual,
  penalizarAbandono,
  sincronizarConNube,
  verificarCambiosUsuario,
} from './game/storage';
import { onlineService } from './game/onlineService';
import { MenuScreen } from './components/MenuScreen';
import { ConfigScreen } from './components/ConfigScreen';
import { OnlineLobbyScreen } from './components/OnlineLobbyScreen';
import { MurosBoard } from './components/MurosBoard';
import { ActionBar, HistorialPanel, PlayerCards } from './components/GameControls';
import {
  AdminPanelModal,
  AjustesModal,
  ComoJugarModal,
  LogrosModal,
  PerfilModal,
  RankingModal,
  TorneoModal,
  VictoryModal,
} from './components/Modals';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('menu');
  const [usuarioActual, setUsuarioActual] = useState<UserAccount | null>(() => obtenerUsuarioActual());
  const [ajustes, setAjustes] = useState<AppSettings>(() => cargarAjustes());

  // Game state
  const [estado, setEstado] = useState<GameState | null>(null);
  const [desgloses, setDesgloses] = useState<Map<number, ScoreBreakdown>>(new Map());
  const [nuevosLogros, setNuevosLogros] = useState<Map<string, AchievementDef[]>>(new Map());
  const [subidasNivel, setSubidasNivel] = useState<Map<string, { anterior: LevelInfo; nuevo: LevelInfo }>>(new Map());

  // Modals
  type ModalType = 'ranking' | 'logros' | 'como_jugar' | 'ajustes' | 'victoria' | 'torneo' | 'perfil' | 'admin' | null;
  const [modalActivo, setModalActivo] = useState<ModalType>(null);
  const [modalPrevio, setModalPrevio] = useState<ModalType>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false);

  // Post-game floating bar state (when user clicks "Ver Tablero" or closes victory modal)
  const [mostrarBarraPostPartida, setMostrarBarraPostPartida] = useState<boolean>(false);

  // Perspective flip (180° rotation)
  const [perspectivaInvertida, setPerspectivaInvertida] = useState<boolean>(false);

  // Online disconnect grace period countdown (120 seconds / 2 minutes)
  const [desconexionSegundos, setDesconexionSegundos] = useState<number | null>(null);

  // Toasts
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Time elapsed in match (seconds)
  const [tiempoPartida, setTiempoPartida] = useState<number>(0);
  const duracionIntervalRef = useRef<any>(null);

  // Sync settings sound on mount
  useEffect(() => {
    sounds.setEnabled(ajustes.sonido);
  }, [ajustes.sonido]);

  // Sync with cloud database on load
  useEffect(() => {
    sincronizarConNube(false).catch(() => {});
  }, []);

  // Check periodically for external admin changes or account deletion
  useEffect(() => {
    const interval = setInterval(() => {
      if (!usuarioActual) return;
      const res = verificarCambiosUsuario(usuarioActual);
      if (res.cambiado) {
        if (res.eliminado) {
          guardarUsuarioActual(null);
          setUsuarioActual(null);
          if (res.mensaje) showToast(res.mensaje);
        } else if (res.usuarioActualizado) {
          setUsuarioActual(res.usuarioActualizado);
          guardarUsuarioActual(res.usuarioActualizado);
          if (res.mensaje) showToast(res.mensaje);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [usuarioActual, showToast]);

  // Turn Timer effect (stops if disconnected or game ended)
  useEffect(() => {
    if (!estado || estado.terminada || !estado.config.modoConTiempo) return;
    if (desconexionSegundos !== null) return; // Paused during opponent disconnect

    const timer = setInterval(() => {
      setEstado((prev) => {
        if (!prev || prev.terminada || !prev.config.modoConTiempo) return prev;
        if (prev.tiempoRestante <= 1) {
          // Time expired for active player
          sounds.playError();
          const p = prev.jugadores[prev.turnoActual];
          p.estadisticas.turnosAgotados++;

          const nextTurno = (prev.turnoActual + 1) % prev.n;
          return {
            ...prev,
            turnoActual: nextTurno,
            tiempoRestante: prev.config.segundosPorTurno,
            modoAccion: 'mover',
            muroPrevisualizado: null,
            caminoPista: null,
            ultimoMensaje: `⏱️ ¡Se agotó el tiempo de ${p.nombre}! Turno pasado.`,
          };
        }
        return { ...prev, tiempoRestante: prev.tiempoRestante - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [estado?.terminada, estado?.config.modoConTiempo, estado?.turnoActual, desconexionSegundos]);

  // Match Duration Timer
  useEffect(() => {
    if (screen === 'juego' && estado && !estado.terminada) {
      duracionIntervalRef.current = setInterval(() => {
        setTiempoPartida((t) => t + 1);
      }, 1000);
    } else {
      if (duracionIntervalRef.current) clearInterval(duracionIntervalRef.current);
    }
    return () => {
      if (duracionIntervalRef.current) clearInterval(duracionIntervalRef.current);
    };
  }, [screen, estado?.terminada]);

  // Automated Bot Turn Handler
  useEffect(() => {
    if (!estado || estado.terminada) return;
    const curPlayer = estado.jugadores[estado.turnoActual];
    if (curPlayer.tipo === 'humano') return;

    let cancelado = false;
    const timeout = setTimeout(() => {
      if (cancelado) return;
      setEstado((prev) => {
        if (!prev || prev.terminada) return prev;
        const p = prev.jugadores[prev.turnoActual];
        if (p.tipo === 'humano') return prev;

        const { nuevoEstado, accion } = ejecutarTurnoBot(prev);
        if (accion.tipo === 'muro') {
          sounds.playWallPlace();
        } else {
          sounds.playMove();
        }

        // Check if game ended on bot's turn
        if (nuevoEstado.terminada) {
          finalizarPartida(nuevoEstado);
        }
        return nuevoEstado;
      });
    }, 650);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
  }, [estado?.turnoActual, estado?.terminada]);

  // Finalize match & calculate rewards
  const finalizarPartida = useCallback(
    (estadoFinal: GameState) => {
      sounds.playVictory();
      const matchDesgloses = calcularDesglosesPuntuacion(estadoFinal);
      setDesgloses(matchDesgloses);

      const res = actualizarDespuesDePartida(estadoFinal, matchDesgloses, tiempoPartida);
      setNuevosLogros(res.nuevosLogrosPorJugador);
      setSubidasNivel(res.subidasNivelPorJugador);

      setMostrarBarraPostPartida(false);

      if (estadoFinal.torneo && estadoFinal.torneo.activo) {
        setModalActivo('torneo');
      } else {
        setModalActivo('victoria');
      }
    },
    [tiempoPartida]
  );

  // Wire Online Game Listeners
  useEffect(() => {
    onlineService.setCallbacks({
      onGameStart: (remoteState) => {
        setTiempoPartida(0);
        setEstado(remoteState);
        setMostrarBarraPostPartida(false);
        setModalActivo(null);
        setScreen('juego');
        if (remoteState.miJugadorId === 1) {
          setPerspectivaInvertida(true);
        } else {
          setPerspectivaInvertida(false);
        }
        showToast('🚀 ¡Comienza la partida online!');
      },
      onStateSync: (remoteState) => {
        setEstado(remoteState);
        if (remoteState.terminada) {
          finalizarPartida(remoteState);
        }
      },
      onPlayerAction: (jugadorId: number, accion: 'mover' | 'muro' | 'pasar', payload: any) => {
        setEstado((prev) => {
          if (!prev) return prev;
          if (accion === 'mover') {
            const next = ejecutarAccionMover(prev, payload.destino, jugadorId);
            sounds.playMove();
            if (next.terminada) finalizarPartida(next);
            return next;
          } else if (accion === 'muro') {
            const next = ejecutarAccionMuro(prev, payload.coord, payload.orientacion, jugadorId);
            sounds.playWallPlace();
            if (next.terminada) finalizarPartida(next);
            return next;
          }
          return prev;
        });
      },
      onReaction: (jugadorId: number, emoji: string) => {
        setEstado((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            reaccionActiva: { jugadorId, emoji, ts: Date.now() },
          };
        });
        setTimeout(() => {
          setEstado((prev) => (prev ? { ...prev, reaccionActiva: null } : null));
        }, 2500);
      },
      onHostDisconnectWarning: (tiempo: number) => {
        setDesconexionSegundos(tiempo);
      },
      onHostReconnected: () => {
        setDesconexionSegundos(null);
        showToast('🟢 ¡Tu rival ha vuelto! Partida reanudada.');
      },
      onError: (err) => {
        showToast(`⚠️ ${err}`);
      },
    });
  }, [finalizarPartida, showToast]);

  // Online Disconnect countdown ticker
  useEffect(() => {
    if (desconexionSegundos === null) return;
    if (desconexionSegundos <= 0) {
      // 2 minutes expired: award abandonment victory
      if (estado && !estado.terminada) {
        showToast('🏆 Victoria otorgada por abandono del rival (+100 pts)');
        const miId = estado.miJugadorId ?? 0;
        const ganadorEstado: GameState = {
          ...estado,
          terminada: true,
          ganador: miId,
          ultimoMensaje: '¡Victoria por abandono del oponente!',
        };
        setEstado(ganadorEstado);
        finalizarPartida(ganadorEstado);
      }
      setDesconexionSegundos(null);
      return;
    }

    const timer = setInterval(() => {
      setDesconexionSegundos((s) => (s !== null ? s - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [desconexionSegundos, estado, finalizarPartida, showToast]);

  // User Actions during local / online play
  const handleMoverJugador = (destino: { r: number; c: number }) => {
    if (!estado || estado.terminada) return;
    const curPlayer = estado.jugadores[estado.turnoActual];

    if (estado.modoOnline && curPlayer.id !== estado.miJugadorId) {
      sounds.playError();
      return;
    }

    const next = ejecutarAccionMover(estado, destino, curPlayer.id);
    sounds.playMove();

    if (estado.modoOnline) {
      onlineService.sendAction('mover', { destino });
      if (estado.esAnfitrion) {
        onlineService.syncState(next);
      }
    }

    setEstado(next);
    if (next.terminada) {
      finalizarPartida(next);
    }
  };

  const handleColocarMuro = (coord: { r: number; c: number }) => {
    if (!estado || estado.terminada) return;
    const curPlayer = estado.jugadores[estado.turnoActual];

    if (estado.modoOnline && curPlayer.id !== estado.miJugadorId) {
      sounds.playError();
      return;
    }

    const next = ejecutarAccionMuro(estado, coord, estado.orientacionMuro, curPlayer.id);
    sounds.playWallPlace();

    if (estado.modoOnline) {
      onlineService.sendAction('muro', {
        orientacion: estado.orientacionMuro,
        r: coord.r,
        c: coord.c,
      });
      if (estado.esAnfitrion) {
        onlineService.syncState(next);
      }
    }

    setEstado(next);
    if (next.terminada) {
      finalizarPartida(next);
    }
  };

  const handleCambiarModo = (modo: 'mover' | 'muro') => {
    sounds.playClick();
    setEstado((prev) => (prev ? { ...prev, modoAccion: modo, caminoPista: null } : null));
  };

  const handleRotarMuro = () => {
    sounds.playClick();
    setEstado((prev) =>
      prev
        ? {
            ...prev,
            orientacionMuro: prev.orientacionMuro === 'H' ? 'V' : 'H',
            muroPrevisualizado: null,
          }
        : null
    );
  };

  const handlePedirPista = () => {
    if (!estado || estado.terminada) return;
    const curPlayer = estado.jugadores[estado.turnoActual];
    if (curPlayer.tipo !== 'humano') return;

    sounds.playClick();
    const camino = obtenerCaminoPista(curPlayer, estado.murosH, estado.murosV);
    curPlayer.estadisticas.usosPista++;

    setEstado((prev) =>
      prev
        ? {
            ...prev,
            caminoPista: camino,
            ultimoMensaje: `💡 Pista activada para ${curPlayer.nombre} (-5 pts)`,
          }
        : null
    );
  };

  const handleDeshacer = () => {
    if (!estado || estado.terminada || estado.modoOnline) return;
    sounds.playClick();
    const next = deshacerJugada(estado);
    setEstado(next);
  };

  const handleEnviarReaccion = (emoji: string) => {
    if (!estado || !estado.modoOnline) return;
    sounds.playClick();
    onlineService.sendReaction(emoji);
  };

  // Start Match
  const handleIniciarPartida = (config: MatchConfig) => {
    setTiempoPartida(0);
    const nuevo = iniciarPartida(config);
    setEstado(nuevo);
    setMostrarBarraPostPartida(false);
    setModalActivo(null);

    // If 2 players, user can start with normal perspective, but if playing as player 1, flip if online
    setPerspectivaInvertida(false);
    setScreen('juego');
  };

  // Start Online Match from Lobby
  const handleIniciarPartidaOnline = (maxJugadores: 2 | 4) => {
    const session = onlineService.getActiveSession();
    const lobby = onlineService.getLobbyPlayers();
    const num = maxJugadores;

    const myId = session?.myPlayerId ?? 0;
    // Top player (player 1) flips board so their pawn starts at bottom and moves UP
    if (myId === 1) {
      setPerspectivaInvertida(true);
    } else {
      setPerspectivaInvertida(false);
    }

    const defaultColors = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66'];
    const defaultHats: HatType[] = ['corona', 'pompon', 'antena', 'brote'];

    const configJugadores = Array.from({ length: num }).map((_, idx) => {
      const p = lobby[idx];
      return {
        nombre: p ? p.nombre : (idx === 0 ? 'Anfitrión' : `Jugador ${idx + 1}`),
        tipo: 'humano' as const,
        color: p ? p.color : defaultColors[idx] || '#ff6b6b',
        hat: p ? p.hat : defaultHats[idx] || 'corona',
      };
    });

    const config: MatchConfig = {
      numJugadores: num,
      jugadores: configJugadores,
      empiezaAlAzar: false,
      permitirDeshacer: false,
      permitirPistas: false,
      modoConTiempo: true,
      segundosPorTurno: 30,
      temaTablero: temaTableroActivo,
    };

    const nuevo = iniciarPartida(config);
    nuevo.modoOnline = true;
    nuevo.miJugadorId = myId;
    nuevo.codigoSala = session?.roomCode;
    nuevo.esAnfitrion = session?.role === 'host';

    setTiempoPartida(0);
    setEstado(nuevo);
    setMostrarBarraPostPartida(false);
    setModalActivo(null);
    setScreen('juego');

    if (session?.role === 'host') {
      onlineService.startGameAsHost(nuevo);
    }
  };

  // Rematch
  const handleRevancha = () => {
    if (!estado) return;
    sounds.playClick();
    setMostrarBarraPostPartida(false);
    setModalActivo(null);

    if (estado.modoOnline) {
      if (estado.miJugadorId !== undefined) {
        onlineService.requestRematch(estado.miJugadorId);
      }
      return;
    }

    const config = estado.config;
    handleIniciarPartida(config);
  };

  // Tournament next round
  const handleSiguienteRondaTorneo = () => {
    if (!estado || !estado.torneo) return;
    sounds.playClick();

    const t = estado.torneo;
    const ganadorId = estado.ganador !== null && estado.ganador >= 0 ? estado.ganador : 0;
    const ganadorNombre = estado.jugadores[ganadorId].nombre;

    const roundScores: Record<number, number> = {};
    estado.jugadores.forEach((p) => {
      roundScores[p.id] = (t.puntosAcumulados[p.id] || 0) + (p.id === ganadorId ? 100 : 25);
    });

    const newRondaActual = t.rondaActual + 1;
    const esFinalizado = newRondaActual > t.totalRondas;

    let campeonId: number | null = null;
    if (esFinalizado) {
      let maxPts = -1;
      Object.entries(roundScores).forEach(([idStr, pts]) => {
        if (pts > maxPts) {
          maxPts = pts;
          campeonId = Number(idStr);
        }
      });
    }

    const nextTorneo: TorneoState = {
      ...t,
      rondaActual: Math.min(newRondaActual, t.totalRondas),
      puntosAcumulados: roundScores,
      victoriasAcumuladas: {
        ...t.victoriasAcumuladas,
        [ganadorId]: (t.victoriasAcumuladas[ganadorId] || 0) + 1,
      },
      terminado: esFinalizado,
      ganadorGlobalId: campeonId,
      historialRondas: [
        ...t.historialRondas,
        {
          ronda: t.rondaActual,
          ganadorId,
          ganadorNombre,
          puntosRonda: roundScores,
        },
      ],
    };

    if (esFinalizado) {
      setEstado((prev) => (prev ? { ...prev, torneo: nextTorneo } : null));
      setModalActivo('torneo');
      return;
    }

    // Start next round
    const nextMatch = iniciarPartida(estado.config);
    nextMatch.torneo = nextTorneo;
    setTiempoPartida(0);
    setEstado(nextMatch);
    setModalActivo(null);
    setMostrarBarraPostPartida(false);
  };

  // Finish Tournament
  const handleFinalizarTorneo = () => {
    sounds.playClick();
    setModalActivo(null);
    setMostrarBarraPostPartida(false);
    setScreen('menu');
  };

  // Exit match to menu
  const handleVolverAlMenu = () => {
    sounds.playClick();
    if (estado && !estado.terminada) {
      // If human abandons active match, apply penalty
      const curPlayer = estado.jugadores[estado.turnoActual];
      if (curPlayer.tipo === 'humano') {
        penalizarAbandono(curPlayer.nombre, 20);
      }
    }
    if (estado?.modoOnline) {
      onlineService.disconnect();
    }
    setModalActivo(null);
    setMostrarBarraPostPartida(false);
    setDesconexionSegundos(null);
    setEstado(null);
    setScreen('menu');
  };

  // Board Theme calculation: from match config -> or current user theme -> or settings
  const temaTableroActivo: BoardTheme =
    estado?.config.temaTablero ||
    usuarioActual?.temaTablero ||
    ajustes.temaTablero ||
    'madera';

  // Format mm:ss for disconnect alert
  const formatMMSS = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#74c0fc] text-[#2b2140] flex flex-col items-center justify-between overflow-x-hidden overflow-y-auto selection:bg-[#ffd43b] selection:text-[#2b2140]">
      {/* Background clouds */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className="absolute top-10 w-48 h-16 bg-white/40 rounded-full filter blur-xs animate-[cloudDriftA_35s_linear_infinite]"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="absolute top-36 w-64 h-20 bg-white/30 rounded-full filter blur-xs animate-[cloudDriftB_45s_linear_infinite]"
          style={{ animationDelay: '-15s' }}
        />
        <div
          className="absolute top-72 w-52 h-16 bg-white/35 rounded-full filter blur-xs animate-[cloudDriftC_40s_linear_infinite]"
          style={{ animationDelay: '-8s' }}
        />
      </div>

      {/* Online Disconnect Discreet Top Alert (Non-blocking, turns timer paused) */}
      {desconexionSegundos !== null && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-[#fff3bf] border-3 border-[#2b2140] rounded-2xl p-2.5 shadow-[0_6px_0_#2b2140,0_10px_20px_rgba(0,0,0,0.25)] flex items-center justify-between gap-3 animate-[slideDown_0.25s_ease-out]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0 animate-bounce">⚠️</span>
            <div className="text-left min-w-0">
              <span className="text-xs font-black text-[#8f4b00] block truncate">
                Rival ausente • Turno pausado
              </span>
              <span className="text-[11px] font-semibold text-[#5c3c00] block leading-tight">
                Esperando reconexión ({formatMMSS(desconexionSegundos)})...
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleVolverAlMenu}
            className="py-1 px-2.5 rounded-xl bg-white border border-[#2b2140] text-[11px] font-black text-[#c92a2a] hover:bg-[#ffe3e3] cursor-pointer shrink-0"
          >
            Salir al Menú
          </button>
        </div>
      )}

      {/* Global Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#2b2140] text-white text-xs sm:text-sm font-black py-2 px-4 rounded-full border-2 border-white/20 shadow-[0_8px_20px_rgba(0,0,0,0.35)] animate-[slideDown_0.2s_ease-out]">
          {toast}
        </div>
      )}

      {/* MAIN SCREEN ROUTING */}
      {screen === 'menu' && (
        <MenuScreen
          usuarioActual={usuarioActual}
          onAbrirPerfil={() => setModalActivo('perfil')}
          onAbrirAdmin={() => setModalActivo('admin')}
          onIniciarPartida={() => setScreen('config')}
          onIniciarTorneo={() => {
            setScreen('config');
          }}
          onAbrirOnline={() => setScreen('online_lobby')}
          onAbrirRanking={() => setModalActivo('ranking')}
          onAbrirLogros={() => setModalActivo('logros')}
          onAbrirComoJugar={() => setModalActivo('como_jugar')}
          onAbrirAjustes={() => setModalActivo('ajustes')}
        />
      )}

      {screen === 'config' && (
        <ConfigScreen
          ajustes={ajustes}
          usuarioActual={usuarioActual}
          onIniciar={handleIniciarPartida}
          onVolver={() => setScreen('menu')}
        />
      )}

      {screen === 'online_lobby' && (
        <OnlineLobbyScreen
          usuarioActual={usuarioActual}
          onIniciarPartidaOnline={handleIniciarPartidaOnline}
          onVolverAlMenu={() => setScreen('menu')}
          onShowToast={showToast}
        />
      )}

      {screen === 'juego' && estado && (
        <div className="relative w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between p-2 sm:p-3 z-10">
          {/* Top In-Game Bar */}
          <div className="w-full max-w-[620px] mx-auto flex items-center justify-between px-2 py-1 mb-1 bg-white/70 backdrop-blur-xs rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <button
              onClick={handleVolverAlMenu}
              className="py-1 px-2.5 rounded-xl bg-white border border-[#2b2140] text-xs font-black text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] cursor-pointer transition-colors"
            >
              ◀ Salir
            </button>

            {/* Match info pill */}
            <div className="flex items-center gap-1.5 text-xs font-black text-[#593922]">
              {estado.torneo && (
                <span className="bg-[#ffd43b] text-[#5c3c00] px-2 py-0.5 rounded-full border border-[#2b2140]">
                  Ronda {estado.torneo.rondaActual}/{estado.torneo.totalRondas}
                </span>
              )}
              {estado.modoOnline && (
                <span className="bg-[#d3f9d8] text-[#134e20] px-2 py-0.5 rounded-full border border-[#2b2140]">
                  Sala: {estado.codigoSala}
                </span>
              )}
              {estado.config.modoConTiempo && (
                <span
                  className={`font-mono-num font-black px-2 py-0.5 rounded-full border border-[#2b2140] ${
                    estado.tiempoRestante <= 5
                      ? 'bg-[#ff6b6b] text-white animate-pulse'
                      : 'bg-[#fff8e7] text-[#2b2140]'
                  }`}
                >
                  ⏱️ {estado.tiempoRestante}s
                </span>
              )}
            </div>

            {/* Quick in-game settings */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setModalPrevio(modalActivo);
                  setModalActivo('ajustes');
                }}
                className="w-7 h-7 rounded-xl bg-white border border-[#2b2140] flex items-center justify-center text-xs font-black text-[#2b2140] hover:bg-[#f1f3f5] cursor-pointer shadow-xs"
                title="Ajustes rápidos"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Player Cards */}
          <PlayerCards estado={estado} mostrarDistancia={ajustes.mostrarDistancia} />

          {/* Central Arena Board */}
          <div className="flex-1 flex items-center justify-center py-1">
            <MurosBoard
              estado={estado}
              onMover={handleMoverJugador}
              onPonerMuro={(orientacion, r, c) => handleColocarMuro({ r, c })}
              onRotarMuro={handleRotarMuro}
              onInvalidWallAttempt={(motivo) => {
                sounds.playError();
                showToast(`⚠️ ${motivo}`);
              }}
              bloqueadoPorAnimacion={false}
              modoDaltonico={ajustes.modoDaltonico}
              animacionesReducidas={ajustes.animacionesReducidas}
              perspectivaInvertida={perspectivaInvertida}
              onTogglePerspectiva={() => setPerspectivaInvertida((p) => !p)}
              temaTablero={temaTableroActivo}
            />
          </div>

          {/* Action Bar */}
          <ActionBar
            estado={estado}
            onCambiarModo={handleCambiarModo}
            onRotarMuro={handleRotarMuro}
            onPedirPista={handlePedirPista}
            onDeshacer={handleDeshacer}
            onAbrirHistorial={() => setMostrarHistorial(true)}
            onEnviarReaccion={handleEnviarReaccion}
            deshabilitado={Boolean(
              estado.terminada ||
              (estado.modoOnline && estado.jugadores[estado.turnoActual].id !== estado.miJugadorId)
            )}
          />

          {/* Floating Post-Game Bar if board is being inspected freely */}
          {mostrarBarraPostPartida && estado.terminada && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#fff8e7] border-4 border-[#2b2140] rounded-2xl p-2 sm:p-2.5 shadow-[0_8px_0_#2b2140,0_20px_30px_rgba(0,0,0,0.35)] flex items-center gap-2 animate-[slideUp_0.2s_ease-out]">
              <button
                onClick={() => {
                  sounds.playClick();
                  setModalActivo(estado.torneo && estado.torneo.activo ? 'torneo' : 'victoria');
                }}
                className="py-1.5 px-3 rounded-xl bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] font-black text-xs hover:bg-[#fcc419] cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>🏆</span>
                <span>Ver Resultados</span>
              </button>
              <button
                onClick={handleRevancha}
                className="py-1.5 px-3 rounded-xl bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] font-black text-xs hover:bg-[#40c057] cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>🔄</span>
                <span>Revancha</span>
              </button>
              <button
                onClick={handleVolverAlMenu}
                className="py-1.5 px-3 rounded-xl bg-white text-[#2b2140] border-2 border-[#2b2140] font-black text-xs hover:bg-[#f1f3f5] cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>🏠</span>
                <span>Menú</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Historial Panel Overlay */}
      {mostrarHistorial && estado && (
        <HistorialPanel
          acciones={estado.registroAcciones || []}
          onCerrar={() => setMostrarHistorial(false)}
          rondaActual={estado.torneo?.rondaActual}
          totalRondas={estado.torneo?.totalRondas}
        />
      )}

      {/* MODALS */}
      {modalActivo === 'ajustes' && (
        <AjustesModal
          ajustes={ajustes}
          onGuardar={(nuevos) => {
            setAjustes(nuevos);
            guardarAjustes(nuevos);
          }}
          onCerrar={() => {
            setModalActivo(modalPrevio);
            setModalPrevio(null);
          }}
        />
      )}

      {modalActivo === 'como_jugar' && (
        <ComoJugarModal onCerrar={() => setModalActivo(null)} />
      )}

      {modalActivo === 'logros' && (
        <LogrosModal onCerrar={() => setModalActivo(null)} />
      )}

      {modalActivo === 'ranking' && (
        <RankingModal
          usuarioActual={usuarioActual}
          onAbrirPerfil={() => {
            setModalPrevio('ranking');
            setModalActivo('perfil');
          }}
          onCerrar={() => {
            // If user opened ranking from post-game, return to victory modal or board
            if (modalPrevio) {
              setModalActivo(modalPrevio);
              setModalPrevio(null);
            } else {
              setModalActivo(null);
            }
          }}
        />
      )}

      {modalActivo === 'perfil' && (
        <PerfilModal
          usuarioActual={usuarioActual}
          onLoginSuccess={(u) => {
            setUsuarioActual(u);
            guardarUsuarioActual(u);
            showToast(`¡Bienvenido, ${u.nombre}!`);
          }}
          onLogout={() => {
            setUsuarioActual(null);
            guardarUsuarioActual(null);
            showToast('Sesión cerrada');
          }}
          onAbrirAdmin={() => {
            setModalPrevio('perfil');
            setModalActivo('admin');
          }}
          onCerrar={() => {
            setModalActivo(modalPrevio);
            setModalPrevio(null);
          }}
        />
      )}

      {modalActivo === 'admin' && (
        <AdminPanelModal
          onShowToast={showToast}
          onCerrar={() => {
            setModalActivo(modalPrevio);
            setModalPrevio(null);
          }}
        />
      )}

      {modalActivo === 'torneo' && estado && estado.torneo && (
        <TorneoModal
          estado={estado}
          torneo={estado.torneo}
          onSiguienteRonda={handleSiguienteRondaTorneo}
          onFinalizarTorneo={handleFinalizarTorneo}
          onVerTablero={() => {
            setModalActivo(null);
            setMostrarBarraPostPartida(true);
          }}
        />
      )}

      {modalActivo === 'victoria' && estado && (
        <VictoryModal
          estado={estado}
          desgloses={desgloses}
          nuevosLogros={nuevosLogros}
          subidasNivel={subidasNivel}
          onRevancha={handleRevancha}
          onVerTablero={() => {
            setModalActivo(null);
            setMostrarBarraPostPartida(true);
          }}
          onVerRanking={() => {
            setModalPrevio('victoria');
            setModalActivo('ranking');
          }}
          onIrAlMenu={handleVolverAlMenu}
        />
      )}
    </div>
  );
};

export default App;
