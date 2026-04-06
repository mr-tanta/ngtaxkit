// ─── Rates Registry ──────────────────────────────────────────────────────────
// Versioned store of all Nigerian tax rates, brackets, thresholds, and categories.
// Loads bundled JSON rate files at module initialization. Zero dependencies.

import { RateNotFoundError } from '../errors';

import vatRates from '../../../../shared/rates/vat_rates_2026.json';
import payeBrackets from '../../../../shared/rates/paye_brackets_2026.json';
import whtRates from '../../../../shared/rates/wht_rates_2026.json';
import pensionRates from '../../../../shared/rates/pension_rates_2026.json';
import statutoryRates from '../../../../shared/rates/statutory_2026.json';
import stateFilingRates from '../../../../shared/rates/state_filing_2026.json';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Any value that can be stored in the rates registry. */
export type RateValue = number | string | boolean | null | RateValue[] | { [key: string]: RateValue };

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
 * Clear all custom overrides, reverting to bundled rates.
 * Useful for testing.
 */
export function clearCustom(): void {
  customOverrides.clear();
}

/**
 * Refresh rates from the Cloud API.
 * This is a stub in the offline-first Layer 1 package — actual implementation
 * lives in the Cloud API client (Layer 3).
 */
export async function refresh(): Promise<void> {
  // Stub: Cloud API only. In Layer 1, this is a no-op.
}
