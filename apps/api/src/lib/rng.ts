import type { Rarity, PackType } from '@leetarena/types';
import { RARITY_DROP_RATES } from '@leetarena/types';

export interface PackConfig {
  size: number;
  rarityOverrides?: Partial<Record<Rarity, number>>;
  guaranteedRarity?: Rarity;
  elementFilter?: string; // topic pack
  blind75Only?: boolean;
}

export const PACK_CONFIGS: Record<PackType, PackConfig> = {
  daily: { size: 4, rarityOverrides: { common: 0.75, rare: 0.25, epic: 0, legendary: 0 } },
  core: { size: 5 },
  topic: { size: 4, elementFilter: undefined },
  blind75: { size: 5, blind75Only: true, rarityOverrides: { common: 0, rare: 0.45, epic: 0.4, legendary: 0.15 } },
  contest: { size: 5, guaranteedRarity: 'epic' },
  company: { size: 5 },
};

/**
 * Weighted random selection of a rarity.
 */
export function rollRarity(
  overrides?: Partial<Record<Rarity, number>>,
  forceLegendary = false
): Rarity {
  if (forceLegendary) return 'legendary';

  const rates = { ...RARITY_DROP_RATES, ...overrides };
  const rand = Math.random();
  let cumulative = 0;

  const order: Rarity[] = ['legendary', 'epic', 'rare', 'common'];
  for (const rarity of order) {
    cumulative += rates[rarity] ?? 0;
    if (rand <= cumulative) return rarity;
  }
  return 'common';
}

/**
 * Roll rarities for a full pack.
 * @param packType the pack type
 * @param packsSinceLegendary pity counter — forces legendary at 10
 */
export function rollPackRarities(
  packType: PackType,
  packsSinceLegendary: number
): Rarity[] {
  const config = PACK_CONFIGS[packType];
  const forceLegendary = packsSinceLegendary >= 10;
  const rarities: Rarity[] = [];

  for (let i = 0; i < config.size; i++) {
    // First slot gets pity legendary if triggered
    if (i === 0 && forceLegendary) {
      rarities.push('legendary');
    } else if (config.guaranteedRarity && i === 0) {
      rarities.push(config.guaranteedRarity);
    } else {
      rarities.push(rollRarity(config.rarityOverrides));
    }
  }

  return rarities;
}
