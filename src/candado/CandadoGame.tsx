/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interfaz principal aislada del minijuego Candado (Local y Duelo P2P 1v1 — Mecánica A y Mecánica B).
 * Estética moderna en tonos pastel suaves y cómodos a la vista, sin puntos y con persistencia al recargar.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EstiloVisual, UserCuenta } from '../types/murosLocos';
import { CartoonCharacter } from '../components/CartoonCharacter';
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
} from './types';

interface CandadoGameProps {
  userActual: UserCuenta | null;
  sonidoActivo: boolean;
  animacionesReducidas: boolean;
  estiloVisual?: EstiloVisual;
  onToggleEstiloVisual?: () => void;
  onToggleSonido?: () => void;
  onVolverAMurosLocos: () => void;
}

const CANDADO_SESSION_KEY = 'candado_game_session_v1';
const CANDADO_THEME_KEY = 'candado_theme_pref_v2';
const CANDADO_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function cargarTemaCandado(): EstiloVisual {
  if (typeof window === 'undefined') return 'minimalista';
  try {
    const saved = window.localStorage.getItem(CANDADO_THEME_KEY);
    return saved === 'clasico' ? 'clasico' : 'minimalista';
  } catch {
    return 'minimalista';
  }
}

interface PersistedCandadoSession {
  savedAt: number;
  pantalla: 'menu' | 'config' | 'juego';
  modalidadJuego: 'local' | 'p2p';
  estiloLocal: EstiloVisual;
  config: CandadoConfig;
  estado: EstadoCandado | null;
  entradaActual: string[];
  cursorIdx: number;
  notasDigitos: Record<string, NotaDigito>;
  modoNotas: boolean;
}

function cargarSesionCandado(): PersistedCandadoSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CANDADO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCandadoSession;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > CANDADO_SESSION_MAX_AGE_MS) {
      window.localStorage.removeItem(CANDADO_SESSION_KEY);
      return null;
    }
    const cfg = normalizarConfigCandado(
      parsed.config || { modo: 'logico', digitos: 4, maxIntentos: 0, permitirRepetidos: false }
    );
    let pantallaValidada: 'menu' | 'config' | 'juego' =
      parsed.pantalla === 'config' || parsed.pantalla === 'juego' ? parsed.pantalla : 'menu';
    const estadoValidado: EstadoCandado | null =
      parsed.estado && typeof parsed.estado.secreto === 'string' ? parsed.estado : null;
    if (pantallaValidada === 'juego' && !estadoValidado) {
      pantallaValidada = 'config';
    }
    const entradaValidada =
      Array.isArray(parsed.entradaActual) && parsed.entradaActual.length === cfg.digitos
        ? parsed.entradaActual.map((d) => (typeof d === 'string' ? d : ''))
        : new Array(cfg.digitos).fill('');

    return {
      savedAt: parsed.savedAt,
      pantalla: pantallaValidada,
      modalidadJuego: parsed.modalidadJuego === 'p2p' ? 'p2p' : 'local',
      estiloLocal: parsed.estiloLocal === 'clasico' ? 'clasico' : 'minimalista',
      config: cfg,
      estado: estadoValidado,
      entradaActual: entradaValidada,
      cursorIdx:
        typeof parsed.cursorIdx === 'number'
          ? Math.max(0, Math.min(cfg.digitos - 1, parsed.cursorIdx))
          : 0,
      notasDigitos:
        parsed.notasDigitos && typeof parsed.notasDigitos === 'object' ? parsed.notasDigitos : {},
      modoNotas: Boolean(parsed.modoNotas),
    };
  } catch {
    return null;
  }
}

