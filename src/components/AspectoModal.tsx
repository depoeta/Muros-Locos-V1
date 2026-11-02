/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BoardTheme, HatType, PERSONAJES_REGISTRO, UserAccount } from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import { sounds } from '../audio/murosAudio';
import { actualizarCuentaAsync } from '../game/storage';

interface AspectoModalProps {
  onCerrar: () => void;
  personajeActual: { hat: HatType; color: string };
  temaActual: BoardTheme;
  usuarioActual?: UserAccount | null;
  onAplicar: (nuevoPersonaje: { hat: HatType; color: string }, nuevoTema: BoardTheme) => void;
  onUsuarioActualizado?: (u: UserAccount) => void;
  onShowToast?: (msg: string) => void;
}

const TEMAS_LISTA: { id: BoardTheme; label: string; desc: string; border: string; bg: string }[] = [
  { id: 'madera', label: '🪵 Madera', desc: 'Clásica de bosque', border: 'border-[#86542d]', bg: 'bg-[#ffec99]' },
  { id: 'neon', label: '⚡ Neón', desc: 'Cyberpunk brillante', border: 'border-[#0c8599]', bg: 'bg-[#c5f6fa]' },
  { id: 'hielo', label: '❄️ Hielo', desc: 'Escarcha ártica', border: 'border-[#1971c2]', bg: 'bg-[#d0ebff]' },
  { id: 'lava', label: '🌋 Lava', desc: 'Magma volcánico', border: 'border-[#c92a2a]', bg: 'bg-[#ffe3e3]' },
];

