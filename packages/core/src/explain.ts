// ─── Explanation Helpers ────────────────────────────────────────────────────
// Shared utilities for source-backed calculator explanations.

import type { RateSourceMetadata } from './types';
import { explain as explainRate } from './rates';

export interface SourceCollection {
  sources: RateSourceMetadata[];
  warnings: string[];
}

export function uniqueRateKeys(rateKeys: string[]): string[] {
  return [...new Set(rateKeys)];
}

export function collectRateSources(rateKeys: string[]): SourceCollection {
  const sources: RateSourceMetadata[] = [];
  const warnings: string[] = [];

  for (const key of uniqueRateKeys(rateKeys)) {
    try {
      const source = explainRate(key);
      sources.push(source);
      warnings.push(...source.warnings);
      if (source.verificationStatus !== 'verified') {
        warnings.push(`${key}: source status is ${source.verificationStatus} with ${source.confidence} confidence. ${source.notes}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${key}: source metadata unavailable. ${message}`);
    }
  }

  return { sources, warnings };
}
