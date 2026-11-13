/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BOARD_SIZE,
  esMeta,
  movimientosLegales,
  sounds,
  validarMuro,
  WALL_GRID_SIZE,
} from '../game/murosLocosEngine';
import { TemaTablero, Coordenada, EstadoDeJuego, OrientacionMuro } from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';

interface MurosBoardProps {
  estado: EstadoDeJuego;
  modoDaltonico: boolean;
  animacionesReducidas?: boolean;
  temaTablero?: TemaTablero;
  perspectivaInvertida?: boolean;
  rotacionGrados?: number;
  rotationMode?: boolean;
  vistaPropiaOnline?: boolean;
  onTogglePerspectiva?: () => void;
  onMover: (destino: Coordenada) => void;
  onPonerMuro: (orientacion: OrientacionMuro, r: number, c: number) => void;
  onRotarMuro: () => void;
  onCambiarModo?: (modo: 'mover' | 'muro') => void;
  onInvalidWallAttempt: (motivo: string) => void;
  bloqueadoPorAnimacion: boolean;
}

const THEMES: Record<
  TemaTablero,
  {
    frameBg: string;
    frameStyle: React.CSSProperties;
    cornerDot: string;
    innerBg: string;
    tileEven: string;
    tileOdd: string;
    tileBorder: string;
  }
> = {
  madera: {
    frameBg: 'bg-[#b07d4b]',
    frameStyle: { backgroundImage: 'radial-gradient(circle at 50% 20%, #c4915c 0%, #a46d3b 100%)' },
    cornerDot: 'bg-[#f6cf8a]',
    innerBg: 'bg-[#593922]',
    tileEven: 'bg-[#fffae8]',
    tileOdd: 'bg-[#faeccb]',
    tileBorder: 'border-[#2b2140]/15',
  },
  neon: {
    frameBg: 'bg-[#0b1329]',
    frameStyle: {
      backgroundImage: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #030712 100%)',
      boxShadow: '0 0 25px rgba(6,182,212,0.35)',
    },
    cornerDot: 'bg-[#06b6d4]',
    innerBg: 'bg-[#030712]',
    tileEven: 'bg-[#0f172a]',
    tileOdd: 'bg-[#1e293b]',
    tileBorder: 'border-[#06b6d4]/25',
  },
  hielo: {
    frameBg: 'bg-[#74c0fc]',
    frameStyle: {
      backgroundImage: 'radial-gradient(circle at 50% 20%, #a5d8ff 0%, #4dabf7 100%)',
      boxShadow: '0 0 20px rgba(116,192,252,0.4)',
    },
    cornerDot: 'bg-[#e7f5ff]',
    innerBg: 'bg-[#1864ab]',
    tileEven: 'bg-[#f8f9fa]',
    tileOdd: 'bg-[#e7f5ff]',
    tileBorder: 'border-[#1971c2]/20',
  },
  lava: {
    frameBg: 'bg-[#491212]',
    frameStyle: {
      backgroundImage: 'radial-gradient(circle at 50% 20%, #7f1d1d 0%, #1f0404 100%)',
      boxShadow: '0 0 25px rgba(239,68,68,0.4)',
    },
    cornerDot: 'bg-[#f59e0b]',
    innerBg: 'bg-[#180505]',
    tileEven: 'bg-[#261010]',
    tileOdd: 'bg-[#381515]',
    tileBorder: 'border-[#ef4444]/25',
  },
};

