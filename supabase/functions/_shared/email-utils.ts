// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Shared between Deno edge functions and test environment

export interface GuideEmailContentInput {
  recipientName: string;
  guideNumber: string;
  carrierName: string;
  trackingUrl?: string | null;
  senderName: string;
}

export function normalizeRecipientEmail(value: unknown): string | null {
  const email = String(value ?? '').trim();

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return null;
  }

  return email;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildGuideEmailContent(input: GuideEmailContentInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Tu guía de envío ${input.guideNumber}`;
  const trackingText = input.trackingUrl
    ? `Puedes rastrear tu envío aquí: ${input.trackingUrl}`
    : 'Consulta el estado del envío directamente con la transportadora.';
  const trackingHtml = input.trackingUrl
    ? `<a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600">Rastrear envío</a>`
    : '<p>Consulta el estado del envío directamente con la transportadora.</p>';

  const text = [
    `Hola ${input.recipientName},`,
    '',
    'Tu guía de envío fue creada.',
    `Número de guía: ${input.guideNumber}`,
    `Transportadora: ${input.carrierName}`,
    trackingText,
    '',
    input.senderName,
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
        <h1 style="margin:0 0 18px;font-size:22px">Tu guía de envío fue creada</h1>
        <p>Hola ${escapeHtml(input.recipientName)},</p>
        <p>Estos son los datos para consultar tu envío:</p>
        <div style="margin:20px 0;padding:16px;border-radius:8px;background:#f1f5f9">
          <p style="margin:0 0 8px"><strong>Número de guía:</strong> ${escapeHtml(input.guideNumber)}</p>
          <p style="margin:0"><strong>Transportadora:</strong> ${escapeHtml(input.carrierName)}</p>
        </div>
        ${trackingHtml}
        <p style="margin:24px 0 0;color:#64748b;font-size:13px">${escapeHtml(input.senderName)}</p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
