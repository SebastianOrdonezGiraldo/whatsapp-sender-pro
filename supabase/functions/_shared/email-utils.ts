// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Shared between Deno edge functions and test environment
import { EMAIL_LOGO_SRC } from './email-logo.ts';
import { EMAIL_ICON_SRCS } from './email-icons.ts';

export interface GuideEmailContentInput {
  recipientName: string;
  guideNumber: string;
  carrierName: string;
  trackingUrl?: string | null;
  senderName: string;
}

const INSTAGRAM_URL = 'https://www.instagram.com/importcorporalmedicalsas/';
const WHATSAPP_URL = 'https://wa.me/573163404723?text=Hola%20tengo%20una%20duda%20acerca%20de%20mi%20pedido';

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
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto">
                    <tr>
                      <td align="center" bgcolor="#78b52c" style="border-radius:8px;background-color:#78b52c;background-image:linear-gradient(90deg,#78b52c 0%,#94c62e 100%);box-shadow:0 6px 14px rgba(120,181,44,.24)">
                        <a href="${escapeHtml(input.trackingUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:700;line-height:20px;text-decoration:none">Rastrear envío&nbsp;&nbsp;&#8594;</a>
                      </td>
                    </tr>
                  </table>`
    : `<p style="margin:0;color:#52606d;font-size:14px;line-height:22px;text-align:center">Consulta el estado del envío directamente con la transportadora.</p>`;

  const recipientName = escapeHtml(input.recipientName);
  const guideNumber = escapeHtml(input.guideNumber);
  const carrierName = escapeHtml(input.carrierName);
  const senderName = escapeHtml(input.senderName);

  const text = [
    `Hola ${input.recipientName},`,
    '',
    '¡Tu guía de envío fue creada!',
    'Tu pedido ya está en camino. Aquí tienes los datos para que puedas rastrear tu envío.',
    `Número de guía: ${input.guideNumber}`,
    `Transportadora: ${input.carrierName}`,
    trackingText,
    '',
    `¿Tienes dudas sobre tu envío? Escríbenos por WhatsApp: ${WHATSAPP_URL}`,
    `Instagram: ${INSTAGRAM_URL}`,
    '',
    input.senderName,
    'Gracias por confiar en nosotros.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${subject}</title>
    <style>
      @media only screen and (max-width:620px) {
        .email-shell { width:100% !important; }
        .email-padding { padding-left:16px !important; padding-right:16px !important; }
        .content-card { width:100% !important; }
        .benefit-cell { display:inline-block !important; width:50% !important; box-sizing:border-box !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;color:#263241;font-family:'Trebuchet MS',Arial,sans-serif;-webkit-font-smoothing:antialiased">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Tu pedido ya está en camino. Consulta aquí tu guía ${guideNumber}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f4f6" style="width:100%;background-color:#f3f4f6">
      <tr>
        <td align="center" class="email-padding" style="padding:24px 12px 32px">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" class="email-shell" style="width:620px;max-width:620px;background:#ffffff;border:1px solid #e8eaed;border-radius:16px;box-shadow:0 12px 35px rgba(41,48,60,.10);overflow:hidden">
            <tr>
              <td align="center" style="padding:25px 24px 23px;border-bottom:1px solid #dce8c8;background-color:#ffffff">
                <img src="${EMAIL_LOGO_SRC}" width="300" alt="Import Corporal Medical S.A.S." style="display:block;width:300px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none">
              </td>
            </tr>
            <tr>
              <td align="center" class="email-padding" style="padding:8px 36px 0;background-color:#fbfcfb">
                <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" class="content-card" style="width:520px;max-width:520px;background:#ffffff;border:1px solid #eceef0;border-radius:15px;box-shadow:0 9px 24px rgba(54,61,71,.10);overflow:hidden">
                  <tr>
                    <td align="center" style="padding:20px 34px 10px">
                      <img src="${EMAIL_ICON_SRCS.packageCheck}" width="76" height="76" alt="Guía creada" style="display:block;width:76px;height:76px;margin:0 auto;border:0;outline:none;text-decoration:none">
                      <h1 style="margin:14px 0 18px;color:#263241;font-size:25px;line-height:32px;font-weight:700;letter-spacing:-.3px">¡Tu guía de envío fue creada!</h1>
                      <p style="margin:0 0 7px;color:#4b5563;font-size:14px;line-height:22px">Hola <strong style="color:#7a2496">${recipientName}</strong>,</p>
                      <p style="margin:0;color:#4b5563;font-size:14px;line-height:22px">Tu pedido ya está en camino. Aquí tienes los datos para que puedas rastrear tu envío.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 42px 10px">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#fafafa" style="width:100%;background:#fafafa;border:1px solid #f0f0f1;border-radius:12px;overflow:hidden">
                        <tr>
                          <td width="62" align="center" style="padding:13px 8px 13px 16px;border-bottom:1px solid #eceef0">
                            <img src="${EMAIL_ICON_SRCS.document}" width="46" height="46" alt="Número de guía" style="display:block;width:46px;height:46px;border:0;outline:none;text-decoration:none">
                          </td>
                          <td style="padding:13px 16px 13px 4px;border-bottom:1px solid #eceef0">
                            <p style="margin:0 0 3px;color:#69727d;font-size:12px;line-height:16px">Número de guía:</p>
                            <p style="margin:0;color:#72258f;font-size:15px;line-height:19px;font-weight:700">${guideNumber}</p>
                          </td>
                        </tr>
                        <tr>
                          <td width="62" align="center" style="padding:13px 8px 13px 16px">
                            <img src="${EMAIL_ICON_SRCS.truck}" width="46" height="46" alt="Transportadora" style="display:block;width:46px;height:46px;border:0;outline:none;text-decoration:none">
                          </td>
                          <td style="padding:13px 16px 13px 4px">
                            <p style="margin:0 0 3px;color:#69727d;font-size:12px;line-height:16px">Transportadora:</p>
                            <p style="margin:0;color:#72258f;font-size:15px;line-height:19px;font-weight:700">${carrierName}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 34px 16px">
                      ${trackingHtml}
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 24px 18px">
                      <p style="margin:0;color:#4f5965;font-size:12px;line-height:19px">
                        <img src="${EMAIL_ICON_SRCS.whatsapp}" width="20" height="20" alt="WhatsApp" style="display:inline-block;width:20px;height:20px;border:0;vertical-align:middle">&nbsp;
                        ¿Tienes dudas con tu envío?
                        <a href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" style="color:#4f5965;font-weight:700;text-decoration:none">Contáctanos, estamos para ayudarte.</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#f4f8e9" style="background:#f4f8e9;border-top:1px solid #e7efd6;padding:14px 8px">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td width="25%" align="center" valign="top" class="benefit-cell" style="padding:5px 4px;color:#39434e">
                            <img src="${EMAIL_ICON_SRCS.shield}" width="38" height="38" alt="Seguridad" style="display:block;width:38px;height:38px;margin:0 auto;border:0">
                            <div style="margin-top:5px;font-size:10px;line-height:13px;font-weight:700">Seguridad<br>en cada envío</div>
                          </td>
                          <td width="25%" align="center" valign="top" class="benefit-cell" style="padding:5px 4px;color:#39434e">
                            <img src="${EMAIL_ICON_SRCS.stopwatch}" width="38" height="38" alt="Entregas puntuales" style="display:block;width:38px;height:38px;margin:0 auto;border:0">
                            <div style="margin-top:5px;font-size:10px;line-height:13px;font-weight:700">Entregas<br>puntuales</div>
                          </td>
                          <td width="25%" align="center" valign="top" class="benefit-cell" style="padding:5px 4px;color:#39434e">
                            <img src="${EMAIL_ICON_SRCS.box}" width="38" height="38" alt="Empaque seguro" style="display:block;width:38px;height:38px;margin:0 auto;border:0">
                            <div style="margin-top:5px;font-size:10px;line-height:13px;font-weight:700">Empaque<br>seguro</div>
                          </td>
                          <td width="25%" align="center" valign="top" class="benefit-cell" style="padding:5px 4px;color:#39434e">
                            <img src="${EMAIL_ICON_SRCS.heart}" width="38" height="38" alt="Comprometidos contigo" style="display:block;width:38px;height:38px;margin:0 auto;border:0">
                            <div style="margin-top:5px;font-size:10px;line-height:13px;font-weight:700">Comprometidos<br>contigo</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 28px 8px;background-color:#fbfcfb">
                <p style="margin:0 0 10px;color:#3e4752;font-size:12px;line-height:18px">Síguenos en nuestras redes</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto">
                  <tr>
                    <td style="padding:0 5px">
                      <a href="${INSTAGRAM_URL}" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style="display:block;width:34px;height:34px;text-decoration:none">
                        <img src="${EMAIL_ICON_SRCS.instagram}" width="34" height="34" alt="Instagram" style="display:block;width:34px;height:34px;border:0;outline:none;text-decoration:none">
                      </a>
                    </td>
                    <td style="padding:0 5px">
                      <a href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style="display:block;width:34px;height:34px;text-decoration:none">
                        <img src="${EMAIL_ICON_SRCS.whatsapp}" width="34" height="34" alt="WhatsApp" style="display:block;width:34px;height:34px;border:0;outline:none;text-decoration:none">
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 70px 22px;background-color:#fbfcfb">
                <div style="height:1px;line-height:1px;background:#bfd58b;font-size:1px">&nbsp;</div>
                <p style="margin:12px 0 2px;color:#78a92e;font-size:12px;line-height:17px;font-weight:700">${senderName}</p>
                <p style="margin:0;color:#4b5563;font-size:11px;line-height:17px">Gracias por confiar en nosotros. <img src="${EMAIL_ICON_SRCS.heart}" width="15" height="15" alt="" style="display:inline-block;width:15px;height:15px;border:0;vertical-align:middle"></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
