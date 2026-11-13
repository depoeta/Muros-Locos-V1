/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor Online P2P aislado para Candado (WebRTC DataChannel + respaldo /api/salas/:codigo/msg).
 * Mantiene total aislamiento respecto a src/game/onlineService.ts de Muros Locos.
 */

import { getApiBaseUrl } from '../game/storage';
import {
  ConfigDueloCandadoP2P,
  DigitosCandado,
  InfoSalaCandado,
  JugadorCandadoOnline,
  MensajeCandadoP2P,
} from './types';

function normalizarCodigoSalaCandado(code: string): string {
  return String(code || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, '');
}

export function generarCodigoSalaCandado(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function randomShortId(len: number = 6): string {
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
  ],
};

async function gatherLocalDescription(
  pc: RTCPeerConnection,
  maxWaitMs: number = 900
): Promise<RTCSessionDescriptionInit | null> {
  if (!pc.localDescription) return null;
  if (pc.iceGatheringState === 'complete') {
    return { type: pc.localDescription.type, sdp: pc.localDescription.sdp };
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    let srflxTimer: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (srflxTimer) clearTimeout(srflxTimer);
      pc.removeEventListener('icegatheringstatechange', onState);
      pc.removeEventListener('icecandidate', onCand);
      resolve();
    };
    const onState = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const onCand = (ev: RTCPeerConnectionIceEvent) => {
      if (!ev.candidate) {
        done();
        return;
      }
      if (ev.candidate.candidate?.includes('typ srflx') && !srflxTimer) {
        srflxTimer = setTimeout(done, 160);
      }
    };
    const hardTimer = setTimeout(done, maxWaitMs);
    pc.addEventListener('icegatheringstatechange', onState);
    pc.addEventListener('icecandidate', onCand);
  });

  if (!pc.localDescription) return null;
  return { type: pc.localDescription.type, sdp: pc.localDescription.sdp };
}

export interface CandadoOnlineCallbacks {
  onLobbyUpdate?: (
    jugadores: JugadorCandadoOnline[],
    config?: ConfigDueloCandadoP2P
  ) => void;
  onMessage?: (msg: MensajeCandadoP2P) => void;
  onPeerLeft?: (nombre: string) => void;
  onDisconnectWarning?: (secondsLeft: number) => void;
  onReconnected?: () => void;
  onDisconnectTimeout?: () => void;
  onConnectionModeChange?: (mode: 'webrtc' | 'http' | 'connecting') => void;
  onLobbyError?: (error: string) => void;
}

class CandadoOnlineManager {
  private role: 'host' | 'client' | null = null;
  private roomCode: string = '';
  private myPeerId: string = '';
  private myPlayerId: 0 | 1 = 0;
  private myName: string = '';
  private myCuentaId?: string;
  private configSala: ConfigDueloCandadoP2P | null = null;
  private lobbyPlayers: JugadorCandadoOnline[] = [];
  private callbacks: CandadoOnlineCallbacks = {};

  private hostPc: RTCPeerConnection | null = null;
  private hostDc: RTCDataChannel | null = null;
  private answeredOfferSdp: string = '';

  private clientPc: RTCPeerConnection | null = null;
  private clientDc: RTCDataChannel | null = null;
  private appliedAnswerSdp: string = '';

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private graceTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight: boolean = false;
  private lastMsgSeq: number = 0;
  private lastRemoteSeenAt: number = Date.now();
  private inMatch: boolean = false;
  private isExiting: boolean = false;
  private seenMessageKeys: Set<string> = new Set();

  public setCallbacks(cb: CandadoOnlineCallbacks) {
    this.callbacks = cb;
  }

  public setInMatch(active: boolean) {
    this.inMatch = active;
    if (active) {
      this.lastRemoteSeenAt = Date.now();
      this.stopGracePeriod();
    }
  }

  public getRoomInfo() {
    return {
      role: this.role,
      roomCode: this.roomCode,
      myPeerId: this.myPeerId,
      myPlayerId: this.myPlayerId,
      configSala: this.configSala,
      lobbyPlayers: [...this.lobbyPlayers],
    };
  }

