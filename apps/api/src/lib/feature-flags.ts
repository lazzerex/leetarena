export function readBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  return fallback;
}

export interface SyncFeatureFlags {
  syncEnabled: boolean;
  extendedCatalogEnabled: boolean;
}

export function getSyncFeatureFlags(env: {
  LEETCODE_SYNC_ENABLED?: string;
  LEETCODE_EXTENDED_SYNC_ENABLED?: string;
}): SyncFeatureFlags {
  return {
    syncEnabled: readBooleanFlag(env.LEETCODE_SYNC_ENABLED, true),
    extendedCatalogEnabled: readBooleanFlag(env.LEETCODE_EXTENDED_SYNC_ENABLED, false),
  };
}

export function getPackFeatureFlags(env: { PACK_VARIETY_MODE_ENABLED?: string }) {
  return {
    varietyModeEnabled: readBooleanFlag(env.PACK_VARIETY_MODE_ENABLED, false),
  };
}

export function getBattleFeatureFlags(env: { RANKED_CORE_ONLY?: string }) {
  return {
    rankedCoreOnly: readBooleanFlag(env.RANKED_CORE_ONLY, true),
  };
}
