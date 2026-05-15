// ─── Rates Registry ──────────────────────────────────────────────────────────
// Versioned store of all Nigerian tax rates, brackets, thresholds, and categories.
// Loads bundled JSON rate files at module initialization. Zero dependencies.

import { RateNotFoundError } from '../errors';
import type { RateAuditResult, RateSourceInput, RateSourceMetadata, RateSourceValue } from '../types';

import vatRates from '../../../../shared/rates/vat_rates_2026.json';
import payeBrackets from '../../../../shared/rates/paye_brackets_2026.json';
import whtRates from '../../../../shared/rates/wht_rates_2026.json';
import pensionRates from '../../../../shared/rates/pension_rates_2026.json';
import statutoryRates from '../../../../shared/rates/statutory_2026.json';
import stateFilingRates from '../../../../shared/rates/state_filing_2026.json';
import sourceMetadata from '../../../../shared/rates/source_metadata_2026.json';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Any value that can be stored in the rates registry. */
export type RateValue = number | string | boolean | null | RateValue[] | { [key: string]: RateValue };

interface SourceMetadataRegistry {
  version: string;
  effectiveDate: string;
  lastReviewed: string;
  metadata: Record<string, RateSourceInput>;
}

// ─── Internal State ──────────────────────────────────────────────────────────

/** Bundled rate data keyed by domain prefix. */
const registry: Record<string, Record<string, unknown>> = {
  vat: vatRates as unknown as Record<string, unknown>,
  paye: payeBrackets as unknown as Record<string, unknown>,
  wht: whtRates as unknown as Record<string, unknown>,
  pension: pensionRates as unknown as Record<string, unknown>,
  statutory: statutoryRates as unknown as Record<string, unknown>,
  state_filing: stateFilingRates as unknown as Record<string, unknown>,
};

/** Process-lifetime custom overrides set via setCustom(). */
const customOverrides = new Map<string, RateValue>();

/** Process-lifetime source metadata for custom overrides. */
const customSourceOverrides = new Map<string, RateSourceInput>();

/** Source records for bundled rate keys and prefixes. */
const sourceRegistry = sourceMetadata as SourceMetadataRegistry;

// ─── Internal Helpers ───────────────────────────────────────────────────────

function readBundledRateValue(key: string): RateValue | undefined {
  const segments = key.split('.');
  const [domain, ...rest] = segments;
  const data = registry[domain];
  if (!data) {
    return undefined;
  }

  let current: unknown = data;
  for (const segment of rest) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current === undefined ? undefined : current as RateValue;
}

function flattenRegistryKeys(): string[] {
  return Object.entries(registry).flatMap(([domain, data]) => flattenRateValue(domain, data));
}

function flattenRateValue(prefix: string, value: unknown): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flattenRateValue(`${prefix}.${key}`, child));
}

function findSourceMetadataKey(key: string): string | null {
  const segments = key.split('.');

  for (let i = segments.length; i >= 1; i -= 1) {
    const candidate = segments.slice(0, i).join('.');
    if (sourceRegistry.metadata[candidate]) {
      return candidate;
    }
  }

  return null;
}

function sourceForKey(key: string): { metadataKey: string; source: RateSourceInput } | null {
  const metadataKey = findSourceMetadataKey(key);
  return metadataKey ? { metadataKey, source: sourceRegistry.metadata[metadataKey] } : null;
}

function defaultCustomOverrideSource(): RateSourceInput {
  return {
    sourceTitle: 'Process-local custom override',
    sourceUrl: '',
    sourceType: 'secondary_reference',
    legalBasis: 'Custom override set via rates.setCustom(); no legal source metadata supplied.',
    effectiveDate: getEffectiveDate(),
    lastReviewed: new Date().toISOString().slice(0, 10),
    verificationStatus: 'needs_review',
    confidence: 'low',
    notes: 'This value was supplied by the current process and is not part of the bundled source-backed rate registry.',
  };
}