export const MurosBoard: React.FC<MurosBoardProps> = ({
  estado,
  modoDaltonico,
  animacionesReducidas = false,
  temaTablero = 'madera',
  perspectivaInvertida = false,
  rotacionGrados = 0,
  rotationMode = false,
  vistaPropiaOnline = true,
  onTogglePerspectiva,
  onMover,
  onPonerMuro,
  onRotarMuro,
  onCambiarModo,
  onInvalidWallAttempt,
  bloqueadoPorAnimacion,
}) => {
  const currentTheme = THEMES[temaTablero] || THEMES.madera;
  const boardRef = useRef<HTMLDivElement>(null);
  const [hoveredIntersection, setHoveredIntersection] = useState<Coordenada | null>(null);
  const [ghostValidity, setGhostValidity] = useState<'ok' | 'fuera' | 'solape' | 'bloquea'>('ok');

  // Guardamos el último turno de un jugador HUMANO para no girar nunca hacia el lado de un Bot
  const [ultimoHumanoIdx, setUltimoHumanoIdx] = useState<number>(() => {
    const firstHuman = estado.jugadores.find((p) => p.tipo === 'humano');
    return firstHuman ? firstHuman.id : 0;
  });

  useEffect(() => {
    const actual = estado.jugadores[estado.turnoActual];
    if (actual && actual.tipo === 'humano') {
      setUltimoHumanoIdx(estado.turnoActual);
    }
  }, [estado.turnoActual, estado.jugadores]);

  useEffect(() => {
    if (estado.turnosTotales === 0) {
      setHoveredIntersection(null);
    }
  }, [estado.turnosTotales]);

  const jugadorActivo = estado.jugadores[estado.turnoActual];
  const esMiTurnoOnline =
    !estado.modoOnline ||
    estado.miJugadorId === undefined ||
    estado.turnoActual === estado.miJugadorId;
  const esTurnoHumano = jugadorActivo.tipo === 'humano' && esMiTurnoOnline;
  const movimientos = esTurnoHumano ? movimientosLegales(jugadorActivo, estado) : [];

  const hayMultiplesHumanos = estado.jugadores.filter((p) => p.tipo === 'humano').length >= 2;

  const obtenerAnguloJugador = (jugadorId: number, numJugadores: 2 | 4): number => {
    if (numJugadores === 2) {
      return jugadorId === 1 ? 180 : 0;
    }
    const angulos4P = [0, -90, 180, 90];
    return angulos4P[((jugadorId % 4) + 4) % 4];
  };

  // Cambio de perspectiva instantáneo (aparece de inmediato sin girar: transition 'none')
  const anguloRotacion = React.useMemo(() => {
    if (!hayMultiplesHumanos && !estado.modoOnline) {
      return 0; // Contra bots siempre fija al lado del humano
    }
    if (estado.modoOnline) {
      const miId = estado.miJugadorId ?? 0;
      return obtenerAnguloJugador(miId, estado.n);
    }
    return obtenerAnguloJugador(ultimoHumanoIdx, estado.n);
  }, [hayMultiplesHumanos, estado.modoOnline, estado.miJugadorId, estado.n, ultimoHumanoIdx]);

  const esRotacionLateral = Math.abs(anguloRotacion % 180) === 90;
  const etiquetaOrientacionVisual = esRotacionLateral
    ? estado.orientacionMuro === 'H'
      ? 'Vertical'
      : 'Horizontal'
    : estado.orientacionMuro === 'H'
    ? 'Horizontal'
    : 'Vertical';

  // La rotación visual la realiza íntegramente CSS transform: rotate(anguloRotacion) sobre el marco;
  // no invertir coordenadas aquí evita la doble inversión (180° + 180° = 0°) que anulaba la vista de J2.
  const toLogicalCell = (vr: number, vc: number): Coordenada => ({ r: vr, c: vc });
  const toVisualCell = (r: number, c: number): Coordenada => ({ r, c });
  const toLogicalIntersection = (vr: number, vc: number): Coordenada => ({ r: vr, c: vc });
  const toVisualIntersection = (r: number, c: number): Coordenada => ({ r, c });

  const isGoalForActivePlayer = (r: number, c: number): boolean => {
    return esMeta(jugadorActivo, r, c, estado.n);
  };

  const getGoalInfo = (r: number, c: number) => {
    const p0 = estado.jugadores[0];
    const p1 = estado.jugadores[1];
    const p2 = estado.jugadores[2];
    const p3 = estado.jugadores[3];

    if (estado.n === 2) {
      if (r === 0) return { color: p0?.color || '#ff6b6b', player: p0?.nombre || 'J1', symbol: '🏁' };
      if (r === 8) return { color: p1?.color || '#4dabf7', player: p1?.nombre || 'J2', symbol: '🏁' };
    } else {
      if ((r === 0 || r === 8) && (c === 0 || c === 8)) return null;
      if (r === 0) return { color: p0?.color || '#ff6b6b', player: p0?.nombre || 'J1', symbol: '🏁' };
      if (c === 8) return { color: p1?.color || '#4dabf7', player: p1?.nombre || 'J2', symbol: '🏁' };
      if (r === 8) return { color: p2?.color || '#ffd43b', player: p2?.nombre || 'J3', symbol: '🏁' };
      if (c === 0) return { color: p3?.color || '#51cf66', player: p3?.nombre || 'J4', symbol: '🏁' };
    }
    return null;
  };

  const updatePreview = (r: number, c: number, orientacion = estado.orientacionMuro) => {
    setHoveredIntersection({ r, c });
    const val = validarMuro(
      orientacion,
      r,
      c,
      estado.murosH,
      estado.murosV,
      estado.jugadores
    );
    setGhostValidity(val);
  };

  const handleIntersectionClick = (r: number, c: number) => {
    if (estado.modoAccion !== 'muro' || !esTurnoHumano || bloqueadoPorAnimacion) return;
    if (jugadorActivo.muros <= 0) {
      onInvalidWallAttempt('¡Ya no te quedan muros! Mueve tu personaje.');
      return;
    }

    const isAlreadySelected =
      hoveredIntersection && hoveredIntersection.r === r && hoveredIntersection.c === c;

    if (!isAlreadySelected) {
      updatePreview(r, c);
      sounds.playClick();
      return;
    }

    confirmWallPlacement(r, c);
  };

  const confirmWallPlacement = (r: number, c: number) => {
    const val = validarMuro(
      estado.orientacionMuro,
      r,
      c,
      estado.murosH,
      estado.murosV,
      estado.jugadores
    );

    if (val === 'ok') {
      onPonerMuro(estado.orientacionMuro, r, c);
      setHoveredIntersection(null);
    } else {
      sounds.playError();
      if (val === 'bloquea') {
        onInvalidWallAttempt('🚫 No puedes encerrar a un jugador: debe quedarle camino libre a su meta');
      } else if (val === 'solape') {
        onInvalidWallAttempt('🚫 Ahí ya hay un muro o se cruzaría perpendicularmente con otro');
      } else {
        onInvalidWallAttempt('🚫 Posición de muro no válida');
      }
    }
  };

  // Controles completos de teclado para ordenadores / laptops
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (!esTurnoHumano || bloqueadoPorAnimacion || estado.terminada) return;

      const code = e.code;
      const key = e.key.toLowerCase();

      // Tecla 'M': Cambiar entre modo Mover y Poner Muro
      if (code === 'KeyM' || key === 'm') {
        e.preventDefault();
        sounds.playClick();
        onCambiarModo?.(estado.modoAccion === 'mover' ? 'muro' : 'mover');
        return;
      }

      // Tecla 'R': Rotar orientación del muro
      if (code === 'KeyR' || key === 'r') {
        e.preventDefault();
        onRotarMuro();
        return;
      }

      // Flechas o WASD
      const isUp = code === 'ArrowUp' || key === 'w';
      const isDown = code === 'ArrowDown' || key === 's';
      const isLeft = code === 'ArrowLeft' || key === 'a';
      const isRight = code === 'ArrowRight' || key === 'd';

      if (isUp || isDown || isLeft || isRight) {
        e.preventDefault();

        // Modo Mover: desplazarse a casilla legal
        if (estado.modoAccion === 'mover') {
          const curR = jugadorActivo.r;
          const curC = jugadorActivo.c;

          let matched: Coordenada | undefined;
          if (isUp) {
            matched =
              movimientos.find((m) => m.r < curR && m.c === curC) ||
              movimientos.find((m) => m.r < curR);
          } else if (isDown) {
            matched =
              movimientos.find((m) => m.r > curR && m.c === curC) ||
              movimientos.find((m) => m.r > curR);
          } else if (isLeft) {
            matched =
              movimientos.find((m) => m.c < curC && m.r === curR) ||
              movimientos.find((m) => m.c < curC);
          } else if (isRight) {
            matched =
              movimientos.find((m) => m.c > curC && m.r === curR) ||
              movimientos.find((m) => m.c > curC);
          }

          if (matched) {
            sounds.playMove();
            onMover(matched);
          }
          return;
        }

        // Modo Muro: mover el cursor del muro fantasma
        if (estado.modoAccion === 'muro') {
          setHoveredIntersection((prev: Coordenada | null) => {
            const curR = prev ? prev.r : 3;
            const curC = prev ? prev.c : 3;
            let nextR = curR;
            let nextC = curC;

            if (isUp) nextR = Math.max(0, curR - 1);
            if (isDown) nextR = Math.min(7, curR + 1);
            if (isLeft) nextC = Math.max(0, curC - 1);
            if (isRight) nextC = Math.min(7, curC + 1);

            updatePreview(nextR, nextC);
            sounds.playClick();
            return { r: nextR, c: nextC };
          });
          return;
        }
      }

      // Enter o Espacio: confirmar muro
      if (code === 'Enter' || code === 'Space') {
        if (estado.modoAccion === 'muro' && hoveredIntersection) {
          e.preventDefault();
          confirmWallPlacement(hoveredIntersection.r, hoveredIntersection.c);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    esTurnoHumano,
    bloqueadoPorAnimacion,
    estado.terminada,
    estado.modoAccion,
    jugadorActivo,
    movimientos,
    hoveredIntersection,
    onMover,
    onRotarMuro,
    onCambiarModo,
  ]);

  const getWallColor = (playerId: number) => {
    const p = estado.jugadores.find((j) => j.id === playerId);
    return p ? p.color : '#e67700';
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[500px] mx-auto px-1 sm:px-2">
      {/* Indicador de turno únicamente en modo Online (los bots juegan directo sin saltos de pantalla) */}
      {estado.modoOnline && !estado.terminada && (
        <div className="w-full flex items-center justify-between gap-2 mb-1 shrink-0">
          <div
            className={`flex-1 py-1 px-3 rounded-2xl border-2 border-[#2b2140] font-black text-xs text-center shadow-[0_2px_0_#2b2140] flex items-center justify-center gap-2 transition-all ${
              esMiTurnoOnline
                ? 'bg-[#51cf66] text-[#134e20] animate-pulse'
                : 'bg-[#fff3bf] text-[#8f4b00]'
            }`}
          >
            <span>
              {esMiTurnoOnline
                ? '👉 ¡ES TU TURNO! Mueve o pon un muro'
                : `⏳ Turno de ${jugadorActivo.nombre}...`}
            </span>
          </div>
        </div>
      )}

      {/* Outer Themed Board Frame (Sin animación de giro, tamaño ajustado a viewport) */}
      <div
        className={`relative w-full max-w-[min(450px,calc(100vh-270px))] max-h-[min(450px,calc(100vh-270px))] aspect-square rounded-3xl p-2 sm:p-2.5 ${currentTheme.frameBg} border-4 border-[#2b2140] shadow-[0_6px_0_#2b2140,0_14px_20px_rgba(0,0,0,0.25)] select-none shrink-0`}
        style={{
          ...currentTheme.frameStyle,
          transform: `rotate(${anguloRotacion}deg)`,
          transition: 'none', // Cambio instantáneo: aparece de inmediato sin animación de giro
        }}
      >
        <div className={`absolute top-2 left-2 w-3 h-3 rounded-full ${currentTheme.cornerDot} border-2 border-[#2b2140]`} />
        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${currentTheme.cornerDot} border-2 border-[#2b2140]`} />
        <div className={`absolute bottom-2 left-2 w-3 h-3 rounded-full ${currentTheme.cornerDot} border-2 border-[#2b2140]`} />
        <div className={`absolute bottom-2 right-2 w-3 h-3 rounded-full ${currentTheme.cornerDot} border-2 border-[#2b2140]`} />

        {/* Inner Playing Surface (9x9 grid) */}
        <div
          ref={boardRef}
          className={`relative w-full h-full rounded-2xl ${currentTheme.innerBg} border-3 border-[#2b2140] overflow-hidden grid grid-cols-9 grid-rows-9 gap-[6px] p-[6px] transition-colors duration-300`}
          style={{ touchAction: 'manipulation' }}
        >
          {Array.from({ length: BOARD_SIZE }).map((_, vr) =>
            Array.from({ length: BOARD_SIZE }).map((_, vc) => {
              const logical = toLogicalCell(vr, vc);
              const r = logical.r;
              const c = logical.c;

              const isEven = (r + c) % 2 === 0;
              const goalInfo = getGoalInfo(r, c);
              const isLegalMove = movimientos.some((m) => m.r === r && m.c === c);
              const isTargetForActive = isGoalForActivePlayer(r, c);
              const isHint = estado.caminoPista?.some((pt) => pt.r === r && pt.c === c);
              const hasPlayer = estado.jugadores.some((p) => p.r === r && p.c === c);

              const tileBg = isEven ? currentTheme.tileEven : currentTheme.tileOdd;

              return (
                <div
                  key={`cell-${vr}-${vc}`}
                  onClick={() => {
                    if (isLegalMove && !bloqueadoPorAnimacion && esTurnoHumano) {
                      onMover({ r, c });
                    }
                  }}
                  className={`relative rounded-lg flex items-center justify-center transition-all ${tileBg} border-2 ${currentTheme.tileBorder} ${
                    isLegalMove && !bloqueadoPorAnimacion && esTurnoHumano
                      ? 'cursor-pointer hover:brightness-110 active:scale-95'
                      : ''
                  }`}
                  style={{
                    backgroundColor: isLegalMove
                      ? `${jugadorActivo.color}25`
                      : goalInfo
                      ? `${goalInfo.color}25`
                      : undefined,
                  }}
                >
                  {goalInfo && (
                    <div
                      className={`absolute inset-0 pointer-events-none rounded-lg border-2 ${
                        isTargetForActive ? 'animate-pulse' : 'opacity-40'
                      }`}
                      style={{
                        borderColor: goalInfo.color,
                        boxShadow: isTargetForActive
                          ? `inset 0 0 10px ${goalInfo.color}60`
                          : undefined,
                      }}
                    >
                      {modoDaltonico && (
                        <span className="absolute top-0.5 right-0.5 text-[9px] font-bold opacity-75">
                          {goalInfo.symbol}
                        </span>
                      )}
                    </div>
                  )}

                  {isHint && !hasPlayer && (
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-[#ffd43b] border-2 border-[#2b2140] animate-ping opacity-80 pointer-events-none" />
                  )}

                  {isLegalMove && !bloqueadoPorAnimacion && esTurnoHumano && (
                    <div
                      className="absolute inset-1 rounded-md border-3 border-dashed flex items-center justify-center animate-pulse pointer-events-none"
                      style={{
                        borderColor: jugadorActivo.color,
                        backgroundColor: `${jugadorActivo.color}35`,
                      }}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 border-[#2b2140] shadow-sm transform scale-110"
                        style={{ backgroundColor: jugadorActivo.color }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Placed Horizontal Walls */}
          {Array.from({ length: WALL_GRID_SIZE }).map((_, r) =>
            Array.from({ length: WALL_GRID_SIZE }).map((_, c) => {
              const wallOwner = estado.murosH[r][c];
              if (wallOwner === -1) return null;
              const wallColor = getWallColor(wallOwner);
              const vis = toVisualIntersection(r, c);

              return (
                <motion.div
                  key={`placed-h-${r}-${c}`}
                  initial={animacionesReducidas ? false : { scale: 0.2, opacity: 0, y: -16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={
                    animacionesReducidas
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 450, damping: 22 }
                  }
                  className="absolute z-15 h-3 rounded-full border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] flex items-center justify-between px-1 pointer-events-none"
                  style={{
                    left: `calc(6px + ${vis.c} * ((100% - 6px) / 9))`,
                    width: `calc((200% - 66px) / 9)`,
                    top: `calc(6px + ${vis.r + 1} * ((100% - 6px) / 9) - 9px)`,
                    backgroundColor: wallColor,
                    backgroundImage:
                      'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.15) 100%)',
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffec99] border border-[#2b2140]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffec99] border border-[#2b2140]" />
                </motion.div>
              );
            })
          )}

          {/* Placed Vertical Walls */}
          {Array.from({ length: WALL_GRID_SIZE }).map((_, r) =>
            Array.from({ length: WALL_GRID_SIZE }).map((_, c) => {
              const wallOwner = estado.murosV[r][c];
              if (wallOwner === -1) return null;
              const wallColor = getWallColor(wallOwner);
              const vis = toVisualIntersection(r, c);

              return (
                <motion.div
                  key={`placed-v-${r}-${c}`}
                  initial={animacionesReducidas ? false : { scale: 0.2, opacity: 0, y: -22 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={
                    animacionesReducidas
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 450, damping: 22 }
                  }
                  className="absolute z-15 w-3 rounded-full border-2 border-[#2b2140] shadow-[2px_2px_0_#2b2140] flex flex-col items-center justify-between py-1 pointer-events-none"
                  style={{
                    top: `calc(6px + ${vis.r} * ((100% - 6px) / 9))`,
                    height: `calc((200% - 66px) / 9)`,
                    left: `calc(6px + ${vis.c + 1} * ((100% - 6px) / 9) - 9px)`,
                    backgroundColor: wallColor,
                    backgroundImage:
                      'linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.15) 100%)',
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffec99] border border-[#2b2140]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffec99] border border-[#2b2140]" />
                </motion.div>
              );
            })
          )}

          {/* Absolute Characters Overlay with Stepped Walking Animation */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {estado.jugadores.map((player) => {
              const vis = toVisualCell(player.r, player.c);
              return (
                <motion.div
                  key={`player-entity-${player.id}`}
                  className="absolute flex items-center justify-center pointer-events-none"
                  style={{
                    width: 'calc((100% - 60px) / 9)',
                    height: 'calc((100% - 60px) / 9)',
                  }}
                  initial={false}
                  animate={{
                    left: `calc(6px + ${vis.c} * ((100% - 6px) / 9))`,
                    top: `calc(6px + ${vis.r} * ((100% - 6px) / 9))`,
                  }}
                  transition={
                    animacionesReducidas
                      ? { duration: 0 }
                      : { duration: 0.5, ease: [0.25, 1, 0.5, 1] }
                  }
                >
                  <motion.div
                    key={`walk-hop-${player.r}-${player.c}`}
                    initial={
                      animacionesReducidas
                        ? {}
                        : {
                            y: [0, -14, -2, -8, 0],
                            rotate: [0, -8, 8, -4, 0],
                            scale: [1, 1.1, 1, 1.05, 1],
                          }
                    }
                    animate={{ y: 0, rotate: 0, scale: 1 }}
                    transition={
                      animacionesReducidas
                        ? { duration: 0 }
                        : { duration: 0.5, ease: 'easeInOut' }
                    }
                    className="w-full h-full flex items-center justify-center relative"
                  >
                    <div
                      style={{
                        transform: `rotate(${-anguloRotacion}deg)`,
                        transition: 'none',
                      }}
                      className="w-full h-full flex items-center justify-center relative"
                    >
                      {estado.reaccionActiva && estado.reaccionActiva.jugadorId === player.id && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white border-2 border-[#2b2140] rounded-full px-2 py-0.5 shadow-md text-base animate-bounce z-40 pointer-events-none whitespace-nowrap">
                          {estado.reaccionActiva.emoji}
                        </div>
                      )}

                      <CartoonCharacter
                        color={player.color}
                        hat={player.hat}
                        ropa={player.ropa}
                        ropaColor={player.ropaColor}
                        aura={player.aura}
                        size={46}
                        inGame={true}
                        isActive={estado.turnoActual === player.id}
                        isDancing={estado.ganador === player.id}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>

          {/* Clickable Intersections Overlay for Wall Placement */}
          {estado.modoAccion === 'muro' && esTurnoHumano && !bloqueadoPorAnimacion && (
            <div className="absolute inset-0 pointer-events-auto z-30">
              {Array.from({ length: WALL_GRID_SIZE }).map((_, vr) =>
                Array.from({ length: WALL_GRID_SIZE }).map((_, vc) => {
                  const logical = toLogicalIntersection(vr, vc);
                  const isCurrentHovered =
                    hoveredIntersection &&
                    hoveredIntersection.r === logical.r &&
                    hoveredIntersection.c === logical.c;

                  return (
                    <button
                      key={`hit-${vr}-${vc}`}
                      type="button"
                      aria-label={`Intersección ${logical.r}, ${logical.c}`}
                      onClick={() => handleIntersectionClick(logical.r, logical.c)}
                      onMouseEnter={() => updatePreview(logical.r, logical.c)}
                      className="absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer group"
                      style={{
                        left: `calc(6px + ${vc + 1} * ((100% - 6px) / 9) - 3px)`,
                        top: `calc(6px + ${vr + 1} * ((100% - 6px) / 9) - 3px)`,
                      }}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full border-2 border-[#2b2140] transition-all duration-150 shadow-sm ${
                          isCurrentHovered
                            ? 'scale-130 bg-[#ffd43b] opacity-100 ring-2 ring-white'
                            : 'scale-90 bg-[#ffd43b]/60 opacity-0 group-hover:opacity-100 group-hover:scale-125'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Ghost Wall Preview */}
          <AnimatePresence>
            {estado.modoAccion === 'muro' &&
              esTurnoHumano &&
              hoveredIntersection &&
              !bloqueadoPorAnimacion &&
              (() => {
                const vis = toVisualIntersection(hoveredIntersection.r, hoveredIntersection.c);
                return (
                  <motion.div
                    key="ghost-wall"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute z-40 pointer-events-none rounded-full border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] flex items-center justify-center ${
                      ghostValidity === 'ok'
                        ? 'bg-[#51cf66]/90'
                        : 'bg-[#ff6b6b]/90 animate-[shake_0.2s_ease-in-out_infinite]'
                    }`}
                    style={
                      estado.orientacionMuro === 'H'
                        ? {
                            left: `calc(6px + ${vis.c} * ((100% - 6px) / 9))`,
                            width: `calc((200% - 66px) / 9)`,
                            top: `calc(6px + ${vis.r + 1} * ((100% - 6px) / 9) - 9px)`,
                            height: '12px',
                          }
                        : {
                            top: `calc(6px + ${vis.r} * ((100% - 6px) / 9))`,
                            height: `calc((200% - 66px) / 9)`,
                            left: `calc(6px + ${vis.c + 1} * ((100% - 6px) / 9) - 9px)`,
                            width: '12px',
                          }
                    }
                  >
                    <span className="text-[10px] font-black text-white drop-shadow">
                      {ghostValidity === 'ok' ? '✔' : '✕'}
                    </span>
                  </motion.div>
                );
              })()}
          </AnimatePresence>
        </div>
      </div>

      {/* Touch / Quick Confirmation Bar when an intersection is selected */}
      {estado.modoAccion === 'muro' && esTurnoHumano && hoveredIntersection && (
        <div className="mt-2 text-xs font-semibold text-[#593922] bg-[#fff8e7] px-3 py-1.5 rounded-2xl border-2 border-[#2b2140] shadow-md flex items-center gap-2 animate-[fadeIn_0.15s_ease-out]">
          <span className="font-extrabold text-[#2b2140]">
            Muro {etiquetaOrientacionVisual}
          </span>

          <button
            onClick={() => {
              sounds.playClick();
              onRotarMuro();
              const nuevaOrientacion = estado.orientacionMuro === 'H' ? 'V' : 'H';
              updatePreview(hoveredIntersection.r, hoveredIntersection.c, nuevaOrientacion);
            }}
            className="text-[11px] bg-[#ffd43b] hover:bg-[#fcc419] px-2.5 py-1 rounded-xl border-2 border-[#2b2140] font-black text-[#5c3c00] shadow-[0_2px_0_#2b2140] active:translate-y-0.5 cursor-pointer flex items-center gap-1"
          >
            🔄 Rotar
          </button>

          <button
            onClick={() => confirmWallPlacement(hoveredIntersection.r, hoveredIntersection.c)}
            disabled={ghostValidity !== 'ok'}
            className={`text-[11px] px-3 py-1 rounded-xl border-2 border-[#2b2140] font-black shadow-[0_2px_0_#2b2140] active:translate-y-0.5 cursor-pointer flex items-center gap-1 transition-all ${
              ghostValidity === 'ok'
                ? 'bg-[#51cf66] text-[#134e20] hover:bg-[#40c057]'
                : 'bg-[#ced4da] text-[#868e96] border-[#adb5bd] cursor-not-allowed shadow-none'
            }`}
          >
            ✓ Colocar
          </button>

          <button
            onClick={() => setHoveredIntersection(null)}
            className="w-6 h-6 rounded-lg bg-white border border-[#2b2140] font-bold text-[#c92a2a] hover:bg-[#ffe3e3] flex items-center justify-center cursor-pointer"
            title="Cancelar selección"
          >
            ✕
          </button>
        </div>
      )}

      {estado.modoAccion === 'muro' && esTurnoHumano && !hoveredIntersection && (
        <div className="mt-2 text-xs font-semibold text-[#593922] bg-[#fff8e7] px-3 py-1 rounded-full border-2 border-[#2b2140] shadow-sm flex items-center gap-2">
          <span>
            Toca una intersección para previsualizar ({etiquetaOrientacionVisual})
          </span>
          <button
            onClick={onRotarMuro}
            className="text-[11px] bg-[#ffd43b] hover:bg-[#fcc419] px-2 py-0.5 rounded-md border border-[#2b2140] font-bold cursor-pointer"
          >
            🔄 Rotar (R)
          </button>
        </div>
      )}
    </div>
  );
};
