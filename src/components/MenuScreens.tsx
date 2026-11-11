/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pantallas unificadas: MenuScreen + ConfigScreen
 */

import React, { useEffect, useState } from 'react';
import { sounds } from '../game/murosLocosEngine';
import {
  AppSettings,
  BoardTheme,
  EstiloVisual,
  HatType,
  MatchConfig,
  PERSONAJES_REGISTRO,
  PlayerType,
  UserAccount,
} from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import { AspectoModal } from './Modals';
import { PWAInstallButton } from './PWAInstallControl';
import { actualizarNombreInvitadoLocal } from '../game/storage';

// =========================================================================
// 1. MENU SCREEN
// =========================================================================
interface MenuScreenProps {
  usuarioActual: UserAccount | null;
  estiloVisual?: EstiloVisual;
  onToggleEstiloVisual?: () => void;
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
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  usuarioActual,
  estiloVisual = 'clasico',
  onToggleEstiloVisual,
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
}) => {
  const [menuJuegosAbierto, setMenuJuegosAbierto] = useState(false);

  const pastelLetters = [
    { char: 'M', color: '#fca5a5' },
    { char: 'U', color: '#fdba74' },
    { char: 'R', color: '#fde68a' },
    { char: 'O', color: '#86efac' },
    { char: 'S', color: '#93c5fd' },
    { char: ' ', color: 'transparent' },
    { char: 'L', color: '#c7d2fe' },
    { char: 'O', color: '#ddd6fe' },
    { char: 'C', color: '#fbcfe8' },
    { char: 'O', color: '#fed7aa' },
    { char: 'S', color: '#a7f3d0' },
  ];

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

  const esDev = Boolean(usuarioActual && (usuarioActual.rol === 'dev' || usuarioActual.id === 'admin' || usuarioActual.esSupremo));
  const esAdmin = Boolean(usuarioActual && (usuarioActual.rol === 'admin' || esDev));
  const esMod = Boolean(usuarioActual && usuarioActual.rol === 'mod');
  const esStaff = esDev || esAdmin || esMod;

  const esMinimalista = estiloVisual === 'minimalista';

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-5 z-10 transition-colors duration-300 ${
      esMinimalista ? 'text-slate-100' : 'text-[#2b2140]'
    }`}>
      {/* Top Bar */}
      <div className="w-full max-w-md flex items-center justify-between px-1 z-20 gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setMenuJuegosAbierto((v) => !v);
            }}
            className={
              esMinimalista
                ? 'flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-xl border border-white/10 shadow-sm active:scale-95 cursor-pointer transition-all'
                : 'flex items-center gap-1.5 bg-white hover:bg-[#fff9db] px-3 py-1.5 rounded-2xl border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5 cursor-pointer transition-all'
            }
            title="Selector de modos rápidos y juegos"
          >
            <span className="text-sm">🕹️</span>
            <span className={esMinimalista ? 'font-semibold text-xs text-slate-200' : 'font-black text-xs text-[#2b2140] tracking-wide'}>
              Juegos
            </span>
            <span className={esMinimalista ? 'text-[10px] text-slate-400' : 'text-[10px] font-black text-[#86542d]'}>
              {menuJuegosAbierto ? '▴' : '▾'}
            </span>
          </button>

          {menuJuegosAbierto && (
            <div className={
              esMinimalista
                ? 'absolute top-11 left-0 w-60 bg-slate-900/95 border border-white/15 rounded-xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-2 z-40 animate-[fadeIn_0.15s_ease-out]'
                : 'absolute top-11 left-0 w-56 bg-[#fff8e7] border-3 border-[#2b2140] rounded-2xl p-2 shadow-[0_8px_0_#2b2140,0_16px_25px_rgba(0,0,0,0.3)] flex flex-col gap-1.5 z-40 animate-[fadeIn_0.15s_ease-out]'
            }>
              <div className={
                esMinimalista
                  ? 'px-3 py-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between text-xs font-semibold text-emerald-300'
                  : 'px-2.5 py-1.5 rounded-xl bg-[#d3f9d8] border-2 border-[#2b2140] flex items-center justify-between text-xs font-black text-[#134e20]'
              }>
                <span>🧱 Muros Locos</span>
                <span className={esMinimalista ? 'text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded' : 'text-[9px] bg-white px-1.5 py-0.5 rounded border border-[#2b2140]'}>
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
                    esMinimalista
                      ? 'px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-left cursor-pointer transition-colors'
                      : 'px-2.5 py-2 rounded-xl bg-[#ffd43b] hover:bg-[#fcc419] border-2 border-[#2b2140] text-left cursor-pointer transition-colors'
                  }
                >
                  <span className={esMinimalista ? 'text-xs font-bold text-amber-300 block' : 'text-xs font-black text-[#2b2140] block'}>
                    🎲 Reto Aleatorio
                  </span>
                  <span className={esMinimalista ? 'text-[10px] text-slate-400 block leading-tight' : 'text-[10px] font-bold text-[#5c3c00] block leading-tight'}>
                    Rival y terreno al azar al instante
                  </span>
                </button>
              )}

              <div className={
                esMinimalista
                  ? 'px-3 py-2 rounded-lg bg-white/5 border border-dashed border-white/10 text-left'
                  : 'px-2.5 py-1.5 rounded-xl bg-white/75 border border-dashed border-[#2b2140]/40 text-left'
              }>
                <span className={esMinimalista ? 'text-[11px] font-semibold text-slate-400 block' : 'text-[11px] font-extrabold text-[#86542d] block'}>
                  ➕ Próximo juego
                </span>
                <span className={esMinimalista ? 'text-[9px] text-slate-500 block leading-tight' : 'text-[9px] font-semibold text-[#868e96] block leading-tight'}>
                  Espacio listo para añadir otro minijuego
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Style Switcher (Prueba en 1 clic) */}
        {onToggleEstiloVisual && (
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onToggleEstiloVisual();
            }}
            className={
              esMinimalista
                ? 'flex items-center gap-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-400/30 px-2.5 py-1 rounded-xl text-[11px] font-semibold backdrop-blur-sm transition-all cursor-pointer shadow-xs active:scale-95'
                : 'flex items-center gap-1 bg-white hover:bg-[#fff9db] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] px-2 py-1 rounded-2xl text-[10px] sm:text-[11px] font-black active:translate-y-0.5 cursor-pointer transition-all'
            }
            title="Alternar entre estilo Clásico Infantil y Moderno Minimalista"
          >
            <span>{esMinimalista ? '🧸' : '✨'}</span>
            <span className="hidden sm:inline">{esMinimalista ? 'Cambiar a' : 'Vista'}</span>
            <span>{esMinimalista ? 'Clásico' : 'Minimal'}</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2">
          <PWAInstallButton variant="compact" />

          {esStaff && onAbrirAdmin && (
            <button
              onClick={() => {
                sounds.playClick();
                onAbrirAdmin();
              }}
              className={
                esMinimalista
                  ? 'py-1 px-2.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 font-bold text-xs cursor-pointer flex items-center gap-1 transition-all'
                  : 'py-1 px-2.5 rounded-2xl bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] font-black text-xs cursor-pointer flex items-center gap-1 active:translate-y-0.5'
              }
              title={esDev ? 'Panel Dev Supremo' : esAdmin ? 'Panel de Administración' : 'Panel de Moderación (Salas Oficiales)'}
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
              esMinimalista
                ? 'py-1 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-white transition-all cursor-pointer flex items-center gap-2 group shadow-sm'
                : 'py-1 px-3 rounded-2xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fff9db] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-2 group'
            }
            title="Gestionar perfil de usuario o iniciar sesión"
          >
            {usuarioActual ? (
              <>
                <CartoonCharacter
                  color={usuarioActual.avatarColor}
                  hat={usuarioActual.avatarHat}
                  size={26}
                  showShadow={false}
                />
                <div className="text-left leading-tight">
                  <div className="flex items-center gap-1">
                    <span className={esMinimalista ? 'text-xs font-semibold text-slate-200 max-w-[95px] truncate' : 'text-xs font-black text-[#2b2140] max-w-[95px] truncate'}>
                      {usuarioActual.nombre}
                    </span>
                    {esStaff && (
                      <span className={
                        esMinimalista
                          ? esDev
                            ? 'text-[8px] bg-amber-400/20 text-amber-300 font-bold px-1 rounded border border-amber-400/30'
                            : esAdmin
                            ? 'text-[8px] bg-blue-400/20 text-blue-300 font-bold px-1 rounded border border-blue-400/30'
                            : 'text-[8px] bg-emerald-400/20 text-emerald-300 font-bold px-1 rounded border border-emerald-400/30'
                          : esDev
                          ? 'text-[8px] bg-[#ffd43b] text-[#5c3c00] font-black px-1 rounded border border-[#2b2140]'
                          : esAdmin
                          ? 'text-[8px] bg-[#a5d8ff] text-[#1864ab] font-black px-1 rounded border border-[#2b2140]'
                          : 'text-[8px] bg-[#b2f2bb] text-[#2b8a3e] font-black px-1 rounded border border-[#2b2140]'
                      }>
                        {usuarioActual.id === 'admin' ? 'DEV SUPREMO' : esDev ? 'DEV' : esAdmin ? 'ADMIN' : 'MOD'}
                      </span>
                    )}
                  </div>
                  <span className={esMinimalista ? 'text-[10px] font-semibold text-emerald-400 block' : 'text-[10px] font-bold text-[#2b8a3e] block'}>
                    ⭐ {usuarioActual.puntos} pts
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm group-hover:scale-110 transition-transform">👤</span>
                <span className={esMinimalista ? 'text-xs font-semibold text-slate-200' : 'text-xs font-black text-[#2b2140]'}>
                  Mi Perfil
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Header / Title */}
      {esMinimalista ? (
        <div className="flex flex-col items-center mt-3 sm:mt-5 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-slate-300 text-[11px] font-semibold tracking-wider uppercase mb-2.5 shadow-sm">
            <span>🧱</span>
            <span className="text-slate-400">Juego Táctico de Estrategia</span>
          </div>
          <div className="flex items-center justify-center gap-1 sm:gap-2 select-none">
            {pastelLetters.map((l, i) =>
              l.char === ' ' ? (
                <span key={i} className="w-2.5 sm:w-4" />
              ) : (
                <span
                  key={i}
                  className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight inline-block filter drop-shadow-[0_2px_14px_rgba(255,255,255,0.12)]"
                  style={{ color: l.color }}
                >
                  {l.char}
                </span>
              )
            )}
          </div>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-400 max-w-xs sm:max-w-md font-medium leading-relaxed">
            Bloquea el camino de tus rivales, calcula tus saltos y alcanza la meta antes que nadie.
          </p>
        </div>
      ) : (
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
      )}

      {/* Mascots Display (Personajes estáticos sin movimiento) */}
      {esMinimalista ? (
        <div className="flex items-center justify-center gap-3 sm:gap-5 my-3 p-3 bg-slate-900/40 border border-white/10 rounded-2xl backdrop-blur-md shadow-inner">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all hover:-translate-y-0.5">
              <CartoonCharacter color="#ff6b6b" hat="corona" size={50} />
            </div>
            <div className="p-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all hover:-translate-y-0.5">
              <CartoonCharacter color="#4dabf7" hat="pompon" size={50} />
            </div>
            <div className="p-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all hover:-translate-y-0.5">
              <CartoonCharacter color="#ffd43b" hat="antena" size={50} />
            </div>
            <div className="p-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all hover:-translate-y-0.5">
              <CartoonCharacter color="#51cf66" hat="brote" size={50} />
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* Action Buttons Menu */}
      {esMinimalista ? (
        <div className="w-full max-w-xs sm:max-w-sm flex flex-col gap-2.5 mb-4">
          <button
            onClick={() => {
              sounds.playClick();
              onIniciarPartida();
            }}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-950/40 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span className="text-lg group-hover:scale-110 transition-transform">🎮</span>
            <span className="tracking-wide">PARTIDA RÁPIDA</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onIniciarTorneo();
            }}
            className="w-full py-3 px-6 rounded-xl font-semibold text-sm sm:text-base bg-slate-900/90 text-amber-300 hover:bg-slate-800 border border-amber-500/30 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span className="text-lg group-hover:scale-110 transition-transform">🏆</span>
            <span className="tracking-wide">MODO TORNEO</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onAbrirOnline();
            }}
            className="w-full py-3 px-6 rounded-xl font-semibold text-sm sm:text-base bg-slate-900/90 text-sky-300 hover:bg-slate-800 border border-sky-500/30 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span className="text-lg group-hover:scale-110 transition-transform">🌐</span>
            <span className="tracking-wide">JUGAR EN LÍNEA (P2P)</span>
          </button>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => {
                sounds.playClick();
                onAbrirRanking();
              }}
              className="py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🏆</span>
              <span>Ranking</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirLogros();
              }}
              className="py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🏅</span>
              <span>Logros</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirComoJugar();
              }}
              className="py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>📖</span>
              <span>Reglas</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onAbrirAjustes();
              }}
              className="py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
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
      )}
    </div>
  );
};

// =========================================================================
// 2. CONFIG SCREEN (Único botón de Aspecto arriba + personaje/terreno predeterminados)
// =========================================================================
interface ConfigScreenProps {
  ajustes?: AppSettings;
  esTorneoInicial?: boolean;
  usuarioActual?: UserAccount | null;
  onIniciar: (config: MatchConfig) => void;
  onVolver: () => void;
  onUsuarioActualizado?: (u: UserAccount) => void;
  onShowToast?: (msg: string) => void;
}

const TEMA_ICONOS: Record<BoardTheme, string> = {
  madera: '🪵 Madera',
  neon: '⚡ Neón',
  hielo: '❄️ Hielo',
  lava: '🌋 Lava',
};

export const ConfigScreen: React.FC<ConfigScreenProps> = ({
  ajustes,
  esTorneoInicial = false,
  usuarioActual,
  onIniciar,
  onVolver,
  onUsuarioActualizado,
  onShowToast,
}) => {
  const [numJugadores, setNumJugadores] = useState<2 | 4>(2);
  const [modalAspectoAbierto, setModalAspectoAbierto] = useState(false);

  // Carga automática del terreno y personaje predeterminados del usuario si existen
  const [temaTablero, setTemaTablero] = useState<BoardTheme>(
    () => usuarioActual?.temaTablero || ajustes?.temaTablero || 'madera'
  );
  const [jugadores, setJugadores] = useState<
    { nombre: string; tipo: PlayerType; color: string; hat: HatType }[]
  >(() => [
    {
      nombre: usuarioActual?.nombre || 'Tú',
      tipo: 'humano',
      color: usuarioActual?.avatarColor || '#ff6b6b',
      hat: usuarioActual?.avatarHat || 'corona',
    },
    { nombre: 'Bot Normal', tipo: 'bot_normal', color: '#4dabf7', hat: 'bot_cpu' },
    { nombre: 'Bot Fácil', tipo: 'bot_facil', color: '#ffd43b', hat: 'bot_cpu' },
    { nombre: 'Bot Difícil', tipo: 'bot_dificil', color: '#51cf66', hat: 'bot_cpu' },
  ]);

  // Si el usuario inicia sesión o sincroniza su perfil predeterminado, reflejar su personaje y terreno
  useEffect(() => {
    if (usuarioActual) {
      if (usuarioActual.temaTablero) {
        setTemaTablero(usuarioActual.temaTablero);
      }
      setJugadores((prev) => {
        const next = [...prev];
        next[0] = {
          ...next[0],
          nombre: usuarioActual.nombre,
          color: usuarioActual.avatarColor || next[0].color,
          hat: usuarioActual.avatarHat || next[0].hat,
        };
        return next;
      });
    }
  }, [usuarioActual?.id, usuarioActual?.avatarHat, usuarioActual?.avatarColor, usuarioActual?.temaTablero]);

  const [empiezaAlAzar, setEmpiezaAlAzar] = useState<boolean>(false);
  const [permitirDeshacer, setPermitirDeshacer] = useState<boolean>(ajustes?.permitirDeshacer ?? true);
  const [permitirPistas, setPermitirPistas] = useState<boolean>(ajustes?.permitirPistas ?? true);
  const [modoConTiempo, setModoConTiempo] = useState<boolean>(false);
  const [segundosPorTurno, setSegundosPorTurno] = useState<number>(30);
  const [esTorneo, setEsTorneo] = useState<boolean>(esTorneoInicial);
  const [totalRondasTorneo, setTotalRondasTorneo] = useState<number>(3);
  const [rotationMode, setRotationMode] = useState<boolean>(
    Boolean(ajustes?.cambiarVistaPorTurno ?? false)
  );
  const [avisoInvitadoVisible, setAvisoInvitadoVisible] = useState<boolean>(true);

  useEffect(() => {
    if (ajustes?.cambiarVistaPorTurno !== undefined) {
      setRotationMode(Boolean(ajustes.cambiarVistaPorTurno));
    }
  }, [ajustes?.cambiarVistaPorTurno]);

  const humanosActivos = jugadores
    .slice(0, numJugadores)
    .filter((j) => j.tipo === 'humano').length;
  const puedeGirarTablero = humanosActivos >= 2;

  const updateJugador = (idx: number, patch: Partial<(typeof jugadores)[0]>) => {
    setJugadores((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      if (merged.tipo !== 'humano') {
        merged.hat = 'bot_cpu';
      } else if (patch.tipo === 'humano' && next[idx].tipo !== 'humano' && merged.hat === 'bot_cpu') {
        merged.hat = idx === 0 && usuarioActual?.avatarHat ? usuarioActual.avatarHat : 'corona';
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
      let nom = i === 0 && usuarioActual ? usuarioActual.nombre : j.nombre.trim();
      if (!nom) nom = i === 0 ? 'Tú' : `Jugador ${i + 1}`;
      if (seenNames.has(nom.toLowerCase())) {
        nom = `${nom} (2)`;
      }
      seenNames.add(nom.toLowerCase());
      return {
        nombre: nom.slice(0, 15),
        tipo: j.tipo,
        color: j.color,
        hat: j.hat,
      };
    });

    if (!usuarioActual && sanitized[0]?.nombre && sanitized[0].nombre !== 'Tú') {
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
      temaTablero,
      // Giro completamente desactivado (vista fija sin rotaciones)
      rotationMode: false,
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-5 max-w-xl mx-auto z-10 overflow-y-auto">
      {/* Top Header con el ÚNICO botón de Aspecto general */}
      <div className="w-full flex items-center justify-between pb-3 mb-2 border-b-3 border-[#2b2140]/15 gap-2">
        <button
          onClick={() => {
            sounds.playClick();
            onVolver();
          }}
          className="py-1.5 px-3 rounded-xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-xs font-bold text-[#2b2140] hover:bg-[#f1f3f5] active:translate-y-0.5 cursor-pointer flex items-center gap-1 shrink-0"
        >
          ◀ Menú
        </button>

        <h2 className="text-lg sm:text-2xl font-black text-[#2b2140] truncate text-center">
          {esTorneo ? 'Configurar Torneo' : 'Configurar Partida'}
        </h2>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setModalAspectoAbierto(true);
          }}
          className="py-1.5 px-2.5 rounded-xl bg-[#fff9db] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-xs font-black text-[#5c3c00] hover:bg-[#ffd43b] active:translate-y-0.5 cursor-pointer flex items-center gap-1 shrink-0"
          title="Personalizar tu personaje y terreno de la arena"
        >
          <span>🎨</span>
          <span>Aspecto</span>
        </button>
      </div>

      {/* Main Settings Body */}
      <div className="w-full flex-1 flex flex-col gap-3 py-1">
        {!usuarioActual && avisoInvitadoVisible && (
          <div className="w-full p-2.5 bg-[#fff3bf] rounded-2xl border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] flex items-center justify-between gap-2 text-xs animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">ℹ️</span>
              <div className="text-[11px] font-bold text-[#8f4b00] leading-tight">
                <strong>Modo Invitado:</strong> Tus partidas se guardarán en tu <u>Ranking Local</u>. Inicia sesión para competir en el Ranking Global y guardar tu personaje y terreno predeterminados.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setAvisoInvitadoVisible(false);
              }}
              className="w-6 h-6 rounded-full bg-white border border-[#2b2140] text-xs font-black text-[#2b2140] hover:bg-[#ffe3e3] shrink-0 flex items-center justify-center cursor-pointer"
              title="Quitar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modalidad y Número de Jugadores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#593922]">
              Modalidad
            </span>
            <div className="relative flex p-1 bg-[#ede4d0] rounded-2xl border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140] w-full">
              <button
                onClick={() => {
                  setEsTorneo(false);
                  sounds.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  !esTorneo
                    ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : 'text-[#86542d] hover:text-[#2b2140]'
                }`}
              >
                🎮 Rápida
              </button>
              <button
                onClick={() => {
                  setEsTorneo(true);
                  sounds.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  esTorneo
                    ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : 'text-[#86542d] hover:text-[#2b2140]'
                }`}
              >
                🏆 Torneo
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#593922]">
              Jugadores
            </span>
            <div className="relative flex p-1 bg-[#ede4d0] rounded-2xl border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140] w-full">
              <button
                onClick={() => {
                  setNumJugadores(2);
                  sounds.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  numJugadores === 2
                    ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : 'text-[#86542d] hover:text-[#2b2140]'
                }`}
              >
                👥 2 Jugadores
              </button>
              <button
                onClick={() => {
                  setNumJugadores(4);
                  sounds.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  numJugadores === 4
                    ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : 'text-[#86542d] hover:text-[#2b2140]'
                }`}
              >
                🎉 4 Jugadores
              </button>
            </div>
          </div>
        </div>

        {esTorneo && (
          <div className="p-3 bg-[#fff9db] rounded-2xl border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] flex items-center justify-between gap-3 animate-[slideDown_0.2s_ease-out]">
            <div className="text-left">
              <span className="font-black text-xs text-[#2b2140] block">Total de Rondas del Torneo:</span>
              <span className="text-[11px] text-[#86542d] font-semibold">
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
                  className={`py-1.5 px-3 rounded-xl font-black text-xs border-2 border-[#2b2140] cursor-pointer ${
                    totalRondasTorneo === rondas
                      ? 'bg-[#ffd43b] text-[#5c3c00] shadow-[0_2px_0_#2b2140]'
                      : 'bg-white text-[#2b2140]'
                  }`}
                >
                  {rondas} rondas
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Indicador informativo del terreno activo (se edita desde el único botón Aspecto) */}
        <div className="px-3 py-1.5 bg-white/80 rounded-xl border-2 border-[#2b2140]/30 flex items-center justify-between text-xs">
          <span className="font-bold text-[#593922]">
            Terreno seleccionado: <strong className="text-[#2b2140]">{TEMA_ICONOS[temaTablero]}</strong>
          </span>
          <span className="text-[11px] font-semibold text-[#86542d]">
            {usuarioActual?.temaTablero === temaTablero && usuarioActual?.avatarHat === jugadores[0].hat
              ? '⭐ Predeterminado de tu perfil'
              : 'Usa 🎨 Aspecto arriba para cambiar'}
          </span>
        </div>

        {/* Players List (Sin duplicar botón de Aspecto en la fila del jugador) */}
        <div className="space-y-2">
          {jugadores.slice(0, numJugadores).map((j, idx) => {
            const isUserPlayer = idx === 0;

            return (
              <div
                key={idx}
                className="p-2.5 bg-white rounded-2xl border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] flex items-center gap-3 animate-[slideDown_0.2s_ease-out]"
              >
                {isUserPlayer && usuarioActual ? (
                  <div className="shrink-0" title="Tu personaje de cuenta">
                    <CartoonCharacter color={j.color} hat={j.hat} size={44} showShadow={false} />
                  </div>
                ) : j.tipo !== 'humano' ? (
                  <div
                    className="shrink-0 p-0.5 rounded-xl bg-[#2b2140]/5 border border-[#2b2140]/20 flex items-center justify-center"
                    title="Avatar exclusivo de Bot CPU (todos los bots usan este diseño único)"
                  >
                    <CartoonCharacter color={j.color} hat="bot_cpu" size={44} showShadow={false} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      const iniciales = PERSONAJES_REGISTRO.filter(
                        (p) => p.puntosRequeridos === 0 && p.id !== 'bot_cpu'
                      );
                      const curIdx = iniciales.findIndex((h) => h.id === j.hat);
                      const nextH = iniciales[(curIdx + 1) % iniciales.length];
                      updateJugador(idx, { hat: nextH.id, color: nextH.defaultColor });
                    }}
                    className="hover:scale-110 active:scale-95 transition-transform cursor-pointer shrink-0"
                    title="Clic para cambiar personaje de este jugador humano"
                  >
                    <CartoonCharacter color={j.color} hat={j.hat} size={44} showShadow={false} />
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  {isUserPlayer && usuarioActual ? (
                    <div className="w-full flex items-center justify-between text-sm font-extrabold text-[#2b2140] bg-[#e7f5ff] border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 shadow-xs select-none">
                      <span className="truncate">{usuarioActual.nombre}</span>
                      <span className="text-[10px] text-[#1971c2] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 bg-white px-1.5 py-0.5 rounded border border-[#1971c2]/30">
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
                      className="w-full text-sm font-extrabold text-[#2b2140] bg-[#f8f9fa] border-2 border-[#2b2140]/30 rounded-xl px-2.5 py-1.5 outline-none focus:border-[#2b2140]"
                    />
                  )}
                </div>

                <select
                  value={j.tipo}
                  onChange={(e) => {
                    const newTipo = e.target.value as PlayerType;
                    let newNombre = j.nombre;
                    const isBotName = /^bot\s*(normal|fácil|facil|difícil|dificil)/i.test(j.nombre);
                    if (newTipo === 'humano' && (isBotName || j.tipo !== 'humano')) {
                      newNombre = idx === 0 ? usuarioActual?.nombre || 'Tú' : `Jugador ${idx + 1}`;
                    } else if (
                      newTipo !== 'humano' &&
                      (j.tipo === 'humano' || /^jugador\s*\d+/i.test(j.nombre) || j.nombre === 'Tú')
                    ) {
                      if (newTipo === 'bot_facil') newNombre = 'Bot Fácil';
                      else if (newTipo === 'bot_normal') newNombre = 'Bot Normal';
                      else if (newTipo === 'bot_dificil') newNombre = 'Bot Difícil';
                    }
                    const newHat: HatType = newTipo !== 'humano'
                      ? 'bot_cpu'
                      : (idx === 0 && usuarioActual?.avatarHat ? usuarioActual.avatarHat : 'corona');
                    updateJugador(idx, { tipo: newTipo, nombre: newNombre, hat: newHat });
                  }}
                  className="text-xs font-bold text-[#2b2140] bg-[#fff9db] border-2 border-[#2b2140] rounded-xl px-2 py-1.5 outline-none cursor-pointer shadow-sm shrink-0"
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
          <div
            onClick={() => {
              setEmpiezaAlAzar(!empiezaAlAzar);
              sounds.playClick();
            }}
            className="p-2 bg-white rounded-xl border-2 border-[#2b2140] flex items-center justify-between cursor-pointer select-none"
          >
            <span className="text-xs font-bold text-[#2b2140]">🎲 Empieza al azar</span>
            <div
              className={`w-9 h-5 rounded-full p-0.5 border border-[#2b2140] transition-colors ${
                empiezaAlAzar ? 'bg-[#51cf66]' : 'bg-[#ced4da]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white border border-[#2b2140] transition-transform ${
                  empiezaAlAzar ? 'translate-x-4' : ''
                }`}
              />
            </div>
          </div>

          <div
            onClick={() => {
              setPermitirDeshacer(!permitirDeshacer);
              sounds.playClick();
            }}
            className="p-2 bg-white rounded-xl border-2 border-[#2b2140] flex items-center justify-between cursor-pointer select-none"
          >
            <span className="text-xs font-bold text-[#2b2140]">↩ Permitir deshacer</span>
            <div
              className={`w-9 h-5 rounded-full p-0.5 border border-[#2b2140] transition-colors ${
                permitirDeshacer ? 'bg-[#51cf66]' : 'bg-[#ced4da]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white border border-[#2b2140] transition-transform ${
                  permitirDeshacer ? 'translate-x-4' : ''
                }`}
              />
            </div>
          </div>

          <div
            onClick={() => {
              setPermitirPistas(!permitirPistas);
              sounds.playClick();
            }}
            className="p-2 bg-white rounded-xl border-2 border-[#2b2140] flex items-center justify-between cursor-pointer select-none"
          >
            <span className="text-xs font-bold text-[#2b2140]">💡 Permitir pistas</span>
            <div
              className={`w-9 h-5 rounded-full p-0.5 border border-[#2b2140] transition-colors ${
                permitirPistas ? 'bg-[#51cf66]' : 'bg-[#ced4da]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white border border-[#2b2140] transition-transform ${
                  permitirPistas ? 'translate-x-4' : ''
                }`}
              />
            </div>
          </div>

          <div
            onClick={() => {
              setModoConTiempo(!modoConTiempo);
              sounds.playClick();
            }}
            className="p-2 bg-white rounded-xl border-2 border-[#2b2140] flex items-center justify-between cursor-pointer select-none"
          >
            <span className="text-xs font-bold text-[#2b2140]">⏱️ Modo con tiempo</span>
            <div
              className={`w-9 h-5 rounded-full p-0.5 border border-[#2b2140] transition-colors ${
                modoConTiempo ? 'bg-[#51cf66]' : 'bg-[#ced4da]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white border border-[#2b2140] transition-transform ${
                  modoConTiempo ? 'translate-x-4' : ''
                }`}
              />
            </div>
          </div>

          {/* Vista Fija Estable: sin giros ni rotaciones para evitar mareos */}
          <div className="p-2 rounded-xl border-2 border-[#2b2140] flex items-center justify-between select-none col-span-2 bg-[#e7f5ff]">
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-[#1864ab] flex items-center gap-1">
                <span>🧭</span> Vista Fija Estable (Sin Giros)
              </span>
              <span className="text-[10px] text-[#1c7ed6]">
                El tablero se mantiene siempre fijo sin rotaciones para evitar mareos, con indicadores claros del lado e inicio del oponente.
              </span>
            </div>
            <span className="text-base shrink-0">✨</span>
          </div>
        </div>

        {modoConTiempo && (
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-xs font-bold text-[#593922]">Segundos por turno:</span>
            {[15, 30, 60].map((sec) => (
              <button
                key={sec}
                onClick={() => setSegundosPorTurno(sec)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border-2 border-[#2b2140] cursor-pointer ${
                  segundosPorTurno === sec
                    ? 'bg-[#ffd43b] text-[#5c3c00] shadow-[0_2px_0_#2b2140]'
                    : 'bg-white text-[#2b2140]'
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
        className={`w-full py-3.5 px-6 rounded-2xl font-black text-lg border-4 border-[#2b2140] shadow-[0_6px_0_#2b2140] active:translate-y-1 active:shadow-[0_2px_0_#2b2140] transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 ${
          esTorneo
            ? 'bg-[#ffd43b] text-[#5c3c00] hover:bg-[#fcc419]'
            : 'bg-[#51cf66] text-[#134e20] hover:bg-[#40c057]'
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
          }}
          temaActual={temaTablero}
          usuarioActual={usuarioActual}
          onUsuarioActualizado={onUsuarioActualizado}
          onShowToast={onShowToast}
          onAplicar={(nuevoP, nuevoTema) => {
            updateJugador(0, { hat: nuevoP.hat, color: nuevoP.color });
            setTemaTablero(nuevoTema);
          }}
        />
      )}
    </div>
  );
};
