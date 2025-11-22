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
    const savedRoomId = localStorage.getItem(ROOM_ID_STORAGE_KEY);
    if (savedRoomId) {
      this.connect(savedRoomId);
    }
  }

  connect(roomId: string, isRetry = false): void {
    if (!isRetry) {
      this.lastRoomId = roomId;
      this.currentRetries = 0;
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
      localStorage.setItem(ROOM_ID_STORAGE_KEY, roomId);
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
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    this.cleanup();

    if (this.currentRetries < this.maxRetries && this.lastRoomId) {
      this.currentRetries++;
      this.connectionState.set('error'); // Show an error state during retry wait
      
      // Use exponential backoff for retries
      const waitTime = this.retryDelay * Math.pow(2, this.currentRetries - 1);
      const waitSeconds = Math.round(waitTime / 1000);

      this.errorMessage.set(
        `Connection failed. Retrying in ${waitSeconds}s... (Attempt ${this.currentRetries}/${this.maxRetries})`
      );
      
      console.log(`Scheduling reconnect in ${waitSeconds} seconds.`);
      this.retryTimeout = setTimeout(() => {
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
        icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z'
      };
      case 1: return { 
        text: 'Hurt', 
        colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'
      };
      case 2: return { 
        text: 'Bloodied', 
        colorClass: 'bg-orange-100 text-orange-800 border-orange-300',
        icon: 'M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 0 1-1.161.886l-.143.048a1.12 1.12 0 0 0-.536.13l-.25.1c-.538.214-1.055.214-1.593 0l-.25-.1a1.12 1.12 0 0 0-.536-.13l-.143-.048a2.25 2.25 0 0 1-1.161-.886l-.51-.766c-.318-.48-.226-1.121.216-1.49l1.068-.89a1.125 1.125 0 0 0 .405-.864v-.568a3 3 0 0 1 3.032-3.032Zm-3.032 9.043c.205 0 .39.02.57.056l.106.022c.18.036.35.086.51.15l.64.256a2.25 2.25 0 0 0 2.132 0l.64-.256c.16-.064.33-.114.51-.15l.106-.022a4.493 4.493 0 0 1 5.12 4.493 2.25 2.25 0 0 1-2.25 2.25h-6.75a2.25 2.25 0 0 1-2.25-2.25 4.493 4.493 0 0 1 5.12-4.493Z'
      };
      case 3: return { 
        text: 'Defeated', 
        colorClass: 'bg-stone-200 text-stone-600 border-stone-400',
        icon: 'M12.25,2A10.25,10.25,0,0,0,2,12.25C2,17.77,6.48,22.25,12,22.25,17.52,22.25,22,17.77,22,12.25A10.25,10.25,0,0,0,12.25,2M9,9A2,2,0,0,1,11,11A2,2,0,0,1,9,13A2,2,0,0,1,7,11A2,2,0,0,1,9,9M15,9A2,2,0,0,1,17,11A2,2,0,0,1,15,13A2,2,0,0,1,13,11A2,2,0,0,1,15,9M12,16A4,4,0,0,1,8,20H16A4,4,0,0,1,12,16Z'
      };
      default: return null;
    }
  }

  private mapStatePayloadToTrackerData(payload: RawStatePayload): TrackerData {
    const validCreatures = payload.rows
      .filter((row): row is RawCreatureRow & { name: string } => !!row.name);

    const sortedCreatures = [...validCreatures].sort((a, b) => {
      if (a.initiative === null && b.initiative !== null) return 1;
      if (a.initiative !== null && b.initiative === null) return -1;
      if (a.initiative === null && b.initiative === null) return a.name.localeCompare(b.name);
      if (a.initiative !== b.initiative) {
        return b.initiative! - a.initiative!;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      round: payload.round,
      creatures: sortedCreatures.map((row, index) => ({
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
