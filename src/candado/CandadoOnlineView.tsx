/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sala Online y Duelo P2P 1v1 aislado para Candado.
 * Incluye salas públicas/privadas (?juego=candado), secreto aleatorio o manual,
 * anti-trampas commit-reveal SHA-256, turnos igualados, temporizador y consenso de puntos.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartoonCharacter } from '../components/CartoonCharacter';
import { AvatarTipoDeAura, AvatarTipoDeGorro, AvatarTipoDeRopa, UserCuenta } from '../types/murosLocos';
import { candadoAudio } from './candadoAudio';
import { calcularCommitHash, generarSalAleatoria, verificarCommitYHistorial } from './candadoCrypto';
import {
  DIGITOS_LOGICO,
  DIGITOS_MAYOR_MENOR,
  evaluarIntentoLogico,
  evaluarIntentoMayorMenor,
  formatearNumeroConCeros,
  generarSecreto,
  normalizarConfigCandado,
} from './candadoEngine';
import { candadoOnlineService, generarCodigoSalaCandado } from './candadoOnlineService';
import {
  calcularPreviewPuntosP2P,
  consultarPuntosCandadoAsync,
  generarMatchIdCandado,
  reportarPuntosCandadoAsync,
} from './candadoPuntosApi';
import { CandadoVault } from './CandadoVault';
import {
  ConfigDueloCandadoP2P,
  DigitosCandado,
  EstadoDueloP2P,
  InfoSalaCandado,
  IntentoLogico,
  IntentoMayorMenor,
  JugadorCandadoOnline,
  MensajeCandadoP2P,
  ModoCandado,
  NotaDigito,
  ResumenPuntosCandado,
  TiempoTurnoCandado,
} from './types';

interface CandadoOnlineViewProps {
  userActual: UserCuenta | null;
  esMinimalista: boolean;
  animacionesReducidas: boolean;
  configInicial: ConfigDueloCandadoP2P;
  onPuntosActualizados?: (nuevosPuntos: number) => void;
  onVolverALocal: () => void;
}

const ETIQUETAS_DIGITOS: Record<DigitosCandado, { icono: string; metal: string }> = {
  4: { icono: '🥉', metal: 'Bronce' },
  5: { icono: '🛡️', metal: 'Acero' },
  6: { icono: '👑', metal: 'Real' },
  8: { icono: '💠', metal: 'Titanio' },
  10: { icono: '🔮', metal: 'Cuántica' },
  14: { icono: '⚡', metal: 'Élite' },
  16: { icono: '🌌', metal: 'Maestra' },
};

const TIEMPOS_TURNO: { valor: TiempoTurnoCandado; texto: string }[] = [
  { valor: 30, texto: '30s' },
  { valor: 45, texto: '45s' },
  { valor: 60, texto: '60s' },
  { valor: 0, texto: 'Libre' },
];

const REACCIONES_RAPIDAS = ['👏', '🔥', '🧠', '😅', '😱', '🎯'];

function nombreInvitadoFallback(): string {
  return `Jugador-${Math.floor(100 + Math.random() * 900)}`;
}

