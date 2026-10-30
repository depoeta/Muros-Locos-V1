/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BOARD_SIZE,
  esMeta,
  movimientosLegales,
  validarMuro,
  WALL_GRID_SIZE,
} from '../game/murosLocosEngine';
import { sounds } from '../audio/murosAudio';
import { Coord, GameState, WallOrientation } from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';

interface MurosBoardProps {
  estado: GameState;
  modoDaltonico: boolean;
  animacionesReducidas?: boolean;
  onMover: (destino: Coord) => void;
  onPonerMuro: (orientacion: WallOrientation, r: number, c: number) => void;
  onRotarMuro: () => void;
  onInvalidWallAttempt: (motivo: string) => void;
  bloqueadoPorAnimacion: boolean;
}

export const MurosBoard: React.FC<MurosBoardProps> = ({
  estado,
  modoDaltonico,
  animacionesReducidas = false,
  onMover,
  onPonerMuro,
  onRotarMuro,
  onInvalidWallAttempt,
  bloqueadoPorAnimacion,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [hoveredIntersection, setHoveredIntersection] = useState<Coord | null>(null);
  const [ghostValidity, setGhostValidity] = useState<'ok' | 'fuera' | 'solape' | 'bloquea'>('ok');

  const jugadorActivo = estado.jugadores[estado.turnoActual];
  const esMiTurnoOnline =
    !estado.modoOnline ||
    estado.miJugadorId === undefined ||
    estado.turnoActual === estado.miJugadorId;
  const esTurnoHumano = jugadorActivo.tipo === 'humano' && esMiTurnoOnline;
  const movimientos = esTurnoHumano ? movimientosLegales(jugadorActivo, estado) : [];

  // Goal indicators for 2P vs 4P
  const isGoalForActivePlayer = (r: number, c: number): boolean => {
    return esMeta(jugadorActivo, r, c);
  };

  // Check goal coloring for cell matching the player whose target it is
  const getGoalInfo = (r: number, c: number) => {
    const p0 = estado.jugadores[0];
    const p1 = estado.jugadores[1];
    const p2 = estado.jugadores[2];
    const p3 = estado.jugadores[3];

    if (estado.n === 2) {
      if (r === 0) return { color: p0?.color || '#ff6b6b', player: p0?.nombre || 'J1', symbol: '🏁' };
      if (r === 8) return { color: p1?.color || '#4dabf7', player: p1?.nombre || 'J2', symbol: '🏁' };
    } else {
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

    // If tapping an intersection that wasn't selected yet, select and preview it first
    const isAlreadySelected =
      hoveredIntersection && hoveredIntersection.r === r && hoveredIntersection.c === c;

    if (!isAlreadySelected) {
      updatePreview(r, c);
      sounds.playClick();
      return;
    }

    // Already selected: attempt to place the wall
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

  // Color of wall according to player who placed it
  const getWallColor = (playerId: number) => {
    const p = estado.jugadores.find((j) => j.id === playerId);
    return p ? p.color : '#e67700';
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[620px] mx-auto px-2">
      {/* Online Turn Indicator Banner */}
      {estado.modoOnline && !estado.terminada && (
        <div
          className={`w-full py-1.5 px-3 rounded-2xl border-2 border-[#2b2140] mb-2 font-black text-xs sm:text-sm text-center shadow-[0_3px_0_#2b2140] flex items-center justify-center gap-2 transition-all ${
            esMiTurnoOnline
              ? 'bg-[#51cf66] text-[#134e20] animate-pulse'
              : 'bg-[#fff3bf] text-[#8f4b00]'
          }`}
        >
          <span>
            {esMiTurnoOnline
              ? '👉 ¡ES TU TURNO! Mueve tu ficha o pon un muro'
              : `⏳ Turno de ${jugadorActivo.nombre}... Esperando jugada`}
          </span>
        </div>
      )}

      {/* Outer Wooden Board Frame */}
      <div
        className="relative w-full aspect-square rounded-3xl p-3 sm:p-4 bg-[#b07d4b] border-4 border-[#2b2140] shadow-[0_10px_0_#2b2140,0_18px_25px_rgba(0,0,0,0.35)] select-none transition-transform"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 20%, #c4915c 0%, #a46d3b 100%)',
        }}
      >
        {/* Subtle decorative frame corner inlays */}
        <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-[#f6cf8a] border-2 border-[#2b2140]" />
        <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#f6cf8a] border-2 border-[#2b2140]" />
        <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-[#f6cf8a] border-2 border-[#2b2140]" />
        <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-[#f6cf8a] border-2 border-[#2b2140]" />

        {/* Inner Playing Surface (9x9 grid) */}
        <div
          ref={boardRef}
          className="relative w-full h-full rounded-2xl bg-[#593922] border-3 border-[#2b2140] overflow-hidden grid grid-cols-9 grid-rows-9 gap-[6px] p-[6px]"
          style={{ touchAction: 'manipulation' }}
        >
          {/* Render 9x9 Cells (Static board background) */}
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((_, c) => {
              const isEven = (r + c) % 2 === 0;
              const goalInfo = getGoalInfo(r, c);
              const isLegalMove = movimientos.some((m) => m.r === r && m.c === c);
              const isTargetForActive = isGoalForActivePlayer(r, c);
              const isHint = estado.caminoPista?.some((pt) => pt.r === r && pt.c === c);
              const hasPlayer = estado.jugadores.some((p) => p.r === r && p.c === c);

              let tileBg = isEven ? 'bg-[#fffae8]' : 'bg-[#faeccb]';
              if (goalInfo) {
                tileBg = 'bg-[#fff5dc]';
              }

              return (
                <div
                  key={`cell-${r}-${c}`}
                  onClick={() => {
                    if (isLegalMove && !bloqueadoPorAnimacion && esTurnoHumano) {
                      onMover({ r, c });
                    }
                  }}
                  className={`relative rounded-lg flex items-center justify-center transition-all ${tileBg} border-2 border-[#2b2140]/15 ${
                    isLegalMove && !bloqueadoPorAnimacion && esTurnoHumano
                      ? 'cursor-pointer hover:brightness-105 active:scale-95'
                      : ''
                  }`}
                  style={{
                    backgroundColor: goalInfo ? `${goalInfo.color}25` : undefined,
                  }}
                >
                  {/* Goal strip indicator accent edge */}
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

                  {/* Hint footprint indicator */}
                  {isHint && !hasPlayer && (
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-[#ffd43b] border-2 border-[#2b2140] animate-ping opacity-80 pointer-events-none" />
                  )}

                  {/* Legal move destination indicator matching active character's color */}
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

          {/* Placed Horizontal Walls with Motion entry animation */}
          {Array.from({ length: WALL_GRID_SIZE }).map((_, r) =>
            Array.from({ length: WALL_GRID_SIZE }).map((_, c) => {
              const wallOwner = estado.murosH[r][c];
              if (wallOwner === -1) return null;
              const wallColor = getWallColor(wallOwner);

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
                    left: `calc(6px + ${c} * ((100% - 6px) / 9))`,
                    width: `calc((200% - 66px) / 9)`,
                    top: `calc(6px + ${r + 1} * ((100% - 6px) / 9) - 9px)`,
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

          {/* Placed Vertical Walls with Motion entry animation */}
          {Array.from({ length: WALL_GRID_SIZE }).map((_, r) =>
            Array.from({ length: WALL_GRID_SIZE }).map((_, c) => {
              const wallOwner = estado.murosV[r][c];
              if (wallOwner === -1) return null;
              const wallColor = getWallColor(wallOwner);

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
                    top: `calc(6px + ${r} * ((100% - 6px) / 9))`,
                    height: `calc((200% - 66px) / 9)`,
                    left: `calc(6px + ${c + 1} * ((100% - 6px) / 9) - 9px)`,
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

          {/* Absolute Characters Overlay with Motion Spring Glide & Hop Animation */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {estado.jugadores.map((player) => (
              <motion.div
                key={`player-entity-${player.id}`}
                className="absolute flex items-center justify-center pointer-events-none"
                style={{
                  width: 'calc((100% - 60px) / 9)',
                  height: 'calc((100% - 60px) / 9)',
                }}
                initial={false}
                animate={{
                  left: `calc(6px + ${player.c} * ((100% - 6px) / 9))`,
                  top: `calc(6px + ${player.r} * ((100% - 6px) / 9))`,
                }}
                transition={
                  animacionesReducidas
                    ? { duration: 0 }
                    : {
                        type: 'spring',
                        stiffness: 340,
                        damping: 24,
                      }
                }
              >
                {/* Inner Hop / Jump Animation on coordinate change */}
                <motion.div
                  key={`hop-${player.r}-${player.c}`}
                  initial={animacionesReducidas ? {} : { y: -12, scale: 1.1 }}
                  animate={{ y: 0, scale: 1 }}
                  transition={
                    animacionesReducidas
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 400, damping: 18 }
                  }
                  className="w-full h-full flex items-center justify-center relative"
                >
                  {/* Floating speech bubble for live online emoji reaction */}
                  {estado.reaccionActiva && estado.reaccionActiva.jugadorId === player.id && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white border-2 border-[#2b2140] rounded-full px-2 py-0.5 shadow-md text-base animate-bounce z-40 pointer-events-none whitespace-nowrap">
                      {estado.reaccionActiva.emoji}
                    </div>
                  )}

                  <CartoonCharacter
                    color={player.color}
                    hat={player.hat}
                    size={46}
                    isActive={estado.turnoActual === player.id}
                    isDancing={estado.ganador === player.id}
                  />
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Clickable/Tappable Intersections Overlay for Wall Placement */}
          {estado.modoAccion === 'muro' && esTurnoHumano && !bloqueadoPorAnimacion && (
            <div className="absolute inset-0 pointer-events-auto z-30">
              {Array.from({ length: WALL_GRID_SIZE }).map((_, r) =>
                Array.from({ length: WALL_GRID_SIZE }).map((_, c) => {
                  const isCurrentHovered =
                    hoveredIntersection &&
                    hoveredIntersection.r === r &&
                    hoveredIntersection.c === c;

                  return (
                    <button
                      key={`hit-${r}-${c}`}
                      type="button"
                      aria-label={`Intersección ${r}, ${c}`}
                      onClick={() => handleIntersectionClick(r, c)}
                      onMouseEnter={() => updatePreview(r, c)}
                      className="absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer group"
                      style={{
                        left: `calc(6px + ${c + 1} * ((100% - 6px) / 9) - 3px)`,
                        top: `calc(6px + ${r + 1} * ((100% - 6px) / 9) - 3px)`,
                      }}
                    >
                      {/* Responsive target dot */}
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
              !bloqueadoPorAnimacion && (
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
                          left: `calc(6px + ${hoveredIntersection.c} * ((100% - 6px) / 9))`,
                          width: `calc((200% - 66px) / 9)`,
                          top: `calc(6px + ${hoveredIntersection.r + 1} * ((100% - 6px) / 9) - 9px)`,
                          height: '12px',
                        }
                      : {
                          top: `calc(6px + ${hoveredIntersection.r} * ((100% - 6px) / 9))`,
                          height: `calc((200% - 66px) / 9)`,
                          left: `calc(6px + ${hoveredIntersection.c + 1} * ((100% - 6px) / 9) - 9px)`,
                          width: '12px',
                        }
                  }
                >
                  <span className="text-[10px] font-black text-white drop-shadow">
                    {ghostValidity === 'ok' ? '✔' : '✕'}
                  </span>
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </div>

      {/* Touch / Quick Confirmation Bar when an intersection is selected */}
      {estado.modoAccion === 'muro' && esTurnoHumano && hoveredIntersection && (
        <div className="mt-2 text-xs font-semibold text-[#593922] bg-[#fff8e7] px-3 py-1.5 rounded-2xl border-2 border-[#2b2140] shadow-md flex items-center gap-2 animate-[fadeIn_0.15s_ease-out]">
          <span className="font-extrabold text-[#2b2140]">
            Muro {estado.orientacionMuro === 'H' ? 'Horizontal' : 'Vertical'}
          </span>

          <button
            onClick={() => {
              sounds.playClick();
              onRotarMuro();
              // Update preview with toggled orientation
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

      {/* Helper text when no intersection is selected yet */}
      {estado.modoAccion === 'muro' && esTurnoHumano && !hoveredIntersection && (
        <div className="mt-2 text-xs font-semibold text-[#593922] bg-[#fff8e7] px-3 py-1 rounded-full border-2 border-[#2b2140] shadow-sm flex items-center gap-2">
          <span>
            Toca una intersección para previsualizar el muro ({estado.orientacionMuro === 'H' ? 'Horizontal' : 'Vertical'})
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
