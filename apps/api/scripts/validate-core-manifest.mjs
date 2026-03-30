#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchProblemIndexRows,
  fetchQuestionData,
  mapDifficulty,
  mapWithConcurrency,
  normalizeString,
  readJson,
  writeJson,
} from './core-manifest-tools.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MANIFEST_PATH = path.resolve(__dirname, '../catalog/core-manifest.v1.json');
const DEFAULT_REPORT_PATH = path.resolve(
  __dirname,
  '../catalog/reports/core-manifest.validation-report.json'
);

function toIndexBySlug(rows) {
  const bySlug = new Map();

  for (const row of rows) {
    const slug = row?.stat?.question__title_slug;
    if (!slug || bySlug.has(slug)) continue;

    bySlug.set(slug, {
      title: row?.stat?.question__title ?? '',
      hidden: Boolean(row?.stat?.question__hide),
      paidOnly: Boolean(row?.paid_only ?? row?.stat?.question__paid_only),
      difficulty: mapDifficulty(Number(row?.difficulty?.level)),
    });
  }

  return bySlug;
}

function toTagSet(tags) {
  return new Set((Array.isArray(tags) ? tags : []).map((t) => String(t).trim()).filter(Boolean));
}

function areTagSetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function pushIssue(list, issue) {
  list.push(issue);
}

async function validateManifestFile({ manifestPath = DEFAULT_MANIFEST_PATH, reportPath = DEFAULT_REPORT_PATH } = {}) {
  const manifest = readJson(manifestPath);

  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.items)) {
    throw new Error('Manifest shape invalid: expected object with items array');
  }

  if (!manifest.catalog_version || typeof manifest.catalog_version !== 'string') {
    throw new Error('Manifest shape invalid: missing catalog_version');
  }

  const rows = await fetchProblemIndexRows();
  const indexBySlug = toIndexBySlug(rows);

  const blocking = [];
  const warnings = [];

  const seen = new Set();
  for (const item of manifest.items) {
    const slug = item?.title_slug;
    if (!slug || typeof slug !== 'string') {
      pushIssue(blocking, { type: 'invalid_entry', detail: 'Missing title_slug', item });
      continue;
    }

    if (seen.has(slug)) {
      pushIssue(blocking, { type: 'duplicate_slug', title_slug: slug });
      continue;
    }
    seen.add(slug);

    if (item.catalog_version !== manifest.catalog_version) {
      pushIssue(blocking, {
        type: 'catalog_version_mismatch',
        title_slug: slug,
        expected: manifest.catalog_version,
        actual: item.catalog_version,
      });
    }

    if (item.is_free !== true) {
      pushIssue(blocking, { type: 'is_free_false', title_slug: slug });
    }

    const indexRow = indexBySlug.get(slug);
    if (!indexRow) {
      pushIssue(blocking, { type: 'missing_slug', title_slug: slug });
      continue;
    }

    if (indexRow.hidden) {
      pushIssue(blocking, { type: 'hidden_problem', title_slug: slug });
    }

    if (indexRow.paidOnly) {
      pushIssue(blocking, { type: 'premium_problem_index', title_slug: slug });
    }
  }

  const checks = await mapWithConcurrency(manifest.items, 8, async (item) => {
    const slug = item.title_slug;
    try {
      const question = await fetchQuestionData(slug);
      return { slug, question, item };
    } catch (error) {
      return { slug, question: null, item, error: error instanceof Error ? error.message : String(error) };
    }
  });

  for (const check of checks) {
    const { slug, question, item, error } = check;

    if (error) {
      pushIssue(blocking, { type: 'graphql_error', title_slug: slug, detail: error });
      continue;
    }

    if (!question) {
      pushIssue(blocking, { type: 'missing_question', title_slug: slug });
      continue;
    }

    if (question.isPaidOnly) {
      pushIssue(blocking, { type: 'premium_problem_graphql', title_slug: slug });
    }

    if (normalizeString(question.title) !== normalizeString(item.title)) {
      pushIssue(blocking, {
        type: 'title_mismatch',
        title_slug: slug,
        expected: item.title,
        actual: question.title,
      });
    }

    if (question.difficulty !== item.difficulty) {
      pushIssue(blocking, {
        type: 'difficulty_mismatch',
        title_slug: slug,
        expected: item.difficulty,
        actual: question.difficulty,
      });
    }

    const manifestTags = toTagSet(item.tags);
    const liveTags = toTagSet(question.topicTags?.map((t) => t.slug) ?? []);

    if (!areTagSetsEqual(manifestTags, liveTags)) {
      pushIssue(warnings, {
        type: 'tags_mismatch',
        title_slug: slug,
        expected: [...manifestTags].sort(),
        actual: [...liveTags].sort(),
      });
    }

    const liveAcRate = typeof question.acRate === 'number' ? question.acRate / 100 : null;
    if (liveAcRate !== null) {
      const delta = Math.abs(Number(item.acceptance_rate ?? 0) - liveAcRate);
      if (delta >= 0.2) {
        pushIssue(warnings, {
          type: 'acceptance_rate_drift',
          title_slug: slug,
          expected: item.acceptance_rate,
          actual: Number(liveAcRate.toFixed(4)),
          delta: Number(delta.toFixed(4)),
        });
      }
    }
  }

  const report = {
    catalog_version: manifest.catalog_version,
    validated_at: new Date().toISOString(),
    manifest_path: manifestPath,
    total_items: manifest.items.length,
    blocking_issues: blocking,
    warning_issues: warnings,
    summary: {
      blocking_count: blocking.length,
      warning_count: warnings.length,
      passed: blocking.length === 0,
    },
  };

  writeJson(reportPath, report);

  console.log(`[manifest:validate] Items: ${report.total_items}`);
  console.log(`[manifest:validate] Blocking issues: ${blocking.length}`);
  console.log(`[manifest:validate] Warnings: ${warnings.length}`);
  console.log(`[manifest:validate] Report written to ${reportPath}`);

  if (blocking.length > 0) {
    throw new Error('[manifest:validate] Blocking mismatches detected. Seed promotion is blocked.');
  }

  return report;
}

async function main() {
  await validateManifestFile();
}

const directRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (directRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

export { validateManifestFile, DEFAULT_MANIFEST_PATH, DEFAULT_REPORT_PATH };
