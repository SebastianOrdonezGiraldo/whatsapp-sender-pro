/**
 * Shared Carrier Detection Utility for Edge Functions
 * Detects shipping carrier based on guide number format
 */

export type Carrier = 'servientrega' | 'envia' | 'deprisa' | 'interrapidisimo';

export interface CarrierConfig {
  carrier: Carrier;
  templateName: string;
  trackingUrlTemplate: string;
  displayName: string;
}

const CARRIERS: Record<Carrier, CarrierConfig> = {
  servientrega: {
    carrier: 'servientrega',
    templateName: 'servientrega_tracking_notification',
    trackingUrlTemplate: 'https://www.servientrega.com/rastreo/multiple/{GUIA}',
    displayName: 'Servientrega',
  },
  envia: {
    carrier: 'envia',
    templateName: 'envia_tracking_notification',
    trackingUrlTemplate: 'https://envia.co/rastreo/?guia={GUIA}',
    displayName: 'Envia',
  },
  deprisa: {
    carrier: 'deprisa',
    templateName: 'deprisa_tracking_notification',
    trackingUrlTemplate: 'https://www.deprisa.com/rastreo/?guia={GUIA}',
    displayName: 'Deprisa',
  },
  interrapidisimo: {
    carrier: 'interrapidisimo',
    templateName: 'interrapidisimo_tracking_notificacion',
    trackingUrlTemplate: 'https://www.interrapidisimo.com/rastreo/?guia={GUIA}',
    displayName: 'InterRapidísimo',
  },
};

/**
 * Normalizes guide number for carrier detection.
 * Handles scientific notation (e.g. "7.00184E+11" from Excel).
 */
function normalizeGuideDigits(guideNumber: string): string {
  let str = String(guideNumber ?? '').trim();
  if (!str) return '';

  const sciRegex = /^([+-]?\d*\.?\d+)[eE]([+-]?\d+)$/;
  if (sciRegex.test(str)) {
    const num = Number.parseFloat(str);
    if (!Number.isNaN(num) && num <= Number.MAX_SAFE_INTEGER && num >= 0) {
      str = String(Math.round(num));
    }
  }

  return str.replace(/\D/g, '');
}

/**
 * Detect carrier based on guide number format
 *
 * Rules (misma lógica que frontend):
 * - Servientrega: Exactly 10 digits
 * - Deprisa: 12 digits, first 3 = 888
 * - InterRapidísimo: 12 digits, first 2 = 76 or first 3 = 700
 * - Envia: 12 digits, resto
 */
export function detectCarrier(guideNumber: string): CarrierConfig | null {
  const cleanGuide = normalizeGuideDigits(guideNumber);
  if (!cleanGuide) return null;

  if (cleanGuide.length === 10) {
    return CARRIERS.servientrega;
  }

  if (cleanGuide.length === 12) {
    if (cleanGuide.startsWith('888')) return CARRIERS.deprisa;
    if (cleanGuide.startsWith('76') || cleanGuide.startsWith('700')) return CARRIERS.interrapidisimo;
    return CARRIERS.envia;
  }

  return CARRIERS.servientrega; // backwards compatibility
}

/**
 * Get tracking URL for a guide number
 */
export function getTrackingUrl(guideNumber: string, carrier?: CarrierConfig | null): string {
  const carrierConfig = carrier || detectCarrier(guideNumber) || CARRIERS.servientrega;
  const cleanGuide = normalizeGuideDigits(guideNumber);
  return carrierConfig.trackingUrlTemplate.replace('{GUIA}', cleanGuide);
}

/**
 * Get carrier config by carrier code
 */
export function getCarrierConfig(carrier: Carrier): CarrierConfig {
  return CARRIERS[carrier];
}

