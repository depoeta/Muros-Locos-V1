/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pantallas unificadas: MenuScreen + ConfigScreen
 */

import React, { useEffect, useState } from 'react';
import { sounds } from '../game/murosLocosEngine';
import {
  AjustesDeApp,
  TemaTablero,
  EstiloMuros,
  AvatarTipoDeGorro,
  ConfigDePartida,
  RegDeAvatar,
  AvatarTipoDeAura,
  AvatarTipoDeRopa,
  TamanoTablero,
  TipoDeJugador,
  UserCuenta,
} from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import { AspectoModal } from './Modals';
import { actualizarNombreInvitadoLocal } from '../game/storage';
import { ESTILO_MUROS_META, useMurosTheme } from '../game/murosTheme';

// =========================================================================
// 1. MENU SCREEN
// =========================================================================
interface MenuScreenProps {
  userActual: UserCuenta | null;
  onAbrirPerfil: () => void;
  onAbrirAdmin?: () => void;
  onIniciarPartida: () => void;
  onPartidaSorpresa?: () => void;
  onIniciarTorneo: () => void;
  onAbrirOnline: () => void;
  onAbrirRanking: () => void;
  onAbrirLogros: () => void;
  onAbrirComoJugar: () => void;
  onAbrirAjustes: () => void;
  onAbrirCandado?: () => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  userActual,
  onAbrirPerfil,
  onAbrirAdmin,
  onIniciarPartida,
  onPartidaSorpresa,
  onIniciarTorneo,
  onAbrirOnline,
  onAbrirRanking,
  onAbrirLogros,
  onAbrirComoJugar,
  onAbrirAjustes,
  onAbrirCandado,
}) => {
  const { estilo, setEstilo, t } = useMurosTheme();
  const [menuJuegosAbierto, setMenuJuegosAbierto] = useState(false);
  const [menuEstiloAbierto, setMenuEstiloAbierto] = useState(false);

  const letters = [
    { char: 'M', color: '#ff6b6b' },
    { char: 'U', color: '#ffd43b' },
    { char: 'R', color: '#4dabf7' },
    { char: 'O', color: '#51cf66' },
    { char: 'S', color: '#ff922b' },
    { char: ' ', color: 'transparent' },
    { char: 'L', color: '#cc5de8' },
    { char: 'O', color: '#ffd43b' },
    { char: 'C', color: '#ff6b6b' },
    { char: 'O', color: '#4dabf7' },
    { char: 'S', color: '#51cf66' },
  ];

  const esDev = Boolean(
    userActual && (userActual.rol === 'dev' || userActual.id === 'admin' || userActual.esSupremo)
  );
  const esAdmin = Boolean(userActual && (userActual.rol === 'admin' || esDev));
  const esMod = Boolean(userActual && userActual.rol === 'mod');
  const esStaff = esDev || esAdmin || esMod;

  const metaEstiloActual = ESTILO_MUROS_META[estilo];

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-5 z-10 transition-colors duration-300 ${t.title}`}
    >
      {/* Top Bar */}
      <div className="w-full max-w-lg flex items-center justify-between px-0.5 sm:px-1 z-30 gap-1.5 min-w-0">
        {/* Selector de Juegos */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setMenuEstiloAbierto(false);
              setMenuJuegosAbierto((v) => !v);
            }}
            className={
              t.esClasico
                ? 'flex items-center gap-1.5 bg-white hover:bg-[#fff9db] px-3 py-1.5 rounded-2xl border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5 cursor-pointer transition-all whitespace-nowrap'
                : t.esOscuro
                ? 'flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-xl border border-white/10 shadow-xs active:scale-95 cursor-pointer transition-all whitespace-nowrap'
                : 'flex items-center gap-1.5 bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] text-[#171923] px-3 py-1.5 rounded-xl border border-[#DFD6BF] shadow-2xs active:scale-98 cursor-pointer transition-all whitespace-nowrap'
            }
            title="Selector de modos rápidos y juegos"
          >
            {t.esClasico && <span className="text-sm">🕹️</span>}
            <span className={t.esClasico ? 'font-black text-xs text-[#2b2140] tracking-wide' : 'text-xs font-semibold'}>
              Juegos
            </span>
            <span className={t.esClasico ? 'text-[10px] font-black text-[#86542d]' : 'text-[10px] opacity-75'}>
              {menuJuegosAbierto ? '▴' : '▾'}
            </span>
          </button>

          {menuJuegosAbierto && (
            <div
              className={
                t.esClasico
                  ? 'absolute top-11 left-0 w-56 bg-[#fff8e7] border-3 border-[#2b2140] rounded-2xl p-2 shadow-[0_8px_0_#2b2140,0_16px_25px_rgba(0,0,0,0.3)] flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
                  : t.esOscuro
                  ? 'absolute top-11 left-0 w-60 bg-[#1B1F30]/95 border border-white/12 rounded-2xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
                  : 'absolute top-11 left-0 w-60 bg-[#FFFDF6] border border-[#DFD6BF] rounded-2xl p-2 shadow-[0_14px_32px_-8px_rgba(38,41,59,0.16)] flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
              }
            >
              <div
                className={
                  t.esClasico
                    ? 'px-2.5 py-1.5 rounded-xl bg-[#d3f9d8] border-2 border-[#2b2140] flex items-center justify-between text-xs font-black text-[#134e20]'
                    : t.esOscuro
                    ? 'px-3 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/25 flex items-center justify-between text-xs font-semibold text-emerald-200'
                    : 'px-3 py-2 rounded-xl bg-[#E1F5EA] border border-[#BCE5CE] flex items-center justify-between text-xs font-semibold text-[#0F3D27]'
                }
              >
                <span>{t.esClasico ? '🧱 Muros Locos' : 'Muros Locos'}</span>
                <span
                  className={
                    t.esClasico
                      ? 'text-[9px] bg-white px-1.5 py-0.5 rounded border border-[#2b2140]'
                      : 'text-[10px] opacity-85'
                  }
                >
                  Activo
                </span>
              </div>

              {onPartidaSorpresa && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setMenuJuegosAbierto(false);
                    onPartidaSorpresa();
                  }}
                  className={
                    t.esClasico
                      ? 'px-2.5 py-2 rounded-xl bg-[#ffd43b] hover:bg-[#fcc419] border-2 border-[#2b2140] text-left cursor-pointer transition-colors'
                      : t.esOscuro
                      ? 'px-3 py-2 rounded-xl bg-amber-300/15 hover:bg-amber-300/25 border border-amber-300/25 text-left cursor-pointer transition-colors'
                      : 'px-3 py-2 rounded-xl bg-[#FDF4DB] hover:bg-[#FCEAC0] border border-[#EAD59B] text-[#4A3309] text-left cursor-pointer transition-colors'
                  }
                >
                  <span
                    className={
                      t.esClasico
                        ? 'text-xs font-black text-[#2b2140] block'
                        : t.esOscuro
                        ? 'text-xs font-semibold text-amber-200 block'
                        : 'text-xs font-semibold block'
                    }
                  >
                    {t.esClasico ? '🎲 Reto Aleatorio' : 'Reto Aleatorio'}
                  </span>
                  <span
                    className={
                      t.esClasico
                        ? 'text-[10px] font-bold text-[#5c3c00] block leading-tight'
                        : 'text-[11px] opacity-80 block leading-tight mt-0.5'
                    }
                  >
                    Rival y terreno al azar al instante
                  </span>
                </button>
              )}

              {onAbrirCandado && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setMenuJuegosAbierto(false);
                    onAbrirCandado();
                  }}
                  className={
                    t.esClasico
                      ? 'px-2.5 py-2 rounded-xl bg-[#e7f5ff] hover:bg-[#d0ebff] border-2 border-[#2b2140] text-left cursor-pointer transition-colors'
                      : t.esOscuro
                      ? 'px-3 py-2 rounded-xl bg-sky-300/15 hover:bg-sky-300/25 border border-sky-300/25 text-left cursor-pointer transition-colors'
                      : 'px-3 py-2 rounded-xl bg-[#CEE4FF]/70 hover:bg-[#BBD8FE] border border-[#A4C6F4] text-[#143254] text-left cursor-pointer transition-colors'
                  }
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={
                        t.esClasico
                          ? 'text-xs font-black text-[#1864ab] block'
                          : t.esOscuro
                          ? 'text-xs font-semibold text-sky-200 block'
                          : 'text-xs font-semibold block'
                      }
                    >
                      {t.esClasico ? '🔐 Candado' : 'Candado'}
                    </span>
                    <span
                      className={
                        t.esClasico
                          ? 'text-[9px] font-black bg-[#d3f9d8] text-[#134e20] px-1.5 py-0.5 rounded border border-[#2b2140]'
                          : 'text-[10px] opacity-80'
                      }
                    >
                      Pasatiempo
                    </span>
                  </div>
                  <span
                    className={
                      t.esClasico
                        ? 'text-[10px] font-bold text-[#364fc7] block leading-tight mt-0.5'
                        : 'text-[11px] opacity-80 block leading-tight mt-0.5'
                    }
                  >
                    Descifra la clave · Local y Duelo P2P
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Selector de Estética Visual (Pastel Oscuro / Pastel Claro / Clásico) */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setMenuJuegosAbierto(false);
              setMenuEstiloAbierto((v) => !v);
            }}
            className={
              t.esClasico
                ? 'flex items-center gap-1 bg-white hover:bg-[#fff9db] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] px-2.5 py-1.5 rounded-2xl text-[11px] font-black active:translate-y-0.5 cursor-pointer transition-all whitespace-nowrap'
                : t.esOscuro
                ? 'flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-white/10 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap'
                : 'flex items-center gap-1.5 bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] text-[#171923] border border-[#DFD6BF] shadow-2xs px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap'
            }
            title="Cambiar estética visual entre Pastel Oscuro, Pastel Claro y Clásico"
          >
            <span>{metaEstiloActual.icon}</span>
            <span>{metaEstiloActual.shortLabel}</span>
            <span className="text-[10px] opacity-70">{menuEstiloAbierto ? '▴' : '▾'}</span>
          </button>

          {menuEstiloAbierto && (
            <div
              className={
                t.esClasico
                  ? 'absolute top-11 left-1/2 -translate-x-1/2 w-56 bg-[#fff8e7] border-3 border-[#2b2140] rounded-2xl p-2 shadow-[0_8px_0_#2b2140,0_16px_25px_rgba(0,0,0,0.3)] flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
                  : t.esOscuro
                  ? 'absolute top-11 left-1/2 -translate-x-1/2 w-60 bg-[#1B1F30]/95 border border-white/12 rounded-2xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
                  : 'absolute top-11 left-1/2 -translate-x-1/2 w-60 bg-[#FFFDF6] border border-[#DFD6BF] rounded-2xl p-2 shadow-[0_14px_32px_-8px_rgba(38,41,59,0.16)] flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
              }
            >
              <span className={`px-2 pt-0.5 text-[10px] font-bold uppercase tracking-wider ${t.muted}`}>
                Estética visual
              </span>
              {(['pastel_oscuro', 'pastel_claro', 'clasico'] as EstiloMuros[]).map((op) => {
                const meta = ESTILO_MUROS_META[op];
                const activo = estilo === op;
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setEstilo(op);
                      setMenuEstiloAbierto(false);
                    }}
                    className={`px-2.5 py-2 rounded-xl text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      activo ? t.bannerSuccess : `${t.card} ${t.cardHover}`
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate">
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[10px] opacity-80 block leading-tight mt-0.5">
                        {meta.desc}
                      </span>
                    </div>
                    {activo && <span className="text-xs font-bold shrink-0">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Derecha: Staff + Perfil */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          {esStaff && onAbrirAdmin && (
            <button
              onClick={() => {
                sounds.playClick();
                onAbrirAdmin();
              }}
              className={
                t.esClasico
                  ? 'py-1 px-2 sm:px-2.5 rounded-2xl bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] font-black text-xs cursor-pointer flex items-center gap-1 active:translate-y-0.5 shrink-0'
                  : `${t.btnAmber} py-1.5 px-2 sm:px-2.5 rounded-xl font-semibold text-xs cursor-pointer flex items-center gap-1 transition-all shrink-0`
              }
              title={
                esDev
                  ? 'Panel Dev Supremo'
                  : esAdmin
                  ? 'Panel de Administración'
                  : 'Panel de Moderación (Salas Oficiales)'
              }
            >
              <span>{esDev ? '👑' : esAdmin ? '🛡️' : '🔰'}</span>
              <span className="hidden sm:inline">{esDev ? 'Dev' : esAdmin ? 'Admin' : 'Mod'}</span>
            </button>
          )}

          <button
            onClick={() => {
              sounds.playClick();
              onAbrirPerfil();
            }}
            className={
              t.esClasico
                ? 'py-1 px-2 sm:px-3 rounded-2xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fff9db] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 group min-w-0 max-w-full'
                : t.esOscuro
                ? 'py-1 px-2 sm:px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-white/10 text-slate-100 transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 group min-w-0 max-w-full'
                : 'py-1 px-2 sm:px-2.5 rounded-xl bg-[#FFFDF6]/95 hover:bg-[#F5EEDB] border border-[#DFD6BF] shadow-2xs text-[#171923] transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 group min-w-0 max-w-full'
            }
            title="Gestionar perfil de usuario o iniciar sesión"
          >
            {userActual ? (
              <>
                <div className="shrink-0">
                  <CartoonCharacter
                    color={userActual.avatarColor}
                    hat={userActual.avatarHat}
                    ropa={userActual.avatarRopa}
                    ropaColor={userActual.avatarRopaColor}
                    aura={userActual.avatarAura}
                    size={t.esClasico ? 26 : 22}
                    showShadow={false}
                  />
                </div>
                <div className="text-left leading-tight min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className={`text-xs max-w-[74px] sm:max-w-[105px] truncate ${
                        t.esClasico ? 'font-black text-[#2b2140]' : 'font-semibold'
                      }`}
                    >
                      {userActual.nombre}
                    </span>
                    {esStaff && (
                      <span
                        className={
                          t.esClasico
                            ? esDev
                              ? 'text-[8px] bg-[#ffd43b] text-[#5c3c00] font-black px-1 rounded border border-[#2b2140] shrink-0'
                              : esAdmin
                              ? 'text-[8px] bg-[#a5d8ff] text-[#1864ab] font-black px-1 rounded border border-[#2b2140] shrink-0'
                              : 'text-[8px] bg-[#b2f2bb] text-[#2b8a3e] font-black px-1 rounded border border-[#2b2140] shrink-0'
                            : t.esOscuro
                            ? esDev
                              ? 'text-[8px] bg-amber-400/20 text-amber-200 font-bold px-1 rounded border border-amber-400/30 shrink-0'
                              : esAdmin
                              ? 'text-[8px] bg-sky-400/20 text-sky-200 font-bold px-1 rounded border border-sky-400/30 shrink-0'
                              : 'text-[8px] bg-emerald-400/20 text-emerald-200 font-bold px-1 rounded border border-emerald-400/30 shrink-0'
                            : esDev
                            ? 'text-[8px] bg-[#FCE8B8] text-[#4A3309] font-bold px-1 rounded border border-[#EAD08E] shrink-0'
                            : esAdmin
                            ? 'text-[8px] bg-[#CEE4FF] text-[#143254] font-bold px-1 rounded border border-[#A4C6F4] shrink-0'
                            : 'text-[8px] bg-[#B7EBD0] text-[#0F3D27] font-bold px-1 rounded border border-[#8AD2AE] shrink-0'
                        }
                      >
                        {userActual.id === 'admin' ? 'DEV' : esDev ? 'DEV' : esAdmin ? 'ADMIN' : 'MOD'}
                      </span>
                    )}
                  </div>
                  <span
                    className={
                      t.esClasico
                        ? 'text-[10px] font-bold text-[#2b8a3e] block truncate'
                        : t.esOscuro
                        ? 'text-[10px] font-medium text-emerald-300 block truncate'
                        : 'text-[10px] font-semibold text-[#0F5C38] block truncate'
                    }
                  >
                    ⭐ {userActual.puntos} pts
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm group-hover:scale-110 transition-transform">👤</span>
                <span className={t.esClasico ? 'text-xs font-black text-[#2b2140]' : 'text-xs font-semibold'}>
                  Mi Perfil
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Header / Title */}
      {t.esClasico ? (
        <div className="flex flex-col items-center mt-2 sm:mt-4">
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            {letters.map((l, i) =>
              l.char === ' ' ? (
                <span key={i} className="w-3 sm:w-5" />
              ) : (
                <span
                  key={i}
                  className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight inline-block drop-shadow-[0_6px_0_#2b2140]"
                  style={{
                    color: l.color,
                    WebkitTextStroke: '2.5px #2b2140',
                  }}
                >
                  {l.char}
                </span>
              )
            )}
          </div>
          <p className="mt-2 text-sm sm:text-base font-extrabold text-[#593922] bg-[#fff8e7]/85 px-4 py-1 rounded-full border-2 border-[#2b2140] shadow-sm text-center">
            🧱 ¡El juego de mesa de carreras, muros y saltos locos!
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center mt-4 sm:mt-6 text-center px-2">
          <span
            className={`text-[11px] font-semibold tracking-[0.16em] uppercase mb-2 ${
              t.esOscuro ? 'text-indigo-200/75' : 'text-[#3A3F54]'
            }`}
          >
            Juego de carreras, muros y saltos
          </span>
          <h1
            className={`text-3xl sm:text-5xl font-extrabold tracking-[0.16em] pl-[0.16em] ${t.title}`}
          >
            MUROS LOCOS
          </h1>
          <div
            className={`mt-2.5 h-1 w-24 rounded-full ${
              t.esOscuro
                ? 'bg-gradient-to-r from-emerald-300/60 via-sky-300/60 to-violet-300/60'
                : 'bg-gradient-to-r from-[#8CD7B0] via-[#9BC0F5] to-[#BEB0F5]'
            }`}
          />
          <p
            className={`mt-3 text-xs sm:text-sm max-w-xs sm:max-w-md leading-relaxed font-medium ${
              t.esOscuro ? 'text-slate-400' : 'text-[#353A4D]'
            }`}
          >
            Bloquea el camino de tus rivales, calcula tus saltos y alcanza la meta antes que nadie.
          </p>
        </div>
      )}

      {/* Mascots Display (Avatares idénticos en todos los temas) */}
      {t.esClasico ? (
        <div className="flex items-center justify-center gap-4 sm:gap-8 my-4">
          <div>
            <CartoonCharacter color="#ff6b6b" hat="corona" size={64} />
          </div>
          <div>
            <CartoonCharacter color="#4dabf7" hat="pompon" size={64} />
          </div>
          <div>
            <CartoonCharacter color="#ffd43b" hat="antena" size={64} />
          </div>
          <div>
            <CartoonCharacter color="#51cf66" hat="brote" size={64} />
          </div>
        </div>
      ) : (
        <div
          className={`flex items-center justify-center gap-2 sm:gap-3.5 my-4 p-2.5 sm:p-3 rounded-2xl border select-none ${
            t.esOscuro
              ? 'bg-slate-900/60 border-white/10 shadow-inner'
              : 'bg-[#FFFDF6]/90 border-[#DFD6BF] shadow-[0_10px_28px_-10px_rgba(38,41,59,0.08)]'
          }`}
        >
          {[
            {
              color: '#ff6b6b',
              hat: 'corona' as const,
              dark: 'bg-rose-400/10 border-rose-300/25',
              light: 'bg-[#FAD8DD]/60 border-[#EEB1B9]',
            },
            {
              color: '#4dabf7',
              hat: 'pompon' as const,
              dark: 'bg-sky-300/10 border-sky-300/25',
              light: 'bg-[#DCEBFF]/80 border-[#B2CEF5]',
            },
            {
              color: '#ffd43b',
              hat: 'antena' as const,
              dark: 'bg-amber-300/10 border-amber-200/25',
              light: 'bg-[#FDF0CC]/80 border-[#EDD595]',
            },
            {
              color: '#51cf66',
              hat: 'brote' as const,
              dark: 'bg-emerald-400/10 border-emerald-300/25',
              light: 'bg-[#D7F3E4]/80 border-[#A8DFC2]',
            },
          ].map((m, idx) => (
            <div
              key={idx}
              className={`p-1.5 sm:p-2 rounded-xl border transition-transform hover:-translate-y-0.5 ${
                t.esOscuro ? m.dark : m.light
              }`}
            >
              <CartoonCharacter color={m.color} hat={m.hat} size={50} />
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons Menu */}
      {t.esClasico ? (
        <div className="w-full max-w-xs sm:max-w-sm flex flex-col gap-2.5 mb-5">
          <button
            onClick={() => {
              sounds.playClick();
              onIniciarPartida();
            }}
            className="w-full py-3.5 px-6 rounded-2xl font-black text-lg bg-[#51cf66] text-[#134e20] border-4 border-[#2b2140] shadow-[0_7px_0_#2b2140] hover:bg-[#40c057] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_2px_0_#2b2140] transition-all cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span className="text-xl group-hover:scale-125 transition-transform">🎮</span>
            <span>PARTIDA RÁPIDA</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onIniciarTorneo();
            }}
            className="w-full py-3 px-6 rounded-2xl font-black text-base bg-[#ffd43b] text-[#5c3c00] border-4 border-[#2b2140] shadow-[0_6px_0_#2b2140] hover:bg-[#fcc419] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_2px_0_#2b2140] transition-all cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span className="text-xl group-hover:scale-125 transition-transform">🏆</span>
            <span>MODO TORNEO</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onAbrirOnline();
            }}
            className="w-full py-3 px-6 rounded-2xl font-black text-base bg-[#4dabf7] text-[#183247] border-4 border-[#2b2140] shadow-[0_6px_0_#2b2140] hover:bg-[#339af0] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_2px_0_#2b2140] transition-all cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span className="text-xl group-hover:scale-125 transition-transform">🌐</span>
            <span>JUGAR EN LÍNEA (P2P)</span>
          </button>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => {
                sounds.playClick();
                onAbrirRanking();
              }}
              className="py-2.5 px-3 rounded-2xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_4px_0_#2b2140] hover:bg-[#f8f9fa] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#2b2140] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🏆</span>
              <span>Ranking</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirLogros();
              }}
              className="py-2.5 px-3 rounded-2xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_4px_0_#2b2140] hover:bg-[#f8f9fa] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#2b2140] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🏅</span>
              <span>Logros</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirComoJugar();
              }}
              className="py-2.5 px-3 rounded-2xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_4px_0_#2b2140] hover:bg-[#f8f9fa] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#2b2140] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>📖</span>
              <span>Reglas</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirAjustes();
              }}
              className="py-2.5 px-3 rounded-2xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_4px_0_#2b2140] hover:bg-[#f8f9fa] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#2b2140] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>⚙️</span>
              <span>Ajustes</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xs sm:max-w-sm flex flex-col gap-2.5 mb-5">
          <button
            onClick={() => {
              sounds.playClick();
              onIniciarPartida();
            }}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${t.btnPrimary}`}
          >
            <span>Partida Rápida</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onIniciarTorneo();
            }}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${t.btnAmber}`}
          >
            <span>Modo Torneo</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onAbrirOnline();
            }}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${t.btnSky}`}
          >
            <span>Jugar en Línea (P2P)</span>
          </button>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => {
                sounds.playClick();
                onAbrirRanking();
              }}
              className={`py-2.5 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${t.btnNeutral}`}
            >
              <span>Ranking</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirLogros();
              }}
              className={`py-2.5 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${t.btnNeutral}`}
            >
              <span>Logros</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirComoJugar();
              }}
              className={`py-2.5 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${t.btnNeutral}`}
            >
              <span>Reglas</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirAjustes();
              }}
              className={`py-2.5 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${t.btnNeutral}`}
            >
              <span>Ajustes</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// 2. CONFIG SCREEN (Único botón de Aspecto arriba + personaje/terreno predeterminados)
