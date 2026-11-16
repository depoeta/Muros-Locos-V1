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
  AjustesDeApp,
  AvatarTipoDeAura,
  AvatarTipoDeGorro,
  AvatarTipoDeRopa,
  UserCuenta,
  DefLogro,
  DesglosePuntos,
  EntradaRanking,
  EstadoDeJuego,
  EstadoTorneo,
  EstiloMuros,
  InfoNivel,
  RegDeAvatar,
  AvatarColeccionable,
  RespuestaRankingSemanal,
  UserRol,
  SalaPersonalizada,
  SolicitudResetRanking,
  TamanoTablero,
  TemaTablero,
} from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import { PWAInstallButton } from './PWAInstallControl';
import { ESTILO_MUROS_META, useMurosTheme } from '../game/murosTheme';
import {
  actualizarCuentaAsync,
  adminActualizarUserAsync,
  adminCambiarIdUserAsync,
  adminEliminarUserAsync,
  adminResetearRankingAsync,
  aprobarResetRankingAsync,
  borrarRankingLocal,
  cargarCuentas,
  cargarRanking,
  cargarRankingLocal,
  cerrarSesion,
  crearSalaPersonalizadaAsync,
  darDeBajaUserAsync,
  eliminarSalaPersonalizadaAsync,
  exportarDatosJSON,
  fijarPremioSemanalAsync,
  guardarConfigSemanalAsync,
  guardarDesbloqueosPersonajesAsync,
  importarDatosJSONAsync,
  iniciarSesionAsync,
  moverPersonajeInventarioAsync,
  obtenerConfigSemanalAsync,
  obtenerDesbloqueosLocales,
  obtenerDesbloqueosPersonajesAsync,
  obtenerSalasPersonalizadasAsync,
  obtenerSolicitudResetRankingAsync,
  quitarPersonajeInventarioAsync,
  rechazarResetRankingAsync,
  regalarPersonajeAsync,
  restablecerClaveUserAsync,
  solicitarResetRankingAsync,
  cambiarClaveUserAsync,
  LOGROS_LISTA,
  DiagnosticoDeRed,
  obtenerDiagnosticoRed,
  obtenerNivelYTitulo,
  obtenerRankingSemanalAsync,
  pingServidor,
  registrarUserAsync,
  sincronizarConNube,
  suscribirCambiosNube,
  suscribirDiagnostico,
  D1_VerificarAccionAdmin,
} from '../game/storage';

export const TEMAS_LISTA: {
  id: TemaTablero;
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
  personajeActual: { hat: AvatarTipoDeGorro; color: string; ropa?: AvatarTipoDeRopa; ropaColor?: string; aura?: AvatarTipoDeAura };
  temaActual: TemaTablero;
  userActual?: UserCuenta | null;
  onAplicar: (
    nuevoPersonaje: { hat: AvatarTipoDeGorro; color: string; ropa?: AvatarTipoDeRopa; ropaColor?: string; aura?: AvatarTipoDeAura },
    nuevoTema: TemaTablero
  ) => void;
  onuserActualizado?: (u: UserCuenta) => void;
  onShowToast?: (msg: string) => void;
}

