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
  EstiloMuros,
  PantallaApp,
  TamanoTablero,
  TemaTablero,
} from './types/murosLocos';
import {
  cargarEstiloMuros,
  guardarEstiloMuros,
  MurosThemeProvider,
} from './game/murosTheme';
import {
  calcularDesglosePuntos,
  calcularDesglosesPuntuacion,
  deshacerJugada,
  ejecutarAccionMover,
  ejecutarAccionMuro,
  ejecutarTurnoBot,
  eliminarJugadorEnPartida,
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
  sincronizarConNube,
  suscribirCambiosNube,
  suscribirDiagnostico,
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
import { AmbientBackdrop } from './components/AmbientBackdrop';
import { CandadoGame, limpiarSesionCandadoPersistida } from './candado';

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

const MUROS_APP_SESSION_KEY = 'muros_locos_app_session_v1';
const MUROS_APP_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type AppModalType =
  | 'ranking'
  | 'logros'
  | 'como_jugar'
  | 'ajustes'
  | 'victoria'
  | 'torneo'
  | 'perfil'
  | 'admin'
  | null;

interface PersistedAppSession {
  savedAt: number;
  juegoActivo: 'muros' | 'candado';
  screen: PantallaApp;
  esTorneoConfig: boolean;
  estado: EstadoDeJuego | null;
  tiempoPartida: number;
  modalActivo: AppModalType;
  mostrarBarraPostPartida: boolean;
}

const MODALES_SEGUROS_PERSISTENTES = new Set<Exclude<AppModalType, null>>([
  'ranking',
  'logros',
  'como_jugar',
  'ajustes',
  'perfil',
  'admin',
]);

function cargarSesionApp(): PersistedAppSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MUROS_APP_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAppSession>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > MUROS_APP_SESSION_MAX_AGE_MS) {
      window.localStorage.removeItem(MUROS_APP_SESSION_KEY);
      return null;
    }

    const juegoValidado: 'muros' | 'candado' =
      parsed.juegoActivo === 'candado' ? 'candado' : 'muros';

    let screenValidada: PantallaApp =
      parsed.screen === 'config' ||
      parsed.screen === 'online_lobby' ||
      parsed.screen === 'juego'
        ? parsed.screen
        : 'menu';

    let estadoValidado: EstadoDeJuego | null =
      parsed.estado &&
      typeof parsed.estado === 'object' &&
      Array.isArray(parsed.estado.jugadores) &&
      typeof parsed.estado.n === 'number'
        ? parsed.estado
        : null;

    if (estadoValidado?.modoOnline) {
      // Una conexión WebRTC P2P no puede mantenerse tras recargar la pestaña
      estadoValidado = null;
      if (screenValidada === 'juego') {
        screenValidada = 'online_lobby';
      }
    }

    if (screenValidada === 'juego' && !estadoValidado) {
      screenValidada = 'menu';
    }

    let modalValidado: AppModalType = null;
    if (parsed.modalActivo) {
      if (MODALES_SEGUROS_PERSISTENTES.has(parsed.modalActivo)) {
        modalValidado = parsed.modalActivo;
      } else if (
        parsed.modalActivo === 'victoria' &&
        screenValidada === 'juego' &&
        estadoValidado?.terminada
      ) {
        modalValidado = 'victoria';
      } else if (
        parsed.modalActivo === 'torneo' &&
        screenValidada === 'juego' &&
        estadoValidado?.terminada &&
        estadoValidado?.torneo?.activo
      ) {
        modalValidado = 'torneo';
      }
    }

    const mostrarBarraPostPartida = Boolean(
      parsed.mostrarBarraPostPartida &&
        screenValidada === 'juego' &&
        estadoValidado?.terminada &&
        !modalValidado
    );

    return {
      savedAt: parsed.savedAt,
      juegoActivo: juegoValidado,
      screen: screenValidada,
      esTorneoConfig: Boolean(parsed.esTorneoConfig),
      estado: estadoValidado,
      tiempoPartida:
        typeof parsed.tiempoPartida === 'number' && parsed.tiempoPartida >= 0
          ? Math.floor(parsed.tiempoPartida)
          : 0,
      modalActivo: modalValidado,
      mostrarBarraPostPartida,
    };
  } catch {
    return null;
  }
}

