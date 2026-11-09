/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modales unificados: AspectoModal, AjustesModal, ComoJugarModal, LogrosModal,
 * RankingModal, TorneoModal, VictoryModal, PerfilModal y AdminPanelModal.
 */

import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../game/murosLocosEngine';
import {
  AchievementDef,
  AppSettings,
  BoardTheme,
  GameState,
  HatType,
  LevelInfo,
  PERSONAJES_REGISTRO,
  RankEntry,
  ScoreBreakdown,
  TorneoState,
  UserAccount,
  WeeklyRankingResponse,
} from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import { PWAInstallButton } from './PWAInstallControl';
import {
  actualizarCuentaAsync,
  adminActualizarUsuarioAsync,
  adminEliminarUsuarioAsync,
  adminResetearRankingAsync,
  borrarRankingLocal,
  cargarCuentas,
  cargarRanking,
  cargarRankingLocal,
  cerrarSesion,
  darDeBajaUsuarioAsync,
  exportarDatosJSON,
  importarDatosJSONAsync,
  iniciarSesionAsync,
  restablecerClaveUsuarioAsync,
  LOGROS_LISTA,
  NetworkDiagnostic,
  obtenerDiagnosticoRed,
  obtenerNivelYTitulo,
  obtenerRankingSemanalAsync,
  pingServidor,
  registrarUsuarioAsync,
  sincronizarConNube,
  suscribirCambiosNube,
  suscribirDiagnostico,
  verificarAccionAdminEnKV,
} from '../game/storage';

export const TEMAS_LISTA: {
  id: BoardTheme;
  label: string;
  desc: string;
  border: string;
  bg: string;
}[] = [
  { id: 'madera', label: '🪵 Madera', desc: 'Clásica de bosque', border: 'border-[#86542d]', bg: 'bg-[#ffec99]' },
  { id: 'neon', label: '⚡ Neón', desc: 'Cyberpunk brillante', border: 'border-[#0c8599]', bg: 'bg-[#c5f6fa]' },
  { id: 'hielo', label: '❄️ Hielo', desc: 'Escarcha ártica', border: 'border-[#1971c2]', bg: 'bg-[#d0ebff]' },
  { id: 'lava', label: '🌋 Lava', desc: 'Magma volcánico', border: 'border-[#c92a2a]', bg: 'bg-[#ffe3e3]' },
];

