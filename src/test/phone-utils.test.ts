import { describe, expect, it } from 'vitest';
import { normalizePhoneE164 } from '@/lib/phone-utils';

describe('normalizePhoneE164', () => {
  it('valida número Colombiano de 10 dígitos empezando con 3', () => {
    const result = normalizePhoneE164('3201234567');
    expect(result).toEqual({ valid: true, phone: '+573201234567' });
  });

  it('valida número con código de país 57 y 12 dígitos', () => {
    const result = normalizePhoneE164('573201234567');
    expect(result).toEqual({ valid: true, phone: '+573201234567' });
  });

  it('valida número con +57 y 12 dígitos', () => {
    const result = normalizePhoneE164('+573201234567');
    expect(result).toEqual({ valid: true, phone: '+573201234567' });
  });

  it('limpia caracteres no dígitos', () => {
    const result = normalizePhoneE164('(320) 123-4567');
    expect(result).toEqual({ valid: true, phone: '+573201234567' });
  });

  it('rechaza número vacío', () => {
    const result = normalizePhoneE164('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('vacío');
  });

  it('rechaza número con solo caracteres no dígitos', () => {
    const result = normalizePhoneE164('abc-xyz');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('No contiene dígitos');
  });

  it('rechaza número inválido con + pero sin 57', () => {
    const result = normalizePhoneE164('+1234567890');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Formato inválido');
  });

  it('rechaza número de 10 dígitos que no empieza con 3', () => {
    const result = normalizePhoneE164('5201234567');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('No se pudo normalizar');
  });
});
