/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interfaz principal aislada del minijuego Candado (Local y Duelo P2P 1v1 — Mecánica A y Mecánica B).
 * Geometría estable: el registro de intentos nunca empuja ni oculta el candado o el teclado.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EstiloVisual, UserCuenta } from '../types/murosLocos';
import { candadoAudio } from './candadoAudio';
import {
  DIGITOS_LOGICO,
  DIGITOS_MAYOR_MENOR,
  formatearNumeroConCeros,
  iniciarPartidaCandado,
  normalizarConfigCandado,
  registrarIntentoCandado,
} from './candadoEngine';
import { CandadoOnlineView } from './CandadoOnlineView';
import { candadoOnlineService } from './candadoOnlineService';
import {
  calcularPreviewPuntosLocal,
  generarMatchIdCandado,
  reportarPuntosCandadoAsync,
} from './candadoPuntosApi';
import { CandadoVault } from './CandadoVault';
import {
  CandadoConfig,
  DigitosCandado,
  EstadoCandado,
  IntentoLogico,
  IntentoMayorMenor,
  LimiteIntentosCandado,
  ModoCandado,
  NivelProximidad,
  NotaDigito,
  ResumenPuntosCandado,
} from './types';

interface CandadoGameProps {
  userActual: UserCuenta | null;
  sonidoActivo: boolean;
  animacionesReducidas: boolean;
  estiloVisual?: EstiloVisual;
  onToggleEstiloVisual?: () => void;
  onToggleSonido?: () => void;
  onPuntosActualizados?: (nuevosPuntos: number) => void;
  onVolverAMurosLocos: () => void;
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

const OPCIONES_INTENTOS: { valor: LimiteIntentosCandado; etiqueta: string; desc: string }[] = [
  { valor: 0, etiqueta: '∞', desc: 'Ilimitado' },
  { valor: 10, etiqueta: '10', desc: 'Reto' },
  { valor: 12, etiqueta: '12', desc: 'Normal' },
  { valor: 15, etiqueta: '15', desc: 'Cómodo' },
  { valor: 20, etiqueta: '20', desc: 'Amplio' },
];

const INFO_PROXIMIDAD: Record<
  NivelProximidad,
  { texto: string; icono: string; claseClasica: string; claseMin: string }
> = {
  exacto: {
    texto: '¡Exacto!',
    icono: '🔓',
    claseClasica: 'bg-[#d3f9d8] text-[#134e20] border-[#2b2140]',
    claseMin: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  hirviendo: {
    texto: '¡Hirviendo!',
    icono: '🔥',
    claseClasica: 'bg-[#ffe3e3] text-[#c92a2a] border-[#c92a2a]',
    claseMin: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  caliente: {
    texto: 'Caliente',
    icono: '☀️',
    claseClasica: 'bg-[#fff3bf] text-[#d9480f] border-[#e8590c]',
    claseMin: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  tibio: {
    texto: 'Tibio',
    icono: '🌤️',
    claseClasica: 'bg-[#fff9db] text-[#8f4b00] border-[#f08c00]',
    claseMin: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30',
  },
  frio: {
    texto: 'Frío',
    icono: '❄️',
    claseClasica: 'bg-[#e7f5ff] text-[#1864ab] border-[#339af0]',
    claseMin: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  muy_frio: {
    texto: 'Muy frío',
    icono: '🧊',
    claseClasica: 'bg-[#f1f3f5] text-[#495057] border-[#868e96]',
    claseMin: 'bg-slate-700/60 text-slate-300 border-slate-500/40',
  },
};

export const CandadoGame: React.FC<CandadoGameProps> = ({
  userActual,
  sonidoActivo,
  animacionesReducidas,
  estiloVisual: estiloProp = 'clasico',
  onToggleEstiloVisual,
  onToggleSonido,
  onPuntosActualizados,
  onVolverAMurosLocos,
}) => {
  const [estiloLocal, setEstiloLocal] = useState<EstiloVisual>(estiloProp);
  const estilo = onToggleEstiloVisual ? estiloProp : estiloLocal;
  const esMinimalista = estilo === 'minimalista';

  const [menuJuegosAbierto, setMenuJuegosAbierto] = useState(false);
  const [mostrarReglas, setMostrarReglas] = useState(false);
  const [registroAmpliado, setRegistroAmpliado] = useState(false);
  const [modalModoAbierto, setModalModoAbierto] = useState(false);

  const [modalidadJuego, setModalidadJuego] = useState<'local' | 'p2p'>('local');

  const [config, setConfig] = useState<CandadoConfig>({
    modo: 'logico',
    digitos: 4,
    maxIntentos: 0,
    permitirRepetidos: false,
  });
  const [draftConfig, setDraftConfig] = useState<CandadoConfig>(config);

  const [pantalla, setPantalla] = useState<'config' | 'juego'>('config');
  const [estado, setEstado] = useState<EstadoCandado | null>(null);
  const [matchIdLocal, setMatchIdLocal] = useState<string>('');
  const [resumenPuntosLocal, setResumenPuntosLocal] = useState<ResumenPuntosCandado>({
    estado: 'idle',
    puntosOtorgados: 0,
  });
  const [entradaActual, setEntradaActual] = useState<string[]>(['', '', '', '']);
  const [cursorIdx, setCursorIdx] = useState<number>(0);
  const [tiempoSegundos, setTiempoSegundos] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState<boolean>(false);

  const [modoNotas, setModoNotas] = useState<boolean>(false);
  const [notasDigitos, setNotasDigitos] = useState<Record<string, NotaDigito>>({});

  const errorTimeoutRef = useRef<number | null>(null);
  const localMatchReportadoRef = useRef<string>('');

  useEffect(() => {
    candadoAudio.setEnabled(sonidoActivo);
  }, [sonidoActivo]);

  useEffect(() => {
    if (!estado || estado.fase !== 'jugando') return;
    const id = window.setInterval(() => {
      setTiempoSegundos(Math.floor((Date.now() - estado.inicioMs) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [estado]);

  const dispararError = useCallback((msg: string) => {
    candadoAudio.playError();
    setErrorMsg(msg);
    setErrorShake(true);
    if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = window.setTimeout(() => {
      setErrorShake(false);
      setErrorMsg(null);
    }, 2200);
  }, []);

  const iniciarNuevaPartida = useCallback((cfgRaw: CandadoConfig) => {
    const cfg = normalizarConfigCandado(cfgRaw);
    const nuevoEstado = iniciarPartidaCandado(cfg);
    setConfig(cfg);
    setEstado(nuevoEstado);
    setMatchIdLocal(generarMatchIdCandado('cndl'));
    setResumenPuntosLocal({ estado: 'idle', puntosOtorgados: 0 });
    localMatchReportadoRef.current = '';
    setEntradaActual(new Array(cfg.digitos).fill(''));
    setCursorIdx(0);
    setTiempoSegundos(0);
    setErrorMsg(null);
    setModoNotas(false);
    setNotasDigitos({});
    setRegistroAmpliado(false);
    setModalModoAbierto(false);
    setModalidadJuego('local');
    setPantalla('juego');
  }, []);

  // Acreditar puntos en modo Local cuando se descifra el candado
  useEffect(() => {
    if (!estado || estado.fase !== 'ganada' || !matchIdLocal) return;
    if (localMatchReportadoRef.current === matchIdLocal) return;
    localMatchReportadoRef.current = matchIdLocal;

    if (!userActual) {
      setResumenPuntosLocal({
        estado: 'invitado',
        puntosOtorgados: 0,
        mensaje: 'Inicia sesión para acumular tus puntos.',
      });
      return;
    }

    let cancelado = false;
    setResumenPuntosLocal({ estado: 'enviando', puntosOtorgados: 0 });

    reportarPuntosCandadoAsync({
      matchId: matchIdLocal,
      modalidad: 'local',
      modo: estado.config.modo,
      digitos: estado.config.digitos,
      conLimite: estado.config.maxIntentos > 0,
      intentosUsados: estado.intentos.length,
      resultado: 'victoria',
    }).then((resp) => {
      if (cancelado) return;
      if (!resp.ok) {
        setResumenPuntosLocal({
          estado: 'error',
          puntosOtorgados: 0,
          mensaje: resp.error || 'No se pudieron registrar los puntos.',
        });
        return;
      }
      if (typeof resp.puntosTotales === 'number') {
        onPuntosActualizados?.(resp.puntosTotales);
      }
      setResumenPuntosLocal({
        estado:
          resp.puntosOtorgados === 0 && resp.cupoDiarioRestante === 0
            ? 'cupo_agotado'
            : 'acreditado',
        puntosOtorgados: resp.puntosOtorgados,
        puntosTotales: resp.puntosTotales,
        cupoDiarioRestante: resp.cupoDiarioRestante,
        mensaje:
          resp.puntosOtorgados === 0 && resp.cupoDiarioRestante === 0
            ? 'Tope diario de 100 pts en Candado alcanzado por hoy.'
            : undefined,
      });
    });

    return () => {
      cancelado = true;
    };
  }, [estado?.fase, matchIdLocal, userActual, onPuntosActualizados]);

  const abrirModalModo = useCallback(() => {
    candadoAudio.playDialTick();
    setDraftConfig(normalizarConfigCandado(pantalla === 'juego' && estado ? estado.config : config));
    setModalModoAbierto(true);
  }, [pantalla, estado, config]);

  const digitosUsadosEnEntrada = useMemo(
    () => new Set(entradaActual.filter((d) => d !== '')),
    [entradaActual]
  );

  // Punto medio: cualquier dígito confirmado como exacto (🟩) queda en verde leve fijo en el teclado
  const confirmadosEnHistorial = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    if (!estado || estado.config.modo !== 'logico') return set;
    for (const it of estado.intentos as IntentoLogico[]) {
      for (const ev of it.digitos) {
        if (ev.estado === 'exacto') {
          set.add(ev.digito);
        }
      }
    }
    return set;
  }, [estado]);

  const ciclarNota = useCallback((d: string) => {
    candadoAudio.playDialTick();
    setNotasDigitos((prev) => ({
      ...prev,
      [d]: prev[d] === 'descartado' ? 'neutro' : 'descartado',
    }));
  }, []);

  const ingresarDigito = useCallback(
    (d: string) => {
      if (!estado || estado.fase !== 'jugando') return;

      if (modoNotas && estado.config.modo === 'logico') {
        ciclarNota(d);
        return;
      }

      if (
        estado.config.modo === 'logico' &&
        !estado.config.permitirRepetidos &&
        entradaActual.some((val, idx) => val === d && idx !== cursorIdx)
      ) {
        dispararError(`El ${d} ya está puesto (modo sin repetidos).`);
        return;
      }

      candadoAudio.playDigitInput();
      setErrorMsg(null);

      setEntradaActual((prev) => {
        const next = [...prev];
        next[cursorIdx] = d;
        return next;
      });

      const len = estado.config.digitos;
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
    [estado, modoNotas, ciclarNota, entradaActual, cursorIdx, dispararError]
  );

  const borrarDigito = useCallback(() => {
    if (!estado || estado.fase !== 'jugando') return;
    candadoAudio.playDelete();
    setErrorMsg(null);
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
  }, [estado, entradaActual, cursorIdx]);

  const limpiarEntrada = useCallback(() => {
    if (!estado || estado.fase !== 'jugando') return;
    candadoAudio.playDelete();
    setEntradaActual(new Array(estado.config.digitos).fill(''));
    setCursorIdx(0);
    setErrorMsg(null);
  }, [estado]);

  const enviarIntento = useCallback(() => {
    if (!estado || estado.fase !== 'jugando') return;
    const combinacion = entradaActual.join('');
    if (combinacion.length !== estado.config.digitos || entradaActual.some((x) => x === '')) {
      dispararError(`Completa los ${estado.config.digitos} dígitos antes de probar.`);
      return;
    }

    const res = registrarIntentoCandado(estado, combinacion);
    if (!res.ok) {
      dispararError(res.error || 'Combinación inválida.');
      return;
    }

    setEstado(res.estado);
    setErrorMsg(null);

    if (res.estado.fase === 'ganada') {
      candadoAudio.playUnlock();
      setTiempoSegundos(
        Math.max(0, Math.floor(((res.estado.finMs || Date.now()) - res.estado.inicioMs) / 1000))
      );
    } else if (res.estado.fase === 'perdida') {
      candadoAudio.playLockFail();
      setTiempoSegundos(
        Math.max(0, Math.floor(((res.estado.finMs || Date.now()) - res.estado.inicioMs) / 1000))
      );
    } else {
      const exactos =
        res.estado.config.modo === 'logico'
          ? (res.intento as IntentoLogico)?.exactos || 0
          : (res.intento as IntentoMayorMenor)?.exactosEnPosicion || 0;
      candadoAudio.playAttemptCheck(exactos);
      setEntradaActual(new Array(estado.config.digitos).fill(''));
      setCursorIdx(0);
    }
  }, [estado, entradaActual, dispararError]);

  useEffect(() => {
    if (
      modalidadJuego !== 'local' ||
      pantalla !== 'juego' ||
      !estado ||
      estado.fase !== 'jugando' ||
      mostrarReglas ||
      registroAmpliado ||
      modalModoAbierto
    ) {
      return;
    }
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
        enviarIntento();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursorIdx((c) => Math.max(0, c - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCursorIdx((c) => Math.min(estado.config.digitos - 1, c + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    modalidadJuego,
    pantalla,
    estado,
    mostrarReglas,
    registroAmpliado,
    modalModoAbierto,
    ingresarDigito,
    borrarDigito,
    limpiarEntrada,
    enviarIntento,
  ]);

  const toggleEstilo = () => {
    if (onToggleEstiloVisual) onToggleEstiloVisual();
    else setEstiloLocal((s) => (s === 'clasico' ? 'minimalista' : 'clasico'));
  };

  const renderListaHistorial = (compacta: boolean) => {
    if (!estado || estado.intentos.length === 0) {
      return (
        <div
          className={
            esMinimalista
              ? 'h-full flex items-center justify-center text-center px-3 text-xs text-slate-400'
              : 'h-full flex items-center justify-center text-center px-3 text-xs font-bold text-[#86542d]'
          }
        >
          Prueba una clave para ver tus pistas aquí.
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {estado.intentos.map((it) => {
          if (estado.config.modo === 'logico') {
            const itemA = it as IntentoLogico;
            return (
              <div
                key={itemA.numero}
                className={
                  esMinimalista
                    ? 'px-2 py-1.5 rounded-xl bg-slate-800/75 border border-white/10 flex items-center justify-between gap-1.5'
                    : 'px-2 py-1.5 rounded-xl bg-white border-2 border-[#2b2140] flex items-center justify-between gap-1.5 shadow-2xs'
                }
              >
                <span className="text-[10px] font-black opacity-65 tabular-nums w-5 shrink-0">
                  #{itemA.numero}
                </span>
                <div className="flex flex-wrap items-center gap-1 flex-1 justify-center min-w-0">
                  {itemA.digitos.map((ev, dIdx) => (
                    <div
                      key={dIdx}
                      title={
                        ev.estado === 'exacto'
                          ? 'Exacto (mismo lugar)'
                          : ev.estado === 'desubicado'
                          ? 'Existe en otro lugar'
                          : 'No está en la clave'
                      }
                      className={`${
                        estado.config.digitos >= 8
                          ? compacta
                            ? 'w-6 h-6 text-[11px]'
                            : 'w-7 h-7 text-xs'
                          : compacta
                          ? 'w-7 h-7 text-xs'
                          : 'w-8 h-8 text-sm'
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
                      <span className="text-[7px] leading-none mt-0.5">
                        {ev.estado === 'exacto' ? '✓' : ev.estado === 'desubicado' ? '↔' : '✕'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-black tabular-nums text-right leading-none shrink-0 flex items-center gap-1">
                  <span className="text-[#2b8a3e]">{itemA.exactos}✓</span>
                  <span className="text-[#d9480f]">{itemA.desubicados}↔</span>
                </div>
              </div>
            );
          }

          const itemB = it as IntentoMayorMenor;
          const prox = INFO_PROXIMIDAD[itemB.proximidad];
          return (
            <div
              key={itemB.numero}
              className={
                esMinimalista
                  ? 'px-2.5 py-1.5 rounded-xl bg-slate-800/75 border border-white/10 flex items-center justify-between gap-2'
                  : 'px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#2b2140] flex items-center justify-between gap-2 shadow-2xs'
              }
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-black opacity-65 tabular-nums">
                  #{itemB.numero}
                </span>
                <span className="font-mono font-black text-sm tracking-wider tabular-nums">
                  {itemB.entrada}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-1.5 py-0.5 rounded-lg border text-[10px] font-black ${
                    itemB.direccion === 'exacto'
                      ? 'bg-[#d3f9d8] text-[#134e20] border-[#2b8a3e]'
                      : itemB.direccion === 'alto'
                      ? esMinimalista
                        ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/40'
                        : 'bg-[#e7f5ff] text-[#1864ab] border-[#339af0]'
                      : esMinimalista
                      ? 'bg-orange-500/25 text-orange-200 border-orange-400/40'
                      : 'bg-[#fff4e6] text-[#d9480f] border-[#fd7e14]'
                  }`}
                >
                  {itemB.direccion === 'exacto'
                    ? '🔓 Exacto'
                    : itemB.direccion === 'alto'
                    ? '↑ Más alto'
                    : '↓ Más bajo'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-lg border text-[10px] font-black ${
                    esMinimalista ? prox.claseMin : prox.claseClasica
                  }`}
                >
                  {prox.icono} {prox.texto}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`relative w-full min-h-screen flex flex-col items-center justify-start px-3 py-2.5 sm:px-5 sm:py-3.5 z-10 transition-colors duration-300 ${
        esMinimalista
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100'
          : 'text-[#2b2140]'
      }`}
    >
      {/* Barra superior compacta con 🕹️ Juegos */}
      <header className="w-full max-w-4xl flex items-center justify-between gap-1.5 z-30 mb-2 min-w-0">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              candadoAudio.playDialTick();
              setMenuJuegosAbierto((v) => !v);
            }}
            className={
              esMinimalista
                ? 'flex items-center gap-1.5 bg-slate-900/85 hover:bg-slate-800 text-slate-100 px-2.5 py-1 rounded-xl border border-white/15 shadow-sm cursor-pointer transition-all'
                : 'flex items-center gap-1.5 bg-white hover:bg-[#fff9db] px-2.5 py-1 rounded-2xl border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] active:translate-y-0.5 cursor-pointer transition-all'
            }
          >
            <span className="text-sm">🕹️</span>
            <span className={esMinimalista ? 'font-semibold text-xs' : 'font-black text-xs'}>
              Juegos
            </span>
            <span className={esMinimalista ? 'text-[10px] text-slate-400' : 'text-[10px] font-black text-[#86542d]'}>
              {menuJuegosAbierto ? '▴' : '▾'}
            </span>
          </button>

          {menuJuegosAbierto && (
            <div
              className={
                esMinimalista
                  ? 'absolute top-10 left-0 w-56 bg-slate-900/95 border border-white/15 rounded-xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 z-40'
                  : 'absolute top-10 left-0 w-56 bg-[#fff8e7] border-3 border-[#2b2140] rounded-2xl p-2 shadow-[0_6px_0_#2b2140,0_12px_20px_rgba(0,0,0,0.3)] flex flex-col gap-1.5 z-40'
              }
            >
              <button
                type="button"
                onClick={async () => {
                  candadoAudio.playDialTick();
                  setMenuJuegosAbierto(false);
                  await candadoOnlineService.leaveRoom();
                  onVolverAMurosLocos();
                }}
                className={
                  esMinimalista
                    ? 'px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/90 border border-white/10 flex items-center justify-between text-xs font-semibold text-slate-200 cursor-pointer text-left'
                    : 'px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#fff9db] border-2 border-[#2b2140] flex items-center justify-between text-xs font-black text-[#2b2140] cursor-pointer text-left'
                }
              >
                <span>🧱 Muros Locos</span>
                <span className={esMinimalista ? 'text-[10px] text-slate-400' : 'text-[10px] font-bold text-[#86542d]'}>
                  Principal ↗
                </span>
              </button>

              <div
                className={
                  esMinimalista
                    ? 'px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between text-xs font-semibold text-emerald-300'
                    : 'px-2.5 py-1.5 rounded-xl bg-[#d3f9d8] border-2 border-[#2b2140] flex items-center justify-between text-xs font-black text-[#134e20]'
                }
              >
                <span>🔐 Candado</span>
                <span
                  className={
                    esMinimalista
                      ? 'text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded'
                      : 'text-[9px] bg-white px-1.5 py-0.5 rounded border border-[#2b2140]'
                  }
                >
                  Activo
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => {
              candadoAudio.playDialTick();
              toggleEstilo();
            }}
            className={
              esMinimalista
                ? 'flex items-center gap-1 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-400/30 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-semibold cursor-pointer shrink-0'
                : 'flex items-center gap-1 bg-white hover:bg-[#fff9db] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] px-2 sm:px-2.5 py-1 rounded-2xl text-[11px] font-black cursor-pointer shrink-0'
            }
          >
            <span>{esMinimalista ? '🧸' : '✨'}</span>
            <span className="hidden sm:inline">{esMinimalista ? 'Clásico' : 'Minimal'}</span>
          </button>

          {onToggleSonido && (
            <button
              type="button"
              onClick={onToggleSonido}
              className={
                esMinimalista
                  ? 'w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/15 flex items-center justify-center text-xs cursor-pointer shrink-0'
                  : 'w-7 h-7 sm:w-8 sm:h-8 rounded-2xl bg-white hover:bg-[#fff9db] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] flex items-center justify-center text-xs cursor-pointer shrink-0'
              }
              title={sonidoActivo ? 'Silenciar efectos' : 'Activar efectos'}
              aria-label="Alternar sonido"
            >
              {sonidoActivo ? '🔊' : '🔇'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              candadoAudio.playDialTick();
              setMostrarReglas(true);
            }}
            className={
              esMinimalista
                ? 'px-2 sm:px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/15 text-[11px] font-semibold cursor-pointer shrink-0 flex items-center gap-1'
                : 'px-2 sm:px-2.5 py-1 rounded-2xl bg-white hover:bg-[#fff9db] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-[11px] font-black cursor-pointer shrink-0 flex items-center gap-1'
            }
            title="Ver reglas del Candado"
          >
            <span>❓</span>
            <span className="hidden sm:inline">Reglas</span>
          </button>

          {userActual && (
            <span
              className={
                esMinimalista
                  ? 'hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[11px] font-bold tabular-nums shrink-0'
                  : 'hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-[#fff3bf] border-2 border-[#2b2140] text-[#5c3c00] text-[11px] font-black tabular-nums shrink-0'
              }
              title="Tus puntos acumulados"
            >
              ⭐ {userActual.puntos} pts
            </span>
          )}

          {modalidadJuego === 'local' && pantalla === 'juego' && estado && (
            <>
              <button
                type="button"
                onClick={abrirModalModo}
                className={
                  esMinimalista
                    ? 'px-2 sm:px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/35 text-[11px] font-semibold cursor-pointer tabular-nums shrink-0'
                    : 'px-2 sm:px-2.5 py-1 rounded-2xl bg-[#ffd43b] hover:bg-[#fcc419] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-[11px] font-black cursor-pointer tabular-nums shrink-0'
                }
                title="Cambiar modo de juego o cantidad de dígitos"
              >
                🎛️ {estado.config.digitos}D · Modo
              </button>
              <button
                type="button"
                onClick={() => {
                  candadoAudio.playDialTick();
                  setPantalla('config');
                }}
                className={
                  esMinimalista
                    ? 'px-2 sm:px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-[11px] font-semibold cursor-pointer shrink-0 flex items-center gap-1'
                    : 'px-2 sm:px-2.5 py-1 rounded-2xl bg-white hover:bg-[#fff9db] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-[11px] font-black cursor-pointer shrink-0 flex items-center gap-1'
                }
                title="Volver al inicio de Candado"
              >
                <span>⚙️</span>
                <span className="hidden sm:inline">Inicio</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MODO ONLINE P2P AISLADO                                               */}
      {/* ===================================================================== */}
      {modalidadJuego === 'p2p' && (
        <CandadoOnlineView
          userActual={userActual}
          esMinimalista={esMinimalista}
          animacionesReducidas={animacionesReducidas}
          configInicial={{ ...config, tiempoTurnoSeg: 45 }}
          onPuntosActualizados={onPuntosActualizados}
          onVolverALocal={async () => {
            await candadoOnlineService.leaveRoom();
            setModalidadJuego('local');
            setPantalla('config');
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* PANTALLA DE CONFIGURACIÓN LOCAL                                       */}
      {/* ===================================================================== */}
      {modalidadJuego === 'local' && pantalla === 'config' && (
        <main className="w-full max-w-lg my-auto py-2 flex flex-col">
          <div
            className={
              esMinimalista
                ? 'rounded-3xl bg-slate-900/90 border border-white/15 p-4 sm:p-5 shadow-2xl backdrop-blur-md'
                : 'rounded-3xl bg-[#fff8e7] border-3 border-[#2b2140] p-4 sm:p-5 shadow-[0_8px_0_#2b2140,0_16px_28px_rgba(0,0,0,0.25)]'
            }
          >
            <div className="flex items-start justify-between gap-2 mb-3.5">
              <div>
                <h1
                  className={
                    esMinimalista
                      ? 'text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2'
                      : 'text-xl sm:text-2xl font-black text-[#2b2140] flex items-center gap-2'
                  }
                >
                  <span>🔐</span>
                  <span>Candado</span>
                </h1>
                <p
                  className={
                    esMinimalista
                      ? 'text-[11px] text-slate-400 mt-0.5'
                      : 'text-[11px] font-bold text-[#6c4f3d] mt-0.5'
                  }
                >
                  {userActual
                    ? `${userActual.nombre} · ⭐ ${userActual.puntos} pts`
                    : 'Deducción numérica · Local y Duelo P2P'}
                </p>
              </div>
              <button
                type="button"
                onClick={onVolverAMurosLocos}
                className={
                  esMinimalista
                    ? 'px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-slate-200 cursor-pointer shrink-0'
                    : 'px-2.5 py-1 rounded-xl bg-white hover:bg-[#f1f3f5] border-2 border-[#2b2140] text-[11px] font-black text-[#2b2140] cursor-pointer shrink-0'
                }
              >
                ◀ Volver
              </button>
            </div>

            {/* Selector principal de modalidad: Local vs Duelo P2P */}
            <div className="grid grid-cols-2 gap-2 mb-3.5">
              <button
                type="button"
                onClick={() => candadoAudio.playDialTick()}
                className={
                  esMinimalista
                    ? 'py-2 px-3 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-100 text-xs font-black text-left cursor-pointer'
                    : 'py-2 px-3 rounded-2xl bg-[#d3f9d8] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-[#134e20] text-xs font-black text-left cursor-pointer'
                }
              >
                <span className="block">🏠 Solo / Local</span>
                <span className="text-[10px] opacity-80 font-bold">Hasta +22 pts · Tu ritmo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  candadoAudio.playDialTick();
                  setModalidadJuego('p2p');
                }}
                className={
                  esMinimalista
                    ? 'py-2 px-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-white/15 text-slate-200 text-xs font-black text-left cursor-pointer transition-all'
                    : 'py-2 px-3 rounded-2xl bg-white hover:bg-[#e7f5ff] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-[#1864ab] text-xs font-black text-left cursor-pointer transition-all'
                }
              >
                <span className="block">🌐 Duelo P2P 1v1</span>
                <span className="text-[10px] opacity-80 font-bold">Salas Online · SHA-256</span>
              </button>
            </div>

            {/* Resumen interactivo de Modo de Juego y Dígitos (estilo Aspecto de Muros Locos) */}
            <div className="mb-3">
              <label
                className={
                  esMinimalista
                    ? 'block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5'
                    : 'block text-[11px] font-black uppercase tracking-wider text-[#593922] mb-1.5'
                }
              >
                1. Modo de juego y dígitos
              </label>

              <button
                type="button"
                onClick={abrirModalModo}
                className={
                  esMinimalista
                    ? 'w-full p-3 rounded-2xl bg-slate-800/85 hover:bg-slate-800 border border-white/15 flex items-center justify-between gap-3 text-left cursor-pointer transition-all'
                    : 'w-full p-3 rounded-2xl bg-white hover:bg-[#fff9db] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5 flex items-center justify-between gap-3 text-left cursor-pointer transition-all'
                }
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-sm">
                      {config.modo === 'logico' ? '🧠 Candado Lógico' : '🌡️ Mayor / Menor'}
                    </span>
                    <span
                      className={
                        esMinimalista
                          ? 'px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[11px] font-bold tabular-nums'
                          : 'px-2 py-0.5 rounded-lg bg-[#ffd43b] text-[#2b2140] border border-[#2b2140] text-[11px] font-black tabular-nums'
                      }
                    >
                      {ETIQUETAS_DIGITOS[config.digitos].icono} {config.digitos} Dígitos (
                      {ETIQUETAS_DIGITOS[config.digitos].metal})
                    </span>
                  </div>
                  <p
                    className={
                      esMinimalista
                        ? 'text-[11px] text-slate-400 mt-1 truncate'
                        : 'text-[11px] font-bold text-[#6c4f3d] mt-1 truncate'
                    }
                  >
                    {config.modo === 'logico'
                      ? config.permitirRepetidos
                        ? '4 a 16 dígitos · Dígitos repetidos permitidos'
                        : '4 a 10 dígitos · Dígitos únicos sin repetir'
                      : '4 a 10 dígitos · ↑ Alto / ↓ Bajo + Proximidad'}
                  </p>
                </div>

                <span
                  className={
                    esMinimalista
                      ? 'px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold shrink-0'
                      : 'px-2.5 py-1.5 rounded-xl bg-[#d3f9d8] border-2 border-[#2b2140] text-[#134e20] text-xs font-black shrink-0'
                  }
                >
                  🎛️ Elegir
                </span>
              </button>
            </div>

            {/* 2. Límite de intentos */}
            <div className="mb-3.5">
              <label
                className={
                  esMinimalista
                    ? 'block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5'
                    : 'block text-[11px] font-black uppercase tracking-wider text-[#593922] mb-1.5'
                }
              >
                2. Intentos (Ilimitado por defecto)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {OPCIONES_INTENTOS.map((op) => {
                  const activo = config.maxIntentos === op.valor;
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => {
                        candadoAudio.playDialTick();
                        setConfig((prev) => ({ ...prev, maxIntentos: op.valor }));
                      }}
                      className={`min-h-[42px] px-1 py-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                        activo
                          ? esMinimalista
                            ? 'bg-cyan-500/25 border-2 border-cyan-400 text-white'
                            : 'bg-[#a5d8ff] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] text-[#1864ab]'
                          : esMinimalista
                          ? 'bg-slate-800/70 border border-white/10 text-slate-300 hover:bg-slate-800'
                          : 'bg-white border-2 border-[#2b2140]/55 text-[#2b2140] hover:bg-[#fff9db]'
                      }`}
                    >
                      <span className="font-black text-xs sm:text-sm tabular-nums leading-none">
                        {op.etiqueta}
                      </span>
                      <span className="text-[9px] font-bold opacity-75 mt-0.5 leading-none">
                        {op.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                candadoAudio.playDigitInput();
                iniciarNuevaPartida(config);
              }}
              className={
                esMinimalista
                  ? 'w-full min-h-[44px] py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg cursor-pointer transition-all'
                  : 'w-full min-h-[44px] py-2.5 rounded-2xl bg-[#51cf66] hover:bg-[#40c057] text-[#134e20] border-2 border-[#2b2140] shadow-[0_4px_0_#2b2140] active:translate-y-0.5 active:shadow-none font-black text-sm cursor-pointer transition-all'
              }
            >
              🔓 Abrir Candado (+{calcularPreviewPuntosLocal(config, config.maxIntentos > 0 ? Math.min(config.digitos + 2, config.maxIntentos) : config.digitos + 2)} pts máx.)
            </button>
          </div>
        </main>
      )}

      {/* ===================================================================== */}
      {/* PANTALLA DE JUEGO ACTIVO LOCAL (GEOMETRÍA FIJA — ZERO LAYOUT SHIFT)   */}
      {/* ===================================================================== */}
      {modalidadJuego === 'local' && pantalla === 'juego' && estado && (
        <main className="w-full max-w-4xl flex flex-col md:grid md:grid-cols-[minmax(0,390px)_minmax(0,1fr)] items-center md:items-start justify-center gap-2.5 sm:gap-4 mt-1">
          {/* Columna izquierda: Bóveda + Franja fija de estado + Teclado */}
          <section className="w-full max-w-[400px] flex flex-col items-center gap-2">
            <CandadoVault
              digitos={estado.config.digitos}
              entradaActual={
                estado.fase !== 'jugando' ? estado.secreto.split('') : entradaActual
              }
              cursorIdx={cursorIdx}
              onSelectSlot={(idx) => {
                candadoAudio.playDialTick();
                setCursorIdx(idx);
              }}
              fase={estado.fase}
              modo={estado.config.modo}
              intentosUsados={estado.intentos.length}
              maxIntentos={estado.config.maxIntentos}
              tiempoSegundos={tiempoSegundos}
              errorShake={errorShake}
              esMinimalista={esMinimalista}
              animacionesReducidas={animacionesReducidas}
            />

            {/* Franja de altura fija (h-7) para avisos / rango sin mover el teclado */}
            <div className="w-full h-7 flex items-center justify-center">
              {errorMsg ? (
                <div
                  className={
                    esMinimalista
                      ? 'w-full h-7 px-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[11px] font-bold flex items-center justify-center truncate'
                      : 'w-full h-7 px-2.5 rounded-xl bg-[#ffe3e3] border-2 border-[#c92a2a] text-[#c92a2a] text-[11px] font-black flex items-center justify-center truncate'
                  }
                >
                  ⚠️ {errorMsg}
                </div>
              ) : estado.config.modo === 'mayor_menor' && estado.fase === 'jugando' ? (
                <div
                  className={
                    esMinimalista
                      ? 'w-full h-7 px-2.5 rounded-xl bg-slate-900/80 border border-white/15 text-[11px] font-semibold text-slate-300 flex items-center justify-between tabular-nums'
                      : 'w-full h-7 px-2.5 rounded-xl bg-white/90 border-2 border-[#2b2140] text-[11px] font-black text-[#2b2140] flex items-center justify-between tabular-nums'
                  }
                >
                  <span>🎯 Rango posible:</span>
                  <span className="font-mono">
                    {formatearNumeroConCeros(estado.rangoMinActual, estado.config.digitos)} —{' '}
                    {formatearNumeroConCeros(estado.rangoMaxActual, estado.config.digitos)}
                  </span>
                </div>
              ) : (
                <div
                  className={
                    esMinimalista
                      ? 'w-full h-7 px-2.5 rounded-xl bg-slate-900/50 border border-white/10 text-[11px] font-medium text-slate-400 flex items-center justify-center'
                      : 'w-full h-7 px-2.5 rounded-xl bg-white/70 border border-[#2b2140]/30 text-[11px] font-bold text-[#593922] flex items-center justify-center'
                  }
                >
                  {estado.config.modo === 'logico'
                    ? estado.config.permitirRepetidos
                      ? 'Pistas: 🟩 Exacto · 🟨 Lugar · ⬛ Ausente'
                      : 'Dígitos únicos · 🟩 Exacto · 🟨 Lugar · ⬛ Ausente'
                    : 'Adivina el número secreto'}
                </div>
              )}
            </div>

            {/* Teclado compacto o Tarjeta de resultado */}
            {estado.fase !== 'jugando' ? (
              <div
                className={`w-full rounded-2xl p-3.5 text-center ${
                  estado.fase === 'ganada'
                    ? esMinimalista
                      ? 'bg-emerald-950/75 border border-emerald-400/50 text-emerald-100'
                      : 'bg-[#d3f9d8] border-3 border-[#2b2140] shadow-[0_5px_0_#2b2140] text-[#134e20]'
                    : esMinimalista
                    ? 'bg-rose-950/75 border border-rose-400/50 text-rose-100'
                    : 'bg-[#ffe3e3] border-3 border-[#2b2140] shadow-[0_5px_0_#2b2140] text-[#c92a2a]'
                }`}
              >
                <div className="text-2xl mb-0.5">{estado.fase === 'ganada' ? '🔓🎉' : '🔒💥'}</div>
                <h2 className="text-base sm:text-lg font-black">
                  {estado.fase === 'ganada' ? '¡Combinación Descifrada!' : '¡Candado Bloqueado!'}
                </h2>
                <p className="text-xs font-bold mt-1 opacity-90 tabular-nums">
                  Clave:{' '}
                  <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-black/10">
                    {estado.secreto}
                  </span>{' '}
                  · {estado.intentos.length} intentos · {tiempoSegundos}s
                </p>

                {estado.fase === 'ganada' && (
                  <div className="mt-2 text-xs font-black">
                    {resumenPuntosLocal.estado === 'acreditado' && (
                      <span className="px-2.5 py-1 rounded-xl bg-white/80 text-[#134e20] border border-[#2b2140] inline-block">
                        ⭐ +{resumenPuntosLocal.puntosOtorgados} pts acreditados
                      </span>
                    )}
                    {resumenPuntosLocal.estado === 'enviando' && (
                      <span className="opacity-80">⏳ Registrando puntos...</span>
                    )}
                    {(resumenPuntosLocal.estado === 'cupo_agotado' ||
                      resumenPuntosLocal.estado === 'invitado' ||
                      resumenPuntosLocal.estado === 'error') && (
                      <span className="text-[11px] opacity-85">{resumenPuntosLocal.mensaje}</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => iniciarNuevaPartida(estado.config)}
                    className={
                      esMinimalista
                        ? 'min-h-[40px] py-2 px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer'
                        : 'min-h-[40px] py-2 px-2.5 rounded-xl bg-[#51cf66] hover:bg-[#40c057] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] font-black text-xs cursor-pointer'
                    }
                  >
                    🔄 Jugar otra vez
                  </button>
                  <button
                    type="button"
                    onClick={() => setPantalla('config')}
                    className={
                      esMinimalista
                        ? 'min-h-[40px] py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/15 font-bold text-xs cursor-pointer'
                        : 'min-h-[40px] py-2 px-2.5 rounded-xl bg-white hover:bg-[#fff9db] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] font-black text-xs cursor-pointer'
                    }
                  >
                    ⚙️ Cambiar modo
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
                {estado.config.modo === 'logico' && (
                  <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                    <span
                      className={
                        esMinimalista
                          ? 'text-[10px] font-semibold text-slate-400'
                          : 'text-[10px] font-extrabold text-[#6c4f3d]'
                      }
                    >
                      {modoNotas
                        ? 'Toca números para tachar / destachar'
                        : 'Usa botones o tu teclado (0–9)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        candadoAudio.playDialTick();
                        setModoNotas((v) => !v);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-all ${
                        modoNotas
                          ? esMinimalista
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-[#ffd43b] text-[#2b2140] border border-[#2b2140]'
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
                    const esExactoEnHistorial =
                      estado.config.modo === 'logico' && confirmadosEnHistorial.has(d);
                    const yaEnSlot =
                      estado.config.modo === 'logico' &&
                      !estado.config.permitirRepetidos &&
                      digitosUsadosEnEntrada.has(d);

                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => ingresarDigito(d)}
                        className={`relative h-10 sm:h-11 rounded-xl font-mono font-black text-base tabular-nums transition-colors cursor-pointer active:translate-y-0.5 ${
                          nota === 'descartado'
                            ? esMinimalista
                              ? 'bg-slate-950/80 text-slate-600 border border-white/5 line-through'
                              : 'bg-[#dee2e6] text-[#868e96] border-2 border-[#adb5bd] line-through'
                            : esExactoEnHistorial
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
                        <span>{d}</span>
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
                    onClick={enviarIntento}
                    className={
                      esMinimalista
                        ? 'col-span-2 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg cursor-pointer'
                        : 'col-span-2 h-10 rounded-xl bg-[#51cf66] hover:bg-[#40c057] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] active:translate-y-0.5 font-black text-xs sm:text-sm cursor-pointer'
                    }
                  >
                    🔓 Probar clave
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Columna derecha: Registro con ALTURA FIJA (h-[168px] móvil / h-[386px] desktop) para no empujar nada */}
          <aside
            className={
              esMinimalista
                ? 'w-full max-w-[390px] md:max-w-none h-[168px] md:h-[386px] rounded-2xl bg-slate-900/90 border border-white/15 p-3 shadow-xl flex flex-col overflow-hidden'
                : 'w-full max-w-[390px] md:max-w-none h-[168px] md:h-[386px] rounded-2xl bg-[#fff8e7] border-3 border-[#2b2140] p-3 shadow-[0_5px_0_#2b2140] flex flex-col overflow-hidden'
            }
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-current/15 shrink-0">
              <h2 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                <span>📋</span>
                <span>Registro ({estado.intentos.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  candadoAudio.playDialTick();
                  setRegistroAmpliado(true);
                }}
                className={
                  esMinimalista
                    ? 'px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300 border border-white/10 cursor-pointer'
                    : 'px-2 py-0.5 rounded-lg bg-white hover:bg-[#fff9db] text-[10px] font-black text-[#2b2140] border border-[#2b2140] cursor-pointer'
                }
                title="Ver registro completo en pantalla"
              >
                ⤢ Ampliar
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {renderListaHistorial(true)}
            </div>
          </aside>
        </main>
      )}

      {/* Modal selector de Modo de Juego y Dígitos (estilo Aspecto de Muros Locos) */}
      {modalModoAbierto && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setModalModoAbierto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              esMinimalista
                ? 'w-full max-w-lg max-h-[90dvh] rounded-3xl bg-slate-900 border border-white/15 p-4 sm:p-5 shadow-2xl text-slate-100 flex flex-col overflow-hidden'
                : 'w-full max-w-lg max-h-[90dvh] rounded-3xl bg-[#fff8e7] border-4 border-[#2b2140] p-4 sm:p-5 shadow-[0_10px_0_#2b2140,0_20px_35px_rgba(0,0,0,0.35)] text-[#2b2140] flex flex-col overflow-hidden'
            }
          >
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-current/15 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl leading-none">🎛️</span>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black leading-tight truncate">
                    Modo de Juego y Dígitos
                  </h3>
                  <p className="text-[11px] font-bold opacity-75 truncate">
                    Elige la mecánica y la longitud de la clave
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalModoAbierto(false)}
                className="w-8 h-8 rounded-xl bg-black/10 hover:bg-black/20 font-black text-sm cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Contenido desplazable */}
            <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-3.5 pr-0.5">
              {/* 1. Elegir Modo de Juego */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider opacity-75 mb-1.5">
                  1. Elige el modo de juego
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: 'logico' as ModoCandado,
                        icono: '🧠',
                        titulo: 'Candado Lógico',
                        sub: '4 a 16 dígitos · 🟩 Exacto · 🟨 Lugar · ⬛ Ausente',
                      },
                      {
                        id: 'mayor_menor' as ModoCandado,
                        icono: '🌡️',
                        titulo: 'Mayor / Menor',
                        sub: '4 a 10 dígitos · ↑ Alto / ↓ Bajo + Proximidad',
                      },
                    ]
                  ).map((m) => {
                    const activo = draftConfig.modo === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          candadoAudio.playDialTick();
                          setDraftConfig((prev) =>
                            normalizarConfigCandado({ ...prev, modo: m.id })
                          );
                        }}
                        className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                          activo
                            ? esMinimalista
                              ? 'bg-emerald-500/20 border-2 border-emerald-400 text-white'
                              : 'bg-[#d3f9d8] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-[#134e20]'
                            : esMinimalista
                            ? 'bg-slate-800/70 border border-white/10 text-slate-300 hover:bg-slate-800'
                            : 'bg-white border-2 border-[#2b2140]/55 text-[#2b2140] hover:bg-[#fff9db]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs sm:text-sm flex items-center gap-1.5">
                            <span>{m.icono}</span>
                            <span>{m.titulo}</span>
                          </span>
                          {activo && <span className="text-xs font-black">✓</span>}
                        </div>
                        <span className="block text-[10px] font-bold opacity-80 mt-0.5 leading-snug">
                          {m.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Elegir Cantidad de Dígitos */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider opacity-75">
                    2. Elige los dígitos
                  </label>
                  <span className="text-[10px] font-bold opacity-70">
                    {draftConfig.modo === 'logico'
                      ? 'Disponibles: 4 a 16 dígitos'
                      : 'Mayor / Menor: hasta 10 dígitos'}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(draftConfig.modo === 'logico' ? DIGITOS_LOGICO : DIGITOS_MAYOR_MENOR).map(
                    (num) => {
                      const activo = draftConfig.digitos === num;
                      const info = ETIQUETAS_DIGITOS[num];
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            candadoAudio.playDialTick();
                            setDraftConfig((prev) =>
                              normalizarConfigCandado({ ...prev, digitos: num })
                            );
                          }}
                          className={`min-h-[50px] px-2 py-1.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                            activo
                              ? esMinimalista
                                ? 'bg-indigo-500/25 border-2 border-indigo-400 text-white'
                                : 'bg-[#ffd43b] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-[#2b2140]'
                              : esMinimalista
                              ? 'bg-slate-800/70 border border-white/10 text-slate-300 hover:bg-slate-800'
                              : 'bg-white border-2 border-[#2b2140]/55 text-[#2b2140] hover:bg-[#fff9db]'
                          }`}
                        >
                          <span className="font-black text-xs sm:text-sm tabular-nums leading-tight">
                            {num} Dígitos
                          </span>
                          <span className="text-[10px] font-bold opacity-80 leading-tight mt-0.5">
                            {info.icono} {info.metal}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 3. Repetidos (solo en Candado Lógico) */}
              {draftConfig.modo === 'logico' && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider opacity-75 mb-1.5">
                    3. Regla de dígitos
                  </label>
                  <button
                    type="button"
                    disabled={draftConfig.digitos > 10}
                    onClick={() => {
                      candadoAudio.playDialTick();
                      setDraftConfig((prev) =>
                        normalizarConfigCandado({
                          ...prev,
                          permitirRepetidos: !prev.permitirRepetidos,
                        })
                      );
                    }}
                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-black transition-all ${
                      draftConfig.digitos > 10 ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      esMinimalista
                        ? 'bg-slate-800/80 border border-white/15'
                        : 'bg-white border-2 border-[#2b2140]'
                    }`}
                  >
                    <span className="text-left">
                      {draftConfig.digitos > 10
                        ? '🔁 Repetidos obligatorios (14–16 dígitos)'
                        : draftConfig.permitirRepetidos
                        ? '🔁 Dígitos repetidos permitidos'
                        : '✨ Dígitos únicos sin repetir'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                        draftConfig.permitirRepetidos
                          ? 'bg-[#ffd43b] text-[#2b2140]'
                          : 'bg-[#d3f9d8] text-[#134e20]'
                      }`}
                    >
                      {draftConfig.permitirRepetidos ? 'Repetidos ON' : 'Únicos'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Pie del Modal (Botones de Confirmar / Cancelar) */}
            <div className="pt-3 border-t border-current/15 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setModalModoAbierto(false)}
                className={
                  esMinimalista
                    ? 'flex-1 min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 font-bold text-xs cursor-pointer'
                    : 'flex-1 min-h-[42px] rounded-xl bg-white hover:bg-[#f1f3f5] border-2 border-[#2b2140] font-black text-xs cursor-pointer'
                }
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalCfg = normalizarConfigCandado(draftConfig);
                  candadoAudio.playDigitInput();
                  if (pantalla === 'juego') {
                    iniciarNuevaPartida(finalCfg);
                  } else {
                    setConfig(finalCfg);
                    setModalModoAbierto(false);
                  }
                }}
                className={
                  esMinimalista
                    ? 'flex-[2] min-h-[42px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-lg'
                    : 'flex-[2] min-h-[42px] rounded-xl bg-[#51cf66] hover:bg-[#40c057] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5 font-black text-xs sm:text-sm cursor-pointer'
                }
              >
                {pantalla === 'juego' ? '🔓 Aplicar y Nueva Partida' : '✓ Aplicar Selección'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registro Ampliado */}
      {registroAmpliado && estado && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRegistroAmpliado(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              esMinimalista
                ? 'w-full max-w-md max-h-[80vh] rounded-3xl bg-slate-900 border border-white/15 p-4 shadow-2xl text-slate-100 flex flex-col'
                : 'w-full max-w-md max-h-[80vh] rounded-3xl bg-[#fff8e7] border-4 border-[#2b2140] p-4 shadow-[0_10px_0_#2b2140] text-[#2b2140] flex flex-col'
            }
          >
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-current/15">
              <h3 className="text-base font-black">
                📋 Registro completo ({estado.intentos.length})
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
              {renderListaHistorial(false)}
            </div>
          </div>
        </div>
      )}

      {/* Modal rápido de Reglas */}
      {mostrarReglas && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setMostrarReglas(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              esMinimalista
                ? 'w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-5 shadow-2xl text-slate-100'
                : 'w-full max-w-md rounded-3xl bg-[#fff8e7] border-4 border-[#2b2140] p-5 shadow-[0_10px_0_#2b2140] text-[#2b2140]'
            }
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black">🔐 Cómo jugar Candado</h3>
              <button
                type="button"
                onClick={() => setMostrarReglas(false)}
                className="w-8 h-8 rounded-xl bg-black/10 hover:bg-black/20 font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2.5 text-xs leading-relaxed font-semibold">
              <div className="p-2.5 rounded-2xl bg-black/5">
                <strong className="block text-sm font-black mb-0.5">🧠 Mecánica A — Candado Lógico</strong>
                Adivina la combinación de 4 a 16 dígitos. Cada ficha muestra:
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  <li>🟩 <strong>✓ Verde:</strong> Dígito correcto en su posición exacta (se marca en verde leve en el teclado).</li>
                  <li>🟨 <strong>↔ Amarillo:</strong> Existe en la clave pero en otra posición.</li>
                  <li>⬛ <strong>✕ Gris:</strong> No aparece en esa cantidad. Usa <strong>✏️ Tachar</strong> para descartar números.</li>
                </ul>
              </div>
              <div className="p-2.5 rounded-2xl bg-black/5">
                <strong className="block text-sm font-black mb-0.5">🌡️ Mecánica B — Mayor / Menor</strong>
                El candado es un número secreto de 4 a 10 dígitos (incluye ceros al inicio). Recibes dirección (<strong>↑ Más alto</strong> / <strong>↓ Más bajo</strong>), rango reducido y temperatura de cercanía.
              </div>
              <div className="p-2.5 rounded-2xl bg-black/5">
                <strong className="block text-sm font-black mb-0.5">🌐 Duelos Online P2P (1v1)</strong>
                Cada jugador protege su propia clave secreta sellada con <strong>SHA-256</strong> desde el turno 1. Si el Jugador 1 acierta primero, el Jugador 2 tiene su intento igualador para empatar. Al final ambos códigos se revelan y verifican automáticamente.
              </div>
              <p className="text-[11px] opacity-80">
                Puntos: ganar en Local o Duelo P2P suma únicamente <strong>⭐ puntos</strong> a tu cuenta (máximo 100 pts diarios en Candado) sin modificar tus estadísticas de Muros Locos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
