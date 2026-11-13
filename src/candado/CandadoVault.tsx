/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pieza visual central de Candado: Bóveda / Candado 2D animado con niveles evolutivos (Bronce / Acero / Real).
 */

import React from 'react';
import { DigitosCandado, FasePartidaCandado, ModoCandado } from './types';

interface CandadoVaultProps {
  digitos: DigitosCandado;
  entradaActual: string[];
  cursorIdx: number;
  onSelectSlot: (idx: number) => void;
  fase: FasePartidaCandado;
  modo: ModoCandado;
  intentosUsados: number;
  maxIntentos: number;
  tiempoSegundos: number;
  errorShake: boolean;
  esMinimalista: boolean;
  animacionesReducidas: boolean;
}

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const CandadoVault: React.FC<CandadoVaultProps> = ({
  digitos,
  entradaActual,
  cursorIdx,
  onSelectSlot,
  fase,
  modo,
  intentosUsados,
  maxIntentos,
  tiempoSegundos,
  errorShake,
  esMinimalista,
  animacionesReducidas,
}) => {
  // Material evolutivo según dificultad de dígitos (4 = Bronce, 5 = Acero, 6 = Real Oro-Púrpura)
  const temaMaterial =
    digitos === 4
      ? {
          titulo: 'Bóveda Bronce',
          cuerpoGrad: esMinimalista ? 'from-amber-900/90 to-stone-900' : 'from-[#f59f00] to-[#d9480f]',
          borde: esMinimalista ? 'border-amber-500/40' : 'border-[#2b2140]',
          arcoColor: esMinimalista ? '#d97706' : '#e67700',
          insignia: '🥉 4 Dígitos',
        }
      : digitos === 5
      ? {
          titulo: 'Bóveda Acero',
          cuerpoGrad: esMinimalista ? 'from-slate-800 to-slate-950' : 'from-[#74c0fc] to-[#364fc7]',
          borde: esMinimalista ? 'border-cyan-400/40' : 'border-[#2b2140]',
          arcoColor: esMinimalista ? '#94a3b8' : '#adb5bd',
          insignia: '🛡️ 5 Dígitos',
        }
      : {
          titulo: 'Bóveda Real',
          cuerpoGrad: esMinimalista ? 'from-violet-900/90 to-slate-950' : 'from-[#9775fa] to-[#5f3dc4]',
          borde: esMinimalista ? 'border-purple-400/50' : 'border-[#2b2140]',
          arcoColor: '#ffd43b',
          insignia: '👑 6 Dígitos',
        };

  const abierta = fase === 'ganada';
  const bloqueada = fase === 'perdida';

  return (
    <div
      className={`relative w-full flex flex-col items-center select-none ${
        errorShake && !animacionesReducidas ? 'animate-[shake_0.28s_ease-in-out]' : ''
      }`}
    >
      {/* Grillete / Arco metálico superior del candado */}
      <div className="relative h-14 sm:h-16 w-36 sm:w-44 flex items-end justify-center overflow-visible -mb-3 z-0">
        <svg
          viewBox="0 0 180 90"
          className={`w-full h-full overflow-visible ${
            animacionesReducidas ? '' : 'transition-transform duration-500 ease-out'
          }`}
          style={{
            transform: abierta
              ? 'translateY(-16px) rotate(-14deg)'
              : 'translateY(0px) rotate(0deg)',
            transformOrigin: '36px 85px',
          }}
          aria-hidden="true"
        >
          <path
            d="M 38 88 L 38 44 C 38 14, 142 14, 142 44 L 142 88"
            fill="none"
            stroke={esMinimalista ? '#0f172a' : '#2b2140'}
            strokeWidth="26"
            strokeLinecap="round"
          />
          <path
            d="M 38 88 L 38 44 C 38 14, 142 14, 142 44 L 142 88"
            fill="none"
            stroke={abierta ? '#51cf66' : bloqueada ? '#ff6b6b' : temaMaterial.arcoColor}
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 48 64 L 48 44 C 48 25, 115 22, 128 34"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Cuerpo principal de la bóveda */}
      <div
        className={`relative z-10 w-full max-w-[460px] rounded-3xl bg-gradient-to-b ${temaMaterial.cuerpoGrad} ${
          esMinimalista
            ? `border ${temaMaterial.borde} shadow-2xl`
            : `border-4 border-[#2b2140] shadow-[0_8px_0_#2b2140,0_16px_28px_rgba(0,0,0,0.3)]`
        } p-3.5 sm:p-5 transition-colors`}
      >
        {/* Tornillos decorativos de las esquinas */}
        <div className="flex items-center justify-between text-[10px] mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full border ${
                abierta
                  ? 'bg-[#51cf66] border-white shadow-[0_0_8px_#51cf66]'
                  : bloqueada
                  ? 'bg-[#ff6b6b] border-white shadow-[0_0_8px_#ff6b6b]'
                  : 'bg-[#ffd43b] border-[#2b2140]'
              }`}
            />
            <span
              className={
                esMinimalista
                  ? 'font-bold text-slate-200 tracking-wide'
                  : 'font-black text-white drop-shadow-[0_1px_0_#2b2140]'
              }
            >
              {temaMaterial.titulo} · {modo === 'logico' ? 'Lógico' : 'Mayor / Menor'}
            </span>
          </div>

          <span
            className={
              esMinimalista
                ? 'px-2 py-0.5 rounded-lg bg-black/30 text-slate-300 font-mono font-semibold tabular-nums border border-white/10'
                : 'px-2 py-0.5 rounded-xl bg-white/90 text-[#2b2140] font-black tabular-nums border-2 border-[#2b2140]'
            }
          >
            {temaMaterial.insignia}
          </span>
        </div>

        {/* Visor de Ruedas de Dígitos */}
        <div
          className={`rounded-2xl p-2.5 sm:p-3.5 ${
            esMinimalista
              ? 'bg-slate-950/90 border border-white/15 shadow-inner'
              : 'bg-[#1f172e] border-3 border-[#2b2140] shadow-inner'
          }`}
        >
          <div
            className="grid gap-2 sm:gap-2.5 justify-center"
            style={{ gridTemplateColumns: `repeat(${digitos}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: digitos }).map((_, idx) => {
              const val = entradaActual[idx] ?? '';
              const seleccionado = idx === cursorIdx && fase === 'jugando';
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSlot(idx)}
                  disabled={fase !== 'jugando'}
                  aria-label={`Dígito ${idx + 1}: ${val || 'vacío'}`}
                  className={`relative h-14 sm:h-16 rounded-2xl flex items-center justify-center font-mono font-black text-2xl sm:text-3xl tabular-nums transition-all cursor-pointer select-none ${
                    abierta
                      ? 'bg-[#d3f9d8] text-[#134e20] border-2 border-[#40c057] shadow-[0_0_12px_rgba(81,207,102,0.5)]'
                      : bloqueada
                      ? 'bg-[#ffe3e3] text-[#c92a2a] border-2 border-[#fa5252]'
                      : seleccionado
                      ? 'bg-[#fff9db] text-[#2b2140] border-3 border-[#ffd43b] shadow-[0_0_0_2px_rgba(255,212,59,0.45)] -translate-y-0.5'
                      : val !== ''
                      ? 'bg-white text-[#2b2140] border-2 border-[#495057] shadow-[0_3px_0_#343a40]'
                      : 'bg-[#2c2240] text-white/35 border-2 border-white/15 hover:border-white/35'
                  }`}
                >
                  <span>{val !== '' ? val : '•'}</span>
                  {seleccionado && (
                    <span className="absolute bottom-1 w-4 h-1 rounded-full bg-[#f08c00]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Barra de telemetría de la bóveda (Intentos + Cronómetro) */}
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
          <div
            className={
              esMinimalista
                ? 'px-2.5 py-1 rounded-xl bg-black/35 border border-white/10 text-slate-200 font-semibold tabular-nums'
                : 'px-2.5 py-1 rounded-xl bg-[#fff8e7] border-2 border-[#2b2140] text-[#2b2140] font-black tabular-nums'
            }
          >
            🎯 Intentos:{' '}
            <span>
              {intentosUsados}
              {maxIntentos > 0 ? ` / ${maxIntentos}` : ' / ∞'}
            </span>
          </div>

          <div
            className={
              esMinimalista
                ? 'px-2.5 py-1 rounded-xl bg-black/35 border border-white/10 text-slate-200 font-mono font-semibold tabular-nums'
                : 'px-2.5 py-1 rounded-xl bg-[#fff8e7] border-2 border-[#2b2140] text-[#2b2140] font-mono font-black tabular-nums'
            }
          >
            ⏱️ {formatMMSS(tiempoSegundos)}
          </div>
        </div>
      </div>
    </div>
  );
};
