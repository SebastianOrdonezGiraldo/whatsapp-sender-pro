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
 * Detect carrier based on guide number format
 * 
 * Rules:
 * - Servientrega: Exactly 10 digits
 * - Deprisa: 12 digits starting with 888
 * - InterRapidísimo: 12 digits starting with 700
 * - Envia: 12 digits NOT starting with 888 or 700
 * 
 * @param guideNumber - The guide/tracking number
 * @returns CarrierInfo or null if format doesn't match any carrier
 */
export function detectCarrier(guideNumber: string): CarrierInfo | null {
  if (!guideNumber) return null;

  // Remove spaces and non-digit characters
  const cleanGuide = guideNumber.replaceAll(/\D/g, '');
  
  if (!cleanGuide) return null;

  // Servientrega: Exactly 10 digits
  if (cleanGuide.length === 10) {
    return CARRIERS.servientrega;
  }

  // 12 digits: Check if Deprisa, InterRapidísimo, or Envia
  if (cleanGuide.length === 12) {
    // Deprisa: Starts with 888
    if (cleanGuide.startsWith('888')) {
      return CARRIERS.deprisa;
    }
    // InterRapidísimo: Starts with 700 o 76
    if (cleanGuide.startsWith('700') || cleanGuide.startsWith('76')) {
      return CARRIERS.interrapidisimo;
    }
    // Envia: Does NOT start with 888, 700 or 76
    return CARRIERS.envia;
  }

  // Unknown format
  return null;
}

/**
 * Get tracking URL for a guide number
 * @param guideNumber - The guide/tracking number
 * @returns Full tracking URL or null if carrier not detected
 */
export function getTrackingUrl(guideNumber: string): string | null {
  const carrierInfo = detectCarrier(guideNumber);
  if (!carrierInfo) return null;

  const cleanGuide = guideNumber.replaceAll(/\D/g, '');
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

