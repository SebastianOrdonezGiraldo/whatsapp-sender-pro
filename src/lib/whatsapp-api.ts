import { WA_RUNTIME_CONFIG } from '@/config/whatsapp';

interface SendPayload {
  phoneE164: string;
  recipientName: string;
  guideNumber: string;
}

interface SendResult {
  ok: boolean;
  waMessageId: string | null;
  errorMessage: string | null;
}

const TEMPLATE_NAME = 'shipment_notification';
const TEMPLATE_LANG = 'es_CO';
const GRAPH_VERSION = 'v19.0';
const SENDER_NAME = 'Import Corporal Medical';

export async function sendWhatsAppMessage(payload: SendPayload): Promise<SendResult> {
  const { token, phoneNumberId } = WA_RUNTIME_CONFIG;

  if (!token || !phoneNumberId) {
    return { ok: false, waMessageId: null, errorMessage: 'Falta token o phone number id en config local' };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: payload.phoneE164.replace('+', ''),
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANG },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: payload.recipientName },
                { type: 'text', text: SENDER_NAME },
                { type: 'text', text: payload.guideNumber },
              ],
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (response.ok && data.messages?.[0]?.id) {
      return { ok: true, waMessageId: data.messages[0].id, errorMessage: null };
    }

    return {
      ok: false,
      waMessageId: null,
      errorMessage: data.error?.message || JSON.stringify(data),
    };
  } catch (error) {
    return {
      ok: false,
      waMessageId: null,
      errorMessage: (error as Error).message,
    };
  }
}

export async function delay(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}
