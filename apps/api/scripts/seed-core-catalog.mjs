#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  computeCardStats,
  loadDevVars,
  mapWithConcurrency,
  requiredEnv,
  writeJson,
  fetchQuestionData,
  readJson,
} from './core-manifest-tools.mjs';
import { validateManifestFile } from './validate-core-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFEST_PATH = path.resolve(__dirname, '../catalog/core-manifest.v1.json');
const VALIDATION_REPORT_PATH = path.resolve(
  __dirname,
  '../catalog/reports/core-manifest.validation-report.json'
);
const SEED_SUMMARY_PATH = path.resolve(
  __dirname,
  '../catalog/reports/core-manifest.seed-summary.json'
);

async function upsertCards(supabaseUrl, serviceRoleKey, cards) {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/cards?on_conflict=title_slug`;
  const chunkSize = 50;
  let includeCatalogVersion = true;

  for (let i = 0; i < cards.length; i += chunkSize) {
    const rawChunk = cards.slice(i, i + chunkSize);
    const chunk = includeCatalogVersion
      ? rawChunk
      : rawChunk.map(({ catalog_version: _catalogVersion, ...rest }) => rest);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      const text = await res.text();

      if (includeCatalogVersion && text.includes('catalog_version')) {
        includeCatalogVersion = false;
        i -= chunkSize;
        console.warn('[seed] cards.catalog_version column not found. Retrying seed without catalog_version payload.');
        continue;
      }

      throw new Error(`Supabase upsert failed on chunk ${i / chunkSize + 1}: ${text}`);
    }
  }
}

async function main() {
  loadDevVars(path.resolve(__dirname, '../.dev.vars'));

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const manifest = readJson(MANIFEST_PATH);

  console.log('[seed] Validating manifest before promotion...');
  const report = await validateManifestFile({
    manifestPath: MANIFEST_PATH,
    reportPath: VALIDATION_REPORT_PATH,
  });

  console.log(`[seed] Manifest validated: ${report.total_items} items.`);
  console.log('[seed] Resolving live metadata for card stats...');

  const enriched = await mapWithConcurrency(manifest.items, 8, async (item) => {
    const question = await fetchQuestionData(item.title_slug);
    if (!question) {
      throw new Error(`[seed] Missing question data for slug: ${item.title_slug}`);
    }
    if (question.isPaidOnly) {
      throw new Error(`[seed] Paid-only question detected during seed: ${item.title_slug}`);
    }

    const tags = Array.isArray(question.topicTags)
      ? question.topicTags.map((t) => t.slug).filter(Boolean)
      : item.tags;
    const acceptanceRate = typeof question.acRate === 'number'
      ? question.acRate / 100
      : Number(item.acceptance_rate ?? 0.5);
    const difficulty =
      question.difficulty === 'Easy' || question.difficulty === 'Hard'
        ? question.difficulty
        : 'Medium';

    return {
      titleSlug: question.titleSlug ?? item.title_slug,
      title: question.title ?? item.title,
      difficulty,
      acRate: Number(Math.max(0, Math.min(1, acceptanceRate)).toFixed(4)),
      tags,
    };
  });

  const records = enriched.map((q) => {
    const acRate = Math.max(0, Math.min(1, Number(q.acRate ?? 0.5)));
    const difficulty = q.difficulty === 'Easy' || q.difficulty === 'Hard'
      ? q.difficulty
      : 'Medium';
    const tags = Array.isArray(q.tags) ? q.tags : [];
    const stats = computeCardStats({
      titleSlug: q.titleSlug,
      difficulty,
      acRate,
      tags,
    });

    return {
      title_slug: q.titleSlug,
      catalog_type: 'core',
      is_seeded_core: true,
      title: q.title,
      difficulty,
      acceptance_rate: Number(acRate.toFixed(4)),
      catalog_version: manifest.catalog_version,
      element_type: stats.elementType,
      base_atk: stats.baseAtk,
      base_def: stats.baseDef,
      base_hp: stats.baseHp,
      rarity: stats.rarity,
      is_blind75: stats.isBlind75,
      tags,
    };
  });

  console.log(`[seed] Upserting ${records.length} core cards into public.cards...`);
  await upsertCards(supabaseUrl, serviceRoleKey, records);

  writeJson(SEED_SUMMARY_PATH, {
    seeded_at: new Date().toISOString(),
    catalog_version: manifest.catalog_version,
    total_cards: records.length,
  });

  console.log('[seed] Core catalog seed complete.');
  console.log(`[seed] Catalog version: ${manifest.catalog_version}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
