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
  PersonajeAuraType,
  PersonajeColeccionable,
  PersonajeRopaType,
  RankEntry,
  ScoreBreakdown,
  SolicitudResetRanking,
  TorneoState,
  UserAccount,
  UserRole,
  WeeklyRankingResponse,
} from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import { PWAInstallButton } from './PWAInstallControl';
import {
  actualizarCuentaAsync,
  adminActualizarUsuarioAsync,
  adminEliminarUsuarioAsync,
  adminResetearRankingAsync,
  aprobarResetRankingAsync,
  borrarRankingLocal,
  cargarCuentas,
  cargarRanking,
  cargarRankingLocal,
  cerrarSesion,
  darDeBajaUsuarioAsync,
  equiparPersonajeInventario,
  exportarDatosJSON,
  fijarPremioSemanalAsync,
  guardarConfigSemanalAsync,
  guardarDesbloqueosPersonajesAsync,
  importarDatosJSONAsync,
  iniciarSesionAsync,
  obtenerConfigSemanalAsync,
  obtenerDesbloqueosLocales,
  obtenerDesbloqueosPersonajesAsync,
  obtenerSolicitudResetRankingAsync,
  quitarPersonajeInventarioAsync,
  rechazarResetRankingAsync,
  regalarPersonajeAsync,
  restablecerClaveUsuarioAsync,
  crearSalaPersonalizadaAsync,
  eliminarSalaPersonalizadaAsync,
  obtenerSalasPersonalizadasAsync,
  solicitarResetRankingAsync,
  cambiarClaveUsuarioAsync,
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
  D1_VerificarAccionAdmin,
} from '../game/storage';
import { SalaPersonalizada } from '../types/murosLocos';

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
  personajeActual: { hat: HatType; color: string; ropa?: PersonajeRopaType; ropaColor?: string; aura?: PersonajeAuraType };
  temaActual: BoardTheme;
  usuarioActual?: UserAccount | null;
  onAplicar: (
    nuevoPersonaje: { hat: HatType; color: string; ropa?: PersonajeRopaType; ropaColor?: string; aura?: PersonajeAuraType },
    nuevoTema: BoardTheme
  ) => void;
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
  const [tabPersonaje, setTabPersonaje] = useState<'base' | 'inventario'>('base');
  const [selectedHat, setSelectedHat] = useState<HatType>(personajeActual.hat || 'corona');
  const [selectedColor, setSelectedColor] = useState<string>(personajeActual.color || '#ff6b6b');
  const [selectedRopa, setSelectedRopa] = useState<PersonajeRopaType>(
    personajeActual.ropa || usuarioActual?.avatarRopa || 'ninguna'
  );
  const [selectedRopaColor, setSelectedRopaColor] = useState<string | undefined>(
    personajeActual.ropaColor || usuarioActual?.avatarRopaColor
  );
  const [selectedAura, setSelectedAura] = useState<PersonajeAuraType>(
    personajeActual.aura || usuarioActual?.avatarAura || 'ninguna'
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    usuarioActual?.inventario?.activoId || null
  );
  const [selectedTema, setSelectedTema] = useState<BoardTheme>(temaActual || 'madera');
  const [guardarEnPerfil, setGuardarEnPerfil] = useState(Boolean(usuarioActual));
  const [guardando, setGuardando] = useState(false);

  const userPoints = usuarioActual?.puntos || 0;
  const esAdmin = Boolean(
    usuarioActual &&
      (usuarioActual.rol === 'admin' || usuarioActual.rol === 'dev' || usuarioActual.id === 'admin')
  );

  const [desbloqueosPuntos, setDesbloqueosPuntos] = useState<Record<string, number>>(() => obtenerDesbloqueosLocales());

  useEffect(() => {
    obtenerDesbloqueosPersonajesAsync().then((d) => setDesbloqueosPuntos(d));
  }, []);

  const personajesBaseConPuntos = useMemo(() => {
    return PERSONAJES_REGISTRO.map((p) => {
      const customReq = desbloqueosPuntos[p.id];
      return {
        ...p,
        puntosRequeridos: customReq !== undefined ? customReq : p.puntosRequeridos,
      };
    });
  }, [desbloqueosPuntos]);

  const isPersonajeDesbloqueado = (puntosReq: number) => {
    if (puntosReq === 0) return true;
    if (esAdmin) return true;
    return userPoints >= puntosReq;
  };

  const personajesVisibles = useMemo(() => {
    return personajesBaseConPuntos.filter((p) => isPersonajeDesbloqueado(p.puntosRequeridos));
  }, [personajesBaseConPuntos, userPoints, esAdmin]);

  const siguientePorDesbloquear = useMemo(() => {
    return personajesBaseConPuntos.find((p) => !isPersonajeDesbloqueado(p.puntosRequeridos));
  }, [personajesBaseConPuntos, userPoints, esAdmin]);

  const cuentaFresca = usuarioActual ? cargarCuentas()[usuarioActual.id] || usuarioActual : null;
  const misExclusivos = cuentaFresca?.inventario?.personajes || usuarioActual?.inventario?.personajes || [];

  const handleSeleccionarPersonajeBase = (p: (typeof PERSONAJES_REGISTRO)[0]) => {
    if (!isPersonajeDesbloqueado(p.puntosRequeridos)) {
      sounds.playError();
      onShowToast?.(`🔒 ${p.label} se desbloquea al alcanzar ${p.puntosRequeridos} puntos`);
      return;
    }
    sounds.playClick();
    setSelectedHat(p.id);
    setSelectedColor(p.defaultColor);
    setSelectedRopa('ninguna');
    setSelectedRopaColor(undefined);
    setSelectedAura('ninguna');
    setSelectedItemId(null);
  };

  const handleSeleccionarExclusivo = (item: PersonajeColeccionable) => {
    sounds.playClick();
    setSelectedHat(item.hat);
    setSelectedColor(item.color);
    setSelectedRopa(item.ropa || 'ninguna');
    setSelectedRopaColor(item.ropaColor);
    setSelectedAura(item.aura || 'ninguna');
    setSelectedItemId(item.id);
    const otorgadoPor =
      typeof item.origen === 'object' && item.origen
        ? item.origen.otorgadoPor
        : typeof item.origen === 'string'
        ? item.origen
        : 'Exclusivo';
    onShowToast?.(`✨ Equipado: "${item.nombre}" (${otorgadoPor})`);
  };

  const handleDesequiparExclusivo = () => {
    sounds.playClick();
    setSelectedRopa('ninguna');
    setSelectedRopaColor(undefined);
    setSelectedAura('ninguna');
    setSelectedItemId(null);
    onShowToast?.('Atuendo exclusivo desequipado');
  };

  const handleGuardarYAplicar = async () => {
    sounds.playClick();
    setGuardando(true);

    try {
      if (usuarioActual && guardarEnPerfil) {
        const cuentas = cargarCuentas();
        const baseUser = cuentas[usuarioActual.id] || usuarioActual;
        const invActual = baseUser.inventario || { personajes: [] };
        const updated: UserAccount = {
          ...baseUser,
          avatarHat: selectedHat,
          avatarColor: selectedColor,
          avatarRopa: selectedRopa,
          avatarRopaColor: selectedRopaColor,
          avatarAura: selectedAura,
          inventario: {
            ...invActual,
            activoId: selectedItemId || undefined,
          },
          temaTablero: selectedTema,
        };
        const freshSaved = await actualizarCuentaAsync(updated);
        onUsuarioActualizado?.(freshSaved);
        onShowToast?.('⭐ Personaje y terreno guardados como predeterminados en tu perfil');
      }

      onAplicar(
        { hat: selectedHat, color: selectedColor, ropa: selectedRopa, ropaColor: selectedRopaColor, aura: selectedAura },
        selectedTema
      );
      onCerrar();
    } catch {
      onAplicar(
        { hat: selectedHat, color: selectedColor, ropa: selectedRopa, ropaColor: selectedRopaColor, aura: selectedAura },
        selectedTema
      );
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
                  : '💡 Modo Invitado (Crea perfil para guardar tus aspectos)'}
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

        {/* Vista previa en vivo */}
        <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex items-center gap-3 mb-3">
          <CartoonCharacter
            color={selectedColor}
            hat={selectedHat}
            ropa={selectedRopa}
            aura={selectedAura}
            size={58}
            showShadow={false}
          />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black text-[#593922] uppercase tracking-wider block">
              Vista Previa Activa
            </span>
            <span className="font-extrabold text-sm text-[#2b2140] flex items-center gap-1.5 truncate">
              <span>{activeCharDef.icon}</span>
              <span className="truncate">
                {selectedItemId
                  ? misExclusivos.find((i) => i.id === selectedItemId)?.nombre || activeCharDef.label
                  : activeCharDef.label}
              </span>
              {selectedItemId && (
                <span className="text-[9px] font-black bg-[#ffd43b] text-[#5c3c00] px-1.5 py-0.5 rounded-full border border-[#2b2140]/30 shrink-0">
                  EXCLUSIVO
                </span>
              )}
            </span>
            <span className="text-[11px] font-bold text-[#86542d] block truncate">
              Terreno: {TEMAS_LISTA.find((t) => t.id === selectedTema)?.label}
            </span>
            {(selectedRopa !== 'ninguna' || selectedAura !== 'ninguna') && (
              <span className="text-[10px] font-bold text-[#1971c2] block truncate">
                Atuendo: {selectedRopa !== 'ninguna' ? selectedRopa : 'Normal'} · Aura: {selectedAura !== 'ninguna' ? selectedAura : 'Ninguna'}
              </span>
            )}
          </div>
        </div>

        {/* Sub-tabs: Personajes Base vs Mis Exclusivos */}
        <div className="flex items-center gap-1.5 p-1 bg-[#f1f3f5] rounded-xl border border-[#2b2140]/20 mb-3">
          <button
            type="button"
            onClick={() => setTabPersonaje('base')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              tabPersonaje === 'base'
                ? 'bg-white text-[#2b2140] border border-[#2b2140] shadow-xs'
                : 'text-[#86542d] hover:text-[#2b2140]'
            }`}
          >
            🎮 Personajes Base
          </button>
          <button
            type="button"
            onClick={() => setTabPersonaje('inventario')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
              tabPersonaje === 'inventario'
                ? 'bg-[#ffd43b] text-[#5c3c00] border border-[#2b2140] shadow-xs'
                : 'text-[#86542d] hover:text-[#2b2140]'
            }`}
          >
            <span>🎒 Mis Exclusivos</span>
            <span className="bg-[#2b2140] text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {misExclusivos.length}
            </span>
          </button>
        </div>

        {/* CONTENIDO SEGÚN TAB */}
        {tabPersonaje === 'base' ? (
          <div className="flex flex-col gap-1.5 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
                1. Tus Personajes Disponibles
              </span>
              <span className="text-[10px] font-bold text-[#2b8a3e]">
                {personajesVisibles.length} desbloqueados
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {personajesVisibles.map((p) => {
                const isSelected = selectedHat === p.id && !selectedItemId;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSeleccionarPersonajeBase(p)}
                    className={`relative p-2 rounded-2xl border-2 border-[#2b2140] cursor-pointer flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-[#ffd43b] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                        : 'bg-white hover:bg-[#f8f9fa]'
                    }`}
                    title={p.label}
                  >
                    <CartoonCharacter color={p.defaultColor} hat={p.id} size={38} showShadow={false} />
                    <span className="text-[10px] font-extrabold text-[#2b2140] text-center leading-tight">
                      {p.label}
                    </span>
                    {isSelected && (
                      <span className="text-[8px] font-black text-[#134e20] bg-[#d3f9d8] px-1 rounded border border-[#2b8a3e]">
                        ✓ ACTIVO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Siguiente personaje a desbloquear si aún quedan */}
            {siguientePorDesbloquear && (
              <div className="p-2.5 bg-gradient-to-r from-[#fff9db] to-[#f8f9fa] rounded-2xl border-2 border-[#2b2140]/25 flex items-center justify-between text-xs mt-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">🔒</span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-[#86542d] block uppercase tracking-wider">
                      Próximo Desbloqueo
                    </span>
                    <span className="font-black text-xs text-[#2b2140] block truncate">
                      {siguientePorDesbloquear.label} ({siguientePorDesbloquear.icon})
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-[#d9480f] block">
                    {userPoints} / {siguientePorDesbloquear.puntosRequeridos} pts
                  </span>
                  <span className="text-[9px] font-bold text-[#868e96] block">
                    Faltan {Math.max(0, siguientePorDesbloquear.puntosRequeridos - userPoints)} pts
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
                🎒 Colección de Personajes Exclusivos
              </span>
              {selectedItemId && (
                <button
                  type="button"
                  onClick={handleDesequiparExclusivo}
                  className="text-[10px] font-bold text-[#c92a2a] hover:underline cursor-pointer"
                >
                  ✕ Desequipar
                </button>
              )}
            </div>

            {misExclusivos.length === 0 ? (
              <div className="p-4 bg-white rounded-2xl border-2 border-[#2b2140]/20 text-center flex flex-col items-center gap-1.5 my-1">
                <span className="text-3xl">🎁</span>
                <span className="font-black text-xs text-[#2b2140]">
                  Aún no tienes personajes exclusivos en tu inventario
                </span>
                <p className="text-[11px] text-[#86542d] leading-relaxed">
                  Gana el <strong>Torneo Semanal</strong> o recíbelo como premio/regalo de un Administrador o Dev.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {misExclusivos.map((item) => {
                  const isEquipped = selectedItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSeleccionarExclusivo(item)}
                      className={`p-2.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-2.5 ${
                        isEquipped
                          ? 'border-[#2b2140] bg-[#fff9db] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                          : 'border-[#2b2140]/40 bg-white hover:bg-[#f8f9fa]'
                      }`}
                    >
                      <CartoonCharacter
                        color={item.color}
                        hat={item.hat}
                        ropa={item.ropa}
                        aura={item.aura}
                        size={42}
                        showShadow={false}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-xs text-[#2b2140] truncate">
                            {item.nombre}
                          </span>
                          {isEquipped && (
                            <span className="text-[9px] font-black text-[#134e20] bg-[#d3f9d8] px-1.5 py-0.5 rounded border border-[#2b8a3e]">
                              EN USO
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-[#86542d] block truncate">
                          {typeof item.origen === 'object' && item.origen?.tipo === 'torneo_semanal'
                            ? '🏆 Torneo Semanal'
                            : typeof item.origen === 'object' && item.origen?.tipo === 'regalo_dev'
                            ? '👑 Regalo de Dev'
                            : typeof item.origen === 'string' && item.origen.toLowerCase().includes('torneo')
                            ? '🏆 Torneo Semanal'
                            : typeof item.origen === 'string' && item.origen.toLowerCase().includes('dev')
                            ? '👑 Regalo de Dev'
                            : '🛡️ Regalo Exclusivo'}
                        </span>
                        <span className="text-[9px] text-[#495057] block truncate">
                          {typeof item.origen === 'object' && item.origen
                            ? item.origen.otorgadoPor
                            : typeof item.origen === 'string'
                            ? item.origen
                            : 'Exclusivo'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SELECCIÓN DE TERRENO */}
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
        showToast(res.dbConectado ? '🔄 Sincronizado con la Database' : '⚠️ Sin conexión a la Database');
      }
    } catch {
      showToast('⚠️ No se pudo sincronizar con la Database');
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
                  : '🌍 Clasificación en Database'}
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

        {/* Database Disconnected Warning inside Ranking */}
        {diag.checkedOnce && !diag.dbConectado && tab !== 'local' && (
          <div className="p-2.5 bg-[#ffe3e3] rounded-2xl border-2 border-[#c92a2a] mb-2 text-[11px] font-bold text-[#c92a2a] flex items-center justify-between gap-2">
            <span>⚠️ Sin conexión a la Database: mostrando últimos datos guardados localmente.</span>
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
          <div className="p-2.5 bg-[#fff3bf] rounded-2xl border-2 border-[#2b2140] mb-2 flex flex-col gap-1.5 shadow-sm text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black text-[#8f4b00] flex items-center gap-1">
                <span>🏆</span> Torneo Semanal Oficial
              </span>
              <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded-full border border-[#2b2140] text-[#2b2140] shrink-0">
                ⏳ {textoCuentaAtrasSemana}
              </span>
            </div>

            {semanalData?.actual?.premioSemanal ? (
              <div className="p-2 bg-white rounded-xl border border-[#ffd43b] flex items-center gap-2.5">
                <CartoonCharacter
                  color={semanalData.actual.premioSemanal.color}
                  hat={semanalData.actual.premioSemanal.hat}
                  ropa={semanalData.actual.premioSemanal.ropa}
                  ropaColor={semanalData.actual.premioSemanal.ropaColor}
                  aura={semanalData.actual.premioSemanal.aura}
                  size={42}
                  showShadow={false}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black uppercase text-[#d9480f] tracking-wider block">
                    🎁 Premio al 1º del Ranking:
                  </span>
                  <span className="text-xs font-black text-[#2b2140] truncate block">
                    {semanalData.actual.premioSemanal.nombre}
                  </span>
                  <span className="text-[10px] text-[#86542d] font-semibold block">
                    Personaje exclusivo para el ganador semanal
                  </span>
                </div>
              </div>
            ) : null}

            <span className="text-[11px] font-bold text-[#5c3c00]">
              Bonos al cierre: 🥇 +{semanalData?.actual?.puntosConfig?.primerLugar || 50} pts · 🥈 +{semanalData?.actual?.puntosConfig?.segundoLugar || 30} pts · 🥉 +{semanalData?.actual?.puntosConfig?.tercerLugar || 15} pts
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
            <span>{sincronizando ? 'Sincronizando...' : 'Actualizar Database'}</span>
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
          {Boolean(jugadorDesglose.bonoDominacion && jugadorDesglose.bonoDominacion > 0) && (
            <div className="flex justify-between text-[#2b8a3e] font-bold">
              <span>🎯 Dominación (rival retenido en inicio ≤2 casillas):</span>
              <span className="font-mono-num">+{jugadorDesglose.bonoDominacion}</span>
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

  const [mostrandoCambioClave, setMostrandoCambioClave] = useState(false);
  const [claveActualInput, setClaveActualInput] = useState('');
  const [nuevaClaveInput, setNuevaClaveInput] = useState('');
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [cambioClaveError, setCambioClaveError] = useState<string | null>(null);
  const [cambioClaveOk, setCambioClaveOk] = useState(false);

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
      setErrorMsg('Error al sincronizar con la Database');
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

        {/* Estado Database en Perfil */}
        {diag.checkedOnce && !diag.dbConectado && (
          <div className="p-2.5 mb-2 bg-[#ffe3e3] rounded-xl border-2 border-[#c92a2a] text-[11px] font-bold text-[#c92a2a] flex items-center justify-between gap-2">
            <span>⚠️ Sin conexión a la Database: no se pueden enviar o recibir cambios.</span>
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

                {/* Formulario de Cambio de Contraseña Personal */}
                <div className="pt-2 border-t border-[#2b2140]/15">
                  {!mostrandoCambioClave ? (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setMostrandoCambioClave(true);
                        setCambioClaveError(null);
                        setCambioClaveOk(false);
                      }}
                      className="w-full py-1.5 px-3 rounded-xl font-bold text-[11px] bg-white text-[#2b2140] border border-[#2b2140]/30 hover:bg-[#fff9db] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>🔑</span>
                      <span>Cambiar mi contraseña</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] flex flex-col gap-2 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#2b2140] flex items-center gap-1">
                          <span>🔑</span> Cambiar Contraseña
                        </span>
                        <button
                          type="button"
                          onClick={() => setMostrandoCambioClave(false)}
                          className="text-[10px] text-[#86542d] font-bold hover:underline cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>

                      {cambioClaveOk ? (
                        <div className="p-2 bg-[#d3f9d8] text-[#134e20] text-xs font-bold rounded-xl border border-[#2b8a3e] text-center">
                          ✅ Contraseña actualizada correctamente en la Database.
                        </div>
                      ) : (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            sounds.playClick();
                            setCambioClaveError(null);
                            setCambiandoClave(true);
                            const res = await cambiarClaveUsuarioAsync(claveActualInput, nuevaClaveInput);
                            setCambiandoClave(false);
                            if (res.ok) {
                              sounds.playWin();
                              setCambioClaveOk(true);
                              setClaveActualInput('');
                              setNuevaClaveInput('');
                              setTimeout(() => setMostrandoCambioClave(false), 2500);
                            } else {
                              sounds.playError();
                              setCambioClaveError(res.error || 'No se pudo actualizar la contraseña');
                            }
                          }}
                          className="flex flex-col gap-2"
                        >
                          <div>
                            <label className="text-[10px] font-bold text-[#86542d] block mb-0.5">
                              Contraseña actual:
                            </label>
                            <input
                              type="password"
                              required
                              value={claveActualInput}
                              onChange={(e) => setClaveActualInput(e.target.value)}
                              placeholder="••••••••"
                              className="w-full text-xs font-bold bg-[#f8f9fa] border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[#86542d] block mb-0.5">
                              Nueva contraseña:
                            </label>
                            <input
                              type="password"
                              required
                              minLength={4}
                              value={nuevaClaveInput}
                              onChange={(e) => setNuevaClaveInput(e.target.value)}
                              placeholder="Mínimo 4 caracteres"
                              className="w-full text-xs font-bold bg-[#f8f9fa] border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none"
                            />
                          </div>

                          {cambioClaveError && (
                            <span className="text-[10px] font-bold text-[#c92a2a] block">
                              ⚠️ {cambioClaveError}
                            </span>
                          )}

                          <button
                            type="submit"
                            disabled={cambiandoClave || !claveActualInput || !nuevaClaveInput}
                            className="w-full py-1.5 bg-[#ffd43b] text-[#5c3c00] font-black text-xs rounded-xl border-2 border-[#2b2140] hover:bg-[#fcc419] disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            {cambiandoClave ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>

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
                                setToastMsg('⚠️ Sin conexión a la Database para eliminar');
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
                    ? 'Verificando en la Database...'
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
// 8. PANEL DE ADMINISTRACIÓN (Sin pedir clave por segunda vez + Verificación en Database en cada acción)
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
  const esAdminSupremoUnico = Boolean(
    usuarioActual && (usuarioActual.id === 'admin' || usuarioActual.esSupremo)
  );
  const esYoSupremo = Boolean(
    usuarioActual && (usuarioActual.rol === 'dev' || esAdminSupremoUnico)
  );
  const esAdmin = Boolean(usuarioActual && (usuarioActual.rol === 'admin' || esYoSupremo));
  const esMod = Boolean(usuarioActual && usuarioActual.rol === 'mod');
  const tieneRolStaff = esYoSupremo || esAdmin || esMod;

  const [adminTab, setAdminTab] = useState<'jugadores' | 'editor' | 'torneo' | 'salas'>(() => {
    if (esMod && !esAdmin) return 'salas';
    return 'jugadores';
  });
  const [cuentas, setCuentas] = useState<Record<string, UserAccount>>(() => cargarCuentas());
  const [filtro, setFiltro] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [diag, setDiag] = useState<NetworkDiagnostic>(() => obtenerDiagnosticoRed());

  // Salas Personalizadas (Dev, Admin, Mod)
  const [salasPersonalizadas, setSalasPersonalizadas] = useState<SalaPersonalizada[]>([]);
  const [creandoSala, setCreandoSala] = useState(false);
  const [nuevaSalaCodigo, setNuevaSalaCodigo] = useState('');
  const [nuevaSalaNombre, setNuevaSalaNombre] = useState('');
  const [nuevaSalaMaxJugadores, setNuevaSalaMaxJugadores] = useState<2 | 4>(2);
  const [nuevaSalaModo, setNuevaSalaModo] = useState<'estandar' | 'caos' | 'tactico'>('estandar');
  const [nuevaSalaTablero, setNuevaSalaTablero] = useState<7 | 9>(9);
  const [nuevaSalaMensaje, setNuevaSalaMensaje] = useState('');

  // Confirmaciones
  const [confirmandoResetRanking, setConfirmandoResetRanking] = useState(false);
  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<string | null>(null);

  // Inspector de inventario
  const [inspectingUser, setInspectingUser] = useState<UserAccount | null>(null);

  // Solicitud de reset de ranking
  const [solicitudReset, setSolicitudReset] = useState<SolicitudResetRanking | null>(null);

  // Configuración de torneo semanal
  const [puntos1, setPuntos1] = useState(50);
  const [puntos2, setPuntos2] = useState(30);
  const [puntos3, setPuntos3] = useState(15);
  const [puntosPart, setPuntosPart] = useState(5);
  const [premioActivo, setPremioActivo] = useState<PersonajeColeccionable | undefined>(undefined);
  const [guardandoTorneo, setGuardandoTorneo] = useState(false);

  // Editor visual de personajes
  const [editorNombre, setEditorNombre] = useState('Campeón Legendario');
  const [editorColor, setEditorColor] = useState('#ffd43b');
  const [editorHat, setEditorHat] = useState<HatType>('corona');
  const [editorRopa, setEditorRopa] = useState<PersonajeRopaType>('capa');
  const [editorRopaColor, setEditorRopaColor] = useState<string>('#c92a2a');
  const [editorAura, setEditorAura] = useState<PersonajeAuraType>('dorada');
  const [editorTargetId, setEditorTargetId] = useState<string>('');
  const [guardandoEditor, setGuardandoEditor] = useState(false);

  // Configuración de desbloqueos de personajes base (Solo Dev)
  const [desbloqueosDev, setDesbloqueosDev] = useState<Record<string, number>>(() => obtenerDesbloqueosLocales());
  const [guardandoDesbloqueos, setGuardandoDesbloqueos] = useState(false);

  // Campos de edición de jugador
  const [editNombre, setEditNombre] = useState('');
  const [editClave, setEditClave] = useState('');
  const [editRol, setEditRol] = useState<UserRole>('jugador');
  const [editPuntos, setEditPuntos] = useState<number>(0);
  const [editVictorias, setEditVictorias] = useState<number>(0);

  const eraStaffRef = React.useRef<boolean>(tieneRolStaff);
  const revocadoNotificadoRef = React.useRef<boolean>(false);
  const usuarioActualRef = React.useRef<UserAccount | null | undefined>(usuarioActual);
  usuarioActualRef.current = usuarioActual;

  const onCerrarRef = React.useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const onShowToastRef = React.useRef(onShowToast);
  onShowToastRef.current = onShowToast;
  const onUsuarioActualizadoRef = React.useRef(onUsuarioActualizado);
  onUsuarioActualizadoRef.current = onUsuarioActualizado;

  useEffect(() => {
    return suscribirDiagnostico(setDiag);
  }, []);

  // Si su rol cambia o se cierra sesión, cerrar modal
  useEffect(() => {
    if (eraStaffRef.current && !tieneRolStaff && !revocadoNotificadoRef.current) {
      revocadoNotificadoRef.current = true;
      onCerrarRef.current();
    }
    if (tieneRolStaff) {
      eraStaffRef.current = true;
    }
  }, [tieneRolStaff]);

  const cargarDatosAdminAdicionales = React.useCallback(async () => {
    try {
      const [sol, cfg, desb, salas] = await Promise.all([
        obtenerSolicitudResetRankingAsync(),
        obtenerConfigSemanalAsync(),
        obtenerDesbloqueosPersonajesAsync(),
        obtenerSalasPersonalizadasAsync(),
      ]);
      setSolicitudReset(sol);
      if (desb) {
        setDesbloqueosDev(desb);
      }
      if (salas) {
        setSalasPersonalizadas(salas);
      }
      if (cfg) {
        setPuntos1(cfg.primerLugar ?? 50);
        setPuntos2(cfg.segundoLugar ?? 30);
        setPuntos3(cfg.tercerLugar ?? 15);
        setPuntosPart(cfg.participacion ?? 5);
        setPremioActivo(cfg.premioSemanal);
      }
    } catch {
      // Ignorar errores transitorios de red
    }
  }, []);

  const verificarRevocacionYActualizarLista = React.useCallback(
    (accs: Record<string, UserAccount>) => {
      setCuentas(accs);
      setEditandoId((prevEdit) => (prevEdit && !accs[prevEdit] ? null : prevEdit));
      setConfirmandoEliminarId((prevDel) => (prevDel && !accs[prevDel] ? null : prevDel));
      setInspectingUser((prevIns) => (prevIns && accs[prevIns.id] ? accs[prevIns.id] : null));

      const cur = usuarioActualRef.current;
      if (cur && cur.id !== 'admin' && cur.rol !== 'dev') {
        const fresh = accs[cur.id];
        if (!fresh) {
          if (!revocadoNotificadoRef.current) {
            revocadoNotificadoRef.current = true;
            onUsuarioActualizadoRef.current?.(null);
            onShowToastRef.current('⚠️ Tu cuenta ya no existe en la Database.');
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
        if (fresh.rol !== 'admin' && fresh.rol !== 'dev') {
          if (!revocadoNotificadoRef.current) {
            revocadoNotificadoRef.current = true;
            sounds.playError();
            onShowToastRef.current('⛔ Tus permisos de administración fueron revocados.');
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

        await cargarDatosAdminAdicionales();

        if (mostrarToastManual) {
          onShowToastRef.current(
            res.dbConectado
              ? '🟢 Sincronizado con la Database (D1)'
              : '⚠️ Sin conexión con la Database (D1)'
          );
        }
      } catch {
        if (mostrarToastManual) {
          onShowToastRef.current('⚠️ Error al contactar la Database');
        }
      } finally {
        if (mostrarToastManual) setSincronizando(false);
      }
    },
    [cargarDatosAdminAdicionales, verificarRevocacionYActualizarLista]
  );

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

  const verificarPermisoAccion = async (requiereSupremo: boolean = false): Promise<boolean> => {
    const check = await D1_VerificarAccionAdmin(usuarioActual || null, requiereSupremo);
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
    setEditClave('');
    setEditRol(acc.rol || 'jugador');
    setEditPuntos(acc.puntos);
    setEditVictorias(acc.victorias);
  };

  const guardarEdicion = async (id: string) => {
    sounds.playClick();
    const targetOriginal = cuentas[id];
    if (!targetOriginal) return;

    // Solo el Dev Supremo puede alterar roles mayores a mod o tocar admins
    const cambioRolMayor = editRol === 'admin' || editRol === 'dev' || targetOriginal.rol === 'admin';
    const autorizado = await verificarPermisoAccion(cambioRolMayor);
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
        rol: esYoSupremo ? editRol : (editRol === 'mod' ? 'mod' : 'jugador'),
        puntos: editPuntos,
        victorias: editVictorias,
      };
      if (esYoSupremo && editClave.trim()) {
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
        onShowToast(`✅ Cambios de "${nombreLimpio}" guardados en Database`);
      } else {
        sounds.playError();
        onShowToast(res.error || '⚠️ No se pudo actualizar el perfil');
      }
    } catch {
      onShowToast('❌ Error de red al guardar en la Database');
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarEliminarUsuario = async (id: string, nombre: string) => {
    sounds.playClick();
    if (!esYoSupremo) {
      onShowToast('⛔ Solo el Dev Supremo puede eliminar cuentas permanentemente.');
      return;
    }
    const autorizado = await verificarPermisoAccion(true);
    if (!autorizado) return;

    setGuardando(true);
    try {
      const res = await adminEliminarUsuarioAsync(id);
      if (res.ok) {
        const actualizadas = cargarCuentas();
        setCuentas(actualizadas);
        setConfirmandoEliminarId(null);
        onShowToast(`🗑️ Usuario "${nombre}" eliminado de la Database`);
      } else {
        sounds.playError();
        onShowToast(res.error || '⚠️ No se pudo eliminar el usuario');
      }
    } catch {
      onShowToast('❌ Error al eliminar en la Database');
    } finally {
      setGuardando(false);
    }
  };

  // Reset directo para Dev
  const ejecutarResetRankingGlobal = async () => {
    sounds.playClick();
    const autorizado = await verificarPermisoAccion(true);
    if (!autorizado) return;

    setGuardando(true);
    try {
      const res = await adminResetearRankingAsync();
      if (res.ok) {
        const actualizadas = cargarCuentas();
        setCuentas(actualizadas);
        setConfirmandoResetRanking(false);
        setSolicitudReset(null);
        if (usuarioActual && usuarioActual.id !== 'admin' && actualizadas[usuarioActual.id]) {
          onUsuarioActualizado?.(actualizadas[usuarioActual.id]);
        }
        onShowToast('🧹 Ranking Global reiniciado a cero en la Database');
      } else {
        sounds.playError();
        onShowToast(res.error || '⚠️ No se pudo reiniciar el Ranking');
      }
    } catch {
      onShowToast('❌ Error al reiniciar el Ranking');
    } finally {
      setGuardando(false);
    }
  };

  // Solicitud de reset para Admin
  const solicitarResetRanking = async () => {
    sounds.playClick();
    setGuardando(true);
    try {
      const res = await solicitarResetRankingAsync('Reinicio semanal solicitado desde el panel');
      if (res.ok) {
        onShowToast('📨 Solicitud enviada al Dev Supremo');
        setSolicitudReset({
          solicitada: true,
          porNombre: usuarioActual?.nombre || 'Admin',
          porId: usuarioActual?.id || 'admin',
          fecha: new Date().toLocaleDateString(),
          motivo: 'Reinicio semanal solicitado',
        });
      } else {
        onShowToast(res.error || 'No se pudo enviar la solicitud');
      }
    } catch {
      onShowToast('❌ Error al conectar con la Database');
    } finally {
      setGuardando(false);
    }
  };

  const responderSolicitudReset = async (aprobar: boolean) => {
    sounds.playClick();
    setGuardando(true);
    try {
      if (aprobar) {
        const res = await aprobarResetRankingAsync();
        if (res.ok) {
          const actualizadas = cargarCuentas();
          setCuentas(actualizadas);
          setSolicitudReset(null);
          onShowToast('✅ Solicitud aprobada y Ranking reiniciado a 0');
        } else {
          onShowToast(res.error || 'Error al aprobar solicitud');
        }
      } else {
        const res = await rechazarResetRankingAsync();
        if (res.ok) {
          setSolicitudReset(null);
          onShowToast('❌ Solicitud de reinicio descartada');
        } else {
          onShowToast(res.error || 'Error al descartar solicitud');
        }
      }
    } finally {
      setGuardando(false);
    }
  };

  // Guardar puntos de torneo semanal
  const handleGuardarPuntosTorneo = async () => {
    sounds.playClick();
    setGuardandoTorneo(true);
    try {
      const res = await guardarConfigSemanalAsync({
        primerLugar: puntos1,
        segundoLugar: puntos2,
        tercerLugar: puntos3,
        participacion: puntosPart,
      });
      if (res.ok) {
        onShowToast('✅ Puntos semanales actualizados en la Database');
      } else {
        onShowToast(res.error || 'Error al guardar configuración');
      }
    } finally {
      setGuardandoTorneo(false);
    }
  };

  // Regalar personaje creado
  const handleRegalarPersonaje = async () => {
    if (!editorTargetId) {
      onShowToast('⚠️ Selecciona un jugador para regalar el personaje');
      return;
    }
    sounds.playClick();
    setGuardandoEditor(true);
    try {
      const nuevoChar: Omit<PersonajeColeccionable, 'id' | 'origen'> = {
        nombre: editorNombre.trim() || 'Personaje Exclusivo',
        color: editorColor,
        hat: editorHat,
        ropa: editorRopa,
        ropaColor: editorRopa !== 'ninguna' ? editorRopaColor : undefined,
        aura: editorAura,
      };
      const res = await regalarPersonajeAsync(editorTargetId, nuevoChar);
      if (res.ok) {
        sounds.playVictory();
        const accs = cargarCuentas();
        setCuentas(accs);
        const targetAcc = accs[editorTargetId];
        onShowToast(`🎁 ¡"${nuevoChar.nombre}" entregado con éxito a ${targetAcc?.nombre || 'jugador'}!`);
      } else {
        onShowToast(res.error || 'Error al entregar personaje');
      }
    } finally {
      setGuardandoEditor(false);
    }
  };

  // Fijar como premio semanal activo
  const handleFijarPremioSemanal = async () => {
    sounds.playClick();
    setGuardandoEditor(true);
    try {
      const nuevoPremio: Omit<PersonajeColeccionable, 'id' | 'origen'> = {
        nombre: editorNombre.trim() || 'Campeón Semanal',
        color: editorColor,
        hat: editorHat,
        ropa: editorRopa,
        ropaColor: editorRopa !== 'ninguna' ? editorRopaColor : undefined,
        aura: editorAura,
      };
      const res = await fijarPremioSemanalAsync(nuevoPremio);
      if (res.ok) {
        sounds.playVictory();
        const premioGuardado = (res.premioSemanal || nuevoPremio) as PersonajeColeccionable;
        setPremioActivo(premioGuardado);
        onShowToast(`🏆 ¡"${nuevoPremio.nombre}" fijado como premio del Torneo Semanal!`);
      } else {
        onShowToast(res.error || 'Error al fijar premio semanal');
      }
    } finally {
      setGuardandoEditor(false);
    }
  };

  // Guardar requisitos de puntos para desbloqueo de personajes base (Solo Dev)
  const handleGuardarDesbloqueosBase = async () => {
    sounds.playClick();
    setGuardandoDesbloqueos(true);
    try {
      const res = await guardarDesbloqueosPersonajesAsync(desbloqueosDev);
      if (res.ok) {
        onShowToast('✅ Requisitos de puntos actualizados en Database');
      } else {
        onShowToast(res.error || 'Error al guardar requisitos');
      }
    } finally {
      setGuardandoDesbloqueos(false);
    }
  };

  // Crear Sala Personalizada en Línea (Staff)
  const handleCrearSalaPersonalizada = async () => {
    const cleanCode = nuevaSalaCodigo.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!cleanCode || cleanCode.length < 3) {
      onShowToast('⚠️ El código de sala debe tener al menos 3 caracteres alfanuméricos.');
      return;
    }
    sounds.playClick();
    setCreandoSala(true);
    try {
      const res = await crearSalaPersonalizadaAsync({
        codigo: cleanCode,
        nombre: nuevaSalaNombre.trim() || `Sala Oficial ${cleanCode}`,
        maxJugadores: nuevaSalaMaxJugadores,
        modoMuros: nuevaSalaModo,
        tamanoTablero: nuevaSalaTablero,
        mensajeEspecial: nuevaSalaMensaje.trim(),
        destacada: true,
      });
      if (res.ok && res.sala) {
        sounds.playVictory();
        setSalasPersonalizadas((prev) => [res.sala!, ...prev.filter((s) => s.codigo !== cleanCode)]);
        setNuevaSalaCodigo('');
        setNuevaSalaNombre('');
        setNuevaSalaMensaje('');
        onShowToast(`🎉 ¡Sala personalizada "${cleanCode}" creada y publicada en el Lobby!`);
      } else {
        onShowToast(res.error || 'No se pudo crear la sala.');
      }
    } finally {
      setCreandoSala(false);
    }
  };

  // Eliminar Sala Personalizada (Staff)
  const handleEliminarSalaPersonalizada = async (codigo: string) => {
    sounds.playClick();
    const res = await eliminarSalaPersonalizadaAsync(codigo);
    if (res.ok) {
      setSalasPersonalizadas((prev) => prev.filter((s) => s.codigo !== codigo));
      onShowToast(`🗑️ Sala "${codigo}" eliminada.`);
    } else {
      onShowToast(res.error || 'No se pudo eliminar la sala.');
    }
  };

  // Quitar personaje del inventario (exclusivo Dev)
  const handleQuitarPersonaje = async (userId: string, personajeId: string) => {
    sounds.playClick();
    const res = await quitarPersonajeInventarioAsync(userId, personajeId);
    if (res.ok) {
      const accs = cargarCuentas();
      setCuentas(accs);
      if (inspectingUser && inspectingUser.id === userId) {
        setInspectingUser(accs[userId] || null);
      }
      onShowToast('🗑️ Personaje retirado del inventario');
    } else {
      onShowToast(res.error || 'No se pudo retirar el personaje');
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
        onShowToast('✅ Database restaurada');
      } else {
        onShowToast('❌ Archivo de respaldo inválido');
      }
    };
    reader.readAsText(file);
  };

  const cuentasFiltradas = Object.values(cuentas).filter((acc) =>
    acc.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  const listaJugadoresNormales = Object.values(cuentas).filter(
    (acc) => acc.id !== 'admin'
  );

  // Paleta de colores predefinidos para el editor
  const coloresDisponibles = [
    '#ffd43b', '#ff6b6b', '#339af0', '#51cf66',
    '#cc5de8', '#ff922b', '#20c997', '#f06595',
    '#845ef7', '#4dabf7', '#343a40', '#adb5bd',
  ];

  // Paleta de colores para atuendos y ropas
  const coloresRopaDisponibles = [
    '#c92a2a', '#1971c2', '#212529', '#2b8a3e',
    '#7048e8', '#f59f00', '#868e96', '#ffffff',
    '#fab005', '#e03131', '#1098ad', '#5c7cfa',
  ];

  const sombrerosDisponibles: HatType[] = [
    'corona', 'pompon', 'antena', 'brote', 'mago',
    'gatito', 'zorro', 'robot', 'dragon', 'ninja',
    'navidad', 'granjero', 'vikingo', 'copa', 'gorra', 'boina', 'espacial',
  ];

  const ropasDisponibles: { id: PersonajeRopaType; label: string; icon: string }[] = [
    { id: 'ninguna', label: 'Sin Ropa', icon: '👕' },
    { id: 'capa', label: 'Capa Real', icon: '🧣' },
    { id: 'armadura', label: 'Armadura', icon: '🛡️' },
    { id: 'tunica', label: 'Túnica', icon: '🥋' },
    { id: 'tuxedo', label: 'Tuxedo', icon: '🤵' },
    { id: 'cinturon', label: 'Cinturón Oro', icon: '🥋' },
    { id: 'alas', label: 'Alas Cósmicas', icon: '🪽' },
  ];

  const aurasDisponibles: { id: PersonajeAuraType; label: string; icon: string }[] = [
    { id: 'ninguna', label: 'Sin Aura', icon: '⚪' },
    { id: 'dorada', label: 'Dorada', icon: '✨' },
    { id: 'fuego', label: 'Fuego', icon: '🔥' },
    { id: 'ciber', label: 'Cíber Neón', icon: '⚡' },
    { id: 'arcoiris', label: 'Arcoíris', icon: '🌈' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-xl bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_12px_0_#2b2140,0_25px_35px_rgba(0,0,0,0.4)] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-[#2b2140]/15">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{esYoSupremo ? '👑' : '🛡️'}</span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#2b2140] leading-none">
                {esYoSupremo ? 'Consola de Desarrollo (Dev)' : 'Panel de Moderación & Admin'}
              </h3>
              <span className="text-[11px] font-bold text-[#86542d]">
                {esYoSupremo ? 'Control Total de la Database D1' : `Administrador: ${usuarioActual?.nombre}`}
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

        {!tieneRolStaff ? (
          <div className="flex flex-col items-center gap-3 my-6 text-center">
            <span className="text-4xl">🔒</span>
            <p className="text-xs sm:text-sm text-[#593922] font-bold leading-relaxed">
              Para acceder al Panel de Administración, inicia sesión con tu cuenta de Staff o con el Dev Supremo en la Database.
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
            {/* Status Bar */}
            {!diag.dbConectado ? (
              <div className="p-2.5 rounded-2xl border-2 border-[#c92a2a] bg-[#ffe3e3] text-[#c92a2a] text-xs font-bold flex items-center justify-between gap-2 shadow-sm">
                <div className="flex-1">
                  <div className="font-black text-[#a61e1e] flex items-center gap-1">
                    <span>⚠️</span>
                    <span>SIN CONEXIÓN A DATABASE (D1)</span>
                  </div>
                  <p className="text-[10px] leading-tight mt-0.5">
                    Las acciones se sincronizarán en cuanto se restablezca la conexión con la Database.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => sincronizar(true)}
                  disabled={sincronizando}
                  className="py-1 px-2 rounded-xl bg-white border-2 border-[#c92a2a] text-[11px] font-black text-[#c92a2a] cursor-pointer shrink-0"
                >
                  {sincronizando ? '⏳...' : '🔄 Reconectar'}
                </button>
              </div>
            ) : (
              <div className="p-2 rounded-2xl border-2 border-[#2b2140] bg-[#d3f9d8] text-[#134e20] text-xs font-black flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base">{esYoSupremo ? '👑' : '🛡️'}</span>
                  <div className="leading-tight truncate">
                    <span className="block truncate text-xs">
                      {esYoSupremo ? 'Sesión Suprema: Dev Activo' : `Admin: ${usuarioActual?.nombre}`}
                    </span>
                    <span className="text-[10px] font-bold text-[#2b8a3e]">
                      🟢 Database D1 Conectada ({diag.serverPingMs} ms)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => sincronizar(true)}
                  disabled={sincronizando}
                  className="py-1 px-2 rounded-lg bg-white border border-[#2b2140] text-[10px] font-black text-[#2b2140] shadow-sm hover:bg-[#f1f3f5] cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span className={sincronizando ? 'animate-spin' : ''}>🔄</span>
                  <span>Sincronizar</span>
                </button>
              </div>
            )}

            {/* Pestañas de Navegación */}
            <div className="flex gap-1.5 bg-[#ebdcc2] p-1 rounded-2xl border-2 border-[#2b2140]">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setAdminTab('jugadores');
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  adminTab === 'jugadores'
                    ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : 'text-[#5c3c00] hover:bg-white/40'
                }`}
              >
                <span>👥</span>
                <span>Jugadores</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setAdminTab('editor');
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  adminTab === 'editor'
                    ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : 'text-[#5c3c00] hover:bg-white/40'
                }`}
              >
                <span>🎨</span>
                <span>Editor de Personajes</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setAdminTab('torneo');
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  adminTab === 'torneo'
                    ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : 'text-[#5c3c00] hover:bg-white/40'
                }`}
              >
                <span>🏆</span>
                <span>Torneo & Premios</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setAdminTab('salas');
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  adminTab === 'salas'
                    ? 'bg-white text-[#2b2140] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                    : 'text-[#5c3c00] hover:bg-white/40'
                }`}
              >
                <span>🎮</span>
                <span>Salas Online (Mod)</span>
              </button>
            </div>

            {/* Banner de Solicitud de Reset Pendiente */}
            {solicitudReset?.solicitada && (
              <div className="p-3 bg-[#fff3bf] border-2 border-[#f59f00] rounded-2xl text-xs flex flex-col gap-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📨</span>
                    <div>
                      <span className="font-black text-[#d9480f] block">
                        Solicitud de Reinicio de Ranking Semanal
                      </span>
                      <span className="text-[11px] text-[#7f4f10] block">
                        Pedida por <strong>{solicitudReset.porNombre}</strong> ({solicitudReset.fecha})
                      </span>
                    </div>
                  </div>
                  {esYoSupremo ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => responderSolicitudReset(true)}
                        className="py-1 px-2 rounded-lg bg-[#51cf66] text-[#134e20] border border-[#2b2140] font-black text-[11px] hover:bg-[#40c057] cursor-pointer"
                      >
                        ✓ Aprobar y Reiniciar
                      </button>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => responderSolicitudReset(false)}
                        className="py-1 px-2 rounded-lg bg-[#ffc9c9] text-[#c92a2a] border border-[#2b2140] font-black text-[11px] hover:bg-[#ffa8a8] cursor-pointer"
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-[#f59f00] font-black text-[#d9480f]">
                      ⏳ Esperando al Dev
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* TAB 1: JUGADORES */}
            {adminTab === 'jugadores' && (
              <div className="flex flex-col gap-3">
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
                            onShowToast('📋 Clave copiada al portapapeles');
                          }}
                          className="px-2 py-1 bg-[#1971c2] text-white rounded text-[11px] font-bold cursor-pointer hover:bg-[#1864ab]"
                        >
                          Copiar
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-[#495057]">
                        Esta clave fue cifrada en la Database. Pásasela al usuario.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClaveTemporalInfo(null)}
                      className="p-1 rounded text-[#1971c2] hover:bg-[#d0ebff] font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Lista de Cuentas */}
                <div className="flex flex-col gap-2">
                  {cuentasFiltradas.map((acc) => {
                    const isEditing = editandoId === acc.id;
                    const isRootAdmin = acc.id === 'admin';
                    const isAccountDev = acc.rol === 'dev' || isRootAdmin;
                    const isConfirmingDelete = confirmandoEliminarId === acc.id;
                    const cantInventario = acc.inventario?.personajes?.length || 0;

                    // El root dev ('admin') no puede ser modificado por nadie.
                    // Si la cuenta es 'dev', solo el Admin Supremo Único puede editarla o revocarla.
                    // Si la cuenta es 'admin', cualquier Dev (Supremo) puede editarla.
                    // Si la cuenta es 'mod' o 'jugador', cualquier Admin o Dev puede editarla.
                    const puedeEditarEstaCuenta = !isRootAdmin && (
                      isAccountDev
                        ? esAdminSupremoUnico
                        : acc.rol === 'admin'
                        ? esYoSupremo
                        : esAdmin
                    );

                    const badgeRol =
                      acc.id === 'admin' || acc.rol === 'dev' ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#ffe8cc] text-[#d9480f] border border-[#ffa94d]">
                          👑 DEV
                        </span>
                      ) : acc.rol === 'admin' ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#dbe4ff] text-[#364fc7] border border-[#91a7ff]">
                          🛡️ ADMIN
                        </span>
                      ) : acc.rol === 'mod' ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#e6fcf5] text-[#099268] border border-[#63e6be]">
                          🔰 MOD
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#f1f3f5] text-[#495057]">
                          🎮 JUGADOR
                        </span>
                      );

                    return (
                      <div
                        key={acc.id}
                        className="p-3 rounded-2xl border-2 border-[#2b2140] bg-white shadow-sm flex flex-col gap-2"
                      >
                        {!isEditing ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <CartoonCharacter
                                  color={acc.avatarColor}
                                  hat={acc.avatarHat}
                                  ropa={acc.avatarRopa}
                                  aura={acc.avatarAura}
                                  size={36}
                                  showShadow={false}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-xs sm:text-sm text-[#2b2140] truncate">
                                      {acc.nombre}
                                    </span>
                                    {badgeRol}
                                  </div>
                                  <span className="text-[11px] text-[#86542d] font-semibold block truncate">
                                    {acc.puntos} pts · {acc.victorias} vic · ELO {acc.elo || 1000}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Botón ver Inventario */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    sounds.playClick();
                                    setInspectingUser(acc);
                                  }}
                                  className="py-1 px-2 rounded-lg border border-[#2b2140] bg-[#fff3bf] text-[11px] font-black text-[#5c3c00] hover:bg-[#ffe066] cursor-pointer flex items-center gap-1"
                                  title="Ver inventario de personajes exclusivos"
                                >
                                  <span>🎒</span>
                                  <span>{cantInventario}</span>
                                </button>

                                {puedeEditarEstaCuenta && (
                                  <>
                                    {esYoSupremo && (
                                      <button
                                        type="button"
                                        onClick={() => handleRestablecerClave(acc.id, acc.nombre)}
                                        className="p-1.5 rounded-lg border border-[#2b2140] bg-[#e7f5ff] text-xs hover:bg-[#d0ebff] cursor-pointer"
                                        title="Restablecer clave temporal (Solo Dev)"
                                      >
                                        🔑
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => iniciarEdicion(acc)}
                                      className="p-1.5 rounded-lg border border-[#2b2140] bg-[#fff9db] text-xs hover:bg-[#fff3bf] cursor-pointer"
                                      title="Editar jugador"
                                    >
                                      ✏️
                                    </button>
                                  </>
                                )}

                                {esYoSupremo && acc.id !== 'admin' && acc.id !== usuarioActual?.id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sounds.playClick();
                                      setConfirmandoEliminarId(acc.id);
                                    }}
                                    className="p-1.5 rounded-lg border border-[#2b2140] bg-[#ffe3e3] text-xs hover:bg-[#ffc9c9] cursor-pointer"
                                    title="Eliminar permanentemente de la Database"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Confirmación eliminación */}
                            {isConfirmingDelete && (
                              <div className="p-2.5 bg-[#ffe3e3] rounded-xl border border-[#c92a2a] flex items-center justify-between gap-2 text-xs">
                                <span className="font-black text-[#c92a2a]">
                                  ¿Eliminar a "{acc.nombre}" de la Database?
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
                          /* Formulario de Edición */
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
                              {esYoSupremo ? (
                                <div>
                                  <label className="font-bold text-[#86542d] block">Nueva Clave (Solo Dev):</label>
                                  <input
                                    type="password"
                                    placeholder="Dejar vacío para no cambiar"
                                    value={editClave}
                                    onChange={(e) => setEditClave(e.target.value)}
                                    className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-bold text-xs"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center text-[10px] text-[#86542d] italic pt-4">
                                  🔒 Claves protegidas (Solo Dev)
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="font-bold text-[#86542d] block">Puntos:</label>
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

                            <div className="text-xs">
                              <label className="font-bold text-[#86542d] block">Rol Asignado:</label>
                              {esAdminSupremoUnico ? (
                                <select
                                  value={editRol}
                                  onChange={(e) => setEditRol(e.target.value as UserRole)}
                                  className="w-full bg-[#fff9db] border border-[#2b2140] rounded px-2 py-1 font-bold text-xs cursor-pointer"
                                >
                                  <option value="jugador">🎮 Jugador Normal</option>
                                  <option value="mod">🔰 Moderador</option>
                                  <option value="admin">🛡️ Administrador</option>
                                  <option value="dev">👑 Dev Supremo (Acceso Total)</option>
                                </select>
                              ) : esYoSupremo ? (
                                <select
                                  value={editRol === 'dev' ? 'dev' : editRol}
                                  disabled={editRol === 'dev'}
                                  onChange={(e) => setEditRol(e.target.value as UserRole)}
                                  className="w-full bg-[#fff9db] border border-[#2b2140] rounded px-2 py-1 font-bold text-xs cursor-pointer"
                                >
                                  <option value="jugador">🎮 Jugador Normal</option>
                                  <option value="mod">🔰 Moderador</option>
                                  <option value="admin">🛡️ Administrador</option>
                                </select>
                              ) : (
                                <select
                                  value={editRol === 'mod' ? 'mod' : 'jugador'}
                                  onChange={(e) => setEditRol(e.target.value as UserRole)}
                                  className="w-full bg-[#fff9db] border border-[#2b2140] rounded px-2 py-1 font-bold text-xs cursor-pointer"
                                >
                                  <option value="jugador">🎮 Jugador Normal</option>
                                  <option value="mod">🔰 Promover a Moderador</option>
                                </select>
                              )}
                            </div>

                            <div className="flex justify-end gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => setEditandoId(null)}
                                className="px-2.5 py-1 rounded bg-[#f1f3f5] border border-[#2b2140] text-xs font-bold cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={guardando}
                                onClick={() => guardarEdicion(acc.id)}
                                className="px-3 py-1 rounded bg-[#51cf66] text-[#134e20] border border-[#2b2140] text-xs font-black cursor-pointer shadow-sm"
                              >
                                {guardando ? 'Guardando...' : '💾 Guardar Cambios'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Zona de Peligro / Reset de Ranking */}
                <div className="p-3 bg-[#fff5f5] rounded-2xl border-2 border-[#ffc9c9] shadow-sm flex flex-col gap-2 mt-1">
                  <span className="font-black text-xs text-[#c92a2a] flex items-center gap-1.5">
                    <span>⚠️</span> Reinicio de Ranking Semanal
                  </span>
                  <p className="text-[11px] text-[#e03131] font-medium leading-relaxed">
                    {esYoSupremo
                      ? 'Como Dev Supremo, puedes reiniciar inmediatamente todos los puntos del Ranking a cero.'
                      : 'Como Admin, puedes solicitar formalmente al Dev el reinicio del ranking semanal.'}
                  </p>

                  {esYoSupremo ? (
                    !confirmandoResetRanking ? (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setConfirmandoResetRanking(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl font-black text-xs bg-[#ffe3e3] text-[#c92a2a] border-2 border-[#ffa8a8] hover:bg-[#ffc9c9] cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <span>🧹</span>
                        <span>Reiniciar Todo el Ranking Global a Cero</span>
                      </button>
                    ) : (
                      <div className="p-3 bg-[#ffe3e3] rounded-xl border-2 border-[#c92a2a] flex flex-col gap-2">
                        <span className="text-xs font-black text-[#a61e1e]">
                          🚨 ¿CONFIRMAS reiniciar todo el Ranking Global a 0 en la Database D1?
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={() => setConfirmandoResetRanking(false)}
                            className="flex-1 py-1.5 rounded-xl bg-white border border-[#2b2140] text-xs font-bold text-[#2b2140] cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={ejecutarResetRankingGlobal}
                            className="flex-1 py-1.5 rounded-xl bg-[#c92a2a] border-2 border-[#2b2140] text-xs font-black text-white hover:bg-[#a61e1e] cursor-pointer shadow-sm"
                          >
                            {guardando ? '⏳ Borrando...' : '✓ Sí, reiniciar'}
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled={guardando || Boolean(solicitudReset?.solicitada)}
                      onClick={solicitarResetRanking}
                      className="w-full py-2 px-3 rounded-xl font-black text-xs bg-[#fff3bf] text-[#d9480f] border-2 border-[#f59f00] hover:bg-[#ffe066] cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>📨</span>
                      <span>
                        {solicitudReset?.solicitada
                          ? '⏳ Solicitud enviada al Dev (Pendiente)'
                          : 'Solicitar Reinicio de Ranking al Dev'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Copia de Seguridad */}
                <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex flex-col gap-2">
                  <span className="font-black text-xs text-[#2b2140] flex items-center gap-1.5">
                    <span>📦</span> Copia de Seguridad JSON
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
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
                        🔒 Restaurar (Dev)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EDITOR VISUAL DE PERSONAJES */}
            {adminTab === 'editor' && (
              <div className="flex flex-col gap-3">
                {/* Tarjeta de Previsualización en Vivo */}
                <div className="p-4 bg-gradient-to-b from-[#f8f0fc] to-[#eebefa] rounded-3xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] flex flex-col sm:flex-row items-center gap-4 justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/70 rounded-2xl border-2 border-[#2b2140] shadow-sm flex items-center justify-center">
                      <CartoonCharacter
                        size={84}
                        color={editorColor}
                        hat={editorHat}
                        ropa={editorRopa}
                        ropaColor={editorRopa !== 'ninguna' ? editorRopaColor : undefined}
                        aura={editorAura}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-wider uppercase text-[#862e9c] bg-white px-2 py-0.5 rounded-full border border-[#da77f2]">
                        Edición Exclusiva
                      </span>
                      <h4 className="text-base sm:text-lg font-black text-[#2b2140] leading-tight mt-1">
                        {editorNombre.trim() || 'Sin Nombre'}
                      </h4>
                      <div className="flex flex-wrap gap-1 mt-1 text-[10px] font-bold">
                        <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#2b2140]/20 text-[#495057]">
                          👒 {editorHat}
                        </span>
                        <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#2b2140]/20 text-[#495057]">
                          👕 {editorRopa}
                        </span>
                        <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#2b2140]/20 text-[#495057]">
                          ✨ {editorAura}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controles de Diseño */}
                <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex flex-col gap-2.5 text-xs">
                  <div>
                    <label className="font-black text-[#86542d] block mb-1">
                      Nombre del Personaje Exclusivo:
                    </label>
                    <input
                      type="text"
                      maxLength={24}
                      value={editorNombre}
                      onChange={(e) => setEditorNombre(e.target.value)}
                      placeholder="Ej: Guerrero del Dragón, Neón Ninja..."
                      className="w-full text-xs font-black bg-[#f8f9fa] border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none"
                    />
                  </div>

                  {/* Selector de Color */}
                  <div>
                    <label className="font-black text-[#86542d] block mb-1">Color Base del Cuerpo:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {coloresDisponibles.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setEditorColor(c);
                          }}
                          style={{ backgroundColor: c }}
                          className={`w-7 h-7 rounded-full border-2 border-[#2b2140] transition-transform cursor-pointer ${
                            editorColor === c ? 'scale-115 ring-3 ring-[#2b2140] shadow-md' : 'hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Selector de Sombreros */}
                  <div>
                    <label className="font-black text-[#86542d] block mb-1">Sombrero / Accesorio Cabeza:</label>
                    <div className="flex flex-wrap gap-1">
                      {sombrerosDisponibles.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setEditorHat(h);
                          }}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold border capitalize transition-all cursor-pointer ${
                            editorHat === h
                              ? 'bg-[#ffd43b] text-[#5c3c00] border-[#2b2140] font-black shadow-sm'
                              : 'bg-[#f8f9fa] text-[#495057] border-[#ced4da] hover:bg-[#e9ecef]'
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selector de Ropa */}
                  <div>
                    <label className="font-black text-[#86542d] block mb-1">Ropa & Atuendo Exclusivo:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                      {ropasDisponibles.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setEditorRopa(r.id);
                          }}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            editorRopa === r.id
                              ? 'bg-[#d3f9d8] text-[#134e20] border-[#2b2140] font-black shadow-sm'
                              : 'bg-[#f8f9fa] text-[#495057] border-[#ced4da] hover:bg-[#e9ecef]'
                          }`}
                        >
                          <span>{r.icon}</span>
                          <span className="truncate">{r.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Selector de Color de Ropa */}
                    {editorRopa !== 'ninguna' && (
                      <div className="mt-2 p-2 bg-[#f8f9fa] rounded-xl border border-[#ced4da]">
                        <label className="font-bold text-[#86542d] block text-[11px] mb-1">
                          🎨 Color del Atuendo / Ropa:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {coloresRopaDisponibles.map((rc) => (
                            <button
                              key={rc}
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setEditorRopaColor(rc);
                              }}
                              style={{ backgroundColor: rc }}
                              className={`w-6 h-6 rounded-full border-2 border-[#2b2140] transition-transform cursor-pointer ${
                                editorRopaColor === rc ? 'scale-120 ring-2 ring-[#2b2140] shadow-md' : 'hover:scale-105'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selector de Aura */}
                  <div>
                    <label className="font-black text-[#86542d] block mb-1">Efecto Especial de Aura:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
                      {aurasDisponibles.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setEditorAura(a.id);
                          }}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            editorAura === a.id
                              ? 'bg-[#e7f5ff] text-[#1864ab] border-[#2b2140] font-black shadow-sm'
                              : 'bg-[#f8f9fa] text-[#495057] border-[#ced4da] hover:bg-[#e9ecef]'
                          }`}
                        >
                          <span>{a.icon}</span>
                          <span className="truncate">{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Acciones del Editor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Opción 1: Regalar a un Jugador */}
                  <div className="p-3 bg-[#e7f5ff] rounded-2xl border-2 border-[#1971c2] flex flex-col gap-2">
                    <span className="text-xs font-black text-[#1864ab] flex items-center gap-1">
                      <span>🎁</span> Opción A: Regalar a un Jugador
                    </span>
                    <select
                      value={editorTargetId}
                      onChange={(e) => setEditorTargetId(e.target.value)}
                      className="w-full text-xs font-bold bg-white border-2 border-[#1971c2] rounded-xl px-2 py-1.5 outline-none cursor-pointer"
                    >
                      <option value="">Selecciona destinatario...</option>
                      {listaJugadoresNormales.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.puntos} pts)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={guardandoEditor || !editorTargetId}
                      onClick={handleRegalarPersonaje}
                      className="w-full py-2 rounded-xl font-black text-xs bg-[#339af0] text-white border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#228be6] disabled:opacity-50 cursor-pointer"
                    >
                      {guardandoEditor ? '⏳ Entregando...' : '🎁 Otorgar a Inventario'}
                    </button>
                  </div>

                  {/* Opción 2: Fijar como Premio Semanal */}
                  <div className="p-3 bg-[#fff9db] rounded-2xl border-2 border-[#f59f00] flex flex-col gap-2 justify-between">
                    <div>
                      <span className="text-xs font-black text-[#d9480f] flex items-center gap-1">
                        <span>🏆</span> Opción B: Premio de Torneo
                      </span>
                      <p className="text-[11px] text-[#7f4f10] font-medium leading-tight mt-1">
                        El jugador que termine en 1er lugar del torneo el domingo se lo llevará de forma exclusiva a su inventario.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={guardandoEditor}
                      onClick={handleFijarPremioSemanal}
                      className="w-full py-2 rounded-xl font-black text-xs bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer"
                    >
                      {guardandoEditor ? '⏳ Fijando...' : '🏆 Fijar como Premio Semanal'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TORNEO & PREMIOS */}
            {adminTab === 'torneo' && (
              <div className="flex flex-col gap-3">
                {/* Premio Semanal Activo */}
                <div className="p-3.5 bg-gradient-to-r from-[#fff9db] to-[#ffe8cc] rounded-2xl border-2 border-[#f59f00] shadow-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#d9480f] flex items-center gap-1.5">
                      <span>🏆</span> Premio Activo para el Ganador de la Semana
                    </span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-[#f59f00] font-bold text-[#d9480f]">
                      Domingo medianoche
                    </span>
                  </div>

                  {premioActivo ? (
                    <div className="flex items-center gap-3 bg-white/80 p-2.5 rounded-xl border border-[#f59f00]/40">
                      <CartoonCharacter
                        size={56}
                        color={premioActivo.color}
                        hat={premioActivo.hat}
                        ropa={premioActivo.ropa}
                        ropaColor={premioActivo.ropaColor}
                        aura={premioActivo.aura}
                      />
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-[#2b2140] truncate">{premioActivo.nombre}</h4>
                        <span className="text-[11px] text-[#86542d] font-bold block">
                          Atuendo: {premioActivo.ropa || 'básico'} · Aura: {premioActivo.aura || 'ninguna'}
                        </span>
                        <span className="text-[10px] text-[#2b8a3e] font-black">
                          ✓ Se otorga automáticamente al 1er puesto del Ranking
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-white/70 rounded-xl text-center text-xs text-[#86542d] font-bold">
                      No hay premio exclusivo activo esta semana. Diseña uno en la pestaña <strong>[🎨 Editor de Personajes]</strong> y fíjalo como premio.
                    </div>
                  )}
                </div>

                {/* Configuración de Puntos Semanales */}
                <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex flex-col gap-3">
                  <div>
                    <h4 className="text-xs font-black text-[#2b2140] flex items-center gap-1.5">
                      <span>⚙️</span> Escala de Puntos Semanales
                    </h4>
                    <p className="text-[11px] text-[#86542d] font-medium mt-0.5">
                      Puntos sumados al Ranking Global al cerrar el Torneo Semanal cada domingo.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-[#fff9db] rounded-xl border border-[#ffd43b]">
                      <label className="font-black text-[#5c3c00] block text-[11px]">🥇 1er Puesto:</label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={puntos1}
                        onChange={(e) => setPuntos1(Number(e.target.value))}
                        className="w-full bg-white border border-[#2b2140] rounded px-1.5 py-1 font-black text-xs mt-1"
                      />
                    </div>
                    <div className="p-2 bg-[#f1f3f5] rounded-xl border border-[#ced4da]">
                      <label className="font-black text-[#495057] block text-[11px]">🥈 2do Puesto:</label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={puntos2}
                        onChange={(e) => setPuntos2(Number(e.target.value))}
                        className="w-full bg-white border border-[#2b2140] rounded px-1.5 py-1 font-black text-xs mt-1"
                      />
                    </div>
                    <div className="p-2 bg-[#ffe8cc] rounded-xl border border-[#ffa94d]">
                      <label className="font-black text-[#d9480f] block text-[11px]">🥉 3er Puesto:</label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={puntos3}
                        onChange={(e) => setPuntos3(Number(e.target.value))}
                        className="w-full bg-white border border-[#2b2140] rounded px-1.5 py-1 font-black text-xs mt-1"
                      />
                    </div>
                    <div className="p-2 bg-[#e7f5ff] rounded-xl border border-[#a5d8ff]">
                      <label className="font-black text-[#1864ab] block text-[11px]">🎮 Participar:</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={puntosPart}
                        onChange={(e) => setPuntosPart(Number(e.target.value))}
                        className="w-full bg-white border border-[#2b2140] rounded px-1.5 py-1 font-black text-xs mt-1"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={guardandoTorneo}
                    onClick={handleGuardarPuntosTorneo}
                    className="w-full py-2 rounded-xl font-black text-xs bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#40c057] cursor-pointer"
                  >
                    {guardandoTorneo ? '⏳ Guardando en Database...' : '💾 Guardar Escala de Puntos en Database'}
                  </button>
                </div>

                {/* Requisitos de Desbloqueo de Personajes Base (Solo Dev) */}
                {esYoSupremo && (
                  <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex flex-col gap-3">
                    <div>
                      <h4 className="text-xs font-black text-[#2b2140] flex items-center gap-1.5">
                        <span>🔓</span> Requisitos de Desbloqueo de Personajes Base (Solo Dev)
                      </h4>
                      <p className="text-[11px] text-[#86542d] font-medium mt-0.5">
                        Puntos requeridos en el Ranking Global para que cada personaje base aparezca y se desbloquee a los usuarios. Los 5 iniciales siempre están disponibles desde 0 pts.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {[
                        { id: 'gatito', nombre: 'Gatito Curioso', icon: '🐱' },
                        { id: 'zorro', nombre: 'Zorro Astuto', icon: '🦊' },
                        { id: 'robot', nombre: 'Cyber Bot', icon: '🤖' },
                        { id: 'dragon', nombre: 'Dragón Guardián', icon: '🐲' },
                        { id: 'ninja', nombre: 'Ninja Maestro', icon: '🥷' },
                      ].map((item) => (
                        <div key={item.id} className="p-2 bg-[#f8f9fa] rounded-xl border border-[#2b2140]/20 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.icon}</span>
                            <div>
                              <span className="font-black text-xs text-[#2b2140] block">{item.nombre}</span>
                              <span className="text-[10px] text-[#86542d] block">Puntos mínimos:</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={10000}
                              value={desbloqueosDev[item.id] ?? 0}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value));
                                setDesbloqueosDev((prev) => ({ ...prev, [item.id]: val }));
                              }}
                              className="w-16 bg-white border border-[#2b2140] rounded px-1.5 py-1 font-black text-xs text-center"
                            />
                            <span className="text-[11px] font-bold text-[#86542d]">pts</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={guardandoDesbloqueos}
                      onClick={handleGuardarDesbloqueosBase}
                      className="w-full py-2 rounded-xl font-black text-xs bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer"
                    >
                      {guardandoDesbloqueos ? '⏳ Guardando Requisitos...' : '💾 Guardar Requisitos de Desbloqueo en Database'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: SALAS PERSONALIZADAS EN LÍNEA (MOD, ADMIN, DEV) */}
            {adminTab === 'salas' && (
              <div className="flex flex-col gap-3">
                {/* Formulario de Creación de Sala Oficial */}
                <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-[#2b2140] flex items-center gap-1.5">
                      <span>🔰</span> Crear Sala Oficial / Evento Personalizado
                    </h4>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#d3f9d8] text-[#134e20] border border-[#2b2140]">
                      Staff {esYoSupremo ? 'Dev' : esAdmin ? 'Admin' : 'Mod'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#86542d] leading-tight font-medium">
                    Las salas creadas aquí aparecen destacadas en la parte superior del Lobby Online para todos los jugadores con reglas personalizadas.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="font-bold text-[#86542d] block text-[11px]">Código de Sala:</label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="Ej: TORNEO1"
                        value={nuevaSalaCodigo}
                        onChange={(e) => setNuevaSalaCodigo(e.target.value.toUpperCase())}
                        className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-black text-xs uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#86542d] block text-[11px]">Nombre de la Sala / Evento:</label>
                      <input
                        type="text"
                        maxLength={32}
                        placeholder="Ej: Sala Oficial Moderación"
                        value={nuevaSalaNombre}
                        onChange={(e) => setNuevaSalaNombre(e.target.value)}
                        className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="font-bold text-[#86542d] block text-[11px]">Jugadores:</label>
                      <select
                        value={nuevaSalaMaxJugadores}
                        onChange={(e) => setNuevaSalaMaxJugadores(Number(e.target.value) as 2 | 4)}
                        className="w-full bg-[#fff9db] border border-[#2b2140] rounded px-1.5 py-1 font-bold text-xs cursor-pointer"
                      >
                        <option value={2}>2 Jugadores (1v1)</option>
                        <option value={4}>4 Jugadores (FFA)</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-[#86542d] block text-[11px]">Modo de Muros:</label>
                      <select
                        value={nuevaSalaModo}
                        onChange={(e) => setNuevaSalaModo(e.target.value as any)}
                        className="w-full bg-[#fff9db] border border-[#2b2140] rounded px-1.5 py-1 font-bold text-xs cursor-pointer"
                      >
                        <option value="estandar">🧱 Estándar (10 muros)</option>
                        <option value="tactico">🎯 Táctico (5 muros)</option>
                        <option value="caos">💥 Caos (15 muros)</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-[#86542d] block text-[11px]">Tablero:</label>
                      <select
                        value={nuevaSalaTablero}
                        onChange={(e) => setNuevaSalaTablero(Number(e.target.value) as 7 | 9)}
                        className="w-full bg-[#fff9db] border border-[#2b2140] rounded px-1.5 py-1 font-bold text-xs cursor-pointer"
                      >
                        <option value={9}>9 × 9 (Clásico)</option>
                        <option value={7}>7 × 7 (Rápido)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-[#86542d] block text-[11px]">Mensaje o Regla Especial (Opcional):</label>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="Ej: Sala de entrenamiento oficial para el torneo del fin de semana"
                      value={nuevaSalaMensaje}
                      onChange={(e) => setNuevaSalaMensaje(e.target.value)}
                      className="w-full bg-[#f8f9fa] border border-[#2b2140] rounded px-2 py-1 font-medium text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={creandoSala}
                    onClick={handleCrearSalaPersonalizada}
                    className="w-full py-2 rounded-xl font-black text-xs bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] hover:bg-[#40c057] cursor-pointer"
                  >
                    {creandoSala ? '⏳ Creando Sala Oficial...' : '✨ Publicar Sala Oficial en Lobby'}
                  </button>
                </div>

                {/* Lista de Salas Oficiales Activas */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#2b2140]">
                      Salas Oficiales Destacadas ({salasPersonalizadas.length})
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const s = await obtenerSalasPersonalizadasAsync();
                        setSalasPersonalizadas(s);
                      }}
                      className="text-[10px] font-bold text-[#1971c2] hover:underline cursor-pointer"
                    >
                      🔄 Actualizar
                    </button>
                  </div>

                  {salasPersonalizadas.length === 0 ? (
                    <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-[#2b2140]/30 text-center text-xs text-[#86542d] font-bold">
                      No hay salas personalizadas creadas actualmente.
                      <br />
                      ¡Crea una arriba para que los jugadores la vean destacada en el Lobby!
                    </div>
                  ) : (
                    salasPersonalizadas.map((sala) => (
                      <div
                        key={sala.codigo}
                        className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-sm flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-[#d9480f] bg-[#ffe8cc] px-2 py-0.5 rounded-lg border border-[#ffa94d]">
                              {sala.codigo}
                            </span>
                            <span className="font-black text-xs text-[#2b2140] truncate">
                              {sala.nombre}
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#dbe4ff] text-[#364fc7]">
                              {sala.maxJugadores} Jugadores · {sala.tamanoTablero || 9}x{sala.tamanoTablero || 9}
                            </span>
                          </div>
                          {sala.mensajeEspecial && (
                            <p className="text-[11px] text-[#2b8a3e] font-semibold mt-0.5 truncate">
                              💬 {sala.mensajeEspecial}
                            </p>
                          )}
                          <span className="text-[10px] text-[#86542d] block mt-0.5">
                            Creada por: <strong>{sala.creador}</strong> ({sala.creadorRol?.toUpperCase() || 'MOD'})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEliminarSalaPersonalizada(sala.codigo)}
                          className="p-1.5 rounded-xl bg-[#ffe3e3] border border-[#c92a2a] text-[#c92a2a] hover:bg-[#ffc9c9] cursor-pointer text-xs font-black shrink-0"
                          title="Eliminar esta sala oficial"
                        >
                          🗑️
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submodal Inspector de Inventario */}
        {inspectingUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
            <div className="relative w-full max-w-md bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-4 shadow-[0_10px_0_#2b2140] flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-[#2b2140]/15">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎒</span>
                  <div>
                    <h4 className="font-black text-sm text-[#2b2140] leading-tight">
                      Inventario de {inspectingUser.nombre}
                    </h4>
                    <span className="text-[10px] text-[#86542d] font-bold">
                      Personajes exclusivos coleccionados
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingUser(null)}
                  className="w-7 h-7 rounded-full bg-[#f1f3f5] border-2 border-[#2b2140] text-xs font-black hover:bg-[#ffe3e3] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 my-1">
                {(!inspectingUser.inventario?.personajes || inspectingUser.inventario.personajes.length === 0) ? (
                  <div className="p-6 text-center text-xs text-[#86542d] font-bold">
                    Este jugador no tiene personajes exclusivos aún en su inventario.
                    <br />
                    Puedes regalarle uno desde la pestaña <strong>[🎨 Editor de Personajes]</strong>.
                  </div>
                ) : (
                  inspectingUser.inventario.personajes.map((char) => (
                    <div
                      key={char.id}
                      className="p-2.5 rounded-2xl border-2 border-[#2b2140] bg-white flex items-center justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CartoonCharacter
                          size={44}
                          color={char.color}
                          hat={char.hat}
                          ropa={char.ropa}
                          ropaColor={char.ropaColor}
                          aura={char.aura}
                        />
                        <div className="min-w-0">
                          <span className="font-black text-xs text-[#2b2140] block truncate">
                            {char.nombre}
                          </span>
                          <span className="text-[10px] text-[#86542d] block">
                            Atuendo: {char.ropa || 'ninguno'} · Aura: {char.aura || 'ninguna'}
                          </span>
                          <span className="text-[9px] text-[#2b8a3e] font-black block">
                            {typeof char.origen === 'object' && char.origen?.tipo === 'torneo_semanal'
                              ? '🏆 Premio Torneo Semanal'
                              : typeof char.origen === 'object' && char.origen?.tipo === 'regalo_dev'
                              ? '👑 Regalo Dev Supremo'
                              : typeof char.origen === 'string'
                              ? `🎁 ${char.origen}`
                              : `🎁 Regalo de ${typeof char.origen === 'object' && char.origen?.otorgadoPor ? char.origen.otorgadoPor : 'Admin'}`}
                            {typeof char.origen === 'object' && char.origen?.fecha ? ` · ${char.origen.fecha}` : ''}
                          </span>
                        </div>
                      </div>

                      {esYoSupremo && (
                        <button
                          type="button"
                          onClick={() => handleQuitarPersonaje(inspectingUser.id, char.id)}
                          className="py-1 px-2 rounded-lg bg-[#ffe3e3] border border-[#c92a2a] text-[10px] font-black text-[#c92a2a] hover:bg-[#ffc9c9] cursor-pointer shrink-0"
                          title="Retirar personaje del inventario del usuario"
                        >
                          🗑️ Retirar
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
