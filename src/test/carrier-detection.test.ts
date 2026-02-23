import { describe, expect, it } from 'vitest';
import { detectCarrier, getCarrierInfo, getTrackingUrl } from '@/lib/carrier-detection';

describe('detectCarrier', () => {
  describe('Servientrega detection', () => {
    it('detects 10-digit guide numbers', () => {
      const result = detectCarrier('1234567890');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('servientrega');
      expect(result?.displayName).toBe('Servientrega');
    });
  });

  describe('Deprisa detection', () => {
    it('detects 12-digit guide numbers starting with 888', () => {
      const result = detectCarrier('888123456789');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('deprisa');
      expect(result?.displayName).toBe('Deprisa');
    });
  });

  describe('InterRapidísimo detection', () => {
    it('detects 12-digit guide numbers starting with 700 (first 3 digits)', () => {
      const result = detectCarrier('700184198166');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('interrapidisimo');
      expect(result?.displayName).toBe('InterRapidísimo');
      expect(result?.templateName).toBe('interrapidisimo_tracking_notificacion');
    });

    it('detects guide 700184205491 as InterRapidísimo', () => {
      const result = detectCarrier('700184205491');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('interrapidisimo');
      expect(result?.displayName).toBe('InterRapidísimo');
    });

    it('handles scientific notation from Excel (7.00184E+11)', () => {
      const result = detectCarrier('7.00184205491E+11');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('interrapidisimo');
    });

    it('handles numeric input from Excel', () => {
      const result = detectCarrier(700184205491);
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('interrapidisimo');
    });

    it('detects guide numbers with spaces', () => {
      const result = detectCarrier('700 184 198 166');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('interrapidisimo');
    });

    it('detects guide numbers with dashes', () => {
      const result = detectCarrier('700-184-198-166');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('interrapidisimo');
    });
  });

  describe('Envia detection', () => {
    it('detects 12-digit guide numbers NOT starting with 888 or 700', () => {
      const result = detectCarrier('123456789012');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('envia');
      expect(result?.displayName).toBe('Envia');
    });

    it('does not confuse with InterRapidísimo when starting with 701', () => {
      const result = detectCarrier('701123456789');
      expect(result).not.toBeNull();
      expect(result?.carrier).toBe('envia');
    });
  });

  describe('Invalid formats', () => {
    it('returns null for empty string', () => {
      expect(detectCarrier('')).toBeNull();
    });

    it('returns null for 11-digit numbers', () => {
      expect(detectCarrier('12345678901')).toBeNull();
    });

    it('returns null for 13-digit numbers', () => {
      expect(detectCarrier('1234567890123')).toBeNull();
    });
  });
});

describe('getCarrierInfo', () => {
  it('returns correct info for interrapidisimo', () => {
    const info = getCarrierInfo('interrapidisimo');
    expect(info.carrier).toBe('interrapidisimo');
    expect(info.displayName).toBe('InterRapidísimo');
    expect(info.templateName).toBe('interrapidisimo_tracking_notificacion');
    expect(info.trackingUrlTemplate).toBe('https://www.interrapidisimo.com/rastreo/?guia={GUIA}');
  });
});

describe('getTrackingUrl', () => {
  it('generates correct tracking URL for InterRapidísimo', () => {
    const url = getTrackingUrl('700184198166');
    expect(url).toBe('https://www.interrapidisimo.com/rastreo/?guia=700184198166');
  });

  it('generates tracking URL with cleaned guide number', () => {
    const url = getTrackingUrl('700-184-198-166');
    expect(url).toBe('https://www.interrapidisimo.com/rastreo/?guia=700184198166');
  });
});
