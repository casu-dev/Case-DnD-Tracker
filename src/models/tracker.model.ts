export interface StatusEffect {
  name: string;
  color: string;
}

export interface WoundInfo {
  text: string;
  colorClass: string;
  icon: string; // Font Awesome icon class name
}

export interface Creature {
  id: string;
  name: string;
  initiative: number | null;
  isPlayer: boolean;
  isActive: boolean; // Is it this creature's turn?
  statusEffects: StatusEffect[];
  woundInfo: WoundInfo | null;
}

export interface TrackerData {
  round: number;
  creatures: Creature[];
}