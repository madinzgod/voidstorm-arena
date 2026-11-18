// Sector upgrades: the refit draft offered between waves. Clearing a wave
// (short of the final victory) pauses the assault and offers three of these
// at random; the pilot picks one with the 1-3 keys or a click, and every pick
// stacks for the rest of the run, so two runs rarely fly the same ship.
// This module owns the catalogue, the draft and the card layout the HUD
// draws and the conductor hit-tests.

import { ARENA_WIDTH } from './config.js';

export const UPGRADE_CARD_WIDTH = 302;
export const UPGRADE_CARD_HEIGHT = 172;
export const UPGRADE_CARD_GAP = 26;
export const UPGRADE_CARDS_TOP = 322;

export function upgradeCardRect(index) {
  const totalWidth = UPGRADE_CARD_WIDTH * 3 + UPGRADE_CARD_GAP * 2;
  const left = (ARENA_WIDTH - totalWidth) / 2 + index * (UPGRADE_CARD_WIDTH + UPGRADE_CARD_GAP);
  return { x: left, y: UPGRADE_CARDS_TOP, width: UPGRADE_CARD_WIDTH, height: UPGRADE_CARD_HEIGHT };
}

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'RAPID CYCLER',
    short: 'Rapid Cycler',
    color: '#ffe95e',
    blurb: 'Your cannon cycles 25% faster. More lead in the air, more kills per wave.',
    apply(state) { state.fireIntervalScale *= 0.75; },
  },
  {
    id: 'twin',
    name: 'TWIN CANNONS',
    short: 'Twin Cannons',
    color: '#29f4ff',
    blurb: 'A second parallel cannon joins every shot you fire, slightly angled outward.',
    apply(state) { state.cannonStreams += 1; },
  },
  {
    id: 'heavy',
    name: 'HEAVY ROUNDS',
    short: 'Heavy Rounds',
    color: '#ff9f2e',
    blurb: 'Every bullet hits twice as hard. Bulwarks and the Warden feel this one.',
    apply(state) { state.bulletDamage += 1; },
  },
  {
    id: 'ion',
    name: 'ION THRUSTERS',
    short: 'Ion Thrusters',
    color: '#3dffc8',
    blurb: 'Fly 12% faster, and your dash recharges 30% sooner. Harder to corner.',
    apply(state) {
      state.speedScale *= 1.12;
      state.dashCooldownScale *= 0.7;
    },
  },
  {
    id: 'plating',
    name: 'VOID PLATING',
    short: 'Void Plating',
    color: '#4dff88',
    blurb: 'Bolt on +25 max hull, and patch 25 points of damage right now.',
    apply(state) {
      state.player.maxHull += 25;
      state.player.hull = Math.min(state.player.maxHull, state.player.hull + 25);
    },
  },
  {
    id: 'magnet',
    name: 'SALVAGE MAGNET',
    short: 'Salvage Magnet',
    color: '#b46bff',
    blurb: 'Pickups fly to your ship from twice as far away. Repairs find you.',
    apply(state) { state.magnetScale *= 2; },
  },
];

export function rollUpgradeChoices(state) {
  const pool = [...UPGRADES];
  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const index = Math.floor(state.rng() * pool.length);
    picks.push(pool.splice(index, 1)[0]);
  }
  return picks;
}

export function applyUpgrade(state, upgrade) {
  upgrade.apply(state);
  state.upgradesTaken.push(upgrade.short);
}
