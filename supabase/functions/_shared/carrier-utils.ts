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
    templateName: 'interrapidisimo_tracking_notification',
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
 */
export function detectCarrier(guideNumber: string): CarrierConfig | null {
  if (!guideNumber) return null;

  // Remove spaces and non-digit characters
  const cleanGuide = guideNumber.replace(/\D/g, '');
  
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
    // InterRapidísimo: Starts with 700
    if (cleanGuide.startsWith('700')) {
      return CARRIERS.interrapidisimo;
    }
    // Envia: Does NOT start with 888 or 700
    return CARRIERS.envia;
  }

  // Unknown format - default to servientrega for backwards compatibility
  return CARRIERS.servientrega;
}

/**
 * Get tracking URL for a guide number
 */
export function getTrackingUrl(guideNumber: string, carrier?: CarrierConfig | null): string {
  const carrierConfig = carrier || detectCarrier(guideNumber) || CARRIERS.servientrega;
  const cleanGuide = guideNumber.replace(/\D/g, '');
  return carrierConfig.trackingUrlTemplate.replace('{GUIA}', cleanGuide);
}

/**
 * Get carrier config by carrier code
 */
export function getCarrierConfig(carrier: Carrier): CarrierConfig {
  return CARRIERS[carrier];
}

