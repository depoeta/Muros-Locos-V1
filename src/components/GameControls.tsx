/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { bfsCamino } from '../game/murosLocosEngine';
import { AccionRegistro, GameState } from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import { sounds } from '../audio/murosAudio';

// =========================================================================
// 1. PLAYER CARDS
// =========================================================================
interface PlayerCardsProps {
  estado: GameState;
  mostrarDistancia: boolean;
}

export const PlayerCards: React.FC<PlayerCardsProps> = ({ estado, mostrarDistancia }) => {
  return (
    <div className="w-full max-w-[620px] mx-auto px-2 mb-2">
      <div
        className={`grid gap-2 ${
          estado.n === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {estado.jugadores.map((jugador, idx) => {
          const isActive = estado.turnoActual === idx && !estado.terminada;
          const { distancia } = bfsCamino(jugador, estado.murosH, estado.murosV);
          const isWinner = estado.ganador === idx;

          return (
            <div
              key={jugador.id}
              className={`relative rounded-2xl p-2.5 flex items-center gap-2 border-3 border-[#2b2140] transition-all duration-300 ${
                isActive
                  ? 'bg-white shadow-[0_6px_0_#2b2140,-2px_0_12px_rgba(255,212,59,0.35)] -translate-y-1 scale-[1.03] z-10'
                  : 'bg-[#fff8e7]/90 shadow-[0_3px_0_#2b2140] opacity-90'
              }`}
            >
              {isActive && (
                <div
                  className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase text-white border-2 border-[#2b2140] shadow-sm animate-bounce"
                  style={{ backgroundColor: jugador.color }}
                >
                  Turno
                </div>
              )}

              {/* Floating Reaction Bubble */}
              {estado.reaccionActiva && estado.reaccionActiva.jugadorId === jugador.id && (
                <div className="absolute -top-7 left-4 z-30 text-2xl animate-bounce bg-white rounded-full px-1.5 py-0.5 border-2 border-[#2b2140] shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                  {estado.reaccionActiva.emoji}
                </div>
              )}

              {isWinner && (
                <div className="absolute -top-2 left-2 text-xl filter drop-shadow">
                  👑
                </div>
              )}

              <div className="flex-shrink-0">
                <CartoonCharacter
                  color={jugador.color}
                  hat={jugador.hat}
                  size={36}
                  showShadow={false}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-xs sm:text-sm text-[#2b2140] truncate block">
                    {jugador.nombre}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-0.5 text-xs font-black text-[#593922]">
                    <span className="text-sm">🧱</span>
                    <span>{jugador.muros}</span>
                  </div>

                  {mostrarDistancia && !estado.terminada && (
                    <div
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded-md border border-[#2b2140]/30"
                      style={{
                        backgroundColor: `${jugador.color}25`,
                        color: '#2b2140',
                      }}
                    >
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
  estado: GameState;
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

  return (
    <div className="w-full max-w-[620px] mx-auto px-2 mt-2">
      {/* Online Quick Reaction Emojis */}
      {estado.modoOnline && onEnviarReaccion && (
        <div className="flex items-center justify-center gap-1.5 mb-1.5 px-2 py-1 bg-white/80 rounded-xl border-2 border-[#2b2140] shadow-sm">
          <span className="text-[10px] font-bold text-[#86542d] mr-1">Reaccionar:</span>
          {['👋', '🧱', '😱', '😂', '👏', '🧠', '👑', '🔥'].map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => onEnviarReaccion(em)}
              className="text-sm hover:scale-130 active:scale-95 transition-transform cursor-pointer px-1"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-[#fff8e7] rounded-2xl border-3 border-[#2b2140] shadow-[0_5px_0_#2b2140]">
        {/* Button: Mover */}
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => onCambiarModo('mover')}
          className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-sm border-2 border-[#2b2140] transition-all flex items-center gap-1.5 cursor-pointer ${
            estado.modoAccion === 'mover'
              ? 'bg-[#51cf66] text-[#134e20] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
              : 'bg-white text-[#2b2140] hover:bg-[#f8f9fa] shadow-[0_2px_0_#2b2140]'
          } ${deshabilitado ? 'opacity-50 cursor-not-allowed' : 'active:translate-y-0.5'}`}
        >
          <span>👟</span>
          <span>Mover</span>
        </button>

        {/* Button: Colocar Muro */}
        <button
          type="button"
          disabled={deshabilitado || !puedePonerMuro}
          onClick={() => onCambiarModo('muro')}
          className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-sm border-2 border-[#2b2140] transition-all flex items-center gap-1.5 cursor-pointer ${
            estado.modoAccion === 'muro'
              ? 'bg-[#ffd43b] text-[#5c3c00] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
              : 'bg-white text-[#2b2140] hover:bg-[#f8f9fa] shadow-[0_2px_0_#2b2140]'
          } ${
            deshabilitado || !puedePonerMuro
              ? 'opacity-50 cursor-not-allowed'
              : 'active:translate-y-0.5'
          }`}
        >
          <span>🧱</span>
          <span>Poner Muro ({jugador.muros})</span>
        </button>

        {/* Button: Rotar Muro */}
        {estado.modoAccion === 'muro' && (
          <button
            type="button"
            disabled={deshabilitado}
            onClick={onRotarMuro}
            className="px-3 py-2 rounded-xl font-bold text-xs bg-[#ff922b] text-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#f76707] active:translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer animate-[pulse_1.5s_ease-in-out_infinite]"
          >
            <span>🔄</span>
            <span>{estado.orientacionMuro === 'H' ? 'Horizontal (H)' : 'Vertical (V)'}</span>
          </button>
        )}

        {/* Button: Pista */}
        {permitirPistas && (
          <button
            type="button"
            disabled={deshabilitado}
            onClick={onPedirPista}
            className="px-2.5 sm:px-3 py-2 rounded-xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#f8f9fa] active:translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer"
            title="Pedir pista (-5 pts)"
          >
            <span>💡</span>
            <span className="hidden sm:inline">Pista</span>
          </button>
        )}

        {/* Button: Deshacer */}
        {hayHistorial && (
          <button
            type="button"
            disabled={deshabilitado}
            onClick={onDeshacer}
            className="px-2.5 sm:px-3 py-2 rounded-xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#f8f9fa] active:translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer"
            title="Deshacer jugada (-10 pts)"
          >
            <span>↩️</span>
            <span className="hidden sm:inline">Deshacer</span>
          </button>
        )}

        {/* Button: Historial */}
        <button
          type="button"
          onClick={onAbrirHistorial}
          className="px-2.5 sm:px-3 py-2 rounded-xl font-bold text-xs bg-[#e7f5ff] text-[#1864ab] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#d0ebff] active:translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer"
          title="Ver registro de jugadas"
        >
          <span>📜</span>
          <span>Historial ({estado.registroAcciones ? estado.registroAcciones.length : 0})</span>
        </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-end sm:p-4 bg-black/50 backdrop-blur-xs animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full sm:max-w-md h-full sm:h-[90vh] bg-[#fff8e7] border-t-4 sm:border-4 border-[#2b2140] sm:rounded-3xl p-4 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col animate-[slideDown_0.25s_ease-out]">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-3 border-[#2b2140]/15">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📜</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#2b2140]">
                  Registro de Partida
                </h2>
                {rondaActual && totalRondas && (
                  <span className="text-[10px] font-black uppercase bg-[#ffd43b] text-[#5c3c00] px-2 py-0.5 rounded-full border border-[#2b2140]">
                    Ronda {rondaActual}/{totalRondas}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#86542d] font-semibold">
                {acciones.length} {acciones.length === 1 ? 'jugada registrada' : 'jugadas registradas'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-8 h-8 rounded-full bg-[#f1f3f5] border-2 border-[#2b2140] text-sm font-black text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filter Pills */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#ede4d0] rounded-2xl border-2 border-[#2b2140] mb-3">
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
              className={`py-1 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                filtro === f.id
                  ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-sm'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Action List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 my-1"
        >
          {filtradas.length === 0 ? (
            <div className="p-6 text-center text-[#86542d] font-bold text-xs bg-white rounded-2xl border-2 border-dashed border-[#2b2140]/30 my-auto">
              No hay acciones con este filtro.
            </div>
          ) : (
            filtradas.map((a, idx) => (
              <div
                key={`${a.turnoNumero}-${idx}`}
                className="p-2.5 rounded-2xl border-2 border-[#2b2140] bg-white flex items-center gap-2.5 shadow-sm"
              >
                <div className="w-6 text-center text-xs font-black text-[#86542d]">
                  #{a.turnoNumero}
                </div>
                <div
                  className="w-3 h-3 rounded-full border border-[#2b2140]"
                  style={{ backgroundColor: a.jugadorColor }}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-extrabold text-xs text-[#2b2140] block truncate">
                    {a.jugadorNombre}
                  </span>
                  <span className="text-[11px] font-semibold text-[#86542d] block">
                    {a.descripcion}
                  </span>
                </div>
                <span className="text-base flex-shrink-0">
                  {a.tipo === 'muro' ? '🧱' : a.tipo === 'mover' ? '👟' : '⏳'}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t-2 border-[#2b2140]/15">
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-full py-2.5 rounded-xl font-black text-xs sm:text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
          >
            Volver a la Partida
          </button>
        </div>
      </div>
    </div>
  );
};