function buildSourceMetadata(
  key: string,
  value: RateValue,
  metadataKey: string,
  source: RateSourceInput,
  overridden: boolean,
  warnings: string[] = [],
): RateSourceMetadata {
  return {
    key,
    value: value as RateSourceValue,
    metadataKey,
    overridden,
    warnings,
    ...source,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Look up a rate value by dot-separated key path.
 *
 * Examples:
 *   get("vat.standard.rate")       → 0.075
 *   get("paye.exemptionThreshold") → 800000
 *   get("wht.serviceTypes.professional.individual") → 0.05
 *   get("pension.minimumRates.employee") → 0.08
 *
 * Custom overrides (set via setCustom) take precedence over bundled data.
 *
 * @throws RateNotFoundError if the key path does not resolve to a value.
 */
export function get(key: string): RateValue {
  // Check custom overrides first
  if (customOverrides.has(key)) {
    return customOverrides.get(key)!;
  }

  const segments = key.split('.');
  if (segments.length < 2) {
    throw new RateNotFoundError(`Rate key "${key}" is invalid — must contain at least a domain prefix and a property (e.g., "vat.standard")`);
  }

  const [domain, ...rest] = segments;
  const data = registry[domain];
  if (!data) {
    throw new RateNotFoundError(`Rate domain "${domain}" not found — valid domains: ${Object.keys(registry).join(', ')}`);
  }

  let current: unknown = data;
  for (const segment of rest) {
    if (current === null || current === undefined || typeof current !== 'object') {
      throw new RateNotFoundError(`Rate key "${key}" not found — path segment "${segment}" is not navigable`);
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (current === undefined) {
    throw new RateNotFoundError(`Rate key "${key}" not found`);
  }

  return current as RateValue;
}

/**
 * Returns the version identifier of the currently loaded rates.
 * All bundled rate files share the same version.
 */
export function getVersion(): string {
  return vatRates.version;
}

/**
 * Returns the effective date of the currently loaded rates (ISO 8601).
 * All bundled rate files share the same effective date.
 */
export function getEffectiveDate(): string {
  return vatRates.effectiveDate;
}

/**
 * Explain a bundled rate with source metadata.
 *
 * Exact metadata is preferred. If a rate is covered by a source-backed prefix
 * (for example wht.serviceTypes.professional), the returned key and value stay
 * scoped to the requested rate while the source record comes from that prefix.
 *
 * @throws RateNotFoundError if the key path does not resolve to a value.
 */
export function explain(key: string): RateSourceMetadata {
  const value = get(key);

  if (customOverrides.has(key)) {
    const customSource = customSourceOverrides.get(key);
    const warnings = customSource
      ? []
      : [`${key}: custom override has no custom source metadata; verify before using in filings or user-facing advice.`];
    return buildSourceMetadata(
      key,
      value,
      key,
      customSource ?? defaultCustomOverrideSource(),
      true,
      warnings,
    );
  }

  const source = sourceForKey(key);

  if (!source) {
    throw new RateNotFoundError(`Rate source metadata for "${key}" not found`);
  }

  return buildSourceMetadata(key, value, source.metadataKey, source.source, false);
}

/**
 * Audit source metadata coverage for all bundled rate leaf keys.
 */
export function audit(): RateAuditResult {
  const rateKeys = flattenRegistryKeys();
  const missingMetadata = rateKeys.filter((key) => !sourceForKey(key));
  const orphanedMetadata = Object.keys(sourceRegistry.metadata).filter((key) => readBundledRateValue(key) === undefined);
  const coverageSources = rateKeys.map((key) => sourceForKey(key)?.source);

  const sources = Object.entries(sourceRegistry.metadata).map(([key, source]) => buildSourceMetadata(
    key,
    (readBundledRateValue(key) ?? null) as RateValue,
    key,
    source,
    false,
  ));

  return {
    version: sourceRegistry.version,
    effectiveDate: sourceRegistry.effectiveDate,
    lastReviewed: sourceRegistry.lastReviewed,
    totalKeys: rateKeys.length,
    verified: coverageSources.filter((source) => source?.verificationStatus === 'verified').length,
    needsReview: coverageSources.filter((source) => source?.verificationStatus === 'needs_review').length,
    disputed: coverageSources.filter((source) => source?.verificationStatus === 'disputed').length,
    missingMetadata,
    orphanedMetadata,
    sources,
  };
}

/**
 * Override specific rates for the current process lifetime.
 * Overrides are keyed by the same dot-separated path used in get().
 * Does not persist across process restarts.
 */
export function setCustom(overrides: Record<string, RateValue>): void {
  for (const [key, value] of Object.entries(overrides)) {
    customOverrides.set(key, value);
  }
}

/**
 * Attach source metadata to process-lifetime custom overrides.
 * This does not persist across process restarts.
 */
export function setCustomSources(sources: Record<string, RateSourceInput>): void {
  for (const [key, source] of Object.entries(sources)) {
    customSourceOverrides.set(key, source);
  }
}

/**
 * Clear all custom overrides, reverting to bundled rates.
 * Useful for testing.
 */
export function clearCustom(): void {
  customOverrides.clear();
  customSourceOverrides.clear();
}

/**
 * Reserved hook for future external rate refresh integrations.
 * The offline package uses bundled rates, so this is currently a no-op.
 */
export async function refresh(): Promise<void> {
  // Bundled rates are static in the offline package.
}