export const CandadoOnlineView: React.FC<CandadoOnlineViewProps> = ({
  userActual,
  esMinimalista,
  animacionesReducidas,
  configInicial,
  onPuntosActualizados,
  onVolverALocal,
}) => {
  const [subVista, setSubVista] = useState<'lobby' | 'espera' | 'duelo'>('lobby');
  const [nombreLocal, setNombreLocal] = useState<string>(
    () => userActual?.nombre || nombreInvitadoFallback()
  );

  // Configuración para crear sala
  const [configSala, setConfigSala] = useState<ConfigDueloCandadoP2P>(configInicial);
  const [salaPublica, setSalaPublica] = useState<boolean>(true);
  const [codigoEntrada, setCodigoEntrada] = useState<string>('');
  const [filtroDigitosSalas, setFiltroDigitosSalas] = useState<DigitosCandado | 0>(0);
  const [salasPublicas, setSalasPublicas] = useState<InfoSalaCandado[]>([]);
  const [cargandoSalas, setCargandoSalas] = useState<boolean>(false);
  const [errorLobby, setErrorLobby] = useState<string | null>(null);
  const [ocupadoRed, setOcupadoRed] = useState<boolean>(false);

  // Estado de sala en espera
  const [codigoSala, setCodigoSala] = useState<string>('');
  const [soyAnfitrion, setSoyAnfitrion] = useState<boolean>(true);
  const [miJugadorId, setMiJugadorId] = useState<0 | 1>(0);
  const [jugadoresSala, setJugadoresSala] = useState<JugadorCandadoOnline[]>([]);
  const [modoConexion, setModoConexion] = useState<'webrtc' | 'http' | 'connecting'>('http');
  const [copiadoCodigo, setCopiadoCodigo] = useState<boolean>(false);

  // Clave propia en espera (opcional: aleatoria o escrita por el jugador)
  const [usarSecretoManual, setUsarSecretoManual] = useState<boolean>(false);
  const [secretoManual, setSecretoManual] = useState<string>('');
  const [secretoVisibleMiBoveda, setSecretoVisibleMiBoveda] = useState<boolean>(false);

  // Estado del duelo activo
  const [duelo, setDuelo] = useState<EstadoDueloP2P | null>(null);
  const dueloRef = useRef<EstadoDueloP2P | null>(null);
  dueloRef.current = duelo;

  const jugadoresSalaRef = useRef<JugadorCandadoOnline[]>([]);
  jugadoresSalaRef.current = jugadoresSala;

  const [entradaActual, setEntradaActual] = useState<string[]>([]);
  const [cursorIdx, setCursorIdx] = useState<number>(0);
  const [modoNotas, setModoNotas] = useState<boolean>(false);
  const [notasDigitos, setNotasDigitos] = useState<Record<string, NotaDigito>>({});
  const [errorDuelo, setErrorDuelo] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState<boolean>(false);
  const [tabHistorial, setTabHistorial] = useState<'mios' | 'rival'>('mios');
  const [registroAmpliado, setRegistroAmpliado] = useState<boolean>(false);

  // Reacciones, desconexión, revancha, puntos
  const [reaccionMia, setReaccionMia] = useState<string | null>(null);
  const [reaccionRival, setReaccionRival] = useState<string | null>(null);
  const [avisoDesconexionSeg, setAvisoDesconexionSeg] = useState<number | null>(null);
  const [rivalSalioSala, setRivalSalioSala] = useState<boolean>(false);
  const [revanchaEstado, setRevanchaEstado] = useState<
    'ninguna' | 'enviada' | 'recibida' | 'rechazada'
  >('ninguna');
  const [resumenPuntos, setResumenPuntos] = useState<ResumenPuntosCandado>({
    estado: 'idle',
    puntosOtorgados: 0,
  });

  const puntosEnviadosMatchRef = useRef<string>('');
  const errorTimerRef = useRef<number | null>(null);
  const secretoManualRef = useRef<string>('');
  secretoManualRef.current = usarSecretoManual ? secretoManual : '';

  const miPerfilSala = useMemo(
    () => ({
      cuentaId: userActual?.id,
      nombre: (userActual?.nombre || nombreLocal || 'Jugador').trim().slice(0, 15),
      color: userActual?.avatarColor || (soyAnfitrion ? '#ff6b6b' : '#4dabf7'),
      hat: (userActual?.avatarHat || 'corona') as string,
      ropa: (userActual?.avatarRopa || 'ninguna') as string,
      ropaColor: userActual?.avatarRopaColor,
      aura: (userActual?.avatarAura || 'ninguna') as string,
    }),
    [userActual, nombreLocal, soyAnfitrion]
  );

  const cargarSalasPublicas = useCallback(async () => {
    setCargandoSalas(true);
    const list = await candadoOnlineService.obtenerSalasPublicasCandado(filtroDigitosSalas);
    setSalasPublicas(list);
    setCargandoSalas(false);
  }, [filtroDigitosSalas]);

  useEffect(() => {
    if (subVista !== 'lobby') return;
    cargarSalasPublicas();
    const id = window.setInterval(cargarSalasPublicas, 6000);
    return () => window.clearInterval(id);
  }, [subVista, cargarSalasPublicas]);

  useEffect(() => {
    return () => {
      candadoOnlineService.cleanUp();
    };
  }, []);

  const validarSecretoOpcional = useCallback(
    (raw: string, cfg: ConfigDueloCandadoP2P): string | null => {
      const limpio = raw.trim();
      if (!new RegExp(`^\\d{${cfg.digitos}}$`).test(limpio)) return null;
      if (cfg.modo === 'logico' && !cfg.permitirRepetidos) {
        if (new Set(limpio.split('')).size !== cfg.digitos) return null;
      }
      return limpio;
    },
    []
  );

  const prepararDueloLocalmente = useCallback(
    async (
      matchId: string,
      code: string,
      cfg: ConfigDueloCandadoP2P,
      myId: 0 | 1,
      secretoPreferido?: string | null
    ) => {
      const cfgNorm: ConfigDueloCandadoP2P = {
        ...normalizarConfigCandado(cfg),
        tiempoTurnoSeg: cfg.tiempoTurnoSeg,
      };
      const secretoValido = secretoPreferido
        ? validarSecretoOpcional(secretoPreferido, cfgNorm)
        : null;
      const miSecreto =
        secretoValido || generarSecreto(cfgNorm.digitos, cfgNorm.modo, cfgNorm.permitirRepetidos);
      const miSal = generarSalAleatoria(16);
      const miCommitHash = await calcularCommitHash(miSecreto, miSal);

      const safeDigits = Math.min(cfgNorm.digitos, 10);
      const maxVal = 10 ** safeDigits - 1;

      const nuevoDuelo: EstadoDueloP2P = {
        matchId,
        codigoSala: code,
        config: cfgNorm,
        miJugadorId: myId,
        turnoActual: 0,
        fase: 'preparando_claves',
        miSecreto,
        miSal,
        miCommitHash,
        rivalCommitHash: '',
        rivalSecretoRevelado: null,
        rivalSalRevelada: null,
        verificacionRival: null,
        misIntentos: [],
        intentosRival: [],
        miRangoMin: 0,
        miRangoMax: maxVal,
        rivalRangoMin: 0,
        rivalRangoMax: maxVal,
        yoDescifre: false,
        rivalDescifro: false,
        turnoIgualadorPendiente: false,
        ganadorId: null,
        desenlaceParaMi: null,
        tiempoRestanteTurno: cfgNorm.tiempoTurnoSeg,
        inicioMs: Date.now(),
        finMs: null,
      };

      dueloRef.current = nuevoDuelo;
      setDuelo(nuevoDuelo);
      setEntradaActual(new Array(cfgNorm.digitos).fill(''));
      setCursorIdx(0);
      setModoNotas(false);
      setNotasDigitos({});
      setErrorDuelo(null);
      setTabHistorial('mios');
      setSecretoVisibleMiBoveda(false);
      setAvisoDesconexionSeg(null);
      setRivalSalioSala(false);
      setRevanchaEstado('ninguna');
      setResumenPuntos({ estado: 'idle', puntosOtorgados: 0 });
      puntosEnviadosMatchRef.current = '';
      setSubVista('duelo');

      candadoOnlineService.setInMatch(true);
      candadoOnlineService.send({
        type: 'CANDADO_COMMIT',
        matchId,
        jugadorId: myId,
        commitHash: miCommitHash,
      });
    },
    [validarSecretoOpcional]
  );

  // Registrar callbacks de P2P
  useEffect(() => {
    candadoOnlineService.setCallbacks({
      onLobbyUpdate: (jugadores, cfg) => {
        setJugadoresSala(jugadores);
        const info = candadoOnlineService.getRoomInfo();
        setMiJugadorId(info.myPlayerId);
        if (cfg) {
          setConfigSala(cfg);
        }
      },
      onConnectionModeChange: (m) => {
        setModoConexion(m);
      },
      onLobbyError: (err) => {
        setErrorLobby(err);
      },
      onDisconnectWarning: (secs) => {
        setAvisoDesconexionSeg(secs);
      },
      onReconnected: () => {
        setAvisoDesconexionSeg(null);
      },
      onDisconnectTimeout: () => {
        setAvisoDesconexionSeg(null);
        const cur = dueloRef.current;
        if (!cur || cur.fase === 'terminada') return;
        candadoAudio.playUnlock();
        const terminado: EstadoDueloP2P = {
          ...cur,
          fase: 'terminada',
          ganadorId: cur.miJugadorId,
          desenlaceParaMi: 'victoria',
          motivoFin: 'Tu rival se desconectó del duelo.',
          finMs: Date.now(),
        };
        dueloRef.current = terminado;
        setDuelo(terminado);
        candadoOnlineService.setInMatch(false);
        setRivalSalioSala(true);
      },
      onPeerLeft: (nombreSaliente) => {
        setRivalSalioSala(true);
        const cur = dueloRef.current;
        if (cur && cur.fase !== 'terminada') {
          candadoAudio.playUnlock();
          const terminado: EstadoDueloP2P = {
            ...cur,
            fase: 'terminada',
            ganadorId: cur.miJugadorId,
            desenlaceParaMi: 'victoria',
            motivoFin: `${nombreSaliente} abandonó el duelo.`,
            finMs: Date.now(),
          };
          dueloRef.current = terminado;
          setDuelo(terminado);
          candadoOnlineService.setInMatch(false);
        } else if (subVista === 'espera') {
          setErrorLobby(`${nombreSaliente} salió de la sala.`);
        }
      },
      onMessage: async (msg: MensajeCandadoP2P) => {
        const cur = dueloRef.current;

        if (msg.type === 'CANDADO_START') {
          const info = candadoOnlineService.getRoomInfo();
          await prepararDueloLocalmente(
            msg.matchId,
            info.roomCode,
            msg.config,
            info.myPlayerId,
            secretoManualRef.current
          );
          return;
        }

        if (msg.type === 'CANDADO_REACTION') {
          if (msg.jugadorId !== dueloRef.current?.miJugadorId) {
            setReaccionRival(msg.emoji);
            window.setTimeout(() => setReaccionRival(null), 2600);
          }
          return;
        }

        if (msg.type === 'CANDADO_REMATCH_REQUEST') {
          if (msg.jugadorId !== dueloRef.current?.miJugadorId) {
            setRevanchaEstado('recibida');
          }
          return;
        }

        if (msg.type === 'CANDADO_REMATCH_RESPONSE') {
          if (msg.jugadorId !== dueloRef.current?.miJugadorId) {
            if (!msg.aceptada) {
              setRevanchaEstado('rechazada');
            }
          }
          return;
        }

        if (!cur || ('matchId' in msg && msg.matchId !== cur.matchId)) {
          return;
        }

        if (msg.type === 'CANDADO_COMMIT') {
          if (msg.jugadorId === cur.miJugadorId) return;
          const actualizado: EstadoDueloP2P = {
            ...cur,
            rivalCommitHash: msg.commitHash,
            fase: cur.miCommitHash && msg.commitHash ? 'jugando' : cur.fase,
            tiempoRestanteTurno: cur.config.tiempoTurnoSeg,
          };
          dueloRef.current = actualizado;
          setDuelo(actualizado);
          return;
        }

        // Rival adivina CONTRA MI secreto -> Evalúo localmente y devuelvo CANDADO_CLUE
        if (msg.type === 'CANDADO_GUESS') {
          if (msg.jugadorId === cur.miJugadorId || cur.fase !== 'jugando') return;
          const entrada = String(msg.entrada || '').trim();
          const numero = cur.intentosRival.length + 1;
          let intentoGenerado: IntentoLogico | IntentoMayorMenor;
          let descifrado = false;
          let nuevoMin = cur.rivalRangoMin;
          let nuevoMax = cur.rivalRangoMax;

          if (cur.config.modo === 'logico') {
            const ev = evaluarIntentoLogico(entrada, cur.miSecreto);
            descifrado = ev.gano;
            intentoGenerado = {
              numero,
              entrada,
              digitos: ev.digitos,
              exactos: ev.exactos,
              desubicados: ev.desubicados,
              ausentes: ev.ausentes,
              timestamp: Date.now(),
            };
          } else {
            const evB = evaluarIntentoMayorMenor(
              entrada,
              cur.miSecreto,
              cur.rivalRangoMin,
              cur.rivalRangoMax
            );
            descifrado = evB.gano;
            nuevoMin = evB.rangoMin;
            nuevoMax = evB.rangoMax;
            intentoGenerado = {
              numero,
              entrada,
              direccion: evB.direccion,
              proximidad: evB.proximidad,
              exactosEnPosicion: evB.exactosEnPosicion,
              rangoMin: evB.rangoMin,
              rangoMax: evB.rangoMax,
              timestamp: Date.now(),
            };
          }

          const rivalNombre =
            jugadoresSalaRef.current.find((j) => j.id === msg.jugadorId)?.nombre || 'Rival';
          const miNombre =
            jugadoresSalaRef.current.find((j) => j.id === cur.miJugadorId)?.nombre || 'Tú';

          let partidaTerminada = false;
          let ganadorId: 0 | 1 | 'empate' | null = null;
          let motivoFin: string | undefined;
          let siguienteTurno: 0 | 1 = cur.miJugadorId;
          let turnoIgualador = cur.turnoIgualadorPendiente;

          if (msg.jugadorId === 0) {
            if (descifrado) {
              // P0 acertó primero -> P1 (yo) tiene turno igualador en el mismo intento!
              turnoIgualador = true;
              siguienteTurno = 1;
            } else {
              siguienteTurno = 1;
            }
          } else {
            // msg.jugadorId === 1 (Soy P0)
            if (cur.turnoIgualadorPendiente || cur.yoDescifre) {
              partidaTerminada = true;
              if (descifrado) {
                ganadorId = 'empate';
                motivoFin = '¡Ambos descifraron el candado en la misma ronda!';
              } else {
                ganadorId = 0;
                motivoFin = `${miNombre} descifró el candado primero.`;
              }
            } else if (descifrado) {
              partidaTerminada = true;
              ganadorId = 1;
              motivoFin = `${rivalNombre} descifró tu candado en ${numero} intentos.`;
            } else if (
              cur.config.maxIntentos > 0 &&
              numero >= cur.config.maxIntentos &&
              cur.misIntentos.length >= cur.config.maxIntentos
            ) {
              partidaTerminada = true;
              ganadorId = 'empate';
              motivoFin = 'Se agotó el límite de intentos para ambos.';
            } else {
              siguienteTurno = 0;
            }
          }

          const desenlace: EstadoDueloP2P['desenlaceParaMi'] = partidaTerminada
            ? ganadorId === 'empate'
              ? 'empate'
              : ganadorId === cur.miJugadorId
              ? 'victoria'
              : 'derrota'
            : null;

          const nuevoEstado: EstadoDueloP2P = {
            ...cur,
            intentosRival: [intentoGenerado, ...cur.intentosRival],
            rivalRangoMin: nuevoMin,
            rivalRangoMax: nuevoMax,
            rivalDescifro: cur.rivalDescifro || descifrado,
            turnoIgualadorPendiente: turnoIgualador,
            turnoActual: siguienteTurno,
            fase: partidaTerminada ? 'terminada' : 'jugando',
            ganadorId,
            desenlaceParaMi: desenlace,
            motivoFin,
            tiempoRestanteTurno: cur.config.tiempoTurnoSeg,
            finMs: partidaTerminada ? Date.now() : null,
          };
          dueloRef.current = nuevoEstado;
          setDuelo(nuevoEstado);

          candadoOnlineService.send({
            type: 'CANDADO_CLUE',
            matchId: cur.matchId,
            objetivoJugadorId: msg.jugadorId,
            intento: intentoGenerado,
            descifrado,
            siguienteTurno,
            turnoIgualadorPendiente: turnoIgualador,
            partidaTerminada,
            ganadorId,
            motivoFin,
          });

          if (partidaTerminada) {
            candadoOnlineService.setInMatch(false);
            candadoOnlineService.send({
              type: 'CANDADO_REVEAL',
              matchId: cur.matchId,
              jugadorId: cur.miJugadorId,
              secreto: cur.miSecreto,
              sal: cur.miSal,
            });
            if (desenlace === 'victoria') candadoAudio.playUnlock();
            else candadoAudio.playLockFail();
          } else {
            candadoAudio.playDialTick();
          }
          return;
        }

        // Recibo pista del RIVAL sobre MI último intento
        if (msg.type === 'CANDADO_CLUE') {
          if (msg.objetivoJugadorId !== cur.miJugadorId) return;
          const esLogico = cur.config.modo === 'logico';
          const itB = !esLogico ? (msg.intento as IntentoMayorMenor) : null;
          const desenlace: EstadoDueloP2P['desenlaceParaMi'] = msg.partidaTerminada
            ? msg.ganadorId === 'empate'
              ? 'empate'
              : msg.ganadorId === cur.miJugadorId
              ? 'victoria'
              : 'derrota'
            : null;

          const actualizado: EstadoDueloP2P = {
            ...cur,
            misIntentos: [msg.intento, ...cur.misIntentos],
            miRangoMin: itB ? itB.rangoMin : cur.miRangoMin,
            miRangoMax: itB ? itB.rangoMax : cur.miRangoMax,
            yoDescifre: cur.yoDescifre || msg.descifrado,
            turnoIgualadorPendiente: msg.turnoIgualadorPendiente,
            turnoActual: msg.siguienteTurno,
            fase: msg.partidaTerminada ? 'terminada' : 'jugando',
            ganadorId: msg.ganadorId,
            desenlaceParaMi: desenlace,
            motivoFin: msg.motivoFin,
            tiempoRestanteTurno: cur.config.tiempoTurnoSeg,
            finMs: msg.partidaTerminada ? Date.now() : null,
          };
          dueloRef.current = actualizado;
          setDuelo(actualizado);
          setEntradaActual(new Array(cur.config.digitos).fill(''));
          setCursorIdx(0);

          if (msg.partidaTerminada) {
            candadoOnlineService.setInMatch(false);
            candadoOnlineService.send({
              type: 'CANDADO_REVEAL',
              matchId: cur.matchId,
              jugadorId: cur.miJugadorId,
              secreto: cur.miSecreto,
              sal: cur.miSal,
            });
            if (desenlace === 'victoria') candadoAudio.playUnlock();
            else candadoAudio.playLockFail();
          } else {
            const ex = esLogico
              ? (msg.intento as IntentoLogico).exactos
              : (msg.intento as IntentoMayorMenor).exactosEnPosicion;
            candadoAudio.playAttemptCheck(ex);
          }
          return;
        }

        if (msg.type === 'CANDADO_TIMEOUT_SKIP') {
          if (msg.jugadorId === cur.miJugadorId || cur.fase !== 'jugando') return;
          const desenlace: EstadoDueloP2P['desenlaceParaMi'] = msg.partidaTerminada
            ? msg.ganadorId === 'empate'
              ? 'empate'
              : msg.ganadorId === cur.miJugadorId
              ? 'victoria'
              : 'derrota'
            : null;
          const actualizado: EstadoDueloP2P = {
            ...cur,
            turnoActual: msg.siguienteTurno,
            fase: msg.partidaTerminada ? 'terminada' : 'jugando',
            ganadorId: msg.ganadorId,
            desenlaceParaMi: desenlace,
            motivoFin: msg.motivoFin,
            tiempoRestanteTurno: cur.config.tiempoTurnoSeg,
            finMs: msg.partidaTerminada ? Date.now() : null,
          };
          dueloRef.current = actualizado;
          setDuelo(actualizado);
          if (msg.partidaTerminada) {
            candadoOnlineService.setInMatch(false);
            candadoOnlineService.send({
              type: 'CANDADO_REVEAL',
              matchId: cur.matchId,
              jugadorId: cur.miJugadorId,
              secreto: cur.miSecreto,
              sal: cur.miSal,
            });
          } else {
            candadoAudio.playDialTick();
          }
          return;
        }

        if (msg.type === 'CANDADO_SURRENDER') {
          if (msg.jugadorId === cur.miJugadorId || cur.fase === 'terminada') return;
          candadoAudio.playUnlock();
          const terminado: EstadoDueloP2P = {
            ...cur,
            fase: 'terminada',
            ganadorId: cur.miJugadorId,
            desenlaceParaMi: 'victoria',
            motivoFin: `${msg.nombre} se rindió en el duelo.`,
            finMs: Date.now(),
          };
          dueloRef.current = terminado;
          setDuelo(terminado);
          candadoOnlineService.setInMatch(false);
          candadoOnlineService.send({
            type: 'CANDADO_REVEAL',
            matchId: cur.matchId,
            jugadorId: cur.miJugadorId,
            secreto: cur.miSecreto,
            sal: cur.miSal,
          });
          return;
        }

        if (msg.type === 'CANDADO_REVEAL') {
          if (msg.jugadorId === cur.miJugadorId) return;
          const verif = await verificarCommitYHistorial({
            secreto: msg.secreto,
            sal: msg.sal,
            commitHash: cur.rivalCommitHash,
            modo: cur.config.modo,
            digitos: cur.config.digitos,
            permitirRepetidos: cur.config.permitirRepetidos,
            intentosRealizadosContraEsteSecreto: cur.misIntentos,
          });
          const latest = dueloRef.current;
          if (!latest || latest.matchId !== cur.matchId) return;
          const actualizado: EstadoDueloP2P = {
            ...latest,
            rivalSecretoRevelado: msg.secreto,
            rivalSalRevelada: msg.sal,
            verificacionRival: verif,
          };
          dueloRef.current = actualizado;
          setDuelo(actualizado);
        }
      },
    });
  }, [prepararDueloLocalmente, subVista]);

  // Temporizador por turno P2P
  useEffect(() => {
    if (subVista !== 'duelo' || !duelo || duelo.fase !== 'jugando' || duelo.config.tiempoTurnoSeg <= 0) {
      return;
    }

    const id = window.setInterval(() => {
      setDuelo((prev) => {
        if (!prev || prev.fase !== 'jugando' || prev.config.tiempoTurnoSeg <= 0) return prev;
        const nextSeg = prev.tiempoRestanteTurno - 1;
        if (nextSeg > 0) {
          return { ...prev, tiempoRestanteTurno: nextSeg };
        }

        // Si es MI turno y se acabó el tiempo, envío auto-pase
        if (prev.turnoActual === prev.miJugadorId) {
          const siguiente: 0 | 1 = prev.miJugadorId === 0 ? 1 : 0;
          const pierdoIgualador = prev.turnoIgualadorPendiente && prev.miJugadorId === 1;
          const ganadorId: 0 | 1 | 'empate' | null = pierdoIgualador ? 0 : null;
          const desenlace: EstadoDueloP2P['desenlaceParaMi'] = pierdoIgualador ? 'derrota' : null;
          const motivo = pierdoIgualador ? 'Se agotó el tiempo en el turno igualador.' : undefined;

          candadoOnlineService.send({
            type: 'CANDADO_TIMEOUT_SKIP',
            matchId: prev.matchId,
            jugadorId: prev.miJugadorId,
            siguienteTurno: siguiente,
            partidaTerminada: pierdoIgualador,
            ganadorId,
            motivoFin: motivo,
            actionId: `tmo_${Date.now()}`,
          });

          if (pierdoIgualador) {
            candadoOnlineService.setInMatch(false);
            candadoOnlineService.send({
              type: 'CANDADO_REVEAL',
              matchId: prev.matchId,
              jugadorId: prev.miJugadorId,
              secreto: prev.miSecreto,
              sal: prev.miSal,
            });
          }

          return {
            ...prev,
            turnoActual: siguiente,
            fase: pierdoIgualador ? 'terminada' : 'jugando',
            ganadorId,
            desenlaceParaMi: desenlace,
            motivoFin: motivo,
            tiempoRestanteTurno: prev.config.tiempoTurnoSeg,
            finMs: pierdoIgualador ? Date.now() : null,
          };
        }

        return { ...prev, tiempoRestanteTurno: 0 };
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [subVista, duelo?.fase, duelo?.config.tiempoTurnoSeg]);

  // Reportar puntos al terminar el duelo P2P (con consenso + polling si aplica)
  useEffect(() => {
    if (!duelo || duelo.fase !== 'terminada' || !duelo.desenlaceParaMi) return;
    if (puntosEnviadosMatchRef.current === duelo.matchId) return;
    puntosEnviadosMatchRef.current = duelo.matchId;

    if (!userActual) {
      setResumenPuntos({
        estado: 'invitado',
        puntosOtorgados: 0,
        mensaje: 'Modo invitado: inicia sesión para sumar puntos a tu cuenta.',
      });
      return;
    }

    let cancelado = false;
    const rival = jugadoresSala.find((j) => j.id !== duelo.miJugadorId);
    const abandonoPropio =
      Boolean(duelo.motivoFin?.includes('te rendiste')) ||
      (duelo.desenlaceParaMi === 'derrota' && Boolean(duelo.motivoFin?.includes('rend')));
    const abandonoDesconexion =
      duelo.desenlaceParaMi === 'victoria' &&
      (Boolean(duelo.motivoFin?.includes('desconect')) ||
        Boolean(duelo.motivoFin?.includes('abandon')));

    setResumenPuntos({ estado: 'enviando', puntosOtorgados: 0 });

    const enviarYConsultar = async () => {
      const resp = await reportarPuntosCandadoAsync({
        matchId: duelo.matchId,
        modalidad: 'p2p',
        modo: duelo.config.modo,
        digitos: duelo.config.digitos,
        conLimite: duelo.config.maxIntentos > 0,
        intentosUsados: Math.max(1, duelo.misIntentos.length),
        resultado: duelo.desenlaceParaMi || 'derrota',
        abandono: abandonoPropio,
        codigoSala: duelo.codigoSala,
        rivalCuentaId: rival?.cuentaId,
        abandonoPorDesconexion: abandonoDesconexion,
      });

      if (cancelado) return;

      if (!resp.ok) {
        setResumenPuntos({
          estado: resp.conflicto ? 'conflicto' : 'error',
          puntosOtorgados: 0,
          mensaje: resp.error || 'No se pudieron acreditar los puntos.',
        });
        return;
      }

      if (resp.confirmado) {
        if (typeof resp.puntosTotales === 'number') {
          onPuntosActualizados?.(resp.puntosTotales);
        }
        setResumenPuntos({
          estado:
            resp.puntosOtorgados === 0 && resp.cupoDiarioRestante === 0
              ? 'cupo_agotado'
              : 'acreditado',
          puntosOtorgados: resp.puntosOtorgados,
          puntosTotales: resp.puntosTotales,
          cupoDiarioRestante: resp.cupoDiarioRestante,
          mensaje:
            resp.puntosOtorgados === 0 && resp.cupoDiarioRestante === 0
              ? 'Límite diario de 100 pts en Candado alcanzado.'
              : undefined,
        });
        return;
      }

      if (resp.pendienteConsenso) {
        setResumenPuntos({
          estado: 'pendiente_consenso',
          puntosOtorgados: 0,
          mensaje: 'Esperando confirmación automática del rival...',
        });

        for (let intentoPoll = 0; intentoPoll < 8; intentoPoll++) {
          await new Promise((r) => setTimeout(r, 1700));
          if (cancelado) return;
          const poll = await consultarPuntosCandadoAsync(duelo.matchId);
          if (cancelado) return;
          if (poll.ok && poll.confirmado) {
            if (typeof poll.puntosTotales === 'number') {
              onPuntosActualizados?.(poll.puntosTotales);
            }
            setResumenPuntos({
              estado:
                poll.puntosOtorgados === 0 && poll.cupoDiarioRestante === 0
                  ? 'cupo_agotado'
                  : 'acreditado',
              puntosOtorgados: poll.puntosOtorgados,
              puntosTotales: poll.puntosTotales,
              cupoDiarioRestante: poll.cupoDiarioRestante,
            });
            return;
          }
          if (poll.conflicto) {
            setResumenPuntos({
              estado: 'conflicto',
              puntosOtorgados: 0,
              mensaje: 'Los reportes del duelo no coincidieron.',
            });
            return;
          }
        }
      }
    };

    enviarYConsultar();
    return () => {
      cancelado = true;
    };
  }, [duelo?.fase, duelo?.matchId, userActual, jugadoresSala, onPuntosActualizados]);

  const crearSalaCandado = async () => {
    setErrorLobby(null);
    setOcupadoRed(true);
    try {
      const cfgNorm: ConfigDueloCandadoP2P = {
        ...normalizarConfigCandado(configSala),
        tiempoTurnoSeg: configSala.tiempoTurnoSeg,
      };
      const code = generarCodigoSalaCandado();
      setSoyAnfitrion(true);
      setMiJugadorId(0);
      await candadoOnlineService.createRoom({
        codigo: code,
        publica: salaPublica,
        config: cfgNorm,
        jugador: { ...miPerfilSala, color: userActual?.avatarColor || '#ff6b6b' },
      });
      setCodigoSala(code);
      setSubVista('espera');
    } catch (err: any) {
      setErrorLobby(err?.message || 'Error al crear la sala.');
    } finally {
      setOcupadoRed(false);
    }
  };

  const unirseASalaCandado = async (codigoDestino: string) => {
    const limpio = codigoDestino.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!limpio) {
      setErrorLobby('Escribe un código de sala válido.');
      return;
    }
    setErrorLobby(null);
    setOcupadoRed(true);
    try {
      setSoyAnfitrion(false);
      const res = await candadoOnlineService.joinRoom({
        codigo: limpio,
        jugador: { ...miPerfilSala, color: userActual?.avatarColor || '#4dabf7' },
      });
      setCodigoSala(limpio);
      setConfigSala(res.config);
      setJugadoresSala(res.jugadores);
      setMiJugadorId(1);
      setSubVista('espera');
    } catch (err: any) {
      setErrorLobby(err?.message || 'No se pudo entrar a la sala.');
    } finally {
      setOcupadoRed(false);
    }
  };

  const iniciarDueloComoAnfitrion = async () => {
    if (!soyAnfitrion || jugadoresSala.length < 2) return;
    if (usarSecretoManual && !validarSecretoOpcional(secretoManual, configSala)) {
      setErrorLobby(
        `Tu clave secreta manual debe tener ${configSala.digitos} dígitos${
          configSala.modo === 'logico' && !configSala.permitirRepetidos ? ' sin repetir' : ''
        }.`
      );
      return;
    }

    candadoAudio.playUnlock();
    const matchId = generarMatchIdCandado('cndp');
    const cfgFinal: ConfigDueloCandadoP2P = {
      ...normalizarConfigCandado(configSala),
      tiempoTurnoSeg: configSala.tiempoTurnoSeg,
    };

    candadoOnlineService.send({
      type: 'CANDADO_START',
      matchId,
      config: cfgFinal,
      startId: `st_${Date.now()}`,
    });

    await prepararDueloLocalmente(matchId, codigoSala, cfgFinal, 0, secretoManualRef.current);
  };

  const dispararErrorDuelo = useCallback((msg: string) => {
    candadoAudio.playError();
    setErrorDuelo(msg);
    setErrorShake(true);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setErrorShake(false);
      setErrorDuelo(null);
    }, 2200);
  }, []);

  const confirmadosEnHistorial = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    if (!duelo || duelo.config.modo !== 'logico') return set;
    for (const it of duelo.misIntentos as IntentoLogico[]) {
      for (const ev of it.digitos) {
        if (ev.estado === 'exacto') set.add(ev.digito);
      }
    }
    return set;
  }, [duelo]);

  const digitosUsadosEnEntrada = useMemo(
    () => new Set(entradaActual.filter((d) => d !== '')),
    [entradaActual]
  );

  const ingresarDigito = useCallback(
    (d: string) => {
      if (!duelo || duelo.fase !== 'jugando') return;
      if (modoNotas && duelo.config.modo === 'logico') {
        candadoAudio.playDialTick();
        setNotasDigitos((prev) => ({
          ...prev,
          [d]: prev[d] === 'descartado' ? 'neutro' : 'descartado',
        }));
        return;
      }
      if (duelo.turnoActual !== duelo.miJugadorId) {
        dispararErrorDuelo('Espera el turno de tu rival.');
        return;
      }
      if (
        duelo.config.modo === 'logico' &&
        !duelo.config.permitirRepetidos &&
        entradaActual.some((val, idx) => val === d && idx !== cursorIdx)
      ) {
        dispararErrorDuelo(`El ${d} ya está puesto (modo sin repetidos).`);
        return;
      }

      candadoAudio.playDigitInput();
      setErrorDuelo(null);
      setEntradaActual((prev) => {
        const next = [...prev];
        next[cursorIdx] = d;
        return next;
      });

      const len = duelo.config.digitos;
      let nextIdx = cursorIdx;
      for (let step = 1; step <= len; step++) {
        const cand = (cursorIdx + step) % len;
        if (cand > cursorIdx && entradaActual[cand] === '') {
          nextIdx = cand;
          break;
        }
      }
      if (nextIdx === cursorIdx && cursorIdx < len - 1) {
        nextIdx = cursorIdx + 1;
      }
      setCursorIdx(nextIdx);
    },
    [duelo, modoNotas, entradaActual, cursorIdx, dispararErrorDuelo]
  );

  const borrarDigito = useCallback(() => {
    if (!duelo || duelo.fase !== 'jugando') return;
    candadoAudio.playDelete();
    setErrorDuelo(null);
    if (entradaActual[cursorIdx] !== '') {
      setEntradaActual((prev) => {
        const next = [...prev];
        next[cursorIdx] = '';
        return next;
      });
    } else if (cursorIdx > 0) {
      const prevIdx = cursorIdx - 1;
      setCursorIdx(prevIdx);
      setEntradaActual((prev) => {
        const next = [...prev];
        next[prevIdx] = '';
        return next;
      });
    }
  }, [duelo, entradaActual, cursorIdx]);

  const limpiarEntrada = useCallback(() => {
    if (!duelo || duelo.fase !== 'jugando') return;
    candadoAudio.playDelete();
    setEntradaActual(new Array(duelo.config.digitos).fill(''));
    setCursorIdx(0);
    setErrorDuelo(null);
  }, [duelo]);

  const enviarIntentoP2P = useCallback(() => {
    if (!duelo || duelo.fase !== 'jugando') return;
    if (duelo.turnoActual !== duelo.miJugadorId) {
      dispararErrorDuelo('Espera tu turno para probar combinación.');
      return;
    }

    const entrada = entradaActual.join('');
    if (entrada.length !== duelo.config.digitos || entradaActual.some((x) => x === '')) {
      dispararErrorDuelo(`Completa los ${duelo.config.digitos} dígitos.`);
      return;
    }
    if (duelo.config.modo === 'logico' && !duelo.config.permitirRepetidos) {
      if (new Set(entrada.split('')).size !== duelo.config.digitos) {
        dispararErrorDuelo('Cada dígito debe ser diferente en modo únicos.');
        return;
      }
    }
    if (duelo.misIntentos.some((it) => it.entrada === entrada)) {
      dispararErrorDuelo(`Ya probaste ${entrada}.`);
      return;
    }

    candadoOnlineService.send({
      type: 'CANDADO_GUESS',
      matchId: duelo.matchId,
      jugadorId: duelo.miJugadorId,
      numeroIntento: duelo.misIntentos.length + 1,
      entrada,
      actionId: `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    });
  }, [duelo, entradaActual, dispararErrorDuelo]);

  // Teclado físico en duelo
  useEffect(() => {
    if (subVista !== 'duelo' || !duelo || duelo.fase !== 'jugando' || registroAmpliado) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        ingresarDigito(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        borrarDigito();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        limpiarEntrada();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        enviarIntentoP2P();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursorIdx((c) => Math.max(0, c - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCursorIdx((c) => Math.min(duelo.config.digitos - 1, c + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    subVista,
    duelo,
    registroAmpliado,
    ingresarDigito,
    borrarDigito,
    limpiarEntrada,
    enviarIntentoP2P,
  ]);

  const abandonarSala = async () => {
    await candadoOnlineService.leaveRoom();
    setDuelo(null);
    setJugadoresSala([]);
    setCodigoSala('');
    setSubVista('lobby');
  };

  const rendirseEnDuelo = () => {
    if (!duelo || duelo.fase !== 'jugando') return;
    candadoAudio.playLockFail();
    candadoOnlineService.send({
      type: 'CANDADO_SURRENDER',
      matchId: duelo.matchId,
      jugadorId: duelo.miJugadorId,
      nombre: miPerfilSala.nombre,
    });
    const rivalId: 0 | 1 = duelo.miJugadorId === 0 ? 1 : 0;
    const terminado: EstadoDueloP2P = {
      ...duelo,
      fase: 'terminada',
      ganadorId: rivalId,
      desenlaceParaMi: 'derrota',
      motivoFin: 'Te rendiste en el duelo.',
      finMs: Date.now(),
    };
    dueloRef.current = terminado;
    setDuelo(terminado);
    candadoOnlineService.setInMatch(false);
    candadoOnlineService.send({
      type: 'CANDADO_REVEAL',
      matchId: duelo.matchId,
      jugadorId: duelo.miJugadorId,
      secreto: duelo.miSecreto,
      sal: duelo.miSal,
    });
  };

  const renderListaIntentos = (
    lista: (IntentoLogico | IntentoMayorMenor)[],
    modo: ModoCandado,
    digitos: DigitosCandado,
    compacta: boolean,
    textoVacio: string
  ) => {
    if (lista.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-center px-3 text-xs opacity-70 font-bold">
          {textoVacio}
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        {lista.map((it) => {
          if (modo === 'logico') {
            const itemA = it as IntentoLogico;
            return (
              <div
                key={itemA.numero}
                className={
                  esMinimalista
                    ? 'px-2 py-1.5 rounded-xl bg-slate-800/75 border border-white/10 flex items-center justify-between gap-1.5'
                    : 'px-2 py-1.5 rounded-xl bg-white border-2 border-[#2b2140] flex items-center justify-between gap-1.5'
                }
              >
                <span className="text-[10px] font-black opacity-65 tabular-nums w-5 shrink-0">
                  #{itemA.numero}
                </span>
                <div className="flex flex-wrap items-center gap-1 flex-1 justify-center min-w-0">
                  {itemA.digitos.map((ev, idx) => (
                    <div
                      key={idx}
                      className={`${
                        digitos >= 8
                          ? compacta
                            ? 'w-5 h-5 text-[10px]'
                            : 'w-6 h-6 text-xs'
                          : compacta
                          ? 'w-6 h-6 text-[11px]'
                          : 'w-7 h-7 text-xs'
                      } rounded-lg flex flex-col items-center justify-center font-mono font-black tabular-nums border ${
                        ev.estado === 'exacto'
                          ? 'bg-[#51cf66] text-[#134e20] border-[#2b8a3e]'
                          : ev.estado === 'desubicado'
                          ? 'bg-[#ffd43b] text-[#5c3c00] border-[#e67700]'
                          : esMinimalista
                          ? 'bg-slate-900 text-slate-400 border-white/10'
                          : 'bg-[#f1f3f5] text-[#495057] border-[#adb5bd]'
                      }`}
                    >
                      <span className="leading-none">{ev.digito}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-black tabular-nums shrink-0 flex items-center gap-1">
                  <span className="text-[#2b8a3e]">{itemA.exactos}✓</span>
                  <span className="text-[#d9480f]">{itemA.desubicados}↔</span>
                </div>
              </div>
            );
          }

          const itemB = it as IntentoMayorMenor;
          return (
            <div
              key={itemB.numero}
              className={
                esMinimalista
                  ? 'px-2.5 py-1.5 rounded-xl bg-slate-800/75 border border-white/10 flex items-center justify-between gap-2'
                  : 'px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#2b2140] flex items-center justify-between gap-2'
              }
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-black opacity-65 tabular-nums">
                  #{itemB.numero}
                </span>
                <span className="font-mono font-black text-xs sm:text-sm tracking-wider tabular-nums">
                  {itemB.entrada}
                </span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-lg border text-[10px] font-black shrink-0 ${
                  itemB.direccion === 'exacto'
                    ? 'bg-[#d3f9d8] text-[#134e20] border-[#2b8a3e]'
                    : itemB.direccion === 'alto'
                    ? 'bg-[#e7f5ff] text-[#1864ab] border-[#339af0]'
                    : 'bg-[#fff4e6] text-[#d9480f] border-[#fd7e14]'
                }`}
              >
                {itemB.direccion === 'exacto'
                  ? '🔓 Exacto'
                  : itemB.direccion === 'alto'
                  ? '↑ Más alto'
                  : '↓ Más bajo'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // =========================================================================
  // SUBVISTA 1: LOBBY P2P (CREAR SALA / UNIRSE / SALAS PÚBLICAS DE CANDADO)
  // =========================================================================
  if (subVista === 'lobby') {
    const digitosDisponibles =
      configSala.modo === 'logico' ? DIGITOS_LOGICO : DIGITOS_MAYOR_MENOR;

    return (
      <main className="w-full max-w-4xl my-auto py-1.5 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-3">
        {/* Columna Izquierda: Crear Sala Candado */}
        <section
          className={
            esMinimalista
              ? 'rounded-3xl bg-slate-900/90 border border-white/15 p-4 shadow-2xl'
              : 'rounded-3xl bg-[#fff8e7] border-3 border-[#2b2140] p-4 shadow-[0_8px_0_#2b2140]'
          }
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-lg font-black flex items-center gap-1.5">
                <span>🌐</span>
                <span>Duelo P2P Candado</span>
              </h2>
              <p className="text-[11px] font-bold opacity-75">
                1v1 con sello anti-trampas SHA-256 · +{calcularPreviewPuntosP2P(configSala.digitos, 'victoria')} pts por victoria
              </p>
            </div>
            <button
              type="button"
              onClick={onVolverALocal}
              className={
                esMinimalista
                  ? 'px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold cursor-pointer'
                  : 'px-2.5 py-1 rounded-xl bg-white hover:bg-[#fff9db] border-2 border-[#2b2140] text-[11px] font-black cursor-pointer'
              }
            >
              ◀ Local
            </button>
          </div>

          {!userActual && (
            <div className="mb-2.5">
              <label className="block text-[10px] font-black uppercase tracking-wider opacity-75 mb-1">
                Tu apodo en sala
              </label>
              <input
                type="text"
                maxLength={15}
                value={nombreLocal}
                onChange={(e) => setNombreLocal(e.target.value)}
                className={
                  esMinimalista
                    ? 'w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-white/15 text-xs font-bold'
                    : 'w-full px-3 py-1.5 rounded-xl bg-white border-2 border-[#2b2140] text-xs font-black'
                }
                placeholder="Tu nombre"
              />
            </div>
          )}

          {/* Modo */}
          <div className="mb-2.5">
            <label className="block text-[10px] font-black uppercase tracking-wider opacity-75 mb-1">
              Mecánica del duelo
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'logico' as ModoCandado, icono: '🧠', titulo: 'Candado Lógico' },
                  { id: 'mayor_menor' as ModoCandado, icono: '🌡️', titulo: 'Mayor / Menor' },
                ]
              ).map((m) => {
                const activo = configSala.modo === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      candadoAudio.playDialTick();
                      setConfigSala((prev) => ({
                        ...normalizarConfigCandado({ ...prev, modo: m.id }),
                        tiempoTurnoSeg: prev.tiempoTurnoSeg,
                      }));
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                      activo
                        ? esMinimalista
                          ? 'bg-emerald-500/25 border-2 border-emerald-400 text-white'
                          : 'bg-[#d3f9d8] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-[#134e20]'
                        : esMinimalista
                        ? 'bg-slate-800/70 border border-white/10 text-slate-300'
                        : 'bg-white border-2 border-[#2b2140]/50 text-[#2b2140]'
                    }`}
                  >
                    {m.icono} {m.titulo}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dígitos */}
          <div className="mb-2.5">
            <label className="block text-[10px] font-black uppercase tracking-wider opacity-75 mb-1">
              Dígitos del candado
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
              {digitosDisponibles.map((num) => {
                const activo = configSala.digitos === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      candadoAudio.playDialTick();
                      setConfigSala((prev) => ({
                        ...normalizarConfigCandado({ ...prev, digitos: num }),
                        tiempoTurnoSeg: prev.tiempoTurnoSeg,
                      }));
                    }}
                    className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center cursor-pointer ${
                      activo
                        ? esMinimalista
                          ? 'bg-indigo-500/30 border-2 border-indigo-400 text-white'
                          : 'bg-[#ffd43b] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-[#2b2140]'
                        : esMinimalista
                        ? 'bg-slate-800/70 border border-white/10 text-slate-300'
                        : 'bg-white border-2 border-[#2b2140]/45 text-[#2b2140]'
                    }`}
                  >
                    <span className="text-xs font-black tabular-nums">{num}D</span>
                    <span className="text-[9px] leading-none">{ETIQUETAS_DIGITOS[num].icono}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tiempo por turno + Repetidos + Visibilidad */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider opacity-75 mb-1">
                Tiempo por turno
              </label>
              <div className="grid grid-cols-4 gap-1">
                {TIEMPOS_TURNO.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => {
                      candadoAudio.playDialTick();
                      setConfigSala((prev) => ({ ...prev, tiempoTurnoSeg: t.valor }));
                    }}
                    className={`py-1.5 rounded-lg text-[10px] font-black cursor-pointer ${
                      configSala.tiempoTurnoSeg === t.valor
                        ? esMinimalista
                          ? 'bg-cyan-500/30 border border-cyan-400 text-white'
                          : 'bg-[#a5d8ff] border-2 border-[#2b2140] text-[#1864ab]'
                        : esMinimalista
                        ? 'bg-slate-800 border border-white/10 text-slate-300'
                        : 'bg-white border border-[#2b2140]/50'
                    }`}
                  >
                    {t.texto}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider opacity-75 mb-1">
                Visibilidad
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setSalaPublica(true)}
                  className={`py-1.5 rounded-lg text-[10px] font-black cursor-pointer ${
                    salaPublica
                      ? esMinimalista
                        ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-200'
                        : 'bg-[#d3f9d8] border-2 border-[#2b2140] text-[#134e20]'
                      : esMinimalista
                      ? 'bg-slate-800 border border-white/10 text-slate-400'
                      : 'bg-white border border-[#2b2140]/50'
                  }`}
                >
                  🌐 Pública
                </button>
                <button
                  type="button"
                  onClick={() => setSalaPublica(false)}
                  className={`py-1.5 rounded-lg text-[10px] font-black cursor-pointer ${
                    !salaPublica
                      ? esMinimalista
                        ? 'bg-amber-500/25 border border-amber-400 text-amber-200'
                        : 'bg-[#fff3bf] border-2 border-[#2b2140] text-[#5c3c00]'
                      : esMinimalista
                      ? 'bg-slate-800 border border-white/10 text-slate-400'
                      : 'bg-white border border-[#2b2140]/50'
                  }`}
                >
                  🔒 Privada
                </button>
              </div>
            </div>
          </div>

          {configSala.modo === 'logico' && configSala.digitos <= 10 && (
            <button
              type="button"
              onClick={() =>
                setConfigSala((prev) => ({
                  ...prev,
                  permitirRepetidos: !prev.permitirRepetidos,
                }))
              }
              className={`w-full mb-3 px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-black cursor-pointer ${
                esMinimalista
                  ? 'bg-slate-800/80 border border-white/15'
                  : 'bg-white border-2 border-[#2b2140]'
              }`}
            >
              <span>
                {configSala.permitirRepetidos
                  ? '🔁 Dígitos repetidos permitidos'
                  : '✨ Dígitos únicos sin repetir'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#ffd43b] text-[#2b2140] text-[10px]">
                {configSala.permitirRepetidos ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={ocupadoRed}
            onClick={crearSalaCandado}
            className={
              esMinimalista
                ? 'w-full min-h-[42px] py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-sm cursor-pointer'
                : 'w-full min-h-[42px] py-2 rounded-2xl bg-[#51cf66] hover:bg-[#40c057] disabled:opacity-50 text-[#134e20] border-2 border-[#2b2140] shadow-[0_4px_0_#2b2140] active:translate-y-0.5 font-black text-sm cursor-pointer'
            }
          >
            {ocupadoRed ? 'Creando sala...' : '🔓 Crear Sala Candado 1v1'}
          </button>
        </section>

        {/* Columna Derecha: Código + Salas Públicas */}
        <section
          className={
            esMinimalista
              ? 'rounded-3xl bg-slate-900/90 border border-white/15 p-4 shadow-2xl flex flex-col'
              : 'rounded-3xl bg-[#fff8e7] border-3 border-[#2b2140] p-4 shadow-[0_8px_0_#2b2140] flex flex-col'
          }
        >
          <h3 className="text-sm font-black mb-2 flex items-center gap-1.5">
            <span>🎟️</span>
            <span>Unirse por código</span>
          </h3>
          <div className="flex gap-1.5 mb-3">
            <input
              type="text"
              maxLength={8}
              value={codigoEntrada}
              onChange={(e) => setCodigoEntrada(e.target.value.toUpperCase())}
              placeholder="Ej: A7K9B2"
              className={
                esMinimalista
                  ? 'flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-white/15 font-mono font-black text-sm tracking-widest uppercase'
                  : 'flex-1 px-3 py-2 rounded-xl bg-white border-2 border-[#2b2140] font-mono font-black text-sm tracking-widest uppercase'
              }
            />
            <button
              type="button"
              disabled={ocupadoRed}
              onClick={() => unirseASalaCandado(codigoEntrada)}
              className={
                esMinimalista
                  ? 'px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs cursor-pointer'
                  : 'px-4 py-2 rounded-xl bg-[#4dabf7] hover:bg-[#339af0] text-white border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black text-xs cursor-pointer'
              }
            >
              Entrar
            </button>
          </div>

          {errorLobby && (
            <div className="mb-2.5 px-3 py-2 rounded-xl bg-[#ffe3e3] border-2 border-[#c92a2a] text-[#c92a2a] text-xs font-black">
              ⚠️ {errorLobby}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-black flex items-center gap-1.5">
              <span>📡</span>
              <span>Salas Candado ({salasPublicas.length})</span>
            </h3>
            <button
              type="button"
              onClick={cargarSalasPublicas}
              className={
                esMinimalista
                  ? 'px-2 py-0.5 rounded-lg bg-slate-800 text-[10px] font-bold cursor-pointer'
                  : 'px-2 py-0.5 rounded-lg bg-white border border-[#2b2140] text-[10px] font-black cursor-pointer'
              }
            >
              {cargandoSalas ? '...' : '🔄 Actualizar'}
            </button>
          </div>

          {/* Filtro por dígitos */}
          <div className="flex flex-wrap gap-1 mb-2">
            {([0, 4, 5, 6, 8, 10, 14, 16] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFiltroDigitosSalas(d)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                  filtroDigitosSalas === d
                    ? 'bg-[#ffd43b] text-[#2b2140] border border-[#2b2140]'
                    : esMinimalista
                    ? 'bg-slate-800 text-slate-300 border border-white/10'
                    : 'bg-white border border-[#2b2140]/40'
                }`}
              >
                {d === 0 ? 'Todas' : `${d}D`}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-[160px] max-h-[250px] overflow-y-auto space-y-1.5 pr-0.5">
            {salasPublicas.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-center text-xs opacity-65 font-bold px-4">
                No hay salas públicas de Candado abiertas ahora. ¡Crea una arriba!
              </div>
            ) : (
              salasPublicas.map((s) => (
                <div
                  key={s.codigo}
                  className={
                    esMinimalista
                      ? 'p-2.5 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-between gap-2'
                      : 'p-2.5 rounded-2xl bg-white border-2 border-[#2b2140] flex items-center justify-between gap-2'
                  }
                >
                  <div className="min-w-0">
                    <div className="font-black text-xs truncate">
                      {s.modoCandado === 'mayor_menor' ? '🌡️' : '🧠'} {s.anfitrion} ·{' '}
                      <span className="font-mono text-[#1864ab] dark:text-cyan-300">{s.codigo}</span>
                    </div>
                    <div className="text-[10px] font-bold opacity-75">
                      {s.digitosCandado} dígitos · {s.tiempoTurnoSeg > 0 ? `${s.tiempoTurnoSeg}s/turno` : 'Sin reloj'}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={ocupadoRed}
                    onClick={() => unirseASalaCandado(s.codigo)}
                    className={
                      esMinimalista
                        ? 'px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shrink-0'
                        : 'px-3 py-1.5 rounded-xl bg-[#51cf66] hover:bg-[#40c057] text-[#134e20] border-2 border-[#2b2140] font-black text-xs cursor-pointer shrink-0'
                    }
                  >
                    Unirme
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    );
  }

  // =========================================================================
  // SUBVISTA 2: SALA DE ESPERA (SELECCIÓN OPCIONAL DE CLAVE + LISTO)
  // =========================================================================
  if (subVista === 'espera') {
    const rivalEnSala = jugadoresSala.find((j) => j.id !== miJugadorId) || null;
    const puedeIniciar = soyAnfitrion && jugadoresSala.length >= 2;
    const infoMetal = ETIQUETAS_DIGITOS[configSala.digitos];

    return (
      <main className="w-full max-w-xl my-auto py-2">
        <div
          className={
            esMinimalista
              ? 'rounded-3xl bg-slate-900/90 border border-white/15 p-4 sm:p-5 shadow-2xl'
              : 'rounded-3xl bg-[#fff8e7] border-3 border-[#2b2140] p-4 sm:p-5 shadow-[0_8px_0_#2b2140]'
          }
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                Sala Candado {salaPublica ? 'Pública' : 'Privada'} ·{' '}
                {modoConexion === 'webrtc' ? '⚡ P2P Directo' : '🔄 Enlace Estable'}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-2xl font-black tracking-widest">
                  {codigoSala}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(codigoSala).catch(() => {});
                    setCopiadoCodigo(true);
                    window.setTimeout(() => setCopiadoCodigo(false), 1800);
                  }}
                  className={
                    esMinimalista
                      ? 'px-2 py-0.5 rounded-lg bg-slate-800 border border-white/15 text-[10px] font-bold cursor-pointer'
                      : 'px-2 py-0.5 rounded-lg bg-white border-2 border-[#2b2140] text-[10px] font-black cursor-pointer'
                  }
                >
                  {copiadoCodigo ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={abandonarSala}
              className="px-3 py-1.5 rounded-xl bg-[#ffe3e3] border-2 border-[#c92a2a] text-[#c92a2a] font-black text-xs cursor-pointer"
            >
              Salir
            </button>
          </div>

          <div
            className={
              esMinimalista
                ? 'p-2.5 rounded-2xl bg-slate-800/70 border border-white/10 text-xs font-bold mb-3 flex items-center justify-between'
                : 'p-2.5 rounded-2xl bg-white border-2 border-[#2b2140] text-xs font-black mb-3 flex items-center justify-between'
            }
          >
            <span>
              {configSala.modo === 'logico' ? '🧠 Candado Lógico' : '🌡️ Mayor / Menor'} ·{' '}
              {infoMetal.icono} {configSala.digitos}D
            </span>
            <span className="opacity-80">
              {configSala.tiempoTurnoSeg > 0 ? `⏱️ ${configSala.tiempoTurnoSeg}s/turno` : '⏱️ Sin límite'}
            </span>
          </div>

          {/* Tarjetas de ambos jugadores */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {[0, 1].map((slotId) => {
              const p = jugadoresSala.find((j) => j.id === slotId);
              return (
                <div
                  key={slotId}
                  className={`p-3 rounded-2xl flex flex-col items-center text-center ${
                    p
                      ? esMinimalista
                        ? 'bg-slate-800 border border-white/15'
                        : 'bg-white border-2 border-[#2b2140]'
                      : esMinimalista
                      ? 'bg-slate-800/35 border border-dashed border-white/15 opacity-70'
                      : 'bg-white/50 border-2 border-dashed border-[#2b2140]/40 opacity-75'
                  }`}
                >
                  {p ? (
                    <>
                      <CartoonCharacter
                        color={p.color || '#ff6b6b'}
                        hat={(p.hat || 'corona') as AvatarTipoDeGorro}
                        ropa={(p.ropa || 'ninguna') as AvatarTipoDeRopa}
                        ropaColor={p.ropaColor}
                        aura={(p.aura || 'ninguna') as AvatarTipoDeAura}
                        size={48}
                      />
                      <span className="font-black text-xs mt-1 truncate max-w-full">
                        {p.nombre}
                      </span>
                      <span className="text-[10px] font-bold opacity-70">
                        {p.esAnfitrion ? '👑 Anfitrión' : '⚡ Retador'}
                      </span>
                    </>
                  ) : (
                    <div className="h-[74px] flex flex-col items-center justify-center">
                      <span className="text-xl mb-1 animate-pulse">⏳</span>
                      <span className="text-[11px] font-bold">Esperando rival...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Opción de Clave Secreta propia (Automática o Manual) */}
          <div
            className={
              esMinimalista
                ? 'p-3 rounded-2xl bg-slate-800/60 border border-white/10 mb-3'
                : 'p-3 rounded-2xl bg-white border-2 border-[#2b2140] mb-3'
            }
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-black">🔑 Tu clave secreta a defender</span>
              <button
                type="button"
                onClick={() => setUsarSecretoManual((v) => !v)}
                className="px-2 py-0.5 rounded-lg bg-[#ffd43b] text-[#2b2140] border border-[#2b2140] text-[10px] font-black cursor-pointer"
              >
                {usarSecretoManual ? '✏️ Manual' : '🎲 Aleatoria'}
              </button>
            </div>
            {usarSecretoManual ? (
              <input
                type="text"
                inputMode="numeric"
                maxLength={configSala.digitos}
                value={secretoManual}
                onChange={(e) => setSecretoManual(e.target.value.replace(/\D/g, ''))}
                placeholder={`Escribe ${configSala.digitos} dígitos${
                  configSala.modo === 'logico' && !configSala.permitirRepetidos
                    ? ' únicos'
                    : ''
                }`}
                className={
                  esMinimalista
                    ? 'w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-white/15 font-mono font-black text-sm tracking-widest'
                    : 'w-full px-3 py-1.5 rounded-xl bg-[#fff8e7] border-2 border-[#2b2140] font-mono font-black text-sm tracking-widest'
                }
              />
            ) : (
              <p className="text-[11px] opacity-75 font-semibold">
                Se generará automáticamente y se sellará con SHA-256 al iniciar el duelo.
              </p>
            )}
          </div>

          {errorLobby && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-[#ffe3e3] border-2 border-[#c92a2a] text-[#c92a2a] text-xs font-black">
              ⚠️ {errorLobby}
            </div>
          )}

          {soyAnfitrion ? (
            <button
              type="button"
              disabled={!puedeIniciar}
              onClick={iniciarDueloComoAnfitrion}
              className={
                esMinimalista
                  ? 'w-full min-h-[44px] py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 font-black text-sm cursor-pointer'
                  : 'w-full min-h-[44px] py-2.5 rounded-2xl bg-[#51cf66] hover:bg-[#40c057] disabled:opacity-45 text-[#134e20] border-2 border-[#2b2140] shadow-[0_4px_0_#2b2140] font-black text-sm cursor-pointer'
              }
            >
              {rivalEnSala
                ? '🚀 Iniciar Duelo Candado'
                : '⏳ Esperando al segundo jugador...'}
            </button>
          ) : (
            <div className="w-full py-2.5 rounded-2xl text-center text-xs font-black bg-black/5">
              ⏳ Esperando a que el anfitrión inicie el duelo...
            </div>
          )}
        </div>
      </main>
    );
  }

  // =========================================================================
  // SUBVISTA 3: DUELO P2P ACTIVO Y VERIFICACIÓN FINAL
  // =========================================================================
  if (!duelo) return null;

  const yoJugador = jugadoresSala.find((j) => j.id === duelo.miJugadorId);
  const rivalJugador = jugadoresSala.find((j) => j.id !== duelo.miJugadorId);
  const esMiTurno = duelo.fase === 'jugando' && duelo.turnoActual === duelo.miJugadorId;

  return (
    <main className="w-full max-w-4xl flex flex-col gap-2 mt-0.5">
      {/* Cabecera de estado del duelo P2P (altura compacta fija) */}
      <div
        className={
          esMinimalista
            ? 'w-full rounded-2xl bg-slate-900/90 border border-white/15 px-3 py-2 flex flex-wrap items-center justify-between gap-2'
            : 'w-full rounded-2xl bg-[#fff8e7] border-3 border-[#2b2140] px-3 py-2 shadow-[0_4px_0_#2b2140] flex flex-wrap items-center justify-between gap-2'
        }
      >
        {/* Avatares y turno */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border ${
              esMiTurno
                ? esMinimalista
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-[#d3f9d8] border-[#2b2140] text-[#134e20]'
                : 'border-transparent opacity-80'
            }`}
          >
            <CartoonCharacter
              color={yoJugador?.color || miPerfilSala.color}
              hat={(yoJugador?.hat || miPerfilSala.hat) as AvatarTipoDeGorro}
              ropa={(yoJugador?.ropa || 'ninguna') as AvatarTipoDeRopa}
              size={28}
            />
            <div className="leading-none">
              <span className="text-[11px] font-black block">
                {yoJugador?.nombre || miPerfilSala.nombre}
              </span>
              <span className="text-[9px] font-bold opacity-75">
                {reaccionMia ? reaccionMia : esMiTurno ? '▶ Tu turno' : 'Tú'}
              </span>
            </div>
          </div>

          <span className="text-xs font-black opacity-50">VS</span>

          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border ${
              duelo.fase === 'jugando' && !esMiTurno
                ? esMinimalista
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-[#fff3bf] border-[#2b2140] text-[#5c3c00]'
                : 'border-transparent opacity-80'
            }`}
          >
            <CartoonCharacter
              color={rivalJugador?.color || '#4dabf7'}
              hat={(rivalJugador?.hat || 'pompon') as AvatarTipoDeGorro}
              ropa={(rivalJugador?.ropa || 'ninguna') as AvatarTipoDeRopa}
              size={28}
            />
            <div className="leading-none">
              <span className="text-[11px] font-black block">
                {rivalJugador?.nombre || 'Rival'}
              </span>
              <span className="text-[9px] font-bold opacity-75">
                {reaccionRival
                  ? reaccionRival
                  : duelo.fase === 'jugando' && !esMiTurno
                  ? '▶ Pensando...'
                  : 'Rival'}
              </span>
            </div>
          </div>
        </div>

        {/* Reloj + Commit badge + Reacciones + Rendirse */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2 py-1 rounded-xl text-[10px] font-black tabular-nums ${
              duelo.config.tiempoTurnoSeg > 0 && duelo.tiempoRestanteTurno <= 8 && duelo.fase === 'jugando'
                ? 'bg-[#ffe3e3] text-[#c92a2a] border border-[#c92a2a] animate-pulse'
                : esMinimalista
                ? 'bg-slate-800 text-slate-200 border border-white/10'
                : 'bg-white text-[#2b2140] border border-[#2b2140]'
            }`}
          >
            ⏱️{' '}
            {duelo.config.tiempoTurnoSeg > 0
              ? `${duelo.tiempoRestanteTurno}s`
              : 'Libre'}
          </span>

          <span
            title={`Commit rival SHA-256: ${duelo.rivalCommitHash || 'esperando'}`}
            className={
              esMinimalista
                ? 'px-2 py-1 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold'
                : 'px-2 py-1 rounded-xl bg-[#e7f5ff] text-[#1864ab] border border-[#339af0] text-[10px] font-black'
            }
          >
            {duelo.rivalCommitHash ? '🛡️ SHA-256' : '⏳ Sellando'}
          </span>

          <div className="hidden sm:flex items-center gap-0.5 bg-black/5 rounded-xl px-1 py-0.5">
            {REACCIONES_RAPIDAS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => {
                  candadoOnlineService.send({
                    type: 'CANDADO_REACTION',
                    jugadorId: duelo.miJugadorId,
                    emoji: em,
                  });
                  setReaccionMia(em);
                  window.setTimeout(() => setReaccionMia(null), 2200);
                }}
                className="w-6 h-6 rounded-lg hover:bg-black/10 text-xs cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>

          {duelo.fase === 'jugando' ? (
            <button
              type="button"
              onClick={rendirseEnDuelo}
              className="px-2 py-1 rounded-xl bg-[#ffe3e3] border border-[#c92a2a] text-[#c92a2a] text-[10px] font-black cursor-pointer"
            >
              🏳️ Rendirse
            </button>
          ) : (
            <button
              type="button"
              onClick={abandonarSala}
              className={
                esMinimalista
                  ? 'px-2 py-1 rounded-xl bg-slate-800 border border-white/15 text-[10px] font-bold cursor-pointer'
                  : 'px-2 py-1 rounded-xl bg-white border border-[#2b2140] text-[10px] font-black cursor-pointer'
              }
            >
              Salir
            </button>
          )}
        </div>
      </div>

      {avisoDesconexionSeg !== null && duelo.fase === 'jugando' && (
        <div className="w-full px-3 py-1.5 rounded-xl bg-[#fff3bf] border-2 border-[#e67700] text-[#5c3c00] text-xs font-black text-center">
          ⚠️ El rival perdió señal — esperando reconexión ({avisoDesconexionSeg}s)...
        </div>
      )}

      {duelo.turnoIgualadorPendiente && duelo.fase === 'jugando' && (
        <div className="w-full px-3 py-1.5 rounded-xl bg-[#ffd43b] border-2 border-[#2b2140] text-[#2b2140] text-xs font-black text-center">
          ⚖️ ¡Última oportunidad igualadora!{' '}
          {duelo.miJugadorId === 1
            ? 'Descifra ahora para empatar el duelo.'
            : 'Tu rival tiene su intento igualador de esta ronda.'}
        </div>
      )}

      {/* Cuerpo del duelo: 2 columnas fijas en desktop */}
      <div className="w-full flex flex-col md:grid md:grid-cols-[minmax(0,390px)_minmax(0,1fr)] items-center md:items-start gap-2.5 sm:gap-4">
        {/* Columna izquierda: Bóveda rival + franja fija + teclado / resumen */}
        <section className="w-full max-w-[400px] flex flex-col items-center gap-2">
          <CandadoVault
            digitos={duelo.config.digitos}
            entradaActual={
              duelo.fase === 'terminada' && duelo.rivalSecretoRevelado
                ? duelo.rivalSecretoRevelado.split('')
                : entradaActual
            }
            cursorIdx={cursorIdx}
            onSelectSlot={(idx) => {
              candadoAudio.playDialTick();
              setCursorIdx(idx);
            }}
            fase={
              duelo.fase === 'terminada'
                ? duelo.desenlaceParaMi === 'derrota'
                  ? 'perdida'
                  : 'ganada'
                : 'jugando'
            }
            modo={duelo.config.modo}
            intentosUsados={duelo.misIntentos.length}
            maxIntentos={duelo.config.maxIntentos}
            tiempoSegundos={Math.floor(((duelo.finMs || Date.now()) - duelo.inicioMs) / 1000)}
            errorShake={errorShake}
            esMinimalista={esMinimalista}
            animacionesReducidas={animacionesReducidas}
          />

          {/* Franja de altura fija */}
          <div className="w-full h-7 flex items-center justify-center">
            {errorDuelo ? (
              <div className="w-full h-7 px-2.5 rounded-xl bg-[#ffe3e3] border-2 border-[#c92a2a] text-[#c92a2a] text-[11px] font-black flex items-center justify-center truncate">
                ⚠️ {errorDuelo}
              </div>
            ) : duelo.fase === 'preparando_claves' ? (
              <div className="w-full h-7 px-2.5 rounded-xl bg-[#e7f5ff] border border-[#339af0] text-[#1864ab] text-[11px] font-black flex items-center justify-center">
                🔐 Intercambiando sellos criptográficos...
              </div>
            ) : duelo.config.modo === 'mayor_menor' && duelo.fase === 'jugando' ? (
              <div
                className={
                  esMinimalista
                    ? 'w-full h-7 px-2.5 rounded-xl bg-slate-900/80 border border-white/15 text-[11px] font-semibold text-slate-300 flex items-center justify-between tabular-nums'
                    : 'w-full h-7 px-2.5 rounded-xl bg-white/90 border-2 border-[#2b2140] text-[11px] font-black text-[#2b2140] flex items-center justify-between tabular-nums'
                }
              >
                <span>🎯 Rango del rival:</span>
                <span className="font-mono">
                  {formatearNumeroConCeros(duelo.miRangoMin, duelo.config.digitos)} —{' '}
                  {formatearNumeroConCeros(duelo.miRangoMax, duelo.config.digitos)}
                </span>
              </div>
            ) : (
              <div
                className={
                  esMinimalista
                    ? 'w-full h-7 px-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-[11px] font-semibold text-slate-300 flex items-center justify-center'
                    : 'w-full h-7 px-2.5 rounded-xl bg-white/80 border border-[#2b2140]/35 text-[11px] font-extrabold text-[#593922] flex items-center justify-center'
                }
              >
                {esMiTurno
                  ? '🟢 Es tu turno — descifra el candado rival'
                  : '⏳ Turno del rival...'}
              </div>
            )}
          </div>

          {duelo.fase === 'terminada' ? (
            <div
              className={`w-full rounded-2xl p-3.5 text-center ${
                duelo.desenlaceParaMi === 'victoria'
                  ? esMinimalista
                    ? 'bg-emerald-950/75 border border-emerald-400/50 text-emerald-100'
                    : 'bg-[#d3f9d8] border-3 border-[#2b2140] shadow-[0_5px_0_#2b2140] text-[#134e20]'
                  : duelo.desenlaceParaMi === 'empate'
                  ? esMinimalista
                    ? 'bg-amber-950/75 border border-amber-400/50 text-amber-100'
                    : 'bg-[#fff3bf] border-3 border-[#2b2140] shadow-[0_5px_0_#2b2140] text-[#5c3c00]'
                  : esMinimalista
                  ? 'bg-rose-950/75 border border-rose-400/50 text-rose-100'
                  : 'bg-[#ffe3e3] border-3 border-[#2b2140] shadow-[0_5px_0_#2b2140] text-[#c92a2a]'
              }`}
            >
              <div className="text-2xl">
                {duelo.desenlaceParaMi === 'victoria'
                  ? '🏆🔓'
                  : duelo.desenlaceParaMi === 'empate'
                  ? '🤝🔐'
                  : '🔒😔'}
              </div>
              <h2 className="text-base font-black">
                {duelo.desenlaceParaMi === 'victoria'
                  ? '¡Victoria en Duelo!'
                  : duelo.desenlaceParaMi === 'empate'
                  ? '¡Empate Justo!'
                  : 'Duelo Perdido'}
              </h2>
              {duelo.motivoFin && (
                <p className="text-[11px] font-bold opacity-90 mt-0.5">{duelo.motivoFin}</p>
              )}

              {/* Verificación Anti-trampas Commit-Reveal */}
              <div className="mt-2 p-2 rounded-xl bg-black/10 text-[11px] font-bold space-y-0.5">
                <div>
                  Clave rival:{' '}
                  <span className="font-mono font-black">
                    {duelo.rivalSecretoRevelado || '—'}
                  </span>{' '}
                  · Tu clave: <span className="font-mono font-black">{duelo.miSecreto}</span>
                </div>
                {duelo.verificacionRival && (
                  <div
                    className={
                      duelo.verificacionRival.verificado
                        ? 'text-emerald-700 dark:text-emerald-300 font-black'
                        : 'text-rose-700 dark:text-rose-300 font-black'
                    }
                  >
                    {duelo.verificacionRival.verificado
                      ? '✓ Commit SHA-256 y pistas verificados (Juego Limpio)'
                      : `⚠️ ${duelo.verificacionRival.motivo || 'Fallo de verificación'}`}
                  </div>
                )}
              </div>

              {/* Puntos ganados */}
              <div className="mt-2 text-xs font-black">
                {resumenPuntos.estado === 'acreditado' && (
                  <span className="px-2.5 py-1 rounded-xl bg-white/80 text-[#134e20] border border-[#2b2140] inline-block">
                    ⭐ +{resumenPuntos.puntosOtorgados} pts acreditados
                  </span>
                )}
                {resumenPuntos.estado === 'pendiente_consenso' && (
                  <span className="opacity-85">⏳ {resumenPuntos.mensaje}</span>
                )}
                {resumenPuntos.estado === 'enviando' && <span>⏳ Registrando puntos...</span>}
                {(resumenPuntos.estado === 'cupo_agotado' ||
                  resumenPuntos.estado === 'invitado' ||
                  resumenPuntos.estado === 'conflicto' ||
                  resumenPuntos.estado === 'error') && (
                  <span className="text-[11px] opacity-85">{resumenPuntos.mensaje}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                {!rivalSalioSala && revanchaEstado !== 'rechazada' ? (
                  <button
                    type="button"
                    disabled={revanchaEstado === 'enviada'}
                    onClick={() => {
                      if (revanchaEstado === 'recibida') {
                        candadoOnlineService.send({
                          type: 'CANDADO_REMATCH_RESPONSE',
                          jugadorId: duelo.miJugadorId,
                          nombre: miPerfilSala.nombre,
                          aceptada: true,
                        });
                        if (soyAnfitrion) {
                          const newMatch = generarMatchIdCandado('cndp');
                          candadoOnlineService.send({
                            type: 'CANDADO_START',
                            matchId: newMatch,
                            config: duelo.config,
                            startId: `rm_${Date.now()}`,
                          });
                          prepararDueloLocalmente(
                            newMatch,
                            duelo.codigoSala,
                            duelo.config,
                            duelo.miJugadorId,
                            secretoManualRef.current
                          );
                        }
                      } else {
                        setRevanchaEstado('enviada');
                        candadoOnlineService.send({
                          type: 'CANDADO_REMATCH_REQUEST',
                          jugadorId: duelo.miJugadorId,
                          nombre: miPerfilSala.nombre,
                        });
                      }
                    }}
                    className={
                      esMinimalista
                        ? 'min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-black text-xs cursor-pointer'
                        : 'min-h-[38px] rounded-xl bg-[#51cf66] hover:bg-[#40c057] disabled:opacity-60 text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black text-xs cursor-pointer'
                    }
                  >
                    {revanchaEstado === 'recibida'
                      ? '✅ Aceptar Revancha'
                      : revanchaEstado === 'enviada'
                      ? '⏳ Esperando...'
                      : '🔄 Revancha'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={abandonarSala}
                    className={
                      esMinimalista
                        ? 'min-h-[38px] rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs cursor-pointer'
                        : 'min-h-[38px] rounded-xl bg-[#4dabf7] hover:bg-[#339af0] text-white border-2 border-[#2b2140] font-black text-xs cursor-pointer'
                    }
                  >
                    🌐 Buscar otro rival
                  </button>
                )}

                <button
                  type="button"
                  onClick={abandonarSala}
                  className={
                    esMinimalista
                      ? 'min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/15 font-bold text-xs cursor-pointer'
                      : 'min-h-[38px] rounded-xl bg-white hover:bg-[#fff9db] text-[#2b2140] border-2 border-[#2b2140] font-black text-xs cursor-pointer'
                  }
                >
                  🏛️ Salas Online
                </button>
              </div>
            </div>
          ) : (
            <div
              className={
                esMinimalista
                  ? 'w-full rounded-2xl bg-slate-900/90 border border-white/15 p-2.5 shadow-xl'
                  : 'w-full rounded-2xl bg-[#fff8e7] border-3 border-[#2b2140] p-2.5 shadow-[0_5px_0_#2b2140]'
              }
            >
              {duelo.config.modo === 'logico' && (
                <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                  <span className="text-[10px] font-bold opacity-75">
                    {modoNotas
                      ? 'Toca números para tachar / destachar'
                      : 'Teclado (0–9)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      candadoAudio.playDialTick();
                      setModoNotas((v) => !v);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                      modoNotas
                        ? 'bg-[#ffd43b] text-[#2b2140] border border-[#2b2140]'
                        : esMinimalista
                        ? 'bg-slate-800 text-slate-300 border border-white/10'
                        : 'bg-white text-[#2b2140] border border-[#2b2140]/60'
                    }`}
                  >
                    {modoNotas ? '✏️ Tachar: ON' : '✏️ Tachar'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-5 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => {
                  const nota = notasDigitos[d] || 'neutro';
                  const esExacto = duelo.config.modo === 'logico' && confirmadosEnHistorial.has(d);
                  const yaEnSlot =
                    duelo.config.modo === 'logico' &&
                    !duelo.config.permitirRepetidos &&
                    digitosUsadosEnEntrada.has(d);

                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => ingresarDigito(d)}
                      className={`h-10 sm:h-11 rounded-xl font-mono font-black text-base tabular-nums transition-colors cursor-pointer active:translate-y-0.5 ${
                        nota === 'descartado'
                          ? esMinimalista
                            ? 'bg-slate-950/80 text-slate-600 border border-white/5 line-through'
                            : 'bg-[#dee2e6] text-[#868e96] border-2 border-[#adb5bd] line-through'
                          : esExacto
                          ? esMinimalista
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                            : 'bg-[#d3f9d8] hover:bg-[#b2f2bb] text-[#134e20] border-2 border-[#40c057] shadow-[0_2px_0_#2b2140]'
                          : yaEnSlot
                          ? esMinimalista
                            ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50'
                            : 'bg-[#e7f5ff] text-[#1864ab] border-2 border-[#339af0]'
                          : esMinimalista
                          ? 'bg-slate-800 hover:bg-slate-700 text-white border border-white/15'
                          : 'bg-white hover:bg-[#fff9db] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-4 gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={borrarDigito}
                  className={
                    esMinimalista
                      ? 'h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-xs cursor-pointer'
                      : 'h-10 rounded-xl bg-white hover:bg-[#ffe3e3] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black text-xs cursor-pointer'
                  }
                >
                  ⌫ Borrar
                </button>
                <button
                  type="button"
                  onClick={limpiarEntrada}
                  className={
                    esMinimalista
                      ? 'h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-xs cursor-pointer'
                      : 'h-10 rounded-xl bg-white hover:bg-[#fff9db] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black text-xs cursor-pointer'
                  }
                >
                  🧹 Limpiar
                </button>
                <button
                  type="button"
                  disabled={!esMiTurno}
                  onClick={enviarIntentoP2P}
                  className={
                    esMinimalista
                      ? 'col-span-2 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 font-black text-xs sm:text-sm cursor-pointer'
                      : 'col-span-2 h-10 rounded-xl bg-[#51cf66] hover:bg-[#40c057] disabled:opacity-45 text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black text-xs sm:text-sm cursor-pointer'
                  }
                >
                  {esMiTurno ? '🔓 Enviar Ataque' : '⏳ Espera Turno'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Columna derecha: Historial Dual con ALTURA FIJA */}
        <aside
          className={
            esMinimalista
              ? 'w-full max-w-[390px] md:max-w-none h-[210px] md:h-[410px] rounded-2xl bg-slate-900/90 border border-white/15 p-3 shadow-xl flex flex-col overflow-hidden'
              : 'w-full max-w-[390px] md:max-w-none h-[210px] md:h-[410px] rounded-2xl bg-[#fff8e7] border-3 border-[#2b2140] p-3 shadow-[0_5px_0_#2b2140] flex flex-col overflow-hidden'
          }
        >
          {/* Pestañas: Mis Ataques vs Mi Bóveda (defensa) */}
          <div className="flex items-center justify-between gap-1.5 pb-2 mb-1.5 border-b border-current/15 shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTabHistorial('mios')}
                className={`px-2 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                  tabHistorial === 'mios'
                    ? 'bg-[#ffd43b] text-[#2b2140] border border-[#2b2140]'
                    : esMinimalista
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-white text-[#2b2140]/75'
                }`}
              >
                🎯 Mis Ataques ({duelo.misIntentos.length})
              </button>
              <button
                type="button"
                onClick={() => setTabHistorial('rival')}
                className={`px-2 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                  tabHistorial === 'rival'
                    ? 'bg-[#a5d8ff] text-[#1864ab] border border-[#2b2140]'
                    : esMinimalista
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-white text-[#2b2140]/75'
                }`}
              >
                🛡️ Mi Bóveda ({duelo.intentosRival.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRegistroAmpliado(true)}
              className={
                esMinimalista
                  ? 'px-2 py-1 rounded-lg bg-slate-800 text-[10px] font-bold cursor-pointer'
                  : 'px-2 py-1 rounded-lg bg-white border border-[#2b2140] text-[10px] font-black cursor-pointer'
              }
            >
              ⤢
            </button>
          </div>

          {tabHistorial === 'rival' && (
            <div
              className={
                esMinimalista
                  ? 'mb-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-between text-[11px] shrink-0'
                  : 'mb-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#2b2140] flex items-center justify-between text-[11px] shrink-0'
              }
            >
              <span className="font-bold">
                Tu clave:{' '}
                <span className="font-mono font-black tracking-widest">
                  {secretoVisibleMiBoveda
                    ? duelo.miSecreto
                    : '•'.repeat(duelo.config.digitos)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSecretoVisibleMiBoveda((v) => !v)}
                className="text-[10px] font-black underline cursor-pointer"
              >
                {secretoVisibleMiBoveda ? 'Ocultar' : '👁️ Ver'}
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {tabHistorial === 'mios'
              ? renderListaIntentos(
                  duelo.misIntentos,
                  duelo.config.modo,
                  duelo.config.digitos,
                  true,
                  'Envía tu primera combinación al candado rival.'
                )
              : renderListaIntentos(
                  duelo.intentosRival,
                  duelo.config.modo,
                  duelo.config.digitos,
                  true,
                  'El rival aún no ha atacado tu bóveda.'
                )}
          </div>
        </aside>
      </div>

      {/* Modal registro ampliado */}
      {registroAmpliado && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRegistroAmpliado(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              esMinimalista
                ? 'w-full max-w-md max-h-[80vh] rounded-3xl bg-slate-900 border border-white/15 p-4 shadow-2xl flex flex-col'
                : 'w-full max-w-md max-h-[80vh] rounded-3xl bg-[#fff8e7] border-4 border-[#2b2140] p-4 shadow-[0_10px_0_#2b2140] flex flex-col'
            }
          >
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-current/15">
              <h3 className="text-base font-black">
                {tabHistorial === 'mios'
                  ? `🎯 Mis Ataques (${duelo.misIntentos.length})`
                  : `🛡️ Ataques a Mi Bóveda (${duelo.intentosRival.length})`}
              </h3>
              <button
                type="button"
                onClick={() => setRegistroAmpliado(false)}
                className="w-8 h-8 rounded-xl bg-black/10 hover:bg-black/20 font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {tabHistorial === 'mios'
                ? renderListaIntentos(
                    duelo.misIntentos,
                    duelo.config.modo,
                    duelo.config.digitos,
                    false,
                    'Sin ataques aún.'
                  )
                : renderListaIntentos(
                    duelo.intentosRival,
                    duelo.config.modo,
                    duelo.config.digitos,
                    false,
                    'Sin ataques recibidos aún.'
                  )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