export const AspectoModal: React.FC<AspectoModalProps> = ({
  onCerrar,
  personajeActual,
  temaActual,
  usuarioActual,
  onAplicar,
  onUsuarioActualizado,
  onShowToast,
}) => {
  const [selectedHat, setSelectedHat] = useState<HatType>(personajeActual.hat || 'corona');
  const [selectedColor, setSelectedColor] = useState<string>(personajeActual.color || '#ff6b6b');
  const [selectedTema, setSelectedTema] = useState<BoardTheme>(temaActual || 'madera');
  const [guardarEnPerfil, setGuardarEnPerfil] = useState(Boolean(usuarioActual));
  const [guardando, setGuardando] = useState(false);

  const userPoints = usuarioActual?.puntos || 0;
  const esAdmin = usuarioActual?.rol === 'admin';

  const isPersonajeDesbloqueado = (puntosReq: number) => {
    if (puntosReq === 0) return true;
    if (esAdmin) return true;
    return userPoints >= puntosReq;
  };

  const handleSeleccionarPersonaje = (p: (typeof PERSONAJES_REGISTRO)[0]) => {
    if (!isPersonajeDesbloqueado(p.puntosRequeridos)) {
      sounds.playError();
      onShowToast?.(`🔒 ${p.label} se desbloquea al alcanzar ${p.puntosRequeridos} puntos`);
      return;
    }
    sounds.playClick();
    setSelectedHat(p.id);
    setSelectedColor(p.defaultColor);
  };

  const handleGuardarYAplicar = async () => {
    sounds.playClick();
    setGuardando(true);

    try {
      if (usuarioActual && guardarEnPerfil) {
        const updated: UserAccount = {
          ...usuarioActual,
          avatarHat: selectedHat,
          avatarColor: selectedColor,
          temaTablero: selectedTema,
        };
        await actualizarCuentaAsync(updated);
        onUsuarioActualizado?.(updated);
        onShowToast?.('⭐ Personaje y tema guardados en tu perfil');
      }

      onAplicar({ hat: selectedHat, color: selectedColor }, selectedTema);
      onCerrar();
    } catch {
      onAplicar({ hat: selectedHat, color: selectedColor }, selectedTema);
      onCerrar();
    } finally {
      setGuardando(false);
    }
  };

  const activeCharDef = PERSONAJES_REGISTRO.find((p) => p.id === selectedHat) || PERSONAJES_REGISTRO[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-md bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-4 sm:p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#2b2140] leading-none">
                Aspecto y Personalización
              </h3>
              <span className="text-[11px] font-bold text-[#86542d]">
                {usuarioActual ? `⭐ Tus puntos: ${userPoints}` : '💡 Modo Invitado (Crea perfil para desbloquear)'}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-8 h-8 rounded-full bg-[#f1f3f5] border-2 border-[#2b2140] text-sm font-black text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex items-center gap-3 mb-3">
          <CartoonCharacter color={selectedColor} hat={selectedHat} size={54} showShadow={false} />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black text-[#593922] uppercase tracking-wider block">
              Vista Previa
            </span>
            <span className="font-extrabold text-sm text-[#2b2140] flex items-center gap-1.5">
              <span>{activeCharDef.icon}</span>
              <span>{activeCharDef.label}</span>
            </span>
            <span className="text-[11px] font-bold text-[#86542d] block truncate">
              Arena: {TEMAS_LISTA.find((t) => t.id === selectedTema)?.label}
            </span>
          </div>
        </div>

        {/* 1. Selector de Personaje (10 Muñequitos) */}
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
              1. Elige tu Personaje (10 Disponibles)
            </span>
            <span className="text-[10px] font-bold text-[#2b8a3e]">
              {PERSONAJES_REGISTRO.filter((p) => isPersonajeDesbloqueado(p.puntosRequeridos)).length}/10 Desbloqueados
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {PERSONAJES_REGISTRO.map((p) => {
              const isSelected = selectedHat === p.id;
              const unlocked = isPersonajeDesbloqueado(p.puntosRequeridos);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSeleccionarPersonaje(p)}
                  className={`relative p-2 rounded-2xl border-2 border-[#2b2140] cursor-pointer flex flex-col items-center gap-1 transition-all ${
                    !unlocked
                      ? 'bg-[#f1f3f5] opacity-70 hover:opacity-90'
                      : isSelected
                      ? 'bg-[#ffd43b] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                      : 'bg-white hover:bg-[#f8f9fa]'
                  }`}
                  title={unlocked ? p.label : `Requiere ${p.puntosRequeridos} puntos`}
                >
                  {/* Lock Indicator */}
                  {!unlocked && (
                    <div className="absolute top-1 right-1 bg-[#2b2140] text-[#ffd43b] text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                      🔒
                    </div>
                  )}

                  <div className={!unlocked ? 'grayscale' : ''}>
                    <CartoonCharacter color={p.defaultColor} hat={p.id} size={36} showShadow={false} />
                  </div>
                  <span className="text-[10px] font-extrabold text-[#2b2140] text-center leading-tight">
                    {p.label}
                  </span>
                  {!unlocked && (
                    <span className="text-[8px] font-black text-[#e03131] leading-none">
                      {p.puntosRequeridos} pts
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Selector de Tema de Tablero */}
        <div className="flex flex-col gap-1.5 mb-3">
          <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
            2. Tema de la Arena / Tablero
          </span>
          <div className="grid grid-cols-2 gap-2">
            {TEMAS_LISTA.map((theme) => {
              const isSelected = selectedTema === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setSelectedTema(theme.id);
                  }}
                  className={`p-2 rounded-xl border-2 text-xs font-black cursor-pointer transition-all flex flex-col items-center gap-0.5 ${theme.border} ${
                    isSelected
                      ? `${theme.bg} shadow-[0_3px_0_#2b2140] scale-[1.02]`
                      : 'bg-white opacity-80 hover:opacity-100 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-sm font-bold">{theme.label}</span>
                  <span className="text-[9px] font-medium text-[#495057]">{theme.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Checkbox: Guardar en perfil si está logueado */}
        {usuarioActual ? (
          <label className="flex items-center gap-2 p-2 bg-[#e7f5ff] rounded-xl border border-[#2b2140]/30 cursor-pointer mb-3 select-none">
            <input
              type="checkbox"
              checked={guardarEnPerfil}
              onChange={(e) => setGuardarEnPerfil(e.target.checked)}
              className="w-4 h-4 rounded text-[#1971c2] cursor-pointer"
            />
            <span className="text-[11px] font-bold text-[#1864ab] leading-tight">
              ⭐ Guardar como mi personaje y arena predeterminados en mi Perfil y Ranking
            </span>
          </label>
        ) : (
          <div className="p-2 bg-[#fff9db] rounded-xl border border-[#2b2140]/20 mb-3 text-[11px] text-[#8f4b00] font-semibold leading-tight">
            💡 <strong>Modo Invitado:</strong> Puedes usar los personajes iniciales. Inicia sesión para desbloquear a Zorro, Robot, Dragón y Ninja conforme ganes puntos.
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          disabled={guardando}
          onClick={handleGuardarYAplicar}
          className="w-full py-2.5 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>✓</span>
          <span>{guardando ? 'Guardando...' : 'Aplicar Aspecto'}</span>
        </button>
      </div>
    </div>
  );
};
