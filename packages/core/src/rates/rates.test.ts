import { describe, it, expect, beforeEach } from 'vitest';
import { get, getVersion, getEffectiveDate, explain, audit, setCustom, setCustomSources, clearCustom, refresh } from './index';
import { RateNotFoundError } from '../errors';

describe('Rates Registry', () => {
  beforeEach(() => {
    clearCustom();
  });

  // ─── getVersion / getEffectiveDate ───────────────────────────────────────

  describe('getVersion()', () => {
    it('returns the bundled rate version', () => {
      expect(getVersion()).toBe('2026.1.0');
    });
  });

  describe('getEffectiveDate()', () => {
    it('returns the bundled effective date', () => {
      expect(getEffectiveDate()).toBe('2026-01-01');
    });
  });

  // ─── explain() / audit() ─────────────────────────────────────────────────

  describe('explain()', () => {
    it('returns source metadata for an exact rate key', () => {
      const source = explain('vat.standard.rate');

      expect(source.key).toBe('vat.standard.rate');
      expect(source.value).toBe(0.075);
      expect(source.sourceTitle).toContain('Nigeria Tax Act');
      expect(source.sourceType).toBe('official_act');
      expect(source.verificationStatus).toBe('verified');
      expect(source.confidence).toBe('high');
    });

    it('falls back to the nearest source-backed prefix', () => {
      const source = explain('wht.serviceTypes.professional.individual');

      expect(source.key).toBe('wht.serviceTypes.professional.individual');
      expect(source.value).toBe(0.05);
      expect(source.sourceTitle).toContain('Deduction of Tax at Source');
      expect(source.legalBasis).toContain('professional services');
    });

    it('throws for unknown keys', () => {
      expect(() => explain('vat.nope.rate')).toThrow(RateNotFoundError);
    });

    it('marks custom override values as needs-review when no custom source is supplied', () => {
      setCustom({ 'vat.standard.rate': 0.10 });

      const source = explain('vat.standard.rate');

      expect(source.key).toBe('vat.standard.rate');
      expect(source.value).toBe(0.10);
      expect(source.overridden).toBe(true);
      expect(source.verificationStatus).toBe('needs_review');
      expect(source.confidence).toBe('low');
      expect(source.sourceTitle).toBe('Process-local custom override');
      expect(source.warnings.some((warning) => warning.includes('no custom source metadata'))).toBe(true);
    });

    it('uses custom source metadata for custom override values', () => {
      setCustom({ 'vat.standard.rate': 0.10 });
      setCustomSources({
        'vat.standard.rate': {
          sourceTitle: 'Internal tax desk memo',
          sourceUrl: 'https://example.com/internal-tax-memo',
          sourceType: 'secondary_reference',
          legalBasis: 'Internal test-only override approved for sandbox calculations',
          effectiveDate: '2026-05-16',
          lastReviewed: '2026-05-16',
          verificationStatus: 'verified',
          confidence: 'medium',
          notes: 'Used by tests to prove custom override source propagation.',
        },
      });

      const source = explain('vat.standard.rate');

      expect(source.value).toBe(0.10);
      expect(source.overridden).toBe(true);
      expect(source.sourceTitle).toBe('Internal tax desk memo');
      expect(source.verificationStatus).toBe('verified');
      expect(source.warnings).toEqual([]);
    });
  });

  describe('audit()', () => {
    it('summarizes local source metadata coverage', () => {
      const result = audit();

      expect(result.version).toBe(getVersion());
      expect(result.totalKeys).toBeGreaterThan(0);
      expect(result.verified).toBeGreaterThan(0);
      expect(result.missingMetadata).not.toContain('vat.standard.rate');
      expect(result.sources.some((source) => source.key === 'vat.standard.rate')).toBe(true);
    });
  });

  // ─── get() — VAT rates ──────────────────────────────────────────────────

  describe('get() — VAT rates', () => {
    it('returns standard VAT rate', () => {
      expect(get('vat.standard.rate')).toBe(0.075);
    });

    it('returns zero-rated category rate', () => {
      expect(get('vat.zeroRated.basic-food.rate')).toBe(0);
    });

    it('returns exempt category rate', () => {
      expect(get('vat.exempt.residential-rent.rate')).toBe(0);
    });

    it('returns inputVatRecoverable for zero-rated', () => {
      expect(get('vat.zeroRated.medicine.inputVatRecoverable')).toBe(true);
    });

    it('returns inputVatRecoverable for exempt', () => {
      expect(get('vat.exempt.financial-services.inputVatRecoverable')).toBe(false);
    });
  });

  // ─── get() — PAYE rates ─────────────────────────────────────────────────

  describe('get() — PAYE rates', () => {
    it('returns exemption threshold', () => {
      expect(get('paye.exemptionThreshold')).toBe(800000);
    });

    it('returns CRA fixed amount', () => {
      expect(get('paye.cra.fixedAmount')).toBe(200000);
    });

    it('returns CRA percent of gross', () => {
      expect(get('paye.cra.additionalPercentOfGross')).toBe(0.20);
    });

    it('returns bands array', () => {
      const bands = get('paye.bands');
      expect(Array.isArray(bands)).toBe(true);
      expect((bands as unknown[]).length).toBe(7);
    });
  });

  // ─── get() — WHT rates ──────────────────────────────────────────────────

  describe('get() — WHT rates', () => {
    it('returns professional individual rate', () => {
      expect(get('wht.serviceTypes.professional.individual')).toBe(0.05);
    });

    it('returns professional company rate', () => {
      expect(get('wht.serviceTypes.professional.company')).toBe(0.10);
    });

    it('returns rent individual rate', () => {
      expect(get('wht.serviceTypes.rent.individual')).toBe(0.10);
    });

    it('returns small company exemption threshold', () => {
      expect(get('wht.smallCompanyExemption.threshold')).toBe(2000000);
    });
  });

  // ─── get() — Pension rates ──────────────────────────────────────────────

  describe('get() — Pension rates', () => {
    it('returns employee minimum rate', () => {
      expect(get('pension.minimumRates.employee')).toBe(0.08);
    });

    it('returns employer minimum rate', () => {
      expect(get('pension.minimumRates.employer')).toBe(0.10);
    });
  });

  // ─── get() — Statutory rates ────────────────────────────────────────────

  describe('get() — Statutory rates', () => {
    it('returns NHF rate', () => {
      expect(get('statutory.nhf.rate')).toBe(0.025);
    });

    it('returns NSITF rate', () => {
      expect(get('statutory.nsitf.rate')).toBe(0.01);
    });

    it('returns ITF rate', () => {
      expect(get('statutory.itf.rate')).toBe(0.01);
    });
  });

  // ─── get() — State filing ───────────────────────────────────────────────

  describe('get() — State filing', () => {
    it('returns Lagos jurisdiction name', () => {
      expect(get('state_filing.jurisdictions.LA.name')).toBe('Lagos');
    });

    it('returns PAYE remittance deadline day', () => {
      expect(get('state_filing.payeRemittanceDeadline.dayOfMonth')).toBe(10);
    });
  });

  // ─── get() — Error cases ────────────────────────────────────────────────

  describe('get() — error cases', () => {
    it('throws RateNotFoundError for invalid domain', () => {
      expect(() => get('nonexistent.key')).toThrow(RateNotFoundError);
    });

    it('throws RateNotFoundError for invalid key path', () => {
      expect(() => get('vat.nonexistent.path')).toThrow(RateNotFoundError);
    });

    it('throws RateNotFoundError for key without domain separator', () => {
      expect(() => get('vat')).toThrow(RateNotFoundError);
    });

    it('throws RateNotFoundError for deeply invalid path', () => {
      expect(() => get('vat.standard.rate.deep.invalid')).toThrow(RateNotFoundError);
    });
  });

  // ─── setCustom() ────────────────────────────────────────────────────────

  describe('setCustom()', () => {
    it('overrides a rate value', () => {
      setCustom({ 'vat.standard.rate': 0.10 });
      expect(get('vat.standard.rate')).toBe(0.10);
    });

    it('override does not affect other keys', () => {
      setCustom({ 'vat.standard.rate': 0.10 });
      // Other keys still return bundled values
      expect(get('paye.exemptionThreshold')).toBe(800000);
    });

    it('multiple overrides work independently', () => {
      setCustom({
        'vat.standard.rate': 0.10,
        'paye.exemptionThreshold': 1000000,
      });
      expect(get('vat.standard.rate')).toBe(0.10);
      expect(get('paye.exemptionThreshold')).toBe(1000000);
    });

    it('clearCustom reverts to bundled values', () => {
      setCustom({ 'vat.standard.rate': 0.10 });
      expect(get('vat.standard.rate')).toBe(0.10);
      clearCustom();
      expect(get('vat.standard.rate')).toBe(0.075);
    });

    it('overrides are process-scoped (isolated per clear)', () => {
      setCustom({ 'wht.serviceTypes.professional.individual': 0.15 });
      expect(get('wht.serviceTypes.professional.individual')).toBe(0.15);
      clearCustom();
      expect(get('wht.serviceTypes.professional.individual')).toBe(0.05);
    });
  });

  // ─── refresh() ──────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('returns a resolved promise (stub)', async () => {
      await expect(refresh()).resolves.toBeUndefined();
    });
  });
});