export const App: React.FC = () => {
  const [codigoSalaUrl, setCodigoSalaUrl] = useState<string | null>(() => leerSalaDeUrl());
  const sesionInicialRef = useRef<PersistedAppSession | null | undefined>(undefined);
  if (sesionInicialRef.current === undefined) {
    sesionInicialRef.current = leerSalaDeUrl() ? null : cargarSesionApp();
  }
  const sesionInicial = sesionInicialRef.current;

  const [screen, setScreen] = useState<PantallaApp>(() =>
    leerSalaDeUrl() ? 'online_lobby' : (sesionInicial?.screen ?? 'menu')
  );
  const [juegoActivo, setJuegoActivo] = useState<'muros' | 'candado'>(() =>
    leerSalaDeUrl() ? 'muros' : (sesionInicial?.juegoActivo ?? 'muros')
  );
  const [esTorneoConfig, setEsTorneoConfig] = useState<boolean>(
    () => sesionInicial?.esTorneoConfig ?? false
  );
  const [userActual, setuserActual] = useState<UserCuenta | null>(() =>
    obteneruserActual()
  );
  const [ajustes, setAjustes] = useState<AjustesDeApp>(() => cargarAjustes());
  const [estiloMuros, setEstiloMuros] = useState<EstiloMuros>(() => cargarEstiloMuros());
  const [modalAspectoAbierto, setModalAspectoAbierto] = useState(false);

  const handleCambiarEstiloMuros = useCallback((nuevo: EstiloMuros) => {
    setEstiloMuros(nuevo);
    guardarEstiloMuros(nuevo);
  }, []);

  // Diagnóstico en tiempo real de conexión a la Database (D1) (aviso permanente en todo momento)
  const [diagRed, setDiagRed] = useState<DiagnosticoDeRed>(() => obtenerDiagnosticoRed());
  const [reconectandoDb, setReconectandoDb] = useState(false);
  const prevDbRef = useRef<boolean>(true);
  const prevInvCorruptoRef = useRef<boolean>(false);

  // Estado de partida
  const [estado, setEstado] = useState<EstadoDeJuego | null>(() =>
    leerSalaDeUrl() ? null : (sesionInicial?.estado ?? null)
  );
  const [desgloses, setDesgloses] = useState<Map<number, DesglosePuntos>>(() =>
    !leerSalaDeUrl() && sesionInicial?.estado?.terminada
      ? calcularDesglosesPuntuacion(sesionInicial.estado)
      : new Map()
  );
  const [nuevosLogros, setNuevosLogros] = useState<Map<string, DefLogro[]>>(new Map());
  const [subidasNivel, setSubidasNivel] = useState<
    Map<string, { anterior: InfoNivel; nuevo: InfoNivel }>
  >(new Map());

  // Modales
  type ModalType = AppModalType;
  const [modalActivo, setModalActivo] = useState<ModalType>(
    () => sesionInicial?.modalActivo ?? null
  );
  const [modalPrevio, setModalPrevio] = useState<ModalType>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false);
  const [mostrarBarraPostPartida, setMostrarBarraPostPartida] = useState<boolean>(
    () => sesionInicial?.mostrarBarraPostPartida ?? false
  );
  const [perspectivaInvertida, setPerspectivaInvertida] = useState<boolean>(false);
  const [desconexionSegundos, setDesconexionSegundos] = useState<number | null>(null);
  const [confirmarAbandonoAbierto, setConfirmarAbandonoAbierto] = useState<boolean>(false);
  const [ultimoHumanoIdx, setUltimoHumanoIdx] = useState<number>(() => {
    const initPlayers = sesionInicial?.estado?.jugadores;
    const first = initPlayers?.find((p) => p.tipo === 'humano' && !p.eliminado);
    return first ? first.id : 0;
  });

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

  const [tiempoPartida, setTiempoPartida] = useState<number>(
    () => sesionInicial?.tiempoPartida ?? 0
  );
  const duracionIntervalRef = useRef<any>(null);
  const partidaContabilizadaRef = useRef<boolean>(
    Boolean(sesionInicial?.estado?.terminada)
  );
  const screenRef = useRef<PantallaApp>(screen);
  screenRef.current = screen;
  const accionLockRef = useRef<boolean>(false);
  const accionLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (accionLockTimerRef.current) clearTimeout(accionLockTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!estado) return;
    const actual = estado.jugadores[estado.turnoActual];
    if (actual && actual.tipo === 'humano' && !actual.eliminado) {
      setUltimoHumanoIdx(estado.turnoActual);
    }
  }, [estado?.turnoActual, estado?.jugadores]);

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
      sincronizarConNube(true).catch(() => {});
    };
    window.addEventListener('online', onBrowserOnline);

    const unsubDiag = suscribirDiagnostico((d) => {
      setDiagRed(d);
      if (d.checkedOnce) {
        if (!prevDbRef.current && d.dbConectado) {
          showToast('🟢 Conexión con la Database restablecida');
        }
        prevDbRef.current = d.dbConectado;
        if (d.miInventarioCorrupto && !prevInvCorruptoRef.current) {
          prevInvCorruptoRef.current = true;
          showToast('⚠️ Tu inventario en la Database D1 tiene datos dañados. Contacta al Dev.');
        } else if (!d.miInventarioCorrupto) {
          prevInvCorruptoRef.current = false;
        }
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
      const res = await sincronizarConNube(true);
      if (res.dbConectado) {
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

  // Sincronización inicial, sesiones revocadas y escucha ligera cada 30s contra la Database
  useEffect(() => {
    sincronizarConNube(false).catch(() => {});
    const stopListener = iniciarEscuchaNube(30000);
    const unsubs = suscribirCambiosNube(({ cuentas }) => {
      const current = userActualRef.current;
      if (current) {
        if (!cuentas || Object.keys(cuentas).length === 0) {
          return;
        }
        const fresh = cuentas[current.id];
        if (!fresh) {
          if (current.id !== 'admin') {
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
          JSON.stringify(fresh.inventario || { personajes: [] }) !==
            JSON.stringify(current.inventario || { personajes: [] })
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

    return () => {
      stopListener();
      unsubs();
      unsubRevocada();
    };
  }, [showToast]);

  // Temporizador de turno
  useEffect(() => {
    if (!estado || estado.terminada || !estado.config.modoConTiempo) return;
    if (desconexionSegundos !== null) return;

    const timer = setInterval(() => {
      const actual = estadoRef.current;
      if (!actual || actual.terminada || !actual.config.modoConTiempo) return;

      if (actual.tiempoRestante <= 1) {
        // En modo Online, solo el anfitrión decide el cambio de turno y lo sincroniza a todos
        if (actual.modoOnline && !actual.esAnfitrion) {
          setEstado((prev) => (prev && prev.tiempoRestante > 0 ? { ...prev, tiempoRestante: 0 } : prev));
          return;
        }

        const jugadoresClonados = actual.jugadores.map((jug, idx) =>
          idx === actual.turnoActual
            ? {
                ...jug,
                estadisticas: {
                  ...jug.estadisticas,
                  turnosAgotados: jug.estadisticas.turnosAgotados + 1,
                },
              }
            : jug
        );
        const p = jugadoresClonados[actual.turnoActual];
        let nextTurno = (actual.turnoActual + 1) % actual.n;
        let tries = 0;
        while (tries < actual.n && jugadoresClonados[nextTurno]?.eliminado) {
          nextTurno = (nextTurno + 1) % actual.n;
          tries++;
        }

        const timeoutState: EstadoDeJuego = {
          ...actual,
          jugadores: jugadoresClonados,
          turnoActual: nextTurno,
          tiempoRestante: actual.config.segundosPorTurno,
          modoAccion: 'mover',
          muroPrevisualizado: null,
          caminoPista: null,
          ultimoMensaje: `⏱️ ¡Se agotó el tiempo de ${p.nombre}! Turno pasado.`,
        };

        sounds.playError();
        setEstado(timeoutState);
        if (actual.modoOnline && actual.esAnfitrion) {
          onlineService.syncState(timeoutState);
        }
        return;
      }

      setEstado((prev) =>
        prev && !prev.terminada && prev.tiempoRestante > 1
          ? { ...prev, tiempoRestante: prev.tiempoRestante - 1 }
          : prev
      );
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

  // Persistencia completa de navegación y partida activa para conservar pantalla al recargar (F5)
  const snapshotSesionRef = useRef({
    juegoActivo,
    screen,
    esTorneoConfig,
    estado,
    modalActivo,
    mostrarBarraPostPartida,
  });
  snapshotSesionRef.current = {
    juegoActivo,
    screen,
    esTorneoConfig,
    estado,
    modalActivo,
    mostrarBarraPostPartida,
  };

  const guardarSesionApp = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const snap = snapshotSesionRef.current;
      const esOnlineEnCurso = Boolean(snap.estado?.modoOnline);
      const estadoPersistible = esOnlineEnCurso ? null : snap.estado;
      const screenPersistible: PantallaApp =
        esOnlineEnCurso && snap.screen === 'juego' ? 'online_lobby' : snap.screen;

      const payload: PersistedAppSession = {
        savedAt: Date.now(),
        juegoActivo: snap.juegoActivo,
        screen: screenPersistible,
        esTorneoConfig: snap.esTorneoConfig,
        estado: estadoPersistible,
        tiempoPartida: tiempoPartidaRef.current,
        modalActivo: esOnlineEnCurso ? null : snap.modalActivo,
        mostrarBarraPostPartida: esOnlineEnCurso ? false : snap.mostrarBarraPostPartida,
      };
      window.localStorage.setItem(MUROS_APP_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  useEffect(() => {
    guardarSesionApp();
  }, [
    juegoActivo,
    screen,
    esTorneoConfig,
    estado,
    modalActivo,
    mostrarBarraPostPartida,
    guardarSesionApp,
  ]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        guardarSesionApp();
      }
    };
    window.addEventListener('beforeunload', guardarSesionApp);
    window.addEventListener('pagehide', guardarSesionApp);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', guardarSesionApp);
      window.removeEventListener('pagehide', guardarSesionApp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [guardarSesionApp]);

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
        if (!remoteState.terminada) {
          partidaContabilizadaRef.current = false;
        }
        setEstado(remoteState);
        if (screenRef.current === 'online_lobby') {
          setModalActivo(null);
          setMostrarBarraPostPartida(false);
          setScreen('juego');
        }
        if (remoteState.terminada) {
          finalizarPartida(remoteState);
        }
      },
      onPlayerAction: (jugadorId: number, accion: 'mover' | 'muro' | 'pasar', payload: any) => {
        const actual = estadoRef.current;
        if (!actual || actual.terminada) return;
        if (actual.turnoActual !== jugadorId) {
          if (actual.esAnfitrion) {
            onlineService.syncState(actual);
          }
          return;
        }

        if (accion === 'mover' && payload?.destino) {
          const next = ejecutarAccionMover(actual, payload.destino, jugadorId);
          if (next === actual) {
            if (actual.esAnfitrion) onlineService.syncState(actual);
            return;
          }
          sounds.playMove();
          setEstado(next);
          if (actual.esAnfitrion) onlineService.syncState(next);
          if (next.terminada) finalizarPartida(next);
        } else if (accion === 'muro') {
          const coord = payload?.coord || { r: payload?.r, c: payload?.c };
          const next = ejecutarAccionMuro(actual, coord, payload.orientacion, jugadorId);
          if (next === actual) {
            if (actual.esAnfitrion) onlineService.syncState(actual);
            return;
          }
          sounds.playWallPlace();
          setEstado(next);
          if (actual.esAnfitrion) onlineService.syncState(next);
          if (next.terminada) finalizarPartida(next);
        }
      },
      onPeerEliminated: (jugadorId: number, nombre: string) => {
        const actual = estadoRef.current;
        if (!actual || actual.terminada) return;
        const next = eliminarJugadorEnPartida(actual, jugadorId);
        if (next === actual) return;
        setEstado(next);
        if (actual.esAnfitrion) {
          onlineService.syncState(next);
        }
        showToast(`🚪 ${nombre} abandonó la partida`);
        if (next.terminada) {
          finalizarPartida(next);
        }
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
    if (accionLockRef.current) return;
    const actual = estadoRef.current;
    if (!actual || actual.terminada) return;
    const curPlayer = actual.jugadores[actual.turnoActual];
    if (!curPlayer || curPlayer.eliminado) return;

    if (actual.modoOnline && curPlayer.id !== actual.miJugadorId) {
      sounds.playError();
      return;
    }

    accionLockRef.current = true;
    try {
      const next = ejecutarAccionMover(actual, destino, curPlayer.id);
      if (next === actual) {
        sounds.playError();
        return;
      }

      sounds.playMove();

      if (actual.modoOnline) {
        onlineService.sendAction('mover', { destino });
        if (actual.esAnfitrion) {
          onlineService.syncState(next);
        }
      }

      setEstado(next);
      if (next.terminada) {
        finalizarPartida(next);
      }
    } finally {
      if (accionLockTimerRef.current) clearTimeout(accionLockTimerRef.current);
      accionLockTimerRef.current = setTimeout(() => {
        accionLockRef.current = false;
      }, 80);
    }
  };

  const handleColocarMuro = (coord: { r: number; c: number }) => {
    if (accionLockRef.current) return;
    const actual = estadoRef.current;
    if (!actual || actual.terminada) return;
    const curPlayer = actual.jugadores[actual.turnoActual];
    if (!curPlayer || curPlayer.eliminado) return;

    if (actual.modoOnline && curPlayer.id !== actual.miJugadorId) {
      sounds.playError();
      return;
    }

    accionLockRef.current = true;
    try {
      const next = ejecutarAccionMuro(actual, coord, actual.orientacionMuro, curPlayer.id);
      if (next === actual) {
        sounds.playError();
        return;
      }

      sounds.playWallPlace();

      if (actual.modoOnline) {
        onlineService.sendAction('muro', {
          orientacion: actual.orientacionMuro,
          r: coord.r,
          c: coord.c,
        });
        if (actual.esAnfitrion) {
          onlineService.syncState(next);
        }
      }

      setEstado(next);
      if (next.terminada) {
        finalizarPartida(next);
      }
    } finally {
      if (accionLockTimerRef.current) clearTimeout(accionLockTimerRef.current);
      accionLockTimerRef.current = setTimeout(() => {
        accionLockRef.current = false;
      }, 80);
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
    const actual = estadoRef.current;
    if (!actual || actual.terminada) return;
    const curPlayer = actual.jugadores[actual.turnoActual];
    if (!curPlayer || curPlayer.tipo !== 'humano' || curPlayer.eliminado) return;

    sounds.playClick();
    const camino = obtenerCaminoPista(curPlayer, actual.murosH, actual.murosV, actual.n);
    const turnoId = actual.turnoActual;

    setEstado((prev) => {
      if (!prev) return null;
      const jugadoresAct = prev.jugadores.map((j, idx) =>
        idx === turnoId
          ? {
              ...j,
              estadisticas: {
                ...j.estadisticas,
                usosPista: j.estadisticas.usosPista + 1,
                partidaLimpia: false,
              },
            }
          : j
      );
      return {
        ...prev,
        jugadores: jugadoresAct,
        caminoPista: camino,
        ultimoMensaje: `💡 Pista activada para ${curPlayer.nombre} (-1 pt)`,
      };
    });
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
    if (
      (typeof config.rotationMode === 'boolean' || typeof config.rotarControles === 'boolean') &&
      config.jugadores.filter((p) => p.tipo === 'humano').length >= 2
    ) {
      setAjustes((prev) => {
        const updated = {
          ...prev,
          cambiarVistaPorTurno:
            typeof config.rotationMode === 'boolean'
              ? config.rotationMode
              : prev.cambiarVistaPorTurno,
          rotarControlesSinTablero:
            config.numJugadores === 2 &&
            !config.rotationMode &&
            typeof config.rotarControles === 'boolean'
              ? config.rotarControles
              : prev.rotarControlesSinTablero,
        };
        guardarAjustes(updated);
        return updated;
      });
    }
    const nuevo = iniciarPartida(config);
    const primerHumano =
      nuevo.jugadores[nuevo.turnoActual]?.tipo === 'humano'
        ? nuevo.turnoActual
        : nuevo.jugadores.find((p) => p.tipo === 'humano')?.id ?? 0;
    setUltimoHumanoIdx(primerHumano);
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

  const ejecutarSalidaAlMenu = (esAbandonoConfirmado: boolean = false) => {
    sounds.playClick();
    limpiarSalaDeUrl();
    setCodigoSalaUrl(null);
    setConfirmarAbandonoAbierto(false);
    const actual = estadoRef.current;
    const eraOnlineEnCurso = Boolean(actual?.modoOnline && !actual?.terminada);

    // La penalización (-5 pts) SOLO aplica en partidas online activas confirmadas y sobre miJugadorId
    if (eraOnlineEnCurso && esAbandonoConfirmado && actual) {
      const miId = actual.miJugadorId ?? 0;
      const miJugador = actual.jugadores[miId];
      if (miJugador && miJugador.tipo === 'humano') {
        penalizarAbandono(miJugador.nombre, 5, miJugador.cuentaId);
        const refreshed = obteneruserActual();
        if (refreshed) {
          setuserActual(refreshed);
        }
      }
    }

    if (actual?.modoOnline) {
      onlineService.disconnect();
    }
    resetEstadoRevanchaOnline();
    setModalActivo(null);
    setMostrarBarraPostPartida(false);
    setDesconexionSegundos(null);
    setEstado(null);
    setScreen(eraOnlineEnCurso ? 'online_lobby' : 'menu');
  };

  const handleVolverAlMenu = () => {
    const actual = estadoRef.current;
    if (actual?.modoOnline && !actual.terminada) {
      sounds.playClick();
      setConfirmarAbandonoAbierto(true);
      return;
    }
    ejecutarSalidaAlMenu(false);
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
  const esLocalMultihumano = Boolean(estado && !estado.modoOnline && hayMultiplesHumanos);
  const preferRotarTablero = Boolean(
    estado?.config.rotationMode ?? ajustes.cambiarVistaPorTurno
  );
  const preferRotarControles = Boolean(
    estado?.config.rotarControles ?? ajustes.rotarControlesSinTablero
  );
  // Activado: solo rota el tablero y las opciones permanecen fijas.
  // Desactivado: el tablero queda fijo (0°) y, si preferRotarControles está activo, todas las opciones (incluida la barra de colocar muro) giran 180° arriba <-> abajo.
  const rotationModeActivo = esLocalMultihumano && preferRotarTablero;
  const activeHumanId =
    estado &&
    estado.jugadores[estado.turnoActual]?.tipo === 'humano' &&
    !estado.jugadores[estado.turnoActual]?.eliminado
      ? estado.turnoActual
      : ultimoHumanoIdx;
  const localActiveAngle =
    estado && esLocalMultihumano
      ? estado.n === 2
        ? activeHumanId === 1
          ? 180
          : 0
        : [0, -90, 180, 90][((activeHumanId % 4) + 4) % 4]
      : 0;
  const controlesInvertidos =
    Boolean(estado && estado.n === 2) &&
    esLocalMultihumano &&
    !preferRotarTablero &&
    preferRotarControles &&
    localActiveAngle === 180;
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

  const murosRootClass =
    estiloMuros === 'pastel_oscuro'
      ? 'bg-gradient-to-br from-[#14172B] via-[#1B1D36] to-[#231D38] text-slate-100 selection:bg-indigo-300/30 selection:text-white'
      : estiloMuros === 'pastel_claro'
      ? 'bg-gradient-to-b from-[#FCF8EC] via-[#FAF4E4] to-[#F7EFE0] text-[#171923] selection:bg-[#FCE8B8] selection:text-[#171923]'
      : 'bg-[#74c0fc] text-[#2b2140] selection:bg-[#ffd43b] selection:text-[#2b2140]';

  return (
    <MurosThemeProvider estilo={estiloMuros} onChangeEstilo={handleCambiarEstiloMuros}>
    <div
      className={`relative w-full h-full min-h-dvh flex flex-col items-center justify-between overflow-x-hidden overflow-y-auto transition-colors duration-300 ${
        juegoActivo === 'candado'
          ? 'bg-[#14172B] text-slate-100 selection:bg-indigo-300/30 selection:text-white'
          : murosRootClass
      }`}
    >
      {/* Aviso que desaparece en 10 segundos al detectar desconexión */}
      {dbDesconectado && mostrarBannerDesconexion && (
        <div
          className={`sticky top-0 left-0 right-0 z-[60] w-full px-3 py-1.5 shadow-md flex items-center justify-between gap-2 text-xs animate-[slideDown_0.2s_ease-out] ${
            estiloMuros === 'clasico'
              ? 'bg-[#c92a2a] text-white border-b-3 border-[#2b2140]'
              : estiloMuros === 'pastel_claro'
              ? 'bg-[#FAD8DD] text-[#661924] border-b border-[#EEB1B9]'
              : 'bg-[#2C1821] text-rose-100 border-b border-rose-400/30'
          }`}
        >
          <span className="font-bold sm:font-extrabold text-center flex-1 leading-tight text-[11px] sm:text-xs">
            ⚠️ Sin conexión a la Database (D1) — No se pueden enviar ni recibir cambios globales en este momento.
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={reconectandoDb}
              onClick={handleReintentarDb}
              className={`py-1 px-2.5 rounded-xl font-bold text-[11px] cursor-pointer ${
                estiloMuros === 'clasico'
                  ? 'bg-[#ffd43b] text-[#2b2140] border-2 border-[#2b2140] hover:bg-[#fcc419]'
                  : estiloMuros === 'pastel_claro'
                  ? 'bg-[#FFFDF6] text-[#661924] border border-[#DF9AA4] hover:bg-[#FCE8B8]'
                  : 'bg-rose-400/20 text-rose-100 border border-rose-300/35 hover:bg-rose-400/30'
              }`}
            >
              {reconectandoDb ? '⏳ Conectando...' : '🔄 Conectar'}
            </button>
            <button
              type="button"
              onClick={() => setMostrarBannerDesconexion(false)}
              className="w-6 h-6 rounded-lg bg-black/15 hover:bg-black/30 flex items-center justify-center font-bold text-xs cursor-pointer"
              title="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Fondo animado ambiental (Clásico, Pastel Oscuro y Pastel Claro) */}
      {juegoActivo === 'muros' && (
        <AmbientBackdrop
          variant={estiloMuros}
          reducedMotion={ajustes.animacionesReducidas}
        />
      )}

      {/* Alerta de desconexión del rival en modo Online */}
      {desconexionSegundos !== null && (
        <div
          className={`fixed top-10 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md rounded-2xl p-2.5 flex items-center justify-between gap-3 animate-[slideDown_0.25s_ease-out] ${
            estiloMuros === 'clasico'
              ? 'bg-[#fff3bf] border-3 border-[#2b2140] shadow-[0_6px_0_#2b2140,0_10px_20px_rgba(0,0,0,0.25)]'
              : estiloMuros === 'pastel_claro'
              ? 'bg-[#FCE8B8] border border-[#EAD08E] text-[#4A3309] shadow-lg'
              : 'bg-[#1B1F30] border border-amber-300/35 text-amber-100 shadow-2xl'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0 animate-bounce">⚠️</span>
            <div className="text-left min-w-0">
              <span
                className={`text-xs font-extrabold block truncate ${
                  estiloMuros === 'clasico'
                    ? 'text-[#8f4b00]'
                    : estiloMuros === 'pastel_claro'
                    ? 'text-[#4A3309]'
                    : 'text-amber-200'
                }`}
              >
                Rival ausente · Turno pausado
              </span>
              <span
                className={`text-[11px] font-semibold block leading-tight ${
                  estiloMuros === 'clasico'
                    ? 'text-[#5c3c00]'
                    : estiloMuros === 'pastel_claro'
                    ? 'text-[#5C4110]'
                    : 'text-slate-300'
                }`}
              >
                Esperando reconexión ({formatMMSS(desconexionSegundos)})...
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleVolverAlMenu}
            className={`py-1 px-2.5 rounded-xl text-[11px] font-bold cursor-pointer shrink-0 ${
              estiloMuros === 'clasico'
                ? 'bg-white border border-[#2b2140] text-[#c92a2a] hover:bg-[#ffe3e3]'
                : estiloMuros === 'pastel_claro'
                ? 'bg-[#FFFDF6] border border-[#D4C9AE] text-[#661924] hover:bg-[#FAD8DD]'
                : 'bg-rose-400/15 border border-rose-400/30 text-rose-200 hover:bg-rose-400/25'
            }`}
          >
            Salir al Menú
          </button>
        </div>
      )}

      {/* Toast Global */}
      {toast && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-[70] text-xs sm:text-sm font-bold py-2 px-4 rounded-full shadow-xl animate-[slideDown_0.2s_ease-out] ${
            estiloMuros === 'clasico'
              ? 'bg-[#2b2140] text-white border-2 border-white/20'
              : estiloMuros === 'pastel_claro'
              ? 'bg-[#171923] text-[#FFFDF6] border border-[#3E4359]'
              : 'bg-slate-800/95 text-slate-100 border border-white/15 backdrop-blur-md'
          }`}
        >
          {toast}
        </div>
      )}

      {/* MINIJUEGO AISLADO: CANDADO (PASATIEMPO LOCAL + P2P SIN PUNTOS) */}
      {juegoActivo === 'candado' && (
        <CandadoGame
          userActual={userActual}
          sonidoActivo={ajustes.sonido}
          animacionesReducidas={ajustes.animacionesReducidas}
          onToggleSonido={() => {
            setAjustes((prev) => {
              const next = { ...prev, sonido: !prev.sonido };
              guardarAjustes(next);
              return next;
            });
          }}
          onVolverAMurosLocos={() => {
            limpiarSesionCandadoPersistida();
            setJuegoActivo('muros');
            setScreen('menu');
          }}
        />
      )}

      {/* RUTAS DE PANTALLA */}
      {juegoActivo === 'muros' && screen === 'menu' && (
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
          onAbrirCandado={() => setJuegoActivo('candado')}
        />
      )}

      {juegoActivo === 'muros' && screen === 'config' && (
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

      {juegoActivo === 'muros' && screen === 'online_lobby' && (
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

      {juegoActivo === 'muros' && screen === 'juego' && estado && (
        <div className="relative w-full max-w-6xl mx-auto flex-1 flex flex-col justify-start gap-1.5 sm:gap-2 p-1.5 sm:p-2.5 lg:p-3 z-10 min-h-0">
          {/* Barra superior de la partida con el ÚNICO botón de Aspecto */}
          <div
            className={`w-full flex items-center justify-between gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-2xl shrink-0 min-w-0 ${
              estiloMuros === 'clasico'
                ? 'bg-white/80 backdrop-blur-xs border-2 border-[#2b2140] shadow-sm'
                : estiloMuros === 'pastel_claro'
                ? 'bg-[#FFFDF6]/95 border border-[#DFD6BF] shadow-xs text-[#171923]'
                : 'bg-[#1B1F30]/90 border border-white/12 shadow-lg text-slate-100 backdrop-blur-md'
            }`}
          >
            <button
              onClick={handleVolverAlMenu}
              className={`py-1 px-2 sm:px-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 ${
                estiloMuros === 'clasico'
                  ? 'bg-white border border-[#2b2140] text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] font-black'
                  : estiloMuros === 'pastel_claro'
                  ? 'bg-[#FAF4E4] border border-[#D4C9AE] text-[#171923] hover:bg-[#FAD8DD] hover:text-[#661924]'
                  : 'bg-slate-800/80 border border-white/12 text-slate-200 hover:bg-rose-400/20 hover:text-rose-200'
              }`}
            >
              ◀ <span className="hidden xs:inline sm:inline">Salir</span>
            </button>

            <div
              className={`flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold min-w-0 truncate ${
                estiloMuros === 'clasico'
                  ? 'text-[#593922] font-black'
                  : estiloMuros === 'pastel_claro'
                  ? 'text-[#3E4359]'
                  : 'text-slate-300'
              }`}
            >
              {estado.torneo && (
                <span className="tabular-nums truncate">
                  Ronda {estado.torneo.rondaActual}/{estado.torneo.totalRondas}
                </span>
              )}
              {estado.modoOnline && <span className="truncate">Sala {estado.codigoSala}</span>}
              {estado.config.modoConTiempo && (
                <span
                  className={`font-mono-num font-bold tabular-nums shrink-0 ${
                    estado.tiempoRestante <= 5
                      ? estiloMuros === 'clasico'
                        ? 'text-[#c92a2a] animate-pulse'
                        : estiloMuros === 'pastel_claro'
                        ? 'text-[#9B1C2E] animate-pulse'
                        : 'text-rose-300 animate-pulse'
                      : estiloMuros === 'clasico'
                      ? 'text-[#2b2140]'
                      : estiloMuros === 'pastel_claro'
                      ? 'text-[#171923]'
                      : 'text-slate-100'
                  }`}
                >
                  ⏱️ {estado.tiempoRestante}s
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setModalAspectoAbierto(true);
                }}
                className={`py-1 px-2 sm:px-2.5 rounded-xl flex items-center gap-1 text-xs font-bold cursor-pointer shadow-xs active:translate-y-0.5 ${
                  estiloMuros === 'clasico'
                    ? 'bg-white border border-[#2b2140] font-black text-[#2b2140] hover:bg-[#fff9db]'
                    : estiloMuros === 'pastel_claro'
                    ? 'bg-[#EAE4FC] border border-[#CCC1F2] text-[#2E2054] hover:bg-[#DFD6FA]'
                    : 'bg-violet-300/15 border border-violet-300/30 text-violet-200 hover:bg-violet-300/25'
                }`}
                title="Cambiar tu avatar o el terreno del tablero"
              >
                <span>🎨</span>
                <span>Aspecto</span>
              </button>
              <button
                onClick={() => {
                  setModalPrevio(modalActivo);
                  setModalActivo('ajustes');
                }}
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold cursor-pointer shadow-xs ${
                  estiloMuros === 'clasico'
                    ? 'bg-white border border-[#2b2140] font-black text-[#2b2140] hover:bg-[#f1f3f5]'
                    : estiloMuros === 'pastel_claro'
                    ? 'bg-[#FAF4E4] border border-[#D4C9AE] text-[#171923] hover:bg-[#F2EBD9]'
                    : 'bg-slate-800/80 border border-white/12 text-slate-200 hover:bg-slate-700'
                }`}
                title="Ajustes rápidos"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Mesa de juego: vertical en móvil (Jugadores -> Tablero -> Acciones) y 2 columnas en escritorio (Tablero | Jugadores + Acciones) */}
          <div className="w-full flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] items-center lg:items-start justify-start gap-1.5 sm:gap-2 lg:gap-4">
            {/* Tablero Central */}
            <div className="order-2 lg:order-1 lg:col-start-1 lg:row-start-1 w-full lg:h-full flex-1 lg:flex-none min-h-0 flex items-center justify-center">
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
                rotationMode={rotationModeActivo}
                controlesInvertidos={controlesInvertidos}
                vistaPropiaOnline={true}
                temaTablero={temaTableroActivo}
              />
            </div>

            {/* Panel lateral (en móvil se aplana con `contents` para respetar el orden Jugadores arriba y Acciones abajo, o invertido si el jugador 180° tiene su turno en mesa) */}
            <div className="contents lg:flex lg:flex-col lg:gap-2.5 lg:w-[320px] xl:w-[340px] lg:col-start-2 lg:row-start-1 lg:self-start">
              <div
                className={`w-full max-w-[620px] lg:max-w-none shrink-0 ${
                  controlesInvertidos
                    ? 'order-3 lg:order-2 rotate-180'
                    : 'order-1 lg:order-1'
                }`}
              >
                <PlayerCards
                  estado={estado}
                  mostrarDistancia={ajustes.mostrarDistancia}
                  layout="auto"
                />
              </div>

              <div
                className={`w-full max-w-[560px] lg:max-w-none shrink-0 ${
                  controlesInvertidos
                    ? 'order-1 lg:order-1 rotate-180'
                    : 'order-3 lg:order-2'
                }`}
              >
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
              </div>
            </div>
          </div>

          {mostrarBarraPostPartida && estado.terminada && (
            <div
              className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-2xl p-2 sm:p-2.5 flex flex-wrap justify-center items-center gap-2 max-w-[95vw] animate-[slideUp_0.2s_ease-out] ${
                estiloMuros === 'clasico'
                  ? 'bg-[#fff8e7] border-4 border-[#2b2140] shadow-[0_8px_0_#2b2140,0_20px_30px_rgba(0,0,0,0.35)]'
                  : estiloMuros === 'pastel_claro'
                  ? 'bg-[#FFFDF6] border border-[#DFD6BF] shadow-[0_14px_30px_rgba(38,41,59,0.18)]'
                  : 'bg-[#1B1F30] border border-white/15 shadow-2xl'
              }`}
            >
              <button
                onClick={() => {
                  sounds.playClick();
                  setModalActivo(estado.torneo && estado.torneo.activo ? 'torneo' : 'victoria');
                }}
                className={`py-1.5 px-3 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 shadow-xs ${
                  estiloMuros === 'clasico'
                    ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] hover:bg-[#fcc419] font-black'
                    : estiloMuros === 'pastel_claro'
                    ? 'bg-[#FCE8B8] text-[#4A3309] border border-[#EAD08E] hover:bg-[#F9DE9E]'
                    : 'bg-amber-200/15 text-amber-200 border border-amber-200/30 hover:bg-amber-200/25'
                }`}
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
                className={`py-1.5 px-3 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 shadow-xs ${
                  estiloMuros === 'clasico'
                    ? 'bg-[#4dabf7] text-white border-2 border-[#2b2140] hover:bg-[#339af0] font-black'
                    : estiloMuros === 'pastel_claro'
                    ? 'bg-[#CEE4FF] text-[#143254] border border-[#A4C6F4] hover:bg-[#BBD8FE]'
                    : 'bg-sky-200/15 text-sky-200 border border-sky-200/30 hover:bg-sky-200/25'
                }`}
              >
                <span>📊</span>
                <span>Ranking</span>
              </button>
              <button
                onClick={handleRevancha}
                className={`py-1.5 px-3 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 shadow-xs ${
                  estado.modoOnline && estadoRevanchaOnline === 'no_disponible'
                    ? estiloMuros === 'clasico'
                      ? 'bg-[#ffe3e3] text-[#c92a2a] border-2 border-[#c92a2a]'
                      : estiloMuros === 'pastel_claro'
                      ? 'bg-[#FAD8DD] text-[#661924] border border-[#EEB1B9]'
                      : 'bg-rose-400/15 text-rose-200 border border-rose-400/30'
                    : estiloMuros === 'clasico'
                    ? 'bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] hover:bg-[#40c057] font-black'
                    : estiloMuros === 'pastel_claro'
                    ? 'bg-[#B7EBD0] text-[#0F3D27] border border-[#8AD2AE] hover:bg-[#A4E3C2]'
                    : 'bg-emerald-300/90 text-slate-950 border border-emerald-200/40 hover:bg-emerald-200'
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
                className={`py-1.5 px-3 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 shadow-xs ${
                  estiloMuros === 'clasico'
                    ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] hover:bg-[#f1f3f5] font-black'
                    : estiloMuros === 'pastel_claro'
                    ? 'bg-[#FAF4E4] text-[#171923] border border-[#DFD6BF] hover:bg-[#F2EBD9]'
                    : 'bg-slate-800/80 text-slate-200 border border-white/12 hover:bg-slate-700'
                }`}
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
          ocultarRotacion={Boolean(
            screen === 'juego' && estado && (estado.modoOnline || !hayMultiplesHumanos)
          )}
          ocultarRotarControles={Boolean(
            screen === 'juego' &&
              estado &&
              (estado.modoOnline || !hayMultiplesHumanos || estado.n !== 2)
          )}
          onGuardar={(nuevos) => {
            setAjustes(nuevos);
            guardarAjustes(nuevos);
            setEstado((prev) => {
              if (!prev || prev.modoOnline) return prev;
              const multiH = prev.jugadores.filter((p) => p.tipo === 'humano').length >= 2;
              return multiH
                ? {
                    ...prev,
                    config: {
                      ...prev.config,
                      rotationMode: Boolean(nuevos.cambiarVistaPorTurno),
                      rotarControles:
                        prev.n === 2 ? Boolean(nuevos.rotarControlesSinTablero) : false,
                    },
                  }
                : prev;
            });
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

      {confirmarAbandonoAbierto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
          <div
            className={`w-full max-w-sm rounded-3xl p-5 flex flex-col gap-3 text-center ${
              estiloMuros === 'clasico'
                ? 'bg-[#fff8e7] border-4 border-[#2b2140] shadow-[0_8px_0_#2b2140]'
                : estiloMuros === 'pastel_claro'
                ? 'bg-[#FFFDF6] border border-[#DFD6BF] shadow-2xl text-[#171923]'
                : 'bg-[#1B1F30] border border-white/15 shadow-2xl text-slate-100'
            }`}
          >
            <div className="text-3xl">⚠️</div>
            <h3 className="text-lg font-black leading-tight">¿Salir de la partida online?</h3>
            <p className="text-xs font-semibold opacity-85 leading-relaxed">
              Si abandonas ahora una partida online en curso, perderás{' '}
              <strong className={estiloMuros === 'clasico' ? 'text-[#c92a2a]' : 'text-rose-400'}>
                -5 puntos
              </strong>{' '}
              en tu perfil y ranking.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setConfirmarAbandonoAbierto(false);
                }}
                className={`py-2.5 px-3 rounded-xl font-black text-xs cursor-pointer ${
                  estiloMuros === 'clasico'
                    ? 'bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : estiloMuros === 'pastel_claro'
                    ? 'bg-[#B7EBD0] text-[#0F3D27] border border-[#8AD2AE]'
                    : 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/35'
                }`}
              >
                Seguir jugando
              </button>
              <button
                type="button"
                onClick={() => ejecutarSalidaAlMenu(true)}
                className={`py-2.5 px-3 rounded-xl font-black text-xs cursor-pointer ${
                  estiloMuros === 'clasico'
                    ? 'bg-[#ff6b6b] text-white border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : estiloMuros === 'pastel_claro'
                    ? 'bg-[#FAD8DD] text-[#661924] border border-[#EEB1B9]'
                    : 'bg-rose-400/20 text-rose-200 border border-rose-400/35'
                }`}
              >
                Abandonar (-5 pts)
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator compact={screen !== 'menu' || Boolean(modalActivo)} />
    </div>
    </MurosThemeProvider>
  );
};

export default App;