export function limpiarSesionCandadoPersistida(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CANDADO_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
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

const OPCIONES_INTENTOS: { valor: LimiteIntentosCandado; etiqueta: string; desc: string }[] = [
  { valor: 0, etiqueta: '∞', desc: 'Libre' },
  { valor: 10, etiqueta: '10', desc: 'Reto' },
  { valor: 12, etiqueta: '12', desc: 'Normal' },
  { valor: 15, etiqueta: '15', desc: 'Cómodo' },
  { valor: 20, etiqueta: '20', desc: 'Amplio' },
];

const INFO_PROXIMIDAD: Record<
  NivelProximidad,
  { texto: string; clasePastel: string; claseOscura: string }
> = {
  exacto: {
    texto: 'Exacto',
    clasePastel: 'bg-[#C4EED7] text-[#0F3D27] border-[#8AD2AE]',
    claseOscura: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/35',
  },
  hirviendo: {
    texto: 'Muy cerca',
    clasePastel: 'bg-[#FAD8DD] text-[#661924] border-[#EEB1B9]',
    claseOscura: 'bg-rose-400/20 text-rose-200 border-rose-400/35',
  },
  caliente: {
    texto: 'Cerca',
    clasePastel: 'bg-[#FDE4D2] text-[#632D0D] border-[#F2C3A3]',
    claseOscura: 'bg-orange-400/20 text-orange-200 border-orange-400/35',
  },
  tibio: {
    texto: 'Tibio',
    clasePastel: 'bg-[#FCE8B8] text-[#4A3309] border-[#EAD08E]',
    claseOscura: 'bg-amber-300/20 text-amber-200 border-amber-300/30',
  },
  frio: {
    texto: 'Lejos',
    clasePastel: 'bg-[#DCEBFF] text-[#143254] border-[#A6C8F5]',
    claseOscura: 'bg-sky-400/20 text-sky-200 border-sky-400/30',
  },
  muy_frio: {
    texto: 'Muy lejos',
    clasePastel: 'bg-[#EFE9D8] text-[#3A3F54] border-[#D8CEB6]',
    claseOscura: 'bg-slate-700/60 text-slate-300 border-slate-500/35',
  },
};

export const CandadoGame: React.FC<CandadoGameProps> = ({
  userActual,
  sonidoActivo,
  animacionesReducidas,
  estiloVisual: estiloProp = 'minimalista',
  onToggleEstiloVisual,
  onToggleSonido,
  onVolverAMurosLocos,
}) => {
  const sesionInicialRef = useRef<PersistedCandadoSession | null>(undefined as any);
  if (sesionInicialRef.current === undefined) {
    sesionInicialRef.current = cargarSesionCandado();
  }
  const sesionInit = sesionInicialRef.current;

  const [estiloLocal, setEstiloLocal] = useState<EstiloVisual>(() => cargarTemaCandado());
  const estilo = onToggleEstiloVisual ? estiloProp : estiloLocal;
  const esMinimalista = estilo === 'minimalista';

  const [menuJuegosAbierto, setMenuJuegosAbierto] = useState(false);
  const [mostrarReglas, setMostrarReglas] = useState(false);
  const [registroAmpliado, setRegistroAmpliado] = useState(false);
  const [modalModoAbierto, setModalModoAbierto] = useState(false);

  const [modalidadJuego, setModalidadJuego] = useState<'local' | 'p2p'>(
    () => sesionInit?.modalidadJuego || 'local'
  );

  const [config, setConfig] = useState<CandadoConfig>(
    () =>
      sesionInit?.config || {
        modo: 'logico',
        digitos: 4,
        maxIntentos: 0,
        permitirRepetidos: false,
      }
  );
  const [draftConfig, setDraftConfig] = useState<CandadoConfig>(config);

  const [pantalla, setPantalla] = useState<'menu' | 'config' | 'juego'>(
    () => sesionInit?.pantalla || 'menu'
  );
  const [estado, setEstado] = useState<EstadoCandado | null>(() => sesionInit?.estado || null);
  const [entradaActual, setEntradaActual] = useState<string[]>(
    () => sesionInit?.entradaActual || new Array(4).fill('')
  );
  const [cursorIdx, setCursorIdx] = useState<number>(() => sesionInit?.cursorIdx || 0);
  const [tiempoSegundos, setTiempoSegundos] = useState<number>(() => {
    const est = sesionInit?.estado;
    if (!est) return 0;
    const end = est.finMs || Date.now();
    return Math.max(0, Math.floor((end - est.inicioMs) / 1000));
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState<boolean>(false);

  const [modoNotas, setModoNotas] = useState<boolean>(() => sesionInit?.modoNotas || false);
  const [notasDigitos, setNotasDigitos] = useState<Record<string, NotaDigito>>(
    () => sesionInit?.notasDigitos || {}
  );

  const errorTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    candadoAudio.setEnabled(sonidoActivo);
  }, [sonidoActivo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: PersistedCandadoSession = {
        savedAt: Date.now(),
        pantalla,
        modalidadJuego,
        estiloLocal,
        config,
        estado,
        entradaActual,
        cursorIdx,
        notasDigitos,
        modoNotas,
      };
      window.localStorage.setItem(CANDADO_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [
    pantalla,
    modalidadJuego,
    estiloLocal,
    config,
    estado,
    entradaActual,
    cursorIdx,
    notasDigitos,
    modoNotas,
  ]);

  useEffect(() => {
    if (!estado || estado.fase !== 'jugando') return;
    const id = window.setInterval(() => {
      setTiempoSegundos(Math.max(0, Math.floor((Date.now() - estado.inicioMs) / 1000)));
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

  const iniciarRetoAleatorio = useCallback(() => {
    candadoAudio.playDigitInput();
    const modoAzar: ModoCandado = Math.random() < 0.65 ? 'logico' : 'mayor_menor';
    const opcionesDigitos: DigitosCandado[] =
      modoAzar === 'logico' ? [4, 5, 6, 8] : [4, 5, 6];
    const digitosAzar = opcionesDigitos[Math.floor(Math.random() * opcionesDigitos.length)];
    iniciarNuevaPartida({
      modo: modoAzar,
      digitos: digitosAzar,
      maxIntentos: 12,
      permitirRepetidos: modoAzar === 'logico' && Math.random() < 0.35,
    });
  }, [iniciarNuevaPartida]);

  const salirAMurosLocos = useCallback(async () => {
    candadoAudio.playDialTick();
    setMenuJuegosAbierto(false);
    await candadoOnlineService.leaveRoom();
    limpiarSesionCandadoPersistida();
    onVolverAMurosLocos();
  }, [onVolverAMurosLocos]);

  const abrirModalModo = useCallback(() => {
    candadoAudio.playDialTick();
    setDraftConfig(normalizarConfigCandado(pantalla === 'juego' && estado ? estado.config : config));
    setModalModoAbierto(true);
  }, [pantalla, estado, config]);

  const digitosUsadosEnEntrada = useMemo(
    () => new Set(entradaActual.filter((d) => d !== '')),
    [entradaActual]
  );

  // Dígitos confirmados como exactos en el historial quedan en verde pastel suave en el teclado
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
        dispararError(`El ${d} ya está colocado (modo únicos).`);
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
    if (onToggleEstiloVisual) {
      onToggleEstiloVisual();
      return;
    }
    setEstiloLocal((s) => {
      const next: EstiloVisual = s === 'clasico' ? 'minimalista' : 'clasico';
      try {
        window.localStorage.setItem(CANDADO_THEME_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  const renderListaHistorial = (compacta: boolean) => {
    if (!estado || estado.intentos.length === 0) {
      return (
        <div
          className={
            esMinimalista
              ? 'h-full flex items-center justify-center text-center px-3 text-xs text-slate-400 font-medium'
              : 'h-full flex items-center justify-center text-center px-3 text-xs text-[#3E4359] font-medium'
          }
        >
          Prueba una combinación para ver las pistas aquí.
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
                    ? 'px-2.5 py-1.5 rounded-xl bg-slate-800/70 border border-white/10 flex items-center justify-between gap-1.5'
                    : 'px-2.5 py-1.5 rounded-xl bg-[#FAF4E4] border border-[#DFD5BC] flex items-center justify-between gap-1.5'
                }
              >
                <span
                  className={`text-[10px] font-semibold tabular-nums w-5 shrink-0 ${
                    esMinimalista ? 'opacity-60' : 'text-[#3E4359]'
                  }`}
                >
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
                      } rounded-lg flex flex-col items-center justify-center font-mono font-bold tabular-nums border ${
                        ev.estado === 'exacto'
                          ? esMinimalista
                            ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/40'
                            : 'bg-[#C4EED7] text-[#0F3D27] border-[#8CD2AE]'
                          : ev.estado === 'desubicado'
                          ? esMinimalista
                            ? 'bg-amber-300/20 text-amber-200 border-amber-300/40'
                            : 'bg-[#FCE8B8] text-[#4A3309] border-[#E7CB82]'
                          : esMinimalista
                          ? 'bg-slate-900/90 text-slate-400 border-white/10'
                          : 'bg-[#EFE9D8] text-[#3E4359] border-[#D8CEB6]'
                      }`}
                    >
                      <span className="leading-none">{ev.digito}</span>
                      <span className="text-[7px] leading-none mt-0.5 opacity-85">
                        {ev.estado === 'exacto' ? '✓' : ev.estado === 'desubicado' ? '↔' : '✕'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-bold tabular-nums text-right leading-none shrink-0 flex items-center gap-1.5">
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
          const prox = INFO_PROXIMIDAD[itemB.proximidad];
          return (
            <div
              key={itemB.numero}
              className={
                esMinimalista
                  ? 'px-2.5 py-1.5 rounded-xl bg-slate-800/70 border border-white/10 flex items-center justify-between gap-2'
                  : 'px-2.5 py-1.5 rounded-xl bg-[#FAF4E4] border border-[#DFD5BC] flex items-center justify-between gap-2'
              }
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-[10px] font-semibold tabular-nums ${
                    esMinimalista ? 'opacity-60' : 'text-[#3E4359]'
                  }`}
                >
                  #{itemB.numero}
                </span>
                <span className="font-mono font-bold text-sm tracking-wider tabular-nums">
                  {itemB.entrada}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${
                    itemB.direccion === 'exacto'
                      ? esMinimalista
                        ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/40'
                        : 'bg-[#C4EED7] text-[#0F3D27] border-[#8AD2AE]'
                      : itemB.direccion === 'alto'
                      ? esMinimalista
                        ? 'bg-sky-400/20 text-sky-200 border-sky-400/35'
                        : 'bg-[#DCEBFF] text-[#143254] border-[#A6C8F5]'
                      : esMinimalista
                      ? 'bg-orange-400/20 text-orange-200 border-orange-400/35'
                      : 'bg-[#FDE4D2] text-[#632D0D] border-[#F2C3A3]'
                  }`}
                >
                  {itemB.direccion === 'exacto'
                    ? 'Exacto'
                    : itemB.direccion === 'alto'
                    ? '↑ Más alto'
                    : '↓ Más bajo'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${
                    esMinimalista ? prox.claseOscura : prox.clasePastel
                  }`}
                >
                  {prox.texto}
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
      className={`relative w-full min-h-dvh flex flex-col items-center justify-between p-3 sm:p-5 z-10 transition-colors duration-300 overflow-x-hidden ${
        esMinimalista
          ? 'bg-gradient-to-br from-[#11131E] via-[#151828] to-[#191D30] text-slate-100'
          : 'bg-gradient-to-b from-[#FCF8EC] via-[#FAF4E4] to-[#F7EFE0] text-[#171923]'
      }`}
    >
      {/* ===================================================================== */}
      {/* MODO ONLINE P2P AISLADO                                               */}
      {/* ===================================================================== */}
      {modalidadJuego === 'p2p' && (
        <div className="w-full flex flex-col items-center flex-1">
          <CandadoOnlineView
            userActual={userActual}
            esMinimalista={esMinimalista}
            animacionesReducidas={animacionesReducidas}
            configInicial={{ ...config, tiempoTurnoSeg: 45 }}
            onVolverALocal={async () => {
              await candadoOnlineService.leaveRoom();
              setModalidadJuego('local');
              setPantalla('menu');
            }}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* PANTALLA 1: MENÚ PRINCIPAL MODERNO PASTEL                             */}
      {/* ===================================================================== */}
      {modalidadJuego === 'local' && pantalla === 'menu' && (
        <>
          {/* Top Bar */}
          <div className="w-full max-w-lg flex items-center justify-between px-0.5 sm:px-1 z-30 gap-2 min-w-0">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  candadoAudio.playDialTick();
                  setMenuJuegosAbierto((v) => !v);
                }}
                className={
                  esMinimalista
                    ? 'flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-xl border border-white/10 shadow-xs active:scale-95 cursor-pointer transition-all whitespace-nowrap'
                    : 'flex items-center gap-1.5 bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] text-[#171923] px-3 py-1.5 rounded-xl border border-[#DFD6BF] shadow-2xs active:scale-98 cursor-pointer transition-all whitespace-nowrap'
                }
                title="Cambiar de juego o iniciar reto aleatorio"
              >
                <span className="text-xs font-semibold">Juegos</span>
                <span className="text-[10px] opacity-75">
                  {menuJuegosAbierto ? '▴' : '▾'}
                </span>
              </button>

              {menuJuegosAbierto && (
                <div
                  className={
                    esMinimalista
                      ? 'absolute top-11 left-0 w-60 bg-[#1B1F30]/95 border border-white/12 rounded-2xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
                      : 'absolute top-11 left-0 w-60 bg-[#FFFDF6] border border-[#DFD6BF] rounded-2xl p-2 shadow-[0_14px_32px_-8px_rgba(38,41,59,0.16)] flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
                  }
                >
                  <button
                    type="button"
                    onClick={salirAMurosLocos}
                    className={
                      esMinimalista
                        ? 'px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-white/10 text-left cursor-pointer transition-colors'
                        : 'px-3 py-2 rounded-xl bg-[#FAF4E4] hover:bg-[#F2EBD9] border border-[#DFD6BF] text-left cursor-pointer transition-colors'
                    }
                  >
                    <span className="text-xs font-semibold block">Muros Locos</span>
                    <span
                      className={`text-[11px] block leading-tight mt-0.5 ${
                        esMinimalista ? 'opacity-65' : 'text-[#3E4359]'
                      }`}
                    >
                      Volver al tablero principal ↗
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuJuegosAbierto(false);
                      iniciarRetoAleatorio();
                    }}
                    className={
                      esMinimalista
                        ? 'px-3 py-2 rounded-xl bg-amber-300/15 hover:bg-amber-300/25 border border-amber-300/25 text-left cursor-pointer transition-colors'
                        : 'px-3 py-2 rounded-xl bg-[#FDF4DB] hover:bg-[#FCEAC0] border border-[#EAD59B] text-[#4A3309] text-left cursor-pointer transition-colors'
                    }
                  >
                    <span className="text-xs font-semibold block">Reto Aleatorio</span>
                    <span className="text-[11px] opacity-85 block leading-tight mt-0.5">
                      Clave y dificultad al azar
                    </span>
                  </button>

                  <div
                    className={
                      esMinimalista
                        ? 'px-3 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/25 flex items-center justify-between text-xs font-semibold text-emerald-200'
                        : 'px-3 py-2 rounded-xl bg-[#E1F5EA] border border-[#BCE5CE] flex items-center justify-between text-xs font-semibold text-[#0F3D27]'
                    }
                  >
                    <span>Candado</span>
                    <span className="text-[10px] opacity-85">Activo</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                candadoAudio.playDialTick();
                toggleEstilo();
              }}
              className={
                esMinimalista
                  ? 'flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-white/10 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0'
                  : 'flex items-center gap-1.5 bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] text-[#1F2333] border border-[#DFD6BF] shadow-2xs px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0'
              }
              title="Alternar entre tema Pastel Claro y Oscuro"
            >
              <span>{esMinimalista ? '☀️ Pastel Claro' : '🌙 Modo Oscuro'}</span>
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              {userActual ? (
                <div
                  className={
                    esMinimalista
                      ? 'py-1 px-2.5 rounded-xl bg-slate-800/80 border border-white/10 text-slate-100 flex items-center gap-2 min-w-0'
                      : 'py-1 px-2.5 rounded-xl bg-[#FFFDF6]/95 border border-[#DFD6BF] shadow-2xs flex items-center gap-2 min-w-0'
                  }
                  title="Modo pasatiempo libre"
                >
                  <div className="shrink-0">
                    <CartoonCharacter
                      color={userActual.avatarColor}
                      hat={userActual.avatarHat}
                      ropa={userActual.avatarRopa}
                      ropaColor={userActual.avatarRopaColor}
                      aura={userActual.avatarAura}
                      size={22}
                      showShadow={false}
                    />
                  </div>
                  <div className="leading-tight min-w-0">
                    <span className="text-xs font-semibold max-w-[82px] truncate block">
                      {userActual.nombre}
                    </span>
                    <span
                      className={`text-[10px] block font-medium ${
                        esMinimalista ? 'text-slate-400' : 'text-[#3E4359]'
                      }`}
                    >
                      Pasatiempo
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={salirAMurosLocos}
                  className={
                    esMinimalista
                      ? 'py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer shrink-0 whitespace-nowrap'
                      : 'py-1.5 px-3 rounded-xl bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] border border-[#DFD6BF] shadow-2xs text-xs font-semibold text-[#171923] cursor-pointer shrink-0 whitespace-nowrap'
                  }
                >
                  Principal
                </button>
              )}
            </div>
          </div>

          {/* Título Moderno y Limpio */}
          <div className="flex flex-col items-center mt-4 sm:mt-6 text-center px-2">
            <span
              className={`text-[11px] font-semibold tracking-[0.16em] uppercase mb-2 ${
                esMinimalista ? 'text-indigo-200/75' : 'text-[#3A3F54]'
              }`}
            >
              Pasatiempo de lógica y deducción
            </span>
            <h1
              className={`text-3xl sm:text-5xl font-extrabold tracking-[0.2em] pl-[0.2em] ${
                esMinimalista ? 'text-slate-100' : 'text-[#171923]'
              }`}
            >
              CANDADO
            </h1>
            <div
              className={`mt-2.5 h-1 w-24 rounded-full ${
                esMinimalista
                  ? 'bg-gradient-to-r from-emerald-300/60 via-sky-300/60 to-violet-300/60'
                  : 'bg-gradient-to-r from-[#8CD7B0] via-[#9BC0F5] to-[#BEB0F5]'
              }`}
            />
            <p
              className={`mt-3 text-xs sm:text-sm max-w-xs sm:max-w-md leading-relaxed font-medium ${
                esMinimalista ? 'text-slate-400' : 'text-[#353A4D]'
              }`}
            >
              Descifra la combinación oculta mediante deducción pura o pistas de cercanía.
            </p>
          </div>

          {/* Pieza central minimalista pastel */}
          <div
            className={`flex items-center justify-center gap-2.5 sm:gap-3.5 my-4 p-3 rounded-2xl border select-none ${
              esMinimalista
                ? 'bg-slate-900/60 border-white/10 shadow-inner'
                : 'bg-[#FFFDF6]/90 border-[#DFD6BF] shadow-[0_10px_28px_-10px_rgba(38,41,59,0.08)]'
            }`}
          >
            {[
              {
                txt: '7',
                light: 'bg-[#D7F3E4] border-[#A8DFC2] text-[#104029]',
                dark: 'bg-emerald-400/15 border-emerald-300/35 text-emerald-200',
              },
              {
                txt: '3',
                light: 'bg-[#FDF0CC] border-[#EDD595] text-[#4A3309]',
                dark: 'bg-amber-300/15 border-amber-200/35 text-amber-200',
              },
              {
                txt: '•',
                light: 'bg-[#E9E4FA] border-[#CCC1F2] text-[#2C1F54]',
                dark: 'bg-violet-300/15 border-violet-300/35 text-violet-200',
              },
              {
                txt: '9',
                light: 'bg-[#DCEBFF] border-[#B2CEF5] text-[#143254]',
                dark: 'bg-sky-300/15 border-sky-300/35 text-sky-200',
              },
            ].map((tile, idx) => (
              <div
                key={idx}
                className={`w-12 h-14 sm:w-14 sm:h-16 rounded-xl border flex items-center justify-center font-mono font-bold text-xl sm:text-2xl ${
                  esMinimalista ? tile.dark : tile.light
                }`}
              >
                {tile.txt}
              </div>
            ))}
          </div>

          {/* Botonera principal moderna en pastel */}
          <div className="w-full max-w-xs sm:max-w-sm flex flex-col gap-2.5 mb-5">
            <button
              type="button"
              onClick={() => {
                candadoAudio.playDialTick();
                setPantalla('config');
              }}
              className={
                esMinimalista
                  ? 'w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base bg-emerald-300/90 hover:bg-emerald-200 text-slate-950 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap'
                  : 'w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base bg-[#B7EBD0] hover:bg-[#A4E3C2] text-[#0F3D27] border border-[#8AD2AE] shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap'
              }
            >
              <span>Partida en Solitario</span>
            </button>

            <button
              type="button"
              onClick={iniciarRetoAleatorio}
              className={
                esMinimalista
                  ? 'w-full py-3 px-6 rounded-xl font-semibold text-sm bg-amber-200/15 hover:bg-amber-200/25 text-amber-200 border border-amber-200/30 transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap'
                  : 'w-full py-3 px-6 rounded-xl font-semibold text-sm bg-[#FCE8B8] hover:bg-[#F9DE9E] text-[#4A3309] border border-[#EAD08E] shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap'
              }
            >
              <span>Reto Aleatorio</span>
            </button>

            <button
              type="button"
              onClick={() => {
                candadoAudio.playDialTick();
                setModalidadJuego('p2p');
              }}
              className={
                esMinimalista
                  ? 'w-full py-3 px-6 rounded-xl font-semibold text-sm bg-sky-200/15 hover:bg-sky-200/25 text-sky-200 border border-sky-200/30 transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap'
                  : 'w-full py-3 px-6 rounded-xl font-semibold text-sm bg-[#CEE4FF] hover:bg-[#BBD8FE] text-[#143254] border border-[#A4C6F4] shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap'
              }
            >
              <span>Jugar en Línea (P2P)</span>
            </button>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  candadoAudio.playDialTick();
                  setMostrarReglas(true);
                }}
                className={
                  esMinimalista
                    ? 'py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-800/75 hover:bg-slate-800 text-slate-200 border border-white/10 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap'
                    : 'py-2.5 px-3 rounded-xl font-semibold text-xs bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] text-[#1F2333] border border-[#DFD6BF] shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap'
                }
              >
                <span>Reglas</span>
              </button>

              {onToggleSonido && (
                <button
                  type="button"
                  onClick={onToggleSonido}
                  className={
                    esMinimalista
                      ? 'py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-800/75 hover:bg-slate-800 text-slate-200 border border-white/10 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap'
                      : 'py-2.5 px-3 rounded-xl font-semibold text-xs bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] text-[#1F2333] border border-[#DFD6BF] shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap'
                  }
                >
                  <span>{sonidoActivo ? 'Sonido: ON' : 'Sonido: OFF'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={salirAMurosLocos}
                className={`${
                  esMinimalista
                    ? 'py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-800/75 hover:bg-slate-800 text-slate-200 border border-white/10 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap'
                    : 'py-2.5 px-3 rounded-xl font-semibold text-xs bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] text-[#1F2333] border border-[#DFD6BF] shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap'
                } ${onToggleSonido ? 'col-span-2' : ''}`}
              >
                <span>Muros Locos</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* PANTALLA 2: CONFIGURAR CANDADO                                        */}
      {/* ===================================================================== */}
      {modalidadJuego === 'local' && pantalla === 'config' && (
        <div className="relative w-full flex-1 flex flex-col items-center justify-between max-w-xl mx-auto z-10">
          {/* Header */}
          <div
            className={
              esMinimalista
                ? 'w-full flex items-center justify-between pb-3 mb-2 border-b border-white/10 gap-2'
                : 'w-full flex items-center justify-between pb-3 mb-2 border-b border-[#DFD6BF] gap-2'
            }
          >
            <button
              type="button"
              onClick={() => {
                candadoAudio.playDialTick();
                setPantalla('menu');
              }}
              className={
                esMinimalista
                  ? 'py-1.5 px-3 rounded-xl bg-slate-800/80 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap'
                  : 'py-1.5 px-3 rounded-xl bg-[#FFFDF6] border border-[#DFD6BF] shadow-2xs text-xs font-semibold text-[#1F2333] hover:bg-[#F5EEDB] cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap'
              }
            >
              ◀ Menú
            </button>

            <h2
              className={
                esMinimalista
                  ? 'text-base sm:text-xl font-bold text-slate-100 truncate text-center'
                  : 'text-base sm:text-xl font-bold text-[#171923] truncate text-center'
              }
            >
              Configurar Candado
            </h2>

            <button
              type="button"
              onClick={abrirModalModo}
              className={
                esMinimalista
                  ? 'py-1.5 px-3 rounded-xl bg-violet-300/15 border border-violet-300/30 text-xs font-semibold text-violet-200 hover:bg-violet-300/25 cursor-pointer shrink-0 whitespace-nowrap'
                  : 'py-1.5 px-3 rounded-xl bg-[#EAE4FC] border border-[#CCC1F2] text-xs font-semibold text-[#2E2054] hover:bg-[#DFD6FA] cursor-pointer shrink-0 whitespace-nowrap'
              }
              title="Elegir mecánica y dígitos"
            >
              Dígitos
            </button>
          </div>

          {/* Cuerpo de Configuración */}
          <div className="w-full flex-1 flex flex-col justify-center gap-4 py-1">
            {/* 1. Mecánica */}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={
                  esMinimalista
                    ? 'text-[11px] font-semibold uppercase tracking-wider text-slate-400'
                    : 'text-[11px] font-semibold uppercase tracking-wider text-[#3A3F54]'
                }
              >
                Mecánica del Candado
              </span>
              <div
                className={
                  esMinimalista
                    ? 'relative flex p-1 bg-slate-900/90 rounded-xl border border-white/10 w-full gap-1'
                    : 'relative flex p-1 bg-[#F2EBD9] rounded-xl border border-[#DDD3BA] w-full gap-1'
                }
              >
                {(
                  [
                    { id: 'logico' as ModoCandado, titulo: 'Candado Lógico' },
                    { id: 'mayor_menor' as ModoCandado, titulo: 'Mayor / Menor' },
                  ]
                ).map((m) => {
                  const activo = config.modo === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        candadoAudio.playDialTick();
                        setConfig((prev) => normalizarConfigCandado({ ...prev, modo: m.id }));
                      }}
                      className={`flex-1 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                        activo
                          ? esMinimalista
                            ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-400/35'
                            : 'bg-[#FFFDF6] text-[#171923] border border-[#D4C9AE] shadow-xs'
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

            {/* 2. Longitud de Clave */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-full flex items-center justify-between px-1">
                <span
                  className={
                    esMinimalista
                      ? 'text-[11px] font-semibold uppercase tracking-wider text-slate-400'
                      : 'text-[11px] font-semibold uppercase tracking-wider text-[#3A3F54]'
                  }
                >
                  Longitud de la Clave
                </span>
                <button
                  type="button"
                  onClick={abrirModalModo}
                  className={
                    esMinimalista
                      ? 'text-[11px] font-semibold text-indigo-300 hover:underline cursor-pointer'
                      : 'text-[11px] font-semibold text-[#2B3E78] hover:underline cursor-pointer'
                  }
                >
                  Serie {ETIQUETAS_DIGITOS[config.digitos].metal} · Detalles
                </button>
              </div>
              <div
                className={
                  esMinimalista
                    ? 'grid grid-cols-4 sm:grid-cols-7 gap-1 p-1 bg-slate-900/90 rounded-xl border border-white/10 w-full'
                    : 'grid grid-cols-4 sm:grid-cols-7 gap-1 p-1 bg-[#F2EBD9] rounded-xl border border-[#DDD3BA] w-full'
                }
              >
                {(config.modo === 'logico' ? DIGITOS_LOGICO : DIGITOS_MAYOR_MENOR).map((num) => {
                  const activo = config.digitos === num;
                  const info = ETIQUETAS_DIGITOS[num];
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        candadoAudio.playDialTick();
                        setConfig((prev) => normalizarConfigCandado({ ...prev, digitos: num }));
                      }}
                      className={`py-1.5 px-1 rounded-lg font-semibold text-xs transition-all cursor-pointer flex flex-col items-center leading-tight ${
                        activo
                          ? esMinimalista
                            ? 'bg-indigo-400/25 text-white border border-indigo-300/40'
                            : 'bg-[#FFFDF6] text-[#171923] border border-[#D4C9AE] shadow-xs'
                          : esMinimalista
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-[#3E4359] hover:text-[#171923]'
                      }`}
                    >
                      <span className="tabular-nums font-bold">{num}D</span>
                      <span className="text-[9px] opacity-85">{info.metal}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Regla de dígitos repetidos */}
            {config.modo === 'logico' && (
              <div
                onClick={() => {
                  if (config.digitos > 10) return;
                  candadoAudio.playDialTick();
                  setConfig((prev) =>
                    normalizarConfigCandado({
                      ...prev,
                      permitirRepetidos: !prev.permitirRepetidos,
                    })
                  );
                }}
                className={`p-3 rounded-xl flex items-center justify-between select-none transition-colors ${
                  config.digitos > 10 ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  esMinimalista
                    ? 'bg-slate-900/80 border border-white/10'
                    : 'bg-[#FFFDF6]/95 border border-[#DFD6BF] shadow-2xs'
                }`}
              >
                <div className="text-left pr-3">
                  <span className="text-xs font-semibold block">
                    {config.digitos > 10
                      ? 'Dígitos repetidos obligatorios (14–16 dígitos)'
                      : config.permitirRepetidos
                      ? 'Dígitos repetidos permitidos'
                      : 'Dígitos únicos sin repetir'}
                  </span>
                  <span
                    className={`text-[11px] ${
                      esMinimalista ? 'opacity-70' : 'text-[#3E4359]'
                    }`}
                  >
                    {config.digitos > 10
                      ? 'Con más de 10 posiciones la clave repite números automáticamente.'
                      : 'Actívalo para aumentar la dificultad combinatoria.'}
                  </span>
                </div>
                <div
                  className={`w-10 h-5.5 rounded-full p-0.5 border transition-colors shrink-0 ${
                    config.permitirRepetidos
                      ? esMinimalista
                        ? 'bg-emerald-400/70 border-emerald-300/40'
                        : 'bg-[#97DAB6] border-[#78C29B]'
                      : esMinimalista
                      ? 'bg-slate-700 border-white/15'
                      : 'bg-[#E2D9C2] border-[#C9BEA2]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                      config.permitirRepetidos ? 'translate-x-4' : ''
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 3. Límite de Intentos */}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={
                  esMinimalista
                    ? 'text-[11px] font-semibold uppercase tracking-wider text-slate-400'
                    : 'text-[11px] font-semibold uppercase tracking-wider text-[#3A3F54]'
                }
              >
                Límite de Intentos
              </span>
              <div
                className={
                  esMinimalista
                    ? 'grid grid-cols-5 gap-1 p-1 bg-slate-900/90 rounded-xl border border-white/10 w-full'
                    : 'grid grid-cols-5 gap-1 p-1 bg-[#F2EBD9] rounded-xl border border-[#DDD3BA] w-full'
                }
              >
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
                      className={`py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer leading-tight ${
                        activo
                          ? esMinimalista
                            ? 'bg-sky-400/20 text-white border border-sky-300/40'
                            : 'bg-[#FFFDF6] text-[#171923] border border-[#D4C9AE] shadow-xs'
                          : esMinimalista
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-[#3E4359] hover:text-[#171923]'
                      }`}
                    >
                      <span className="font-bold text-xs sm:text-sm tabular-nums">
                        {op.etiqueta}
                      </span>
                      <span className="text-[9px] opacity-85">{op.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Botón inferior */}
          <button
            type="button"
            onClick={() => {
              candadoAudio.playDigitInput();
              iniciarNuevaPartida(config);
            }}
            className={
              esMinimalista
                ? 'w-full py-3.5 px-6 rounded-xl font-bold text-base bg-emerald-300/90 hover:bg-emerald-200 text-slate-950 shadow-md cursor-pointer flex items-center justify-center gap-2 mt-2 transition-all'
                : 'w-full py-3.5 px-6 rounded-xl font-bold text-base bg-[#B7EBD0] hover:bg-[#A4E3C2] text-[#0F3D27] border border-[#8AD2AE] shadow-xs active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 mt-2 transition-all'
            }
          >
            <span>Abrir Candado</span>
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PANTALLA 3: JUEGO ACTIVO LOCAL (MISMA GEOMETRÍA COMPACTA Y FIJA)      */}
      {/* ===================================================================== */}
      {modalidadJuego === 'local' && pantalla === 'juego' && estado && (
        <div className="w-full flex-1 flex flex-col items-center justify-start">
          {/* Barra superior compacta */}
          <div
            className={
              esMinimalista
                ? 'w-full max-w-4xl flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-slate-900/80 backdrop-blur-xs rounded-xl border border-white/10 shadow-xs mb-2 min-w-0'
                : 'w-full max-w-4xl flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-[#FFFDF6]/92 backdrop-blur-xs rounded-xl border border-[#DFD6BF] shadow-xs mb-2 min-w-0'
            }
          >
            <button
              type="button"
              onClick={() => {
                candadoAudio.playDialTick();
                setPantalla('menu');
              }}
              className={
                esMinimalista
                  ? 'py-1 px-2.5 rounded-lg bg-slate-800 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer shrink-0 whitespace-nowrap'
                  : 'py-1 px-2.5 rounded-lg bg-[#FAF4E4] border border-[#DFD6BF] text-xs font-semibold text-[#1F2333] hover:bg-[#FAD8DD] hover:text-[#661924] cursor-pointer shrink-0 whitespace-nowrap transition-colors'
              }
            >
              ◀ Salir
            </button>

            <div className="text-[11px] sm:text-xs font-semibold truncate min-w-0 text-center">
              Candado · {estado.config.modo === 'logico' ? 'Lógico' : 'Mayor/Menor'} ({estado.config.digitos}D)
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={abrirModalModo}
                className={
                  esMinimalista
                    ? 'py-1 px-2.5 rounded-lg bg-violet-300/15 border border-violet-300/30 text-[11px] font-semibold text-violet-200 cursor-pointer whitespace-nowrap'
                    : 'py-1 px-2.5 rounded-lg bg-[#EAE4FC] border border-[#CCC1F2] text-[11px] font-semibold text-[#2E2054] hover:bg-[#DFD6FA] cursor-pointer whitespace-nowrap'
                }
                title="Cambiar modo o dígitos"
              >
                Modo
              </button>
              {onToggleSonido && (
                <button
                  type="button"
                  onClick={onToggleSonido}
                  className={
                    esMinimalista
                      ? 'w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-xs cursor-pointer'
                      : 'w-7 h-7 rounded-lg bg-[#FAF4E4] border border-[#DFD6BF] flex items-center justify-center text-xs cursor-pointer'
                  }
                  title={sonidoActivo ? 'Silenciar efectos' : 'Activar efectos'}
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
                    ? 'w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold cursor-pointer'
                    : 'w-7 h-7 rounded-lg bg-[#FAF4E4] border border-[#DFD6BF] flex items-center justify-center text-xs font-bold text-[#171923] cursor-pointer'
                }
                title="Reglas de Candado"
              >
                ?
              </button>
            </div>
          </div>

          <main className="w-full max-w-4xl flex flex-col md:grid md:grid-cols-[minmax(0,390px)_minmax(0,1fr)] items-center md:items-start justify-center gap-2.5 sm:gap-4 mt-0.5">
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

              {/* Franja de altura fija (h-7) */}
              <div className="w-full h-7 flex items-center justify-center">
                {errorMsg ? (
                  <div
                    className={
                      esMinimalista
                        ? 'w-full h-7 px-2.5 rounded-xl bg-rose-400/20 border border-rose-400/35 text-rose-200 text-[11px] font-semibold flex items-center justify-center truncate'
                        : 'w-full h-7 px-2.5 rounded-xl bg-[#FAD8DD] border border-[#EEB1B9] text-[#661924] text-[11px] font-semibold flex items-center justify-center truncate'
                    }
                  >
                    {errorMsg}
                  </div>
                ) : estado.config.modo === 'mayor_menor' && estado.fase === 'jugando' ? (
                  <div
                    className={
                      esMinimalista
                        ? 'w-full h-7 px-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-[11px] font-semibold text-slate-300 flex items-center justify-between tabular-nums'
                        : 'w-full h-7 px-2.5 rounded-xl bg-[#FFFDF6]/95 border border-[#DFD6BF] text-[11px] font-semibold text-[#1F2333] flex items-center justify-between tabular-nums'
                    }
                  >
                    <span>Rango posible</span>
                    <span className="font-mono font-bold">
                      {formatearNumeroConCeros(estado.rangoMinActual, estado.config.digitos)} —{' '}
                      {formatearNumeroConCeros(estado.rangoMaxActual, estado.config.digitos)}
                    </span>
                  </div>
                ) : (
                  <div
                    className={
                      esMinimalista
                        ? 'w-full h-7 px-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-[11px] font-medium text-slate-400 flex items-center justify-center gap-2'
                        : 'w-full h-7 px-2.5 rounded-xl bg-[#FFFDF6]/90 border border-[#DFD6BF] text-[11px] font-medium text-[#3A3F54] flex items-center justify-center gap-2'
                    }
                  >
                    {estado.config.modo === 'logico' ? (
                      <>
                        <span>{estado.config.permitirRepetidos ? 'Con repetidos' : 'Únicos'}</span>
                        <span aria-hidden="true">·</span>
                        <span className={esMinimalista ? 'text-emerald-300' : 'text-[#0F5232]'}>
                          ✓ Exacto
                        </span>
                        <span className={esMinimalista ? 'text-amber-300' : 'text-[#734E0D]'}>
                          ↔ Lugar
                        </span>
                        <span>✕ Ausente</span>
                      </>
                    ) : (
                      <span>Adivina el número secreto</span>
                    )}
                  </div>
                )}
              </div>

              {/* Teclado compacto o Tarjeta de resultado */}
              {estado.fase !== 'jugando' ? (
                <div
                  className={`w-full rounded-2xl p-3.5 text-center border ${
                    estado.fase === 'ganada'
                      ? esMinimalista
                        ? 'bg-emerald-950/60 border-emerald-400/35 text-emerald-100'
                        : 'bg-[#DDF5E8] border-[#9AD8B7] text-[#0F3D27] shadow-xs'
                      : esMinimalista
                      ? 'bg-rose-950/60 border-rose-400/35 text-rose-100'
                      : 'bg-[#FCE4E8] border-[#EEB1B9] text-[#661924] shadow-xs'
                  }`}
                >
                  <h2 className="text-base sm:text-lg font-bold">
                    {estado.fase === 'ganada' ? 'Combinación Descifrada' : 'Candado Bloqueado'}
                  </h2>
                  <p className="text-xs font-medium mt-1 opacity-95 tabular-nums">
                    Clave:{' '}
                    <span className="font-mono font-bold text-sm px-1.5 py-0.5 rounded bg-black/5">
                      {estado.secreto}
                    </span>{' '}
                    · {estado.intentos.length} intentos · {tiempoSegundos}s
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => iniciarNuevaPartida(estado.config)}
                      className={
                        esMinimalista
                          ? 'min-h-[40px] py-2 px-2.5 rounded-xl bg-emerald-300/90 hover:bg-emerald-200 text-slate-950 font-bold text-xs cursor-pointer'
                          : 'min-h-[40px] py-2 px-2.5 rounded-xl bg-[#B7EBD0] hover:bg-[#A4E3C2] text-[#0F3D27] border border-[#8AD2AE] font-bold text-xs cursor-pointer'
                      }
                    >
                      Jugar otra vez
                    </button>
                    <button
                      type="button"
                      onClick={() => setPantalla('config')}
                      className={
                        esMinimalista
                          ? 'min-h-[40px] py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/15 font-semibold text-xs cursor-pointer'
                          : 'min-h-[40px] py-2 px-2.5 rounded-xl bg-[#FFFDF6] hover:bg-[#F5EEDB] text-[#171923] border border-[#DFD6BF] font-semibold text-xs cursor-pointer'
                      }
                    >
                      Cambiar modo
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={
                    esMinimalista
                      ? 'w-full rounded-2xl bg-[#1A1E2E]/95 border border-white/10 p-2.5 shadow-xl'
                      : 'w-full rounded-2xl bg-[#FFFDF6]/95 border border-[#DFD6BF] p-2.5 shadow-[0_8px_24px_-8px_rgba(38,41,59,0.08)]'
                  }
                >
                  {estado.config.modo === 'logico' && (
                    <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                      <span
                        className={
                          esMinimalista
                            ? 'text-[10px] font-medium text-slate-400'
                            : 'text-[10px] font-medium text-[#3E4359]'
                        }
                      >
                        {modoNotas
                          ? 'Toca números para tachar o destachar'
                          : 'Usa botones o tu teclado (0–9)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          candadoAudio.playDialTick();
                          setModoNotas((v) => !v);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-all ${
                          modoNotas
                            ? esMinimalista
                              ? 'bg-amber-300/85 text-slate-950'
                              : 'bg-[#E5DCFE] text-[#2E2054] border border-[#C7B7FA]'
                            : esMinimalista
                            ? 'bg-slate-800 text-slate-300 border border-white/10'
                            : 'bg-[#F5EEDB] text-[#1F2333] border border-[#DDD3BA]'
                        }`}
                      >
                        {modoNotas ? 'Tachar: ON' : 'Tachar'}
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
                          className={`relative h-10 sm:h-11 rounded-xl font-mono font-bold text-base tabular-nums transition-colors cursor-pointer active:translate-y-0.5 ${
                            nota === 'descartado'
                              ? esMinimalista
                                ? 'bg-slate-950/80 text-slate-600 border border-white/5 line-through'
                                : 'bg-[#EFE9D8] text-[#6B6E80] border border-[#DDD3BA] line-through'
                              : esExactoEnHistorial
                              ? esMinimalista
                                ? 'bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-200 border border-emerald-400/40'
                                : 'bg-[#DCF5E7] hover:bg-[#CBEFD9] text-[#0F3D27] border border-[#9FDABB]'
                              : yaEnSlot
                              ? esMinimalista
                                ? 'bg-indigo-400/20 text-indigo-200 border border-indigo-400/40'
                                : 'bg-[#E2EEFF] text-[#143254] border border-[#B2CEF8]'
                              : esMinimalista
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10'
                              : 'bg-[#FAF4E4] hover:bg-[#F2EBD9] text-[#171923] border border-[#DDD3BA]'
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
                          ? 'h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-semibold text-xs cursor-pointer'
                          : 'h-10 rounded-xl bg-[#FAF4E4] hover:bg-[#FAD8DD] text-[#1F2333] hover:text-[#661924] border border-[#DDD3BA] font-semibold text-xs cursor-pointer transition-colors'
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
                          : 'h-10 rounded-xl bg-[#FAF4E4] hover:bg-[#FCE8B8] text-[#1F2333] hover:text-[#4A3309] border border-[#DDD3BA] font-semibold text-xs cursor-pointer transition-colors'
                      }
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={enviarIntento}
                      className={
                        esMinimalista
                          ? 'col-span-2 h-10 rounded-xl bg-emerald-300/90 hover:bg-emerald-200 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer transition-colors'
                          : 'col-span-2 h-10 rounded-xl bg-[#B7EBD0] hover:bg-[#A4E3C2] text-[#0F3D27] border border-[#8AD2AE] active:translate-y-0.5 font-bold text-xs sm:text-sm cursor-pointer transition-colors'
                      }
                    >
                      Probar clave
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Columna derecha: Registro con ALTURA FIJA (h-[168px] móvil / h-[386px] desktop) */}
            <aside
              className={
                esMinimalista
                  ? 'w-full max-w-[390px] md:max-w-none h-[168px] md:h-[386px] rounded-2xl bg-[#1A1E2E]/95 border border-white/10 p-3 shadow-xl flex flex-col overflow-hidden'
                  : 'w-full max-w-[390px] md:max-w-none h-[168px] md:h-[386px] rounded-2xl bg-[#FFFDF6]/95 border border-[#DFD6BF] p-3 shadow-[0_8px_24px_-8px_rgba(38,41,59,0.08)] flex flex-col overflow-hidden'
              }
            >
              <div
                className={`flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b shrink-0 ${
                  esMinimalista ? 'border-white/10' : 'border-[#E6DEC8]'
                }`}
              >
                <h2 className="text-xs sm:text-sm font-bold">
                  Registro ({estado.intentos.length})
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
                      : 'px-2 py-0.5 rounded-lg bg-[#F5EEDB] hover:bg-[#ECE2CA] text-[10px] font-semibold text-[#1F2333] border border-[#DDD3BA] cursor-pointer'
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
        </div>
      )}

      {/* Modal selector de Modo de Juego y Dígitos */}
      {modalModoAbierto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setModalModoAbierto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              esMinimalista
                ? 'w-full max-w-lg max-h-[90dvh] rounded-2xl bg-[#1A1E2E] border border-white/12 p-4 sm:p-5 shadow-2xl text-slate-100 flex flex-col overflow-hidden'
                : 'w-full max-w-lg max-h-[90dvh] rounded-2xl bg-[#FFFDF6] border border-[#DFD6BF] p-4 sm:p-5 shadow-[0_20px_50px_-12px_rgba(38,41,59,0.22)] text-[#171923] flex flex-col overflow-hidden'
            }
          >
            {/* Cabecera del Modal */}
            <div
              className={`flex items-center justify-between gap-2 pb-3 border-b shrink-0 ${
                esMinimalista ? 'border-white/10' : 'border-[#E6DEC8]'
              }`}
            >
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold leading-tight truncate">
                  Modo de Juego y Dígitos
                </h3>
                <p
                  className={`text-xs truncate ${
                    esMinimalista ? 'opacity-70' : 'text-[#3E4359]'
                  }`}
                >
                  Elige la mecánica y la longitud de la clave
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalModoAbierto(false)}
                className={
                  esMinimalista
                    ? 'w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-sm cursor-pointer shrink-0'
                    : 'w-8 h-8 rounded-xl bg-[#F5EEDB] hover:bg-[#EAE0C8] text-[#171923] font-bold text-sm cursor-pointer shrink-0'
                }
              >
                ✕
              </button>
            </div>

            {/* Contenido desplazable */}
            <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-4 pr-0.5">
              {/* 1. Elegir Modo */}
              <div>
                <label
                  className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
                    esMinimalista ? 'opacity-70' : 'text-[#3A3F54]'
                  }`}
                >
                  1. Modo de juego
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: 'logico' as ModoCandado,
                        titulo: 'Candado Lógico',
                        sub: '4 a 16 dígitos · ✓ Exacto · ↔ Lugar · ✕ Ausente',
                      },
                      {
                        id: 'mayor_menor' as ModoCandado,
                        titulo: 'Mayor / Menor',
                        sub: '4 a 10 dígitos · ↑ Alto / ↓ Bajo y cercanía',
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
                        className={`p-3 rounded-xl text-left transition-all cursor-pointer border ${
                          activo
                            ? esMinimalista
                              ? 'bg-emerald-400/20 border-emerald-300/45 text-white'
                              : 'bg-[#DDF5E8] border-[#8AD2AE] text-[#0F3D27]'
                            : esMinimalista
                            ? 'bg-slate-800/70 border-white/10 text-slate-300 hover:bg-slate-800'
                            : 'bg-[#FAF4E4] border-[#DFD6BF] text-[#171923] hover:bg-[#F2EBD9]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs sm:text-sm">{m.titulo}</span>
                          {activo && <span className="text-xs font-bold">✓</span>}
                        </div>
                        <span
                          className={`block text-[11px] mt-1 leading-snug ${
                            activo
                              ? 'opacity-90'
                              : esMinimalista
                              ? 'opacity-75'
                              : 'text-[#3E4359]'
                          }`}
                        >
                          {m.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Dígitos */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      esMinimalista ? 'opacity-70' : 'text-[#3A3F54]'
                    }`}
                  >
                    2. Cantidad de dígitos
                  </label>
                  <span
                    className={`text-[11px] ${
                      esMinimalista ? 'opacity-65' : 'text-[#3E4359] font-medium'
                    }`}
                  >
                    {draftConfig.modo === 'logico'
                      ? '4 a 16 dígitos'
                      : 'Hasta 10 dígitos'}
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
                          className={`min-h-[48px] px-2 py-1.5 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                            activo
                              ? esMinimalista
                                ? 'bg-indigo-400/25 border-indigo-300/45 text-white'
                                : 'bg-[#EAE4FC] border-[#BFB2EC] text-[#2B1E54]'
                              : esMinimalista
                              ? 'bg-slate-800/70 border-white/10 text-slate-300 hover:bg-slate-800'
                              : 'bg-[#FAF4E4] border-[#DFD6BF] text-[#171923] hover:bg-[#F2EBD9]'
                          }`}
                        >
                          <span className="font-bold text-xs sm:text-sm tabular-nums leading-tight">
                            {num} Dígitos
                          </span>
                          <span
                            className={`text-[10px] leading-tight mt-0.5 flex items-center gap-1 ${
                              esMinimalista ? 'opacity-75' : 'opacity-90'
                            }`}
                          >
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: info.dotColor }}
                            />
                            <span>{info.metal}</span>
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 3. Repetidos */}
              {draftConfig.modo === 'logico' && (
                <div>
                  <label
                    className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
                      esMinimalista ? 'opacity-70' : 'text-[#3A3F54]'
                    }`}
                  >
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
                    className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition-all border ${
                      draftConfig.digitos > 10 ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      esMinimalista
                        ? 'bg-slate-800/80 border-white/10'
                        : 'bg-[#FAF4E4] border-[#DFD6BF] text-[#171923]'
                    }`}
                  >
                    <span className="text-left">
                      {draftConfig.digitos > 10
                        ? 'Repetidos obligatorios (14–16 dígitos)'
                        : draftConfig.permitirRepetidos
                        ? 'Dígitos repetidos permitidos'
                        : 'Dígitos únicos sin repetir'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${
                        draftConfig.permitirRepetidos
                          ? esMinimalista
                            ? 'bg-amber-300/20 text-amber-200'
                            : 'bg-[#FCE8B8] text-[#4A3309]'
                          : esMinimalista
                          ? 'bg-emerald-400/20 text-emerald-200'
                          : 'bg-[#C4EED7] text-[#0F3D27]'
                      }`}
                    >
                      {draftConfig.permitirRepetidos ? 'Repetidos ON' : 'Únicos'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Pie del Modal */}
            <div
              className={`pt-3 border-t flex items-center gap-2 shrink-0 ${
                esMinimalista ? 'border-white/10' : 'border-[#E6DEC8]'
              }`}
            >
              <button
                type="button"
                onClick={() => setModalModoAbierto(false)}
                className={
                  esMinimalista
                    ? 'flex-1 min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 font-semibold text-xs cursor-pointer'
                    : 'flex-1 min-h-[42px] rounded-xl bg-[#F5EEDB] hover:bg-[#EAE0C8] border border-[#DDD3BA] font-semibold text-xs text-[#1F2333] cursor-pointer'
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
                    ? 'flex-[2] min-h-[42px] rounded-xl bg-emerald-300/90 hover:bg-emerald-200 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer'
                    : 'flex-[2] min-h-[42px] rounded-xl bg-[#B7EBD0] hover:bg-[#A4E3C2] text-[#0F3D27] border border-[#8AD2AE] font-bold text-xs sm:text-sm cursor-pointer'
                }
              >
                {pantalla === 'juego' ? 'Aplicar y Nueva Partida' : 'Aplicar Selección'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registro Ampliado */}
      {registroAmpliado && estado && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRegistroAmpliado(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              esMinimalista
                ? 'w-full max-w-md max-h-[80vh] rounded-2xl bg-[#1A1E2E] border border-white/12 p-4 shadow-2xl text-slate-100 flex flex-col'
                : 'w-full max-w-md max-h-[80vh] rounded-2xl bg-[#FFFDF6] border border-[#DFD6BF] p-4 shadow-[0_20px_50px_-12px_rgba(38,41,59,0.22)] text-[#171923] flex flex-col'
            }
          >
            <div
              className={`flex items-center justify-between mb-2.5 pb-2 border-b ${
                esMinimalista ? 'border-white/10' : 'border-[#E6DEC8]'
              }`}
            >
              <h3 className="text-base font-bold">
                Registro completo ({estado.intentos.length})
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
              {renderListaHistorial(false)}
            </div>
          </div>
        </div>
      )}

      {/* Modal rápido de Reglas */}
      {mostrarReglas && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setMostrarReglas(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              esMinimalista
                ? 'w-full max-w-md rounded-2xl bg-[#1A1E2E] border border-white/12 p-5 shadow-2xl text-slate-100'
                : 'w-full max-w-md rounded-2xl bg-[#FFFDF6] border border-[#DFD6BF] p-5 shadow-[0_20px_50px_-12px_rgba(38,41,59,0.22)] text-[#171923]'
            }
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Cómo jugar Candado</h3>
              <button
                type="button"
                onClick={() => setMostrarReglas(false)}
                className={
                  esMinimalista
                    ? 'w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-sm cursor-pointer'
                    : 'w-8 h-8 rounded-xl bg-[#F5EEDB] hover:bg-[#EAE0C8] text-[#171923] font-bold text-sm cursor-pointer'
                }
              >
                ✕
              </button>
            </div>
            <div className="space-y-2.5 text-xs leading-relaxed">
              <div
                className={`p-3 rounded-xl border ${
                  esMinimalista
                    ? 'bg-slate-800/60 border-white/10'
                    : 'bg-[#FAF4E4] border-[#DFD6BF]'
                }`}
              >
                <strong className="block text-sm font-bold mb-1">
                  Mecánica A — Candado Lógico
                </strong>
                Adivina la combinación de 4 a 16 dígitos. Cada casilla indica:
                <ul className="mt-1 space-y-0.5 list-disc list-inside opacity-95">
                  <li>
                    <strong>✓ Verde pastel:</strong> Dígito correcto en su posición exacta (queda
                    marcado suave en el teclado).
                  </li>
                  <li>
                    <strong>↔ Ámbar pastel:</strong> Existe en la clave pero en otro lugar.
                  </li>
                  <li>
                    <strong>✕ Gris:</strong> No aparece en esa cantidad. Usa <strong>Tachar</strong>{' '}
                    para descartar números.
                  </li>
                </ul>
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  esMinimalista
                    ? 'bg-slate-800/60 border-white/10'
                    : 'bg-[#FAF4E4] border-[#DFD6BF]'
                }`}
              >
                <strong className="block text-sm font-bold mb-1">
                  Mecánica B — Mayor / Menor
                </strong>
                El candado oculta un número de 4 a 10 dígitos (incluye ceros al inicio). Recibes
                dirección (<strong>↑ Más alto</strong> / <strong>↓ Más bajo</strong>), rango
                reducido y cercanía.
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  esMinimalista
                    ? 'bg-slate-800/60 border-white/10'
                    : 'bg-[#FAF4E4] border-[#DFD6BF]'
                }`}
              >
                <strong className="block text-sm font-bold mb-1">
                  Duelos Online P2P (1v1)
                </strong>
                Cada jugador protege su clave sellada con <strong>SHA-256</strong> desde el inicio.
                Si el Jugador 1 acierta primero, el Jugador 2 dispone de su turno igualador.
              </div>
              <p
                className={`text-[11px] pt-0.5 ${
                  esMinimalista ? 'opacity-70' : 'text-[#3E4359]'
                }`}
              >
                Pasatiempo independiente: jugar a Candado es pura deducción y entretenimiento,
                totalmente aislado de los puntos de Muros Locos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
