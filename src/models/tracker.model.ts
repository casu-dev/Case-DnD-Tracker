export interface StatusEffect {
  name: string;
  color: string;
  turns: number | null;
}

export interface WoundInfo {
  iconClass: string;
  colorClass: string;
  title: string;
  isDefeated: boolean;
}

export interface Creature {
  id: string;
  name: string;
  initiative: number | null;
  hpCurrent: number | null;
  hpMax: number | null;
  isPlayer: boolean;
  isNpc: boolean;
  isActive: boolean; // Is it this creature's turn?
  statusEffects: StatusEffect[];
  woundInfo: WoundInfo | null;
}

export interface TrackerData {
  round: number;
  creatures: Creature[];
}