// =========================================================================
// 0. ASPECTO MODAL (Unificado aquí para reducir archivos)
// =========================================================================
interface AspectoModalProps {
  onCerrar: () => void;
  personajeActual: { hat: HatType; color: string };
  temaActual: BoardTheme;
  usuarioActual?: UserAccount | null;
  onAplicar: (nuevoPersonaje: { hat: HatType; color: string }, nuevoTema: BoardTheme) => void;
  onUsuarioActualizado?: (u: UserAccount) => void;
  onShowToast?: (msg: string) => void;
}

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
  const esAdmin = Boolean(usuarioActual && (usuarioActual.rol === 'admin' || usuarioActual.id === 'admin'));

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
        const freshSaved = await actualizarCuentaAsync(updated);
        onUsuarioActualizado?.(freshSaved);
        onShowToast?.('⭐ Personaje y terreno guardados como predeterminados en tu perfil');
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

  const activeCharDef =
    PERSONAJES_REGISTRO.find((p) => p.id === selectedHat) || PERSONAJES_REGISTRO[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-md bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-4 sm:p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#2b2140] leading-none">
                Aspecto y Terreno
              </h3>
              <span className="text-[11px] font-bold text-[#86542d]">
                {usuarioActual
                  ? `⭐ Tus puntos: ${userPoints}`
                  : '💡 Modo Invitado (Crea perfil para desbloquear más)'}
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

        <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex items-center gap-3 mb-3">
          <CartoonCharacter color={selectedColor} hat={selectedHat} size={54} showShadow={false} />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black text-[#593922] uppercase tracking-wider block">
              Vista Previa Activa
            </span>
            <span className="font-extrabold text-sm text-[#2b2140] flex items-center gap-1.5">
              <span>{activeCharDef.icon}</span>
              <span>{activeCharDef.label}</span>
            </span>
            <span className="text-[11px] font-bold text-[#86542d] block truncate">
              Terreno: {TEMAS_LISTA.find((t) => t.id === selectedTema)?.label}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
              1. Elige tu Personaje
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

        <div className="flex flex-col gap-1.5 mb-3">
          <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
            2. Terreno de la Arena / Tablero
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

        {usuarioActual ? (
          <label className="flex items-center gap-2 p-2 bg-[#e7f5ff] rounded-xl border border-[#2b2140]/30 cursor-pointer mb-3 select-none">
            <input
              type="checkbox"
              checked={guardarEnPerfil}
              onChange={(e) => setGuardarEnPerfil(e.target.checked)}
              className="w-4 h-4 rounded text-[#1971c2] cursor-pointer"
            />
            <span className="text-[11px] font-bold text-[#1864ab] leading-tight">
              ⭐ Guardar como mi personaje y terreno predeterminados en mi Perfil
            </span>
          </label>
        ) : (
          <div className="p-2 bg-[#fff9db] rounded-xl border border-[#2b2140]/20 mb-3 text-[11px] text-[#8f4b00] font-semibold leading-tight">
            💡 <strong>Modo Invitado:</strong> Inicia sesión en Mi Perfil para dejar tu personaje y terreno guardados de forma predeterminada.
          </div>
        )}

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

// =========================================================================
// 1. AJUSTES MODAL
// =========================================================================
interface AjustesModalProps {
  ajustes: AppSettings;
  onGuardar: (nuevosAjustes: AppSettings) => void;
  onCerrar: () => void;
}

export const AjustesModal: React.FC<AjustesModalProps> = ({ ajustes, onGuardar, onCerrar }) => {
  const [localAjustes, setLocalAjustes] = useState<AppSettings>({ ...ajustes });

  const toggle = (key: keyof AppSettings) => {
    sounds.playClick();
    setLocalAjustes((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'sonido') {
        sounds.setEnabled(Boolean(next.sonido));
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
    { key: 'cambiarVistaPorTurno', label: 'Cambiar Vista en Turno Local', desc: 'Cambia al lado del jugador activo sin girar (2+ humanos)', icon: '🔄' },
    { key: 'vistaPropiaOnline', label: 'Mi Lado Abajo en Online', desc: 'Muestra tu ficha abajo de forma fija sin girar', icon: '🧭' },
    { key: 'animacionesReducidas', label: 'Animaciones Reducidas', desc: 'Simplifica transiciones visuales del juego', icon: '⚡' },
    { key: 'mostrarDistancia', label: 'Mostrar Distancia a Meta', desc: 'Indica los pasos mínimos en la tarjeta', icon: '📏' },
    { key: 'permitirDeshacer', label: 'Permitir Deshacer', desc: 'Permite retroceder turnos (-2 pts)', icon: '↩️' },
    { key: 'permitirPistas', label: 'Permitir Pistas', desc: 'Muestra el camino óptimo a la meta (-1 pt)', icon: '💡' },
    { key: 'modoDaltonico', label: 'Modo Alto Contraste / Daltónico', desc: 'Iconos distintivos en las metas', icon: '👁️' },
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
          <PWAInstallButton variant="card" />

          {opciones.map((op) => {
            const activo = Boolean(localAjustes[op.key]);
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
export const ComoJugarModal: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
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
              Sé el primero en llevar tu personaje hasta cualquier casilla del extremo opuesto del tablero.
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <h4 className="font-black text-sm text-[#2b2140] flex items-center gap-1.5 mb-1">
              <span>🎲</span> En tu turno elige UNA acción:
            </h4>
            <ul className="list-disc list-inside space-y-1 pl-1 leading-relaxed">
              <li>
                <strong>Mover tu ficha:</strong> 1 paso ortogonal (arriba, abajo, izquierda, derecha).
              </li>
              <li>
                <strong>Colocar un muro:</strong> Pon un muro de 2 casillas (Horizontal o Vertical) entre intersecciones.
              </li>
            </ul>
          </div>

          <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <h4 className="font-black text-sm text-[#2b2140] flex items-center gap-1.5 mb-1">
              <span>🦘</span> Saltos sobre rivales
            </h4>
            <p className="leading-relaxed">
              Si estás frente a un rival y no hay un muro detrás, puedes saltarlo. Si hay un muro detrás, puedes saltar en diagonal a los lados.
            </p>
          </div>

          <div className="p-3 bg-[#fff3bf] rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <h4 className="font-black text-sm text-[#8f4b00] flex items-center gap-1.5 mb-1">
              <span>⚠️</span> Regla de Oro de los Muros
            </h4>
            <p className="leading-relaxed text-[#744210]">
              <strong>NUNCA</strong> puedes encerrar por completo a un jugador. Siempre debe quedar al menos un camino libre hasta su meta.
            </p>
          </div>

          <div className="p-3 bg-[#d3f9d8] rounded-2xl border-2 border-[#2b2140] shadow-sm">
            <h4 className="font-black text-sm text-[#134e20] flex items-center gap-1.5 mb-1">
              <span>⭐</span> Sistema de Puntos
            </h4>
            <ul className="list-disc list-inside space-y-1 pl-1 leading-relaxed text-[#1b4332]">
              <li>
                <strong>Victoria en partida:</strong> <strong>+5 pts</strong> por ganar.
              </li>
              <li>
                <strong>Uso de muros:</strong> <strong>+1 pt</strong> por cada muro colocado.
              </li>
              <li>
                <strong>¡Por los pelos!:</strong> <strong>+5 pts extra</strong> si ganas cuando un rival estaba a solo <strong>1 cuadro</strong> de su meta.
              </li>
              <li>
                <strong>Torneos:</strong> <strong>+5 pts</strong> por cada ronda ganada (más muros y final ajustado) y <strong>+10 pts adicionales</strong> si ganas el torneo completo.
              </li>
              <li>
                <strong>Penalizaciones:</strong> Pista (<strong>-1 pt</strong>), Deshacer (<strong>-2 pts</strong>), Tiempo agotado (<strong>-1 pt</strong>) y Abandonar (<strong>-5 pts</strong>).
              </li>
            </ul>
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
export const LogrosModal: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
  const ranking = useMemo(() => cargarRanking(), []);
  const rankingLocal = useMemo(() => cargarRankingLocal(), []);

  const misLogros = useMemo(() => {
    const set = new Set<string>();
    [...Object.values(ranking), ...Object.values(rankingLocal)].forEach((entry) => {
      if (entry.logros && Array.isArray(entry.logros)) {
        entry.logros.forEach((l) => set.add(l));
      }
    });
    return set;
  }, [ranking, rankingLocal]);

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

        <div className="w-full bg-[#f1f3f5] h-3.5 rounded-full border-2 border-[#2b2140] my-2 overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-[#ffd43b] to-[#51cf66] transition-all duration-500"
            style={{ width: `${progresoPct}%` }}
          />
        </div>

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
// 4. RANKING MODAL
// =========================================================================
interface RankingModalProps {
  onCerrar: () => void;
  usuarioActual?: UserAccount | null;
  onAbrirPerfil?: () => void;
}

type TabType = 'local' | 'global' | 'esta_semana' | 'semana_pasada';

interface DisplayRankEntry {
  nombre: string;
  puntosTotales: number;
  partidas: number;
  victorias: number;
  elo: number;
  avatarColor: string;
  avatarHat: RankEntry['avatarHat'];
}

export const RankingModal: React.FC<RankingModalProps> = ({
  onCerrar,
  usuarioActual,
  onAbrirPerfil,
}) => {
  // Orden solicitado: Local siempre primero, luego Global, Esta Semana y Sem. Pasada
  const [tab, setTab] = useState<TabType>('local');
  const [rankingData, setRankingData] = useState<Record<string, RankEntry>>(() => cargarRanking());
  const [localRankingData, setLocalRankingData] = useState<Record<string, RankEntry>>(() =>
    cargarRankingLocal()
  );
  const [semanalData, setSemanalData] = useState<WeeklyRankingResponse | null>(null);
  const [mensajeToast, setMensajeToast] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmandoBorrarLocal, setConfirmandoBorrarLocal] = useState(false);
  const [diag, setDiag] = useState<NetworkDiagnostic>(() => obtenerDiagnosticoRed());

  useEffect(() => {
    return suscribirDiagnostico(setDiag);
  }, []);

  const showToast = (msg: string) => {
    setMensajeToast(msg);
    setTimeout(() => setMensajeToast(null), 3000);
  };

  const entries: DisplayRankEntry[] = useMemo(() => {
    if (tab === 'local') {
      const list = Object.values(localRankingData)
        .filter((r) => r.partidas > 0)
        .map((r) => ({
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

    if (tab === 'global') {
      const list = Object.values(rankingData)
        .filter((r) => r.partidas > 0 || r.puntosTotales > 0)
        .map((r) => ({
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

    const board = tab === 'esta_semana' ? semanalData?.actual : semanalData?.pasada;
    if (!board || !board.jugadores) return [];

    const list: DisplayRankEntry[] = Object.values(board.jugadores)
      .filter((p) => p && p.partidas > 0)
      .map((p) => ({
        nombre: p.nombre,
        puntosTotales: p.puntos,
        partidas: p.partidas,
        victorias: p.victorias,
        elo: p.elo || 1000,
        avatarColor: p.avatarColor || '#ff6b6b',
        avatarHat: p.avatarHat || 'corona',
      }));

    list.sort((a, b) => {
      if (b.puntosTotales !== a.puntosTotales) return b.puntosTotales - a.puntosTotales;
      if (b.victorias !== a.victorias) return b.victorias - a.victorias;
      return b.partidas - a.partidas;
    });
    return list;
  }, [tab, rankingData, localRankingData, semanalData]);

  const refrescarRanking = async (forzar: boolean = false) => {
    setSincronizando(true);
    try {
      const [res, sem] = await Promise.all([
        sincronizarConNube(forzar),
        obtenerRankingSemanalAsync(),
      ]);
      setRankingData(cargarRanking());
      setLocalRankingData(cargarRankingLocal());
      setSemanalData(sem);
      if (forzar) {
        showToast(res.kvConectado ? '🔄 Sincronizado con Cloudflare KV' : '⚠️ Sin conexión al KV');
      }
    } catch {
      showToast('⚠️ No se pudo sincronizar con el KV');
    } finally {
      setSincronizando(false);
    }
  };

  useEffect(() => {
    refrescarRanking(false);
  }, []);

  const textoCuentaAtrasSemana = useMemo(() => {
    const ms = semanalData?.cierraEnMs ?? 0;
    if (ms <= 0) return 'Cerrando semana...';
    const dias = Math.floor(ms / 86400000);
    const horas = Math.floor((ms % 86400000) / 3600000);
    return dias > 0 ? `${dias}d ${horas}h restantes` : `${horas}h restantes`;
  }, [semanalData?.cierraEnMs]);

  const bonosSemanal = [25, 15, 10];

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
                {tab === 'local'
                  ? '📍 Ranking Local en este Dispositivo'
                  : '🌍 Clasificación en Cloudflare KV'}
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

        {/* KV Disconnected Warning inside Ranking */}
        {diag.checkedOnce && !diag.kvConnected && tab !== 'local' && (
          <div className="p-2.5 bg-[#ffe3e3] rounded-2xl border-2 border-[#c92a2a] mb-2 text-[11px] font-bold text-[#c92a2a] flex items-center justify-between gap-2">
            <span>⚠️ Sin conexión al KV: mostrando últimos datos guardados localmente.</span>
            <button
              type="button"
              onClick={() => refrescarRanking(true)}
              className="py-1 px-2 rounded-lg bg-white border border-[#c92a2a] text-[10px] font-black cursor-pointer shrink-0"
            >
              🔄 Reintentar
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-1 p-1 bg-[#ede4d0] rounded-2xl border-2 border-[#2b2140] my-2">
          {[
            { id: 'local', label: '📍 Local' },
            { id: 'global', label: '🌍 Global' },
            { id: 'esta_semana', label: '📅 Esta Semana' },
            { id: 'semana_pasada', label: '⏮️ Sem. Pasada' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                sounds.playClick();
                setTab(t.id as TabType);
              }}
              className={`py-1.5 px-1 rounded-xl font-black text-[10px] sm:text-xs transition-all cursor-pointer truncate ${
                tab === t.id
                  ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-sm'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'esta_semana' && (
          <div className="p-2.5 bg-[#fff3bf] rounded-2xl border-2 border-[#2b2140] mb-2 flex flex-col gap-1 shadow-sm text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black text-[#8f4b00]">
                👑 ¡Quien termine encima gana puntos extra!
              </span>
              <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded-full border border-[#2b2140] text-[#2b2140] shrink-0">
                ⏳ {textoCuentaAtrasSemana}
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#5c3c00]">
              Recompensas al cierre semanal: 🥇 +25 pts · 🥈 +15 pts · 🥉 +10 pts
            </span>
          </div>
        )}

        {tab === 'semana_pasada' && semanalData?.pasada?.premiados && semanalData.pasada.premiados.length > 0 && (
          <div className="p-2.5 bg-[#d3f9d8] rounded-2xl border-2 border-[#2b2140] mb-2 text-[11px] font-black text-[#134e20]">
            🏆 Premios entregados:{' '}
            {semanalData.pasada.premiados
              .map((p) => `${p.puesto}º ${p.nombre} (+${p.bono} pts)`)
              .join(' · ')}
          </div>
        )}

        {!usuarioActual && tab !== 'local' && (
          <div className="p-2.5 bg-[#fff3bf] rounded-2xl border-2 border-[#2b2140] mb-2 flex items-center justify-between gap-2 shadow-sm text-xs">
            <div className="text-[11px] font-bold text-[#8f4b00] leading-tight">
              Juegas como <strong>Invitado</strong>. Inicia sesión para competir en Global y Esta Semana.
            </div>
            {onAbrirPerfil && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onAbrirPerfil();
                }}
                className="py-1 px-2.5 rounded-xl bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] font-black text-xs shrink-0 shadow-sm hover:bg-[#fcc419] cursor-pointer"
              >
                👤 Entrar
              </button>
            )}
          </div>
        )}

        {tab === 'local' && (
          <div className="p-2.5 bg-[#e7f5ff] rounded-2xl border-2 border-[#2b2140] mb-2 flex flex-col gap-2 shadow-sm text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#1864ab]">
                Récords guardados únicamente en este dispositivo.
              </span>
              {!confirmandoBorrarLocal && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setConfirmandoBorrarLocal(true);
                  }}
                  className="py-1 px-2.5 rounded-xl bg-[#ffe3e3] text-[#c92a2a] border border-[#ff8787] font-black text-[11px] hover:bg-[#ffc9c9] cursor-pointer shrink-0"
                >
                  🗑️ Borrar Local
                </button>
              )}
            </div>
            {confirmandoBorrarLocal && (
              <div className="p-2 bg-white rounded-xl border border-[#c92a2a] flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-[#c92a2a]">
                  ¿Confirmas borrar tu ranking local?
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmandoBorrarLocal(false)}
                    className="py-1 px-2 rounded-lg bg-[#f1f3f5] text-[#495057] font-bold text-[11px] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      borrarRankingLocal();
                      setLocalRankingData({});
                      setConfirmandoBorrarLocal(false);
                      showToast('🧹 Ranking local borrado');
                    }}
                    className="py-1 px-2.5 rounded-lg bg-[#c92a2a] text-white font-black text-[11px] cursor-pointer"
                  >
                    Sí, borrar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 my-1">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-[#86542d] font-bold text-sm bg-white rounded-2xl border-2 border-dashed border-[#2b2140]/30 my-4">
              <span className="text-3xl block mb-2">🏁</span>
              Aún no hay partidas registradas en esta categoría.
            </div>
          ) : (
            entries.map((entry, index) => {
              const lvl = obtenerNivelYTitulo(entry.puntosTotales);
              const medal =
                index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
              const winRate =
                entry.partidas > 0 ? Math.round((entry.victorias / entry.partidas) * 100) : 0;
              const bonoProyectado = tab === 'esta_semana' ? bonosSemanal[index] || 0 : 0;

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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-[#2b2140] truncate">
                        {entry.nombre}
                      </span>
                      <span className="text-[10px] text-[#8f4b00] font-bold">
                        · {lvl.icono} {lvl.titulo}
                      </span>
                      {bonoProyectado > 0 && (
                        <span className="text-[9px] bg-[#51cf66] text-[#134e20] font-black px-1.5 py-0.5 rounded border border-[#2b2140]">
                          +{bonoProyectado} pts premio
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#86542d] font-semibold mt-0.5">
                      <span>Elo: {entry.elo}</span>
                      <span>·</span>
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

        <div className="pt-3 mt-2 border-t-2 border-[#2b2140]/15 flex items-center justify-between gap-2 text-xs">
          <button
            onClick={() => {
              sounds.playClick();
              refrescarRanking(true);
            }}
            disabled={sincronizando}
            className="py-1.5 px-3.5 rounded-xl font-black bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#fff9db] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={sincronizando ? 'animate-spin' : ''}>🔄</span>
            <span>{sincronizando ? 'Sincronizando...' : 'Actualizar KV'}</span>
          </button>

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

// =========================================================================
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
  const esFinal = torneo.terminado;
  const ultimaRonda =
    torneo.historialRondas.length > 0
      ? torneo.historialRondas[torneo.historialRondas.length - 1]
      : null;

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
    estado.ganador !== null && estado.ganador >= 0 ? estado.jugadores[estado.ganador] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-md bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 sm:p-6 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col text-center max-h-[92vh]">
        <div className="text-4xl mb-1">{esFinal ? '👑' : '🏁'}</div>

        <h3 className="text-xl sm:text-2xl font-black text-[#2b2140] mb-0.5">
          {esFinal
            ? '¡Gran Final del Torneo!'
            : `Torneo: Ronda ${torneo.rondaActual} de ${torneo.totalRondas}`}
        </h3>

        <p className="text-xs text-[#593922] font-semibold mb-2">
          {esFinal
            ? `¡${granCampeon.nombre} gana el torneo y recibe +10 pts extra de campeón!`
            : ganadorRonda
            ? `¡${ganadorRonda.nombre} ganó la ronda ${torneo.rondaActual}! (+5 pts victoria + muros)`
            : 'Ronda finalizada.'}
        </p>

        {esFinal && (
          <div className="p-2 mb-2 rounded-xl bg-[#d3f9d8] border-2 border-[#2b2140] text-xs font-black text-[#134e20]">
            🏆 Bono Campeón del Torneo: +10 pts sumados al total de {granCampeon.nombre}
          </div>
        )}

        <div className="bg-white rounded-2xl border-2 border-[#2b2140] p-3 shadow-inner my-2 flex flex-col gap-2 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#593922]">
            <span>Tabla Acumulada</span>
            <span>Victoria +5 · Muro +1 · Campeón +10</span>
          </div>
          {standings.map((p, idx) => {
            const pts = torneo.puntosAcumulados[p.id] || 0;
            const vic = torneo.victoriasAcumuladas[p.id] || 0;
            const ptsEstaRonda = ultimaRonda?.puntosRonda?.[p.id] ?? 0;
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
                  <div className="text-left min-w-0">
                    <span className="text-xs font-bold text-[#2b2140] block truncate">{p.nombre}</span>
                    <span className="text-[10px] text-[#2b8a3e] font-bold block">
                      Ronda {torneo.rondaActual}: +{ptsEstaRonda} pts
                    </span>
                  </div>
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
  estadoRevanchaOnline?: 'idle' | 'esperando' | 'recibida' | 'no_disponible';
  solicitanteRevancha?: string | null;
  mensajeRevanchaNoDisponible?: string | null;
  onAceptarRevancha?: () => void;
  onRechazarRevancha?: () => void;
  onCancelarEsperaRevancha?: () => void;
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
  estadoRevanchaOnline = 'idle',
  solicitanteRevancha = null,
  mensajeRevanchaNoDisponible = null,
  onAceptarRevancha,
  onRechazarRevancha,
  onCancelarEsperaRevancha,
}) => {
  const ganador =
    estado.ganador !== null && estado.ganador >= 0
      ? estado.jugadores[estado.ganador]
      : estado.jugadores[0];

  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(ganador.id);

  const jugadorSeleccionado =
    estado.jugadores.find((p) => p.id === selectedPlayerId) || ganador;
  const jugadorDesglose = desgloses.get(selectedPlayerId) || {
    resultado: selectedPlayerId === ganador.id ? 5 : 0,
    murosUsados: 0,
    finalCerrado: 0,
    bonoTorneo: 0,
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
    total: selectedPlayerId === ganador.id ? 5 : 0,
  };

  const misNuevosLogros =
    nuevosLogros.get(jugadorSeleccionado.nombre.trim().toLowerCase()) || [];
  const miSubidaNivel = subidasNivel.get(jugadorSeleccionado.nombre.trim().toLowerCase());

  const [segundosRestantes, setSegundosRestantes] = useState(30);
  const enConfirmacionRevancha =
    Boolean(estado.modoOnline) &&
    (estadoRevanchaOnline === 'esperando' || estadoRevanchaOnline === 'recibida');

  useEffect(() => {
    if (enConfirmacionRevancha) {
      setSegundosRestantes((prev) => (prev < 20 ? 20 : prev));
      return;
    }
    const timer = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onIrAlMenu();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onIrAlMenu, enConfirmacionRevancha]);

  useEffect(() => {
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

        <div className="w-full bg-[#f1f3f5] rounded-xl border border-[#2b2140] p-1.5 mb-2">
          <div className="flex items-center justify-between text-[11px] font-black text-[#593922] mb-1">
            <span>
              {enConfirmacionRevancha
                ? '⏸️ Salida pausada durante confirmación:'
                : '⏱️ Salida automática en:'}
            </span>
            <span
              className={`font-mono-num font-black ${
                !enConfirmacionRevancha && segundosRestantes <= 5
                  ? 'text-[#c92a2a] animate-pulse'
                  : 'text-[#2b2140]'
              }`}
            >
              {segundosRestantes}s
            </span>
          </div>
          <div className="w-full bg-[#dee2e6] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                segundosRestantes <= 5
                  ? 'bg-[#ff6b6b]'
                  : segundosRestantes <= 10
                  ? 'bg-[#ffd43b]'
                  : 'bg-[#51cf66]'
              }`}
              style={{ width: `${(segundosRestantes / 30) * 100}%` }}
            />
          </div>
        </div>

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
          <CartoonCharacter
            color={jugadorSeleccionado.color}
            hat={jugadorSeleccionado.hat}
            size={60}
          />
        </div>

        <div className="bg-white rounded-2xl border-2 border-[#2b2140] p-3 shadow-inner my-2 text-xs flex flex-col gap-1 text-left">
          <span className="text-[10px] font-black uppercase text-[#86542d] mb-0.5 block">
            Desglose de Puntos · {jugadorSeleccionado.nombre}
          </span>
          <div className="flex justify-between text-[#86542d] font-semibold">
            <span>{jugadorDesglose.resultado > 0 ? '🏆 Partida ganada:' : 'Partida jugada:'}</span>
            <span className="font-mono-num font-bold">+{jugadorDesglose.resultado}</span>
          </div>
          <div className="flex justify-between text-[#86542d] font-semibold">
            <span>🧱 Muros usados ({jugadorSeleccionado.estadisticas.murosColocados} × 1 pt):</span>
            <span className="font-mono-num font-bold">+{jugadorDesglose.murosUsados}</span>
          </div>
          {jugadorDesglose.finalCerrado > 0 && (
            <div className="flex justify-between text-[#d9480f] font-bold">
              <span>⚡ ¡Por los pelos! (rival a 1 cuadro):</span>
              <span className="font-mono-num">+{jugadorDesglose.finalCerrado}</span>
            </div>
          )}
          {jugadorDesglose.bonoTorneo > 0 && (
            <div className="flex justify-between text-[#2b8a3e] font-bold">
              <span>👑 Campeón del Torneo:</span>
              <span className="font-mono-num">+{jugadorDesglose.bonoTorneo}</span>
            </div>
          )}
          {jugadorDesglose.penalizaciones.total > 0 && (
            <div className="flex justify-between text-[#c92a2a] font-semibold">
              <span>Penalizaciones (pistas/deshacer/tiempo):</span>
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
          {estado.modoOnline && estadoRevanchaOnline === 'no_disponible' ? (
            <div className="flex flex-col gap-1.5">
              <div className="p-2.5 rounded-xl bg-[#ffe3e3] border-2 border-[#c92a2a] text-xs font-black text-[#c92a2a] leading-snug">
                {mensajeRevanchaNoDisponible ||
                  '⚠️ Esa opción ya no es válida ya que el jugador acaba de retirarse.'}
              </div>
              <button
                type="button"
                disabled
                className="w-full py-2.5 rounded-xl font-black text-xs bg-[#e9ecef] text-[#868e96] border-2 border-[#adb5bd] cursor-not-allowed"
              >
                🚫 Revancha no disponible · Jugador retirado
              </button>
            </div>
          ) : estado.modoOnline && estadoRevanchaOnline === 'recibida' ? (
            <div className="p-2.5 rounded-2xl bg-[#fff3bf] border-2 border-[#2b2140] flex flex-col gap-2 shadow-sm">
              <p className="text-xs font-black text-[#2b2140] leading-snug">
                🔄 <strong>{solicitanteRevancha || 'El otro jugador'}</strong> pidió una revancha.
                ¿Confirmas jugar de nuevo?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onAceptarRevancha?.();
                  }}
                  className="py-2 rounded-xl font-black text-xs bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
                >
                  ✓ Sí, jugar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onRechazarRevancha?.();
                  }}
                  className="py-2 rounded-xl font-black text-xs bg-[#ffe3e3] text-[#c92a2a] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#ffc9c9] active:translate-y-0.5 cursor-pointer"
                >
                  ✕ Retirarme
                </button>
              </div>
            </div>
          ) : estado.modoOnline && estadoRevanchaOnline === 'esperando' ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled
                className="flex-1 py-2.5 px-3 rounded-xl font-black text-xs bg-[#fff3bf] text-[#8f4b00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] flex items-center justify-center gap-2 cursor-wait"
              >
                <span className="animate-spin">⏳</span>
                <span>Esperando confirmación...</span>
              </button>
              {onCancelarEsperaRevancha && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onCancelarEsperaRevancha();
                  }}
                  className="py-2.5 px-3 rounded-xl font-black text-xs bg-white text-[#c92a2a] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#ffe3e3] cursor-pointer shrink-0"
                  title="Cancelar espera de revancha"
                >
                  ✕ Cancelar
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                sounds.playClick();
                onRevancha();
              }}
              className="w-full py-2.5 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer"
            >
              🔄 Jugar Revancha
            </button>
          )}
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
// 7. PERFIL Y CUENTA DE USUARIO MODAL (Login único + Personaje y Terreno Predeterminados)
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
  const [perfilSubTab, setPerfilSubTab] = useState<'mi_perfil' | 'comunidad'>('mi_perfil');
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [textoBajaConfirmacion, setTextoBajaConfirmacion] = useState('');
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('');
  const [color, setColor] = useState('#ff6b6b');
  const [hat, setHat] = useState<HatType>('corona');
  const [temaRegistro, setTemaRegistro] = useState<BoardTheme>('madera');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const [perfilHat, setPerfilHat] = useState<HatType>(() => usuarioActual?.avatarHat || 'corona');
  const [perfilColor, setPerfilColor] = useState<string>(
    () => usuarioActual?.avatarColor || '#ff6b6b'
  );
  const [perfilTema, setPerfilTema] = useState<BoardTheme>(
    () => usuarioActual?.temaTablero || 'madera'
  );
  const [guardandoPreferencias, setGuardandoPreferencias] = useState(false);
  const [guardadoOkMsg, setGuardadoOkMsg] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [diag, setDiag] = useState<NetworkDiagnostic>(() => obtenerDiagnosticoRed());

  const [todasLasCuentas, setTodasLasCuentas] = useState<Record<string, UserAccount>>(() =>
    cargarCuentas()
  );

  useEffect(() => {
    const unsubDiag = suscribirDiagnostico(setDiag);
    const unsubNube = suscribirCambiosNube(({ cuentas: nuevas }) => {
      setTodasLasCuentas(nuevas);
    });
    sincronizarConNube(false).then(() => setTodasLasCuentas(cargarCuentas())).catch(() => {});
    return () => {
      unsubDiag();
      unsubNube();
    };
  }, []);

  useEffect(() => {
    setTodasLasCuentas(cargarCuentas());
  }, [usuarioActual, cargando]);

  useEffect(() => {
    if (usuarioActual) {
      setPerfilHat(usuarioActual.avatarHat || 'corona');
      setPerfilColor(usuarioActual.avatarColor || '#ff6b6b');
      setPerfilTema(usuarioActual.temaTablero || 'madera');
    }
  }, [
    usuarioActual?.id,
    usuarioActual?.avatarHat,
    usuarioActual?.avatarColor,
    usuarioActual?.temaTablero,
  ]);

  const comunidadLista = useMemo(() => {
    return Object.values(todasLasCuentas).sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      return b.victorias - a.victorias;
    });
  }, [todasLasCuentas]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    setErrorMsg(null);
    setCargando(true);
    try {
      const res = await iniciarSesionAsync(nombre, clave);
      if (res.ok && res.user) {
        onLoginSuccess(res.user);
        onCerrar();
      } else {
        sounds.playError();
        setErrorMsg(res.error || 'Credenciales inválidas');
      }
    } catch {
      setErrorMsg('Error de conexión al verificar perfil');
    } finally {
      setCargando(false);
    }
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    setErrorMsg(null);
    setCargando(true);
    try {
      const res = await registrarUsuarioAsync(nombre, clave, color, hat, temaRegistro);
      if (res.ok && res.user) {
        onLoginSuccess(res.user);
        onCerrar();
      } else {
        sounds.playError();
        setErrorMsg(res.error || 'No se pudo crear la cuenta');
      }
    } catch {
      setErrorMsg('Error al sincronizar con Cloudflare KV');
    } finally {
      setCargando(false);
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

        {/* Estado KV en Perfil */}
        {diag.checkedOnce && !diag.kvConnected && (
          <div className="p-2.5 mb-2 bg-[#ffe3e3] rounded-xl border-2 border-[#c92a2a] text-[11px] font-bold text-[#c92a2a] flex items-center justify-between gap-2">
            <span>⚠️ Sin conexión al KV: no se pueden enviar o recibir cambios.</span>
            <button
              type="button"
              onClick={() => {
                pingServidor();
                sincronizarConNube(true);
              }}
              className="py-1 px-2 bg-white rounded-lg border border-[#c92a2a] text-[10px] font-black cursor-pointer shrink-0"
            >
              🔄 Conectar
            </button>
          </div>
        )}

        {usuarioActual ? (
          <div className="flex flex-col gap-3 py-1">
            <div className="grid grid-cols-2 p-1 bg-[#ede4d0] rounded-xl border-2 border-[#2b2140]">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPerfilSubTab('mi_perfil');
                }}
                className={`py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                  perfilSubTab === 'mi_perfil'
                    ? 'bg-white text-[#2b2140] border border-[#2b2140] shadow-sm'
                    : 'text-[#86542d]'
                }`}
              >
                👤 Mi Perfil
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPerfilSubTab('comunidad');
                }}
                className={`py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                  perfilSubTab === 'comunidad'
                    ? 'bg-white text-[#2b2140] border border-[#2b2140] shadow-sm'
                    : 'text-[#86542d]'
                }`}
              >
                👥 Comunidad ({Object.keys(todasLasCuentas).length})
              </button>
            </div>

            {perfilSubTab === 'mi_perfil' ? (
              <>
                <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm">
                  <CartoonCharacter
                    color={perfilColor}
                    hat={perfilHat}
                    size={56}
                    showShadow={false}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-base text-[#2b2140] truncate">
                        {usuarioActual.nombre}
                      </span>
                      {(usuarioActual.rol === 'admin' || usuarioActual.id === 'admin') && (
                        <span className="text-[10px] font-black text-[#8f4b00]">
                          · 👑 {usuarioActual.id === 'admin' ? 'Admin Supremo' : 'Admin'}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-[#495057] block">
                      ID: {usuarioActual.id} · {obtenerNivelYTitulo(usuarioActual.puntos).titulo}
                    </span>
                    <span className="text-xs font-black text-[#2b8a3e] block">
                      {usuarioActual.puntos} puntos acumulados
                    </span>
                    {(perfilHat !== usuarioActual.avatarHat ||
                      perfilColor !== usuarioActual.avatarColor ||
                      perfilTema !== (usuarioActual.temaTablero || 'madera')) && (
                      <span className="text-[10px] font-black text-[#d9480f] block mt-0.5">
                        👀 Vista previa activa · Pulsa Guardar abajo
                      </span>
                    )}
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

                {/* Personaje y Terreno Predeterminados */}
                <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] flex flex-col gap-2 shadow-sm text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
                      Personaje y Terreno Predeterminados
                    </span>
                    {toastMsg && (
                      <span className="text-[10px] text-[#e03131] font-black animate-pulse">
                        {toastMsg}
                      </span>
                    )}
                    {guardadoOkMsg && (
                      <span className="text-[10px] text-[#2b8a3e] font-black animate-bounce">
                        ✓ ¡Guardado!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 mt-1">
                    {PERSONAJES_REGISTRO.map((h) => {
                      const unlocked =
                        (usuarioActual.puntos || 0) >= h.puntosRequeridos ||
                        usuarioActual.rol === 'admin' ||
                        usuarioActual.id === 'admin';
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            if (!unlocked) {
                              sounds.playError();
                              setToastMsg(`🔒 Requiere ${h.puntosRequeridos} pts`);
                              setTimeout(() => setToastMsg(null), 2500);
                              return;
                            }
                            sounds.playClick();
                            setPerfilHat(h.id);
                            setPerfilColor(h.defaultColor);
                          }}
                          className={`relative py-1.5 px-1 rounded-xl text-xs border-2 border-[#2b2140] cursor-pointer flex flex-col items-center gap-0.5 transition-all ${
                            !unlocked
                              ? 'bg-[#e9ecef] opacity-60'
                              : perfilHat === h.id
                              ? 'bg-[#ffd43b] shadow-sm -translate-y-0.5 font-black'
                              : 'bg-[#fff8e7] hover:bg-white'
                          }`}
                          title={unlocked ? h.label : `Requiere ${h.puntosRequeridos} puntos`}
                        >
                          {!unlocked && (
                            <span className="absolute top-0.5 right-0.5 text-[8px]">🔒</span>
                          )}
                          <span className="text-base">{h.icon}</span>
                          <span className="text-[9px] font-bold truncate max-w-full">{h.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selector de Terreno Predeterminado */}
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {TEMAS_LISTA.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setPerfilTema(t.id);
                        }}
                        className={`py-1.5 px-1 rounded-xl text-[10px] font-black border-2 border-[#2b2140] cursor-pointer transition-all ${
                          perfilTema === t.id ? `${t.bg} shadow-xs -translate-y-0.5` : 'bg-[#f8f9fa]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={guardandoPreferencias}
                    onClick={async () => {
                      sounds.playClick();
                      setGuardandoPreferencias(true);
                      try {
                        const actualizado: UserAccount = {
                          ...usuarioActual,
                          avatarHat: perfilHat,
                          avatarColor: perfilColor,
                          temaTablero: perfilTema,
                        };
                        const freshSaved = await actualizarCuentaAsync(actualizado);
                        onLoginSuccess(freshSaved);
                        setGuardadoOkMsg(true);
                        setTimeout(() => setGuardadoOkMsg(false), 2500);
                      } catch {
                        // ignore
                      } finally {
                        setGuardandoPreferencias(false);
                      }
                    }}
                    className="w-full py-1.5 rounded-xl font-black text-xs bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer mt-1 flex items-center justify-center gap-1.5"
                  >
                    <span>💾</span>
                    <span>
                      {guardandoPreferencias ? 'Guardando...' : 'Guardar Predeterminados'}
                    </span>
                  </button>
                </div>

                {(usuarioActual.rol === 'admin' || usuarioActual.id === 'admin') && (
                  <button
                    onClick={() => {
                      sounds.playClick();
                      onAbrirAdmin();
                    }}
                    className="w-full py-2.5 rounded-xl font-black text-xs bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>👑</span>
                    <span>Abrir Panel de Administración</span>
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

                {usuarioActual.id !== 'admin' && (
                  <div className="pt-2 border-t border-[#2b2140]/15">
                    {!confirmandoBaja ? (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setConfirmandoBaja(true);
                          setTextoBajaConfirmacion('');
                        }}
                        className="w-full py-1.5 px-3 rounded-xl font-bold text-[11px] bg-[#fff5f5] text-[#c92a2a] border border-[#ffc9c9] hover:bg-[#ffe3e3] cursor-pointer flex items-center justify-center gap-1"
                      >
                        <span>🗑️</span>
                        <span>Darme de baja (Eliminar mi cuenta)</span>
                      </button>
                    ) : (
                      <div className="p-3 bg-[#ffe3e3] rounded-2xl border-2 border-[#ff8787] flex flex-col gap-2 text-left animate-[fadeIn_0.2s_ease-out]">
                        <div className="text-xs font-black text-[#c92a2a]">
                          ⚠️ ¿Confirmas eliminar tu cuenta permanentemente?
                        </div>
                        <p className="text-[11px] font-bold text-[#c92a2a]">
                          Escribe <strong>{usuarioActual.nombre}</strong> o <strong>BORRAR</strong>:
                        </p>
                        <input
                          type="text"
                          value={textoBajaConfirmacion}
                          onChange={(e) => setTextoBajaConfirmacion(e.target.value)}
                          placeholder={`Escribe ${usuarioActual.nombre} o BORRAR`}
                          className="w-full text-xs font-bold bg-white border-2 border-[#ff8787] rounded-xl px-2.5 py-1.5 outline-none"
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setConfirmandoBaja(false)}
                            className="flex-1 py-1.5 rounded-xl font-bold text-xs bg-white text-[#495057] border border-[#ced4da] cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={
                              cargando ||
                              (textoBajaConfirmacion.trim().toUpperCase() !== 'BORRAR' &&
                                textoBajaConfirmacion.trim().toLowerCase() !==
                                  usuarioActual.nombre.trim().toLowerCase())
                            }
                            onClick={async () => {
                              sounds.playClick();
                              setCargando(true);
                              const ok = await darDeBajaUsuarioAsync(usuarioActual.id);
                              setCargando(false);
                              if (ok) {
                                onLogout();
                                onCerrar();
                              } else {
                                setToastMsg('⚠️ Sin conexión al KV para eliminar');
                              }
                            }}
                            className="flex-1 py-1.5 rounded-xl font-black text-xs bg-[#c92a2a] text-white border border-[#a61e1e] disabled:opacity-40 cursor-pointer"
                          >
                            {cargando ? 'Eliminando...' : 'Sí, eliminar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                <span className="text-[11px] font-black uppercase text-[#86542d]">
                  Jugadores Registrados ({comunidadLista.length})
                </span>
                {comunidadLista.map((u, idx) => {
                  const esYo = u.id === usuarioActual.id;
                  const lvl = obtenerNivelYTitulo(u.puntos);
                  return (
                    <div
                      key={u.id}
                      className={`p-2.5 rounded-xl border-2 border-[#2b2140] flex items-center gap-2.5 ${
                        esYo ? 'bg-[#fff9db] shadow-sm font-bold' : 'bg-white'
                      }`}
                    >
                      <span className="text-xs font-black text-[#86542d] w-4">{idx + 1}º</span>
                      <CartoonCharacter
                        color={u.avatarColor}
                        hat={u.avatarHat}
                        size={34}
                        showShadow={false}
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-[#2b2140] truncate">
                            {u.nombre}
                          </span>
                          {esYo && <span className="text-[10px] font-black text-[#2b8a3e]">· TÚ</span>}
                          {u.rol === 'admin' && <span className="text-[10px]">👑</span>}
                        </div>
                        <span className="text-[10px] text-[#86542d] font-semibold block">
                          {lvl.icono} {lvl.titulo} · {u.id}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-black text-[#2b2140] block">{u.puntos} pts</span>
                        <span className="text-[10px] text-[#86542d] block">{u.victorias} vic</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
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

            <form
              onSubmit={tab === 'login' ? handleLogin : handleRegistro}
              className="flex flex-col gap-2.5"
            >
              <div>
                <label className="text-xs font-bold text-[#86542d] block mb-0.5">
                  Nombre de usuario:
                </label>
                <input
                  type="text"
                  minLength={3}
                  maxLength={20}
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={tab === 'login' ? 'Tu usuario o Admin Supremo' : 'Tu nombre (3-15 caracteres)'}
                  className="w-full text-xs font-bold text-[#2b2140] bg-white border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#ffd43b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#86542d] block mb-0.5">
                  Clave / Contraseña:
                </label>
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
                <>
                  <div>
                    <label className="text-xs font-bold text-[#86542d] block mb-1">
                      Personaje Predeterminado (Vista Previa):
                    </label>
                    <div className="p-2 mb-1.5 bg-white rounded-xl border-2 border-[#2b2140] flex items-center gap-2.5">
                      <CartoonCharacter color={color} hat={hat} size={46} showShadow={false} />
                      <div className="text-left min-w-0">
                        <span className="text-xs font-black text-[#2b2140] block truncate">
                          {PERSONAJES_REGISTRO.find((p) => p.id === hat)?.label || 'Corona'}
                        </span>
                        <span className="text-[10px] font-semibold text-[#86542d] block">
                          Terreno: {TEMAS_LISTA.find((t) => t.id === temaRegistro)?.label}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {PERSONAJES_REGISTRO.filter((p) => p.puntosRequeridos === 0).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setHat(item.id);
                            setColor(item.defaultColor);
                          }}
                          className={`py-1 rounded-xl text-sm border-2 border-[#2b2140] cursor-pointer flex flex-col items-center gap-0.5 ${
                            hat === item.id ? 'bg-[#ffd43b] shadow-sm -translate-y-0.5' : 'bg-white'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span className="text-[8px] font-bold">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#86542d] block mb-1">
                      Terreno Predeterminado:
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {TEMAS_LISTA.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setTemaRegistro(t.id);
                          }}
                          className={`py-1 rounded-xl text-[10px] font-black border-2 border-[#2b2140] cursor-pointer ${
                            temaRegistro === t.id ? `${t.bg} -translate-y-0.5` : 'bg-white'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {errorMsg && (
                <div className="p-2 bg-[#ffe3e3] text-[#c92a2a] text-xs font-bold rounded-xl border border-[#2b2140] text-center">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-2.5 rounded-xl font-black text-sm bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#40c057] active:translate-y-0.5 cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {cargando && <span className="animate-spin">⏳</span>}
                <span>
                  {cargando
                    ? 'Verificando en Cloudflare KV...'
                    : tab === 'login'
                    ? 'Entrar a mi Cuenta'
                    : 'Registrar y Guardar'}
                </span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// 8. PANEL DE ADMINISTRACIÓN (Sin pedir clave por segunda vez + Verificación KV en cada acción)
// =========================================================================
interface AdminPanelModalProps {
  onCerrar: () => void;
  onShowToast?: (msg: string) => void;
  usuarioActual?: UserAccount | null;
  onUsuarioActualizado?: (usuario: UserAccount | null) => void;
  onAbrirLogin?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  onCerrar,
  onShowToast = () => {},
  usuarioActual,
  onUsuarioActualizado,
  onAbrirLogin,
}) => {
  const tieneRolAdmin = Boolean(
    usuarioActual && (usuarioActual.rol === 'admin' || usuarioActual.id === 'admin')
  );
  const esYoSupremo = Boolean(usuarioActual && usuarioActual.id === 'admin');

  const [cuentas, setCuentas] = useState<Record<string, UserAccount>>(() => cargarCuentas());
  const [filtro, setFiltro] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [diag, setDiag] = useState<NetworkDiagnostic>(() => obtenerDiagnosticoRed());

  // Estados de confirmación en pantalla (sin window.confirm bloqueado)
  const [confirmandoResetRanking, setConfirmandoResetRanking] = useState(false);
  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<string | null>(null);

  // Campos de edición
  const [editNombre, setEditNombre] = useState('');
  const [editClave, setEditClave] = useState('');
  const [editRol, setEditRol] = useState<'jugador' | 'admin'>('jugador');
  const [editPuntos, setEditPuntos] = useState<number>(0);
  const [editVictorias, setEditVictorias] = useState<number>(0);

  const eraAdminRef = React.useRef<boolean>(tieneRolAdmin);
  const revocadoNotificadoRef = React.useRef<boolean>(false);
  const usuarioActualRef = React.useRef<UserAccount | null | undefined>(usuarioActual);
  usuarioActualRef.current = usuarioActual;

  // Refs estables para callbacks del padre (evita bucle infinito de peticiones al re-renderizar App)
  const onCerrarRef = React.useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const onShowToastRef = React.useRef(onShowToast);
  onShowToastRef.current = onShowToast;
  const onUsuarioActualizadoRef = React.useRef(onUsuarioActualizado);
  onUsuarioActualizadoRef.current = onUsuarioActualizado;

  useEffect(() => {
    return suscribirDiagnostico(setDiag);
  }, []);

  // Si tenía el panel abierto como admin y su rol cambia a jugador o se cierra sesión, cerrar de inmediato
  useEffect(() => {
    if (eraAdminRef.current && !tieneRolAdmin && !revocadoNotificadoRef.current) {
      revocadoNotificadoRef.current = true;
      onCerrarRef.current();
    }
    if (tieneRolAdmin) {
      eraAdminRef.current = true;
    }
  }, [tieneRolAdmin]);

  const verificarRevocacionYActualizarLista = React.useCallback(
    (accs: Record<string, UserAccount>) => {
      setCuentas(accs);
      setEditandoId((prevEdit) => (prevEdit && !accs[prevEdit] ? null : prevEdit));
      setConfirmandoEliminarId((prevDel) => (prevDel && !accs[prevDel] ? null : prevDel));

      const cur = usuarioActualRef.current;
      if (cur && cur.id !== 'admin') {
        const fresh = accs[cur.id];
        if (!fresh) {
          if (!revocadoNotificadoRef.current) {
            revocadoNotificadoRef.current = true;
            onUsuarioActualizadoRef.current?.(null);
            onShowToastRef.current('⚠️ Tu cuenta ya no existe en la Base de Datos.');
            onCerrarRef.current();
          }
          return false;
        }
        if (
          fresh.rol !== cur.rol ||
          fresh.puntos !== cur.puntos ||
          fresh.victorias !== cur.victorias ||
          fresh.nombre !== cur.nombre
        ) {
          onUsuarioActualizadoRef.current?.(fresh);
        }
        if (fresh.rol !== 'admin') {
          if (!revocadoNotificadoRef.current) {
            revocadoNotificadoRef.current = true;
            sounds.playError();
            onShowToastRef.current('⛔ Tus permisos de administrador fueron revocados.');
            onCerrarRef.current();
          }
          return false;
        }
      }
      return true;
    },
    []
  );

  const sincronizar = React.useCallback(
    async (mostrarToastManual: boolean = false) => {
      if (mostrarToastManual) setSincronizando(true);
      try {
        const res = await sincronizarConNube(true);
        const accs = cargarCuentas();
        const sigueActivo = verificarRevocacionYActualizarLista(accs);
        if (!sigueActivo) return;

        if (mostrarToastManual) {
          onShowToastRef.current(
            res.kvConectado
              ? '🟢 Sincronizado con la Base de Datos (Database)'
              : '⚠️ Sin conexión con la Base de Datos (Database)'
          );
        }
      } catch {
        if (mostrarToastManual) {
          onShowToastRef.current('⚠️ Error al contactar la Base de Datos');
        }
      } finally {
        if (mostrarToastManual) setSincronizando(false);
      }
    },
    [verificarRevocacionYActualizarLista]
  );

  // Carga única al abrir el panel + ping ligero cada 8s (descarga cuentas solo si hubo cambios en KV)
  useEffect(() => {
    sincronizar(false);

    const unsubNube = suscribirCambiosNube(({ cuentas: cloudAccs }) => {
      verificarRevocacionYActualizarLista(cloudAccs);
    });

    const liveInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      pingServidor().catch(() => {});
    }, 25000);

    return () => {
      unsubNube();
      clearInterval(liveInterval);
    };
  }, [sincronizar, verificarRevocacionYActualizarLista]);

  // Verifica siempre en el KV si el usuario sigue siendo Admin antes de ejecutar cualquier acción
  const verificarPermisoAccion = async (requiereSupremo: boolean = false): Promise<boolean> => {
    const check = await verificarAccionAdminEnKV(usuarioActual || null, requiereSupremo);
    if (!check.ok) {
      sounds.playError();
      onShowToast(check.error || '⛔ Acción no autorizada');
      if (check.revocado) {
        const accs = cargarCuentas();
        const updated = usuarioActual ? accs[usuarioActual.id] || null : null;
        onUsuarioActualizado?.(updated);
        onCerrar();
      }
      return false;
    }
    return true;
  };

  const [claveTemporalInfo, setClaveTemporalInfo] = useState<{ nombre: string; clave: string } | null>(null);

  const handleRestablecerClave = async (id: string, nombre: string) => {
    sounds.playClick();
    onShowToast('⏳ Generando clave temporal...');
    const res = await restablecerClaveUsuarioAsync(id);
    if (res.ok && res.claveTemporal) {
      setClaveTemporalInfo({ nombre, clave: res.claveTemporal });
      onShowToast(`🔑 Clave restablecida para ${nombre}`);
    } else {
      sounds.playError();
      onShowToast(res.error || 'No se pudo restablecer la clave');
    }
  };

  const iniciarEdicion = (acc: UserAccount) => {
    sounds.playClick();
    setEditandoId(acc.id);
    setEditNombre(acc.nombre);
    setEditClave(''); // Nunca precargar claves
    setEditRol(acc.rol || 'jugador');
    setEditPuntos(acc.puntos);
    setEditVictorias(acc.victorias);
  };

  const guardarEdicion = async (id: string) => {
    sounds.playClick();
    const targetOriginal = cuentas[id];
    if (!targetOriginal) return;

    const cambioDeRol = editRol !== (targetOriginal.rol || 'jugador');
    // Solo el Admin Supremo puede dar o quitar el rol de Admin a otros
    const autorizado = await verificarPermisoAccion(cambioDeRol);
    if (!autorizado) return;

    const nombreLimpio = editNombre.trim();
    if (nombreLimpio.length < 3 || nombreLimpio.length > 15) {
      onShowToast('⚠️ El nombre debe tener entre 3 y 15 letras');
      return;
    }

    setGuardando(true);
    try {
      const patchData: any = {
        nombre: nombreLimpio,
        rol: esYoSupremo ? editRol : targetOriginal.rol,
        puntos: editPuntos,
        victorias: editVictorias,
      };
      // Solo enviar clave si el admin la escribió expresamente para cambiarla
      if (editClave.trim()) {
        patchData.clave = editClave.trim();
      }

      const res = await adminActualizarUsuarioAsync(id, patchData);

      if (res.ok) {
        const actualizadas = cargarCuentas();
        setCuentas(actualizadas);
        setEditandoId(null);
        if (usuarioActual && usuarioActual.id === id) {
          onUsuarioActualizado?.(actualizadas[id] || null);
        }
        onShowToast(`✅ Cambios de "${nombreLimpio}" enviados a la Base de Datos`);
      } else {
        sounds.playError();
        onShowToast(res.error || '⚠️ No se pudo actualizar el perfil');
      }
    } catch {
      onShowToast('❌ Error de red al guardar en la Base de Datos');
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarEliminarUsuario = async (id: string, nombre: string) => {
    sounds.playClick();
    const targetAcc = cuentas[id];
    // Si el objetivo es otro admin, solo el Admin Supremo puede eliminarlo
    const requiereSup = targetAcc?.rol === 'admin';
    const autorizado = await verificarPermisoAccion(requiereSup);
    if (!autorizado) return;

    setGuardando(true);
    try {
      const res = await adminEliminarUsuarioAsync(id);
      if (res.ok) {
        const actualizadas = cargarCuentas();
        setCuentas(actualizadas);
        setConfirmandoEliminarId(null);
        onShowToast(`🗑️ Usuario "${nombre}" eliminado de la Base de Datos`);
      } else {
        sounds.playError();
        onShowToast(res.error || '⚠️ No se pudo eliminar el usuario');
      }
    } catch {
      onShowToast('❌ Error al eliminar en la Base de Datos');
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarResetRankingGlobal = async () => {
    sounds.playClick();
    const autorizado = await verificarPermisoAccion(false);
    if (!autorizado) return;

    setGuardando(true);
    try {
      const res = await adminResetearRankingAsync();
      if (res.ok) {
        const actualizadas = cargarCuentas();
        setCuentas(actualizadas);
        setConfirmandoResetRanking(false);
        if (usuarioActual && usuarioActual.id !== 'admin' && actualizadas[usuarioActual.id]) {
          onUsuarioActualizado?.(actualizadas[usuarioActual.id]);
        }
        onShowToast('🧹 Ranking Global borrado y reiniciado a cero en la Base de Datos');
      } else {
        sounds.playError();
        onShowToast(res.error || '⚠️ No se pudo reiniciar el Ranking Global');
      }
    } catch {
      onShowToast('❌ Error al reiniciar el Ranking Global');
    } finally {
      setGuardando(false);
    }
  };

  const handleExportBackup = () => {
    sounds.playClick();
    const json = exportarDatosJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muros_locos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('💾 Copia de seguridad descargada');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sounds.playClick();
    const autorizado = await verificarPermisoAccion(true);
    if (!autorizado) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      const ok = await importarDatosJSONAsync(content);
      if (ok) {
        setCuentas(cargarCuentas());
        onShowToast('✅ Base de datos restaurada');
      } else {
        onShowToast('❌ Archivo de respaldo inválido');
      }
    };
    reader.readAsText(file);
  };

  const cuentasFiltradas = Object.values(cuentas).filter((acc) =>
    acc.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-lg bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <h3 className="text-xl font-black text-[#2b2140] flex items-center gap-2">
            <span>🛡️</span> Panel de Administración
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

        {!tieneRolAdmin ? (
          <div className="flex flex-col items-center gap-3 my-6 text-center">
            <span className="text-4xl">🔒</span>
            <p className="text-xs sm:text-sm text-[#593922] font-bold leading-relaxed">
              Para acceder al Panel de Administración, inicia sesión una sola vez desde <strong>Mi Perfil</strong> con tu cuenta de Administrador o con las credenciales del Admin Supremo del Worker.
            </p>
            {onAbrirLogin && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onAbrirLogin();
                }}
                className="w-full py-2.5 rounded-xl font-black text-sm bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer"
              >
                👤 Ir a Iniciar Sesión
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 my-1">
            {/* Estado de Conexión Base de Datos en tiempo real */}
            {!diag.kvConnected ? (
              <div className="p-3 rounded-2xl border-2 border-[#c92a2a] bg-[#ffe3e3] text-[#c92a2a] text-xs font-bold flex items-center justify-between gap-2 shadow-sm">
                <div className="flex-1">
                  <div className="font-black text-[#a61e1e] flex items-center gap-1">
                    <span>⚠️</span>
                    <span>NO CONECTADO A LA BASE DE DATOS (DATABASE)</span>
                  </div>
                  <p className="text-[11px] leading-tight mt-0.5">
                    No se pueden enviar ni recibir cambios globales hasta restablecer la conexión con la Base de Datos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => sincronizar(true)}
                  disabled={sincronizando}
                  className="py-1.5 px-2.5 rounded-xl bg-white border-2 border-[#c92a2a] text-[11px] font-black text-[#c92a2a] cursor-pointer shrink-0"
                >
                  {sincronizando ? '⏳...' : '🔄 Conectar'}
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl border-2 border-[#2b2140] bg-[#d3f9d8] text-[#134e20] text-xs font-black flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base">{esYoSupremo ? '👑' : '🛡️'}</span>
                  <div className="leading-tight truncate">
                    <span className="block truncate">
                      {esYoSupremo ? 'Admin Supremo Activo' : `Admin: ${usuarioActual?.nombre}`}
                    </span>
                    <span className="text-[10px] font-bold text-[#2b8a3e]">
                      🟢 Conectado a la Base de Datos (Database) ({diag.serverPingMs} ms)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => sincronizar(true)}
                  disabled={sincronizando}
                  className="py-1 px-2.5 rounded-lg bg-white border border-[#2b2140] text-[11px] font-black text-[#2b2140] shadow-sm hover:bg-[#f1f3f5] cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span className={sincronizando ? 'animate-spin' : ''}>🔄</span>
                  <span>Sincronizar</span>
                </button>
              </div>
            )}

            {/* Buscador */}
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                placeholder="🔍 Buscar jugador..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full text-xs font-bold bg-white border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none"
              />
              <span className="text-xs font-bold text-[#86542d] whitespace-nowrap">
                {cuentasFiltradas.length} cuentas
              </span>
            </div>

            {/* Alerta de Clave Temporal */}
            {claveTemporalInfo && (
              <div className="p-3 bg-[#e7f5ff] border-2 border-[#1971c2] rounded-2xl flex items-start justify-between gap-3 text-xs shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-black text-[#1864ab] flex items-center gap-1.5">
                    <span>🔑</span>
                    <span>Nueva clave temporal generada para <strong>{claveTemporalInfo.nombre}</strong></span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="px-2 py-1 bg-white border border-[#1971c2]/40 rounded font-mono font-black text-sm text-[#0c8599] select-all">
                      {claveTemporalInfo.clave}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(claveTemporalInfo.clave);
                        alert(`Clave copiada al portapapeles: ${claveTemporalInfo.clave}`);
                      }}
                      className="px-2 py-1 bg-[#1971c2] text-white rounded text-[11px] font-bold cursor-pointer hover:bg-[#1864ab]"
                    >
                      Copiar
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-[#495057]">
                    Comparte esta clave con el jugador. El servidor la ha protegido y no se volverá a mostrar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setClaveTemporalInfo(null)}
                  className="p-1 rounded text-[#1971c2] hover:bg-[#d0ebff] font-bold cursor-pointer"
                  title="Cerrar aviso"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Lista de Usuarios */}
            <div className="flex flex-col gap-2">
              {cuentasFiltradas.map((acc) => {
                const isEditing = editandoId === acc.id;
                const isSupreme = acc.id === 'admin';
                const isConfirmingDelete = confirmandoEliminarId === acc.id;
                const puedeGestionarEstaCuenta =
                  !isSupreme && (esYoSupremo || acc.rol !== 'admin' || acc.id === usuarioActual?.id);

                return (
                  <div
                    key={acc.id}
                    className="p-3 rounded-2xl border-2 border-[#2b2140] bg-white shadow-sm flex flex-col gap-2"
                  >
                    {!isEditing ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <CartoonCharacter
                              color={acc.avatarColor}
                              hat={acc.avatarHat}
                              size={34}
                              showShadow={false}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-xs sm:text-sm text-[#2b2140] truncate">
                                  {acc.nombre}
                                </span>
                                {acc.rol === 'admin' && (
                                  <span className="text-[10px] font-black text-[#8f4b00]">
                                    · 👑 {isSupreme ? 'SUPREMO' : 'ADMIN'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#86542d] font-semibold block truncate">
                                {acc.puntos} pts · {acc.victorias} vic · ELO {acc.elo || 1000}
                              </span>
                            </div>
                          </div>

                          {isSupreme ? (
                            <span className="text-[10px] font-black text-[#5c3c00] whitespace-nowrap">
                              👑 Supremo
                            </span>
                          ) : puedeGestionarEstaCuenta ? (
                            <div className="flex items-center gap-1 shrink-0">
                              {esYoSupremo && acc.id !== 'admin' && (
                                <button
                                  onClick={() => handleRestablecerClave(acc.id, acc.nombre)}
                                  className="p-1.5 rounded-lg border border-[#2b2140] bg-[#e7f5ff] text-xs hover:bg-[#d0ebff] cursor-pointer"
                                  title="Restablecer clave temporal"
                                >
                                  🔑
                                </button>
                              )}
                              <button
                                onClick={() => iniciarEdicion(acc)}
                                className="p-1.5 rounded-lg border border-[#2b2140] bg-[#fff9db] text-xs hover:bg-[#fff3bf] cursor-pointer"
                                title="Editar usuario"
                              >
                                ✏️
                              </button>
                              {acc.id !== usuarioActual?.id && (
                                <button
                                  onClick={() => {
                                    sounds.playClick();
                                    setConfirmandoEliminarId(acc.id);
                                  }}
                                  className="p-1.5 rounded-lg border border-[#2b2140] bg-[#ffe3e3] text-xs hover:bg-[#ffc9c9] cursor-pointer"
                                  title="Eliminar usuario"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-[#868e96]">Protegido</span>
                          )}
                        </div>

                        {isConfirmingDelete && (
                          <div className="p-2.5 bg-[#ffe3e3] rounded-xl border border-[#c92a2a] flex items-center justify-between gap-2 text-xs">
                            <span className="font-black text-[#c92a2a]">
                              ¿Eliminar a "{acc.nombre}" de la Base de Datos?
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setConfirmandoEliminarId(null)}
                                className="py-1 px-2 rounded-lg bg-white border border-[#ced4da] font-bold text-[11px] cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={guardando}
                                onClick={() => ejecutarEliminarUsuario(acc.id, acc.nombre)}
                                className="py-1 px-2.5 rounded-lg bg-[#c92a2a] text-white font-black text-[11px] cursor-pointer"
                              >
                                {guardando ? 'Borrando...' : 'Sí, eliminar'}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col gap-2 pt-1 border-t border-[#2b2140]/10">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="font-bold text-[#86542d] block">Nombre:</label>
                            <input
                              type="text"
                              minLength={3}
                              maxLength={15}
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-bold"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-[#86542d] block">Nueva clave (opcional):</label>
                            <input
                              type="password"
                              placeholder="Dejar vacío para no cambiar"
                              value={editClave}
                              onChange={(e) => setEditClave(e.target.value)}
                              className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-bold text-xs"
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

                        {/* Solo el Admin Supremo puede dar o quitar el rol de Admin a los demás */}
                        {esYoSupremo ? (
                          <div className="text-xs">
                            <label className="font-bold text-[#86542d] block">
                              Rol del Usuario (exclusivo Admin Supremo):
                            </label>
                            <select
                              value={editRol}
                              onChange={(e) => setEditRol(e.target.value as 'jugador' | 'admin')}
                              className="w-full bg-[#fff9db] border border-[#2b2140] rounded px-2 py-1 font-bold text-xs cursor-pointer"
                            >
                              <option value="jugador">🎮 Jugador Normal</option>
                              <option value="admin">
                                👑 Administrador (Entra sin clave maestra)
                              </option>
                            </select>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#86542d] font-semibold">
                            ℹ️ Solo el Admin Supremo puede otorgar o quitar el rol de Administrador.
                          </div>
                        )}

                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            onClick={() => setEditandoId(null)}
                            className="px-2.5 py-1 rounded bg-[#f1f3f5] border border-[#2b2140] text-xs font-bold cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            disabled={guardando}
                            onClick={() => guardarEdicion(acc.id)}
                            className="px-3 py-1 rounded bg-[#51cf66] text-[#134e20] border border-[#2b2140] text-xs font-black cursor-pointer shadow-sm"
                          >
                            {guardando ? 'Guardando...' : 'Guardar en Base de Datos'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Zona de Peligro: Borrar Ranking Global con Confirmación integrada */}
            <div className="p-3 bg-[#fff5f5] rounded-2xl border-2 border-[#ffc9c9] shadow-sm flex flex-col gap-2 mt-2">
              <span className="font-black text-xs text-[#c92a2a] flex items-center gap-1.5">
                <span>⚠️</span> Zona de Peligro: Reiniciar Ranking Global
              </span>
              <p className="text-[11px] text-[#e03131] font-medium leading-relaxed">
                Borra todas las entradas del Ranking Global en la Base de Datos y reinicia a 0 los puntos, partidas y victorias de todos los jugadores.
              </p>

              {!confirmandoResetRanking ? (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setConfirmandoResetRanking(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl font-black text-xs bg-[#ffe3e3] text-[#c92a2a] border-2 border-[#ffa8a8] hover:bg-[#ffc9c9] active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>🧹</span>
                  <span>Reiniciar Todo el Ranking Global a Cero</span>
                </button>
              ) : (
                <div className="p-3 bg-[#ffe3e3] rounded-xl border-2 border-[#c92a2a] flex flex-col gap-2 animate-[fadeIn_0.15s_ease-out]">
                  <span className="text-xs font-black text-[#a61e1e]">
                    🚨 ¿CONFIRMAS borrar TODO el Ranking Global en la Base de Datos? Esta acción dejará en 0 puntos a todos los jugadores.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => setConfirmandoResetRanking(false)}
                      className="flex-1 py-2 rounded-xl bg-white border border-[#2b2140] text-xs font-bold text-[#2b2140] hover:bg-[#f8f9fa] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={ejecutarResetRankingGlobal}
                      className="flex-1 py-2 rounded-xl bg-[#c92a2a] border-2 border-[#2b2140] text-xs font-black text-white hover:bg-[#a61e1e] cursor-pointer shadow-sm"
                    >
                      {guardando ? '⏳ Borrando en Base de Datos...' : '✓ Sí, borrar Ranking Global'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Respaldo */}
            <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex flex-col gap-2 mt-1">
              <span className="font-black text-xs text-[#2b2140] flex items-center gap-1.5">
                <span>📦</span> Copia de Seguridad JSON
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={handleExportBackup}
                  className="py-1.5 px-3 rounded-xl font-bold bg-[#f8f9fa] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#e9ecef] cursor-pointer flex items-center justify-center gap-1"
                >
                  📥 Descargar Copia
                </button>
                {esYoSupremo ? (
                  <label className="py-1.5 px-3 rounded-xl font-bold bg-[#f8f9fa] text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#e9ecef] cursor-pointer flex items-center justify-center gap-1">
                    📤 Restaurar Copia
                    <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                  </label>
                ) : (
                  <div className="py-1.5 px-3 rounded-xl font-bold bg-[#f1f3f5] text-[#868e96] border border-[#ced4da] flex items-center justify-center text-[11px]">
                    🔒 Restaurar (Supremo)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
