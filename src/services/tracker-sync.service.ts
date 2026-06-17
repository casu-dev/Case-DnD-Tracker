import { Injectable, signal } from '@angular/core';
import { TrackerData, WoundInfo } from '../models/tracker.model';

// The new data structure received from the 5e.tools peerjs connection
interface RawStatCol {
  name: string;
  isInit: boolean;
  isPlayerVisible: boolean;
}

interface RawCondition {
  // A condition from 5e.tools contains an entity with the display info
  entity: {
    name: string;
    color: string;
    turns: number | null;
  };
}

interface RawStatePayload {
  round: number;
  rows: RawCreatureRow[];
  statsCols: RawStatCol[];
}

interface RawCreatureRow {
  name: string | null;
  initiative: number | null;
  isActive: boolean;
  conditions: RawCondition[];
  hpWoundLevel: number;
  rowStatColData: string[];
  hpCurrent: number | null;
  hpMax: number | null;
}

// The wrapper used by 5e.tools to send data
interface PeerPacket {
  head?: {
    type?: string;
    version?: string;
  };
  data?: {
    type?: string;
    payload?: RawStatePayload;
  };
}

// Minimal type shapes for the PeerJS API we use. PeerJS is loaded from a CDN script tag.
interface PeerInstance {
  on(event: string, cb: (...args: any[]) => void): void;
  off(event: string): void;
  connect(id: string, opts: { reliable: boolean }): DataConnection | null;
  destroyed: boolean;
  destroy(): void;
}

interface DataConnection {
  on(event: string, cb: (...args: any[]) => void): void;
  close(): void;
}

declare const Peer: new () => PeerInstance;

export const ROOM_ID_STORAGE_KEY = '5e-tracker-room-id';
const ROOM_ID_URL_PREFIX = '#v1:';
const RECONNECT_TIMEOUT_MS = 10_000;

@Injectable({
  providedIn: 'root',
})
export class TrackerSyncService {
  private peer: PeerInstance | null = null;
  private connection: DataConnection | null = null;
  private lastRoomId: string | null = null;
  private reconnectTimeout: any = null; // For handling reconnect timeouts

  readonly trackerData = signal<TrackerData | null>(null);
  readonly connectionState = signal<'disconnected' | 'connecting' | 'connected' | 'error' | 'waiting'>('disconnected');
  readonly errorMessage = signal<string | null>(null);
  readonly reconnectingAttempt = signal<boolean>(false);

  constructor() {
    // Prioritize Room ID from URL fragment
    const roomIdFromUrl = this.getRoomIdFromUrl();
    if (roomIdFromUrl) {
      this.connect(roomIdFromUrl);
      return; // Stop here if we have a URL-based ID
    }

    // Fallback to local storage for existing sessions
    const savedRoomId = localStorage.getItem(ROOM_ID_STORAGE_KEY);
    if (savedRoomId) {
      this.connect(savedRoomId);
    }
  }

  getRoomIdFromUrl(): string | null {
    const hash = window.location.hash;
    if (hash.startsWith(ROOM_ID_URL_PREFIX)) {
      return hash.substring(ROOM_ID_URL_PREFIX.length);
    }
    return null;
  }

