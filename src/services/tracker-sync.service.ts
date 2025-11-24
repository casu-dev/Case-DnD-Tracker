import { Injectable, signal } from '@angular/core';
import { TrackerData, WoundInfo } from '../models/tracker.model';

// The new data structure received from the 5e.tools peerjs connection
interface RawStatCol {
  name: string;
  isInit: boolean;
  isPlayerVisible: boolean;
}

interface RawCondition {
  name: string;
  color: string;
  // The 'effect' property from the payload is ignored as it's not needed for display
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

// PeerJS is loaded from a script tag in index.html, so we declare it here to satisfy TypeScript.
declare const Peer: any;

export const ROOM_ID_STORAGE_KEY = '5e-tracker-room-id';

@Injectable({
  providedIn: 'root',
})
export class TrackerSyncService {
  private peer: any | null = null;
  private connection: any | null = null;
  private lastRoomId: string | null = null;

  // Retry mechanism properties
  private retryTimeout: any | null = null;
  private readonly maxRetries = 5;
  private currentRetries = 0;
  private readonly retryDelay = 3000; // 3 seconds

  readonly trackerData = signal<TrackerData | null>(null);
  readonly connectionState = signal<'disconnected' | 'connecting' | 'connected' | 'error' | 'waiting'>('disconnected');
  readonly errorMessage = signal<string | null>(null);

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

  private getRoomIdFromUrl(): string | null {
    const hash = window.location.hash;
    // The format is #v1:token-id
    if (hash && hash.startsWith('#v1:')) {
      return hash.substring(4);
    }
    return null;
  }

  connect(roomId: string, isRetry = false): void {
    if (!isRetry) {
      this.lastRoomId = roomId;
      this.currentRetries = 0;
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
      // Store in both local storage (as fallback) and URL fragment (as primary)
      localStorage.setItem(ROOM_ID_STORAGE_KEY, roomId);
      window.location.hash = `v1:${roomId}`;
    }

    // Clean up any existing connection before starting a new one.
    this.cleanup();

    this.connectionState.set('connecting');
    this.errorMessage.set(isRetry ? `Reconnecting... (Attempt ${this.currentRetries}/${this.maxRetries})` : null);
    this.trackerData.set(null);

    try {
      this.peer = new Peer();

      this.peer.on('open', (id: string) => {
        console.log('PeerJS client initialized with ID:', id);

        this.connection = this.peer.connect(this.lastRoomId, { reliable: true });

        if (!this.connection) {
          this.errorMessage.set('Failed to initiate connection. The Room ID might be invalid or the peer server is unreachable.');
          this.scheduleReconnect();
          return;
        }

        // --- Setup DataConnection Listeners ---
        this.connection.on('open', () => {
          console.log('PeerJS data connection is open.');
          this.connectionState.set('waiting');
        });

        this.connection.on('data', (packet: PeerPacket) => {
          // On successful data, reset retry counter as the connection is now stable.
          if (this.currentRetries > 0) {
            console.log("Connection re-established successfully.");
            this.currentRetries = 0;
            // If we re-established connection, cancel any pending reconnect timeout.
            if (this.retryTimeout) {
              clearTimeout(this.retryTimeout);
              this.retryTimeout = null;
            }
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
          this.errorMessage.set('Connection to the DM was closed.');
          this.scheduleReconnect();
        });

        this.connection.on('error', (err: any) => {
          console.error('PeerJS connection error:', err);
          this.errorMessage.set(`Connection failed: ${err.message || 'An unknown error occurred.'}`);
          this.scheduleReconnect();
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
        this.errorMessage.set(message);
        this.scheduleReconnect();
      });

      this.peer.on('disconnected', () => {
        console.log('PeerJS disconnected from the signaling server.');
        this.errorMessage.set('Lost connection to the signaling server.');
        this.scheduleReconnect();
      });

    } catch (e: any) {
      console.error('Failed to initialize PeerJS:', e);
      this.connectionState.set('error');
      this.errorMessage.set('Failed to initialize connection service. Your browser might not support WebRTC.');
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

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.lastRoomId = null;
    this.currentRetries = 0;
    this.cleanup();
    this.trackerData.set(null);
    this.connectionState.set('disconnected');
    this.errorMessage.set(null);
  }

  private scheduleReconnect(): void {
    // If a reconnect is already scheduled, don't queue another one. This prevents
    // a cascade of errors on mobile resume from creating a loop.
    if (this.retryTimeout) {
      console.log('A reconnect attempt is already pending. Ignoring subsequent triggers.');
      return;
    }
    this.cleanup();

    if (this.currentRetries < this.maxRetries && this.lastRoomId) {
      this.currentRetries++;
      this.connectionState.set('error'); // Show an error state during retry wait

      // Use exponential backoff for retries
      const waitTime = this.retryDelay * Math.pow(2, this.currentRetries - 1);
      const waitSeconds = Math.round(waitTime / 1000);

      this.errorMessage.set(
        `Connection lost. Retrying in ${waitSeconds}s... (Attempt ${this.currentRetries}/${this.maxRetries})`
      );

      console.log(`Scheduling reconnect in ${waitSeconds} seconds.`);
      this.retryTimeout = setTimeout(() => {
        this.retryTimeout = null; // Clear the lock before the next attempt.
        if (this.lastRoomId) {
          this.connect(this.lastRoomId, true);
        }
      }, waitTime);
    } else {
      console.log('Max retries reached. Giving up.');
      this.connectionState.set('error');
      this.errorMessage.set('Connection failed after multiple retries. Please check the Room ID and your connection, then connect manually.');
    }
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
      case 0: return {
        text: 'Healthy',
        colorClass: 'bg-green-100 text-green-800 border-green-300',
        icon: 'fas fa-heart'
      };
      case 1: return {
        text: 'Hurt',
        colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        icon: 'fas fa-triangle-exclamation'
      };
      case 2: return {
        text: 'Bloodied',
        colorClass: 'bg-orange-100 text-orange-800 border-orange-300',
        icon: 'fas fa-droplet'
      };
      case 3: return {
        text: 'Defeated',
        colorClass: 'bg-stone-200 text-stone-600 border-stone-400',
        icon: 'fas fa-skull-crossbones'
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
      creatures: creaturesInOrder.map((row, index) => ({
        id: `${row.name}-${row.initiative}-${index}`,
        name: row.name,
        initiative: row.initiative,
        isPlayer: row.hpWoundLevel === -1,
        isActive: row.isActive,
        statusEffects: (row.conditions || []).map((condition) => ({
          name: condition.name,
          color: condition.color,
        })),
        woundInfo: this.getWoundLevelInfo(row.hpWoundLevel),
      })),
    };
  }
}
