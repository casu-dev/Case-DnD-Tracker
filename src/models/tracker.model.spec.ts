import { describe, it, expect } from 'vitest';
import { StatusEffect, WoundInfo, Creature, TrackerData } from './tracker.model';

describe('tracker.model types', () => {
  it('should accept valid StatusEffect', () => {
    const effect: StatusEffect = {
      name: 'Stunned',
      color: '#ff0000',
      turns: 2
    };
    expect(effect.name).toBe('Stunned');
    expect(effect.turns).toBe(2);
  });

  it('should accept null turns in StatusEffect', () => {
    const effect: StatusEffect = {
      name: 'Poisoned',
      color: '#00ff00',
      turns: null
    };
    expect(effect.turns).toBeNull();
  });

  it('should accept valid WoundInfo', () => {
    const wound: WoundInfo = {
      iconClass: 'fas fa-droplet',
      colorClass: 'text-amber-600',
      title: 'Hurt',
      isDefeated: false
    };
    expect(wound.isDefeated).toBe(false);
    expect(wound.title).toBe('Hurt');
  });

  it('should accept valid Creature', () => {
    const creature: Creature = {
      id: 'goblin-15-0',
      name: 'Goblin',
      initiative: 15,
      hpCurrent: 10,
      hpMax: 15,
      isPlayer: false,
      isNpc: false,
      isBoss: false,
      isActive: true,
      statusEffects: [],
      woundInfo: null,
      iconOverrideClass: null,
      iconOverrideColor: null
    };
    expect(creature.isActive).toBe(true);
    expect(creature.statusEffects).toHaveLength(0);
  });

  it('should accept valid TrackerData', () => {
    const data: TrackerData = {
      round: 3,
      creatures: []
    };
    expect(data.round).toBe(3);
    expect(data.creatures).toHaveLength(0);
  });
});
