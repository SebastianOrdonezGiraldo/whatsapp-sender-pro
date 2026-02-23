/**
 * Carrier Detection Utility
 * Automatically detects shipping carrier based on guide number format
 */

export type Carrier = 'servientrega' | 'envia' | 'deprisa' | 'interrapidisimo';

export interface CarrierInfo {
  carrier: Carrier;
  templateName: string;
  trackingUrlTemplate: string;
  displayName: string;
}

const CARRIERS: Record<Carrier, CarrierInfo> = {
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
 * Handles: strings, numbers (from Excel), scientific notation (e.g. "7.00184E+11").
 * @returns digits-only string or empty string
 */
function normalizeGuideDigits(guideNumber: string | number): string {
  let str = String(guideNumber ?? '').trim();
  if (!str) return '';

  // Handle scientific notation (Excel may export long numbers as "7.00184E+11")
  const sciRegex = /^([+-]?\d*\.?\d+)[eE]([+-]?\d+)$/;
  if (sciRegex.test(str)) {
    const num = Number.parseFloat(str);
    if (!Number.isNaN(num) && num <= Number.MAX_SAFE_INTEGER && num >= 0) {
      str = String(Math.round(num));
    }
  }

  return str.replaceAll(/\D/g, '');
}

/**
 * Detect carrier based on guide number format
 *
 * Rules (using first 2–3 digits for 12-digit guides):
 * - Servientrega: Exactly 10 digits
 * - Deprisa: 12 digits, first 3 = 888
 * - InterRapidísimo: 12 digits, first 3 = 700 or first 2 = 76 (e.g. 760000488530)
 * - Envia: 12 digits, first 3 NOT 888 or 700, and NOT starting with 76
 *
 * @param guideNumber - The guide/tracking number (string or number from Excel)
 * @returns CarrierInfo or null if format doesn't match any carrier
 */
export function detectCarrier(guideNumber: string | number): CarrierInfo | null {
  const cleanGuide = normalizeGuideDigits(guideNumber);
  if (!cleanGuide) return null;

  // Servientrega: Exactly 10 digits
  if (cleanGuide.length === 10) {
    return CARRIERS.servientrega;
  }

  // 12 digits: use first 2–3 digits to determine carrier
  if (cleanGuide.length === 12) {
    const prefix3 = cleanGuide.substring(0, 3);
    const prefix2 = cleanGuide.substring(0, 2);
    if (prefix3 === '888') return CARRIERS.deprisa;
    if (prefix3 === '700' || prefix2 === '76') return CARRIERS.interrapidisimo;
    return CARRIERS.envia;
  }

  return null;
}

/**
 * Get tracking URL for a guide number
 * @param guideNumber - The guide/tracking number
 * @returns Full tracking URL or null if carrier not detected
 */
export function getTrackingUrl(guideNumber: string | number): string | null {
  const carrierInfo = detectCarrier(guideNumber);
  if (!carrierInfo) return null;

  const cleanGuide = normalizeGuideDigits(guideNumber);
  return carrierInfo.trackingUrlTemplate.replace('{GUIA}', cleanGuide);
}

/**
 * Get carrier info by carrier code
 * @param carrier - Carrier code
 * @returns CarrierInfo
 */
export function getCarrierInfo(carrier: Carrier): CarrierInfo {
  return CARRIERS[carrier];
}

/**
 * Get all supported carriers
 * @returns Array of all carrier information
 */
export function getAllCarriers(): CarrierInfo[] {
  return Object.values(CARRIERS);
}

/**
 * Validate if a guide number has a valid format for any carrier
 * @param guideNumber - The guide/tracking number
 * @returns true if valid format for any carrier
 */
export function isValidGuideFormat(guideNumber: string): boolean {
  return detectCarrier(guideNumber) !== null;
}

/**
 * Get carrier display name
 * @param carrier - Carrier code
 * @returns Display name or 'Desconocido'
 */
export function getCarrierDisplayName(carrier: Carrier | null | undefined): string {
  if (!carrier) return 'Desconocido';
  return CARRIERS[carrier]?.displayName || 'Desconocido';
}

