/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { bfsCamino, sounds } from '../game/murosLocosEngine';
import { AccionRegistro, EstadoDeJuego } from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import { useMurosTheme } from '../game/murosTheme';

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
  const { t } = useMurosTheme();
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

          const cardCls = t.esClasico
            ? isActive
              ? 'bg-[#fff9db] border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140]'
              : 'bg-white/95 border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
            : t.esOscuro
            ? isActive
              ? 'bg-slate-800/95 border-2 border-emerald-400/75 shadow-md shadow-emerald-500/15 backdrop-blur-md'
              : 'bg-slate-900/82 border border-white/15 hover:border-white/25 backdrop-blur-md'
            : isActive
            ? 'bg-[#FFFDF6] border-2 border-[#72C89D] shadow-[0_6px_16px_-4px_rgba(38,41,59,0.12)]'
            : 'bg-[#FFFDF6]/90 border border-[#DFD6BF] hover:border-[#CBBFA3] shadow-2xs';

          return (
            <div
              key={jugador.id}
              className={`relative rounded-xl sm:rounded-2xl px-2 py-1.5 flex items-center gap-2 transition-colors duration-200 ${cardCls}`}
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
                  <span
                    className={`text-xs sm:text-sm truncate ${
                      t.esClasico ? 'font-black text-[#2b2140]' : `font-semibold ${t.title}`
                    }`}
                  >
                    {jugador.nombre}
                  </span>

                  {tieneReaccion ? (
                    <span
                      className={`shrink-0 text-sm leading-none rounded-md px-1 py-0.5 animate-bounce ${
                        t.esClasico
                          ? 'bg-white border border-[#2b2140]'
                          : t.esOscuro
                          ? 'bg-slate-700/90 border border-white/20'
                          : 'bg-[#FAF4E4] border border-[#DFD6BF]'
                      }`}
                    >
                      {estado.reaccionActiva?.emoji}
                    </span>
                  ) : isActive ? (
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider leading-none ${
                        t.esClasico
                          ? 'bg-[#51cf66] text-[#134e20] border border-[#2b2140]'
                          : t.esOscuro
                          ? 'text-emerald-200 bg-emerald-500/20 border border-emerald-400/35'
                          : 'text-[#0F3D27] bg-[#B7EBD0] border border-[#8AD2AE]'
                      }`}
                    >
                      {jugador.tipo === 'humano' ? 'Turno' : 'Bot'}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <div
                    className={`flex items-center gap-1 text-[11px] font-semibold tabular-nums ${t.sub}`}
                  >
                    <span className={t.esOscuro ? 'text-amber-300/85' : ''}>🧱</span>
                    <span>{jugador.muros}</span>
                  </div>

                  {mostrarDistancia && !estado.terminada && (
                    <div
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md border tabular-nums ${
                        t.esClasico
                          ? 'border-[#1864ab]/40 bg-[#e7f5ff] text-[#1864ab]'
                          : t.esOscuro
                          ? 'border-sky-400/25 bg-sky-500/15 text-sky-200'
                          : 'border-[#A4C6F4] bg-[#CEE4FF]/70 text-[#143254]'
                      }`}
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
  const { t } = useMurosTheme();
  const jugador = estado.jugadores[estado.turnoActual];
  const puedePonerMuro = jugador.muros > 0;
  const hayHistorial =
    estado.historial.length > 0 && estado.config.permitirDeshacer && !estado.modoOnline;
  const permitirPistas = estado.config.permitirPistas && !estado.modoOnline;
  const enModoMuro = estado.modoAccion === 'muro';

  const containerCls = t.esClasico
    ? 'bg-[#fff8e7] border-2 border-[#2b2140] shadow-[0_4px_0_#2b2140]'
    : t.esOscuro
    ? 'bg-slate-900/85 backdrop-blur-md border border-white/10 shadow-xl'
    : 'bg-[#FFFDF6]/95 border border-[#DFD6BF] shadow-[0_10px_28px_-10px_rgba(38,41,59,0.14)]';

  const moveBtnCls =
    estado.modoAccion === 'mover'
      ? t.esClasico
        ? 'bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black'
        : t.esOscuro
        ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/45 shadow-sm'
        : 'bg-[#B7EBD0] text-[#0F3D27] border border-[#8AD2AE] shadow-2xs'
      : t.esClasico
      ? 'bg-white text-[#2b2140] hover:bg-[#f8f9fa] border-2 border-[#2b2140] font-bold'
      : t.esOscuro
      ? 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-white/10'
      : 'bg-[#FAF4E4] text-[#3E4359] hover:text-[#171923] hover:bg-[#F2EBD9] border border-[#DFD6BF]';

  const wallBtnCls = enModoMuro
    ? t.esClasico
      ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black'
      : t.esOscuro
      ? 'bg-amber-400/20 text-amber-200 border border-amber-400/45 shadow-sm'
      : 'bg-[#FCE8B8] text-[#4A3309] border border-[#EAD08E] shadow-2xs'
    : t.esClasico
    ? 'bg-white text-[#2b2140] hover:bg-[#f8f9fa] border-2 border-[#2b2140] font-bold'
    : t.esOscuro
    ? 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-white/10'
    : 'bg-[#FAF4E4] text-[#3E4359] hover:text-[#171923] hover:bg-[#F2EBD9] border border-[#DFD6BF]';

  const rotateBtnCls =
    enModoMuro && !deshabilitado
      ? t.esClasico
        ? 'bg-[#ffa94d] text-[#4a2200] border-2 border-[#2b2140] hover:bg-[#ff922b] active:scale-95 cursor-pointer font-black'
        : t.esOscuro
        ? 'bg-orange-400/20 text-orange-200 border border-orange-400/40 hover:bg-orange-400/30 active:scale-95 cursor-pointer'
        : 'bg-[#FDE4D2] text-[#632D0D] border border-[#F2C3A3] hover:bg-[#FAD6BD] active:scale-95 cursor-pointer'
      : t.esClasico
      ? 'bg-[#e9ecef] text-[#868e96] border-2 border-[#adb5bd] opacity-65 cursor-not-allowed'
      : t.esOscuro
      ? 'bg-slate-800/50 text-slate-500 border border-white/5 opacity-55 cursor-not-allowed'
      : 'bg-[#F2EBD9] text-[#7D8298] border border-[#DFD6BF] opacity-65 cursor-not-allowed';

  return (
    <div className="w-full shrink-0 space-y-1.5">
      {onEnviarReaccion && (
        <div
          className={`flex items-center justify-between gap-1 px-2.5 py-1 rounded-2xl ${containerCls}`}
        >
          <span
            className={`hidden sm:inline text-[10px] font-semibold uppercase tracking-wider shrink-0 ${t.muted}`}
          >
            Reaccionar:
          </span>
          <div className="flex items-center justify-around flex-1">
            {['👋', '🧱', '😱', '😂', '👏', '🧠', '👑', '🔥'].map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => onEnviarReaccion(em)}
                className={`text-base sm:text-lg hover:scale-125 active:scale-95 transition-transform cursor-pointer px-1 py-0.5 leading-none ${t.title}`}
                title={`Reaccionar ${em}`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`p-1.5 sm:p-2 rounded-2xl space-y-1.5 ${containerCls}`}>
        {/* Fila principal fija (3 columnas constantes: Mover | Muro | Rotar) */}
        <div className="grid grid-cols-[1fr_1.15fr_auto] gap-1.5">
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => onCambiarModo('mover')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${moveBtnCls} ${
              deshabilitado ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            <span>👟</span>
            <span>Mover</span>
          </button>

          <button
            type="button"
            disabled={deshabilitado || !puedePonerMuro}
            onClick={() => onCambiarModo('muro')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${wallBtnCls} ${
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
            className={`min-h-[38px] min-w-[74px] px-2.5 py-1.5 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${rotateBtnCls}`}
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
              className={`flex-1 min-h-[34px] px-2.5 py-1 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${t.btnNeutral} ${
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
              className={`flex-1 min-h-[34px] px-2.5 py-1 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${t.btnNeutral} ${
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
            className={`flex-1 min-h-[34px] px-2.5 py-1 rounded-xl font-medium text-xs active:scale-95 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
              t.esClasico
                ? 'bg-[#e7f5ff] text-[#1864ab] border-2 border-[#2b2140] hover:bg-[#d0ebff] font-black'
                : t.btnViolet
            }`}
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
  const { t } = useMurosTheme();
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
      <div
        className={`relative w-full sm:max-w-md h-full sm:h-[90vh] sm:rounded-3xl p-5 flex flex-col animate-[slideDown_0.25s_ease-out] ${t.shellModal}`}
      >
        <div className={`flex items-center justify-between pb-3 mb-2 border-b ${t.divider}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-base sm:text-lg font-bold ${t.title}`}>
                  Registro de Partida
                </h2>
                {rondaActual && totalRondas && (
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${t.bannerWarn}`}>
                    Ronda {rondaActual}/{totalRondas}
                  </span>
                )}
              </div>
              <p className={`text-xs font-medium ${t.muted}`}>
                {acciones.length} {acciones.length === 1 ? 'jugada registrada' : 'jugadas registradas'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer ${t.closeBtn}`}
          >
            ✕
          </button>
        </div>

        <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl mb-3 ${t.track}`}>
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'mover', label: '👟 Pasos' },
            { id: 'muro', label: '🧱 Muros' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                sounds.playClick();
                setFiltro(f.id as 'todos' | 'mover' | 'muro');
              }}
              className={`py-1 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                filtro === f.id ? t.tabActive : t.tabInactive
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
            <div className={`p-6 text-center font-medium text-xs rounded-2xl my-auto ${t.card} ${t.muted}`}>
              No hay acciones con este filtro.
            </div>
          ) : (
            filtradas.map((a, idx) => (
              <div
                key={`${a.turnoNumero}-${idx}`}
                className={`p-2.5 rounded-xl flex items-center gap-2.5 shadow-2xs ${t.card}`}
              >
                <div className={`w-6 text-center text-xs font-semibold tabular-nums ${t.muted}`}>
                  #{a.turnoNumero}
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                  style={{ backgroundColor: a.jugadorColor }}
                />
                <div className="flex-1 min-w-0">
                  <span className={`font-semibold text-xs block truncate ${t.title}`}>
                    {a.jugadorNombre}
                  </span>
                  <span className={`text-[11px] font-normal block ${t.muted}`}>
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

        <div className={`pt-3 border-t ${t.divider}`}>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${t.btnPrimary}`}
          >
            Volver a la Partida
          </button>
        </div>
      </div>
    </div>
  );
};
