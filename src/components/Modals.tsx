/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../audio/murosAudio';
import {
  AchievementDef,
  AppSettings,
  GameState,
  HatType,
  LevelInfo,
  MatchResultRecord,
  RankEntry,
  ScoreBreakdown,
  TorneoState,
  UserAccount,
} from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import {
  adminActualizarUsuario,
  adminEliminarUsuario,
  cargarCuentas,
  cargarHistorial,
  cargarRanking,
  cerrarSesion,
  exportarDatosJSON,
  guardarCuentas,
  importarDatosJSON,
  iniciarSesion,
  LOGROS_LISTA,
  obtenerNivelYTitulo,
  registrarUsuario,
} from '../game/storage';

// =========================================================================
// 1. AJUSTES MODAL
// =========================================================================
interface AjustesModalProps {
  ajustes: AppSettings;
  onGuardar: (nuevosAjustes: AppSettings) => void;
  onCerrar: () => void;
}

export const AjustesModal: React.FC<AjustesModalProps> = ({
  ajustes,
  onGuardar,
  onCerrar,
}) => {
  const [localAjustes, setLocalAjustes] = useState<AppSettings>({ ...ajustes });

  const toggle = (key: keyof AppSettings) => {
    sounds.playClick();
    setLocalAjustes((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'sonido') {
        sounds.setEnabled(next.sonido);
      }
      return next;
    });
  };

  const handleGuardar = () => {
    sounds.playClick();
    onGuardar(localAjustes);
    onCerrar();
  };

  const opciones: { key: keyof AppSettings; label: string; desc: string; icon: string }[] = [
    { key: 'sonido', label: 'Efectos de Sonido', desc: 'Sonidos retro y efectos en cada jugada', icon: '🔊' },
    { key: 'animacionesReducidas', label: 'Animaciones Reducidas', desc: 'Desactiva efectos visuales continuos', icon: '⚡' },
    { key: 'mostrarDistancia', label: 'Mostrar Distancia a Meta', desc: 'Indica los pasos mínimos en la tarjeta del jugador', icon: '📏' },
    { key: 'permitirDeshacer', label: 'Permitir Deshacer', desc: 'Permite retroceder turnos con penalización (-10 pts)', icon: '↩️' },
    { key: 'permitirPistas', label: 'Permitir Pistas', desc: 'Muestra el camino óptimo hacia la meta (-5 pts)', icon: '💡' },
    { key: 'modoDaltonico', label: 'Modo Alto Contraste / Daltónico', desc: 'Iconos y patrones geométricos distintivos', icon: '👁️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-md bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_10px_0_#2b2140,0_20px_30px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <h3 className="text-xl font-black text-[#2b2140] flex items-center gap-2">
            <span>⚙️</span> Ajustes del Juego
          </h3>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-8 h-8 rounded-full bg-[#f1f3f5] border-2 border-[#2b2140] text-sm font-black text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 my-2">
          {opciones.map((op) => {
            const activo = localAjustes[op.key];
            return (
              <div
                key={op.key}
                onClick={() => toggle(op.key)}
                className={`p-3 rounded-2xl border-2 border-[#2b2140] flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                  activo
                    ? 'bg-[#d3f9d8] shadow-[0_2px_0_#2b2140]'
                    : 'bg-white hover:bg-[#f8f9fa] shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl flex-shrink-0">{op.icon}</span>
                  <div className="min-w-0">
                    <span className="font-extrabold text-xs sm:text-sm text-[#2b2140] block truncate">
                      {op.label}
                    </span>
                    <span className="text-[11px] font-medium text-[#86542d] block leading-tight">
                      {op.desc}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-12 h-7 rounded-full border-2 border-[#2b2140] p-0.5 transition-colors flex items-center flex-shrink-0 ${
                    activo ? 'bg-[#51cf66] justify-end' : 'bg-[#dee2e6] justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white border-2 border-[#2b2140] shadow-sm" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t-2 border-[#2b2140]/15 flex items-center justify-end gap-2">
          <button
            onClick={handleGuardar}
            className="w-full py-2.5 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
          >
            💾 Guardar y Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. CÓMO SE JUEGA MODAL
// =========================================================================
interface ComoSeJuegaModalProps {
  onCerrar: () => void;
}

export const ComoSeJuegaModal: React.FC<ComoSeJuegaModalProps> = ({ onCerrar }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-lg bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 sm:p-6 shadow-[0_10px_0_#2b2140,0_20px_30px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <h3 className="text-xl sm:text-2xl font-black text-[#2b2140] flex items-center gap-2">
            <span>📖</span> ¿Cómo se juega?
          </h3>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-8 h-8 rounded-full bg-[#f1f3f5] border-2 border-[#2b2140] text-sm font-black text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 my-2 text-[#593922] text-xs sm:text-sm">
          <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <h4 className="font-black text-sm text-[#2b2140] flex items-center gap-1.5 mb-1">
              <span>🎯</span> Objetivo del Juego
            </h4>
            <p className="leading-relaxed">
              Sé el primero en llevar tu ficha hasta cualquier casilla del extremo opuesto del tablero.
              En partidas de 2 jugadores, cruzas de arriba a abajo o viceversa. En 4 jugadores, cada uno cruza hacia su lado opuesto.
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <h4 className="font-black text-sm text-[#2b2140] flex items-center gap-1.5 mb-1">
              <span>🎲</span> En tu turno puedes elegir UNA acción:
            </h4>
            <ul className="list-disc list-inside space-y-1 pl-1 leading-relaxed">
              <li>
                <strong>Mover tu ficha:</strong> 1 paso ortogonal (arriba, abajo, izquierda, derecha) a una casilla libre.
              </li>
              <li>
                <strong>Colocar un muro:</strong> Pon un muro de 2 casillas de largo (Horizontal o Vertical) entre las intersecciones.
              </li>
            </ul>
          </div>

          <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <h4 className="font-black text-sm text-[#2b2140] flex items-center gap-1.5 mb-1">
              <span>🦘</span> Saltos sobre rivales
            </h4>
            <p className="leading-relaxed">
              Si estás frente a un rival y no hay un muro detrás de él, ¡puedes saltar sobre él hacia la casilla posterior! Si hay un muro o el borde detrás, puedes saltar en diagonal a los lados.
            </p>
          </div>

          <div className="p-3 bg-[#fff3bf] rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <h4 className="font-black text-sm text-[#8f4b00] flex items-center gap-1.5 mb-1">
              <span>⚠️</span> ¡La Regla de Oro de los Muros!
            </h4>
            <p className="leading-relaxed text-[#744210]">
              <strong>NUNCA</strong> puedes encerrar totalmente a un jugador. Siempre debe quedar al menos un camino libre hacia la meta para todos los participantes.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t-2 border-[#2b2140]/15">
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-full py-2.5 rounded-xl font-black text-sm bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] active:translate-y-0.5 cursor-pointer"
          >
            ¡Entendido, a jugar! 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 3. LOGROS MODAL
// =========================================================================
interface LogrosModalProps {
  onCerrar: () => void;
}

export const LogrosModal: React.FC<LogrosModalProps> = ({ onCerrar }) => {
  const ranking = useMemo(() => cargarRanking(), []);

  const misLogros = useMemo(() => {
    const set = new Set<string>();
    Object.values(ranking).forEach((entry) => {
      if (entry.logros && Array.isArray(entry.logros)) {
        entry.logros.forEach((l) => set.add(l));
      }
    });
    return set;
  }, [ranking]);

  const totalLogros = LOGROS_LISTA.length;
  const desbloqueados = misLogros.size;
  const progresoPct = Math.round((desbloqueados / totalLogros) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-lg bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 sm:p-6 shadow-[0_10px_0_#2b2140,0_20px_30px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎖️</span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#2b2140] leading-none">
                Logros y Medallas
              </h3>
              <span className="text-[11px] font-bold text-[#86542d]">
                {desbloqueados} de {totalLogros} completados ({progresoPct}%)
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-8 h-8 rounded-full bg-[#f1f3f5] border-2 border-[#2b2140] text-sm font-black text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#f1f3f5] h-3.5 rounded-full border-2 border-[#2b2140] my-2 overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-[#ffd43b] to-[#51cf66] transition-all duration-500"
            style={{ width: `${progresoPct}%` }}
          />
        </div>

        {/* Achievements Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-2">
          {LOGROS_LISTA.map((logro) => {
            const conseguido = misLogros.has(logro.id);
            return (
              <div
                key={logro.id}
                className={`p-3 rounded-2xl border-2 border-[#2b2140] flex items-center gap-3 transition-all ${
                  conseguido
                    ? 'bg-white shadow-[0_3px_0_#2b2140]'
                    : 'bg-[#f1f3f5]/70 opacity-60 grayscale shadow-none'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-2xl border-2 border-[#2b2140] flex items-center justify-center text-xl flex-shrink-0 ${
                    conseguido ? 'bg-[#ffd43b] shadow-sm' : 'bg-[#dee2e6]'
                  }`}
                >
                  {conseguido ? logro.icono : '🔒'}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-xs sm:text-sm text-[#2b2140] block truncate">
                    {logro.titulo}
                  </span>
                  <span className="text-[11px] text-[#86542d] font-medium block leading-tight">
                    {logro.descripcion}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t-2 border-[#2b2140]/15">
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-full py-2.5 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 4. RANKING MODAL (PROTECTED - NO DESTRUCTIVE RESET)
// =========================================================================
interface RankingModalProps {
  onCerrar: () => void;
}

type TabType = 'global' | '2p' | '4p' | 'semana';

interface DisplayRankEntry {
  nombre: string;
  puntosTotales: number;
  partidas: number;
  victorias: number;
  elo: number;
  avatarColor: string;
  avatarHat: RankEntry['avatarHat'];
}

export const RankingModal: React.FC<RankingModalProps> = ({ onCerrar }) => {
  const [tab, setTab] = useState<TabType>('global');
  const [rankingData, setRankingData] = useState<Record<string, RankEntry>>(() => cargarRanking());
  const [historial, setHistorial] = useState(() => cargarHistorial());
  const [mensajeToast, setMensajeToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setMensajeToast(msg);
    setTimeout(() => setMensajeToast(null), 3000);
  };

  const entries: DisplayRankEntry[] = useMemo(() => {
    if (tab === 'global') {
      const list = Object.values(rankingData).map((r) => ({
        nombre: r.nombre,
        puntosTotales: r.puntosTotales,
        partidas: r.partidas,
        victorias: r.victorias,
        elo: r.elo || 1000,
        avatarColor: r.avatarColor || '#ff6b6b',
        avatarHat: r.avatarHat || 'corona',
      }));

      list.sort((a, b) => {
        if (b.puntosTotales !== a.puntosTotales) return b.puntosTotales - a.puntosTotales;
        if (b.elo !== a.elo) return b.elo - a.elo;
        return b.partidas - a.partidas;
      });
      return list;
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const filteredMatches = historial.filter((m) => {
      if (tab === '2p') return m.numJugadores === 2;
      if (tab === '4p') return m.numJugadores === 4;
      if (tab === 'semana') return new Date(m.fecha).getTime() >= sevenDaysAgo;
      return true;
    });

    const playerAgg = new Map<
      string,
      { puntos: number; partidas: number; victorias: number; color: string }
    >();

    for (const match of filteredMatches) {
      for (const pj of match.puntosPorJugador) {
        if (!pj.esHumano) continue;
        const key = pj.nombre.trim();
        const current = playerAgg.get(key) || {
          puntos: 0,
          partidas: 0,
          victorias: 0,
          color: pj.color,
        };
        current.puntos += pj.puntos;
        current.partidas += 1;
        if (pj.puesto === 1) {
          current.victorias += 1;
        }
        playerAgg.set(key, current);
      }
    }

    const list: DisplayRankEntry[] = [];
    playerAgg.forEach((val, name) => {
      const globalRec = rankingData[name.toLowerCase()];
      list.push({
        nombre: name,
        puntosTotales: val.puntos,
        partidas: val.partidas,
        victorias: val.victorias,
        elo: globalRec?.elo || 1000,
        avatarColor: val.color || '#ff6b6b',
        avatarHat: globalRec?.avatarHat || 'corona',
      });
    });

    list.sort((a, b) => b.puntosTotales - a.puntosTotales);
    return list;
  }, [tab, rankingData, historial]);

  const handleExport = () => {
    sounds.playClick();
    const json = exportarDatosJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muros_locos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Copia de seguridad descargada');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sounds.playClick();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const ok = importarDatosJSON(content);
      if (ok) {
        setRankingData(cargarRanking());
        setHistorial(cargarHistorial());
        showToast('✅ Datos importados correctamente');
      } else {
        showToast('❌ Archivo de respaldo no válido');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-lg bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 sm:p-6 shadow-[0_10px_0_#2b2140,0_20px_30px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#2b2140] leading-none">
                Salón de la Fama
              </h3>
              <span className="text-[11px] font-bold text-[#2b8a3e]">
                🛡️ Ranking Permanente y Seguro
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="w-8 h-8 rounded-full bg-[#f1f3f5] border-2 border-[#2b2140] text-sm font-black text-[#2b2140] hover:bg-[#ffe3e3] hover:text-[#c92a2a] flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Filters */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#ede4d0] rounded-2xl border-2 border-[#2b2140] my-2">
          {[
            { id: 'global', label: 'Global' },
            { id: '2p', label: '2 Jugadores' },
            { id: '4p', label: '4 Jugadores' },
            { id: 'semana', label: 'Semanal' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                sounds.playClick();
                setTab(t.id as TabType);
              }}
              className={`py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                tab === t.id
                  ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-sm'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Ranking List */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 my-2">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-[#86542d] font-bold text-sm bg-white rounded-2xl border-2 border-dashed border-[#2b2140]/30 my-4">
              <span className="text-3xl block mb-2">🏁</span>
              Aún no hay partidas registradas en esta categoría. ¡Juega una partida para inaugurar el ranking!
            </div>
          ) : (
            entries.map((entry, index) => {
              const lvl = obtenerNivelYTitulo(entry.puntosTotales);
              const medal =
                index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
              const winRate =
                entry.partidas > 0 ? Math.round((entry.victorias / entry.partidas) * 100) : 0;

              return (
                <div
                  key={entry.nombre}
                  className={`p-2.5 sm:p-3 rounded-2xl border-2 border-[#2b2140] flex items-center gap-3 transition-all ${
                    index === 0
                      ? 'bg-gradient-to-r from-[#fff9db] to-white shadow-[0_3px_0_#2b2140]'
                      : 'bg-white shadow-sm'
                  }`}
                >
                  <div className="w-8 text-center font-black text-base sm:text-lg text-[#2b2140] flex-shrink-0">
                    {medal}
                  </div>

                  <CartoonCharacter
                    color={entry.avatarColor}
                    hat={entry.avatarHat}
                    size={38}
                    showShadow={false}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs sm:text-sm text-[#2b2140] truncate">
                        {entry.nombre}
                      </span>
                      <span className="text-[10px] bg-[#fff3bf] text-[#8f4b00] font-black px-1.5 py-0.2 rounded border border-[#2b2140]/30 flex items-center gap-0.5">
                        <span>{lvl.icono}</span>
                        <span>{lvl.titulo}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#86542d] font-semibold mt-0.5">
                      <span>Elo: {entry.elo}</span>
                      <span>•</span>
                      <span>
                        {entry.victorias}V / {entry.partidas}P ({winRate}%)
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm sm:text-base font-black text-[#2b2140]">
                      {entry.puntosTotales}{' '}
                      <span className="text-[10px] font-normal text-[#86542d]">pts</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Actions: Export / Import Backup only */}
        <div className="pt-3 mt-2 border-t-2 border-[#2b2140]/15 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="py-1.5 px-3 rounded-xl font-bold bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#f1f3f5] active:translate-y-0.5 cursor-pointer flex items-center gap-1"
            >
              📥 Guardar Respaldo
            </button>

            <label className="py-1.5 px-3 rounded-xl font-bold bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#f1f3f5] active:translate-y-0.5 cursor-pointer flex items-center gap-1">
              📤 Cargar Respaldo
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className="py-1.5 px-4 rounded-xl font-black bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        {mensajeToast && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#2b2140] text-white text-xs font-bold py-1.5 px-4 rounded-full shadow-lg border border-white/20 animate-[slideUp_0.2s_ease-out]">
            {mensajeToast}
          </div>
        )}
      </div>
    </div>
  );
};

/// =========================================================================
// 5. TORNEO MODAL
// =========================================================================
interface TorneoModalProps {
  estado: GameState;
  torneo: TorneoState;
  onSiguienteRonda: () => void;
  onFinalizarTorneo: () => void;
  onVerTablero: () => void;
}

export const TorneoModal: React.FC<TorneoModalProps> = ({
  estado,
  torneo,
  onSiguienteRonda,
  onFinalizarTorneo,
  onVerTablero,
}) => {
  const esFinal = torneo.terminado || torneo.rondaActual >= torneo.totalRondas;

  const standings = [...estado.jugadores].sort((a, b) => {
    const ptsA = torneo.puntosAcumulados[a.id] || 0;
    const ptsB = torneo.puntosAcumulados[b.id] || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    const vicA = torneo.victoriasAcumuladas[a.id] || 0;
    const vicB = torneo.victoriasAcumuladas[b.id] || 0;
    return vicB - vicA;
  });

  const granCampeon = standings[0];
  const ganadorRonda =
    estado.ganador !== null && estado.ganador >= 0
      ? estado.jugadores[estado.ganador]
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-md bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 sm:p-6 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col text-center max-h-[92vh]">
        <div className="text-4xl mb-1">{esFinal ? '👑' : '🏁'}</div>

        <h3 className="text-xl sm:text-2xl font-black text-[#2b2140] mb-0.5">
          {esFinal
            ? '¡Gran Final del Torneo!'
            : `Torneo: Ronda ${torneo.rondaActual} de ${torneo.totalRondas}`}
        </h3>

        <p className="text-xs text-[#593922] font-semibold mb-3">
          {esFinal
            ? `¡${granCampeon.nombre} se corona como campeón absoluto!`
            : ganadorRonda
            ? `¡${ganadorRonda.nombre} ha ganado la ronda ${torneo.rondaActual}!`
            : `Ronda finalizada.`}
        </p>

        {/* Clasificación de la tabla */}
        <div className="bg-white rounded-2xl border-2 border-[#2b2140] p-3 shadow-inner my-2 flex flex-col gap-2 max-h-56 overflow-y-auto">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#593922] text-left block">
            Tabla de Puntuación Acumulada
          </span>
          {standings.map((p, idx) => {
            const pts = torneo.puntosAcumulados[p.id] || 0;
            const vic = torneo.victoriasAcumuladas[p.id] || 0;
            return (
              <div
                key={p.id}
                className={`p-2 rounded-xl border-2 border-[#2b2140] flex items-center justify-between gap-2 ${
                  idx === 0 ? 'bg-[#fff9db] font-extrabold' : 'bg-[#f8f9fa]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-black w-5">{idx === 0 ? '🥇' : `${idx + 1}º`}</span>
                  <CartoonCharacter color={p.color} hat={p.hat} size={30} showShadow={false} />
                  <span className="text-xs font-bold text-[#2b2140] truncate">{p.nombre}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-black text-[#2b2140] block">{pts} pts</span>
                  <span className="text-[10px] text-[#86542d] font-semibold block">{vic} vic</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 mt-2 border-t-2 border-[#2b2140]/15 flex flex-col gap-2">
          {!esFinal ? (
            <button
              onClick={() => {
                sounds.playClick();
                onSiguienteRonda();
              }}
              className="w-full py-3 rounded-2xl font-black text-sm sm:text-base bg-[#51cf66] text-[#134e20] border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] hover:bg-[#40c057] active:translate-y-1 cursor-pointer"
            >
              ▶ Siguiente Ronda ({torneo.rondaActual + 1} de {torneo.totalRondas})
            </button>
          ) : (
            <button
              onClick={() => {
                sounds.playClick();
                onFinalizarTorneo();
              }}
              className="w-full py-3 rounded-2xl font-black text-sm sm:text-base bg-[#ffd43b] text-[#5c3c00] border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] hover:bg-[#fcc419] active:translate-y-1 cursor-pointer"
            >
              🏆 Concluir Torneo y Volver al Menú
            </button>
          )}

          <button
            onClick={() => {
              sounds.playClick();
              onVerTablero();
            }}
            className="w-full py-2 rounded-xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#f8f9fa] active:translate-y-0.5 cursor-pointer"
          >
            👀 Ver Tablero
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 6. VICTORY MODAL
// =========================================================================
interface VictoryModalProps {
  estado: GameState;
  desgloses: Map<number, ScoreBreakdown>;
  nuevosLogros: Map<string, AchievementDef[]>;
  subidasNivel: Map<string, { anterior: LevelInfo; nuevo: LevelInfo }>;
  onRevancha: () => void;
  onVerTablero: () => void;
  onIrAlMenu: () => void;
  onVerRanking: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  estado,
  desgloses,
  nuevosLogros,
  subidasNivel,
  onRevancha,
  onVerTablero,
  onIrAlMenu,
  onVerRanking,
}) => {
  const ganador =
    estado.ganador !== null && estado.ganador >= 0
      ? estado.jugadores[estado.ganador]
      : estado.jugadores[0];

  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(ganador.id);

  const jugadorSeleccionado =
    estado.jugadores.find((p) => p.id === selectedPlayerId) || ganador;
  const jugadorDesglose = desgloses.get(selectedPlayerId) || {
    resultado: 100,
    ahorrador: 0,
    rapidez: 0,
    saltador: 0,
    muroMaestro: 0,
    remontada: 0,
    racha: 0,
    partidaLimpia: 0,
    penalizaciones: {
      pistas: 0,
      deshacer: 0,
      murosInvalidos: 0,
      tiempoAgotado: 0,
      abandonar: 0,
      total: 0,
    },
    multiplicador: 1,
    total: 100,
  };

  const misNuevosLogros = nuevosLogros.get(jugadorSeleccionado.nombre.trim().toLowerCase()) || [];
  const miSubidaNivel = subidasNivel.get(jugadorSeleccionado.nombre.trim().toLowerCase());

  React.useEffect(() => {
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-sm bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col text-center max-h-[92vh] overflow-y-auto">
        <div className="text-4xl mb-1 animate-bounce">🏆</div>

        <h3 className="text-2xl font-black text-[#2b2140] mb-0.5">¡Partida Finalizada!</h3>
        <p className="text-xs text-[#593922] font-semibold mb-2">
          ¡<strong className="text-[#2b2140]">{ganador.nombre}</strong> ha ganado la carrera!
        </p>

        {/* Player selector pills for breakdown if multiple players */}
        <div className="flex items-center justify-center gap-1.5 mb-2 overflow-x-auto p-1 bg-[#ede4d0] rounded-xl border-2 border-[#2b2140]">
          {estado.jugadores.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                sounds.playClick();
                setSelectedPlayerId(p.id);
              }}
              className={`py-1 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                selectedPlayerId === p.id
                  ? 'bg-white text-[#2b2140] border border-[#2b2140] shadow-sm'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              <span>{p.id === ganador.id ? '👑' : '👤'}</span>
              <span>{p.nombre}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-center my-1">
          <CartoonCharacter color={jugadorSeleccionado.color} hat={jugadorSeleccionado.hat} size={60} />
        </div>

        {/* Desglose de puntos */}
        <div className="bg-white rounded-2xl border-2 border-[#2b2140] p-3 shadow-inner my-2 text-xs flex flex-col gap-1 text-left">
          <span className="text-[10px] font-black uppercase text-[#86542d] mb-0.5 block">
            Puntuación de {jugadorSeleccionado.nombre}
          </span>
          <div className="flex justify-between text-[#86542d] font-semibold">
            <span>Resultado base:</span>
            <span className="font-mono-num font-bold">+{jugadorDesglose.resultado}</span>
          </div>
          {jugadorDesglose.ahorrador > 0 && (
            <div className="flex justify-between text-[#86542d] font-semibold">
              <span>Muros guardados:</span>
              <span className="font-mono-num font-bold">+{jugadorDesglose.ahorrador}</span>
            </div>
          )}
          {jugadorDesglose.racha > 0 && (
            <div className="flex justify-between text-[#d9480f] font-bold">
              <span>🔥 Bono de racha:</span>
              <span className="font-mono-num">+{jugadorDesglose.racha}</span>
            </div>
          )}
          {jugadorDesglose.saltador > 0 && (
            <div className="flex justify-between text-[#86542d] font-semibold">
              <span>Saltos sobre rivales:</span>
              <span className="font-mono-num font-bold">+{jugadorDesglose.saltador}</span>
            </div>
          )}
          {jugadorDesglose.penalizaciones.total > 0 && (
            <div className="flex justify-between text-[#c92a2a] font-semibold">
              <span>Penalizaciones:</span>
              <span className="font-mono-num">-{jugadorDesglose.penalizaciones.total}</span>
            </div>
          )}
          <div className="pt-1.5 mt-1 border-t-2 border-[#2b2140]/10 flex justify-between font-black text-sm text-[#2b2140]">
            <span>Total obtenido:</span>
            <span className="font-mono-num text-[#2b8a3e]">+{jugadorDesglose.total} pts</span>
          </div>
        </div>


        {miSubidaNivel && (
          <div className="p-2 bg-[#d3f9d8] rounded-xl border-2 border-[#2b2140] text-xs font-black text-[#134e20] mb-2 flex items-center justify-center gap-1.5 animate-pulse">
            <span>🌟</span> ¡Subiste a Nivel {miSubidaNivel.nuevo.nivel}: {miSubidaNivel.nuevo.titulo}!
          </div>
        )}

        {misNuevosLogros.length > 0 && (
          <div className="p-2 bg-[#fff3bf] rounded-xl border-2 border-[#2b2140] text-xs font-black text-[#8f4b00] mb-2 flex items-center justify-center gap-1.5">
            <span>🎖️</span> ¡Nuevo logro desbloqueado: {misNuevosLogros[0].titulo}!
          </div>
        )}

        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={() => {
              sounds.playClick();
              onRevancha();
            }}
            className="w-full py-2.5 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
          >
            🔄 Jugar Revancha
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                sounds.playClick();
                onVerTablero();
              }}
              className="py-2 rounded-xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#f8f9fa] active:translate-y-0.5 cursor-pointer"
            >
              👀 Ver Tablero
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                onVerRanking();
              }}
              className="py-2 rounded-xl font-bold text-xs bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#fcc419] active:translate-y-0.5 cursor-pointer"
            >
              🏆 Ver Ranking
            </button>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onIrAlMenu();
            }}
            className="w-full py-2 rounded-xl font-bold text-xs bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#f1f3f5] active:translate-y-0.5 cursor-pointer"
          >
            🏠 Volver al Menú
          </button>
        </div>
      </div>
    </div>
  );
};


// =========================================================================
// 7. ONLINE DISCONNECT MODAL (10 SECONDS GRACE PERIOD & ABANDONMENT VICTORY)
// =========================================================================
interface OnlineDisconnectModalProps {
  segundosRestantes: number;
  esAnfitrion: boolean;
  onVolverAlMenu: () => void;
}

export const OnlineDisconnectModal: React.FC<OnlineDisconnectModalProps> = ({
  segundosRestantes,
  esAnfitrion,
  onVolverAlMenu,
}) => {
  const tiempoTerminado = segundosRestantes <= 0;
  const progresoPct = Math.max(0, Math.min(100, (segundosRestantes / 10) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-sm bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col text-center">
        <div className="text-4xl mb-2 animate-bounce">
          {tiempoTerminado ? '🏆' : '⏳'}
        </div>

        <h3 className="text-xl font-black text-[#2b2140] mb-1">
          {tiempoTerminado
            ? '¡Victoria por abandono!'
            : '⚠️ Esperando reconexión del rival...'}
        </h3>

        <p className="text-xs text-[#593922] mb-3 leading-relaxed">
          {tiempoTerminado
            ? 'El rival no ha regresado en 10 segundos. Has ganado la partida automáticamente (+100 pts).'
            : 'Un jugador se ha desconectado o cerrado la pestaña. Tiene 10 segundos para volver o perderá la partida por abandono.'}
        </p>

        {!tiempoTerminado && (
          <div className="mb-4">
            <div className="text-3xl font-black text-[#c92a2a] font-mono-num animate-pulse">
              {segundosRestantes}s
            </div>
            <div className="w-full bg-[#f1f3f5] h-3.5 rounded-full border-2 border-[#2b2140] mt-2 overflow-hidden">
              <div
                className="h-full bg-[#ff922b] transition-all duration-1000 ease-linear"
                style={{ width: `${progresoPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-2">
          {tiempoTerminado ? (
            <button
              onClick={onVolverAlMenu}
              className="w-full py-2.5 px-4 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
            >
              🎉 Reclamar Victoria y Volver al Menú
            </button>
          ) : (
            <button
              onClick={onVolverAlMenu}
              className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-white text-[#c92a2a] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#ffe3e3] active:translate-y-0.5 cursor-pointer"
            >
              Salir al Menú ahora
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 8. PERFIL Y CUENTA DE USUARIO MODAL
// =========================================================================
interface PerfilModalProps {
  usuarioActual: UserAccount | null;
  onLoginSuccess: (usuario: UserAccount) => void;
  onLogout: () => void;
  onAbrirAdmin: () => void;
  onCerrar: () => void;
}

export const PerfilModal: React.FC<PerfilModalProps> = ({
  usuarioActual,
  onLoginSuccess,
  onLogout,
  onAbrirAdmin,
  onCerrar,
}) => {
  const [tab, setTab] = useState<'login' | 'registro'>('login');
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('');
  const [color, setColor] = useState('#ff6b6b');
  const [hat, setHat] = useState<HatType>('corona');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    setErrorMsg(null);
    const res = iniciarSesion(nombre, clave);
    if (res.ok && res.user) {
      onLoginSuccess(res.user);
      onCerrar();
    } else {
      sounds.playError();
      setErrorMsg(res.error || 'Credenciales inválidas');
    }
  };

  const handleRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    setErrorMsg(null);
    const res = registrarUsuario(nombre, clave, color, hat);
    if (res.ok && res.user) {
      onLoginSuccess(res.user);
      onCerrar();
    } else {
      sounds.playError();
      setErrorMsg(res.error || 'No se pudo crear la cuenta');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-sm bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <h3 className="text-xl font-black text-[#2b2140] flex items-center gap-2">
            <span>👤</span> {usuarioActual ? 'Mi Perfil' : 'Perfil y Cuenta'}
          </h3>
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

        {/* If logged in: Show User Dashboard */}
        {usuarioActual ? (
          <div className="flex flex-col gap-3 py-1">
            <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm">
              <CartoonCharacter
                color={usuarioActual.avatarColor}
                hat={usuarioActual.avatarHat}
                size={54}
                showShadow={false}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base text-[#2b2140] truncate">
                    {usuarioActual.nombre}
                  </span>
                  {usuarioActual.rol === 'admin' && (
                    <span className="text-[9px] bg-[#ffd43b] text-[#5c3c00] font-black px-1.5 py-0.5 rounded border border-[#2b2140]">
                      👑 ADMIN
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-[#86542d] block">
                  {obtenerNivelYTitulo(usuarioActual.puntos).titulo}
                </span>
                <span className="text-xs font-black text-[#2b8a3e] block">
                  {usuarioActual.puntos} puntos acumulados
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 bg-white rounded-xl border-2 border-[#2b2140]">
                <span className="text-[11px] font-bold text-[#86542d] block">Victorias</span>
                <span className="text-lg font-black text-[#2b2140]">
                  {usuarioActual.victorias} / {usuarioActual.partidas}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border-2 border-[#2b2140]">
                <span className="text-[11px] font-bold text-[#86542d] block">Puntos Elo</span>
                <span className="text-lg font-black text-[#2b2140]">{usuarioActual.elo}</span>
              </div>
            </div>

            {usuarioActual.rol === 'admin' && (
              <button
                onClick={() => {
                  sounds.playClick();
                  onAbrirAdmin();
                }}
                className="w-full py-2.5 rounded-xl font-black text-xs bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>⚙️</span>
                <span>Panel de Administración Secreto</span>
              </button>
            )}

            <button
              onClick={() => {
                sounds.playClick();
                cerrarSesion();
                onLogout();
                onCerrar();
              }}
              className="w-full py-2 rounded-xl font-bold text-xs bg-white text-[#c92a2a] border-2 border-[#2b2140] hover:bg-[#ffe3e3] cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        ) : (
          /* If not logged in: Login or Register */
          <div className="flex flex-col gap-3 py-1">
            <div className="grid grid-cols-2 p-1 bg-[#ede4d0] rounded-xl border-2 border-[#2b2140]">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setTab('login');
                  setErrorMsg(null);
                }}
                className={`py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-white text-[#2b2140] border border-[#2b2140] shadow-sm'
                    : 'text-[#86542d]'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setTab('registro');
                  setErrorMsg(null);
                }}
                className={`py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                  tab === 'registro'
                    ? 'bg-[#51cf66] text-[#134e20] border border-[#2b2140] shadow-sm'
                    : 'text-[#86542d]'
                }`}
              >
                Crear Perfil
              </button>
            </div>

            <form onSubmit={tab === 'login' ? handleLogin : handleRegistro} className="flex flex-col gap-2.5">
              <div>
                <label className="text-xs font-bold text-[#86542d] block mb-0.5">Nombre de usuario:</label>
                <input
                  type="text"
                  maxLength={14}
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full text-xs font-bold text-[#2b2140] bg-white border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#ffd43b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#86542d] block mb-0.5">Clave / Contraseña:</label>
                <input
                  type="password"
                  required
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs font-bold text-[#2b2140] bg-white border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#ffd43b]"
                />
              </div>

              {tab === 'registro' && (
                <div>
                  <label className="text-xs font-bold text-[#86542d] block mb-1">Color y Sombrero:</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'corona', icon: '👑', color: '#ff6b6b' },
                      { id: 'pompon', icon: '❄️', color: '#4dabf7' },
                      { id: 'antena', icon: '⚡', color: '#ffd43b' },
                      { id: 'brote', icon: '🌱', color: '#51cf66' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setHat(item.id as HatType);
                          setColor(item.color);
                        }}
                        className={`py-1 rounded-xl text-base border-2 border-[#2b2140] cursor-pointer ${
                          hat === item.id ? 'bg-[#ffd43b] shadow-sm' : 'bg-white'
                        }`}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-2 bg-[#ffe3e3] text-[#c92a2a] text-xs font-bold rounded-xl border border-[#2b2140] text-center">
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer mt-1"
              >
                {tab === 'login' ? 'Entrar a mi Cuenta' : 'Registrar y Guardar'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// 9. PANEL DE ADMINISTRADOR SECRETO MODAL
// =========================================================================
interface AdminPanelModalProps {
  onCerrar: () => void;
  onShowToast: (msg: string) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ onCerrar, onShowToast }) => {
  const [autenticado, setAutenticado] = useState(false);
  const [claveInput, setClaveInput] = useState('');
  const [cuentas, setCuentas] = useState<Record<string, UserAccount>>(() => cargarCuentas());
  const [filtro, setFiltro] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Edit fields
  const [editNombre, setEditNombre] = useState('');
  const [editClave, setEditClave] = useState('');
  const [editPuntos, setEditPuntos] = useState<number>(0);
  const [editVictorias, setEditVictorias] = useState<number>(0);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    const adminAcc = cuentas['admin'];
    if (adminAcc && claveInput.trim() === adminAcc.clave) {
      setAutenticado(true);
      onShowToast('👑 Modo Administrador concedido');
    } else {
      sounds.playError();
      onShowToast('❌ Clave de administrador incorrecta');
    }
  };

  const iniciarEdicion = (acc: UserAccount) => {
    sounds.playClick();
    setEditandoId(acc.id);
    setEditNombre(acc.nombre);
    setEditClave(acc.clave);
    setEditPuntos(acc.puntos);
    setEditVictorias(acc.victorias);
  };

  const guardarEdicion = (id: string) => {
    sounds.playClick();
    adminActualizarUsuario(id, {
      nombre: editNombre,
      clave: editClave,
      puntos: editPuntos,
      victorias: editVictorias,
    });
    setCuentas(cargarCuentas());
    setEditandoId(null);
    onShowToast(`✅ Perfil ${editNombre} actualizado`);
  };

  const handleEliminar = (id: string, nombre: string) => {
    sounds.playClick();
    if (window.confirm(`¿Seguro que deseas eliminar a "${nombre}"?`)) {
      adminEliminarUsuario(id);
      setCuentas(cargarCuentas());
      onShowToast(`🗑️ Perfil "${nombre}" eliminado`);
    }
  };

  const cuentasFiltradas = Object.values(cuentas).filter((acc) =>
    acc.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-lg bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <h3 className="text-xl font-black text-[#2b2140] flex items-center gap-2">
            <span>🛡️</span> Panel de Control y Administración
          </h3>
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

        {!autenticado ? (
          <form onSubmit={handleAdminLogin} className="flex flex-col gap-3 my-4">
            <p className="text-xs text-[#593922] font-semibold leading-relaxed">
              Introduce la clave secreta de administración para gestionar perfiles, modificar ranking y resetear claves:
            </p>
            <input
              type="password"
              required
              value={claveInput}
              onChange={(e) => setClaveInput(e.target.value)}
              placeholder="Clave maestra (por defecto: muros2026)"
              className="w-full text-center text-sm font-black tracking-widest text-[#2b2140] bg-white border-2 border-[#2b2140] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#ffd43b]"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-black text-sm bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer"
            >
              🔓 Desbloquear Panel de Administrador
            </button>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 my-1">
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                placeholder="🔍 Buscar jugador..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full text-xs font-bold bg-white border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none"
              />
              <span className="text-xs font-bold text-[#86542d] whitespace-nowrap">
                {cuentasFiltradas.length} perfiles
              </span>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {cuentasFiltradas.map((acc) => {
                const isEditing = editandoId === acc.id;

                return (
                  <div
                    key={acc.id}
                    className="p-3 rounded-2xl border-2 border-[#2b2140] bg-white shadow-sm flex flex-col gap-2"
                  >
                    {!isEditing ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CartoonCharacter
                            color={acc.avatarColor}
                            hat={acc.avatarHat}
                            size={34}
                            showShadow={false}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs sm:text-sm text-[#2b2140] truncate">
                                {acc.nombre}
                              </span>
                              {acc.rol === 'admin' && (
                                <span className="text-[9px] bg-[#ffd43b] text-[#5c3c00] font-black px-1 rounded border border-[#2b2140]">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#86542d] font-semibold block">
                              Clave: {acc.clave} • {acc.puntos} pts • {acc.victorias} vic
                            </span>
                          </div>
                        </div>

                        {acc.id === 'admin' || acc.rol === 'admin' ? (
                          <span className="text-[10px] font-black bg-[#ffd43b]/50 text-[#5c3c00] px-2.5 py-1 rounded-xl border border-[#2b2140] whitespace-nowrap shadow-sm">
                            👑 Supremo (Intocable)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => iniciarEdicion(acc)}
                              className="p-1.5 rounded-lg border border-[#2b2140] bg-[#fff9db] text-xs hover:bg-[#fff3bf] cursor-pointer"
                              title="Editar clave o datos"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleEliminar(acc.id, acc.nombre)}
                              className="p-1.5 rounded-lg border border-[#2b2140] bg-[#ffe3e3] text-xs hover:bg-[#ffc9c9] cursor-pointer"
                              title="Eliminar usuario"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Formulario de Edición */
                      <div className="flex flex-col gap-2 pt-1 border-t border-[#2b2140]/10">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="font-bold text-[#86542d] block">Nombre:</label>
                            <input
                              type="text"
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-bold"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-[#86542d] block">Clave:</label>
                            <input
                              type="text"
                              value={editClave}
                              onChange={(e) => setEditClave(e.target.value)}
                              className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="font-bold text-[#86542d] block">Puntos Ranking:</label>
                            <input
                              type="number"
                              value={editPuntos}
                              onChange={(e) => setEditPuntos(Number(e.target.value))}
                              className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-bold"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-[#86542d] block">Victorias:</label>
                            <input
                              type="number"
                              value={editVictorias}
                              onChange={(e) => setEditVictorias(Number(e.target.value))}
                              className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-bold"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            onClick={() => setEditandoId(null)}
                            className="px-2.5 py-1 rounded bg-[#f1f3f5] border border-[#2b2140] text-xs font-bold cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => guardarEdicion(acc.id)}
                            className="px-3 py-1 rounded bg-[#51cf66] text-[#134e20] border border-[#2b2140] text-xs font-black cursor-pointer shadow-sm"
                          >
                            Guardar Cambios
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

