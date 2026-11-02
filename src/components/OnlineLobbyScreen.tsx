/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { sounds } from '../audio/murosAudio';
import {
  formatRoomPeerId,
  generarCodigoSala,
  onlineService,
} from '../game/onlineService';
import { HatType, OnlinePlayerInfo, PublicRoomInfo, UserAccount } from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';

interface OnlineLobbyScreenProps {
  usuarioActual?: UserAccount | null;
  onIniciarPartidaOnline: (maxJugadores: 2 | 4) => void;
  onVolverAlMenu: () => void;
  onShowToast: (msg: string) => void;
}

type LobbyTab = 'publicas' | 'crear' | 'unirse' | 'en_sala';

export const OnlineLobbyScreen: React.FC<OnlineLobbyScreenProps> = ({
  usuarioActual,
  onIniciarPartidaOnline,
  onVolverAlMenu,
  onShowToast,
}) => {
  const [tab, setTab] = useState<LobbyTab>('publicas');
  const [nombre, setNombre] = useState<string>(() => usuarioActual ? usuarioActual.nombre : 'Tú');
  const [color, setColor] = useState<string>(() => usuarioActual ? usuarioActual.avatarColor : '#ff6b6b');
  const [hat, setHat] = useState<HatType>(() => usuarioActual ? usuarioActual.avatarHat : 'corona');
  const [codigoInput, setCodigoInput] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [maxJugadores, setMaxJugadores] = useState<2 | 4>(2);
  const [publicarEnLista, setPublicarEnLista] = useState<boolean>(true);
  const [salasDinamicas, setSalasDinamicas] = useState<PublicRoomInfo[]>([]);
  const [cargandoSalas, setCargandoSalas] = useState<boolean>(false);
  const [conectando, setConectando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [jugadoresEnLobby, setJugadoresEnLobby] = useState<OnlinePlayerInfo[]>([]);

  const recargarSalasPublicas = async () => {
    setCargandoSalas(true);
    try {
      const salas = await onlineService.obtenerSalasPublicas();
      setSalasDinamicas(salas);
    } catch {
      // ignore
    } finally {
      setCargandoSalas(false);
    }
  };

  useEffect(() => {
    if (tab === 'publicas') {
      recargarSalasPublicas();
      const interval = setInterval(() => {
        recargarSalasPublicas();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [tab]);

  // Wire Lobby Listeners
  useEffect(() => {
    onlineService.setCallbacks({
      onLobbyUpdate: (players, max) => {
        setJugadoresEnLobby([...players]);
        setMaxJugadores(max);
        setTab('en_sala');
        setConectando(false);
        setErrorMsg(null);
      },
      onError: (err) => {
        setConectando(false);
        setErrorMsg(err);
        sounds.playError();
      },
    });
  }, []);

  // Handle URL with ?sala=CODE
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramSala = params.get('sala');
      if (paramSala && paramSala.length >= 4) {
        setCodigoInput(paramSala.toUpperCase());
        setTab('unirse');
      }
    } catch {
      // ignore
    }
  }, []);

  // Entrar a una sala pública de la lista
  const handleEntrarSalaPublica = async (salaId: string, maxP: 2 | 4) => {
    sounds.playClick();
    setConectando(true);
    setErrorMsg(null);
    setRoomCode(salaId);
    setMaxJugadores(maxP);

    try {
      await onlineService.joinRoom(salaId, nombre, color, hat);
      setTab('en_sala');
      onShowToast(`¡Te has unido a ${salaId}!`);
    } catch {
      setErrorMsg('No se pudo conectar a la sala pública. Es posible que el anfitrión haya salido o la sala esté llena.');
      setConectando(false);
    }
  };

  const handleCrearSalaPrivada = async () => {
    sounds.playClick();
    setConectando(true);
    setErrorMsg(null);
    const code = generarCodigoSala();
    setRoomCode(code);

    try {
      await onlineService.createRoom(code, nombre, color, hat, maxJugadores);
      if (publicarEnLista) {
        await onlineService.publicarSalaPublica({
          codigo: code,
          nombre: `Sala de ${nombre}`,
          anfitrion: nombre,
          color,
          hat,
          maxJugadores,
          creadoEn: Date.now(),
        });
      }
      setTab('en_sala');
      onShowToast(`¡Sala ${code} creada! ${publicarEnLista ? 'Publicada en la lista.' : 'Privada lista.'}`);
    } catch {
      setErrorMsg('No se pudo crear la sala. Verifica tu conexión.');
      setConectando(false);
    }
  };

  const handleUnirseSala = async () => {
    const code = codigoInput.trim().toUpperCase();
    if (code.length < 4) {
      setErrorMsg('Introduce un código de sala válido');
      sounds.playError();
      return;
    }

    sounds.playClick();
    setConectando(true);
    setErrorMsg(null);
    setRoomCode(code);

    try {
      await onlineService.joinRoom(code, nombre, color, hat);
      onShowToast(`Conectando a la sala ${code}...`);
    } catch {
      setErrorMsg('No se pudo encontrar la sala. Asegúrate de que el anfitrión la tenga abierta.');
      setConectando(false);
    }
  };

  const handleCopiarEnlace = () => {
    sounds.playClick();
    const url = `${window.location.origin}${window.location.pathname}?sala=${roomCode}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        onShowToast('📋 ¡Enlace directo copiado al portapapeles!');
      })
      .catch(() => {
        navigator.clipboard.writeText(roomCode);
        onShowToast(`📋 Código ${roomCode} copiado`);
      });
  };

  const isHost = onlineService.getRole() === 'host';
  const puedeEmpezar = isHost && jugadoresEnLobby.length >= 2;

  // Auto-start when lobby reaches required capacity
  useEffect(() => {
    if (isHost && tab === 'en_sala' && jugadoresEnLobby.length >= maxJugadores) {
      const timer = setTimeout(() => {
        onIniciarPartidaOnline(maxJugadores);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isHost, tab, jugadoresEnLobby.length, maxJugadores, onIniciarPartidaOnline]);

  const hatsList: { id: HatType; label: string; icon: string; defaultColor: string }[] = [
    { id: 'corona', label: 'Corona', icon: '👑', defaultColor: '#ff6b6b' },
    { id: 'pompon', label: 'Pompón', icon: '❄️', defaultColor: '#4dabf7' },
    { id: 'antena', label: 'Antena', icon: '⚡', defaultColor: '#ffd43b' },
    { id: 'brote', label: 'Brote', icon: '🌱', defaultColor: '#51cf66' },
    { id: 'mago', label: 'Mago', icon: '🧙', defaultColor: '#9775fa' },
    { id: 'gatito', label: 'Gatito', icon: '🐱', defaultColor: '#f06595' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-5 max-w-xl mx-auto z-10 overflow-y-auto">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-3 mb-2 border-b-3 border-[#2b2140]/15">
        <button
          onClick={() => {
            sounds.playClick();
            onlineService.cleanUp();
            onVolverAlMenu();
          }}
          className="py-1.5 px-3 rounded-xl bg-white border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] text-xs font-bold text-[#2b2140] hover:bg-[#ffe3e3] active:translate-y-0.5 cursor-pointer flex items-center gap-1"
        >
          ◀ Menú
        </button>
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-black text-[#2b2140] flex items-center justify-center gap-1.5">
            <span>🌐</span>
            <span>Juego en Línea P2P</span>
          </h2>
          <span className="text-[11px] font-bold text-[#2b8a3e]">
            ● Conexión Directa sin Servidores
          </span>
        </div>
        <div className="w-16" />
      </div>

      {/* Main Tabs (Public, Create Private, Join Private) */}
      {tab !== 'en_sala' && (
        <div className="w-full flex-1 flex flex-col gap-3 py-1">
          {/* Tabs Selector */}
          <div className="grid grid-cols-3 p-1 bg-[#ede4d0] rounded-2xl border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140] w-full max-w-md mx-auto">
            <button
              onClick={() => {
                setTab('publicas');
                sounds.playClick();
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
                tab === 'publicas'
                  ? 'bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              🌍 Salas Públicas
            </button>
            <button
              onClick={() => {
                setTab('crear');
                sounds.playClick();
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
                tab === 'crear'
                  ? 'bg-[#ffd43b] text-[#5c3c00] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              👑 Crear Privada
            </button>
            <button
              onClick={() => {
                setTab('unirse');
                sounds.playClick();
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
                tab === 'unirse'
                  ? 'bg-[#4dabf7] text-[#183247] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140]'
                  : 'text-[#86542d] hover:text-[#2b2140]'
              }`}
            >
              🔑 Unirse Código
            </button>
          </div>

          {/* Profile Setup: Name and Avatar */}
          <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] flex flex-col gap-2">
            <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
              Tu Personaje
            </span>
            <div className="flex items-center gap-3">
              <CartoonCharacter color={color} hat={hat} size={54} showShadow={false} />

              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[11px] font-bold text-[#86542d] block">
                    Nombre en partida:
                  </label>
                  {usuarioActual ? (
                    <span className="text-[10px] bg-[#d3f9d8] text-[#134e20] font-black px-1.5 py-0.5 rounded border border-[#2b2140]">
                      ⭐ Perfil Oficial
                    </span>
                  ) : (
                    <span className="text-[10px] bg-[#fff3bf] text-[#8f4b00] font-extrabold px-1.5 py-0.5 rounded border border-[#2b2140]">
                      Invitado (sin ranking)
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={15}
                  value={usuarioActual ? usuarioActual.nombre : nombre}
                  onChange={(e) => {
                    if (!usuarioActual) {
                      setNombre(e.target.value);
                    }
                  }}
                  readOnly={Boolean(usuarioActual)}
                  placeholder="Tu nombre"
                  className={`w-full text-sm font-extrabold text-[#2b2140] border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none ${
                    usuarioActual
                      ? 'bg-[#edf2ff] cursor-not-allowed select-none'
                      : 'bg-[#f8f9fa] focus:ring-2 focus:ring-[#ffd43b]'
                  }`}
                  title={usuarioActual ? 'Tu nombre proviene de tu perfil iniciado' : undefined}
                />
              </div>
            </div>

            {/* Hat Selection (6 characters) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-1">
              {hatsList.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setHat(h.id);
                    setColor(h.defaultColor);
                  }}
                  className={`py-1.5 px-1 rounded-xl text-xs font-black border-2 border-[#2b2140] flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                    hat === h.id
                      ? 'bg-[#ffd43b] text-[#5c3c00] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                      : 'bg-[#fff8e7] text-[#593922] hover:bg-white'
                  }`}
                >
                  <span className="text-base">{h.icon}</span>
                  <span className="text-[10px]">{h.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: Salas Públicas (Matchmaking Abierto) */}
          {tab === 'publicas' && (
            <div className="p-3.5 bg-white rounded-2xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-sm font-black text-[#2b2140]">
                    🌍 Salas Públicas en Vivo
                  </h3>
                  <p className="text-[11px] text-[#86542d] leading-snug">
                    Únete a una partida pública creada por otros jugadores o a una de las arenas fijas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={recargarSalasPublicas}
                  disabled={cargandoSalas}
                  className="py-1 px-2.5 bg-[#f1f3f5] rounded-xl border border-[#2b2140] text-xs font-bold text-[#2b2140] hover:bg-[#e9ecef] cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span className={cargandoSalas ? 'animate-spin' : ''}>🔄</span>
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>

              {/* Salas Públicas Abiertas Dinámicas */}
              {salasDinamicas.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-[#2b8a3e] tracking-wider">
                    🟢 Salas Públicas Abiertas ({salasDinamicas.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {salasDinamicas.map((sala) => (
                      <button
                        key={sala.codigo}
                        disabled={conectando}
                        onClick={() => {
                          setCodigoInput(sala.codigo);
                          handleEntrarSalaPublica(sala.codigo, sala.maxJugadores);
                        }}
                        className="p-2.5 rounded-xl border-2 border-[#2b2140] bg-[#e7f5ff] hover:bg-[#d0ebff] active:translate-y-0.5 shadow-[0_2px_0_#2b2140] flex items-center gap-2.5 text-left transition-all cursor-pointer"
                      >
                        <CartoonCharacter color={sala.color} hat={sala.hat} size={36} showShadow={false} />
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-xs text-[#2b2140] block truncate">
                            {sala.nombre}
                          </span>
                          <span className="text-[10px] text-[#1864ab] font-bold block">
                            Anfitrión: {sala.anfitrion} • {sala.maxJugadores}P
                          </span>
                        </div>
                        <span className="text-[10px] bg-[#ffd43b] text-[#5c3c00] font-black px-1.5 py-0.5 rounded border border-[#2b2140] shrink-0">
                          Entrar ▶
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl border-2 border-dashed border-[#2b2140]/30 bg-[#f8f9fa] flex flex-col items-center justify-center text-center gap-2">
                  <span className="text-3xl">🏜️</span>
                  <span className="text-xs font-bold text-[#86542d]">
                    No hay salas públicas abiertas en este momento.
                  </span>
                  <span className="text-[11px] text-[#868e96]">
                    ¡Crea una sala y márcala como pública para que otros jugadores puedan unirse!
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setPublicarEnLista(true);
                      setTab('crear');
                    }}
                    className="mt-1 py-1.5 px-3 bg-[#ffd43b] text-[#5c3c00] rounded-xl border-2 border-[#2b2140] text-xs font-black shadow-[0_2px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer"
                  >
                    👑 Crear Sala Pública Ahora
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Crear Sala */}
          {tab === 'crear' && (
            <div className="p-3.5 bg-white rounded-2xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] flex flex-col gap-3">
              <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
                Capacidad de la Sala
              </span>
              <div className="flex gap-2">
                {[2, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setMaxJugadores(num as 2 | 4);
                    }}
                    className={`flex-1 py-2.5 rounded-xl font-black text-sm border-2 border-[#2b2140] transition-all cursor-pointer ${
                      maxJugadores === num
                        ? 'bg-[#51cf66] text-[#134e20] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                        : 'bg-[#fff8e7] text-[#593922] hover:bg-white'
                    }`}
                  >
                    {num} Jugadores
                  </button>
                ))}
              </div>

              {/* Toggle Public / Private */}
              <div
                onClick={() => {
                  sounds.playClick();
                  setPublicarEnLista(!publicarEnLista);
                }}
                className={`p-2.5 rounded-xl border-2 border-[#2b2140] flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  publicarEnLista ? 'bg-[#d3f9d8]' : 'bg-[#f8f9fa]'
                }`}
              >
                <div className="text-left">
                  <span className="text-xs font-black text-[#2b2140] block">
                    📢 Sala Pública (Visible en la lista)
                  </span>
                  <span className="text-[11px] font-medium text-[#495057]">
                    {publicarEnLista
                      ? 'Cualquier jugador podrá verla y unirse directamente.'
                      : 'Privada: sólo podrán unirse con tu código o enlace directo.'}
                  </span>
                </div>
                <div
                  className={`w-11 h-6 rounded-full border-2 border-[#2b2140] p-0.5 flex items-center shrink-0 ${
                    publicarEnLista ? 'bg-[#51cf66] justify-end' : 'bg-[#ced4da] justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white border border-[#2b2140]" />
                </div>
              </div>

              <button
                type="button"
                disabled={conectando}
                onClick={handleCrearSalaPrivada}
                className="w-full py-3 rounded-2xl font-black text-base bg-[#ffd43b] text-[#5c3c00] border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] hover:bg-[#fcc419] active:translate-y-1 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>👑</span>
                <span>{conectando ? 'Creando sala...' : 'Crear Sala y Abrir Lobby'}</span>
              </button>
            </div>
          )}

          {/* TAB 3: Unirse con Código */}
          {tab === 'unirse' && (
            <div className="p-3.5 bg-white rounded-2xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] flex flex-col gap-3">
              <div>
                <label className="text-xs font-black text-[#593922] block mb-1">
                  Introduce el Código de Sala:
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={codigoInput}
                  onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
                  placeholder="Ej: ML-A4X9K2"
                  className="w-full text-center text-lg font-black tracking-widest text-[#2b2140] bg-[#f8f9fa] border-3 border-[#2b2140] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#4dabf7]"
                />
              </div>

              <button
                type="button"
                disabled={conectando}
                onClick={handleUnirseSala}
                className="w-full py-3 rounded-2xl font-black text-base bg-[#4dabf7] text-[#183247] border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] hover:bg-[#339af0] active:translate-y-1 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                <span>{conectando ? 'Conectando...' : 'Unirme a la Sala'}</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-[#ffe3e3] text-[#c92a2a] text-xs font-bold rounded-xl border-2 border-[#2b2140] text-center animate-shake">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* VIEW: Dentro de la Sala (Waiting Lobby) */}
      {tab === 'en_sala' && (
        <div className="w-full flex-1 flex flex-col gap-3 py-1">
          {/* Room Code Card */}
          <div className="p-3 bg-white rounded-2xl border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#86542d] block">
                Código de Sala
              </span>
              <span className="text-2xl font-black text-[#2b2140] font-mono tracking-widest">
                {roomCode}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopiarEnlace}
                className="py-2 px-3 bg-[#ffd43b] text-[#5c3c00] rounded-xl border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black text-xs hover:bg-[#fcc419] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
                title="Copiar enlace de invitación con código"
              >
                <span>🔗</span>
                <span>Copiar Enlace</span>
              </button>
            </div>
          </div>

          {/* Players in Lobby */}
          <div className="p-3.5 bg-white rounded-2xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between pb-1 border-b-2 border-[#2b2140]/10">
              <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
                Jugadores Conectados ({jugadoresEnLobby.length}/{maxJugadores})
              </span>
              <span className="text-xs font-bold text-[#86542d]">
                {jugadoresEnLobby.length >= 2 ? '✅ Sala lista' : '⏳ Esperando rival...'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {jugadoresEnLobby.map((p) => (
                <div
                  key={p.peerId}
                  className="p-2.5 rounded-xl border-2 border-[#2b2140] bg-[#fff8e7] flex items-center gap-2.5 shadow-sm"
                >
                  <CartoonCharacter color={p.color} hat={p.hat} size={42} showShadow={false} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-[#2b2140] truncate">
                        {p.nombre}
                      </span>
                      {p.esAnfitrion && (
                        <span className="text-[9px] bg-[#ffd43b] text-[#5c3c00] font-black px-1 rounded border border-[#2b2140]">
                          HOST
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-[#2b8a3e] block">
                      ● Conectado
                    </span>
                  </div>
                </div>
              ))}

              {Array.from({ length: Math.max(0, maxJugadores - jugadoresEnLobby.length) }).map(
                (_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="p-2.5 rounded-xl border-2 border-dashed border-[#2b2140]/30 bg-[#f8f9fa] flex items-center justify-center text-center text-[#868e96] text-xs font-bold h-16 animate-pulse"
                  >
                    <span>Esperando jugador... ⏳</span>
                  </div>
                )
              )}
            </div>

            {/* Quick Reactions */}
            <div className="mt-auto pt-3 border-t-2 border-[#2b2140]/10">
              <span className="text-[11px] font-bold text-[#86542d] block mb-1">
                Reacciones rápidas:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {['👋', '🧱', '😱', '😂', '👏', '🧠', '👑', '🔥'].map((em) => (
                  <button
                    key={em}
                    onClick={() => {
                      sounds.playClick();
                      onlineService.sendReaction(em);
                    }}
                    className="w-8 h-8 rounded-xl bg-[#fff8e7] border border-[#2b2140] text-sm hover:scale-125 transition-transform flex items-center justify-center cursor-pointer shadow-sm active:translate-y-0.5"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status & Instant Start Info */}
          {jugadoresEnLobby.length >= maxJugadores ? (
            <div className="flex flex-col gap-2">
              <div className="p-3 bg-[#d3f9d8] text-[#134e20] rounded-2xl border-3 border-[#2b2140] text-sm font-black text-center shadow-[0_4px_0_#2b2140] animate-bounce flex items-center justify-center gap-2">
                <span>🚀</span>
                <span>¡Rival conectado! Iniciando partida automáticamente...</span>
              </div>
              {isHost && (
                <button
                  type="button"
                  onClick={() => onIniciarPartidaOnline(maxJugadores)}
                  className="w-full py-2.5 bg-[#ffd43b] text-[#5c3c00] rounded-xl border-2 border-[#2b2140] font-black text-sm shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer"
                >
                  ▶ Iniciar Partida Ahora Mismo
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 bg-[#e7f5ff] text-[#1864ab] rounded-2xl border-2 border-[#2b2140] text-xs font-bold text-center shadow-sm flex items-center justify-center gap-2 animate-pulse">
              <span>⏳</span>
              <span>Esperando a que entre el rival... La partida iniciará automáticamente en cuanto se conecte.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