  public async obtenerSalasPublicasCandado(
    digitosFiltro?: DigitosCandado | 0
  ): Promise<InfoSalaCandado[]> {
    try {
      const base = getApiBaseUrl('/api/salas');
      const params = new URLSearchParams({ juego: 'candado', _t: String(Date.now()) });
      if (digitosFiltro && digitosFiltro > 0) {
        params.set('digitos', String(digitosFiltro));
      }
      const res = await fetch(`${base}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  public async createRoom(params: {
    codigo?: string;
    publica: boolean;
    config: ConfigDueloCandadoP2P;
    jugador: {
      cuentaId?: string;
      nombre: string;
      color: string;
      hat: string;
      ropa?: string;
      ropaColor?: string;
      aura?: string;
    };
  }): Promise<string> {
    this.cleanUp();
    this.isExiting = false;
    this.role = 'host';
    this.roomCode =
      normalizarCodigoSalaCandado(params.codigo || '') || generarCodigoSalaCandado();
    this.myPlayerId = 0;
    this.myName = params.jugador.nombre.trim() || 'Anfitrión';
    this.myCuentaId = params.jugador.cuentaId;
    this.myPeerId = `cnd-host-${this.roomCode.toLowerCase()}-${randomShortId(5)}`;
    this.configSala = { ...params.config };
    this.lastMsgSeq = 0;

    const hostJugador: JugadorCandadoOnline = {
      id: 0,
      peerId: this.myPeerId,
      cuentaId: this.myCuentaId,
      nombre: this.myName,
      color: params.jugador.color,
      hat: params.jugador.hat,
      ropa: params.jugador.ropa || 'ninguna',
      ropaColor: params.jugador.ropaColor,
      aura: params.jugador.aura || 'ninguna',
      conectado: true,
      esAnfitrion: true,
    };
    this.lobbyPlayers = [hostJugador];

    const res = await fetch(getApiBaseUrl('/api/salas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        codigo: this.roomCode,
        juego: 'candado',
        nombre: `Candado de ${this.myName}`,
        anfitrion: this.myName,
        cuentaId: this.myCuentaId,
        hostPeerId: this.myPeerId,
        color: hostJugador.color,
        hat: hostJugador.hat,
        ropa: hostJugador.ropa,
        ropaColor: hostJugador.ropaColor,
        aura: hostJugador.aura,
        maxJugadores: 2,
        publica: params.publica,
        modoCandado: params.config.modo,
        digitosCandado: params.config.digitos,
        permitirRepetidos: params.config.permitirRepetidos,
        maxIntentos: params.config.maxIntentos,
        tiempoTurnoSeg: params.config.tiempoTurnoSeg,
        jugadores: this.lobbyPlayers,
        creadoEn: Date.now(),
      }),
    });

    if (!res.ok) {
      this.cleanUp();
      throw new Error('No se pudo crear la sala de Candado en el servidor.');
    }

    this.callbacks.onConnectionModeChange?.('http');
    this.startLoops();
    this.callbacks.onLobbyUpdate?.([...this.lobbyPlayers], this.configSala);
    return this.roomCode;
  }

  public async joinRoom(params: {
    codigo: string;
    jugador: {
      cuentaId?: string;
      nombre: string;
      color: string;
      hat: string;
      ropa?: string;
      ropaColor?: string;
      aura?: string;
    };
  }): Promise<{ config: ConfigDueloCandadoP2P; jugadores: JugadorCandadoOnline[] }> {
    this.cleanUp();
    this.isExiting = false;
    const codigoLimpio = normalizarCodigoSalaCandado(params.codigo);
    if (!codigoLimpio) {
      throw new Error('Código de sala inválido.');
    }

    // Verificar primero que la sala exista y pertenezca a Candado
    const checkRes = await fetch(
      getApiBaseUrl(`/api/salas/${encodeURIComponent(codigoLimpio)}?_t=${Date.now()}`),
      { cache: 'no-store' }
    );
    const checkData = await checkRes.json().catch(() => null);
    if (!checkRes.ok || !checkData?.ok || !checkData?.sala) {
      throw new Error(checkData?.error || `La sala ${codigoLimpio} no existe o ya cerró.`);
    }
    if (checkData.sala.juego !== 'candado') {
      throw new Error('Ese código pertenece a una sala de Muros Locos, no a Candado.');
    }

    this.role = 'client';
    this.roomCode = codigoLimpio;
    this.myName = params.jugador.nombre.trim() || 'Invitado';
    this.myCuentaId = params.jugador.cuentaId;
    this.myPeerId = `cnd-cli-${codigoLimpio.toLowerCase()}-${randomShortId(5)}`;
    this.lastMsgSeq = Number(checkData.sala.seq) || 0;

    let offer: RTCSessionDescriptionInit | null = null;
    if (typeof RTCPeerConnection !== 'undefined') {
      try {
        const pc = new RTCPeerConnection(RTC_CONFIGURATION);
        this.clientPc = pc;
        const dc = pc.createDataChannel('candado-p2p', { ordered: true });
        this.clientDc = dc;
        this.bindDataChannel(dc);

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            this.callbacks.onConnectionModeChange?.('webrtc');
          }
        };

        const offerRaw = await pc.createOffer();
        await pc.setLocalDescription(offerRaw);
        offer = await gatherLocalDescription(pc, 900);
      } catch {}
    }

    const res = await fetch(
      getApiBaseUrl(`/api/salas/${encodeURIComponent(codigoLimpio)}/join`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          peerId: this.myPeerId,
          cuentaId: this.myCuentaId,
          nombre: this.myName,
          color: params.jugador.color,
          hat: params.jugador.hat,
          ropa: params.jugador.ropa || 'ninguna',
          ropaColor: params.jugador.ropaColor,
          aura: params.jugador.aura || 'ninguna',
          offer,
        }),
      }
    );

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.sala) {
      this.cleanUp();
      throw new Error(data?.error || 'No se pudo entrar a la sala de Candado.');
    }

    const sala = data.sala;
    const jugadores: JugadorCandadoOnline[] = Array.isArray(sala.jugadores) ? sala.jugadores : [];
    const me = jugadores.find((j) => j.peerId === this.myPeerId);
    this.myPlayerId = me?.id === 0 ? 0 : 1;
    this.lobbyPlayers = jugadores;
    this.configSala = {
      modo: sala.modoCandado === 'mayor_menor' ? 'mayor_menor' : 'logico',
      digitos: sala.digitosCandado || 4,
      permitirRepetidos: Boolean(sala.permitirRepetidos),
      maxIntentos: sala.maxIntentos || 0,
      tiempoTurnoSeg: sala.tiempoTurnoSeg ?? 45,
    };

    this.callbacks.onConnectionModeChange?.('connecting');
    this.startLoops();
    this.callbacks.onLobbyUpdate?.([...this.lobbyPlayers], this.configSala);

    return { config: this.configSala, jugadores: [...this.lobbyPlayers] };
  }

  public async updateRoomConfigAsHost(config: ConfigDueloCandadoP2P) {
    if (this.role !== 'host' || !this.roomCode) return;
    this.configSala = { ...config };
    try {
      await fetch(getApiBaseUrl('/api/salas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          codigo: this.roomCode,
          juego: 'candado',
          anfitrion: this.myName,
          cuentaId: this.myCuentaId,
          hostPeerId: this.myPeerId,
          maxJugadores: 2,
          modoCandado: config.modo,
          digitosCandado: config.digitos,
          permitirRepetidos: config.permitirRepetidos,
          maxIntentos: config.maxIntentos,
          tiempoTurnoSeg: config.tiempoTurnoSeg,
          jugadores: this.lobbyPlayers,
        }),
      });
    } catch {}
    this.send({ type: 'LOBBY_UPDATE', jugadores: this.lobbyPlayers, config });
  }

  public send(msg: MensajeCandadoP2P) {
    if (this.isExiting || !this.roomCode) return;
    const raw = JSON.stringify(msg);
    const dc = this.role === 'host' ? this.hostDc : this.clientDc;
    let enviadoPorWebRtc = false;
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(raw);
        enviadoPorWebRtc = true;
      } catch {}
    }

    // Enviar por /msg si WebRTC no está abierto o si es evento crítico de inicio/cierre/rematch
    const esCritico =
      msg.type === 'CANDADO_START' ||
      msg.type === 'CANDADO_COMMIT' ||
      msg.type === 'CANDADO_REVEAL' ||
      msg.type === 'CANDADO_SURRENDER' ||
      msg.type === 'CANDADO_REMATCH_REQUEST' ||
      msg.type === 'CANDADO_REMATCH_RESPONSE';

    if (!enviadoPorWebRtc || esCritico) {
      this.postMsgFallback(msg);
    }
  }

  private async postMsgFallback(msg: MensajeCandadoP2P) {
    if (!this.roomCode || this.isExiting) return;
    try {
      await fetch(
        getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}/msg`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            from: this.myPeerId,
            msg,
          }),
        }
      );
    } catch {}
  }

  private bindDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      this.lastRemoteSeenAt = Date.now();
      this.stopGracePeriod();
      this.callbacks.onConnectionModeChange?.('webrtc');
      this.callbacks.onReconnected?.();
    };
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as MensajeCandadoP2P;
        this.handleIncomingMessage(msg);
      } catch {}
    };
    dc.onclose = () => {
      this.callbacks.onConnectionModeChange?.('http');
      if (this.inMatch && !this.isExiting) {
        this.startGracePeriod();
      }
    };
  }

  private handleIncomingMessage(msg: MensajeCandadoP2P) {
    if (!msg || typeof msg !== 'object') return;
    this.lastRemoteSeenAt = Date.now();
    this.stopGracePeriod();
    this.callbacks.onReconnected?.();

    if (msg.type === 'HEARTBEAT') return;

    // Deduplicar mensajes con actionId / startId / matchId+type para que WebRTC + /msg fallback no dupliquen
    let dedupeKey: string | null = null;
    if ('actionId' in msg && msg.actionId) {
      dedupeKey = `${msg.type}:${msg.actionId}`;
    } else if (msg.type === 'CANDADO_START') {
      dedupeKey = `START:${msg.startId}`;
    } else if (msg.type === 'CANDADO_COMMIT') {
      dedupeKey = `COMMIT:${msg.matchId}:${msg.jugadorId}`;
    } else if (msg.type === 'CANDADO_CLUE') {
      dedupeKey = `CLUE:${msg.matchId}:${msg.objetivoJugadorId}:${msg.intento.numero}`;
    } else if (msg.type === 'CANDADO_REVEAL') {
      dedupeKey = `REVEAL:${msg.matchId}:${msg.jugadorId}`;
    }

    if (dedupeKey) {
      if (this.seenMessageKeys.has(dedupeKey)) return;
      this.seenMessageKeys.add(dedupeKey);
      if (this.seenMessageKeys.size > 150) {
        const first = this.seenMessageKeys.values().next().value;
        if (first) this.seenMessageKeys.delete(first);
      }
    }

    if (msg.type === 'LOBBY_UPDATE') {
      this.lobbyPlayers = msg.jugadores;
      if (msg.config) this.configSala = msg.config;
      this.callbacks.onLobbyUpdate?.([...msg.jugadores], msg.config || this.configSala || undefined);
      return;
    }

    if (msg.type === 'PLAYER_LEFT') {
      this.callbacks.onPeerLeft?.(msg.nombre);
      return;
    }

    this.callbacks.onMessage?.(msg);
  }

  private startLoops() {
    this.stopLoops();
    this.lastRemoteSeenAt = Date.now();

    this.pollTimer = setInterval(() => {
      this.pollOnce();
    }, 1400);

    this.heartbeatTimer = setInterval(() => {
      if (this.isExiting || !this.role) return;
      const dc = this.role === 'host' ? this.hostDc : this.clientDc;
      if (dc && dc.readyState === 'open') {
        try {
          dc.send(
            JSON.stringify({
              type: 'HEARTBEAT',
              peerId: this.myPeerId,
              jugadorId: this.myPlayerId,
            } satisfies MensajeCandadoP2P)
          );
        } catch {}
      }

      if (this.inMatch && Date.now() - this.lastRemoteSeenAt > 14000) {
        this.startGracePeriod();
      }
    }, 2500);
  }

  private stopLoops() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.stopGracePeriod();
  }

  private startGracePeriod() {
    if (this.graceTimer || this.isExiting) return;
    let remaining = 20;
    this.callbacks.onDisconnectWarning?.(remaining);
    this.graceTimer = setInterval(() => {
      remaining -= 1;
      this.callbacks.onDisconnectWarning?.(remaining);
      if (remaining <= 0) {
        this.stopGracePeriod();
        this.callbacks.onDisconnectTimeout?.();
      }
    }, 1000);
  }

  private stopGracePeriod() {
    if (this.graceTimer) {
      clearInterval(this.graceTimer);
      this.graceTimer = null;
    }
  }

  private async pollOnce() {
    if (this.isExiting || !this.role || !this.roomCode || this.pollInFlight) return;

    const dc = this.role === 'host' ? this.hostDc : this.clientDc;
    const webrtcOpen = Boolean(dc && dc.readyState === 'open');
    if (this.inMatch && webrtcOpen && Date.now() - this.lastRemoteSeenAt < 10000) {
      return;
    }

    this.pollInFlight = true;
    try {
      const base = getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}`);
      const res = await fetch(
        `${base}?peerId=${encodeURIComponent(this.myPeerId)}&since=${this.lastMsgSeq}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (this.isExiting || !this.role) return;

      if (res.status === 404) {
        this.callbacks.onPeerLeft?.(
          this.lobbyPlayers.find((p) => p.id !== this.myPlayerId)?.nombre || 'El rival'
        );
        return;
      }
      if (!res.ok) return;

      const data = await res.json().catch(() => null);
      if (!data?.ok || !data?.sala) return;
      const sala = data.sala;

      if (sala.juego === 'candado') {
        const cfg: ConfigDueloCandadoP2P = {
          modo: sala.modoCandado === 'mayor_menor' ? 'mayor_menor' : 'logico',
          digitos: sala.digitosCandado || 4,
          permitirRepetidos: Boolean(sala.permitirRepetidos),
          maxIntentos: sala.maxIntentos || 0,
          tiempoTurnoSeg: sala.tiempoTurnoSeg ?? 45,
        };
        const lista: JugadorCandadoOnline[] = Array.isArray(sala.jugadores) ? sala.jugadores : [];
        const cambioLobby =
          lista.length !== this.lobbyPlayers.length ||
          lista.some((p, i) => {
            const prev = this.lobbyPlayers[i];
            return !prev || prev.peerId !== p.peerId || prev.conectado !== p.conectado || prev.nombre !== p.nombre;
          }) ||
          this.configSala?.digitos !== cfg.digitos ||
          this.configSala?.modo !== cfg.modo ||
          this.configSala?.tiempoTurnoSeg !== cfg.tiempoTurnoSeg;

        if (cambioLobby) {
          this.lobbyPlayers = lista;
          this.configSala = cfg;
          this.callbacks.onLobbyUpdate?.([...lista], cfg);
        }
      }

      // Negociación WebRTC pendiente
      if (this.role === 'host') {
        const guest = (sala.jugadores || []).find((p: any) => !p.esAnfitrion && p.peerId);
        const sig = guest ? sala.signals?.[guest.peerId] : null;
        if (guest && sig?.offer?.sdp && this.answeredOfferSdp !== sig.offer.sdp) {
          await this.acceptGuestOffer(guest.peerId, sig.offer);
        }
      } else if (this.role === 'client') {
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
          } catch {}
        }
      }

      const nuevos = Array.isArray(sala.mensajesNuevos) ? sala.mensajesNuevos : [];
      for (const item of nuevos) {
        if (item.seq > this.lastMsgSeq) this.lastMsgSeq = item.seq;
        if (item.msg) {
          this.handleIncomingMessage(item.msg as MensajeCandadoP2P);
        }
      }
      if (typeof sala.seq === 'number' && sala.seq > this.lastMsgSeq) {
        this.lastMsgSeq = sala.seq;
      }
    } catch {
    } finally {
      this.pollInFlight = false;
    }
  }

  private async acceptGuestOffer(
    guestPeerId: string,
    offer: RTCSessionDescriptionInit
  ) {
    if (typeof RTCPeerConnection === 'undefined') return;
    try {
      this.hostDc?.close();
      this.hostPc?.close();
    } catch {}
    this.answeredOfferSdp = offer.sdp || '';

    try {
      const pc = new RTCPeerConnection(RTC_CONFIGURATION);
      this.hostPc = pc;
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          this.callbacks.onConnectionModeChange?.('webrtc');
        }
      };
      pc.ondatachannel = (ev) => {
        this.hostDc = ev.channel;
        this.bindDataChannel(ev.channel);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      const fullAns = await gatherLocalDescription(pc, 900);
      if (fullAns && !this.isExiting && this.roomCode) {
        await fetch(
          getApiBaseUrl(`/api/salas/${encodeURIComponent(this.roomCode)}/signal`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ clientPeerId: guestPeerId, answer: fullAns }),
          }
        );
      }
    } catch {}
  }

  public async leaveRoom() {
    const code = this.roomCode;
    const role = this.role;
    const peerId = this.myPeerId;
    const nombre = this.myName;
    const jugadorId = this.myPlayerId;
    this.isExiting = true;
    this.cleanUp();

    if (!code) return;
    try {
      if (role === 'host' && !this.inMatch) {
        await fetch(getApiBaseUrl(`/api/salas/${encodeURIComponent(code)}`), {
          method: 'DELETE',
          cache: 'no-store',
        });
      } else {
        await fetch(getApiBaseUrl(`/api/salas/${encodeURIComponent(code)}/leave`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ peerId, nombre, jugadorId }),
        });
      }
    } catch {}
  }

  public cleanUp() {
    this.stopLoops();
    try {
      this.hostDc?.close();
      this.hostPc?.close();
      this.clientDc?.close();
      this.clientPc?.close();
    } catch {}
    this.hostDc = null;
    this.hostPc = null;
    this.clientDc = null;
    this.clientPc = null;
    this.answeredOfferSdp = '';
    this.appliedAnswerSdp = '';
    this.role = null;
    this.roomCode = '';
    this.inMatch = false;
    this.seenMessageKeys.clear();
  }
}

export const candadoOnlineService = new CandadoOnlineManager();
