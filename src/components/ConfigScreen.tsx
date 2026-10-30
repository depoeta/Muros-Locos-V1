/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { sounds } from '../audio/murosAudio';
import { AppSettings, MatchConfig, PlayerType } from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';

interface ConfigScreenProps {
  ajustes?: AppSettings;
  esTorneoInicial?: boolean;
  onIniciar: (config: MatchConfig) => void;
  onVolver: () => void;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({
  ajustes,
  esTorneoInicial = false,
  onIniciar,
  onVolver,
}) => {
  const [numJugadores, setNumJugadores] = useState<2 | 4>(2);
  const [jugadores, setJugadores] = useState<
    { nombre: string; tipo: PlayerType; color: string; hat: 'corona' | 'pompon' | 'antena' | 'brote' }[]
  >([
    { nombre: 'Tú', tipo: 'humano', color: '#ff6b6b', hat: 'corona' },
    { nombre: 'Bot Normal', tipo: 'bot_normal', color: '#4dabf7', hat: 'pompon' },
    { nombre: 'Bot Fácil', tipo: 'bot_facil', color: '#ffd43b', hat: 'antena' },
    { nombre: 'Bot Difícil', tipo: 'bot_dificil', color: '#51cf66', hat: 'brote' },
  ]);

  const [empiezaAlAzar, setEmpiezaAlAzar] = useState<boolean>(false);
  const [permitirDeshacer, setPermitirDeshacer] = useState<boolean>(
    ajustes?.permitirDeshacer ?? true
  );
  const [permitirPistas, setPermitirPistas] = useState<boolean>(
    ajustes?.permitirPistas ?? true
  );
  const [modoConTiempo, setModoConTiempo] = useState<boolean>(false);
  const [segundosPorTurno, setSegundosPorTurno] = useState<number>(30);
  const [esTorneo, setEsTorneo] = useState<boolean>(esTorneoInicial);
  const [totalRondasTorneo, setTotalRondasTorneo] = useState<number>(3);

  const updateJugador = (idx: number, patch: Partial<(typeof jugadores)[0]>) => {
    setJugadores((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const handleStart = () => {
    sounds.playClick();

    // Sanitize names: empty -> default, duplicate -> suffix (2)
    const activeList = jugadores.slice(0, numJugadores);
    const seenNames = new Set<string>();

    const sanitized = activeList.map((j, i) => {
      let nom = j.nombre.trim();
      if (!nom) nom = `Jugador ${i + 1}`;
      if (seenNames.has(nom.toLowerCase())) {
        nom = `${nom} (2)`;
      }
      seenNames.add(nom.toLowerCase());
      return {
        nombre: nom.slice(0, 12),
        tipo: j.tipo,
      };
    });

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
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-5 max-w-xl mx-auto z-10 overflow-y-auto">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-3 mb-2 border-b-3 border-[#2b2140]/15">
        <button
          onClick={() => {
            sounds.playClick();
            onVolver();
          }}
          className="py-1.5 px-3 rounded-xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-xs font-bold text-[#2b2140] hover:bg-[#f1f3f5] active:translate-y-0.5 cursor-pointer flex items-center gap-1"
        >
          ◀ Menú
        </button>
        <h2 className="text-xl sm:text-2xl font-black text-[#2b2140]">
          {esTorneo ? 'Configurar Torneo' : 'Configurar Partida'}
        </h2>
        <div className="w-16" />
      </div>

      {/* Main Settings Body */}
      <div className="w-full flex-1 flex flex-col gap-3 py-1">
        {/* Game Mode Pill: Partida Rápida vs Torneo */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#593922]">
            Modalidad de Juego
          </span>
          <div className="relative flex p-1 bg-[#ede4d0] rounded-2xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] w-72">
            <button
              onClick={() => {
                setEsTorneo(false);
                sounds.playClick();
              }}
              className={`flex-1 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                !esTorneo
                  ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              🎮 Partida Rápida
            </button>
            <button
              onClick={() => {
                setEsTorneo(true);
                sounds.playClick();
              }}
              className={`flex-1 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                esTorneo
                  ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              🏆 Modo Torneo
            </button>
          </div>
        </div>

        {/* Tournament Rounds Selection Banner if Torneo is active */}
        {esTorneo && (
          <div className="p-3 bg-[#fff9db] rounded-2xl border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] flex items-center justify-between gap-3 animate-[slideDown_0.2s_ease-out]">
            <div className="text-left">
              <span className="font-black text-xs text-[#2b2140] block">
                Total de Rondas del Torneo:
              </span>
              <span className="text-[11px] text-[#86542d] font-semibold">
                Suma los puntos de cada ronda hasta coronar al Gran Campeón
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

        {/* 2 or 4 Players Selector Pill */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#593922]">
            Número de Jugadores
          </span>
          <div className="relative flex p-1 bg-[#ede4d0] rounded-2xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] w-64">
            <button
              onClick={() => {
                setNumJugadores(2);
                sounds.playClick();
              }}
              className={`flex-1 py-2 rounded-xl font-black text-sm transition-all cursor-pointer ${
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
              className={`flex-1 py-2 rounded-xl font-black text-sm transition-all cursor-pointer ${
                numJugadores === 4
                  ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              🎉 4 Jugadores
            </button>
          </div>
        </div>


        {/* Players List */}
        <div className="space-y-2 mt-1">
          {jugadores.slice(0, numJugadores).map((j, idx) => (
            <div
              key={idx}
              className="p-2.5 bg-white rounded-2xl border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] flex items-center gap-3 animate-[slideDown_0.2s_ease-out]"
            >
              <CartoonCharacter
                color={j.color}
                hat={j.hat}
                size={44}
                showShadow={false}
              />

              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  maxLength={12}
                  value={j.nombre}
                  onChange={(e) => updateJugador(idx, { nombre: e.target.value })}
                  placeholder={`Jugador ${idx + 1}`}
                  className="w-full text-sm font-extrabold text-[#2b2140] bg-[#f8f9fa] border-2 border-[#2b2140]/30 rounded-lg px-2 py-1 outline-none focus:border-[#2b2140]"
                />
              </div>

              <select
                value={j.tipo}
                onChange={(e) => {
                  const newTipo = e.target.value as PlayerType;
                  let newNombre = j.nombre;
                  const isBotName = /^bot\s*(normal|fácil|facil|difícil|dificil)/i.test(j.nombre);
                  if (newTipo === 'humano' && (isBotName || j.tipo !== 'humano')) {
                    newNombre = idx === 0 ? 'Tú' : `Jugador ${idx + 1}`;
                  } else if (newTipo !== 'humano' && (j.tipo === 'humano' || /^jugador\s*\d+/i.test(j.nombre) || j.nombre === 'Tú')) {
                    if (newTipo === 'bot_facil') newNombre = 'Bot Fácil';
                    else if (newTipo === 'bot_normal') newNombre = 'Bot Normal';
                    else if (newTipo === 'bot_dificil') newNombre = 'Bot Difícil';
                  }
                  updateJugador(idx, { tipo: newTipo, nombre: newNombre });
                }}
                className="text-xs font-bold text-[#2b2140] bg-[#fff9db] border-2 border-[#2b2140] rounded-xl px-2 py-1.5 outline-none cursor-pointer shadow-sm"
              >
                <option value="humano">👤 Humano</option>
                <option value="bot_facil">🤖 Bot Fácil</option>
                <option value="bot_normal">🤖 Bot Normal</option>
                <option value="bot_dificil">🤖 Bot Difícil</option>
              </select>
            </div>
          ))}
        </div>

        {/* Match Toggles */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {/* Empieza al azar */}
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

          {/* Permitir Deshacer */}
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

          {/* Permitir Pistas */}
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

          {/* Modo con tiempo */}
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
        </div>

        {/* Tiempo por turno selector if enabled */}
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
    </div>
  );
};