export const AspectoModal: React.FC<AspectoModalProps> = ({
  onCerrar,
  personajeActual,
  temaActual,
  userActual,
  onAplicar,
  onuserActualizado,
  onShowToast,
}) => {
  const { t } = useMurosTheme();
  const [tabPersonaje, setTabPersonaje] = useState<'base' | 'inventario'>('base');
  const [selectedHat, setSelectedHat] = useState<AvatarTipoDeGorro>(personajeActual.hat || 'corona');
  const [selectedColor, setSelectedColor] = useState<string>(personajeActual.color || '#ff6b6b');
  const [selectedRopa, setSelectedRopa] = useState<AvatarTipoDeRopa>(
    personajeActual.ropa || userActual?.avatarRopa || 'ninguna'
  );
  const [selectedRopaColor, setSelectedRopaColor] = useState<string | undefined>(
    personajeActual.ropaColor || userActual?.avatarRopaColor
  );
  const [selectedAura, setSelectedAura] = useState<AvatarTipoDeAura>(
    personajeActual.aura || userActual?.avatarAura || 'ninguna'
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    userActual?.inventario?.activoId || null
  );
  const [selectedTema, setSelectedTema] = useState<TemaTablero>(temaActual || 'madera');
  const [guardarEnPerfil, setGuardarEnPerfil] = useState(Boolean(userActual));
  const [guardando, setGuardando] = useState(false);

  const userPoints = userActual?.puntos || 0;
  const esAdmin = Boolean(
    userActual &&
      (userActual.rol === 'admin' || userActual.rol === 'dev' || userActual.id === 'admin')
  );

  const [desbloqueosPuntos, setDesbloqueosPuntos] = useState<Record<string, number>>(() => obtenerDesbloqueosLocales());

  useEffect(() => {
    obtenerDesbloqueosPersonajesAsync().then((d) => setDesbloqueosPuntos(d));
  }, []);

  const personajesBaseConPuntos = useMemo(() => {
    return RegDeAvatar.map((p) => {
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

  const cuentaFresca = userActual ? cargarCuentas()[userActual.id] || userActual : null;
  const misExclusivos = cuentaFresca?.inventario?.personajes || userActual?.inventario?.personajes || [];
  const activeCharDef = RegDeAvatar.find((p) => p.id === selectedHat) || RegDeAvatar[0];

  const handleSeleccionarPersonajeBase = (p: (typeof RegDeAvatar)[0]) => {
    if (!isPersonajeDesbloqueado(p.puntosRequeridos)) {
      sounds.playError();
      onShowToast?.(`🔒 ${p.nombre} se desbloquea al alcanzar ${p.puntosRequeridos} puntos`);
      return;
    }
    sounds.playClick();
    setSelectedHat(p.id);
    setSelectedColor(p.colorDefault);
    setSelectedRopa('ninguna');
    setSelectedRopaColor(undefined);
    setSelectedAura('ninguna');
    setSelectedItemId(null);
  };

  const handleSeleccionarExclusivo = (item: AvatarColeccionable) => {
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
      if (userActual && guardarEnPerfil) {
        const cuentas = cargarCuentas();
        const baseUser = cuentas[userActual.id] || userActual;
        const invActual = baseUser.inventario || { personajes: [] };
        const res = await actualizarCuentaAsync(baseUser, {
          avatarHat: selectedHat,
          avatarColor: selectedColor,
          avatarRopa: selectedRopa,
          avatarRopaColor: selectedRopa !== 'ninguna' ? selectedRopaColor : undefined,
          avatarAura: selectedAura,
          inventario: {
            ...invActual,
            activoId: selectedItemId || undefined,
          },
          temaTablero: selectedTema,
        });
        if (res.ok && res.user) {
          onuserActualizado?.(res.user);
          onShowToast?.('⭐ Avatar y terreno guardados como predeterminados en tu perfil');
        } else {
          sounds.playError();
          onShowToast?.(res.error || '⚠️ No se pudo guardar en tu perfil');
        }
      }

      onAplicar(
        { hat: selectedHat, color: selectedColor, ropa: selectedRopa, ropaColor: selectedRopaColor, aura: selectedAura },
        selectedTema
      );
      onCerrar();
    } catch {
      sounds.playError();
      onShowToast?.('⚠️ Error de red al guardar en tu perfil. Verifica tu conexión.');
      onAplicar(
        { hat: selectedHat, color: selectedColor, ropa: selectedRopa, ropaColor: selectedRopaColor, aura: selectedAura },
        selectedTema
      );
      onCerrar();
    } finally {
      setGuardando(false);
    }
  };

  const temaOscuroCard: Record<TemaTablero, string> = {
    madera: 'bg-amber-300/15 border-amber-300/45 text-amber-100',
    neon: 'bg-cyan-300/15 border-cyan-300/45 text-cyan-100',
    hielo: 'bg-sky-300/15 border-sky-300/45 text-sky-100',
    lava: 'bg-rose-400/15 border-rose-400/45 text-rose-100',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className={`relative w-full max-w-md rounded-3xl p-4 sm:p-5 flex flex-col max-h-[92vh] overflow-y-auto ${t.shellModal}`}>
        <div className={`flex items-center justify-between pb-3 mb-2 border-b-2 ${t.divider}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className={`text-lg sm:text-xl font-black leading-none ${t.title}`}>
                Aspecto y Terreno
              </h3>
              <span className={`text-[11px] font-bold ${t.muted}`}>
                {userActual
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
            className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center cursor-pointer transition-colors ${t.closeBtn}`}
          >
            ✕
          </button>
        </div>

        {/* Vista previa en vivo */}
        <div className={`p-3 rounded-2xl shadow-sm flex items-center gap-3 mb-3 ${t.card}`}>
          <CartoonCharacter
            color={selectedColor}
            hat={selectedHat}
            ropa={selectedRopa}
            ropaColor={selectedRopaColor}
            aura={selectedAura}
            size={58}
            showShadow={false}
          />
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-black uppercase tracking-wider block ${t.sub}`}>
              Vista Previa Activa
            </span>
            <span className={`font-extrabold text-sm flex items-center gap-1.5 truncate ${t.title}`}>
              <span>{activeCharDef.emoji}</span>
              <span className="truncate">
                {selectedItemId
                  ? misExclusivos.find((i) => i.id === selectedItemId)?.nombre || activeCharDef.nombre
                  : activeCharDef.nombre}
              </span>
              {selectedItemId && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                  t.esOscuro
                    ? 'bg-amber-300/20 text-amber-200 border border-amber-300/40'
                    : t.esClaro
                    ? 'bg-[#FCE8B8] text-[#4A3309] border border-[#EAD08E]'
                    : 'bg-[#ffd43b] text-[#5c3c00] border border-[#2b2140]/30'
                }`}>
                  EXCLUSIVO
                </span>
              )}
            </span>
            <span className={`text-[11px] font-bold block truncate ${t.muted}`}>
              Terreno: {TEMAS_LISTA.find((tm) => tm.id === selectedTema)?.label}
            </span>
            {(selectedRopa !== 'ninguna' || selectedAura !== 'ninguna') && (
              <span className={`text-[10px] font-bold block truncate ${t.esOscuro ? 'text-sky-300' : 'text-[#1971c2]'}`}>
                Atuendo: {selectedRopa !== 'ninguna' ? selectedRopa : 'Normal'} · Aura: {selectedAura !== 'ninguna' ? selectedAura : 'Ninguna'}
              </span>
            )}
          </div>
        </div>

        {/* Sub-tabs: Avatares Base vs Mis Exclusivos */}
        <div className={`flex items-center gap-1.5 p-1 rounded-xl mb-3 ${t.track}`}>
          <button
            type="button"
            onClick={() => setTabPersonaje('base')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              tabPersonaje === 'base' ? t.tabActive : t.tabInactive
            }`}
          >
            🎮 Avatares Base
          </button>
          <button
            type="button"
            onClick={() => setTabPersonaje('inventario')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
              tabPersonaje === 'inventario'
                ? t.esClasico
                  ? 'bg-[#ffd43b] text-[#5c3c00] border border-[#2b2140] shadow-xs'
                  : t.esClaro
                  ? 'bg-[#FCE8B8] text-[#4A3309] border border-[#EAD08E] shadow-xs'
                  : 'bg-amber-300/20 text-amber-100 border border-amber-300/40 shadow-xs'
                : t.tabInactive
            }`}
          >
            <span>🎒 Mis Exclusivos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              t.esOscuro ? 'bg-slate-900 text-slate-100' : 'bg-[#2b2140] text-white'
            }`}>
              {misExclusivos.length}
            </span>
          </button>
        </div>

        {/* CONTENIDO SEGÚN TAB */}
        {tabPersonaje === 'base' ? (
          <div className="flex flex-col gap-1.5 mb-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black uppercase tracking-wider ${t.sub}`}>
                1. Tus Avatares Disponibles
              </span>
              <span className={`text-[10px] font-bold ${t.accentText}`}>
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
                    className={`relative p-2 rounded-2xl cursor-pointer flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? t.esClasico
                          ? 'bg-[#ffd43b] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                          : t.esClaro
                          ? 'bg-[#FCE8B8] border border-[#EAD08E] shadow-xs -translate-y-0.5'
                          : 'bg-amber-300/20 border border-amber-300/50 shadow-xs -translate-y-0.5'
                        : `${t.card} ${t.cardHover}`
                    }`}
                    title={p.nombre}
                  >
                    <CartoonCharacter color={p.colorDefault} hat={p.id} size={38} showShadow={false} />
                    <span className={`text-[10px] font-extrabold text-center leading-tight ${t.title}`}>
                      {p.nombre}
                    </span>
                    {isSelected && (
                      <span className={`text-[8px] font-black px-1 rounded border ${
                        t.esOscuro
                          ? 'text-emerald-200 bg-emerald-400/20 border-emerald-400/40'
                          : 'text-[#134e20] bg-[#d3f9d8] border-[#2b8a3e]'
                      }`}>
                        ✓ ACTIVO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Siguiente personaje a desbloquear si aún quedan */}
            {siguientePorDesbloquear && (
              <div className={`p-2.5 rounded-2xl flex items-center justify-between text-xs mt-1 ${t.bannerWarn}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">🔒</span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold opacity-80 block uppercase tracking-wider">
                      Próximo Desbloqueo
                    </span>
                    <span className="font-black text-xs block truncate">
                      {siguientePorDesbloquear.nombre} ({siguientePorDesbloquear.emoji})
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black block">
                    {userPoints} / {siguientePorDesbloquear.puntosRequeridos} pts
                  </span>
                  <span className="text-[9px] font-bold opacity-80 block">
                    Faltan {Math.max(0, siguientePorDesbloquear.puntosRequeridos - userPoints)} pts
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black uppercase tracking-wider ${t.sub}`}>
                🎒 Colección de Avatares Exclusivos
              </span>
              {selectedItemId && (
                <button
                  type="button"
                  onClick={handleDesequiparExclusivo}
                  className={`text-[10px] font-bold hover:underline cursor-pointer ${t.esOscuro ? 'text-rose-300' : 'text-[#c92a2a]'}`}
                >
                  ✕ Desequipar
                </button>
              )}
            </div>

            {misExclusivos.length === 0 ? (
              <div className={`p-4 rounded-2xl text-center flex flex-col items-center gap-1.5 my-1 ${t.card}`}>
                <span className="text-3xl">🎁</span>
                <span className={`font-black text-xs ${t.title}`}>
                  Aún no tienes avatares exclusivos en tu inventario
                </span>
                <p className={`text-[11px] leading-relaxed ${t.muted}`}>
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
                      className={`p-2.5 rounded-2xl cursor-pointer transition-all flex items-center gap-2.5 ${
                        isEquipped
                          ? t.esClasico
                            ? 'border-2 border-[#2b2140] bg-[#fff9db] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                            : t.esClaro
                            ? 'border border-[#EAD08E] bg-[#FCE8B8]/70 shadow-xs -translate-y-0.5'
                            : 'border border-amber-300/45 bg-amber-300/15 shadow-xs -translate-y-0.5'
                          : `${t.card} ${t.cardHover}`
                      }`}
                    >
                      <CartoonCharacter
                        color={item.color}
                        hat={item.hat}
                        ropa={item.ropa}
                        ropaColor={item.ropaColor}
                        aura={item.aura}
                        size={42}
                        showShadow={false}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-black text-xs truncate ${t.title}`}>
                            {item.nombre}
                          </span>
                          {isEquipped && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                              t.esOscuro
                                ? 'text-emerald-200 bg-emerald-400/20 border-emerald-400/40'
                                : 'text-[#134e20] bg-[#d3f9d8] border-[#2b8a3e]'
                            }`}>
                              EN USO
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold block truncate ${t.muted}`}>
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
                        <span className={`text-[9px] block truncate ${t.sub}`}>
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
          <span className={`text-xs font-black uppercase tracking-wider ${t.sub}`}>
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
                  className={`p-2 rounded-xl text-xs font-black cursor-pointer transition-all flex flex-col items-center gap-0.5 ${
                    isSelected
                      ? t.esOscuro
                        ? `border ${temaOscuroCard[theme.id]} scale-[1.02]`
                        : t.esClaro
                        ? `border ${theme.border} ${theme.bg} text-[#171923] shadow-xs scale-[1.02]`
                        : `border-2 ${theme.border} ${theme.bg} text-[#2b2140] shadow-[0_3px_0_#2b2140] scale-[1.02]`
                      : `${t.card} opacity-80 hover:opacity-100`
                  }`}
                >
                  <span className="text-sm font-bold">{theme.label}</span>
                  <span className={`text-[9px] font-medium ${isSelected && !t.esOscuro ? 'text-[#3E4359]' : t.muted}`}>
                    {theme.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {userActual ? (
          <label className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer mb-3 select-none ${t.bannerInfo}`}>
            <input
              type="checkbox"
              checked={guardarEnPerfil}
              onChange={(e) => setGuardarEnPerfil(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-[11px] font-bold leading-tight">
              ⭐ Guardar como mi avatar y terreno predeterminados en mi Perfil
            </span>
          </label>
        ) : (
          <div className={`p-2 rounded-xl mb-3 text-[11px] font-semibold leading-tight ${t.bannerWarn}`}>
            💡 <strong>Modo Invitado:</strong> Inicia sesión en Mi Perfil para dejar tu avatar y terreno guardados de forma predeterminada.
          </div>
        )}

        <button
          type="button"
          disabled={guardando}
          onClick={handleGuardarYAplicar}
          className={`w-full py-2.5 rounded-xl font-black text-sm cursor-pointer flex items-center justify-center gap-1.5 ${t.btnPrimary}`}
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
  ajustes: AjustesDeApp;
  onGuardar: (nuevosAjustes: AjustesDeApp) => void;
  onCerrar: () => void;
}

export const AjustesModal: React.FC<AjustesModalProps> = ({ ajustes, onGuardar, onCerrar }) => {
  const { estilo, setEstilo, t } = useMurosTheme();
  const [localAjustes, setLocalAjustes] = useState<AjustesDeApp>({ ...ajustes });

  const toggle = (key: keyof AjustesDeApp) => {
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

  const opciones: { key: keyof AjustesDeApp; label: string; desc: string; icon: string }[] = [
    { key: 'sonido', label: 'Efectos de Sonido', desc: 'Sonidos retro y efectos en cada jugada', icon: '🔊' },
    { key: 'animacionesReducidas', label: 'Animaciones Reducidas', desc: 'Simplifica transiciones visuales del juego', icon: '⚡' },
    { key: 'mostrarDistancia', label: 'Mostrar Distancia a Meta', desc: 'Indica los pasos mínimos en la tarjeta', icon: '📏' },
    { key: 'permitirDeshacer', label: 'Permitir Deshacer', desc: 'Permite retroceder turnos (-2 pts)', icon: '↩️' },
    { key: 'permitirPistas', label: 'Permitir Pistas', desc: 'Muestra el camino óptimo a la meta (-1 pt)', icon: '💡' },
    { key: 'modoDaltonico', label: 'Modo Alto Contraste / Daltónico', desc: 'Iconos distintivos en las metas', icon: '👁️' },
  ];

  const estilosLista: EstiloMuros[] = ['pastel_oscuro', 'pastel_claro', 'clasico'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className={`relative w-full max-w-md rounded-3xl p-5 flex flex-col max-h-[90vh] ${t.shellModal}`}>
        <div className={`flex items-center justify-between pb-3 mb-2 border-b-2 ${t.divider}`}>
          <h3 className={`text-xl font-black flex items-center gap-2 ${t.title}`}>
            <span>⚙️</span> Ajustes del Juego
          </h3>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center transition-colors cursor-pointer ${t.closeBtn}`}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 my-2">
          {/* Selector de Estética Visual (Pastel Oscuro / Pastel Claro / Clásico) */}
          <div className={`p-3 rounded-2xl flex flex-col gap-2 ${t.card}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">🎨</span>
                <div className="min-w-0">
                  <span className={`font-black text-xs sm:text-sm block leading-tight ${t.title}`}>
                    Estética Visual
                  </span>
                  <span className={`text-[10px] font-medium block truncate ${t.muted}`}>
                    {ESTILO_MUROS_META[estilo].desc}
                  </span>
                </div>
              </div>
            </div>
            <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl ${t.track}`}>
              {estilosLista.map((itemKey) => {
                const meta = ESTILO_MUROS_META[itemKey];
                const activo = estilo === itemKey;
                return (
                  <button
                    key={itemKey}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setEstilo(itemKey);
                    }}
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                      activo ? t.tabActive : t.tabInactive
                    }`}
                  >
                    <span className="text-sm">{meta.icon}</span>
                    <span className="truncate leading-none">{meta.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <PWAInstallButton variant="card" />

          {opciones.map((op) => {
            const activo = Boolean(localAjustes[op.key]);
            return (
              <div
                key={op.key}
                onClick={() => toggle(op.key)}
                className={`p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                  activo
                    ? t.esClasico
                      ? 'bg-[#d3f9d8] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                      : t.bannerSuccess
                    : `${t.card} ${t.cardHover}`
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl flex-shrink-0">{op.icon}</span>
                  <div className="min-w-0">
                    <span className={`font-extrabold text-xs sm:text-sm block truncate ${t.title}`}>
                      {op.label}
                    </span>
                    <span className={`text-[11px] font-medium block leading-tight ${t.muted}`}>
                      {op.desc}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-12 h-7 rounded-full p-0.5 transition-colors flex items-center flex-shrink-0 ${
                    t.esClasico
                      ? `border-2 border-[#2b2140] ${activo ? 'bg-[#51cf66] justify-end' : 'bg-[#dee2e6] justify-start'}`
                      : t.esOscuro
                      ? `border border-white/15 ${activo ? 'bg-emerald-400/70 justify-end' : 'bg-slate-900 justify-start'}`
                      : `border border-[#CBBFA3] ${activo ? 'bg-[#8AD2AE] justify-end' : 'bg-[#E5DEC9] justify-start'}`
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full shadow-sm ${
                      t.esClasico
                        ? 'bg-white border-2 border-[#2b2140]'
                        : t.esOscuro
                        ? 'bg-slate-100 border border-white/20'
                        : 'bg-[#FFFDF6] border border-[#CBBFA3]'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className={`pt-3 border-t-2 flex items-center justify-end gap-2 ${t.divider}`}>
          <button
            onClick={handleGuardar}
            className={`w-full py-2.5 rounded-xl font-black text-sm cursor-pointer ${t.btnPrimary}`}
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
  const { t } = useMurosTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className={`relative w-full max-w-lg rounded-3xl p-5 sm:p-6 flex flex-col max-h-[90vh] ${t.shellModal}`}>
        <div className={`flex items-center justify-between pb-3 mb-2 border-b-2 ${t.divider}`}>
          <h3 className={`text-xl sm:text-2xl font-black flex items-center gap-2 ${t.title}`}>
            <span>📖</span> ¿Cómo se juega?
          </h3>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center transition-colors cursor-pointer ${t.closeBtn}`}
          >
            ✕
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto pr-1 flex flex-col gap-3 my-2 text-xs sm:text-sm ${t.sub}`}>
          <div className={`p-3 rounded-2xl shadow-sm ${t.card}`}>
            <h4 className={`font-black text-sm flex items-center gap-1.5 mb-1 ${t.title}`}>
              <span>🎯</span> Objetivo del Juego
            </h4>
            <p className="leading-relaxed">
              Sé el primero en llevar tu avatar hasta cualquier casilla del extremo opuesto del tablero.
            </p>
          </div>

          <div className={`p-3 rounded-2xl shadow-sm ${t.card}`}>
            <h4 className={`font-black text-sm flex items-center gap-1.5 mb-1 ${t.title}`}>
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

          <div className={`p-3 rounded-2xl shadow-sm ${t.card}`}>
            <h4 className={`font-black text-sm flex items-center gap-1.5 mb-1 ${t.title}`}>
              <span>🦘</span> Saltos sobre rivales
            </h4>
            <p className="leading-relaxed">
              Si estás frente a un rival y no hay un muro detrás, puedes saltarlo. Si hay un muro detrás, puedes saltar en diagonal a los lados.
            </p>
          </div>

          <div className={`p-3 rounded-2xl shadow-sm ${t.bannerWarn}`}>
            <h4 className="font-black text-sm flex items-center gap-1.5 mb-1">
              <span>⚠️</span> Regla de Oro de los Muros
            </h4>
            <p className="leading-relaxed">
              <strong>NUNCA</strong> puedes encerrar por completo a un jugador. Siempre debe quedar al menos un camino libre hasta su meta.
            </p>
          </div>

          <div className={`p-3 rounded-2xl shadow-sm ${t.bannerSuccess}`}>
            <h4 className="font-black text-sm flex items-center gap-1.5 mb-1">
              <span>⭐</span> Sistema de Puntos
            </h4>
            <ul className="list-disc list-inside space-y-1 pl-1 leading-relaxed">
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

        <div className={`pt-3 border-t-2 ${t.divider}`}>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-full py-2.5 rounded-xl font-black text-sm cursor-pointer ${t.btnAmber}`}
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
  const { t } = useMurosTheme();
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
      <div className={`relative w-full max-w-lg rounded-3xl p-5 sm:p-6 flex flex-col max-h-[90vh] ${t.shellModal}`}>
        <div className={`flex items-center justify-between pb-3 mb-2 border-b-2 ${t.divider}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎖️</span>
            <div>
              <h3 className={`text-lg sm:text-xl font-black leading-none ${t.title}`}>
                Logros y Medallas
              </h3>
              <span className={`text-[11px] font-bold ${t.muted}`}>
                {desbloqueados} de {totalLogros} completados ({progresoPct}%)
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center transition-colors cursor-pointer ${t.closeBtn}`}
          >
            ✕
          </button>
        </div>

        <div className={`w-full h-3.5 rounded-full my-2 overflow-hidden shadow-inner ${t.track}`}>
          <div
            className={`h-full transition-all duration-500 ${
              t.esClasico
                ? 'bg-gradient-to-r from-[#ffd43b] to-[#51cf66]'
                : t.esOscuro
                ? 'bg-gradient-to-r from-amber-300/80 to-emerald-300/80'
                : 'bg-gradient-to-r from-[#F9DE9E] to-[#8AD2AE]'
            }`}
            style={{ width: `${progresoPct}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-2">
          {LOGROS_LISTA.map((logro) => {
            const conseguido = misLogros.has(logro.id);
            return (
              <div
                key={logro.id}
                className={`p-3 rounded-2xl flex items-center gap-3 transition-all ${
                  conseguido
                    ? t.card
                    : `${t.cardInner} opacity-55 grayscale shadow-none`
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                    conseguido
                      ? t.esClasico
                        ? 'bg-[#ffd43b] border-2 border-[#2b2140] shadow-sm'
                        : t.esClaro
                        ? 'bg-[#FCE8B8] border border-[#EAD08E]'
                        : 'bg-amber-300/20 border border-amber-300/40'
                      : t.track
                  }`}
                >
                  {conseguido ? logro.icono : '🔒'}
                </div>

                <div className="min-w-0 flex-1">
                  <span className={`font-extrabold text-xs sm:text-sm block truncate ${t.title}`}>
                    {logro.titulo}
                  </span>
                  <span className={`text-[11px] font-medium block leading-tight ${t.muted}`}>
                    {logro.descripcion}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={`pt-3 border-t-2 ${t.divider}`}>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-full py-2.5 rounded-xl font-black text-sm cursor-pointer ${t.btnPrimary}`}
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
  userActual?: UserCuenta | null;
  onAbrirPerfil?: () => void;
}

type TabType = 'local' | 'global' | 'esta_semana' | 'semana_pasada';

interface DisplayRankEntry {
  id?: string;
  nombre: string;
  puntosTotales: number;
  partidas: number;
  victorias: number;
  avatarColor: string;
  avatarHat: EntradaRanking['avatarHat'];
  avatarRopa?: AvatarTipoDeRopa;
  avatarRopaColor?: string;
  avatarAura?: AvatarTipoDeAura;
}

export const RankingModal: React.FC<RankingModalProps> = ({
  onCerrar,
  userActual,
  onAbrirPerfil,
}) => {
  const { t } = useMurosTheme();
  // Orden solicitado: Local siempre primero, luego Global, Esta Semana y Sem. Pasada
  const [tab, setTab] = useState<TabType>('local');
  const [rankingData, setRankingData] = useState<Record<string, EntradaRanking>>(() => cargarRanking());
  const [localRankingData, setLocalRankingData] = useState<Record<string, EntradaRanking>>(() =>
    cargarRankingLocal()
  );
  const [semanalData, setSemanalData] = useState<RespuestaRankingSemanal | null>(null);
  const [mensajeToast, setMensajeToast] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmandoBorrarLocal, setConfirmandoBorrarLocal] = useState(false);
  const [diag, setDiag] = useState<DiagnosticoDeRed>(() => obtenerDiagnosticoRed());

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
          id: r.id,
          nombre: r.nombre,
          puntosTotales: r.puntosTotales,
          partidas: r.partidas,
          victorias: r.victorias,
          avatarColor: r.avatarColor || '#ff6b6b',
          avatarHat: r.avatarHat || 'corona',
          avatarRopa: r.avatarRopa,
          avatarRopaColor: r.avatarRopaColor,
          avatarAura: r.avatarAura,
        }));

      list.sort((a, b) => {
        if (b.puntosTotales !== a.puntosTotales) return b.puntosTotales - a.puntosTotales;
        if (b.victorias !== a.victorias) return b.victorias - a.victorias;
        return b.partidas - a.partidas;
      });
      return list;
    }

    if (tab === 'global') {
      const porId = new Map<string, DisplayRankEntry>();
      for (const r of Object.values(rankingData)) {
        if (r.partidas <= 0 && r.puntosTotales <= 0) continue;
        const canonKey = (r.id || r.nombre).trim().toLowerCase();
        const prev = porId.get(canonKey);
        if (!prev || r.puntosTotales >= prev.puntosTotales) {
          porId.set(canonKey, {
            id: r.id || canonKey,
            nombre: r.nombre,
            puntosTotales: Math.max(prev?.puntosTotales || 0, r.puntosTotales),
            partidas: Math.max(prev?.partidas || 0, r.partidas),
            victorias: Math.max(prev?.victorias || 0, r.victorias),
            avatarColor: r.avatarColor || '#ff6b6b',
            avatarHat: r.avatarHat || 'corona',
            avatarRopa: r.avatarRopa,
            avatarRopaColor: r.avatarRopaColor,
            avatarAura: r.avatarAura,
          });
        }
      }
      const list = Array.from(porId.values());

      list.sort((a, b) => {
        if (b.puntosTotales !== a.puntosTotales) return b.puntosTotales - a.puntosTotales;
        if (b.victorias !== a.victorias) return b.victorias - a.victorias;
        return b.partidas - a.partidas;
      });
      return list;
    }

    const board = tab === 'esta_semana' ? semanalData?.actual : semanalData?.pasada;
    if (!board || !board.jugadores) return [];

    const porIdSemanal = new Map<string, DisplayRankEntry>();
    for (const p of Object.values(board.jugadores)) {
      if (!p || p.partidas <= 0) continue;
      const canonKey = (p.id || p.nombre).trim().toLowerCase();
      const prev = porIdSemanal.get(canonKey);
      if (!prev || p.puntos >= prev.puntosTotales) {
        porIdSemanal.set(canonKey, {
          id: p.id || canonKey,
          nombre: p.nombre,
          puntosTotales: Math.max(prev?.puntosTotales || 0, p.puntos),
          partidas: Math.max(prev?.partidas || 0, p.partidas),
          victorias: Math.max(prev?.victorias || 0, p.victorias),
          avatarColor: p.avatarColor || '#ff6b6b',
          avatarHat: p.avatarHat || 'corona',
          avatarRopa: p.avatarRopa,
          avatarRopaColor: p.avatarRopaColor,
          avatarAura: p.avatarAura,
        });
      }
    }
    const list = Array.from(porIdSemanal.values());

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

  const bonosSemanal = [
    semanalData?.actual?.puntosConfig?.primerLugar ?? 50,
    semanalData?.actual?.puntosConfig?.segundoLugar ?? 25,
    semanalData?.actual?.puntosConfig?.tercerLugar ?? 15,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className={`relative w-full max-w-lg rounded-3xl p-4 sm:p-6 flex flex-col max-h-[90vh] overflow-hidden ${t.shellModal}`}>
        <div className={`flex items-center justify-between pb-3 mb-2 border-b-2 ${t.divider}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <h3 className={`text-lg sm:text-xl font-black leading-none ${t.title}`}>
                Salón de la Fama
              </h3>
              <span className={`text-[11px] font-bold ${t.accentText}`}>
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
            className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center transition-colors cursor-pointer ${t.closeBtn}`}
          >
            ✕
          </button>
        </div>

        {/* Database Disconnected Warning inside Ranking */}
        {diag.checkedOnce && !diag.dbConectado && tab !== 'local' && (
          <div className={`p-2.5 rounded-2xl mb-2 text-[11px] font-bold flex items-center justify-between gap-2 ${t.bannerDanger}`}>
            <span>⚠️ Sin conexión a la Database: mostrando últimos datos guardados localmente.</span>
            <button
              type="button"
              onClick={() => refrescarRanking(true)}
              className={`py-1 px-2 rounded-lg text-[10px] font-black cursor-pointer shrink-0 ${t.btnNeutral}`}
            >
              🔄 Reintentar
            </button>
          </div>
        )}

        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-2xl my-2 ${t.track}`}>
          {[
            { id: 'local', label: '📍 Local' },
            { id: 'global', label: '🌍 Global' },
            { id: 'esta_semana', label: '📅 Esta Semana' },
            { id: 'semana_pasada', label: '⏮️ Sem. Pasada' },
          ].map((tb) => (
            <button
              key={tb.id}
              onClick={() => {
                sounds.playClick();
                setTab(tb.id as TabType);
              }}
              className={`py-1.5 px-1 rounded-xl font-black text-[10px] sm:text-xs transition-all cursor-pointer truncate ${
                tab === tb.id ? t.tabActive : t.tabInactive
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'esta_semana' && (
          <div className={`p-2.5 rounded-2xl mb-2 flex flex-col gap-1.5 shadow-sm text-xs ${t.bannerWarn}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-black flex items-center gap-1">
                <span>🏆</span> Torneo Semanal Oficial
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${t.badgeNeutral}`}>
                ⏳ {textoCuentaAtrasSemana}
              </span>
            </div>

            {semanalData?.actual?.premioSemanal ? (
              <div className={`p-2 rounded-xl flex items-center gap-2.5 ${t.card}`}>
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
                  <span className={`text-[10px] font-black uppercase tracking-wider block ${t.esOscuro ? 'text-amber-300' : 'text-[#d9480f]'}`}>
                    🎁 Premio al 1º del Ranking:
                  </span>
                  <span className={`text-xs font-black truncate block ${t.title}`}>
                    {semanalData.actual.premioSemanal.nombre}
                  </span>
                  <span className={`text-[10px] font-semibold block ${t.muted}`}>
                    Avatar exclusivo para el ganador semanal
                  </span>
                </div>
              </div>
            ) : null}

            <span className="text-[11px] font-bold">
              Bonos al cierre: 🥇 +{semanalData?.actual?.puntosConfig?.primerLugar ?? 50} pts · 🥈 +{semanalData?.actual?.puntosConfig?.segundoLugar ?? 25} pts · 🥉 +{semanalData?.actual?.puntosConfig?.tercerLugar ?? 15} pts
            </span>
          </div>
        )}

        {tab === 'semana_pasada' && semanalData?.pasada?.premiados && semanalData.pasada.premiados.length > 0 && (
          <div className={`p-2.5 rounded-2xl mb-2 text-[11px] font-black ${t.bannerSuccess}`}>
            🏆 Premios entregados:{' '}
            {semanalData.pasada.premiados
              .map((p) => `${p.puesto}º ${p.nombre} (+${p.bono} pts)`)
              .join(' · ')}
          </div>
        )}

        {!userActual && tab !== 'local' && (
          <div className={`p-2.5 rounded-2xl mb-2 flex items-center justify-between gap-2 shadow-sm text-xs ${t.bannerWarn}`}>
            <div className="text-[11px] font-bold leading-tight">
              Juegas como <strong>Invitado</strong>. Inicia sesión para competir en Global y Esta Semana.
            </div>
            {onAbrirPerfil && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onAbrirPerfil();
                }}
                className={`py-1 px-2.5 rounded-xl font-black text-xs shrink-0 cursor-pointer ${t.btnAmber}`}
              >
                👤 Entrar
              </button>
            )}
          </div>
        )}

        {tab === 'local' && (
          <div className={`p-2.5 rounded-2xl mb-2 flex flex-col gap-2 shadow-sm text-xs ${t.bannerInfo}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold">
                Récords guardados únicamente en este dispositivo.
              </span>
              {!confirmandoBorrarLocal && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setConfirmandoBorrarLocal(true);
                  }}
                  className={`py-1 px-2.5 rounded-xl font-black text-[11px] cursor-pointer shrink-0 ${t.btnDanger}`}
                >
                  🗑️ Borrar Local
                </button>
              )}
            </div>
            {confirmandoBorrarLocal && (
              <div className={`p-2 rounded-xl flex items-center justify-between gap-2 ${t.card}`}>
                <span className={`text-[11px] font-black ${t.esOscuro ? 'text-rose-300' : 'text-[#c92a2a]'}`}>
                  ¿Confirmas borrar tu ranking local?
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmandoBorrarLocal(false)}
                    className={`py-1 px-2 rounded-lg font-bold text-[11px] cursor-pointer ${t.btnNeutral}`}
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
                    className={`py-1 px-2.5 rounded-lg font-black text-[11px] cursor-pointer ${t.btnDanger}`}
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
            <div className={`p-8 text-center font-bold text-sm rounded-2xl border-2 border-dashed my-4 ${t.card} ${t.muted}`}>
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
                  key={`${tab}-${entry.id || entry.nombre}-${index}`}
                  className={`p-2.5 sm:p-3 rounded-2xl flex items-center gap-3 transition-all ${
                    index === 0
                      ? t.esClasico
                        ? 'bg-gradient-to-r from-[#fff9db] to-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140]'
                        : t.esClaro
                        ? 'bg-[#FCE8B8]/55 border border-[#EAD08E] shadow-xs'
                        : 'bg-amber-300/12 border border-amber-300/35 shadow-xs'
                      : `${t.card} shadow-sm`
                  }`}
                >
                  <div className={`w-8 text-center font-black text-base sm:text-lg flex-shrink-0 ${t.title}`}>
                    {medal}
                  </div>

                  <CartoonCharacter
                    color={entry.avatarColor}
                    hat={entry.avatarHat}
                    ropa={entry.avatarRopa}
                    ropaColor={entry.avatarRopaColor}
                    aura={entry.avatarAura}
                    size={38}
                    showShadow={false}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-extrabold text-xs sm:text-sm truncate ${t.title}`}>
                        {entry.nombre}
                      </span>
                      {tab !== 'local' && entry.id && (
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${t.badgeNeutral}`}>
                          @{entry.id}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold ${t.muted}`}>
                        · {lvl.icono} {lvl.titulo}
                      </span>
                      {bonoProyectado > 0 && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${t.bannerSuccess}`}>
                          +{bonoProyectado} pts premio
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-2 text-[11px] font-semibold mt-0.5 ${t.muted}`}>
                      <span>
                        {entry.victorias}V / {entry.partidas}P ({winRate}% victorias)
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm sm:text-base font-black ${t.title}`}>
                      {entry.puntosTotales}{' '}
                      <span className={`text-[10px] font-normal ${t.muted}`}>pts</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={`pt-3 mt-2 border-t-2 flex items-center justify-between gap-2 text-xs ${t.divider}`}>
          <button
            onClick={() => {
              sounds.playClick();
              refrescarRanking(true);
            }}
            disabled={sincronizando}
            className={`py-1.5 px-3.5 rounded-xl font-black cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${t.btnNeutral}`}
          >
            <span className={sincronizando ? 'animate-spin' : ''}>🔄</span>
            <span>{sincronizando ? 'Sincronizando...' : 'Actualizar Database'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`py-1.5 px-4 rounded-xl font-black cursor-pointer ${t.btnPrimary}`}
          >
            Cerrar
          </button>
        </div>

        {mensajeToast && (
          <div
            className={`absolute bottom-16 left-1/2 -translate-x-1/2 text-xs font-bold py-1.5 px-4 rounded-full shadow-lg border animate-[slideUp_0.2s_ease-out] ${
              t.esOscuro
                ? 'bg-slate-800 text-slate-100 border-white/20'
                : 'bg-[#2b2140] text-white border-white/20'
            }`}
          >
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
  estado: EstadoDeJuego;
  torneo: EstadoTorneo;
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
  const { t } = useMurosTheme();
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
      <div className={`relative w-full max-w-md rounded-3xl p-5 sm:p-6 flex flex-col text-center max-h-[92vh] ${t.shellModal}`}>
        <div className="text-4xl mb-1">{esFinal ? '👑' : '🏁'}</div>

        <h3 className={`text-xl sm:text-2xl font-black mb-0.5 ${t.title}`}>
          {esFinal
            ? '¡Gran Final del Torneo!'
            : `Torneo: Ronda ${torneo.rondaActual} de ${torneo.totalRondas}`}
        </h3>

        <p className={`text-xs font-semibold mb-2 ${t.sub}`}>
          {esFinal
            ? `¡${granCampeon.nombre} gana el torneo y recibe +10 pts extra de campeón!`
            : ganadorRonda
            ? `¡${ganadorRonda.nombre} ganó la ronda ${torneo.rondaActual}! (+5 pts victoria + muros)`
            : 'Ronda finalizada.'}
        </p>

        {esFinal && (
          <div className={`p-2 mb-2 rounded-xl text-xs font-black ${t.bannerSuccess}`}>
            🏆 Bono Campeón del Torneo: +10 pts sumados al total de {granCampeon.nombre}
          </div>
        )}

        <div className={`rounded-2xl p-3 shadow-inner my-2 flex flex-col gap-2 max-h-56 overflow-y-auto ${t.cardInner}`}>
          <div className={`flex items-center justify-between text-[10px] font-black uppercase tracking-wider ${t.sub}`}>
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
                className={`p-2 rounded-xl flex items-center justify-between gap-2 ${
                  idx === 0
                    ? t.esClasico
                      ? 'bg-[#fff9db] border-2 border-[#2b2140] font-extrabold'
                      : t.esClaro
                      ? 'bg-[#FCE8B8]/65 border border-[#EAD08E] font-extrabold'
                      : 'bg-amber-300/15 border border-amber-300/40 font-extrabold'
                    : t.card
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-sm font-black w-5 ${t.title}`}>{idx === 0 ? '🥇' : `${idx + 1}º`}</span>
                  <CartoonCharacter
                    color={p.color}
                    hat={p.hat}
                    ropa={p.ropa}
                    ropaColor={p.ropaColor}
                    aura={p.aura}
                    size={30}
                    showShadow={false}
                  />
                  <div className="text-left min-w-0">
                    <span className={`text-xs font-bold block truncate ${t.title}`}>{p.nombre}</span>
                    <span className={`text-[10px] font-bold block ${t.accentText}`}>
                      Ronda {torneo.rondaActual}: +{ptsEstaRonda} pts
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-black block ${t.title}`}>{pts} pts</span>
                  <span className={`text-[10px] font-semibold block ${t.muted}`}>{vic} vic</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={`pt-3 mt-2 border-t-2 flex flex-col gap-2 ${t.divider}`}>
          {!esFinal ? (
            <button
              onClick={() => {
                sounds.playClick();
                onSiguienteRonda();
              }}
              className={`w-full py-3 rounded-2xl font-black text-sm sm:text-base cursor-pointer ${t.btnPrimary}`}
            >
              ▶ Siguiente Ronda ({torneo.rondaActual + 1} de {torneo.totalRondas})
            </button>
          ) : (
            <button
              onClick={() => {
                sounds.playClick();
                onFinalizarTorneo();
              }}
              className={`w-full py-3 rounded-2xl font-black text-sm sm:text-base cursor-pointer ${t.btnAmber}`}
            >
              🏆 Concluir Torneo y Volver al Menú
            </button>
          )}

          <button
            onClick={() => {
              sounds.playClick();
              onVerTablero();
            }}
            className={`w-full py-2 rounded-xl font-bold text-xs cursor-pointer ${t.btnNeutral}`}
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
  estado: EstadoDeJuego;
  desgloses: Map<number, DesglosePuntos>;
  nuevosLogros: Map<string, DefLogro[]>;
  subidasNivel: Map<string, { anterior: InfoNivel; nuevo: InfoNivel }>;
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
  const { t } = useMurosTheme();
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
      <div className={`relative w-full max-w-sm rounded-3xl p-5 flex flex-col text-center max-h-[92vh] overflow-y-auto ${t.shellModal}`}>
        <div className="text-4xl mb-1 animate-bounce">🏆</div>

        <h3 className={`text-2xl font-black mb-0.5 ${t.title}`}>¡Partida Finalizada!</h3>
        <p className={`text-xs font-semibold mb-2 ${t.sub}`}>
          ¡<strong className={t.title}>{ganador.nombre}</strong> ha ganado la carrera!
        </p>

        <div className={`w-full rounded-xl p-1.5 mb-2 ${t.cardInner}`}>
          <div className={`flex items-center justify-between text-[11px] font-black mb-1 ${t.sub}`}>
            <span>
              {enConfirmacionRevancha
                ? '⏸️ Salida pausada durante confirmación:'
                : '⏱️ Salida automática en:'}
            </span>
            <span
              className={`font-mono-num font-black ${
                !enConfirmacionRevancha && segundosRestantes <= 5
                  ? `${t.esOscuro ? 'text-rose-300' : 'text-[#c92a2a]'} animate-pulse`
                  : t.title
              }`}
            >
              {segundosRestantes}s
            </span>
          </div>
          <div className={`w-full h-2 rounded-full overflow-hidden ${t.track}`}>
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

        <div className={`flex items-center justify-center gap-1.5 mb-2 overflow-x-auto p-1 rounded-xl ${t.track}`}>
          {estado.jugadores.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                sounds.playClick();
                setSelectedPlayerId(p.id);
              }}
              className={`py-1 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                selectedPlayerId === p.id ? t.tabActive : t.tabInactive
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
            ropa={jugadorSeleccionado.ropa}
            ropaColor={jugadorSeleccionado.ropaColor}
            aura={jugadorSeleccionado.aura}
            size={60}
          />
        </div>

        <div className={`rounded-2xl p-3 shadow-inner my-2 text-xs flex flex-col gap-1 text-left ${t.card}`}>
          <span className={`text-[10px] font-black uppercase mb-0.5 block ${t.muted}`}>
            Desglose de Puntos · {jugadorSeleccionado.nombre}
          </span>
          <div className={`flex justify-between font-semibold ${t.muted}`}>
            <span>{jugadorDesglose.resultado > 0 ? '🏆 Partida ganada:' : 'Partida jugada:'}</span>
            <span className="font-mono-num font-bold">+{jugadorDesglose.resultado}</span>
          </div>
          <div className={`flex justify-between font-semibold ${t.muted}`}>
            <span>🧱 Muros usados ({jugadorSeleccionado.estadisticas.murosColocados} × 1 pt):</span>
            <span className="font-mono-num font-bold">+{jugadorDesglose.murosUsados}</span>
          </div>
          {jugadorDesglose.finalCerrado > 0 && (
            <div className={`flex justify-between font-bold ${t.esOscuro ? 'text-amber-300' : 'text-[#d9480f]'}`}>
              <span>⚡ ¡Por los pelos! (rival a 1 cuadro):</span>
              <span className="font-mono-num">+{jugadorDesglose.finalCerrado}</span>
            </div>
          )}
          {Boolean(jugadorDesglose.bonoDominacion && jugadorDesglose.bonoDominacion > 0) && (
            <div className={`flex justify-between font-bold ${t.accentText}`}>
              <span>🎯 Dominación (rival retenido en inicio ≤2 casillas):</span>
              <span className="font-mono-num">+{jugadorDesglose.bonoDominacion}</span>
            </div>
          )}
          {jugadorDesglose.bonoTorneo > 0 && (
            <div className={`flex justify-between font-bold ${t.accentText}`}>
              <span>👑 Campeón del Torneo:</span>
              <span className="font-mono-num">+{jugadorDesglose.bonoTorneo}</span>
            </div>
          )}
          {jugadorDesglose.penalizaciones.total > 0 && (
            <div className={`flex justify-between font-semibold ${t.esOscuro ? 'text-rose-300' : 'text-[#c92a2a]'}`}>
              <span>Penalizaciones (pistas/deshacer/tiempo):</span>
              <span className="font-mono-num">-{jugadorDesglose.penalizaciones.total}</span>
            </div>
          )}
          <div className={`pt-1.5 mt-1 border-t-2 flex justify-between font-black text-sm ${t.divider} ${t.title}`}>
            <span>Total obtenido:</span>
            <span className={`font-mono-num ${t.accentText}`}>+{jugadorDesglose.total} pts</span>
          </div>
        </div>

        {miSubidaNivel && (
          <div className={`p-2 rounded-xl text-xs font-black mb-2 flex items-center justify-center gap-1.5 animate-pulse ${t.bannerSuccess}`}>
            <span>🌟</span> ¡Subiste a Nivel {miSubidaNivel.nuevo.nivel}: {miSubidaNivel.nuevo.titulo}!
          </div>
        )}

        {misNuevosLogros.length > 0 && (
          <div className={`p-2 rounded-xl text-xs font-black mb-2 flex items-center justify-center gap-1.5 ${t.bannerWarn}`}>
            <span>🎖️</span> ¡Nuevo logro desbloqueado: {misNuevosLogros[0].titulo}!
          </div>
        )}

        <div className="pt-2 flex flex-col gap-2">
          {estado.modoOnline && estadoRevanchaOnline === 'no_disponible' ? (
            <div className="flex flex-col gap-1.5">
              <div className={`p-2.5 rounded-xl text-xs font-black leading-snug ${t.bannerDanger}`}>
                {mensajeRevanchaNoDisponible ||
                  '⚠️ Esa opción ya no es válida ya que el jugador acaba de retirarse.'}
              </div>
              <button
                type="button"
                disabled
                className={`w-full py-2.5 rounded-xl font-black text-xs opacity-60 cursor-not-allowed ${t.btnNeutral}`}
              >
                🚫 Revancha no disponible · Jugador retirado
              </button>
            </div>
          ) : estado.modoOnline && estadoRevanchaOnline === 'recibida' ? (
            <div className={`p-2.5 rounded-2xl flex flex-col gap-2 shadow-sm ${t.bannerWarn}`}>
              <p className="text-xs font-black leading-snug">
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
                  className={`py-2 rounded-xl font-black text-xs cursor-pointer ${t.btnPrimary}`}
                >
                  ✓ Sí, jugar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onRechazarRevancha?.();
                  }}
                  className={`py-2 rounded-xl font-black text-xs cursor-pointer ${t.btnDanger}`}
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
                className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-wait ${t.btnAmber}`}
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
                  className={`py-2.5 px-3 rounded-xl font-black text-xs cursor-pointer shrink-0 ${t.btnDanger}`}
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
              className={`w-full py-2.5 rounded-xl font-black text-sm cursor-pointer ${t.btnPrimary}`}
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
              className={`py-2 rounded-xl font-bold text-xs cursor-pointer ${t.btnNeutral}`}
            >
              👀 Ver Tablero
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                onVerRanking();
              }}
              className={`py-2 rounded-xl font-bold text-xs cursor-pointer ${t.btnAmber}`}
            >
              🏆 Ver Ranking
            </button>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onIrAlMenu();
            }}
            className={`w-full py-2 rounded-xl font-bold text-xs cursor-pointer ${t.btnNeutral}`}
          >
            🏠 Volver al Menú
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 7. PERFIL Y CUENTA DE USER MODAL (Login único + Personaje y Terreno Predeterminados)
// =========================================================================
interface PerfilModalProps {
  userActual: UserCuenta | null;
  onLoginSuccess: (user: UserCuenta) => void;
  onLogout: () => void;
  onAbrirAdmin: () => void;
  onCerrar: () => void;
}

export const PerfilModal: React.FC<PerfilModalProps> = ({
  userActual,
  onLoginSuccess,
  onLogout,
  onAbrirAdmin,
  onCerrar,
}) => {
  const { t } = useMurosTheme();
  const [tab, setTab] = useState<'login' | 'registro'>('login');
  const [perfilSubTab, setPerfilSubTab] = useState<'mi_perfil' | 'comunidad'>('mi_perfil');
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [textoBajaConfirmacion, setTextoBajaConfirmacion] = useState('');
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const [mostrandoCambioClave, setMostrandoCambioClave] = useState(false);
  const [claveActualInput, setClaveActualInput] = useState('');
  const [nuevaClaveInput, setNuevaClaveInput] = useState('');
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [cambioClaveError, setCambioClaveError] = useState<string | null>(null);
  const [cambioClaveOk, setCambioClaveOk] = useState(false);

  const [perfilNombre, setPerfilNombre] = useState<string>(() => userActual?.nombre || '');
  const [guardandoPreferencias, setGuardandoPreferencias] = useState(false);
  const [guardadoOkMsg, setGuardadoOkMsg] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiagnosticoDeRed>(() => obtenerDiagnosticoRed());

  const [todasLasCuentas, setTodasLasCuentas] = useState<Record<string, UserCuenta>>(() =>
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
  }, [userActual, cargando]);

  useEffect(() => {
    if (userActual) {
      setPerfilNombre(userActual.nombre || '');
    }
  }, [userActual?.id, userActual?.nombre]);

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
      const res = await registrarUserAsync(nombre, clave, '#ff6b6b', 'corona', 'madera');
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
      <div className={`relative w-full max-w-sm rounded-3xl p-5 flex flex-col max-h-[92vh] overflow-y-auto ${t.shellModal}`}>
        <div className={`flex items-center justify-between pb-3 mb-2 border-b-2 ${t.divider}`}>
          <h3 className={`text-xl font-black flex items-center gap-2 ${t.title}`}>
            <span>👤</span> {userActual ? 'Mi Perfil' : 'Perfil y Cuenta'}
          </h3>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center cursor-pointer transition-colors ${t.closeBtn}`}
          >
            ✕
          </button>
        </div>

        {/* Estado Database en Perfil */}
        {diag.checkedOnce && !diag.dbConectado && (
          <div className={`p-2.5 mb-2 rounded-xl text-[11px] font-bold flex items-center justify-between gap-2 ${t.bannerDanger}`}>
            <span>⚠️ Sin conexión a la Database: no se pueden enviar o recibir cambios.</span>
            <button
              type="button"
              onClick={() => {
                pingServidor();
                sincronizarConNube(true);
              }}
              className={`py-1 px-2 rounded-lg text-[10px] font-black cursor-pointer shrink-0 ${t.btnNeutral}`}
            >
              🔄 Conectar
            </button>
          </div>
        )}

        {userActual ? (
          <div className="flex flex-col gap-3 py-1">
            <div className={`grid grid-cols-2 p-1 rounded-xl ${t.track}`}>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPerfilSubTab('mi_perfil');
                }}
                className={`py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                  perfilSubTab === 'mi_perfil' ? t.tabActive : t.tabInactive
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
                  perfilSubTab === 'comunidad' ? t.tabActive : t.tabInactive
                }`}
              >
                👥 Comunidad ({Object.keys(todasLasCuentas).length})
              </button>
            </div>

            {perfilSubTab === 'mi_perfil' ? (
              <>
                <div className={`flex items-center gap-3 p-3 rounded-2xl shadow-sm ${t.card}`}>
                  <CartoonCharacter
                    color={userActual.avatarColor}
                    hat={userActual.avatarHat}
                    ropa={userActual.avatarRopa}
                    ropaColor={userActual.avatarRopaColor}
                    aura={userActual.avatarAura}
                    size={56}
                    showShadow={false}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-black text-base truncate ${t.title}`}>
                        {userActual.nombre}
                      </span>
                      {(userActual.rol === 'dev' || userActual.id === 'admin') && (
                        <span className={`text-[10px] font-black ${t.esOscuro ? 'text-amber-300' : 'text-[#d9480f]'}`}>
                          · 👑 {userActual.id === 'admin' ? 'Dev Supremo' : 'Dev'}
                        </span>
                      )}
                      {userActual.rol === 'admin' && userActual.id !== 'admin' && (
                        <span className={`text-[10px] font-black ${t.esOscuro ? 'text-indigo-300' : 'text-[#364fc7]'}`}>
                          · 🛡️ Admin
                        </span>
                      )}
                      {userActual.rol === 'mod' && (
                        <span className={`text-[10px] font-black ${t.accentText}`}>
                          · 🔰 Mod
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold block ${t.sub}`}>
                      ID: {userActual.id} · {obtenerNivelYTitulo(userActual.puntos).titulo}
                    </span>
                    <span className={`text-xs font-black block ${t.accentText}`}>
                      {userActual.puntos} puntos acumulados
                    </span>
                    {userActual.id !== 'admin' && perfilNombre.trim() !== userActual.nombre && (
                      <span className={`text-[10px] font-black block mt-0.5 ${t.esOscuro ? 'text-amber-300' : 'text-[#d9480f]'}`}>
                        👀 Nombre sin guardar · Pulsa Guardar abajo
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className={`p-2.5 rounded-xl ${t.card}`}>
                    <span className={`text-[11px] font-bold block ${t.muted}`}>Victorias</span>
                    <span className={`text-lg font-black ${t.title}`}>
                      {userActual.victorias} / {userActual.partidas}
                    </span>
                  </div>
                  <div className={`p-2.5 rounded-xl ${t.card}`}>
                    <span className={`text-[11px] font-bold block ${t.muted}`}>Nivel Actual</span>
                    <span className={`text-sm font-black ${t.title}`}>
                      {obtenerNivelYTitulo(userActual.puntos).icono} {obtenerNivelYTitulo(userActual.puntos).titulo}
                    </span>
                  </div>
                </div>

                {/* Nombre visible en Perfil */}
                {userActual.id !== 'admin' && (
                  <div className={`p-3 rounded-2xl flex flex-col gap-2 shadow-sm text-left ${t.card}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black uppercase tracking-wider ${t.sub}`}>
                        Nombre de Perfil
                      </span>
                      {toastMsg && (
                        <span className={`text-[10px] font-black animate-pulse ${t.esOscuro ? 'text-rose-300' : 'text-[#e03131]'}`}>
                          {toastMsg}
                        </span>
                      )}
                      {guardadoOkMsg && (
                        <span className={`text-[10px] font-black animate-bounce ${t.accentText}`}>
                          ✓ ¡Guardado!
                        </span>
                      )}
                    </div>

                    <div>
                      <label className={`text-[10px] font-bold block mb-0.5 ${t.muted}`}>
                        Nombre visible (3 a 15 caracteres):
                      </label>
                      <input
                        type="text"
                        minLength={3}
                        maxLength={15}
                        value={perfilNombre}
                        onChange={(e) => setPerfilNombre(e.target.value)}
                        className={`w-full text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={guardandoPreferencias}
                      onClick={async () => {
                        sounds.playClick();
                        const cleanName = perfilNombre.trim();
                        if (cleanName.length < 3 || cleanName.length > 15) {
                          sounds.playError();
                          setToastMsg('⚠️ Nombre entre 3 y 15 caracteres');
                          setTimeout(() => setToastMsg(null), 2500);
                          return;
                        }
                        setGuardandoPreferencias(true);
                        try {
                          const res = await actualizarCuentaAsync(userActual, {
                            nombre: cleanName,
                          });
                          if (res.ok && res.user) {
                            onLoginSuccess(res.user);
                            setGuardadoOkMsg(true);
                            setTimeout(() => setGuardadoOkMsg(false), 2500);
                          } else {
                            sounds.playError();
                            setToastMsg(res.error || '⚠️ No se pudo guardar');
                            setTimeout(() => setToastMsg(null), 2500);
                          }
                        } catch {
                          setToastMsg('⚠️ Error de red');
                          setTimeout(() => setToastMsg(null), 2500);
                        } finally {
                          setGuardandoPreferencias(false);
                        }
                      }}
                      className={`w-full py-1.5 rounded-xl font-black text-xs cursor-pointer mt-1 flex items-center justify-center gap-1.5 ${t.btnPrimary}`}
                    >
                      <span>💾</span>
                      <span>
                        {guardandoPreferencias ? 'Guardando...' : 'Guardar Nombre'}
                      </span>
                    </button>
                  </div>
                )}

                {(userActual.rol === 'dev' ||
                  userActual.rol === 'admin' ||
                  userActual.rol === 'mod' ||
                  userActual.id === 'admin') && (
                  <button
                    onClick={() => {
                      sounds.playClick();
                      onAbrirAdmin();
                    }}
                    className={`w-full py-2.5 rounded-xl font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 ${t.btnAmber}`}
                  >
                    <span>
                      {userActual.rol === 'dev' || userActual.id === 'admin'
                        ? '👑'
                        : userActual.rol === 'admin'
                        ? '🛡️'
                        : '🔰'}
                    </span>
                    <span>
                      {userActual.rol === 'dev' || userActual.id === 'admin'
                        ? 'Abrir Consola de Desarrollo (Dev)'
                        : userActual.rol === 'admin'
                        ? 'Abrir Panel de Administración'
                        : 'Abrir Salas Online (Moderación)'}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => {
                    sounds.playClick();
                    cerrarSesion();
                    onLogout();
                    onCerrar();
                  }}
                  className={`w-full py-2 rounded-xl font-bold text-xs cursor-pointer ${t.btnDanger}`}
                >
                  Cerrar Sesión
                </button>

                {/* Formulario de Cambio de Contraseña Personal */}
                <div className={`pt-2 border-t ${t.divider}`}>
                  {!mostrandoCambioClave ? (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setMostrandoCambioClave(true);
                        setCambioClaveError(null);
                        setCambioClaveOk(false);
                      }}
                      className={`w-full py-1.5 px-3 rounded-xl font-bold text-[11px] cursor-pointer flex items-center justify-center gap-1.5 ${t.btnNeutral}`}
                    >
                      <span>🔑</span>
                      <span>Cambiar mi contraseña</span>
                    </button>
                  ) : (
                    <div className={`p-3 rounded-2xl flex flex-col gap-2 text-left ${t.card}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black flex items-center gap-1 ${t.title}`}>
                          <span>🔑</span> Cambiar Contraseña
                        </span>
                        <button
                          type="button"
                          onClick={() => setMostrandoCambioClave(false)}
                          className={`text-[10px] font-bold hover:underline cursor-pointer ${t.muted}`}
                        >
                          Cancelar
                        </button>
                      </div>

                      {cambioClaveOk ? (
                        <div className={`p-2 text-xs font-bold rounded-xl text-center ${t.bannerSuccess}`}>
                          ✅ Contraseña actualizada correctamente en la Database.
                        </div>
                      ) : (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            sounds.playClick();
                            setCambioClaveError(null);
                            setCambiandoClave(true);
                            const res = await cambiarClaveUserAsync(claveActualInput, nuevaClaveInput);
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
                            <label className={`text-[10px] font-bold block mb-0.5 ${t.muted}`}>
                              Contraseña actual:
                            </label>
                            <input
                              type="password"
                              required
                              value={claveActualInput}
                              onChange={(e) => setClaveActualInput(e.target.value)}
                              placeholder="••••••••"
                              className={`w-full text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                            />
                          </div>

                          <div>
                            <label className={`text-[10px] font-bold block mb-0.5 ${t.muted}`}>
                              Nueva contraseña:
                            </label>
                            <input
                              type="password"
                              required
                              minLength={4}
                              value={nuevaClaveInput}
                              onChange={(e) => setNuevaClaveInput(e.target.value)}
                              placeholder="Mínimo 4 caracteres"
                              className={`w-full text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                            />
                          </div>

                          {cambioClaveError && (
                            <span className={`text-[10px] font-bold block ${t.esOscuro ? 'text-rose-300' : 'text-[#c92a2a]'}`}>
                              ⚠️ {cambioClaveError}
                            </span>
                          )}

                          <button
                            type="submit"
                            disabled={cambiandoClave || !claveActualInput || !nuevaClaveInput}
                            className={`w-full py-1.5 font-black text-xs rounded-xl disabled:opacity-50 cursor-pointer ${t.btnAmber}`}
                          >
                            {cambiandoClave ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {userActual.id !== 'admin' && (
                  <div className={`pt-2 border-t ${t.divider}`}>
                    {!confirmandoBaja ? (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setConfirmandoBaja(true);
                          setTextoBajaConfirmacion('');
                        }}
                        className={`w-full py-1.5 px-3 rounded-xl font-bold text-[11px] cursor-pointer flex items-center justify-center gap-1 ${t.btnDanger}`}
                      >
                        <span>🗑️</span>
                        <span>Darme de baja (Eliminar mi cuenta)</span>
                      </button>
                    ) : (
                      <div className={`p-3 rounded-2xl flex flex-col gap-2 text-left animate-[fadeIn_0.2s_ease-out] ${t.bannerDanger}`}>
                        <div className="text-xs font-black">
                          ⚠️ ¿Confirmas eliminar tu cuenta permanentemente?
                        </div>
                        <p className="text-[11px] font-bold">
                          Escribe <strong>{userActual.nombre}</strong> o <strong>BORRAR</strong>:
                        </p>
                        <input
                          type="text"
                          value={textoBajaConfirmacion}
                          onChange={(e) => setTextoBajaConfirmacion(e.target.value)}
                          placeholder={`Escribe ${userActual.nombre} o BORRAR`}
                          className={`w-full text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setConfirmandoBaja(false)}
                            className={`flex-1 py-1.5 rounded-xl font-bold text-xs cursor-pointer ${t.btnNeutral}`}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={
                              cargando ||
                              (textoBajaConfirmacion.trim().toUpperCase() !== 'BORRAR' &&
                                textoBajaConfirmacion.trim().toLowerCase() !==
                                  userActual.nombre.trim().toLowerCase())
                            }
                            onClick={async () => {
                              sounds.playClick();
                              setCargando(true);
                              const res = await darDeBajaUserAsync(textoBajaConfirmacion);
                              setCargando(false);
                              if (res.ok) {
                                onLogout();
                                onCerrar();
                              } else {
                                setToastMsg(res.error || '⚠️ Sin conexión a la Database para eliminar');
                              }
                            }}
                            className={`flex-1 py-1.5 rounded-xl font-black text-xs disabled:opacity-40 cursor-pointer ${t.btnDanger}`}
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
                <span className={`text-[11px] font-black uppercase ${t.muted}`}>
                  Jugadores Registrados ({comunidadLista.length})
                </span>
                {comunidadLista.map((u, idx) => {
                  const esYo = u.id === userActual.id;
                  const lvl = obtenerNivelYTitulo(u.puntos);
                  return (
                    <div
                      key={u.id}
                      className={`p-2.5 rounded-xl flex items-center gap-2.5 ${
                        esYo
                          ? t.esClasico
                            ? 'bg-[#fff9db] border-2 border-[#2b2140] shadow-sm font-bold'
                            : t.esClaro
                            ? 'bg-[#FCE8B8]/65 border border-[#EAD08E] font-bold'
                            : 'bg-amber-300/15 border border-amber-300/35 font-bold'
                          : t.card
                      }`}
                    >
                      <span className={`text-xs font-black w-4 ${t.muted}`}>{idx + 1}º</span>
                      <CartoonCharacter
                        color={u.avatarColor}
                        hat={u.avatarHat}
                        ropa={u.avatarRopa}
                        ropaColor={u.avatarRopaColor}
                        aura={u.avatarAura}
                        size={34}
                        showShadow={false}
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-extrabold truncate ${t.title}`}>
                            {u.nombre}
                          </span>
                          {esYo && <span className={`text-[10px] font-black ${t.accentText}`}>· TÚ</span>}
                          {(u.rol === 'dev' || u.id === 'admin') && <span className="text-[10px]">👑</span>}
                          {u.rol === 'admin' && u.id !== 'admin' && <span className="text-[10px]">🛡️</span>}
                          {u.rol === 'mod' && <span className="text-[10px]">🔰</span>}
                        </div>
                        <span className={`text-[10px] font-semibold block ${t.muted}`}>
                          {lvl.icono} {lvl.titulo} · {u.id}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs font-black block ${t.title}`}>{u.puntos} pts</span>
                        <span className={`text-[10px] block ${t.muted}`}>{u.victorias} vic</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            <div className={`grid grid-cols-2 p-1 rounded-xl ${t.track}`}>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setTab('login');
                  setErrorMsg(null);
                }}
                className={`py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                  tab === 'login' ? t.tabActive : t.tabInactive
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
                    ? t.esClasico
                      ? 'bg-[#51cf66] text-[#134e20] border border-[#2b2140] shadow-sm'
                      : t.esClaro
                      ? 'bg-[#B7EBD0] text-[#0F3D27] border border-[#8AD2AE] shadow-xs'
                      : 'bg-emerald-400/25 text-emerald-100 border border-emerald-400/40 shadow-xs'
                    : t.tabInactive
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
                <label className={`text-xs font-bold block mb-0.5 ${t.muted}`}>
                  {tab === 'login' ? 'User ID:' : 'Nombre / User ID:'}
                </label>
                <input
                  type="text"
                  minLength={3}
                  maxLength={20}
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={tab === 'login' ? 'Tu User ID' : 'Tu nombre / ID inicial (3-15 caracteres)'}
                  className={`w-full text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                />
              </div>

              <div>
                <label className={`text-xs font-bold block mb-0.5 ${t.muted}`}>
                  Clave / Contraseña:
                </label>
                <input
                  type="password"
                  required
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                />
              </div>

              {errorMsg && (
                <div className={`p-2 text-xs font-bold rounded-xl text-center ${t.bannerDanger}`}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className={`w-full py-2.5 rounded-xl font-black text-sm cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2 ${t.btnPrimary}`}
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
  userActual?: UserCuenta | null;
  onuserActualizado?: (user: UserCuenta | null) => void;
  onAbrirLogin?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  onCerrar,
  onShowToast = () => {},
  userActual,
  onuserActualizado,
  onAbrirLogin,
}) => {
  const { t } = useMurosTheme();
  const esAdminSupremoUnico = Boolean(
    userActual && (userActual.id === 'admin' || userActual.esSupremo)
  );
  const esYoSupremo = Boolean(
    userActual && (userActual.rol === 'dev' || esAdminSupremoUnico)
  );
  const esAdmin = Boolean(userActual && (userActual.rol === 'admin' || esYoSupremo));
  const esMod = Boolean(userActual && userActual.rol === 'mod');
  const tieneRolStaff = esYoSupremo || esAdmin || esMod;

  const [adminTab, setAdminTab] = useState<'jugadores' | 'editor' | 'torneo' | 'salas'>(() => {
    if (esMod && !esAdmin) return 'salas';
    return 'jugadores';
  });
  const [cuentas, setCuentas] = useState<Record<string, UserCuenta>>(() => cargarCuentas());
  const [filtro, setFiltro] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [diag, setDiag] = useState<DiagnosticoDeRed>(() => obtenerDiagnosticoRed());
  const [adminSyncError, setAdminSyncError] = useState<string | null>(null);

  // Salas Personalizadas (Dev, Admin, Mod)
  const [salasPersonalizadas, setSalasPersonalizadas] = useState<SalaPersonalizada[]>([]);
  const [creandoSala, setCreandoSala] = useState(false);
  const [nuevaSalaCodigo, setNuevaSalaCodigo] = useState('');
  const [nuevaSalaNombre, setNuevaSalaNombre] = useState('');
  const [nuevaSalaMaxJugadores, setNuevaSalaMaxJugadores] = useState<2 | 4>(2);
  const [nuevaSalaModo, setNuevaSalaModo] = useState<'estandar' | 'caos' | 'tactico'>('estandar');
  const [nuevaSalaTablero, setNuevaSalaTablero] = useState<TamanoTablero>(9);
  const [nuevaSalaMensaje, setNuevaSalaMensaje] = useState('');

  // Confirmaciones
  const [confirmandoResetRanking, setConfirmandoResetRanking] = useState(false);
  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<string | null>(null);

  // Inspector de inventario
  const [inspectingUser, setInspectingUser] = useState<UserCuenta | null>(null);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [moviendoCharId, setMoviendoCharId] = useState<string | null>(null);

  // Solicitud de reset de ranking
  const [solicitudReset, setSolicitudReset] = useState<SolicitudResetRanking | null>(null);

  // Configuración de torneo semanal
  const [puntos1, setPuntos1] = useState(50);
  const [puntos2, setPuntos2] = useState(25);
  const [puntos3, setPuntos3] = useState(15);
  const [puntosPart, setPuntosPart] = useState(5);
  const [premioActivo, setPremioActivo] = useState<AvatarColeccionable | undefined>(undefined);
  const [guardandoTorneo, setGuardandoTorneo] = useState(false);

  // Editor visual de personajes
  const [editorNombre, setEditorNombre] = useState('Campeón Legendario');
  const [editorColor, setEditorColor] = useState('#ffd43b');
  const [editorHat, setEditorHat] = useState<AvatarTipoDeGorro>('corona');
  const [editorRopa, setEditorRopa] = useState<AvatarTipoDeRopa>('capa');
  const [editorRopaColor, setEditorRopaColor] = useState<string>('#c92a2a');
  const [editorAura, setEditorAura] = useState<AvatarTipoDeAura>('dorada');
  const [editorTargetId, setEditorTargetId] = useState<string>('');
  const [guardandoEditor, setGuardandoEditor] = useState(false);

  // Configuración de desbloqueos de personajes base (Solo Dev)
  const [desbloqueosDev, setDesbloqueosDev] = useState<Record<string, number>>(() => obtenerDesbloqueosLocales());
  const [guardandoDesbloqueos, setGuardandoDesbloqueos] = useState(false);

  // Campos de edición de jugador
  const [editNombre, setEditNombre] = useState('');
  const [editNuevoId, setEditNuevoId] = useState('');
  const [editClave, setEditClave] = useState('');
  const [editRol, setEditRol] = useState<UserRol>('jugador');
  const [editPuntos, setEditPuntos] = useState<number>(0);
  const [editVictorias, setEditVictorias] = useState<number>(0);

  const eraStaffRef = React.useRef<boolean>(tieneRolStaff);
  const revocadoNotificadoRef = React.useRef<boolean>(false);
  const userActualRef = React.useRef<UserCuenta | null | undefined>(userActual);
  userActualRef.current = userActual;

  const onCerrarRef = React.useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const onShowToastRef = React.useRef(onShowToast);
  onShowToastRef.current = onShowToast;
  const onuserActualizadoRef = React.useRef(onuserActualizado);
  onuserActualizadoRef.current = onuserActualizado;

  useEffect(() => {
    return suscribirDiagnostico(setDiag);
  }, []);

  // Forzar pestaña de Salas si es Moderador sin rango Admin/Dev
  useEffect(() => {
    if (esMod && !esAdmin && adminTab !== 'salas') {
      setAdminTab('salas');
    }
  }, [esMod, esAdmin, adminTab]);

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
        obtenerSolicitudResetRankingAsync(true),
        obtenerConfigSemanalAsync(),
        obtenerDesbloqueosPersonajesAsync(true),
        obtenerSalasPersonalizadasAsync(true),
      ]);
      setSolicitudReset(sol);
      if (desb) {
        setDesbloqueosDev(desb);
      }
      if (salas) {
        setSalasPersonalizadas(salas);
      }
      if (cfg?.puntosConfig) {
        setPuntos1(cfg.puntosConfig.primerLugar ?? 50);
        setPuntos2(cfg.puntosConfig.segundoLugar ?? 25);
        setPuntos3(cfg.puntosConfig.tercerLugar ?? 15);
        setPuntosPart(cfg.puntosConfig.participacion ?? 5);
      }
      if (cfg?.premioSemanal !== undefined) {
        setPremioActivo(cfg.premioSemanal || undefined);
      }
      setAdminSyncError(cfg?._error || null);
    } catch (err: any) {
      setAdminSyncError(err?.message || 'Error cargando configuración administrativa desde D1.');
    }
  }, []);

  const verificarRevocacionYActualizarLista = React.useCallback(
    (accs: Record<string, UserCuenta>) => {
      setCuentas(accs);
      setEditandoId((prevEdit) => (prevEdit && !accs[prevEdit] ? null : prevEdit));
      setConfirmandoEliminarId((prevDel) => (prevDel && !accs[prevDel] ? null : prevDel));
      setInspectingUser((prevIns) => (prevIns && accs[prevIns.id] ? accs[prevIns.id] : null));

      const cur = userActualRef.current;
      if (cur) {
        const fresh = accs[cur.id];
        if (!fresh) {
          if (cur.id !== 'admin' && cur.rol !== 'dev') {
            if (!revocadoNotificadoRef.current) {
              revocadoNotificadoRef.current = true;
              onuserActualizadoRef.current?.(null);
              onShowToastRef.current('⚠️ Tu cuenta ya no existe en la Database.');
              onCerrarRef.current();
            }
            return false;
          }
        } else {
          if (
            fresh.rol !== cur.rol ||
            fresh.puntos !== cur.puntos ||
            fresh.victorias !== cur.victorias ||
            fresh.nombre !== cur.nombre ||
            fresh.avatarHat !== cur.avatarHat ||
            fresh.avatarRopa !== cur.avatarRopa ||
            fresh.avatarAura !== cur.avatarAura ||
            JSON.stringify(fresh.inventario || { personajes: [] }) !==
              JSON.stringify(cur.inventario || { personajes: [] })
          ) {
            onuserActualizadoRef.current?.(fresh);
          }
          if (
            cur.id !== 'admin' &&
            cur.rol !== 'dev' &&
            fresh.rol !== 'admin' &&
            fresh.rol !== 'dev' &&
            fresh.rol !== 'mod'
          ) {
            if (!revocadoNotificadoRef.current) {
              revocadoNotificadoRef.current = true;
              sounds.playError();
              onShowToastRef.current('⛔ Tus permisos de Staff fueron revocados.');
              onCerrarRef.current();
            }
            return false;
          }
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
    const check = await D1_VerificarAccionAdmin(userActual || null, requiereSupremo);
    if (!check.ok) {
      sounds.playError();
      onShowToast(check.error || '⛔ Acción no autorizada');
      if (check.revocado) {
        const accs = cargarCuentas();
        const updated = userActual ? accs[userActual.id] || null : null;
        onuserActualizado?.(updated);
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
    const res = await restablecerClaveUserAsync(id);
    if (res.ok && res.claveTemporal) {
      setClaveTemporalInfo({ nombre, clave: res.claveTemporal });
      onShowToast(`🔑 Clave restablecida para ${nombre}`);
    } else {
      sounds.playError();
      onShowToast(res.error || 'No se pudo restablecer la clave');
    }
  };

  const iniciarEdicion = (acc: UserCuenta) => {
    sounds.playClick();
    setEditandoId(acc.id);
    setEditNombre(acc.nombre);
    setEditNuevoId(acc.id);
    setEditClave('');
    setEditRol(acc.rol || 'jugador');
    setEditPuntos(acc.puntos);
    setEditVictorias(acc.victorias);
  };

  const guardarEdicion = async (id: string) => {
    sounds.playClick();
    const targetOriginal = cuentas[id];
    if (!targetOriginal) return;

    // Solo el Dev Supremo Único puede asignar o revocar el rango Dev, o modificar a un Dev
    const cambioRolMayor =
      editRol === 'admin' ||
      editRol === 'dev' ||
      targetOriginal.rol === 'admin' ||
      targetOriginal.rol === 'dev';
    const autorizado = await verificarPermisoAccion(cambioRolMayor);
    if (!autorizado) return;

    const nombreLimpio = editNombre.trim();
    if (nombreLimpio.length < 3 || nombreLimpio.length > 15) {
      onShowToast('⚠️ El nombre debe tener entre 3 y 15 letras');
      return;
    }

    const nuevoIdLimpio = editNuevoId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (esYoSupremo && nuevoIdLimpio !== id) {
      if (nuevoIdLimpio.length < 3 || nuevoIdLimpio.length > 20 || nuevoIdLimpio === 'admin') {
        onShowToast('⚠️ El nuevo ID debe tener entre 3 y 20 caracteres válidos');
        return;
      }
    }

    setGuardando(true);
    try {
      let effectiveTargetId = id;
      if (esYoSupremo && nuevoIdLimpio && nuevoIdLimpio !== id) {
        const resId = await adminCambiarIdUserAsync(id, nuevoIdLimpio);
        if (!resId.ok) {
          sounds.playError();
          onShowToast(resId.error || '⚠️ No se pudo cambiar el ID de la cuenta');
          return;
        }
        effectiveTargetId = nuevoIdLimpio;
      }

      const patchData: any = {
        nombre: nombreLimpio,
        rol: esAdminSupremoUnico
          ? editRol
          : esYoSupremo
          ? editRol === 'dev'
            ? targetOriginal.rol
            : editRol
          : editRol === 'mod'
          ? 'mod'
          : 'jugador',
        puntos: editPuntos,
        victorias: editVictorias,
      };
      if (esYoSupremo && editClave.trim()) {
        patchData.clave = editClave.trim();
      }

      const res = await adminActualizarUserAsync(effectiveTargetId, patchData);

      if (res.ok) {
        const actualizadas = cargarCuentas();
        setCuentas(actualizadas);
        setEditandoId(null);
        if (userActual && (userActual.id === id || userActual.id === effectiveTargetId)) {
          onuserActualizado?.(actualizadas[effectiveTargetId] || null);
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

  const ejecutarEliminarUser = async (id: string, nombre: string) => {
    sounds.playClick();
    if (!esYoSupremo) {
      onShowToast('⛔ Solo el Dev Supremo puede eliminar cuentas permanentemente.');
      return;
    }
    const autorizado = await verificarPermisoAccion(true);
    if (!autorizado) return;

    setGuardando(true);
    try {
      const res = await adminEliminarUserAsync(id);
      if (res.ok) {
        const actualizadas = cargarCuentas();
        setCuentas(actualizadas);
        setConfirmandoEliminarId(null);
        onShowToast(`🗑️ User "${nombre}" eliminado de la Database`);
      } else {
        sounds.playError();
        onShowToast(res.error || '⚠️ No se pudo eliminar el user');
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
        if (userActual && userActual.id !== 'admin' && actualizadas[userActual.id]) {
          onuserActualizado?.(actualizadas[userActual.id]);
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
          porNombre: userActual?.nombre || 'Admin',
          porId: userActual?.id || 'admin',
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
      onShowToast('⚠️ Selecciona un jugador para regalar el avatar');
      return;
    }
    sounds.playClick();
    setGuardandoEditor(true);
    try {
      const nuevoChar = {
        nombre: editorNombre.trim() || 'Avatar Exclusivo',
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
        onShowToast(res.error || 'Error al entregar avatar');
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
      const nuevoPremio = {
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
        setPremioActivo({
          id: 'premio_actual',
          ...nuevoPremio,
          fechaAdquisicion: new Date().toISOString(),
          origen: 'torneo_semanal',
        });
        await cargarDatosAdminAdicionales();
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

  // Quitar personaje del inventario (Dev o Admin)
  const handleQuitarPersonaje = async (userId: string, personajeId: string) => {
    sounds.playClick();
    const res = await quitarPersonajeInventarioAsync(userId, personajeId);
    if (res.ok) {
      const accs = cargarCuentas();
      setCuentas(accs);
      if (inspectingUser && inspectingUser.id === userId) {
        setInspectingUser(accs[userId] || null);
      }
      onShowToast('🗑️ Avatar retirado del inventario');
    } else {
      onShowToast(res.error || 'No se pudo retirar el avatar');
    }
  };

  // Mover avatar de un inventario a otro (Dev o Admin)
  const handleMoverPersonaje = async (fromId: string, toId: string, personajeId: string) => {
    if (!toId) {
      onShowToast('⚠️ Selecciona un jugador destino para mover el avatar');
      return;
    }
    sounds.playClick();
    setMoviendoCharId(personajeId);
    try {
      const res = await moverPersonajeInventarioAsync(fromId, toId, personajeId);
      if (res.ok) {
        sounds.playVictory();
        const accs = cargarCuentas();
        setCuentas(accs);
        if (inspectingUser && inspectingUser.id === fromId) {
          setInspectingUser(accs[fromId] || null);
        }
        onShowToast(res.mensaje || '📦 Avatar transferido al otro inventario');
      } else {
        sounds.playError();
        onShowToast(res.error || 'No se pudo mover el avatar');
      }
    } finally {
      setMoviendoCharId(null);
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
      const res = await importarDatosJSONAsync(content);
      if (res.ok) {
        setCuentas(cargarCuentas());
        onShowToast('✅ Datos locales restaurados');
      } else {
        onShowToast(res.error || '❌ Archivo de respaldo inválido');
      }
    };
    reader.readAsText(file);
  };

  const qFiltro = filtro.trim().toLowerCase();
  const cuentasFiltradas = Object.values(cuentas).filter(
    (acc) =>
      !qFiltro ||
      acc.nombre.toLowerCase().includes(qFiltro) ||
      acc.id.toLowerCase().includes(qFiltro)
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

  const sombrerosDisponibles: AvatarTipoDeGorro[] = [
    'corona', 'pompon', 'antena', 'brote', 'mago',
    'gatito', 'zorro', 'robot', 'dragon', 'ninja',
    'navidad', 'granjero', 'vikingo', 'copa', 'gorra', 'boina', 'espacial',
  ];

  const ropasDisponibles: { id: AvatarTipoDeRopa; label: string; icon: string }[] = [
    { id: 'ninguna', label: 'Sin Ropa', icon: '👕' },
    { id: 'capa', label: 'Capa Real', icon: '🧣' },
    { id: 'armadura', label: 'Armadura', icon: '🛡️' },
    { id: 'tunica', label: 'Túnica', icon: '🥋' },
    { id: 'tuxedo', label: 'Tuxedo', icon: '🤵' },
    { id: 'cinturon', label: 'Cinturón Oro', icon: '🥋' },
    { id: 'alas', label: 'Alas Cósmicas', icon: '🪽' },
  ];

  const aurasDisponibles: { id: AvatarTipoDeAura; label: string; icon: string }[] = [
    { id: 'ninguna', label: 'Sin Aura', icon: '⚪' },
    { id: 'dorada', label: 'Dorada', icon: '✨' },
    { id: 'fuego', label: 'Fuego', icon: '🔥' },
    { id: 'ciber', label: 'Cíber Neón', icon: '⚡' },
    { id: 'arcoiris', label: 'Arcoíris', icon: '🌈' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className={`relative w-full max-w-xl rounded-3xl p-3.5 sm:p-5 flex flex-col max-h-[92vh] overflow-hidden ${t.shellModal}`}>
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 mb-2 border-b-2 ${t.divider}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0">{esYoSupremo ? '👑' : esAdmin ? '🛡️' : '🔰'}</span>
            <div className="min-w-0">
              <h3 className={`text-lg sm:text-xl font-black leading-none truncate ${t.title}`}>
                {esYoSupremo
                  ? 'Consola de Desarrollo (Dev)'
                  : esAdmin
                  ? 'Panel de Administración'
                  : 'Panel de Moderación (Salas)'}
              </h3>
              <span className={`text-[11px] font-bold block truncate ${t.muted}`}>
                {esYoSupremo
                  ? 'Control Total de la Database D1'
                  : esAdmin
                  ? `Administrador: ${userActual?.nombre}`
                  : `Moderador: ${userActual?.nombre}`}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onCerrar();
            }}
            className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center cursor-pointer transition-colors shrink-0 ${t.closeBtn}`}
          >
            ✕
          </button>
        </div>

        {!tieneRolStaff ? (
          <div className="flex flex-col items-center gap-3 my-6 text-center">
            <span className="text-4xl">🔒</span>
            <p className={`text-xs sm:text-sm font-bold leading-relaxed ${t.sub}`}>
              Para acceder al Panel de Administración, inicia sesión con tu cuenta de Staff o con el Dev Supremo en la Database.
            </p>
            {onAbrirLogin && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onAbrirLogin();
                }}
                className={`w-full py-2.5 rounded-xl font-black text-sm cursor-pointer ${t.btnAmber}`}
              >
                👤 Ir a Iniciar Sesión
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-0.5 sm:pr-1 flex flex-col gap-3 my-1 min-w-0">
            {/* Status Bar */}
            {!diag.dbConectado ? (
              <div className={`p-2.5 rounded-2xl text-xs font-bold flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-sm min-w-0 ${t.bannerDanger}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-black flex items-center gap-1">
                    <span>⚠️</span>
                    <span>SIN CONEXIÓN A DATABASE (D1)</span>
                  </div>
                  <p className="text-[10px] leading-tight mt-0.5 opacity-90">
                    Las acciones se sincronizarán en cuanto se restablezca la conexión con la Database.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => sincronizar(true)}
                  disabled={sincronizando}
                  className={`py-1 px-2.5 rounded-xl text-[11px] font-black cursor-pointer shrink-0 ml-auto ${t.btnNeutral}`}
                >
                  {sincronizando ? '⏳...' : '🔄 Reconectar'}
                </button>
              </div>
            ) : (
              <div className={`p-2 rounded-2xl text-xs font-black flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-sm min-w-0 ${t.bannerSuccess}`}>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-base shrink-0">{esYoSupremo ? '👑' : esAdmin ? '🛡️' : '🔰'}</span>
                  <div className="leading-tight min-w-0">
                    <span className="block truncate text-xs">
                      {esYoSupremo
                        ? 'Sesión Suprema: Dev Activo'
                        : esAdmin
                        ? `Admin: ${userActual?.nombre}`
                        : `Mod: ${userActual?.nombre}`}
                    </span>
                    <span className="text-[10px] font-bold block truncate opacity-90">
                      🟢 Database D1 Conectada ({diag.serverPingMs} ms)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => sincronizar(true)}
                  disabled={sincronizando}
                  className={`py-1 px-2 rounded-lg text-[10px] font-black cursor-pointer flex items-center gap-1 shrink-0 ${t.btnNeutral}`}
                >
                  <span className={sincronizando ? 'animate-spin' : ''}>🔄</span>
                  <span>Sincronizar</span>
                </button>
              </div>
            )}

            {adminSyncError && (
              <div className={`p-2 rounded-2xl text-[11px] font-bold flex items-center justify-between gap-2 ${t.bannerDanger}`}>
                <span className="min-w-0 break-words">⚠️ Error de D1 en panel Staff: {adminSyncError}</span>
                <button
                  type="button"
                  onClick={() => setAdminSyncError(null)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 cursor-pointer ${t.btnNeutral}`}
                >
                  Ocultar
                </button>
              </div>
            )}

            {diag.advertenciasInventario && diag.advertenciasInventario.length > 0 && (
              <div className={`p-2.5 rounded-2xl text-[11px] font-bold flex flex-col gap-1 ${t.bannerWarn}`}>
                <div className="font-black">
                  ⚠️ Inventario con JSON inválido detectado en D1 ({diag.advertenciasInventario.length}):
                </div>
                <div className="text-[10px] leading-snug opacity-90">
                  Se protegió el dato original en D1 para evitar sobrescribirlo con vacío. Cuentas afectadas:{' '}
                  {diag.advertenciasInventario
                    .map((w) => `${w.nombre} (@${w.id})`)
                    .join(', ')}
                </div>
              </div>
            )}

            {/* Pestañas de Navegación (Responsivas: 2x2 en móvil, 4 cols en escritorio) */}
            <div className={`grid ${esAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1'} gap-1.5 p-1.5 rounded-2xl ${t.track}`}>
              {esAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setAdminTab('jugadores');
                    }}
                    className={`py-1.5 px-2 rounded-xl font-black text-[11px] sm:text-xs leading-tight text-center transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 ${
                      adminTab === 'jugadores' ? t.tabActive : t.tabInactive
                    }`}
                  >
                    <span>👥</span>
                    <span className="truncate">Jugadores</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setAdminTab('editor');
                    }}
                    className={`py-1.5 px-2 rounded-xl font-black text-[11px] sm:text-xs leading-tight text-center transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 ${
                      adminTab === 'editor' ? t.tabActive : t.tabInactive
                    }`}
                  >
                    <span>🎨</span>
                    <span className="truncate">Avatares</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setAdminTab('torneo');
                    }}
                    className={`py-1.5 px-2 rounded-xl font-black text-[11px] sm:text-xs leading-tight text-center transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 ${
                      adminTab === 'torneo' ? t.tabActive : t.tabInactive
                    }`}
                  >
                    <span>🏆</span>
                    <span className="truncate">Torneo & Premios</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setAdminTab('salas');
                }}
                className={`py-1.5 px-2 rounded-xl font-black text-[11px] sm:text-xs leading-tight text-center transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 ${
                  adminTab === 'salas' ? t.tabActive : t.tabInactive
                }`}
              >
                <span>🎮</span>
                <span className="truncate">Salas Online ({esAdmin ? 'Staff' : 'Mod'})</span>
              </button>
            </div>

            {/* Banner de Solicitud de Reset Pendiente */}
            {solicitudReset?.solicitada && (
              <div className={`p-3 rounded-2xl text-xs flex flex-col gap-2 shadow-sm ${t.bannerWarn}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0">📨</span>
                    <div className="min-w-0">
                      <span className="font-black block">
                        Solicitud de Reinicio de Ranking Semanal
                      </span>
                      <span className="text-[11px] opacity-90 block">
                        Pedida por <strong>{solicitudReset.porNombre}</strong> ({solicitudReset.fecha})
                      </span>
                    </div>
                  </div>
                  {esYoSupremo ? (
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => responderSolicitudReset(true)}
                        className={`py-1 px-2 rounded-lg font-black text-[11px] cursor-pointer ${t.btnPrimary}`}
                      >
                        ✓ Aprobar y Reiniciar
                      </button>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => responderSolicitudReset(false)}
                        className={`py-1 px-2 rounded-lg font-black text-[11px] cursor-pointer ${t.btnDanger}`}
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black self-start ${t.badgeNeutral}`}>
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
                    className={`w-full text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                  />
                  <span className={`text-xs font-bold whitespace-nowrap ${t.muted}`}>
                    {cuentasFiltradas.length} cuentas
                  </span>
                </div>

                {/* Alerta de Clave Temporal */}
                {claveTemporalInfo && (
                  <div className={`p-3 rounded-2xl flex items-start justify-between gap-3 text-xs shadow-sm ${t.bannerInfo}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-black flex items-center gap-1.5">
                        <span>🔑</span>
                        <span>Nueva clave temporal generada para <strong>{claveTemporalInfo.nombre}</strong></span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className={`px-2 py-1 rounded font-mono font-black text-sm select-all ${t.badgeNeutral}`}>
                          {claveTemporalInfo.clave}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(claveTemporalInfo.clave);
                            onShowToast('📋 Clave copiada al portapapeles');
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${t.btnSky}`}
                        >
                          Copiar
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] opacity-85">
                        Esta clave fue cifrada en la Database. Pásasela al user.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClaveTemporalInfo(null)}
                      className="p-1 rounded font-bold cursor-pointer"
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

                    const puedeEditarEstaCuenta = !isRootAdmin && (
                      isAccountDev
                        ? esAdminSupremoUnico
                        : acc.rol === 'admin'
                        ? esYoSupremo
                        : esAdmin
                    );

                    const badgeRol =
                      acc.id === 'admin' || acc.rol === 'dev' ? (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                          t.esOscuro
                            ? 'bg-amber-300/15 text-amber-200 border-amber-300/35'
                            : 'bg-[#ffe8cc] text-[#d9480f] border-[#ffa94d]'
                        }`}>
                          👑 DEV
                        </span>
                      ) : acc.rol === 'admin' ? (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                          t.esOscuro
                            ? 'bg-indigo-300/15 text-indigo-200 border-indigo-300/35'
                            : 'bg-[#dbe4ff] text-[#364fc7] border-[#91a7ff]'
                        }`}>
                          🛡️ ADMIN
                        </span>
                      ) : acc.rol === 'mod' ? (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                          t.esOscuro
                            ? 'bg-emerald-300/15 text-emerald-200 border-emerald-300/35'
                            : 'bg-[#e6fcf5] text-[#099268] border-[#63e6be]'
                        }`}>
                          🔰 MOD
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.badgeNeutral}`}>
                          🎮 JUGADOR
                        </span>
                      );

                    return (
                      <div
                        key={acc.id}
                        className={`p-3 rounded-2xl shadow-sm flex flex-col gap-2 ${t.card}`}
                      >
                        {!isEditing ? (
                          <>
                            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="shrink-0">
                                  <CartoonCharacter
                                    color={acc.avatarColor}
                                    hat={acc.avatarHat}
                                    ropa={acc.avatarRopa}
                                    ropaColor={acc.avatarRopaColor}
                                    aura={acc.avatarAura}
                                    size={36}
                                    showShadow={false}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`font-black text-xs sm:text-sm truncate ${t.title}`}>
                                      {acc.nombre}
                                    </span>
                                    {badgeRol}
                                  </div>
                                  <span className={`text-[11px] font-semibold block truncate ${t.muted}`}>
                                    ID: {acc.id} · {acc.puntos} pts · {acc.victorias} vic
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-auto">
                                {/* Botón ver Inventario */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    sounds.playClick();
                                    setInspectingUser(acc);
                                  }}
                                  className={`py-1 px-2 rounded-lg text-[11px] font-black cursor-pointer flex items-center gap-1 ${t.btnAmber}`}
                                  title="Ver inventario de avatares exclusivos"
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
                                        className={`p-1.5 rounded-lg text-xs cursor-pointer ${t.btnSky}`}
                                        title="Restablecer clave temporal (Solo Dev)"
                                      >
                                        🔑
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => iniciarEdicion(acc)}
                                      className={`p-1.5 rounded-lg text-xs cursor-pointer ${t.btnAmber}`}
                                      title="Editar jugador"
                                    >
                                      ✏️
                                    </button>
                                  </>
                                )}

                                {esYoSupremo && acc.id !== 'admin' && acc.id !== userActual?.id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sounds.playClick();
                                      setConfirmandoEliminarId(acc.id);
                                    }}
                                    className={`p-1.5 rounded-lg text-xs cursor-pointer ${t.btnDanger}`}
                                    title="Eliminar permanentemente de la Database"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Confirmación eliminación */}
                            {isConfirmingDelete && (
                              <div className={`p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs ${t.bannerDanger}`}>
                                <span className="font-black">
                                  ¿Eliminar a "{acc.nombre}" de la Database?
                                </span>
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmandoEliminarId(null)}
                                    className={`py-1 px-2 rounded-lg font-bold text-[11px] cursor-pointer ${t.btnNeutral}`}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={guardando}
                                    onClick={() => ejecutarEliminarUser(acc.id, acc.nombre)}
                                    className={`py-1 px-2.5 rounded-lg font-black text-[11px] cursor-pointer ${t.btnDanger}`}
                                  >
                                    {guardando ? 'Borrando...' : 'Sí, eliminar'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          /* Formulario de Edición */
                          <div className={`flex flex-col gap-2 pt-2 border-t ${t.divider}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className={`font-bold block mb-0.5 ${t.muted}`}>Nombre:</label>
                                <input
                                  type="text"
                                  minLength={3}
                                  maxLength={15}
                                  value={editNombre}
                                  onChange={(e) => setEditNombre(e.target.value)}
                                  className={`w-full rounded px-2 py-1 font-bold ${t.input}`}
                                />
                              </div>
                              {esYoSupremo ? (
                                <div>
                                  <label className={`font-bold block mb-0.5 ${t.muted}`}>Nueva Clave (Solo Dev):</label>
                                  <input
                                    type="password"
                                    placeholder="Dejar vacío para no cambiar"
                                    value={editClave}
                                    onChange={(e) => setEditClave(e.target.value)}
                                    className={`w-full rounded px-2 py-1 font-bold text-xs ${t.input}`}
                                  />
                                </div>
                              ) : (
                                <div className={`flex items-center text-[10px] italic sm:pt-4 ${t.muted}`}>
                                  🔒 Claves protegidas (Solo Dev)
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className={`font-bold block mb-0.5 ${t.muted}`}>Puntos:</label>
                                <input
                                  type="number"
                                  value={editPuntos}
                                  onChange={(e) => setEditPuntos(Number(e.target.value))}
                                  className={`w-full rounded px-2 py-1 font-bold ${t.input}`}
                                />
                              </div>
                              <div>
                                <label className={`font-bold block mb-0.5 ${t.muted}`}>Victorias:</label>
                                <input
                                  type="number"
                                  value={editVictorias}
                                  onChange={(e) => setEditVictorias(Number(e.target.value))}
                                  className={`w-full rounded px-2 py-1 font-bold ${t.input}`}
                                />
                              </div>
                            </div>

                            {esYoSupremo && acc.id !== 'admin' && (
                              <div className="text-xs">
                                <label className={`font-bold block mb-0.5 ${t.muted}`}>
                                  🆔 ID de Cuenta en Cascada (Solo Dev):
                                </label>
                                <input
                                  type="text"
                                  minLength={3}
                                  maxLength={20}
                                  value={editNuevoId}
                                  onChange={(e) => setEditNuevoId(e.target.value.toLowerCase())}
                                  className={`w-full rounded px-2 py-1 font-mono font-bold text-xs ${t.input}`}
                                />
                              </div>
                            )}

                            <div className="text-xs">
                              <label className={`font-bold block mb-0.5 ${t.muted}`}>Rol Asignado:</label>
                              {esAdminSupremoUnico ? (
                                <select
                                  value={editRol}
                                  onChange={(e) => setEditRol(e.target.value as UserRol)}
                                  className={`w-full rounded px-2 py-1 font-bold text-xs cursor-pointer ${t.input}`}
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
                                  onChange={(e) => setEditRol(e.target.value as UserRol)}
                                  className={`w-full rounded px-2 py-1 font-bold text-xs cursor-pointer ${t.input}`}
                                >
                                  <option value="jugador">🎮 Jugador Normal</option>
                                  <option value="mod">🔰 Moderador</option>
                                  <option value="admin">🛡️ Administrador</option>
                                </select>
                              ) : (
                                <select
                                  value={editRol === 'mod' ? 'mod' : 'jugador'}
                                  onChange={(e) => setEditRol(e.target.value as UserRol)}
                                  className={`w-full rounded px-2 py-1 font-bold text-xs cursor-pointer ${t.input}`}
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
                                className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${t.btnNeutral}`}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={guardando}
                                onClick={() => guardarEdicion(acc.id)}
                                className={`px-3 py-1 rounded text-xs font-black cursor-pointer ${t.btnPrimary}`}
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
                <div className={`p-3 rounded-2xl shadow-sm flex flex-col gap-2 mt-1 ${t.bannerDanger}`}>
                  <span className="font-black text-xs flex items-center gap-1.5">
                    <span>⚠️</span> Reinicio de Ranking Semanal
                  </span>
                  <p className="text-[11px] font-medium leading-relaxed opacity-90">
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
                        className={`w-full py-2 px-3 rounded-xl font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 ${t.btnDanger}`}
                      >
                        <span>🧹</span>
                        <span>Reiniciar Todo el Ranking Global a Cero</span>
                      </button>
                    ) : (
                      <div className={`p-3 rounded-xl flex flex-col gap-2 ${t.card}`}>
                        <span className={`text-xs font-black ${t.esOscuro ? 'text-rose-300' : 'text-[#a61e1e]'}`}>
                          🚨 ¿CONFIRMAS reiniciar todo el Ranking Global a 0 en la Database D1?
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={() => setConfirmandoResetRanking(false)}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${t.btnNeutral}`}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={ejecutarResetRankingGlobal}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-black cursor-pointer ${t.btnDanger}`}
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
                      className={`w-full py-2 px-3 rounded-xl font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 ${t.btnAmber}`}
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
                <div className={`p-3 rounded-2xl shadow-sm flex flex-col gap-2 ${t.card}`}>
                  <span className={`font-black text-xs flex items-center gap-1.5 ${t.title}`}>
                    <span>📦</span> Copia de Seguridad JSON
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className={`py-1.5 px-3 rounded-xl font-bold cursor-pointer flex items-center justify-center gap-1 ${t.btnNeutral}`}
                    >
                      📥 Descargar Copia
                    </button>
                    {esYoSupremo ? (
                      <label className={`py-1.5 px-3 rounded-xl font-bold cursor-pointer flex items-center justify-center gap-1 ${t.btnNeutral}`}>
                        📤 Restaurar Copia
                        <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                      </label>
                    ) : (
                      <div className={`py-1.5 px-3 rounded-xl font-bold flex items-center justify-center text-[11px] opacity-60 ${t.badgeNeutral}`}>
                        🔒 Restaurar (Dev)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EDITOR VISUAL DE AVATARES */}
            {adminTab === 'editor' && (
              <div className="flex flex-col gap-3">
                {/* Tarjeta de Previsualización en Vivo */}
                <div className={`p-4 rounded-3xl flex flex-col sm:flex-row items-center gap-4 justify-between ${
                  t.esClasico
                    ? 'bg-gradient-to-b from-[#f8f0fc] to-[#eebefa] border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140]'
                    : t.esClaro
                    ? 'bg-gradient-to-b from-[#EAE4FC]/70 to-[#DFD6FA]/70 border border-[#CCC1F2]'
                    : 'bg-gradient-to-b from-violet-300/15 to-fuchsia-300/10 border border-violet-300/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-2xl shadow-sm flex items-center justify-center ${t.cardInner}`}>
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
                      <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full ${t.bannerViolet}`}>
                        Edición Exclusiva
                      </span>
                      <h4 className={`text-base sm:text-lg font-black leading-tight mt-1 ${t.title}`}>
                        {editorNombre.trim() || 'Sin Nombre'}
                      </h4>
                      <div className="flex flex-wrap gap-1 mt-1 text-[10px] font-bold">
                        <span className={`px-1.5 py-0.5 rounded ${t.badgeNeutral}`}>
                          👒 {editorHat}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${t.badgeNeutral}`}>
                          👕 {editorRopa}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${t.badgeNeutral}`}>
                          ✨ {editorAura}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controles de Diseño */}
                <div className={`p-3 rounded-2xl shadow-sm flex flex-col gap-2.5 text-xs ${t.card}`}>
                  <div>
                    <label className={`font-black block mb-1 ${t.muted}`}>
                      Nombre del Avatar Exclusivo:
                    </label>
                    <input
                      type="text"
                      maxLength={24}
                      value={editorNombre}
                      onChange={(e) => setEditorNombre(e.target.value)}
                      placeholder="Ej: Guerrero del Dragón, Neón Ninja..."
                      className={`w-full text-xs font-black rounded-xl px-2.5 py-1.5 outline-none ${t.input}`}
                    />
                  </div>

                  {/* Selector de Color */}
                  <div>
                    <label className={`font-black block mb-1 ${t.muted}`}>Color Base del Cuerpo:</label>
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
                          className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                            t.esOscuro ? 'border-white/30' : 'border-[#2b2140]'
                          } ${
                            editorColor === c
                              ? `scale-115 shadow-md ${t.esOscuro ? 'ring-3 ring-white' : 'ring-3 ring-[#2b2140]'}`
                              : 'hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Selector de Sombreros */}
                  <div>
                    <label className={`font-black block mb-1 ${t.muted}`}>Sombrero / Accesorio Cabeza:</label>
                    <div className="flex flex-wrap gap-1">
                      {sombrerosDisponibles.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setEditorHat(h);
                          }}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                            editorHat === h ? t.btnAmber : t.btnNeutral
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selector de Ropa */}
                  <div>
                    <label className={`font-black block mb-1 ${t.muted}`}>Ropa & Atuendo Exclusivo:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                      {ropasDisponibles.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setEditorRopa(r.id);
                          }}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            editorRopa === r.id ? t.btnPrimary : t.btnNeutral
                          }`}
                        >
                          <span>{r.icon}</span>
                          <span className="truncate">{r.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Selector de Color de Ropa */}
                    {editorRopa !== 'ninguna' && (
                      <div className={`mt-2 p-2 rounded-xl ${t.cardInner}`}>
                        <label className={`font-bold block text-[11px] mb-1 ${t.muted}`}>
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
                              className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                                t.esOscuro ? 'border-white/30' : 'border-[#2b2140]'
                              } ${
                                editorRopaColor === rc
                                  ? `scale-120 shadow-md ${t.esOscuro ? 'ring-2 ring-white' : 'ring-2 ring-[#2b2140]'}`
                                  : 'hover:scale-105'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selector de Aura */}
                  <div>
                    <label className={`font-black block mb-1 ${t.muted}`}>Efecto Especial de Aura:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
                      {aurasDisponibles.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setEditorAura(a.id);
                          }}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            editorAura === a.id ? t.btnSky : t.btnNeutral
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
                  <div className={`p-3 rounded-2xl flex flex-col gap-2 ${t.bannerInfo}`}>
                    <span className="text-xs font-black flex items-center gap-1">
                      <span>🎁</span> Opción A: Regalar a un Jugador
                    </span>
                    <select
                      value={editorTargetId}
                      onChange={(e) => setEditorTargetId(e.target.value)}
                      className={`w-full text-xs font-bold rounded-xl px-2 py-1.5 outline-none cursor-pointer ${t.input}`}
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
                      className={`w-full py-2 rounded-xl font-black text-xs disabled:opacity-50 cursor-pointer ${t.btnSky}`}
                    >
                      {guardandoEditor ? '⏳ Entregando...' : '🎁 Otorgar a Inventario'}
                    </button>
                  </div>

                  {/* Opción 2: Fijar como Premio Semanal */}
                  <div className={`p-3 rounded-2xl flex flex-col gap-2 justify-between ${t.bannerWarn}`}>
                    <div>
                      <span className="text-xs font-black flex items-center gap-1">
                        <span>🏆</span> Opción B: Premio de Torneo
                      </span>
                      <p className="text-[11px] font-medium leading-tight mt-1 opacity-90">
                        El jugador que termine en 1er lugar del torneo el domingo se lo llevará de forma exclusiva a su inventario.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={guardandoEditor}
                      onClick={handleFijarPremioSemanal}
                      className={`w-full py-2 rounded-xl font-black text-xs cursor-pointer ${t.btnAmber}`}
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
                <div className={`p-3.5 rounded-2xl shadow-sm flex flex-col gap-2 ${t.bannerWarn}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black flex items-center gap-1.5">
                      <span>🏆</span> Premio Activo para el Ganador de la Semana
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.badgeNeutral}`}>
                      Domingo medianoche
                    </span>
                  </div>

                  {premioActivo ? (
                    <div className={`flex items-center gap-3 p-2.5 rounded-xl ${t.card}`}>
                      <CartoonCharacter
                        size={56}
                        color={premioActivo.color}
                        hat={premioActivo.hat}
                        ropa={premioActivo.ropa}
                        ropaColor={premioActivo.ropaColor}
                        aura={premioActivo.aura}
                      />
                      <div className="min-w-0">
                        <h4 className={`font-black text-sm truncate ${t.title}`}>{premioActivo.nombre}</h4>
                        <span className={`text-[11px] font-bold block ${t.muted}`}>
                          Atuendo: {premioActivo.ropa || 'básico'} · Aura: {premioActivo.aura || 'ninguna'}
                        </span>
                        <span className={`text-[10px] font-black ${t.accentText}`}>
                          ✓ Se otorga automáticamente al 1er puesto del Ranking
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-3 rounded-xl text-center text-xs font-bold ${t.card} ${t.muted}`}>
                      No hay premio exclusivo activo esta semana. Diseña uno en la pestaña <strong>[🎨 Avatares]</strong> y fíjalo como premio.
                    </div>
                  )}
                </div>

                {/* Configuración de Puntos Semanales */}
                <div className={`p-3 rounded-2xl shadow-sm flex flex-col gap-3 ${t.card}`}>
                  <div>
                    <h4 className={`text-xs font-black flex items-center gap-1.5 ${t.title}`}>
                      <span>⚙️</span> Escala de Puntos Semanales
                    </h4>
                    <p className={`text-[11px] font-medium mt-0.5 ${t.muted}`}>
                      Puntos sumados al Ranking Global al cerrar el Torneo Semanal cada domingo.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className={`p-2 rounded-xl ${t.bannerWarn}`}>
                      <label className="font-black block text-[11px]">🥇 1er Puesto:</label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={puntos1}
                        onChange={(e) => setPuntos1(Number(e.target.value))}
                        className={`w-full rounded px-1.5 py-1 font-black text-xs mt-1 ${t.input}`}
                      />
                    </div>
                    <div className={`p-2 rounded-xl ${t.cardInner}`}>
                      <label className={`font-black block text-[11px] ${t.sub}`}>🥈 2do Puesto:</label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={puntos2}
                        onChange={(e) => setPuntos2(Number(e.target.value))}
                        className={`w-full rounded px-1.5 py-1 font-black text-xs mt-1 ${t.input}`}
                      />
                    </div>
                    <div className={`p-2 rounded-xl ${t.bannerDanger}`}>
                      <label className="font-black block text-[11px]">🥉 3er Puesto:</label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={puntos3}
                        onChange={(e) => setPuntos3(Number(e.target.value))}
                        className={`w-full rounded px-1.5 py-1 font-black text-xs mt-1 ${t.input}`}
                      />
                    </div>
                    <div className={`p-2 rounded-xl ${t.bannerInfo}`}>
                      <label className="font-black block text-[11px]">🎮 Participar:</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={puntosPart}
                        onChange={(e) => setPuntosPart(Number(e.target.value))}
                        className={`w-full rounded px-1.5 py-1 font-black text-xs mt-1 ${t.input}`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={guardandoTorneo}
                    onClick={handleGuardarPuntosTorneo}
                    className={`w-full py-2 rounded-xl font-black text-xs cursor-pointer ${t.btnPrimary}`}
                  >
                    {guardandoTorneo ? '⏳ Guardando en Database...' : '💾 Guardar Escala de Puntos en Database'}
                  </button>
                </div>

                {/* Requisitos de Desbloqueo de Avatares Base (Solo Dev) */}
                {esYoSupremo && (
                  <div className={`p-3 rounded-2xl shadow-sm flex flex-col gap-3 ${t.card}`}>
                    <div>
                      <h4 className={`text-xs font-black flex items-center gap-1.5 ${t.title}`}>
                        <span>🔓</span> Requisitos de Desbloqueo de Avatares Base (Solo Dev)
                      </h4>
                      <p className={`text-[11px] font-medium mt-0.5 ${t.muted}`}>
                        Puntos requeridos en el Ranking Global para que cada avatar base aparezca y se desbloquee a los users. Los 5 iniciales siempre están disponibles desde 0 pts.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {RegDeAvatar.filter((p) => p.desbloqueoTipo === 'puntos').map((item) => (
                        <div key={item.id} className={`p-2 rounded-xl flex items-center justify-between gap-2 ${t.cardInner}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{item.emoji}</span>
                            <div className="min-w-0">
                              <span className={`font-black text-xs block truncate ${t.title}`}>{item.nombre}</span>
                              <span className={`text-[10px] block ${t.muted}`}>Puntos mínimos:</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={10000}
                              value={desbloqueosDev[item.id] ?? item.puntosRequeridos}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value));
                                setDesbloqueosDev((prev) => ({ ...prev, [item.id]: val }));
                              }}
                              className={`w-16 rounded px-1.5 py-1 font-black text-xs text-center ${t.input}`}
                            />
                            <span className={`text-[11px] font-bold ${t.muted}`}>pts</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={guardandoDesbloqueos}
                      onClick={handleGuardarDesbloqueosBase}
                      className={`w-full py-2 rounded-xl font-black text-xs cursor-pointer ${t.btnAmber}`}
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
                <div className={`p-3 rounded-2xl shadow-sm flex flex-col gap-2.5 ${t.card}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className={`text-xs font-black flex items-center gap-1.5 ${t.title}`}>
                      <span>🔰</span> Crear Sala Oficial / Evento Personalizado
                    </h4>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${t.bannerSuccess}`}>
                      Staff {esYoSupremo ? 'Dev' : esAdmin ? 'Admin' : 'Mod'}
                    </span>
                  </div>
                  <p className={`text-[11px] leading-tight font-medium ${t.muted}`}>
                    Las salas creadas aquí aparecen destacadas en la parte superior del Lobby Online para todos los jugadores con reglas personalizadas.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className={`font-bold block text-[11px] mb-0.5 ${t.muted}`}>Código de Sala:</label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="Ej: TORNEO1"
                        value={nuevaSalaCodigo}
                        onChange={(e) => setNuevaSalaCodigo(e.target.value.toUpperCase())}
                        className={`w-full rounded px-2 py-1 font-black text-xs uppercase ${t.input}`}
                      />
                    </div>
                    <div>
                      <label className={`font-bold block text-[11px] mb-0.5 ${t.muted}`}>Nombre de la Sala / Evento:</label>
                      <input
                        type="text"
                        maxLength={32}
                        placeholder="Ej: Sala Oficial Moderación"
                        value={nuevaSalaNombre}
                        onChange={(e) => setNuevaSalaNombre(e.target.value)}
                        className={`w-full rounded px-2 py-1 font-bold text-xs ${t.input}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className={`font-bold block text-[11px] mb-0.5 ${t.muted}`}>Jugadores:</label>
                      <select
                        value={nuevaSalaMaxJugadores}
                        onChange={(e) => setNuevaSalaMaxJugadores(Number(e.target.value) as 2 | 4)}
                        className={`w-full rounded px-1.5 py-1 font-bold text-xs cursor-pointer ${t.input}`}
                      >
                        <option value={2}>2 Jugadores (1v1)</option>
                        <option value={4}>4 Jugadores (FFA)</option>
                      </select>
                    </div>
                    <div>
                      <label className={`font-bold block text-[11px] mb-0.5 ${t.muted}`}>Modo de Muros:</label>
                      <select
                        value={nuevaSalaModo}
                        onChange={(e) => setNuevaSalaModo(e.target.value as any)}
                        className={`w-full rounded px-1.5 py-1 font-bold text-xs cursor-pointer ${t.input}`}
                      >
                        <option value="estandar">🧱 Estándar (10 muros)</option>
                        <option value="tactico">🎯 Táctico (5 muros)</option>
                        <option value="caos">💥 Caos (15 muros)</option>
                      </select>
                    </div>
                    <div>
                      <label className={`font-bold block text-[11px] mb-0.5 ${t.muted}`}>Tablero:</label>
                      <select
                        value={nuevaSalaTablero}
                        onChange={(e) => setNuevaSalaTablero(Number(e.target.value) as TamanoTablero)}
                        className={`w-full rounded px-1.5 py-1 font-bold text-xs cursor-pointer ${t.input}`}
                      >
                        <option value={5}>5 × 5 (Relámpago)</option>
                        <option value={7}>7 × 7 (Rápido)</option>
                        <option value={9}>9 × 9 (Clásico)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`font-bold block text-[11px] mb-0.5 ${t.muted}`}>Mensaje o Regla Especial (Opcional):</label>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="Ej: Sala de entrenamiento oficial para el torneo del fin de semana"
                      value={nuevaSalaMensaje}
                      onChange={(e) => setNuevaSalaMensaje(e.target.value)}
                      className={`w-full rounded px-2 py-1 font-medium text-xs ${t.input}`}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={creandoSala}
                    onClick={handleCrearSalaPersonalizada}
                    className={`w-full py-2 rounded-xl font-black text-xs cursor-pointer ${t.btnPrimary}`}
                  >
                    {creandoSala ? '⏳ Creando Sala Oficial...' : '✨ Publicar Sala Oficial en Lobby'}
                  </button>
                </div>

                {/* Lista de Salas Oficiales Activas */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black ${t.title}`}>
                      Salas Oficiales Destacadas ({salasPersonalizadas.length})
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const s = await obtenerSalasPersonalizadasAsync();
                        setSalasPersonalizadas(s);
                      }}
                      className={`text-[10px] font-bold hover:underline cursor-pointer ${t.esOscuro ? 'text-sky-300' : 'text-[#1971c2]'}`}
                    >
                      🔄 Actualizar
                    </button>
                  </div>

                  {salasPersonalizadas.length === 0 ? (
                    <div className={`p-4 rounded-2xl border-2 border-dashed text-center text-xs font-bold ${t.card} ${t.muted}`}>
                      No hay salas personalizadas creadas actualmente.
                      <br />
                      ¡Crea una arriba para que los jugadores la vean destacada en el Lobby!
                    </div>
                  ) : (
                    salasPersonalizadas.map((sala) => (
                      <div
                        key={sala.codigo}
                        className={`p-3 rounded-2xl shadow-sm flex items-center justify-between gap-2 ${t.card}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-mono font-black text-sm px-2 py-0.5 rounded-lg ${t.bannerWarn}`}>
                              {sala.codigo}
                            </span>
                            <span className={`font-black text-xs truncate ${t.title}`}>
                              {sala.nombre}
                            </span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${t.bannerInfo}`}>
                              {sala.maxJugadores} Jugadores · {sala.tamanoTablero || 9}x{sala.tamanoTablero || 9}
                            </span>
                          </div>
                          {sala.mensajeEspecial && (
                            <p className={`text-[11px] font-semibold mt-0.5 truncate ${t.accentText}`}>
                              💬 {sala.mensajeEspecial}
                            </p>
                          )}
                          <span className={`text-[10px] block mt-0.5 ${t.muted}`}>
                            Creada por: <strong>{sala.creador}</strong> ({sala.creadorRol?.toUpperCase() || 'MOD'})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEliminarSalaPersonalizada(sala.codigo)}
                          className={`p-1.5 rounded-xl cursor-pointer text-xs font-black shrink-0 ${t.btnDanger}`}
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
            <div className={`relative w-full max-w-md rounded-3xl p-3.5 sm:p-4 flex flex-col max-h-[85vh] overflow-hidden ${t.shellModal}`}>
              <div className={`flex items-center justify-between pb-2 mb-2 border-b-2 ${t.divider}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎒</span>
                  <div>
                    <h4 className={`font-black text-sm leading-tight ${t.title}`}>
                      Inventario de {inspectingUser.nombre}
                    </h4>
                    <span className={`text-[10px] font-bold ${t.muted}`}>
                      Avatares exclusivos coleccionados
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingUser(null)}
                  className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center cursor-pointer transition-colors ${t.closeBtn}`}
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 my-1">
                {(!inspectingUser.inventario?.personajes || inspectingUser.inventario.personajes.length === 0) ? (
                  <div className={`p-6 text-center text-xs font-bold ${t.muted}`}>
                    Este jugador no tiene avatares exclusivos aún en su inventario.
                    <br />
                    Puedes regalarle uno desde la pestaña <strong>[🎨 Avatares]</strong>.
                  </div>
                ) : (
                  inspectingUser.inventario.personajes.map((char) => (
                    <div
                      key={char.id}
                      className={`p-2.5 rounded-2xl flex flex-col gap-2 shadow-sm ${t.card}`}
                    >
                      <div className="flex items-center justify-between gap-2">
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
                            <span className={`font-black text-xs block truncate ${t.title}`}>
                              {char.nombre}
                            </span>
                            <span className={`text-[10px] block ${t.muted}`}>
                              Atuendo: {char.ropa || 'ninguno'} · Aura: {char.aura || 'ninguna'}
                            </span>
                            <span className={`text-[9px] font-black block ${t.accentText}`}>
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

                        {esAdmin && (
                          <button
                            type="button"
                            onClick={() => handleQuitarPersonaje(inspectingUser.id, char.id)}
                            className={`py-1 px-2 rounded-lg text-[10px] font-black cursor-pointer shrink-0 ${t.btnDanger}`}
                            title="Retirar avatar del inventario del user"
                          >
                            🗑️ Retirar
                          </button>
                        )}
                      </div>

                      {esAdmin && (
                        <div className={`flex flex-col sm:flex-row sm:items-center gap-1.5 pt-1.5 border-t min-w-0 ${t.divider}`}>
                          <select
                            value={moveTargets[char.id] || ''}
                            onChange={(e) =>
                              setMoveTargets((prev) => ({ ...prev, [char.id]: e.target.value }))
                            }
                            className={`flex-1 min-w-0 text-[11px] font-bold rounded-lg px-2 py-1 outline-none cursor-pointer ${t.input}`}
                          >
                            <option value="">Mover a otro jugador...</option>
                            {Object.values(cuentas)
                              .filter((u) => u.id !== 'admin' && u.id !== inspectingUser.id)
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.nombre} ({u.id})
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            disabled={moviendoCharId === char.id || !moveTargets[char.id]}
                            onClick={() =>
                              handleMoverPersonaje(inspectingUser.id, moveTargets[char.id] || '', char.id)
                            }
                            className={`py-1 px-2.5 rounded-lg text-[10px] font-black disabled:opacity-50 cursor-pointer shrink-0 ${t.btnSky}`}
                          >
                            {moviendoCharId === char.id ? '⏳...' : '📦 Mover'}
                          </button>
                        </div>
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