  connect(roomId: string, isReconnectAttempt = false): void {
    if (!isReconnectAttempt) {
      this.lastRoomId = roomId;
      // Store in both local storage (as fallback) and URL fragment (as primary)
      localStorage.setItem(ROOM_ID_STORAGE_KEY, roomId);
      window.location.hash = `${ROOM_ID_URL_PREFIX.substring(1)}${roomId}`;
      this.connectionState.set('connecting');
      this.errorMessage.set(null);
      this.trackerData.set(null);
    }
    
    // Clean up any existing connection before starting a new one.
    this.cleanup();
    
    try {
      this.peer = new Peer();

      this.peer.on('open', (id: string) => {
        console.log('PeerJS client initialized with ID:', id);

        this.connection = this.peer!.connect(this.lastRoomId!, { reliable: true });

        if (!this.connection) {
          const message = 'Failed to initiate connection. The Room ID might be invalid or the peer server is unreachable.';
          if (isReconnectAttempt) {
            this.handleReconnectFailure(message);
          } else {
            this.errorMessage.set(message);
            this.connectionState.set('error');
          }
          return;
        }

        // --- Setup DataConnection Listeners ---
        this.connection.on('open', () => {
          console.log('PeerJS data connection is open.');
          if (isReconnectAttempt) {
            this.handleReconnectSuccess();
          }
          this.connectionState.set('waiting');
        });

        this.connection.on('data', (packet: PeerPacket) => {
           if (this.reconnectingAttempt()) {
             this.handleReconnectSuccess();
           }
          // 5e.tools wraps data in a packet. We need to unwrap it.
          if (packet?.head?.type === 'server' && packet?.data?.type === 'state' && packet?.data?.payload) {
            const rawData = packet.data.payload;
            const mappedData = this.mapStatePayloadToTrackerData(rawData);
            this.trackerData.set(mappedData);
            if (this.connectionState() !== 'connected') {
              this.connectionState.set('connected');
            }
          } else {
            console.warn("Received unexpected data format from peer:", packet);
          }
        });

        this.connection.on('close', () => {
          console.log('PeerJS connection closed.');
          this.handleConnectionLoss('Connection to the DM was closed.');
        });

        this.connection.on('error', (err: any) => {
          console.error('PeerJS connection error:', err);
          this.handleConnectionLoss(`Connection failed: ${err.message || 'An unknown error occurred.'}`);
        });
      });

      // --- Setup Peer Listeners ---
      this.peer.on('error', (err: any) => {
        console.error('PeerJS peer error:', err);
        let message = 'A peer-to-peer error occurred.';
        if (err.type === 'peer-unavailable') {
          message = 'Could not find a DM with that Room ID. Please double-check the ID and ensure the DM is still hosting.';
        } else if (err.type === 'network') {
          message = 'Network error. Please check your internet connection and firewall settings.';
        } else {
            message = `Error: ${err.message || err.type}`;
        }
        
        if (isReconnectAttempt) {
            this.handleReconnectFailure(message);
        } else {
            this.errorMessage.set(message);
            this.connectionState.set('error');
        }
      });

      this.peer.on('disconnected', () => {
        console.log('PeerJS disconnected from the signaling server.');
        this.handleConnectionLoss('Lost connection to the signaling server.');
      });

    } catch (e: any) {
      console.error('Failed to initialize PeerJS:', e);
      const message = 'Failed to initialize connection service. Your browser might not support WebRTC.';
      if (isReconnectAttempt) {
        this.handleReconnectFailure(message);
      } else {
        this.connectionState.set('error');
        this.errorMessage.set(message);
      }
    }
  }

  disconnect(): void {
    localStorage.removeItem(ROOM_ID_STORAGE_KEY);
    
    // Clear the URL fragment without adding to history or reloading
    if (window.history.pushState) {
        history.pushState("", document.title, window.location.pathname + window.location.search);
    } else {
        // Fallback for older browsers
        window.location.hash = '';
    }

    this.lastRoomId = null;
    this.cleanup();
    this.trackerData.set(null);
    this.connectionState.set('disconnected');
    this.errorMessage.set(null);
  }

