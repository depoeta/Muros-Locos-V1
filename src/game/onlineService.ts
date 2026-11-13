/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor Online Híbrido WebRTC P2P + Señalización Propia (/api/salas) + Respaldo CGNAT:
 * - Independiente de servidores externos caídos (elimina el cuello de botella de 0.peerjs.com).
 * - Negocia RTCDataChannel directo entre navegadores en <1s usando /api/salas/:codigo.
 * - Cuando el canal WebRTC está abierto, el tráfico va 100% P2P directo (0 peticiones al servidor en partida).
 * - Si un jugador está tras NAT simétrico / 4G-5G CGNAT o firewall estricto, conmuta sin cortes al canal /msg.
 */

import {
  AvatarTipoDeAura,
  AvatarTipoDeGorro,
  AvatarTipoDeRopa,
  Coordenada,
  DatosDiagnosticoOnline,
  EstadoDeJuego,
  InfoJugadorOnline,
  InfoSalaPublica,
  MensajeOnline,
  OrientacionMuro,
  SesionOnlineActiva,
  TamanoTablero,
} from '../types/murosLocos';
import { normalizarTamanoTablero } from './murosLocosEngine';
import { getApiBaseUrl, obtenerTokenSesion } from './storage';

export const SESSION_STORAGE_KEY = 'muros_locos_active_online_session';

export function normalizeRoomCode(code: string): string {
  return String(code || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, '');
}

export function generarCodigoSala(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatRoomPeerId(code: string): string {
  return `muros-locos-p2p-${normalizeRoomCode(code).toLowerCase()}`;
}

function randomShortId(len: number = 8): string {
  return (Math.random().toString(36).slice(2) + Date.now().toString(36))
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, len);
}

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

function prepareWireState(state: EstadoDeJuego): EstadoDeJuego {
  const clean = JSON.parse(JSON.stringify(state)) as EstadoDeJuego;
  clean.historial = [];
  if (Array.isArray(clean.registroAcciones) && clean.registroAcciones.length > 40) {
    clean.registroAcciones = clean.registroAcciones.slice(-40);
  }
  return clean;
}

async function gatherLocalDescription(
  pc: RTCPeerConnection,
  maxWaitMs: number = 900
): Promise<RTCSessionDescriptionInit | null> {
  if (!pc.localDescription) return null;
  if (pc.iceGatheringState === 'complete') {
    return {
      type: pc.localDescription.type,
      sdp: pc.localDescription.sdp,
    };
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    let srflxGraceTimer: ReturnType<typeof setTimeout> | null = null;

    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (srflxGraceTimer) clearTimeout(srflxGraceTimer);
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      pc.removeEventListener('icecandidate', onCandidate);
      resolve();
    };

    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        done();
      }
    };

    const onCandidate = (ev: RTCPeerConnectionIceEvent) => {
      if (!ev.candidate) {
        done();
        return;
      }
      if (ev.candidate.candidate && ev.candidate.candidate.includes('typ srflx') && !srflxGraceTimer) {
        srflxGraceTimer = setTimeout(done, 160);
      }
    };

    const hardTimer = setTimeout(done, maxWaitMs);
    pc.addEventListener('icegatheringstatechange', onStateChange);
    pc.addEventListener('icecandidate', onCandidate);
  });

  if (!pc.localDescription) return null;
  return {
    type: pc.localDescription.type,
    sdp: pc.localDescription.sdp,
  };
}

export type OnlineEventCallback = {
  onLobbyUpdate?: (players: InfoJugadorOnline[], maxPlayers: 2 | 4, tamanoTablero?: TamanoTablero) => void;
  onLobbyFull?: (maxPlayers: 2 | 4) => void;
  onGameStart?: (initialState: EstadoDeJuego) => void;
  onStateSync?: (state: EstadoDeJuego) => void;
  onClientAction?: (
    jugadorId: number,
    accion: 'mover' | 'muro' | 'pasar',
    payload: { destino?: Coordenada; orientacion?: OrientacionMuro; r?: number; c?: number }
  ) => void;
  onPlayerAction?: (
    jugadorId: number,
    accion: 'mover' | 'muro' | 'pasar',
    payload: any
  ) => void;
  onReaction?: (jugadorId: number, emoji: string) => void;
  onRematchRequested?: (jugadorId: number, nombre: string) => void;
  onRematchResponded?: (jugadorId: number, nombre: string, aceptada: boolean) => void;
  onPlayerLeftRoom?: (nombre: string) => void;
  onOpponentAbandoned?: (nombre: string) => void;
  onHostDisconnected?: (secondsRemaining: number) => void;
  onHostDisconnectWarning?: (secondsRemaining: number) => void;
  onHostReconnected?: () => void;
  onError?: (errorMsg: string) => void;
  onLobbyError?: (errorMsg: string) => void;
  onDisconnectTimeout?: () => void;
};

interface HostPeerSlot {
  peerId: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  answeredOfferSdp: string;
}

class OnlineManager {
  private hostPeers: Map<string, HostPeerSlot> = new Map();
  private clientPc: RTCPeerConnection | null = null;
  private clientDc: RTCDataChannel | null = null;
  private appliedAnswerSdp: string = '';

  private role: 'host' | 'client' | null = null;
  private roomCode: string = '';
  private roomPublica: boolean = true;
  private myPeerId: string = '';
  private myCuentaId?: string;
  private maxPlayers: 2 | 4 = 2;
  private tamanoTablero: TamanoTablero = 9;
  private myPlayerId: number = 0;
  private myName: string = '';
  private myColor: string = '#ff6b6b';
  private myHat: AvatarTipoDeGorro = 'corona';
  private myRopa: AvatarTipoDeRopa = 'ninguna';
  private myRopaColor?: string;
  private myAura: AvatarTipoDeAura = 'ninguna';
  private lobbyPlayers: InfoJugadorOnline[] = [];
  private callbacks: OnlineEventCallback = {};

  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private syncInFlight: boolean = false;
  private lastMsgSeq: number = 0;
  private lastHandledStartId: string = '';
  private handledActionIds: Set<string> = new Set();

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastSeenMap: Map<string, number> = new Map();
  private hostLastSeen: number = Date.now();
  private lastRemoteActivityMarker: string = '';
  private hadWebRtcOpenInMatch: boolean = false;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private pendingActionRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPollAt: number = 0;

