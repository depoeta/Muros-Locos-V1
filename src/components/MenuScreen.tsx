/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { sounds } from '../audio/murosAudio';
import { CartoonCharacter } from './CartoonCharacter';

import { UserAccount } from '../types/murosLocos';

interface MenuScreenProps {
  usuarioActual: UserAccount | null;
  onAbrirPerfil: () => void;
  onIniciarPartida: () => void;
  onIniciarTorneo: () => void;
  onAbrirOnline: () => void;
  onAbrirRanking: () => void;
  onAbrirLogros: () => void;
  onAbrirComoJugar: () => void;
  onAbrirAjustes: () => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  usuarioActual,
  onAbrirPerfil,
  onIniciarPartida,
  onIniciarTorneo,
  onAbrirOnline,
  onAbrirRanking,
  onAbrirLogros,
  onAbrirComoJugar,
  onAbrirAjustes,
}) => {
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

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-4 z-10">
      {/* Top Bar with Profile / Secret Admin Access */}
      <div className="w-full max-w-md flex items-center justify-between px-1 z-20">
        <div className="flex items-center gap-1.5 bg-[#fff8e7]/80 px-2.5 py-1 rounded-full border-2 border-[#2b2140] shadow-sm">
          <span className="text-base">🎲</span>
          <span className="font-black text-xs text-[#2b2140] tracking-wide">MUROS LOCOS</span>
        </div>

        <button
          onClick={() => {
            sounds.playClick();
            onAbrirPerfil();
          }}
          className="py-1 px-3 rounded-2xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fff9db] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-2 group"
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
                  <span className="text-xs font-black text-[#2b2140] max-w-[95px] truncate">
                    {usuarioActual.nombre}
                  </span>
                  {usuarioActual.rol === 'admin' && (
                    <span className="text-[8px] bg-[#ffd43b] text-[#5c3c00] font-black px-1 rounded border border-[#2b2140]">
                      ADMIN
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-[#2b8a3e] block">
                  ⭐ {usuarioActual.puntos} pts
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm group-hover:scale-110 transition-transform">👤</span>
              <span className="text-xs font-black text-[#2b2140]">Mi Perfil</span>
            </>
          )}
        </button>
      </div>

      {/* Cartoon Top Header / Title */}
      <div className="flex flex-col items-center mt-2 sm:mt-4">
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          {letters.map((l, i) =>
            l.char === ' ' ? (
              <span key={i} className="w-3 sm:w-5" />
            ) : (
              <span
                key={i}
                className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight inline-block animate-bounce drop-shadow-[0_6px_0_#2b2140]"
                style={{
                  color: l.color,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '1.4s',
                  WebkitTextStroke: '2.5px #2b2140',
                }}
              >
                {l.char}
              </span>
            )
          )}
        </div>
        <p className="mt-2 text-sm sm:text-base font-extrabold text-[#593922] bg-[#fff8e7]/85 px-4 py-1 rounded-full border-2 border-[#2b2140] shadow-sm">
          🧱 ¡El juego de mesa de carreras, muros y saltos locos!
        </p>
      </div>

      {/* Floating Mascots Row */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 my-4">
        <div className="animate-[bounce_2.2s_ease-in-out_infinite] [animation-delay:0s]">
          <CartoonCharacter color="#ff6b6b" hat="corona" size={64} />
        </div>
        <div className="animate-[bounce_2.6s_ease-in-out_infinite] [animation-delay:0.3s]">
          <CartoonCharacter color="#4dabf7" hat="pompon" size={64} />
        </div>
        <div className="animate-[bounce_2.4s_ease-in-out_infinite] [animation-delay:0.6s]">
          <CartoonCharacter color="#ffd43b" hat="antena" size={64} />
        </div>
        <div className="animate-[bounce_2.8s_ease-in-out_infinite] [animation-delay:0.9s]">
          <CartoonCharacter color="#51cf66" hat="brote" size={64} />
        </div>
      </div>

      {/* Action Buttons Menu */}
      <div className="w-full max-w-xs sm:max-w-sm flex flex-col gap-2.5 mb-5">
        {/* Play Big Button */}
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

        {/* Tournament Big Button */}
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

        {/* Play Online P2P Button */}
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

        {/* Secondary Buttons Grid */}
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
    </div>
  );
};

