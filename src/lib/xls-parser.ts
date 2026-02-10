import * as XLSX from 'xlsx';
import { normalizePhoneE164 } from './phone-utils';

export interface ParsedRow {
  guideNumber: string;
  recipient: string;
  phoneRaw: string;
  phoneE164: string;
  phoneValid: boolean;
  phoneReason?: string;
  status?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

const REQUIRED_COLUMNS = {
  guideNumber: ['numero de guia', 'número de guía', 'numero de guía', 'nro guia', 'guia'],
  recipient: ['destinatario', 'nombre destinatario', 'dest'],
  phone: ['numero de celular', 'número de celular', 'celular', 'telefono', 'teléfono', 'cel'],
  status: ['estado'],
};

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(h => h?.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '');
  for (const candidate of candidates) {
    const normCandidate = candidate.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const idx = normalized.findIndex(h => h.includes(normCandidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseXlsFile(data: ArrayBuffer): ParseResult {
  const errors: string[] = [];

  try {
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], errors: ['El archivo no contiene hojas de cálculo'] };
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

    if (jsonData.length < 2) {
      return { rows: [], errors: ['El archivo no contiene datos suficientes'] };
    }

    // Find header row (first row with recognizable columns)
    let headerRowIdx = -1;
    let colGuide = -1, colRecipient = -1, colPhone = -1, colStatus = -1;

    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] as string[];
      const headers = row.map(String);
      const gIdx = findColumn(headers, REQUIRED_COLUMNS.guideNumber);
      const rIdx = findColumn(headers, REQUIRED_COLUMNS.recipient);
      const pIdx = findColumn(headers, REQUIRED_COLUMNS.phone);

      if (gIdx !== -1 && rIdx !== -1 && pIdx !== -1) {
        headerRowIdx = i;
        colGuide = gIdx;
        colRecipient = rIdx;
        colPhone = pIdx;
        colStatus = findColumn(headers, REQUIRED_COLUMNS.status);
        break;
      }
    }

    if (headerRowIdx === -1) {
      return { rows: [], errors: ['No se encontraron las columnas requeridas: Número de Guía, Destinatario, Número de Celular'] };
    }

    const dataRows = jsonData.slice(headerRowIdx + 1);
    const rows: ParsedRow[] = [];

    for (const row of dataRows) {
      const r = row as string[];
      const guideNumber = String(r[colGuide] || '').trim();
      const recipient = String(r[colRecipient] || '').trim();
      const phoneRaw = String(r[colPhone] || '').trim();
      const status = colStatus !== -1 ? String(r[colStatus] || '').trim() : '';

      if (!guideNumber && !recipient && !phoneRaw) continue; // skip empty rows

      const { valid, phone, reason } = normalizePhoneE164(phoneRaw);

      rows.push({
        guideNumber,
        recipient,
        phoneRaw,
        phoneE164: phone,
        phoneValid: valid,
        phoneReason: reason,
        status,
      });
    }

    return { rows, errors };
  } catch (e) {
    return { rows: [], errors: [`Error al parsear el archivo: ${(e as Error).message}`] };
  }
}
