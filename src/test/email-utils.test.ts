import { describe, expect, it } from 'vitest';
import {
  buildGuideEmailContent,
  escapeHtml,
  normalizeRecipientEmail,
} from '../../supabase/functions/_shared/email-utils';
import {
  EMAIL_LOGO_BASE64,
  EMAIL_LOGO_CID,
} from '../../supabase/functions/_shared/email-logo';

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
    expect(content.html).toContain(`src="cid:${EMAIL_LOGO_CID}"`);
    expect(EMAIL_LOGO_BASE64).toMatch(/^\/9j\//);
    expect(EMAIL_LOGO_BASE64.length).toBeGreaterThan(10_000);
    expect(content.html).toContain('https://www.instagram.com/importcorporalmedicalsas/');
    expect(content.html).toContain('https://wa.me/573163404723?text=Hola%20tengo%20una%20duda%20acerca%20de%20mi%20pedido');
    expect(content.html).toContain('Rastrear envío');
    expect(content.html).not.toContain('facebook.com');
    expect(content.text).toContain('Instagram: https://www.instagram.com/importcorporalmedicalsas/');
    expect(content.text).toContain('WhatsApp: https://wa.me/573163404723');
    expect(content.html).not.toContain('<Cliente>');
  });

  it('muestra una alternativa cuando no hay enlace de rastreo', () => {
    const content = buildGuideEmailContent({
      recipientName: 'Sebastian',
      guideNumber: '2258298191',
      carrierName: 'Servientrega',
      trackingUrl: null,
      senderName: 'Import Corporal Medical S.A.S.',
    });

    expect(content.html).toContain('Consulta el estado del envío directamente con la transportadora.');
    expect(content.html).not.toContain('Rastrear envío&nbsp;');
  });

  it('escapa caracteres peligrosos para HTML', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#039;');
  });
});
