/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Peer, type DataConnection } from 'peerjs';
import {
  ActiveOnlineSession,
  Coord,
  GameState,
  HatType,
  OnlineMessage,
  OnlinePlayerInfo,
  WallOrientation,
} from '../types/murosLocos';

export const SESSION_STORAGE_KEY = 'muros_locos_active_online_session';

export const SALAS_PUBLICAS = [
  { id: 'PUB-ALFA', nombre: 'Sala Alfa 🌟', desc: 'Partida Rápida 1 vs 1', max: 2 as const },
  { id: 'PUB-BETA', nombre: 'Sala Beta ⚡', desc: 'Partida Rápida 1 vs 1', max: 2 as const },
  { id: 'PUB-DUELO', nombre: 'Duelo de Titanes 👑', desc: 'Reto Estratégico 1 vs 1', max: 2 as const },
  { id: 'PUB-FIESTA', nombre: 'Gran Fiesta 4P 🎉', desc: 'Todos contra Todos (4 Jugadores)', max: 4 as const },
];

export function generarCodigoSala(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatRoomPeerId(code: string): string {
  return `muros-locos-p2p-${code.toLowerCase().trim()}`;
}

export type OnlineEventCallback = {
  onLobbyUpdate?: (players: OnlinePlayerInfo[], maxPlayers: 2 | 4) => void;
  onLobbyFull?: (maxPlayers: 2 | 4) => void;
  onGameStart?: (initialState: GameState) => void;
  onStateSync?: (state: GameState) => void;
  onClientAction?: (
    jugadorId: number,
    accion: 'mover' | 'muro' | 'pasar',
    payload: { destino?: Coord; orientacion?: WallOrientation; r?: number; c?: number }
  ) => void;
  onReaction?: (jugadorId: number, emoji: string) => void;
  onHostDisconnected?: (secondsRemaining: number) => void;
  onHostReconnected?: () => void;
  onError?: (errorMsg: string) => void;
  onDisconnectTimeout?: () => void;
};

class OnlineManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private role: 'host' | 'client' | null = null;
  private roomCode: string = '';
  private maxPlayers: 2 | 4 = 2;
  private myPlayerId: number = 0;
  private myName: string = '';
  private myColor: string = '#ff6b6b';
  private myHat: HatType = 'corona';
  private lobbyPlayers: OnlinePlayerInfo[] = [];
  private callbacks: OnlineEventCallback = {};

  // Heartbeat & keep-alive
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastSeenMap: Map<string, number> = new Map();
  private hostLastSeen: number = Date.now();

  // Reconnection grace period
  private reconnectInterval: ReturnType<typeof setInterval> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private currentGameState: GameState | null = null;
  private isIntentionalExit: boolean = false;

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

  public getLobbyPlayers(): OnlinePlayerInfo[] {
    return this.lobbyPlayers;
  }

  public setGameState(state: GameState) {
    this.currentGameState = state;
    this.saveActiveSession();
  }

  public saveActiveSession() {
    if (!this.roomCode || !this.role) return;
    try {
      const session: ActiveOnlineSession = {
        roomCode: this.roomCode,
        role: this.role,
        myPlayerId: this.myPlayerId,
        myName: this.myName,
        myColor: this.myColor,
        myHat: this.myHat,
        lastState: this.currentGameState || undefined,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
  }

  public getSavedSession(): ActiveOnlineSession | null {
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

  public clearSession() {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // ===================== HEARTBEAT (PING-PONG) =====================
  private startHeartbeat() {
    this.stopHeartbeat();
    this.hostLastSeen = Date.now();

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      if (this.role === 'host') {
        // Host pings all connected clients & purges inactive ones
        const deadPeers: string[] = [];

        for (const [peerId, conn] of this.connections.entries()) {
          if (conn.open) {
            try {
              conn.send({ type: 'PING' });
            } catch {
              deadPeers.push(peerId);
            }
          }

          const lastSeen = this.lastSeenMap.get(peerId) || now;
          if (now - lastSeen > 5000) {
            deadPeers.push(peerId);
          }
        }

        // Clean up dead peers immediately so room becomes available
        if (deadPeers.length > 0) {
          deadPeers.forEach((pId) => {
            const conn = this.connections.get(pId);
            if (conn) {
              try { conn.close(); } catch {}
            }
            this.connections.delete(pId);
            this.lastSeenMap.delete(pId);
          });

          const prevCount = this.lobbyPlayers.length;
          this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.esAnfitrion || !deadPeers.includes(p.peerId));
          this.lobbyPlayers.forEach((p, idx) => { p.id = idx; });

          if (this.lobbyPlayers.length !== prevCount) {
            this.broadcastLobbyUpdate();
          }
        }
      } else if (this.role === 'client') {
        // Client pings host
        if (this.hostConnection && this.hostConnection.open) {
          try {
            this.hostConnection.send({ type: 'PING' });
          } catch {
            // will detect on timeout
          }
        }

        // Check if host went quiet (only in active unfinished game and not intentional exit)
        if (
          !this.isIntentionalExit &&
          this.currentGameState &&
          !this.currentGameState.terminada &&
          now - this.hostLastSeen > 5500
        ) {
          this.startHostDisconnectGracePeriod(formatRoomPeerId(this.roomCode));
        }
      }
    }, 2000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ===================== HOST CREATION =====================
  public async createRoom(
    code: string,
    hostName: string,
    color: string,
    hat: HatType,
    maxPlayers: 2 | 4 = 2
  ): Promise<string> {
    this.cleanUp();
    this.isIntentionalExit = false;
    this.role = 'host';
    this.roomCode = code.toUpperCase();
    this.maxPlayers = maxPlayers;
    this.myPlayerId = 0;
    this.myName = hostName.trim() || 'Anfitrión';
    this.myColor = color;
    this.myHat = hat;

    const hostPeerId = formatRoomPeerId(this.roomCode);

    return new Promise((resolve, reject) => {
      this.peer = new Peer(hostPeerId, { debug: 1 });

      this.peer.on('open', (id) => {
        this.lobbyPlayers = [
          {
            id: 0,
            peerId: id,
            nombre: this.myName,
            color: this.myColor,
            hat: this.myHat,
            listo: true,
            conectado: true,
            esAnfitrion: true,
          },
        ];
        this.saveActiveSession();
        this.startHeartbeat();

        if (this.callbacks.onLobbyUpdate) {
          this.callbacks.onLobbyUpdate(this.lobbyPlayers, this.maxPlayers);
        }
        resolve(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingClientConnection(conn);
      });

      this.peer.on('error', (err) => {
        if (this.callbacks.onError) {
          this.callbacks.onError(`Error en la sala: ${err.message}`);
        }
        reject(err);
      });
    });
  }

  private handleIncomingClientConnection(conn: DataConnection) {
    const setup = () => {
      this.connections.set(conn.peer, conn);
      this.lastSeenMap.set(conn.peer, Date.now());

      conn.on('data', (raw: unknown) => {
        const msg = raw as OnlineMessage;
        this.handleMessageFromClient(conn, msg);
      });

      conn.on('close', () => {
        this.connections.delete(conn.peer);
        this.lastSeenMap.delete(conn.peer);

        if (this.isIntentionalExit || !this.role) return;

        // If game is in progress and not finished: start 10s abandonment countdown
        if (this.currentGameState && !this.currentGameState.terminada) {
          this.startPeerDisconnectGracePeriod();
        } else {
          // In lobby or game already finished: remove to free room slot immediately
          const prevCount = this.lobbyPlayers.length;
          this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.peerId !== conn.peer);
          this.lobbyPlayers.forEach((p, idx) => { p.id = idx; });

          if (this.lobbyPlayers.length !== prevCount) {
            this.broadcastLobbyUpdate();
          }
        }
      });
    };

    if (conn.open) {
      setup();
    } else {
      conn.on('open', setup);
    }
  }

  private handleMessageFromClient(conn: DataConnection, msg: OnlineMessage) {
    this.lastSeenMap.set(conn.peer, Date.now());

    if (msg.type === 'PING') {
      try { conn.send({ type: 'PONG' }); } catch {}
      return;
    }
    if (msg.type === 'PONG') {
      return;
    }

    if (msg.type === 'JOIN_REQUEST') {
      // If room is full, reject
      if (this.lobbyPlayers.length >= this.maxPlayers) {
        conn.send({
          type: 'HOST_DISCONNECT_WARNING',
          tiempoRestante: 0,
        });
        conn.close();
        return;
      }

      const newId = this.lobbyPlayers.length;
      const playerColors = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66'];
      const playerHats: HatType[] = ['corona', 'pompon', 'antena', 'brote'];

      const newPlayer: OnlinePlayerInfo = {
        id: newId,
        peerId: conn.peer,
        nombre: msg.nombre.trim() || `Jugador ${newId + 1}`,
        color: msg.color || playerColors[newId] || '#4dabf7',
        hat: msg.hat || playerHats[newId] || 'pompon',
        listo: true,
        conectado: true,
        esAnfitrion: false,
      };

      this.lobbyPlayers.push(newPlayer);
      this.broadcastLobbyUpdate();

      // AUTO-START INSTANTLY when lobby reaches required capacity!
      if (this.lobbyPlayers.length >= this.maxPlayers) {
        if (this.callbacks.onLobbyFull) {
          this.callbacks.onLobbyFull(this.maxPlayers);
        }
      }
    } else if (msg.type === 'PLAYER_ACTION') {
      if (this.callbacks.onClientAction) {
        this.callbacks.onClientAction(msg.jugadorId, msg.accion, msg.payload);
      }
    } else if (msg.type === 'REACTION') {
      this.broadcast(msg);
      if (this.callbacks.onReaction) {
        this.callbacks.onReaction(msg.jugadorId, msg.emoji);
      }
    }
  }

  private broadcastLobbyUpdate() {
    const updateMsg: OnlineMessage = {
      type: 'LOBBY_UPDATE',
      roomCode: this.roomCode,
      maxJugadores: this.maxPlayers,
      jugadores: this.lobbyPlayers,
    };
    this.broadcast(updateMsg);
    if (this.callbacks.onLobbyUpdate) {
      this.callbacks.onLobbyUpdate(this.lobbyPlayers, this.maxPlayers);
    }
  }

  public broadcast(msg: OnlineMessage) {
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch {
          // ignore
        }
      }
    }
  }

  public startGameAsHost(initialState: GameState) {
    this.currentGameState = initialState;
    this.saveActiveSession();
    const startMsg: OnlineMessage = {
      type: 'START_GAME',
      config: initialState.config,
      initialState,
    };
    this.broadcast(startMsg);
  }

  public syncGameStateFromHost(state: GameState) {
    this.currentGameState = state;
    this.saveActiveSession();
    this.broadcast({
      type: 'STATE_SYNC',
      state,
    });
  }

  // ===================== CLIENT JOINING =====================
  public async joinRoom(
    code: string,
    playerName: string,
    color: string,
    hat: HatType
  ): Promise<void> {
    this.cleanUp();
    this.isIntentionalExit = false;
    this.role = 'client';
    this.roomCode = code.toUpperCase().trim();
    this.myName = playerName.trim() || 'Invitado';
    this.myColor = color;
    this.myHat = hat;

    const hostPeerId = formatRoomPeerId(this.roomCode);

    return new Promise((resolve, reject) => {
      let isSettled = false;
      this.peer = new Peer({ debug: 1 });

      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.cleanUp();
          reject(new Error('Sala no disponible'));
        }
      }, 2500);

      this.peer.on('open', () => {
        this.connectToHost(
          hostPeerId,
          () => {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeoutId);
              this.startHeartbeat();
              resolve();
            }
          },
          (err) => {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeoutId);
              reject(err);
            }
          }
        );
      });

      this.peer.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      });
    });
  }

  // Auto-Matchmaking: Fast join or become host
  public async joinOrHostPublicRoom(
    code: string,
    playerName: string,
    color: string,
    hat: HatType,
    maxPlayers: 2 | 4 = 2
  ): Promise<'host' | 'client'> {
    try {
      await this.joinRoom(code, playerName, color, hat);
      return 'client';
    } catch {
      await this.createRoom(code, playerName, color, hat, maxPlayers);
      return 'host';
    }
  }

  private connectToHost(
    hostPeerId: string,
    onSuccess?: () => void,
    onError?: (e: unknown) => void
  ) {
    if (!this.peer) return;

    this.hostConnection = this.peer.connect(hostPeerId, {
      reliable: true,
    });

    const onOpen = () => {
      this.stopReconnectGracePeriod();
      this.hostLastSeen = Date.now();

      this.hostConnection?.send({
        type: 'JOIN_REQUEST',
        nombre: this.myName,
        color: this.myColor,
        hat: this.myHat,
      });

      this.saveActiveSession();

      if (this.callbacks.onHostReconnected) {
        this.callbacks.onHostReconnected();
      }

      if (onSuccess) onSuccess();
    };

    if (this.hostConnection.open) {
      onOpen();
    } else {
      this.hostConnection.on('open', onOpen);
    }

    this.hostConnection.on('data', (raw: unknown) => {
      const msg = raw as OnlineMessage;
      this.handleMessageFromHost(msg);
    });

    this.hostConnection.on('close', () => {
      if (
        this.isIntentionalExit ||
        !this.role ||
        !this.currentGameState ||
        this.currentGameState.terminada
      ) {
        return;
      }
      this.startHostDisconnectGracePeriod(hostPeerId);
    });

    this.hostConnection.on('error', (err) => {
      if (onError) onError(err);
    });
  }

  private handleMessageFromHost(msg: OnlineMessage) {
    this.hostLastSeen = Date.now();

    if (msg.type === 'PING') {
      try { this.hostConnection?.send({ type: 'PONG' }); } catch {}
      return;
    }
    if (msg.type === 'PONG') {
      return;
    }

    if (msg.type === 'LOBBY_UPDATE') {
      this.roomCode = msg.roomCode;
      this.maxPlayers = msg.maxJugadores;
      this.lobbyPlayers = msg.jugadores;

      const me = msg.jugadores.find((p) => p.peerId === this.peer?.id);
      if (me) {
        this.myPlayerId = me.id;
        this.myColor = me.color;
        this.myHat = me.hat;
      }

      this.saveActiveSession();

      if (this.callbacks.onLobbyUpdate) {
        this.callbacks.onLobbyUpdate(msg.jugadores, msg.maxJugadores);
      }
    } else if (msg.type === 'START_GAME') {
      // Ensure myPlayerId and client role are correctly applied
      const clientState: GameState = {
        ...msg.initialState,
        miJugadorId: this.myPlayerId,
        esAnfitrion: false,
        modoOnline: true,
      };
      this.currentGameState = clientState;
      this.saveActiveSession();
      if (this.callbacks.onGameStart) {
        this.callbacks.onGameStart(clientState);
      }
    } else if (msg.type === 'STATE_SYNC') {
      const clientState: GameState = {
        ...msg.state,
        miJugadorId: this.myPlayerId,
        esAnfitrion: false,
        modoOnline: true,
      };
      this.currentGameState = clientState;
      this.saveActiveSession();
      if (this.callbacks.onStateSync) {
        this.callbacks.onStateSync(clientState);
      }
    } else if (msg.type === 'REACTION') {
      if (this.callbacks.onReaction) {
        this.callbacks.onReaction(msg.jugadorId, msg.emoji);
      }
    } else if (msg.type === 'HOST_RESUMED') {
      this.stopReconnectGracePeriod();
      const clientState: GameState = {
        ...msg.state,
        miJugadorId: this.myPlayerId,
        esAnfitrion: false,
        modoOnline: true,
      };
      this.currentGameState = clientState;
      if (this.callbacks.onStateSync) {
        this.callbacks.onStateSync(clientState);
      }
      if (this.callbacks.onHostReconnected) {
        this.callbacks.onHostReconnected();
      }
    }
  }

  // ===================== GRACE PERIOD ON DISCONNECT (10 SECONDS) =====================
  private startHostDisconnectGracePeriod(hostPeerId: string) {
    if (this.countdownInterval) return; // already active

    let secondsLeft = 10;

    if (this.callbacks.onHostDisconnected) {
      this.callbacks.onHostDisconnected(secondsLeft);
    }

    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);

    this.countdownInterval = setInterval(() => {
      secondsLeft -= 1;
      if (this.callbacks.onHostDisconnected) {
        this.callbacks.onHostDisconnected(secondsLeft);
      }

      if (secondsLeft <= 0) {
        this.stopReconnectGracePeriod();
        if (this.callbacks.onDisconnectTimeout) {
          this.callbacks.onDisconnectTimeout();
        }
      }
    }, 1000);

    this.reconnectInterval = setInterval(() => {
      if (this.peer && !this.peer.destroyed) {
        try {
          this.connectToHost(hostPeerId);
        } catch {
          // retry
        }
      }
    }, 2000);
  }

  private startPeerDisconnectGracePeriod() {
    if (this.countdownInterval) return; // already active

    let secondsLeft = 10;

    if (this.callbacks.onHostDisconnected) {
      this.callbacks.onHostDisconnected(secondsLeft);
    }

    if (this.countdownInterval) clearInterval(this.countdownInterval);

    this.countdownInterval = setInterval(() => {
      secondsLeft -= 1;
      if (this.callbacks.onHostDisconnected) {
        this.callbacks.onHostDisconnected(secondsLeft);
      }

      if (secondsLeft <= 0) {
        this.stopReconnectGracePeriod();
        if (this.callbacks.onDisconnectTimeout) {
          this.callbacks.onDisconnectTimeout();
        }
      }
    }, 1000);
  }

  private stopReconnectGracePeriod() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    if (this.callbacks.onHostDisconnected) {
      this.callbacks.onHostDisconnected(null as unknown as number);
    }
  }

  // ===================== ACTION DISPATCH =====================
  public sendAction(
    accion: 'mover' | 'muro' | 'pasar',
    payload: { destino?: Coord; orientacion?: WallOrientation; r?: number; c?: number }
  ) {
    const msg: OnlineMessage = {
      type: 'PLAYER_ACTION',
      jugadorId: this.myPlayerId,
      accion,
      payload,
    };

    if (this.role === 'client') {
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send(msg);
      }
    } else if (this.role === 'host') {
      if (this.callbacks.onClientAction) {
        this.callbacks.onClientAction(this.myPlayerId, accion, payload);
      }
    }
  }

  public sendReaction(emoji: string) {
    const msg: OnlineMessage = {
      type: 'REACTION',
      jugadorId: this.myPlayerId,
      emoji,
    };
    if (this.role === 'client') {
      this.hostConnection?.send(msg);
    } else if (this.role === 'host') {
      this.broadcast(msg);
    }
    if (this.callbacks.onReaction) {
      this.callbacks.onReaction(this.myPlayerId, emoji);
    }
  }

  public cleanUp() {
    this.isIntentionalExit = true;
    this.stopHeartbeat();
    this.stopReconnectGracePeriod();
    this.currentGameState = null;
    try {
      localStorage.removeItem('muros_active_session');
    } catch {}

    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch {
        // ignore
      }
    }
    this.connections.clear();
    this.lastSeenMap.clear();

    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch {
        // ignore
      }
      this.hostConnection = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }

    this.role = null;
    this.roomCode = '';
    this.lobbyPlayers = [];
  }
}

export const onlineService = new OnlineManager();
