/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unificado: OnlineLobbyScreen + OnlineDiagnosticsOverlay
 */

import React, { useEffect, useRef, useState } from 'react';
import { sounds } from '../game/murosLocosEngine';
import { generarCodigoSala, normalizeRoomCode, onlineService } from '../game/onlineService';
import {
  AvatarTipoDeAura,
  AvatarTipoDeGorro,
  AvatarTipoDeRopa,
  DatosDiagnosticoOnline,
  InfoJugadorOnline,
  RegDeAvatar,
  InfoSalaPublica,
  SalaPersonalizada,
  TamanoTablero,
  UserCuenta,
} from '../types/murosLocos';
import { CartoonCharacter } from './CartoonCharacter';
import {
  obtenerDesbloqueosLocales,
  obtenerDesbloqueosPersonajesAsync,
  obtenerSalasPersonalizadasAsync,
} from '../game/storage';

// =========================================================================
// 1. ONLINE DIAGNOSTICS OVERLAY
// =========================================================================
export const OnlineDiagnosticsOverlay: React.FC = () => {
  const [data, setData] = useState<DatosDiagnosticoOnline>(() => onlineService.getDiagnosticData());
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    const unsubscribe = onlineService.subscribeDiagnostics((fresh) => {
      setData(fresh);
    });
    return unsubscribe;
  }, []);

  if (data.status === 'desconectado' && data.role === 'none' && data.logs.length === 0) {
    return null;
  }

  const getStatusColor = () => {
    switch (data.status) {
      case 'conectado':
        return 'bg-[#51cf66] text-[#134e20]';
      case 'negociando':
        return 'bg-[#ffd43b] text-[#5c3c00]';
      case 'reconectando':
        return 'bg-[#ff922b] text-[#6d2500]';
      default:
        return 'bg-[#ced4da] text-[#495057]';
    }
  };

  const getQualityBars = () => {
    let count = 0;
    if (data.calidad === 'excelente') count = 4;
    else if (data.calidad === 'buena') count = 3;
    else if (data.calidad === 'inestable') count = 2;
    else if (data.calidad === 'critica') count = 1;

    return (
      <div className="flex items-end gap-0.5 h-3.5">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`w-1 rounded-xs transition-all ${
              bar <= count
                ? count >= 3
                  ? 'bg-[#2b8a3e]'
                  : count === 2
                  ? 'bg-[#f59f00]'
                  : 'bg-[#e03131]'
                : 'bg-black/15'
            }`}
            style={{ height: `${bar * 25}%` }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed bottom-3 left-3 z-50 select-none font-sans">
      <div className="flex items-center gap-1.5 p-1.5 bg-[#fff8e7] border-2 border-[#2b2140] rounded-2xl shadow-[0_4px_0_#2b2140] text-xs">
        <div className="relative flex items-center justify-center w-3 h-3 ml-1">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              data.status === 'conectado'
                ? 'bg-[#51cf66] animate-ping'
                : data.status === 'negociando'
                ? 'bg-[#ffd43b] animate-ping'
                : 'bg-[#ff6b6b]'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 border border-[#2b2140] ${getStatusColor()}`}
          />
        </div>

        {getQualityBars()}

        <span className="font-mono-num font-black text-[11px] text-[#2b2140]">
          {data.pingMs !== null ? `${data.pingMs} ms` : 'P2P WebRTC'}
        </span>

        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className={`py-0.5 px-2 rounded-xl text-[10px] font-black border border-[#2b2140] transition-colors cursor-pointer ${
            expandido
              ? 'bg-[#2b2140] text-white'
              : 'bg-white text-[#2b2140] hover:bg-[#ede4d0]'
          }`}
          title="Ver diagnóstico detallado de conexión"
        >
          {expandido ? '✕' : 'ⓘ Red'}
        </button>
      </div>

      {expandido && (
        <div className="mt-2 w-80 max-w-[90vw] bg-[#fff8e7] border-3 border-[#2b2140] rounded-2xl p-3 shadow-[0_8px_0_#2b2140,0_16px_25px_rgba(0,0,0,0.35)] flex flex-col gap-2.5 animate-[slideUp_0.15s_ease-out]">
          <div className="flex items-center justify-between pb-1.5 border-b-2 border-[#2b2140]/15">
            <div className="flex items-center gap-1.5">
              <span className="text-base">📡</span>
              <span className="font-black text-xs text-[#2b2140]">Diagnóstico de Red P2P</span>
            </div>
            <button
              type="button"
              onClick={() => onlineService.sendInstantDiagnosticPing()}
              className="py-0.5 px-2 bg-white rounded-lg border border-[#2b2140] text-[10px] font-black hover:bg-[#fff9db] cursor-pointer"
            >
              🔄 Ping
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="p-1.5 bg-white rounded-xl border border-[#2b2140]/25">
              <span className="text-[9px] font-bold text-[#86542d] block">Estado Conexión</span>
              <span className="font-black text-[#2b2140] capitalize">{data.status}</span>
            </div>
            <div className="p-1.5 bg-white rounded-xl border border-[#2b2140]/25">
              <span className="text-[9px] font-bold text-[#86542d] block">Latencia RTT</span>
              <span className="font-black font-mono-num text-[#2b8a3e]">
                {data.pingMs !== null ? `${data.pingMs} ms` : 'Calculando...'}
              </span>
            </div>
            <div className="p-1.5 bg-white rounded-xl border border-[#2b2140]/25">
              <span className="text-[9px] font-bold text-[#86542d] block">Rol de Sesión</span>
              <span className="font-black text-[#2b2140] uppercase">
                {data.role === 'host' ? '👑 Anfitrión' : data.role === 'client' ? '🎮 Cliente' : 'Ninguno'}
              </span>
            </div>
            <div className="p-1.5 bg-white rounded-xl border border-[#2b2140]/25">
              <span className="text-[9px] font-bold text-[#86542d] block">Calidad Enlace</span>
              <span className="font-black text-[#2b2140] capitalize">{data.calidad}</span>
            </div>
          </div>

          <div className="p-2 bg-white rounded-xl border border-[#2b2140]/25 text-[10px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#86542d]">Mi PeerID:</span>
              <span className="font-mono text-[#2b2140] font-black truncate max-w-[170px]" title={data.miPeerId}>
                {data.miPeerId || 'Iniciando...'}
              </span>
            </div>
            {data.rivalPeerId && (
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#86542d]">Rival PeerID:</span>
                <span className="font-mono text-[#2b2140] font-black truncate max-w-[170px]" title={data.rivalPeerId}>
                  {data.rivalPeerId}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-[#593922] uppercase tracking-wider">
              Registro de Conexión (Logs):
            </span>
            <div className="bg-[#1a1b1e] text-[#d0ebff] font-mono rounded-xl p-2 max-h-28 overflow-y-auto text-[9px] space-y-1">
              {data.logs.length === 0 ? (
                <span className="text-gray-400 italic">Sin eventos registrados aún</span>
              ) : (
                data.logs.map((log, idx) => (
                  <div key={idx} className="leading-tight">
                    <span className="text-[#ffd43b]">[{log.ts}] </span>
                    <span
                      className={
                        log.tipo === 'error'
                          ? 'text-[#ff8787] font-bold'
                          : log.tipo === 'warn'
                          ? 'text-[#ffe066]'
                          : 'text-[#a5d8ff]'
                      }
                    >
                      {log.mensaje}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// 2. ONLINE LOBBY SCREEN
// =========================================================================
interface OnlineLobbyScreenProps {
  userActual?: UserCuenta | null;
  codigoSalaInicial?: string | null;
  onConsumirSalaInicial?: () => void;
  onIniciarPartidaOnline: (maxJugadores: 2 | 4, tamanoTablero: TamanoTablero) => void;
  onVolverAlMenu: () => void;
  onShowToast: (msg: string) => void;
}

type LobbyTab = 'publicas' | 'crear' | 'unirse' | 'en_sala';

export const OnlineLobbyScreen: React.FC<OnlineLobbyScreenProps> = ({
  userActual,
  codigoSalaInicial,
  onConsumirSalaInicial,
  onIniciarPartidaOnline,
  onVolverAlMenu,
  onShowToast,
}) => {
  const [tab, setTab] = useState<LobbyTab>(() => (codigoSalaInicial ? 'unirse' : 'publicas'));
  const [nombre, setNombre] = useState<string>(() => (userActual ? userActual.nombre : 'Invitado'));
  const [color, setColor] = useState<string>(() => (userActual ? userActual.avatarColor : '#ff6b6b'));
  const [hat, setHat] = useState<AvatarTipoDeGorro>(() => (userActual ? userActual.avatarHat : 'corona'));
  const [ropa, setRopa] = useState<AvatarTipoDeRopa>(() => (userActual?.avatarRopa || 'ninguna'));
  const [ropaColor, setRopaColor] = useState<string | undefined>(() => userActual?.avatarRopaColor);
  const [aura, setAura] = useState<AvatarTipoDeAura>(() => (userActual?.avatarAura || 'ninguna'));
  const [desbloqueos, setDesbloqueos] = useState<Record<string, number>>(() => obtenerDesbloqueosLocales());
  const [codigoInput, setCodigoInput] = useState<string>(() =>
    codigoSalaInicial ? normalizeRoomCode(codigoSalaInicial) : ''
  );
  const [roomCode, setRoomCode] = useState<string>('');
  const [maxJugadores, setMaxJugadores] = useState<2 | 4>(2);
  const [tamanoTablero, setTamanoTablero] = useState<TamanoTablero>(9);
  const [publicarEnLista, setPublicarEnLista] = useState<boolean>(true);
  const [salasDinamicas, setSalasDinamicas] = useState<InfoSalaPublica[]>([]);
  const [salasPersonalizadas, setSalasPersonalizadas] = useState<SalaPersonalizada[]>([]);
  const [cargandoSalas, setCargandoSalas] = useState<boolean>(false);
  const [conectando, setConectando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [jugadoresEnLobby, setJugadoresEnLobby] = useState<InfoJugadorOnline[]>([]);
  const [esAnfitrionLocal, setEsAnfitrionLocal] = useState<boolean>(
    () => onlineService.getRole() === 'host'
  );
  const autoJoinedCodeRef = useRef<string | null>(null);

  const onConsumirRef = useRef(onConsumirSalaInicial);
  onConsumirRef.current = onConsumirSalaInicial;
  const onShowToastRef = useRef(onShowToast);
  onShowToastRef.current = onShowToast;
  const onIniciarPartidaRef = useRef(onIniciarPartidaOnline);
  onIniciarPartidaRef.current = onIniciarPartidaOnline;
  const profileRef = useRef({ userActual, nombre, color, hat, ropa, ropaColor, aura });
  profileRef.current = { userActual, nombre, color, hat, ropa, ropaColor, aura };

  useEffect(() => {
    obtenerDesbloqueosPersonajesAsync()
      .then((d) => setDesbloqueos(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (userActual) {
      setNombre(userActual.nombre);
      setColor(userActual.avatarColor || '#ff6b6b');
      setHat(userActual.avatarHat || 'corona');
      setRopa(userActual.avatarRopa || 'ninguna');
      setRopaColor(userActual.avatarRopaColor);
      setAura(userActual.avatarAura || 'ninguna');
    }
  }, [userActual]);

  const recargarSalasPublicas = async () => {
    setCargandoSalas(true);
    try {
      const [salas, custom] = await Promise.all([
        onlineService.obtenerSalasPublicas(),
        obtenerSalasPersonalizadasAsync(),
      ]);
      setSalasDinamicas(salas);
      setSalasPersonalizadas(custom);
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
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        recargarSalasPublicas();
      }, 8000);
      const onFocus = () => recargarSalasPublicas();
      window.addEventListener('focus', onFocus);
      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', onFocus);
      };
    }
  }, [tab]);

  useEffect(() => {
    onlineService.setCallbacks({
      onLobbyUpdate: (players, max, tablero) => {
        setJugadoresEnLobby([...players]);
        setMaxJugadores(max);
        if (tablero) setTamanoTablero(tablero);
        setRoomCode(onlineService.getRoomCode());
        setEsAnfitrionLocal(onlineService.getRole() === 'host');
        setTab('en_sala');
        setConectando(false);
        setErrorMsg(null);
      },
      onLobbyError: (err) => {
        setConectando(false);
        setErrorMsg(err);
        sounds.playError();
      },
    });
    const currentPlayers = onlineService.getLobbyPlayers();
    if (currentPlayers.length > 0 && onlineService.getRoomCode()) {
      setJugadoresEnLobby([...currentPlayers]);
      setRoomCode(onlineService.getRoomCode());
      setEsAnfitrionLocal(onlineService.getRole() === 'host');
    }
    return () => {
      onlineService.setCallbacks({
        onLobbyUpdate: undefined,
        onLobbyError: undefined,
      });
    };
  }, []);

  // Si el user entra desde un enlace directo (?sala=7TQERX), unirse automáticamente a esa sala
  useEffect(() => {
    let targetCode = normalizeRoomCode(codigoSalaInicial || '');
    if (!targetCode) {
      try {
        const params = new URLSearchParams(window.location.search);
        targetCode = normalizeRoomCode(params.get('sala') || '');
      } catch {}
    }

    if (targetCode.length >= 3 && autoJoinedCodeRef.current !== targetCode) {
      autoJoinedCodeRef.current = targetCode;
      setCodigoInput(targetCode);
      setRoomCode(targetCode);
      setTab('unirse');
      setConectando(true);
      setErrorMsg(null);
      onConsumirRef.current?.();

      const snap = profileRef.current;
      const joinName = (snap.userActual?.nombre || snap.nombre || 'Invitado').trim();
      const joinColor = snap.userActual?.avatarColor || snap.color || '#4dabf7';
      const joinHat = snap.userActual?.avatarHat || snap.hat || 'corona';

      onlineService
        .joinRoom(targetCode, joinName, joinColor, joinHat, {
          cuentaId: snap.userActual?.id,
          ropa: snap.userActual?.avatarRopa || snap.ropa,
          ropaColor: snap.userActual?.avatarRopaColor ?? snap.ropaColor,
          aura: snap.userActual?.avatarAura || snap.aura,
        })
        .then(() => {
          setConectando(false);
          setErrorMsg(null);
          setEsAnfitrionLocal(onlineService.getRole() === 'host');
          const list = onlineService.getLobbyPlayers();
          if (list.length > 0) setJugadoresEnLobby([...list]);
          setTab('en_sala');
          onShowToastRef.current(`🚀 Conectado a la sala ${targetCode}`);
        })
        .catch((err: any) => {
          setConectando(false);
          const detail = String(err?.message || '').trim();
          const esRechazoExplicito =
            detail.includes('llena') || detail.includes('comenzó');
          setErrorMsg(
            esRechazoExplicito
              ? detail
              : `No se pudo entrar automáticamente a la sala ${targetCode}. Verifica que siga abierta o pulsa "Unirme a la Sala".`
          );
        });
    }
  }, [codigoSalaInicial]);

  const handleEntrarSalaPublica = async (salaId: string, maxP: 2 | 4, tablero?: TamanoTablero) => {
    const code = normalizeRoomCode(salaId);
    if (code.length < 3) return;
    sounds.playClick();
    setConectando(true);
    setErrorMsg(null);
    setRoomCode(code);
    setMaxJugadores(maxP);
    if (tablero) setTamanoTablero(tablero);

    const joinName = (userActual?.nombre || nombre || 'Invitado').trim();

    try {
      await onlineService.joinRoom(code, joinName, color, hat, {
        cuentaId: userActual?.id,
        ropa,
        ropaColor,
        aura,
      });
      setConectando(false);
      setErrorMsg(null);
      setEsAnfitrionLocal(onlineService.getRole() === 'host');
      const list = onlineService.getLobbyPlayers();
      if (list.length > 0) setJugadoresEnLobby([...list]);
      setTab('en_sala');
      onShowToast(`¡Te has unido a ${code}!`);
    } catch (err: any) {
      setConectando(false);
      setErrorMsg(
        err?.message ||
          'No se pudo conectar a la sala pública. Puede que el anfitrión haya salido o esté llena.'
      );
      recargarSalasPublicas();
    }
  };

  const handleCrearSalaPrivada = async () => {
    sounds.playClick();
    setConectando(true);
    setErrorMsg(null);
    const code = generarCodigoSala();
    const hostName = (userActual?.nombre || nombre || 'Anfitrión').trim();
    setRoomCode(code);

    try {
      await onlineService.createRoom(code, hostName, color, hat, maxJugadores, publicarEnLista, {
        cuentaId: userActual?.id,
        ropa,
        ropaColor,
        aura,
        tamanoTablero,
      });
      setConectando(false);
      setErrorMsg(null);
      setEsAnfitrionLocal(true);
      setJugadoresEnLobby([...onlineService.getLobbyPlayers()]);
      setTab('en_sala');
      onShowToast(`¡Sala ${code} creada! ${publicarEnLista ? 'Publicada en la lista.' : 'Privada lista.'}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo crear la sala. Verifica tu conexión.');
      setConectando(false);
    }
  };

  const handleUnirseSala = async () => {
    const code = normalizeRoomCode(codigoInput);
    if (code.length < 3) {
      setErrorMsg('Introduce un código de sala válido');
      sounds.playError();
      return;
    }

    sounds.playClick();
    setConectando(true);
    setErrorMsg(null);
    setCodigoInput(code);
    setRoomCode(code);

    const joinName = (userActual?.nombre || nombre || 'Invitado').trim();

    try {
      await onlineService.joinRoom(code, joinName, color, hat, {
        cuentaId: userActual?.id,
        ropa,
        ropaColor,
        aura,
      });
      setConectando(false);
      setErrorMsg(null);
      setEsAnfitrionLocal(onlineService.getRole() === 'host');
      const list = onlineService.getLobbyPlayers();
      if (list.length > 0) setJugadoresEnLobby([...list]);
      setTab('en_sala');
      onShowToast(`🚀 ¡Te has unido a la sala ${code}!`);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'No se pudo encontrar la sala. Asegúrate de que el anfitrión la tenga abierta.'
      );
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

  const isHost = esAnfitrionLocal;

  // Mantener viva la sala (pública o privada) mientras el anfitrión espera en el lobby
  useEffect(() => {
    if (!isHost || tab !== 'en_sala' || !roomCode) return;
    const hb = setInterval(() => {
      onlineService.actualizarSalaPublica(jugadoresEnLobby.length || 1);
    }, 120000);
    return () => clearInterval(hb);
  }, [isHost, tab, roomCode, jugadoresEnLobby.length]);

  useEffect(() => {
    if (isHost && tab === 'en_sala' && jugadoresEnLobby.length >= maxJugadores) {
      const timer = setTimeout(() => {
        onIniciarPartidaRef.current(maxJugadores, tamanoTablero);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isHost, tab, jugadoresEnLobby.length, maxJugadores, tamanoTablero]);

  const userPoints = userActual?.puntos || 0;
  const esStaffPrivilegiado = userActual?.rol === 'admin' || userActual?.rol === 'dev';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-5 max-w-xl mx-auto z-10 overflow-y-auto">
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
            ● Conexión Directa WebRTC
          </span>
        </div>
        <div className="w-16" />
      </div>

      {tab !== 'en_sala' && (
        <div className="w-full flex-1 flex flex-col gap-3 py-1">
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
              👑 Crear Sala
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

          <div className="p-3 bg-white rounded-2xl border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] flex flex-col gap-2">
            <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
              Tu Avatar
            </span>
            <div className="flex items-center gap-3">
              <CartoonCharacter
                color={color}
                hat={hat}
                ropa={ropa}
                ropaColor={ropaColor}
                aura={aura}
                size={54}
                showShadow={false}
              />

              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[11px] font-bold text-[#86542d] block">
                    Nombre en partida:
                  </label>
                  {userActual ? (
                    <span className="text-[10px] bg-[#d3f9d8] text-[#134e20] font-black px-1.5 py-0.5 rounded border border-[#2b2140]">
                      ⭐ Perfil Oficial
                    </span>
                  ) : (
                    <span className="text-[10px] bg-[#fff3bf] text-[#8f4b00] font-extrabold px-1.5 py-0.5 rounded border border-[#2b2140]">
                      Invitado (local)
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={15}
                  value={userActual ? userActual.nombre : nombre}
                  onChange={(e) => {
                    if (!userActual) {
                      setNombre(e.target.value);
                    }
                  }}
                  readOnly={Boolean(userActual)}
                  placeholder="Tu nombre"
                  className={`w-full text-sm font-extrabold text-[#2b2140] border-2 border-[#2b2140] rounded-xl px-2.5 py-1.5 outline-none ${
                    userActual
                      ? 'bg-[#edf2ff] cursor-not-allowed select-none'
                      : 'bg-[#f8f9fa] focus:ring-2 focus:ring-[#ffd43b]'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 mt-1">
              {RegDeAvatar.map((h) => {
                const reqPts = h.desbloqueoTipo === 'inicial' ? 0 : (desbloqueos[h.id] ?? h.puntosRequeridos);
                const unlocked = reqPts === 0 || esStaffPrivilegiado || userPoints >= reqPts;
                if (!unlocked && h.desbloqueoTipo === 'puntos') {
                  return null;
                }
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      if (!unlocked) {
                        sounds.playError();
                        onShowToast(`🔒 ${h.nombre} requiere ${reqPts} pts`);
                        return;
                      }
                      sounds.playClick();
                      setHat(h.id);
                      setColor(h.colorDefault);
                    }}
                    className={`relative py-1.5 px-1 rounded-xl text-xs font-black border-2 border-[#2b2140] flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      !unlocked
                        ? 'bg-[#e9ecef] opacity-60'
                        : hat === h.id
                        ? 'bg-[#ffd43b] text-[#5c3c00] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                        : 'bg-[#fff8e7] text-[#593922] hover:bg-white'
                    }`}
                  >
                    {!unlocked && <span className="absolute top-0.5 right-0.5 text-[8px]">🔒</span>}
                    <span className="text-base">{h.emoji}</span>
                    <span className="text-[9px] truncate max-w-full">{h.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {tab === 'publicas' && (
            <div className="p-3.5 bg-white rounded-2xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-sm font-black text-[#2b2140]">🌍 Salas Públicas en Vivo</h3>
                  <p className="text-[11px] text-[#86542d] leading-snug">
                    Únete a una partida pública creada por otros jugadores.
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

              {/* Salas Oficiales / Eventos Destacados por Moderación y Devs */}
              {salasPersonalizadas.length > 0 && (
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-[#fff9db] border-2 border-[#ffd43b]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-[#8f4b00] tracking-wider flex items-center gap-1">
                      <span>🔰</span> Salas Oficiales Staff (Mod & Dev)
                    </span>
                    <span className="text-[9px] font-bold bg-white text-[#5c3c00] px-1.5 py-0.5 rounded border border-[#2b2140]">
                      {salasPersonalizadas.length} destacada{salasPersonalizadas.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {salasPersonalizadas.map((sp) => (
                      <button
                        key={sp.codigo}
                        disabled={conectando}
                        onClick={() => {
                          setCodigoInput(sp.codigo);
                          handleEntrarSalaPublica(sp.codigo, sp.maxJugadores, sp.tamanoTablero);
                        }}
                        className="p-2 rounded-xl border-2 border-[#2b2140] bg-white hover:bg-[#fff3bf] active:translate-y-0.5 shadow-[0_2px_0_#2b2140] flex items-center justify-between gap-2 text-left transition-all cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-xs text-[#d9480f] bg-[#ffe8cc] px-1.5 py-0.2 rounded border border-[#ffa94d]">
                              {sp.codigo}
                            </span>
                            <span className="font-extrabold text-xs text-[#2b2140] truncate">
                              {sp.nombre}
                            </span>
                          </div>
                          {sp.mensajeEspecial && (
                            <span className="text-[10px] text-[#2b8a3e] font-semibold block truncate">
                              💬 {sp.mensajeEspecial}
                            </span>
                          )}
                          <span className="text-[9px] text-[#86542d] font-bold block mt-0.5">
                            {sp.maxJugadores} Jugadores · {sp.tamanoTablero || 9}×{sp.tamanoTablero || 9} · Mod: {sp.creador}
                          </span>
                        </div>
                        <span className="text-[10px] bg-[#51cf66] text-[#134e20] font-black px-2 py-1 rounded-lg border border-[#2b2140] shrink-0 shadow-xs">
                          Unirse ▶
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {salasDinamicas.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-[#2b8a3e] tracking-wider">
                    🟢 Salas Abiertas ({salasDinamicas.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {salasDinamicas.map((sala) => (
                      <button
                        key={sala.codigo}
                        disabled={conectando}
                        onClick={() => {
                          setCodigoInput(sala.codigo);
                          handleEntrarSalaPublica(sala.codigo, sala.maxJugadores, sala.tamanoTablero);
                        }}
                        className="p-2.5 rounded-xl border-2 border-[#2b2140] bg-[#e7f5ff] hover:bg-[#d0ebff] active:translate-y-0.5 shadow-[0_2px_0_#2b2140] flex items-center gap-2.5 text-left transition-all cursor-pointer"
                      >
                        <CartoonCharacter
                          color={sala.color}
                          hat={sala.hat}
                          ropa={sala.ropa}
                          ropaColor={sala.ropaColor}
                          aura={sala.aura}
                          size={36}
                          showShadow={false}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-xs text-[#2b2140] block truncate">
                            {sala.nombre}
                          </span>
                          <span className="text-[10px] text-[#1864ab] font-bold block">
                            Anfitrión: {sala.anfitrion} •{' '}
                            {sala.jugadoresConectados || 1}/{sala.maxJugadores} jug. •{' '}
                            {sala.tamanoTablero || 9}×{sala.tamanoTablero || 9}
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

              <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
                Tamaño de la Mesa
              </span>
              <div className="grid grid-cols-3 gap-1.5">
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
                      sounds.playClick();
                      setTamanoTablero(op.val);
                    }}
                    className={`py-2 px-1 rounded-xl font-black text-xs border-2 border-[#2b2140] transition-all cursor-pointer flex flex-col items-center leading-tight ${
                      tamanoTablero === op.val
                        ? 'bg-[#ffd43b] text-[#5c3c00] shadow-[0_3px_0_#2b2140] -translate-y-0.5'
                        : 'bg-[#fff8e7] text-[#593922] hover:bg-white'
                    }`}
                  >
                    <span>{op.label}</span>
                    <span className="text-[9px] font-bold opacity-80">{op.sub}</span>
                  </button>
                ))}
              </div>

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
                      ? 'Cualquier jugador podrá verla y unirse desde Salas Públicas.'
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
                  placeholder="Ej: A4X9K2"
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
            <div className="p-2.5 bg-[#ffe3e3] text-[#c92a2a] text-xs font-bold rounded-xl border-2 border-[#2b2140] text-center">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>
      )}

      {tab === 'en_sala' && (
        <div className="w-full flex-1 flex flex-col gap-3 py-1">
          <div className="p-3 bg-white rounded-2xl border-3 border-[#2b2140] shadow-[0_3px_0_#2b2140] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#86542d] block">Código de Sala</span>
              <span className="text-2xl font-black text-[#2b2140] font-mono tracking-widest">
                {roomCode}
              </span>
            </div>

            <button
              onClick={handleCopiarEnlace}
              className="py-2 px-3 bg-[#ffd43b] text-[#5c3c00] rounded-xl border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] font-black text-xs hover:bg-[#fcc419] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
            >
              <span>🔗</span>
              <span>Copiar Enlace</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-[#ffe3e3] text-[#c92a2a] text-xs font-bold rounded-xl border-2 border-[#2b2140] text-center">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="p-3.5 bg-white rounded-2xl border-3 border-[#2b2140] shadow-[0_4px_0_#2b2140] flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between pb-1 border-b-2 border-[#2b2140]/10">
              <span className="text-xs font-black text-[#593922] uppercase tracking-wider">
                Jugadores ({jugadoresEnLobby.length}/{maxJugadores}) · Mesa {tamanoTablero}×{tamanoTablero}
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
                  <CartoonCharacter
                    color={p.color}
                    hat={p.hat}
                    ropa={p.ropa}
                    ropaColor={p.ropaColor}
                    aura={p.aura}
                    size={42}
                    showShadow={false}
                  />
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

          {jugadoresEnLobby.length >= maxJugadores ? (
            <div className="flex flex-col gap-2">
              <div className="p-3 bg-[#d3f9d8] text-[#134e20] rounded-2xl border-3 border-[#2b2140] text-sm font-black text-center shadow-[0_4px_0_#2b2140] animate-bounce flex items-center justify-center gap-2">
                <span>🚀</span>
                <span>¡Rival conectado! Iniciando partida automáticamente...</span>
              </div>
              {isHost && (
                <button
                  type="button"
                  onClick={() => onIniciarPartidaOnline(maxJugadores, tamanoTablero)}
                  className="w-full py-2.5 bg-[#ffd43b] text-[#5c3c00] rounded-xl border-2 border-[#2b2140] font-black text-sm shadow-[0_3px_0_#2b2140] hover:bg-[#fcc419] cursor-pointer"
                >
                  ▶ Iniciar Partida Ahora Mismo
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 bg-[#e7f5ff] text-[#1864ab] rounded-2xl border-2 border-[#2b2140] text-xs font-bold text-center shadow-sm flex items-center justify-center gap-2 animate-pulse">
              <span>⏳</span>
              <span>Esperando a que entre el rival... La partida iniciará automáticamente.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
