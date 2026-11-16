/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sistema de estética visual para Muros Locos:
 *  - pastel_oscuro (predestinado): estética moderna pastel nocturna (igual a Candado)
 *  - pastel_claro: estética moderna pastel vainilla suave con alto contraste
 *  - clasico: estética cartoon original de Muros Locos (cielo azul + bordes gruesos)
 */

import React, { createContext, useContext } from 'react';
import { EstiloMuros } from '../types/murosLocos';

export const MUROS_ESTILO_KEY = 'muros_locos_estilo_v1';

export function cargarEstiloMuros(): EstiloMuros {
  try {
    const raw = localStorage.getItem(MUROS_ESTILO_KEY);
    if (raw === 'pastel_oscuro' || raw === 'pastel_claro' || raw === 'clasico') {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return 'clasico';
}

export function guardarEstiloMuros(estilo: EstiloMuros): void {
  try {
    localStorage.setItem(MUROS_ESTILO_KEY, estilo);
  } catch {
    // ignore storage errors
  }
}

export interface MurosThemeTokens {
  estilo: EstiloMuros;
  esPastel: boolean;
  esOscuro: boolean;
  esClaro: boolean;
  esClasico: boolean;
  // Fondos principales
  rootBg: string;
  // Contenedores y modales
  shell: string;
  shellModal: string;
  card: string;
  cardInner: string;
  cardHover: string;
  // Pestañas / Segmented controls
  track: string;
  tabActive: string;
  tabInactive: string;
  // Texto
  title: string;
  sub: string;
  muted: string;
  accentText: string;
  divider: string;
  // Botones
  btnPrimary: string;
  btnAmber: string;
  btnSky: string;
  btnViolet: string;
  btnDanger: string;
  btnNeutral: string;
  btnTopbar: string;
  closeBtn: string;
  // Inputs
  input: string;
  // Banners / Badges
  bannerInfo: string;
  bannerWarn: string;
  bannerSuccess: string;
  bannerDanger: string;
  bannerViolet: string;
  badgeNeutral: string;
}

const TOKENS: Record<EstiloMuros, MurosThemeTokens> = {
  pastel_oscuro: {
    estilo: 'pastel_oscuro',
    esPastel: true,
    esOscuro: true,
    esClaro: false,
    esClasico: false,
    rootBg: 'bg-gradient-to-br from-[#11131E] via-[#151828] to-[#191D30] text-slate-100',
    shell: 'bg-[#1B1F30] border border-white/12 text-slate-100 shadow-2xl',
    shellModal: 'bg-[#1B1F30] border border-white/12 text-slate-100 shadow-2xl',
    card: 'bg-slate-800/75 border border-white/10 text-slate-100',
    cardInner: 'bg-slate-900/75 border border-white/10 text-slate-100',
    cardHover: 'hover:bg-slate-800 hover:border-white/20',
    track: 'bg-slate-900/90 border border-white/10',
    tabActive: 'bg-emerald-400/20 text-emerald-100 border border-emerald-400/35 shadow-xs',
    tabInactive: 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent',
    title: 'text-slate-100',
    sub: 'text-slate-300',
    muted: 'text-slate-400',
    accentText: 'text-emerald-300',
    divider: 'border-white/10',
    btnPrimary:
      'bg-emerald-300/90 hover:bg-emerald-200 text-slate-950 border border-emerald-200/40 shadow-sm active:translate-y-0.5',
    btnAmber:
      'bg-amber-200/15 hover:bg-amber-200/25 text-amber-200 border border-amber-200/30 shadow-xs active:translate-y-0.5',
    btnSky:
      'bg-sky-200/15 hover:bg-sky-200/25 text-sky-200 border border-sky-200/30 shadow-xs active:translate-y-0.5',
    btnViolet:
      'bg-violet-300/15 hover:bg-violet-300/25 text-violet-200 border border-violet-300/30 shadow-xs active:translate-y-0.5',
    btnDanger:
      'bg-rose-400/15 hover:bg-rose-400/25 text-rose-200 border border-rose-400/30 shadow-xs active:translate-y-0.5',
    btnNeutral:
      'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-white/12 shadow-xs active:translate-y-0.5',
    btnTopbar:
      'bg-slate-800/85 hover:bg-slate-700/85 text-slate-100 border border-white/12 shadow-xs',
    closeBtn:
      'bg-slate-800/90 hover:bg-rose-400/20 text-slate-300 hover:text-rose-200 border border-white/15',
    input:
      'bg-slate-900/85 text-slate-100 border border-white/15 focus:border-indigo-300/50 placeholder:text-slate-500',
    bannerInfo: 'bg-sky-200/12 border border-sky-200/25 text-sky-100',
    bannerWarn: 'bg-amber-200/12 border border-amber-200/25 text-amber-100',
    bannerSuccess: 'bg-emerald-300/15 border border-emerald-300/30 text-emerald-100',
    bannerDanger: 'bg-rose-400/15 border border-rose-400/30 text-rose-100',
    bannerViolet: 'bg-violet-300/15 border border-violet-300/30 text-violet-100',
    badgeNeutral: 'bg-slate-800/90 border border-white/15 text-slate-200',
  },
  pastel_claro: {
    estilo: 'pastel_claro',
    esPastel: true,
    esOscuro: false,
    esClaro: true,
    esClasico: false,
    rootBg: 'bg-gradient-to-b from-[#FCF8EC] via-[#FAF4E4] to-[#F7EFE0] text-[#171923]',
    shell:
      'bg-[#FFFDF6] border border-[#DFD6BF] text-[#171923] shadow-[0_18px_40px_-10px_rgba(38,41,59,0.16)]',
    shellModal:
      'bg-[#FFFDF6] border border-[#DFD6BF] text-[#171923] shadow-[0_18px_40px_-10px_rgba(38,41,59,0.20)]',
    card: 'bg-[#FAF4E4] border border-[#DFD5BC] text-[#171923]',
    cardInner: 'bg-[#FFFDF6] border border-[#DFD6BF] text-[#171923]',
    cardHover: 'hover:bg-[#F5EEDB] hover:border-[#CBBFA3]',
    track: 'bg-[#F2EBD9] border border-[#DDD3BA]',
    tabActive: 'bg-[#FFFDF6] text-[#171923] border border-[#D4C9AE] shadow-xs',
    tabInactive:
      'text-[#3E4359] hover:text-[#171923] hover:bg-[#FFFDF6]/60 border border-transparent',
    title: 'text-[#171923]',
    sub: 'text-[#3E4359]',
    muted: 'text-[#4A5068]',
    accentText: 'text-[#0F5C38]',
    divider: 'border-[#DFD6BF]',
    btnPrimary:
      'bg-[#B7EBD0] hover:bg-[#A4E3C2] text-[#0F3D27] border border-[#8AD2AE] shadow-xs active:translate-y-0.5',
    btnAmber:
      'bg-[#FCE8B8] hover:bg-[#F9DE9E] text-[#4A3309] border border-[#EAD08E] shadow-xs active:translate-y-0.5',
    btnSky:
      'bg-[#CEE4FF] hover:bg-[#BBD8FE] text-[#143254] border border-[#A4C6F4] shadow-xs active:translate-y-0.5',
    btnViolet:
      'bg-[#EAE4FC] hover:bg-[#DFD6FA] text-[#2E2054] border border-[#CCC1F2] shadow-xs active:translate-y-0.5',
    btnDanger:
      'bg-[#FAD8DD] hover:bg-[#F5C5CC] text-[#661924] border border-[#EEB1B9] shadow-xs active:translate-y-0.5',
    btnNeutral:
      'bg-[#FFFDF6] hover:bg-[#F5EEDB] text-[#1F2333] border border-[#DFD6BF] shadow-xs active:translate-y-0.5',
    btnTopbar:
      'bg-[#FFFDF6] hover:bg-[#F5EEDB] text-[#171923] border border-[#DFD6BF] shadow-xs',
    closeBtn:
      'bg-[#FFFDF6] hover:bg-[#FAD8DD] text-[#3E4359] hover:text-[#661924] border border-[#D4C9AE]',
    input:
      'bg-[#FFFDF6] text-[#171923] border border-[#D4C9AE] focus:border-[#8AD2AE] placeholder:text-[#7D8298]',
    bannerInfo: 'bg-[#CEE4FF]/65 border border-[#A4C6F4] text-[#143254]',
    bannerWarn: 'bg-[#FCE8B8]/70 border border-[#EAD08E] text-[#4A3309]',
    bannerSuccess: 'bg-[#B7EBD0]/65 border border-[#8AD2AE] text-[#0F3D27]',
    bannerDanger: 'bg-[#FAD8DD]/70 border border-[#EEB1B9] text-[#661924]',
    bannerViolet: 'bg-[#EAE4FC]/70 border border-[#CCC1F2] text-[#2E2054]',
    badgeNeutral: 'bg-[#FFFDF6] border border-[#D4C9AE] text-[#1F2333]',
  },
  clasico: {
    estilo: 'clasico',
    esPastel: false,
    esOscuro: false,
    esClaro: false,
    esClasico: true,
    rootBg: 'bg-gradient-to-b from-[#74c0fc] via-[#4dabf7] to-[#228be6] text-[#2b2140]',
    shell:
      'bg-[#fff8e7] border-4 border-[#2b2140] text-[#2b2140] shadow-[0_8px_0_#2b2140,0_15px_30px_rgba(0,0,0,0.3)]',
    shellModal:
      'bg-[#fff8e7] border-4 border-[#2b2140] text-[#2b2140] shadow-[0_12px_0_#2b2140,0_25px_50px_rgba(0,0,0,0.4)]',
    card: 'bg-white border-2 border-[#2b2140] text-[#2b2140]',
    cardInner: 'bg-[#fff8e7] border-2 border-[#2b2140] text-[#2b2140]',
    cardHover: 'hover:bg-[#fff9db]',
    track: 'bg-[#e6d5b8] border-2 border-[#2b2140]',
    tabActive: 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]',
    tabInactive: 'text-[#593922] hover:bg-white/40 border-2 border-transparent',
    title: 'text-[#2b2140]',
    sub: 'text-[#593922]',
    muted: 'text-[#86542d]',
    accentText: 'text-[#2b8a3e]',
    divider: 'border-[#2b2140]/15',
    btnPrimary:
      'bg-[#51cf66] hover:bg-[#40c057] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5',
    btnAmber:
      'bg-[#ffd43b] hover:bg-[#fcc419] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5',
    btnSky:
      'bg-[#4dabf7] hover:bg-[#339af0] text-[#092e52] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5',
    btnViolet:
      'bg-[#9775fa] hover:bg-[#845ef7] text-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5',
    btnDanger:
      'bg-[#ff8787] hover:bg-[#fa5252] text-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5',
    btnNeutral:
      'bg-white hover:bg-[#fff9db] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5',
    btnTopbar:
      'bg-[#fff8e7] hover:bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140]',
    closeBtn:
      'bg-white hover:bg-[#ffe3e3] text-[#2b2140] border-2 border-[#2b2140]',
    input:
      'bg-white text-[#2b2140] border-2 border-[#2b2140] focus:border-[#4dabf7]',
    bannerInfo: 'bg-[#e7f5ff] border-2 border-[#2b2140] text-[#1864ab]',
    bannerWarn: 'bg-[#fff3bf] border-2 border-[#2b2140] text-[#5c3c00]',
    bannerSuccess: 'bg-[#d3f9d8] border-2 border-[#2b2140] text-[#134e20]',
    bannerDanger: 'bg-[#ffe3e3] border-2 border-[#c92a2a] text-[#c92a2a]',
    bannerViolet: 'bg-[#f3f0ff] border-2 border-[#2b2140] text-[#5f3dc4]',
    badgeNeutral: 'bg-white border-2 border-[#2b2140] text-[#2b2140]',
  },
};

export interface MurosThemeContextValue {
  estilo: EstiloMuros;
  setEstilo: (nuevo: EstiloMuros) => void;
  ciclarEstilo: () => void;
  t: MurosThemeTokens;
}

const defaultCtx: MurosThemeContextValue = {
  estilo: 'clasico',
  setEstilo: () => {},
  ciclarEstilo: () => {},
  t: TOKENS.pastel_oscuro,
};

const MurosThemeContext = createContext<MurosThemeContextValue>(defaultCtx);

export const MurosThemeProvider: React.FC<{
  estilo: EstiloMuros;
  onChangeEstilo: (nuevo: EstiloMuros) => void;
  children: React.ReactNode;
}> = ({ estilo, onChangeEstilo, children }) => {
  const ciclarEstilo = () => {
    const orden: EstiloMuros[] = ['clasico', 'pastel_oscuro', 'pastel_claro'];
    const idx = orden.indexOf(estilo);
    const sig = orden[(idx + 1) % orden.length];
    onChangeEstilo(sig);
  };

  return (
    <MurosThemeContext.Provider
      value={{
        estilo,
        setEstilo: onChangeEstilo,
        ciclarEstilo,
        t: TOKENS[estilo],
      }}
    >
      {children}
    </MurosThemeContext.Provider>
  );
};

export function useMurosTheme(): MurosThemeContextValue {
  return useContext(MurosThemeContext);
}

export const ESTILO_MUROS_META: Record<
  EstiloMuros,
  { label: string; shortLabel: string; icon: string; desc: string }
> = {
  pastel_oscuro: {
    label: 'Pastel Oscuro',
    shortLabel: 'Oscuro',
    icon: '🌙',
    desc: 'Fondo oscuro nocturno con tonos pastel suaves',
  },
  pastel_claro: {
    label: 'Pastel Claro',
    shortLabel: 'Claro',
    icon: '☀️',
    desc: 'Vainilla suave antifatiga con letras oscuras',
  },
  clasico: {
    label: 'Clásico',
    shortLabel: 'Clásico',
    icon: '🧸',
    desc: 'El diseño cartoon original de Muros Locos',
  },
};
