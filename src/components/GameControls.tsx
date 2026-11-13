/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { bfsCamino, sounds } from '../game/murosLocosEngine';
import { AccionRegistro, EstadoDeJuego } from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';

// =========================================================================
// 1. PLAYER CARDS (Sin botón duplicado de Aspecto — solo queda el global)
// =========================================================================
interface PlayerCardsProps {
  estado: EstadoDeJuego;
  mostrarDistancia: boolean;
  layout?: 'auto' | 'sidebar';
}

export const PlayerCards: React.FC<PlayerCardsProps> = ({
  estado,
  mostrarDistancia,
  layout = 'auto',
}) => {
  const gridClass =
    layout === 'sidebar'
      ? 'grid-cols-2 lg:grid-cols-1 gap-1.5'
      : estado.n === 2
      ? 'grid-cols-2 gap-1.5 sm:gap-2'
      : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1.5';

  return (
    <div className="w-full shrink-0">
      <div className={`grid ${gridClass}`}>
        {estado.jugadores.map((jugador, idx) => {
          const isActive = estado.turnoActual === idx && !estado.terminada;
          const { distancia } = bfsCamino(jugador, estado.murosH, estado.murosV, undefined, estado.n);
          const isWinner = estado.ganador === idx;
          const tieneReaccion =
            Boolean(estado.reaccionActiva) && estado.reaccionActiva?.jugadorId === jugador.id;

          return (
            <div
              key={jugador.id}
              className={`relative rounded-xl sm:rounded-2xl px-2 py-1.5 flex items-center gap-2 transition-colors duration-200 backdrop-blur-md ${
                isActive
                  ? 'bg-slate-800/95 border-2 border-emerald-400/75 shadow-md shadow-emerald-500/15'
                  : 'bg-slate-900/82 border border-white/15 hover:border-white/25'
              }`}
            >
              <div className="relative flex-shrink-0">
                <CartoonCharacter
                  color={jugador.color}
                  hat={jugador.hat}
                  ropa={jugador.ropa}
                  ropaColor={jugador.ropaColor}
                  aura={jugador.aura}
                  size={30}
                  showShadow={false}
                />
                {isWinner && (
                  <span
                    className="absolute -top-1.5 -left-1.5 text-sm leading-none drop-shadow pointer-events-none"
                    title="Ganador"
                  >
                    👑
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                    {jugador.nombre}
                  </span>

                  {tieneReaccion ? (
                    <span className="shrink-0 text-sm leading-none bg-slate-700/90 border border-white/20 rounded-md px-1 py-0.5 animate-bounce">
                      {estado.reaccionActiva?.emoji}
                    </span>
                  ) : isActive ? (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider text-emerald-200 bg-emerald-500/20 border border-emerald-400/35 leading-none">
                      {jugador.tipo === 'humano' ? 'Turno' : 'Bot'}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 tabular-nums">
                    <span className="text-amber-300/85">🧱</span>
                    <span>{jugador.muros}</span>
                  </div>

                  {mostrarDistancia && !estado.terminada && (
                    <div className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md border border-sky-400/25 bg-sky-500/15 text-sky-200 tabular-nums">
                      {distancia} {distancia === 1 ? 'paso' : 'pasos'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =========================================================================
// 2. ACTION BAR
// =========================================================================
interface ActionBarProps {
  estado: EstadoDeJuego;
  onCambiarModo: (modo: 'mover' | 'muro') => void;
  onRotarMuro: () => void;
  onPedirPista: () => void;
  onDeshacer: () => void;
  onAbrirHistorial: () => void;
  onEnviarReaccion?: (emoji: string) => void;
  deshabilitado: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  estado,
  onCambiarModo,
  onRotarMuro,
  onPedirPista,
  onDeshacer,
  onAbrirHistorial,
  onEnviarReaccion,
  deshabilitado,
}) => {
  const jugador = estado.jugadores[estado.turnoActual];
  const puedePonerMuro = jugador.muros > 0;
  const hayHistorial =
    estado.historial.length > 0 && estado.config.permitirDeshacer && !estado.modoOnline;
  const permitirPistas = estado.config.permitirPistas && !estado.modoOnline;
  const enModoMuro = estado.modoAccion === 'muro';

  return (
    <div className="w-full shrink-0 space-y-1.5">
      {onEnviarReaccion && (
        <div className="flex items-center justify-between gap-1 px-2.5 py-1 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-white/10 shadow-sm">
          <span className="hidden sm:inline text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            Reaccionar:
          </span>
          <div className="flex items-center justify-around flex-1">
            {['👋', '🧱', '😱', '😂', '👏', '🧠', '👑', '🔥'].map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => onEnviarReaccion(em)}
                className="text-base sm:text-lg hover:scale-125 active:scale-95 transition-transform cursor-pointer px-1 py-0.5 text-slate-200 leading-none"
                title={`Reaccionar ${em}`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-1.5 sm:p-2 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl space-y-1.5">
        {/* Fila principal fija (3 columnas constantes: Mover | Muro | Rotar) */}
        <div className="grid grid-cols-[1fr_1.15fr_auto] gap-1.5">
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => onCambiarModo('mover')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer border whitespace-nowrap ${
              estado.modoAccion === 'mover'
                ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/45 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border-white/10'
            } ${deshabilitado ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
          >
            <span>👟</span>
            <span>Mover</span>
          </button>

          <button
            type="button"
            disabled={deshabilitado || !puedePonerMuro}
            onClick={() => onCambiarModo('muro')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer border whitespace-nowrap tabular-nums ${
              enModoMuro
                ? 'bg-amber-400/20 text-amber-200 border-amber-400/45 shadow-sm shadow-amber-500/10'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border-white/10'
            } ${
              deshabilitado || !puedePonerMuro
                ? 'opacity-40 cursor-not-allowed'
                : 'active:scale-95'
            }`}
          >
            <span>🧱</span>
            <span>Muro ({jugador.muros})</span>
          </button>

          <button
            type="button"
            disabled={deshabilitado || !enModoMuro}
            onClick={onRotarMuro}
            title={
              enModoMuro
                ? 'Rotar orientación del muro (R)'
                : 'Cambia a modo Muro para rotar'
            }
            className={`min-h-[38px] min-w-[74px] px-2.5 py-1.5 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1 border whitespace-nowrap ${
              enModoMuro && !deshabilitado
                ? 'bg-orange-400/20 text-orange-200 border-orange-400/40 hover:bg-orange-400/30 active:scale-95 cursor-pointer'
                : 'bg-slate-800/50 text-slate-500 border-white/5 opacity-55 cursor-not-allowed'
            }`}
          >
            <span>🔄</span>
            <span>{estado.orientacionMuro === 'H' ? 'Horiz.' : 'Vert.'}</span>
          </button>
        </div>

        {/* Fila secundaria compacta: Pista, Deshacer, Historial */}
        <div className="flex items-center justify-center gap-1.5">
          {permitirPistas && (
            <button
              type="button"
              disabled={deshabilitado}
              onClick={onPedirPista}
              className={`flex-1 min-h-[34px] px-2.5 py-1 rounded-xl font-medium text-xs bg-slate-800/80 text-slate-200 hover:text-white hover:bg-slate-700/80 border border-white/10 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                deshabilitado ? 'opacity-45 cursor-not-allowed' : 'active:scale-95 cursor-pointer'
              }`}
              title="Pedir pista (-1 pt)"
            >
              <span>💡</span>
              <span>Pista</span>
            </button>
          )}

          {hayHistorial && (
            <button
              type="button"
              disabled={deshabilitado}
              onClick={onDeshacer}
              className={`flex-1 min-h-[34px] px-2.5 py-1 rounded-xl font-medium text-xs bg-slate-800/80 text-slate-200 hover:text-white hover:bg-slate-700/80 border border-white/10 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                deshabilitado ? 'opacity-45 cursor-not-allowed' : 'active:scale-95 cursor-pointer'
              }`}
              title="Deshacer jugada (-2 pts)"
            >
              <span>↩️</span>
              <span>Deshacer</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAbrirHistorial}
            className="flex-1 min-h-[34px] px-2.5 py-1 rounded-xl font-medium text-xs bg-indigo-500/15 text-indigo-200 border border-indigo-400/25 hover:bg-indigo-500/25 active:scale-95 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums"
            title="Ver registro de jugadas"
          >
            <span>📜</span>
            <span>Historial ({estado.registroAcciones ? estado.registroAcciones.length : 0})</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 3. HISTORIAL PANEL
// =========================================================================
interface HistorialPanelProps {
  acciones: AccionRegistro[];
  onCerrar: () => void;
  rondaActual?: number;
  totalRondas?: number;
}

export const HistorialPanel: React.FC<HistorialPanelProps> = ({
  acciones,
  onCerrar,
  rondaActual,
  totalRondas,
}) => {
  const [filtro, setFiltro] = useState<'todos' | 'mover' | 'muro'>('todos');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [acciones.length]);

  const filtradas = acciones.filter((a) => {
    if (filtro === 'mover') return a.tipo === 'mover';
    if (filtro === 'muro') return a.tipo === 'muro';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full sm:max-w-md h-full sm:h-[90vh] bg-slate-900/95 border-t sm:border border-white/10 sm:rounded-3xl p-5 shadow-2xl flex flex-col animate-[slideDown_0.25s_ease-out] text-slate-100">
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">Registro de Partida</h2>
                {rondaActual && totalRondas && (
                  <span className="text-[10px] font-semibold uppercase bg-amber-400/20 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-full">
                    Ronda {rondaActual}/{totalRondas}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {acciones.length} {acciones.length === 1 ? 'jugada registrada' : 'jugadas registradas'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-8 h-8 rounded-full bg-slate-800/80 border border-white/10 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-700/80 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/60 rounded-xl border border-white/10 mb-3">
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'mover', label: '👟 Pasos' },
            { id: 'muro', label: '🧱 Muros' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                sounds.playClick();
                setFiltro(f.id as any);
              }}
              className={`py-1 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                filtro === f.id
                  ? 'bg-slate-800 text-white border border-white/10 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 my-1"
        >
          {filtradas.length === 0 ? (
            <div className="p-6 text-center text-slate-400 font-medium text-xs bg-slate-800/40 rounded-2xl border border-white/5 my-auto">
              No hay acciones con este filtro.
            </div>
          ) : (
            filtradas.map((a, idx) => (
              <div
                key={`${a.turnoNumero}-${idx}`}
                className="p-2.5 rounded-xl border border-white/5 bg-slate-800/60 flex items-center gap-2.5 shadow-sm"
              >
                <div className="w-6 text-center text-xs font-semibold text-slate-400">
                  #{a.turnoNumero}
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full border border-white/20"
                  style={{ backgroundColor: a.jugadorColor }}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-xs text-slate-200 block truncate">
                    {a.jugadorNombre}
                  </span>
                  <span className="text-[11px] font-normal text-slate-400 block">
                    {a.descripcion}
                  </span>
                </div>
                <span className="text-sm flex-shrink-0">
                  {a.tipo === 'muro' ? '🧱' : a.tipo === 'mover' ? '👟' : '⏳'}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-white/10">
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-full py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-emerald-400/90 to-teal-400/90 text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-emerald-500/10"
          >
            Volver a la Partida
          </button>
        </div>
      </div>
    </div>
  );
};
