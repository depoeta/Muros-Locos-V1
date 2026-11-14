/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pieza visual central de Candado: Bóveda moderna en acabados pastel suaves y mates.
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
          titulo: 'Serie Arena',
          cuerpoGrad: esMinimalista
            ? 'from-stone-800/95 to-slate-900'
            : 'from-[#F7E8D8] to-[#EED7BE]',
          borde: esMinimalista ? 'border-amber-200/25' : 'border-[#DFC2A4]',
          textoTitulo: esMinimalista ? 'text-amber-100' : 'text-[#3B2613]',
          arcoColor: esMinimalista ? '#E6C29F' : '#D5AF86',
          insignia: '4 Díg.',
        }
      : digitos === 5
      ? {
          titulo: 'Serie Bruma',
          cuerpoGrad: esMinimalista
            ? 'from-slate-800/95 to-slate-900'
            : 'from-[#DFECFA] to-[#CBE0F6]',
          borde: esMinimalista ? 'border-sky-200/25' : 'border-[#B2CCE8]',
          textoTitulo: esMinimalista ? 'text-sky-100' : 'text-[#162B45]',
          arcoColor: esMinimalista ? '#A8CBEF' : '#94B8DE',
          insignia: '5 Díg.',
        }
      : digitos === 6
      ? {
          titulo: 'Serie Lavanda',
          cuerpoGrad: esMinimalista
            ? 'from-indigo-950/90 to-slate-900'
            : 'from-[#EAE2FC] to-[#DAD0F8]',
          borde: esMinimalista ? 'border-violet-200/25' : 'border-[#C4B5EE]',
          textoTitulo: esMinimalista ? 'text-violet-100' : 'text-[#251A47]',
          arcoColor: esMinimalista ? '#C3B4F4' : '#B09FE4',
          insignia: '6 Díg.',
        }
      : digitos === 8
      ? {
          titulo: 'Serie Glacial',
          cuerpoGrad: esMinimalista
            ? 'from-cyan-950/85 to-slate-900'
            : 'from-[#D6F0F2] to-[#C2E5E9]',
          borde: esMinimalista ? 'border-cyan-200/25' : 'border-[#A6D4D9]',
          textoTitulo: esMinimalista ? 'text-cyan-100' : 'text-[#0E3238]',
          arcoColor: esMinimalista ? '#9ED6DC' : '#85C4CA',
          insignia: '8 Díg.',
        }
      : digitos === 10
      ? {
          titulo: 'Serie Salvia',
          cuerpoGrad: esMinimalista
            ? 'from-emerald-950/85 to-slate-900'
            : 'from-[#D6F2E3] to-[#C2E9D5]',
          borde: esMinimalista ? 'border-emerald-200/25' : 'border-[#A3D6BC]',
          textoTitulo: esMinimalista ? 'text-emerald-100' : 'text-[#0D3623]',
          arcoColor: esMinimalista ? '#9CD9BA' : '#83C7A3',
          insignia: '10 Díg.',
        }
      : digitos === 14
      ? {
          titulo: 'Serie Coralina',
          cuerpoGrad: esMinimalista
            ? 'from-rose-950/85 to-slate-900'
            : 'from-[#FAE2E8] to-[#F2CDD7]',
          borde: esMinimalista ? 'border-rose-200/25' : 'border-[#E2B4C0]',
          textoTitulo: esMinimalista ? 'text-rose-100' : 'text-[#471622]',
          arcoColor: esMinimalista ? '#EDB2C0' : '#D99BA9',
          insignia: '14 Díg.',
        }
      : {
          titulo: 'Serie Íris',
          cuerpoGrad: esMinimalista
            ? 'from-slate-800/95 to-indigo-950/90'
            : 'from-[#E4E7FD] to-[#D2D8FA]',
          borde: esMinimalista ? 'border-indigo-200/25' : 'border-[#B8C1F0]',
          textoTitulo: esMinimalista ? 'text-indigo-100' : 'text-[#1A2047]',
          arcoColor: esMinimalista ? '#B3BDF5' : '#9AA6E6',
          insignia: '16 Díg.',
        };

  const abierta = fase === 'ganada';
  const bloqueada = fase === 'perdida';

  const gridCols =
    digitos <= 6
      ? digitos
      : digitos === 8
      ? 4
      : digitos === 10
      ? 5
      : digitos === 14
      ? 7
      : 8;

  const slotHeightClass =
    digitos >= 8 ? 'h-9 sm:h-10 text-base sm:text-lg' : 'h-11 sm:h-12 text-xl sm:text-2xl';
  const gridGapClass = digitos >= 14 ? 'gap-1' : 'gap-1.5 sm:gap-2';

  return (
    <div
      className={`relative w-full max-w-[400px] flex flex-col items-center select-none ${
        errorShake && !animacionesReducidas ? 'animate-[shake_0.28s_ease-in-out]' : ''
      }`}
    >
      {/* Grillete mate moderno */}
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
            stroke={esMinimalista ? 'rgba(255,255,255,0.12)' : 'rgba(38,41,59,0.14)'}
            strokeWidth="22"
            strokeLinecap="round"
          />
          <path
            d="M 38 88 L 38 44 C 38 14, 142 14, 142 44 L 142 88"
            fill="none"
            stroke={abierta ? '#8CE0B4' : bloqueada ? '#F0A8B2' : temaMaterial.arcoColor}
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 48 64 L 48 44 C 48 25, 115 22, 128 34"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Cuerpo moderno de la bóveda en acabado pastel satinado */}
      <div
        className={`relative z-10 w-full rounded-2xl bg-gradient-to-b ${temaMaterial.cuerpoGrad} border ${temaMaterial.borde} ${
          esMinimalista
            ? 'shadow-[0_14px_30px_-10px_rgba(0,0,0,0.55)]'
            : 'shadow-[0_10px_26px_-8px_rgba(38,41,59,0.14)]'
        } p-2.5 sm:p-3 transition-colors`}
      >
        {/* Cabecera de estado */}
        <div className="flex items-center justify-between text-[11px] mb-1.5 gap-2">
          <span className={`font-bold truncate ${temaMaterial.textoTitulo}`}>
            {temaMaterial.titulo} · {modo === 'logico' ? 'Lógico' : 'Mayor / Menor'}
          </span>

          <span
            className={`text-[10px] font-semibold tabular-nums shrink-0 ${
              esMinimalista ? 'text-slate-300/80' : 'text-[#2C3042]'
            }`}
          >
            {temaMaterial.insignia}
          </span>
        </div>

        {/* Visor de Dígitos */}
        <div
          className={`rounded-xl p-2 ${
            esMinimalista
              ? 'bg-slate-950/90 border border-white/10 shadow-inner'
              : 'bg-[#FAF5E6]/90 border border-[#D4C9AE] shadow-inner'
          }`}
        >
          <div
            className={`grid ${gridGapClass} justify-center`}
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
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
                  className={`relative ${slotHeightClass} rounded-xl flex items-center justify-center font-mono font-bold tabular-nums transition-all cursor-pointer select-none ${
                    abierta
                      ? esMinimalista
                        ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/50'
                        : 'bg-[#C4EED7] text-[#0F3D27] border border-[#84CEA8]'
                      : bloqueada
                      ? esMinimalista
                        ? 'bg-rose-400/20 text-rose-100 border border-rose-300/50'
                        : 'bg-[#FAD8DD] text-[#661924] border border-[#E69FA9]'
                      : seleccionado
                      ? esMinimalista
                        ? 'bg-indigo-400/25 text-white border-2 border-indigo-300 shadow-[0_0_0_2px_rgba(165,180,252,0.22)]'
                        : 'bg-[#FFF3CC] text-[#171923] border-2 border-[#7C98DF] shadow-[0_0_0_2px_rgba(124,152,223,0.28)]'
                      : val !== ''
                      ? esMinimalista
                        ? 'bg-slate-800 text-slate-100 border border-white/15'
                        : 'bg-[#FFFDF6] text-[#171923] border border-[#C6BBA0] shadow-2xs'
                      : esMinimalista
                      ? 'bg-slate-900/90 text-slate-500 border border-white/10 hover:border-white/25'
                      : 'bg-[#EFE7D4] text-[#665F50] border border-[#D8CEB6] hover:border-[#B4A78B]'
                  }`}
                >
                  <span>{val !== '' ? val : '•'}</span>
                  {seleccionado && (
                    <span
                      className={`absolute bottom-0.5 w-3.5 h-0.5 rounded-full ${
                        esMinimalista ? 'bg-indigo-300' : 'bg-[#6B89D6]'
                      }`}
                    />
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
                ? 'px-2 py-0.5 rounded-lg bg-black/30 border border-white/10 text-slate-200 font-semibold tabular-nums'
                : 'px-2 py-0.5 rounded-lg bg-[#FFFDF6]/88 border border-black/10 text-[#1F2333] font-semibold tabular-nums'
            }
          >
            Intentos: {intentosUsados}
            {maxIntentos > 0 ? ` / ${maxIntentos}` : ' / ∞'}
          </div>

          <div
            className={
              esMinimalista
                ? 'px-2 py-0.5 rounded-lg bg-black/30 border border-white/10 text-slate-200 font-mono font-semibold tabular-nums'
                : 'px-2 py-0.5 rounded-lg bg-[#FFFDF6]/88 border border-black/10 text-[#1F2333] font-mono font-semibold tabular-nums'
            }
          >
            {formatMMSS(tiempoSegundos)}
          </div>
        </div>
      </div>
    </div>
  );
};