  private handleConnectionLoss(reason: string): void {
    // If we're already trying to reconnect, do nothing to prevent a loop.
    if (this.reconnectingAttempt()) {
      console.log('Connection loss detected while already reconnecting. Ignoring to prevent loop.');
      return;
    }

    this.cleanup();

    if (this.trackerData() && this.lastRoomId) {
      // We were in a session, so attempt a single reconnect.
      this.reconnectingAttempt.set(true);
      this.connectionState.set('waiting'); // Visually, we're waiting for something
      console.log(`Connection lost: "${reason}". Attempting a single reconnect...`);
      
      // Set a timeout for the reconnect attempt.
      this.reconnectTimeout = setTimeout(() => {
        // The timeout will only trigger a failure if we are still in the reconnecting state.
        if (this.reconnectingAttempt()) {
          console.log('Reconnect attempt timed out after 10 seconds.');
          this.handleReconnectFailure('Connection attempt timed out');
        }
      }, RECONNECT_TIMEOUT_MS);

      this.connect(this.lastRoomId, true);
    } else {
      // We were not in a session, just show an error on the connection page.
      this.connectionState.set('error');
      this.errorMessage.set(reason);
    }
  }
  
  private handleReconnectSuccess(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectingAttempt.set(false);
    console.log('Reconnect successful!');
  }

  private handleReconnectFailure(reason: string): void {
    // This function can be called from multiple places (peer error, timeout).
    // Only act if we are actually in a reconnecting state to avoid race conditions.
    if (!this.reconnectingAttempt()) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log('Single reconnect attempt failed:', reason);
    this.reconnectingAttempt.set(false);
    this.errorMessage.set(`Reconnect failed: ${reason}. Please connect manually.`);
    this.disconnect(); // This resets state and brings user to the connection page.
  }

  private cleanup(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.off('open');
      this.peer.off('error');
      this.peer.off('disconnected');
      if (!this.peer.destroyed) {
        this.peer.destroy();
      }
      this.peer = null;
    }
  }

  private getWoundLevelInfo(level: number): WoundInfo | null {
    if (level < 0) return null; // Players are < 0 and don't show wound levels.
    switch (level) {
      case 0: return null; // Healthy
      case 1: return { 
        iconClass: 'fas fa-droplet', 
        colorClass: 'text-amber-600', 
        title: 'Hurt',
        isDefeated: false 
      };
      case 2: return { 
        iconClass: 'fas fa-burst', 
        colorClass: 'text-red-700', 
        title: 'Bloodied',
        isDefeated: false 
      };
      case 3: return { 
        iconClass: 'fas fa-skull-crossbones', 
        colorClass: 'text-stone-500', 
        title: 'Defeated',
        isDefeated: true
      };
      default: return null;
    }
  }

  private mapStatePayloadToTrackerData(payload: RawStatePayload): TrackerData {
    // The rows from the payload are already in the correct turn order,
    // including any tie-breakers the DM has resolved. We should not re-sort them.
    const creaturesInOrder = payload.rows
      .filter((row): row is RawCreatureRow & { name: string } => !!row.name);

    return {
      round: payload.round,
      creatures: creaturesInOrder.map((row) => {
        let isPlayer = false, isNpc = false, isBoss = false;
        let iconOverrideClass: string | null = null;
        let iconOverrideColor: string | null = null;
        const statusEffects: { name: string; color: string; turns: number | null }[] = [];

        for (const c of row.conditions ?? []) {
          const nameLower = c.entity.name.toLowerCase();
          if (nameLower === 'player') { isPlayer = true; continue; }
          if (nameLower === 'npc') { isNpc = true; continue; }
          if (nameLower === 'boss') { isBoss = true; continue; }
          if (nameLower.startsWith('fa-')) {
            iconOverrideClass = c.entity.name;
            iconOverrideColor = c.entity.color;
            continue;
          }
          statusEffects.push({ name: c.entity.name, color: c.entity.color, turns: c.entity.turns });
        }

        return {
          id: `${row.name}-${row.initiative}`,
          name: row.name,
          initiative: row.initiative,
          hpCurrent: row.hpCurrent,
          hpMax: row.hpMax,
          isPlayer,
          isNpc,
          isBoss,
          isActive: row.isActive,
          iconOverrideClass,
          iconOverrideColor,
          statusEffects,
          woundInfo: this.getWoundLevelInfo(row.hpWoundLevel),
        };
      }),
    };
  }
}