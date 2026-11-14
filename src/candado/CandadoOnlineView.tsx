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
  TiempoTurnoCandado,
} from './types';

function generarMatchIdCandado(prefijo = 'cndp'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${Date.now().toString(36)}_${rand}`;
}

interface CandadoOnlineViewProps {
  userActual: UserCuenta | null;
  esMinimalista: boolean;
  animacionesReducidas: boolean;
  configInicial: ConfigDueloCandadoP2P;
  onVolverALocal: () => void;
}

const ETIQUETAS_DIGITOS: Record<DigitosCandado, { metal: string; dotColor: string }> = {
  4: { metal: 'Arena', dotColor: '#E6C29F' },
  5: { metal: 'Bruma', dotColor: '#A6C8F0' },
  6: { metal: 'Lavanda', dotColor: '#C2B3F2' },
  8: { metal: 'Glacial', dotColor: '#9ED6DC' },
  10: { metal: 'Salvia', dotColor: '#99D8B8' },
  14: { metal: 'Coral', dotColor: '#EEB4C2' },
  16: { metal: 'Íris', dotColor: '#B2BDF5' },
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

  // Reacciones, desconexión, revancha
  const [reaccionMia, setReaccionMia] = useState<string | null>(null);
  const [reaccionRival, setReaccionRival] = useState<string | null>(null);
  const [avisoDesconexionSeg, setAvisoDesconexionSeg] = useState<number | null>(null);
  const [rivalSalioSala, setRivalSalioSala] = useState<boolean>(false);
  const [revanchaEstado, setRevanchaEstado] = useState<
    'ninguna' | 'enviada' | 'recibida' | 'rechazada'
  >('ninguna');

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
        <div
          className={`h-full flex items-center justify-center text-center px-3 text-xs font-medium ${
            esMinimalista ? 'text-slate-400' : 'text-[#3E4359]'
          }`}
        >
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
                    ? 'px-2.5 py-1.5 rounded-xl bg-slate-800/70 border border-white/10 flex items-center justify-between gap-1.5'
                    : 'px-2.5 py-1.5 rounded-xl bg-[#FAF4E4] border border-[#E2D9C2] flex items-center justify-between gap-1.5'
                }
              >
                <span
                  className={`text-[10px] font-semibold tabular-nums w-5 shrink-0 ${
                    esMinimalista ? 'text-slate-400' : 'text-[#43485E]'
                  }`}
                >
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
                      } rounded-lg flex flex-col items-center justify-center font-mono font-bold tabular-nums border ${
                        ev.estado === 'exacto'
                          ? esMinimalista
                            ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/40'
                            : 'bg-[#C4EED7] text-[#0F3D27] border-[#82CAA4]'
                          : ev.estado === 'desubicado'
                          ? esMinimalista
                            ? 'bg-amber-300/20 text-amber-200 border-amber-300/40'
                            : 'bg-[#FCE8B8] text-[#4A3309] border-[#E0C070]'
                          : esMinimalista
                          ? 'bg-slate-900/90 text-slate-400 border-white/10'
                          : 'bg-[#EFE7D4] text-[#3E4359] border-[#D7CCB2]'
                      }`}
                    >
                      <span className="leading-none">{ev.digito}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-bold tabular-nums shrink-0 flex items-center gap-1.5">
                  <span className={esMinimalista ? 'text-emerald-300' : 'text-[#0F5232]'}>
                    {itemA.exactos}✓
                  </span>
                  <span className={esMinimalista ? 'text-amber-300' : 'text-[#734E0D]'}>
                    {itemA.desubicados}↔
                  </span>
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
                  ? 'px-2.5 py-1.5 rounded-xl bg-slate-800/70 border border-white/10 flex items-center justify-between gap-2'
                  : 'px-2.5 py-1.5 rounded-xl bg-[#FAF4E4] border border-[#E2D9C2] flex items-center justify-between gap-2'
              }
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-[10px] font-semibold tabular-nums ${
                    esMinimalista ? 'text-slate-400' : 'text-[#43485E]'
                  }`}
                >
                  #{itemB.numero}
                </span>
                <span className="font-mono font-bold text-xs sm:text-sm tracking-wider tabular-nums">
                  {itemB.entrada}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold shrink-0 ${
                  itemB.direccion === 'exacto'
                    ? esMinimalista
                      ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/40'
                      : 'bg-[#C4EED7] text-[#0F3D27] border-[#82CAA4]'
                    : itemB.direccion === 'alto'
                    ? esMinimalista
                      ? 'bg-sky-400/20 text-sky-200 border-sky-400/35'
                      : 'bg-[#DCEBFF] text-[#143254] border-[#9EC2F0]'
                    : esMinimalista
                    ? 'bg-orange-400/20 text-orange-200 border-orange-400/35'
                    : 'bg-[#FDE4D2] text-[#632D0D] border-[#ECC0A0]'
                }`}
              >
                {itemB.direccion === 'exacto'
                  ? 'Exacto'
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
      <main className="w-full max-w-4xl my-auto py-1 flex flex-col gap-3">
        {/* Cabecera moderna */}
        <div
          className={
            esMinimalista
              ? 'w-full flex items-center justify-between pb-2.5 border-b border-white/10 gap-2'
              : 'w-full flex items-center justify-between pb-2.5 border-b border-[#E0D7C0] gap-2'
          }
        >
          <button
            type="button"
            onClick={() => {
              candadoAudio.playDialTick();
              onVolverALocal();
            }}
            className={
              esMinimalista
                ? 'py-1.5 px-3 rounded-xl bg-slate-800/80 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap'
                : 'py-1.5 px-3 rounded-xl bg-[#FFFDF6] border border-[#DDD3BA] shadow-2xs text-xs font-semibold text-[#1F2333] hover:bg-[#F5EEDB] cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap'
            }
          >
            ◀ Menú
          </button>

          <div className="text-center min-w-0">
            <h2 className="text-base sm:text-xl font-bold truncate">
              Multijugador P2P · Candado
            </h2>
            <p
              className={`text-[11px] truncate ${
                esMinimalista ? 'text-slate-400' : 'text-[#3E4359] font-medium'
              }`}
            >
              Duelo 1v1 con verificación SHA-256 · Juego limpio
            </p>
          </div>

          <span
            className={
              esMinimalista
                ? 'text-[11px] font-semibold text-indigo-200/80 shrink-0 hidden sm:inline-flex'
                : 'text-[11px] font-semibold text-[#2E3C6E] shrink-0 hidden sm:inline-flex'
            }
          >
            1v1 Directo
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-3">
          {/* Columna Izquierda: Crear Sala Candado */}
          <section
            className={
              esMinimalista
                ? 'rounded-2xl bg-[#1A1E2E]/95 border border-white/10 p-4 shadow-xl'
                : 'rounded-2xl bg-[#FFFDF6]/95 border border-[#DFD6BF] p-4 shadow-[0_8px_24px_-8px_rgba(68,58,36,0.1)]'
            }
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-bold">Crear Sala 1v1</h3>
              <span
                className={`text-[11px] font-semibold ${
                  esMinimalista ? 'text-slate-400' : 'text-[#3A3F54]'
                }`}
              >
                Anfitrión
              </span>
            </div>

            {!userActual && (
              <div className="mb-2.5">
                <label
                  className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    esMinimalista ? 'text-slate-400' : 'text-[#3A3F54]'
                  }`}
                >
                  Tu apodo en sala
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={nombreLocal}
                  onChange={(e) => setNombreLocal(e.target.value)}
                  className={
                    esMinimalista
                      ? 'w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-xs font-semibold'
                      : 'w-full px-3 py-1.5 rounded-xl bg-[#FAF4E4] border border-[#DDD3BA] text-[#171923] text-xs font-semibold'
                  }
                  placeholder="Tu nombre"
                />
              </div>
            )}

            {/* Modo */}
            <div className="mb-2.5">
              <label
                className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                  esMinimalista ? 'text-slate-400' : 'text-[#3A3F54]'
                }`}
              >
                Mecánica del duelo
              </label>
              <div
                className={
                  esMinimalista
                    ? 'grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-900/90 border border-white/10'
                    : 'grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F2EBD9] border border-[#DDD3BA]'
                }
              >
                {(
                  [
                    { id: 'logico' as ModoCandado, titulo: 'Candado Lógico' },
                    { id: 'mayor_menor' as ModoCandado, titulo: 'Mayor / Menor' },
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
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        activo
                          ? esMinimalista
                            ? 'bg-emerald-400/20 border border-emerald-400/35 text-emerald-100'
                            : 'bg-[#FFFDF6] border border-[#CFC4A8] shadow-xs text-[#171923]'
                          : esMinimalista
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-[#3E4359] hover:text-[#171923]'
                      }`}
                    >
                      {m.titulo}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dígitos */}
            <div className="mb-2.5">
              <label
                className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                  esMinimalista ? 'text-slate-400' : 'text-[#3A3F54]'
                }`}
              >
                Dígitos del candado
              </label>
              <div
                className={
                  esMinimalista
                    ? 'grid grid-cols-4 sm:grid-cols-7 gap-1 p-1 rounded-xl bg-slate-900/90 border border-white/10'
                    : 'grid grid-cols-4 sm:grid-cols-7 gap-1 p-1 rounded-xl bg-[#F2EBD9] border border-[#DDD3BA]'
                }
              >
                {digitosDisponibles.map((num) => {
                  const activo = configSala.digitos === num;
                  const info = ETIQUETAS_DIGITOS[num];
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
                      className={`py-1.5 px-1 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
                        activo
                          ? esMinimalista
                            ? 'bg-indigo-400/25 border border-indigo-300/40 text-white'
                            : 'bg-[#FFFDF6] border border-[#CFC4A8] shadow-xs text-[#171923]'
                          : esMinimalista
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-[#3E4359] hover:text-[#171923]'
                      }`}
                    >
                      <span className="text-xs font-bold tabular-nums">{num}D</span>
                      <span
                        className="mt-0.5 w-2 h-1 rounded-full"
                        style={{ backgroundColor: info.dotColor }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tiempo por turno + Visibilidad */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label
                  className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    esMinimalista ? 'text-slate-400' : 'text-[#3A3F54]'
                  }`}
                >
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
                      className={`py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer border transition-colors ${
                        configSala.tiempoTurnoSeg === t.valor
                          ? esMinimalista
                            ? 'bg-sky-400/20 border-sky-300/40 text-sky-100'
                            : 'bg-[#DCEBFF] border-[#9EC2F0] text-[#143254]'
                          : esMinimalista
                          ? 'bg-slate-800 border-white/10 text-slate-300'
                          : 'bg-[#FAF4E4] border-[#DDD3BA] text-[#282C3D]'
                      }`}
                    >
                      {t.texto}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    esMinimalista ? 'text-slate-400' : 'text-[#3A3F54]'
                  }`}
                >
                  Visibilidad
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setSalaPublica(true)}
                    className={`py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer border transition-colors ${
                      salaPublica
                        ? esMinimalista
                          ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-200'
                          : 'bg-[#DDF5E8] border-[#8ECEAC] text-[#0F3D27]'
                        : esMinimalista
                        ? 'bg-slate-800 border-white/10 text-slate-400'
                        : 'bg-[#FAF4E4] border-[#DDD3BA] text-[#3A3F54]'
                    }`}
                  >
                    Pública
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalaPublica(false)}
                    className={`py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer border transition-colors ${
                      !salaPublica
                        ? esMinimalista
                          ? 'bg-amber-300/20 border-amber-300/40 text-amber-200'
                          : 'bg-[#FCE8B8] border-[#E0C070] text-[#4A3309]'
                        : esMinimalista
                        ? 'bg-slate-800 border-white/10 text-slate-400'
                        : 'bg-[#FAF4E4] border-[#DDD3BA] text-[#3A3F54]'
                    }`}
                  >
                    Privada
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
                className={`w-full mb-3 px-3 py-2 rounded-xl flex items-center justify-between text-[11px] font-semibold cursor-pointer border ${
                  esMinimalista
                    ? 'bg-slate-800/75 border-white/10'
                    : 'bg-[#FAF4E4] border-[#DDD3BA] text-[#171923]'
                }`}
              >
                <span>
                  {configSala.permitirRepetidos
                    ? 'Dígitos repetidos permitidos'
                    : 'Dígitos únicos sin repetir'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    configSala.permitirRepetidos
                      ? esMinimalista
                        ? 'bg-amber-300/20 text-amber-200'
                        : 'bg-[#FCE8B8] text-[#4A3309]'
                      : esMinimalista
                      ? 'bg-emerald-400/20 text-emerald-200'
                      : 'bg-[#C4EED7] text-[#0F3D27]'
                  }`}
                >
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
                  ? 'w-full min-h-[42px] py-2 rounded-xl bg-emerald-300/90 hover:bg-emerald-200 disabled:opacity-50 text-slate-950 font-bold text-sm cursor-pointer transition-colors'
                  : 'w-full min-h-[42px] py-2 rounded-xl bg-[#B7EBD0] hover:bg-[#A4E3C2] disabled:opacity-50 text-[#0F3D27] border border-[#82CAA4] font-bold text-sm cursor-pointer transition-colors'
              }
            >
              {ocupadoRed ? 'Creando sala...' : 'Crear Sala Candado 1v1'}
            </button>
          </section>

          {/* Columna Derecha: Código + Salas Públicas */}
          <section
            className={
              esMinimalista
                ? 'rounded-2xl bg-[#1A1E2E]/95 border border-white/10 p-4 shadow-xl flex flex-col'
                : 'rounded-2xl bg-[#FFFDF6]/95 border border-[#DFD6BF] p-4 shadow-[0_8px_24px_-8px_rgba(68,58,36,0.1)] flex flex-col'
            }
          >
            <h3 className="text-sm font-bold mb-2">Unirse por código</h3>
            <div className="flex gap-1.5 mb-3">
              <input
                type="text"
                maxLength={8}
                value={codigoEntrada}
                onChange={(e) => setCodigoEntrada(e.target.value.toUpperCase())}
                placeholder="Ej: A7K9B2"
                className={
                  esMinimalista
                    ? 'flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-white/10 font-mono font-bold text-sm tracking-widest uppercase'
                    : 'flex-1 px-3 py-2 rounded-xl bg-[#FAF4E4] border border-[#DDD3BA] text-[#171923] font-mono font-bold text-sm tracking-widest uppercase'
                }
              />
              <button
                type="button"
                disabled={ocupadoRed}
                onClick={() => unirseASalaCandado(codigoEntrada)}
                className={
                  esMinimalista
                    ? 'px-4 py-2 rounded-xl bg-sky-300/90 hover:bg-sky-200 text-slate-950 font-bold text-xs cursor-pointer'
                    : 'px-4 py-2 rounded-xl bg-[#CEE4FF] hover:bg-[#BBD8FE] text-[#143254] border border-[#9EC2F0] font-bold text-xs cursor-pointer'
                }
              >
                Entrar
              </button>
            </div>

            {errorLobby && (
              <div
                className={
                  esMinimalista
                    ? 'mb-2.5 px-3 py-2 rounded-xl bg-rose-400/20 border border-rose-400/35 text-rose-200 text-xs font-semibold'
                    : 'mb-2.5 px-3 py-2 rounded-xl bg-[#FAD8DD] border border-[#E59FA8] text-[#661924] text-xs font-semibold'
                }
              >
                {errorLobby}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-bold">Salas Candado ({salasPublicas.length})</h3>
              <button
                type="button"
                onClick={cargarSalasPublicas}
                className={
                  esMinimalista
                    ? 'px-2.5 py-0.5 rounded-lg bg-slate-800 border border-white/10 text-[10px] font-semibold cursor-pointer'
                    : 'px-2.5 py-0.5 rounded-lg bg-[#F5EEDB] border border-[#DDD3BA] text-[10px] font-semibold text-[#1F2333] cursor-pointer'
                }
              >
                {cargandoSalas ? '...' : 'Actualizar'}
              </button>
            </div>

            {/* Filtro por dígitos */}
            <div className="flex flex-wrap gap-1 mb-2">
              {([0, 4, 5, 6, 8, 10, 14, 16] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFiltroDigitosSalas(d)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold cursor-pointer border transition-colors ${
                    filtroDigitosSalas === d
                      ? esMinimalista
                        ? 'bg-indigo-400/25 text-white border-indigo-300/40'
                        : 'bg-[#EAE4FC] text-[#2E2054] border-[#C3B6EC]'
                      : esMinimalista
                      ? 'bg-slate-800 text-slate-300 border-white/10'
                      : 'bg-[#FAF4E4] text-[#282C3D] border-[#DDD3BA]'
                  }`}
                >
                  {d === 0 ? 'Todas' : `${d}D`}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-[160px] max-h-[250px] overflow-y-auto space-y-1.5 pr-0.5">
              {salasPublicas.length === 0 ? (
                <div
                  className={`h-32 flex items-center justify-center text-center text-xs font-medium px-4 ${
                    esMinimalista ? 'text-slate-400' : 'text-[#3E4359]'
                  }`}
                >
                  No hay salas públicas de Candado abiertas ahora. Crea una para empezar.
                </div>
              ) : (
                salasPublicas.map((s) => (
                  <div
                    key={s.codigo}
                    className={
                      esMinimalista
                        ? 'p-2.5 rounded-xl bg-slate-800/70 border border-white/10 flex items-center justify-between gap-2'
                        : 'p-2.5 rounded-xl bg-[#FAF4E4] border border-[#E2D9C2] flex items-center justify-between gap-2'
                    }
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-xs truncate">
                        {s.modoCandado === 'mayor_menor' ? 'Mayor/Menor' : 'Lógico'} · {s.anfitrion} ·{' '}
                        <span
                          className={`font-mono font-bold ${
                            esMinimalista ? 'text-sky-300' : 'text-[#1E3D66]'
                          }`}
                        >
                          {s.codigo}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] ${
                          esMinimalista ? 'text-slate-400' : 'text-[#3E4359]'
                        }`}
                      >
                        {s.digitosCandado} dígitos ·{' '}
                        {s.tiempoTurnoSeg > 0 ? `${s.tiempoTurnoSeg}s/turno` : 'Sin reloj'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={ocupadoRed}
                      onClick={() => unirseASalaCandado(s.codigo)}
                      className={
                        esMinimalista
                          ? 'px-3 py-1.5 rounded-xl bg-emerald-300/90 hover:bg-emerald-200 text-slate-950 font-bold text-xs cursor-pointer shrink-0'
                          : 'px-3 py-1.5 rounded-xl bg-[#B7EBD0] hover:bg-[#A4E3C2] text-[#0F3D27] border border-[#82CAA4] font-bold text-xs cursor-pointer shrink-0'
                      }
                    >
                      Unirme
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
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
              ? 'rounded-2xl bg-[#1A1E2E]/95 border border-white/10 p-4 sm:p-5 shadow-2xl'
              : 'rounded-2xl bg-[#FFFDF6]/95 border border-[#DFD6BF] p-4 sm:p-5 shadow-[0_12px_32px_-10px_rgba(68,58,36,0.12)]'
          }
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  esMinimalista ? 'text-slate-400' : 'text-[#3A3F54]'
                }`}
              >
                Sala Candado {salaPublica ? 'Pública' : 'Privada'} ·{' '}
                {modoConexion === 'webrtc' ? 'P2P Directo' : 'Enlace Estable'}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-2xl font-bold tracking-widest">
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
                      ? 'px-2 py-0.5 rounded-lg bg-slate-800 border border-white/10 text-[10px] font-semibold cursor-pointer'
                      : 'px-2 py-0.5 rounded-lg bg-[#F5EEDB] border border-[#DDD3BA] text-[#1F2333] text-[10px] font-semibold cursor-pointer'
                  }
                >
                  {copiadoCodigo ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={abandonarSala}
              className={
                esMinimalista
                  ? 'px-3 py-1.5 rounded-xl bg-rose-400/20 border border-rose-400/35 text-rose-200 font-semibold text-xs cursor-pointer'
                  : 'px-3 py-1.5 rounded-xl bg-[#FAD8DD] border border-[#E59FA8] text-[#661924] font-semibold text-xs cursor-pointer'
              }
            >
              Salir
            </button>
          </div>

          <div
            className={
              esMinimalista
                ? 'p-2.5 rounded-xl bg-slate-800/70 border border-white/10 text-xs font-semibold mb-3 flex items-center justify-between'
                : 'p-2.5 rounded-xl bg-[#FAF4E4] border border-[#E2D9C2] text-[#171923] text-xs font-semibold mb-3 flex items-center justify-between'
            }
          >
            <span>
              {configSala.modo === 'logico' ? 'Candado Lógico' : 'Mayor / Menor'} · Serie{' '}
              {infoMetal.metal} ({configSala.digitos}D)
            </span>
            <span className={esMinimalista ? 'text-slate-300' : 'text-[#3A3F54]'}>
              {configSala.tiempoTurnoSeg > 0 ? `${configSala.tiempoTurnoSeg}s/turno` : 'Sin límite'}
            </span>
          </div>

          {/* Tarjetas de ambos jugadores */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {[0, 1].map((slotId) => {
              const p = jugadoresSala.find((j) => j.id === slotId);
              return (
                <div
                  key={slotId}
                  className={`p-3 rounded-xl flex flex-col items-center text-center border ${
                    p
                      ? esMinimalista
                        ? 'bg-slate-800/80 border-white/10'
                        : 'bg-[#FAF4E4] border-[#E2D9C2]'
                      : esMinimalista
                      ? 'bg-slate-800/35 border-dashed border-white/15 opacity-70'
                      : 'bg-[#FAF4E4]/70 border-dashed border-[#CFC4A8]'
                  }`}
                >
                  {p ? (
                    <>
                      <CartoonCharacter
                        color={p.color || '#A6C8F0'}
                        hat={(p.hat || 'corona') as AvatarTipoDeGorro}
                        ropa={(p.ropa || 'ninguna') as AvatarTipoDeRopa}
                        ropaColor={p.ropaColor}
                        aura={(p.aura || 'ninguna') as AvatarTipoDeAura}
                        size={48}
                      />
                      <span className="font-bold text-xs mt-1 truncate max-w-full">
                        {p.nombre}
                      </span>
                      <span
                        className={`text-[10px] font-medium ${
                          esMinimalista ? 'text-slate-400' : 'text-[#3E4359]'
                        }`}
                      >
                        {p.esAnfitrion ? 'Anfitrión' : 'Retador'}
                      </span>
                    </>
                  ) : (
                    <div className="h-[74px] flex flex-col items-center justify-center">
                      <span
                        className={`text-xs font-semibold ${
                          esMinimalista ? 'text-slate-400' : 'text-[#3E4359]'
                        }`}
                      >
                        Esperando rival...
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Opción de Clave Secreta propia */}
          <div
            className={
              esMinimalista
                ? 'p-3 rounded-xl bg-slate-800/60 border border-white/10 mb-3'
                : 'p-3 rounded-xl bg-[#FAF4E4] border border-[#E2D9C2] mb-3'
            }
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold">Tu clave secreta a defender</span>
              <button
                type="button"
                onClick={() => setUsarSecretoManual((v) => !v)}
                className={
                  esMinimalista
                    ? 'px-2 py-0.5 rounded-lg bg-amber-300/20 text-amber-200 border border-amber-300/30 text-[10px] font-semibold cursor-pointer'
                    : 'px-2 py-0.5 rounded-lg bg-[#FCE8B8] text-[#4A3309] border border-[#E0C070] text-[10px] font-semibold cursor-pointer'
                }
              >
                {usarSecretoManual ? 'Manual' : 'Aleatoria'}
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
                    ? 'w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 font-mono font-bold text-sm tracking-widest'
                    : 'w-full px-3 py-1.5 rounded-xl bg-[#FFFDF6] border border-[#DDD3BA] text-[#171923] font-mono font-bold text-sm tracking-widest'
                }
              />
            ) : (
              <p
                className={`text-[11px] ${
                  esMinimalista ? 'text-slate-400' : 'text-[#3E4359] font-medium'
                }`}
              >
                Se generará automáticamente y se sellará con SHA-256 al iniciar el duelo.
              </p>
            )}
          </div>

          {errorLobby && (
            <div
              className={
                esMinimalista
                  ? 'mb-3 px-3 py-2 rounded-xl bg-rose-400/20 border border-rose-400/35 text-rose-200 text-xs font-semibold'
                  : 'mb-3 px-3 py-2 rounded-xl bg-[#FAD8DD] border border-[#E59FA8] text-[#661924] text-xs font-semibold'
              }
            >
              {errorLobby}
            </div>
          )}

          {soyAnfitrion ? (
            <button
              type="button"
              disabled={!puedeIniciar}
              onClick={iniciarDueloComoAnfitrion}
              className={
                esMinimalista
                  ? 'w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-300/90 hover:bg-emerald-200 disabled:opacity-45 text-slate-950 font-bold text-sm cursor-pointer'
                  : 'w-full min-h-[44px] py-2.5 rounded-xl bg-[#B7EBD0] hover:bg-[#A4E3C2] disabled:opacity-45 text-[#0F3D27] border border-[#82CAA4] font-bold text-sm cursor-pointer'
              }
            >
              {rivalEnSala ? 'Iniciar Duelo Candado' : 'Esperando al segundo jugador...'}
            </button>
          ) : (
            <div
              className={
                esMinimalista
                  ? 'w-full py-2.5 rounded-xl text-center text-xs font-semibold bg-slate-800/60'
                  : 'w-full py-2.5 rounded-xl text-center text-xs font-semibold bg-[#F2EBD9] text-[#282C3D]'
              }
            >
              Esperando a que el anfitrión inicie el duelo...
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
      {/* Cabecera de estado del duelo P2P */}
      <div
        className={
          esMinimalista
            ? 'w-full rounded-xl bg-[#1A1E2E]/95 border border-white/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2'
            : 'w-full rounded-xl bg-[#FFFDF6]/95 border border-[#DFD6BF] px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2'
        }
      >
        {/* Avatares y turno */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border ${
              esMiTurno
                ? esMinimalista
                  ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-100'
                  : 'bg-[#DDF5E8] border-[#8ECEAC] text-[#0F3D27]'
                : 'border-transparent'
            }`}
          >
            <CartoonCharacter
              color={yoJugador?.color || miPerfilSala.color}
              hat={(yoJugador?.hat || miPerfilSala.hat) as AvatarTipoDeGorro}
              ropa={(yoJugador?.ropa || 'ninguna') as AvatarTipoDeRopa}
              size={28}
            />
            <div className="leading-none">
              <span className="text-[11px] font-bold block">
                {yoJugador?.nombre || miPerfilSala.nombre}
              </span>
              <span
                className={`text-[9px] font-medium ${
                  esMiTurno ? 'opacity-90' : esMinimalista ? 'text-slate-400' : 'text-[#3E4359]'
                }`}
              >
                {reaccionMia ? reaccionMia : esMiTurno ? '▶ Tu turno' : 'Tú'}
              </span>
            </div>
          </div>

          <span
            className={`text-xs font-semibold ${
              esMinimalista ? 'text-slate-500' : 'text-[#5C5546]'
            }`}
          >
            vs
          </span>

          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border ${
              duelo.fase === 'jugando' && !esMiTurno
                ? esMinimalista
                  ? 'bg-amber-300/20 border-amber-300/40 text-amber-100'
                  : 'bg-[#FCE8B8] border-[#E0C070] text-[#4A3309]'
                : 'border-transparent'
            }`}
          >
            <CartoonCharacter
              color={rivalJugador?.color || '#A6C8F0'}
              hat={(rivalJugador?.hat || 'pompon') as AvatarTipoDeGorro}
              ropa={(rivalJugador?.ropa || 'ninguna') as AvatarTipoDeRopa}
              size={28}
            />
            <div className="leading-none">
              <span className="text-[11px] font-bold block">
                {rivalJugador?.nombre || 'Rival'}
              </span>
              <span
                className={`text-[9px] font-medium ${
                  duelo.fase === 'jugando' && !esMiTurno
                    ? 'opacity-90'
                    : esMinimalista
                    ? 'text-slate-400'
                    : 'text-[#3E4359]'
                }`}
              >
                {reaccionRival
                  ? reaccionRival
                  : duelo.fase === 'jugando' && !esMiTurno
                  ? '▶ Pensando...'
                  : 'Rival'}
              </span>
            </div>
          </div>
        </div>

        {/* Reloj + Commit + Reacciones + Rendirse */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold tabular-nums border ${
              duelo.config.tiempoTurnoSeg > 0 &&
              duelo.tiempoRestanteTurno <= 8 &&
              duelo.fase === 'jugando'
                ? esMinimalista
                  ? 'bg-rose-400/20 text-rose-200 border-rose-400/40 animate-pulse'
                  : 'bg-[#FAD8DD] text-[#661924] border-[#E59FA8] animate-pulse'
                : esMinimalista
                ? 'bg-slate-800 text-slate-200 border-white/10'
                : 'bg-[#F5EEDB] text-[#1F2333] border-[#DDD3BA]'
            }`}
          >
            {duelo.config.tiempoTurnoSeg > 0 ? `${duelo.tiempoRestanteTurno}s` : 'Libre'}
          </span>

          <span
            title={`Commit rival SHA-256: ${duelo.rivalCommitHash || 'esperando'}`}
            className={
              esMinimalista
                ? 'px-2 py-1 rounded-lg bg-indigo-400/15 text-indigo-200 border border-indigo-300/30 text-[10px] font-semibold'
                : 'px-2 py-1 rounded-lg bg-[#EAE4FC] text-[#2E2054] border border-[#C3B6EC] text-[10px] font-semibold'
            }
          >
            {duelo.rivalCommitHash ? 'SHA-256' : 'Sellando'}
          </span>

          <div
            className={`hidden sm:flex items-center gap-0.5 rounded-lg px-1 py-0.5 ${
              esMinimalista ? 'bg-slate-800/60' : 'bg-[#F5EEDB] border border-[#E2D9C2]'
            }`}
          >
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
                className="w-6 h-6 rounded-md hover:bg-black/5 text-xs cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>

          {duelo.fase === 'jugando' ? (
            <button
              type="button"
              onClick={rendirseEnDuelo}
              className={
                esMinimalista
                  ? 'px-2.5 py-1 rounded-lg bg-rose-400/20 border border-rose-400/35 text-rose-200 text-[10px] font-semibold cursor-pointer'
                  : 'px-2.5 py-1 rounded-lg bg-[#FAD8DD] border border-[#E59FA8] text-[#661924] text-[10px] font-semibold cursor-pointer'
              }
            >
              Rendirse
            </button>
          ) : (
            <button
              type="button"
              onClick={abandonarSala}
              className={
                esMinimalista
                  ? 'px-2.5 py-1 rounded-lg bg-slate-800 border border-white/10 text-[10px] font-semibold cursor-pointer'
                  : 'px-2.5 py-1 rounded-lg bg-[#F5EEDB] border border-[#DDD3BA] text-[#1F2333] text-[10px] font-semibold cursor-pointer'
              }
            >
              Salir
            </button>
          )}
        </div>
      </div>

      {avisoDesconexionSeg !== null && duelo.fase === 'jugando' && (
        <div
          className={
            esMinimalista
              ? 'w-full px-3 py-1.5 rounded-xl bg-amber-300/20 border border-amber-300/35 text-amber-200 text-xs font-semibold text-center'
              : 'w-full px-3 py-1.5 rounded-xl bg-[#FCE8B8] border border-[#E0C070] text-[#4A3309] text-xs font-semibold text-center'
          }
        >
          El rival perdió señal — esperando reconexión ({avisoDesconexionSeg}s)...
        </div>
      )}

      {duelo.turnoIgualadorPendiente && duelo.fase === 'jugando' && (
        <div
          className={
            esMinimalista
              ? 'w-full px-3 py-1.5 rounded-xl bg-amber-300/25 border border-amber-300/40 text-amber-100 text-xs font-semibold text-center'
              : 'w-full px-3 py-1.5 rounded-xl bg-[#FCE8B8] border border-[#E0C070] text-[#4A3309] text-xs font-semibold text-center'
          }
        >
          Última oportunidad igualadora:{' '}
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
              <div
                className={
                  esMinimalista
                    ? 'w-full h-7 px-2.5 rounded-xl bg-rose-400/20 border border-rose-400/35 text-rose-200 text-[11px] font-semibold flex items-center justify-center truncate'
                    : 'w-full h-7 px-2.5 rounded-xl bg-[#FAD8DD] border border-[#E59FA8] text-[#661924] text-[11px] font-semibold flex items-center justify-center truncate'
                }
              >
                {errorDuelo}
              </div>
            ) : duelo.fase === 'preparando_claves' ? (
              <div
                className={
                  esMinimalista
                    ? 'w-full h-7 px-2.5 rounded-xl bg-sky-400/20 border border-sky-400/35 text-sky-200 text-[11px] font-semibold flex items-center justify-center'
                    : 'w-full h-7 px-2.5 rounded-xl bg-[#DCEBFF] border border-[#9EC2F0] text-[#143254] text-[11px] font-semibold flex items-center justify-center'
                }
              >
                Intercambiando sellos criptográficos...
              </div>
            ) : duelo.config.modo === 'mayor_menor' && duelo.fase === 'jugando' ? (
              <div
                className={
                  esMinimalista
                    ? 'w-full h-7 px-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-[11px] font-semibold text-slate-300 flex items-center justify-between tabular-nums'
                    : 'w-full h-7 px-2.5 rounded-xl bg-[#FFFDF6]/95 border border-[#DFD6BF] text-[11px] font-semibold text-[#1F2333] flex items-center justify-between tabular-nums'
                }
              >
                <span>Rango del rival</span>
                <span className="font-mono font-bold">
                  {formatearNumeroConCeros(duelo.miRangoMin, duelo.config.digitos)} —{' '}
                  {formatearNumeroConCeros(duelo.miRangoMax, duelo.config.digitos)}
                </span>
              </div>
            ) : (
              <div
                className={
                  esMinimalista
                    ? 'w-full h-7 px-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-[11px] font-medium text-slate-300 flex items-center justify-center'
                    : 'w-full h-7 px-2.5 rounded-xl bg-[#FFFDF6]/90 border border-[#DFD6BF] text-[11px] font-medium text-[#3A3F54] flex items-center justify-center'
                }
              >
                {esMiTurno
                  ? 'Es tu turno — descifra el candado rival'
                  : 'Turno del rival...'}
              </div>
            )}
          </div>

          {duelo.fase === 'terminada' ? (
            <div
              className={`w-full rounded-2xl p-3.5 text-center border ${
                duelo.desenlaceParaMi === 'victoria'
                  ? esMinimalista
                    ? 'bg-emerald-950/60 border-emerald-400/35 text-emerald-100'
                    : 'bg-[#DDF5E8] border-[#8ECEAC] text-[#0F3D27]'
                  : duelo.desenlaceParaMi === 'empate'
                  ? esMinimalista
                    ? 'bg-amber-950/60 border-amber-300/35 text-amber-100'
                    : 'bg-[#FDF4DB] border-[#E0C070] text-[#4A3309]'
                  : esMinimalista
                  ? 'bg-rose-950/60 border-rose-400/35 text-rose-100'
                  : 'bg-[#FCE4E8] border-[#E59FA8] text-[#661924]'
              }`}
            >
              <h2 className="text-base font-bold">
                {duelo.desenlaceParaMi === 'victoria'
                  ? 'Victoria en Duelo'
                  : duelo.desenlaceParaMi === 'empate'
                  ? 'Empate Justo'
                  : 'Duelo Perdido'}
              </h2>
              {duelo.motivoFin && (
                <p className="text-[11px] opacity-95 mt-0.5">{duelo.motivoFin}</p>
              )}

              {/* Verificación Anti-trampas Commit-Reveal */}
              <div className="mt-2 p-2.5 rounded-xl bg-black/5 text-[11px] font-medium space-y-0.5">
                <div>
                  Clave rival:{' '}
                  <span className="font-mono font-bold">
                    {duelo.rivalSecretoRevelado || '—'}
                  </span>{' '}
                  · Tu clave: <span className="font-mono font-bold">{duelo.miSecreto}</span>
                </div>
                {duelo.verificacionRival && (
                  <div
                    className={
                      duelo.verificacionRival.verificado
                        ? esMinimalista
                          ? 'text-emerald-300 font-semibold'
                          : 'text-[#0F3D27] font-semibold'
                        : esMinimalista
                        ? 'text-rose-300 font-semibold'
                        : 'text-[#661924] font-semibold'
                    }
                  >
                    {duelo.verificacionRival.verificado
                      ? '✓ Commit SHA-256 y pistas verificados (Juego Limpio)'
                      : duelo.verificacionRival.motivo || 'Fallo de verificación'}
                  </div>
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
                        ? 'min-h-[38px] rounded-xl bg-emerald-300/90 hover:bg-emerald-200 disabled:opacity-60 text-slate-950 font-bold text-xs cursor-pointer'
                        : 'min-h-[38px] rounded-xl bg-[#B7EBD0] hover:bg-[#A4E3C2] disabled:opacity-60 text-[#0F3D27] border border-[#82CAA4] font-bold text-xs cursor-pointer'
                    }
                  >
                    {revanchaEstado === 'recibida'
                      ? 'Aceptar Revancha'
                      : revanchaEstado === 'enviada'
                      ? 'Esperando...'
                      : 'Revancha'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={abandonarSala}
                    className={
                      esMinimalista
                        ? 'min-h-[38px] rounded-xl bg-sky-300/90 hover:bg-sky-200 text-slate-950 font-bold text-xs cursor-pointer'
                        : 'min-h-[38px] rounded-xl bg-[#CEE4FF] hover:bg-[#BBD8FE] text-[#143254] border border-[#9EC2F0] font-bold text-xs cursor-pointer'
                    }
                  >
                    Buscar otro rival
                  </button>
                )}

                <button
                  type="button"
                  onClick={abandonarSala}
                  className={
                    esMinimalista
                      ? 'min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10 font-semibold text-xs cursor-pointer'
                      : 'min-h-[38px] rounded-xl bg-[#FFFDF6] hover:bg-[#F5EEDB] text-[#171923] border border-[#DDD3BA] font-semibold text-xs cursor-pointer'
                  }
                >
                  Salas Online
                </button>
              </div>
            </div>
          ) : (
            <div
              className={
                esMinimalista
                  ? 'w-full rounded-2xl bg-[#1A1E2E]/95 border border-white/10 p-2.5 shadow-xl'
                  : 'w-full rounded-2xl bg-[#FFFDF6]/95 border border-[#DFD6BF] p-2.5 shadow-[0_8px_24px_-8px_rgba(68,58,36,0.1)]'
              }
            >
              {duelo.config.modo === 'logico' && (
                <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                  <span
                    className={`text-[10px] font-medium ${
                      esMinimalista ? 'text-slate-400' : 'text-[#3E4359]'
                    }`}
                  >
                    {modoNotas
                      ? 'Toca números para tachar o destachar'
                      : 'Teclado (0–9)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      candadoAudio.playDialTick();
                      setModoNotas((v) => !v);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold cursor-pointer border ${
                      modoNotas
                        ? esMinimalista
                          ? 'bg-amber-300/85 text-slate-950 border-amber-300'
                          : 'bg-[#E5DCFE] text-[#2E2054] border-[#C3B6EC]'
                        : esMinimalista
                        ? 'bg-slate-800 text-slate-300 border-white/10'
                        : 'bg-[#F5EEDB] text-[#1F2333] border-[#DDD3BA]'
                    }`}
                  >
                    {modoNotas ? 'Tachar: ON' : 'Tachar'}
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
                      className={`h-10 sm:h-11 rounded-xl font-mono font-bold text-base tabular-nums transition-colors cursor-pointer active:translate-y-0.5 ${
                        nota === 'descartado'
                          ? esMinimalista
                            ? 'bg-slate-950/80 text-slate-600 border border-white/5 line-through'
                            : 'bg-[#EFE7D4] text-[#7D7563] border border-[#DDD3BA] line-through'
                          : esExacto
                          ? esMinimalista
                            ? 'bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-200 border border-emerald-400/40'
                            : 'bg-[#DCF5E7] hover:bg-[#CBEFD9] text-[#0F3D27] border border-[#8ECEAC]'
                          : yaEnSlot
                          ? esMinimalista
                            ? 'bg-indigo-400/20 text-indigo-200 border border-indigo-400/40'
                            : 'bg-[#E2EEFF] text-[#143254] border border-[#9EC2F0]'
                          : esMinimalista
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10'
                          : 'bg-[#FAF4E4] hover:bg-[#F0E7D0] text-[#171923] border border-[#DDD3BA]'
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
                      ? 'h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-semibold text-xs cursor-pointer'
                      : 'h-10 rounded-xl bg-[#FAF4E4] hover:bg-[#FAD8DD] text-[#1F2333] hover:text-[#661924] border border-[#DDD3BA] font-semibold text-xs cursor-pointer'
                  }
                >
                  ⌫ Borrar
                </button>
                <button
                  type="button"
                  onClick={limpiarEntrada}
                  className={
                    esMinimalista
                      ? 'h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-semibold text-xs cursor-pointer'
                      : 'h-10 rounded-xl bg-[#FAF4E4] hover:bg-[#FCE8B8] text-[#1F2333] hover:text-[#4A3309] border border-[#DDD3BA] font-semibold text-xs cursor-pointer'
                  }
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  disabled={!esMiTurno}
                  onClick={enviarIntentoP2P}
                  className={
                    esMinimalista
                      ? 'col-span-2 h-10 rounded-xl bg-emerald-300/90 hover:bg-emerald-200 disabled:opacity-45 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer'
                      : 'col-span-2 h-10 rounded-xl bg-[#B7EBD0] hover:bg-[#A4E3C2] disabled:opacity-45 text-[#0F3D27] border border-[#82CAA4] font-bold text-xs sm:text-sm cursor-pointer'
                  }
                >
                  {esMiTurno ? 'Enviar Ataque' : 'Espera Turno'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Columna derecha: Historial Dual con ALTURA FIJA */}
        <aside
          className={
            esMinimalista
              ? 'w-full max-w-[390px] md:max-w-none h-[210px] md:h-[410px] rounded-2xl bg-[#1A1E2E]/95 border border-white/10 p-3 shadow-xl flex flex-col overflow-hidden'
              : 'w-full max-w-[390px] md:max-w-none h-[210px] md:h-[410px] rounded-2xl bg-[#FFFDF6]/95 border border-[#DFD6BF] p-3 shadow-[0_8px_24px_-8px_rgba(68,58,36,0.1)] flex flex-col overflow-hidden'
          }
        >
          {/* Pestañas: Mis Ataques vs Mi Bóveda */}
          <div
            className={`flex items-center justify-between gap-1.5 pb-2 mb-1.5 border-b shrink-0 ${
              esMinimalista ? 'border-white/10' : 'border-[#E6DEC8]'
            }`}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTabHistorial('mios')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${
                  tabHistorial === 'mios'
                    ? esMinimalista
                      ? 'bg-amber-300/20 text-amber-200 border-amber-300/35'
                      : 'bg-[#FCE8B8] text-[#4A3309] border-[#E0C070]'
                    : esMinimalista
                    ? 'bg-slate-800 text-slate-300 border-transparent'
                    : 'bg-[#F5EEDB] text-[#282C3D] border-transparent'
                }`}
              >
                Mis Ataques ({duelo.misIntentos.length})
              </button>
              <button
                type="button"
                onClick={() => setTabHistorial('rival')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${
                  tabHistorial === 'rival'
                    ? esMinimalista
                      ? 'bg-sky-400/20 text-sky-200 border-sky-400/35'
                      : 'bg-[#DCEBFF] text-[#143254] border-[#9EC2F0]'
                    : esMinimalista
                    ? 'bg-slate-800 text-slate-300 border-transparent'
                    : 'bg-[#F5EEDB] text-[#282C3D] border-transparent'
                }`}
              >
                Mi Bóveda ({duelo.intentosRival.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRegistroAmpliado(true)}
              className={
                esMinimalista
                  ? 'px-2 py-1 rounded-lg bg-slate-800 border border-white/10 text-[10px] font-semibold cursor-pointer'
                  : 'px-2 py-1 rounded-lg bg-[#F5EEDB] border border-[#DDD3BA] text-[#1F2333] text-[10px] font-semibold cursor-pointer'
              }
            >
              ⤢
            </button>
          </div>

          {tabHistorial === 'rival' && (
            <div
              className={
                esMinimalista
                  ? 'mb-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/75 border border-white/10 flex items-center justify-between text-[11px] shrink-0'
                  : 'mb-1.5 px-2.5 py-1.5 rounded-xl bg-[#FAF4E4] border border-[#E2D9C2] flex items-center justify-between text-[11px] shrink-0'
              }
            >
              <span className="font-medium">
                Tu clave:{' '}
                <span className="font-mono font-bold tracking-widest">
                  {secretoVisibleMiBoveda
                    ? duelo.miSecreto
                    : '•'.repeat(duelo.config.digitos)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSecretoVisibleMiBoveda((v) => !v)}
                className="text-[10px] font-semibold underline cursor-pointer"
              >
                {secretoVisibleMiBoveda ? 'Ocultar' : 'Ver'}
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
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRegistroAmpliado(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              esMinimalista
                ? 'w-full max-w-md max-h-[80vh] rounded-2xl bg-[#1A1E2E] border border-white/12 p-4 shadow-2xl flex flex-col'
                : 'w-full max-w-md max-h-[80vh] rounded-2xl bg-[#FFFDF6] border border-[#DFD6BF] text-[#171923] p-4 shadow-[0_20px_50px_-12px_rgba(68,58,36,0.25)] flex flex-col'
            }
          >
            <div
              className={`flex items-center justify-between mb-2.5 pb-2 border-b ${
                esMinimalista ? 'border-white/10' : 'border-[#E6DEC8]'
              }`}
            >
              <h3 className="text-base font-bold">
                {tabHistorial === 'mios'
                  ? `Mis Ataques (${duelo.misIntentos.length})`
                  : `Ataques a Mi Bóveda (${duelo.intentosRival.length})`}
              </h3>
              <button
                type="button"
                onClick={() => setRegistroAmpliado(false)}
                className={
                  esMinimalista
                    ? 'w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-sm cursor-pointer'
                    : 'w-8 h-8 rounded-xl bg-[#F5EEDB] hover:bg-[#EAE0C8] text-[#171923] font-bold text-sm cursor-pointer'
                }
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

