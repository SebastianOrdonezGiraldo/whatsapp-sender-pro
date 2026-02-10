/**
 * Normalize Colombian phone numbers to E.164 format (+57XXXXXXXXXX)
 */
export function normalizePhoneE164(raw: string): { valid: boolean; phone: string; reason?: string } {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, phone: '', reason: 'Número vacío' };
  }

  // Remove all non-digit characters except leading +
  let cleaned = raw.trim().replace(/[^\d+]/g, '');

  if (!cleaned) {
    return { valid: false, phone: '', reason: 'No contiene dígitos' };
  }

  // If starts with +, validate
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.startsWith('57') && digits.length === 12) {
      return { valid: true, phone: cleaned };
    }
    return { valid: false, phone: cleaned, reason: `Formato inválido: ${cleaned}` };
  }

  // Remove + if any remaining
  cleaned = cleaned.replace(/\+/g, '');

  // 10 digits starting with 3 → Colombian mobile
  if (cleaned.length === 10 && cleaned.startsWith('3')) {
    return { valid: true, phone: `+57${cleaned}` };
  }

  // 12 digits starting with 57 → add +
  if (cleaned.length === 12 && cleaned.startsWith('57')) {
    return { valid: true, phone: `+${cleaned}` };
  }

  // 11 digits starting with 57 → might be missing a digit
  if (cleaned.startsWith('57') && cleaned.length === 12) {
    return { valid: true, phone: `+${cleaned}` };
  }

  return { valid: false, phone: cleaned, reason: `No se pudo normalizar: ${raw}` };
}
