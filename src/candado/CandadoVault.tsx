/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pieza visual central de Candado: Bóveda / Candado 2D compacto y animado (Bronce / Acero / Real).
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
  const temaMaterial =
    digitos === 4
      ? {
          titulo: 'Bóveda Bronce',
          cuerpoGrad: esMinimalista ? 'from-amber-900/90 to-stone-900' : 'from-[#f59f00] to-[#d9480f]',
          borde: esMinimalista ? 'border-amber-500/40' : 'border-[#2b2140]',
          arcoColor: esMinimalista ? '#d97706' : '#e67700',
          insignia: '🥉 4 Díg.',
        }
      : digitos === 5
      ? {
          titulo: 'Bóveda Acero',
          cuerpoGrad: esMinimalista ? 'from-slate-800 to-slate-950' : 'from-[#74c0fc] to-[#364fc7]',
          borde: esMinimalista ? 'border-cyan-400/40' : 'border-[#2b2140]',
          arcoColor: esMinimalista ? '#94a3b8' : '#adb5bd',
          insignia: '🛡️ 5 Díg.',
        }
      : {
          titulo: 'Bóveda Real',
          cuerpoGrad: esMinimalista ? 'from-violet-900/90 to-slate-950' : 'from-[#9775fa] to-[#5f3dc4]',
          borde: esMinimalista ? 'border-purple-400/50' : 'border-[#2b2140]',
          arcoColor: '#ffd43b',
          insignia: '👑 6 Díg.',
        };

  const abierta = fase === 'ganada';
  const bloqueada = fase === 'perdida';

  return (
    <div
      className={`relative w-full max-w-[390px] flex flex-col items-center select-none ${
        errorShake && !animacionesReducidas ? 'animate-[shake_0.28s_ease-in-out]' : ''
      }`}
    >
      {/* Grillete compacto */}
      <div className="relative h-8 sm:h-9 w-24 sm:w-28 flex items-end justify-center overflow-visible -mb-2 z-0">
        <svg
          viewBox="0 0 180 90"
          className={`w-full h-full overflow-visible ${
            animacionesReducidas ? '' : 'transition-transform duration-500 ease-out'
          }`}
          style={{
            transform: abierta
              ? 'translateY(-12px) rotate(-14deg)'
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

      {/* Cuerpo compacto de la bóveda */}
      <div
        className={`relative z-10 w-full rounded-2xl bg-gradient-to-b ${temaMaterial.cuerpoGrad} ${
          esMinimalista
            ? `border ${temaMaterial.borde} shadow-xl`
            : `border-3 border-[#2b2140] shadow-[0_5px_0_#2b2140,0_10px_18px_rgba(0,0,0,0.25)]`
        } p-2.5 sm:p-3 transition-colors`}
      >
        {/* Cabecera de estado */}
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-block w-2 h-2 rounded-full border shrink-0 ${
                abierta
                  ? 'bg-[#51cf66] border-white shadow-[0_0_6px_#51cf66]'
                  : bloqueada
                  ? 'bg-[#ff6b6b] border-white shadow-[0_0_6px_#ff6b6b]'
                  : 'bg-[#ffd43b] border-[#2b2140]'
              }`}
            />
            <span
              className={
                esMinimalista
                  ? 'font-bold text-slate-200 truncate'
                  : 'font-black text-white drop-shadow-[0_1px_0_#2b2140] truncate'
              }
            >
              {temaMaterial.titulo} · {modo === 'logico' ? 'Lógico' : 'Mayor / Menor'}
            </span>
          </div>

          <span
            className={
              esMinimalista
                ? 'px-1.5 py-0.5 rounded-md bg-black/30 text-slate-300 font-mono text-[10px] font-semibold tabular-nums border border-white/10 shrink-0'
                : 'px-1.5 py-0.5 rounded-lg bg-white/90 text-[#2b2140] text-[10px] font-black tabular-nums border border-[#2b2140] shrink-0'
            }
          >
            {temaMaterial.insignia}
          </span>
        </div>

        {/* Visor de Dígitos */}
        <div
          className={`rounded-xl p-2 ${
            esMinimalista
              ? 'bg-slate-950/90 border border-white/15 shadow-inner'
              : 'bg-[#1f172e] border-2 border-[#2b2140] shadow-inner'
          }`}
        >
          <div
            className="grid gap-1.5 sm:gap-2 justify-center"
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
                  className={`relative h-11 sm:h-12 rounded-xl flex items-center justify-center font-mono font-black text-xl sm:text-2xl tabular-nums transition-all cursor-pointer select-none ${
                    abierta
                      ? 'bg-[#d3f9d8] text-[#134e20] border-2 border-[#40c057] shadow-[0_0_10px_rgba(81,207,102,0.45)]'
                      : bloqueada
                      ? 'bg-[#ffe3e3] text-[#c92a2a] border-2 border-[#fa5252]'
                      : seleccionado
                      ? 'bg-[#fff9db] text-[#2b2140] border-2 border-[#ffd43b] shadow-[0_0_0_2px_rgba(255,212,59,0.45)]'
                      : val !== ''
                      ? 'bg-white text-[#2b2140] border-2 border-[#495057]'
                      : 'bg-[#2c2240] text-white/35 border border-white/15 hover:border-white/35'
                  }`}
                >
                  <span>{val !== '' ? val : '•'}</span>
                  {seleccionado && (
                    <span className="absolute bottom-0.5 w-3.5 h-0.5 rounded-full bg-[#f08c00]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Telemetría compacta */}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <div
            className={
              esMinimalista
                ? 'px-2 py-0.5 rounded-lg bg-black/35 border border-white/10 text-slate-200 font-semibold tabular-nums'
                : 'px-2 py-0.5 rounded-lg bg-[#fff8e7] border border-[#2b2140] text-[#2b2140] font-black tabular-nums'
            }
          >
            🎯 {intentosUsados}
            {maxIntentos > 0 ? ` / ${maxIntentos}` : ' / ∞'}
          </div>

          <div
            className={
              esMinimalista
                ? 'px-2 py-0.5 rounded-lg bg-black/35 border border-white/10 text-slate-200 font-mono font-semibold tabular-nums'
                : 'px-2 py-0.5 rounded-lg bg-[#fff8e7] border border-[#2b2140] text-[#2b2140] font-mono font-black tabular-nums'
            }
          >
            ⏱️ {formatMMSS(tiempoSegundos)}
          </div>
        </div>
      </div>
    </div>
  );
};