  private currentGameState: EstadoDeJuego | null = null;
  private isIntentionalExit: boolean = false;
  private rivalLeftAfterMatch: boolean = false;
  private roomClosedRemotely: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const handleUnload = () => {
        if (this.role && this.roomCode && !this.isIntentionalExit) {
          this.cleanUp();
        }
      };
      window.addEventListener('pagehide', handleUnload);
      window.addEventListener('beforeunload', handleUnload);
    }
  }

  private diagnosticData: DatosDiagnosticoOnline = {
    status: 'desconectado',
    pingMs: null,
    calidad: 'desconectado',
    miPeerId: '',
    rivalPeerId: null,
    role: 'none',
    iceState: 'new',
    dataChannelState: 'closed',
    logs: [],
  };
  private diagnosticListeners: Set<(data: DatosDiagnosticoOnline) => void> = new Set();
  private diagPingTimer: ReturnType<typeof setInterval> | null = null;

  public getDiagnosticData(): DatosDiagnosticoOnline {
    return { ...this.diagnosticData, logs: [...this.diagnosticData.logs] };
  }

  public subscribeDiagnostics(listener: (data: DatosDiagnosticoOnline) => void): () => void {
    this.diagnosticListeners.add(listener);
    listener(this.getDiagnosticData());
    return () => {
      this.diagnosticListeners.delete(listener);
    };
  }

  private notifyDiagnostics() {
    const data = this.getDiagnosticData();
    this.diagnosticListeners.forEach((l) => {
      try {
        l(data);
      } catch {}
    });
  }

  public addDiagnosticLog(tipo: 'info' | 'warn' | 'error', mensaje: string) {
    const now = new Date();
    const ts = now.toTimeString().split(' ')[0];
    this.diagnosticData.logs.unshift({ ts, tipo, mensaje });
    if (this.diagnosticData.logs.length > 20) {
      this.diagnosticData.logs.pop();
    }
    this.notifyDiagnostics();
  }

  private updateLatencyMetric(rttMs: number) {
    const rtt = Math.max(1, Math.round(rttMs));
    this.diagnosticData.pingMs = rtt;
    this.diagnosticData.calidad =
      rtt < 100 ? 'excelente' : rtt < 200 ? 'buena' : rtt < 350 ? 'inestable' : 'critica';
    this.notifyDiagnostics();
  }

  public sendInstantDiagnosticPing() {
    const now = Date.now();
    if (this.role === 'client') {
      if (this.clientDc && this.clientDc.readyState === 'open') {
        try {
          this.clientDc.send(JSON.stringify({ type: 'DIAG_PING', ts: now }));
        } catch {}
      }
    } else if (this.role === 'host') {
      this.hostPeers.forEach((slot) => {
        if (slot.dc && slot.dc.readyState === 'open') {
          try {
            slot.dc.send(JSON.stringify({ type: 'DIAG_PING', ts: now }));
          } catch {}
        }
      });
    }
  }

  private startDiagnosticPingLoop() {
    this.stopDiagnosticPingLoop();
    this.diagPingTimer = setInterval(() => {
      this.sendInstantDiagnosticPing();
    }, 3500);
  }

  private stopDiagnosticPingLoop() {
    if (this.diagPingTimer) {
      clearInterval(this.diagPingTimer);
      this.diagPingTimer = null;
    }
  }

  public setCallbacks(cb: OnlineEventCallback) {
    this.callbacks = { ...this.callbacks, ...cb };
  }

  public getRole() {
    return this.role;
  }

  public getRoomCode() {
    return this.roomCode;
  }

  public getMyPlayerId() {
    return this.myPlayerId;
  }

  public getLobbyPlayers(): InfoJugadorOnline[] {
    return this.lobbyPlayers;
  }

  public getTamanoTablero(): TamanoTablero {
    return this.tamanoTablero;
  }

  public saveActiveSession() {
    if (!this.roomCode || !this.role) return;
    try {
      const session: SesionOnlineActiva = {
        roomCode: this.roomCode,
        role: this.role,
        myPeerId: this.myPeerId,
        myPlayerId: this.myPlayerId,
        myCuentaId: this.myCuentaId,
        myName: this.myName,
        myColor: this.myColor,
        myHat: this.myHat,
        myRopa: this.myRopa,
        myRopaColor: this.myRopaColor,
        myAura: this.myAura,
        tamanoTablero: this.tamanoTablero,
        lastState: this.currentGameState || undefined,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {}
  }

  public getSavedSession(): SesionOnlineActiva | null {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < 300000) {
        return parsed;
      }
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    } catch {
      return null;
    }
  }

  public getActiveSession(): SesionOnlineActiva | null {
    return this.getSavedSession();
  }

  private areAllClientDataChannelsOpen(): boolean {
    if (this.role === 'client') {
      return Boolean(this.clientDc && this.clientDc.readyState === 'open');
    }
    if (this.role === 'host') {
      const remotePlayers = this.lobbyPlayers.filter((p) => !p.esAnfitrion);
      if (remotePlayers.length === 0) return false;
      return remotePlayers.every((p) => {
        const slot = this.hostPeers.get(p.peerId);
        return Boolean(slot?.dc && slot.dc.readyState === 'open');
      });
    }
    return false;
  }

  private areAllPeersResponsive(now: number = Date.now()): boolean {
    if (!this.areAllClientDataChannelsOpen()) return false;
    if (this.role === 'client') {
      return now - this.hostLastSeen < 6500;
    }
    if (this.role === 'host') {
      const remotePlayers = this.lobbyPlayers.filter((p) => !p.esAnfitrion);
      if (remotePlayers.length === 0) return false;
      return remotePlayers.every((p) => {
        const lastSeen = this.lastSeenMap.get(p.peerId) || 0;
        return now - lastSeen < 6500;
      });
    }
    return false;
  }

  private clearPendingActionRetry() {
    if (this.pendingActionRetryTimer) {
      clearTimeout(this.pendingActionRetryTimer);
      this.pendingActionRetryTimer = null;
    }
  }

  private buildPingPayload(type: 'PING' | 'PONG'): MensajeOnline {
    return {
      type,
      turnosTotales: this.currentGameState?.turnosTotales,
      turnoActual: this.currentGameState?.turnoActual,
      terminada: this.currentGameState?.terminada,
    };
  }

  private notifyPeerDeparture(nombre: string) {
    if (this.rivalLeftAfterMatch) return;
    this.rivalLeftAfterMatch = true;
    this.stopReconnectGracePeriod();
    this.clearPendingActionRetry();

    if (this.currentGameState && !this.currentGameState.terminada) {
      this.callbacks.onOpponentAbandoned?.(nombre);
    } else {
      this.callbacks.onPlayerLeftRoom?.(nombre);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    const initNow = Date.now();
    this.hostLastSeen = initNow;
    this.lobbyPlayers.forEach((p) => {
      if (!p.esAnfitrion && p.peerId) {
        this.lastSeenMap.set(p.peerId, initNow);
      }
    });

    this.heartbeatInterval = setInterval(() => {
      if (this.isIntentionalExit || !this.role) return;
      const now = Date.now();

      if (this.role === 'host') {
        const pingStr = JSON.stringify(this.buildPingPayload('PING'));
        for (const slot of this.hostPeers.values()) {
          if (slot.dc && slot.dc.readyState === 'open') {
            try {
              slot.dc.send(pingStr);
            } catch {}
          }
        }

        if (this.currentGameState && !this.currentGameState.terminada) {
          const remotePlayers = this.lobbyPlayers.filter((p) => !p.esAnfitrion);
          const silenceLimitMs = this.hadWebRtcOpenInMatch ? 12000 : 35000;
          for (const p of remotePlayers) {
            const lastSeen = this.lastSeenMap.get(p.peerId) || initNow;
            if (now - lastSeen > 6500) {
              this.pollRoomOnce();
            }
            if (now - lastSeen > silenceLimitMs) {
              this.startDisconnectGracePeriod();
              break;
            }
          }
        }
      } else if (this.role === 'client') {
        if (this.clientDc && this.clientDc.readyState === 'open') {
          try {
            this.clientDc.send(JSON.stringify(this.buildPingPayload('PING')));
          } catch {}
        }
        if (this.currentGameState && !this.currentGameState.terminada) {
          const silenceLimitMs = this.hadWebRtcOpenInMatch ? 12000 : 35000;
          if (now - this.hostLastSeen > 6500) {
            this.pollRoomOnce();
          }
          if (now - this.hostLastSeen > silenceLimitMs) {
            this.startDisconnectGracePeriod();
          }
        }
      }
    }, 2500);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startRoomSyncLoop() {
    this.stopRoomSyncLoop();
    this.syncInterval = setInterval(() => {
      this.pollRoomOnce();
    }, 1500);
  }

  private stopRoomSyncLoop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async pollRoomOnce() {
    if (this.isIntentionalExit || !this.role || !this.roomCode || this.syncInFlight) return;
    if (this.rivalLeftAfterMatch || this.roomClosedRemotely) return;

    const now = Date.now();

    // Si la partida está activa o recién terminada y todos los pares responden por WebRTC directo, 0 peticiones de red
    if (this.currentGameState && this.areAllPeersResponsive(now)) {
      return;
    }

    // Mientras el anfitrión espera solo en el lobby sin rival, espaciar a 3s para optimizar recursos
    if (
      this.role === 'host' &&
      !this.currentGameState &&
      this.lobbyPlayers.length < 2 &&
      now - this.lastPollAt < 2900
    ) {
      return;
    }

    this.syncInFlight = true;
    this.lastPollAt = now;
    const t0 = now;

    try {
      const base = getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}`);
      const sep = base.includes('?') ? '&' : '?';
      const url = `${base}${sep}peerId=${encodeURIComponent(this.myPeerId)}&since=${this.lastMsgSeq}&_t=${t0}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });

      if (this.isIntentionalExit || !this.role) return;

      if (res.status === 404) {
        this.roomClosedRemotely = true;
        if (this.role === 'client') {
          const hostName =
            this.currentGameState?.jugadores[0]?.nombre ||
            this.lobbyPlayers.find((p) => p.esAnfitrion)?.nombre ||
            'El anfitrión';
          if (this.currentGameState) {
            this.notifyPeerDeparture(hostName);
          } else {
            this.callbacks.onLobbyError?.('El anfitrión cerró la sala.');
          }
        }
        return;
      }

      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data?.ok || !data.sala || this.isIntentionalExit) return;

      const rtt = Date.now() - t0;
      if (!this.areAllClientDataChannelsOpen()) {
        this.updateLatencyMetric(rtt);
      }

      const sala = data.sala;
      const marker = `${sala.seq ?? 0}:${sala.ultimoCambio ?? 0}:${Array.isArray(sala.jugadores) ? sala.jugadores.length : 0}`;
      if (marker !== this.lastRemoteActivityMarker) {
        this.lastRemoteActivityMarker = marker;
        if (this.role === 'client') {
          this.hostLastSeen = Date.now();
        }
      }

      if (this.role === 'host') {
        await this.processHostRoomPoll(sala);
      } else if (this.role === 'client') {
        await this.processClientRoomPoll(sala);
      }
    } catch {
      // Silenciar fallos puntuales de red
    } finally {
      this.syncInFlight = false;
    }
  }

  private async processHostRoomPoll(sala: any) {
    const remoteList: InfoJugadorOnline[] = Array.isArray(sala.jugadores) ? sala.jugadores : [];

    // Sincronizar lista del lobby mientras no haya iniciado la partida
    if (!this.currentGameState && remoteList.length > 0) {
      const changed =
        remoteList.length !== this.lobbyPlayers.length ||
        remoteList.some((p, i) => {
          const prev = this.lobbyPlayers[i];
          return (
            !prev ||
            p.peerId !== prev.peerId ||
            p.nombre !== prev.nombre ||
            p.conectado !== prev.conectado ||
            p.ropa !== prev.ropa ||
            p.ropaColor !== prev.ropaColor ||
            p.aura !== prev.aura
          );
        });

      if (changed) {
        this.lobbyPlayers = remoteList;
        this.saveActiveSession();
        this.broadcastLobbyUpdate();

        if (this.lobbyPlayers.length >= this.maxPlayers) {
          this.callbacks.onLobbyFull?.(this.maxPlayers);
        }
      }
    }

    // Responder ofertas WebRTC entrantes de clientes
    const signals = sala.signals || {};
    for (const p of remoteList) {
      if (p.esAnfitrion || !p.peerId) continue;
      const sig = signals[p.peerId];
      if (sig?.offer?.sdp) {
        const existingSlot = this.hostPeers.get(p.peerId);
        if (!existingSlot || existingSlot.answeredOfferSdp !== sig.offer.sdp) {
          this.diagnosticData.rivalPeerId = p.peerId;
          await this.acceptClientOfferAsHost(p.peerId, sig.offer);
        }
      }
    }

    // Procesar mensajes recibidos por el canal de respaldo /msg
    const nuevos = Array.isArray(sala.mensajesNuevos) ? sala.mensajesNuevos : [];
    for (const item of nuevos) {
      if (item.seq > this.lastMsgSeq) {
        this.lastMsgSeq = item.seq;
      }
      if (item.msg) {
        this.handleMessageFromClient(item.from, item.msg as MensajeOnline);
      }
    }
    if (typeof sala.seq === 'number' && sala.seq > this.lastMsgSeq) {
      this.lastMsgSeq = sala.seq;
    }
  }

  private async processClientRoomPoll(sala: any) {
    const remoteList: InfoJugadorOnline[] = Array.isArray(sala.jugadores) ? sala.jugadores : [];

    if (!this.currentGameState && remoteList.length > 0) {
      const me = remoteList.find((p) => p.peerId === this.myPeerId);
      if (me) {
        this.myPlayerId = me.id;
      }
      const changed =
        remoteList.length !== this.lobbyPlayers.length ||
        remoteList.some((p, i) => {
          const prev = this.lobbyPlayers[i];
          return (
            !prev ||
            p.peerId !== prev.peerId ||
            p.nombre !== prev.nombre ||
            p.conectado !== prev.conectado ||
            p.ropa !== prev.ropa ||
            p.ropaColor !== prev.ropaColor ||
            p.aura !== prev.aura
          );
        });

      if (changed) {
        this.lobbyPlayers = remoteList;
        this.maxPlayers = sala.maxJugadores === 4 ? 4 : 2;
        if (sala.tamanoTablero !== undefined) {
          this.tamanoTablero = normalizarTamanoTablero(sala.tamanoTablero);
        }
        this.saveActiveSession();
        this.callbacks.onLobbyUpdate?.([...this.lobbyPlayers], this.maxPlayers, this.tamanoTablero);
      }
    }

    // Aplicar respuesta SDP del anfitrión para abrir el canal WebRTC directo
    const mySig = sala.signals?.[this.myPeerId];
    if (
      mySig?.answer?.sdp &&
      this.clientPc &&
      this.appliedAnswerSdp !== mySig.answer.sdp &&
      this.clientPc.signalingState === 'have-local-offer'
    ) {
      this.appliedAnswerSdp = mySig.answer.sdp;
      try {
        await this.clientPc.setRemoteDescription(new RTCSessionDescription(mySig.answer));
        this.addDiagnosticLog('info', 'Respuesta SDP recibida del anfitrión');
      } catch (err: any) {
        this.addDiagnosticLog('warn', `Aviso SDP cliente: ${err?.message || err}`);
      }
    }

    // Procesar mensajes del anfitrión por el canal /msg
    const nuevos = Array.isArray(sala.mensajesNuevos) ? sala.mensajesNuevos : [];
    for (const item of nuevos) {
      if (item.seq > this.lastMsgSeq) {
        this.lastMsgSeq = item.seq;
      }
      if (item.msg) {
        this.handleMessageFromHost(item.msg as MensajeOnline);
      }
    }
    if (typeof sala.seq === 'number' && sala.seq > this.lastMsgSeq) {
      this.lastMsgSeq = sala.seq;
    }
  }

  private async acceptClientOfferAsHost(
    clientPeerId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') return;

    const prev = this.hostPeers.get(clientPeerId);
    if (prev) {
      try {
        prev.dc?.close();
        prev.pc.close();
      } catch {}
      this.hostPeers.delete(clientPeerId);
    }

    try {
      const pc = new RTCPeerConnection(RTC_CONFIGURATION);
      const slot: HostPeerSlot = {
        peerId: clientPeerId,
        pc,
        dc: null,
        answeredOfferSdp: offer.sdp || '',
      };
      this.hostPeers.set(clientPeerId, slot);
      this.lastSeenMap.set(clientPeerId, Date.now());

      pc.oniceconnectionstatechange = () => {
        this.diagnosticData.iceState = pc.iceConnectionState;
        this.notifyDiagnostics();
      };

      pc.ondatachannel = (ev) => {
        const dc = ev.channel;
        slot.dc = dc;
        this.bindHostDataChannel(clientPeerId, dc);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answerRaw = await pc.createAnswer();
      await pc.setLocalDescription(answerRaw);
      const fullAnswer = await gatherLocalDescription(pc, 900);

      if (fullAnswer && !this.isIntentionalExit && this.roomCode) {
        await fetch(getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}/signal`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            clientPeerId,
            answer: fullAnswer,
          }),
        });
        this.addDiagnosticLog('info', `Respuesta WebRTC enviada a ${clientPeerId}`);
      }
    } catch (err: any) {
      this.addDiagnosticLog('warn', `Respaldo activo para ${clientPeerId}: ${err?.message || err}`);
    }
  }

  private bindHostDataChannel(clientPeerId: string, dc: RTCDataChannel) {
    dc.onopen = () => {
      this.hadWebRtcOpenInMatch = true;
      this.lastSeenMap.set(clientPeerId, Date.now());
      this.stopReconnectGracePeriod();
      this.diagnosticData.status = 'conectado';
      this.diagnosticData.dataChannelState = 'open';
      this.diagnosticData.iceState = 'connected';
      this.addDiagnosticLog('info', `Canal P2P WebRTC directo abierto con ${clientPeerId}`);
      this.sendInstantDiagnosticPing();

      // Sincronizar lobby o estado de partida apenas abre el canal directo
      try {
        dc.send(
            JSON.stringify({
              type: 'LOBBY_UPDATE',
              roomCode: this.roomCode,
              maxJugadores: this.maxPlayers,
              tamanoTablero: this.tamanoTablero,
              jugadores: [...this.lobbyPlayers],
            } satisfies MensajeOnline)
        );
        if (this.currentGameState && !this.currentGameState.terminada) {
          dc.send(
            JSON.stringify({
              type: 'START_GAME',
              config: this.currentGameState.config,
              initialState: prepareWireState(this.currentGameState),
              _startId: this.lastHandledStartId || `sync_${this.roomCode}`,
            } satisfies MensajeOnline)
          );
        }
      } catch {}
    };

    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as MensajeOnline;
        this.handleMessageFromClient(clientPeerId, msg);
      } catch {}
    };

    dc.onclose = () => {
      this.diagnosticData.dataChannelState = 'closed';
      this.notifyDiagnostics();
      this.handlePeerChannelClosedOnHost(clientPeerId);
    };
  }

  private handlePeerChannelClosedOnHost(clientPeerId: string) {
    if (this.isIntentionalExit || !this.role) return;

    if (this.currentGameState && this.currentGameState.terminada) {
      const leftPlayer = this.lobbyPlayers.find((p) => p.peerId === clientPeerId);
      const leftName = leftPlayer?.nombre || 'El otro jugador';
      if (!this.rivalLeftAfterMatch) {
        this.broadcast({
          type: 'PLAYER_LEFT',
          jugadorId: leftPlayer?.id ?? 1,
          nombre: leftName,
        });
        this.notifyPeerDeparture(leftName);
      }
    } else if (this.currentGameState && !this.currentGameState.terminada) {
      // Comprobar de inmediato /leave o caída real en servidor y mostrar aviso si no responde
      this.pollRoomOnce();
      this.startDisconnectGracePeriod();
    }
  }

  public async createRoom(
    code: string,
    hostName: string,
    color: string,
    hat: AvatarTipoDeGorro,
    maxPlayers: 2 | 4 = 2,
    publica: boolean = true,
    opciones?: {
      cuentaId?: string;
      ropa?: AvatarTipoDeRopa;
      ropaColor?: string;
      aura?: AvatarTipoDeAura;
      tamanoTablero?: TamanoTablero;
    }
  ): Promise<string> {
    this.cleanUp();
    this.isIntentionalExit = false;
    this.rivalLeftAfterMatch = false;
    this.roomClosedRemotely = false;
    this.role = 'host';
    this.roomCode = normalizeRoomCode(code) || generarCodigoSala();
    this.roomPublica = publica;
    this.maxPlayers = maxPlayers === 4 ? 4 : 2;
    this.tamanoTablero = normalizarTamanoTablero(opciones?.tamanoTablero);
    this.myPlayerId = 0;
    this.myCuentaId = opciones?.cuentaId;
    this.myName = hostName.trim() || 'Anfitrión';
    this.myColor = color;
    this.myHat = hat;
    this.myRopa = opciones?.ropa || 'ninguna';
    this.myRopaColor = opciones?.ropaColor;
    this.myAura = opciones?.aura || 'ninguna';
    this.myPeerId = `host-${this.roomCode.toLowerCase()}-${randomShortId(5)}`;
    this.lastMsgSeq = 0;

    this.lobbyPlayers = [
      {
        id: 0,
        peerId: this.myPeerId,
        cuentaId: this.myCuentaId,
        nombre: this.myName,
        color: this.myColor,
        hat: this.myHat,
        ropa: this.myRopa,
        ropaColor: this.myRopaColor,
        aura: this.myAura,
        listo: true,
        conectado: true,
        esAnfitrion: true,
      },
    ];

    const res = await fetch(getApiBaseUrl('/api/salas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        codigo: this.roomCode,
        nombre: `Sala de ${this.myName}`,
        anfitrion: this.myName,
        cuentaId: this.myCuentaId,
        hostPeerId: this.myPeerId,
        color: this.myColor,
        hat: this.myHat,
        ropa: this.myRopa,
        ropaColor: this.myRopaColor,
        aura: this.myAura,
        maxJugadores: this.maxPlayers,
        tamanoTablero: this.tamanoTablero,
        publica: this.roomPublica,
        jugadores: this.lobbyPlayers,
        creadoEn: Date.now(),
      }),
    });

    if (!res.ok) {
      this.cleanUp();
      throw new Error('No se pudo registrar la sala en el servidor.');
    }

    this.saveActiveSession();
    this.startHeartbeat();
    this.startRoomSyncLoop();
    this.startDiagnosticPingLoop();

    this.diagnosticData.status = 'conectado';
    this.diagnosticData.role = 'host';
    this.diagnosticData.miPeerId = this.myPeerId;
    this.diagnosticData.iceState = 'connected';
    this.diagnosticData.dataChannelState = 'open';
    this.addDiagnosticLog('info', `Sala ${this.roomCode} abierta y lista para recibir jugadores`);

    this.callbacks.onLobbyUpdate?.([...this.lobbyPlayers], this.maxPlayers, this.tamanoTablero);
    return this.roomCode;
  }

  public async joinRoom(
    code: string,
    playerName: string,
    color: string,
    hat: AvatarTipoDeGorro,
    opciones?: {
      cuentaId?: string;
      ropa?: AvatarTipoDeRopa;
      ropaColor?: string;
      aura?: AvatarTipoDeAura;
    }
  ): Promise<void> {
    this.cleanUp();
    this.isIntentionalExit = false;
    this.rivalLeftAfterMatch = false;
    this.roomClosedRemotely = false;
    this.role = 'client';
    this.roomCode = normalizeRoomCode(code);
    this.myCuentaId = opciones?.cuentaId;
    this.myName = playerName.trim() || 'Invitado';
    this.myColor = color;
    this.myHat = hat;
    this.myRopa = opciones?.ropa || 'ninguna';
    this.myRopaColor = opciones?.ropaColor;
    this.myAura = opciones?.aura || 'ninguna';
    this.myPeerId = `cli-${randomShortId(8)}`;
    this.appliedAnswerSdp = '';
    this.lastMsgSeq = 0;

    if (this.roomCode.length < 3) {
      this.cleanUp();
      throw new Error('Introduce un código de sala válido.');
    }

    this.diagnosticData.status = 'negociando';
    this.diagnosticData.role = 'client';
    this.diagnosticData.miPeerId = this.myPeerId;
    this.diagnosticData.rivalPeerId = formatRoomPeerId(this.roomCode);
    this.addDiagnosticLog('info', `Conectando a la sala ${this.roomCode}...`);

    let offerSdp: RTCSessionDescriptionInit | null = null;

    if (typeof RTCPeerConnection !== 'undefined') {
      try {
        const pc = new RTCPeerConnection(RTC_CONFIGURATION);
        this.clientPc = pc;

        pc.oniceconnectionstatechange = () => {
          this.diagnosticData.iceState = pc.iceConnectionState;
          this.notifyDiagnostics();
        };

        const dc = pc.createDataChannel('muros-p2p', { ordered: true });
        this.clientDc = dc;
        this.bindClientDataChannel(dc);

        const rawOffer = await pc.createOffer();
        await pc.setLocalDescription(rawOffer);
        offerSdp = await gatherLocalDescription(pc, 850);
      } catch (err: any) {
        this.addDiagnosticLog('warn', `WebRTC local en modo respaldo: ${err?.message || err}`);
      }
    }

    const t0 = Date.now();
    const token = obtenerTokenSesion();
    const res = await fetch(
      getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}/join`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
        body: JSON.stringify({
          peerId: this.myPeerId,
          cuentaId: this.myCuentaId,
          nombre: this.myName,
          color: this.myColor,
          hat: this.myHat,
          ropa: this.myRopa,
          ropaColor: this.myRopaColor,
          aura: this.myAura,
          offer: offerSdp,
        }),
      }
    );

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data.sala) {
      const msg =
        data?.error ||
        `La sala ${this.roomCode} no está disponible o el anfitrión ya la cerró.`;
      this.cleanUp();
      throw new Error(msg);
    }

    this.updateLatencyMetric(Date.now() - t0);

    const sala = data.sala;
    this.maxPlayers = sala.maxJugadores === 4 ? 4 : 2;
    this.tamanoTablero = normalizarTamanoTablero(sala.tamanoTablero);
    this.lobbyPlayers = Array.isArray(sala.jugadores) ? sala.jugadores : [];
    this.lastMsgSeq = typeof sala.seq === 'number' ? sala.seq : 0;

    const me = this.lobbyPlayers.find((p) => p.peerId === this.myPeerId);
    if (me) {
      this.myPlayerId = me.id;
      this.myColor = me.color;
      this.myHat = me.hat;
      this.myRopa = me.ropa || 'ninguna';
      this.myRopaColor = me.ropaColor;
      this.myAura = me.aura || 'ninguna';
      if (me.esAnfitrion || data.esAnfitrion) {
        if (this.clientDc) {
          try {
            this.clientDc.close();
          } catch {}
          this.clientDc = null;
        }
        if (this.clientPc) {
          try {
            this.clientPc.close();
          } catch {}
          this.clientPc = null;
        }
        this.hostPeers.clear();
        this.role = 'host';
        this.diagnosticData.role = 'host';
        this.diagnosticData.iceState = 'connected';
        this.diagnosticData.dataChannelState = 'open';
      }
    }

    this.diagnosticData.status = 'conectado';
    this.diagnosticData.rivalPeerId = sala.hostPeerId || formatRoomPeerId(this.roomCode);
    this.addDiagnosticLog('info', `Unido a la sala ${this.roomCode} como Jugador ${this.myPlayerId + 1}`);

    this.saveActiveSession();
    this.startHeartbeat();
    this.startRoomSyncLoop();
    this.startDiagnosticPingLoop();

    this.callbacks.onLobbyUpdate?.([...this.lobbyPlayers], this.maxPlayers, this.tamanoTablero);
  }

  private bindClientDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      this.hadWebRtcOpenInMatch = true;
      this.stopReconnectGracePeriod();
      this.hostLastSeen = Date.now();
      this.diagnosticData.status = 'conectado';
      this.diagnosticData.iceState = 'connected';
      this.diagnosticData.dataChannelState = 'open';
      this.addDiagnosticLog('info', 'Enlace P2P WebRTC directo activo');
      this.sendInstantDiagnosticPing();

      try {
        dc.send(
          JSON.stringify({
            type: 'JOIN_REQUEST',
            cuentaId: this.myCuentaId,
            nombre: this.myName,
            color: this.myColor,
            hat: this.myHat,
            ropa: this.myRopa,
            ropaColor: this.myRopaColor,
            aura: this.myAura,
          } satisfies MensajeOnline)
        );
        if (this.currentGameState && !this.currentGameState.terminada) {
          dc.send(
            JSON.stringify({
              type: 'REQUEST_SYNC',
              jugadorId: this.myPlayerId,
              turnosTotales: this.currentGameState.turnosTotales,
            } satisfies MensajeOnline)
          );
        }
      } catch {}
    };

    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as MensajeOnline;
        this.handleMessageFromHost(msg);
      } catch {}
    };

    dc.onclose = () => {
      this.diagnosticData.dataChannelState = 'closed';
      this.notifyDiagnostics();
      if (this.isIntentionalExit || !this.role || !this.currentGameState) return;

      const hostName = this.currentGameState.jugadores[0]?.nombre || 'El anfitrión';
      if (this.currentGameState.terminada) {
        this.notifyPeerDeparture(hostName);
        return;
      }
      // Si se cerró el DataChannel en mitad de partida, comprobar de inmediato si cerró la sala o hubo corte temporal
      this.pollRoomOnce();
      this.startDisconnectGracePeriod();
    };
  }

  private async postFallbackMessage(msg: MensajeOnline, toPeerId?: string) {
    if (!this.roomCode) return;
    try {
      await fetch(getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}/msg`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          from: this.myPeerId,
          to: toPeerId || null,
          msg,
        }),
      });
    } catch {}
  }

  private sendToHost(msg: MensajeOnline) {
    if (this.clientDc && this.clientDc.readyState === 'open') {
      try {
        this.clientDc.send(JSON.stringify(msg));
        return;
      } catch {}
    }
    if (
      msg.type !== 'PING' &&
      msg.type !== 'PONG' &&
      msg.type !== 'DIAG_PING' &&
      msg.type !== 'DIAG_PONG'
    ) {
      this.postFallbackMessage(msg);
    }
  }

  public broadcast(msg: MensajeOnline) {
    const serialized = JSON.stringify(msg);
    let sentCount = 0;
    const expectedRemotes = this.lobbyPlayers.filter((p) => !p.esAnfitrion).length;

    for (const slot of this.hostPeers.values()) {
      if (slot.dc && slot.dc.readyState === 'open') {
        try {
          slot.dc.send(serialized);
          sentCount++;
        } catch {}
      }
    }

    const isControlEphemeral =
      msg.type === 'PING' ||
      msg.type === 'PONG' ||
      msg.type === 'DIAG_PING' ||
      msg.type === 'DIAG_PONG';

    // Si algún jugador aún no abrió WebRTC (o es START_GAME para marcar sala enPartida), publicar en /msg
    if (!isControlEphemeral && (sentCount < expectedRemotes || msg.type === 'START_GAME')) {
      this.postFallbackMessage(msg);
    }
  }

  private syncHostStateToSingleClient(senderPeerId: string) {
    if (!this.currentGameState) return;
    const syncMsg: MensajeOnline = {
      type: 'STATE_SYNC',
      state: prepareWireState(this.currentGameState),
    };
    const slot = this.hostPeers.get(senderPeerId);
    if (slot?.dc?.readyState === 'open') {
      try {
        slot.dc.send(JSON.stringify(syncMsg));
        return;
      } catch {}
    }
    this.postFallbackMessage(syncMsg, senderPeerId);
  }

  private handleMessageFromClient(senderPeerId: string, msg: MensajeOnline) {
    if (!msg || typeof msg !== 'object') return;
    this.lastSeenMap.set(senderPeerId, Date.now());

    if (this.countdownInterval && msg.type !== 'PLAYER_LEFT') {
      this.stopReconnectGracePeriod();
      this.callbacks.onHostReconnected?.();
    }

    const senderSlot = this.hostPeers.get(senderPeerId);

    if (msg.type === 'PING' || msg.type === 'PONG') {
      if (msg.type === 'PING' && senderSlot?.dc?.readyState === 'open') {
        try {
          senderSlot.dc.send(JSON.stringify(this.buildPingPayload('PONG')));
        } catch {}
      }
      if (
        this.currentGameState &&
        typeof msg.turnosTotales === 'number' &&
        (msg.turnosTotales < this.currentGameState.turnosTotales ||
          (this.currentGameState.terminada && !msg.terminada))
      ) {
        this.syncHostStateToSingleClient(senderPeerId);
      }
      return;
    }

    if (msg.type === 'REQUEST_SYNC') {
      this.syncHostStateToSingleClient(senderPeerId);
      return;
    }

    if (msg.type === 'DIAG_PING') {
      if (senderSlot?.dc?.readyState === 'open') {
        try {
          senderSlot.dc.send(JSON.stringify({ type: 'DIAG_PONG', ts: msg.ts }));
        } catch {}
      }
      return;
    }
    if (msg.type === 'DIAG_PONG') {
      this.updateLatencyMetric(Date.now() - msg.ts);
      return;
    }

    if (msg.type === 'JOIN_REQUEST') {
      const existing = this.lobbyPlayers.find((p) => p.peerId === senderPeerId);
      if (existing) {
        existing.cuentaId = msg.cuentaId || existing.cuentaId;
        existing.nombre = msg.nombre.trim() || existing.nombre;
        existing.color = msg.color || existing.color;
        existing.hat = msg.hat || existing.hat;
        existing.ropa = msg.ropa || existing.ropa || 'ninguna';
        existing.ropaColor = msg.ropaColor !== undefined ? msg.ropaColor : existing.ropaColor;
        existing.aura = msg.aura || existing.aura || 'ninguna';
        existing.conectado = true;
        this.broadcastLobbyUpdate();
      }
      return;
    }

    if (msg.type === 'PLAYER_ACTION') {
      if (msg._actionId) {
        if (this.handledActionIds.has(msg._actionId)) {
          // El cliente reintentó su acción porque no le llegó el STATE_SYNC: reenviarle estado actual
          this.syncHostStateToSingleClient(senderPeerId);
          return;
        }
        this.handledActionIds.add(msg._actionId);
        if (this.handledActionIds.size > 60) {
          const first = this.handledActionIds.values().next().value;
          if (first) this.handledActionIds.delete(first);
        }
      }
      if (this.callbacks.onPlayerAction) {
        this.callbacks.onPlayerAction(msg.jugadorId, msg.accion, msg.payload);
      } else if (this.callbacks.onClientAction) {
        this.callbacks.onClientAction(msg.jugadorId, msg.accion, msg.payload);
      }
    } else if (msg.type === 'REACTION') {
      for (const [peerId, slot] of this.hostPeers.entries()) {
        if (peerId !== senderPeerId && slot.dc?.readyState === 'open') {
          try {
            slot.dc.send(JSON.stringify(msg));
          } catch {}
        }
      }
      this.callbacks.onReaction?.(msg.jugadorId, msg.emoji);
    } else if (msg.type === 'REMATCH_REQUEST') {
      const senderName =
        msg.nombre ||
        this.currentGameState?.jugadores[msg.jugadorId]?.nombre ||
        `Jugador ${msg.jugadorId + 1}`;
      for (const [peerId, slot] of this.hostPeers.entries()) {
        if (peerId !== senderPeerId && slot.dc?.readyState === 'open') {
          try {
            slot.dc.send(JSON.stringify(msg));
          } catch {}
        }
      }
      this.callbacks.onRematchRequested?.(msg.jugadorId, senderName);
    } else if (msg.type === 'REMATCH_RESPONSE') {
      const senderName =
        msg.nombre ||
        this.currentGameState?.jugadores[msg.jugadorId]?.nombre ||
        `Jugador ${msg.jugadorId + 1}`;
      if (!msg.aceptada) {
        this.rivalLeftAfterMatch = true;
      }
      for (const [peerId, slot] of this.hostPeers.entries()) {
        if (peerId !== senderPeerId && slot.dc?.readyState === 'open') {
          try {
            slot.dc.send(JSON.stringify(msg));
          } catch {}
        }
      }
      this.callbacks.onRematchResponded?.(msg.jugadorId, senderName, msg.aceptada);
    } else if (msg.type === 'PLAYER_LEFT') {
      const senderName =
        msg.nombre ||
        this.currentGameState?.jugadores[msg.jugadorId]?.nombre ||
        'El otro jugador';
      this.broadcast(msg);
      this.notifyPeerDeparture(senderName);
    }
  }

  private handleMessageFromHost(msg: MensajeOnline) {
    if (!msg || typeof msg !== 'object') return;
    this.hostLastSeen = Date.now();

    if (this.countdownInterval && msg.type !== 'PLAYER_LEFT') {
      this.stopReconnectGracePeriod();
      this.callbacks.onHostReconnected?.();
    }

    if (msg.type === 'PING' || msg.type === 'PONG') {
      if (msg.type === 'PING' && this.clientDc?.readyState === 'open') {
        try {
          this.clientDc.send(JSON.stringify(this.buildPingPayload('PONG')));
        } catch {}
      }
      if (
        this.currentGameState &&
        typeof msg.turnosTotales === 'number' &&
        (msg.turnosTotales > this.currentGameState.turnosTotales ||
          (msg.terminada && !this.currentGameState.terminada))
      ) {
        this.sendToHost({
          type: 'REQUEST_SYNC',
          jugadorId: this.myPlayerId,
          turnosTotales: this.currentGameState.turnosTotales,
        });
      }
      return;
    }

    if (msg.type === 'DIAG_PING') {
      if (this.clientDc?.readyState === 'open') {
        try {
          this.clientDc.send(JSON.stringify({ type: 'DIAG_PONG', ts: msg.ts }));
        } catch {}
      }
      return;
    }
    if (msg.type === 'DIAG_PONG') {
      this.updateLatencyMetric(Date.now() - msg.ts);
      return;
    }

    if (msg.type === 'JOIN_REJECTED') {
      this.callbacks.onLobbyError?.(msg.motivo || 'No se pudo entrar a la sala.');
      return;
    }

    if (msg.type === 'LOBBY_UPDATE') {
      this.roomCode = msg.roomCode;
      this.maxPlayers = msg.maxJugadores === 4 ? 4 : 2;
      if (msg.tamanoTablero !== undefined) {
        this.tamanoTablero = normalizarTamanoTablero(msg.tamanoTablero);
      }
      this.lobbyPlayers = msg.jugadores;

      const me = msg.jugadores.find((p) => p.peerId === this.myPeerId);
      if (me) {
        this.myPlayerId = me.id;
        this.myColor = me.color;
        this.myHat = me.hat;
        this.myRopa = me.ropa || 'ninguna';
        this.myRopaColor = me.ropaColor;
        this.myAura = me.aura || 'ninguna';
      }

      this.saveActiveSession();
      this.callbacks.onLobbyUpdate?.(msg.jugadores, this.maxPlayers, this.tamanoTablero);
    } else if (msg.type === 'START_GAME') {
      if (msg._startId && msg._startId === this.lastHandledStartId) {
        return;
      }
      if (msg._startId) {
        this.lastHandledStartId = msg._startId;
      }
      this.clearPendingActionRetry();
      this.rivalLeftAfterMatch = false;
      this.roomClosedRemotely = false;
      this.hadWebRtcOpenInMatch = this.areAllClientDataChannelsOpen();
      const clientState: EstadoDeJuego = {
        ...msg.initialState,
        miJugadorId: this.myPlayerId,
        esAnfitrion: false,
        modoOnline: true,
      };
      this.currentGameState = clientState;
      this.saveActiveSession();
      this.callbacks.onGameStart?.(clientState);
    } else if (msg.type === 'STATE_SYNC') {
      this.clearPendingActionRetry();
      const clientState: EstadoDeJuego = {
        ...msg.state,
        miJugadorId: this.myPlayerId,
        esAnfitrion: false,
        modoOnline: true,
      };
      this.currentGameState = clientState;
      this.saveActiveSession();
      this.callbacks.onStateSync?.(clientState);
    } else if (msg.type === 'REACTION') {
      this.callbacks.onReaction?.(msg.jugadorId, msg.emoji);
    } else if (msg.type === 'REMATCH_REQUEST') {
      const senderName =
        msg.nombre ||
        this.currentGameState?.jugadores[msg.jugadorId]?.nombre ||
        'El anfitrión';
      this.callbacks.onRematchRequested?.(msg.jugadorId, senderName);
    } else if (msg.type === 'REMATCH_RESPONSE') {
      const senderName =
        msg.nombre ||
        this.currentGameState?.jugadores[msg.jugadorId]?.nombre ||
        'El anfitrión';
      if (!msg.aceptada) {
        this.rivalLeftAfterMatch = true;
      }
      this.callbacks.onRematchResponded?.(msg.jugadorId, senderName, msg.aceptada);
    } else if (msg.type === 'PLAYER_LEFT') {
      this.notifyPeerDeparture(msg.nombre || 'El otro jugador');
    } else if (msg.type === 'HOST_RESUMED') {
      this.clearPendingActionRetry();
      this.stopReconnectGracePeriod();
      const clientState: EstadoDeJuego = {
        ...msg.state,
        miJugadorId: this.myPlayerId,
        esAnfitrion: false,
        modoOnline: true,
      };
      this.currentGameState = clientState;
      this.callbacks.onStateSync?.(clientState);
      this.callbacks.onHostReconnected?.();
    }
  }

  private broadcastLobbyUpdate() {
    const list = [...this.lobbyPlayers];
    const updateMsg: MensajeOnline = {
      type: 'LOBBY_UPDATE',
      roomCode: this.roomCode,
      maxJugadores: this.maxPlayers,
      tamanoTablero: this.tamanoTablero,
      jugadores: list,
    };
    const serialized = JSON.stringify(updateMsg);
    for (const slot of this.hostPeers.values()) {
      if (slot.dc && slot.dc.readyState === 'open') {
        try {
          slot.dc.send(serialized);
        } catch {}
      }
    }
    this.callbacks.onLobbyUpdate?.(list, this.maxPlayers, this.tamanoTablero);
  }

  public startGameAsHost(initialState: EstadoDeJuego) {
    this.clearPendingActionRetry();
    this.rivalLeftAfterMatch = false;
    this.roomClosedRemotely = false;
    this.hadWebRtcOpenInMatch = this.areAllClientDataChannelsOpen();
    const now = Date.now();
    this.lobbyPlayers.forEach((p) => {
      if (!p.esAnfitrion && p.peerId) {
        this.lastSeenMap.set(p.peerId, now);
      }
    });
    const cleanInitial = prepareWireState(initialState);
    this.currentGameState = cleanInitial;
    const startId = `st_${now}_${randomShortId(4)}`;
    this.lastHandledStartId = startId;
    this.saveActiveSession();

    const startMsg: MensajeOnline = {
      type: 'START_GAME',
      config: cleanInitial.config,
      initialState: cleanInitial,
      _startId: startId,
    };
    this.broadcast(startMsg);
  }

  public syncState(state: EstadoDeJuego) {
    const cleanState = prepareWireState(state);
    this.currentGameState = cleanState;
    this.saveActiveSession();
    this.broadcast({
      type: 'STATE_SYNC',
      state: cleanState,
    });
  }

  public sendAction(
    accion: 'mover' | 'muro' | 'pasar',
    payload: { destino?: Coordenada; orientacion?: OrientacionMuro; r?: number; c?: number }
  ) {
    if (this.role !== 'client') return;
    const expectedPrevTurns = this.currentGameState?.turnosTotales ?? 0;
    const msg: MensajeOnline = {
      type: 'PLAYER_ACTION',
      jugadorId: this.myPlayerId,
      accion,
      payload,
      _actionId: `act_${Date.now()}_${randomShortId(4)}`,
    };
    this.sendToHost(msg);

    // Reintento automático por respaldo HTTP si el canal WebRTC quedó semiabierto y el anfitrión no confirmó el turno
    this.clearPendingActionRetry();
    this.pendingActionRetryTimer = setTimeout(() => {
      this.pendingActionRetryTimer = null;
      if (
        this.isIntentionalExit ||
        this.role !== 'client' ||
        !this.currentGameState ||
        this.currentGameState.terminada
      ) {
        return;
      }
      if ((this.currentGameState.turnosTotales ?? 0) <= expectedPrevTurns) {
        this.postFallbackMessage(msg);
        this.postFallbackMessage({
          type: 'REQUEST_SYNC',
          jugadorId: this.myPlayerId,
          turnosTotales: this.currentGameState.turnosTotales,
        });
        this.pollRoomOnce();
      }
    }, 2200);
  }

  public sendReaction(emoji: string) {
    const msg: MensajeOnline = {
      type: 'REACTION',
      jugadorId: this.myPlayerId,
      emoji,
    };
    if (this.role === 'client') {
      this.sendToHost(msg);
    } else if (this.role === 'host') {
      this.broadcast(msg);
    }
    this.callbacks.onReaction?.(this.myPlayerId, emoji);
  }

  public canRequestRematch(): boolean {
    if (!this.role || this.rivalLeftAfterMatch || this.roomClosedRemotely) return false;
    if (this.areAllClientDataChannelsOpen()) return true;
    return Boolean(this.roomCode);
  }

  public requestRematch(_jugadorId?: number): boolean {
    if (!this.canRequestRematch()) return false;
    const msg: MensajeOnline = {
      type: 'REMATCH_REQUEST',
      jugadorId: this.myPlayerId,
      nombre: this.myName,
    };
    if (this.role === 'client') {
      this.sendToHost(msg);
      return true;
    }
    if (this.role === 'host') {
      this.broadcast(msg);
      return true;
    }
    return false;
  }

  public respondRematch(aceptada: boolean): boolean {
    const msg: MensajeOnline = {
      type: 'REMATCH_RESPONSE',
      jugadorId: this.myPlayerId,
      nombre: this.myName,
      aceptada,
    };
    if (!aceptada) {
      this.rivalLeftAfterMatch = true;
    }
    if (this.role === 'client') {
      this.sendToHost(msg);
      return true;
    }
    if (this.role === 'host') {
      this.broadcast(msg);
      return true;
    }
    return false;
  }

  private startDisconnectGracePeriod() {
    if (this.countdownInterval) return;
    let secondsLeft = 25;
    this.callbacks.onHostDisconnectWarning?.(secondsLeft);

    this.countdownInterval = setInterval(() => {
      secondsLeft -= 1;
      this.callbacks.onHostDisconnectWarning?.(secondsLeft);
      if (secondsLeft <= 0) {
        this.stopReconnectGracePeriod();
        this.callbacks.onDisconnectTimeout?.();
      }
    }, 1000);
  }

  private stopReconnectGracePeriod() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  public async obtenerSalasPublicas(): Promise<InfoSalaPublica[]> {
    try {
      const base = getApiBaseUrl('/api/salas');
      const sep = base.includes('?') ? '&' : '?';
      const res = await fetch(`${base}${sep}_t=${Date.now()}`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const list = await res.json();
        if (Array.isArray(list)) return list;
      }
    } catch {}
    return [];
  }

  public async publicarSalaPublica(input?: string | any): Promise<boolean> {
    const info = typeof input === 'object' && input !== null ? input : {};
    const code = normalizeRoomCode(info.codigo || this.roomCode);
    if (!code) return false;
    const nombre = typeof input === 'string' ? input : info.nombre || `Sala de ${this.myName}`;
    try {
      const res = await fetch(getApiBaseUrl('/api/salas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          codigo: code,
          nombre: String(nombre).trim() || `Sala ${code}`,
          anfitrion: info.anfitrion || this.myName,
          cuentaId: info.cuentaId || this.myCuentaId,
          hostPeerId: this.myPeerId || `host_${code.toLowerCase()}`,
          color: info.color || this.myColor,
          hat: info.hat || this.myHat,
          ropa: info.ropa || this.myRopa,
          ropaColor: info.ropaColor ?? this.myRopaColor,
          aura: info.aura || this.myAura,
          maxJugadores: info.maxJugadores || this.maxPlayers,
          tamanoTablero: info.tamanoTablero || this.tamanoTablero,
          publica: true,
          jugadores: this.lobbyPlayers.length > 0 ? this.lobbyPlayers : undefined,
          jugadoresConectados: Math.max(1, this.lobbyPlayers.length || 1),
          creadoEn: info.creadoEn || Date.now(),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async actualizarSalaPublica(jugadoresConectados?: number): Promise<void> {
    if (this.role !== 'host' || !this.roomCode) return;
    try {
      await fetch(getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          jugadoresConectados:
            typeof jugadoresConectados === 'number'
              ? jugadoresConectados
              : Math.max(1, this.lobbyPlayers.length || 1),
        }),
      });
    } catch {}
  }

  public async eliminarSalaPublica(): Promise<void> {
    if (!this.roomCode) return;
    try {
      await fetch(getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}`), {
        method: 'DELETE',
        cache: 'no-store',
        keepalive: true,
      });
    } catch {}
  }

  public disconnect() {
    this.cleanUp();
  }

  public cleanUp() {
    const prevRole = this.role;
    const prevCode = this.roomCode;
    const prevPeerId = this.myPeerId;
    const prevPlayerId = this.myPlayerId;
    const prevName = this.myName;

    if (prevRole === 'host' && prevCode) {
      const leftMsg: MensajeOnline = {
        type: 'PLAYER_LEFT',
        jugadorId: prevPlayerId,
        nombre: prevName || 'El anfitrión',
      };
      for (const slot of this.hostPeers.values()) {
        if (slot.dc && slot.dc.readyState === 'open') {
          try {
            slot.dc.send(JSON.stringify(leftMsg));
          } catch {}
        }
      }
      fetch(getApiBaseUrl(`/api/salas/${encodeURIComponent(prevCode)}`), {
        method: 'DELETE',
        cache: 'no-store',
        keepalive: true,
      }).catch(() => {});
    } else if (prevRole === 'client' && prevCode) {
      const leftMsg: MensajeOnline = {
        type: 'PLAYER_LEFT',
        jugadorId: prevPlayerId,
        nombre: prevName || 'El otro jugador',
      };
      if (this.clientDc && this.clientDc.readyState === 'open') {
        try {
          this.clientDc.send(JSON.stringify(leftMsg));
        } catch {}
      }
      fetch(getApiBaseUrl(`/api/salas/${encodeURIComponent(prevCode)}/leave`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        keepalive: true,
        body: JSON.stringify({
          peerId: prevPeerId,
          jugadorId: prevPlayerId,
          nombre: prevName || 'El otro jugador',
        }),
      }).catch(() => {});
    }

    this.isIntentionalExit = true;
    this.rivalLeftAfterMatch = false;
    this.roomClosedRemotely = false;
    this.hadWebRtcOpenInMatch = false;
    this.lastRemoteActivityMarker = '';
    this.lastPollAt = 0;
    this.clearPendingActionRetry();
    this.stopHeartbeat();
    this.stopRoomSyncLoop();
    this.stopReconnectGracePeriod();
    this.stopDiagnosticPingLoop();

    for (const slot of this.hostPeers.values()) {
      try {
        slot.dc?.close();
        slot.pc.close();
      } catch {}
    }
    this.hostPeers.clear();
    this.lastSeenMap.clear();

    if (this.clientDc) {
      try {
        this.clientDc.close();
      } catch {}
      this.clientDc = null;
    }
    if (this.clientPc) {
      try {
        this.clientPc.close();
      } catch {}
      this.clientPc = null;
    }

    this.appliedAnswerSdp = '';
    this.lastMsgSeq = 0;
    this.lastHandledStartId = '';
    this.handledActionIds.clear();
    this.currentGameState = null;
    this.role = null;
    this.roomCode = '';
    this.myPeerId = '';
    this.myCuentaId = undefined;
    this.myRopa = 'ninguna';
    this.myRopaColor = undefined;
    this.myAura = 'ninguna';
    this.lobbyPlayers = [];

    this.diagnosticData.status = 'desconectado';
    this.diagnosticData.calidad = 'desconectado';
    this.diagnosticData.pingMs = null;
    this.diagnosticData.role = 'none';
    this.diagnosticData.rivalPeerId = null;
    this.diagnosticData.dataChannelState = 'closed';
    this.notifyDiagnostics();

    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }
}

export const onlineService = new OnlineManager();
