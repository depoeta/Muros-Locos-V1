/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AjustesDeApp,
  AvatarTipoDeGorro,
  UserCuenta,
  DefLogro,
  DesglosePuntos,
  EstadoDeJuego,
  EstadoTorneo,
  InfoNivel,
  ConfigDePartida,
  PantallaApp,
  TamanoTablero,
  TemaTablero,
} from './types/murosLocos';
import {
  calcularDesglosePuntos,
  calcularDesglosesPuntuacion,
  deshacerJugada,
  ejecutarAccionMover,
  ejecutarAccionMuro,
  ejecutarTurnoBot,
  iniciarPartida,
  normalizarTamanoTablero,
  obtenerCaminoPista,
  sounds,
} from './game/murosLocosEngine';
import {
  actualizarDespuesDePartida,
  cargarAjustes,
  guardarAjustes,
  guardarUserActual,
  iniciarEscuchaNube,
  DiagnosticoDeRed,
  obtenerDiagnosticoRed,
  obteneruserActual,
  penalizarAbandono,
  pingServidor,
  sincronizarConNube,
  suscribirCambiosNube,
  suscribirDiagnostico,
  suscribirNotificacionesStaff,
  suscribirSesionRevocada,
} from './game/storage';
import { onlineService } from './game/onlineService';
import { ConfigScreen, MenuScreen } from './components/MenuScreens';
import { OnlineDiagnosticsOverlay, OnlineLobbyScreen } from './components/OnlineLobbyScreen';
import { MurosBoard } from './components/MurosBoard';
import { ActionBar, HistorialPanel, PlayerCards } from './components/GameControls';
import {
  AdminPanelModal,
  AjustesModal,
  AspectoModal,
  ComoJugarModal,
  LogrosModal,
  PerfilModal,
  RankingModal,
  TorneoModal,
  VictoryModal,
} from './components/Modals';
import { OfflineIndicator } from './components/PWAInstallControl';

function leerSalaDeUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URLSearchParams(window.location.search).get('sala');
    if (!raw) return null;
    const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean.length >= 3 ? clean.slice(0, 10) : null;
  } catch {
    return null;
  }
}

function limpiarSalaDeUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('sala')) {
      url.searchParams.delete('sala');
      const nextSearch = url.searchParams.toString();
      const nextRelative = url.pathname + (nextSearch ? `?${nextSearch}` : '') + url.hash;
      window.history.replaceState({}, document.title, nextRelative);
    }
  } catch {
    // ignore history errors in restricted iframes
  }
}

