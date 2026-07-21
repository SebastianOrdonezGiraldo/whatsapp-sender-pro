import { describe, expect, it } from 'vitest';
import {
  buildGuideEmailContent,
  escapeHtml,
  normalizeRecipientEmail,
} from '../../supabase/functions/_shared/email-utils';

describe('email utils', () => {
  it('normaliza correos válidos y rechaza formatos inválidos', () => {
    expect(normalizeRecipientEmail('  cliente@example.com ')).toBe('cliente@example.com');
    expect(normalizeRecipientEmail('correo-invalido')).toBeNull();
    expect(normalizeRecipientEmail('')).toBeNull();
  });

  it('crea el correo de guía escapando contenido y conservando el enlace', () => {
    const content = buildGuideEmailContent({
      recipientName: '<Cliente>',
      guideNumber: '1234567890',
      carrierName: 'Servientrega',
      trackingUrl: 'https://example.com/rastreo?guia=1234567890&canal=email',
      senderName: 'Import Corporal Medical',
    });

    expect(content.subject).toContain('1234567890');
    expect(content.text).toContain('https://example.com/rastreo');
    expect(content.html).toContain('&lt;Cliente&gt;');
    expect(content.html).toContain('&amp;canal=email');
    expect(content.html).not.toContain('<Cliente>');
  });

  it('escapa caracteres peligrosos para HTML', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#039;');
  });
});