// =========================================================================
interface ConfigScreenProps {
  ajustes?: AjustesDeApp;
  esTorneoInicial?: boolean;
  userActual?: UserCuenta | null;
  onIniciar: (config: ConfigDePartida) => void;
  onVolver: () => void;
  onuserActualizado?: (u: UserCuenta) => void;
  onShowToast?: (msg: string) => void;
}

const TEMA_ICONOS: Record<TemaTablero, string> = {
  madera: '🪵 Madera',
  neon: '⚡ Neón',
  hielo: '❄️ Hielo',
  lava: '🌋 Lava',
};

export const ConfigScreen: React.FC<ConfigScreenProps> = ({
  ajustes,
  esTorneoInicial = false,
  userActual,
  onIniciar,
  onVolver,
  onuserActualizado,
  onShowToast,
}) => {
  const { t } = useMurosTheme();
  const [numJugadores, setNumJugadores] = useState<2 | 4>(2);
  const [tamanoTablero, setTamanoTablero] = useState<TamanoTablero>(9);
  const [modalAspectoAbierto, setModalAspectoAbierto] = useState(false);

  // Carga automática del terreno y personaje predeterminados del user si existen
  const [temaTablero, setTemaTablero] = useState<TemaTablero>(
    () => userActual?.temaTablero || ajustes?.temaTablero || 'madera'
  );
  const [jugadores, setJugadores] = useState<
    {
      cuentaId?: string;
      nombre: string;
      tipo: TipoDeJugador;
      color: string;
      hat: AvatarTipoDeGorro;
      ropa?: AvatarTipoDeRopa;
      ropaColor?: string;
      aura?: AvatarTipoDeAura;
    }[]
  >(() => [
    {
      cuentaId: userActual?.id,
      nombre: userActual?.nombre || 'Tú',
      tipo: 'humano',
      color: userActual?.avatarColor || '#ff6b6b',
      hat: userActual?.avatarHat || 'corona',
      ropa: userActual?.avatarRopa || 'ninguna',
      ropaColor: userActual?.avatarRopaColor,
      aura: userActual?.avatarAura || 'ninguna',
    },
    { nombre: 'Bot Normal', tipo: 'bot_normal', color: '#4dabf7', hat: 'bot_cpu', ropa: 'ninguna', aura: 'ninguna' },
    { nombre: 'Bot Fácil', tipo: 'bot_facil', color: '#ffd43b', hat: 'bot_cpu', ropa: 'ninguna', aura: 'ninguna' },
    { nombre: 'Bot Difícil', tipo: 'bot_dificil', color: '#51cf66', hat: 'bot_cpu', ropa: 'ninguna', aura: 'ninguna' },
  ]);

  // Si el user inicia sesión o sincroniza su perfil predeterminado, reflejar su personaje y terreno
  useEffect(() => {
    if (userActual) {
      if (userActual.temaTablero) {
        setTemaTablero(userActual.temaTablero);
      }
      setJugadores((prev) => {
        const next = [...prev];
        next[0] = {
          ...next[0],
          cuentaId: userActual.id,
          nombre: userActual.nombre,
          color: userActual.avatarColor || next[0].color,
          hat: userActual.avatarHat || next[0].hat,
          ropa: userActual.avatarRopa || 'ninguna',
          ropaColor: userActual.avatarRopaColor,
          aura: userActual.avatarAura || 'ninguna',
        };
        return next;
      });
    }
  }, [
    userActual?.id,
    userActual?.nombre,
    userActual?.avatarHat,
    userActual?.avatarColor,
    userActual?.avatarRopa,
    userActual?.avatarRopaColor,
    userActual?.avatarAura,
    userActual?.temaTablero,
  ]);

  const [empiezaAlAzar, setEmpiezaAlAzar] = useState<boolean>(false);
  const [permitirDeshacer, setPermitirDeshacer] = useState<boolean>(ajustes?.permitirDeshacer ?? true);
  const [permitirPistas, setPermitirPistas] = useState<boolean>(ajustes?.permitirPistas ?? true);
  const [modoConTiempo, setModoConTiempo] = useState<boolean>(false);
  const [segundosPorTurno, setSegundosPorTurno] = useState<number>(30);
  const [esTorneo, setEsTorneo] = useState<boolean>(esTorneoInicial);
  const [totalRondasTorneo, setTotalRondasTorneo] = useState<number>(3);
  const [, setRotationMode] = useState<boolean>(
    Boolean(ajustes?.cambiarVistaPorTurno ?? false)
  );
  const [avisoInvitadoVisible, setAvisoInvitadoVisible] = useState<boolean>(true);

  useEffect(() => {
    if (ajustes?.cambiarVistaPorTurno !== undefined) {
      setRotationMode(Boolean(ajustes.cambiarVistaPorTurno));
    }
  }, [ajustes?.cambiarVistaPorTurno]);

  const updateJugador = (idx: number, patch: Partial<(typeof jugadores)[0]>) => {
    setJugadores((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      if (merged.tipo !== 'humano') {
        merged.hat = 'bot_cpu';
      } else if (patch.tipo === 'humano' && next[idx].tipo !== 'humano' && merged.hat === 'bot_cpu') {
        merged.hat = idx === 0 && userActual?.avatarHat ? userActual.avatarHat : 'corona';
      }
      next[idx] = merged;
      return next;
    });
  };

  const handleStart = () => {
    sounds.playClick();

    const activeList = jugadores.slice(0, numJugadores);
    const seenNames = new Set<string>();

    const sanitized = activeList.map((j, i) => {
      let nom = i === 0 && userActual ? userActual.nombre : j.nombre.trim();
      if (!nom) nom = i === 0 ? 'Tú' : `Jugador ${i + 1}`;
      if (seenNames.has(nom.toLowerCase())) {
        nom = `${nom} (2)`;
      }
      seenNames.add(nom.toLowerCase());
      return {
        cuentaId: i === 0 ? userActual?.id : j.cuentaId,
        nombre: nom.slice(0, 15),
        tipo: j.tipo,
        color: j.color,
        hat: j.hat,
        ropa: j.ropa,
        ropaColor: j.ropaColor,
        aura: j.aura,
      };
    });

    if (!userActual && sanitized[0]?.nombre && sanitized[0].nombre !== 'Tú') {
      actualizarNombreInvitadoLocal('Tú', sanitized[0].nombre);
      actualizarNombreInvitadoLocal('Invitado', sanitized[0].nombre);
    }

    onIniciar({
      numJugadores,
      jugadores: sanitized,
      empiezaAlAzar,
      permitirDeshacer,
      permitirPistas,
      modoConTiempo,
      segundosPorTurno,
      esTorneo,
      totalRondasTorneo,
      tamanoTablero,
      temaTablero,
      rotationMode: false,
    });
  };

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-5 max-w-xl mx-auto z-10 overflow-y-auto ${t.title}`}>
      {/* Top Header */}
      <div className={`w-full flex items-center justify-between pb-3 mb-2 ${t.esClasico ? 'border-b-3 border-[#2b2140]/15' : `border-b ${t.divider}`} gap-2`}>
        <button
          onClick={() => {
            sounds.playClick();
            onVolver();
          }}
          className={`py-1.5 px-3 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0 ${t.btnNeutral}`}
        >
          ◀ Menú
        </button>

        <h2 className={`text-lg sm:text-xl font-extrabold truncate text-center ${t.title}`}>
          {esTorneo ? 'Configurar Torneo' : 'Configurar Partida'}
        </h2>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setModalAspectoAbierto(true);
          }}
          className={`py-1.5 px-2.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0 ${t.esClasico ? 'bg-[#fff9db] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-[#5c3c00] hover:bg-[#ffd43b] active:translate-y-0.5' : t.btnViolet}`}
          title="Personalizar tu avatar y terreno de la arena"
        >
          <span>🎨</span>
          <span>Aspecto</span>
        </button>
      </div>

      {/* Main Settings Body */}
      <div className="w-full flex-1 flex flex-col gap-3 py-1">
        {!userActual && avisoInvitadoVisible && (
          <div className={`w-full p-2.5 rounded-2xl flex items-center justify-between gap-2 text-xs animate-[fadeIn_0.2s_ease-out] ${t.bannerWarn}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">ℹ️</span>
              <div className="text-[11px] font-semibold leading-tight">
                <strong>Modo Invitado:</strong> Tus partidas se guardarán en tu <u>Ranking Local</u>. Inicia sesión para competir en el Ranking Global y guardar tu avatar y terreno predeterminados.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setAvisoInvitadoVisible(false);
              }}
              className={`w-6 h-6 rounded-full text-xs font-bold shrink-0 flex items-center justify-center cursor-pointer ${t.closeBtn}`}
              title="Quitar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modalidad y Número de Jugadores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="flex flex-col items-center gap-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${t.sub}`}>
              Modalidad
            </span>
            <div className={`relative flex p-1 rounded-2xl w-full ${t.esClasico ? 'bg-[#ede4d0] border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140]' : t.track}`}>
              <button
                onClick={() => {
                  setEsTorneo(false);
                  sounds.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  !esTorneo ? t.tabActive : t.tabInactive
                }`}
              >
                🎮 Rápida
              </button>
              <button
                onClick={() => {
                  setEsTorneo(true);
                  sounds.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  esTorneo
                    ? t.esClasico
                      ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                      : t.tabActive
                    : t.tabInactive
                }`}
              >
                🏆 Torneo
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${t.sub}`}>
              Jugadores
            </span>
            <div className={`relative flex p-1 rounded-2xl w-full ${t.esClasico ? 'bg-[#ede4d0] border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140]' : t.track}`}>
              <button
                onClick={() => {
                  setNumJugadores(2);
                  sounds.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  numJugadores === 2
                    ? t.esClasico
                      ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                      : t.tabActive
                    : t.tabInactive
                }`}
              >
                👥 2 Jugadores
              </button>
              <button
                onClick={() => {
                  setNumJugadores(4);
                  sounds.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  numJugadores === 4
                    ? t.esClasico
                      ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                      : t.tabActive
                    : t.tabInactive
                }`}
              >
                🎉 4 Jugadores
              </button>
            </div>
          </div>
        </div>

        {/* Tamaño del Tablero (3 tamaños: 5x5, 7x7, 9x9) */}
        <div className="flex flex-col items-center gap-1">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${t.sub}`}>
            Tamaño de la Mesa
          </span>
          <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-2xl w-full ${t.esClasico ? 'bg-[#ede4d0] border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140]' : t.track}`}>
            {(
              [
                { val: 5, label: '5×5', sub: 'Relámpago' },
                { val: 7, label: '7×7', sub: 'Rápido' },
                { val: 9, label: '9×9', sub: 'Clásico' },
              ] as const
            ).map((op) => (
              <button
                key={op.val}
                type="button"
                onClick={() => {
                  setTamanoTablero(op.val);
                  sounds.playClick();
                }}
                className={`py-1.5 px-1 rounded-xl font-bold text-xs transition-all cursor-pointer flex flex-col items-center leading-tight ${
                  tamanoTablero === op.val
                    ? t.esClasico
                      ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                      : t.tabActive
                    : t.tabInactive
                }`}
              >
                <span>{op.label}</span>
                <span className="text-[9px] font-semibold opacity-80">{op.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {esTorneo && (
          <div className={`p-3 rounded-2xl flex items-center justify-between gap-3 animate-[slideDown_0.2s_ease-out] ${t.bannerWarn}`}>
            <div className="text-left">
              <span className="font-bold text-xs block">Total de Rondas del Torneo:</span>
              <span className="text-[11px] opacity-85 font-medium">
                Suma puntos en cada ronda hasta coronar al Gran Campeón
              </span>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {[3, 5].map((rondas) => (
                <button
                  key={rondas}
                  onClick={() => {
                    setTotalRondasTorneo(rondas);
                    sounds.playClick();
                  }}
                  className={`py-1.5 px-3 rounded-xl font-bold text-xs cursor-pointer ${
                    totalRondasTorneo === rondas ? t.btnAmber : t.btnNeutral
                  }`}
                >
                  {rondas} rondas
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Indicador informativo del terreno activo */}
        <div className={`px-3 py-2 rounded-xl flex items-center justify-between text-xs ${t.card}`}>
          <span className={`font-semibold ${t.sub}`}>
            Terreno seleccionado: <strong className={t.title}>{TEMA_ICONOS[temaTablero]}</strong>
          </span>
          <span className={`text-[11px] font-medium ${t.muted}`}>
            {userActual?.temaTablero === temaTablero && userActual?.avatarHat === jugadores[0].hat
              ? '⭐ Predeterminado de tu perfil'
              : 'Usa 🎨 Aspecto arriba para cambiar'}
          </span>
        </div>

        {/* Players List */}
        <div className="space-y-2">
          {jugadores.slice(0, numJugadores).map((j, idx) => {
            const isUserPlayer = idx === 0;

            return (
              <div
                key={idx}
                className={`p-2.5 rounded-2xl flex items-center gap-3 animate-[slideDown_0.2s_ease-out] ${
                  t.esClasico ? 'bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140]' : t.card
                }`}
              >
                {isUserPlayer && userActual ? (
                  <div className="shrink-0" title="Tu avatar de cuenta">
                    <CartoonCharacter
                      color={j.color}
                      hat={j.hat}
                      ropa={j.ropa}
                      ropaColor={j.ropaColor}
                      aura={j.aura}
                      size={44}
                      showShadow={false}
                    />
                  </div>
                ) : j.tipo !== 'humano' ? (
                  <div
                    className={`shrink-0 p-0.5 rounded-xl flex items-center justify-center ${
                      t.esClasico ? 'bg-[#2b2140]/5 border border-[#2b2140]/20' : t.cardInner
                    }`}
                    title="Avatar exclusivo de Bot CPU"
                  >
                    <CartoonCharacter color={j.color} hat="bot_cpu" size={44} showShadow={false} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      const iniciales = RegDeAvatar.filter(
                        (p) => p.puntosRequeridos === 0 && p.id !== 'bot_cpu'
                      );
                      const curIdx = iniciales.findIndex((h) => h.id === j.hat);
                      const nextH = iniciales[(curIdx + 1) % iniciales.length];
                      updateJugador(idx, { hat: nextH.id, color: nextH.colorDefault });
                    }}
                    className="hover:scale-110 active:scale-95 transition-transform cursor-pointer shrink-0"
                    title="Clic para cambiar avatar de este jugador humano"
                  >
                    <CartoonCharacter
                      color={j.color}
                      hat={j.hat}
                      ropa={j.ropa}
                      ropaColor={j.ropaColor}
                      aura={j.aura}
                      size={44}
                      showShadow={false}
                    />
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  {isUserPlayer && userActual ? (
                    <div
                      className={`w-full flex items-center justify-between text-sm font-bold rounded-xl px-2.5 py-1.5 shadow-xs select-none ${t.bannerInfo}`}
                    >
                      <span className="truncate">{userActual.nombre}</span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded ${t.badgeNeutral}`}
                      >
                        🔒 Cuenta
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      maxLength={12}
                      value={j.nombre}
                      onChange={(e) => updateJugador(idx, { nombre: e.target.value })}
                      placeholder={isUserPlayer ? 'Nombre invitado' : `Jugador ${idx + 1}`}
                      className={`w-full text-sm font-bold rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                    />
                  )}
                </div>

                <select
                  value={j.tipo}
                  onChange={(e) => {
                    const newTipo = e.target.value as TipoDeJugador;
                    let newNombre = j.nombre;
                    const isBotName = /^bot\s*(normal|fácil|facil|difícil|dificil)/i.test(j.nombre);
                    if (newTipo === 'humano' && (isBotName || j.tipo !== 'humano')) {
                      newNombre = idx === 0 ? userActual?.nombre || 'Tú' : `Jugador ${idx + 1}`;
                    } else if (
                      newTipo !== 'humano' &&
                      (j.tipo === 'humano' || /^jugador\s*\d+/i.test(j.nombre) || j.nombre === 'Tú')
                    ) {
                      if (newTipo === 'bot_facil') newNombre = 'Bot Fácil';
                      else if (newTipo === 'bot_normal') newNombre = 'Bot Normal';
                      else if (newTipo === 'bot_dificil') newNombre = 'Bot Difícil';
                    }
                    const newHat: AvatarTipoDeGorro =
                      newTipo !== 'humano'
                        ? 'bot_cpu'
                        : idx === 0 && userActual?.avatarHat
                        ? userActual.avatarHat
                        : 'corona';
                    updateJugador(idx, { tipo: newTipo, nombre: newNombre, hat: newHat });
                  }}
                  className={`text-xs font-bold rounded-xl px-2 py-1.5 outline-none cursor-pointer shadow-xs shrink-0 ${
                    t.esClasico
                      ? 'text-[#2b2140] bg-[#fff9db] border-2 border-[#2b2140]'
                      : t.input
                  }`}
                >
                  <option value="humano">👤 Humano</option>
                  <option value="bot_facil">🤖 Bot Fácil</option>
                  <option value="bot_normal">🤖 Bot Normal</option>
                  <option value="bot_dificil">🤖 Bot Difícil</option>
                </select>
              </div>
            );
          })}
        </div>

        {/* Match Toggles */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          {[
            { label: '🎲 Empieza al azar', val: empiezaAlAzar, toggle: () => setEmpiezaAlAzar(!empiezaAlAzar) },
            { label: '↩ Permitir deshacer', val: permitirDeshacer, toggle: () => setPermitirDeshacer(!permitirDeshacer) },
            { label: '💡 Permitir pistas', val: permitirPistas, toggle: () => setPermitirPistas(!permitirPistas) },
            { label: '⏱️ Modo con tiempo', val: modoConTiempo, toggle: () => setModoConTiempo(!modoConTiempo) },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                item.toggle();
                sounds.playClick();
              }}
              className={`p-2 rounded-xl flex items-center justify-between cursor-pointer select-none ${t.card}`}
            >
              <span className={`text-xs font-bold ${t.title}`}>{item.label}</span>
              <div
                className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                  t.esClasico
                    ? `border border-[#2b2140] ${item.val ? 'bg-[#51cf66]' : 'bg-[#ced4da]'}`
                    : t.esOscuro
                    ? `border border-white/15 ${item.val ? 'bg-emerald-400/70' : 'bg-slate-700'}`
                    : `border border-[#D4C9AE] ${item.val ? 'bg-[#8CD7B0]' : 'bg-[#E5DEC9]'}`
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                    t.esClasico ? 'border border-[#2b2140]' : 'shadow-xs'
                  } ${item.val ? 'translate-x-4' : ''}`}
                />
              </div>
            </div>
          ))}

          {/* Vista Fija Estable */}
          <div className={`p-2 rounded-xl flex items-center justify-between select-none col-span-2 ${t.bannerInfo}`}>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold flex items-center gap-1">
                <span>🧭</span> Vista Fija Estable (Sin Giros)
              </span>
              <span className="text-[10px] opacity-85">
                El tablero se mantiene siempre fijo sin rotaciones para evitar mareos, con indicadores claros del lado e inicio del oponente.
              </span>
            </div>
            <span className="text-base shrink-0">✨</span>
          </div>
        </div>

        {modoConTiempo && (
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className={`text-xs font-bold ${t.sub}`}>Segundos por turno:</span>
            {[15, 30, 60].map((sec) => (
              <button
                key={sec}
                onClick={() => setSegundosPorTurno(sec)}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  segundosPorTurno === sec ? t.btnAmber : t.btnNeutral
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Start Button */}
      <button
        onClick={handleStart}
        className={`w-full py-3.5 px-6 rounded-2xl font-extrabold text-base sm:text-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 ${
          t.esClasico
            ? `border-4 border-[#2b2140] shadow-[0_6px_0_#2b2140] active:translate-y-1 active:shadow-[0_2px_0_#2b2140] ${
                esTorneo
                  ? 'bg-[#ffd43b] text-[#5c3c00] hover:bg-[#fcc419]'
                  : 'bg-[#51cf66] text-[#134e20] hover:bg-[#40c057]'
              }`
            : esTorneo
            ? t.btnAmber
            : t.btnPrimary
        }`}
      >
        <span>{esTorneo ? '🏆' : '🚀'}</span>
        <span>{esTorneo ? '¡COMENZAR TORNEO!' : '¡COMENZAR PARTIDA!'}</span>
      </button>

      {modalAspectoAbierto && (
        <AspectoModal
          onCerrar={() => setModalAspectoAbierto(false)}
          personajeActual={{
            hat: jugadores[0].hat,
            color: jugadores[0].color,
            ropa: jugadores[0].ropa,
            ropaColor: jugadores[0].ropaColor,
            aura: jugadores[0].aura,
          }}
          temaActual={temaTablero}
          userActual={userActual}
          onuserActualizado={onuserActualizado}
          onShowToast={onShowToast}
          onAplicar={(nuevoP, nuevoTema) => {
            updateJugador(0, {
              hat: nuevoP.hat,
              color: nuevoP.color,
              ropa: nuevoP.ropa,
              ropaColor: nuevoP.ropaColor,
              aura: nuevoP.aura,
            });
            setTemaTablero(nuevoTema);
          }}
        />
      )}
    </div>
  );
};