export const App: React.FC = () => {
  const [codigoSalaUrl, setCodigoSalaUrl] = useState<string | null>(() => leerSalaDeUrl());
  const [screen, setScreen] = useState<PantallaApp>(() =>
    leerSalaDeUrl() ? 'online_lobby' : 'menu'
  );
  const [esTorneoConfig, setEsTorneoConfig] = useState<boolean>(false);
  const [userActual, setuserActual] = useState<UserCuenta | null>(() =>
    obteneruserActual()
  );
  const [ajustes, setAjustes] = useState<AjustesDeApp>(() => cargarAjustes());
  const [modalAspectoAbierto, setModalAspectoAbierto] = useState(false);

  // Diagnóstico en tiempo real de conexión a la Database (D1) (aviso permanente en todo momento)
  const [diagRed, setDiagRed] = useState<DiagnosticoDeRed>(() => obtenerDiagnosticoRed());
  const [reconectandoDb, setReconectandoDb] = useState(false);
  const prevDbRef = useRef<boolean>(true);

  // Estado de partida
  const [estado, setEstado] = useState<EstadoDeJuego | null>(null);
  const [desgloses, setDesgloses] = useState<Map<number, DesglosePuntos>>(new Map());
  const [nuevosLogros, setNuevosLogros] = useState<Map<string, DefLogro[]>>(new Map());
  const [subidasNivel, setSubidasNivel] = useState<
    Map<string, { anterior: InfoNivel; nuevo: InfoNivel }>
  >(new Map());

  // Modales
  type ModalType =
    | 'ranking'
    | 'logros'
    | 'como_jugar'
    | 'ajustes'
    | 'victoria'
    | 'torneo'
    | 'perfil'
    | 'admin'
    | null;
  const [modalActivo, setModalActivo] = useState<ModalType>(null);
  const [modalPrevio, setModalPrevio] = useState<ModalType>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false);
  const [mostrarBarraPostPartida, setMostrarBarraPostPartida] = useState<boolean>(false);
  const [perspectivaInvertida, setPerspectivaInvertida] = useState<boolean>(false);
  const [desconexionSegundos, setDesconexionSegundos] = useState<number | null>(null);

  // Confirmación y validez de revancha Online P2P
  const [estadoRevanchaOnline, setEstadoRevanchaOnline] = useState<
    'idle' | 'esperando' | 'recibida' | 'no_disponible'
  >('idle');
  const [solicitanteRevancha, setSolicitanteRevancha] = useState<string | null>(null);
  const [mensajeRevanchaNoDisponible, setMensajeRevanchaNoDisponible] = useState<string | null>(
    null
  );
  const estadoRevanchaRef = useRef(estadoRevanchaOnline);
  estadoRevanchaRef.current = estadoRevanchaOnline;
  const aceptacionesRevanchaRef = useRef<Set<number>>(new Set());

  const resetEstadoRevanchaOnline = useCallback(() => {
    setEstadoRevanchaOnline('idle');
    setSolicitanteRevancha(null);
    setMensajeRevanchaNoDisponible(null);
    aceptacionesRevanchaRef.current.clear();
  }, []);

  // Toasts
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const [tiempoPartida, setTiempoPartida] = useState<number>(0);
  const duracionIntervalRef = useRef<any>(null);
  const partidaContabilizadaRef = useRef<boolean>(false);

  useEffect(() => {
    sounds.setEnabled(ajustes.sonido);
  }, [ajustes.sonido]);

  // Al volver al menú principal siempre limpiamos ?sala=[código] de la barra de direcciones
  useEffect(() => {
    if (screen === 'menu') {
      limpiarSalaDeUrl();
      setCodigoSalaUrl(null);
    }
  }, [screen]);

  // Soportar navegación atrás/adelante si cambia ?sala=
  useEffect(() => {
    const onPopState = () => {
      const code = leerSalaDeUrl();
      if (code) {
        setCodigoSalaUrl(code);
        setScreen('online_lobby');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Suscripción permanente al estado de la Database + resincronización automática al volver internet
  useEffect(() => {
    const onBrowserOnline = () => {
      pingServidor()
        .then((diag) => {
          if (diag.dbConectado) {
            return sincronizarConNube(true);
          }
        })
        .catch(() => {});
    };
    window.addEventListener('online', onBrowserOnline);

    const unsubDiag = suscribirDiagnostico((d) => {
      setDiagRed(d);
      if (d.checkedOnce) {
        if (!prevDbRef.current && d.dbConectado) {
          showToast('🟢 Conexión con la Database restablecida');
        }
        prevDbRef.current = d.dbConectado;
      }
    });

    return () => {
      window.removeEventListener('online', onBrowserOnline);
      unsubDiag();
    };
  }, [showToast]);

  const handleReintentarDb = async () => {
    sounds.playClick();
    setReconectandoDb(true);
    try {
      const diag = await pingServidor();
      if (diag.dbConectado) {
        await sincronizarConNube(true);
        showToast('🟢 Conectado a la Database — Datos sincronizados');
      } else {
        showToast('🔴 Sigue sin conexión a la Database');
      }
    } finally {
      setReconectandoDb(false);
    }
  };

  const userActualRef = useRef<UserCuenta | null>(userActual);
  userActualRef.current = userActual;

  const modalActivoRef = useRef<ModalType>(modalActivo);
  modalActivoRef.current = modalActivo;

  // Sincronización inicial, sesiones revocadas, notificaciones staff y escucha ligera cada 90s contra la Database
  useEffect(() => {
    sincronizarConNube(false).catch(() => {});
    const stopListener = iniciarEscuchaNube(90000);
    const unsubs = suscribirCambiosNube(({ cuentas }) => {
      const current = userActualRef.current;
      if (current && current.id !== 'admin') {
        if (!cuentas || Object.keys(cuentas).length === 0) {
          return;
        }
        const fresh = cuentas[current.id];
        if (!fresh) {
          // Solo desconectar si la base de datos descargada contiene users y confirma que este fue borrado
          const otrasCuentas = Object.keys(cuentas).filter((k) => k !== 'admin');
          if (otrasCuentas.length > 0) {
            setuserActual(null);
            guardarUserActual(null);
            if (modalActivoRef.current === 'admin') {
              setModalActivo(null);
              setModalPrevio(null);
            }
            showToast('⚠️ Tu cuenta ya no existe en la Database');
          }
        } else if (
          fresh.rol !== current.rol ||
          fresh.puntos !== current.puntos ||
          fresh.victorias !== current.victorias ||
          fresh.nombre !== current.nombre ||
          fresh.avatarHat !== current.avatarHat ||
          fresh.avatarColor !== current.avatarColor ||
          fresh.avatarRopa !== current.avatarRopa ||
          fresh.avatarRopaColor !== current.avatarRopaColor ||
          fresh.avatarAura !== current.avatarAura ||
          fresh.temaTablero !== current.temaTablero ||
          (fresh.inventario?.personajes?.length || 0) !== (current.inventario?.personajes?.length || 0)
        ) {
          const teniaStaff = current.rol === 'admin' || current.rol === 'mod' || current.rol === 'dev';
          const mantieneStaff = fresh.rol === 'admin' || fresh.rol === 'mod' || fresh.rol === 'dev';
          const perdioStaff = teniaStaff && !mantieneStaff;
          setuserActual(fresh);
          guardarUserActual(fresh);
          if (perdioStaff) {
            if (modalActivoRef.current === 'admin') {
              setModalActivo(null);
              setModalPrevio(null);
            }
            showToast('⛔ Tus permisos de Staff fueron revocados');
          } else {
            showToast('☁️ Perfil sincronizado con la Database');
          }
        }
      }
    });

    const unsubRevocada = suscribirSesionRevocada((motivo) => {
      setuserActual(null);
      if (modalActivoRef.current === 'admin') {
        setModalActivo(null);
        setModalPrevio(null);
      }
      sounds.playError();
      showToast(`🔒 ${motivo}`);
    });

    const unsubStaffNotif = suscribirNotificacionesStaff((notifs) => {
      const ultima = notifs[notifs.length - 1];
      if (ultima) {
        const msgTexto = ultima.detalle || ultima.mensaje || ultima.accion || 'Actividad Staff';
        showToast(`🔔 ${ultima.actorNombre}: ${msgTexto}`);
      }
    });

    return () => {
      stopListener();
      unsubs();
      unsubRevocada();
      unsubStaffNotif();
    };
  }, [showToast]);

  // Temporizador de turno
  useEffect(() => {
    if (!estado || estado.terminada || !estado.config.modoConTiempo) return;
    if (desconexionSegundos !== null) return;

    const timer = setInterval(() => {
      setEstado((prev) => {
        if (!prev || prev.terminada || !prev.config.modoConTiempo) return prev;
        if (prev.tiempoRestante <= 1) {
          // En modo Online, solo el anfitrión decide el cambio de turno y lo sincroniza a todos
          if (prev.modoOnline && !prev.esAnfitrion) {
            return { ...prev, tiempoRestante: 0 };
          }

          sounds.playError();
          const jugadoresClonados = prev.jugadores.map((jug, idx) =>
            idx === prev.turnoActual
              ? {
                  ...jug,
                  estadisticas: {
                    ...jug.estadisticas,
                    turnosAgotados: jug.estadisticas.turnosAgotados + 1,
                  },
                }
              : jug
          );
          const p = jugadoresClonados[prev.turnoActual];
          const nextTurno = (prev.turnoActual + 1) % prev.n;
          const timeoutState: EstadoDeJuego = {
            ...prev,
            jugadores: jugadoresClonados,
            turnoActual: nextTurno,
            tiempoRestante: prev.config.segundosPorTurno,
            modoAccion: 'mover',
            muroPrevisualizado: null,
            caminoPista: null,
            ultimoMensaje: `⏱️ ¡Se agotó el tiempo de ${p.nombre}! Turno pasado.`,
          };

          if (prev.modoOnline && prev.esAnfitrion) {
            setTimeout(() => onlineService.syncState(timeoutState), 0);
          }
          return timeoutState;
        }
        return { ...prev, tiempoRestante: prev.tiempoRestante - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [estado?.terminada, estado?.config.modoConTiempo, estado?.turnoActual, desconexionSegundos]);

  // Duración total de la partida
  const tiempoPartidaRef = useRef<number>(0);
  tiempoPartidaRef.current = tiempoPartida;

  const estadoRef = useRef<EstadoDeJuego | null>(null);
  estadoRef.current = estado;

  useEffect(() => {
    if (screen === 'juego' && estado && !estado.terminada) {
      duracionIntervalRef.current = setInterval(() => {
        setTiempoPartida((t) => t + 1);
      }, 1000);
    } else if (duracionIntervalRef.current) {
      clearInterval(duracionIntervalRef.current);
    }
    return () => {
      if (duracionIntervalRef.current) clearInterval(duracionIntervalRef.current);
    };
  }, [screen, estado?.terminada]);

  // Finalizar partida y calcular recompensas una única vez por partida
  const finalizarPartida = useCallback((estadoFinal: EstadoDeJuego) => {
    if (partidaContabilizadaRef.current) return;
    partidaContabilizadaRef.current = true;

    limpiarSalaDeUrl();
    setCodigoSalaUrl(null);

    sounds.playVictory();
    const matchDesgloses = calcularDesglosesPuntuacion(estadoFinal);
    let estadoParaGuardar: EstadoDeJuego = estadoFinal;

    // Si pertenece a un Torneo, contabilizar de inmediato los puntos de ESTA ronda (incluida la Ronda 1)
    // y sumar +10 puntos extra al campeón global al concluir la última ronda.
    if (estadoFinal.torneo && estadoFinal.torneo.activo) {
      const t = estadoFinal.torneo;
      const ganadorId =
        estadoFinal.ganador !== null && estadoFinal.ganador >= 0 ? estadoFinal.ganador : -1;
      const ganadorNombre =
        ganadorId >= 0 ? estadoFinal.jugadores[ganadorId]?.nombre || 'Empate' : 'Empate';

      const puntosRonda: Record<number, number> = {};
      const nuevosAcumulados: Record<number, number> = { ...t.puntosAcumulados };
      estadoFinal.jugadores.forEach((p) => {
        const ptsPartida = matchDesgloses.get(p.id)?.total || 0;
        puntosRonda[p.id] = ptsPartida;
        nuevosAcumulados[p.id] = (t.puntosAcumulados[p.id] || 0) + ptsPartida;
      });

      const nuevasVictorias: Record<number, number> = { ...t.victoriasAcumuladas };
      if (ganadorId >= 0) {
        nuevasVictorias[ganadorId] = (nuevasVictorias[ganadorId] || 0) + 1;
      }

      const esUltimaRonda = t.rondaActual >= t.totalRondas;
      let campeonId: number | null = null;

      if (esUltimaRonda) {
        const ordenados = [...estadoFinal.jugadores].sort((a, b) => {
          const diffPts = (nuevosAcumulados[b.id] || 0) - (nuevosAcumulados[a.id] || 0);
          if (diffPts !== 0) return diffPts;
          return (nuevasVictorias[b.id] || 0) - (nuevasVictorias[a.id] || 0);
        });
        const campeon = ordenados[0];
        if (campeon) {
          campeonId = campeon.id;
          // +10 puntos extra al ganar el torneo completo
          nuevosAcumulados[campeon.id] = (nuevosAcumulados[campeon.id] || 0) + 10;
          puntosRonda[campeon.id] = (puntosRonda[campeon.id] || 0) + 10;
          matchDesgloses.set(
            campeon.id,
            calcularDesglosePuntos(campeon, estadoFinal, 0, 10)
          );
        }
      }

      const updatedTorneo: EstadoTorneo = {
        ...t,
        puntosAcumulados: nuevosAcumulados,
        victoriasAcumuladas: nuevasVictorias,
        terminado: esUltimaRonda,
        ganadorGlobalId: campeonId,
        historialRondas: [
          ...t.historialRondas,
          {
            ronda: t.rondaActual,
            ganadorId: ganadorId >= 0 ? ganadorId : 0,
            ganadorNombre,
            puntosRonda,
          },
        ],
      };

      estadoParaGuardar = { ...estadoFinal, torneo: updatedTorneo };
      setEstado((prev) =>
        prev ? { ...prev, torneo: updatedTorneo } : estadoParaGuardar
      );
    }

    setDesgloses(new Map(matchDesgloses));

    const res = actualizarDespuesDePartida(
      estadoParaGuardar,
      matchDesgloses,
      tiempoPartidaRef.current
    );
    setNuevosLogros(res.nuevosLogrosPorJugador);
    setSubidasNivel(res.subidasNivelPorJugador);

    const refreshedUser = obteneruserActual();
    if (refreshedUser) {
      setuserActual(refreshedUser);
    }

    setMostrarBarraPostPartida(false);

    if (estadoParaGuardar.torneo && estadoParaGuardar.torneo.activo) {
      setModalActivo('torneo');
    } else {
      setModalActivo('victoria');
    }
  }, []);

  // Turno automático del Bot: ~0.95s (ágil y natural) sin reiniciarse con el reloj
  useEffect(() => {
    if (screen !== 'juego') return;
    const snap = estadoRef.current;
    if (!snap || snap.terminada) return;
    const curPlayer = snap.jugadores[snap.turnoActual];
    if (!curPlayer || curPlayer.tipo === 'humano') return;

    const timeout = setTimeout(() => {
      const actual = estadoRef.current;
      if (!actual || actual.terminada) return;
      const p = actual.jugadores[actual.turnoActual];
      if (!p || p.tipo === 'humano') return;

      const { nuevoEstado, accion } = ejecutarTurnoBot(actual);
      if (accion.tipo === 'muro') {
        sounds.playWallPlace();
      } else {
        sounds.playMove();
      }

      setEstado(nuevoEstado);
      if (nuevoEstado.terminada) {
        finalizarPartida(nuevoEstado);
      }
    }, 1300);

    return () => {
      clearTimeout(timeout);
    };
  }, [screen, estado?.turnoActual, estado?.turnosTotales, estado?.terminada, finalizarPartida]);

  // Tema activo de tablero: config de partida -> terreno predeterminado del user -> ajustes
  const temaTableroActivo: TemaTablero =
    estado?.config.temaTablero ||
    userActual?.temaTablero ||
    ajustes.temaTablero ||
    'madera';

  const iniciarRevanchaOnlineComoHost = useCallback(() => {
    const actual = estadoRef.current;
    if (!actual || !actual.esAnfitrion) return;

    partidaContabilizadaRef.current = false;
    const nuevo = iniciarPartida({ ...actual.config, empiezaAlAzar: true });
    nuevo.modoOnline = true;
    nuevo.miJugadorId = 0;
    nuevo.codigoSala = actual.codigoSala;
    nuevo.esAnfitrion = true;

    resetEstadoRevanchaOnline();
    setDesconexionSegundos(null);
    setTiempoPartida(0);
    setMostrarBarraPostPartida(false);
    setModalActivo(null);
    setPerspectivaInvertida(false);
    setEstado(nuevo);
    setScreen('juego');
    onlineService.startGameAsHost(nuevo);
    showToast('🔄 ¡Revancha iniciada!');
  }, [resetEstadoRevanchaOnline, showToast]);

  // Evitar que la espera de revancha se quede bloqueada indefinidamente
  useEffect(() => {
    if (estadoRevanchaOnline !== 'esperando') return;
    const timeout = setTimeout(() => {
      if (estadoRevanchaRef.current !== 'esperando') return;
      if (!onlineService.canRequestRematch()) {
        const msg = '⚠️ Esa opción ya no es válida ya que el jugador acaba de retirarse.';
        setEstadoRevanchaOnline('no_disponible');
        setMensajeRevanchaNoDisponible(msg);
        showToast(msg);
      } else {
        aceptacionesRevanchaRef.current.clear();
        setEstadoRevanchaOnline('idle');
        showToast('⏱️ Tiempo de espera agotado para la revancha.');
      }
    }, 20000);
    return () => clearTimeout(timeout);
  }, [estadoRevanchaOnline, showToast]);

  const otorgarVictoriaPorAbandono = useCallback(
    (motivoToast: string, mensajeTablero: string, nombreRetirado?: string) => {
      const msgNoDisp = nombreRetirado
        ? `⚠️ Esa opción ya no es válida ya que ${nombreRetirado} acaba de retirarse.`
        : '⚠️ Esa opción ya no es válida ya que el jugador acaba de retirarse.';
      setDesconexionSegundos(null);
      setEstadoRevanchaOnline('no_disponible');
      setMensajeRevanchaNoDisponible(msgNoDisp);

      const actual = estadoRef.current;
      if (!actual || actual.terminada) {
        showToast(motivoToast);
        return;
      }

      showToast(motivoToast);
      const miId = actual.miJugadorId ?? 0;
      const ganadorEstado: EstadoDeJuego = {
        ...actual,
        terminada: true,
        ganador: miId,
        ultimoMensaje: mensajeTablero,
      };
      setEstado(ganadorEstado);
      finalizarPartida(ganadorEstado);
    },
    [finalizarPartida, showToast]
  );

  // Eventos del modo Online P2P
  useEffect(() => {
    onlineService.setCallbacks({
      onGameStart: (remoteState) => {
        partidaContabilizadaRef.current = false;
        resetEstadoRevanchaOnline();
        setDesconexionSegundos(null);
        setTiempoPartida(0);
        setEstado(remoteState);
        setMostrarBarraPostPartida(false);
        setModalActivo(null);
        setScreen('juego');
        // MurosBoard coloca automáticamente tu lado abajo sin animación de giro
        setPerspectivaInvertida(false);
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
          if (!prev || prev.terminada) return prev;
          if (prev.turnoActual !== jugadorId) {
            if (prev.esAnfitrion) {
              setTimeout(() => onlineService.syncState(prev), 0);
            }
            return prev;
          }

          if (accion === 'mover' && payload?.destino) {
            const next = ejecutarAccionMover(prev, payload.destino, jugadorId);
            if (next === prev) {
              if (prev.esAnfitrion) setTimeout(() => onlineService.syncState(prev), 0);
              return prev;
            }
            sounds.playMove();
            if (prev.esAnfitrion) setTimeout(() => onlineService.syncState(next), 0);
            if (next.terminada) setTimeout(() => finalizarPartida(next), 0);
            return next;
          } else if (accion === 'muro') {
            const coord = payload?.coord || { r: payload?.r, c: payload?.c };
            const next = ejecutarAccionMuro(prev, coord, payload.orientacion, jugadorId);
            if (next === prev) {
              if (prev.esAnfitrion) setTimeout(() => onlineService.syncState(prev), 0);
              return prev;
            }
            sounds.playWallPlace();
            if (prev.esAnfitrion) setTimeout(() => onlineService.syncState(next), 0);
            if (next.terminada) setTimeout(() => finalizarPartida(next), 0);
            return next;
          }
          return prev;
        });
      },
      onReaction: (jugadorId: number, emoji: string) => {
        setEstado((prev) =>
          prev ? { ...prev, reaccionActiva: { jugadorId, emoji, ts: Date.now() } } : null
        );
        setTimeout(() => {
          setEstado((prev) => (prev ? { ...prev, reaccionActiva: null } : null));
        }, 2500);
      },
      onRematchRequested: (jugadorId: number, nombre: string) => {
        const actual = estadoRef.current;
        if (!actual || !actual.modoOnline) return;
        aceptacionesRevanchaRef.current.add(jugadorId);

        // Si yo ya había solicitado revancha simultáneamente, confirmar de inmediato
        if (estadoRevanchaRef.current === 'esperando') {
          const miId = actual.miJugadorId ?? 0;
          aceptacionesRevanchaRef.current.add(miId);
          onlineService.respondRematch(true);
          if (actual.esAnfitrion && aceptacionesRevanchaRef.current.size >= actual.n) {
            iniciarRevanchaOnlineComoHost();
          }
          return;
        }

        setSolicitanteRevancha(nombre);
        setEstadoRevanchaOnline('recibida');
        setMostrarBarraPostPartida(false);
        setModalActivo('victoria');
        showToast(`🔄 ${nombre} te pidió una revancha`);
      },
      onRematchResponded: (jugadorId: number, nombre: string, aceptada: boolean) => {
        const actual = estadoRef.current;
        if (!actual || !actual.modoOnline) return;

        if (!aceptada) {
          const msg = `⚠️ Esa opción ya no es válida ya que ${nombre} acaba de retirarse.`;
          sounds.playError();
          setEstadoRevanchaOnline('no_disponible');
          setMensajeRevanchaNoDisponible(msg);
          showToast(msg);
          return;
        }

        aceptacionesRevanchaRef.current.add(jugadorId);
        if (actual.esAnfitrion && aceptacionesRevanchaRef.current.size >= actual.n) {
          iniciarRevanchaOnlineComoHost();
        }
      },
      onPlayerLeftRoom: (nombre: string) => {
        const msg = `⚠️ Esa opción ya no es válida ya que ${nombre} acaba de retirarse.`;
        if (estadoRevanchaRef.current === 'esperando' || estadoRevanchaRef.current === 'recibida') {
          sounds.playError();
        }
        setEstadoRevanchaOnline('no_disponible');
        setMensajeRevanchaNoDisponible(msg);
        showToast(`🚪 ${nombre} se ha retirado de la sala`);
      },
      onOpponentAbandoned: (nombre: string) => {
        otorgarVictoriaPorAbandono(
          `🚪 ${nombre} abandonó la partida — ¡Victoria por abandono! (+5 pts)`,
          `¡${nombre} se retiró de la sala! Victoria otorgada.`,
          nombre
        );
      },
      onHostDisconnectWarning: (tiempo: number) => {
        setDesconexionSegundos(tiempo > 0 ? tiempo : null);
      },
      onDisconnectTimeout: () => {
        otorgarVictoriaPorAbandono(
          '🏆 El rival se desconectó — ¡Victoria otorgada! (+5 pts)',
          '¡Victoria por abandono del oponente!'
        );
      },
      onHostReconnected: () => {
        setDesconexionSegundos(null);
        showToast('🟢 ¡Tu rival ha vuelto! Partida reanudada.');
      },
      onError: (err) => {
        showToast(`⚠️ ${err}`);
      },
    });
  }, [
    finalizarPartida,
    iniciarRevanchaOnlineComoHost,
    otorgarVictoriaPorAbandono,
    resetEstadoRevanchaOnline,
    showToast,
  ]);

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
    const camino = obtenerCaminoPista(curPlayer, estado.murosH, estado.murosV, estado.n);
    curPlayer.estadisticas.usosPista++;

    setEstado((prev) =>
      prev
        ? {
            ...prev,
            caminoPista: camino,
            ultimoMensaje: `💡 Pista activada para ${curPlayer.nombre} (-1 pt)`,
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
    if (!estado) return;
    sounds.playClick();
    const curPlayerId = estado.modoOnline ? (estado.miJugadorId ?? 0) : estado.turnoActual;
    setEstado((prev) =>
      prev ? { ...prev, reaccionActiva: { jugadorId: curPlayerId, emoji, ts: Date.now() } } : null
    );
    setTimeout(() => {
      setEstado((prev) => (prev ? { ...prev, reaccionActiva: null } : null));
    }, 2800);

    if (estado.modoOnline) {
      onlineService.sendReaction(emoji);
    }
  };

  const handleIniciarPartida = (config: ConfigDePartida) => {
    partidaContabilizadaRef.current = false;
    resetEstadoRevanchaOnline();
    setDesconexionSegundos(null);
    setTiempoPartida(0);
    if (typeof config.rotationMode === 'boolean' && config.jugadores.filter((p) => p.tipo === 'humano').length >= 2) {
      setAjustes((prev) => {
        const updated = { ...prev, cambiarVistaPorTurno: config.rotationMode };
        guardarAjustes(updated);
        return updated;
      });
    }
    const nuevo = iniciarPartida(config);
    setEstado(nuevo);
    setMostrarBarraPostPartida(false);
    setModalActivo(null);
    setPerspectivaInvertida(false);
    setScreen('juego');
  };

  const handlePartidaSorpresa = () => {
    const dificultades = ['bot_facil', 'bot_normal', 'bot_dificil'] as const;
    const temas: TemaTablero[] = ['madera', 'neon', 'hielo', 'lava'];
    const botTipo = dificultades[Math.floor(Math.random() * dificultades.length)];
    const temaAzar = temas[Math.floor(Math.random() * temas.length)];
    const botNombre =
      botTipo === 'bot_dificil'
        ? 'Bot Maestro'
        : botTipo === 'bot_normal'
        ? 'Bot Astuto'
        : 'Bot Curioso';

    const configSorpresa: ConfigDePartida = {
      numJugadores: 2,
      jugadores: [
        {
          cuentaId: userActual?.id,
          nombre: userActual?.nombre || 'Jugador 1',
          tipo: 'humano',
          color: userActual?.avatarColor || '#ff6b6b',
          hat: userActual?.avatarHat || 'corona',
          ropa: userActual?.avatarRopa || 'ninguna',
          ropaColor: userActual?.avatarRopaColor,
          aura: userActual?.avatarAura || 'ninguna',
        },
        {
          nombre: botNombre,
          tipo: botTipo,
          color: '#4dabf7',
          hat: 'bot_cpu',
        },
      ],
      empiezaAlAzar: true,
      permitirDeshacer: true,
      permitirPistas: true,
      modoConTiempo: false,
      segundosPorTurno: 30,
      temaTablero: temaAzar,
      rotationMode: false,
    };

    handleIniciarPartida(configSorpresa);
    showToast(`🎲 ¡Reto Aleatorio vs ${botNombre}!`);
  };

  const handleIniciarPartidaOnline = (maxJugadores: 2 | 4, tamanoTablero?: TamanoTablero) => {
    partidaContabilizadaRef.current = false;
    const session = onlineService.getActiveSession();
    const lobby = onlineService.getLobbyPlayers();
    const num: 2 | 4 = maxJugadores === 2 ? 2 : 4;
    const boardSize = normalizarTamanoTablero(tamanoTablero ?? session?.tamanoTablero ?? onlineService.getTamanoTablero());

    const liveRole = onlineService.getRole();
    const role = liveRole || session?.role || 'host';
    const myId = onlineService.getMyPlayerId() ?? session?.myPlayerId ?? 0;
    const code = onlineService.getRoomCode() || session?.roomCode;

    // MurosBoard aplica automáticamente la rotación propia de cada jugador (inicio abajo -> meta arriba)
    setPerspectivaInvertida(false);
    resetEstadoRevanchaOnline();
    setDesconexionSegundos(null);

    const defaultColors = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66'];
    const defaultHats: AvatarTipoDeGorro[] = ['corona', 'pompon', 'antena', 'brote'];

    const configJugadores = Array.from({ length: num }).map((_, idx) => {
      const p = lobby[idx];
      const isMe = idx === myId;
      return {
        cuentaId: p?.cuentaId ?? (isMe ? userActual?.id : undefined),
        nombre: p ? p.nombre : idx === 0 ? 'Anfitrión' : `Jugador ${idx + 1}`,
        tipo: 'humano' as const,
        color: p ? p.color : defaultColors[idx] || '#ff6b6b',
        hat: p ? p.hat : defaultHats[idx] || 'corona',
        ropa: p?.ropa ?? (isMe ? userActual?.avatarRopa : 'ninguna'),
        ropaColor: p?.ropaColor ?? (isMe ? userActual?.avatarRopaColor : undefined),
        aura: p?.aura ?? (isMe ? userActual?.avatarAura : 'ninguna'),
      };
    });

    const config: ConfigDePartida = {
      numJugadores: num,
      jugadores: configJugadores,
      empiezaAlAzar: false,
      permitirDeshacer: false,
      permitirPistas: false,
      modoConTiempo: true,
      segundosPorTurno: 45,
      tamanoTablero: boardSize,
      temaTablero: userActual?.temaTablero || ajustes.temaTablero || 'madera',
      rotationMode: false,
    };

    const nuevo = iniciarPartida(config);
    nuevo.modoOnline = true;
    nuevo.miJugadorId = myId;
    nuevo.codigoSala = code;
    nuevo.esAnfitrion = role === 'host';

    setTiempoPartida(0);
    setEstado(nuevo);
    setMostrarBarraPostPartida(false);
    setModalActivo(null);
    setScreen('juego');

    if (role === 'host') {
      onlineService.startGameAsHost(nuevo);
    }
  };

  const handleCancelarEsperaRevancha = useCallback(() => {
    aceptacionesRevanchaRef.current.clear();
    setEstadoRevanchaOnline('idle');
  }, []);

  const handleAceptarRevanchaOnline = () => {
    if (!estado || !estado.modoOnline) return;
    if (estadoRevanchaOnline === 'no_disponible' || !onlineService.canRequestRematch()) {
      const msg = '⚠️ Esa opción ya no es válida ya que el jugador acaba de retirarse.';
      sounds.playError();
      setEstadoRevanchaOnline('no_disponible');
      setMensajeRevanchaNoDisponible(msg);
      showToast(msg);
      return;
    }

    const miId = estado.miJugadorId ?? 0;
    aceptacionesRevanchaRef.current.add(miId);
    onlineService.respondRematch(true);

    if (estado.esAnfitrion && aceptacionesRevanchaRef.current.size >= estado.n) {
      iniciarRevanchaOnlineComoHost();
    } else {
      setEstadoRevanchaOnline('esperando');
    }
  };

  const handleRechazarRevanchaOnline = () => {
    if (estado?.modoOnline) {
      onlineService.respondRematch(false);
    }
    handleVolverAlMenu();
  };

  const handleRevancha = () => {
    if (!estado) return;

    if (estado.modoOnline) {
      if (estadoRevanchaOnline === 'recibida') {
        handleAceptarRevanchaOnline();
        return;
      }

      if (estadoRevanchaOnline === 'no_disponible' || !onlineService.canRequestRematch()) {
        const msg =
          mensajeRevanchaNoDisponible ||
          '⚠️ Esa opción ya no es válida ya que el jugador acaba de retirarse.';
        sounds.playError();
        setEstadoRevanchaOnline('no_disponible');
        setMensajeRevanchaNoDisponible(msg);
        setMostrarBarraPostPartida(false);
        setModalActivo('victoria');
        showToast(msg);
        return;
      }

      sounds.playClick();
      const miId = estado.miJugadorId ?? 0;
      aceptacionesRevanchaRef.current.clear();
      aceptacionesRevanchaRef.current.add(miId);
      const enviado = onlineService.requestRematch(miId);
      if (!enviado) {
        const msg = '⚠️ Esa opción ya no es válida ya que el jugador acaba de retirarse.';
        sounds.playError();
        setEstadoRevanchaOnline('no_disponible');
        setMensajeRevanchaNoDisponible(msg);
        setMostrarBarraPostPartida(false);
        setModalActivo('victoria');
        showToast(msg);
        return;
      }

      setEstadoRevanchaOnline('esperando');
      setMostrarBarraPostPartida(false);
      setModalActivo('victoria');
      showToast('⏳ Esperando confirmación del otro jugador...');
      return;
    }

    sounds.playClick();
    setMostrarBarraPostPartida(false);
    setModalActivo(null);
    handleIniciarPartida(estado.config);
  };

  const handleSiguienteRondaTorneo = () => {
    if (!estado || !estado.torneo) return;
    sounds.playClick();

    const t = estado.torneo;
    if (t.terminado || t.rondaActual >= t.totalRondas) {
      handleFinalizarTorneo();
      return;
    }

    const nextTorneo: EstadoTorneo = {
      ...t,
      rondaActual: t.rondaActual + 1,
      terminado: false,
    };

    partidaContabilizadaRef.current = false;
    const nextMatch = iniciarPartida(estado.config);
    nextMatch.torneo = nextTorneo;
    setTiempoPartida(0);
    setEstado(nextMatch);
    setModalActivo(null);
    setMostrarBarraPostPartida(false);
  };

  const handleFinalizarTorneo = () => {
    sounds.playClick();
    limpiarSalaDeUrl();
    setCodigoSalaUrl(null);
    setModalActivo(null);
    setMostrarBarraPostPartida(false);
    setScreen('menu');
  };

  const handleVolverAlMenu = () => {
    sounds.playClick();
    limpiarSalaDeUrl();
    setCodigoSalaUrl(null);
    const eraOnlineEnCurso = Boolean(estado?.modoOnline && !estado?.terminada);
    if (estado && !estado.terminada) {
      const curPlayer = estado.jugadores[estado.turnoActual];
      if (curPlayer.tipo === 'humano') {
        penalizarAbandono(curPlayer.nombre, 5, curPlayer.cuentaId);
      }
    }
    if (estado?.modoOnline) {
      onlineService.disconnect();
    }
    resetEstadoRevanchaOnline();
    setModalActivo(null);
    setMostrarBarraPostPartida(false);
    setDesconexionSegundos(null);
    setEstado(null);
    setScreen(eraOnlineEnCurso ? 'online_lobby' : 'menu');
  };

  const formatMMSS = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const miJugadorIdx = estado?.miJugadorId ?? 0;
  const hayMultiplesHumanos = estado
    ? estado.jugadores.filter((p) => p.tipo === 'humano').length >= 2
    : false;
  const dbDesconectado = diagRed.checkedOnce && (!diagRed.isOnline || !diagRed.dbConectado);
  const [mostrarBannerDesconexion, setMostrarBannerDesconexion] = useState<boolean>(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dbDesconectado) {
      setMostrarBannerDesconexion(true);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => {
        setMostrarBannerDesconexion(false);
      }, 10000); // Desaparece automáticamente en 10 segundos
    } else {
      setMostrarBannerDesconexion(false);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    }
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [dbDesconectado]);

  return (
    <div className="relative w-full h-full min-h-screen bg-[#74c0fc] text-[#2b2140] flex flex-col items-center justify-between overflow-x-hidden overflow-y-auto selection:bg-[#ffd43b] selection:text-[#2b2140]">
      {/* Aviso que desaparece en 10 segundos al detectar desconexión */}
      {dbDesconectado && mostrarBannerDesconexion && (
        <div className="sticky top-0 left-0 right-0 z-[60] w-full bg-[#c92a2a] text-white border-b-3 border-[#2b2140] px-3 py-1.5 shadow-md flex items-center justify-between gap-2 text-xs animate-[slideDown_0.2s_ease-out]">
          <span className="font-black text-center flex-1 leading-tight text-[11px] sm:text-xs">
            ⚠️ Sin conexión a la Database (D1) — No se pueden enviar ni recibir cambios globales en este momento.
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={reconectandoDb}
              onClick={handleReintentarDb}
              className="py-1 px-2.5 rounded-xl bg-[#ffd43b] text-[#2b2140] border-2 border-[#2b2140] font-black text-[11px] hover:bg-[#fcc419] cursor-pointer"
            >
              {reconectandoDb ? '⏳ Conectando...' : '🔄 Conectar'}
            </button>
            <button
              type="button"
              onClick={() => setMostrarBannerDesconexion(false)}
              className="w-6 h-6 rounded-lg bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              title="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Nubes decorativas de fondo */}
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

      {/* Alerta de desconexión del rival en modo Online */}
      {desconexionSegundos !== null && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-[#fff3bf] border-3 border-[#2b2140] rounded-2xl p-2.5 shadow-[0_6px_0_#2b2140,0_10px_20px_rgba(0,0,0,0.25)] flex items-center justify-between gap-3 animate-[slideDown_0.25s_ease-out]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0 animate-bounce">⚠️</span>
            <div className="text-left min-w-0">
              <span className="text-xs font-black text-[#8f4b00] block truncate">
                Rival ausente · Turno pausado
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

      {/* Toast Global */}
      {toast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[70] bg-[#2b2140] text-white text-xs sm:text-sm font-black py-2 px-4 rounded-full border-2 border-white/20 shadow-[0_8px_20px_rgba(0,0,0,0.35)] animate-[slideDown_0.2s_ease-out]">
          {toast}
        </div>
      )}

      {/* RUTAS DE PANTALLA */}
      {screen === 'menu' && (
        <MenuScreen
          userActual={userActual}
          onAbrirPerfil={() => setModalActivo('perfil')}
          onAbrirAdmin={() => setModalActivo('admin')}
          onIniciarPartida={() => {
            setEsTorneoConfig(false);
            setScreen('config');
          }}
          onPartidaSorpresa={handlePartidaSorpresa}
          onIniciarTorneo={() => {
            setEsTorneoConfig(true);
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
          esTorneoInicial={esTorneoConfig}
          userActual={userActual}
          onIniciar={handleIniciarPartida}
          onVolver={() => setScreen('menu')}
          onuserActualizado={(upd) => {
            setuserActual(upd);
            guardarUserActual(upd);
          }}
          onShowToast={showToast}
        />
      )}

      {screen === 'online_lobby' && (
        <OnlineLobbyScreen
          userActual={userActual}
          codigoSalaInicial={codigoSalaUrl}
          onConsumirSalaInicial={() => {
            setCodigoSalaUrl(null);
          }}
          onIniciarPartidaOnline={handleIniciarPartidaOnline}
          onVolverAlMenu={() => {
            limpiarSalaDeUrl();
            setCodigoSalaUrl(null);
            setScreen('menu');
          }}
          onShowToast={showToast}
        />
      )}

      {screen === 'juego' && estado && (
        <div className="relative w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between p-1.5 sm:p-2.5 z-10 min-h-0">
          {/* Barra superior de la partida con el ÚNICO botón de Aspecto (el que le aparece a todos) */}
          <div className="w-full max-w-[620px] mx-auto flex items-center justify-between px-2 py-1 mb-1 bg-white/75 backdrop-blur-xs rounded-2xl border-2 border-[#2b2140] shadow-sm shrink-0">
            <button
              onClick={handleVolverAlMenu}
              className="py-1 px-2.5 rounded-xl bg-white border border-[#2b2140] text-xs font-black text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] cursor-pointer transition-colors"
            >
              ◀ Salir
            </button>

            <div className="flex items-center gap-2 text-xs font-black text-[#593922]">
              {estado.torneo && (
                <span>
                  Ronda {estado.torneo.rondaActual}/{estado.torneo.totalRondas}
                </span>
              )}
              {estado.modoOnline && <span>Sala {estado.codigoSala}</span>}
              {estado.config.modoConTiempo && (
                <span
                  className={`font-mono-num font-black ${
                    estado.tiempoRestante <= 5 ? 'text-[#c92a2a] animate-pulse' : 'text-[#2b2140]'
                  }`}
                >
                  ⏱️ {estado.tiempoRestante}s
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setModalAspectoAbierto(true);
                }}
                className="py-1 px-2.5 rounded-xl bg-white border border-[#2b2140] flex items-center gap-1 text-xs font-black text-[#2b2140] hover:bg-[#fff9db] cursor-pointer shadow-xs active:translate-y-0.5"
                title="Cambiar tu personaje o el terreno del tablero"
              >
                <span>🎨</span>
                <span>Aspecto</span>
              </button>
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

          {/* Tarjetas de jugadores (sin duplicar botón de Aspecto) */}
          <PlayerCards estado={estado} mostrarDistancia={ajustes.mostrarDistancia} />

          {/* Tablero Central */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-0.5 sm:py-1 shrink-0">
            <MurosBoard
              estado={estado}
              onMover={handleMoverJugador}
              onPonerMuro={(_orientacion, r, c) => handleColocarMuro({ r, c })}
              onRotarMuro={handleRotarMuro}
              onCambiarModo={handleCambiarModo}
              onInvalidWallAttempt={(motivo) => {
                sounds.playError();
                showToast(`⚠️ ${motivo}`);
              }}
              bloqueadoPorAnimacion={false}
              modoDaltonico={ajustes.modoDaltonico}
              animacionesReducidas={ajustes.animacionesReducidas}
              perspectivaInvertida={false}
              rotationMode={false}
              vistaPropiaOnline={true}
              temaTablero={temaTableroActivo}
            />
          </div>

          {/* Barra de Acciones */}
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
                estado.jugadores[estado.turnoActual].tipo !== 'humano' ||
                (estado.modoOnline &&
                  estado.jugadores[estado.turnoActual].id !== estado.miJugadorId)
            )}
          />

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
                <span>Resultados</span>
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  setModalPrevio('victoria');
                  setModalActivo('ranking');
                }}
                className="py-1.5 px-3 rounded-xl bg-[#4dabf7] text-white border-2 border-[#2b2140] font-black text-xs hover:bg-[#339af0] cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>📊</span>
                <span>Ranking</span>
              </button>
              <button
                onClick={handleRevancha}
                className={`py-1.5 px-3 rounded-xl border-2 font-black text-xs cursor-pointer flex items-center gap-1 shadow-sm ${
                  estado.modoOnline && estadoRevanchaOnline === 'no_disponible'
                    ? 'bg-[#ffe3e3] text-[#c92a2a] border-[#c92a2a]'
                    : 'bg-[#51cf66] text-[#134e20] border-[#2b2140] hover:bg-[#40c057]'
                }`}
              >
                <span>
                  {estado.modoOnline && estadoRevanchaOnline === 'no_disponible' ? '🚫' : '🔄'}
                </span>
                <span>
                  {estado.modoOnline && estadoRevanchaOnline === 'no_disponible'
                    ? 'Rival retirado'
                    : estado.modoOnline && estadoRevanchaOnline === 'esperando'
                    ? 'Esperando...'
                    : 'Revancha'}
                </span>
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

      {mostrarHistorial && estado && (
        <HistorialPanel
          acciones={estado.registroAcciones || []}
          onCerrar={() => setMostrarHistorial(false)}
          rondaActual={estado.torneo?.rondaActual}
          totalRondas={estado.torneo?.totalRondas}
        />
      )}

      {/* MODALES */}
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

      {modalActivo === 'como_jugar' && <ComoJugarModal onCerrar={() => setModalActivo(null)} />}

      {modalActivo === 'logros' && <LogrosModal onCerrar={() => setModalActivo(null)} />}

      {modalActivo === 'ranking' && (
        <RankingModal
          userActual={userActual}
          onAbrirPerfil={() => {
            setModalPrevio('ranking');
            setModalActivo('perfil');
          }}
          onCerrar={() => {
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
          userActual={userActual}
          onLoginSuccess={(u) => {
            setuserActual(u);
            guardarUserActual(u);
            showToast(`¡Bienvenido, ${u.nombre}!`);
          }}
          onLogout={() => {
            setuserActual(null);
            guardarUserActual(null);
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
          userActual={userActual}
          onuserActualizado={(upd) => {
            setuserActual(upd);
            guardarUserActual(upd);
          }}
          onAbrirLogin={() => {
            setModalPrevio(null);
            setModalActivo('perfil');
          }}
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
          estadoRevanchaOnline={estadoRevanchaOnline}
          solicitanteRevancha={solicitanteRevancha}
          mensajeRevanchaNoDisponible={mensajeRevanchaNoDisponible}
          onAceptarRevancha={handleAceptarRevanchaOnline}
          onRechazarRevancha={handleRechazarRevanchaOnline}
          onCancelarEsperaRevancha={handleCancelarEsperaRevancha}
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

      {(screen === 'online_lobby' || Boolean(estado?.modoOnline)) && (
        <OnlineDiagnosticsOverlay />
      )}

      {modalAspectoAbierto && (
        <AspectoModal
          onCerrar={() => setModalAspectoAbierto(false)}
          personajeActual={{
            hat:
              estado?.jugadores[miJugadorIdx]?.hat ||
              userActual?.avatarHat ||
              'corona',
            color:
              estado?.jugadores[miJugadorIdx]?.color ||
              userActual?.avatarColor ||
              '#ff6b6b',
            ropa:
              estado?.jugadores[miJugadorIdx]?.ropa ||
              userActual?.avatarRopa ||
              'ninguna',
            ropaColor:
              estado?.jugadores[miJugadorIdx]?.ropaColor ||
              userActual?.avatarRopaColor,
            aura:
              estado?.jugadores[miJugadorIdx]?.aura ||
              userActual?.avatarAura ||
              'ninguna',
          }}
          temaActual={temaTableroActivo}
          userActual={userActual}
          onuserActualizado={(upd) => {
            setuserActual(upd);
            guardarUserActual(upd);
          }}
          onShowToast={showToast}
          onAplicar={(nuevoP, nuevoTema) => {
            if (estado) {
              setEstado((prev) => {
                if (!prev) return prev;
                const nextPlayers = [...prev.jugadores];
                const targetIdx = prev.miJugadorId ?? 0;
                if (nextPlayers[targetIdx]) {
                  nextPlayers[targetIdx] = {
                    ...nextPlayers[targetIdx],
                    hat: nuevoP.hat,
                    color: nuevoP.color,
                    ropa: nuevoP.ropa,
                    ropaColor: nuevoP.ropaColor,
                    aura: nuevoP.aura,
                  };
                }
                return {
                  ...prev,
                  jugadores: nextPlayers,
                  config: { ...prev.config, temaTablero: nuevoTema },
                };
              });
            }
            setAjustes((prev) => {
              const updated = { ...prev, temaTablero: nuevoTema };
              guardarAjustes(updated);
              return updated;
            });
          }}
        />
      )}

      <OfflineIndicator compact={screen !== 'menu' || Boolean(modalActivo)} />
    </div>
  );
};

export default App;
